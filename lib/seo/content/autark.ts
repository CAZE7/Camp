/**
 * lib/seo/content/vorlagen-autark.ts — Vorlagenseite `/vorlagen/autark/`.
 *
 * Ein Fahrzeug, das mehrere Tage ohne Landstrom stehen soll: größere Batterie,
 * mehr Solar, ein Wechselrichter für die wenigen 230-V-Geräte. Die Vorlage
 * zeigt auch, wo diese Rechnung an Grenzen stößt — beim Winterfall und bei den
 * Strömen, die ein Wechselrichter am 12-V-Bordnetz verursacht.
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
    hinweis: 'Der Grundlastposten — er läuft, solange es warm ist.',
  },
  {
    geraet: 'Standheizung (Diesel, Gebläse)',
    watt: 35,
    stunden: 8,
    laengeM: 3,
    hinweis: 'Auch hier nur das Gebläse; der Brenner heizt mit Kraftstoff.',
  },
  {
    geraet: 'Wasserpumpe',
    watt: 60,
    stunden: 0.4,
    laengeM: 5,
    hinweis: 'Kurze Zeit, hohe Leistung, lange Leitung — der kritische Kreis der Vorlage.',
  },
  {
    geraet: 'LED-Beleuchtung',
    watt: 12,
    stunden: 5,
    laengeM: 4,
    hinweis: 'Dauerlicht, 12 W statt 60 W.',
  },
  {
    geraet: 'Laptop über 12-V-Netzteil',
    watt: 65,
    stunden: 4,
    laengeM: 2,
    hinweis: 'Ohne Wechselrichter — ein 12-V-Netzteil gehört in die Stückliste.',
  },
  {
    geraet: 'Kaffeemaschine (230 V, über Wechselrichter)',
    watt: 800,
    stunden: 0.5,
    laengeM: 1.5,
    hinweis: 'Der teuerste Verbraucher der Liste: 800 W am 12-V-Bordnetz sind 66,7 A.',
  },
] as const;

const BILANZ = bilanziere(VERBRAUCHER);
const BATTERIE = batterieRechnung(BILANZ.summeWh, 3, 12);
const SOMMER = solarRechnung(BILANZ.summeWh, 12, 100, false);
const WINTER = solarRechnung(BILANZ.summeWh, 12, 100, true);
const KREISE = kreiseRechnungen(VERBRAUCHER, 12);
const HAUPTLEITUNG = kreisRechnung('Hauptleitung Batterie → Plusverteilung', 960, 2, 12);
const WECHSELRICHTER = kreisRechnung('Wechselrichter 1 200 W an der Batterie', 1200, 1.5, 12);

/** Peukert-korrigierte Nennkapazität: die Größe, die drei volle Tage trägt. */
const MIT_PEUKERT = Math.ceil(BATTERIE.requiredNominalAh / BATTERIE.peukertFactor / 5) * 5;

/** Ausgangsstrom des Ladereglers bei 13,8 V Ladespannung. */
const MPPT_STROM = SOMMER.recommendedPeakWatts / 13.8;

