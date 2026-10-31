/**
 * lib/seo/content/ladebooster.ts — Themenseite `/camper-elektrik/ladebooster/`.
 *
 * Die Seite vergleicht zuerst und erklärt danach. Der Gerätevergleich steht als
 * `comparison` im Export VOR diesen Abschnitten (Gate G4); die vier Abschnitte
 * erklären die Entscheidung dahinter: Relais oder Booster, welche Stromklasse,
 * welche Leitung, welche Messung.
 *
 * Zwei Zusagen:
 *   1. Alle Querschnitte, Sicherungen und Spannungsfälle in den Tabellen werden
 *      beim Import aus `lib/cableSizing.ts` GERECHNET, nicht getippt. Eine
 *      Themenseite, die andere Zahlen zeigt als der Rechner daneben, wäre
 *      schlimmer als keine Tabelle.
 *   2. Der Gerätevergleich wird hier nicht nacherzählt. Geräte, Preise,
 *      Datenblatt-Widersprüche und Forenfunde stehen in
 *      `lib/seo/comparisons/ladebooster.ts`; Gate G1 meldet jede Aussage ab 60
 *      Zeichen und jede gemeinsame Wortfolge ab 6 Wörtern, die in beiden
 *      Schichten steht.
 */

import { sizeCable } from '@/lib/cableSizing';
import { DERATE_FACTOR, FUSE_MAX_UNPROTECTED_LENGTH_M, VOLTAGE_DROP_PCT_PLAN_LIMIT } from '@/lib/electrical';
import { LADEBOOSTER_VERGLEICH } from '../comparisons/ladebooster';

import type { SeoPageContent } from '../types';

/** Deutsche Schreibweise für Zahlen im Fließtext und in Tabellenzellen. */
const de = (value: number, digits = 1): string => value.toFixed(digits).replace('.', ',');

/** Derating als Text — die Konstante selbst trägt einen Punkt als Dezimaltrenner. */
const DERATING_DE = DERATE_FACTOR.toFixed(1).replace('.', ',');

/** Beschriftung des bestimmenden Kriteriums aus `sizeCable`. */
const CRITERION_LABELS: Record<string, string> = {
  voltageDrop: 'Spannungsfall',
  ampacity: 'Strombelastbarkeit',
  standardMinimum: 'Norm-Minimum',
};

/**
 * Die Bemessungstabelle: Ladestrom, Leitungslänge, Querschnitt, Spannungsfall,
 * Sicherung — alles aus dem Modell, nichts von Hand.
 *
 * Die drei Ströme sind die drei Klassen, um die es auf dieser Seite geht
 * (30, 60 und 90 A — gerechnet mit 50 A, weil das die nächstliegende
 * Normstufe zwischen 30 und 90 ist und die Geräte dort liegen).
 *
 * Gerechnet wird die EINFACHE Länge (Batterie → Booster) bei 12 V; das Modell
 * verdoppelt sie intern für Hin- und Rückleitung. Beispiel: Der Kastenwagen
 * mit 30-A-Booster hinter dem Fahrersitz liegt bei 4 bis 6 m einfacher Länge.
 */
const KABEL_BEISPIELE: readonly { currentA: number; lengthM: number }[] = [
  { currentA: 30, lengthM: 2 },
  { currentA: 30, lengthM: 4 },
  { currentA: 30, lengthM: 6 },
  { currentA: 50, lengthM: 2 },
  { currentA: 50, lengthM: 4 },
  { currentA: 50, lengthM: 6 },
  { currentA: 90, lengthM: 2 },
  { currentA: 90, lengthM: 4 },
  { currentA: 90, lengthM: 6 },
];

const KABEL_ROWS = KABEL_BEISPIELE.map(({ currentA, lengthM }) => {
  const sizing = sizeCable(currentA, lengthM);
  return [
    `${currentA} A`,
    `${de(lengthM, 0)} m`,
    `${de(sizing.crossSectionMm2)} mm²`,
    `${de(sizing.voltageDropPercent)} %`,
    sizing.fuseA === null ? '—' : `${sizing.fuseA} A`,
    CRITERION_LABELS[sizing.criterion] ?? sizing.criterion,
  ];
});

/** Werte, die auch in der FAQ auftauchen — aus derselben Rechnung. */
const BEISPIEL_30A_2M = sizeCable(30, 2);
const BEISPIEL_30A_6M = sizeCable(30, 6);
const BEISPIEL_50A_4M = sizeCable(50, 4);

