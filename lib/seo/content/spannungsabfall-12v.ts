/**
 * lib/seo/content/spannungsabfall-12v.ts — Rechner-Landingpage
 * `/rechner/spannungsabfall-12v/`.
 *
 * Abgrenzung zur Themenseite `/camper-elektrik/spannungsabfall/`: Dort stehen
 * Herleitung, Grenzwerte und die Frage „welche Grenze ist die richtige?", hier
 * steht der Umgang mit dem Rechner — Eingaben, Ablesen, Beispiele aus der
 * Praxis und die typischen Eingabefehler. Zwei Seiten mit demselben Text wären
 * eine Dublette; zwei Seiten mit zwei Aufgaben sind eine Reihe.
 *
 * Alle Zahlen kommen aus `voltageDropFor` (lib/cableSizing.ts).
 */

import { maxCurrentForPlanLimit, voltageDropFor } from '@/lib/cableSizing';
import { VDE_SIZES, VOLTAGE_DROP_PCT_CRITICAL, VOLTAGE_DROP_PCT_PLAN_LIMIT } from '@/lib/electrical';
import { COPPER_CONDUCTIVITY_MS_PER_MM2 } from '@/lib/materials';

import type { SeoPageContent } from '../types';

const fmt = (value: number, digits: number): string => value.toFixed(digits).replace('.', ',');

/**
 * Drei Leitungen, wie sie in der Praxis häufig gewählt werden — nicht, wie sie
 * optimal wären. Genau darum stehen sie hier: Die Tabelle zeigt, dass die
 * „gefühlt passende" Größe bei 12 V regelmäßig über der Grenze liegt.
 */
const BEISPIELE = [
  { label: 'LED-Leuchte', currentA: 1.5, lengthM: 6, chosenMm2: 1.5 },
  { label: 'Kompressor-Kühlschrank', currentA: 8, lengthM: 4, chosenMm2: 2.5 },
  { label: 'Wechselrichter 1 000 W', currentA: 98, lengthM: 1.5, chosenMm2: 25 },
] as const;

const VERDICT_TEXT = {
  ziel: 'Zielbereich',
  planungsgrenze: 'an der Planungsgrenze',
  verstoss: 'Verstoß',
  kritisch: 'kritisch',
} as const;

/** Beispieltabelle: gewählter Querschnitt, Ergebnis, Empfehlung des Rechners. */
const BEISPIEL_ROWS = BEISPIELE.map((entry) => {
  const result = voltageDropFor(entry.currentA, entry.lengthM, entry.chosenMm2);
  return [
    entry.label,
    `${fmt(entry.currentA, 1)} A / ${fmt(entry.lengthM, 1)} m`,
    `${fmt(entry.chosenMm2, 1)} mm²`,
    `${fmt(result.dropV, 2)} V · ${fmt(result.dropPercent, 2)} %`,
    VERDICT_TEXT[result.verdict],
    `${fmt(result.recommendedCrossSectionMm2, 1)} mm²`,
  ];
});

/** Ab welchem Strom ein Querschnitt die 3-%-Grenze auf 5 m überschreitet. */
const GRENZSTROM_ROWS = VDE_SIZES.filter((size) => size <= 16).map((size) => [
  `${fmt(size, 1)} mm²`,
  `${fmt(maxCurrentForPlanLimit(size, 5), 1)} A`,
]);