const STUECKLISTE: readonly (readonly string[])[] = [
  [
    'Aufbaubatterie',
    'LiFePO4 12 V, 410 Ah (2 × 205 Ah parallel)',
    '2',
    `Drei Tage ohne Ladung verlangen ${fmt(BATTERIE.requiredNominalAh, 1)} Ah Nennkapazität. Mit Peukert-Korrektur bei 25 A Dauerstrom sind es ${MIT_PEUKERT} Ah — als 2 × 210 Ah die übliche Aufteilung.`,
  ],
  [
    'Batteriehalter und Verbindung',
    'Polklemmen, Sicherung 100 A an der Batterie',
    '1',
    'Der Schutzorgan sitzt am Batteriepol, die Leitung zur Batterie bleibt kurz und ungeschützt.',
  ],
  [
    'Hauptleitung',
    '50 mm² Leitung, 2 m',
    '1',
    `Bei ${fmt(HAUPTLEITUNG.stromA, 0)} A (Laden und größte Verbraucher gleichzeitig) fordert das Modell ${fmt(HAUPTLEITUNG.querschnittMm2, 1)} mm² auf ${fmt(HAUPTLEITUNG.laengeM, 0)} m.`,
  ],
  [
    'Hauptsicherung',
    '80 A, direkt am Batteriepol',
    '1',
    `Die Leitung darf max. ${HAUPTLEITUNG.maxSicherungA} A abgesichert werden.`,
  ],
  [
    'Wechselrichter',
    '1 200 W, 12 V auf 230 V, reine Sinuswelle',
    '1',
    'Für die wenigen 230-V-Geräte. Er muss den Dauerstrom am 12-V-Bordnetz können: 100 A.',
  ],
  [
    'Leitung zum Wechselrichter',
    '70 mm² Leitung, 1,5 m, 100 A Sicherung',
    '1',
    `1 200 W am 12-V-Bordnetz sind ${fmt(WECHSELRICHTER.stromA, 1)} A. Auf ${fmt(WECHSELRICHTER.laengeM, 1)} m fordert das Modell ${fmt(WECHSELRICHTER.querschnittMm2, 1)} mm² — das ist die teuerste Leitung der Vorlage.`,
  ],
  [
    'Solarmodule',
    '100 Wp, 12 V',
    '6',
    `Sommerrechnung: ${fmt(SOMMER.requiredPeakWatts, 0)} Wp nötig, mit 6 Modulen ${SOMMER.recommendedPeakWatts} Wp (Deckung ${fmt(SOMMER.coverageFactor, 2)}).`,
  ],
  [
    'Laderegler',
    'MPPT, 50 A Ausgangsstrom',
    '1',
    `${SOMMER.recommendedPeakWatts} Wp ergeben am Reglerausgang bei 13,8 V Ladespannung ${fmt(MPPT_STROM, 1)} A — ein 30-A-Regler wäre zu klein.`,
  ],
  [
    'Ladegerät am Landstrom',
    '30 A, mit Temperaturkompensation',
    '1',
    `Nachladen im Ladefenster: ${fmt(BATTERIE.chargeCurrentA, 1)} A nach dem Ladezeit-Aufschlag des Modells.`,
  ],
  [
    'Bordnetzverteilung',
    'Fuse-Box mit 6 bis 8 Kreisen, Masseverteilung',
    '1',
    'Jeder Kreis mit eigener Sicherung; die Masse führt an einem Punkt zurück zur Batterie.',
  ],
  ['USB-Netzteil 12 V', '65 W (5 A)', '1', 'Damit Laptop und Handy nicht am Wechselrichter hängen.'],
];

