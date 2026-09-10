#!/usr/bin/env node
/**
 * Rollover non distruttivo dello snapshot meteo (usato da fetch-weather.mjs).
 *
 * Quando un giorno della finestra esce dalla copertura del fetch — perché ormai
 * nel passato, e i modelli non lo restituiscono più — lo snapshot nuovo eredita
 * quel giorno dallo snapshot PRECEDENTE: durante il viaggio i giorni passati
 * restano visibili e la validazione continua a coprire l'intera finestra.
 *
 * Regole:
 *  - i dati freschi vincono SEMPRE (per giorno e per modello);
 *  - si eredita solo ciò che il fetch non ha coperto (giorno o modello assente);
 *    un record presente ma con valori null NON viene toccato (es. fine orizzonte
 *    di un modello: i null restano null, niente valori stantii risorti);
 *  - nessun effetto collaterale su window/stops/modelli: solo dati.
 */

/**
 * @typedef {{ from: string | null, days: string[] }} CarryInfo
 * `days` = elenco ordinato delle date per cui ALMENO un modello (o l'orario) è
 * stato ereditato dallo snapshot precedente.
 */

function windowDates(window) {
  const dates = []
  if (!window?.start || !window?.end) return dates
  const start = new Date(window.start + 'T00:00:00Z')
  const end = new Date(window.end + 'T00:00:00Z')
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function fillAstro(freshSlot, prevAstro) {
  if (!prevAstro) return
  if (!freshSlot.astro) {
    freshSlot.astro = prevAstro
    return
  }
  freshSlot.astro.sunrise ??= prevAstro.sunrise ?? null
  freshSlot.astro.sunset ??= prevAstro.sunset ?? null
  freshSlot.astro.uv ??= prevAstro.uv ?? null
}

/**
 * Eredita da `prev` i giorni/modelli mancanti in `fresh` (mutazione in place).
 * @param {object} fresh snapshot appena costruito dal fetch (verrà arricchito)
 * @param {object|null} prev snapshot precedente letto da disco (può mancare)
 * @returns {CarryInfo}
 */
export function mergeSnapshots(fresh, prev) {
  const carried = new Set()
  const from = prev?.fetchedAt ?? null
  if (!prev?.daily && !prev?.hourly) return { from, days: [] }
  const dates = windowDates(fresh?.window)

  for (const stop of fresh?.stops ?? []) {
    const id = stop.id
    for (const date of dates) {
      // ---- giornaliero ----
      const fslot = fresh.daily?.[id]?.[date]
      const pslot = prev.daily?.[id]?.[date]
      if (!fslot && pslot) {
        // giorno intero assente nel fetch (ormai nel passato): eredita tutto
        fresh.daily[id] ??= {}
        fresh.daily[id][date] = pslot
        carried.add(date)
      } else if (fslot && pslot) {
        fillAstro(fslot, pslot.astro)
        for (const key of Object.keys(pslot)) {
          if (key === 'astro') continue
          if (!fslot[key] && pslot[key]) {
            fslot[key] = pslot[key] // modello assente nel fetch fresco
            carried.add(date)
          }
        }
      }
      // ---- orario ----
      const fhour = fresh.hourly?.[id]?.[date]
      const phour = prev.hourly?.[id]?.[date]
      if (!fhour && phour) {
        fresh.hourly[id] ??= {}
        fresh.hourly[id][date] = phour
        carried.add(date)
      } else if (fhour && phour) {
        for (const key of Object.keys(phour)) {
          if (!fhour[key] && phour[key]) {
            fhour[key] = phour[key]
            carried.add(date)
          }
        }
      }
    }
  }

  const days = [...carried].sort()
  if (days.length) fresh.carried = { from, days }
  return { from, days }
}
