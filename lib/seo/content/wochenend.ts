/**
 * lib/seo/content/vorlagen-wochenend.ts — Vorlagenseite `/vorlagen/wochenend/`.
 *
 * Eine vollständige Elektrik für ein Fahrzeug, das an Wochenenden und auf
 * kurzen Reisen unterwegs ist: Landstrom als Regel, Solar als Aufladung, zwei
 * Tage Autarkie als Reserve.
 *
 * Alle Zahlen stammen aus den Modellen der Auslieferung — Verbrauch als
 * Eingang, Batterie aus `lib/batterySizing.ts`, Solar aus `lib/solarSizing.ts`,
 * Querschnitt und Sicherung aus `lib/electrical.ts`. Die Rechenwege stehen in
 * `lib/seo/vorlagen.ts`; dieses Modul macht keine eigene Rechnung.
 *
 * Die Verbraucherliste ist ein BEISPIEL, kein Messwert: Sie beschreibt einen
 * typischen Tageshaushalt, nicht den einer bestimmten Familie.
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
    hinweis: 'Der größte Einzelposten im Tageshaushalt — läuft er durch, ist die Batteriegröße gesetzt.',
  },
  {
    geraet: 'Standheizung (Diesel, Gebläse)',
    watt: 35,
    stunden: 8,
    laengeM: 3,
    hinweis: 'Nur das Gebläse; der Brenner heizt mit Kraftstoff, nicht mit Strom.',
  },
  {
    geraet: 'Wasserpumpe',
    watt: 60,
    stunden: 0.4,
    laengeM: 5,
    hinweis: 'Kurze Einschaltdauer, aber hohe Leistung — deshalb die längste Leitung der Vorlage.',
  },
  {
    geraet: 'LED-Beleuchtung',
    watt: 12,
    stunden: 5,
    laengeM: 4,
    hinweis: 'Dauerlicht statt Glühlampe: der Unterschied zwischen 12 W und 60 W.',
  },
  {
    geraet: 'Laptop über 12-V-Netzteil',
    watt: 65,
    stunden: 4,
    laengeM: 2,
    hinweis: 'Fünf Verbraucher ohne Netteil — deshalb gehört ein 12-V-USB-Netzteil an die Stückliste.',
  },
] as const;

const BILANZ = bilanziere(VERBRAUCHER);
const BATTERIE = batterieRechnung(BILANZ.summeWh, 2, 12);
const SOMMER = solarRechnung(BILANZ.summeWh, 12, 100, false);
const WINTER = solarRechnung(BILANZ.summeWh, 12, 100, true);
const KREISE = kreiseRechnungen(VERBRAUCHER, 12);
const HAUPTLEITUNG = kreisRechnung('Hauptleitung Batterie → Plusverteilung', 600, 2, 12);

/** Peukert-korrigierte Nennkapazität: die Größe, die zwei volle Tage trägt. */
const MIT_PEUKERT = Math.ceil(BATTERIE.requiredNominalAh / BATTERIE.peukertFactor / 5) * 5;

/** Ausgangsstrom des Ladereglers bei 13,8 V Ladespannung (Regel des MPPT-Fachthema). */
const MPPT_STROM = SOMMER.recommendedPeakWatts / 13.8;

