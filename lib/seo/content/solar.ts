/**
 * lib/seo/content/solar.ts — Cluster-Seite `/camper-elektrik/solar/`.
 *
 * Die Beispielrechnungen kommen aus `sizeSolarArray` (lib/solarSizing.ts) —
 * inklusive des Winterfalls, der in Prospekten gern fehlt.
 */

import { sizeSolarArray } from '@/lib/solarSizing';
import { VDE_SOLAR_WINTER_REDUCTION } from '@/lib/vde-standards';

import type { SeoPageContent } from '../types';

const DAILY_WH = 1000;
const summer = sizeSolarArray({ dailyEnergyWh: DAILY_WH, systemVoltageV: 12, panelWatts: 100 });
const winter = sizeSolarArray({
  dailyEnergyWh: DAILY_WH,
  systemVoltageV: 12,
  panelWatts: 100,
  winterDesign: true,
});

const SEASON_ROWS = [
  [
    'Sommer (Juni–August)',
    '1,00',
    `${summer.effectiveYieldKwhPerKwpDay.toFixed(1).replace('.', ',')} kWh/kWp/Tag`,
    `${summer.recommendedPeakWatts} Wp (${summer.panelCount} × 100 Wp)`,
  ],
  [
    'Übergangszeit (April/Mai, September)',
    'rund 0,6',
    `${(summer.effectiveYieldKwhPerKwpDay * 0.6).toFixed(1).replace('.', ',')} kWh/kWp/Tag`,
    'rund 600 Wp',
  ],
  [
    `Winter (Dezember/Januar)`,
    `${VDE_SOLAR_WINTER_REDUCTION.toFixed(2).replace('.', ',')}`,
    `${winter.effectiveYieldKwhPerKwpDay.toFixed(2).replace('.', ',')} kWh/kWp/Tag`,
    `${winter.recommendedPeakWatts} Wp (${winter.panelCount} × 100 Wp)`,
  ],
];

