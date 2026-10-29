/**
 * lib/seo/content/solar.ts — Cluster-Seite `/camper-elektrik/solar/`.
 *
 * Ausbau der bestehenden Solarseite um die Frage „Wie viel Watt?". Die
 * Beispielrechnungen kommen aus `sizeSolarArray` (lib/solarSizing.ts) —
 * inklusive des Winterfalls, der in Prospekten gern fehlt.
 *
 * Information Gain: Eigene Sommer-/Winter-Vergleichsrechnung aus dem
 * 12V-Elektroplaner, Praxis-Entscheidung zur Solarmontage, Normverweise.
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
  title: 'Solar: Wie viel Watt braucht mein Camper?',
  absoluteTitle: true,
  description:
    'Solaranlage im Camper berechnen: Wie viel Watt Solarleistung für den Tagesbedarf? Sommer- und Winterfall, Verschattung, Laderegler und Rechenbeispiele.',
  h1: 'Solar im Camper: Wie viel Watt brauche ich?',
  lead: 'Die Frage „wie viel Watt passen aufs Dach?" ist die falsche Reihenfolge. Zuerst steht der Tagesbedarf, dann der Ertrag am Einbauort — erst danach die Frage, ob die Fläche reicht.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'kernantwort',
      heading: 'Wie viel Solar brauche ich für meinen Camper?',
      body: [
        'Das folgt aus dem Tagesbedarf: P = Bedarf / Ertrag × 1000 Wp × 1,15. Bei 1 000 Wh Tagesbedarf und 3,0 kWh/kWp/Tag sind das im Sommer rund 400 Wp, im Winter rund 1 100 Wp. Der Sommerwert 3,0 kWh/kWp/Tag gilt für eine günstig geneigte Fläche; ein flaches Camperdach liegt eher bei 2,4–2,6 und braucht entsprechend mehr Modulleistung. Die Winterzahl ist auf den meisten Dächern nicht erreichbar — dort hilft nur eine zweite Ladequelle.',
        'Die Rechengrundlage: Das Modell setzt als Standard 3,0 kWh je kWp und Tag an (rund 1 100 kWh im Jahr am unteren Rand guter mitteleuropäischer Dachflächen). Der Ladezeit-Aufschlag von 1,15 berücksichtigt CC/CV-Knick, Wärme und Alterung.',
        'Wer im Winter autark stehen will, kombiniert Solar mit einer Ladung über die Lichtmaschine während der Fahrt und senkt den Verbrauch. Den Winterfall als Auslegungsziel zu setzen, führt fast immer zu einer überdimensionierten und ungenutzten Insel.',
      ],
      callout: {
        tone: 'info',
        text: '[Solaranlage berechnen](/rechner/solaranlage/) — eigenen Tagesbedarf eingeben und die nötige Modulleistung ermitteln.',
      },
    },
    {
      id: 'formel',
      heading: 'Die Formel und was jeder Buchstabe bedeutet',
      formula: {
        expression: 'P_erf = (Bedarf_Wh / Ertrag_Wh_je_kWp) · 1000 Wp · Ladezeit-Aufschlag',
        caption:
          'Der Ladezeit-Aufschlag (1,15) kommt aus dem Modell (`VDE_CHARGE_DERATING_FACTOR`): CC/CV-Knick, Wärme und Alterung kosten rund 15 % der Ladezeit.',
      },
      definitions: [
        { term: 'Bedarf_Wh', description: 'Tagesenergiebedarf in Wattstunden (aus der Verbrauchertabelle).' },
        {
          term: 'Ertrag_Wh_je_kWp',
          description: 'Spezifischer Ertrag in kWh je kWp und Tag (Standardwert 3,0 kWh/kWp/Tag).',
        },
        { term: '1000 Wp', description: 'Umrechnung von kW in Wp (Watt peak).' },
        { term: 'Ladezeit-Aufschlag', description: 'Faktor 1,15 für CC/CV-Knick, Wärme und Alterung.' },
      ],
      body: [
        'Rechenbeispiel: 1 000 Wh Tagesbedarf, 3,0 kWh/kWp/Tag Ertrag. P = (1 000 / 3 000) · 1000 Wp · 1,15 = 383 Wp → aufgerundet 400 Wp (vier 100-Wp-Panels).',
        'Die vier Engineering-Nuancen für Solar: (1) Niedrigste Betriebsspannung als Basis für die Batterieberechnung (10,7 V statt 12 V). (2) 20 % Puffer für Wandlerverluste. (3) Über 4 % Spannungsfall (0,48 V bei 12 V) können bei empfindlichen Geräten zur Unterspannungsabschaltung führen; die Schwelle steht im Datenblatt. (4) Temperatur-Derating im geschlossenen Sitzkasten.',
      ],
    },
    {
      id: 'ertrag',
      heading: 'Ertrag: die Zahl, die über die Auslegung entscheidet',
      body: [
        'Ein Solarmodul mit 100 Wp liefert nicht 100 W — nur bei Einstrahlung, Zelltemperatur und Sonnenstand nach Standardbedingungen (STC: 1 000 W/m², 25 °C). Über einen Tag kommen davon je nach Standort und Jahreszeit deutlich weniger an.',
        'Das Modell setzt als Standard 3,0 kWh je kWp und Tag an. Wer eine flache Dachmontage ohne Ausrichtung, Teilverschattung oder einen Ost-West-Standort hat, muss diesen Wert senken.',
        '[Erfahrung] In meinem Fahrzeug habe ich die Panels nicht flach aufs Blech geklebt, sondern mit einem kleinen Abstand montiert, damit Luft zirkulieren kann. Bei 60 °C Zelltemperatur liefert ein Modul je nach Temperaturkoeffizient etwa 12–16 % weniger als bei 25 °C — Hinterlüftung lohnt sich.',
      ],
    },
    {
      id: 'jahreszeit',
      heading: 'Sommer und Winter sind zwei verschiedene Anlagen',
      table: {
        caption: `Beispiel: ${DAILY_WH} Wh Tagesbedarf am 12-V-Bordnetz (Modellrechnung, 100-Wp-Panels)`,
        head: ['Jahreszeit', 'Ertragsfaktor', 'Angesetzter Ertrag', 'Nötige Modulleistung'],
        rows: SEASON_ROWS,
        note: `Der Winterfaktor ${(VDE_SOLAR_WINTER_REDUCTION * 100).toLocaleString('de-DE')} % ist ein Modellwert aus der Auslieferung. Er gilt für eine gut geneigte Südlage in Süddeutschland; ein flaches Camperdach liegt im Winter oft nur bei 10–20 % des Sommerwerts. Für die Winterplanung ist der Modellwert daher optimistisch.`,
      },
      body: [
        `Die Tabelle ist die ehrlichste Antwort auf die Frage „wie viel Solar brauche ich?": Für denselben Tagesbedarf reichen im Sommer ${summer.recommendedPeakWatts} Wp, im Winter braucht es ${winter.recommendedPeakWatts} Wp — mehr, als auf die meisten Camper-Dächer passt. Deshalb ist die Winterauslegung in der Praxis keine Flächenfrage, sondern eine Frage der Ladequellen: Lichtmaschine, Landstrom oder eine zweite Quelle.`,
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
        'Ein PWM-Regler ist ein Schalter, kein Widerstand: Er zieht das Modul auf Batteriespannung; das Modul arbeitet dann nicht im MPP, und ein Teil der möglichen Leistung wird gar nicht erzeugt. Ein MPPT-Regler sucht den MPP und wandelt die Spannungsdifferenz in zusätzlichen Ladestrom um; damit nutzt er mehr vom Modul.',
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
      heading: 'Typische Fehler bei der Solarauslegung',
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
    {
      id: 'naechster-schritt',
      heading: 'Vom Watt-Wert in den Plan',
      body: [
        'Mit der ermittelten Modulleistung als Eingabe rechnet der Elektroplaner die Kabelquerschnitte und Sicherungen für die Solarleitungen. Die Panels werden im Dach-Planer auf der verfügbaren Fläche platziert.',
      ],
      callout: {
        tone: 'info',
        text: '[Dach-Planer öffnen](/tools/dach/) — Panels auf der Dachfläche platzieren und die Gesamtleistung ablesen.',
      },
      links: [
        {
          href: '/camper-elektrik/mppt/',
          label: 'MPPT-Laderegler auslegen',
          description: 'Spannungsfenster, Kalt-Leerlaufspannung, Ströme und Sicherungen.',
        },
        {
          href: '/camper-elektrik/batterie/',
          label: 'Batterie dimensionieren',
          description: 'Entladetiefe, Peukert und der Weg vom Tagesbedarf zur Nennkapazität.',
        },
        {
          href: '/planer/',
          label: 'Camper-Elektroplaner öffnen',
          description: 'Die Solaranlage als Plan zeichnen und Querschnitt sowie Sicherung ableiten.',
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Wie viel Solar brauche ich für meinen Camper?',
      answer:
        'Das folgt aus dem Tagesbedarf: P = Bedarf / Ertrag × 1000 Wp × 1,15. Bei 1 000 Wh Tagesbedarf und 3,0 kWh/kWp/Tag sind das im Sommer rund 400 Wp, im Winter rund 1 100 Wp. Die Sommerzahl ist mit vier 100-Wp-Panels erreichbar, die Winterzahl auf den meisten Dächern nicht.',
    },
    {
      question: 'Reichen 200 W Solar für einen Camper?',
      answer:
        'Für einen sparsamen Ausbau mit Kompressor-Kühlbox und LED-Licht ja, sobald die Sonne scheint: 200 Wp liefern im Sommer bei günstiger Neigung und 3 kWh/kWp/Tag rund 600 Wh am Tag. Im Winter sind es nach dem Modellwert etwa 210 Wh, bei flacher Montage deutlich weniger — das deckt dann kaum den Kühlschrank.',
    },
    {
      question: 'Wie viel Verlust entsteht durch Verschattung?',
      answer:
        'Das lässt sich nicht pauschal sagen: Eine Teilverschattung auf einem Panel wirkt bei Reihenschaltung auf den ganzen String. In der Praxis ist ein Abschlag von 20 bis 30 % für einen flachen Dachaufbau mit Dachluken, Antennen und Dachboxen realistisch.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/mppt/', label: 'MPPT-Laderegler auslegen' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/rechner/solaranlage/', label: 'Solaranlage berechnen' },
    { href: '/tools/dach/', label: 'Dach-Planer: Panels auf der Fläche platzieren' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modellwerte für Solar',
      detail: `Winterertrag ${(VDE_SOLAR_WINTER_REDUCTION * 100).toLocaleString('de-DE')} % des Sommerwerts (Modellwert für gut geneigte Südlage; flaches Dach 10–20 %) und MPP-Spannung 18 V je 12-V-Modul in \`lib/vde-standards.ts\`; Ladezeit-Aufschlag 1,15 ebenda.`,
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
    'Die Praxis-Entscheidung (Hinterlüftung) ist eine individuelle Erfahrung, keine allgemeine Empfehlung.',
  ],
  limits: [
    'Eine Ertragsprognose je Standort (Neigung, Azimut, Schattenwurf) leistet diese Seite nicht.',
    'Die elektrische Auslegung von Strings, Sicherungen und Kabeln ist ein eigener Abschnitt (MPPT) und nicht Teil der Leistungsbemessung.',
  ],
};
