// Tipi del file dati public/data/weather.json (generato da scripts/fetch-weather.mjs)

export type Zone = 'kruger' | 'cape' | 'transito'

export interface StopDef {
  id: string
  name: string
  zone: Zone
  kind: string
  lat: number
  lon: number
  approx: boolean
  elevation: number | null
  role: string
}

export interface DayRec {
  code: number | null
  tmax: number | null
  tmin: number | null
  precip: number | null
  prob: number | null
  wind: number | null
  gusts: number | null
}

export interface AstroRec {
  sunrise: string | null // "HH:MM" ora locale
  sunset: string | null
  uv: number | null
}

export interface HourRec {
  time: string[] // "2026-09-13T06:00" (ora locale, senza offset)
  temp: (number | null)[]
  code: (number | null)[]
  precip: (number | null)[]
  prob: (number | null)[]
  wind: (number | null)[]
  gusts: (number | null)[]
}

export type ModelId = 'ecmwf_ifs025' | 'gfs_seamless' | 'icon_seamless' | 'gem_seamless' | 'jma_gsm'

export const MODEL_ORDER: ModelId[] = ['ecmwf_ifs025', 'gfs_seamless', 'gem_seamless', 'jma_gsm', 'icon_seamless']

export interface DailySlot extends Record<ModelId, DayRec> {
  astro: AstroRec
}

export interface DailyMap {
  [stopId: string]: { [date: string]: DailySlot }
}

export interface HourlySlot extends Record<ModelId, HourRec> {}

export interface HourlyMap {
  [stopId: string]: { [date: string]: HourlySlot }
}

export interface WeatherFile {
  schema: number
  fetchedAt: string
  timezone: string
  window: { start: string; end: string }
  models: Record<string, { label: string; short: string; url: string; note: string; horizonDaily: string | null; horizonHourly: string | null }>
  stops: StopDef[]
  daily: DailyMap
  hourly: HourlyMap
}
