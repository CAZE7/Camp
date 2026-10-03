/**
 * lib/seo/content/wechselrichter.ts — Cluster-Seite
 * `/camper-elektrik/wechselrichter/`.
 *
 * Der Eingangsstrom wird mit der Entladeschlussspannung des Modells gerechnet
 * (`dischargeFloorVoltage`, Faktor 0,9375), der Wirkungsgrad mit
 * `VDE_INVERTER_EFFICIENCY` (0,85). Der Kabelquerschnitt kommt aus
 * `sizeCable` — dieselbe Funktion wie im Planer.
 */

import { sizeCable } from '@/lib/cableSizing';
import {
  AC_MODEL_VOLTAGE_V,
  MCB_INSTANT_TRIP_MAX_MULTIPLE,
  UPSTREAM_IMPEDANCE_ASSUMPTION_OHM,
} from '@/lib/acProtection';
import { VDE_INVERTER_EFFICIENCY, dischargeFloorVoltage, DEFAULT_SYSTEM_VOLTAGE } from '@/lib/vde-standards';

import type { SeoPageContent } from '../types';

const FLOOR_V = dischargeFloorVoltage(DEFAULT_SYSTEM_VOLTAGE);

/** Eingangsstrom für eine Wechselrichterleistung am 12-V-Bordnetz. */
const inputCurrent = (outputWatts: number): number => outputWatts / VDE_INVERTER_EFFICIENCY / FLOOR_V;

const SIZING_ROWS = [500, 1000, 2000, 3000].map((watts) => {
  const current = inputCurrent(watts);
  const sizing = sizeCable(current, 1.5);
  return [
    `${watts} W`,
    `${current.toFixed(0)} A`,
    `${sizing.crossSectionMm2.toFixed(1).replace('.', ',')} mm²`,
    sizing.maxFuseA === null ? '—' : `${sizing.fuseA ?? '—'} A`,
    `${sizing.voltageDropPercent.toFixed(2).replace('.', ',')} %`,
  ];
});

