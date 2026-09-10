// Itinerario del viaggio e contenuti editoriali (note basate sull'analisi dei
// modelli del 7 settembre 2026). I numeri vivono in public/data/weather.json;
// qui c'è solo la struttura: giorni, mete attive, testi e verdetti.

export interface Tip {
  icon: string
  text: string
}

export interface DayPlan {
  date: string // YYYY-MM-DD
  dow: string // nome giorno della settimana
  title: string
  zoneLabel: string
  route: string
  intro: string[]
  tips: Tip[]
  stopIds: string[]
  mainStop: string | null // meta col grafico già aperto
}

export interface Verdict {
  date: string
  better: 'kruger' | 'cape' | 'parita'
  k: string // sintesi Kruger (riferimento: Skukuza)
  c: string // sintesi Città del Capo
  note: string
}

export const DAYS: DayPlan[] = [
  {
    date: '2026-09-11',
    dow: 'Venerdì',
    title: 'Partenza dall’Italia',
    zoneLabel: 'In volo',
    route: 'Italia → Johannesburg (volo notturno)',
    intro: [
      'Partenza dall’Italia in serata: volo notturno con arrivo a Johannesburg sabato alle 9:00.',
      'Nessuna sosta in Sudafrica oggi: il sito è pronto per le prossime giornate.',
    ],
    tips: [
      { icon: '🛏️', text: 'Posti comodi e tappi: arrivo alle 9:00 e alle 10:00 si è già al noleggio auto.' },
    ],
    stopIds: [],
    mainStop: null,
  },
  {
    date: '2026-09-12',
    dow: 'Sabato',
    title: 'Arrivo a Johannesburg + Blyde River Canyon',
    zoneLabel: 'Kruger',
    route: 'OR Tambo → Three Rondavels (~4,5–5 h) → Bourke’s Luck · God’s Window → Numbi (1 h)',
    intro: [
      '09:00 atterraggio a OR Tambo · ritiro del 4×4 (€100 a testa) e partenza ~10:00 verso il Blyde River Canyon.',
      'Sosta panoramica ai Three Rondavels, poi Bourke’s Luck Potholes e God’s Window, e un’ora fino a Numbi Hotel & Garden Suite, dove si pernotta.',
      'Sulla scarpata del canyon (~1.000 m) fa più fresco che nel bushveld: 5–6 °C in meno rispetto a Numbi.',
    ],
    tips: [
      { icon: '🧥', text: 'Pile a portata di mano: a Johannesburg alle 9:00 ci sono ~9–10 °C.' },
      { icon: '🌤️', text: 'Il pomeriggio ai belvederi del Blyde è in genere il momento più limpido.' },
    ],
    stopIds: ['jnb', 'blyde', 'potholes', 'godswindow', 'numbi'],
    mainStop: 'blyde',
  },
  {
    date: '2026-09-13',
    dow: 'Domenica',
    title: 'Phabeni Gate → Skukuza · primo safari',
    zoneLabel: 'Kruger',
    route: 'Phabeni Gate → Skukuza Rest Camp (check-in 14:00)',
    intro: [
      'Ingresso dal Phabeni Gate e guida verso Skukuza con safari in autonomia fino al check-in delle 14:00.',
      'Da prenotare al campo: Night Drive SANParks che parte al tramonto (30–40 €).',
      'Cielo variabile: possibile velatura o pioviggine breve, ma niente che fermi il safari. Il modello americano GFS vede anzi una giornata di sole pieno.',
    ],
    tips: [
      { icon: '🧣', text: 'Al Night Drive la sera fa ~16–18 °C: pile leggero e macchina fotografica pronta.' },
      { icon: '🌅', text: 'L’alba è ~5:50 e i cancelli aprono con la luce: la mattina a Skukuza è la migliore per gli avvistamenti.' },
    ],
    stopIds: ['phabeni', 'skukuza'],
    mainStop: 'skukuza',
  },
  {
    date: '2026-09-14',
    dow: 'Lunedì',
    title: 'H4-1 → Lower Sabie · Guided Sunset',
    zoneLabel: 'Kruger',
    route: 'Skukuza → H4-1 → Lower Sabie Rest Camp (~3 h a 25 km/h)',
    intro: [
      'Mattina: guida lungo la strada H4-1 verso Lower Sabie, con soste di avvistamento.',
      'Da prenotare: Guided Sunset SANParks (30–40 €). Sosta a Sunset Dam per ippopotami e coccodrilli, pernottamento a Lower Sabie (vista fiume).',
      'È il giorno col rischio pioggia più alto del soggiorno al Kruger (1–3 mm, probabilità ~25%): ma resta una pioviggine leggera, non un acquazzone.',
    ],
    tips: [
      { icon: '🌇', text: 'Pile leggero e macchina fotografica per il Guided Sunset sul fiume.' },
      { icon: '🔄', text: 'Divergenza modelli: GFS vede sole e 32–33 °C. Vale la pena ricontrollare a 48 h.' },
    ],
    stopIds: ['skukuza', 'lowersabie'],
    mainStop: 'lowersabie',
  },
  {
    date: '2026-09-15',
    dow: 'Martedì',
    title: 'Verso Satara · le praterie e i big cats',
    zoneLabel: 'Kruger',
    route: 'Lower Sabie → Satara Rest Camp (~5 h a 25 km/h)',
    intro: [
      'Mattina: guida verso nord in direzione Satara. La boscaglia si dirada e diventa prateria: cercare i grandi branchi di leoni e ghepardi che cacciano nelle pianure aperte.',
      'Da prenotare: Sunset Drive SANParks (30–40 €). Pernottamento a Satara, l’atmosfera più selvaggia e autentica del parco.',
      'Piovaschi brevi possibili nel pomeriggio (probabilità ~10–14%): cielo praticabile per tutto il giorno.',
    ],
    tips: [
      { icon: '🦁', text: 'Se passa un acquazzone, i felini si spostano ai waterhole: momento perfetto per gli avvistamenti.' },
    ],
    stopIds: ['satara'],
    mainStop: 'satara',
  },
  {
    date: '2026-09-16',
    dow: 'Mercoledì',
    title: 'Satara → Hoedspruit ✈ Città del Capo',
    zoneLabel: 'Kruger → Capo',
    route: 'Satara → Hoedspruit (~2,5 h) · volo 14:00 → Cape Town (~17:00)',
    intro: [
      'Mattina: Satara → Hoedspruit (~2,5 ore), riconsegna del 4×4 e volo delle 14:00 da Eastgate Airport (€150) per Città del Capo.',
      'Il meteo accompagna il trasferimento: in miglioramento sul Kruger, volo senza problemi.',
      'Attenzione alla sera: a Città del Capo il 16 è la giornata più piovosa della finestra (5–15 mm secondo i modelli) — è l’ultimo fronte invernale che passa.',
    ],
    tips: [
      { icon: '☔', text: 'Sera al coperto: cena in città, niente programmi all’aperto all’arrivo.' },
      { icon: '✈️', text: 'Giacca antipioggia in cima al bagaglio a mano per lo sbarco.' },
    ],
    stopIds: ['satara', 'hoedspruit', 'capetown'],
    mainStop: 'hoedspruit',
  },
  {
    date: '2026-09-17',
    dow: 'Giovedì',
    title: 'Giro città',
    zoneLabel: 'Città del Capo',
    route: 'Città del Capo: V&A Waterfront, musei, Bo-Kaap',
    intro: [
      'Giornata in città, dopo la notte a Cape Town.',
      'È la giornata più debole al Capo: residui del fronte al mattino, fresco e ventilato. I modelli divergono: ECMWF vede 18 °C e miglioramento, GFS 14 °C con vento forte.',
      'Niente Table Mountain oggi: nuvole e vento rovinerebbero la vista. La mattina del 19 sarà dedicata ai giardini di Kirstenbosch.',
    ],
    tips: [
      { icon: '🏛️', text: 'Piano indoor flessibile; se esce il sole, punta a Signal Hill o ai Giardini della Compagnia.' },
    ],
    stopIds: ['capetown', 'tablemountain'],
    mainStop: 'capetown',
  },
  {
    date: '2026-09-18',
    dow: 'Venerdì',
    title: 'Tour della penisola · giornata intera',
    zoneLabel: 'Città del Capo',
    route: 'Chapman’s Peak → Cape Point → Boulders Beach',
    intro: [
      'Giro completo della penisola: Chapman’s Peak, Cape Point / Capo di Buona Speranza, pinguini a Boulders Beach.',
      'Bel tempo: sole o schiarite, 19–20 °C, pioggia assente. Il vento di sud-est primaverile è di casa a Cape Point.',
    ],
    tips: [
      { icon: '🌬️', text: 'Giacca antivento: a Cape Point soffia sempre, oggi con raffiche fino a ~50 km/h.' },
      { icon: '🌞', text: 'Parti presto: il sole migliore sulla penisola è al mattino.' },
    ],
    stopIds: ['capetown', 'capepoint'],
    mainStop: 'capepoint',
  },
  {
    date: '2026-09-19',
    dow: 'Sabato',
    title: 'Mattina: giardini di Kirstenbosch · rientro',
    zoneLabel: 'Città del Capo',
    route: 'Cape Town (giardini) → OR Tambo (15:00–17:00) → Italia (22:00)',
    intro: [
      'Mattina: l’appuntamento meteo migliore del soggiorno al Capo — sole e 25–26 °C secondo ECMWF. Giro dei giardini botanici di Kirstenbosch, alle pendici della Table Mountain.',
      '15:00–17:00 volo Cape Town → Johannesburg (€60); alle 22:00 decollo per l’Italia.',
      'La serata a Johannesburg è fredda: ~10 °C alle 22:00 sull’altopiano.',
    ],
    tips: [
      { icon: '🌿', text: 'Kirstenbosch apre presto e al mattino ha meno visitatori: sole sulle aiuole prima del volo.' },
      { icon: '🧥', text: 'Pile a portata di mano per la serata a JNB e il volo di rientro.' },
    ],
    stopIds: ['capetown', 'kirstenbosch', 'jnb'],
    mainStop: 'kirstenbosch',
  },
]

