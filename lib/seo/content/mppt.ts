/**
 * lib/seo/content/mppt.ts — Cluster-Seite `/camper-elektrik/mppt/`.
 *
 * Alle Faktoren dieser Seite stammen aus `lib/solar.ts` (dort mit Quellenlage
 * dokumentiert): Isc/Imp-Fallback 1,25 · Stringkabel-Faktor 1,25 ·
 * Sicherungsfaktor 1,5625 (NEC 690.8 × 690.9) · Temperaturkoeffizient
 * −0,35 %/K · Auslegungstemperatur −20 °C.
 */

import {
  SOLAR_CABLE_ISC_FACTOR,
  SOLAR_DESIGN_MIN_TEMPERATURE_C,
  SOLAR_FUSE_ISC_FACTOR,
  SOLAR_STC_TEMPERATURE_C,
  SOLAR_VOC_TEMP_COEFF_PER_KELVIN,
} from '@/lib/solar';
import { VDE_SOLAR_VMP_VOLTAGE } from '@/lib/vde-standards';

import type { SeoPageContent } from '../types';

/** Beispielmodul mit 100 Wp, Voc 22 V, Imp 5,5 A — typische Größenordnung. */
const EXAMPLE = { watts: 100, vocStc: 22, imp: 5.5 };
const isc = EXAMPLE.imp * 1.25;
const coldVoc =
  EXAMPLE.vocStc *
  (1 + SOLAR_VOC_TEMP_COEFF_PER_KELVIN * (SOLAR_DESIGN_MIN_TEMPERATURE_C - SOLAR_STC_TEMPERATURE_C));

const FACTOR_ROWS = [
  [
    'Leerlaufspannung kalt (−20 °C)',
    `${coldVoc.toFixed(1).replace('.', ',')} V`,
    'Voc bei STC mit dem Temperaturkoeffizienten',
  ],
  [
    'Kurzschlussstrom Isc',
    `${isc.toFixed(2).replace('.', ',')} A`,
    'Imp × 1,25, wenn das Datenblatt kein Isc nennt',
  ],
  [
    'Stringkabel-Dimensionierung',
    `${(isc * SOLAR_CABLE_ISC_FACTOR).toFixed(2).replace('.', ',')} A`,
    `1,25 × Isc (Faktor ${SOLAR_CABLE_ISC_FACTOR})`,
  ],
  [
    'String-Sicherung',
    `${(isc * SOLAR_FUSE_ISC_FACTOR).toFixed(1).replace('.', ',')} A`,
    `1,5625 × Isc (Faktor ${SOLAR_FUSE_ISC_FACTOR})`,
  ],
];

