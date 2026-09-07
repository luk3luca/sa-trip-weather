// Sa Trip Weather — pagina unica: itinerario giorno per giorno con meteo orario.
import './styles.css'
import type {
  WeatherFile, StopDef, DayRec, HourRec, Zone,
} from './types'
import { DAYS, VERDICTS, type DayPlan } from './trip'
import { codeInfo, renderHourlyChart, renderDailyOverlay } from './charts'
import { initTripMap } from './map'
import { MODEL_ORDER, type ModelId } from './types'

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

const ZONE_META: Record<Zone, { label: string; cls: string }> = {
  kruger: { label: 'Kruger', cls: 'kruger' },
  cape: { label: 'Città del Capo', cls: 'cape' },
  transito: { label: 'Trasferimento', cls: 'transito' },
}

const KIND_ICON: Record<string, string> = {
  'aeroporto': '✈️',
  'belvedere': '🏞️',
  'paese': '🏘️',
  'ingresso parco': '🦏',
  'campo SANParks': '🏕️',
  'città': '🏙️',
}

let DATA: WeatherFile | null = null
let ACTIVE_TAB = 'itinerario'

// ---------- helper generici ----------

const $ = (sel: string, root: ParentNode = document): HTMLElement | null => root.querySelector(sel)
const $$ = (sel: string, root: ParentNode = document): HTMLElement[] => Array.from(root.querySelectorAll(sel))

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmt0(v: number | null): string {
  return v === null || !Number.isFinite(v) ? '—' : String(Math.round(v))
}

function fmt1(v: number | null): string {
  return v === null || !Number.isFinite(v) ? '—' : v.toFixed(1).replace('.', ',')
}

function dayOf(date: string): DayPlan {
  return DAYS.find((d) => d.date === date) ?? DAYS[0]
}

function modelLabel(id: ModelId): string {
  return DATA?.models?.[id]?.label ?? id
}

function shortLabel(id: ModelId): string {
  return DATA?.models?.[id]?.short ?? modelLabel(id)
}

function stopById(id: string): StopDef | null {
  return DATA?.stops.find((s) => s.id === id) ?? null
}

function dayRec(stopId: string, date: string, model: ModelId): DayRec | null {
  return DATA?.daily?.[stopId]?.[date]?.[model] ?? null
}

/** Primo modello con valori reali per la meta/il giorno, in ordine di preferenza. */
function dayRecBest(stopId: string, date: string): DayRec | null {
  for (const m of MODEL_ORDER) {
    const r = dayRec(stopId, date, m)
    if (r && r.tmax != null) return r
  }
  return dayRec(stopId, date, MODEL_ORDER[0])
}

function astroOf(stopId: string, date: string) {
  return DATA?.daily?.[stopId]?.[date]?.astro ?? null
}

/** Il modello orario preferito (ECMWF → GFS → GEM → JMA → ICON), con dati reali per quel giorno. */
function hourPick(stopId: string, date: string): { model: ModelId; hr: HourRec } | null {
  const slot = DATA?.hourly?.[stopId]?.[date]
  if (!slot) return null
  for (const m of MODEL_ORDER) {
    const rec = slot[m]
    if (rec && rec.time.length && rec.temp.some((t) => t !== null)) return { model: m, hr: rec }
  }
  return null
}

function daySky(stopId: string, date: string): { emoji: string; label: string } | null {
  const pick = hourPick(stopId, date)
  if (pick) {
    const at14 = pick.hr.time.findIndex((t) => t.endsWith('T14:00'))
    const code = at14 >= 0 ? pick.hr.code[at14] : null
    if (code !== null) {
      const ci = codeInfo(code)
      return { emoji: ci.emoji, label: ci.label }
    }
  }
  const rec = dayRecBest(stopId, date)
  if (rec?.code !== null && rec?.code !== undefined) {
    const ci = codeInfo(rec.code)
    return { emoji: ci.emoji, label: ci.label }
  }
  return null
}

// ---------- bootstrap ----------

