/**
 * lib/seo/content/batterie.ts — Cluster-Seite `/camper-elektrik/batterie/`.
 * Sie ist gleichzeitig das Elternthema von LiFePO4 und AGM (Topics `lifepo4`,
 * `agm` hängen in `topics.ts` unter `batterie`).
 */

import { VDE_BATTERY_DOD, VDE_DISCHARGE_VOLTAGE_FACTOR } from '@/lib/vde-standards';

import type { SeoPageContent } from '../types';

const DOD_ROWS = Object.entries(VDE_BATTERY_DOD).map(([chemistry, dod]) => [
  chemistry === 'Blei' ? 'Nassblei' : chemistry,
  `${Math.round(dod * 100)} %`,
  `${Math.round(dod * 100)} Ah`,
  chemistry === 'LiFePO4'
    ? 'Hohe Zyklenzahl, BMS nötig, teurer'
    : chemistry === 'AGM'
      ? 'Robust, günstig, schwerer'
      : chemistry === 'Gel'
        ? 'Wie AGM, empfindlicher gegen hohe Ladeströme'
        : 'Günstig, geringe Entladetiefe, Wartung',
]);

export const BATTERIE_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/batterie/',
  slug: 'batterie',
  topicId: 'batterie',
  kind: 'cluster',
  title: 'Camper-Batterie dimensionieren: Kapazität richtig wählen',
  absoluteTitle: true,
  description:
    'Aufbaubatterie im Camper dimensionieren: Entladetiefe je Chemie, nutzbare Kapazität, Peukert-Effekt und Autarkie — vom Tagesbedarf zur Nennkapazität in Ah.',
  h1: 'Camper-Batterie dimensionieren',
  lead: 'Nicht die Nennkapazität auf dem Etikett entscheidet über die Autarkie, sondern der Anteil, den die Chemie wirklich hergibt. Diese Seite rechnet vom Tagesbedarf zur benötigten Batteriegröße — und zeigt, welche Verluste dabei entstehen.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'rechner',
      heading: 'Kapazität aus dem Tagesbedarf berechnen',
      body: [
        'Der Rechner nimmt den Tagesbedarf in Wattstunden, die gewünschte Zahl autarker Tage und die Chemie — und nennt die Nennkapazität, die daraus folgt. Der Peukert-Effekt hoher Ströme ist enthalten, ein Reservezuschlag ist ein sichtbarer Eingabewert.',
      ],
      calculator: 'batteriekapazitaet',
    },
    {
      id: 'nutzbar',
      heading: 'Nutzbar statt nominell',
      formula: {
        expression: 'C_nutz = C_nenn · DoD',
        caption:
          'Die Entladetiefe (Depth of Discharge) bestimmt, welcher Anteil der Nennkapazität entnehmbar ist.',
      },
      table: {
        caption: 'Entladetiefen des Modells (`VDE_BATTERY_DOD`) und ihre Folge für die Planung',
        head: ['Chemie', 'Entladetiefe', 'Nutzbar bei 100 Ah', 'Einordnung'],
        rows: DOD_ROWS,
        note: 'Werte sind Planungsannahmen des Modells: Die Herstellerangabe der konkreten Batterie geht vor.',
      },
      body: [
        'Eine 100-Ah-AGM liefert in diesem Modell 50 Ah, eine 100-Ah-LiFePO4 dagegen 90 Ah. Wer Äpfel mit Birnen vergleicht — „Lithium ist teurer" — übersieht, dass er für dieselbe nutzbare Energie die doppelte AGM-Kapazität und damit etwa das doppelte Gewicht braucht.',
      ],
    },
    {
      id: 'peukert',
      heading: 'Peukert: Warum hohe Ströme Kapazität kosten',
      body: [
        'Die Nennkapazität einer Batterie gilt für eine bestimmte Entladezeit (üblich 20 Stunden, also C/20). Wird schneller entladen, sinkt die entnehmbare Kapazität — die Ladung, die noch in der Batterie steckt, ist dann nicht mehr vollständig nutzbar. Der Peukert-Exponent beschreibt diesen Effekt je Chemie; das Modell führt LiFePO4 mit 1,05, AGM mit 1,12 und Gel mit 1,15.',
        'Ein Beispiel: Eine 100-Ah-AGM ist auf 5 A Entladestrom normiert (C/20). Bei 40 A Entladestrom bleiben nur 77,9 % der Kapazität nutzbar — zusammen mit der Entladetiefe von 50 % also 39,0 statt 50 Ah. In der Planung ist das relevant, sobald Wechselrichter, Kaffeemaschine oder Induktionskochfeld mitlaufen.',
      ],
      callout: {
        tone: 'info',
        text: 'Der Peukert-Exponent ist ein chemiespezifischer Faustwert; ein Datenblattwert (falls vorhanden) schlägt ihn im Modell. Wer einen exakten Wert hat, trägt ihn im Planer an der Batterie ein.',
      },
    },
    {
      id: 'spannung',
      heading: 'Mit welcher Spannung gerechnet wird',
      body: [
        'Dimensionierungsströme dürfen nicht mit der Nennspannung gerechnet werden. Am Entladeende liefert eine Batterie weniger Spannung, und dieselbe Leistung zieht dann mehr Strom: Das Modell rechnet mit 12,8 V für Lithium-Bänke und 12,0 V für Blei, die Entladeschlussspannung liegt bei ' +
          `${(VDE_DISCHARGE_VOLTAGE_FACTOR * 100).toFixed(2).replace('.', ',')} % der Nennspannung — bei einer Bleibank also bei 11,25 V.`,
        'Für die Kapazitätsbemessung zählt der TAGESBEDARF in Wattstunden, nicht der Spitzenstrom: Ein Gerät mit hoher Leistung über kurze Zeit verschiebt die Batteriegröße weniger, als die Peukert-Reduktion erwarten lässt. Beides gehört jedoch in die Bilanz.',
      ],
    },
    {
      id: 'autarkie',
      heading: 'Autarkie: Tage, nicht Stunden',
      body: [
        'Autarkie heißt hier: wie viele Tage die Batterie den Tagesbedarf deckt, ohne Ladung. Die Rechnung ist einfach — Kapazität × Entladetiefe × Peukert-Faktor gegen den Tagesbedarf —, die Annahmen sind es nicht: Im Winter sinkt der Solarertrag auf 35 % des Sommerwerts, und eine Bleibatterie verliert bei Kälte zusätzlich nutzbare Kapazität.',
        'Für ein Wochenendfahrzeug sind ein bis zwei Tage Autarkie üblich, für ein Reisefahrzeug mit Solar drei. Eine größere Batterie ist selten der günstigste Weg dorthin: Mehr Ladung (Solar, Fahren) hilft meist mehr als mehr Speicher.',
      ],
      links: [
        { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
        { href: '/rechner/solaranlage/', label: 'Solaranlage berechnen' },
        { href: '/camper-elektrik/solar/', label: 'Solar im Camper auslegen' },
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Nennkapazität mit nutzbarer Kapazität verwechseln — der häufigste Fehler bei der Auslegung.',
          'Peukert ignorieren, obwohl ein Wechselrichter mit 100 A Dauerstrom dranhängt.',
          'Start- und Aufbaubatterie gemeinsam bilanzieren: Die Starterbatterie ist keine Reserve für den Aufbau.',
          'Batterien unterschiedlichen Alters oder Typs parallel schalten: Die schwächere bestimmt das Verhalten, die stärkere altert mit.',
          'Den Ladepfad vergessen: Eine große Batterie ohne Ladung verlängert nur die Zeit bis zum leeren Zustand.',
        ],
      },
    },
    {
      id: 'naechster-schritt',
      heading: 'Nächster Schritt',
      links: [
        { href: '/camper-elektrik/lifepo4/', label: 'LiFePO4 im Camper' },
        { href: '/camper-elektrik/agm/', label: 'AGM und Gel im Camper' },
        { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen am Batteriepol' },
        { href: '/elektrik-planung/#planer', label: 'Camper-Elektroplaner öffnen' },
      ],
    },
  ],
  faq: [
    {
      question: 'Wie groß sollte die Aufbaubatterie im Camper sein?',
      answer:
        'Sie folgt aus dem Tagesbedarf, nicht aus einer Faustregel: Kapazität = Tagesbedarf / (Systemspannung × Entladetiefe) × Autarkietage, dazu ein Reservezuschlag nach eigener Entscheidung. Ein Kastenwagen mit 1 000 Wh Tagesbedarf und einem Tag Autarkie braucht in LiFePO4 rechnerisch 92,6 Ah Nennkapazität — üblich ist dann eine 95-Ah-Batterie.',
    },
    {
      question: 'Wie tief darf eine Camper-Batterie entladen werden?',
      answer:
        'Das Modell rechnet mit 90 % bei LiFePO4, 50 % bei AGM und Gel und 30 % bei Nassblei. Die Werte sind Planungsannahmen: Das Datenblatt der konkreten Batterie und die Abschaltschwellen des BMS oder des Wechselrichters gehen vor.',
    },
    {
      question: 'Was ist der Peukert-Effekt in der Praxis?',
      answer:
        'Die entnehmbare Kapazität sinkt, wenn schnell entladen wird. Bei einer 100-Ah-AGM bleiben bei 40 A Entladestrom statt 50 Ah nur noch rund 39 Ah nutzbar (Faktor 0,78). Eine 100-Ah-LiFePO4 liefert bei gleichem Strom 81 statt 90 Ah (Faktor 0,90) — der Effekt ist geringer, aber nicht null. Der Rechner weist den Faktor deshalb aus.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/lifepo4/', label: 'LiFePO4 im Camper' },
    { href: '/camper-elektrik/agm/', label: 'AGM und Gel im Camper' },
    { href: '/camper-elektrik/solar/', label: 'Solar im Camper auslegen' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Entladetiefen in der Auslieferung',
      detail: 'LiFePO4 90 %, AGM und Gel 50 %, Nassblei 30 % — `VDE_BATTERY_DOD` in `lib/vde-standards.ts`.',
    },
    {
      label: 'Peukert-Faustwerte',
      detail:
        'LiFePO4 1,05 · AGM 1,12 · Gel 1,15 — `lib/peukert.ts`, dort ausdrücklich als Faustwerte gekennzeichnet.',
    },
    {
      label: 'Entladeschlussspannung',
      detail:
        'Faktor 0,9375 auf die Nennspannung (`lib/vde-standards.ts`), dokumentierte Modellannahme mit 3,0 V je LiFePO4-Zelle.',
    },
  ],
  assumptions: [
    'Entladetiefe und Peukert-Exponent sind Modellannahmen je Chemie; Datenblattwerte schlagen sie.',
    'Alterung, Zyklenzahl und Temperaturverhalten sind nicht modelliert — der Reservezuschlag ist ein sichtbarer Eingabewert.',
  ],
  limits: [
    'Batteriemanagement-Systeme (BMS) mit eigenen Abschaltschwellen sind nicht Teil der Kapazitätsrechnung.',
    'Blei- und Lithiumbatterien in einer Bank sind nicht modelliert — sie verhalten sich unterschiedlich und gehören nicht parallel.',
  ],
};
