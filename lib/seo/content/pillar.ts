/**
 * lib/seo/content/pillar.ts — die Pillar-Seite `/camper-elektrik/`.
 *
 * Sie ist das Einstiegstor in das Thema und beantwortet die Frage „in welcher
 * Reihenfolge plane ich das eigentlich?" — mit dem Weg zu den vertiefenden
 * Seiten. Zahlen in den Tabellen stammen aus dem Modell
 * (`lib/electrical.ts`, `lib/vde-standards.ts`), nicht aus einer zweiten
 * Quelle; Beispielwerte für Verbraucher sind als Beispiel gekennzeichnet.
 */

import {
  FUSE_MAP,
  FUSE_MAX_UNPROTECTED_LENGTH_M,
  VDE_AMPACITY,
  VDE_SIZES,
  VOLTAGE_DROP_PCT_PLAN_LIMIT,
  designAmpacity,
} from '@/lib/electrical';
import { COPPER_CONDUCTIVITY_MS_PER_MM2 } from '@/lib/materials';
import { VDE_BATTERY_DOD } from '@/lib/vde-standards';

import type { SeoPageContent } from '../types';

const DOD_ROWS = Object.entries(VDE_BATTERY_DOD).map(([chemistry, dod]) => [
  chemistry === 'Blei' ? 'Nassblei' : chemistry,
  `${Math.round(dod * 100)} %`,
  `aus 100 Ah nutzbar: ${Math.round(dod * 100)} Ah`,
]);

const CABLE_ROWS = VDE_SIZES.map((size) => [
  `${size.toFixed(1).replace('.', ',')} mm²`,
  `${VDE_AMPACITY[size] ?? '—'} A`,
  `${designAmpacity(size).toFixed(1).replace('.', ',')} A`,
  `${FUSE_MAP[size] ?? '—'} A`,
]);

/**
 * Regelwerke, auf die sich das Modell bezieht.
 *
 * Übernommen von der umgezogenen Seite `/elektrik-planung/`: Die Liste
 * stand dort als Abschnitt „Normen, auf die sich das Modell bezieht" und ist
 * mit auf die Pillar-Seite gewandert.
 */
const NORMEN: readonly { norm: string; bereich: string }[] = [
  {
    norm: 'DIN VDE 0298-4',
    bereich: 'Strombelastbarkeit von Leitungen (Verlegeart B2, 30 °C, 2 belastete Adern)',
  },
  {
    norm: 'DIN VDE 0100-430',
    bereich: 'Schutz bei Überstrom: Koordination von Betriebsstrom, Sicherung und Leitungsbelastbarkeit',
  },
  {
    norm: 'DIN VDE 0100-520',
    bereich: 'Auswahl und Errichtung elektrischer Betriebsmittel, Spannungsfall',
  },
  {
    norm: 'DIN VDE 0100-721',
    bereich: 'Kleinspannungsanlagen in Caravans und Motorcaravans — 12 V und 230 V im Fahrzeug',
  },
  {
    norm: 'ISO 10133 / ABYC E-11',
    bereich: 'Schutzorgan am Quellpunkt bei Kleinspannungs-Gleichstromanlagen',
  },
];

/** Beispielverbraucher — ausdrücklich Beispielwerte, keine Messwerte. */
const CONSUMER_ROWS: readonly (readonly string[])[] = [
  ['Kompressor-Kühlbox', '45 W', '10 h', '450 Wh'],
  ['Standheizung (Diesel, Gebläse)', '35 W', '8 h', '280 Wh'],
  ['Wasserpumpe', '60 W', '0,4 h', '24 Wh'],
  ['LED-Beleuchtung', '12 W', '5 h', '60 Wh'],
  ['Laptop über 12-V-Netzteil', '65 W', '4 h', '260 Wh'],
  ['Summe (Beispiel)', '—', '—', '1 074 Wh'],
];

