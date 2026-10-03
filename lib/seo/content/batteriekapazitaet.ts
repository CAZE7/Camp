/**
 * lib/seo/content/batteriekapazitaet.ts — Rechner-Seite
 * `/rechner/batteriekapazitaet/`.
 *
 * Der Rechner ist Hauptinhalt; der Text erklärt Eingaben, Ergebnis, Formel,
 * Annahmen und Grenzen, statt die Seite künstlich zu füllen (§8).
 */

import { sizeBattery } from '@/lib/batterySizing';
import { PEUKERT_EXPONENT } from '@/lib/peukert';
import { VDE_BATTERY_DOD } from '@/lib/vde-standards';

import type { SeoPageContent } from '../types';

const EXAMPLE = sizeBattery({
  dailyEnergyWh: 1000,
  autonomyDays: 1,
  systemVoltageV: 12,
  chemistry: 'LiFePO4',
});
const EXAMPLE_AGM = sizeBattery({
  dailyEnergyWh: 1000,
  autonomyDays: 1,
  systemVoltageV: 12,
  chemistry: 'AGM',
});

export const BATTERIEKAPAZITAET_CONTENT: SeoPageContent = {
  path: '/rechner/batteriekapazitaet/',
  slug: 'batteriekapazitaet',
  topicId: 'batterie',
  kind: 'rechner',
  title: 'Batteriekapazität für den Camper berechnen',
  absoluteTitle: true,
  description:
    'Batteriekapazität berechnen: Tagesbedarf, Autarkietage, Entladetiefe und Peukert-Effekt ergeben die nötige Nennkapazität in Ah — mit Beispielrechnung.',
  h1: 'Batteriekapazität berechnen',
  lead: 'Dieser Rechner beantwortet die Frage, wie groß die Aufbaubatterie sein muss: aus dem Tagesbedarf in Wattstunden, der gewünschten Zahl autarker Tage und der Chemie — inklusive der Verluste, die die Nennkapazität zur Wunschzahl machen.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.9,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'rechner',
      heading: 'Tagesbedarf, Autarkie und Chemie eingeben',
      body: [
        'Der Rechner erwartet vier Angaben: den Tagesbedarf in Wattstunden, die Zahl der autarken Tage, die Systemspannung und die Chemie. Optional sind ein Reservezuschlag und ein Dauerstrom — beide verändern das Ergebnis sichtbar und sind deshalb Eingaben, keine versteckten Annahmen.',
      ],
      calculator: 'batteriekapazitaet',
    },
    {
      id: 'eingaben',
      heading: 'Was die Eingaben bedeuten',
      definitions: [
        {
          term: 'Tagesbedarf (Wh)',
          description:
            'Summe aus Leistung × Nutzungsdauer aller Verbraucher an einem Tag. Wer ihn nicht kennt, schätzt konservativ — der Fehler wirkt sich sonst im Winter aus.',
        },
        {
          term: 'Autarkietage',
          description:
            'Tage ohne Ladung. Ein Wochenendfahrzeug braucht einen Tag, ein Reisefahrzeug mit Solar zwei bis drei.',
        },
        {
          term: 'Entladetiefe (DoD)',
          description: `Kommt aus der Chemie und steht im Modell fest: LiFePO4 ${Math.round((VDE_BATTERY_DOD.LiFePO4 ?? 0) * 100)} %, AGM und Gel ${Math.round((VDE_BATTERY_DOD.AGM ?? 0) * 100)} %, Nassblei ${Math.round((VDE_BATTERY_DOD.Blei ?? 0) * 100)} %.`,
        },
        {
          term: 'Dauerstrom (A, optional)',
          description:
            'Der Strom der stärksten Last. Er bestimmt den Peukert-Faktor; ohne Angabe rechnet der Rechner mit dem Tagesmittel (Bedarf / 24 h).',
        },
        {
          term: 'Reserve (%)',
          description:
            'Zuschlag für Alterung, Kälte und unvollständige Ladung. Standard 0, weil das Modell diese Effekte nicht kennt — die Entscheidung bleibt beim Nutzer.',
        },
      ],
    },
    {
      id: 'ergebnis',
      heading: 'Was das Ergebnis sagt — und was nicht',
      body: [
        `Im Beispiel (1 000 Wh Tagesbedarf, ein autarker Tag, 12 V, LiFePO4) fordert die Rechnung ${EXAMPLE.requiredNominalAh.toFixed(1).replace('.', ',')} Ah Nennkapazität; die Empfehlung rundet auf ${EXAMPLE.recommendedNominalAh} Ah in 5-Ah-Stufen. Mit AGM sind es ${EXAMPLE_AGM.recommendedNominalAh} Ah — mehr als das Doppelte für dieselbe nutzbare Energie.`,
        'Das Ergebnis ist eine Nennkapazität, die den TAGESBEDARF deckt. Es ist keine Aussage darüber, ob die Batterie bei Kälte oder nach drei Jahren noch dieselbe Kapazität hat, und keine Aussage über den Ladepfad: Eine große Batterie ohne Ladung verlängert nur die Zeit bis zum leeren Zustand.',
      ],
      formula: {
        expression: 'C_nenn = (Bedarf_Wh · Tage) / (U · DoD) · (1 + Reserve)',
        caption:
          'Der Peukert-Faktor kommt hinzu, sobald ein Dauerstrom angegeben ist — er mindert die nutzbare Kapazität, nicht die Empfehlung.',
      },
    },
    {
      id: 'peukert',
      heading: 'Peukert: warum hohe Lasten mehr Kapazität kosten',
      body: [
        `Die Nennkapazität gilt für eine 20-stündige Entladung (C/20). Wird schneller entladen, sinkt die entnehmbare Kapazität — das Modell führt dafür je Chemie einen Exponenten (LiFePO4 ${PEUKERT_EXPONENT.LiFePO4}, AGM ${PEUKERT_EXPONENT.AGM}, Gel ${PEUKERT_EXPONENT.Gel}).`,
        'Bei 40 A Entladestrom bleiben aus einer 100-Ah-AGM nur noch 39 Ah nutzbar (50 % Entladetiefe × Faktor 0,78). Wer einen Wechselrichter betreibt, sollte deshalb den Dauerstrom eingeben und nicht mit dem Tagesmittel rechnen.',
      ],
    },
    {
      id: 'ladepfad',
      heading: 'Der Ladepfad gehört zur Dimensionierung',
      body: [
        `Der Rechner nennt zusätzlich den Ladestrom, der den Tagesbedarf in einem Ladefenster nachlädt — inklusive des Ladezeit-Aufschlags von 15 %, den das Modell ansetzt (CC/CV-Knick, Wärme, Alterung). Im Beispiel sind das bei 5 Stunden Ladefenster rund ${EXAMPLE.chargeCurrentA.toFixed(0)} A.`,
        'Damit lässt sich prüfen, ob Solar, Lichtmaschine oder Landstromgerät überhaupt liefern können, was die Batterie braucht. Eine Batterie, die nicht nachgeladen wird, ist nach dem ersten Standtag leer — unabhängig von ihrer Größe.',
      ],
      links: [
        {
          href: '/rechner/solaranlage/',
          label: 'Solaranlage berechnen',
          description: 'Modulleistung für denselben Tagesbedarf.',
        },
        { href: '/camper-elektrik/solar/', label: 'Solar im Camper auslegen' },
        { href: '/camper-elektrik/lifepo4/', label: 'LiFePO4 im Camper' },
        { href: '/camper-elektrik/agm/', label: 'AGM und Gel im Camper' },
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Nennkapazität mit nutzbarer Kapazität verwechseln.',
          'Tagesbedarf zu optimistisch schätzen — Geräte im Standby und der Wechselrichter im Leerlauf fehlen regelmäßig.',
          'Spitzenlasten unterschlagen: Sie ändern nicht die Empfehlung des Tagesbedarfs, aber die nutzbare Kapazität über den Peukert-Faktor.',
          'Die Batterie ohne Blick auf den Ladepfad vergrößern.',
          'Reserve doppelt einrechnen: Wer die Entladetiefe schon konservativ wählt, braucht nicht zusätzlich 30 %.',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Die berechnete Kapazität lässt sich im [Camper-Elektroplaner](/elektrik-planung/#planer) direkt an der Batterie eintragen — dort prüft sie die Energiebilanz gegen alle Verbraucher und Ladepfade.',
      },
    },
  ],
  faq: [
    {
      question: 'Welche Werte brauche ich, um die Batteriekapazität zu berechnen?',
      answer:
        'Den Tagesbedarf in Wattstunden, die Zahl der autarken Tage, die Systemspannung und die Chemie. Der Tagesbedarf entsteht aus Leistung × Nutzungsdauer je Verbraucher — eine Beispieltabelle dafür steht auf der Seite „Camper-Elektrik planen".',
    },
    {
      question: 'Warum empfehlen LiFePO4 und AGM unterschiedliche Kapazitäten?',
      answer:
        'Weil die Entladetiefe unterschiedlich ist: Das Modell rechnet LiFePO4 mit 90 %, AGM mit 50 %. Für denselben Tagesbedarf braucht AGM deshalb fast die doppelte Nennkapazität — inklusive des höheren Gewichts und des stärkeren Peukert-Effekts.',
    },
    {
      question: 'Ist die empfohlene Kapazität ein Sicherheitspuffer?',
      answer:
        'Nein. Die Empfehlung deckt genau den eingegebenen Tagesbedarf über die angegebene Zahl von Tagen. Ein Puffer für Alterung oder Kälte ist nicht enthalten — dafür gibt es den Reserve-Eingabewert, dessen Höhe man selbst verantworten muss.',
    },
  ],
  related: [
    { href: '/camper-elektrik/batterie/', label: 'Camper-Batterie dimensionieren' },
    { href: '/rechner/solaranlage/', label: 'Solaranlage berechnen' },
    { href: '/camper-elektrik/lifepo4/', label: 'LiFePO4 im Camper' },
    { href: '/camper-elektrik/agm/', label: 'AGM und Gel im Camper' },
    { href: '/rechner/', label: 'Alle Rechner im Überblick' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Entladetiefen',
      detail: 'LiFePO4 90 %, AGM/Gel 50 %, Nassblei 30 % — `VDE_BATTERY_DOD` in `lib/vde-standards.ts`.',
    },
    {
      label: 'Peukert',
      detail: 'Exponenten 1,05 / 1,12 / 1,15 in `lib/peukert.ts` (dort als Faustwerte gekennzeichnet).',
    },
    {
      label: 'Ladezeit-Aufschlag',
      detail:
        'Faktor 1,15 (`VDE_CHARGE_DERATING_FACTOR`) — dieselbe Größe nutzt die Ladezeit-Schätzung des Planers.',
    },
  ],
  assumptions: [
    'Die Entladezeit-Normierung liegt bei 20 Stunden (C/20); schnellere Entladung wird über den Peukert-Faktor abgebildet.',
    'Ohne Dauerstromangabe rechnet der Rechner mit dem Tagesmittelstrom.',
    'Der Reservezuschlag ist ein Eingabewert, keine Modellannahme.',
  ],
  limits: [
    'Alterung, Zyklenzahl, Temperaturverhalten und BMS-Abschaltschwellen sind nicht modelliert.',
    'Ein Batterieverbund aus mehreren Blöcken wird als Summe der Nennkapazitäten gerechnet; Mischbestückung ist nicht abgebildet.',
  ],
};
