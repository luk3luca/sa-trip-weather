#!/usr/bin/env node
// Validazione dello snapshot meteo. Due usi:
//   1. importata da fetch-weather.mjs → valida in memoria PRIMA di scrivere il file;
//   2. CLI (npm run validate, o in CI come gate): valida il file su disco:
//      se fallisce esce con codice 1 → niente commit, niente deploy → il sito
//      resta sull'ultimo deploy valido e il file precedente è intatto.
// Regole "hard" = blocco; "soft" = solo avviso.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const DEFAULT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'weather.json')
const WINDOW = { start: '2026-09-11', end: '2026-09-19' }
const CORE_MODELS = ['ecmwf_ifs025', 'gfs_seamless'] // il minimo vitale per ogni meta/giorno

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

export function validateWeather(data) {
  const errors = []
  const warnings = []
  if (!data || typeof data !== 'object') return { errors: ['dati non sono un oggetto JSON'], warnings: [] }
  if (data.schema !== 2) errors.push(`schema inatteso: ${String(data.schema)} (atteso 2)`)
  if (!data.fetchedAt) warnings.push('fetchedAt mancante')
  if (!Array.isArray(data.stops) || data.stops.length === 0) errors.push('nessuna meta (stops vuoto)')
  if (data.stops && data.stops.length !== 11) warnings.push(`mete: ${data.stops.length} (attese 11)`)

  const dates = []
  const start = new Date(WINDOW.start + 'T00:00:00Z')
  const end = new Date(WINDOW.end + 'T00:00:00Z')
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10))

  for (const stop of data.stops ?? []) {
    if (!data.daily?.[stop.id] || !data.hourly?.[stop.id]) {
      errors.push(`${stop.id}: daily/hourly mancanti`)
      continue
    }
    let dailyOk = 0
    for (const date of dates) {
      const slot = data.daily[stop.id]?.[date]
      if (!slot) {
        errors.push(`${stop.id} ${date}: slot giornaliero mancante`)
        continue
      }
      for (const m of CORE_MODELS) {
        const rec = slot[m]
        if (!rec || !isNum(rec.tmax) || !isNum(rec.tmin)) {
          errors.push(`${stop.id} ${date}: ${m} senza max/min validi`)
          continue
        }
        dailyOk++
        if (rec.tmax < -20 || rec.tmax > 50 || rec.tmin < -30 || rec.tmin > 45) {
          errors.push(`${stop.id} ${date}: temperatura fuori range plausibile (${rec.tmax}°/${rec.tmin}°)`)
        }
        if (isNum(rec.precip) && rec.precip < -0.01) errors.push(`${stop.id} ${date}: pioggia negativa`)
      }
    }
    if (dailyOk < dates.length * CORE_MODELS.length - 2) {
      errors.push(`${stop.id}: copertura giornaliera insufficiente (${dailyOk}/${dates.length * CORE_MODELS.length} valori ECMWF+GFS)`)
    }
    let hourlyOk = 0
    for (const date of dates) {
      const slot = data.hourly[stop.id]?.[date]
      if (!slot) {
        errors.push(`${stop.id} ${date}: slot orario mancante`)
        continue
      }
      for (const m of CORE_MODELS) {
        const rec = slot[m]
        if (!rec || rec.time.length !== 24) {
          errors.push(`${stop.id} ${date}: ${m} orario senza 24 ore`)
          continue
        }
        if (!rec.temp.some(isNum)) {
          warnings.push(`${stop.id} ${date}: ${m} orario senza temperature valide`)
          continue
        }
        hourlyOk++
        for (const v of [...rec.temp, ...rec.precip, ...rec.wind, ...rec.gusts]) {
          if (v !== null && !isNum(v)) {
            errors.push(`${stop.id} ${date}: valori non numerici nell'orario ${m}`)
            break
          }
        }
      }
    }
    if (hourlyOk < dates.length * CORE_MODELS.length - 2) {
      errors.push(`${stop.id}: copertura oraria insufficiente (${hourlyOk}/${dates.length * CORE_MODELS.length})`)
    }
  }
  // JSON serializzabile senza cicli/stranezze: tentativo di round-trip
  try {
    JSON.stringify(data)
  } catch (e) {
    errors.push(`dati non serializzabili: ${e.message}`)
  }
  return { errors, warnings }
}

// CLI
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const file = process.argv[2] ?? DEFAULT_PATH
  let data
  try {
    data = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(`❌ Impossibile leggere ${file}: ${e.message}`)
    process.exit(1)
  }
  const { errors, warnings } = validateWeather(data)
  if (warnings.length) console.warn(`⚠️ ${warnings.length} avviso/i:\n  - ${warnings.join('\n  - ')}`)
  if (errors.length) {
    console.error(`❌ VALIDAZIONE FALLITA (${errors.length}):\n  - ${errors.join('\n  - ')}`)
    process.exit(1)
  }
  console.log(`✅ validazione OK — ${data.stops?.length ?? 0} mete, ${datesCount(data)} giorni, snapshot ${data.fetchedAt}`)
}

function datesCount(data) {
  const first = data.stops?.[0]
  return first ? Object.keys(data.daily?.[first.id] ?? {}).length : 0
}