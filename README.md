# Sa Trip Weather — Sudafrica 11–19 settembre 2026

Sito statico (Vite + TypeScript vanilla) che raccoglie il meteo **giorno per giorno e ora per ora**
dell'itinerario in Sudafrica: Kruger (Blyde Canyon con Bourke's Luck e God's Window, Numbi/Phabeni,
Skukuza, Lower Sabie, Satara, Hoedspruit) e Città del Capo (città, giardini di Kirstenbosch,
Cape Point), più Johannesburg
per arrivo e rientro.

## Comandi

```bash
npm install        # prima volta
npm run dev        # sviluppo su http://localhost:5173
npm run fetch      # rigenera public/data/weather.json dai modelli (Open-Meteo)
npm run build      # build di produzione in dist/
npm run preview    # serve la build
```

## Dati e fonti

- I dati sono uno **snapshot** dei modelli **ECMWF IFS 0.25°**, **NOAA GFS 0.25°**, **DWD ICON**,
  **CMC GEM** e **JMA GSM** (tutti via Open-Meteo, cheap e senza chiave), catturato da
  `scripts/fetch-weather.mjs` — la data di cattura è mostrata nel sito.
- Orizzonti reali (validati dal probe del 7/9/2026): ECMWF e GFS coprono l'intera finestra,
  GEM fino al 16/9, JMA fino al 17/9, ICON fino al ~13/9. I grafici mostrano solo i giorni
  coperti da ciascun modello; dove i modelli divergono (fronte del 17–19) c'è incertezza.
- Le previsioni a medio termine evolvono: **rilancia `npm run fetch` a 48–72 h dalla partenza**
  (o quando vuoi) per aggiornare il sito. Il commit del JSON aggiornato è il deploy.
- Riferimenti usati per il confronto: previsioni estese AccuWeather (Cape Town, Mbombela),
  profilo climatico Natural Habitat Adventures. Il sito non chiama API a runtime: funziona
  anche offline una volta servito.
- Coordinate delle mete indicative (±1 km) per i punti non urbani (campi SANParks, gate,
  viewpoint): il modello ha una griglia di ~25 km, la precisione locale è quindi limitata.

## Struttura

```
scripts/fetch-weather.mjs   # scarica ECMWF+GFS, scrive public/data/weather.json
public/data/weather.json    # dati (generato)
src/types.ts                # tipi del JSON
src/trip.ts                 # itinerario, note editoriali, verdetti giorno per giorno
src/charts.ts               # grafico orario SVG (temp, pioggia, vento, cielo)
src/main.ts                 # rendering della pagina
src/styles.css              # tema scuro
```

## Deploy

Sito pubblico su **GitHub Pages**: <https://luk3luca.github.io/sa-trip-weather/>

- Il workflow `.github/workflows/update.yml` rifà lo snapshot meteo e ridistribuisce
  **ogni lunedì 04:00 UTC**, **ogni giorno alle 05:00 UTC dall'8 al 19 settembre**
  (run-up + viaggio) e a ogni push di codice su `main`.
- Aggiornamento manuale quando vuoi: `gh workflow run "Weekly data update + deploy"`.
- Il commit del refresh dati (`[bot] weekly weather snapshot refresh`) è escluso dal
  trigger `on: push` (`paths-ignore`) per evitare loop.

### Sicurezza dei dati (perché non si perde mai lo snapshot)

1. **Validazione prima della scrittura**: `scripts/fetch-weather.mjs` valida lo snapshot
   in memoria (mete presenti, 9 giorni × min/max validi per ECMWF+GFS, 24 ore orarie,
   temperature in range, nulla di non numerico); se fallisce **non scrive nulla**.
2. **Scrittura atomica**: il file viene scritto come `weather.json.new` e poi sostituito
   con `rename` — mai un file troncato a metà sul path finale.
3. **Gate in CI**: `npm run validate` (scripts/validate-weather.mjs) ricontrolla il file
   su disco prima di commit e deploy. Se fallisce, il job si ferma: niente commit,
   niente deploy, e **GitHub Pages continua a servire l'ultimo deploy valido**.
4. **Fetch fallito ≠ dati persi**: la rete può andare giù — in quel caso resta lo
   snapshot precedente e il sito viene ridistribuito com'era.
5. **Rollover non distruttivo dei giorni passati**: quando un giorno esce dalla
   finestra del fetch (ormai nel passato, i modelli non lo restituiscono più), lo
   snapshot nuovo **eredita** quel giorno dallo snapshot precedente — niente buchi
   e niente giorni persi durante il viaggio (dettagli in `scripts/merge-snapshot.mjs`).
   Il fetch scrive solo se esiste almeno un giorno nuovo; a viaggio concluso, con
   la finestra tutta passata, il file resta invariato (nessun commit inutile).
6. **Git come backup**: ogni snapshot buono è committato; recupero istantaneo con
   `git checkout -- public/data/weather.json` (o da un commit precedente).

Comandi locali: `npm run fetch` · `npm run validate` · `node scripts/validate-weather.mjs <file>`

## Note editoriali

Le note e i "verdetti" giornalieri (es. «il 16 a Cape Town è il giorno più piovoso»,
«giardini di Kirstenbosch la mattina del 19») sono stati scritti a partire dall'analisi dei modelli
del 7 settembre 2026 e vivono in `src/trip.ts`: se la previsione cambia molto, aggiorna lì i testi.
