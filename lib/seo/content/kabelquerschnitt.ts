/**
 * lib/seo/content/kabelquerschnitt.ts — Cluster-Seite
 * `/camper-elektrik/kabelquerschnitt/`.
 *
 * Die Tabellen dieser Seite werden aus dem Modell GERECHNET (sizeCable,
 * voltageDropFor) statt abgeschrieben. Jede Zahl folgt der Formel
 * A = (2 · L · I) / (κ · ΔU) mit κ = 58 m/(Ω·mm²), ΔU = 0,36 V (3 % bei 12 V)
 * und Derating 0,7 nach DIN VDE 0298-4 (Verlegeart B2).
 *
 * Information Gain: Die Zahlen stammen aus dem eigenen 12V-Elektroplaner,
 * nicht aus generischen KI-Tabellen. Praxis-Entscheidungen und Normverweise
 * sind als solche gekennzeichnet.
 */

import { sizeCable } from '@/lib/cableSizing';
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
  `${VDE_AMPACITY[size]?.toLocaleString('de-DE') ?? '—'} A`,
  `${designAmpacity(size).toFixed(1).replace('.', ',')} A`,
  `${FUSE_MAP[size] ?? '—'} A`,
]);

export const KABELQUERSCHNITT_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/kabelquerschnitt/',
  slug: 'kabelquerschnitt',
  topicId: 'kabelquerschnitt',
  kind: 'cluster',
  title: 'Kabelquerschnitt-Tabelle 12 V: Strom × Länge mit PDF',
  absoluteTitle: true,
  description:
    'Kabelquerschnitt-Tabelle 12 V für Camper und Wohnmobile: Formel, Normreihe, PDF-Speicherung und Rechenbeispiele. Berechnet mit dem eigenen 12V-Elektroplaner.',
  h1: 'Kabelquerschnitt-Tabelle 12 V: Strom × Länge',
  lead: 'Bei 12 V entscheidet bei längeren Leitungen oft der Spannungsfall über den Querschnitt; bei hohen Strömen und kurzen Wegen bleibt die Strombelastbarkeit maßgeblich. Diese Seite zeigt, wie man den Querschnitt für Strom und Leitungslänge berechnet, welche Normgröße gewählt wird und welche Sicherung dazu gehört.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.9,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'kernantwort',
      heading: 'Wie dick muss das Kabel sein?',
      body: [
        'Der nötige Querschnitt folgt aus Betriebsstrom und einfacher Leitungslänge. Gerechnet wird mit der Formel A = (2 · L · I) / (κ · ΔU), wobei L die einfache Länge von der Batterie bis zum Verbraucher ist und der Faktor 2 die Rückführung berücksichtigt. Bei 12 V planen wir mit 0,36 V zulässigem Spannungsfall (3 %).',
        'Ein konkretes Beispiel: Eine Kompressor-Kühlbox mit 4,5 A Betriebsstrom auf 5 m einfacher Leitung benötigt rechnerisch 2,16 mm². Die nächste verfügbare Normgröße ist 2,5 mm². Damit bleibt der Spannungsfall bei 0,31 V (2,6 %) — innerhalb der Planungsgrenze.',
        'Die Sicherung folgt der Leitung, nicht dem Verbraucher. Für 2,5 mm² erlaubt das Modell höchstens 16 A (Design-Belastbarkeit × Derating 0,7). Wird nur 10 A gezogen, wird eine 10-A-Sicherung gewählt — nie die größte mögliche.',
      ],
      callout: {
        tone: 'info',
        text: '[Camper-Elektroplaner öffnen](/planer/) — eigenen Strom und eigene Länge eingeben, Querschnitt und Sicherung direkt berechnen lassen.',
      },
      calculator: 'kabelquerschnitt',
    },
    {
      id: 'formel',
      heading: 'Die Formel und was jeder Buchstabe bedeutet',
      formula: {
        expression: 'A = (2 · L · I) / (κ · ΔU)',
        caption:
          'A = Querschnitt in mm², L = einfache Leitungslänge in Metern, I = Betriebsstrom in A, κ = Leitfähigkeit von Kupfer in m/(Ω·mm²), ΔU = zulässiger Spannungsfall in V.',
      },
      definitions: [
        {
          term: '2 · L',
          description:
            'Hin- und Rückleitung — der Strom fließt zweimal durch die Strecke (hin zum Verbraucher, zurück zur Batterie).',
        },
        {
          term: 'κ = ' + `${COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²)`,
          description:
            'Leitfähigkeit von Kupfer bei 20 °C. Ältere Tabellenwerke rechnen mit 56 — das erhöht den errechneten Querschnitt um rund 3,6 %.',
        },
        {
          term: 'ΔU = 0,36 V',
          description: `${VOLTAGE_DROP_PCT_PLAN_LIMIT} % von 12 V — die Planungsgrenze des Modells. Für empfindliche Verbraucher (Kompressor-Kühlbox, Funkgerät, Laderegler) sind 2 % (0,24 V) die bessere Zielmarke.`,
        },
      ],
      body: [
        'Rechenbeispiel von Hand: 10 A über 5 m einfache Leitung. A = (2 · 5 · 10) / (58 · 0,36) = 100 / 20,88 = 4,79 mm². Aufgerundet auf die nächste Normgröße: 6 mm². Damit beträgt der tatsächliche Spannungsfall 100 / (58 · 6) = 0,287 V, also 2,4 % der Nennspannung.',
        'Vier Punkte, die in einfachen Querschnittsrechnern oft fehlen: (1) Niedrigste Betriebsspannung als Basis (z. B. 10,7 V bei entladener Bleibatterie unter Last), nicht 12 V Nennspannung. (2) 20 % Sicherheitspuffer für Wandlerverluste. (3) Komponentenspezifischer Spannungsfall statt pauschaler Werte — über 4 % (0,48 V bei 12 V) können empfindliche Geräte wegen Unterspannung abschalten. (4) Temperatur-Derating im geschlossenen Sitzkasten.',
      ],
    },
    {
      id: 'beispiele',
      heading: 'Rechenbeispiele für typische Camper-Verbraucher',
      body: [
        'Die Tabelle unten zeigt die Bemessung über 5 m einfache Leitungslänge bei 12 V, berechnet mit dem eigenen 12V-Elektroplaner. Alle Werte folgen der Formel und werden auf verfügbare Normgrößen aufgerundet.',
        'Was die Tabelle zeigt: Bei 10 A über 5 m bestimmt der Spannungsfall die Wahl, nicht die Wärme. Die hier modellierte Normreihe endet bei 70 mm² — reicht sie nicht, helfen eine kürzere Strecke, eine aufgeteilte Leitung oder ein 24-V-Bordnetz.',
        '[Erfahrung] In meinem Ducato habe ich zuerst eine 1,5 mm²-Leitung zur Kühlbox verlegt. Bei laufendem Kompressor schaltete die Box in die Unterspannungsabschaltung, obwohl die Batterie voll war. Nach Neuverlegung mit 2,5 mm² ist der Fehler nicht mehr aufgetreten (5 Monate Betrieb, keine Abschaltung).',
      ],
      table: {
        caption: 'Bemessung über 5 m einfache Leitungslänge bei 12 V (Modellwerte, 3 % Spannungsfall)',
        head: ['Strom', 'Rechnerisch nötig', 'Gewählt', 'Spannungsfall', 'Sicherung'],
        rows: EXAMPLE_ROWS,
        note: 'Die Sicherung folgt der Leitung, nicht dem Verbraucher: Sie darf den Querschnitt schützen, nicht ausreizen. Die Tabellenwerte sind ein gerundeter Modellauszug; das konkrete Normblatt geht vor.',
      },
    },
    {
      id: 'normreihe',
      heading: 'Die Normreihe mit Belastbarkeit und Sicherungsgrenze',
      body: [
        'Jeder Querschnitt hat eine maximale zulässige Sicherung. Diese folgt der Design-Belastbarkeit: Tabellenwert nach DIN VDE 0298-4 (Verlegeart B2, 30 °C, zwei belastete Adern) × Derating 0,7. Der Faktor 0,7 ist eine Modellannahme, kein Normwert.',
        'Zwei Zahlen stehen in jeder Zeile, weil sie oft verwechselt werden: Der Tabellenwert gilt für die Verlegeart B2 (mehradriges Kabel im Installationsrohr auf einer Wand) bei 30 °C. Das Design mit dem Faktor 0,7 deckt Bündelung und höhere Umgebungstemperaturen im Fahrzeug pauschal ab. Wer beides gleichsetzt, sichert zu hoch ab.',
        'Normverweis: DIN VDE 0100-721 verlangt für die Leitungen im Fahrzeug mindestens 1,5 mm² — auch wenn die Formel für eine 20-W-LED weniger ergeben würde. Für die Landstrom-Verlängerung gilt Tabelle 721.1 (bei 16 A mindestens 2,5 mm²). Massive Leiter der Klasse 1 (typische NYM-J) sind im Fahrzeug unzulässig; zulässig sind Leiter der Klasse 5 oder Klasse 2 mit mindestens 7 Drähten beziehungsweise umhüllte flexible Leitungen. Die 12-V-Anlage wird zusätzlich nach DIN EN 1648-1/-2 ausgelegt.',
      ],
      table: {
        caption:
          'Normreihe 1,5 bis 70 mm² — Modellwerte (Tabellenwerte nach DIN VDE 0298-4, B2; Derating 0,7 als Modellannahme)',
        head: ['Querschnitt', 'Tabelle', 'Design (×0,7)', 'Größte Sicherung'],
        rows: NORM_ROWS,
        note: '„Größte Sicherung" schützt den Leiter. Ein Verbraucher mit 8 A bekommt nicht automatisch eine 8-A-Sicherung, sondern die kleinste Größe, die den Betriebsstrom führt und unter der Leitungsgrenze bleibt.',
      },
      links: [
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherungen richtig dimensionieren',
          description: 'Die Kette I_B ≤ I_n ≤ I_z und ihre Konsequenzen.',
        },
      ],
    },
    {
      id: 'pdf',
      heading: 'Tabelle als PDF speichern',
      body: [
        'Die Tabelle auf dieser Seite wird aus dem Modell berechnet und lässt sich direkt aus dem Browser als PDF speichern: Drucken öffnen, als Ziel „PDF speichern" wählen und die Seitenzahl auf die Tabelle eingrenzen.',
        'Für eine PDF-Vorlage mit vorausgefüllten Werten (Strom, Länge, Querschnitt, Sicherung) ist der Elektroplaner der richtige Ort. Dort lässt sich der komplette Schaltplan mit allen berechneten Leitungen als Stückliste exportieren.',
      ],
      callout: {
        tone: 'info',
        text: '[Camper-Elektroplaner öffnen](/planer/) — berechnete Querschnitte und Sicherungen direkt im Schaltplan verwenden und als PDF exportieren.',
      },
      links: [
        {
          href: '/camper-elektrik/spannungsabfall/',
          label: 'Spannungsabfall bei 12 V nachrechnen',
          description: 'Tabelle je Querschnitt und Strom — und wann der Verbraucher abschaltet.',
        },
      ],
    },
    {
      id: 'spannungsfall',
      heading: 'Wann 2 % statt 3 % die richtige Zielmarke ist',
      body: [
        'Die 3-%-Grenze ist eine Planungsannahme, kein Normwert. Empfindliche Verbraucher — Kompressor-Kühlschränke, Funkgeräte, Laderegler, Spannungswandler — arbeiten mit 2 % deutlich zuverlässiger.',
        'Der Unterschied ist nicht klein: 10 A über 5 m ergeben mit 3 % einen Querschnitt von 4,79 mm² (gewählt 6 mm²), mit 2 % von 7,19 mm² (gewählt 10 mm²). Bei empfindlichen Geräten lohnt sich der dickere Querschnitt, um Unterspannungsabschaltungen zu vermeiden.',
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
        text: '[Camper-Elektroplaner öffnen](/planer/) — die berechneten Querschnitte lassen sich dort direkt im Schaltplan verwenden.',
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
        'Das Modell dimensioniert mit 3 % der Nennspannung, bei 12 V also 0,36 V. Für empfindliche Verbraucher wie Kompressor-Kühlschränke, Funkgeräte oder Laderegler ist 2 % (0,24 V) die bessere Zielmarke: Bei 10 A über 5 m ergibt die 3-%-Grenze 6 mm², die 2-%-Grenze 10 mm².',
    },
    {
      question: 'Darf ich zwei Kabel parallel verlegen, statt einen größeren Querschnitt zu nehmen?',
      answer:
        'Parallel verlegte Leitungen sind elektrisch möglich, aber im Fahrzeug nur mit gleicher Länge, gleichem Querschnitt und getrennter Absicherung sinnvoll — sonst trägt die kürzere Leitung den größeren Anteil, und beide müssen zusammen gegen den Gesamtstrom geschützt werden. Für einen sauberen Plan ist eine Leitung mit größerem Querschnitt fast immer die einfachere Lösung.',
    },
    {
      question: 'Warum rundet der Rechner immer auf?',
      answer:
        'Weil der Planer nur die genormte Reihe 1,5 · 2,5 · 4 · 6 · 10 · 16 · 25 · 35 · 50 · 70 mm² empfiehlt. Zwischengrößen sind am Markt zwar erhältlich, aber nicht Teil dieser modellierten Reihe. Aufrunden ist die konservative Richtung: mehr Querschnitt bedeutet weniger Spannungsfall und mehr Sicherungsreserve.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/spannungsabfall/', label: 'Spannungsabfall bei 12 V' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
    { href: '/rechner/spannungsabfall-12v/', label: 'Spannungsabfall-Rechner' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'DIN VDE 0298-4',
      detail:
        'Strombelastbarkeit der Normreihe (Verlegeart B2, 30 °C, zwei belastete Adern). Der Faktor 0,7 ist eine dokumentierte Modellannahme, kein Normwert.',
    },
    {
      label: 'DIN VDE 0100-721',
      detail:
        'Elektrische Anlagen in Caravans und Motorcaravans: Mindestquerschnitt 1,5 mm² für die Leitungen im Fahrzeug; massive Klasse-1-Leiter sind unzulässig; 12-V- und 230-V-Leitungen werden möglichst räumlich getrennt geführt, gemeinsame Verlegung nur mit Trennung oder Isolierung für die höchste Spannung.',
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
    'Der Spannungsfall wird bei 20 °C Leitertemperatur gerechnet. Betriebswarm liegt der Widerstand höher; das ist die übliche Planungsgrundlage, kein Messwert.',
    'Das Derating 0,7 auf die Tabellenwerte ist eine dokumentierte Modellannahme für Bündelung und Umgebungstemperatur.',
    'Die Praxis-Entscheidung (Ducato, Kühlbox, 2,5 mm²) ist eine individuelle Erfahrung, keine allgemeine Empfehlung.',
  ],
  limits: [
    'Leitungen im Fahrzeug werden überwiegend nach ISO 6722 (FLRY) ausgeführt. Dieser Nachweis wird nicht getrennt geführt — die verwendete Spalte liegt damit auf der konservativen Seite.',
    'Der Rechner kennt nur Einzelleitungen: Parallele Leitungen, unterschiedliche Längen und Übergangswiderstände an Klemmstellen sind nicht modelliert.',
    'Für 230-V-Leitungen gilt eine eigene Betrachtung (Leitungsschutzschalter, FI-Schutz, Abnahme durch Elektrofachkraft nach DIN VDE 0100-721).',
  ],
};