export const MPPT_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/mppt/',
  slug: 'mppt',
  topicId: 'mppt',
  kind: 'cluster',
  title: 'MPPT-Laderegler auslegen: Spannung, Strom, Sicherung',
  absoluteTitle: true,
  description:
    'MPPT-Laderegler auslegen: Warum MPPT mehr bringt als PWM, wie das Spannungsfenster mit der Kalt-Leerlaufspannung gerechnet wird und welche Ströme gelten.',
  h1: 'MPPT-Laderegler auslegen',
  lead: 'Der Laderegler ist die Schnittstelle zwischen Modul und Batterie. Wird er nur nach der Wattzahl gewählt, fällt der Fehler erst bei Kälte auf — dann, wenn die Leerlaufspannung des Moduls am höchsten ist und den Regler zerstören kann.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'mppt-oder-pwm',
      heading: 'MPPT oder PWM: der Unterschied in Zahlen',
      body: [
        `Ein 12-V-Modul liefert seine Leistung bei rund ${VDE_SOLAR_VMP_VOLTAGE} V MPP-Spannung, die Batterie nimmt sie bei 12 bis 14,4 V auf. Ein PWM-Regler verbindet beide direkt: Die Spannungsdifferenz von rund 5 V verpufft, es kommen nur etwa 70 bis 80 % der Modulleistung an. Ein MPPT-Regler wandelt die Differenz in zusätzlichen Ladestrom um und nutzt die Leistung weitgehend.`,
        'Für eine Bleibank ist der Unterschied deutlich spürbar: Aus 300 Wp werden mit PWM schnell nur 220 W Ladeleistung. Bei Lithium fällt der Vorteil kleiner aus, weil die Batteriespannung höher liegt — aber ein PWM-Regler bleibt die schwächere Wahl.',
      ],
    },
    {
      id: 'spannungsfenster',
      heading: 'Das Spannungsfenster: kalt ist der kritische Fall',
      body: [
        `Die Leerlaufspannung eines Moduls steigt mit sinkender Temperatur — im Modell mit ${(SOLAR_VOC_TEMP_COEFF_PER_KELVIN * 100).toFixed(2).replace('.', ',')} % je Kelvin und einer Auslegungstemperatur von ${SOLAR_DESIGN_MIN_TEMPERATURE_C} °C. Ein Modul mit 22 V Leerlaufspannung bei 25 °C erreicht bei −20 °C rund ${coldVoc.toFixed(1).replace('.', ',')} V.`,
        'Auf der anderen Seite muss die Spannung im Betrieb reichen, um die Batterie überhaupt zu laden: Ein Modul mit zu geringer Spannung in Reihe geschalteter Zellen lädt eine 24-V-Bank nicht mehr zuverlässig. Beide Grenzen gehören in dieselbe Prüfung — die Maximalspannung des Reglers muss über der Kalt-Leerlaufspannung liegen, die MPP-Spannung des Strings unter allen Bedingungen über der Batteriespannung plus Regler-Reserve.',
      ],
      callout: {
        tone: 'warning',
        text: 'Wer nur die STC-Spannung prüft, übersieht bis zu 16 % Zusatzspannung bei Kälte. Ein Regler, der „gerade so" passt, passt im Winter nicht.',
      },
    },
    {
      id: 'stroeme',
      heading: 'Ströme und Sicherungen am Solarkreis',
      table: {
        caption: 'Abgeleitete Größen für ein Beispielmodul (100 Wp, Voc 22 V, Imp 5,5 A)',
        head: ['Größe', 'Wert', 'Woher'],
        rows: FACTOR_ROWS,
        note: 'Alle Faktoren stammen aus `lib/solar.ts`; die Quellenlage ist dort dokumentiert (NEC 690.8 × 690.9 für den Sicherungsfaktor, IEC-62548-Kontext für den Stringkabel-Strom).',
      },
      body: [
        'Die Modulkabel werden nach dem höheren der beiden Ströme dimensioniert — Kurzschlussstrom mit Faktor oder Betriebsstrom. Die Sicherung sitzt in der Zuleitung und muss den Kurzschlussstrom des Strings abschalten können. Bei nur zwei parallelen Strings ist ein Stringschutz in vielen Regelwerken nicht zwingend — das Modell fordert ihn konservativ trotzdem, weil es Stringanzahlen nicht explizit führt.',
      ],
      links: [
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherungen nach Abschaltvermögen wählen',
          description: 'Bauformen, Nennströme und die Kette I_B ≤ I_n ≤ I_z.',
        },
      ],
    },
    {
      id: 'ladestrom',
      heading: 'Ladestrom: was der Regler in die Batterie schiebt',
      body: [
        'Die Ausgangsseite des Reglers zählt: Ein 400-Wp-Array liefert bei 13,8 V Ladespannung rund 29 A — der Regler muss diesen Strom dauerhaft können, nicht nur die Modulleistung. Wer eine 24-V-Bank lädt, halbiert den Ausgangsstrom bei gleicher Leistung und kann einen kleineren Regler einsetzen.',
        'Für die Batterie ist der Ladestrom eine Obergrenze: Bleibatterien nehmen dauerhaft etwa ein Fünftel bis ein Zehntel ihrer Kapazität an, Lithium deutlich mehr. Ein zu großer Regler ist deshalb seltener ein Problem als ein zu kleiner.',
      ],
      links: [
        { href: '/rechner/solaranlage/', label: 'Solaranlage und Ladestrom berechnen' },
        { href: '/camper-elektrik/solar/', label: 'Solar im Camper auslegen' },
        { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Regler nach der Wattzahl wählen und das Spannungsfenster nicht prüfen.',
          'Die Kalt-Leerlaufspannung mit dem Wert bei 25 °C ansetzen.',
          'Module in Reihe schalten, bis die Spannung „passt", ohne die Reglergrenze zu beachten.',
          'Modulkabel zu dünn wählen — der Verlust geht direkt von der Ladeleistung ab.',
          'Den Regler ohne Abstand zur Batterie montieren: Die Temperaturkompensation und die Ladeleitungslänge leiden darunter.',
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Wie wähle ich die Spannungsgrenze eines MPPT-Reglers?',
      answer:
        'Die maximale Eingangsspannung des Reglers muss über der Leerlaufspannung des Strings bei tiefster Auslegungstemperatur liegen. Das Modell rechnet dafür mit −20 °C und −0,35 %/K: Aus 22 V bei 25 °C werden dabei etwa 25,5 V. Wer nur die STC-Spannung vergleicht, plant zu knapp.',
    },
    {
      question: 'Wie viel bringt MPPT gegenüber PWM?',
      answer:
        'Bei einem 12-V-Modul mit rund 18 V MPP-Spannung und einer Bleibatterie sind es etwa 20 bis 30 % mehr Ladestrom, weil die Spannungsdifferenz nicht verpufft. Bei einer Lithium-Batterie mit höherer Ladespannung fällt der Vorteil kleiner aus — verschwindet aber nicht.',
    },
    {
      question: 'Wie groß muss die String-Sicherung sein?',
      answer:
        'Das Modell setzt 1,5625 × Isc an — abgeleitet aus der NEC-Regel (1,25 × Isc für den maximalen Stromkreisstrom, davon 125 % Sicherheitsfaktor). Bei einem Modul mit 6,9 A Isc sind das rund 10,7 A, also eine 15-A-Sicherung. Das Datenblatt des Moduls und die Regelwerk-Vorgabe für den konkreten Einbauort gehen vor.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/solar/', label: 'Solar im Camper auslegen' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/rechner/solaranlage/', label: 'Solaranlage berechnen' },
    { href: '/elektrik-planung/#planer', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modellwerte des Solarkreises',
      detail:
        'Isc/Imp-Fallback 1,25 · Stringkabel 1,25 × Isc · Sicherung 1,5625 × Isc · Temperaturkoeffizient −0,35 %/K · Auslegungstemperatur −20 °C — `lib/solar.ts`, dort mit Quellenlage.',
    },
    {
      label: 'NEC 690.8 / 690.9',
      detail:
        'Ableitung des Sicherungsfaktors 1,5625 (1,25 × Isc und davon 125 %). US-Regel, im Modell als unterer Rand recherchierter Bereiche gewählt.',
    },
  ],
  assumptions: [
    'Der Temperaturkoeffizient ist der schlechteste typische c-Si-Wert; ein Datenblattwert kann ihn unterschreiten.',
    '−20 °C Auslegungstemperatur ist eine Modellannahme für ein Fahrzeug in mitteleuropäischem Winterbetrieb.',
  ],
  limits: [
    'Regler-interne Begrenzungen, Temperaturkompensation und Kommunikationsfunktionen einzelner Geräte sind nicht modelliert.',
    'Die Verschattungsanalyse ist keine Leistung dieses Modells — ein verschattetes Modul wird hier wie ein besonntes gerechnet, wenn kein Abschlag eingegeben wird.',
  ],
};
