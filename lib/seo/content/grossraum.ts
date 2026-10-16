/**
 * lib/seo/content/grossraum.ts — Vorlagenseite `/vorlagen/grossraum/`.
 *
 * Ein großes Fahrzeug: mehr Verbraucher, eine Waschmaschine, eine 24-V-Bank.
 * Diese Vorlage ist der Fall, in dem die Bordnetzspannung das stärkste
 * Argument ist — dieselbe Leistung zieht am 24-V-Bordnetz halb so viel Strom,
 * und die Leitungen werden dünner.
 *
 * Alle Zahlen stammen aus den Modellen der Auslieferung; die Rechenwege stehen
 * in `lib/seo/vorlagen.ts`.
 */

import {
  bilanziere,
  batterieRechnung,
  fmt,
  kreisRechnung,
  kreiseRechnungen,
  kreisZeile,
  solarErtrag,
  solarRechnung,
} from '../vorlagen';
import type { SeoPageContent } from '../types';

const VERBRAUCHER = [
  {
    geraet: 'Kompressor-Kühlbox',
    watt: 45,
    stunden: 10,
    laengeM: 3,
    hinweis: 'Grundlast — sie läuft, solange es warm ist.',
  },
  {
    geraet: 'Tiefkühlgerät',
    watt: 60,
    stunden: 8,
    laengeM: 3,
    hinweis: 'Läuft häufiger und länger als eine Kühlbox und gehört deshalb auf einen eigenen Kreis.',
  },
  {
    geraet: 'Wasserpumpe',
    watt: 60,
    stunden: 0.4,
    laengeM: 5,
    hinweis: 'Kurze Zeit, hohe Leistung, lange Leitung.',
  },
  {
    geraet: 'LED-Beleuchtung',
    watt: 24,
    stunden: 6,
    laengeM: 4,
    hinweis: 'Mehr Leuchten im Fahrzeug, dafür bleibt der Verbrauch pro Lampe niedrig.',
  },
  {
    geraet: 'Laptop über 12-V-Netzteil',
    watt: 65,
    stunden: 4,
    laengeM: 2,
    hinweis: 'Arbeitsplatz mit Netzanschluss am 12-V-Netzteil.',
  },
  {
    geraet: 'Waschmaschine (230 V, über Wechselrichter)',
    watt: 500,
    stunden: 1,
    laengeM: 1.5,
    hinweis: 'Der teuerste Verbraucher der Liste — 500 W an 24 V sind 20,8 A.',
  },
] as const;

const BILANZ = bilanziere(VERBRAUCHER);
const BATTERIE = batterieRechnung(BILANZ.summeWh, 2, 24);
const SOMMER = solarRechnung(BILANZ.summeWh, 24, 100, false);
const WINTER = solarRechnung(BILANZ.summeWh, 24, 100, true);
const KREISE = kreiseRechnungen(VERBRAUCHER, 24);
const HAUPTLEITUNG = kreisRechnung('Hauptleitung Batterie → Plusverteilung', 1200, 2.5, 24);
const WECHSELRICHTER = kreisRechnung('Wechselrichter 2 000 W an der Batterie', 2000, 1.5, 24);

/** Peukert-korrigierte Nennkapazität: die Größe, die zwei volle Tage trägt. */
const MIT_PEUKERT = Math.ceil(BATTERIE.requiredNominalAh / BATTERIE.peukertFactor / 5) * 5;

/**
 * Ausgangsstrom des Ladereglers. Für eine 24-V-Bank halbiert sich der
 * Ausgangsstrom bei gleicher Leistung (Regel des MPPT-Fachthema); angesetzt
 * wird die doppelte Ladespannung von 13,8 V.
 */
const MPPT_STROM = SOMMER.recommendedPeakWatts / 27.6;

