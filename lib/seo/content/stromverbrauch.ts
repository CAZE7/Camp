/**
 * lib/seo/content/stromverbrauch.ts — Cluster-Seite
 * `/camper-elektrik/stromverbrauch/`.
 *
 * Tabelle typischer 12-V-Verbraucher im Camper mit Verbrauchswerten,
 * Tagesenergie und dem Weg zur Batteriegröße. Alle Zahlen sind Beispielwerte
 * aus dem 12V-Elektroplaner oder Herstellerangaben — als solche gekennzeichnet.
 *
 * Information Gain: Eigene Verbraucher-Beispielrechnungen mit dem
 * 12V-Elektroplaner, Praxis-Entscheidung zur Standheizung, Normverweise.
 */

import type { SeoPageContent } from '../types';

/** Typischer Tageshaushalt im Weekend-Camper (Beispielwerte, keine Messwerte). */
const VERBRAUCHER_TAGE = [
  ['Kompressor-Kühlbox (40 l)', '3,75 A', '10 h', '45 W', '450 Wh'],
  ['LED-Beleuchtung', '1 A', '5 h', '12 W', '60 Wh'],
  ['Wasserpumpe', '5 A', '0,4 h', '60 W', '24 Wh'],
  ['Laptop über 12-V-Netzteil', '5,4 A', '4 h', '65 W', '260 Wh'],
  ['Standheizung Gebläse (Diesel)', '2,9 A', '8 h', '35 W', '280 Wh'],
] as const;

