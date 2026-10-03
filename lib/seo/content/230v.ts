/**
 * lib/seo/content/230v.ts — Cluster-Seite `/camper-elektrik/230v/`.
 *
 * Diese Seite beschreibt die 230-V-Seite so, wie das Modell sie kennt:
 * Mehrleitermodell (L/N/PE), Schutzleiter nach IEC 60364-5-54, LS-Schalter mit
 * Charakteristik B/C, Abschaltbedingung nach IEC 60364-4-41 — und ausdrücklich
 * das, was nur eine Fachkraft beurteilen darf.
 */

import {
  AC_MODEL_VOLTAGE_V,
  MCB_BREAKING_CAPACITY_KA_OPTIONS,
  MCB_INSTANT_TRIP_MAX_MULTIPLE,
  UPSTREAM_IMPEDANCE_ASSUMPTION_OHM,
  acCableComposition,
  guaranteedTripCurrentA,
  maxLoopImpedanceOhm,
  protectiveEarthCrossSectionMm2,
} from '@/lib/acProtection';

import type { SeoPageContent } from '../types';

const PE_ROWS = [1.5, 2.5, 4, 6, 10, 16, 25, 35].map((phase) => [
  `${phase.toFixed(1).replace('.', ',')} mm²`,
  `${protectiveEarthCrossSectionMm2(phase).toFixed(1).replace('.', ',')} mm²`,
  acCableComposition(phase).label,
]);

const TRIP_ROWS = ([16, 10] as const).flatMap((rated) =>
  (['B', 'C'] as const).map((characteristic) => [
    `${rated} A, Charakteristik ${characteristic}`,
    `${guaranteedTripCurrentA(rated, characteristic)} A`,
    `${maxLoopImpedanceOhm(rated, characteristic).toFixed(2).replace('.', ',')} Ω`,
  ])
);

