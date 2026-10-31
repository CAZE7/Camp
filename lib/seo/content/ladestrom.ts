/**
 * lib/seo/content/ladestrom.ts — Rechner-Seite `/rechner/ladestrom/`.
 *
 * Der Rechner ist Hauptinhalt; der Text erklärt Eingaben, Ergebnis, Formel,
 * Annahmen und Grenzen, statt die Seite künstlich zu füllen (§8). Dieselbe
 * Logik ist in `/camper-elektrik/ladebooster/` eingebettet — eine Rechnung,
 * zwei Einstiege (Rule D: `lib/boosterSizing.ts`).
 */

import {
  BOOSTER_C_FENSTER,
  BOOSTER_FAHRZEUGLAST_A,
  BOOSTER_GRENZEN,
  BOOSTER_LADEZEIT_ZUSCHLAG,
  BOOSTER_WIRKUNGSGRAD,
} from '@/lib/boosterSizing';

import type { SeoPageContent } from '../types';

const prozent = (anteil: number) => `${Math.round(anteil * 100)} %`;

export const LADESTROM_CONTENT: SeoPageContent = {
  path: '/rechner/ladestrom/',
  slug: 'ladestrom',
  topicId: 'ladebooster',
  kind: 'rechner',
  title: 'Ladestrom berechnen: welcher Ladebooster passt',
  absoluteTitle: true,
  description:
    'Ladestrom berechnen: Batteriekapazität, Fahrzeit und Lichtmaschine ergeben Stromklasse, C-Rate und die Belastung der Lichtmaschine — als Faustregel.',
  h1: 'Ladestrom berechnen',
  lead: 'Dieser Rechner beantwortet, welche Stromklasse ein Ladebooster haben muss: aus der Nennkapazität der Aufbaubatterie, den Stunden am Stück mit laufendem Motor und dem Nennstrom der Lichtmaschine. Er nennt den Bedarf in Ampere, die C-Rate und ob die Lichtmaschine das trägt.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.9,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'rechner',
      heading: 'Kapazität, Fahrzeit und Lichtmaschine eingeben',
      body: [
        `Drei Zahlen genügen. Aus ihnen folgen der Bedarfsstrom in Ampere, die C-Rate (der Strom als Vielfaches der Nennkapazität — 0,24 C bedeutet ein Viertel der Kapazität pro Stunde) und die Belastung der Lichtmaschine. Erlaubt sind ${BOOSTER_GRENZEN.kapazitaetAh.min} bis ${BOOSTER_GRENZEN.kapazitaetAh.max} Ah, ${BOOSTER_GRENZEN.fahrzeitH.min} bis ${BOOSTER_GRENZEN.fahrzeitH.max} Stunden und ${BOOSTER_GRENZEN.lichtmaschineA.min} bis ${BOOSTER_GRENZEN.lichtmaschineA.max} A — außerhalb nennt der Rechner den Bereich statt eine Zahl auszugeben.`,
      ],
      calculator: 'ladestrom',
    },
    {
      id: 'stromklasse',
      heading: 'Was die Stromklasse aussagt',
      body: [
        'Die Klasse ist eine Bedarfsklasse, keine Geräteempfehlung: Sie sagt, welchen Strom der Booster abgeben müsste, damit die Batterie nach der angegebenen Fahrzeit wieder voll ist. Ein Gerät darunter lädt ebenfalls — nur länger.',
      ],
      definitions: [
        {
          term: 'Bedarf in der Fahrzeit',
          description:
            'Strom, der nötig wäre, um die Nennkapazität in der eingegebenen Zeit nachzuladen, zuzüglich des Zuschlags für die Konstantspannungsphase.',
        },
        {
          term: 'C-Rate',
          description: `Bedarfsstrom geteilt durch die Nennkapazität. Das Ladefenster der Chemie begrenzt sie: LiFePO4 ${BOOSTER_C_FENSTER.LiFePO4.minC} bis ${BOOSTER_C_FENSTER.LiFePO4.maxC} C, Blei ${BOOSTER_C_FENSTER.Blei.minC} bis ${BOOSTER_C_FENSTER.Blei.maxC} C.`,
        },
        {
          term: 'Gerät muss liefern',
          description:
            'Der Bedarf, auf das Ladefenster begrenzt. Diese Zahl bestimmt die Belastung der Lichtmaschine — nicht der rechnerische Bedarf, denn mehr Strom nimmt die Batterie nicht an.',
        },
      ],
      callout: {
        tone: 'info',
        text: 'Die C-Rate sagt nichts über die Entladung: Sie beschreibt hier das Laden. Für die entnehmbare Kapazität bei hoher Last siehe [Batteriekapazität berechnen](/rechner/batteriekapazitaet/) — dort wirkt der Peukert-Effekt.',
      },
    },
    {
      id: 'lichtmaschine',
      heading: 'Die Lichtmaschine ist die eigentliche Grenze',
      body: [
        `Ein Booster zieht seinen Eingangsstrom aus der Lichtmaschine, und die versorgt gleichzeitig Zündung, Licht, Lüftung und Steuergeräte. Der Rechner setzt dafür ${BOOSTER_FAHRZEUGLAST_A} A Fahrzeuglast an und rechnet mit ${prozent(BOOSTER_WIRKUNGSGRAD)} Wirkungsgrad. Über 80 % Auslastung wird es knapp, über 100 % ist die Lichtmaschine rechnerisch überlastet.`,
        'Zwei Dinge verkürzen den Spielraum zusätzlich: Im Leerlauf liefert eine Lichtmaschine deutlich weniger als ihr Nennstrom, und moderne Steuergeräte regeln die Ladung bei voller Batterie oder hoher Motorauslastung ab. Der Nennstrom aus dem Datenblatt ist deshalb eine Obergrenze, kein Versprechen.',
      ],
    },
    {
      id: 'rechnung',
      heading: 'Der Rechenweg',
      formula: {
        expression:
          'I_Bedarf = (C_nenn / t_Fahrt) · 1,2  →  I_Gerät = I_Bedarf, begrenzt auf das Ladefenster  →  I_LiMa = I_Gerät / 0,9 + 20 A',
        caption:
          'Der Zuschlag von 20 % deckt die Konstantspannungsphase, in der der Strom sinkt. Die Begrenzung auf das Ladefenster verhindert, dass eine kurze Fahrzeit einen Strom fordert, den die Batterie nicht annimmt.',
      },
      callout: {
        tone: 'info',
        text: 'Faustregel, keine Messung: Wirkungsgrad, Fahrzeuglast und Zuschlag sind Modellannahmen. Maßgeblich sind Datenblatt, BMS und die tatsächliche Verkabelung — Kabel und Sicherung gehören zur Auslegung, siehe [Ladebooster im Vergleich](/camper-elektrik/ladebooster/).',
      },
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Die Fahrzeit überschätzen: Gerechnet wird mit Stunden am Stück bei laufendem Motor, nicht mit dem Reisetag.',
          'Mit der nutzbaren statt der Nennkapazität rechnen — der Booster richtet sich nach der Nennkapazität.',
          'Den Nennstrom der Lichtmaschine mit dem verfügbaren Strom verwechseln.',
          'Die Stromklasse wählen und danach den Kabelquerschnitt vergessen: Der Querschnitt folgt aus dem Strom des Geräts, nicht aus dem Bedarf.',
          'Bei Blei dasselbe Ladefenster wie bei LiFePO4 annehmen.',
        ],
      },
      links: [
        { href: '/camper-elektrik/ladebooster/', label: 'Ladebooster im Vergleich: 30, 60 oder 90 A?' },
        { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt für die Booster-Leitung' },
        { href: '/camper-elektrik/sicherungen/', label: 'Sicherung am Batteriepol' },
      ],
    },
  ],
  faq: [
    {
      question: 'Welcher Ladestrom passt zu einer 100-Ah-Batterie?',
      answer:
        'Bei LiFePO4 liegt das Ladefenster zwischen 30 und 50 A, bei Blei zwischen 20 und 30 A. Soll die Batterie in fünf Fahrstunden voll werden, sind rechnerisch 24 A nötig — das Gerät wird dann auf den unteren Fensterrand gezogen.',
    },
    {
      question: 'Kann ein Ladebooster die Lichtmaschine überlasten?',
      answer:
        'Rechnerisch ja, wenn der Eingangsstrom den Nennstrom erreicht. Gute Geräte regeln den Strom selbst herunter, sobald die Lichtmaschine warm wird oder die Bordspannung fällt — der Rechner nennt die Auslastung, die Regelung steht im Datenblatt.',
    },
    {
      question: 'Was bedeutet 0,24 C?',
      answer:
        'Die C-Rate ist der Strom als Vielfaches der Nennkapazität. 0,24 C bei 100 Ah sind 24 A. Sie entsteht hier aus dem Zuschlag für die Konstantspannungsphase geteilt durch die Fahrzeit — deshalb ist sie bei gleicher Fahrzeit unabhängig von der Kapazität.',
    },
  ],
  related: [
    { href: '/camper-elektrik/ladebooster/', label: 'Ladebooster im Vergleich' },
    { href: '/camper-elektrik/laden/', label: 'Bordbatterie laden: Wege im Vergleich' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
    { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
    { href: '/rechner/', label: 'Alle Rechner im Überblick' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Ladefenster',
      detail: `LiFePO4 ${BOOSTER_C_FENSTER.LiFePO4.minC}–${BOOSTER_C_FENSTER.LiFePO4.maxC} C, Blei ${BOOSTER_C_FENSTER.Blei.minC}–${BOOSTER_C_FENSTER.Blei.maxC} C — \`BOOSTER_C_FENSTER\` in \`lib/boosterSizing.ts\`, dort als Faustwert gekennzeichnet.`,
    },
    {
      label: 'Wirkungsgrad und Fahrzeuglast',
      detail: `${prozent(BOOSTER_WIRKUNGSGRAD)} Wirkungsgrad (\`BOOSTER_WIRKUNGSGRAD\`) und ${BOOSTER_FAHRZEUGLAST_A} A Fahrzeuglast (\`BOOSTER_FAHRZEUGLAST_A\`) — Modellannahmen, keine Messwerte.`,
    },
    {
      label: 'Ladezeit-Zuschlag',
      detail: `Faktor ${BOOSTER_LADEZEIT_ZUSCHLAG} (\`BOOSTER_LADEZEIT_ZUSCHLAG\`) für die Konstantspannungsphase.`,
    },
  ],
  assumptions: [
    'Die Batterie ist zu Beginn der Fahrzeit leer genug, um den vollen Strom anzunehmen.',
    'Die Lichtmaschine liefert ihren Nennstrom — Leerlaufdrehzahl, Temperatur und Abregelung sind nicht modelliert.',
    'Der Booster begrenzt den Strom selbst auf das Ladefenster der Chemie.',
    'Das Ladefenster ist eine Modellannahme: 0,3 bis 0,5 C für LiFePO4, 0,2 bis 0,3 C für Blei. Datenblätter für AGM und Gel nennen oft 0,1 bis 0,2 C Dauerstrom — das Datenblatt der konkreten Batterie geht vor.',
  ],
  limits: [
    'Keine Aussage über Kabelquerschnitt und Sicherung — dafür steht der Kabelquerschnitt-Rechner.',
    'Ladung aus Solar, Landstrom oder einem Trennrelais ist nicht Teil dieser Rechnung.',
    'Gerätespezifische Kennlinien (Dreibatterie-Fenster, Temperaturfühler, Motorlauf-Erkennung) sind nicht abgebildet.',
  ],
};