// Confronto Kruger (riferimento: Skukuza) vs Città del Capo, giorno per giorno.
// Il 16–19 il viaggiatore è al Capo; le colonne Kruger restano utili perché le
// tappe del Kruger sono interscambiabili fino al 16.
export const VERDICTS: Verdict[] = [
  {
    date: '2026-09-12',
    better: 'kruger',
    k: 'Sole o velature, 26–28 °C, asciutto',
    c: 'Nuvoloso e molto ventoso: raffiche fino a ~99 km/h, 20 °C',
    note: 'Kruger: giornata di trasferimento con bel tempo ovunque; il Capo è ventoso ma non lo vedi ancora.',
  },
  {
    date: '2026-09-13',
    better: 'parita',
    k: 'Variabile: 24–33 °C a seconda del modello, pioviggine possibile',
    c: 'Nuvole in dissolvimento, 25 °C, vento in calo',
    note: 'Pareggio: al Kruger è il primo giorno di safari e il tempo regge; al Capo il pomeriggio migliora.',
  },
  {
    date: '2026-09-14',
    better: 'parita',
    k: 'Nuvoloso, 1–3 mm, 25 °C — giorno col rischio pioggia più alto al Kruger',
    c: 'Nuvole e schiarite, 22–23 °C, pioggia assente',
    note: 'Pareggio: nessuna zona eccellente, entrambe praticabili. Il Guided Sunset a Lower Sabie chiude la giornata sul fiume.',
  },
  {
    date: '2026-09-15',
    better: 'kruger',
    k: 'Piovaschi brevi possibili (10–14%), 25–26 °C',
    c: 'Fronte in arrivo: 17 °C, pioggia al 50%',
    note: 'Kruger: il fronte inizia a bagnare il Capo mentre tu sei nelle praterie di Satara.',
  },
  {
    date: '2026-09-16',
    better: 'kruger',
    k: 'In miglioramento: 27 °C, mattina asciutta, volo ok',
    c: 'Peggior giorno della finestra: 5–15 mm, 15–16 °C',
    note: 'Kruger di giorno, ma la sera sei al Capo: programma al coperto per l’arrivo.',
  },
  {
    date: '2026-09-17',
    better: 'cape',
    k: 'Fronte sul Lowveld: 16–18 °C e raffiche 60–90 km/h (non ci sei più)',
    c: 'Residui al mattino, poi migliora: 14–18 °C (GFS: più freddo e ventoso)',
    note: 'Capo in ripresa: giornata cittadina flessibile; al Kruger soffia fortissimo, ma hai già volato via.',
  },
  {
    date: '2026-09-18',
    better: 'cape',
    k: 'Crollo termico e vento: 16–18 °C, raffiche 60–90 km/h',
    c: 'Sole o schiarite, 19–20 °C, asciutto',
    note: 'Capo nettamente: giornata perfetta per la penisola, mentre il Kruger è sotto il fronte.',
  },
  {
    date: '2026-09-19',
    better: 'cape',
    k: 'Recupero: 22 °C (GFS: ancora piovoso al mattino)',
    c: 'Sole, 25–26 °C, vento debole — migliore del soggiorno',
    note: 'Capo: mattina di sole per i giardini di Kirstenbosch, poi volo di rientro senza intoppi.',
  },
]
