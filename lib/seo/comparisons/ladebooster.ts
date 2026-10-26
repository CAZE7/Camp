/**
 * lib/seo/comparisons/ladebooster.ts — die neun Geräte des Ladebooster-Vergleichs.
 *
 * Einzige Quelle für Rangliste, Produktkarten, Einsatzfälle und strukturierte
 * Beschreibung. Vorher standen dieselben Geräte viermal von Hand im JSX
 * (`LadeboosterVergleich.tsx`: Leiter, Tabelle, Detailkarten, Kompaktkarten),
 * und eine Preisänderung war ein Suchspiel über vier Stellen.
 *
 * Herkunft der Werte: Herstellerdatenblätter und Handbücher, Forenthreads und
 * beobachtete Händlerpreise, Stichtag 23.10.2026. Alle Belege stehen in
 * `sources`; die Geräte wurden nicht unter identischen Bedingungen gemessen.
 *
 * Was hier bewusst NICHT steht: Bewertungen, Noten, Sterne. Die Seite verkauft
 * nichts und enthält keine Affiliate-Links — das ist in `noRatingNote` sichtbar
 * und bleibt es.
 */

import type { ComparisonSpec } from './types';

/** Herstellerangaben, je Gerät ein Beleg. */
const QUELLEN_HERSTELLER = [
  {
    href: 'https://www.victronenergy.de/upload/documents/Datasheet-Orion-Tr-Smart-DC-DC-chargers-non-isolated-360-400W-DE.pdf',
    label: 'Victron Orion-Tr Smart, Datenblatt',
    kind: 'datasheet',
  },
  {
    href: 'https://www.offgridtec.com/media/product_attachements/Votronic_VCC_3326-3328-3329_Bedienungsanleitung.pdf',
    label: 'Votronic VCC 1212-50/70/90, Montageanleitung',
    kind: 'manual',
  },
  {
    href: 'https://www.ective.de/mediafiles/Datenblatt/ective/ladebooster/ECTIVE-BB%2BSBB-Bedienungsanleitung-DE-2026-02-27.pdf',
    label: 'ECTIVE BB/SBB, Bedienungsanleitung',
    kind: 'manual',
  },
  {
    href: 'https://www.ivt-hirschau.de/media/products/920000_Bedienungsanleitung_Ladebooster-SCHAUDT-WA121545.pdf',
    label: 'Schaudt WA 121545, Bedienungsanleitung',
    kind: 'manual',
  },
  {
    href: 'https://www.ivt-hirschau.de/de/Ladebooster-SCHAUDT-WA-121525::1216.html',
    label: 'Schaudt WA 121525, Produktseite',
    kind: 'datasheet',
  },
  {
    href: 'https://www.buettner-elektronik.de/produkte/lade-booster/produkt/show/mt-bcb-30-40-60.html',
    label: 'Büttner MT BCB 30/40/60, Produktseite',
    kind: 'datasheet',
  },
  {
    href: 'https://de.renogy.com/cdn/shop/files/RBC30D1S-G3_G4_RBC50D1S-G6_DC-DC_with_MPPT_EN__UM_B4.pdf',
    label: 'Renogy RBC30/50, Handbuch',
    kind: 'manual',
  },
  {
    href: 'https://sterling-power.com/products/bb12120-reverse-charging-jump-start-assistance',
    label: 'Sterling BB12120, Produktseite',
    kind: 'datasheet',
  },
  {
    href: 'https://cdn.shopify.com/s/files/1/0658/7343/files/Collated_manual_6fe055ef-bac9-46fd-bb51-662f1bfe0d15.pdf',
    label: 'Sterling Saturn, Handbuch',
    kind: 'manual',
  },
  {
    href: 'https://www.victronenergy.com/dc-dc-converters/buck-boost-dc-dc-converter-25a-50a',
    label: 'Victron Buck-Boost 25/50/100 A, Produktseite',
    kind: 'datasheet',
  },
] as const;

