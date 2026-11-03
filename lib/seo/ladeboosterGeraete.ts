/**
 * lib/seo/ladeboosterGeraete.ts — die EINE Datenquelle des Ladebooster-Vergleichs.
 *
 * Vorher standen dieselben neun Geräte an drei Stellen im JSX (Tabelle, vier
 * Detailkarten, fünf Kompaktkarten); eine Preisänderung bedeutete drei
 * Editierstellen. Rangliste und Produktkarten werden jetzt aus dieser Datei
 * erzeugt. Das ist bewusst KEIN generisches Template für beliebige Vergleiche:
 * Es beschreibt genau diese eine Seite, mit ihren Attributen und ihren Grenzen.
 *
 * Regel gegen erfundene Daten: Ein nicht belegter Wert ist `null` und wird in
 * der Anzeige als „nicht belegt" ausgewiesen, nie als leere Zelle oder
 * geschätzte Zahl. Preise sind beobachtete Momentaufnahmen mit Datum — sie
 * stehen deshalb nicht im JSON-LD (siehe lib/seo/jsonLd.ts).
 *
 * Kein React, keine Farben, keine Elektro-Berechnung (ARCHITECTURE-RULES A/B).
 */

export type GeraeteKlasse = '30' | '60' | '90';

export type AttributId =
  'strom' | 'kapazitaet' | 'steuerung' | 'spannung' | 'querschnitt' | 'masse' | 'besonderheit' | 'preis';

export type VergleichAttribut = {
  id: AttributId;
  label: string;
  /** Erklärung EINMAL hier, nicht je Gerät wiederholt. */
  legende: string;
};

export type VergleichLink = {
  href: string;
  label: string;
  kind: 'datenblatt' | 'handbuch' | 'hersteller' | 'preis' | 'forum';
};

export type Geraet = {
  id: string;
  brand: string;
  name: string;
  klasse: GeraeteKlasse;
  /** Sortierschlüssel als Zahl; `null` = nicht belegt und sortiert ans Ende. */
  stromA: number | null;
  stromLabel: string;
  dplus: string;
  preisEur: number | null;
  preisLabel: string;
  /** ISO-Datum der Preisbeobachtung — Gate: älter als 180 Tage ist rot. */
  preisGeprueft: string;
  /** Für die Tabellenspalte „Was auffällt". */
  auffaellig: string;
  /** Kurzes „Passt für" für die Karte. */
  passtFuer: string;
  /** Alle acht Attribute in identischer Reihenfolge; `null` ist belegt unbekannt. */
  specs: Record<AttributId, string | null>;
  /** Redaktionelle Einordnung — EINMAL, nicht in Tabelle und Karte zugleich. */
  einordnung: string;
  /** Der Haken, der in der Karte sichtbar bleibt. */
  haken: string;
  links: readonly VergleichLink[];
  /** Markiert die zwei Geräte, die im Original hervorgehoben waren — mit Legende. */
  hervorgehoben?: boolean;
};

export const PREISSTAND = '2026-10-23';
export const PREISSTAND_LABEL = '23.10.2026';
export const PREIS_MAX_ALTER_TAGE = 180;

export const ATTRIBUTE: readonly VergleichAttribut[] = [
  { id: 'strom', label: 'Ladestrom', legende: 'Nennstrom des Herstellers; Drosselung steht dabei.' },
  {
    id: 'kapazitaet',
    label: 'Batteriekapazität',
    legende: 'Vom Hersteller genannter Arbeitsbereich der Bank.',
  },
  { id: 'steuerung', label: 'Steuerung / D+', legende: 'Wie das Gerät den laufenden Motor erkennt.' },
  { id: 'spannung', label: 'Ladespannung', legende: 'Abschlussspannungen je Ladeprogramm.' },
  { id: 'querschnitt', label: 'Kabel / Querschnitt', legende: 'Grenze der Klemmen bzw. empfohlene Leitung.' },
  { id: 'masse', label: 'Maße / Gewicht', legende: 'Herstellerangabe, Einbauraum und Lüftung prüfen.' },
  { id: 'besonderheit', label: 'Besonderheit', legende: 'Zulassung, Wirkungsgrad oder die Datenlücke.' },
  {
    id: 'preis',
    label: 'Preis',
    legende: `Beobachteter Straßenpreis, Stand ${PREISSTAND_LABEL}, inkl. MwSt.`,
  },
];

export const KLASSEN: readonly { id: GeraeteKlasse; label: string; beschreibung: string }[] = [
  { id: '30', label: '30 A', beschreibung: 'Einstieg bis rund 200 Ah' },
  { id: '60', label: '60–70 A', beschreibung: 'Die mittlere Klasse' },
  { id: '90', label: '90 A+', beschreibung: 'Große Bänke und hohe Verbraucher' },
];