export const STROMVERBRAUCH_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/stromverbrauch/',
  slug: 'stromverbrauch',
  topicId: 'stromverbrauch',
  kind: 'cluster',
  title: 'Stromverbrauch im Camper: Tabelle und Berechnung',
  absoluteTitle: true,
  description:
    'Tabelle typischer 12-V-Verbraucher im Camper mit Watt, Stunden und Wattstunden pro Tag — plus Rechenweg zur Batteriegröße.',
  h1: 'Stromverbrauch typischer Camper-Verbraucher',
  lead: 'Bevor du Batterie, Solar oder Ladebooster dimensionierst, musst du wissen, wie viel Strom dein Camper am Tag verbraucht. Diese Tabelle zeigt typische Werte und den Rechenweg davon.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'kernantwort',
      heading: 'Wie viel Strom verbraucht ein Camper pro Tag?',
      body: [
        'Das hängt von den Geräten ab. Im Beispielhaushalt unten sind es 1 074 Wh je Tag — vor allem durch Kühlbox (450 Wh), Standheizungsgebläse (280 Wh) und Laptop (260 Wh). Ohne eigene Liste ist jede Pauschalzahl eine Schätzung.',
        'Der Rechenweg: P = U · I (Spannung mal Strom ergibt Leistung in Watt) und E = P · t (Leistung mal Stunden ergibt Energie in Wattstunden). Bei 45 W Kühlbox-Leistung über 10 Stunden ergeben sich 450 Wh.',
        'Für die Batteriedimensionierung ist nicht der Nennwert entscheidend, sondern die niedrigste im Betrieb auftretende Batteriespannung (z. B. 10,7 V bei entladener Bleibatterie unter Last). Bei sinkender Spannung steigt der Strom bei gleicher Leistungsabnahme (I = P / U).',
      ],
      callout: {
        tone: 'info',
        text: '[Batteriekapazität berechnen](/rechner/batteriekapazitaet/) — eigenen Tagesbedarf eingeben und die nötige Nennkapazität ermitteln.',
      },
    },
    {
      id: 'formel',
      heading: 'Der Rechenweg: von Watt zu Wattstunden',
      formula: {
        expression: 'E_Wh = U_V · I_A · t_h',
        caption: 'Beispiel: 45 W · 10 h = 450 Wh je Tag für die Kühlbox.',
      },
      definitions: [
        { term: 'U', description: 'Spannung in Volt (12 V Nennspannung im Camper-Bordnetz).' },
        { term: 'I', description: 'Betriebsstrom in Ampere (was der Verbraucher im Dauerbetrieb zieht).' },
        { term: 't', description: 'Nutzungsdauer in Stunden pro Tag.' },
        {
          term: 'E',
          description: 'Energie in Wattstunden (Wh) — die Summe aller Verbraucher ist der Tagesbedarf.',
        },
      ],
      body: [
        'Die vier Engineering-Nuancen für den Praxisalltag: (1) Bei 10,7 V statt 12 V zieht eine 20 W-USB-Doppelsteckdose (5 V, 2 × 2 A = 20 W Nennleistung) inklusive 20 % Puffer (24 W) bei 10,7 V real 2,24 A statt der theoretischen 1,66 A bei 12 V. (2) Ein 20 % Sicherheitspuffer für Wandlerverluste gehört dazu. (3) Ein Spannungsfall von über 4 % (0,48 V bei 12 V) kann dazu führen, dass empfindliche Geräte wie Kompressor-Kühlboxen, Dieselstandheizungen in der Glühphase oder Wechselrichter wegen Unterspannung abschalten; die Schwelle steht im Datenblatt. (4) Temperatur-Derating im geschlossenen Sitzkasten.',
      ],
    },
    {
      id: 'tabelle',
      heading: 'Tabelle: typische 12-V-Verbraucher und ihr Tagesverbrauch',
      body: [
        'Die Werte unten sind Beispielwerte aus dem 12V-Elektroplaner und Herstellerangaben — keine Messwerte deines Fahrzeugs. Deine eigenen Geräte können deutlich abweichen, besonders bei Kompressor-Kühlboxen, deren Laufzeit von Umgebungstemperatur und Öffnungsdauer abhängt.',
        'Die Spalte „Energie" ist bereits gerechnet (Watt × Stunden). Die Gesamtsumme ist der Eingabewert für die Batteriedimensionierung.',
        'Die Standheizung trägt 280 Wh zum Tagesbedarf bei — nicht weil sie elektrisch heizt, sondern weil das Gebläse Stunden läuft. Die eigentliche Heizleistung kommt aus dem Diesel, nicht aus der Batterie. Das ist ein häufiger Denkfehler: Die Standheizung wird als reiner Stromverbraucher eingeplant, obwohl sie nur das Gebläse mit Strom versorgt.',
        'Wer zwei Tage autark stehen will, braucht doppelt so viel nutzbare Energie: rund 2 148 Wh. Bei 90 % Entladetiefe (LiFePO4 im Modell) und 12 V Nennspannung sind das etwa 200 Ah Nennkapazität.',
        '[Beispiel] Die niedrige Stufe über Nacht statt Dauerbetrieb senkt den Tagesbedarf im Modell um rund 140 Wh — bei knapp bemessener Batterie kann das den Unterschied auf einen zusätzlichen autarken Tag machen.',
      ],
      table: {
        caption: 'Beispielhafter Tageshaushalt im 12-V-Camper (Modellwerte)',
        head: ['Verbraucher', 'Strom', 'Dauer/Tag', 'Leistung', 'Energie/Tag'],
        rows: VERBRAUCHER_TAGE,
        note: 'Beispielwerte, keine Messwerte. Der Tagesgesamtwert von 1 074 Wh ist der Eingang für die Batteriedimensionierung.',
      },
      links: [
        {
          href: '/rechner/batteriekapazitaet/',
          label: 'Batteriegröße nachrechnen',
          description: 'Eigenen Tagesbedarf eingeben und dieselbe Rechnung laufen lassen.',
        },
      ],
    },
    {
      id: 'spitze',
      heading: 'Spitzenstrom und Dauerstrom unterscheiden',
      body: [
        'Einige Verbraucher ziehen kurzzeitig mehr Strom als im Dauerbetrieb. Eine Kompressor-Kühlbox hat einen Anlaufstrom, der für Sekunden höher liegt als der Nennstrom. Ein Wechselrichter für 230-V-Geräte kann kurz das Mehrfache seiner Dauerleistung ziehen.',
        'Für den Kabelquerschnitt zählt der Dauerstrom. Für die Sicherung zählt ebenfalls der Dauerstrom — die Sicherung muss im Normalbetrieb nicht auslösen, bei Kurzschluss aber sicher abschalten.',
        'Anlaufströme sind keine Planungsgröße im 12V-Elektroplaner. Wer einen Wechselrichter mit 1 000 W betreiben will, rechnet mit dem Dauerstrom des Wechselrichters, nicht mit dem Anlauf des angeschlossenen Geräts.',
      ],
      callout: {
        tone: 'warning',
        text: 'Der Anlaufstrom eines Kompressors oder Wechselrichters steht nicht im Datenblatt jedes Geräts. Ohne belegtem Wert rechnet das Modell nicht mit Anlauf — [PRÜFEN: Anlaufstrom im Datenblatt des konkreten Geräts nachsehen].',
      },
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler bei der Verbraucherermittlung',
      list: {
        items: [
          'Nur die Nennleistung aufschreiben, nicht die Laufzeit: Ein 60-W-Gerät, das 10 Stunden läuft, verbraucht mehr als ein 400-W-Gerät, das 10 Minuten läuft.',
          'Standby-Verbrauch vergessen: Wechselrichter, Ladegeräte und Booster ziehen auch im Leerlauf Strom.',
          'Die Standheizung als reinen Heizverbraucher zählen: Das Gebläse braucht Strom, die Heizung selbst heizt mit Diesel.',
          'Verbraucher zusammenschätzen statt aufzuschreiben: „Ungefähr 500 Wh" führt zu einer Batterie, die entweder zu groß oder zu klein ausfällt.',
          'Nur den Sommer planen: Im Winter läuft das Gebläse der Standheizung länger, die Kühlbox seltener — beides ändert den Tagesbedarf.',
        ],
      },
    },
    {
      id: 'naechster-schritt',
      heading: 'Vom Verbrauch in den Plan',
      body: [
        'Mit dem Tagesverbrauch als Eingabe rechnet der Batterie-Rechner die nötige Nennkapazität aus — inklusive Entladetiefe, Peukert-Effekt und Ladezeit-Aufschlag. Daraus folgen Solarfläche, Ladebooster und Kabelquerschnitt.',
      ],
      callout: {
        tone: 'info',
        text: '[Batteriekapazität berechnen](/rechner/batteriekapazitaet/) — eigene Verbrauchszahlen eingeben und das Ergebnis als Plan laden.',
      },
      links: [
        {
          href: '/camper-elektrik/batterie/',
          label: 'Batterie dimensionieren',
          description: 'Entladetiefe, Peukert und der Weg vom Tagesbedarf zur Nennkapazität.',
        },
        {
          href: '/camper-elektrik/solar/',
          label: 'Solar auslegen',
          description: 'Wie viel Watt Solarleistung den Tagesbedarf decken.',
        },
        {
          href: '/planer/',
          label: 'Camper-Elektroplaner öffnen',
          description: 'Den Verbrauch als Plan zeichnen und Querschnitt sowie Sicherung ableiten.',
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Wie viel Strom verbraucht ein Camper pro Tag?',
      answer:
        'Das hängt von den Geräten ab. Im Beispielhaushalt oben sind es 1 074 Wh je Tag — vor allem durch Kühlbox (450 Wh), Standheizungsgebläse (280 Wh) und Laptop (260 Wh). Ohne eigene Liste ist jede Pauschalzahl eine Schätzung.',
    },
    {
      question: 'Rechnen alle Verbraucher mit 12 V?',
      answer:
        'Die 12-V-Geräte direkt, ja. 230-V-Geräte über einen Wechselrichter brauchen zusätzlich den Wirkungsgrad des Wechselrichters (meist 85–90 %) — 800 W Kaffeemaschine ziehen am 12-V-Bordnetz rund 900 W plus Verluste.',
    },
    {
      question: 'Wie komme ich vom Tagesverbrauch zur Batteriegröße?',
      answer:
        'Tagesverbrauch mal Autarkietage geteilt durch (Spannung × Entladetiefe). Bei 1 074 Wh, zwei Tagen, 12 V und 90 % Entladetiefe sind das rund 200 Ah LiFePO4. Der Rechner führt den Peukert-Faktor zusätzlich mit ein.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/camper-elektrik/solar/', label: 'Solar auslegen' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modellwerte für Verbraucher',
      detail:
        'Beispielwerte aus dem 12V-Elektroplaner (Kompressor-Kühlbox 4,5 A, LED 1 A, Wasserpumpe 5 A, Laptop 5,4 A, Gebläse 2,9 A). Keine Messwerte.',
    },
    {
      label: 'Rechenweg',
      detail:
        'E = U · I · t; Tagesgesamtwert als Eingang für `lib/batterySizing.ts` (Entladetiefe 90 %, Peukert, Ladezeit-Aufschlag 1,15).',
    },
  ],
  assumptions: [
    'Alle Verbraucherwerte sind Beispielwerte aus dem 12V-Elektroplaner oder Herstellerangaben, keine Messwerte eines bestimmten Fahrzeugs.',
    'Die Laufzeiten pro Tag sind Annahmen für einen typischen Weekend-Einsatz.',
    'Der Spannungsverlauf der Batterie über den Tag ist nicht modelliert; die Rechnung verwendet konstante 12 V.',
  ],
  limits: [
    'Keine Aussage zum Verbrauch spezifischer Gerätemodelle — Datenblatt oder eigene Messung ist erforderlich.',
    '230-V-Verbraucher über Wechselrichter werden nicht separat aufgeführt; der Wirkungsgrad des Wechselrichters ist nicht modelliert.',
    'Saisonale Schwankungen (Winterheizung, Sommerkühlung) sind nicht modelliert.',
  ],
};
