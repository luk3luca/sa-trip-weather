// Grafico orario SVG: temperatura (linea), pioggia (barre), raffiche (tratteggio),
// icone del cielo ogni 3 ore. Tooltip al passaggio del mouse.
// In più: overlay giornaliero multi-modello (max/min + pioggia) per la tab confronto.
import type { HourRec, ModelId } from './types'

export const MODEL_COLORS: Record<ModelId, string> = {
  ecmwf_ifs025: '#f2b25c',
  gfs_seamless: '#5ea0f7',
  gem_seamless: '#7fbf7a',
  jma_gsm: '#e8827a',
  icon_seamless: '#b891e8',
}

const W = 860
const H = 252
const L = 34
const R = 8
const PLOT_TOP = 34
const PLOT_BOTTOM = H - 24
const PLOT_H = PLOT_BOTTOM - PLOT_TOP
const PLOT_W = W - L - R
const STEP = PLOT_W / 23

export interface CodeInfo {
  emoji: string
  label: string
  cls: string
}

export function codeInfo(code: number | null): CodeInfo {
  if (code === null) return { emoji: '—', label: 'n/d', cls: '' }
  if (code === 0) return { emoji: '☀️', label: 'Sereno', cls: 'sun' }
  if (code === 1) return { emoji: '🌤️', label: 'Quasi sereno', cls: 'sun' }
  if (code === 2) return { emoji: '⛅', label: 'Poco nuvoloso', cls: 'part' }
  if (code === 3) return { emoji: '☁️', label: 'Nuvoloso', cls: 'cloud' }
  if (code === 45 || code === 48) return { emoji: '🌫️', label: 'Nebbia', cls: 'cloud' }
  if (code >= 51 && code <= 57) return { emoji: '🌦️', label: 'Pioviggine', cls: 'rain' }
  if (code >= 61 && code <= 67) return { emoji: '🌧️', label: 'Pioggia', cls: 'rain' }
  if (code >= 71 && code <= 77) return { emoji: '🌨️', label: 'Neve', cls: 'rain' }
  if (code >= 80 && code <= 82) return { emoji: '🌦️', label: 'Rovesci', cls: 'rain' }
  if (code >= 85 && code <= 86) return { emoji: '🌨️', label: 'Rovesci di neve', cls: 'rain' }
  if (code >= 95) return { emoji: '⛈️', label: 'Temporale', cls: 'storm' }
  return { emoji: '❓', label: `Codice ${code}`, cls: '' }
}

function num(v: number | null): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function fmt(v: number | null, digits = 0): string {
  return v === null ? '—' : v.toFixed(digits).replace('.', ',')
}

function xAt(i: number): number {
  return L + i * STEP
}

function subpaths(vals: (number | null)[], yOf: (v: number) => number): string {
  // Segmenta la linea: dopo un dato mancante riparte con un nuovo tratto (niente ponti sui buchi).
  let d = ''
  let open = false
  for (let i = 0; i < vals.length; i++) {
    const v = num(vals[i])
    if (v === null) {
      open = false
      continue
    }
    const x = xAt(i)
    const y = yOf(v)
    d += open ? `L${x.toFixed(1)} ${y.toFixed(1)} ` : `M${x.toFixed(1)} ${y.toFixed(1)} `
    open = true
  }
  return d.trim()
}

/**
 * Disegna il grafico orario dentro `host` (che deve essere vuoto).
 * Se i dati orari del modello primario mancano, usa il fallback indicato da `modelLabel`.
 */