async function boot(): Promise<void> {
  const app = $('#app')!
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <span class="logo">🌍</span>
        <div>
          <h1>Sudafrica <em>11–19 settembre 2026</em></h1>
          <p class="sub">Kruger &amp; Città del Capo — meteo giorno per giorno, ora per ora, tappa per tappa</p>
        </div>
      </div>
      <div class="snap">📡 snapshot <b data-role="fetched">…</b> · <span data-role="models">…</span></div>
    </header>
    <nav class="tabs" role="tablist">
      <button class="tab active" data-tab="itinerario" role="tab">🗓️ Itinerario giorno per giorno</button>
      <button class="tab" data-tab="confronto" role="tab">⚖️ Kruger vs Città del Capo</button>
      <button class="tab" data-tab="modelli" role="tab">📊 Modelli a confronto</button>
      <button class="tab" data-tab="mappa" role="tab">🗺️ Mappa delle mete</button>
      <button class="tab" data-tab="mete" role="tab">📍 Tutte le mete</button>
      <button class="tab" data-tab="fonti" role="tab">📚 Fonti e metodo</button>
    </nav>
    <main>
      <div id="route-strip" class="route-strip"></div>
      <section id="sec-itinerario" class="pane active"></section>
      <section id="sec-confronto" class="pane"></section>
      <section id="sec-modelli" class="pane"></section>
      <section id="sec-mappa" class="pane"></section>
      <section id="sec-mete" class="pane"></section>
      <section id="sec-fonti" class="pane"></section>
    </main>
    <footer>
      <p id="foot"></p>
    </footer>`

  try {
    const res = await fetch('data/weather.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    DATA = (await res.json()) as WeatherFile
  } catch {
    app.querySelector<HTMLElement>('.topbar')!.insertAdjacentHTML(
      'afterend',
      `<div class="error-banner">⚠️ Dati meteo non trovati (data/weather.json). Esegui <code>npm run fetch</code> nella cartella del progetto per scaricarli da Open-Meteo, poi ricarica la pagina.</div>`,
    )
    return
  }

  const fetched = new Date(DATA.fetchedAt)
  const fetchedStr = fetched.toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
  $$('[data-role="fetched"]').forEach((n) => (n.textContent = fetchedStr))
  $$('[data-role="models"]').forEach((n) => (n.textContent = `${Object.keys(DATA!.models).length} modelli`))
  $('#route-strip')!.innerHTML = routeStrip()
  $('#sec-itinerario')!.innerHTML = sectionItinerario()
  $('#sec-confronto')!.innerHTML = sectionConfronto()
  $('#sec-modelli')!.innerHTML = sectionModelli()
  $('#sec-mappa')!.innerHTML = sectionMappa()
  $('#sec-mete')!.innerHTML = sectionMete()
  $('#sec-fonti')!.innerHTML = sectionFonti()
  const pz = DATA.window.end
  const da = new Date().toISOString().slice(0, 10)
  const daysAhead = Math.max(0, Math.round((new Date(pz + 'T12:00:00Z').getTime() - new Date(da + 'T12:00:00Z').getTime()) / 86400000))
  const footNote = `Previsioni a medio termine: affidabilità buona fino al 16 settembre; dal 17 il passaggio del fronte ha un’incertezza di ±1–2 giorni tra i modelli (ultimo giorno coperto: ${pz}, tra ${daysAhead} giorni). Ricontrolla con <code>npm run fetch</code> a 48–72 h dalle tappe che contano.`
  $('#foot')!.innerHTML = footNote
  wireEvents()
}

// ---------- route strip (panoramica del viaggio) ----------

function routeStrip(): string {
  let html = ''
  DAYS.forEach((d, i) => {
    const zone = pillFor(d.zoneLabel)
    const num = d.date.slice(8, 10)
    html += `<button class="strip-chip" data-goto="${d.date}" title="${esc(d.dow)} ${d.date.slice(8, 10)} settembre — ${esc(d.title)}">
        <span class="s-num">${num}</span><span class="s-dow">${d.dow.slice(0, 3)}</span><span class="s-dot ${zone.cls}"></span>
      </button>`
    if (i < DAYS.length - 1) {
      const fly = d.date === '2026-09-11' || d.date === '2026-09-16' || d.date === '2026-09-19'
      html += `<span class="strip-arrow">${fly ? '✈️' : '→'}</span>`
    }
  })
  return html
}

function zoneOf(label: string): { label: string; cls: string } {
  if (label.includes('Capo')) return ZONE_META.cape
  if (label.includes('Kruger')) return ZONE_META.kruger
  return ZONE_META.transito
}

function pillFor(label: string): { label: string; cls: string } {
  if (label === 'In volo') return { label: 'In volo', cls: 'transito' }
  if (label === 'Kruger → Capo') return { label: 'Kruger ✈ Capo', cls: 'mix' }
  return zoneOf(label)
}

// ---------- sezione itinerario ----------

function sectionItinerario(): string {
  const inner = DAYS.map(dayCard).join('')
  return `<div class="intro-note">🌦️ I numeri vengono dai 5 modelli globali (ECMWF, GFS, GEM, JMA, ICON — snapshot del ${new Date(DATA!.fetchedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}): nei primi giorni la fiducia è alta, nelle giornate 17–19 resta da verificare la data esatta del fronte. Ogni tappa ha il grafico delle 24 ore: passa il mouse per i valori.</div>
    <div class="days">${inner}</div>`
}

function dayCard(day: DayPlan): string {
  const num = day.date.slice(8, 10)
  const month = MONTHS[Number(day.date.slice(5, 7)) - 1]
  const z = pillFor(day.zoneLabel)
  const stopsHtml = day.stopIds.length
    ? `<div class="stops">${day.stopIds.map((sid) => stopCard(sid, day.date)).join('')}</div>`
    : `<p class="no-stops">✈️ Nessuna meta sudafricana oggi: il meteo locale tornerà utile da domani mattina.</p>`
  return `
    <article class="day" id="day-${day.date}">
      <div class="day-head">
        <div class="date-badge"><span class="dow">${day.dow}</span><span class="num">${num}</span><span class="mon">${month}</span></div>
        <div class="day-title"><h2>${esc(day.title)}</h2><div class="route">📍 ${esc(day.route)}</div></div>
        <span class="pill ${z.cls}">${z.label}</span>
      </div>
      ${day.intro.map((p) => `<p class="intro">${esc(p)}</p>`).join('')}
      ${day.tips.length ? `<ul class="tips">${day.tips.map((t) => `<li><span>${t.icon}</span>${esc(t.text)}</li>`).join('')}</ul>` : ''}
      ${stopsHtml}
    </article>`
}

function stopCard(stopId: string, date: string): string {
  const stop = stopById(stopId)
  if (!stop) return ''
  const rec = dayRecBest(stopId, date)
  const astro = astroOf(stopId, date)
  const sky = daySky(stopId, date)
  const z = ZONE_META[stop.zone]
  const chips: string[] = []
  if (rec) {
    const wet = rec.precip !== null && rec.precip > 0.02
    chips.push(`<span class="chip ${wet ? 'wet' : ''}">💧 ${rec.precip === null ? '—' : rec.precip > 0.02 ? `${fmt1(rec.precip)} mm` : 'asciutto'}${rec.prob !== null ? ` <i>(${fmt0(rec.prob)}%)</i>` : ''}</span>`)
    if (rec.wind !== null) chips.push(`<span class="chip">🌬 ${fmt0(rec.wind)} km/h${rec.gusts !== null && rec.gusts > rec.wind + 5 ? ` · raffiche ${fmt0(rec.gusts)}` : ''}</span>`)
  }
  if (astro?.sunrise) chips.push(`<span class="chip">☀️ alba ${astro.sunrise}</span>`)
  if (astro?.sunset) chips.push(`<span class="chip">🌇 tramonto ${astro.sunset}</span>`)
  if (astro?.uv !== null && astro?.uv !== undefined) chips.push(`<span class="chip">☀️ UV ${fmt0(astro.uv)}</span>`)
  if (stop.elevation) chips.push(`<span class="chip alt">▲ ~${fmt0(stop.elevation)} m</span>`)

  const main = rec
    ? `<div class="main-t"><span class="tmax">${fmt0(rec.tmax)}°</span><span class="slash">/</span><span class="tmin">${fmt0(rec.tmin)}°</span></div>`
    : '<div class="main-t dim">dati non disponibili</div>'

  return `
    <div class="stop" data-stop="${stop.id}">
      <div class="stop-head">
        <div class="stop-ico">${KIND_ICON[stop.kind] ?? '📍'}</div>
        <div class="stop-id"><b>${esc(stop.name)}</b><span class="kind">${esc(stop.kind)}</span><span class="pill mini ${z.cls}">${z.label}</span></div>
        <div class="stop-sky">${sky ? `<span class="sky-emoji ${codeInfo(null).cls}">${sky.emoji}</span><span class="sky-lab">${esc(sky.label)}</span>` : ''}${main}</div>
      </div>
      <div class="stop-chips">${chips.join('')}</div>
      <details open>
        <summary>📈 Andamento orario delle 24 ore <span class="sum-model">…</span></summary>
        <div class="chart-wrap">
          <div class="model-switch" data-switch="${stop.id}|${date}"></div>
          <div class="chart-host" data-chart="${stop.id}|${date}"></div>
        </div>
      </details>
    </div>`
}

// ---------- sezione confronto ----------

function cellFor(stopId: string, date: string): string {
  const rec = dayRecBest(stopId, date)
  if (!rec) return '<td class="c-nodata">—</td>'
  const sky = daySky(stopId, date)
  const wet = rec.precip !== null && rec.precip > 0.02
  return `<td class="c-data">
      <div class="c-sky">${sky ? `${sky.emoji} <span>${esc(sky.label)}</span>` : ''}</div>
      <div class="c-t">${fmt0(rec.tmax)}° / ${fmt0(rec.tmin)}°</div>
      <div class="c-sub ${wet ? 'wet' : ''}">💧 ${rec.precip === null ? '—' : rec.precip > 0.02 ? `${fmt1(rec.precip)} mm` : 'asciutto'}${rec.prob !== null ? ` · ${fmt0(rec.prob)}%` : ''}</div>
      <div class="c-sub">🌬 ${rec.gusts !== null ? `${fmt0(rec.gusts)} km/h` : ''}</div>
    </td>`
}

function sectionConfronto(): string {
  const rows = VERDICTS.map((v) => {
    const d = dayOf(v.date)
    const num = v.date.slice(8, 10)
    return `<tr>
      <td class="c-date"><b>${d.dow} ${num}</b></td>
      ${cellFor('skukuza', v.date)}
      ${cellFor('capetown', v.date)}
      <td class="c-verdict"><span class="pill ${v.better === 'kruger' ? 'kruger' : v.better === 'cape' ? 'cape' : 'parita'}">${v.better === 'kruger' ? 'Kruger' : v.better === 'cape' ? 'Città del Capo' : 'Pareggio'}</span><p>${esc(v.note)}</p></td>
    </tr>`
  }).join('')
  return `<div class="intro-note">⚖️ Le due zone hanno climi opposti a settembre: il bushveld esce dall’inverno secco (sole e caldo di giorno), il Capo è in coda alla stagione delle piogge. Il fronte freddo del 17–19 è l’elemento che decide la seconda metà del viaggio — e lascia il Kruger proprio il giorno dopo la tua partenza. Riferimenti: Skukuza (Kruger) e la città per il Capo · valori ECMWF.</div>
    <div class="table-scroll"><table class="cmp">
      <thead><tr><th>Giorno</th><th>Kruger · bushveld</th><th>Città del Capo</th><th>Dove conviene</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="table-note">Il 17–19 le colonne Kruger sono solo di contesto (sei già al Capo): mostrano che il fronte — con raffiche fino a 90 km/h — arriva sul Lowveld dopo la tua partenza del 16.</p>`
}

// ---------- sezione mappa ----------

function sectionMappa(): string {
  return `<div class="intro-note">🗺️ Mappa interattiva delle 11 mete — OpenStreetMap con tema scuro CARTO: nessun cookie, nessuna chiave API. Giallo = Kruger, blu = Città del Capo, grigio = trasferimenti (tratteggiato: voli). Il numero sul ping è il giorno di arrivo; clicca un ping per il meteo della/e giornata/e e il salto al dettaglio.</div>
    <div class="map-wrap"><div id="trip-map" class="trip-map"></div></div>`
}

// ---------- sezione confronto modelli ----------

function sectionModelli(): string {
  const stops = (DATA?.stops ?? []).map((s) => `<option value="${s.id}"${s.id === 'skukuza' ? ' selected' : ''}>${esc(s.name)}</option>`).join('')
  return `<div class="intro-note">📊 Ogni centro meteorologico produce la sua previsione. Qui le vedi tutte insieme per la stessa meta: temperature max/min (finestra 11–19) e pioggia giornaliera. Dove le linee si separano — come sui giorni 17–19 — c’è incertezza; dove si sovrappongono, la fiducia è alta. I modelli con orizzonte breve (ICON, GEM, JMA) interrompono le linee quando finiscono i dati.</div>
    <div class="model-pick">
      <label for="ov-stop">Meta:</label>
      <select id="ov-stop">${stops}</select>
    </div>
    <div class="ov-charts" id="ov-charts"></div>
    <p class="table-note">Linee piene = massime · tratteggiate = minime. Per la vista oraria di un singolo giorno usa la tab «Itinerario», dove ogni grafico ha il selettore del modello.</p>`
}

function renderOverlay(stopId: string): void {
  const host = $('#ov-charts')
  if (!host) return
  const dates = DAYS.map((d) => d.date)
  const series = MODEL_ORDER
    .filter((m) => dates.some((dt) => dayRecBestCheck(stopId, dt, m)))
    .map((m) => ({
      model: m,
      label: modelLabel(m),
      tmax: dates.map((dt) => dayRec(stopId, dt, m)?.tmax ?? null),
      tmin: dates.map((dt) => dayRec(stopId, dt, m)?.tmin ?? null),
      precip: dates.map((dt) => dayRec(stopId, dt, m)?.precip ?? null),
    }))
  if (!series.length) {
    host.innerHTML = '<p class="chart-empty">Nessun dato giornaliero per questa meta.</p>'
    return
  }
  renderDailyOverlay(host, { dates, series })
}

function dayRecBestCheck(stopId: string, date: string, m: ModelId): boolean {
  return (dayRec(stopId, date, m)?.tmax ?? null) != null
}

// ---------- sezione mete ----------

function sectionMete(): string {
  const cards = (DATA?.stops ?? []).map((s) => {
    const z = ZONE_META[s.zone]
    const cells = DAYS.filter((d) => d.date >= DATA!.window.start)
      .map((d) => {
        const rec = dayRecBest(s.id, d.date)
        const sky = daySky(s.id, d.date)
        const num = d.date.slice(8, 10)
        if (!rec) return `<span class="mcell" data-goto="${d.date}" title="${d.dow} ${num} — n/d"><i class="mn">${num}</i><i class="me">—</i><i class="mt">—</i></span>`
        const wet = rec.precip !== null && rec.precip > 0.02
        return `<button class="mcell" data-goto="${d.date}" title="${esc(d.dow)} ${num} settembre · ${fmt0(rec.tmax)}°/${fmt0(rec.tmin)}° · ${rec.precip !== null && rec.precip > 0.02 ? `${fmt1(rec.precip)} mm` : 'asciutto'}">${sky ? `<i class="me">${sky.emoji}</i>` : '<i class="me">—</i>'}<i class="mt">${fmt0(rec.tmax)}°</i><i class="mn">${num}</i><i class="mw ${wet ? 'wet' : ''}">${rec.precip !== null && rec.precip > 0.02 ? '💧' + fmt1(rec.precip) : '·'}</i></button>`
      })
      .join('')
    const coords = `${Math.abs(s.lat).toFixed(2)}°${s.lat < 0 ? 'S' : 'N'} ${Math.abs(s.lon).toFixed(2)}°${s.lon < 0 ? 'E' : 'W'}${s.approx ? ' (indicative)' : ''}`
    return `<div class="meta-card">
      <div class="meta-head">
        <span class="meta-ico">${KIND_ICON[s.kind] ?? '📍'}</span>
        <div><b>${esc(s.name)}</b><div class="meta-role">${esc(s.role)}</div><div class="meta-meta"><span class="pill mini ${z.cls}">${z.label}</span><span class="coords">${coords}${s.elevation ? ` · ▲ ~${fmt0(s.elevation)} m` : ''}</span></div></div>
      </div>
      <div class="mstrip" title="Clicca un giorno per vederne il dettaglio">${cells}</div>
    </div>`
  }).join('')
  return `<div class="intro-note">📍 Le 11 mete del viaggio, con l’estratto meteo dei 9 giorni (clicca una casella per saltare al dettaglio). Le coordinate dei punti non urbani sono indicative: la griglia dei modelli è di ~25 km.</div>
    <div class="meta-grid">${cards}</div>`
}

// ---------- sezione fonti ----------

function sectionFonti(): string {
  const stopRows = (DATA?.stops ?? [])
    .map((s) => `<tr><td>${esc(s.name)}</td><td>${Math.abs(s.lat).toFixed(3)}°${s.lat < 0 ? 'S' : 'N'}, ${Math.abs(s.lon).toFixed(3)}°${s.lon < 0 ? 'E' : 'W'}</td><td>${s.approx ? 'indicative' : 'precise'}</td><td>${s.elevation !== null ? `~${fmt0(s.elevation)} m` : '—'}</td></tr>`)
    .join('')
  const modelsHtml = Object.entries(DATA?.models ?? {})
    .map(([id, m]) => {
      const horD = m.horizonDaily ? ` · giornaliero ≤ ${m.horizonDaily.slice(8, 10)}/9` : ''
      const horH = m.horizonHourly ? ` · orario ≤ ${m.horizonHourly.slice(8, 10)}/9` : ''
      return `<li><a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.label)}</a> <code>${esc(id)}</code> — ${esc(m.note)}${horD}${horH}</li>`
    })
    .join('')
  return `<div class="grid2">
    <div class="card">
      <h3>📡 Da dove arrivano i numeri</h3>
      <p>Snapshot catturato il <b>${new Date(DATA!.fetchedAt).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC</b> tramite l’API di Open-Meteo, che ridistribuisce i modelli dei centri meteorologici (nessuna API chiamata dal sito: i dati sono nel file <code>data/weather.json</code>).</p>
      <ul>${modelsHtml}</ul>
      <p>Ogni meta ha valori <b>giornalieri</b> (min/max, pioggia, probabilità da ensemble, vento, alba/tramonto, UV) e <b>orari</b> (24 h) per ciascuno dei 5 modelli: nei grafici dell’itinerario puoi passare da un modello all’altro, nella tab «Modelli a confronto» li vedi sovrapposti sulla finestra dei 9 giorni — di solito divergono solo sulla data esatta del fronte (17–19 settembre).</p>
    </div>
    <div class="card">
      <h3>🔄 Come aggiornare le previsioni</h3>
      <p>Le previsioni a medio termine evolvono: rigenera i dati quando vuoi, poi ricarica la pagina (o fai il build).</p>
      <pre><code>npm run fetch   # scarica ECMWF + GFS in public/data/weather.json
npm run dev      # oppure: npm run build && npm run preview</code></pre>
      <p><b>Quando:</b> subito prima di partire (10–11 settembre) per fissare il fronte del 17–19, e — se vuoi — una volta in Sudafrica. Oltre i ~10 giorni di previsione la fiducia cala rapidamente.</p>
    </div>
    <div class="card">
      <h3>📚 Fonti esterne usate per il confronto</h3>
      <ul>
        <li><a href="https://open-meteo.com/en/docs" target="_blank" rel="noopener">Open-Meteo</a> — dati modellistici (ECMWF IFS 0.25°, NOAA GFS 0.25°)</li>
        <li><a href="https://www.accuweather.com/en/za/cape-town/306633/september-weather/306633" target="_blank" rel="noopener">AccuWeather — Cape Town, previsione estesa</a> (terza fonte, pattern generale)</li>
        <li><a href="https://www.accuweather.com/en/za/mbombela/299527/september-weather/299527" target="_blank" rel="noopener">AccuWeather — Mbombela (porta del Kruger)</a></li>
        <li><a href="https://www.nathab.com/know-before-you-go/african-safaris/southern-africa/weather-climate/south-africa" target="_blank" rel="noopener">Natural Habitat Adventures — clima Sudafrica</a> (contesto stagionale)</li>
        <li><a href="https://www.weathersa.co.za" target="_blank" rel="noopener">South African Weather Service</a> — bollettino ufficiale locale, per la verifica finale</li>
      </ul>
    </div>
    <div class="card">
      <h3>🧭 Coordinate delle mete</h3>
      <div class="table-scroll"><table class="small">
        <thead><tr><th>Meta</th><th>Coordinate</th><th>Precisione</th><th>Altitudine</th></tr></thead>
        <tbody>${stopRows}</tbody>
      </table></div>
      <p class="table-note">I punti di campi SANParks, gate e belvederi sono indicativi (±1 km): la griglia del modello è ~25 km e la microclima locale (es. la scarpata del Blyde, più fresca) non è risolvibile.</p>
    </div>
    <div class="card wide">
      <h3>⚠️ Limiti onesti</h3>
      <p>Le note e i «verdetti» giornalieri sono stati scritti il 7 settembre 2026 dall’analisi dei modelli e del piano di viaggio (in <code>src/trip.ts</code>): sono indicazioni, non una garanzia. I tre modelli consultati concordano sul quadro generale (secco e caldo al Kruger fino al 16; fronte al Capo il 15–17; bel tempo 18–19) ma <b>divergono di ±1–2 giorni sulla data esatta del passaggio del fronte</b> — l’unico elemento che potrebbe ancora cambiare. Le probabilità di pioggia derivano dagli ensemble dei modelli; le quantità in mm sono attese, non certezze.</p>
    </div>
  </div>`
}

// ---------- eventi ----------

function wireEvents(): void {
  $$('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      ACTIVE_TAB = btn.dataset.tab ?? 'itinerario'
      $$('.tab').forEach((b) => b.classList.toggle('active', b === btn))
      $$('.pane').forEach((p) => p.classList.toggle('active', p.id === `sec-${ACTIVE_TAB}`))
      if (ACTIVE_TAB === 'mappa' && DATA) {
        // La mappa va inizializzata a contenitore visibile (larghezza/altezza reali)
        const data = DATA
        requestAnimationFrame(() => initTripMap(data, $('#trip-map')!))
      }
    })
  })

  document.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement
    const goto = target.closest('[data-goto]')
    if (goto) {
      const date = (goto as HTMLElement).dataset.goto!
      const tab = $('.tab[data-tab="itinerario"]')!
      tab.click()
      const sec = $('#day-' + date)
      if (sec) {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' })
        sec.classList.remove('flash')
        void sec.offsetWidth
        sec.classList.add('flash')
      }
    }
    const sw = target.closest('[data-switch] button')
    if (sw) {
      const key = (sw.closest('[data-switch]') as HTMLElement).dataset.switch!
      const model = (sw as HTMLElement).dataset.model as ModelId
      const host = $(`[data-chart="${key}"]`)
      if (!host) return
      const [stopId, date] = key.split('|')
      const slot = DATA!.hourly[stopId]?.[date]
      const hr = slot?.[model]
      if (hr?.time.length) {
        host.closest('details')!.querySelector('.sum-model')!.textContent = modelLabel(model)
        renderHourlyChart(host, hr, modelLabel(model))
        sw.closest('.model-switch')!.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === sw))
      }
    }
  })

  // Rendering dei grafici orari: bottoni modello dinamici (solo quelli con dati per quel giorno)
  $$('[data-chart]').forEach((host) => {
    const key = host.dataset.chart!
    const [stopId, date] = key.split('|')
    const slot = DATA!.hourly[stopId]?.[date]
    const sw = host.closest('details')!.querySelector<HTMLElement>('.model-switch')!
    const avail = MODEL_ORDER.filter((m) => {
      const rec = slot?.[m]
      return !!rec && rec.time.length && rec.temp.some((t) => t !== null)
    })
    if (!avail.length) {
      sw.innerHTML = ''
      host.innerHTML = '<p class="chart-empty">Dati orari non disponibili per questa meta e questo giorno.</p>'
      return
    }
    sw.innerHTML = avail
      .map((m) => `<button data-model="${m}"${m === avail[0] ? ' class="active"' : ''}>${shortLabel(m)}</button>`)
      .join('')
    host.closest('details')!.querySelector('.sum-model')!.textContent = modelLabel(avail[0])
    renderHourlyChart(host, slot![avail[0]], modelLabel(avail[0]))
  })

  // Overlay multi-modello: selezione meta
  const ov = $('#ov-stop') as HTMLSelectElement | null
  if (ov) {
    renderOverlay(ov.value)
    ov.addEventListener('change', () => renderOverlay(ov.value))
  }
}

boot()
