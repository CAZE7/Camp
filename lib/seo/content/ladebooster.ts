/**
 * lib/seo/content/ladebooster.ts — Themenseite `/camper-elektrik/ladebooster/`.
 *
 * Sie beantwortet die Frage, die vor jedem Booster-Einbau steht: Braucht die
 * Bordbatterie überhaupt einen Ladebooster, oder tut es ein Trennrelais? Und
 * wenn ja — 30 A oder 50 A, und welcher Querschnitt gehört dazu?
 *
 * Zwei Zusagen dieser Seite:
 *   1. Alle Querschnitte, Sicherungen und Spannungsfälle in der Tabelle werden
 *      beim Import aus `lib/cableSizing.ts` GERECHNET, nicht getippt. Eine
 *      Themenseite, die andere Zahlen zeigt als der Rechner daneben, wäre
 *      schlimmer als keine Tabelle.
 *   2. Kein Markenvergleich. Die Seite nennt Bauformen, Ströme und
 *      Anschlussbedingungen; Produktdaten (Wirkungsgrad eines konkreten
 *      Geräts, Kabelquerschnitt der Herstellerempfehlung) stammen aus
 *      Datenblättern und stehen nicht im Modell.
 */

import { sizeCable } from '@/lib/cableSizing';
import {
  DERATE_FACTOR,
  FUSE_MAX_UNPROTECTED_LENGTH_M,
  VOLTAGE_DROP_PCT_PLAN_LIMIT,
  calculateMaxFuse,
} from '@/lib/electrical';

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

/** Querschnitt für Strom und Länge als Text — dieselbe Rechnung wie die Tabelle unten. */
const querschnitt = (currentA: number, lengthM: number): string =>
  `${de(sizeCable(currentA, lengthM).crossSectionMm2)} mm²`;

/** Größte zulässige Sicherung eines Querschnitts als Text (Modellwert). */
const maxSicherung = (crossSectionMm2: number): string => `${calculateMaxFuse(crossSectionMm2)} A`;

/** Werte, die auch in FAQ und Fließtext auftauchen — aus derselben Rechnung. */
const BEISPIEL_30A_2M = sizeCable(30, 2);
const BEISPIEL_30A_6M = sizeCable(30, 6);
const BEISPIEL_50A_4M = sizeCable(50, 4);

/** Der Text der Querschnitts-FAQ, vollständig aus dem Modell abgeleitet. */
const FAQ_KABELQUERSCHNITT =
  `Der Querschnitt folgt aus zwei Grenzen, und die strengere gewinnt. Mit ${VOLTAGE_DROP_PCT_PLAN_LIMIT} % ` +
  `Planungsgrenze und dem Derating von ${DERATING_DE} fordert das Modell bei 30 A über 2 m Leitung ` +
  `${de(BEISPIEL_30A_2M.crossSectionMm2)} mm² (Spannungsfall der gewählten Leitung ` +
  `${de(BEISPIEL_30A_2M.voltageDropPercent)} %), über 6 m ${de(BEISPIEL_30A_6M.crossSectionMm2)} mm² — ` +
  `und bei 50 A über 4 m ${de(BEISPIEL_50A_4M.crossSectionMm2)} mm². Maßgeblich ist immer der größere ` +
  `der beiden Werte: Die Strombelastbarkeit fordert bei 30 A dauerhaft mindestens ` +
  `${de(sizeCable(30, 2).requiredCrossSectionMm2)} mm², der Spannungsfall wächst mit der Länge.`;