const STUECKLISTE: readonly (readonly string[])[] = [
  [
    'Aufbaubatterie',
    'LiFePO4 12 V, 200 Ah (oder 2 × 105 Ah parallel)',
    '1 (2)',
    `Deckt 2 × ${fmt(BILANZ.summeWh, 0)} Wh bei 90 % Entladetiefe. Bei 25 A Dauerstrom bleiben nach Peukert ${fmt(BATTERIE.usableAhOfRecommendation, 1)} Ah — für zwei volle Tage sind dann ${MIT_PEUKERT} Ah die ehrliche Größe.`,
  ],
  [
    'Hauptleitung',
    '25 mm² Leitung, 2 m',
    '1',
    `${fmt(HAUPTLEITUNG.stromA, 0)} A möglich (Laden und größte Verbraucher gleichzeitig) — das Modell fordert ${fmt(HAUPTLEITUNG.querschnittMm2, 1)} mm² auf ${fmt(HAUPTLEITUNG.laengeM, 0)} m.`,
  ],
  [
    'Hauptsicherung',
    '50 A, direkt am Batteriepol',
    '1',
    `Dicht an der Quelle: die Leitung darf max. ${HAUPTLEITUNG.maxSicherungA} A abgesichert werden, gewählt wird ${fmt(HAUPTLEITUNG.sicherungA, 0)} A.`,
  ],
  [
    'Plusverteilung',
    'Sicherungssystem mit 4 bis 6 Kreisen',
    '1',
    'Jeder Kreis mit eigener Sicherung; die Leitung vom Verteiler zum Verbraucher ist so dünn wie der Strom es erlaubt.',
  ],
  [
    'Solarmodule',
    '100 Wp, 12 V',
    '5',
    `Sommerrechnung: ${fmt(SOMMER.requiredPeakWatts, 0)} Wp nötig, mit 5 Modulen ${SOMMER.recommendedPeakWatts} Wp (Deckung ${fmt(SOMMER.coverageFactor, 2)}).`,
  ],
  [
    'Laderegler',
    'MPPT, 40 A Ausgangsstrom',
    '1',
    `Das Array liefert ${fmt(SOMMER.expectedChargeCurrentA, 1)} A am Modul, am Reglerausgang bei 13,8 V Ladespannung ${fmt(MPPT_STROM, 1)} A — ein 30-A-Regler wäre zu klein.`,
  ],
  [
    'Ladegerät am Landstrom',
    '20 A, mit Temperaturkompensation',
    '1',
    `Der Tagesbedarf von ${fmt(BILANZ.summeWh, 0)} Wh muss im Ladefenster wieder hinein: ${fmt(BATTERIE.chargeCurrentA, 1)} A nach dem Ladezeit-Aufschlag des Modells.`,
  ],
  [
    'Leitungsmaterial',
    '1,5 mm² und 2,5 mm², FLRY bzw. automotive-tauglich',
    'nach Bedarf',
    'Die dünnere Leitung für Kurzstrecken, die 2,5 mm² für die Wasserpumpe auf 5 m.',
  ],
  [
    'Beleuchtung',
    '12-V-LED-Leisten, 12 W',
    'nach Bedarf',
    'Der Verbraucher mit dem besten Verhältnis aus Nutzen und Verbrauch in der Vorlage.',
  ],
  [
    'USB-Netzteil 12 V',
    '65 W (5 A)',
    '1',
    'Für Laptop, Handy und Kamera — sonst hängt am Notebook ein 230-V-Netzteil am Wechselrichter.',
  ],
];