export function renderHourlyChart(host: HTMLElement, hr: HourRec, modelLabel: string): void {
  host.innerHTML = ''
  const n = hr.time.length
  if (n === 0) {
    host.innerHTML = '<p class="chart-empty">Dati orari non disponibili per questo giorno e modello.</p>'
    return
  }

  const temps = hr.temp.map(num)
  const pre = hr.precip.map(num)
  const probs = hr.prob.map(num)
  const gusts = hr.gusts.map(num)
  const hourOf = (i: number) => (hr.time[i] ? hr.time[i].slice(11, 13) : '--')

  // Scale
  const tVals = temps.filter((v): v is number => v !== null)
  const pVals = pre.filter((v): v is number => v !== null)
  const gVals = gusts.filter((v): v is number => v !== null)
  const tlo = tVals.length ? Math.floor(Math.min(...tVals) - 2) : 10
  const thi = tVals.length ? Math.ceil(Math.max(...tVals) + 2) : 30
  const pMax = pVals.length ? Math.max(...pVals) : 0
  const gMax = gVals.length ? Math.max(20, Math.ceil(Math.max(...gVals) / 10) * 10) : 40
  const yT = (v: number) => PLOT_BOTTOM - ((v - tlo) / (thi - tlo)) * PLOT_H
  const yP = (v: number) => PLOT_BOTTOM - (v / Math.max(pMax, 0.2)) * PLOT_H * 0.92
  const yG = (v: number) => PLOT_BOTTOM - (v / gMax) * PLOT_H * 0.95

  const p: string[] = []
  // Riepilogo veloce min/max del grafico (24 h del modello selezionato)
  const minT = tVals.length ? Math.min(...tVals) : null
  const maxT = tVals.length ? Math.max(...tVals) : null
  p.push(`<div class="chart-extrema">🌡️ Min <b>${minT === null ? '—' : Math.round(minT)}°</b> · Max <b>${maxT === null ? '—' : Math.round(maxT)}°</b><span class="dim">24 ore · ${modelLabel}</span></div>`)
  p.push(`<svg class="hchart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Andamento orario temperatura, pioggia e vento">`)

  // Griglia verticale ogni 3 ore + etichette
  for (let i = 0; i < n; i++) {
    const x = xAt(i)
    if (i % 3 === 0) p.push(`<line x1="${x.toFixed(1)}" y1="${PLOT_TOP}" x2="${x.toFixed(1)}" y2="${PLOT_BOTTOM}" class="grid"/>`)
    if (i % 6 === 0) p.push(`<text x="${x.toFixed(1)}" y="${H - 7}" class="hlab">${hourOf(i)}</text>`)
  }
  // Griglia orizzontale temperatura
  for (let t = Math.max(0, tlo); t <= thi; t += Math.max(1, Math.round((thi - tlo) / 4))) {
    const y = yT(t)
    if (y < PLOT_TOP || y > PLOT_BOTTOM) continue
    p.push(`<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" class="gridh"/>`)
    p.push(`<text x="${L - 6}" y="${(y + 3).toFixed(1)}" class="tlab">${t}°</text>`)
  }

  // Icone cielo ogni 3 ore (banda alta)
  for (let i = 0; i < n; i += 3) {
    const ci = codeInfo(hr.code[i])
    p.push(
      `<text x="${xAt(i).toFixed(1)}" y="22" class="skyico" text-anchor="middle"><title>${hourOf(i)}:00 · ${ci.label}</title>${ci.emoji}</text>`,
    )
  }

  // Pioggia: barre
  for (let i = 0; i < n; i++) {
    const v = pre[i]
    if (v === null || v <= 0.02) continue
    const x = xAt(i)
    const y = yP(v)
    p.push(`<rect x="${(x - 3.2).toFixed(1)}" y="${y.toFixed(1)}" width="6.4" height="${(PLOT_BOTTOM - y).toFixed(1)}" rx="1.2" class="bar"><title>${hourOf(i)}:00 · ${fmt(v, 1)} mm</title></rect>`)
  }

  // Probabilità di pioggia ≥ 30%: fascia tratteggiata chiara sopra il plot (disegnata sotto le linee)
  const hasProb = probs.some((v) => v !== null && v >= 30)
  if (hasProb) {
    for (let i = 0; i < n; i++) {
      const v = probs[i]
      if (v === null || v < 30) continue
      const x = xAt(i)
      p.push(`<rect x="${x.toFixed(1)}" y="${PLOT_TOP}" width="${STEP.toFixed(1)}" height="${PLOT_H}" class="probzone"><title>${hourOf(i)}:00 · probabilità pioggia ${Math.round(v)}%</title></rect>`)
    }
  }

  // Linea temperatura
  const tempPath = subpaths(temps, yT)
  if (tempPath) {
    const area = `${tempPath} L${xAt(temps.length - 1).toFixed(1)} ${PLOT_BOTTOM} L${xAt(0).toFixed(1)} ${PLOT_BOTTOM} Z`
    p.push(`<path d="${area}" class="tempfill"/>`)
    p.push(`<path d="${tempPath}" class="templine"><title>Temperatura</title></path>`)
  }
  // Raffiche (tratteggio)
  const gustPath = subpaths(gusts, yG)
  if (gustPath) p.push(`<path d="${gustPath}" class="gustline"/>`)

  // Bordo del plot
  p.push(`<rect x="${L}" y="${PLOT_TOP}" width="${PLOT_W}" height="${PLOT_H}" class="plotframe"/>`)

  // Overlay per tooltip
  p.push(`<rect x="${L}" y="${PLOT_TOP}" width="${PLOT_W}" height="${PLOT_H}" class="hit"/></svg>`)
  p.push('<div class="chart-tip" hidden></div>')

  host.innerHTML = p.join('')

  const svg = host.querySelector('svg')!
  const tip = host.querySelector<HTMLDivElement>('.chart-tip')!
  const vline = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  vline.setAttribute('y1', String(PLOT_TOP))
  vline.setAttribute('y2', String(PLOT_BOTTOM))
  vline.setAttribute('class', 'vline')
  svg.appendChild(vline)

  const place = (i: number) => {
    const ci = codeInfo(hr.code[i] ?? null)
    const t = temps[i]
    const pp = pre[i]
    const pr = probs[i]
    const g = gusts[i]
    let s = `<b>${hourOf(i)}:00</b> · ${ci.emoji} ${ci.label}`
    if (t !== null) s += ` · <b>${fmt(t)} °C</b>`
    if (pp !== null) s += ` · 💧 ${fmt(pp, 1)} mm${pr !== null ? ` (prob. ${Math.round(pr)}%)` : ''}`
    if (g !== null) s += ` · 🌬 ${fmt(g)} km/h raffica`
    tip.innerHTML = s
  }

  svg.addEventListener('mousemove', (ev) => {
    const rect = svg.getBoundingClientRect()
    const x = ((ev.clientX - rect.left) / rect.width) * W
    const i = Math.max(0, Math.min(n - 1, Math.round((x - L) / STEP)))
    if (x < L || x > W - R) {
      tip.hidden = true
      vline.setAttribute('x1', '-10'); vline.setAttribute('x2', '-10')
      return
    }
    vline.setAttribute('x1', String(xAt(i))); vline.setAttribute('x2', String(xAt(i)))
    tip.hidden = false
    place(i)
    const bw = host.clientWidth
    tip.style.left = `${Math.min(Math.max(8, xAt(i) - 60), bw - 190)}px`
    tip.style.top = `${PLOT_TOP + 6}px`
  })
  svg.addEventListener('mouseleave', () => {
    tip.hidden = true
    vline.setAttribute('x1', '-10'); vline.setAttribute('x2', '-10')
  })

  const legend = document.createElement('div')
  legend.className = 'chart-legend'
  legend.innerHTML = `
    <span><i class="sw temp"></i>Temperatura (°C)</span>
    <span><i class="sw rain"></i>Pioggia (mm/h)</span>
    <span><i class="sw gust"></i>Raffiche (km/h)</span>
    <span class="ml-auto">Modello: ${modelLabel}</span>`
  host.appendChild(legend)
}