/** Foren und Einbauberichte — Praxisfälle, keine Messwerte. */
const QUELLEN_FOREN = [
  {
    href: 'https://communityarchive.victronenergy.com/questions/78315/warum-arbeitet-nur-eins-der-beiden-parallel-gescha.html',
    label: 'Victron Community: zwei Orion parallel',
    kind: 'report',
  },
  {
    href: 'https://www.wohnmobilforum.de/w-t157920.html',
    label: 'Wohnmobilforum: zwei Orion einbauen',
    kind: 'report',
  },
  {
    href: 'https://diysolarforum.com/threads/victron-orion-tr-smart-12-12-30-chargers-hooked-in-parallel.36336/',
    label: 'DIY Solar: Orion parallel, keine 60 A',
    kind: 'report',
  },
  {
    href: 'https://www.vanovizen.de/ladebooster-bei-euro-6-ducato-baujahr-2022-mit-intelligenter-lichtmaschine/',
    label: 'Vanovizen: Euro-6-Ducato und D+',
    kind: 'report',
  },
  {
    href: 'https://www.sprinter-forum.de/viewtopic.php?t=27536&start=30',
    label: 'Sprinter-Forum: D+ abgreifen',
    kind: 'report',
  },
  {
    href: 'https://www.wohnmobilforum.de/w-t141571.html',
    label: 'Wohnmobilforum: Schaudt WA 121525 und LiFePO4',
    kind: 'report',
  },
  {
    href: 'https://diysolarforum.com/threads/renogy-50a-dc-dc-mppt-charging-profile-w-engine-on.65496/',
    label: 'DIY Solar: Renogy 50 A geteilt',
    kind: 'report',
  },
  {
    href: 'https://www.segeln-forum.de/thread/83239-votronic-ladebooster-vcc-1212-70-an-115a-lichtmaschine-z-b-vp-d1-20-oder-d1-30/',
    label: 'Segeln-Forum: Votronic 90 an 90-A-Lima',
    kind: 'report',
  },
  {
    href: 'https://www.sprinter-forum.de/viewtopic.php?t=23955',
    label: 'Sprinter-Forum: Votronic 70, zwei Jahre',
    kind: 'report',
  },
  {
    href: 'https://www.wohnmobilforum.de/w-t126938.html',
    label: 'Wohnmobilforum: Votronic 90 im Ducato',
    kind: 'report',
  },
  {
    href: 'https://www.digicamper.com/forum/index.php?thread/42674-ladebooster-sterling-power-bbw12120/',
    label: 'Digicamper: Sterling BB12120 ohne Antwort',
    kind: 'report',
  },
] as const;

/** Beobachtete Händlerpreise am Stichtag. */
const QUELLEN_PREISE = [
  {
    href: 'https://www.camping-factory.com/votronic-ladewandler-vcc-1212-90',
    label: 'Camping-Factory: Votronic 90, 500,59 €',
    kind: 'price',
  },
  {
    href: 'https://voltimax.de/en/Votronic-3329-VCC-1212-90-12V-to-12V-90A-charging-booster-charging-converter/V3363',
    label: 'VoltiMax: Votronic 90, 555,50 €',
    kind: 'price',
  },
  {
    href: 'https://www.ivt-hirschau.de/de/Ladebooster-SCHAUDT-WA-121545-inkl-Anschluss-und-Temperaturfuehler-Set::1217.html',
    label: 'IVT: Schaudt 121545, 575 €',
    kind: 'price',
  },
  {
    href: 'https://www.ivt-hirschau.de/de/Ladebooster-SCHAUDT-WA-121525::1216.html',
    label: 'IVT: Schaudt 121525, 232,35 €',
    kind: 'price',
  },
  {
    href: 'https://www.ective.de/ladetechnik/ladebooster/bb-60-12v-auf-12v-ladebooster-60a',
    label: 'ECTIVE: BB 60, 292 €',
    kind: 'price',
  },
  {
    href: 'https://www.idealo.de/preisvergleich/OffersOfProduct/201945849_-bb-60-tn4545-ective-batteries.html',
    label: 'idealo: ECTIVE BB 60 ab 260,30 €',
    kind: 'price',
  },
  {
    href: 'https://www.campingwagner.de/de/p/buettner-elektronik-bcb-iuou-lader-booster-kombination-batterie-control-booster_m7469',
    label: 'CampingWagner: Büttner 25/20, 702 €',
    kind: 'price',
  },
  {
    href: 'https://de.renogy.com/products/dc-zu-dc-laderegler-mppt-12v-50a-fur-batterie',
    label: 'Renogy: 50 A, 209,99 €',
    kind: 'price',
  },
  {
    href: 'https://www.yachtbatterie.de/de/sterling-power-batterie-batterie-lader-bidirektional.html',
    label: 'Yachtbatterie: Sterling BB12120, 710,91 €',
    kind: 'price',
  },
  {
    href: 'https://lepper-marine.de/Sterling-Hochleistungs-B2B-Ladegeraet-Typ-BB12120-Batterie-zu-Batterie/7170-9',
    label: 'Lepper Marine: Sterling BB12120, 746,90 €',
    kind: 'price',
  },
  {
    href: 'https://shop4akku.de/hersteller/victron-energy/dc-dc-wandler/',
    label: 'shop4akku: Victron Buck-Boost 100 A, 794,99 €',
    kind: 'price',
  },
  {
    href: 'https://geizhals.de/victron-energy-orion-tr-smart-dc-dc-ladebooster-isoliert-12-12-30-ori121236120-a2523163.html',
    label: 'Geizhals: Orion 30 A isoliert',
    kind: 'price',
  },
  {
    href: 'https://www.idealo.at/preisvergleich/OffersOfProduct/202088593_-orion-tr-smart-12-12-30a-360-w-victron.html',
    label: 'idealo.at: Orion 30 A nicht isoliert',
    kind: 'price',
  },
] as const;