export const AC_230V_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/230v/',
  slug: '230v',
  topicId: '230v',
  kind: 'cluster',
  title: '230 V im Camper: Landstrom, FI-Schutz und Absicherung',
  absoluteTitle: true,
  description:
    '230-V-Anlage im Camper: CEE-Einspeisung, FI-Schutz mit 30 mA, Leitungsschutzschalter, Schutzleiterquerschnitt und die Pflicht zur Abnahme.',
  h1: '230-V-Anlage im Camper',
  lead: 'Die 230-V-Seite ist der Teil der Camper-Elektrik, der nicht in Eigenregie fertig wird: Sie braucht eine Elektrofachkraft für Aufbau und Abnahme. Diese Seite erklärt, was dabei geprüft wird — damit man den Plan versteht und die richtigen Fragen stellt.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'einspeisung',
      heading: 'Einspeisung: wie der Landstrom ins Fahrzeug kommt',
      body: [
        'Der Landstromanschluss ist eine Außenstelle des Fahrzeugs und muss wasserdicht, zugentlastet und mechanisch geschützt ausgeführt sein. Üblich ist eine CEE-Einspeisung (blau, 16 A) mit Klappe, von dort geht es zur Verteilung. Ein Adapter von Schuko auf CEE ist für den Dauerbetrieb keine Lösung.',
        'Zwei Dinge gehören in die Planung: eine Trennstelle, mit der sich das Fahrzeug vollständig vom Landstrom lösen lässt, und eine eindeutige Zuordnung von Außenleiter (L), Neutralleiter (N) und Schutzleiter (PE). Das Modell führt die 230-V-Leitung deshalb als 3-adrige Leitung und nicht als Einzelader.',
      ],
    },
    {
      id: 'schutzleiter',
      heading: 'Schutzleiter: eigener Querschnitt nach Tabelle',
      body: [
        'Der Schutzleiter ist kein Anhängsel des Außenleiters. Sein Mindestquerschnitt folgt aus dem Außenleiterquerschnitt (IEC 60364-5-54, Tabelle 54.2): bis 16 mm² gleich dem Außenleiter, zwischen 16 und 35 mm² mindestens 16 mm², darüber die Hälfte.',
      ],
      table: {
        caption: 'Schutzleiter-Mindestquerschnitt und Leitungsbezeichnung (Modell)',
        head: ['Außenleiter', 'Schutzleiter', 'Leitungsbezeichnung'],
        rows: PE_ROWS,
        note: 'Das Modell prüft diese Zuordnung an jeder AC-Kante — eine 3-adrige Leitung mit zu dünnem Schutzleiter ist kein zulässiger Zustand.',
      },
    },
    {
      id: 'fi',
      heading: 'FI-Schutz: 30 mA, und zwar vor allem anderen',
      body: [
        'Ein Fehlerstrom-Schutzschalter (RCD, FI) mit 30 mA Auslösestrom ist die Schutzmaßnahme, die im Fahrzeug den Fehlerschutz sicherstellt — auch dann, wenn die magnetische Abschaltbedingung eines Leitungsschutzschalters nicht erreicht wird. Der FI sitzt hinter der Einspeisung und schützt alle nachfolgenden Kreise.',
        'Wichtig für die Praxis: Ein FI im Fahrzeug ersetzt nicht den FI der Campingplatzsäule, und ein FI ohne angeschlossenen Schutzleiter schützt niemanden. Beides sind häufige Fehler in Bestandsanlagen.',
      ],
      callout: {
        tone: 'warning',
        text: 'Fehlerschutz ist keine Rechnung, die man selbst abschließt. Aufbau und Abnahme der 230-V-Anlage gehören in die Hände einer Elektrofachkraft — Camp liefert den Plan, nicht die Abnahme.',
      },
    },
    {
      id: 'absicherung',
      heading: 'Absicherung: Charakteristik und Abschaltbedingung',
      body: [
        `Das Modell prüft die automatische Abschaltung der Stromversorgung nach IEC 60364-4-41 § 411.3.2: Der Schleifenwiderstand muss so klein sein, dass der Schutzschalter im Fehlerfall innerhalb der geforderten Zeit auslöst. Maßgeblich ist der garantierte Auslösestrom — die obere Grenze des magnetischen Schnellauslösebereichs: bei Charakteristik B das ${MCB_INSTANT_TRIP_MAX_MULTIPLE.B}-Fache, bei C das ${MCB_INSTANT_TRIP_MAX_MULTIPLE.C}-Fache des Nennstroms.`,
        `Dazu kommt die 2/3-Regel aus DIN VDE 0100-600: Der gemessene Schleifenwiderstand darf höchstens zwei Drittel des rechnerischen Grenzwerts betragen — das deckt Messunsicherheit und Leitererwärmung im Fehlerfall ab. Die vorgelagerte Netzimpedanz ist im Modell als Annahme hinterlegt (${UPSTREAM_IMPEDANCE_ASSUMPTION_OHM} Ω für eine CEE-16-A-Einspeisung); ein Messwert vor Ort schlägt diese Annahme.`,
      ],
      table: {
        caption: `Zulässiger Schleifenwiderstand nach der 2/3-Regel bei ${AC_MODEL_VOLTAGE_V} V`,
        head: ['Schutzorgan', 'Garantierter Auslösestrom', 'Zulässiges Zs'],
        rows: TRIP_ROWS,
        note: 'Je größer der Nennstrom, desto kleiner der zulässige Schleifenwiderstand — deshalb ist eine lange, dünne Landstromleitung ein Sicherheitsthema und nicht nur ein Spannungsproblem.',
      },
      subsections: [
        {
          heading: 'Bemessungs-Abschaltvermögen',
          body: [
            `Leitungsschutzschalter werden im Modell mit einem Bemessungs-Abschaltvermögen von ${MCB_BREAKING_CAPACITY_KA_OPTIONS.join(' oder ')} kA geführt (IEC 60898-1).`,
          ],
        },
      ],
    },
    {
      id: 'wechselrichter',
      heading: 'Wechselrichter ist nicht Landstrom',
      body: [
        'Ein Wechselrichterausgang ist elektronisch strombegrenzt und verhält sich nicht wie das öffentliche Netz. Die Schleifenimpedanz-Prüfung, die am Landstromanschluss gilt, lässt sich darauf nicht übertragen — hier gilt die Anleitung des Geräts. Wer beides kombiniert (Umschaltung Landstrom/Wechselrichter), braucht eine saubere Trennung der Quellen.',
      ],
      links: [{ href: '/camper-elektrik/wechselrichter/', label: 'Wechselrichter auslegen' }],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          '230-V-Kreise im Fahrzeug ohne eigenen FI-Schutz betreiben.',
          'Schutzleiterquerschnitt kleiner ausführen als den Außenleiter, obwohl kein größerer Querschnitt vorliegt.',
          'Landstrom ohne Zugentlastung einführen — die mechanische Last landet auf den Klemmen.',
          'Steckdosen mit Schuko-Stecker nach innen verwenden statt fester Verdrahtung in der Verteilung.',
          'Wechselrichter und Landstrom gleichzeitig auf dieselbe Verteilung schalten, ohne Trennung.',
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Darf ich die 230-V-Anlage im Camper selbst bauen?',
      answer:
        'Eine 230-V-Anlage im Fahrzeug gehört in die Hände einer Elektrofachkraft — Aufbau und Abnahme. Camp liefert den Plan, prüft rechnerisch Abschaltbedingung, Schutzleiterquerschnitt und Absicherung, ersetzt aber keine Abnahme nach DIN VDE 0100-721.',
    },
    {
      question: 'Brauche ich im Camper einen FI-Schutzschalter?',
      answer:
        'Ja, ein FI mit 30 mA Auslösestrom ist die zentrale Schutzmaßnahme im Fahrzeug — auch auf Campingplätzen mit eigenem FI in der Säule. Er schützt Personen vor Fehlerströmen, bevor der Leitungsschutzschalter überhaupt reagieren könnte.',
    },
    {
      question: 'Welcher Leitungsschutzschalter passt zur 230-V-Verteilung im Camper?',
      answer:
        'Üblich sind LS-Schalter mit Charakteristik B oder C, im Modell mit 6 oder 10 kA Bemessungs-Abschaltvermögen. Entscheidend ist nicht nur der Nennstrom: Der Schleifenwiderstand muss den garantierten Auslösestrom zulassen — bei 16 A Charakteristik B sind das 80 A und damit ein maximaler Schleifenwiderstand von 1,92 Ω nach der 2/3-Regel.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/wechselrichter/', label: 'Wechselrichter auslegen' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/camper-elektrik/schaltplan/', label: 'Schaltplan zeichnen' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
    { href: '/ueber-werft/', label: 'Über Werft: Grenzen des Modells' },
  ],
  sources: [
    {
      label: 'IEC 60364-5-54, Tabelle 54.2',
      detail: 'Schutzleiter-Mindestquerschnitt in Abhängigkeit vom Außenleiterquerschnitt.',
    },
    {
      label: 'IEC 60898-1',
      detail: `Magnetische Schnellauslösebereiche B = 3–5× In und C = 5–10× In, übliche Abschaltvermögen ${MCB_BREAKING_CAPACITY_KA_OPTIONS.join('/')} kA.`,
    },
    {
      label: 'IEC 60364-4-41 § 411.3.2',
      detail: 'Automatische Abschaltung der Stromversorgung — Grundlage der Zs-Prüfung im Modell.',
    },
    {
      label: 'DIN VDE 0100-600',
      detail: '2/3-Regel für den zulässigen Schleifenwiderstand (Messunsicherheit und Erwärmung).',
    },
    {
      label: 'DIN VDE 0100-721',
      detail: 'Kleinspannungsanlagen in Caravans und Motorcaravans — 230 V im Fahrzeug.',
    },
  ],
  assumptions: [
    `Vorgelagerte Netzimpedanz ${UPSTREAM_IMPEDANCE_ASSUMPTION_OHM} Ω (CEE-16-A-Näherung) — im Modell ausdrücklich als Annahme geführt; eine Messung vor Ort schlägt sie.`,
    'Das Modell ist ein Single-Line-Schema: Neutralleiterführung einzeln, Trenn- und Umschalteinrichtungen sowie Selektivität bildet es nicht ab.',
  ],
  limits: [
    'Isolationswiderstand, Schutzleiterdurchgang und RCD-Auslösezeit sind Messungen vor Ort — keine Rechengrößen.',
    'Die Beurteilung von Bestandsanlagen und die Abnahme sind Aufgaben einer Elektrofachkraft.',
    'Brandschutz und mechanischer Schutz der Leitungsführung sind nicht modelliert.',
  ],
};