/** Der Text der Querschnitts-FAQ, vollständig aus dem Modell abgeleitet. */
const FAQ_KABELQUERSCHNITT =
  `Mit ${VOLTAGE_DROP_PCT_PLAN_LIMIT} % Planungsgrenze und Derating ${DERATING_DE} fordert das Modell ` +
  `bei 30 A über 2 m ${de(BEISPIEL_30A_2M.crossSectionMm2)} mm², über 6 m ` +
  `${de(BEISPIEL_30A_6M.crossSectionMm2)} mm² und bei 50 A über 4 m ` +
  `${de(BEISPIEL_50A_4M.crossSectionMm2)} mm². Maßgeblich ist der größere Wert aus ` +
  `Strombelastbarkeit und Spannungsfall.`;

export const LADEBOOSTER_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/ladebooster/',
  slug: 'ladebooster',
  topicId: 'ladebooster',
  kind: 'cluster',
  title: 'Ladebooster-Vergleich: 9 Geräte, 30–110 A',
  description:
    'Neun Ladebooster mit Ladestrom, Preis, D+-Bedingung und Datenblattlage — plus Querschnitt, Sicherung und ein Rechner für die passende Stromklasse.',
  h1: 'Ladebooster vergleichen und auslegen',
  lead: 'Oben stehen die Geräte mit Ladestrom, Preis, Steuerleitung und Datenblattlage — sortierbar und mit Belegen. Darunter die Auslegung: Trennrelais oder Booster, welche Stromklasse zur Batterie passt, welche Leitung und welche Sicherung dazugehören und was nach dem Einbau gemessen wird.',
  priority: 'P2',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-10',
  comparison: LADEBOOSTER_VERGLEICH,
  sections: [
    {
      id: 'relais-oder-booster',
      heading: 'Trennrelais oder Ladebooster: die Entscheidung',
      body: [
        'Ein Trennrelais verbindet Starter- und Bordbatterie, sobald der Motor läuft. Der Ladestrom ist nicht geregelt — er stellt sich aus dem Spannungsunterschied und dem Widerstand der Leitungen ein. Bei einer Bleibatterie und einer kurzen Leitung kann das genügen.',
        'Ein Booster setzt ein eigenes Ladegerät dazwischen und gibt die Spannung mit einer Ladekennlinie weiter. Bei LiFePO4 ist das die Voraussetzung dafür, dass die Batterie überhaupt voll wird: Ohne Regelung bestimmt die Lichtmaschine den Strom, und sie arbeitet dann außerhalb ihres Auslegungspunkts.',
      ],
      list: {
        items: [
          'Geregelte Lichtmaschine (Euro 6d und neuer): Sie fährt die Ladespannung im Teillastbetrieb bewusst herunter, häufig so weit, dass eine Bordbatterie über eine lange Leitung nicht mehr voll wird. Der Booster hebt sie auf das Niveau der Kennlinie.',
          'Lange Leitung oder zwei Banken: Der Booster macht den Ladestrom unabhängig vom Spannungsabfall der Leitung.',
          'Zwei Geräte parallel sind erlaubt, teilen die Last aber nicht von selbst — kleine Toleranzen entscheiden, welches zuerst in die Strombegrenzung läuft. Abhilfe sind gleiche Leitungslängen und ein gemeinsamer Abgreifpunkt, keine Einstellung.',
          'Ein Relais an einer LiFePO4-Bank ist der häufigste Fehlgriff: Die Batterie wird nie voll, und die Lichtmaschine wird warm.',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Ein Booster ersetzt keine Sicherung und keinen Querschnitt. Er begrenzt seinen Ausgangsstrom; die Zuleitung von der Starterbatterie führt aber den vollen Eingangsstrom und wird mit diesem Wert bemessen.',
      },
    },
    {
      id: 'stromklasse',
      heading: 'Welche Stromklasse: 30, 60 oder 90 A',
      body: [
        'Die C-Rate ist der Ladestrom als Vielfaches der Nennkapazität: 30 A an 330 Ah sind 0,09 C, 90 A sind 0,27 C. LiFePO4-Datenblätter nennen als Dauerladestrom meist 0,3 bis 0,5 C, AGM und Gel 0,1 bis 0,2 C — daran muss die Klasse zur Batterie passen. Das Blei-Fenster des Rechners liegt mit 0,2 bis 0,3 C darüber; es ist eine Modellannahme und keine Datenblattgrenze.',
        '100 Ah ab leer brauchen mit 30 A gut drei Stunden und mit 50 A zwei; die Konstantspannungsphase am Ende kommt dazu, weil der Strom dort von selbst sinkt. Der Rechner rechnet beides für deine Bank und prüft gleichzeitig die Lichtmaschine — denn die ist die Grenze, nicht das Gerät.',
      ],
      calculator: 'ladestrom',
      definitions: [
        {
          term: 'Bedarfsstrom',
          description:
            'Was das Gerät abgeben müsste, damit die Batterie nach der Fahrzeit voll ist. Ein kleineres Gerät lädt ebenfalls, nur länger.',
        },
        {
          term: 'Eingangsstrom',
          description:
            'Ausgangsstrom geteilt durch den Wirkungsgrad, zuzüglich der Fahrzeuglast. Ein 90-A-Booster zieht eingangsseitig rund 100 A; die Zuleitung von der Starterbatterie wird mit diesem Wert bemessen.',
        },
        {
          term: 'Drosselung',
          description:
            'Geräte mit einstellbarem Strom lassen sich zurücknehmen, sobald die Lichtmaschine warm wird. Das ist Reserve für den Winter, ohne dauerhaft am Limit zu fahren.',
        },
      ],
      callout: {
        tone: 'info',
        text: 'Mein Ausbau: 330 Ah LiFePO4, Induktionskochfeld über Wechselrichter, Euro-6-Fahrzeug mit geregelter Lichtmaschine. 30 A sind daran 0,09 C — zwei Stunden Fahrt brachten rechnerisch 0,8 kWh, das Kochfeld braucht 1 bis 2 kWh am Tag. 60 A waren der härteste Gegenkandidat mit 0,18 C. Geworden sind es 90 A, die ich bei warmer Lichtmaschine auf 75 A zurücknehme.',
      },
    },
    {
      id: 'leitung',
      heading: 'Kabel, Sicherung und Steuerleitung',
      body: [
        'Die Zuleitung zum Booster ist der anspruchsvollste Teil der Anlage: Sie führt den vollen Ladestrom über die größte Strecke im Fahrzeug. Gerechnet wird mit zwei Grenzen — der Strombelastbarkeit nach DIN VDE 0298-4 mit einem Derating von ' +
          DERATING_DE +
          ' für Bündelung und Wärme im Motorraum und dem Spannungsfall als Planungsgrenze von ' +
          VOLTAGE_DROP_PCT_PLAN_LIMIT +
          ' % der Nennspannung. Maßgeblich ist das größere der beiden Ergebnisse.',
        'Der häufigste Fehler ist ein Querschnitt nach dem Ausgangsstrom, obwohl die Eingangsleitung den höheren Strom führt. Der zweithäufigste ist eine Sicherung am Booster statt am Batteriepol: Dann liegt die längste ungeschützte Strecke direkt an der Quelle.',
      ],
      table: {
        caption:
          'Bemessung der Zuleitung bei 12 V, einfache Länge (Batterie → Booster), gerechnet mit dem Modell dieser Auslieferung',
        head: ['Ladestrom', 'Länge (einfach)', 'Querschnitt', 'Spannungsfall', 'Sicherung', 'Bestimmt durch'],
        rows: KABEL_ROWS,
        note: `Über 8 m fordert dieselbe Rechnung ${de(sizeCable(30, 8).crossSectionMm2)} mm² bei 30 A und ${de(sizeCable(90, 8).crossSectionMm2)} mm² bei 90 A. Alle Werte sind Normgrößen der Reihe 1,5 bis 70 mm²; ist mehr nötig, meldet der Planer das statt zu runden.`,
      },
      definitions: [
        {
          term: 'Sicherung am Batteriepol',
          description: `Sie schützt die Leitung, nicht das Gerät, und sitzt im Modell höchstens ${Math.round(FUSE_MAX_UNPROTECTED_LENGTH_M * 100)} cm vom Pol entfernt. Die Größe folgt der Leitung: über dem Betriebsstrom des Boosters, unter dem, was die Leitung dauerhaft führen kann. Für Dauerlast sind etwa 25 % Reserve üblich; die größte zulässige Sicherung je Querschnitt ist die Obergrenze, nicht automatisch die richtige Wahl. Bei LiFePO4-Bänken muss das Abschaltvermögen zum Kurzschlussstrom passen — regelmäßig mindestens MRBF oder Class T, nicht die Flachsicherung; BMS und Datenblatt der Batterie bleiben maßgeblich.`,
        },
        {
          term: 'Zweite Sicherung an der Bordbatterie',
          description:
            'Zwischen Booster und Bordbatterie speist die Bordbatterie den Kurzschlussstrom — deshalb sitzt die zweite Sicherung an ihrem Pol, nicht am Booster-Ausgang. Diese Leitung liegt auch im Stand an Batteriespannung; die Sicherung schützt die Leitung, nicht Personen.',
        },
        {
          term: 'Steuerleitung D+',
          description:
            'Viele Booster starten am D+-Signal oder an der Zündung. Fehlt beides und das Gerät erkennt den Motor nur über die Eingangsspannung, läuft es bei Solar-Einspeisung oder am Landstromladegerät ungewollt an. Bei Euro 6 ist D+ die sichere Wahl.',
        },
        {
          term: 'Masseleitung',
          description:
            'Sie gehört zum Stromkreis und braucht denselben Querschnitt wie die Plusleitung. Ein dünnerer Rückweg hebt den Querschnitt der Plusleitung auf, und ein loser Massepunkt ist eine Wärmestelle.',
        },
      ],
      list: {
        items: [
          'Beide Adern rechnen: Der Spannungsfall entsteht über Hin- und Rückleitung. Das Modell verdoppelt die einfache Länge, deshalb steht sie so in der Tabelle.',
          'Übergangswiderstände zählen mit — Klemmen, Kabelschuhe und der Massepunkt am Chassis. Ein sauberer, angezogener Massepunkt in vollem Querschnitt ist Teil der Bemessung.',
          'Quetschverbinder und Aderendhülsen in passender Größe: Ein 16-mm²-Kabelschuh an einer 25-mm²-Leitung ist ein Widerstand und eine Wärmestelle.',
        ],
      },
      links: [
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: 'Kabelquerschnitt im Camper berechnen',
          description: 'Formel, Normreihe und die Rolle von Strom und Länge.',
        },
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherungen im Camper',
          description: 'Größte zulässige Sicherung je Querschnitt und Abschaltvermögen.',
        },
        { href: '/rechner/ladestrom/', label: 'Ladestrom berechnen' },
      ],
    },
    {
      id: 'messen',
      heading: 'Messen nach dem Einbau',
      body: [
        'Zwei Messungen entscheiden, ob die Anlage das tut, was die Rechnung verspricht — beide mit dem Multimeter und beide im Betrieb, nicht im Stand.',
      ],
      list: {
        ordered: true,
        items: [
          'Spannungsfall der Zuleitung: Spannung am Batteriepol und am Boostereingang bei vollem Ladestrom messen. Die Differenz ist der Verlust der Leitung. Liegt sie deutlich über der Rechnung, sind Klemmen, Querschnitt oder Massepunkt die Ursache.',
          'Ladestrom und Ladespannung an der Bordbatterie: Erreicht die Spannung die Ladeschlussspannung der Batterie nicht, ist die Kennlinie falsch eingestellt — nicht die Lichtmaschine zu schwach.',
          'Nach einer Fahrt Klemmen und Kabelschuhe auf Wärme prüfen, vorsichtig und nicht mit dem bloßen Finger. Eine warme Klemme ist ein Widerstand.',
        ],
      },
      callout: {
        tone: 'warning',
        text: 'Arbeiten an der Fahrzeuganlage nur bei abgeklemmter Starterbatterie, Arbeiten an 230-V-Anlagen ausschließlich durch eine Elektrofachkraft. Diese Seite ersetzt keine Fachplanung, sie macht die Rechenwege nachvollziehbar.',
      },
    },
  ],
  faq: [
    {
      question: 'Brauche ich einen Ladebooster oder reicht ein Trennrelais?',
      answer:
        'Bei Bleibatterie, kurzer Leitung und einfacher Anlage kann ein Relais genügen. Bei LiFePO4, geregelter Lichtmaschine oder langer Leitung übernimmt der Booster: Er lädt mit Kennlinie und begrenztem Strom, statt den Strom dem Spannungsunterschied zu überlassen.',
    },
    {
      question: 'Welcher Kabelquerschnitt gehört zu einem Ladebooster?',
      answer: FAQ_KABELQUERSCHNITT,
    },
    {
      question: 'Reicht ein 30-A-Booster für eine 100-Ah-LiFePO4-Batterie?',
      answer:
        'Rechnerisch ja: 30 A sind 0,3 C und liegen im üblichen Datenblattfenster. Eine leere 100-Ah-Batterie braucht damit gut drei Stunden plus Konstantspannungsphase. Wer nur kurze Etappen fährt, gewinnt mit Solar mehr als mit einem größeren Gerät.',
    },
    {
      question: 'Kann man zwei Ladebooster parallel schalten?',
      answer:
        'Victron erlaubt es für die Orion-Tr-Smart-Reihe ausdrücklich. Die Last verteilt sich aber nicht automatisch, und der Eingangsstrom verdoppelt sich — gleiche Leitungslängen, ein gemeinsamer Abgreifpunkt und eine stillgelegte EBL-Ladung sind Pflicht.',
    },
    {
      question: 'Welcher Ladebooster für 300 Ah LiFePO4?',
      answer:
        'Nach 0,3 bis 0,5 C wären das 90 bis 150 A; praktisch relevant ist die Klasse 60 bis 90 A. Entscheidend sind zusätzlich der maximale Ladestrom des BMS und die Lichtmaschine — ein 90-A-Gerät zieht eingangsseitig rund 100 A.',
    },
    {
      question: 'Braucht man bei Euro 6 unbedingt D+?',
      answer:
        'Nicht jedes Fahrzeug, aber bei einer intelligenten Lichtmaschine ist D+ oder ein Zündsignal die zuverlässigere Steuerung. Reine Spannungserkennung kann den Booster abschalten, obwohl der Motor läuft, und beim Rekuperieren wieder zuschalten.',
    },
    {
      question: 'Was kostet ein guter Ladebooster?',
      answer:
        'Das Gerät ist die kleinere Hälfte: 30 A gibt es ab rund 168 €, 90 A ab rund 500 €. Dazu kommen je nach Fahrzeug 100 bis 300 € für Kabel, Sicherungen und Kabelschuhe — der Querschnitt steigt mit dem Strom.',
    },
  ],
  related: [
    { href: '/rechner/ladestrom/', label: 'Ladestrom berechnen' },
    { href: '/camper-elektrik/laden/', label: 'Bordbatterie laden: die drei Wege' },
    {
      href: '/camper-elektrik/lifepo4/',
      label: 'LiFePO4 im Camper',
      description: 'Warum die Lichtmaschine allein keine geregelte Ladequelle ist.',
    },
    {
      href: '/camper-elektrik/kabelquerschnitt/',
      label: 'Kabelquerschnitt berechnen',
      description: 'Strombelastbarkeit und Spannungsfall als zwei Grenzen.',
    },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    {
      href: '/planer/',
      label: 'kostenlosen Camper-Schaltplan erstellen',
      description: 'Booster, Batterie und Leitungen im Zusammenhang zeichnen.',
    },
  ],
  sources: [
    {
      label: 'Geräte und Preise',
      detail:
        'Datenblätter, Handbücher, Forenthreads und Preisstände stehen im Quellenblock des Vergleichs oben auf dieser Seite.',
    },
    {
      label: 'DIN VDE 0298-4',
      detail:
        'Strombelastbarkeit der Leitungen — die Tabelle dieser Seite rechnet mit dem Modellwert der Auslieferung (Verlegeart B2, Derating für Bündelung und Umgebung).',
    },
    {
      label: 'DIN VDE 0100-430',
      detail:
        'Schutz bei Überstrom: Koordination von Betriebsstrom, Sicherungsgröße und Leitungsbelastbarkeit.',
    },
    {
      label: 'ISO 13297:2020 § 8.1',
      detail: 'Schutzorgan unmittelbar am Quellpunkt — im Modell 0,2 m ab dem Batteriepol.',
    },
    {
      label: 'DIN VDE 0100-721',
      detail:
        'Elektrische Anlagen in Caravans und Motorcaravans: Bezugsrahmen für Absicherung und Leitungsschutz in dieser Auslieferung.',
    },
  ],
  assumptions: [
    'Gerechnet wird mit 12 V und dem Nennstrom des Boosters als Dauerstrom.',
    'Länge ist die einfache Strecke zwischen den Polen; das Modell verdoppelt sie für Hin- und Rückleitung.',
    'Derating 0,7 und Planungsgrenze 3 % Spannungsfall sind Modellannahmen, keine Herstellerangaben.',
  ],
  limits: [
    'Der Vergleich oben nennt Geräte, Preise und Forenstimmen als redaktionelle Einordnung. Er ersetzt keine Messung am Fahrzeug und keine Kaufberatung.',
    'Wirkungsgrad, Temperaturregelung und Kennlinien konkreter Geräte sind Datenblattangaben und nicht im Modell.',
    'Fahrzeugspezifische Anschlüsse (D+-Signal, Klemmenbelegung, Absicherung ab Werk) stehen hier nicht.',
  ],
};