export const SOLAR_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/solar/',
  slug: 'solar',
  topicId: 'solar',
  kind: 'cluster',
  title: 'Solar im Camper auslegen: Wie viel Watt braucht mein Dach?',
  absoluteTitle: true,
  description:
    'Solaranlage im Camper berechnen: Modulleistung aus Tagesbedarf und Ertrag, Winterfall, Verschattung und Laderegler — mit Beispielrechnung.',
  h1: 'Solaranlage im Camper auslegen',
  lead: 'Die Frage „wie viel Watt passen aufs Dach?" ist die falsche Reihenfolge. Zuerst steht der Tagesbedarf, dann der Ertrag am Einbauort — erst danach die Frage, ob die Fläche reicht.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'rechner',
      heading: 'Modulleistung aus dem Tagesbedarf berechnen',
      body: [
        'Der Rechner nimmt den Tagesbedarf in Wattstunden, den spezifischen Ertrag am Standort, die Modulgröße und die Jahreszeit. Er liefert die nötige Leistung in Watt peak, die Panelanzahl und den erwarteten Ladestrom.',
      ],
      calculator: 'solaranlage',
    },
    {
      id: 'ertrag',
      heading: 'Ertrag: die Zahl, die über die Auslegung entscheidet',
      body: [
        'Ein Solarmodul mit 100 Wp liefert nicht 100 W — nur bei Einstrahlung, Zelltemperatur und Sonnenstand nach Standardbedingungen (STC: 1 000 W/m², 25 °C). Über einen Tag kommen davon je nach Standort und Jahreszeit deutlich weniger an. Der spezifische Ertrag in kWh je kWp und Tag beschreibt genau das.',
        'Das Modell setzt als Standard 3,0 kWh je kWp und Tag an — rund 1 100 kWh im Jahr am unteren Rand guter mitteleuropäischer Dachflächen. Wer eine flache Dachmontage ohne Ausrichtung, Teilverschattung oder einen Ost-West-Standort hat, muss diesen Wert senken.',
      ],
      formula: {
        expression: 'P_erf = (Bedarf_Wh / Ertrag_Wh_je_kWp) · 1000 Wp · Ladezeit-Aufschlag',
        caption:
          'Der Ladezeit-Aufschlag (1,15) kommt aus dem Modell (`VDE_CHARGE_DERATING_FACTOR`): CC/CV-Knick, Wärme und Alterung kosten rund 15 % der Ladezeit.',
      },
    },
    {
      id: 'jahreszeit',
      heading: 'Sommer und Winter sind zwei verschiedene Anlagen',
      table: {
        caption: `Beispiel: ${DAILY_WH} Wh Tagesbedarf am 12-V-Bordnetz (Modellrechnung, 100-Wp-Panels)`,
        head: ['Jahreszeit', 'Ertragsfaktor', 'Angesetzter Ertrag', 'Nötige Modulleistung'],
        rows: SEASON_ROWS,
        note: `Der Winterfaktor ${VDE_SOLAR_WINTER_REDUCTION} ist ein Modellwert aus der Auslieferung — rund ein Drittel des Sommerertrags.`,
      },
      body: [
        `Die Tabelle ist die ehrlichste Antwort auf die Frage „wie viel Solar brauche ich?": Für denselben Tagesbedarf reichen im Sommer ${summer.recommendedPeakWatts} Wp, im Winter braucht es ${winter.recommendedPeakWatts} Wp — mehr, als auf die meisten Camper-Dächer passt. Deshalb ist die Winterauslegung in der Praxis keine Flächenfrage, sondern eine Frage der Ladequellen: Lichtmaschine, Landstrom oder eine zweite Quelle.`,
        'Wer im Winter autark stehen will, kombiniert Solar mit einer Ladung über die Lichtmaschine während der Fahrt und senkt den Verbrauch. Den Winterfall als Auslegungsziel zu setzen, führt dagegen fast immer zu einer überdimensionierten und ungenutzten Insel.',
      ],
    },
    {
      id: 'verschattung',
      heading: 'Verschattung, Ausrichtung und Temperatur',
      list: {
        items: [
          'Ein verschattetes Panel liefert überproportional wenig: Schon eine Teilverschattung kann den String auf einen Bruchteil bringen. Modulreihen in Reihe verstärken das, parallele Strings mit eigenen Laderegler-Eingängen mildern es.',
          'Flach auf dem Dach ist der Jahresertrag geringer als bei Ausrichtung nach Süden — dafür ist die Verteilung über den Tag gleichmäßiger.',
          'Hitze kostet Leistung: Ein Modul bei 60 °C liefert einige Prozent weniger als bei 25 °C. Der Temperaturkoeffizient steht im Datenblatt, das Modell führt ihn für die Leerlaufspannung.',
          'Ein Abschlag ist kein Sicherheitspuffer: Wer 30 % Verschattungsverlust ansetzt, plant realistisch — nicht üppig.',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Den Abschlag gibt es als Eingabewert im Rechner, standardmäßig 0 %. Ein Modell, das die Verschattung einer Anlage kennt, die es nicht sieht, wäre eine Behauptung.',
      },
    },
    {
      id: 'laderegler',
      heading: 'Der Laderegler entscheidet, wie viel ankommt',
      body: [
        'Ohne Laderegler liegt die Modulspannung über der Batteriespannung — die Differenz verpufft als Wärme im Widerstand, bei PWM bleibt ein Teil der Modulleistung ungenutzt. Ein MPPT-Regler wandelt die Spannungsdifferenz in zusätzlichen Strom um und nutzt damit deutlich mehr vom Modul.',
        'Die Auslegung des Reglers ist ein eigenes Thema: Spannungsfenster, Kalt-Leerlaufspannung und Stromgrenzen müssen zu Modul und Batterie passen.',
      ],
      links: [
        {
          href: '/camper-elektrik/mppt/',
          label: 'MPPT-Laderegler auslegen',
          description: 'Spannungsfenster, Kalt-Leerlaufspannung, Ströme und Sicherungen.',
        },
        {
          href: '/rechner/solaranlage/',
          label: 'Solaranlage berechnen',
          description: 'Modulleistung, Panelanzahl und Ladestrom für deinen Bedarf.',
        },
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Nach Prospektwatt planen statt nach Tagesbedarf: „200 W reichen immer" ist keine Rechnung.',
          'Den Winterfall ignorieren und sich im November über die leere Batterie wundern.',
          'Module in Reihe ohne Rücksicht auf Verschattung verschalten — ein Schatten legt den ganzen String lahm.',
          'Modulkabel zu dünn wählen: Der Verlust auf dem Weg zum Regler geht direkt von der Ladeleistung ab.',
          'Panels ohne Hinterlüftung flach aufs Blech kleben: Die Zelltemperatur steigt, die Leistung sinkt.',
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Wie viel Solar brauche ich für meinen Camper?',
      answer:
        'Das folgt aus dem Tagesbedarf: P = Bedarf / Ertrag × 1000 Wp × 1,15. Bei 1 000 Wh Tagesbedarf und 3,0 kWh/kWp/Tag sind das im Sommer rund 400 Wp, im Winter rund 1 100 Wp. Die Sommerzahl ist mit vier 100-Wp-Panels erreichbar, die Winterzahl auf den meisten Dächern nicht — dort hilft nur eine zweite Ladequelle.',
    },
    {
      question: 'Reichen 200 W Solar für einen Camper?',
      answer:
        'Für einen sparsamen Ausbau mit Kompressor-Kühlbox und LED-Licht ja, sobald die Sonne scheint: 200 Wp liefern im Sommer bei 3 kWh/kWp/Tag rund 600 Wh am Tag. Im Winter sind es nur etwa 210 Wh — das deckt dann kaum den Kühlschrank. Wer mehr braucht, plant Ladung über die Lichtmaschine mit ein.',
    },
    {
      question: 'Wie viel Verlust entsteht durch Verschattung?',
      answer:
        'Das lässt sich nicht pauschal sagen: Eine Teilverschattung auf einem Panel wirkt bei Reihenschaltung auf den ganzen String. In der Praxis ist ein Abschlag von 20 bis 30 % für einen flachen Dachaufbau mit Dachluken, Antennen und Dachboxen realistisch — als Eingabewert im Rechner, nicht als versteckte Modellannahme.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/mppt/', label: 'MPPT-Laderegler auslegen' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/rechner/solaranlage/', label: 'Solaranlage berechnen' },
    { href: '/tools/dach/', label: 'Dach-Planer: Panels auf der Fläche platzieren' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modellwerte für Solar',
      detail: `Winterertrag ${VDE_SOLAR_WINTER_REDUCTION} des Sommerwerts und MPP-Spannung 18 V je 12-V-Modul in \`lib/vde-standards.ts\`; Ladezeit-Aufschlag 1,15 ebenda.`,
    },
    {
      label: 'Spezifischer Ertrag',
      detail:
        '3,0 kWh je kWp und Tag ist ein dokumentierter Eingabestandard (rund 1 100 kWh/kWp im Jahr), keine Messung — Standort, Ausrichtung und Verschattung sind Eingabewerte.',
    },
  ],
  assumptions: [
    'Der Ertragswert gilt für eine gut belüftete Dachmontage ohne Verschattung; Abschläge sind sichtbar einzugeben.',
    'Die Auslegung rechnet den Tagesbedarf gegen den Tagesertrag — Saisonverläufe über mehrere Tage sind nicht modelliert.',
  ],
  limits: [
    'Eine Ertragsprognose je Standort (Neigung, Azimut, Schattenwurf) leistet diese Seite nicht.',
    'Die elektrische Auslegung von Strings, Sicherungen und Kabeln ist ein eigener Abschnitt (MPPT) und nicht Teil der Leistungsbemessung.',
  ],
};