export const SPANNUNGSABFALL_12V_CONTENT: SeoPageContent = {
  path: '/rechner/spannungsabfall-12v/',
  slug: 'spannungsabfall-12v',
  topicId: 'spannungsabfall',
  kind: 'rechner',
  title: 'Spannungsabfall-Rechner für 12 V',
  absoluteTitle: true,
  description:
    'Spannungsabfall für 12-V-Leitungen rechnen: Strom, Länge und Querschnitt eingeben — mit Einordnung in 1 % / 3 % / 4 %, Empfehlung und Beispielen.',
  h1: 'Spannungsabfall-Rechner für 12 V',
  lead: 'Dieser Rechner bewertet eine Leitung, die es schon gibt oder geben soll: Strom und Länge eintragen, vorhandenen Querschnitt wählen — und ablesen, ob der Verbraucher genug Spannung bekommt. Die Formel dahinter steht auf der Themenseite, hier steht die Anwendung.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'rechner',
      heading: 'Leitung bewerten',
      body: [
        'Die Eingabe ist bewusst knapp: Betriebsstrom, einfache Länge und der Querschnitt, der verlegt ist oder verlegt werden soll. Das Ergebnis nennt den Verlust in Volt und Prozent, ordnet ihn ein und schlägt den Querschnitt vor, den die vollständige Bemessung wählen würde.',
      ],
      calculator: 'spannungsabfall',
    },
    {
      id: 'beispiele',
      heading: 'Drei typische Leitungen im Vergleich',
      body: [
        'Die Beispiele zeigen, warum der Spannungsfall bei 12 V fast immer die Leitung bestimmt und nicht die Strombelastbarkeit: Selbst eine 1,5-A-Leuchte verliert über 6 m deutlich Spannung, während der Wechselrichter mit 98 A auf 1,5 m nur mit einem sehr großen Querschnitt im Zielbereich bleibt.',
      ],
      table: {
        caption: 'Modellrechnung bei 12 V, Kupfer bei 20 °C — Empfehlung aus derselben Rechnung',
        head: ['Verbraucher', 'Strom / Länge', 'gewählt', 'ΔU', 'Einordnung', 'Empfehlung'],
        rows: BEISPIEL_ROWS,
        note: 'Die Empfehlung stammt aus der vollständigen Bemessung, die auch die Strombelastbarkeit prüft — beim Wechselrichter verlangt deshalb nicht der Spannungsfall (25 mm² genügt ihm) den größeren Querschnitt, sondern der Strom von 98 A.',
      },
    },
    {
      id: 'ablesen',
      heading: 'Ergebnis richtig lesen',
      definitions: [
        {
          term: '1 % — Zielbereich',
          description:
            'Der Verlust liegt unter 0,12 V. Diese Leitung hat Reserve für Übergangswiderstände an Klemmen und Sicherungen.',
        },
        {
          term: `${VOLTAGE_DROP_PCT_PLAN_LIMIT} % — Planungsgrenze`,
          description: `Der Verlust liegt bei höchstens 0,36 V. Das ist die Zielmarke, mit der Camp dimensioniert — für die meisten Verbraucher ausreichend.`,
        },
        {
          term: `${VOLTAGE_DROP_PCT_CRITICAL} % und darüber`,
          description:
            'Der Planer meldet einen Verstoß. Empfindliche Verbraucher — Kompressor-Kühlschränke, Funkgeräte, Wechselrichter — arbeiten dann nicht mehr zuverlässig.',
        },
      ],
      callout: {
        tone: 'info',
        text: `Der Rechner gibt den reinen Leitungswiderstand an: ΔU = (I · 2 · L) / (κ · A) mit κ = ${COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²). Widerstände von Sicherungen, Schaltern und Steckverbindern kommen hinzu.`,
      },
    },
    {
      id: 'eingabe',
      heading: 'Was in welches Feld gehört',
      list: {
        items: [
          'Strom: der Nennstrom des Verbrauchers im Dauerbetrieb — nicht der Anlaufstrom. Ein Kompressor zieht beim Anlauf ein Vielfaches; das ist Sache der Sicherungsauswahl, nicht des Spannungsfalls.',
          'Länge: die einfache Strecke von der Batterie bis zum Verbraucher. Hin- und Rückweg stecken im Faktor 2 der Formel.',
          'Querschnitt: aus der Normreihe wählen — 1,5 / 2,5 / 4 / 6 / 10 / 16 / 25 mm². Zwischengrößen gibt es nicht; wer mit 5,7 mm² rechnet, bestellt am Ende doch 6 mm².',
          'Systemspannung: 12 V als Standard. Bei 24 V halbiert sich der Strom für dieselbe Leistung — und mit ihm der Spannungsfall.',
        ],
      },
    },
    {
      id: 'grenzstrom',
      heading: 'Wie viel Strom trägt ein Querschnitt auf 5 m?',
      table: {
        caption: 'Größter Strom bis zur 3-%-Planungsgrenze, aus der Umkehrung der Formel',
        head: ['Querschnitt', 'Strom auf 5 m'],
        rows: GRENZSTROM_ROWS,
        note: 'Für andere Längen gilt der umgekehrte Zusammenhang: doppelte Länge, halber Grenzstrom. Wird 2 % statt 3 % angesetzt, sinkt der Wert auf zwei Drittel.',
      },
    },
    {
      id: 'naechster-schritt',
      heading: 'Nächster Schritt',
      body: [
        'Wer den Querschnitt kennt, wählt die Sicherung nach der Leitung — nicht nach dem Verbraucher. Der Camper-Elektroplaner rechnet dieselbe Bewertung für alle Leitungen einer Anlage und prüft dabei auch, ob Betriebsstrom, Nennstrom und Belastbarkeit zusammenpassen.',
      ],
      links: [
        {
          href: '/camper-elektrik/spannungsabfall/',
          label: 'Spannungsabfall bei 12 V: Formel und Grenzwerte',
        },
        { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
        { href: '/camper-elektrik/sicherungen/', label: 'Sicherung passend zur Leitung wählen' },
        { href: '/elektrik-planung/#planer', label: 'Camper-Elektroplaner öffnen' },
      ],
    },
  ],
  faq: [
    {
      question:
        'Welchen Querschnitt wähle ich, wenn der Rechner ein Ergebnis zwischen zwei Normgrößen nennt?',
      answer:
        'Immer die nächste Normgröße nach oben. Die Empfehlung des Rechners ist bereits auf die Normreihe aufgerundet; wer genau dazwischen liegt, nimmt den nächstgrößeren Querschnitt. Reserve ist billiger als ein zweites Kabel.',
    },
    {
      question: 'Warum weicht die Empfehlung manchmal vom reinen Spannungsfall ab?',
      answer:
        'Weil die Bemessung zwei Kriterien prüft: Spannungsfall und Strombelastbarkeit der Leitung. Bei hohen Strömen — etwa einer Wechselrichter-Zuleitung mit 98 A — kann die Belastbarkeit den größeren Querschnitt verlangen, obwohl der Spannungsfall allein mit weniger auskäme.',
    },
    {
      question: 'Kann ich den Verlust durch ein zweites Kabel verkleinern?',
      answer:
        'Zwei parallel gelegte Leitungen halbieren den Widerstand, aber Parallelschaltungen sind nichts für den Laien: Beide Adern müssen gleiche Länge, gleichen Querschnitt und sichere Klemmverbindungen haben, und die Sicherung schützt weiterhin die einzelne Ader. Der einfachere Weg ist immer der größere Querschnitt.',
    },
  ],
  related: [
    { href: '/camper-elektrik/spannungsabfall/', label: 'Spannungsabfall verstehen' },
    { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen dimensionieren' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
    { href: '/rechner/', label: 'Alle Rechner im Überblick' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Kupfer-Kennwerte in der Auslieferung',
      detail: `κ = ${COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²) bei 20 °C in \`lib/materials.ts\`.`,
    },
    {
      label: 'Spannungsfall-Modell',
      detail:
        'Die Grenzen 1 / 3 / 4 % und die Formel stehen in `lib/cableSizing.ts` und `lib/electrical.ts`.',
    },
    {
      label: 'DIN VDE 0100-520',
      detail: 'Auswahl und Errichtung elektrischer Betriebsmittel — Spannungsfall in Leitungsanlagen.',
    },
  ],
  assumptions: [
    'Gerechnet wird mit dem Nennstrom als Dauerstrom; Anlaufströme sind nicht enthalten.',
    'Die Leitung ist eine Kupferader im Normalbetrieb; Übergangswiderstände sind nicht enthalten.',
    '1 / 3 / 4 % sind Modellgrenzen für die Planung, keine Normwerte für 12-V-Bordnetze.',
  ],
  limits: [
    'Keine Temperaturkorrektur: Bei betriebswarmer Leitung liegt der Verlust rund 20 % höher.',
    'Keine Aussage über Kurzschlussstrom oder Selektivität — dafür ist die Sicherungsauswahl zuständig.',
  ],
};
