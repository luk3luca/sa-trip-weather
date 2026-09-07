#!/usr/bin/env node
/**
 * Scarica da Open-Meteo (modelli ECMWF IFS 0.25° e NOAA GFS 0.25°) i dati
 * giornalieri e orari per le mete del viaggio e scrive public/data/weather.json.
 *
 * Uso:  npm run fetch
 * Nota: le coordinate dei punti non urbani sono indicative (±1 km): la griglia
 *       dei modelli è ~25 km, la precisione locale è comunque limitata.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'weather.json')
const WINDOW = { start: '2026-09-11', end: '2026-09-19' }
const TZ = 'Africa/Johannesburg'
const MODELS = {
  ecmwf_ifs025: {
    label: 'ECMWF IFS 0.25°', short: 'ECMWF', url: 'https://www.ecmwf.int/',
    note: 'Centro europeo (Reading, UK) — il riferimento a medio termine',
  },
  gfs_seamless: {
    label: 'NOAA GFS 0.25°', short: 'GFS', url: 'https://www.noaa.gov/',
    note: 'Centro statunitense NCEP — orizzonte 16 giorni',
  },
  icon_seamless: {
    label: 'DWD ICON', short: 'ICON', url: 'https://www.dwd.de/EN/',
    note: 'Germania (DWD) — orizzonte breve (~7 giorni): utile solo per i primi giorni',
  },
  gem_seamless: {
    label: 'CMC GEM', short: 'GEM', url: 'https://eccc-msc.github.io/open-data/',
    note: 'Canada (CMC) — orizzonte ~10 giorni, probabilità da ensemble',
  },
  jma_gsm: {
    label: 'JMA GSM', short: 'JMA', url: 'https://www.jma.go.jp/jma/indexe.html',
    note: 'Giappone (JMA) — orizzonte ~11 giorni',
  },
}

// id, nome, zona, tipo, lat, lon, coordinate indicative?, ruolo nell'itinerario
const STOPS = [
  { id: 'jnb', name: 'Johannesburg · OR Tambo', zone: 'transito', kind: 'aeroporto', lat: -26.139, lon: 28.246, approx: false, role: '12 · arrivo 6:30 — 19 · volo 22:00 per l’Italia' },
  { id: 'blyde', name: 'Blyde Canyon · Three Rondavels', zone: 'kruger', kind: 'belvedere', lat: -24.563, lon: 30.807, approx: true, role: '12 · tappa panoramica (~4,5–5 h da JNB)' },
  { id: 'hazyview', name: 'Hazyview', zone: 'kruger', kind: 'paese', lat: -25.044, lon: 31.127, approx: true, role: '12 · pernottamento (porta del Kruger)' },
  { id: 'phabeni', name: 'Phabeni Gate', zone: 'kruger', kind: 'ingresso parco', lat: -25.024, lon: 31.151, approx: true, role: '13 · ingresso nel Kruger National Park' },
  { id: 'skukuza', name: 'Skukuza Rest Camp', zone: 'kruger', kind: 'campo SANParks', lat: -24.981, lon: 31.591, approx: true, role: '13 · safari + Night Drive al tramonto' },
  { id: 'lowersabie', name: 'Lower Sabie Rest Camp', zone: 'kruger', kind: 'campo SANParks', lat: -25.125, lon: 31.917, approx: true, role: '14 · Morning Walk + Sunset Dam' },
  { id: 'satara', name: 'Satara Rest Camp', zone: 'kruger', kind: 'campo SANParks', lat: -24.391, lon: 31.781, approx: true, role: '15 · praterie e big cats + Sunset Drive' },
  { id: 'hoedspruit', name: 'Hoedspruit · Eastgate Apt', zone: 'kruger', kind: 'aeroporto', lat: -24.368, lon: 31.049, approx: true, role: '16 · volo 14:00 → Città del Capo' },
  { id: 'capetown', name: 'Città del Capo', zone: 'cape', kind: 'città', lat: -33.925, lon: 18.424, approx: false, role: '16 sera – 19 · base al Capo' },
  { id: 'tablemountain', name: 'Table Mountain', zone: 'cape', kind: 'belvedere', lat: -33.962, lon: 18.41, approx: true, role: '17/19 · funivia (consigliata mattina del 19)' },
  { id: 'capepoint', name: 'Cape Point · Capo di Buona Speranza', zone: 'cape', kind: 'belvedere', lat: -34.356, lon: 18.497, approx: true, role: '18 · tour penisola (giornata intera)' },
]

const DAILY_VARS =
  'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max'
const HOURLY_VARS =
  'temperature_2m,weather_code,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m'

async function getJSON(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'sa-trip-weather/0.1' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
      return getJSON(url, attempt + 1)
    }
    throw err
  }
}

function inWindow(d) {
  return d >= WINDOW.start && d <= WINDOW.end
}

function hhmm(iso) {
  return typeof iso === 'string' && iso.length >= 16 ? iso.slice(11, 16) : null
}

const out = {
  schema: 2,
  fetchedAt: new Date().toISOString(),
  timezone: TZ,
  window: WINDOW,
  models: Object.fromEntries(
    Object.entries(MODELS).map(([id, m]) => [id, { ...m, horizonDaily: null, horizonHourly: null }]),
  ),
  stops: [],
  daily: {},
  hourly: {},
}

for (const s of STOPS) {
  const stopOut = {
    id: s.id, name: s.name, zone: s.zone, kind: s.kind,
    lat: s.lat, lon: s.lon, approx: s.approx, elevation: null, role: s.role,
  }
  let elevation = null
  for (const [modelId] of Object.entries(MODELS)) {
    const params = new URLSearchParams({
      latitude: String(s.lat), longitude: String(s.lon),
      daily: DAILY_VARS, hourly: HOURLY_VARS,
      timezone: TZ, forecast_days: '16',
      wind_speed_unit: 'kmh', precipitation_unit: 'mm',
      models: modelId,
    })
    const url = `https://api.open-meteo.com/v1/forecast?${params}`
    process.stdout.write(`  ${s.id} / ${modelId} … `)
    const body = await getJSON(url)
    const D = body.daily ?? {}
    const H = body.hourly ?? {}
    elevation = elevation ?? body.elevation ?? null

    // Giornaliero
    for (let i = 0; i < (D.time ?? []).length; i++) {
      const date = D.time[i]
      if (!inWindow(date)) continue
      out.daily[s.id] ??= {}
      out.daily[s.id][date] ??= { astro: { sunrise: null, sunset: null, uv: null } }
      const slot = out.daily[s.id][date]
      slot.astro.sunrise = slot.astro.sunrise ?? hhmm(D.sunrise?.[i])
      slot.astro.sunset = slot.astro.sunset ?? hhmm(D.sunset?.[i])
      slot.astro.uv = slot.astro.uv ?? (D.uv_index_max?.[i] ?? null)
      slot[modelId] = {
        code: D.weather_code?.[i] ?? null,
        tmax: D.temperature_2m_max?.[i] ?? null,
        tmin: D.temperature_2m_min?.[i] ?? null,
        precip: D.precipitation_sum?.[i] ?? null,
        prob: D.precipitation_probability_max?.[i] ?? null,
        wind: D.wind_speed_10m_max?.[i] ?? null,
        gusts: D.wind_gusts_10m_max?.[i] ?? null,
      }
    }
    // Orario
    const n = (H.time ?? []).length
    const rec = { time: [], temp: [], code: [], precip: [], prob: [], wind: [], gusts: [] }
    for (let i = 0; i < n; i++) {
      const ts = H.time[i]
      if (!ts || !inWindow(ts.slice(0, 10))) continue
      rec.time.push(ts)
      rec.temp.push(H.temperature_2m?.[i] ?? null)
      rec.code.push(H.weather_code?.[i] ?? null)
      rec.precip.push(H.precipitation?.[i] ?? null)
      rec.prob.push(H.precipitation_probability?.[i] ?? null)
      rec.wind.push(H.wind_speed_10m?.[i] ?? null)
      rec.gusts.push(H.wind_gusts_10m?.[i] ?? null)
    }
    for (let i = 0; i < rec.time.length; i += 24) {
      const date = rec.time[i].slice(0, 10)
      out.hourly[s.id] ??= {}
      out.hourly[s.id][date] ??= {}
      out.hourly[s.id][date][modelId] = {
        time: rec.time.slice(i, i + 24),
        temp: rec.temp.slice(i, i + 24),
        code: rec.code.slice(i, i + 24),
        precip: rec.precip.slice(i, i + 24),
        prob: rec.prob.slice(i, i + 24),
        wind: rec.wind.slice(i, i + 24),
        gusts: rec.gusts.slice(i, i + 24),
      }
    }
    const days = Object.keys(out.daily[s.id] ?? {}).length
    // Copertura reale del modello: ultima data con valori non nulli su questa meta
    for (const [date, slot] of Object.entries(out.daily[s.id] ?? {})) {
      if (slot[modelId]?.tmax != null && (!out.models[modelId].horizonDaily || date > out.models[modelId].horizonDaily)) {
        out.models[modelId].horizonDaily = date
      }
    }
    for (let i = rec.time.length - 1; i >= 0; i--) {
      if (rec.temp[i] != null) {
        const d = rec.time[i].slice(0, 10)
        if (!out.models[modelId].horizonHourly || d > out.models[modelId].horizonHourly) {
          out.models[modelId].horizonHourly = d
        }
        break
      }
    }
    process.stdout.write(`ok (${days} giorni, ${rec.time.length} ore)\n`)
    await new Promise((r) => setTimeout(r, 250))
  }
  stopOut.elevation = elevation
  out.stops.push(stopOut)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(out))
console.log(`\nScritto ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB) — snapshot ${out.fetchedAt}`)
