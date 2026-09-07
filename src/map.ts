// Mappa interattiva (Leaflet + OpenStreetMap, basemap scuro CARTO):
// ping per ogni meta, colorati per zona e numerati col giorno di arrivo,
// popup con meteo della/e giornata/e e link al dettaglio del giorno.
// Nessun cookie, nessuna API key: i tile sono raster pubblici.
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { WeatherFile, StopDef, Zone } from './types'
import { MODEL_ORDER } from './types'
import { DAYS } from './trip'
import { codeInfo } from './charts'

let map: L.Map | null = null
let inited = false

const ZONE_COLOR: Record<Zone, string> = {
  kruger: '#e0a458',
  cape: '#6fa8dc',
  transito: '#98a2b3',
}

function bestRec(data: WeatherFile, stopId: string, date: string) {
  for (const m of MODEL_ORDER) {
    const r = data.daily?.[stopId]?.[date]?.[m]
    if (r && r.tmax != null) return r
  }
  return null
}

function firstDayNum(stopId: string): string {
  const d = DAYS.find((day) => day.stopIds.includes(stopId))
  return d ? d.date.slice(8, 10) : ''
}

function popupHTML(stop: StopDef, data: WeatherFile): string {
  const rows = DAYS.filter((d) => d.stopIds.includes(stop.id))
    .map((d) => {
      const rec = bestRec(data, stop.id, d.date)
      if (!rec) return ''
      const sky = codeInfo(rec.code ?? null)
      return `<button class="mday-link" data-goto="${d.date}">${d.dow.slice(0, 3)} ${d.date.slice(8, 10)}/9 — ${sky.emoji} ${sky.label.toLowerCase()} · ${rec.tmax == null ? '—' : Math.round(rec.tmax)}°/${rec.tmin == null ? '—' : Math.round(rec.tmin)}°</button>`
    })
    .join('')
  const elev = stop.elevation != null ? ` · ▲ ~${Math.round(stop.elevation)} m` : ''
  return `<div class="pop"><b>${stop.name}</b><span class="pop-kind">${stop.kind}${elev}</span>${rows}</div>`
}

function makePin(stop: StopDef): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${ZONE_COLOR[stop.zone]}"><span>${firstDayNum(stop.id)}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  })
}

export function initTripMap(data: WeatherFile, container: HTMLElement): void {
  if (inited) {
    map?.invalidateSize()
    return
  }
  inited = true

  map = L.map(container, {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: true,
    zoomSnap: 0.5,
  })

  L.tileLayer('https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a> · meteo: Open-Meteo',
  }).addTo(map)

  const byId = new Map(data.stops.map((s) => [s.id, s]))
  const latLng = (id: string): L.LatLngExpression | null => {
    const s = byId.get(id)
    return s ? [s.lat, s.lon] : null
  }

  // Linee di percorso: tappe del Kruger, penisola del Capo, volo di ritorno
  const kIds = ['jnb', 'blyde', 'hazyview', 'phabeni', 'skukuza', 'lowersabie', 'satara', 'hoedspruit']
  const cIds = ['capetown', 'tablemountain', 'capepoint', 'capetown']
  const kPts = kIds.map(latLng).filter((p): p is L.LatLngExpression => p !== null)
  const cPts = cIds.map(latLng).filter((p): p is L.LatLngExpression => p !== null)
  const jnb = latLng('jnb')
  const ct = latLng('capetown')
  if (kPts.length > 1) L.polyline(kPts, { color: ZONE_COLOR.kruger, weight: 3, opacity: 0.8 }).addTo(map)
  if (cPts.length > 1) L.polyline(cPts, { color: ZONE_COLOR.cape, weight: 3, opacity: 0.8 }).addTo(map)
  if (ct && jnb) L.polyline([ct, jnb], { color: ZONE_COLOR.transito, weight: 2, opacity: 0.65, dashArray: '6 9' }).addTo(map)

  const pins: L.LatLngExpression[] = []
  for (const stop of data.stops) {
    pins.push([stop.lat, stop.lon])
    L.marker([stop.lat, stop.lon], { icon: makePin(stop), title: stop.name })
      .bindPopup(popupHTML(stop, data), { maxWidth: 260 })
      .addTo(map)
  }
  if (pins.length) map.fitBounds(L.latLngBounds(pins).pad(0.14))

  window.addEventListener('resize', () => map?.invalidateSize())
}