// ---------- confronto multi-modello (giornaliero, finestra 9 giorni) ----------

export interface ModelSeries {
  model: ModelId
  label: string
  tmax: (number | null)[]
  tmin: (number | null)[]
  precip: (number | null)[]
}

export interface DailyOverlayOpts {
  dates: string[] // "2026-09-11" …
  series: ModelSeries[]
}

const W2 = 860
const H2 = 218
const L2 = 40
const R2 = 10
const TOP2 = 26
const BOT2 = H2 - 26
const H2_H = BOT2 - TOP2
const W2_H = W2 - L2 - R2

function xDay(i: number, n: number): number {
  return L2 + (i / (n - 1)) * W2_H
}

/**
 * Due pannelli: (1) max/min per modello in overlay sulla finestra,
 * (2) pioggia giornaliera per modello (barre raggruppate). I buchi
 * (modelli con orizzonte breve, es. ICON) non vengono disegnati.
 */
export function renderDailyOverlay(host: HTMLElement, opts: DailyOverlayOpts): void {
  host.innerHTML = ''
  const n = opts.dates.length
  if (n === 0) {
    host.innerHTML = '<p class="chart-empty">Nessun dato giornaliero disponibile.</p>'
    return
  }

  const allMax: number[] = []
  const allMin: number[] = []
  const allRain: number[] = []
  for (const s of opts.series) {
    for (let i = 0; i < n; i++) {
      if (s.tmax[i] != null) allMax.push(s.tmax[i] as number)
      if (s.tmin[i] != null) allMin.push(s.tmin[i] as number)
      if (s.precip[i] != null) allRain.push(s.precip[i] as number)
    }
  }
  const lo = allMin.length ? Math.min(...allMin) - 3 : 0
  const hi = allMax.length ? Math.max(...allMax) + 3 : 30
  const rainMax = allRain.length ? Math.max(...allRain) : 1
  const rainCeil = Math.max(2, Math.ceil(rainMax * 1.15))
  const yT = (v: number) => BOT2 - ((v - lo) / (hi - lo)) * H2_H
  const yR = (v: number) => BOT2 - (v / rainCeil) * H2_H

  const p: string[] = []
  const dow = (date: string) => ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][new Date(date + 'T12:00:00').getDay()]

  // Pannello 1 — temperature
  p.push(`<svg class="hchart" viewBox="0 0 ${W2} ${H2}" width="${W2}" height="${H2}" role="img" aria-label="Temperature giornaliere per modello">`)
  for (let i = 0; i < n; i++) {
    const x = xDay(i, n)
    p.push(`<line x1="${x.toFixed(1)}" y1="${TOP2}" x2="${x.toFixed(1)}" y2="${BOT2}" class="grid"/>`)
    p.push(`<text x="${x.toFixed(1)}" y="${H2 - 9}" class="hlab" text-anchor="middle">${Number(opts.dates[i].slice(8, 10))} ${dow(opts.dates[i])}</text>`)
  }
  for (let t = Math.ceil(lo / 5) * 5; t <= hi; t += 5) {
    p.push(`<line x1="${L2}" y1="${yT(t).toFixed(1)}" x2="${W2 - R2}" y2="${yT(t).toFixed(1)}" class="gridh"/>`)
    p.push(`<text x="${L2 - 5}" y="${(yT(t) + 3).toFixed(1)}" class="tlab">${t}°</text>`)
  }
  for (const s of opts.series) {
    const c = MODEL_COLORS[s.model] ?? '#8b96a8'
    const maxPts: string[] = []
    const minPts: string[] = []
    for (let i = 0; i < n; i++) {
      if (s.tmax[i] != null) maxPts.push(`${xDay(i, n).toFixed(1)} ${yT(s.tmax[i] as number).toFixed(1)}`)
      if (s.tmin[i] != null) minPts.push(`${xDay(i, n).toFixed(1)} ${yT(s.tmin[i] as number).toFixed(1)}`)
    }
    if (maxPts.length > 1) {
      p.push(`<path d="M${maxPts.join(' L')}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><title>${s.label} · max</title></path>`)
      p.push(`<path d="M${minPts.join(' L')}" fill="none" stroke="${c}" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.75"><title>${s.label} · min</title></path>`)
    }
  }
  p.push(`<rect x="${L2}" y="${TOP2}" width="${W2_H}" height="${H2_H}" class="plotframe"/></svg>`)

  // Pannello 2 — pioggia per modello
  p.push(`<svg class="hchart" viewBox="0 0 ${W2} ${H2}" width="${W2}" height="${H2}" role="img" aria-label="Pioggia giornaliera per modello">`)
  const nb = opts.series.length
  const bw = (W2_H / n) * 0.62
  for (let i = 0; i < n; i++) {
    const x0 = xDay(i, n) + ((W2_H / n) * 0.19) // centro gruppo → start
    p.push(`<text x="${x0 + bw / 2}" y="${H2 - 9}" class="hlab" text-anchor="middle">${Number(opts.dates[i].slice(8, 10))} ${dow(opts.dates[i])}</text>`)
    for (let m = 0; m < nb; m++) {
      const v = opts.series[m].precip[i]
      if (v == null || v <= 0.02) continue
      const c = MODEL_COLORS[opts.series[m].model] ?? '#8b96a8'
      const x = x0 + (m / nb) * bw
      p.push(`<rect x="${x.toFixed(1)}" y="${yR(v).toFixed(1)}" width="${(bw / nb - 1.4).toFixed(1)}" height="${(BOT2 - yR(v)).toFixed(1)}" rx="1.2" fill="${c}" opacity="0.85"><title>${opts.series[m].label} · ${Number(opts.dates[i].slice(8, 10))}/${Number(opts.dates[i].slice(5, 7))} · ${v.toFixed(1)} mm</title></rect>`)
    }
  }
  p.push(`<rect x="${L2}" y="${TOP2}" width="${W2_H}" height="${H2_H}" class="plotframe"/></svg>`)

  const legend = `<div class="chart-legend">${opts.series
    .map((s) => `<span><i class="sw" style="background:${MODEL_COLORS[s.model] ?? '#8b96a8'}"></i>${s.label}</span>`)
    .join('')}<span class="ml-auto">linea piena = max · tratteggiata = min</span></div>`

  host.innerHTML = p.join('') + legend
}
