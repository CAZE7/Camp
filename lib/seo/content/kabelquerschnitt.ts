/**
 * lib/seo/content/kabelquerschnitt.ts — Cluster-Seite
 * `/camper-elektrik/kabelquerschnitt/`.
 *
 * Die Tabellen dieser Seite werden aus dem Modell GERECHNET (sizeCable,
 * voltageDropFor) statt abgeschrieben: Ändert sich eine Konstante in
 * `lib/electrical.ts`, ändert sich die Tabelle mit — eine Seite, die andere
 * Zahlen zeigt als der Rechner daneben, wäre schlimmer als keine Tabelle.
 */

import { MAX_STANDARD_CROSS_SECTION_MM2, sizeCable } from '@/lib/cableSizing';
import {
  FUSE_MAP,
  VDE_AMPACITY,
  VDE_SIZES,
  VOLTAGE_DROP_PCT_PLAN_LIMIT,
  designAmpacity,
} from '@/lib/electrical';
import { COPPER_CONDUCTIVITY_MS_PER_MM2 } from '@/lib/materials';

import type { SeoPageContent } from '../types';

/** Beispielhafte Ströme und ihre Bemessung über 5 m Leitung. */
const EXAMPLE_CURRENTS = [5, 10, 15, 20, 30] as const;

const EXAMPLE_ROWS = EXAMPLE_CURRENTS.map((current) => {
  const sizing = sizeCable(current, 5);
  return [
    `${current} A`,
    `${sizing.requiredCrossSectionMm2.toFixed(1).replace('.', ',')} mm²`,
    `${sizing.crossSectionMm2.toFixed(1).replace('.', ',')} mm²`,
    `${sizing.voltageDropPercent.toFixed(1).replace('.', ',')} %`,
    sizing.maxFuseA === null ? '—' : `${sizing.fuseA ?? '—'} A`,
  ];
});

const NORM_ROWS = VDE_SIZES.map((size) => [
  `${size.toFixed(1).replace('.', ',')} mm²`,
  `${VDE_AMPACITY[size] ?? '—'} A`,
  `${designAmpacity(size).toFixed(1).replace('.', ',')} A`,
  `${FUSE_MAP[size] ?? '—'} A`,
]);