export const VORLAGE_AUTARK: SeoPageContent = {
  path: '/vorlagen/autark/',
  slug: 'autark',
  topicId: 'vorlagen',
  kind: 'cluster',
  title: 'Elektrik-Vorlage Autark-Camper: 3 Tage ohne Landstrom',
  absoluteTitle: true,
  description:
    'Autark-Vorlage für den Camper: 1 474 Wh Tagesbedarf, 410-Ah-Batterie, 600 Wp Solar und ein 1 200-W-Wechselrichter — mit Stückliste und Rechenweg.',
  h1: 'Elektrik-Vorlage: Autark-Camper',
  lead: 'Wer mehrere Tage ohne Campingplatz steht, braucht mehr als eine gute Solaranlage: genug Speicher für die Nacht, Nachladung am Tag und — wenn 230-V-Geräte dazugehören — einen Wechselrichter, dessen Ströme man einkalkuliert. Diese Vorlage rechnet das vollständig durch.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'gedanken',
      heading: 'Wofür diese Vorlage gedacht ist',
      body: [
        'Die Vorlage beschreibt ein Fahrzeug mit zwei bis vier Personen, das drei Tage ohne Landstrom steht und dabei alles nutzt, was ein Wohnmobil hergibt — inklusive einzelner 230-V-Geräte. Die Batterie trägt die Nächte, das Solar den Tag, der Wechselrichter die wenigen Geräte, die 12 V nicht können.',
        'Sie ist eine Ausgangslage, kein fertiges Projekt. Verbraucherliste und Leitungslängen sind Beispiele; der Planer rechnet aus deinen Werten denselben Weg nach.',
      ],
      list: {
        items: [
          'Ziel: drei Tage ohne Landstrom, täglich nachgeladen.',
          'Bordnetz 12 V, eine Batteriebank, ein Wechselrichter für 230 V.',
          'Ladung über 600 Wp Solar und ein 30-A-Ladegerät am Landstrom.',
          'Auslegung im Sommer; der Winterfall steht weiter unten und ist unbequem.',
        ],
      },
      links: [
        {
          href: '/vorlagen/wochenend/',
          label: 'Zur Wochenend-Vorlage',
          description: 'Weniger Verbrauch, kleinere Batterie, kein Wechselrichter.',
        },
        {
          href: '/vorlagen/grossraum/',
          label: 'Zur Vorlage für große Fahrzeuge',
          description: '24-V-Bordnetz — halbierte Ströme, dünnere Leitungen.',
        },
      ],
    },
    {
      id: 'verbrauch',
      heading: 'Verbrauch: mit 230 V wird die Bilanz teurer',
      body: [
        `Der Tagesbedarf dieser Vorlage liegt bei ${fmt(BILANZ.summeWh, 0)} Wh — rund 370 Wh mehr als in der Wochenend-Vorlage. Der Unterschied ist fast vollständig die Kaffeemaschine: 800 W am 12-V-Bordnetz sind 66,7 A, und der Wechselrichter wandelt dabei Strom in Wärme.`,
        'Genau das ist der Punkt, an dem die Planung von 12 V auf 24 V umspringt: Wer dauerhaft 230-V-Geräte betreibt, trägt am 12-V-Bordnetz die vollen Ströme — mit dicken Leitungen, großer Sicherung und einer Batterie, die den Strom liefern muss.',
      ],
      table: {
        caption: 'Beispielhafter Tageshaushalt eines autark fahrenden Campers (12 V)',
        head: ['Verbraucher', 'Leistung', 'Dauer/Tag', 'Energie'],
        rows: BILANZ.rows,
        note: 'Beispielwerte, keine Messwerte.',
      },
      links: [
        {
          href: '/camper-elektrik/wechselrichter/',
          label: 'Wechselrichter auslegen',
          description: 'Wirkungsgrad, Leerlaufverbrauch und der Strom am 12-V-Bordnetz.',
        },
      ],
    },
    {
      id: 'batterie',
      heading: 'Batterie: 410 Ah, mit Peukert auf 415 Ah',
      body: [
        `Drei Tage ohne Ladung sind 3 × ${fmt(BILANZ.summeWh, 0)} Wh = ${fmt(BILANZ.summeWh * 3, 0)} Wh nutzbare Energie. Bei 90 % Entladetiefe und 12 V sind das ${fmt(BATTERIE.requiredNominalAh, 1)} Ah Nennkapazität, aufgerundet auf die übliche Baugröße 410 Ah — praktisch zwei 205-Ah-Batterien parallel.`,
        `Bei 25 A Dauerstrom liegt der Peukert-Faktor bei ${fmt(BATTERIE.peukertFactor, 3)}; die nutzbare Kapazität sinkt damit auf ${fmt(BATTERIE.usableAhOfRecommendation, 1)} Ah (${fmt((BATTERIE.usableAhOfRecommendation * 12) / 1000, 2)} kWh). Für drei volle Tage sind ${MIT_PEUKERT} Ah die ehrliche Größe — also 2 × 210 Ah.`,
        `Nachgeladen wird im Ladefenster: ${fmt(BATTERIE.chargeCurrentA, 1)} A nach dem Ladezeit-Aufschlag des Modells. Das ist der Grund, warum die Stückliste ein 30-A-Ladegerät am Landstrom nennt.`,
      ],
      formula: {
        expression: 'C_nenn = (Bedarf_Wh · Tage) / (U · DoD)',
        caption: `Für diese Vorlage: (${fmt(BILANZ.summeWh, 0)} Wh × 3) / (12 V × 0,90) = ${fmt(BATTERIE.requiredNominalAh, 1)} Ah → 410 Ah als Baugröße, ${MIT_PEUKERT} Ah mit Peukert.`,
      },
      callout: {
        tone: 'warning',
        text: 'Drei Tage Autarkie mit 230-V-Geräten sind eine Batterie- und Gewichtsfrage, keine Kabelfrage. 410 Ah LiFePO4 wiegen je nach Gehäuse gut 100 kg — das gehört in die Fahrzeugbilanz, bevor die Bestellung läuft.',
      },
      links: [
        {
          href: '/rechner/batteriekapazitaet/',
          label: 'Batteriegröße nachrechnen',
          description: 'Eigene Verbrauchszahlen und Autarkietage eingeben.',
        },
      ],
    },
    {
      id: 'solar',
      heading: 'Solar: 600 Wp im Sommer — und der Winter, der nicht aufgeht',
      body: [
        `Mit 100-Wp-Modulen und dem Ertragssatz von 3,0 kWh je kWp und Tag fordert die Rechnung ${fmt(SOMMER.requiredPeakWatts, 0)} Wp: 6 Module, ${SOMMER.recommendedPeakWatts} Wp. Das deckt den Tagesbedarf ${fmt(SOMMER.coverageFactor, 2)}-fach.`,
        `Im Winter liegt der Ertrag bei 35 % des Sommerwerts. Die Rechnung fordert dann ${fmt(WINTER.requiredPeakWatts, 0)} Wp, also ${WINTER.panelCount} Module — das ist auf einem Camperdach nicht unterzubringen. Die ehrliche Konsequenz: Winterautarkie kommt nicht vom Dach, sondern vom Laden während der Fahrt und vom Landstrom.`,
      ],
      table: {
        caption: 'Was die Solaranlage im Jahr leistet (100-Wp-Module, 12 V)',
        head: ['Dachfläche', 'Sommerertrag', 'Deckung', 'Winterertrag', 'Deckung'],
        rows: [
          [
            '4 × 100 Wp',
            `${fmt(solarErtrag(400, BILANZ.summeWh, 12, 100, false).ertragWh, 0)} Wh`,
            fmt(solarErtrag(400, BILANZ.summeWh, 12, 100, false).deckung, 2),
            `${fmt(solarErtrag(400, BILANZ.summeWh, 12, 100, true).ertragWh, 0)} Wh`,
            fmt(solarErtrag(400, BILANZ.summeWh, 12, 100, true).deckung, 2),
          ],
          [
            '6 × 100 Wp (Empfehlung)',
            `${fmt(solarErtrag(600, BILANZ.summeWh, 12, 100, false).ertragWh, 0)} Wh`,
            fmt(solarErtrag(600, BILANZ.summeWh, 12, 100, false).deckung, 2),
            `${fmt(solarErtrag(600, BILANZ.summeWh, 12, 100, true).ertragWh, 0)} Wh`,
            fmt(solarErtrag(600, BILANZ.summeWh, 12, 100, true).deckung, 2),
          ],
        ],
        note: 'Ertrag je Modulleistung nach dem Standard des Solaranlage-Rechners. Keine Prognose für einen bestimmten Standort.',
      },
      callout: {
        tone: 'info',
        text: `${SOMMER.recommendedPeakWatts} Wp ergeben am Laderegler-Ausgang bei 13,8 V Ladespannung ${fmt(MPPT_STROM, 1)} A. Die Stückliste nennt deshalb einen MPPT mit 50 A.`,
      },
      links: [
        {
          href: '/tools/dach/',
          label: 'Panels auf dem Dach platzieren',
          description: 'Wie viel Fläche das Dach wirklich hergibt.',
        },
        {
          href: '/camper-elektrik/solar/',
          label: 'Solar im Camper auslegen',
          description: 'Sommer und Winter getrennt gerechnet.',
        },
      ],
    },
    {
      id: 'wechselrichter',
      heading: 'Der Wechselrichter und seine Ströme',
      body: [
        `Ein 1 200-W-Wechselrichter am 12-V-Bordnetz zieht ${fmt(WECHSELRICHTER.stromA, 1)} A. Auf ${fmt(WECHSELRICHTER.laengeM, 1)} m Leitungslänge fordert das Modell dafür ${fmt(WECHSELRICHTER.querschnittMm2, 1)} mm² — und eine Sicherung von ${fmt(WECHSELRICHTER.sicherungA, 0)} A.`,
        'Das ist die teuerste Leitung der gesamten Vorlage, und sie hängt an einem optionalen Gerät. Wer die Kaffeemaschine durch ein 12-V-Netzteil ersetzt, spart nicht nur den Wechselrichter, sondern diese Leitung, die Sicherung und die Batterielast.',
        'Der Wechselrichter selbst muss eine reine Sinuswelle liefern; für sensible Elektronik ist das der Unterschied zwischen „geht" und „geht nicht".',
      ],
      table: {
        caption: 'Kreise der Vorlage (12 V)',
        head: ['Kreis', 'Strom', 'Länge', 'Querschnitt', 'I_z', 'Sicherung'],
        rows: [...KREISE.map(kreisZeile), kreisZeile(HAUPTLEITUNG), kreisZeile(WECHSELRICHTER)],
        note: 'Querschnitt nach Spannungsfall und Belastbarkeit, Sicherung nach der Leitung. Längen sind Annahmen der Vorlage.',
      },
      links: [
        {
          href: '/camper-elektrik/230v/',
          label: '230 V im Fahrzeug',
          description: 'Einspeisung, FI-Schutz und Abnahme — Facharbeiten.',
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
        caption: 'Stückliste der Vorlage „Autark-Camper"',
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
          'Kein Winter ohne Nachladung: Der Winterfall dieser Vorlage ist mit Solar nicht erreichbar.',
          'Keine Aussage zur 230-V-Einspeisung: FI-Schutz, Steckdose und Abnahme sind Facharbeiten.',
          'Kein Gewichts- und Raumkonzept: 410 Ah LiFePO4 sind ein erheblicher Brocken.',
          'Keine Materialfestlegung: Leitungstyp, Aderquerschnitt und Stecker sind je nach Fahrzeug zu wählen.',
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
      question: 'Wie viel Solar braucht ein autarker Camper im Winter?',
      answer:
        'Nach dem Modell 1 700 Wp bei 1 474 Wh Tagesbedarf und 35 % Winterertrag — 17 Module mit je 100 Wp. Das passt nicht auf ein Camperdach. Winterautarkie entsteht deshalb durch Laden während der Fahrt und Landstrom, nicht durch mehr Panels.',
    },
    {
      question: 'Lohnt sich 24 V statt 12 V für diese Vorlage?',
      answer:
        'Bei dauerhaftem 230-V-Betrieb ja: Der 1 200-W-Wechselrichter zieht am 12-V-Bordnetz 100 A und fordert 70 mm² Leitung. Am 24-V-Bordnetz wären es 50 A und gut 35 mm². Die Vorlage für große Fahrzeuge rechnet genau das durch.',
    },
    {
      question: 'Warum ist die Wechselrichterleitung dicker als die Hauptleitung?',
      answer:
        'Weil am Wechselrichter der volle Strom im Wechselrichter fließt: 1 200 W an 12 V sind 100 A, auf 1,5 m Weg fordert das Modell 70 mm². Die Hauptleitung der Vorlage ist mit 50 mm² dünner, weil sie den Verbrauch verteilt statt ihn zu bündeln.',
    },
    {
      question: 'Reichen 410 Ah wirklich für drei Tage?',
      answer:
        'Nach Entladetiefe ja: 410 Ah an 12 V sind 4 920 Wh Nennenergie, davon 90 % nutzbar. Bei 25 A Dauerstrom greift der Peukert-Effekt: 365,4 Ah bleiben, also 4,38 kWh — knapp unter den 4,42 kWh für drei Tage dieses Verbrauchs. Mit 415 Ah ist die Rechnung eingehalten.',
    },
  ],
  related: [
    { href: '/vorlagen/wochenend/', label: 'Vorlage: Wochenend-Camper (2 Tage, ohne 230 V)' },
    { href: '/vorlagen/grossraum/', label: 'Vorlage: Großraum-Camper (24 V)' },
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/wechselrichter/', label: 'Wechselrichter auslegen' },
    { href: '/rechner/solaranlage/', label: 'Solaranlage berechnen' },
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
    'Die Leitungslängen (2 m Hauptleitung, 1,5 m Wechselrichter, 3–5 m zu den Verbrauchern) sind Annahmen der Vorlage.',
    'Der spezifische Solardertrag von 3,0 kWh/kWp/Tag ist der Standardwert des Rechners, kein Ertrag für einen bestimmten Standort.',
    'Der Peukert-Faktor wird mit 25 A Dauerstrom angesetzt.',
  ],
  limits: [
    'Die Vorlage kennt keine Landstrom-Einspeisung, keinen FI-Schutz und keine Abnahme.',
    'Alterung, Kälte und unvollständige Ladung der Batterie sind nicht modelliert.',
    'Temperatur, Verschattung und Neigung der Module sind nicht modelliert.',
    'Gewicht, Bauraum und Fahrzeugtauglichkeit der Batteriebank sind nicht Teil der Rechnung.',
  ],
};
