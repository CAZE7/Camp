/**
 * lib/seo/content/solaranlage.ts — Rechner-Seite `/rechner/solaranlage/`.
 *
 * Die Beispielwerte kommen aus `sizeSolarArray` — dieselbe Funktion, die den
 * Rechner antreibt. Sommer und Winter stehen bewusst nebeneinander: Eine
 * Auslegung, die nur im Juli trägt, ist keine Auslegung.
 */

import { DEFAULT_YIELD_KWH_PER_KWP_DAY, sizeSolarArray } from '@/lib/solarSizing';
import { VDE_CHARGE_DERATING_FACTOR, VDE_SOLAR_WINTER_REDUCTION } from '@/lib/vde-standards';

import type { SeoPageContent } from '../types';

const summer = sizeSolarArray({ dailyEnergyWh: 1000, systemVoltageV: 12, panelWatts: 100 });
const winter = sizeSolarArray({
  dailyEnergyWh: 1000,
  systemVoltageV: 12,
  panelWatts: 100,
  winterDesign: true,
});

export const SOLARANLAGE_CONTENT: SeoPageContent = {
  path: '/rechner/solaranlage/',
  slug: 'solaranlage',
  topicId: 'solar',
  kind: 'rechner',
  title: 'Solaranlage für den Camper berechnen',
  absoluteTitle: true,
  description:
    'Solaranlage berechnen: Tagesbedarf, spezifischer Ertrag und Jahreszeit ergeben Modulleistung, Panelanzahl und Ladestrom — mit Sommer- und Winterrechnung.',
  h1: 'Solaranlage berechnen',
  lead: 'Dieser Rechner beantwortet zwei Fragen in einer: Wie viel Modulleistung deckt meinen Tagesbedarf — und reicht die Fläche dafür im Winter überhaupt? Sommer- und Winterfall stehen dabei getrennt, weil sie unterschiedliche Antworten geben.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.9,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'rechner',
      heading: 'Tagesbedarf, Ertrag und Panelgröße eingeben',
      body: [
        'Vier Angaben treiben die Rechnung: der Tagesbedarf in Wattstunden, der spezifische Ertrag am Einbauort (kWh je kWp und Tag), die Leistung eines Panels und die Jahreszeit. Optional kommt ein Abschlag für Verschattung und Ausrichtung hinzu — als Eingabe, weil das Modell den Einbauort nicht kennt.',
      ],
      calculator: 'solaranlage',
    },
    {
      id: 'eingaben',
      heading: 'Was die Eingaben bedeuten',
      definitions: [
        {
          term: 'Tagesbedarf (Wh)',
          description:
            'Dieselbe Zahl wie in der Batterieauslegung. Beide Rechnungen müssen vom selben Bedarf ausgehen.',
        },
        {
          term: `Spezifischer Ertrag (kWh/kWp/Tag)`,
          description: `Standard ${DEFAULT_YIELD_KWH_PER_KWP_DAY.toFixed(1).replace('.', ',')} — rund 1 100 kWh je kWp im Jahr, unterer Rand guter mitteleuropäischer Dachflächen. Flache Montage, Ost-West oder Teilverschattung: Wert senken.`,
        },
        {
          term: 'Panel (Wp)',
          description: 'Leistung eines Moduls. Bestimmt die Panelanzahl, nicht die benötigte Gesamtleistung.',
        },
        {
          term: `Winterfall`,
          description: `Rechnet mit ${VDE_SOLAR_WINTER_REDUCTION} des Sommerertrags (Modellwert). Er zeigt, was im Dezember von der Anlage übrig bleibt.`,
        },
        {
          term: 'Abschlag (%)',
          description:
            'Verschattung, Ausrichtung, Verschmutzung. 20 bis 30 % sind für einen flachen Dachaufbau mit Luken und Boxen realistisch.',
        },
      ],
    },
    {
      id: 'formel',
      heading: 'Die Formel',
      formula: {
        expression: 'P_erf = (Bedarf_Wh / Ertrag_Wh_je_kWp) · 1000 Wp · 1,15',
        caption: `Der Faktor ${VDE_CHARGE_DERATING_FACTOR} ist der Ladezeit-Aufschlag des Modells (CC/CV, Wärme, Alterung).`,
      },
      body: [
        'Der Rechner rundet anschließend auf ganze Panels auf — eine halbe Platte gibt es nicht. Die Angabe „erwarteter Ladestrom" ergibt sich aus der installierten Leistung geteilt durch die MPP-Spannung von 18 V je 12-V-Modul.',
      ],
    },
    {
      id: 'beispiel',
      heading: 'Beispiel: 1 000 Wh Tagesbedarf',
      table: {
        caption:
          'Modellrechnung für 1 000 Wh Tagesbedarf am 12-V-Bordnetz, 100-Wp-Panels, Ertrag 3,0 kWh/kWp/Tag',
        head: ['Jahreszeit', 'Nötige Leistung', 'Empfehlung', 'Erwarteter Ladestrom'],
        rows: [
          [
            'Sommer',
            `${summer.requiredPeakWatts.toFixed(0)} Wp`,
            `${summer.recommendedPeakWatts} Wp (${summer.panelCount} Panels)`,
            `${summer.expectedChargeCurrentA.toFixed(0)} A`,
          ],
          [
            'Winter',
            `${winter.requiredPeakWatts.toFixed(0)} Wp`,
            `${winter.recommendedPeakWatts} Wp (${winter.panelCount} Panels)`,
            `${winter.expectedChargeCurrentA.toFixed(0)} A`,
          ],
        ],
        note: `Der Winterfall fordert das ${(winter.requiredPeakWatts / summer.requiredPeakWatts).toFixed(1).replace('.', ',')}-Fache der Sommerleistung — auf den meisten Camper-Dächern ist das nicht unterzubringen.`,
      },
      body: [
        'Das ist keine Schwäche des Rechners, sondern die Physik: Im Winter steht die Sonne tief, die Einstrahlung ist gering, und ein flach montiertes Modul verliert zusätzlich. Wer im Winter autark stehen will, kombiniert Solar mit Laden während der Fahrt oder mit Landstrom — und senkt den Verbrauch.',
      ],
    },
    {
      id: 'grenzen-des-ergebnis',
      heading: 'Was das Ergebnis nicht sagt',
      list: {
        items: [
          'Es ist keine Ertragsprognose: Neigung, Azimut, Schattenwurf und regionale Einstrahlung sind nicht modelliert.',
          'Es sagt nichts über die Batterie — die Auslegung der Kapazität ist eine eigene Rechnung.',
          'Es prüft nicht, ob die Module mechanisch aufs Dach passen; dafür gibt es den Dach-Planer.',
          'Es berücksichtigt keine Verschattung einzelner Panels innerhalb eines Strings; der Abschlag ist eine Pauschale.',
        ],
      },
      links: [
        { href: '/tools/dach/', label: 'Dach-Planer: Panels auf der Fläche platzieren' },
        {
          href: '/camper-elektrik/solar/',
          label: 'Solar im Camper auslegen',
          description: 'Ertrag, Verschattung und Laderegler.',
        },
        { href: '/camper-elektrik/mppt/', label: 'MPPT-Laderegler auslegen' },
        { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Den Sommerertrag für die Winterplanung verwenden.',
          'Den spezifischen Ertrag unverändert lassen, obwohl das Panel flach und teilverschattet liegt.',
          'Modulleistung mit Ladeleistung gleichsetzen: 100 Wp sind nicht 100 W am Batteriepol.',
          'Die Batterie kleiner wählen, weil „Solar ja nachlädt" — ohne Winterrechnung.',
          'Panels ohne Rücksicht auf die Verschattung in Reihe schalten.',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Berechnete Leistung und Panelanzahl lassen sich im [Camper-Elektroplaner](/elektrik-planung/#planer) als Solarquelle eintragen — dort fließen sie in die Energiebilanz ein.',
      },
    },
  ],
  faq: [
    {
      question: 'Wie viel Watt Solar brauche ich für den Camper?',
      answer:
        'Das ergibt sich aus dem Tagesbedarf: Bei 1 000 Wh und 3,0 kWh/kWp/Tag fordert die Rechnung im Sommer rund 400 Wp (vier 100-Wp-Panels), im Winter rund 1 100 Wp. Der Winterwert übersteigt die Dachfläche der meisten Fahrzeuge — dort helfen Landstrom oder Laden während der Fahrt.',
    },
    {
      question: 'Was ist ein realistischer spezifischer Ertrag?',
      answer:
        'Für eine gut belüftete Süddach-Montage in Mitteleuropa sind 3,0 kWh je kWp und Tag ein üblicher Jahresdurchschnitt (rund 1 100 kWh/kWp). Flache Montage, Ost-West-Ausrichtung, Verschattung durch Luken oder Dachboxen senken den Wert — dann gehört ein Abschlag in die Rechnung.',
    },
    {
      question: 'Warum rechnet der Rechner mit einem Ladezeit-Aufschlag von 15 %?',
      answer:
        'Weil eine Batterie nie die volle Energie aufnimmt, die ihr angeboten wird: Die letzte Ladephase (Konstantspannung) fließt mit abnehmendem Strom, Wärme und Alterung kosten zusätzlich. Der Faktor 1,15 stammt aus dem Modell und wird auch für die Ladezeit-Schätzung im Planer verwendet.',
    },
  ],
  related: [
    { href: '/camper-elektrik/solar/', label: 'Solar im Camper auslegen' },
    { href: '/camper-elektrik/mppt/', label: 'MPPT-Laderegler auslegen' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
    { href: '/tools/dach/', label: 'Dach-Planer' },
    { href: '/rechner/', label: 'Alle Rechner im Überblick' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modellwerte',
      detail:
        'Winterertrag 35 % des Sommerwerts, MPP-Spannung 18 V je 12-V-Modul, Ladezeit-Aufschlag 1,15 — `lib/vde-standards.ts`.',
    },
    {
      label: 'Ertragsstandard',
      detail:
        '3,0 kWh/kWp/Tag ist ein dokumentierter Eingabestandard in `lib/solarSizing.ts`, kein Messwert für einen konkreten Standort.',
    },
  ],
  assumptions: [
    'Der Ertragswert gilt für eine gut belüftete Dachmontage ohne Verschattung.',
    'Die Auslegung rechnet den Tagesbedarf gegen den Tagesertrag; mehrtägige Schlechtwetterphasen sind nicht modelliert.',
  ],
  limits: [
    'Keine Standortprognose (Neigung, Azimut, regionale Einstrahlung).',
    'Keine elektrische String-Auslegung — Sicherungen, Kabel und Laderegler stehen auf der MPPT-Seite.',
    'Keine mechanische Prüfung der Dachfläche.',
  ],
};