const STUECKLISTE: readonly (readonly string[])[] = [
  [
    'Aufbaubatterie',
    'LiFePO4 24 V, 175 Ah',
    '1',
    `Zwei Tage ohne Ladung verlangen ${fmt(BATTERIE.requiredNominalAh, 1)} Ah Nennkapazität bei 24 V. Mit Peukert-Korrektur bei 25 A Dauerstrom sind es ${MIT_PEUKERT} Ah.`,
  ],
  [
    'Batteriehalter und Absicherung',
    'Polklemmen, Sicherung 125 A an der Batterie',
    '1',
    'Der Schutzorgan sitzt am Batteriepol, die Leitung zur Batterie bleibt kurz und ungeschützt.',
  ],
  [
    'Hauptleitung',
    '25 mm² Leitung, 2,5 m',
    '1',
    `Bei ${fmt(HAUPTLEITUNG.stromA, 0)} A auf ${fmt(HAUPTLEITUNG.laengeM, 1)} m fordert das Modell ${fmt(HAUPTLEITUNG.querschnittMm2, 1)} mm².`,
  ],
  [
    'Hauptsicherung',
    '60 A, direkt am Batteriepol',
    '1',
    `Die Leitung darf max. ${HAUPTLEITUNG.maxSicherungA} A abgesichert werden.`,
  ],
  [
    'Wechselrichter',
    '2 000 W, 24 V auf 230 V, reine Sinuswelle',
    '1',
    'Für Waschmaschine, Kaffeemaschine und Ladegeräte. Am 24-V-Bordnetz zieht er 83,3 A.',
  ],
  [
    'Leitung zum Wechselrichter',
    '50 mm² Leitung, 1,5 m, 80 A Sicherung',
    '1',
    `2 000 W an 24 V sind ${fmt(WECHSELRICHTER.stromA, 1)} A. Auf ${fmt(WECHSELRICHTER.laengeM, 1)} m fordert das Modell ${fmt(WECHSELRICHTER.querschnittMm2, 1)} mm².`,
  ],
  [
    'Solarmodule',
    '100 Wp, 12 V (zwei Stränge à 24 V)',
    '8',
    `Sommerrechnung: ${fmt(SOMMER.requiredPeakWatts, 0)} Wp nötig, mit 8 Modulen ${SOMMER.recommendedPeakWatts} Wp (Deckung ${fmt(SOMMER.coverageFactor, 2)}).`,
  ],
  [
    'Laderegler',
    'MPPT für 24 V, 30 A Ausgangsstrom',
    '1',
    `${SOMMER.recommendedPeakWatts} Wp ergeben am Reglerausgang bei 27,6 V Ladespannung ${fmt(MPPT_STROM, 1)} A — bei 24 V halbiert sich der Ausgangsstrom gegenüber 12 V.`,
  ],
  [
    'Ladegerät am Landstrom',
    '30 A, mit Temperaturkompensation',
    '1',
    `Nachladen im Ladefenster: ${fmt(BATTERIE.chargeCurrentA, 1)} A nach dem Ladezeit-Aufschlag des Modells.`,
  ],
  [
    'Bordnetzverteilung',
    'Fuse-Box mit 8 bis 10 Kreisen, Masseverteilung',
    '1',
    'Jeder Kreis mit eigener Sicherung; die Masse führt an einem Punkt zurück zur Batterie.',
  ],
  [
    '230-V-Verteilung',
    'FI-Schutzschalter, Steckdosen, 16-A-Kreis',
    'nach Bedarf',
    'Die 230-V-Seite gehört in die Hand einer Fachkraft: Einspeisung, FI-Schutz und Abnahme sind dort geregelt.',
  ],
];