export const LADEBOOSTER_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/ladebooster/',
  slug: 'ladebooster',
  topicId: 'ladebooster',
  kind: 'cluster',
  title: 'Ladebooster im Camper: Trennrelais oder 30 A?',
  description:
    'Ladebooster im Camper auslegen: Wann ein Trennrelais genügt, wann ein DC-DC-Lader nötig ist und welcher Kabelquerschnitt zu 30 A oder 50 A Ladestrom gehört.',
  h1: 'Ladebooster im Camper auslegen',
  lead: 'Der Ladebooster löst ein Problem, das ein Trennrelais offen lässt: Er lädt die Bordbatterie während der Fahrt mit geregeltem Strom und passender Kennlinie — auch dann, wenn die Lichtmaschine oder eine lange Leitung es sonst nicht zulassen. Diese Seite zeigt, wann welcher Ladestrom passt und welcher Querschnitt dazugehört.',
  priority: 'P2',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'relais-oder-booster',
      heading: 'Trennrelais oder Ladebooster: die Entscheidung',
      body: [
        'Ein Trennrelais verbindet Starter- und Bordbatterie direkt, sobald der Motor läuft. Damit ist der Ladestrom nicht geregelt: Er stellt sich aus dem Spannungsunterschied und dem Widerstand der Leitungen ein. Das funktioniert, solange die Bordbatterie eine Bleibatterie ist und die Leitung kurz — beide Batterien vertragen die entstehende Spannungslage.',
        'Ein Ladebooster setzt dazwischen ein eigenes Ladegerät: Er nimmt die Spannung der Lichtmaschine und gibt sie mit einer Ladekennlinie auf einem eingestellten Niveau an die Bordbatterie weiter. Das ist mehr als Bequemlichkeit — es ist bei LiFePO4 die Voraussetzung dafür, dass die Batterie überhaupt voll wird und die Lichtmaschine nicht überlastet.',
      ],
      list: {
        items: [
          'Bleibatterie (AGM/Gel), kurze Leitung, einfache Anlage: Das Relais kann genügen — der Ladestrom bleibt begrenzt und die Batterie nimmt die Spannung der Lichtmaschine an.',
          'LiFePO4-Bordbatterie: Ein Ladebooster ist der Regelfall. Ohne ihn begrenzt nur der Leitungswiderstand den Strom, und die Lichtmaschine arbeitet außerhalb ihres Auslegungspunkts.',
          'Moderne Lichtmaschinen mit Spannungsmanagement (Euro 6d und neuer) regeln die Ladespannung im Teillastbetrieb bewusst herunter — häufig so weit, dass eine Bordbatterie über eine lange Leitung nicht mehr voll wird. Der Booster hebt die Spannung auf das Niveau an, das die Batterie laut ihrer Kennlinie braucht.',
          'Lange Leitungen (Heckgarage statt Fahrersitz) oder zwei parallel geladene Batteriebanken: Der Booster macht den Ladestrom unabhängig vom Spannungsabfall der Leitung.',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Ein Booster ersetzt keine Sicherung und keinen Querschnitt: Er begrenzt seinen Ausgangsstrom, seine Zuleitung von der Starterbatterie führt aber weiterhin den vollen Eingangsstrom plus Verluste. Gerechnet wird die Zuleitung mit dem Eingangsstrom.',
      },
    },
    {
      id: 'ladestrom',
      heading: 'Wie viel Ladestrom: 30 A oder 50 A',
      body: [
        'Der Ladestrom bestimmt, wie viel Fahrzeit eine leere Bordbatterie braucht. Die Rechnung ist einfach: Kapazität geteilt durch Strom — 100 Ah mit 30 A sind gut drei Stunden, mit 50 A zwei. Dazu kommt die Konstantspannungsphase am Ende, in der der Strom von selbst sinkt und die letzten Prozent langsamer fließen; praktisch landen 100 Ah deshalb bei etwa vier Stunden mit dem 30-A-Booster und gut zweieinhalb mit dem 50-A-Gerät.',
        'Gegen den größeren Booster sprechen nicht die Kosten allein: Der Ladestrom muss zur Batterie passen (LiFePO4-Datenblätter nennen häufig 0,3 bis 0,5 C als Dauerstrom, also 30 bis 50 A bei 100 Ah), zur Lichtmaschine und zur Zuleitung.',
        'Die Faustregel, die aus beidem folgt: Der Booster darf den Ladestrom der Batterie ausschöpfen, aber nicht überfordern. Wer dauerhaft mit 50 A in eine 100-Ah-Batterie lädt, fährt am oberen Rand des Datenblattwerts — wer mit 30 A lädt, liegt sicher darunter und braucht eine Querschnittsstufe weniger. Die folgende Gegenüberstellung zeigt, was das für Fahrzeit und Leitung bedeutet.',
      ],
      table: {
        caption:
          'Ladeleistung, Fahrzeit und Zuleitungsquerschnitt im Vergleich (gerechnet mit dem Modell dieser Auslieferung)',
        head: [
          'Ladestrom',
          'Fahrzeit für 100 Ah ab leer',
          'Kabelquerschnitt ab 4 m',
          'Kabelquerschnitt ab 6 m',
        ],
        rows: [
          ['20 A', 'gut 5 Stunden', querschnitt(20, 4), querschnitt(20, 6)],
          ['30 A', 'etwa 4 Stunden', querschnitt(30, 4), querschnitt(30, 6)],
          ['50 A', 'etwa 2,5 Stunden', querschnitt(50, 4), querschnitt(50, 6)],
        ],
        note: 'Fahrzeiten ohne Konstantspannungsphase (die letzten 20 bis 30 % Füllstand fließen langsamer) und ohne Solar-Ertrag während der Fahrt. Die Querschnitte stammen aus der Bemessungstabelle unten — dieselbe Rechnung für dieselben Ströme.',
      },
    },
    {
      id: 'leitungen',
      heading: 'Kabelquerschnitt: was die Leitung leisten muss',
      body: [
        'Die Zuleitung zum Booster ist der anspruchsvollste Teil der Anlage: Sie führt den vollen Ladestrom über die größte Strecke im Fahrzeug und darf dabei nur wenige Prozent Spannung verlieren. Gerechnet wird mit zwei Grenzen — der Strombelastbarkeit der Leitung (DIN VDE 0298-4 mit einem Derating von ' +
          DERATING_DE +
          ' für Bündelung und Wärme im Motorraum) und dem Spannungsfall als Planungsgrenze (' +
          VOLTAGE_DROP_PCT_PLAN_LIMIT +
          ' % der Nennspannung). Maßgeblich ist das größere der beiden Ergebnisse.',
      ],
      // (Der Absatz zur Spalte „Bestimmt durch" steht unten in `subsections` —
      // nach der Tabelle, weil er sich auf ihre Spalten bezieht.)
      table: {
        caption:
          'Bemessung der Zuleitung bei 12 V, einfache Länge (Batterie → Booster), gerechnet mit dem Modell dieser Auslieferung',
        head: ['Ladestrom', 'Länge (einfach)', 'Querschnitt', 'Spannungsfall', 'Sicherung', 'Bestimmt durch'],
        rows: KABEL_ROWS,
        note: `Fortsetzung: Bei 30 A über 8 m fordert die Rechnung ${de(sizeCable(30, 8).crossSectionMm2)} mm², bei 50 A über 8 m ${de(sizeCable(50, 8).crossSectionMm2)} mm². Alle Werte sind Normgrößen der Reihe 1,5 bis 70 mm²; ist mehr nötig, meldet der Planer das statt zu runden.`,
      },
      subsections: [
        {
          heading: 'Welche Grenze den Querschnitt bestimmt',
          body: [
            'Die Spalte „Bestimmt durch" ist die eigentliche Lehre der Tabelle: Bei kurzen Leitungen und hohem Strom entscheidet die Strombelastbarkeit, ab einer gewissen Länge der Spannungsfall. Wer nur nach Tabellen für „30 A = soundsoviel mm²" verlegt, übersieht genau den Fall, in dem die Länge den Querschnitt diktiert — 30 A über 2 m brauchen 10,0 mm², über 6 m dagegen 25,0 mm².',
            'Dieselbe Überlegung erklärt, warum ein Booster an der Heckgarage teurer wird als einer hinter dem Fahrersitz: Es ist nicht das Gerät, es ist der Kupferquerschnitt.',
          ],
        },
      ],
      list: {
        items: [
          'Beide Adern rechnen: Der Spannungsfall entsteht über Hin- und Rückleitung. Das Modell verdoppelt die einfache Länge, deshalb steht sie so in der Tabelle.',
          'Die Masseleitung gehört zum Kreis: Sie muss denselben Querschnitt haben wie die Plusleitung — ein dünnerer Rückweg hebt den Querschnitt der Plusleitung auf.',
          'Übergangswiderstände (Klemmen, Kabelschuhe, Massepunkt am Chassis) zählen zum Spannungsfall. Ein sauberer, angezogener Massepunkt mit vollem Querschnitt ist Teil der Bemessung, nicht Zubehör.',
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
          href: '/rechner/spannungsabfall-12v/',
          label: 'Spannungsabfall einer Leitung nachrechnen',
        },
      ],
    },
    {
      id: 'absicherung',
      heading: 'Absicherung: am Batteriepol, nicht am Booster',
      body: [
        `Die Plusleitung von der Starter- oder Bordbatterie zum Booster ist eine Leitung an einer Quelle mit sehr hohem Kurzschlussstrom. Sie wird deshalb an ihrem Anfang abgesichert — so nah wie möglich an der Batterie, im Modell höchstens ${Math.round(FUSE_MAX_UNPROTECTED_LENGTH_M * 100)} cm entfernt. Der Booster selbst schützt diese Leitung nicht: Seine Eingangssicherung wäre im Fehlerfall stromabwärts der Fehlerstelle.`,
        `Die Sicherungsgröße folgt der Leitung, nicht dem Booster: Sie muss über dem Betriebsstrom des Boosters liegen und unter dem, was die Leitung dauerhaft führen kann. Die größte zulässige Sicherung je Querschnitt im Modell dieser Auslieferung: 16 mm² bis ${maxSicherung(16)}, 25 mm² bis ${maxSicherung(25)}, 35 mm² bis ${maxSicherung(35)}.`,
      ],
      table: {
        caption: 'Sicherungswahl: Leitungsgrenze und Boosterstrom zusammenbringen (Modellwerte)',
        head: ['Querschnitt', 'Größte zulässige Sicherung', 'Passender Ladestrom (Beispiel)'],
        rows: [
          ['10,0 mm²', maxSicherung(10), '30 A (kurze Leitung)'],
          ['16,0 mm²', maxSicherung(16), '30 A'],
          ['25,0 mm²', maxSicherung(25), '50 A'],
          ['35,0 mm²', maxSicherung(35), '50 A (lange Leitung)'],
        ],
        note: 'Modellwerte aus `lib/electrical.ts` (Belastbarkeit × Derating, auf die Normgrößen der Sicherungsreihe abgebildet). Das Abschaltvermögen der Sicherung muss zum Kurzschlussstrom der Batterie passen — bei LiFePO4 regelmäßig eine Bauform ab MIDI/MEGA, nicht die Flachsicherung.',
      },
      subsections: [
        {
          heading: 'Zwei Sicherungen pro Leitung',
          body: [
            'Die Sicherung an der Quelle schützt die Leitung, die Sicherung am Booster-Ausgang schützt die Leitung zur Bordbatterie — das ist kein Widerspruch, sondern dieselbe Regel zweimal angewendet: Jede Leitung wird an ihrem Anfang abgesichert.',
            'Die Ausgangsseite liegt spannungslos, wenn der Booster nicht arbeitet. Die Absicherung dort ist deshalb Teil des Anlagenschutzes (Leitungsschutz bei einem Fehler im Ladegerät), nicht des Personenschutzes.',
          ],
        },
      ],
    },
    {
      id: 'bauformen',
      heading: 'Bauformen und Anschlussbedingungen',
      definitions: [
        {
          term: 'Trennrelais (Relais zwischen den Batteriepluspolen)',
          description:
            'Verbindet die Batterien direkt, sobald die Steuerleitung (D+, Klemme 15 oder Spannungserkennung) das Relais schaltet. Kein geregelter Strom, keine Kennlinie, keine Verluste im Ladepfad außer den Kontakten und Leitungen.',
        },
        {
          term: 'Ladebooster mit einer Ladeleitung (DC-DC-Lader)',
          description:
            'Eingang von der Starter- oder Bordbatterie, geregelter Ausgang zur Zielbatterie. Eingangsstrom und Ausgangsstrom hängen über den Wirkungsgrad zusammen; bei 12 V auf 12 V liegt der Eingangsstrom über dem Ausgangsstrom. Beide Leitungen werden bemessen, nicht nur die Ausgangsseite.',
        },
        {
          term: 'Ladebooster mit Solar-Eingang',
          description:
            'Kombination aus DC-DC-Lader und MPPT-Regler in einem Gehäuse. Praktisch, weil ein Kabelweg entfällt; zu prüfen ist, ob beide Quellen gleichzeitig laden können und wie die Priorität geregelt ist.',
        },
        {
          term: 'Ladebooster mit umschaltbarer Kennlinie',
          description:
            'Ladeschlussspannung und Kennlinie sind einstellbar (Blei, Gel, LiFePO4, teilweise frei). Bei LiFePO4 gehört das zur Grundausstattung — die Batterie nimmt die Ladeschlussspannung sonst nicht vollständig an.',
        },
      ],
      list: {
        items: [
          'Steuerleitung: Viele Booster starten an der Spannung der Zündung oder an einem D+-Signal. Wird der Booster nur an der Eingangsspannung erkannt, kann er bei Solar-Einspeisung oder Ladegerät am Landstrom ungewollt anlaufen — die Steuerleitung ist deshalb Teil der Planung.',
          'Wärme: Booster arbeiten mit Leistungselektronik und brauchen Luft. Ein Einbauort ohne Luftbewegung — zugebaute Sitzbank, geschlossene Elektrobox — kostet Ladestrom über die Temperaturregelung.',
          'Rückstromsperre: Eine Diode oder ein Relais im Booster verhindert, dass die Bordbatterie über den Ladepfad entladen wird. Bei Trennrelais ohne Sperre entlädt sich die Bordbatterie über die Starterbatterie, wenn die Batterien unterschiedlich gealtert sind.',
          'Anordnung: Kurze Wege und getrennte Kabelführung (Plus und Minus nicht als loses Paar durch Blechkanten) sind billiger als der nächste Querschnitt.',
        ],
      },
    },
    {
      id: 'pruefung',
      heading: 'Was nach dem Einbau gemessen wird',
      body: [
        'Zwei Messungen entscheiden, ob die Anlage das tut, was die Rechnung verspricht — beide mit einem Multimeter und beide im Betrieb, nicht im Stand.',
      ],
      list: {
        ordered: true,
        items: [
          'Spannungsfall der Zuleitung: Spannung am Batteriepol und Spannung am Boostereingang im Moment des vollen Ladestroms messen. Die Differenz ist der Verlust der Leitung. Liegt sie deutlich über der Rechnung aus der Tabelle, sind Klemmen, Querschnitt oder Massepunkt die Ursache.',
          'Ladestrom und Ladespannung an der Bordbatterie: Der Booster regelt den Strom auf seinen eingestellten Wert. Erreicht die Ladespannung die Ladeschlussspannung der Batterie nicht, ist die Kennlinie falsch eingestellt — nicht die Lichtmaschine zu schwach.',
          'Übergangswiderstände prüfen: Nach einer Fahrt die Klemmen und Kabelschuhe auf Wärme prüfen (vorsichtig, nicht mit dem Finger). Eine warme Klemme ist ein Widerstand, und der frisst Ladestrom und Querschnitt.',
        ],
      },
      callout: {
        tone: 'warning',
        text: 'Arbeiten an der Fahrzeuganlage nur bei abgeklemmter Starterbatterie, und Arbeiten an 230-V-Anlagen ausschließlich durch eine Elektrofachkraft. Die 12-V-Seite dieser Seite ersetzt keine Fachplanung, sie macht die Rechenwege nachvollziehbar.',
      },
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler bei der Auslegung',
      list: {
        items: [
          'Querschnitt nach dem Booster-Ausgangsstrom wählen, obwohl die Eingangsleitung den höheren Strom führt.',
          'Nur die Plusleitung dick verlegen und den Masseweg über ein dünnes Chassisblech oder die Fahrzeugkarosserie mit unbekanntem Querschnitt führen.',
          'Die Sicherung erst am Booster setzen statt am Batteriepol — die längste, ungeschützte Strecke liegt dann direkt an der Batterie.',
          'Ein Trennrelais für eine LiFePO4-Batterie einbauen und sich wundern, dass die Batterie nie voll wird und die Lichtmaschine warm wird.',
          'Kennlinie und Ladeschlussspannung nicht auf die Chemie einstellen — die Batterie bleibt bei 80 % hängen.',
          'Booster ohne Steuerleitung betreiben und ihn bei jeder Solar-Ladung anlaufen lassen; die Bordbatterie entlädt sich dann über die Starterbatterie, wenn die Anlage steht.',
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Brauche ich einen Ladebooster oder reicht ein Trennrelais?',
      answer:
        'Das hängt an der Bordbatterie und der Lichtmaschine. Bei Bleibatterie, kurzer Leitung und einfacher Anlage kann ein Relais genügen. Sobald LiFePO4 im Spiel ist, die Lichtmaschine spannungsgeregelt arbeitet (Euro 6d und neuer) oder die Leitung lang ist, übernimmt der Booster: Er lädt mit geregelter Kennlinie und begrenztem Strom, statt den Ladestrom dem Spannungsunterschied zu überlassen.',
    },
    {
      question: 'Welcher Kabelquerschnitt gehört zu einem Ladebooster?',
      answer: FAQ_KABELQUERSCHNITT,
    },
    {
      question: 'Reicht ein 30-A-Booster für eine 100-Ah-LiFePO4-Batterie?',
      answer:
        'Für eine leere 100-Ah-Batterie braucht ein 30-A-Booster rechnerisch gut drei Stunden Ladestrom — in der Praxis etwa vier, weil die Konstantspannungsphase am Ende langsamer füllt; mit 50 A sind es rechnerisch zwei, praktisch gut zweieinhalb Stunden. 30 A liegt im sicheren Bereich üblicher Datenblattangaben (0,3 C), 50 A am oberen Rand (0,5 C). Wer nur kurze Strecken fährt, gewinnt mit Solar und einem kleineren Booster mehr als mit dem größten Gerät.',
    },
    {
      question: 'Wird die Lichtmaschine durch einen Ladebooster stärker belastet?',
      answer:
        'Die Leistung, die in die Bordbatterie fließt, muss die Lichtmaschine liefern — plus Verluste, die als Wärme im Booster bleiben. Die Belastung wird aber berechenbar und begrenzt: Ohne Booster zieht eine leere LiFePO4-Batterie je nach Spannungsabfall einen Strom, den die Lichtmaschine nicht regelt; mit Booster steht der Ladestrom fest und die Lichtmaschine liefert nur die zugehörige Eingangsleistung. Ein Blick auf die Leistungsdaten der Lichtmaschine (üblich 120 bis 180 A bei modernen Fahrzeugen) gehört trotzdem zum Vorhaben.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
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
    {
      href: '/camper-elektrik/sicherungen/',
      label: 'Sicherungen im Camper',
      description: 'Schutzorgan am Pol, Sicherungsgröße nach Leitung.',
    },
    { href: '/camper-elektrik/batterie/', label: 'Batteriekapazität bestimmen' },
    {
      href: '/planer/',
      label: 'kostenlosen Camper-Schaltplan erstellen',
      description: 'Booster, Batterie und Leitungen im Zusammenhang zeichnen.',
    },
  ],
  sources: [
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
      label: 'ISO 10133 § 8.1',
      detail: 'Schutzorgan unmittelbar am Quellpunkt — im Modell 0,2 m ab dem Batteriepol.',
    },
    {
      label: 'DIN VDE 0100-721',
      detail:
        'Kleinspannungsanlagen in Caravans und Motorcaravans: Bezugsrahmen für Absicherung und Leitungsschutz in dieser Auslieferung.',
    },
  ],
  assumptions: [
    'Gerechnet wird mit 12 V und dem Nennstrom des Boosters (30 A bzw. 50 A) als Dauerstrom.',
    'Länge ist die einfache Strecke zwischen den Polen; das Modell verdoppelt sie für Hin- und Rückleitung.',
    'Derating 0,7 und Planungsgrenze 3 % Spannungsfall sind Modellannahmen, keine Herstellerangaben.',
  ],
  limits: [
    'Keine Produktnennung und kein Markenvergleich — die Seite beschreibt Bauformen und Rechenwege, keine Geräte.',
    'Wirkungsgrad, Temperaturregelung und Kennlinien konkreter Geräte sind Datenblattangaben und nicht im Modell.',
    'Fahrzeugspezifische Anschlüsse (D+-Signal, Klemmenbelegung, Absicherung ab Werk) stehen hier nicht.',
  ],
};
