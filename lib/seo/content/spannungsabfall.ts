/**
 * lib/seo/content/spannungsabfall.ts — Cluster-Seite
 * `/camper-elektrik/spannungsabfall/`.
 *
 * Die Tabellen entstehen aus `voltageDropFor` und `maxCurrentForPlanLimit`
 * (lib/cableSizing.ts) — dieselbe Rechnung, die der Rechner und der Planer
 * benutzen.
 */

import { maxCurrentForPlanLimit, voltageDropFor } from '@/lib/cableSizing';
import { VDE_SIZES, VOLTAGE_DROP_PCT_CRITICAL, VOLTAGE_DROP_PCT_PLAN_LIMIT } from '@/lib/electrical';
import { COPPER_CONDUCTIVITY_MS_PER_MM2 } from '@/lib/materials';

import type { SeoPageContent } from '../types';

/** Spannungsfall bei 10 A über 5 m je Normquerschnitt. */
const DROP_ROWS = VDE_SIZES.filter((size) => size <= 25).map((size) => {
  const result = voltageDropFor(10, 5, size);
  return [
    `${size.toFixed(1).replace('.', ',')} mm²`,
    `${result.dropV.toFixed(2).replace('.', ',')} V`,
    `${result.dropPercent.toFixed(2).replace('.', ',')} %`,
    result.dropPercent <= 1
      ? 'Zielbereich'
      : result.dropPercent <= VOLTAGE_DROP_PCT_PLAN_LIMIT
        ? 'innerhalb der Planungsgrenze'
        : 'über der Planungsgrenze',
  ];
});

/** Reichweite eines Querschnitts: größter Strom bis 3 % Fall. */
const REACH_ROWS = VDE_SIZES.filter((size) => size <= 16).map((size) => [
  `${size.toFixed(1).replace('.', ',')} mm²`,
  `${maxCurrentForPlanLimit(size, 2.5).toFixed(1).replace('.', ',')} A`,
  `${maxCurrentForPlanLimit(size, 5).toFixed(1).replace('.', ',')} A`,
  `${maxCurrentForPlanLimit(size, 10).toFixed(1).replace('.', ',')} A`,
]);