/** Ist eine Preisbeobachtung noch jung genug, um sie ohne Warnung zu zeigen? */
export function preisIstFrisch(iso: string, heuteIso: string): boolean {
  const geprueft = Date.parse(`${iso}T00:00:00Z`);
  const heute = Date.parse(`${heuteIso}T00:00:00Z`);
  if (Number.isNaN(geprueft) || Number.isNaN(heute)) return false;
  return (heute - geprueft) / 86_400_000 <= PREIS_MAX_ALTER_TAGE;
}

export const EINSATZFAELLE: readonly {
  id: string;
  index: string;
  amp: string;
  titel: string;
  situation: string;
  geraetId: string;
  grenze: string;
}[] = [
  {
    id: 'einstieg',
    index: '01 // Einstieg',
    amp: '30 A',
    titel: 'Für 100–200 Ah, kurze Fahrten, Solar als Stütze.',
    situation: 'Zuverlässig, günstig und für viele Ausbauten völlig ausreichend.',
    geraetId: 'orion-30',
    grenze: 'Bei 330 Ah sind 30 A nur 0,09 C. Für Induktion und kurze Etappen zu wenig.',
  },
  {
    id: 'alltag',
    index: '02 // Sweet Spot',
    amp: '60–70 A',
    titel: 'Für 200–400 Ah ohne großen Wechselrichter.',
    situation: 'Kühlschrank, Licht, Laptop, Kaffeemaschine — dafür ist diese Klasse gebaut.',
    geraetId: 'ective-bb60',
    grenze: '60 A sind an 330 Ah 0,18 C. Im Winter mit Induktion fehlt die Reserve.',
  },
  {
    id: 'reserve',
    index: '03 // Mein Setup',
    amp: '90 A',
    titel: 'Für 300–600 Ah und hohe Verbraucher.',
    situation: 'Ein Gerät, ein Kabelweg, 0–75 A drosselbar. Genau die Reserve, die ich wollte.',
    geraetId: 'votronic-90',
    grenze: '25/35 mm², Luft für den Lüfter und ein sauberer D+-Anschluss sind Pflicht.',
  },
  {
    id: 'gross',
    index: '04 // Große Bänke',
    amp: '100–120 A',
    titel: 'Für Expeditionsmobile, 24-V-Systeme und große Lithium-Bänke.',
    situation: 'Sterling BB12120 oder Victron Buck-Boost 100 A.',
    geraetId: 'sterling-120',
    grenze: 'Teuer, aufwendig, und die Lichtmaschine muss die Eingangsleistung wirklich liefern.',
  },
];