export const CAMPER_ELEKTRIK_PILLAR: SeoPageContent = {
  path: '/camper-elektrik/',
  slug: 'camper-elektrik',
  topicId: 'camper-elektrik',
  kind: 'pillar',
  title: 'Camper-Elektrik planen: 12 V, Batterie, Solar und Schaltplan',
  absoluteTitle: true,
  description:
    'Der Weg durch die Camper-Elektrik: Verbrauch ermitteln, Kabel und Sicherungen auslegen, Batterie und Solar dimensionieren — mit Rechnern und Normbezug.',
  h1: 'Camper-Elektrik planen',
  lead: 'Eine Elektrik im Camper wird nicht gezeichnet, sondern gerechnet: Erst der Verbrauch, dann die Leitung, dann die Absicherung — und am Ende der Plan, aus dem die Stückliste fällt. Diese Seite ist der Wegweiser durch die einzelnen Schritte.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.9,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'reihenfolge',
      heading: 'Die Reihenfolge, in der Elektrik geplant wird',
      body: [
        'Die häufigste Ursache für eine Elektrik, die zweimal gebaut werden muss, ist die Reihenfolge: Wer mit dem Kabel anfängt, wählt es nach Gefühl und findet den Fehler erst, wenn der Kühlschrank im Sommer abschaltet. Der Weg unten kehrt die Abhängigkeiten um — jede Stufe liefert die Eingabe für die nächste.',
        'Jede Stufe hat eine eigene Seite mit Rechenweg, Beispiel und typischen Fehlern. Diese Seite ist die Landkarte; die Details stehen dort.',
      ],
      list: {
        ordered: true,
        items: [
          'Verbrauch aufschreiben: jedes Gerät mit Leistung in Watt und Nutzungsdauer in Stunden am Tag. Die Summe ist der Tagesbedarf in Wh.',
          'Bordnetzspannung festlegen — 12 V für kleine, 24 V für große Anlagen. Sie entscheidet über Ströme und damit über Kabel und Sicherungen.',
          'Leitungen bemessen: Querschnitt über Spannungsfall und Strombelastbarkeit, danach die Sicherung nach der Leitungsgrenze.',
          'Verteilen und absichern: Plusverteilung, Massen, Schutzorgan unmittelbar am Batteriepol.',
          'Batterie dimensionieren: Tagesbedarf, Autarkietage, Entladetiefe der Chemie.',
          'Ladung planen: Solar mit Laderegler, Landstrom oder Lichtmaschine.',
          '230 V nur dort, wo nötig — mit FI-Schutz und Abnahme durch eine Fachkraft.',
          'Plan zeichnen, prüfen lassen und erst dann Kabel konfektionieren.',
        ],
      },
      links: [
        {
          href: '/camper-elektrik/schaltplan/',
          label: 'Schaltplan für den Camper zeichnen',
          description: 'Wie aus der Rechnung ein Plan wird, den man abarbeiten kann.',
        },
      ],
    },
    {
      id: 'verbrauch',
      heading: 'Mit dem Verbrauch anfangen, nicht mit dem Kabel',
      body: [
        'Der Tagesbedarf in Wattstunden (Wh) ist die einzige Zahl, aus der sich alles andere ergibt: Batteriegröße, Solarleistung, Leitungsströme. Eine Beispielrechnung für einen einfachen Kastenwagen:',
        'Die Summe von rund 1 074 Wh ist der Ausgangspunkt. Bei 12 V entspricht das 90 Ah am Tag — eine Zahl, die man nur mit Lithium oder einer großen Solarinsel autark deckt (zur Batterie: [Camper-Batterie dimensionieren](/camper-elektrik/batterie/)).',
      ],
      table: {
        caption: 'Beispielverbrauch eines Kastenwagens — Beispielwerte, keine Messwerte',
        head: ['Verbraucher', 'Leistung', 'Nutzung/Tag', 'Energie/Tag'],
        rows: CONSUMER_ROWS,
        note: 'Watt und Stunden stammen aus Datenblättern oder eigener Messung. Wer keine Messung hat, setzt bewusst konservativ an — der Fehler wirkt sonst erst im Winter.',
      },
      links: [
        {
          href: '/rechner/batteriekapazitaet/',
          label: 'Batteriekapazität aus dem Tagesbedarf berechnen',
          description: 'Vom Wh-Bedarf zur benötigten Nennkapazität in Ah.',
        },
      ],
    },
    {
      id: 'leitungen',
      heading: 'Leitungen: der Spannungsfall entscheidet, nicht das Tabellenbuch',
      body: [
        'Bei 12 V sind die Ströme zehnmal so hoch wie bei 230 V — und genau darum ist der Spannungsfall hier das bestimmende Kriterium, nicht die Strombelastbarkeit. Eine Leitung, die thermisch 20 A trägt, kann über fünf Meter bei 10 A bereits sichtbar Spannung verlieren.',
        'Die Formel ist in beide Richtungen nutzbar: A = (2 · L · I) / (κ · ΔU) sucht den Querschnitt, ΔU = I · 2L / (κ · A) bewertet eine gewählte Leitung. Der Faktor 2 steht für Hin- und Rückleitung, κ ist die Leitfähigkeit von Kupfer mit ' +
          `${COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²) bei 20 °C. Geplant wird mit ${VOLTAGE_DROP_PCT_PLAN_LIMIT} % zulässigem Spannungsfall — bei 12 V also 0,36 V.`,
        'Für empfindliche Verbraucher — Kompressor-Kühlschrank, Funkgerät, Laderegler — ist die 2-%-Grenze die bessere Zielmarke; sie liegt bei 0,24 V und wird in Tabellenwerken häufig auf 0,25 V gerundet. Der Unterschied ist erheblich: 10 A über 5 m ergeben mit 3 % einen Querschnitt von 4,79 mm² (gewählt: 6 mm²), mit 2 % von 7,19 mm² (gewählt: 10 mm²).',
        'Zur Leitfähigkeit gibt es zwei gebräuchliche Zahlen: κ = 58 m/(Ω·mm²), der Kehrwert des spezifischen Widerstands ρ = 0,0175 Ω·mm²/m, und κ = 56 m/(Ω·mm²) in älteren Tabellen. Beide beschreiben dasselbe Kupfer bei 20 °C; mit 56 statt 58 wächst der gerechnete Querschnitt um rund 3,6 %. Der Planer rechnet mit 58 m/(Ω·mm²) und damit auf der knapperen Seite — wer auf Nummer sicher gehen will, wählt die nächstgrößere Normstufe.',
      ],
      formula: {
        expression: 'A = (2 · L · I) / (κ · ΔU)',
        caption: 'Kleinster Querschnitt, damit über die Länge L bei Strom I höchstens ΔU abfällt.',
      },
      definitions: [
        { term: 'A', description: 'Leitungsquerschnitt in mm²' },
        {
          term: 'L',
          description: 'einfache Leitungslänge in Metern (der Faktor 2 steht für Hin- und Rückleitung)',
        },
        { term: 'I', description: 'Betriebsstrom in Ampere' },
        {
          term: 'κ',
          description: `Leitfähigkeit des Leiters, für Kupfer ${COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²) bei 20 °C`,
        },
        { term: 'ΔU', description: 'zulässiger Spannungsfall in Volt' },
      ],
      table: {
        caption:
          'Normreihe mit Belastbarkeit und größter Sicherung (Modell: DIN VDE 0298-4, Verlegeart B2, Derating 0,7)',
        head: ['Querschnitt', 'Tabelle', 'Design (×0,7)', 'Größte Sicherung'],
        rows: CABLE_ROWS,
        note: 'Die letzte Spalte schützt die LEITUNG. Welche Sicherung zu einem Gerät passt, ist eine andere Frage — siehe [Sicherungen im Camper](/camper-elektrik/sicherungen/).',
      },
      links: [
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: '12V-Kabelquerschnitt für den Camper berechnen',
          description: 'Formel, Normreihe, Rechenbeispiele und Rechner.',
        },
        {
          href: '/camper-elektrik/spannungsabfall/',
          label: 'Spannungsabfall bei 12 V verstehen',
          description: 'Warum 3 % die Planungsgrenze sind und wann 2 % nötig werden.',
        },
      ],
    },
    {
      /*
       * Der Rechner ist der einzige Block, den die alte Adresse
       * (`/elektrik-planung/`) einzigartig hatte. Er ist mit auf die
       * Pillar-Seite gewandert: Er rechnet Querschnitt UND Sicherung in
       * einem Schritt — genau die Kette, die sonst über zwei Seiten läuft.
       */
      id: 'rechner',
      heading: 'Kabelquerschnitt und Absicherung berechnen',
      body: [
        'Der Rechner dimensioniert eine 12-V-Leitung nach Spannungsfall und Strombelastbarkeit und nennt die Sicherung, die am Batteriepol sitzt. Das Ergebnis ist immer eine Normgröße aus der Reihe 1,5 bis 70 mm².',
        `Gerechnet wird mit ${VOLTAGE_DROP_PCT_PLAN_LIMIT} % zulässigem Spannungsfall, κ = ${COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²) für Kupfer und einem Derating von 0,7 auf die Tabellenwerte der DIN VDE 0298-4.`,
      ],
      calculator: 'kabelquerschnitt',
      links: [
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherungen passend zur Leitung auswählen',
          description: 'Warum die Sicherung dem Kabel folgt und nicht dem Gerät.',
        },
      ],
    },
    {
      id: 'batterie',
      heading: 'Batterie: nutzbar ist nicht gleich nominell',
      body: [
        'Eine 100-Ah-Batterie liefert je nach Chemie zwischen 30 Ah und 90 Ah, bevor sie leer ist. Die Entladetiefe (Depth of Discharge, DoD) steht im Modell je Chemie — sie ist der wichtigste Hebel bei der Dimensionierung.',
        'Bei hohen Entladeströmen kommt der Peukert-Effekt hinzu: Die entnehmbare Kapazität sinkt weiter, weil der Innenwiderstand mit dem Strom steigt. Der Planer rechnet ihn für die Batteriebilanz mit.',
      ],
      table: {
        caption: 'Entladetiefen des Modells (VDE_BATTERY_DOD)',
        head: ['Chemie', 'Entladetiefe', 'Nutzbar bei 100 Ah'],
        rows: DOD_ROWS,
      },
      formula: {
        expression: 'C_nutz = C_nenn · DoD',
        caption: 'Nutzbare Kapazität als Produkt aus Nennkapazität und Entladetiefe.',
      },
      links: [
        {
          href: '/camper-elektrik/batterie/',
          label: 'Camper-Batterie dimensionieren',
          description: 'Kapazität, Peukert-Effekt und Autarkie zusammengerechnet.',
        },
        {
          href: '/camper-elektrik/lifepo4/',
          label: 'LiFePO4 im Camper',
          description: '90 % Entladetiefe, BMS und Temperaturgrenzen.',
        },
        {
          href: '/camper-elektrik/agm/',
          label: 'AGM und Gel im Camper',
          description: '50 % Entladetiefe, Ladekennlinie und Grenzen.',
        },
      ],
    },
    {
      id: 'laden',
      heading: 'Ladung: Solar, Laderegler, Landstrom',
      body: [
        'Eine Batterie ohne Ladung ist ein Vorrat, kein System. Die Solarinsel wird aus demselben Tagesbedarf ausgelegt wie die Batterie — im Winter mit 35 % des Sommerertrags, weil die Auslegung sonst nur im Juli trägt. Der Laderegler (MPPT oder PWM) bestimmt, wie viel von der Modulleistung tatsächlich in der Batterie ankommt.',
      ],
      links: [
        {
          href: '/rechner/solaranlage/',
          label: 'Solaranlage für den Camper berechnen',
          description: 'Modulleistung aus Tagesbedarf, Ertrag und Jahreszeit.',
        },
        {
          href: '/camper-elektrik/solar/',
          label: 'Solar im Camper auslegen',
          description: 'Ertrag, Verschattung, Winterfall.',
        },
        {
          href: '/camper-elektrik/mppt/',
          label: 'MPPT-Laderegler auslegen',
          description: 'Spannungsfenster, Kalt-Leerlaufspannung, Ströme.',
        },
      ],
    },
    {
      id: 'stromkreise',
      heading: 'Von der Batterie zu den Verbrauchern',
      body: [
        'Zwischen Batterie und Verbraucher liegt mehr als ein Kabel: Verteiler, Sammelschienen, Schutzorgane, Schalter. Zwei Regeln tragen die Sicherheit dieser Ebene — das Schutzorgan sitzt unmittelbar am Batteriepol, und jede Leitung ist gegen den Strom geschützt, den sie führen kann, nicht gegen den, den das Gerät zieht.',
      ],
      links: [
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherungen im Camper richtig setzen',
          description: 'Ort, Größe und Schutzziel des Schutzorgans.',
        },
        {
          href: '/camper-elektrik/wechselrichter/',
          label: 'Wechselrichter auslegen',
          description: '230 V aus 12 V: Wirkungsgrad, Leerlaufverbrauch, Kabel.',
        },
        {
          href: '/camper-elektrik/230v/',
          label: '230-V-Anlage im Camper',
          description: 'Landstrom, FI-Schutz und Abnahme.',
        },
      ],
    },
    {
      id: 'absicherung',
      heading: 'Absicherung: die Sicherung sitzt am Batteriepol',
      body: [
        'Ein Kurzschluss in einer ungeschützten Leitung wird zur Heizung: Der Strom einer 100-Ah-LiFePO4 ist hoch genug, um eine 2,5-mm²-Leitung in Sekunden in Brand zu setzen. Deshalb sitzt das Schutzorgan unmittelbar am Pluspol der Batterie, bevor die erste Leitung ungeschützt geführt wird. Der Planer prüft dafür ' +
          `${FUSE_MAX_UNPROTECTED_LENGTH_M * 100} cm ab der Quelle — der Wert aus ISO 10133:2000 § 8.1, der für kleine Boote und damit für einen großen Teil der Camper-Praxis gilt. DIN VDE 0100-721 verlangt den Überstromschutz ebenfalls nahe der Batterie, nennt aber keine Länge.`,
        'Bemessen wird die Sicherung nicht nach dem Gerät, sondern nach dem Kabel. Maßgeblich ist die Kette I_B ≤ I_n ≤ I_z: Der Betriebsstrom I_B darf die Nennstromstärke der Sicherung I_n nicht überschreiten, und die Sicherung darf die Belastbarkeit des Leiters I_z nicht überschreiten. Ein zu dünnes Kabel ist daher kein „Puffer“, sondern bestimmt die Obergrenze der Sicherung — dickere Leitung ist der günstigere Weg zu einer größeren Sicherung als eine Sicherung, die im Kurzschlussfall nicht mehr schützt.',
      ],
      callout: {
        tone: 'warning',
        text: 'Die 230-V-Seite des Fahrzeugs ist ein eigener Fall: Für Landstromanschlüsse gilt die Prüfung nach DIN VDE 0100-721 durch eine Elektrofachkraft. Der Planer hilft beim Aufbau, er ersetzt keine Abnahme.',
      },
      links: [
        {
          href: '/camper-elektrik/230v/',
          label: '230-V-Anlage im Camper',
          description: 'Landstrom, FI-Schutz und Abnahme.',
        },
      ],
    },
    {
      id: 'normen',
      heading: 'Normen, auf die sich das Modell bezieht',
      body: [
        'Die Aussagen dieser Seite und die Rechnungen des Planers stützen sich auf die folgenden Regelwerke. Normaussagen sind Referenzen auf den Geltungsbereich der genannten Regelwerke, keine Rechtsprüfung.',
      ],
      definitions: NORMEN.map((entry) => ({ term: entry.norm, description: entry.bereich })),
      links: [
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: '12V-Kabelquerschnitt für den Camper berechnen',
          description: 'Formel, Normreihe, Rechenbeispiele und Rechner.',
        },
      ],
    },
    {
      id: 'pruefen',
      heading: 'Woran man eine fertige Planung prüft',
      body: [
        'Die folgende Liste hat sich als Prüfschritt vor dem ersten Schnitt bewährt. Wer sie durchgeht, findet die meisten Fehler, ohne ein Kabel zu verlegen.',
      ],
      list: {
        items: [
          'Ist jede Leitung über ihre ganze Länge gesichert — auch die kurze Strecke vom Batteriepol zum Verteiler?',
          'Sind die Ströme mit Hin- und Rückleitung gerechnet, oder fehlt der Faktor 2?',
          'Trägt die Batterie den Tagesbedarf auch an einem trüben Wintertag, oder nur im Sommer?',
          'Sind die 230-V-Kreise mit FI-Schutz ausgestattet, und ist die Abnahme durch eine Fachkraft eingeplant?',
          'Steht in der Stückliste zu jedem Querschnitt auch die passende Sicherung?',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Der Camper-Elektroplaner prüft diese Punkte automatisch mit: Er rechnet Spannungsfall je Kabel, prüft die Absicherung, warnt vor dem Schutzorgan weit weg vom Batteriepol und erzeugt die Stückliste. [Camper-Elektroplaner öffnen](/planer/).',
      },
    },
  ],
  faq: [
    {
      question: 'Womit fange ich bei der Camper-Elektrik an?',
      answer:
        'Mit dem Verbrauch in Wattstunden pro Tag. Aus dieser einen Zahl folgen Batteriekapazität, Solarleistung und alle Ströme — also auch Kabelquerschnitte und Sicherungen. Wer mit dem Kabel anfängt, entscheidet ohne Grundlage und korrigiert später teuer.',
    },
    {
      question: 'Reicht 12 V oder brauche ich 24 V?',
      answer:
        'Bis etwa 2 000 W Spitzenlast ist 12 V üblich; darüber werden die Ströme so groß, dass Querschnitte und Schutzorgane unhandlich werden. Der Rechenweg bleibt derselbe, nur die Zahlen ändern sich: Bei 24 V halbiert sich der Strom bei gleicher Leistung, der Querschnitt sinkt damit auf ein Viertel.',
    },
    {
      /*
       * Die folgenden vier Fragen stammen von der umgezogenen Seite
       * `/elektrik-planung/`. Sie beantworten die Einzelfragen, die dort
       * das Akkordeon füllten — mit denselben Zahlen, mit denen das Modell
       * rechnet. Sichtbarer Text und `FAQPage` kommen aus dieser einen
       * Quelle, damit sie nicht auseinanderlaufen können.
       */
      question: 'Wie hoch darf der Spannungsabfall in einem 12-V-Kreis sein?',
      answer:
        'Der Rechner dimensioniert mit 3 % der Nennspannung, bei 12 V also mit 0,36 V. Für empfindliche Verbraucher wie Kompressor-Kühlschränke, Funkgeräte oder Laderegler sind 2 % (0,24 V, in Tabellen häufig auf 0,25 V gerundet) die bessere Zielmarke: Bei 10 A über 5 m Leitung ergibt die 3-%-Grenze 6 mm², die 2-%-Grenze bereits 10 mm². Beide Prozentwerte sind Planungsannahmen — DIN VDE 0298-4 nennt Strombelastbarkeiten, keine Spannungsfall-Grenzwerte.',
    },
    {
      question: 'Wie berechnet man den Kabelquerschnitt für Kupferleitungen?',
      answer:
        'Mit A = (2 · L · I) / (κ · ΔU): A ist der Querschnitt in mm², L die einfache Leitungslänge in Metern, der Faktor 2 steht für Hin- und Rückleitung, I der Betriebsstrom in Ampere, ΔU der zulässige Spannungsfall in Volt und κ die Leitfähigkeit des Leiters. Für Kupfer rechnet der Planer mit κ = 58 m/(Ω·mm²) bei 20 °C; ältere Tabellenwerke verwenden 56 m/(Ω·mm²), was den rechnerischen Querschnitt um knapp 4 % erhöht. Das Ergebnis wird immer auf die nächste Normgröße aufgerundet: 1,5 · 2,5 · 4 · 6 · 10 · 16 · 25 · 35 · 50 · 70 mm².',
    },
    {
      question: 'Wie tief dürfen LiFePO4- und AGM-Batterien entladen werden?',
      answer:
        'LiFePO4 bis 90 % Entladetiefe, AGM und Gel bis 50 %, Nassblei bis 30 %. Aus einer 100-Ah-Batterie werden damit 90 Ah (LiFePO4) beziehungsweise 50 Ah (AGM) nutzbare Kapazität. Der Planer hinterlegt diese Entladetiefen je Chemie und rechnet zusätzlich den Peukert-Effekt: Bei hohen Strömen sinkt die entnehmbare Kapazität weiter, weshalb die nutzbare Kapazität nicht allein aus der Nennkapazität folgt.',
    },
    {
      question: 'Wo muss die Sicherung in der 12-V-Anlage sitzen?',
      answer:
        'Unmittelbar am Pluspol der Batterie, vor der ersten ungeschützten Leitungsstrecke. Der Planer prüft 0,2 m ab der Quelle (ISO 10133:2000 § 8.1); DIN VDE 0100-721 verlangt den Überstromschutz nahe der Batterie, ohne eine Länge zu nennen. Die Sicherung schützt die Leitung, nicht das Gerät: Ihre Größe folgt der Belastbarkeit des Querschnitts — im Modell 70 % der Tabellenwerte nach DIN VDE 0298-4, Verlegeart B2 — und nicht dem Verbraucher.',
    },
    {
      question: 'Was prüft Camp automatisch, was muss ich selbst prüfen?',
      answer:
        'Der Planer prüft rechnerisch: Spannungsfall je Leitung, Strombelastbarkeit, Sicherungsgröße, Abstand des Schutzorgans zur Quelle und ob Verbraucher Angaben für die Energiebilanz haben. Nicht geprüft werden Anlagen, die nur eine Elektrofachkraft beurteilen darf — insbesondere die 230-V-Seite, der Zustand von Batterien und die mechanische Verlegung.',
    },
  ],
  related: [
    { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
    { href: '/camper-elektrik/spannungsabfall/', label: 'Spannungsabfall bei 12 V' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/camper-elektrik/solar/', label: 'Solar auslegen' },
    { href: '/camper-elektrik/schaltplan/', label: 'Schaltplan zeichnen' },
    { href: '/rechner/', label: 'Alle Rechner im Überblick' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
    { href: '/tools/dach/', label: 'Dach-Planer: Panels und Dachluke platzieren' },
    { href: '/tools/heizung/', label: 'Heizlast-Rechner: passende Heizleistung finden' },
    { href: '/guides/ausbau-fahrplan/', label: 'Ausbau-Fahrplan: Reihenfolge der Gewerke' },
    { href: '/guides/camper-ausbauguide/', label: 'Camper-Ausbauguide: Technik, Normen und Praxis' },
  ],
  sources: [
    {
      label: 'DIN VDE 0298-4',
      detail:
        'Strombelastbarkeit der verwendeten Normreihe (Modell: Verlegeart B2, 30 °C, zwei belastete Adern). Camp rechnet mit einem Derating von 0,7 auf die Tabellenwerte — eine dokumentierte, konservative Annahme.',
    },
    {
      label: 'DIN VDE 0100-721',
      detail:
        'Kleinspannungsanlagen in Caravans und Motorcaravans: verlangt den Überstromschutz nahe der Batterie, nennt für diesen Abstand aber keine Länge.',
    },
    {
      label: 'ISO 10133:2000 § 8.1',
      detail:
        'Schutzorgan am Quellpunkt bei Kleinspannungs-Gleichstromanlagen. Der Planer prüft daraus 0,2 m ab der Quelle.',
    },
    {
      label: 'Modellwerte in der Auslieferung',
      detail:
        'Kupfer-Leitfähigkeit κ = 58 m/(Ω·mm²) bei 20 °C, Entladetiefen je Chemie und die Grenzen 1 / 3 / 4 % Spannungsfall stehen in `lib/materials.ts`, `lib/vde-standards.ts` und `lib/electrical.ts`.',
    },
  ],
  assumptions: [
    'Kupfer bei 20 °C: Der Temperaturzuschlag betriebswarmer Leitungen ist im Spannungsfall nicht modelliert (DIN VDE 0100-520 nennt den Spannungsfall ohne Zuschlag).',
    'Verlegeart B2 mit pauschalem Derating 0,7 deckt Bündelung und Umgebungstemperaturen über 30 °C ab, ersetzt aber keinen Nachweis je Einzelfall.',
    'Beispielverbraucher auf dieser Seite sind Beispielwerte zur Veranschaulichung — für die eigene Planung zählt die eigene Messung oder das Datenblatt.',
  ],
  limits: [
    'Die 230-V-Seite des Fahrzeugs darf nur eine Elektrofachkraft errichten und abnehmen. Rechnerische Hinweise in Camp sind keine Abnahme.',
    'Batteriealterung, Zyklenzahl und Temperaturschwäche von Bleibatterien sind im Modell nicht abgebildet; der Reservezuschlag im Batterierechner ist ein bewusst sichtbarer Eingabewert.',
    'Eine mechanische Beurteilung (Scheuerstellen, Zugentlastung, Brandverhalten von Leitungen im Fahrzeug) leistet keine Rechnung.',
  ],
};
