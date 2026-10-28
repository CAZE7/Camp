import type { FaqEntry } from '@/lib/seo/types';

/**
 * app/tools/heizung/explainerContent.ts — der erklärende Text des
 * Heizlast-Rechners.
 *
 * Wie beim Dach-Planer stehen die Texte hier, weil sie an zwei Stellen
 * gebraucht werden: sichtbar unter dem Rechner (`page.tsx`) und als `FAQPage`
 * in der strukturierten Beschreibung (`layout.tsx`). Die Export-Prüfung
 * vergleicht beide Fassungen Zeichen für Zeichen.
 *
 * Alle Zahlen sind die des Modells in `page.tsx` (`calculateThermodynamics`)
 * und des Gerätekatalogs (`HEATER_CATALOG`) — keine Datenblattwerte, keine
 * Normaussage. Was der Rechner nicht leistet (keine Wärmebrücken, keine
 * solaren Gewinne, kein Aufheizverlauf), steht ausdrücklich als Grenze da.
 */

/** U-Werte des Modells in W/(m²·K) — Spiegel der Konstanten in `page.tsx`. */
export const HEIZUNG_U_WERTE = { fenster: 3.0, blechUngedaemmt: 5.88 } as const;

/** Wärmeleitfähigkeit der Dämmung in W/(m·K) und innerer Übergangswiderstand. */
export const HEIZUNG_DAEMMUNG = { lambda: 0.036, rueckwand: 0.17 } as const;

/** Zuschlag bei „schnelles Aufheizen“. */
export const HEIZUNG_RESERVE_FAKTOR = 1.3;

export const HEIZUNG_EXPLAINER_BLOCKS = [
  {
    id: 'huelle',
    heading: 'Welche Fläche der Rechner ansetzt',
    body: [
      'Die Hüllfläche ist die Oberfläche eines Quaders aus Länge, Breite und Höhe des Fahrzeugs: 2 · (L·H + B·H + L·B). Für die Wärmeverluste zählt diese Fläche, nicht der Grundriss — Decke, Boden und alle vier Wände liegen an der Außenluft.',
      'Fensterfläche und Dämmquote werden davon abgezogen, bevor der Rechner rechnet: Der eingestellte Fensteranteil geht mit dem U-Wert eines Fensters in die Bilanz, der Rest wird nach deinem Dämmgrad in gedämmte und ungedämmte Fläche geteilt.',
    ],
  },
  {
    id: 'u-werte',
    heading: 'Welche U-Werte das Modell annimmt',
    body: [
      'Angesetzt werden 3,0 W/(m²·K) für Fenster und 5,88 W/(m²·K) für ungedämmtes Blech. Für gedämmte Flächen bildet der Rechner den U-Wert aus der Dämmstärke: U = 1 / (0,17 + d / 0,036), mit d in Metern und 0,036 W/(m·K) für die Dämmung. 19 mm ergeben damit rund 1,4 W/(m²·K) — ungefähr ein Viertel des ungedämmten Werts.',
      'Diese Werte sind Modellannahmen, keine Messungen. Sie ordnen Fahrzeuge nach Dämmstandard richtig ein; sie ersetzen keine Wärmebrückenberechnung.',
    ],
  },
  {
    id: 'luftwechsel',
    heading: 'Wie Lüftung und Reserve in die Summe kommen',
    body: [
      'Der Lüftungsverlust folgt der Faustformel 0,34 · Volumen · Luftwechsel · Temperaturdifferenz. Der Luftwechsel startet bei 0,5 pro Stunde und steigt mit der Fensterfläche um bis zu 0,5 weitere Wechsel — große Fenster kosten also doppelt: über die Fläche und über die Lüftung.',
      `Mit „schnelles Aufheizen“ multipliziert der Rechner die Summe zusätzlich mit ${HEIZUNG_RESERVE_FAKTOR.toString().replace(
        '.',
        ','
      )} — 30 % Reserve. Die Rechnung selbst bleibt stationär: Sie beschreibt den Beharrungszustand, keinen Aufheizverlauf.`,
    ],
  },
  {
    id: 'grenzen',
    heading: 'Wo die Abschätzung endet',
    body: [
      'Nicht enthalten sind Wärmebrücken (Rahmen, Holme, Radkästen), solare Gewinne durch Sonne, die Wärmeabgabe von Personen und die Zeit, die das Fahrzeug zum Aufheizen braucht. Für die Auswahl eines Heizgeräts ist die Zahl deshalb eine gute Näherung — für einen Energieausweis ist sie es nicht.',
      'Der Rechner prüft außerdem beide Grenzen des gewählten Geräts: Es muss deine Last decken und darf bei −10 °C nicht unter seine Mindestleistung fallen. Diesel-Luftheizungen, die dauerhaft unter ihrer Modulationsgrenze laufen, sind im Gerätekatalog ausdrücklich als kritisch vermerkt.',
    ],
  },
] as const;

export const HEIZUNG_FAQ: readonly FaqEntry[] = [
  {
    question: 'Welche Heizleistung braucht mein Camper?',
    answer:
      'Das hängt von Hüllfläche, Dämmstärke, Fensterfläche und der Temperaturdifferenz ab — genau diese Größen rechnet der Rechner. Ein pauschaler Quadratmeter-Wert wäre bequemer, aber falsch: Derselbe Kastenwagen braucht bei −10 °C ein Vielfaches dessen, was bei +5 °C reicht. Fahrzeug, Dämmung und Außentemperatur eingeben; die Leistung steht im Ergebnisblock.',
  },
  {
    question: 'Warum ist eine größere Heizung nicht automatisch besser?',
    answer:
      'Weil Diesel-Luftheizungen unterhalb ihrer Mindestleistung dauerhaft takten: Im Gerätekatalog ist für die Autoterm 4D vermerkt, dass sie bei Unterforderung zum Verrußen neigt, und der 5-kW-Standardheizer braucht laut Katalog viel Raumvolumen, um Tot-Taktung zu vermeiden. Der Rechner empfiehlt deshalb das kleinste Modell, das deine Last deckt und bei −10 °C über seiner Mindestleistung bleibt.',
  },
  {
    question: 'Sind die U-Werte im Rechner gemessen?',
    answer:
      'Nein. Sie sind Modellannahmen: 3,0 W/(m²·K) für Fenster, 5,88 W/(m²·K) für ungedämmtes Blech, und für gedämmte Flächen 1/(0,17 + d/0,036) aus der Dämmstärke d. Sie ordnen Fahrzeuge nach Dämmstandard ein; gemessen oder normgerecht berechnet wird nichts.',
  },
  {
    question: 'Was bewirkt die Option „schnelles Aufheizen“?',
    answer:
      'Sie multipliziert die berechnete Leistung mit 1,3, also 30 % Reserve. Der Zuschlag erhöht die verlangte Geräteleistung; die Rechnung selbst bleibt eine stationäre Bilanz für den Beharrungszustand und beschreibt keinen Aufheizverlauf mit Zeitangabe.',
  },
];