export const SPANNUNGSABFALL_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/spannungsabfall/',
  slug: 'spannungsabfall',
  topicId: 'spannungsabfall',
  kind: 'cluster',
  title: 'Spannungsabfall bei 12 V: berechnen und begrenzen',
  absoluteTitle: true,
  description:
    'Spannungsabfall in der 12-V-Anlage berechnen: Formel, Tabelle je Querschnitt, Grenzwerte und die Frage, ab wann ein Verbraucher zu wenig Spannung bekommt.',
  h1: 'Spannungsabfall bei 12 V berechnen',
  lead: 'Eine Leitung ist kein idealer Leiter: Über Hin- und Rückleitung fällt Spannung ab, und was am Verbraucher ankommt, ist weniger als das, was die Batterie liefert. Diese Seite zeigt, wie groß der Verlust ist, wann er zum Problem wird und wie man ihn begrenzt.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'rechner',
      heading: 'Spannungsfall einer Leitung nachrechnen',
      body: [
        'Der Rechner bewertet eine bereits gewählte Leitung: Strom, Länge und Querschnitt eingeben, Ergebnis in Volt und Prozent — eingeteilt in die Grenzen des Modells (1 % / ' +
          `${VOLTAGE_DROP_PCT_PLAN_LIMIT} % / ${VOLTAGE_DROP_PCT_CRITICAL} %).`,
      ],
      calculator: 'spannungsabfall',
    },
    {
      id: 'formel',
      heading: 'Formel und Größenordnung',
      formula: {
        expression: 'ΔU = (I · 2 · L) / (κ · A)',
        caption: `κ = ${COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²) bei 20 °C, A = Querschnitt in mm², L = einfache Länge in Metern.`,
      },
      body: [
        'Die Formel ist die Umkehrung der Querschnittsbemessung — dieselbe Physik, andere Frage. Wer den Spannungsfall einer bestehenden Leitung kennt, weiß auch, warum ein Verbraucher am Ende einer langen dünnen Leitung schwächer arbeitet: Bei 12 V sind 0,5 V bereits mehr als 4 %.',
      ],
    },
    {
      id: 'tabelle',
      heading: 'Spannungsfall bei 10 A über 5 m je Querschnitt',
      table: {
        caption: 'Modellrechnung bei 12 V Nennspannung, Kupfer bei 20 °C',
        head: ['Querschnitt', 'ΔU', 'ΔU in Prozent', 'Einordnung'],
        rows: DROP_ROWS,
        note: `Die Planungsgrenze liegt bei ${VOLTAGE_DROP_PCT_PLAN_LIMIT} % (0,36 V), ab ${VOLTAGE_DROP_PCT_CRITICAL} % meldet der Planer einen Verstoß.`,
      },
      body: [
        'Die Tabelle macht den eigentlichen Konflikt sichtbar: 2,5 mm² über 5 m verliert bei 10 A fast 6 % der Spannung. Die Leitung bleibt dabei kühl — das Problem ist nicht die Erwärmung, sondern die Spannung, die am Verbraucher fehlt.',
      ],
    },
    {
      id: 'reichweite',
      heading: 'Wie weit trägt ein Querschnitt?',
      table: {
        caption: 'Größter Strom bis 3 % Spannungsfall, aus I = κ · A · ΔU / (2 · L)',
        head: ['Querschnitt', 'bei 2,5 m', 'bei 5 m', 'bei 10 m'],
        rows: REACH_ROWS,
        note: 'Beispiel: 2,5 mm² trägt auf 5 m noch 13,1 A bis zur Planungsgrenze. Wer 2 % statt 3 % ansetzt, muss diesen Wert mit 0,66 multiplizieren.',
      },
      body: [
        'Die Tabelle antwortet auf die praktische Frage („reicht mein vorhandenes Kabel für diesen Verbraucher?"), die Formel auf die Planungsfrage. Beide gehören zusammen: Wer den Tagesbedarf kennt, kann die Leitungslänge als Entwurfsgröße begreifen und den Querschnitt danach wählen.',
      ],
      links: [
        {
          href: '/rechner/spannungsabfall-12v/',
          label: 'Spannungsabfall für eine eigene Leitung rechnen',
          description: 'Strom, Länge und Querschnitt eingeben, Ergebnis mit Einordnung.',
        },
      ],
    },
    {
      id: 'grenzen',
      heading: 'Welche Grenze ist die richtige?',
      definitions: [
        {
          term: '1 % — Zielbereich',
          description:
            'Für kurze Leitungen und kurze Wege leicht erreichbar; lässt Reserve für Übergangswiderstände an Klemmen und Sicherungen.',
        },
        {
          term: `${VOLTAGE_DROP_PCT_PLAN_LIMIT} % — Planungsgrenze des Modells`,
          description:
            'Ausgangspunkt der Bemessung in Camp: 0,36 V bei 12 V. Ein guter Kompromiss aus Querschnitt, Gewicht und Kosten.',
        },
        {
          term: '2 % — 0,24 V',
          description:
            'Empfindliche Verbraucher: Kompressor-Kühlschränke, Funkgeräte, Laderegler, Wechselrichter-Zuleitungen. In vielen Tabellenwerken auf 0,25 V gerundet.',
        },
        {
          term: `${VOLTAGE_DROP_PCT_CRITICAL} % — Verstoßgrenze`,
          description:
            'Der Planer meldet ab hier einen Fehler. Ein Verbraucher, der bei 12,8 V spezifiziert ist, arbeitet bei 11,5 V nicht mehr zuverlässig.',
        },
      ],
      callout: {
        tone: 'warning',
        text: 'Der Spannungsfall ist keine Normgrenze, sondern eine Planungsentscheidung. DIN VDE 0100-520 nennt den Spannungsfall, ohne für 12-V-Bordnetze in Fahrzeugen einen Prozentwert festzuschreiben — wer eine Anlage abnehmen lässt, klärt die Zielmarke vorher.',
      },
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Spannungsfall nur auf dem Plusleiter rechnen: Der Rückweg zählt mit, deshalb steht der Faktor 2 in der Formel.',
          'Querschnitt am Verbraucheranschluss verkleinern: Ein 0,75-mm²-Anschlusskabel an einer 10-mm²-Leitung wirkt wie eine Engstelle.',
          'Übergänge vergessen: Jede Klemmstelle, jeder Steckverbinder und jede Sicherung ist ein zusätzlicher Widerstand — bei 12 V fällt er auf.',
          'Batteriespannung als Nennspannung ansetzen: Unter Last liegt eine 12-V-Batterie bei 12,0 bis 12,8 V, nicht bei 12,8 V im Leerlauf.',
          'Kurzschlussstrom mit Spannungsfall verwechseln: Ein dickerer Querschnitt senkt den Spannungsfall, erhöht aber auch den Kurzschlussstrom — die Sicherung muss dazu passen.',
        ],
      },
    },
    {
      id: 'naechster-schritt',
      heading: 'Nächster Schritt',
      body: [
        'Wer den Spannungsfall kennt, kann den Querschnitt wählen — und die Sicherung an die Leitung anpassen. Beides prüft der Planer für jede einzelne Verbindung und meldet Grenzverletzungen, bevor Kabel geschnitten werden.',
      ],
      links: [
        { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
        { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen dimensionieren' },
        { href: '/elektrik-planung/#planer', label: 'Camper-Elektroplaner öffnen' },
      ],
    },
  ],
  faq: [
    {
      question: 'Wie viel Spannungsabfall ist bei 12 V zulässig?',
      answer:
        'Camp dimensioniert mit 3 % (0,36 V). Für empfindliche Verbraucher sind 2 % (0,24 V) die bessere Zielmarke, ab 4 % meldet der Planer einen Verstoß. Eine Normgrenze für 12-V-Bordnetze in Fahrzeugen gibt es nicht: DIN VDE 0298-4 nennt Strombelastbarkeiten, der Spannungsfall ist eine Planungsentscheidung.',
    },
    {
      question: 'Warum ist der Spannungsfall bei 12 V kritischer als bei 230 V?',
      answer:
        'Bei gleicher Leistung fließt bei 12 V der rund 19-fache Strom gegenüber 230 V. Der Spannungsfall steigt mit dem Strom, deshalb sind bei 12 V Querschnitte nötig, die bei 230 V für dieselbe Leistung absurd wären: Eine 100-W-Last zieht bei 12 V 8,3 A, bei 230 V nur 0,43 A.',
    },
    {
      question: 'Steigt der Spannungsfall, wenn das Kabel warm wird?',
      answer:
        'Ja. Kupfer hat einen Temperaturkoeffizienten von etwa 0,4 %/K; bei betriebswarmen 70 °C liegt der Widerstand rund 20 % über dem Wert bei 20 °C. Camp rechnet mit dem 20-°C-Wert — das ist die übliche Planungsgrundlage, weil die Last im Normalbetrieb unterhalb der Leitertemperaturgrenze bleibt. Wer sicher planen will, wählt die nächste Normgröße.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/rechner/spannungsabfall-12v/', label: 'Spannungsabfall-Rechner' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Kupfer-Kennwerte in der Auslieferung',
      detail: 'κ = 58 m/(Ω·mm²) bei 20 °C und der Temperaturkoeffizient 0,00393 1/K in `lib/materials.ts`.',
    },
    {
      label: 'DIN VDE 0100-520',
      detail: 'Auswahl und Errichtung elektrischer Betriebsmittel — Spannungsfall.',
    },
    {
      label: 'DIN VDE 0100-721',
      detail: 'Kleinspannungsanlagen in Caravans und Motorcaravans.',
    },
  ],
  assumptions: [
    'Gerechnet wird bei 20 °C LeiterTemperatur und mit dem Nennstrom als Dauerstrom.',
    'Die Grenzen 1 / 3 / 4 % sind Planungsannahmen des Modells, keine Normwerte.',
  ],
  limits: [
    'Übergangswiderstände von Klemmen, Steckern und Sicherungen sind nicht enthalten — sie kommen zum gerechneten Wert hinzu.',
    'Dynamische Lasten (Anlaufströme von Motoren und Kompressoren) sind nicht modelliert.',
  ],
};