export const VORLAGE_WOCHENEND: SeoPageContent = {
  path: '/vorlagen/wochenend/',
  slug: 'wochenend',
  topicId: 'vorlagen',
  kind: 'cluster',
  title: 'Elektrik-Vorlage Wochenend-Camper: Stückliste und Plan',
  absoluteTitle: true,
  description:
    'Ausbau-Vorlage für den Wochenend-Camper: Verbrauch, 200-Ah-Batterie, 500 Wp Solar, Leitungen und Sicherungen als Stückliste — mit Rechenweg und Grenzen.',
  h1: 'Elektrik-Vorlage: Wochenend-Camper',
  lead: 'Ein Fahrzeug, das unter der Woche steht und am Wochenende rausfährt, braucht eine kleine, aber vollständige Anlage: genug Reserve für zwei Tage, eine Ladeoption für jeden Tag und Leitungen, die zur Batterie passen. Diese Vorlage rechnet das durch — vom Verbrauch bis zur Sicherung.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'gedanken',
      heading: 'Wofür diese Vorlage gedacht ist',
      body: [
        'Die Vorlage beschreibt ein Fahrzeug mit zwei bis vier Personen, das an Wochenenden und auf kurzen Reisen unterwegs ist. Landstrom am Stellplatz ist der Normalfall, die Solaranlage lädt nach, und die Batterie muss zwei Tage ohne Campingplatz tragen — für Heizung, Licht, Kühlung und Wasser.',
        'Der Plan ist eine Ausgangslage, kein fertiges Projekt. Die Verbraucherliste unten ist ein Beispiel; deine eigenen Geräte gehören an ihre Stelle. Der Planer rechnet aus deiner Liste denselben Weg nach — die Vorlage zeigt, wie das Ergebnis aussieht.',
      ],
      list: {
        items: [
          'Ziel: zwei Tage Autarkie ohne Landstrom, mit täglicher Nachladung.',
          'Bordnetz 12 V, eine Aufbaubatterie, kein Wechselrichter (230-V-Geräte bleiben draußen).',
          'Ladung über Landstrom (20 A) und über 500 Wp Solar.',
          'Auslegung im Sommer; für den Winter gilt die ehrliche Rechnung weiter unten.',
        ],
      },
      links: [
        {
          href: '/vorlagen/autark/',
          label: 'Zur Autark-Vorlage',
          description: 'Drei Tage ohne Landstrom, mit Wechselrichter und größerer Batterie.',
        },
        {
          href: '/vorlagen/grossraum/',
          label: 'Zur Vorlage für große Fahrzeuge',
          description: '24-V-Bordnetz, Waschmaschine und mehr Leistung.',
        },
      ],
    },
    {
      id: 'verbrauch',
      heading: 'Verbrauch: die Zahlen, aus denen alles andere folgt',
      body: [
        'Alles Weitere ist eine Folge dieses Verbrauchs. Wer ihn nicht aufschreibt, dimensioniert die Batterie nach Gefühl und merkt den Fehler erst, wenn die Kühlbox am zweiten Abend abschaltet.',
        'Die Summe liegt bei rund 1 074 Wh je Tag. Die Standheizung trägt mit 280 Wh am meisten zur Wärme bei — nicht weil sie elektrisch arbeitet, sondern weil das Gebläse die ganze Zeit läuft.',
      ],
      table: {
        caption: 'Beispielhafter Tageshaushalt eines Weekend-Campers (12 V)',
        head: ['Verbraucher', 'Leistung', 'Dauer/Tag', 'Energie'],
        rows: BILANZ.rows,
        note: 'Beispielwerte, keine Messwerte. Der Tagesbedarf ist der Eingangswert für alle weiteren Rechnungen dieser Seite.',
      },
      links: [
        {
          href: '/camper-elektrik/batterie/',
          label: 'Batterie dimensionieren',
          description: 'Entladetiefe, Peukert und der Weg vom Tagesbedarf zur Nennkapazität.',
        },
      ],
    },
    {
      id: 'batterie',
      heading: 'Batterie: 200 Ah LiFePO4, mit einer Einschränkung',
      body: [
        `Für zwei Tage ohne Ladung braucht die Vorlage 2 × ${fmt(BILANZ.summeWh, 0)} Wh = 2 148 Wh nutzbare Energie. Bei 90 % Entladetiefe (LiFePO4 im Modell) und 12 V Nennspannung sind das ${fmt(BATTERIE.requiredNominalAh, 1)} Ah Nennkapazität — aufgerundet auf die übliche Baugröße: 200 Ah.`,
        `Der Peukert-Effekt verschiebt die Sache ein Stück: Bei 25 A Dauerstrom liegt der Faktor bei ${fmt(BATTERIE.peukertFactor, 3)}, die nutzbare Kapazität damit bei ${fmt(BATTERIE.usableAhOfRecommendation, 1)} Ah (${fmt((BATTERIE.usableAhOfRecommendation * 12) / 1000, 2)} kWh). Für zwei volle Tage sind dann ${MIT_PEUKERT} Ah die ehrliche Größe.`,
        `Nachgeladen wird im Ladefenster: Der Tagesbedarf von ${fmt(BILANZ.summeWh, 0)} Wh, verteilt auf fünf Stunden, ergibt nach dem Ladezeit-Aufschlag des Modells ${fmt(BATTERIE.chargeCurrentA, 1)} A Ladestrom. Ein 20-A-Ladegerät am Landstrom passt dazu.`,
      ],
      formula: {
        expression: 'C_nenn = (Bedarf_Wh · Tage) / (U · DoD)',
        caption: `Für diese Vorlage: (${fmt(BILANZ.summeWh, 0)} Wh × 2) / (12 V × 0,90) = ${fmt(BATTERIE.requiredNominalAh, 1)} Ah → 200 Ah als Baugröße.`,
      },
      callout: {
        tone: 'warning',
        text: `Bei 25 A Dauerstrom trägt eine 200-Ah-Batterie nach Peukert nur ${fmt((BATTERIE.usableAhOfRecommendation * 12) / 1000, 2)} kWh — für zwei Tage mit vollem Verbrauch fehlt dann etwas. Zwei Wege: ${MIT_PEUKERT} Ah einplanen oder die Standheizung kürzer laufen lassen (280 Wh des Tagesbedarfs).`,
      },
      links: [
        {
          href: '/rechner/batteriekapazitaet/',
          label: 'Batteriegröße nachrechnen',
          description: 'Eigene Verbrauchszahlen eingeben und dieselbe Rechnung laufen lassen.',
        },
      ],
    },
    {
      id: 'solar',
      heading: 'Solar: 500 Wp im Sommer, 1 200 Wp im Winter',
      body: [
        `Die Solaranlage ist bei einem Weekend-Camper keine Verbrauchsdeckung, sondern eine Nachladung: Sie hält die Batterie zwischen zwei Etappen voll. Die Rechnung stellt den Tagesbedarf ${fmt(BILANZ.summeWh, 0)} Wh einem Ertrag von 3,0 kWh je kWp und Tag gegenüber und schlägt den Ladezeit-Aufschlag von 1,15 auf.`,
        `Im Sommer sind das ${fmt(SOMMER.requiredPeakWatts, 0)} Wp — mit 100-Wp-Modulen also 5 Module und ${SOMMER.recommendedPeakWatts} Wp. Die Rechnung deckt den Tagesbedarf damit ${fmt(SOMMER.coverageFactor, 2)}-fach.`,
        `Im Winter ändert sich die Lage: Der Modellwert von 35 % des Sommerertrags führt auf ${fmt(WINTER.requiredPeakWatts, 0)} Wp, also ${WINTER.panelCount} Module. Das passt auf kein übliches Camperdach. Das ist keine Schwäche der Vorlage, sondern die Physik — wer im Winter autark stehen will, lädt während der Fahrt oder am Landstrom nach.`,
      ],
      table: {
        caption: 'Was die Solaranlage im Jahr leistet (100-Wp-Module, 12 V)',
        head: ['Dachfläche', 'Sommerertrag', 'Deckung', 'Winterertrag', 'Deckung'],
        rows: [
          [
            '2 × 100 Wp',
            `${fmt(solarErtrag(200, BILANZ.summeWh, 12, 100, false).ertragWh, 0)} Wh`,
            fmt(solarErtrag(200, BILANZ.summeWh, 12, 100, false).deckung, 2),
            `${fmt(solarErtrag(200, BILANZ.summeWh, 12, 100, true).ertragWh, 0)} Wh`,
            fmt(solarErtrag(200, BILANZ.summeWh, 12, 100, true).deckung, 2),
          ],
          [
            '4 × 100 Wp',
            `${fmt(solarErtrag(400, BILANZ.summeWh, 12, 100, false).ertragWh, 0)} Wh`,
            fmt(solarErtrag(400, BILANZ.summeWh, 12, 100, false).deckung, 2),
            `${fmt(solarErtrag(400, BILANZ.summeWh, 12, 100, true).ertragWh, 0)} Wh`,
            fmt(solarErtrag(400, BILANZ.summeWh, 12, 100, true).deckung, 2),
          ],
          [
            '5 × 100 Wp (Empfehlung)',
            `${fmt(solarErtrag(500, BILANZ.summeWh, 12, 100, false).ertragWh, 0)} Wh`,
            fmt(solarErtrag(500, BILANZ.summeWh, 12, 100, false).deckung, 2),
            `${fmt(solarErtrag(500, BILANZ.summeWh, 12, 100, true).ertragWh, 0)} Wh`,
            fmt(solarErtrag(500, BILANZ.summeWh, 12, 100, true).deckung, 2),
          ],
        ],
        note: 'Ertrag je Modulleistung nach dem Standard des Solaranlage-Rechners (3,0 kWh/kWp/Tag im Sommer, 35 % davon im Winter). Keine Ertragsprognose für einen bestimmten Standort.',
      },
      callout: {
        tone: 'info',
        text: `Das Array der Empfehlung liefert ${fmt(SOMMER.expectedChargeCurrentA, 1)} A am Modul. Am Laderegler-Ausgang mit 13,8 V Ladespannung sind das ${fmt(MPPT_STROM, 1)} A — ein 30-A-Regler wäre zu klein, die Stückliste nennt deshalb 40 A.`,
      },
      links: [
        {
          href: '/tools/dach/',
          label: 'Panels auf dem Dach platzieren',
          description: 'Vor dem Kauf prüfen, wie viel Fläche das Dach hergibt.',
        },
        {
          href: '/camper-elektrik/solar/',
          label: 'Solar im Camper auslegen',
          description: 'Sommer und Winter getrennt gerechnet — und warum das nötig ist.',
        },
      ],
    },
    {
      id: 'leitungen',
      heading: 'Leitungen und Sicherungen',
      body: [
        'Jeder Verbraucher bekommt eine eigene Leitung und eine eigene Sicherung. Die Leitung wird nach Spannungsfall (3 % auf 12 V) und Belastbarkeit bemessen, die Sicherung nach der Leitung — nicht nach dem Verbraucher. Das ist der Punkt, an dem die meisten Ausbauten scheitern: Eine 10-A-Sicherung auf einer 1,5-mm²-Leitung ist kein Sicherheitsgewinn, sondern eine zusätzliche Fehlerquelle.',
        'Die Hauptleitung vom Batteriepol zur Plusverteilung trägt den ungünstigsten Fall: Laden und größter Verbraucher gleichzeitig. Bei 50 A auf 2 m fordert das Modell 25 mm².',
      ],
      table: {
        caption: 'Stromkreise der Vorlage (12 V)',
        head: ['Kreis', 'Strom', 'Länge', 'Querschnitt', 'I_z', 'Sicherung'],
        rows: [...KREISE.map(kreisZeile), kreisZeile(HAUPTLEITUNG)],
        note: 'Querschnitt nach Spannungsfall und Belastbarkeit, Sicherung nach der Leitung (I_B ≤ I_n ≤ I_z). Die Längen sind Annahmen der Vorlage.',
      },
      links: [
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherungen richtig wählen',
          description: 'Wo das Schutzorgan sitzt und welche Kette gilt.',
        },
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: 'Kabelquerschnitt nachrechnen',
          description: 'Formel, Tabelle und die Rolle der Leitungslänge.',
        },
      ],
    },
    {
      id: 'stueckliste',
      heading: 'Stückliste',
      body: [
        'Die Stückliste nennt die Bauteile und die Zahl, mit der sie in der Planung stehen. Sie ist eine Einkaufsgrundlage, keine Bestellliste: Vor dem Kauf gehören Länge, Querschnitt und Typ der Leitung an das konkrete Fahrzeug angepasst, und jedes Bauteil ist gegen das Datenblatt im Planer zu prüfen.',
      ],
      table: {
        caption: 'Stückliste der Vorlage „Wochenend-Camper"',
        head: ['Position', 'Bauteil', 'Menge', 'Begründung'],
        rows: STUECKLISTE,
        note: 'Muster für die Planung, kein Angebot. Preise, Lieferanten und Verfügbarkeit sind nicht Teil dieser Seite.',
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
          'Kein 230-V-Netz: Ohne Wechselrichter gibt es keine Kaffeemaschine, kein Induktionskochfeld, keine Waschmaschine.',
          'Kein Winterbetrieb ohne Nachladung: 35 % Sommerertrag reichen nicht für eine ganze Woche Standzeit.',
          'Keine Aussage zur Anlage am Fahrzeug: Landstrom-Einspeisung, FI-Schutz und Abnahme sind Facharbeiten.',
          'Keine Materialfestlegung: FLRY, Leitungsdurchmesser und Stecker sind je nach Fahrzeug zu wählen.',
          'Keine Garantie: Die Verbraucherliste ist ein Beispiel — mit den eigenen Geräten ändert sich die Rechnung.',
        ],
      },
      links: [
        {
          href: '/ueber-werft/',
          label: 'Wie Werft rechnet',
          description: 'Quellen, Annahmen und die Grenzen des Modells.',
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Reicht eine 200-Ah-Batterie für zwei Tage ohne Landstrom?',
      answer:
        'Nach der Entladetiefe ja: 200 Ah LiFePO4 bei 12 V ergeben 2 400 Wh Nennenergie, davon 90 % nutzbar — 2 160 Wh für zwei Tage bei 1 074 Wh Tagesbedarf. Mit dem Peukert-Effekt bei 25 A Dauerstrom bleiben 171,9 Ah, also 2 060 Wh: knapp unter zwei vollen Tagen. Wer 25 A dauerhaft zieht, plant 210 Ah ein.',
    },
    {
      question: 'Wie viel Solar brauche ich für einen Wochenend-Camper?',
      answer:
        'Im Sommer rechnen 5 Module mit je 100 Wp den Tagesbedarf von 1 074 Wh vollständig ab — 500 Wp mit 13,8 V Ladespannung erfordern einen Laderegler mit rund 36 A Ausgangsstrom. Im Winter wären es nach dem Modell 1 200 Wp; das passt auf kein übliches Dach.',
    },
    {
      question: 'Warum ist die Leitung zur Wasserpumpe dicker als die zum Laptop?',
      answer:
        'Weil Länge und Strom zusammen zählen: Die Pumpe liegt 5 m entfernt und zieht 5 A, das Notebook 2 m und 5,4 A. Die Pumpe braucht nach dem Modell 2,5 mm², das Notebook kommt mit 1,5 mm² aus. Der Spannungsfall von 3 % auf 12 V ist der Grund, nicht der Verbraucher.',
    },
    {
      question: 'Kann ich diese Vorlage für 24 V übernehmen?',
      answer:
        'Die Rechnung ändert sich, das Prinzip nicht: Bei 24 V halbieren sich die Ströme, die Leitungen können dünner bleiben. Für größere Leistungen — Waschmaschine, großer Wechselrichter — ist 24 V die deutlichere Wahl. Die Vorlage für große Fahrzeuge rechnet das durch.',
    },
  ],
  related: [
    { href: '/vorlagen/autark/', label: 'Vorlage: Autark-Camper (3 Tage, mit Wechselrichter)' },
    { href: '/vorlagen/grossraum/', label: 'Vorlage: Großraum-Camper (24 V)' },
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriegröße berechnen' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modelle der Auslieferung',
      detail:
        'Batterie: `lib/batterySizing.ts` (Entladetiefe, Peukert, Ladezeit-Aufschlag 1,15) · Solar: `lib/solarSizing.ts` (Ertrag 3,0 kWh/kWp/Tag, Winterfaktor 0,35) · Leitungen: `lib/electrical.ts` (Spannungsfall 3 % auf 12 V, Belastbarkeit nach DIN VDE 0298-4, Planerpauschale 0,7).',
    },
    {
      label: 'Rechenweg der Vorlage',
      detail:
        'Die Zahlen dieser Seite stammen aus `scripts/dev/bereche-vorlagen.ts`; das Skript rechnet dieselben Eingaben mit denselben Modellen nach und ist der Grund, warum Anzeige und Skript nicht auseinanderlaufen.',
    },
  ],
  assumptions: [
    'Die Verbraucherliste ist ein Beispiel für einen typischen Tageshaushalt, kein Messwert eines bestimmten Fahrzeugs.',
    'Die Leitungslängen (2 m Hauptleitung, 3–5 m zu den Verbrauchern) sind Annahmen der Vorlage.',
    'Der spezifische Solardertrag von 3,0 kWh/kWp/Tag ist der Standardwert des Rechners, kein Ertrag für einen bestimmten Standort.',
    'Der Peukert-Faktor wird mit 25 A Dauerstrom angesetzt — einem Wert, der nur während des Ladens oder bei gleichzeitigem Betrieb mehrerer Verbraucher auftritt.',
  ],
  limits: [
    'Die Vorlage kennt keine 230-V-Anlage: Wechselrichter, FI-Schutz und Landstromeinspeisung sind nicht Teil dieser Seite.',
    'Alterung, Kälte und unvollständige Ladung der Batterie sind nicht modelliert — das Modell bietet dafür keinen Zuschlag, nur die sichtbare Reserve.',
    'Temperatur, Verschattung und Neigung der Module sind nicht modelliert; der Winterfall nutzt einen festen Ertragsfaktor.',
    'Material, Steckverbinder und Konfektionierung sind nicht Teil der Rechnung.',
  ],
};