export const VORLAGE_GROSSRAUM: SeoPageContent = {
  path: '/vorlagen/grossraum/',
  slug: 'grossraum',
  topicId: 'vorlagen',
  kind: 'cluster',
  title: 'Elektrik-Vorlage Großraum-Camper: 24 V, Waschmaschine',
  absoluteTitle: true,
  description:
    'Ausbau-Vorlage für große Fahrzeuge: 24-V-Bordnetz, 175-Ah-Batterie, 800 Wp Solar und 2 000-W-Wechselrichter — mit Stückliste, Rechenweg und Grenzen.',
  h1: 'Elektrik-Vorlage: Großraum-Camper',
  lead: 'Wer eine Waschmaschine, mehr Licht und mehrere Verbraucher an Bord hat, stößt am 12-V-Bordnetz an eine Grenze: derselbe Strom durch dünnere Leitungen. Diese Vorlage rechnet den Fall durch — mit 24 V, weil dort die Ströme halbiert sind.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'gedanken',
      heading: 'Wofür diese Vorlage gedacht ist',
      body: [
        'Die Vorlage beschreibt ein großes Fahrzeug mit Waschmaschine, mehreren Verbrauchern und einer längeren Standzeit. Der Unterschied zur Autark-Vorlage ist nicht der Verbrauch allein, sondern die Bordnetzspannung: 24 V halbiert die Ströme, und damit sinken Querschnitte, Sicherungen und Verluste.',
        'Sie ist eine Ausgangslage, kein fertiges Projekt. Verbraucherliste und Leitungslängen sind Beispiele; der Planer rechnet aus deinen Werten denselben Weg nach.',
      ],
      list: {
        items: [
          'Ziel: zwei Tage ohne Landstrom, täglich nachgeladen.',
          'Bordnetz 24 V, eine Batteriebank, ein Wechselrichter für 230 V.',
          'Ladung über 800 Wp Solar (zwei 24-V-Stränge) und ein 30-A-Ladegerät am Landstrom.',
          'Auslegung im Sommer; der Winterfall steht weiter unten und ist unbequem.',
        ],
      },
      links: [
        {
          href: '/vorlagen/autark/',
          label: 'Zur Autark-Vorlage',
          description: 'Dieselbe Frage am 12-V-Bordnetz — mit dickeren Leitungen als Preis.',
        },
        {
          href: '/vorlagen/wochenend/',
          label: 'Zur Wochenend-Vorlage',
          description: 'Der einfache Fall ohne 230 V.',
        },
      ],
    },
    {
      id: 'verbrauch',
      heading: 'Verbrauch: derselbe Verbrauch, halb so viel Strom',
      body: [
        `Der Tagesbedarf liegt bei ${fmt(BILANZ.summeWh, 0)} Wh. An einem 24-V-Bordnetz ist der Strom dabei halb so groß wie an einem 12-V-Bordnetz: Die Waschmaschine mit 500 W zieht 20,8 A statt 41,7 A.`,
        'Genau darin liegt der Vorteil der höheren Bordnetzspannung: nicht mehr Energie, sondern weniger Leitungsquerschnitt, kleinere Sicherungen und geringere Verluste auf langen Wegen.',
      ],
      table: {
        caption: 'Beispielhafter Tageshaushalt eines großen Campers (24 V)',
        head: ['Verbraucher', 'Leistung', 'Dauer/Tag', 'Energie'],
        rows: BILANZ.rows,
        note: 'Beispielwerte, keine Messwerte.',
      },
      links: [
        {
          href: '/camper-elektrik/',
          label: 'Camper-Elektrik planen',
          description: 'Die Reihenfolge, in der die einzelnen Schritte entstehen.',
        },
      ],
    },
    {
      id: 'batterie',
      heading: 'Batterie: 175 Ah bei 24 V',
      body: [
        `Zwei Tage ohne Ladung sind 2 × ${fmt(BILANZ.summeWh, 0)} Wh = ${fmt(BILANZ.summeWh * 2, 0)} Wh nutzbare Energie. Bei 90 % Entladetiefe und 24 V sind das ${fmt(BATTERIE.requiredNominalAh, 1)} Ah Nennkapazität, aufgerundet 175 Ah — ${fmt((175 * 24) / 1000, 2)} kWh Nennenergie.`,
        `Bei 25 A Dauerstrom liegt der Peukert-Faktor bei ${fmt(BATTERIE.peukertFactor, 3)}; nutzbar bleiben ${fmt(BATTERIE.usableAhOfRecommendation, 1)} Ah (${fmt((BATTERIE.usableAhOfRecommendation * 24) / 1000, 2)} kWh). Für zwei volle Tage sind ${MIT_PEUKERT} Ah die ehrliche Größe.`,
        `Nachgeladen wird im Ladefenster: ${fmt(BATTERIE.chargeCurrentA, 1)} A nach dem Ladezeit-Aufschlag des Modells.`,
      ],
      formula: {
        expression: 'C_nenn = (Bedarf_Wh · Tage) / (U · DoD)',
        caption: `Für diese Vorlage: (${fmt(BILANZ.summeWh, 0)} Wh × 2) / (24 V × 0,90) = ${fmt(BATTERIE.requiredNominalAh, 1)} Ah → 175 Ah als Baugröße, ${MIT_PEUKERT} Ah mit Peukert.`,
      },
      callout: {
        tone: 'info',
        text: 'Die 24-V-Bank ist nicht nur eine Zahl: Zellen, Ladegerät, Laderegler und die vorhandene Verkabelung im Fahrzeug müssen dazu passen. Ein 12-V-System auf 24 V umzubauen ist ein eigenes Projekt.',
      },
      links: [
        {
          href: '/camper-elektrik/batterie/',
          label: 'Batterie dimensionieren',
          description: 'Entladetiefe, Peukert und der Weg zum Nennwert.',
        },
      ],
    },
    {
      id: 'solar',
      heading: 'Solar: 800 Wp im Sommer',
      body: [
        `Mit 100-Wp-Modulen fordert die Rechnung ${fmt(SOMMER.requiredPeakWatts, 0)} Wp: 8 Module, ${SOMMER.recommendedPeakWatts} Wp, Deckung ${fmt(SOMMER.coverageFactor, 2)}. Auf 24 V werden die Module in zwei Strängen à 24 V verschaltet.`,
        `Der Winterfall liegt bei ${fmt(WINTER.requiredPeakWatts, 0)} Wp, also ${WINTER.panelCount} Module. Auch hier ist das die ehrliche Grenze: Wer im Winter mehrere Tage autark stehen will, braucht Landstrom oder lädt während der Fahrt nach.`,
      ],
      table: {
        caption: 'Was die Solaranlage im Jahr leistet (100-Wp-Module, 24 V)',
        head: ['Dachfläche', 'Sommerertrag', 'Deckung', 'Winterertrag', 'Deckung'],
        rows: [
          [
            '4 × 100 Wp',
            `${fmt(solarErtrag(400, BILANZ.summeWh, 24, 100, false).ertragWh, 0)} Wh`,
            fmt(solarErtrag(400, BILANZ.summeWh, 24, 100, false).deckung, 2),
            `${fmt(solarErtrag(400, BILANZ.summeWh, 24, 100, true).ertragWh, 0)} Wh`,
            fmt(solarErtrag(400, BILANZ.summeWh, 24, 100, true).deckung, 2),
          ],
          [
            '8 × 100 Wp (Empfehlung)',
            `${fmt(solarErtrag(800, BILANZ.summeWh, 24, 100, false).ertragWh, 0)} Wh`,
            fmt(solarErtrag(800, BILANZ.summeWh, 24, 100, false).deckung, 2),
            `${fmt(solarErtrag(800, BILANZ.summeWh, 24, 100, true).ertragWh, 0)} Wh`,
            fmt(solarErtrag(800, BILANZ.summeWh, 24, 100, true).deckung, 2),
          ],
        ],
        note: 'Ertrag je Modulleistung nach dem Standard des Solaranlage-Rechners. Keine Prognose für einen bestimmten Standort.',
      },
      callout: {
        tone: 'info',
        text: `${SOMMER.recommendedPeakWatts} Wp ergeben am Laderegler-Ausgang bei 27,6 V Ladespannung ${fmt(MPPT_STROM, 1)} A. Bei 24 V halbiert sich der Ausgangsstrom gegenüber 12 V — deshalb genügt hier ein 30-A-Regler.`,
      },
      links: [
        {
          href: '/tools/dach/',
          label: 'Panels auf dem Dach platzieren',
          description: 'Wie viel Fläche das Dach wirklich hergibt.',
        },
        {
          href: '/camper-elektrik/mppt/',
          label: 'Laderegler auslegen',
          description: 'Spannungsfenster, Kalt-Leerlaufspannung und Ströme.',
        },
      ],
    },
    {
      id: 'wechselrichter',
      heading: 'Der Wechselrichter: 83 A statt 167 A',
      body: [
        `Ein 2 000-W-Wechselrichter am 24-V-Bordnetz zieht ${fmt(WECHSELRICHTER.stromA, 1)} A. Am 12-V-Bordnetz wären es 166,7 A — dieselbe Leistung, doppelter Strom, doppelte Leitung. Auf ${fmt(WECHSELRICHTER.laengeM, 1)} m fordert das Modell für den 24-V-Fall ${fmt(WECHSELRICHTER.querschnittMm2, 1)} mm² und eine Sicherung von ${fmt(WECHSELRICHTER.sicherungA, 0)} A.`,
        'Die 230-V-Seite selbst (FI-Schutz, Steckdosen, Einspeisung) ist nicht Teil dieser Vorlage: Sie gehört in die Hand einer Fachkraft.',
      ],
      table: {
        caption: 'Kreise der Vorlage (24 V)',
        head: ['Kreis', 'Strom', 'Länge', 'Querschnitt', 'I_z', 'Sicherung'],
        rows: [...KREISE.map(kreisZeile), kreisZeile(HAUPTLEITUNG), kreisZeile(WECHSELRICHTER)],
        note: 'Querschnitt nach Spannungsfall und Belastbarkeit, Sicherung nach der Leitung. Längen sind Annahmen der Vorlage.',
      },
      links: [
        {
          href: '/camper-elektrik/wechselrichter/',
          label: 'Wechselrichter auslegen',
          description: 'Wirkungsgrad, Leerlaufverbrauch und Ströme am Bordnetz.',
        },
        {
          href: '/camper-elektrik/230v/',
          label: '230 V im Fahrzeug',
          description: 'Einspeisung, FI-Schutz und Abnahme.',
        },
      ],
    },
    {
      id: 'stueckliste',
      heading: 'Stückliste',
      body: [
        'Die Stückliste nennt die Bauteile und ihre Mengen, wie sie in der Planung stehen. Vor dem Kauf gehören Länge, Querschnitt und Typ an das konkrete Fahrzeug angepasst — und jedes Bauteil ist gegen sein Datenblatt im Planer zu prüfen.',
      ],
      table: {
        caption: 'Stückliste der Vorlage „Großraum-Camper"',
        head: ['Position', 'Bauteil', 'Menge', 'Begründung'],
        rows: STUECKLISTE,
        note: 'Muster für die Planung, kein Angebot. Preise und Verfügbarkeit sind nicht Teil dieser Seite.',
      },
      links: [
        {
          href: '/planer/',
          label: 'Plan mit diesen Werten zeichnen',
          description: 'Der Planer rechnet Querschnitt, Sicherung und Stückliste aus dem Plan.',
        },
      ],
    },
    {
      id: 'grenzen',
      heading: 'Was diese Vorlage nicht leistet',
      list: {
        items: [
          'Kein Umbau bestehender Fahrzeuge: 24 V setzt Zellen, Ladegerät, Laderegler und Verkabelung voraus.',
          'Kein Winter ohne Nachladung: Der Winterfall dieser Vorlage ist mit Solar nicht erreichbar.',
          'Keine 230-V-Anlage: Einspeisung, FI-Schutz und Abnahme sind Facharbeiten.',
          'Kein Gewichts- und Raumkonzept für die Batteriebank.',
          'Keine Garantie: Mit den eigenen Verbrauchern ändert sich die Rechnung.',
        ],
      },
      links: [
        {
          href: '/ueber-werft/',
          label: 'Wie Werft rechnet',
          description: 'Quellen, Annahmen und Grenzen des Modells.',
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Warum lohnt sich 24 V bei größeren Fahrzeugen?',
      answer:
        'Weil dieselbe Leistung an der doppelten Spannung halb so viel Strom zieht: 2 000 W sind am 12-V-Botnetz 166,7 A, am 24-V-Bordnetz 83,3 A. Der Querschnitt der Leitung sinkt mit, und die Verluste auf langen Wegen sinken quadratisch mit dem Strom.',
    },
    {
      question: 'Wie viel Solar braucht ein großes Fahrzeug?',
      answer:
        'Nach dem Modell 800 Wp für 1 858 Wh Tagesbedarf im Sommer — 8 Module mit je 100 Wp, in zwei Strängen à 24 V. Im Winter wären es 2 100 Wp; das passt auf kein Dach, und die Nachladung kommt dann aus dem Landstrom oder vom Fahren.',
    },
    {
      question: 'Kann ich die Waschmaschine in dieser Vorlage lassen?',
      answer:
        'Ja, aber sie ist der teuerste Verbraucher der Liste: 500 W am 24-V-Bordnetz sind 20,8 A, der Wechselrichter mit 2 000 W zieht 83,3 A. Wer sie seltener nutzt, senkt den Tagesbedarf und damit die Batteriegröße direkt mit.',
    },
    {
      question: 'Wie viel kostet der Unterschied zwischen 12 V und 24 V an der Leitung?',
      answer:
        'Bei diesem Beispiel liegt die Leitung zum Wechselrichter am 12-V-Bordnetz bei 70 mm², am 24-V-Bordnetz bei 50 mm² — und die Sicherung sinkt von 100 A auf 80 A. Der Aufwand liegt weniger im Kupfer als in Sicherungen, Verteilern und dem Umbau des Fahrzeugs.',
    },
  ],
  related: [
    { href: '/vorlagen/autark/', label: 'Vorlage: Autark-Camper (12 V, 3 Tage)' },
    { href: '/vorlagen/wochenend/', label: 'Vorlage: Wochenend-Camper (12 V, 2 Tage)' },
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/camper-elektrik/230v/', label: '230-V-Anlage im Fahrzeug' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modelle der Auslieferung',
      detail:
        'Batterie: `lib/batterySizing.ts` · Solar: `lib/solarSizing.ts` (Ertrag 3,0 kWh/kWp/Tag, Winterfaktor 0,35) · Leitungen und Sicherungen: `lib/electrical.ts` (Spannungsfall 3 % auf 12 V, Belastbarkeit nach DIN VDE 0298-4, Planerpauschale 0,7).',
    },
    {
      label: 'Rechenweg der Vorlage',
      detail:
        'Die Zahlen dieser Seite stammen aus `scripts/dev/bereche-vorlagen.ts`; das Skript rechnet dieselben Eingaben mit denselben Modellen nach.',
    },
  ],
  assumptions: [
    'Die Verbraucherliste ist ein Beispiel für einen typischen Tageshaushalt, kein Messwert eines bestimmten Fahrzeugs.',
    'Die Leitungslängen (2,5 m Hauptleitung, 1,5 m Wechselrichter, 2–5 m zu den Verbrauchern) sind Annahmen der Vorlage.',
    'Der spezifische Solardertrag von 3,0 kWh/kWp/Tag ist der Standardwert des Rechners, kein Ertrag für einen bestimmten Standort.',
    'Der Peukert-Faktor wird mit 25 A Dauerstrom angesetzt.',
  ],
  limits: [
    'Die Vorlage kennt keine Landstrom-Einspeisung, keinen FI-Schutz und keine Abnahme.',
    'Alterung, Kälte und unvollständige Ladung der Batterie sind nicht modelliert.',
    'Temperatur, Verschattung und Neigung der Module sind nicht modelliert.',
    'Umfang und Aufwand eines Umbaus von 12 V auf 24 V sind nicht Teil der Rechnung.',
  ],
};
