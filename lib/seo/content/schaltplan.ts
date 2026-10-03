/**
 * lib/seo/content/schaltplan.ts — Cluster-Seite `/camper-elektrik/schaltplan/`.
 *
 * Die Seite beschreibt den Weg vom leeren Blatt zum Plan und verweist auf die
 * Funktionen, die es im Planer wirklich gibt (Auto-Verdrahtung, Prüfungen,
 * Stückliste) — keine Ankündigungen, keine Roadmap.
 */

import { VDE_SIZES } from '@/lib/electrical';

import type { SeoPageContent } from '../types';

export const SCHALTPLAN_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/schaltplan/',
  slug: 'schaltplan',
  topicId: 'schaltplan',
  kind: 'cluster',
  title: 'Schaltplan für den Camper zeichnen: Aufbau und Prüfung',
  absoluteTitle: true,
  description:
    'Camper-Schaltplan erstellen: von der Batterie über Verteiler, Sicherungen und Verbraucher bis zur Stückliste — mit Prüfliste für den Plan.',
  h1: 'Schaltplan für den Camper zeichnen',
  lead: 'Ein Schaltplan ist kein Dokument für die Schublade: Er ist die Arbeitsanweisung für den Einbau und die Prüfliste für den, der ihn liest. Diese Seite zeigt den Aufbau — und was ein Plan enthalten muss, damit er die Prüfung übersteht.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'aufbau',
      heading: 'Der Aufbau: vom Quellpunkt zu den Verbrauchern',
      body: [
        'Ein Camper-Schaltplan wird von der Quelle aus gelesen — nicht von den Verbrauchern. Die Reihenfolge auf dem Blatt (und im Fahrzeug) ist immer dieselbe:',
      ],
      list: {
        ordered: true,
        items: [
          'Batterie (Aufbau) mit Hauptsicherung am Pol, direkt danach der Trennschalter.',
          'Hauptverteilung: Plus- und Minusverteilung getrennt führen, Masse nicht über die Karosserie improvisieren.',
          'Ladepfade: Lichtmaschine über Booster, Solar über Laderegler, Landstrom über Ladegerät — jeweils mit eigener Absicherung.',
          'Verbraucherkreise: je Leitung eine Sicherung, je Verbraucher ein Schalter.',
          '230-V-Zweig getrennt darstellen, mit FI, Leitungsschutzschaltern und Schutzleiter.',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Die Trennung von Plus- und Minusstrang ist nicht nur Ordnung: Sie macht sichtbar, welche Leitung abgesichert ist (Plus) und welche nicht (Masse).',
      },
    },
    {
      id: 'leitungen',
      heading: 'Jede Leitung braucht drei Angaben',
      body: [
        `Ein Plan ohne Querschnitt ist eine Skizze. Jede Leitung trägt den Querschnitt aus der Normreihe (${VDE_SIZES.map((size) => size.toFixed(1).replace('.', ',')).join(' · ')} mm²), die Länge in Metern und die zugehörige Sicherung. Erst diese drei Angaben machen den Plan nachrechenbar.`,
        'Die Länge ist dabei keine Schätzung, sondern das Ergebnis der Verlegeplanung entlang der Trassen: Der Weg von der Batterie zum Heck des Fahrzeugs ist fast immer deutlich länger als die Luftlinie.',
      ],
      links: [
        { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
        { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen dimensionieren' },
      ],
    },
    {
      id: 'pruefung',
      heading: 'Was der Planer automatisch prüft',
      body: [
        'Der Camper-Elektroplaner setzt den Plan nicht nur zusammen, er prüft ihn auch. Die Prüfungen sind rechnerisch nachvollziehbar und werden im Plan sichtbar gemeldet:',
      ],
      list: {
        items: [
          'Spannungsfall je Kabel — mit der Planungsgrenze von 3 % (0,36 V bei 12 V) und Meldung ab 4 %.',
          'Strombelastbarkeit des gewählten Querschnitts mit dem Derating des Modells.',
          'Absicherung: Die Sicherung muss über dem Betriebsstrom und unter der Leitungsgrenze liegen (I_B ≤ I_n ≤ I_z).',
          'Abstand des Schutzorgans zur Quelle: geprüft werden 0,2 m ab dem Pluspol.',
          'Vollständigkeit der Energiebilanz: Verbraucher ohne Leistung oder Nutzungsdauer werden als unvollständig gemeldet, statt still als null gerechnet.',
          'Abschaltvermögen der Sicherung gegen den geschätzten Kurzschlussstrom der Batteriebank.',
        ],
      },
      subsections: [
        {
          heading: 'Was nicht geprüft wird',
          body: [
            'Mechanische Verlegung, Scheuerstellen, Brandverhalten der Leitungen im Fahrzeug, die 230-V-Abnahme und der Zustand der Batterien sind keine Rechengrößen. Der Planer sagt das selbst — eine Prüfung, die alles abhakt, wäre eine Lüge.',
          ],
        },
      ],
    },
    {
      id: 'stueckliste',
      heading: 'Von der Prüfung zur Stückliste',
      body: [
        'Weil Querschnitt, Länge und Sicherung am Plan hängen, fällt die Stückliste direkt aus dem Plan: Kabel nach Querschnitt und Länge, Sicherungen nach Nennstrom und Bauform, dazu Bauteile und Kleinteile. Das erspart die zweite Fehlerquelle nach der Planung — die Bestellung nach Gedächtnis.',
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Plan ohne Längenangaben: Querschnitte lassen sich nicht nachprüfen.',
          'Sicherungen im Plan doppelt führen (einmal am Pol, einmal am Verbraucher) und dabei eine ungeschützte Strecke übersehen.',
          'Zwei Farben für denselben Domänenbezug — 12 V und 230 V im gleichen Strang ohne Trennung.',
          'Erdungspunkte mehrfach verwenden, ohne die massekritischen Ströme zu denken.',
          'Den Plan nach dem Einbau nicht mehr ändern: Jede Änderung im Fahrzeug gehört in den Plan.',
        ],
      },
    },
    {
      id: 'naechster-schritt',
      heading: 'Im Planer weiterarbeiten',
      body: [
        'Der Planer läuft im Browser, ohne Anmeldung, und speichert lokal — der Plan kann unterbrochen und später fortgesetzt werden. Bauteile setzen, verdrahten lassen, prüfen; die Stückliste wird nebenbei erzeugt.',
      ],
      callout: {
        tone: 'info',
        text: '[Camper-Elektroplaner öffnen](/elektrik-planung/#planer) — vom ersten Bauteil bis zur Stückliste.',
      },
    },
  ],
  faq: [
    {
      question: 'Was gehört in einen Camper-Schaltplan?',
      answer:
        'Alle Quellen (Batterie, Solar, Landstrom, Lichtmaschine), alle Schutzorgane mit Nennstrom und Bauform, alle Leitungen mit Querschnitt und Länge sowie die Verbraucher. Plus- und Minusstrang werden getrennt geführt, der 230-V-Zweig wird als eigener Abschnitt dargestellt.',
    },
    {
      question: 'Kann ich den Schaltplan im Browser erstellen?',
      answer:
        'Ja — der Camper-Elektroplaner läuft im Browser ohne Anmeldung. Bauteile lassen sich setzen und automatisch verdrahten; Querschnitt, Sicherung und Spannungsfall werden mitgerechnet. Der Plan bleibt lokal im Browser gespeichert und überlebt einen Neustart.',
    },
    {
      question: 'Wie lang dürfen Kabel im Camper sein?',
      answer:
        'Es gibt keine pauschale Höchstlänge — die Länge ergibt sich aus der Verlegung, und der Querschnitt muss zu ihr passen. Die entscheidende Zahl ist der Spannungsfall über die tatsächliche Länge: Bei 10 A verliert 2,5 mm² über 5 m bereits 5,7 % der Spannung, während 10 mm² über dieselbe Strecke bei 1,4 % bleibt.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/camper-elektrik/230v/', label: '230-V-Anlage im Camper' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
    { href: '/guides/ausbau-fahrplan/', label: 'Reihenfolge der Gewerke' },
  ],
  sources: [
    {
      label: 'Prüfungen in der Auslieferung',
      detail:
        'Spannungsfall-Grenzen und Absicherung: `lib/electrical.ts` · Schutzorgan am Quellpunkt: `FUSE_MAX_UNPROTECTED_LENGTH_M` (ISO 10133:2000 § 8.1) · Energiebilanz: `lib/verify/powerPath.ts`.',
    },
    {
      label: 'DIN VDE 0100-430',
      detail: 'Koordination von Betriebsstrom, Sicherung und Leitungsbelastbarkeit (I_B ≤ I_n ≤ I_z).',
    },
  ],
  assumptions: [
    'Der Plan ist ein Single-Line-Schema. Verbindungsdetails (Klemmen, Stecker) stehen nicht im Schema, sondern in der Stückliste.',
    'Kabelwege werden im Planer über die Verlege-Geometrie geführt; die Längen sind Planungslängen, keine Messungen im Fahrzeug.',
  ],
  limits: [
    'Der Plan ersetzt keine Abnahme: 230-V-Anlagen brauchen eine Elektrofachkraft.',
    'Mechanische Verlegung, Scheuerschutz und Brandverhalten sind keine Bestandteile der Prüfung.',
  ],
};