export const KABELQUERSCHNITT_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/kabelquerschnitt/',
  slug: 'kabelquerschnitt',
  topicId: 'kabelquerschnitt',
  kind: 'cluster',
  title: 'Kabelquerschnitt im Camper: 12 V richtig berechnen',
  absoluteTitle: true,
  description:
    'Kabelquerschnitt für 12 V im Camper berechnen: Formel, Normreihe, Rechenbeispiele und die häufigsten Fehler — mit Rechner für Strom und Leitungslänge.',
  h1: '12V-Kabelquerschnitt berechnen',
  lead: 'Bei 12 V entscheidet nicht die Strombelastbarkeit über den Querschnitt, sondern der Spannungsfall. Diese Seite zeigt, wie die Formel angewendet wird, was die Normreihe hergibt und wo in der Praxis die Fehler entstehen.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.9,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'rechner',
      heading: 'Querschnitt für Strom und Länge berechnen',
      body: [
        'Zwei Eingaben genügen: der Betriebsstrom des Verbrauchers und die einfache Leitungslänge von der Batterie bis zum Verbraucher. Der Rechner dimensioniert mit ' +
          `${VOLTAGE_DROP_PCT_PLAN_LIMIT} % zulässigem Spannungsfall (bei 12 V also 0,36 V), prüft zusätzlich die Strombelastbarkeit und nennt die Sicherung, die am Batteriepol sitzt.`,
      ],
      calculator: 'kabelquerschnitt',
      callout: {
        tone: 'info',
        text: 'Das Ergebnis ist immer eine Normgröße aus der Reihe 1,5 bis 70 mm². Reicht selbst 70 mm² nicht, sagt der Rechner das — statt eine scheinbar gültige Größe auszugeben.',
      },
    },
    {
      id: 'formel',
      heading: 'Die Formel und was jeder Buchstabe bedeutet',
      formula: {
        expression: 'A = (2 · L · I) / (κ · ΔU)',
        caption:
          'A = Querschnitt in mm², L = einfache Leitungslänge in Metern, I = Betriebsstrom in A, κ = Leitfähigkeit in m/(Ω·mm²), ΔU = zulässiger Spannungsfall in V.',
      },
      definitions: [
        { term: '2 · L', description: 'Hin- und Rückleitung — der Strom fließt zweimal durch die Strecke.' },
        {
          term: 'κ = ' + `${COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²)`,
          description:
            'Leitfähigkeit von Kupfer bei 20 °C. Ältere Tabellenwerke rechnen mit 56 — das erhöht den Querschnitt um rund 3,6 %.',
        },
        {
          term: 'ΔU = 0,36 V',
          description: `${VOLTAGE_DROP_PCT_PLAN_LIMIT} % von 12 V — die Planungsgrenze des Modells. Für empfindliche Verbraucher sind 2 % (0,24 V) die bessere Zielmarke.`,
        },
      ],
      body: [
        'Ein Beispiel von Hand nachgerechnet: 10 A über 5 m. A = (2 · 5 · 10) / (58 · 0,36) = 100 / 20,88 = 4,79 mm². Die nächste Normgröße ist 6 mm² — mit ihr fällt der Spannungsfall auf 100 / (58 · 6) = 0,287 V, also 2,4 % der Nennspannung.',
      ],
    },
    {
      id: 'beispiele',
      heading: 'Rechenbeispiele für typische Camper-Verbraucher',
      table: {
        caption: 'Bemessung über 5 m einfache Leitungslänge bei 12 V (Modellwerte)',
        head: ['Strom', 'Rechnerisch nötig', 'Gewählt', 'Spannungsfall', 'Sicherung'],
        rows: EXAMPLE_ROWS,
        note: 'Die Sicherung folgt der Leitung, nicht dem Verbraucher: Sie darf den Querschnitt schützen, nicht ausreizen.',
      },
      body: [
        `Was die Tabelle zeigt: Ab etwa 10 A über 5 m bestimmt der Spannungsfall die Wahl, nicht die Wärme. Der größte Querschnitt der Reihe ist ${MAX_STANDARD_CROSS_SECTION_MM2} mm² — darüber hilft nur eine kürzere Strecke, eine aufgeteilte Leitung oder ein 24-V-Bordnetz.`,
      ],
    },
    {
      id: 'normreihe',
      heading: 'Die Normreihe mit Belastbarkeit und Sicherungsgrenze',
      table: {
        caption: 'Modell: DIN VDE 0298-4, Verlegeart B2, 30 °C, zwei belastete Adern, Derating 0,7',
        head: ['Querschnitt', 'Tabelle', 'Design (×0,7)', 'Größte Sicherung'],
        rows: NORM_ROWS,
        note: '„Größte Sicherung" schützt den Leiter. Ein Verbraucher mit 8 A bekommt deshalb nicht automatisch eine 8-A-Sicherung — er bekommt die kleinste Größe, die den Betriebsstrom führt und unter der Leitungsgrenze bleibt.',
      },
      body: [
        'Zwei Zahlen stehen in jeder Zeile, weil sie oft verwechselt werden: Der Tabellenwert gilt für die Verlegeart B2 bei 30 °C. Das Design mit dem Faktor 0,7 deckt Bündelung und höhere Umgebungstemperaturen pauschal ab. Wer beides gleichsetzt, sichert zu hoch ab.',
      ],
      links: [
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherungen richtig dimensionieren',
          description: 'Die Kette I_B ≤ I_n ≤ I_z und ihre Konsequenzen.',
        },
      ],
    },
    {
      id: 'spannungsfall',
      heading: 'Wann 2 % statt 3 % die richtige Zielmarke ist',
      body: [
        'Die 3-%-Grenze ist eine Planungsannahme, kein Normwert. Empfindliche Verbraucher — Kompressor-Kühlschränke, Funkgeräte, Laderegler, Spannungswandler — arbeiten mit 2 % deutlich zuverlässiger. Der Unterschied ist nicht klein: 10 A über 5 m ergeben mit 3 % einen Querschnitt von 4,79 mm² (gewählt 6 mm²), mit 2 % von 7,19 mm² (gewählt 10 mm²).',
      ],
      links: [
        {
          href: '/camper-elektrik/spannungsabfall/',
          label: 'Spannungsabfall bei 12 V nachrechnen',
          description: 'Tabelle je Querschnitt und Strom — und wann der Verbraucher abschaltet.',
        },
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler bei der Querschnittswahl',
      list: {
        items: [
          'Nur die halbe Strecke rechnen: Wer die einfache Länge eingibt und den Faktor 2 vergisst, halbiert den Querschnitt.',
          'Nach Gerätesicherung dimensionieren: „Der Kühlschrank ist mit 15 A abgesichert, also reicht 2,5 mm²" dreht die Kette um — die Leitung bestimmt die Sicherung.',
          'Länge schätzen statt messen: Der Weg entlang der Karosserie ist fast immer länger als die Luftlinie — und Kabel werden entlang von Trassen geführt, nicht diagonal.',
          'Querschnitt am Verbraucher reduzieren: Jede Übergangsstelle ist ein Widerstand. Ein 0,75-mm²-Anschlusskabel am Ende einer 10-mm²-Leitung bringt den Spannungsfall zurück.',
          'Verlegeart ignorieren: Im Bündel oder im warmen Motorraum sinkt die Belastbarkeit — der Tabellenwert ohne Derating gilt dort nicht.',
        ],
      },
    },
    {
      id: 'naechster-schritt',
      heading: 'Vom Querschnitt in den Plan',
      body: [
        'Einzelne Leitungen lassen sich von Hand rechnen. Ab dem dritten Verbraucher lohnt der Plan: Der Camper-Elektroplaner rechnet für jede Kabelverbindung Strom, Querschnitt und Spannungsfall, setzt passende Sicherungen und erzeugt daraus die Stückliste.',
      ],
      callout: {
        tone: 'info',
        text: '[Camper-Elektroplaner öffnen](/elektrik-planung/#planer) — die berechneten Querschnitte lassen sich dort direkt im Schaltplan verwenden.',
      },
    },
  ],
  faq: [
    {
      question: 'Welcher Kabelquerschnitt ist im Camper für 12 V üblich?',
      answer:
        'Für Beleuchtung und kleine Verbraucher bis 5 A reichen 1,5 bis 2,5 mm². Kühlbox und Wasserpumpe liegen bei 2,5 bis 4 mm², Standheizungen und Wechselrichter-Zuleitungen bei 6 bis 16 mm² — bei 12 V bestimmt der Spannungsfall über die Leitungslänge die Wahl, nicht die Strombelastbarkeit.',
    },
    {
      question: 'Rechnet man mit 3 % oder 2 % Spannungsfall?',
      answer:
        'Camp dimensioniert mit 3 % der Nennspannung, bei 12 V also 0,36 V. Für empfindliche Verbraucher wie Kompressor-Kühlschränke, Funkgeräte oder Laderegler ist 2 % (0,24 V) die bessere Zielmarke: Bei 10 A über 5 m ergibt die 3-%-Grenze 6 mm², die 2-%-Grenze 10 mm². Beide Werte sind Planungsannahmen — DIN VDE 0298-4 nennt Strombelastbarkeiten, keine Spannungsfall-Grenzwerte.',
    },
    {
      question: 'Darf ich zwei Kabel parallel verlegen, statt einen größeren Querschnitt zu nehmen?',
      answer:
        'Parallel verlegte Leitungen sind elektrisch möglich, aber im Fahrzeug nur mit gleicher Länge, gleichem Querschnitt und getrennter Absicherung sinnvoll — sonst trägt die kürzere Leitung den größeren Anteil, und beide müssen zusammen gegen den Gesamtstrom geschützt werden. Für einen sauberen Plan ist eine Leitung mit größerem Querschnitt fast immer die einfachere Lösung.',
    },
    {
      question: 'Warum rundet der Rechner immer auf?',
      answer:
        'Weil der Querschnitt aus einer Normreihe stammen muss (1,5 · 2,5 · 4 · 6 · 10 · 16 · 25 · 35 · 50 · 70 mm²) — Zwischengrößen sind am Markt nicht erhältlich und würden die Leitung nicht schützen. Aufrunden ist die konservative Richtung: mehr Querschnitt bedeutet weniger Spannungsfall und mehr Sicherungsreserve.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/spannungsabfall/', label: 'Spannungsabfall bei 12 V' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
    { href: '/rechner/spannungsabfall-12v/', label: 'Spannungsabfall-Rechner' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'DIN VDE 0298-4',
      detail:
        'Strombelastbarkeit der Normreihe (Verlegeart B2, 30 °C, zwei belastete Adern). Die Werte für 50 und 70 mm² weichen von einer verbreiteten Referenz leicht ab und sind im Modell unverändert übernommen.',
    },
    {
      label: 'DIN VDE 0100-520',
      detail: 'Auswahl und Errichtung elektrischer Betriebsmittel — Spannungsfall ohne Temperaturzuschlag.',
    },
    {
      label: 'Kupfer-Kennwerte in der Auslieferung',
      detail: 'κ = 58 m/(Ω·mm²) bei 20 °C, dokumentiert in `lib/materials.ts`.',
    },
  ],
  assumptions: [
    'Der Spannungsfall wird bei 20 °C LeiterTemperatur gerechnet. Betriebswarm liegt der Widerstand höher; das ist die übliche Planungsgrundlage, kein Messwert.',
    'Das Derating 0,7 auf die Tabellenwerte ist eine dokumentierte Modellannahme für Bündelung und Umgebungstemperatur.',
    'Normaussagen geben den Geltungsbereich der genannten Regelwerke wieder, keine Rechtsprüfung des Einzelfalls.',
  ],
  limits: [
    'Leitungen im Fahrzeug werden überwiegend nach ISO 6722 (FLRY) ausgeführt. Dieser Nachweis wird nicht getrennt geführt — die verwendete Spalte liegt damit auf der konservativen Seite.',
    'Der Rechner kennt nur Einzelleitungen: Parallele Leitungen, unterschiedliche Längen und Übergangswiderstände an Klemmstellen sind nicht modelliert.',
    'Für 230-V-Leitungen gilt eine eigene Betrachtung (Leitungsschutzschalter, FI-Schutz, Abnahme).',
  ],
};