export const GERAETE: readonly Geraet[] = [
  {
    id: 'orion-30',
    brand: 'Victron Energy',
    name: 'Orion-Tr Smart 12/12-30',
    klasse: '30',
    stromA: 30,
    stromLabel: '30 A',
    dplus: 'nein',
    preisEur: 168,
    preisLabel: 'ab ca. 168 €',
    preisGeprueft: PREISSTAND,
    auffaellig: '16-mm²-Grenze; parallel möglich, Lastverteilung ungleich',
    passtFuer: '100–200 Ah, kurze Fahrten',
    specs: {
      strom: '30 A bei 40 °C',
      kapazitaet: null,
      steuerung: 'Spannungserkennung, kein D+',
      spannung: null,
      querschnitt: 'max. 16 mm²',
      masse: '130 × 186 × 70 mm / 1,8 kg',
      besonderheit: '87 % Wirkungsgrad, 40 A / 10 s Spitze, Bluetooth',
      preis: 'ab ca. 168 €',
    },
    einordnung:
      'Der kleinste sinnvolle Einstieg. Kompakt, per Bluetooth konfigurierbar und ohne D+ nachrüstbar. Für 100–200 Ah und kurze Fahrten eine saubere Lösung. Bei 330 Ah und Induktion ist er mit 0,09 C überfordert.',
    haken:
      'Die 16-mm²-Klemmen sind die harte Grenze. Wer 60 A will, braucht zwei Geräte, zwei Zuleitungen und zwei Sicherungen — nicht einfach ein dickeres Kabel.',
    links: [
      {
        href: 'https://www.victronenergy.de/upload/documents/Datasheet-Orion-Tr-Smart-DC-DC-chargers-non-isolated-360-400W-DE.pdf',
        label: 'Datenblatt',
        kind: 'datenblatt',
      },
      {
        href: 'https://communityarchive.victronenergy.com/questions/78315/warum-arbeitet-nur-eins-der-beiden-parallel-gescha.html',
        label: 'Forum: Parallelbetrieb',
        kind: 'forum',
      },
    ],
  },
  {
    id: 'ective-bb60',
    brand: 'ECTIVE',
    name: 'BB 60',
    klasse: '60',
    stromA: 60,
    stromLabel: '60 A',
    dplus: 'ja',
    preisEur: 260,
    preisLabel: 'ca. 260 €',
    preisGeprueft: PREISSTAND,
    auffaellig: '90–560 Ah; vier LiFePO4-Spannungen; ECE R10',
    passtFuer: '200–400 Ah ohne großen Wechselrichter',
    specs: {
      strom: '60 A',
      kapazitaet: '90–560 Ah',
      steuerung: 'D+ 8–16 V, erforderlich',
      spannung: '13,9 / 14,2 / 14,4 / 14,6 V',
      querschnitt: null,
      masse: '215 × 190 × 70 mm / 1,6–1,7 kg',
      besonderheit: 'ECE R10',
      preis: '292 €, ab ca. 260 €',
    },
    einordnung:
      'Der Preis-Leistungs-Kandidat. 60 A an 330 Ah sind 0,18 C; für ein Setup ohne großen Wechselrichter reicht das. Vier LiFePO4-Spannungen, D+ und eine solide Ausstattung zu einem Preis, der nicht nach Experiment aussieht.',
    haken:
      'D+ muss vorhanden sein oder über einen Simulator kommen. Die Produkthistorie ist jünger als bei Schaudt oder Votronic — das ist kein Qualitätsurteil, sondern eine Datenlage.',
    links: [
      {
        href: 'https://www.ective.de/ladetechnik/ladebooster/bb-60-12v-auf-12v-ladebooster-60a',
        label: 'Herstellerseite',
        kind: 'hersteller',
      },
      {
        href: 'https://www.ective.de/mediafiles/Datenblatt/ective/ladebooster/ECTIVE-BB%2BSBB-Bedienungsanleitung-DE-2026-02-27.pdf',
        label: 'Handbuch',
        kind: 'handbuch',
      },
    ],
    hervorgehoben: true,
  },
  {
    id: 'schaudt-70',
    brand: 'Schaudt / Lippert',
    name: 'WA 121545',
    klasse: '60',
    stromA: 70,
    stromLabel: '45–70 A',
    dplus: 'ja',
    preisEur: 575,
    preisLabel: '575 €',
    preisGeprueft: PREISSTAND,
    auffaellig: '80–700 Ah; Lithium fest 14,4 V; teuer pro Ampere',
    passtFuer: 'OEM-Nähe, feste 14,4 V akzeptiert',
    specs: {
      strom: '45 / 55 / 63 / 70 A',
      kapazitaet: '80–700 Ah',
      steuerung: 'D+ bei Euro 6 erforderlich',
      spannung: '14,4 V konstant (LiFePO4)',
      querschnitt: null,
      masse: '160 × 79 × 160 mm / 1,15 kg',
      besonderheit: '93 % Wirkungsgrad, Temperaturfühler dabei',
      preis: '575 €',
    },
    einordnung:
      'OEM-Qualität, in vielen Reisemobilen ab Werk. 70 A an 330 Ah sind 0,21 C. Wer mit 14,4 V konstant leben kann, bekommt ein solides Gerät mit Temperaturfühler und klarer D+-Steuerung.',
    haken:
      'Wer 14,6 V für seine Zellen braucht, ist hier falsch. Preis pro Ampere: rund 8,20 € bei 70 A — deutlich über dem Votronic.',
    links: [
      {
        href: 'https://www.ivt-hirschau.de/media/products/920000_Bedienungsanleitung_Ladebooster-SCHAUDT-WA121545.pdf',
        label: 'Handbuch',
        kind: 'handbuch',
      },
      {
        href: 'https://www.ivt-hirschau.de/de/Ladebooster-SCHAUDT-WA-121545-inkl-Anschluss-und-Temperaturfuehler-Set::1217.html',
        label: 'Preis / Händler',
        kind: 'preis',
      },
    ],
  },
  {
    id: 'votronic-90',
    brand: 'Votronic',
    name: 'VCC 1212-90',
    klasse: '90',
    stromA: 90,
    stromLabel: '90 A',
    dplus: 'optional',
    preisEur: 500,
    preisLabel: 'ca. 501 €',
    preisGeprueft: PREISSTAND,
    auffaellig: '150–600 Ah; 0–75 A drosselbar; 25/35 mm²',
    passtFuer: '300–600 Ah, Reserve für den Winter',
    specs: {
      strom: '90 A, drosselbar auf 75 A',
      kapazitaet: '150–600 Ah (optional 800)',
      steuerung: 'D+ / Zündung / Spannung',
      spannung: '13,9 / 14,2 / 14,4 / 14,6 V',
      querschnitt: '25 mm² bis 6 m, 35 mm² bis 9 m',
      masse: '234 × 139 × 74 mm / 1,48 kg',
      besonderheit: 'Temperaturfühler dabei, bei LiFePO4 Pflicht',
      preis: '500–555 €; mein Kauf: 380 €',
    },
    einordnung:
      'Mein Gerät. 90 A an 330 Ah sind 0,27 C; mit 75 A Drosselung bleiben 0,23 C. Ein Gerät, ein Kabelweg, ein Temperaturfühler. Der Preis ist nicht der billigste, aber gegenüber zwei Orion plus Verkabelung auch kein Ausreißer.',
    haken:
      'Der 90er braucht 25/35 mm² und Luft. Wer die alten 16-mm²-Kabel vom 30-A-Booster behält, hat das eigentliche Problem — nicht das Gerät.',
    links: [
      {
        href: 'https://www.offgridtec.com/media/product_attachements/Votronic_VCC_3326-3328-3329_Bedienungsanleitung.pdf',
        label: 'Handbuch',
        kind: 'handbuch',
      },
      {
        href: 'https://www.sprinter-forum.de/viewtopic.php?t=23955',
        label: 'Forum: 70-A-Langzeiterfahrung',
        kind: 'forum',
      },
    ],
    hervorgehoben: true,
  },
  {
    id: 'renogy-50',
    brand: 'Renogy',
    name: '50 A DC/DC mit MPPT',
    klasse: '60',
    stromA: 50,
    stromLabel: '50 A gesamt',
    dplus: 'IGN',
    preisEur: 210,
    preisLabel: 'ca. 210 €',
    preisGeprueft: PREISSTAND,
    auffaellig: '25 A je Quelle im Hybridbetrieb; 11,5-V-Schwelle',
    passtFuer: 'Kleine Bank, Solar und Lima gemeinsam',
    specs: {
      strom: '50 A gesamt, 25 A je Quelle im Hybridbetrieb',
      kapazitaet: null,
      steuerung: 'IGN',
      spannung: null,
      querschnitt: null,
      masse: null,
      besonderheit: 'Solar und Lichtmaschine teilen sich 50 A; 11,5-V-Schwelle',
      preis: 'ca. 210 €',
    },
    einordnung:
      '50 A sind die Gesamtleistung über beide Quellen. Im Hybridbetrieb liefert jede Quelle maximal 25 A. Wer 50 A aus der Lichtmaschine erwartet, während Solar läuft, wird enttäuscht.',
    haken:
      'Kombiniert, nicht additiv. Das Handbuch ist eindeutig; die Aufteilung muss man verstehen, bevor man kauft.',
    links: [
      {
        href: 'https://de.renogy.com/cdn/shop/files/RBC30D1S-G3_G4_RBC50D1S-G6_DC-DC_with_MPPT_EN__UM_B4.pdf',
        label: 'Handbuch',
        kind: 'handbuch',
      },
      {
        href: 'https://diysolarforum.com/threads/renogy-50a-dc-dc-mppt-charging-profile-w-engine-on.65496/',
        label: 'Forum: Hybridbetrieb',
        kind: 'forum',
      },
    ],
  },
  {
    id: 'buettner-bcb',
    brand: 'Büttner',
    name: 'MT BCB',
    klasse: '60',
    stromA: 60,
    stromLabel: '20–60 A + 230 V',
    dplus: 'ja',
    preisEur: 702,
    preisLabel: 'ca. 702 €',
    preisGeprueft: PREISSTAND,
    auffaellig: '3-in-1; EBL-Einschränkung; kein 90-A-Modell',
    passtFuer: 'Wer Lader und Booster in einem Gehäuse will',
    specs: {
      strom: '20–60 A Booster plus 230-V-Lader',
      kapazitaet: null,
      steuerung: 'D+ ja',
      spannung: null,
      querschnitt: null,
      masse: null,
      besonderheit: '3-in-1; EBL-Einschränkung; kein 90-A-Modell',
      preis: 'ca. 702 € (Einstieg)',
    },
    einordnung:
      '3-in-1 aus 230-V-Lader und Booster, 30/30/20 bis 60/40/40. Beim 40/40/30 muss in Fahrzeugen mit EBL auf 30 A begrenzt werden; der 30/30/20 braucht ein Hochlastrelais.',
    haken:
      'Einen 90-A-Booster gibt es nicht. Je nach Variante mit größerem 230-V-Teil liegen die Preise bei 959–1.289 € — der Tabellenwert ist der Einstieg, nicht die Obergrenze.',
    links: [],
  },
  {
    id: 'sterling-120',
    brand: 'Sterling Power',
    name: 'Saturn BB12120',
    klasse: '90',
    stromA: 110,
    stromLabel: '110–120 A',
    dplus: 'nein',
    preisEur: 711,
    preisLabel: 'ca. 711 €',
    preisGeprueft: PREISSTAND,
    auffaellig: '35 mm²/150 A; Herstellerangaben nicht konsistent',
    passtFuer: 'Große Bänke, wenn die Lima mitspielt',
    specs: {
      strom: '120 A laut Produktseite, 110 A bei 14,41 V laut Handbuch',
      kapazitaet: null,
      steuerung: 'kein D+',
      spannung: null,
      querschnitt: '35 mm² / 150 A',
      masse: null,
      besonderheit: 'Herstellerangaben widersprechen sich',
      preis: 'ca. 711 €',
    },
    einordnung:
      'Die Produktseite nennt 120 A und 1.620 W; das Handbuch nennt 110 A bei 14,41 V. Beides ist viel Leistung, für den Vergleich ist die Abweichung relevant.',
    haken: 'Einen deutschen BB12120-Einbaubericht habe ich nicht gefunden — die Erfahrungsdecke ist dünn.',
    links: [
      {
        href: 'https://sterling-power.com/products/bb12120-reverse-charging-jump-start-assistance',
        label: 'Herstellerseite',
        kind: 'hersteller',
      },
      {
        href: 'https://www.yachtbatterie.de/de/sterling-power-batterie-batterie-lader-bidirektional.html',
        label: 'Preis',
        kind: 'preis',
      },
    ],
  },
  {
    id: 'victron-buckboost',
    brand: 'Victron Energy',
    name: 'Buck-Boost 100 A',
    klasse: '90',
    stromA: 100,
    stromLabel: '100 A',
    dplus: 'programmierbar',
    preisEur: 795,
    preisLabel: 'ca. 795 €',
    preisGeprueft: PREISSTAND,
    auffaellig: 'für Victron-Systeme; sonst überdimensioniert',
    passtFuer: 'Gewachsenes Victron-System mit Monitoring',
    specs: {
      strom: '100 A, programmierbar',
      kapazitaet: null,
      steuerung: 'programmierbar',
      spannung: null,
      querschnitt: null,
      masse: null,
      besonderheit: 'Für Victron-Systeme mit Monitoring',
      preis: 'ca. 795 €',
    },
    einordnung:
      'Programmierbar und für ein gewachsenes Victron-System mit Monitoring interessant. Für eine einfache Nachrüstung ist es zu teuer und zu komplex.',
    haken: 'Ohne das passende System zahlt man für Funktionen, die man nicht nutzt.',
    links: [],
  },
  {
    id: 'import-120',
    brand: 'Ungebrandeter Import',
    name: '110–120-A-Wandler',
    klasse: '90',
    stromA: null,
    stromLabel: '110–120 A (angeblich)',
    dplus: 'je nach Gerät',
    preisEur: 180,
    preisLabel: 'ca. 180 € (beobachtet)',
    preisGeprueft: PREISSTAND,
    auffaellig: 'keine Prüfbarkeit; Gewährleistung bei Kauf in DE bleibt',
    passtFuer: 'Nicht empfohlen — Rechenbeispiel, kein Kaufvorschlag',
    specs: {
      strom: '110–120 A (angeblich, nicht geprüft)',
      kapazitaet: null,
      steuerung: 'je nach Gerät',
      spannung: null,
      querschnitt: null,
      masse: null,
      besonderheit: 'Datenblatt, Firmware und Dauerleistung nicht prüfbar',
      preis: 'ca. 180 € (beobachtet)',
    },
    einordnung:
      'Äußerlich und laut Datenblatt einem 110–120-A-Wandler entsprechend, für rund 180 €. Rechnerisch das günstigste Angebot im Vergleich — und trotzdem nicht genommen.',
    haken:
      'Kein Ansprechpartner, keine realistische Rücksendung, keine unabhängige Messreihe. Das war eine Risikoentscheidung, kein Messergebnis. Die gesetzliche Gewährleistung bei Kauf in Deutschland bleibt bestehen.',
    links: [],
  },
];

/** Anker für Deeplinks und die Rangliste. */
export const geraetAnker = (id: string): string => `p-${id}`;