export const LADEBOOSTER_VERGLEICH: ComparisonSpec = {
  id: 'ladebooster',
  heading: 'Ladebooster im Vergleich: 30, 60 oder 90 A?',
  tableLabel: 'Geräteüberblick',
  tableCaption: 'Neun Ladebooster von 30 bis 120 A, sortierbar nach Ladestrom und Preis.',
  noRatingNote:
    'Keine Sterne, keine Noten, kein Testsieger. Die Rangliste nennt Daten, Preise und die Punkte, an denen ich hängen geblieben bin. Diese Seite enthält keine Affiliate-Links und keine Shop-Empfehlung.',
  priceAsOf:
    'Preisstand 23.10.2026, inklusive MwSt., sofern der Händler nichts anderes angibt. Momentaufnahmen, keine Live-Preise.',
  priceAsOfDate: '2026-10-23',

  attributes: [
    {
      id: 'ladestrom',
      label: 'Ladestrom',
      inTable: true,
      sortierbar: 'strom',
      legend: 'Dauerstrom an die Bordbatterie — nicht der Eingangsstrom der Lichtmaschine.',
    },
    {
      id: 'dplus',
      label: 'D+ / Euro 6',
      inTable: true,
      legend:
        'Ob das Gerät eine Steuerleitung braucht. Intelligente Lichtmaschinen regeln die Spannung fahrzustandsabhängig herunter.',
    },
    {
      id: 'batterie',
      label: 'Batteriebereich',
      inTable: false,
      legend: 'Vom Hersteller freigegebene Kapazität der Bordbatterie.',
    },
    {
      id: 'ladespannung',
      label: 'LiFePO4-Spannungen',
      inTable: false,
    },
    {
      id: 'kabel',
      label: 'Zuleitung',
      inTable: false,
      legend: 'Herstellerempfehlung. Gerechnet wird die Zuleitung mit dem Eingangsstrom.',
    },
    {
      id: 'wirkungsgrad',
      label: 'Wirkungsgrad',
      inTable: false,
    },
    {
      id: 'zulassung',
      label: 'Zulassung',
      inTable: false,
    },
    {
      id: 'masse',
      label: 'Maße / Gewicht',
      inTable: false,
    },
  ],

  classes: [
    { id: '30', label: '30 A' },
    { id: '50-70', label: '50–70 A' },
    { id: '90', label: '90 A und mehr' },
  ],

  products: [
    {
      id: 'orion-tr-smart-12-12-30',
      brand: 'Victron Energy',
      name: 'Orion-Tr Smart 12/12-30',
      classId: '30',
      specs: {
        ladestrom: '30 A bei 40 °C',
        dplus: 'nein — Spannungserkennung',
        batterie: null,
        ladespannung: null,
        kabel: 'max. 16 mm²',
        wirkungsgrad: '87 %',
        zulassung: null,
        masse: '130 × 186 × 70 mm · 1,8 kg',
      },
      fit: { label: 'kleine Bank, kurze Fahrten', tone: 'plain' },
      caveats: [{ text: 'Die 16-mm²-Klemmen sind die harte Grenze.', tone: 'warn' }],
      stromA: 30,
      priceEur: 150,
      priceChecked: '2026-10-23',
      detail: ['Spitze 40 A für 10 s, Leistung 430 W / 360 W. Bluetooth-Konfiguration.'],
      links: [
        {
          href: 'https://www.victronenergy.de/upload/documents/Datasheet-Orion-Tr-Smart-DC-DC-chargers-non-isolated-360-400W-DE.pdf',
          label: 'Datenblatt',
          kind: 'datasheet',
        },
        {
          href: 'https://communityarchive.victronenergy.com/questions/78315/warum-arbeitet-nur-eins-der-beiden-parallel-gescha.html',
          label: 'Forum: Parallelbetrieb',
          kind: 'report',
        },
      ],
    },
    {
      id: 'ective-bb-60',
      brand: 'ECTIVE',
      name: 'BB 60',
      classId: '50-70',
      specs: {
        ladestrom: '60 A',
        dplus: 'ja — 8–16 V, erforderlich',
        batterie: '90–560 Ah LiFePO4 · Starter min. 100 Ah',
        ladespannung: '13,9 / 14,2 / 14,4 / 14,6 V',
        kabel: null,
        wirkungsgrad: null,
        zulassung: 'ECE R10',
        masse: '215 × 190 × 70 mm · 1,6–1,7 kg',
      },
      fit: { label: '200–400 Ah LiFePO4', tone: 'pick' },
      caveats: [{ text: 'D+ muss vorhanden sein oder über einen Simulator kommen.', tone: 'warn' }],
      stromA: 60,
      priceEur: 260,
      priceChecked: '2026-10-23',
      detail: [
        'UVP 292 €, im Preisvergleich ab 260,30 €. Die Produkthistorie ist jünger als bei Schaudt oder Votronic — eine Datenlage, kein Qualitätsurteil.',
      ],
      links: [
        {
          href: 'https://www.ective.de/ladetechnik/ladebooster/bb-60-12v-auf-12v-ladebooster-60a',
          label: 'Herstellerseite',
          kind: 'price',
        },
        {
          href: 'https://www.ective.de/mediafiles/Datenblatt/ective/ladebooster/ECTIVE-BB%2BSBB-Bedienungsanleitung-DE-2026-02-27.pdf',
          label: 'Handbuch',
          kind: 'manual',
        },
      ],
    },
    {
      id: 'renogy-50a-dc-dc-mppt',
      brand: 'Renogy',
      name: '50 A DC/DC mit MPPT',
      classId: '50-70',
      specs: {
        ladestrom: '50 A gesamt über beide Quellen',
        dplus: 'IGN-Anschluss',
        batterie: null,
        ladespannung: null,
        kabel: null,
        wirkungsgrad: null,
        zulassung: null,
        masse: null,
      },
      fit: { label: 'Solar und Lima in einem Gerät', tone: 'plain' },
      caveats: [{ text: 'Im Hybridbetrieb liefert jede Quelle maximal 25 A.', tone: 'warn' }],
      stromA: 50,
      priceEur: 169,
      priceChecked: '2026-10-23',
      detail: ['Beobachtet ab 169 €, der Herstellershop nannte am selben Stichtag 209,99 €.'],
      links: [
        {
          href: 'https://de.renogy.com/cdn/shop/files/RBC30D1S-G3_G4_RBC50D1S-G6_DC-DC_with_MPPT_EN__UM_B4.pdf',
          label: 'Handbuch',
          kind: 'manual',
        },
        {
          href: 'https://diysolarforum.com/threads/renogy-50a-dc-dc-mppt-charging-profile-w-engine-on.65496/',
          label: 'Thread: 50 A geteilt',
          kind: 'report',
        },
      ],
    },
    {
      id: 'schaudt-wa-121545',
      brand: 'Schaudt / Lippert',
      name: 'WA 121545',
      classId: '50-70',
      specs: {
        ladestrom: '45 / 55 / 63 / 70 A',
        dplus: 'ja — bei Euro 6 erforderlich',
        batterie: '80–700 Ah',
        ladespannung: 'Lithium fest 14,4 V',
        kabel: null,
        wirkungsgrad: '93 %',
        zulassung: null,
        masse: '160 × 79 × 160 mm · 1,15 kg',
      },
      fit: { label: 'OEM-naher Einbau', tone: 'plain' },
      caveats: [
        { text: 'Lithium nur mit festen 14,4 V — wer 14,6 V braucht, ist hier falsch.', tone: 'warn' },
      ],
      stromA: 70,
      priceEur: 575,
      priceChecked: '2026-10-23',
      detail: ['Eingang 12–15 V, Temperaturfühler im Lieferumfang. Preis pro Ampere: rund 8,20 € bei 70 A.'],
      links: [
        {
          href: 'https://www.ivt-hirschau.de/media/products/920000_Bedienungsanleitung_Ladebooster-SCHAUDT-WA121545.pdf',
          label: 'Handbuch',
          kind: 'manual',
        },
        {
          href: 'https://www.ivt-hirschau.de/de/Ladebooster-SCHAUDT-WA-121545-inkl-Anschluss-und-Temperaturfuehler-Set::1217.html',
          label: 'Preis / Händler',
          kind: 'price',
        },
      ],
    },
    {
      id: 'votronic-vcc-1212-90',
      brand: 'Votronic',
      name: 'VCC 1212-90',
      classId: '90',
      specs: {
        ladestrom: '90 A, drosselbar auf 75 A',
        dplus: 'optional — D+, Zündung oder Spannung',
        batterie: '150–600 Ah, optional 800 Ah',
        ladespannung: '13,9 / 14,2 / 14,4 / 14,6 V',
        kabel: '25 mm² bis 6 m, 35 mm² bis 9 m',
        wirkungsgrad: null,
        zulassung: null,
        masse: '234 × 139 × 74 mm · 1,48 kg',
      },
      fit: { label: 'große Bank, drosselbar', tone: 'pick' },
      caveats: [
        { text: '25/35 mm² und Luft für den Lüfter sind Pflicht.', tone: 'warn' },
        { text: 'Zum 90er gibt es Kurzberichte, aber keine unabhängige Messreihe.', tone: 'warn' },
      ],
      stromA: 90,
      priceEur: 501,
      priceChecked: '2026-10-23',
      detail: [
        'Eingang 1.350 W, maximal 125 A, Temperaturfühler im Lieferumfang. Straßenpreis 500–555 €, eigener Kaufpreis 380 € im Oktober 2026.',
      ],
      links: [
        {
          href: 'https://www.offgridtec.com/media/product_attachements/Votronic_VCC_3326-3328-3329_Bedienungsanleitung.pdf',
          label: 'Handbuch',
          kind: 'manual',
        },
        {
          href: 'https://www.sprinter-forum.de/viewtopic.php?t=23955',
          label: 'Langzeitbericht 70 A',
          kind: 'report',
        },
        {
          href: 'https://www.wohnmobilforum.de/w-t126938.html',
          label: 'Kurzbericht 90 A',
          kind: 'report',
        },
      ],
    },
    {
      id: 'buettner-mt-bcb',
      brand: 'Büttner Elektronik',
      name: 'MT BCB',
      classId: '50-70',
      specs: {
        ladestrom: '20–60 A plus 230-V-Lader',
        dplus: 'ja',
        batterie: null,
        ladespannung: null,
        kabel: null,
        wirkungsgrad: null,
        zulassung: null,
        masse: null,
      },
      fit: { label: '3-in-1 mit Netzteil', tone: 'plain' },
      caveats: [{ text: 'Kein 90-A-Modell; in Fahrzeugen mit EBL Einschränkungen.', tone: 'warn' }],
      stromA: 60,
      priceEur: 702,
      priceChecked: '2026-10-23',
      detail: [
        'Beim 40/40/30 muss in Fahrzeugen mit EBL auf 30 A begrenzt werden; der 30/30/20 braucht ein Hochlastrelais. 702–1.289 € je nach Modell.',
      ],
      links: [
        {
          href: 'https://www.buettner-elektronik.de/produkte/lade-booster/produkt/show/mt-bcb-30-40-60.html',
          label: 'Produktseite',
          kind: 'datasheet',
        },
        {
          href: 'https://www.campingwagner.de/de/p/buettner-elektronik-bcb-iuou-lader-booster-kombination-batterie-control-booster_m7469',
          label: 'Preis / Händler',
          kind: 'price',
        },
      ],
    },
    {
      id: 'sterling-saturn-bb12120',
      brand: 'Sterling Power',
      name: 'Saturn BB12120',
      classId: '90',
      specs: {
        ladestrom: '110–120 A',
        dplus: 'nein',
        batterie: null,
        ladespannung: null,
        kabel: '35 mm² / 150 A',
        wirkungsgrad: null,
        zulassung: null,
        masse: null,
      },
      fit: { label: 'maximaler Strom ohne D+', tone: 'plain' },
      caveats: [
        {
          text: 'Die Produktseite nennt 120 A und 1.620 W, das Handbuch 110 A bei 14,41 V.',
          tone: 'block',
        },
      ],
      stromA: 110,
      priceEur: 711,
      priceChecked: '2026-10-23',
      detail: [
        'Bidirektional, auch als Starthilfe nutzbar. In Deutschland 711–747 €; ein deutscher Einbaubericht zu genau diesem Modell war nicht auffindbar.',
      ],
      links: [
        {
          href: 'https://sterling-power.com/products/bb12120-reverse-charging-jump-start-assistance',
          label: 'Produktseite',
          kind: 'datasheet',
        },
        {
          href: 'https://www.yachtbatterie.de/de/sterling-power-batterie-batterie-lader-bidirektional.html',
          label: 'Preis / Händler',
          kind: 'price',
        },
      ],
    },
    {
      id: 'victron-buck-boost-100a',
      brand: 'Victron Energy',
      name: 'Buck-Boost 100 A',
      classId: '90',
      specs: {
        ladestrom: '100 A',
        dplus: 'programmierbar',
        batterie: null,
        ladespannung: null,
        kabel: null,
        wirkungsgrad: null,
        zulassung: null,
        masse: null,
      },
      fit: { label: 'gewachsenes Victron-System', tone: 'plain' },
      caveats: [{ text: 'Für eine einfache Nachrüstung zu teuer und zu komplex.', tone: 'warn' }],
      stromA: 100,
      priceEur: 795,
      priceChecked: '2026-10-23',
      detail: ['Für 12- und 24-V-Systeme, im Victron-Verbund mit Monitoring.'],
      links: [
        {
          href: 'https://www.victronenergy.com/dc-dc-converters/buck-boost-dc-dc-converter-25a-50a',
          label: 'Produktseite',
          kind: 'datasheet',
        },
        {
          href: 'https://shop4akku.de/hersteller/victron-energy/dc-dc-wandler/',
          label: 'Preis / Händler',
          kind: 'price',
        },
      ],
    },
    {
      id: 'import-ungebrandet',
      brand: 'Marktplatz',
      name: 'Ungebrandeter Import',
      classId: '90',
      specs: {
        ladestrom: '110–120 A (angeblich)',
        dplus: 'je nach Gerät',
        batterie: null,
        ladespannung: null,
        kabel: null,
        wirkungsgrad: null,
        zulassung: null,
        masse: null,
      },
      fit: { label: 'Risikokauf', tone: 'plain' },
      caveats: [
        {
          text: 'Datenblatt, Firmware und Dauerleistung nicht prüfbar; kein Ansprechpartner, keine Gewährleistung.',
          tone: 'block',
        },
      ],
      stromA: null,
      priceEur: 180,
      priceChecked: '2026-10-23',
      detail: [
        'Angebote um 180 € für Geräte, die äußerlich und laut Datenblatt einem 110–120-A-Wandler entsprechen. Rechnerisch war das der günstigste Wert im ganzen Vergleich — genommen habe ich ihn trotzdem nicht. Das war eine Risikoentscheidung, keine technische: Im Fehlerfall gab es keinen Ansprechpartner und keine realistische Rücksendung.',
        'Ein unabhängiger Test zu diesen Geräten war nicht auffindbar. Die Aussage bleibt eine Beobachtung, kein Messergebnis.',
      ],
      links: [],
    },
  ],

  useCases: [
    {
      id: 'einstieg',
      situation: '100–200 Ah, kurze Fahrten, Solar stützt',
      pickId: 'orion-tr-smart-12-12-30',
      why: '30 A reichen für diese Bank, und die Zuleitung bleibt bei 16 mm² bezahlbar.',
    },
    {
      id: 'standard',
      situation: '200–400 Ah LiFePO4, Kühlschrank, Licht, Laptop',
      pickId: 'ective-bb-60',
      why: '60 A sind an 330 Ah 0,18 C — im Datenblattfenster, ohne dicke Kabel.',
    },
    {
      id: 'reserve',
      situation: '300–600 Ah, Induktion oder Winterbetrieb',
      pickId: 'votronic-vcc-1212-90',
      why: '90 A Reserve, auf 75 A drosselbar, sobald die Lichtmaschine an ihre Grenze kommt.',
    },
    {
      id: 'kombi',
      situation: 'Solar und Lichtmaschine, wenig Platz im Technikfach',
      pickId: 'renogy-50a-dc-dc-mppt',
      why: 'Ein Gehäuse für beide Quellen — die 50 A teilen sich allerdings zwischen ihnen auf.',
    },
  ],

  sources: [
    { group: 'Hersteller', entries: QUELLEN_HERSTELLER },
    { group: 'Foren & Praxis', entries: QUELLEN_FOREN },
    { group: 'Preise', entries: QUELLEN_PREISE },
  ],
};