export const WECHSELRICHTER_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/wechselrichter/',
  slug: 'wechselrichter',
  topicId: 'wechselrichter',
  kind: 'cluster',
  title: 'Wechselrichter im Camper auslegen: Strom, Kabel, Sicherung',
  absoluteTitle: true,
  description:
    'Wechselrichter im Camper dimensionieren: Eingangsstrom aus Leistung und Wirkungsgrad, Kabelquerschnitt, Absicherung und Leerlaufverbrauch.',
  h1: 'Wechselrichter im Camper auslegen',
  lead: 'Ein Wechselrichter zieht bei 12 V Ströme, die jede andere Last im Fahrzeug in den Schatten stellen. Wer die Zuleitung nach Gefühl wählt, verliert Leistung in der Leitung — oder schmilzt sie.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'strom',
      heading: 'Der Eingangsstrom ist die entscheidende Zahl',
      formula: {
        expression: 'I_ein = P_aus / (η · U_min)',
        caption: `η = ${VDE_INVERTER_EFFICIENCY} (Modellwert für den Wirkungsgrad), U_min = ${FLOOR_V.toFixed(1).replace('.', ',')} V (Entladeschlussspannung des Modells bei 12,8 V Nennspannung).`,
      },
      body: [
        `Ein 1 000-W-Wechselrichter zieht am 12-V-Bordnetz rund ${inputCurrent(1000).toFixed(0)} A — nicht 83 A, wie die Rechnung mit 12,8 V und ohne Verluste ergäbe. Die konservative Rechnung ist Absicht: Am Entladeende ist die Batteriespannung niedriger, und bei gleicher Leistung fließt dann mehr Strom.`,
        'Der Strom steigt überproportional mit der Leistung, weil die Verluste im Wechselrichter mit ihr wachsen. Genau deshalb gehört der Eingangsstrom in die Kabelbemessung — nicht die Ausgangsleistung.',
      ],
      callout: {
        tone: 'info',
        text: 'Für Dauerlast gilt der Nennstrom; Anlaufströme von Motoren und Kompressoren liegen darüber. Das Modell rechnet mit dem stationären Strom und weist auf den Anlauf hin, statt ihn zu schätzen.',
      },
    },
    {
      id: 'kabel',
      heading: 'Zuleitung: kurz halten und dick wählen',
      table: {
        caption: 'Modellrechnung: Zuleitung über 1,5 m einfache Länge bei 12 V Nennspannung',
        head: ['Wechselrichter', 'Eingangsstrom', 'Gewählter Querschnitt', 'Sicherung', 'Spannungsfall'],
        rows: SIZING_ROWS,
        note: 'Der Querschnitt folgt dem Spannungsfall, die Sicherung der Leitungsgrenze — bei großen Leistungen ist die Zuleitung damit ein eigenes Bauteil und keine Beigabe.',
      },
      body: [
        'Die Tabelle macht sichtbar, warum die Zuleitung so kurz wie möglich sein sollte: Bei 2 000 W entscheidet der Meter über die nächste Normgröße. Ein Wechselrichter, der 1 m neben der Batterie sitzt, braucht deutlich weniger Kupfer als einer am Heck.',
        'Auch die 230-V-Seite sollte nicht ignoriert werden: Ein langes, dünnes Ausgangskabel verschiebt die Verluste nur — aber die bleiben Verluste.',
      ],
    },
    {
      id: 'sicherung',
      heading: 'Absicherung und Anschluss',
      list: {
        items: [
          'Die Zuleitung wird am Batteriepol abgesichert — nicht am Wechselrichter. Der Kurzschlussstrom der Batterie ist an der Quelle am größten.',
          'Die Sicherung schützt die Leitung: Sie muss über dem Dauerstrom liegen und unter der Design-Belastbarkeit des Kabels.',
          'Bei Lithium-Bänken muss die Sicherung das hohe Abschaltvermögen können; eine Flachsicherung reicht dort meist nicht.',
          'Klemmen und Kabelschuhe sind Teil der Leitung: Eine schlecht gepresste Verbindung wird warm und kostet Spannung.',
          'Viele Wechselrichter erwarten einen eigenen Schutzleiter und einen definierten Potentialbezug — die Anleitung des Geräts gilt.',
        ],
      },
      links: [
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherung nach Leitung und Abschaltvermögen wählen',
          description: 'Die Kette I_B ≤ I_n ≤ I_z und typische Bauformen.',
        },
      ],
    },
    {
      id: 'verbrauch',
      heading: 'Was der Wechselrichter im Leerlauf kostet',
      body: [
        'Ein Wechselrichter arbeitet nicht umsonst: Sein eigener Leerlaufverbrauch (typisch zweistellige Wattzahlen, im Bereitschaftsmodus weniger) fließt rund um die Uhr aus der Batterie, wenn er eingeschaltet bleibt. Über 24 Stunden summiert sich das zu einem erheblichen Teil des Tagesbedarfs.',
        'Praktisch heißt das: Wechselrichter bei Nichtbenutzung hart ausschalten (Fernbedienung oder Schalter) und die Geräteauswahl prüfen — eine 230-V-Kaffeemaschine zieht über den Umweg Wechselrichter etwa 98 A aus der Batterie, während ein 12-V-Kocher dieselbe Energie direkt zieht.',
      ],
      links: [
        { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
        { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
      ],
    },
    {
      id: 'ac-seite',
      heading: 'Die 230-V-Seite: eigener Schutz, eigene Regeln',
      body: [
        `Ein Wechselrichterausgang ist ein eigenes Stromversorgungssystem mit ${AC_MODEL_VOLTAGE_V} V, das nicht über die Außenwelt geerdet ist. Das Modell der 230-V-Seite führt dabei drei Größen: Schutzleiterquerschnitt nach IEC 60364-5-54, Leitungsschutzschalter mit Charakteristik B oder C (Schnellauslösung bei ${MCB_INSTANT_TRIP_MAX_MULTIPLE.B}× bis ${MCB_INSTANT_TRIP_MAX_MULTIPLE.C}× Nennstrom) und die Abschaltbedingung nach IEC 60364-4-41.`,
        'Wechselrichter-Ausgänge sind elektronisch strombegrenzt — sie verhalten sich nicht wie das öffentliche Netz. Was das für Schutzmaßnahmen bedeutet, steht in der Anleitung des Geräts und ist keine Rechenaufgabe dieser Seite.',
      ],
      links: [{ href: '/camper-elektrik/230v/', label: '230-V-Anlage im Camper verstehen' }],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Zuleitung nach der Ausgangsleistung bemessen statt nach dem Eingangsstrom.',
          'Wirkungsgrad vernachlässigen — 15 % Mehrstrom sind bei 2 000 W immerhin 25 A.',
          'Sicherung am Wechselrichter statt am Batteriepol.',
          'Leerlaufverbrauch nicht einplanen und sich über die leere Batterie am dritten Standtag wundern.',
          'Wechselrichter ohne Blick auf die Kurzschlussleistung der Batteriebank betreiben.',
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Wie viel Strom zieht ein 2000-W-Wechselrichter aus der 12-V-Batterie?',
      answer: `Rechnerisch rund ${inputCurrent(2000).toFixed(0)} A: 2 000 W Ausgangsleistung bei einem Wirkungsgrad von ${VDE_INVERTER_EFFICIENCY} und der Entladeschlussspannung von ${FLOOR_V.toFixed(1).replace('.', ',')} V. Die Zuleitung über 1,5 m fordert dafür im Modell ${sizeCable(inputCurrent(2000), 1.5).crossSectionMm2.toFixed(0)} mm² — die Sicherung schützt den Leiter, nicht das Gerät.`,
    },
    {
      question: 'Reicht ein 1000-W-Wechselrichter für eine Kaffeemaschine?',
      answer:
        'Für den Dauerbetrieb ja, wenn die Maschine dauerhaft unter 1 000 W bleibt. Viele Kaffeemaschinen ziehen aber kurzzeitig mehr und takten (Heizstab mit Thermostat): Die Spitzenlast übersteigt dann die Nennleistung. Bei 1 000 W Ausgangsleistung fließen rund 98 A aus der Batterie — das ist der Strom, den Kabel und Sicherung tragen müssen.',
    },
    {
      question: 'Wechselrichter mit reinem Sinus oder modifiziertem Sinus?',
      answer:
        'Geräte mit Motor oder Elektronik (Kühlschrank-Kompressor, Ladegeräte, Pumpen) verlangen in der Regel einen reinen Sinus. Modifizierte Sinusform ist günstiger, kann aber zur Erwärmung oder Fehlfunktion führen. Diese Entscheidung ist eine Frage des Verbrauchers, nicht der Rechnung.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/230v/', label: '230-V-Anlage im Camper' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
    { href: '/elektrik-planung/#planer', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modellwerte des Wechselrichters',
      detail: `Wirkungsgrad ${VDE_INVERTER_EFFICIENCY} und Entladeschlussspannung (Faktor 0,9375) in \`lib/vde-standards.ts\`; die 230-V-Seite in \`lib/acProtection.ts\` (dort mit Normbezug).`,
    },
    {
      label: 'IEC 60364-5-54 / 4-41, IEC 60898-1',
      detail:
        'Schutzleiterquerschnitt, magnetische Auslösebereiche B/C und Abschaltbedingung — der Modellkern der 230-V-Prüfungen.',
    },
  ],
  assumptions: [
    'Der Wirkungsgrad 0,85 ist ein Modellwert; Geräte mit besserem Wirkungsgrad brauchen weniger Eingangsstrom.',
    `Die Entladeschlussspannung liegt bei ${FLOOR_V.toFixed(1).replace('.', ',')} V — die Rechnung fällt damit konservativ aus.`,
  ],
  limits: [
    'Anlaufströme und Einschaltspitzen sind nicht modelliert; sie liegen über dem Dauerstrom.',
    'Blindleistung, Einschaltstrombegrenzer und Netzbildung (Inselbetrieb) sind keine Größen dieser Seite.',
    'Die vorgelagerte Netzimpedanz ist im AC-Modell eine deklarierte Annahme (' +
      `${UPSTREAM_IMPEDANCE_ASSUMPTION_OHM} Ω` +
      ') und keine Messung vor Ort.',
  ],
};
