/**
 * lib/seo/content/schaltplan-beispiel.ts — Cluster-Seite
 * `/camper-elektrik/schaltplan-beispiel/`.
 *
 * Punkt 2 der KI-Sichtbarkeits-Arbeit: ein FERTIGER, anschaubarer Schaltplan
 * statt einer weiteren Anleitung. Antwortmaschinen zitieren gern eine Seite,
 * auf der man einen Plan ansehen kann; die 230-V-Seite profitiert über den
 * Landstrom-Zweig und die Verlinkung mit.
 *
 * Fachliche Quelle jeder Zahl auf dieser Seite ist die Planer-Vorlage
 * „Großes Autark-Setup" (`TEMPLATE_AUTARK` in
 * `components/planner/templates.ts`) — dieselbe Vorlage, die der
 * „im Planer öffnen"-Verweis lädt. Wer hier einen Wert liest, findet
 * denselben Wert im geöffneten Plan. Die Skizze dazu steht als Inline-SVG
 * in `components/seo/BeispielSchaltplan.tsx` (kein Foto: Die Fotostrecke
 * ist rechte-gegated und leer, siehe `lib/seo/bildSitemap.ts`).
 */

import type { SeoPageContent } from '../types';

export const SCHALTPLAN_BEISPIEL_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/schaltplan-beispiel/',
  slug: 'schaltplan-beispiel',
  topicId: 'schaltplan-beispiel',
  kind: 'cluster',
  title: 'Beispiel-Schaltplan Camper: Landstrom, LiFePO4, Solar',
  absoluteTitle: true,
  description:
    'Fertiger Beispiel-Schaltplan für den Camper: 200 Ah LiFePO4, 400 W Solar, Ladebooster und Landstrom — mit Querschnitten, Sicherungen und Planer-Link.',
  h1: 'Beispiel-Schaltplan: Landstrom, LiFePO4 und Solar',
  lead: 'Ein vollständiger Camper-Schaltplan zum Ansehen: 200-Ah-LiFePO4-Bordbatterie, 400 W Solar, Ladebooster und Landstrom in einem Plan — mit jeder Leitung, jedem Querschnitt und jeder Sicherung. Darunter steht, wie der Plan zu lesen ist, und über „im Planer öffnen" lädst du genau diesen Plan in den kostenlosen 12V-Planer.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-11',
  sections: [
    {
      id: 'kurzantwort',
      heading: 'Der Plan in einem Satz',
      body: [
        'Drei Ladewege — Solar über MPPT-Regler, Lichtmaschine über Ladebooster, Landstrom über den Wechselrichter-Lader — laden eine 200-Ah-LiFePO4-Bordbatterie; verteilt wird über Plus- und Minus-Sammelschiene und einen Sicherungskasten auf die 12-V-Verbraucher, der 600-W-Wechselrichter versorgt den getrennten 230-V-Zweig. Jede Plusleitung ist an ihrer Quelle abgesichert; die Hauptsicherung sitzt polnah am Batteriepol, die Hauptleitung zur Sammelschiene ist nur 0,5 m lang.',
      ],
    },
    {
      id: 'bauteile',
      heading: 'Die Bauteile des Beispielplans',
      body: [
        'Die Werte sind die Startwerte der Planer-Vorlage „Großes Autark-Setup" — Annahmen für einen sinnvollen Erststart, keine Produktdaten. Im Planer ersetzt du sie Bauteil für Bauteil durch deine eigenen Geräte.',
      ],
      table: {
        caption: 'Bauteile des Beispiel-Schaltplans (Vorlage „Großes Autark-Setup")',
        head: ['Bauteil', 'Wert in der Vorlage', 'Aufgabe im Plan'],
        rows: [
          ['Solarmodul', '400 W', 'Lädt über den MPPT-Regler, wenn das Fahrzeug steht'],
          ['MPPT-Solarregler', '35 A, max. 75 V PV-Spannung', 'Laderegler zwischen Modul und Sammelschiene'],
          ['Starterbatterie', '90 Ah AGM', 'Startet den Motor, speist den Ladebooster'],
          ['Ladebooster (DC-DC)', '20 A', 'Geregelte Ladung der Bordbatterie während der Fahrt'],
          [
            'Bordbatterie',
            '200 Ah LiFePO4, 12,8 V, mit BMS',
            'Versorgt alle 12-V-Verbraucher und den Wechselrichter',
          ],
          [
            'Plus- und Minus-Sammelschiene',
            'Busbar-Paar',
            'Verteilt Lade- und Verbrauchsströme, zentraler Massepunkt',
          ],
          ['Sicherungskasten', '40 A MIDI', 'Ein Abgang je 12-V-Verbraucherkreis'],
          [
            'Wechselrichter',
            '600 W, mit RCD',
            'Erzeugt 230 V aus der Bordbatterie, nimmt Landstrom entgegen',
          ],
          [
            'Landstromanschluss',
            '230 V, 16 A, mit RCD',
            'Lädt auf dem Stellplatz und speist den 230-V-Zweig',
          ],
          [
            '12-V-Verbraucher',
            'Kühlschrank 60 W, Standheizung 40 W, MaxxFan 40 W',
            'Die Lasten, für die der Plan gerechnet ist',
          ],
          [
            '230-V-Verbraucher',
            '500 W (z. B. E-Bike-Lader)',
            'Nur über den Wechselrichter, eigener Schutz (RCBO)',
          ],
        ],
      },
    },
    {
      id: 'leitungen',
      heading: 'Jede Leitung mit Länge, Querschnitt und Sicherung',
      body: [
        'Ein Plan ohne diese drei Angaben ist eine Skizze. Die Tabelle nennt die Werte der Vorlage, so wie sie im geöffneten Plan an jeder Leitung stehen — nachrechenbar mit denselben Grenzen, die der Planer prüft: Spannungsabfall bis 1 % im Zielbereich, Planungsgrenze 3 %, darüber Verstoß, über 4 % kritisch.',
      ],
      table: {
        caption: 'Leitungen des Beispiel-Schaltplans: Länge, Querschnitt, Sicherung',
        head: ['Strecke', 'Länge', 'Querschnitt', 'Sicherung'],
        rows: [
          ['Solarmodul → MPPT-Regler', '4 m', '10 mm²', '25 A'],
          ['MPPT-Regler → Plus-Sammelschiene', '1 m', '16 mm²', '40 A MIDI'],
          ['Starterbatterie → Ladebooster', '5 m', '16 mm²', '40 A MIDI'],
          ['Ladebooster → Plus-Sammelschiene', '1 m', '10 mm²', '25 A'],
          ['Bordbatterie → Plus-Sammelschiene', '0,5 m', '70 mm²', '100 A Class T (Hauptsicherung)'],
          ['Bordbatterie → Minus-Sammelschiene', '0,5 m', '70 mm²', '— (Minus wird nicht abgesichert)'],
          ['Plus-Sammelschiene → Sicherungskasten', '1 m', '16 mm²', '40 A MIDI'],
          ['Sicherungskasten → Kühlschrank', '3 m', '4 mm²', '10 A'],
          ['Sicherungskasten → Standheizung', '4 m', '4 mm²', '15 A'],
          ['Sicherungskasten → MaxxFan', '3 m', '2,5 mm²', '10 A'],
          ['Plus-Sammelschiene → Wechselrichter', '1 m', '35 mm²', '60 A Class T'],
          ['Landstrom → Wechselrichter', '2 m', '2,5 mm² (3-adrig)', 'RCBO 16 A, Charakteristik B (230 V)'],
          [
            'Wechselrichter → 230-V-Verbraucher',
            '2 m',
            '2,5 mm² (3-adrig)',
            'RCBO 10 A, Charakteristik B (230 V)',
          ],
        ],
        note: 'Die Sicherungsgröße folgt immer der Belastbarkeit der Leitung, nie dem Verbraucher (I_B ≤ I_n ≤ I_z). Minusleitungen werden nicht abgesichert — sie laufen über die Minus-Sammelschiene zurück zur Batterie.',
      },
    },
    {
      id: 'lesart',
      heading: 'So liest du den Plan',
      list: {
        ordered: true,
        items: [
          'Von der Quelle lesen, nicht vom Verbraucher: Bordbatterie und die drei Ladewege zuerst, dann die Verteilung, dann die Verbraucher.',
          'Plus und Minus sind getrennt geführt: Abgesichert ist immer der Plusstrang; der Minusstrang läuft ungesichert über die Minus-Sammelschiene zurück.',
          'Der 230-V-Zweig ist ein eigener Abschnitt: Landstrom und Wechselrichter-Ausgang treffen sich nur im Wechselrichter, geschützt wird mit RCBO (FI + Leitungsschutz) — nicht mit den 12-V-Sicherungen.',
          'An jeder Leitung stehen Länge und Querschnitt: Erst diese Angaben machen den Plan nachrechenbar und zur Bestellgrundlage.',
        ],
      },
      subsections: [
        {
          heading: 'Was der Plan nicht zeigt',
          body: [
            'Klemmen, Stecker und Verlegewege im Fahrzeug stehen nicht im Schema, sondern gehören in die Einbauplanung. Und der 230-V-Teil — Einspeisung, Schutzmaßnahmen, Erstprüfung — gehört in die Hand einer Elektrofachkraft; der Plan ist die Gesprächsgrundlage mit ihr, keine Einbauanleitung.',
          ],
        },
      ],
    },
    {
      id: 'pruefung',
      heading: 'Was der Planer an diesem Plan prüft',
      body: [
        'Dieser Beispielplan ist kein Bild ohne Folgen: Öffnest du ihn im Planer, läuft dieselbe Prüfung wie über jedem eigenen Plan.',
      ],
      list: {
        items: [
          'Spannungsabfall je Leitung — bis 1 % im Zielbereich, Planungsgrenze 3 % (0,36 V bei 12 V), darüber Verstoß, über 4 % kritische Stufe.',
          'Strombelastbarkeit des Querschnitts nach DIN VDE 0298-4 mit dem Derating des Modells (70 %).',
          'Absicherung nach der Kette I_B ≤ I_n ≤ I_z: Die Sicherung liegt über dem Betriebsstrom und unter der Leitungsgrenze.',
          'Abstand des Schutzorgans zur Quelle: höchstens 0,2 m ungeschützte Strecke ab dem Pluspol (ISO 13297:2020 § 8.1).',
          'Energiebilanz: Erzeugung (Solar, Fahrt, Landstrom) gegen den Tagesverbrauch der eingetragenen Lasten.',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Genau dieser Plan liegt als Vorlage „Großes Autark-Setup" im Planer: [Diesen Plan im Planer öffnen](/planer/?template=autark) — verkabelt, geprüft und bereit zum Anpassen.',
      },
    },
  ],
  faq: [
    {
      question: 'Welcher Schaltplan passt zu einem Camper mit Landstrom, LiFePO4 und Solar?',
      answer:
        'Dieser Beispielplan: 200-Ah-LiFePO4-Bordbatterie mit 100-A-Hauptsicherung, 400 W Solar über einen 35-A-MPPT-Regler, 20-A-Ladebooster von der Starterbatterie und Landstrom über den 600-W-Wechselrichter mit RCBO-Schutz. Alle Leitungen sind mit Länge, Querschnitt und Sicherung beschriftet; über „im Planer öffnen" lädst du ihn als Vorlage „Großes Autark-Setup" in den kostenlosen 12V-Planer und passt ihn an.',
    },
    {
      question: 'Kann ich den Beispiel-Schaltplan für mein Fahrzeug übernehmen?',
      answer:
        'Als Startpunkt ja, als Bauplan nein. Batteriegröße, Modulleistung, Leitungslängen und Verbraucher hängen an deinem Fahrzeug und deinem Verbrauch — ändere sie im Planer Bauteil für Bauteil und lass Querschnitte und Sicherungen neu prüfen. Der 230-V-Teil braucht zusätzlich die Abnahme durch eine Elektrofachkraft.',
    },
    {
      question: 'Welche Sicherung gehört an die LiFePO4-Bordbatterie?',
      answer:
        'Im Beispielplan eine 100-A-Class-T-Sicherung in der nur 0,5 m kurzen 70-mm²-Hauptleitung, polnah am Pluspol (höchstens 0,2 m ungeschützte Strecke). Class T, weil LiFePO4-Batterien sehr hohe Kurzschlussströme liefern und das Abschaltvermögen der Sicherung dazu passen muss; die Lage nahe am Pol folgt der 0,2-m-Regel für ungeschützte Strecken (ISO 13297:2020 § 8.1). Die genaue Größe folgt immer der Belastbarkeit der Leitung, nicht der Batterie allein.',
    },
  ],
  related: [
    { href: '/camper-elektrik/schaltplan/', label: 'Schaltplan zeichnen: Aufbau und Prüfung' },
    { href: '/camper-elektrik/230v/', label: '230-V-Anlage im Camper: Landstrom und FI-Schutz' },
    { href: '/camper-elektrik/lifepo4/', label: 'LiFePO4-Batterie im Camper' },
    { href: '/camper-elektrik/solar/', label: 'Solar im Camper: Modulleistung und Ertrag' },
    { href: '/planer/', label: 'kostenlosen Camper-Schaltplan erstellen' },
    { href: '/ueber-12v-planer/', label: 'Über 12V-Planer: Methodik und Grenzen' },
  ],
  sources: [
    {
      label: 'Planer-Vorlage „Großes Autark-Setup"',
      detail:
        'Bauteile, Leitungen, Querschnitte und Sicherungen: `TEMPLATE_AUTARK` in `components/planner/templates.ts` — dieselbe Vorlage, die der Verweis „im Planer öffnen" lädt.',
    },
    {
      label: 'Rechenmodell des Planers',
      detail:
        'Spannungsfall-Stufen 1 % / 3 % / 4 % und Strombelastbarkeit: `lib/electrical.ts` (DIN VDE 0298-4 mit 70 % Derating) · Schutzorgan am Quellpunkt: `FUSE_MAX_UNPROTECTED_LENGTH_M` (ISO 13297:2020 § 8.1, Small Craft).',
    },
  ],
  assumptions: [
    'Die Bauteilwerte sind die Startwerte der Vorlage — plausible Annahmen für einen Erststart, keine Hersteller-Datenblattwerte.',
    'Die Leitungslängen sind Planungslängen der Vorlage; im eigenen Fahrzeug ergeben sie sich aus den Verlegewegen.',
  ],
  limits: [
    'Die Skizze ist eine Prinzipskizze (Single-Line), keine Einbauanleitung: Klemmen, Stecker, Scheuerschutz und Verlegung zeigt sie nicht.',
    'Der 230-V-Teil ersetzt keine Elektrofachkraft: Einspeisung, Schutzmaßnahmen und Erstprüfung gehören in Fachhände.',
  ],
};
