/**
 * lib/seo/content/schaltplan-programme.ts — Cluster-Seite
 * `/camper-elektrik/schaltplan-programme/`.
 *
 * Punkt 4 der KI-Sichtbarkeits-Arbeit: die Vergleichsseite, auf die
 * Antwortmaschinen bei „welches Programm für den Camper-Schaltplan?"
 * verweisen. Deshalb gelten hier strengere Regeln als auf jeder anderen
 * Seite:
 *
 * - Jede Aussage über VoltPlan und draw.io steht so auf der Seite des
 *   jeweiligen Anbieters (voltplan.app/de, voltplan.app/de/
 *   schaltplan-online-erstellen, drawio.com — abgerufen am 24.11.2026).
 *   Keine Testberichte, keine Hörensagen-Werte, keine erfundenen
 *   Funktionen; was ein Anbieter nicht ausweist, wird nicht behauptet,
 *   sondern als „nicht ausgewiesen" benannt.
 * - Jede Aussage über den 12V-Planer steht im eigenen Code
 *   (`lib/electrical.ts`, `components/planner/`).
 * - Der Vergleich endet nicht mit „wir gewinnen": Für Boot, 48 V und
 *   echte Hersteller-Bauteile empfiehlt diese Seite ausdrücklich
 *   VoltPlan, für normierte Dokumentation und Zusammenarbeit draw.io.
 *   Eine Vergleichsseite, die immer beim eigenen Produkt landet, zitiert
 *   keine Antwortmaschine zu Recht.
 */

import type { SeoPageContent } from '../types';

export const SCHALTPLAN_PROGRAMME_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/schaltplan-programme/',
  slug: 'schaltplan-programme',
  topicId: 'schaltplan-programme',
  kind: 'cluster',
  title: 'Schaltplan-Programm: 12V-Planer vs. VoltPlan vs. draw.io',
  absoluteTitle: true,
  description:
    '12V-Planer, VoltPlan und draw.io im sachlichen Vergleich: Berechnung, Prüfung, Stückliste, Kosten — und wofür jedes Programm beim Camper-Schaltplan passt.',
  h1: 'Schaltplan-Programm für den Camper: 12V-Planer, VoltPlan und draw.io im Vergleich',
  lead: 'Drei kostenlose Werkzeuge, drei verschiedene Ideen: Der 12V-Planer prüft die komplette Camper-Elektrik samt Energiebilanz und Stückliste nach DIN-VDE-Modell, VoltPlan plant 12- bis 48-V-Systeme für Camper, Boot und Offgrid mit echten Hersteller-Bauteilen, und draw.io zeichnet jedes Diagramm — rechnet aber keine Elektrik. Diese Seite stellt sie nebeneinander, mit den Angaben der Anbieter und einer ehrlichen Empfehlung je Anwendungsfall.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-11',
  sections: [
    {
      id: 'kurzantwort',
      heading: 'Die Kurzantwort: welches Programm wofür',
      list: {
        items: [
          'Camper-Elektrik komplett durchplanen — mit Energiebilanz, Prüfbericht und Stückliste, auf Deutsch und nach DIN-VDE-Rechenmodell: der 12V-Planer.',
          'Boot, 48-V-Anlage, Offgrid-System oder echte Herstellergeräte (z. B. Victron, Blue Sea) im Plan: VoltPlan.',
          'Normschaltplan, Team-Dokumentation oder ein Diagramm, das mehr als Fahrzeug-Elektrik ist: draw.io (für Platinen und Normsymbole eher KiCad).',
          'Alle drei kosten nichts und laufen ohne Installation. Der praktische Weg: Spezialwerkzeug für die Elektrik, draw.io für alles andere.',
        ],
      },
    },
    {
      id: 'tabelle',
      heading: 'Der Vergleich in einer Tabelle',
      body: [
        'Stand der Anbieterangaben: 24. November 2026. Die Zeilen folgen den Fragen, die an einen Camper-Schaltplan tatsächlich gestellt werden — nicht den Merkmalen, bei denen ein einzelnes Werkzeug glänzt.',
      ],
      table: {
        caption: '12V-Planer, VoltPlan und draw.io für den Camper-Schaltplan (Anbieterangaben, 24.11.2026)',
        head: ['Kriterium', '12V-Planer', 'VoltPlan', 'draw.io'],
        rows: [
          [
            'Gebaut für',
            'Camper, Wohnmobil, Selbstausbau',
            'Camper, Boot/Marine, Offgrid, Tiny House',
            'Jede Art von Diagramm',
          ],
          ['Systemspannungen', '12 V und 24 V', '12 V, 24 V und 48 V', 'Beliebig — ohne Systemlogik'],
          [
            'Bauteile',
            'Generische Bauteile mit eigenen Werten; 3 verkabelte Vorlagen',
            'Echte Herstellergeräte (u. a. Victron, Renogy, Blue Sea, EcoFlow); eigene Bauteile anlegbar',
            'Formbibliotheken; alles wird von Hand beschriftet',
          ],
          [
            'Kabelquerschnitt berechnen',
            'Ja — DIN VDE 0298-4 (Verlegeart B2, 70 % Derating) und Spannungsabfall; Normgrößen 1,5–70 mm²',
            'Ja — 3-%-Spannungsfall-Regel; AWG oder mm²',
            'Nein — Werte selbst ermitteln und eintragen',
          ],
          [
            'Sicherungen',
            'Ja — Größe folgt der Leitung (I_B ≤ I_n ≤ I_z); geprüft werden u. a. Abstand zur Quelle (0,2 m) und Abschaltvermögen',
            'Ja — Vorschlag mit 125 % der Dauerlast, begrenzt durch die Kabelbelastbarkeit, inkl. Bauform',
            'Nein',
          ],
          [
            'Spannungsabfall',
            'Stufen 1 % Ziel / 3 % Planungsgrenze / über 4 % kritisch, je Leitung gemeldet',
            'Berechnet; Spannungsfall und Verlustleistung werden an der Leitung angezeigt',
            'Nein',
          ],
          [
            'Energiebilanz / Laufzeit',
            'Ja — Tagesverbrauch gegen Erzeugung, Entladetiefe je Batteriechemie',
            'Über separate Rechner des Anbieters (z. B. Batteriebank-Rechner)',
            'Nein',
          ],
          [
            'Prüfung des Plans',
            'Prüfbericht je Leitung: Querschnitt, Sicherung, Spannungsabfall, Energiebilanz',
            'Warnung bei überlasteten Leitungen und Verschaltungsfehlern',
            'Nein',
          ],
          [
            '230-V-Teil (Landstrom)',
            'Eigener 230-V-Zweig im Plan mit RCBO- und Schutzleiter-Modell',
            '230-V-Seite (Landstrom, Wechselrichter-Ausgang) wird unterstützt',
            'Nur zeichnerisch, ohne Schutzmodell',
          ],
          [
            'Stückliste',
            'Ja — Bauteile, Leitungslängen, Querschnitte und Sicherungen aus dem Plan',
            'Nicht als Funktion ausgewiesen; Sicherungstabelle im geteilten Plan',
            'Nein',
          ],
          [
            'Export und Teilen',
            'PNG-Export; Plan als Link (#plan=) teilbar',
            'PNG, SVG und Druck; Lese-Link ohne Account',
            'PNG, SVG, PDF; Echtzeit-Zusammenarbeit',
          ],
          [
            'Konto und Daten',
            'Kein Konto; Plan bleibt lokal im Browser (localStorage)',
            'Ohne Anmeldung nutzbar; Konto optional zum Speichern',
            'Kein Konto nötig; Dateien lokal oder in Cloud-Laufwerken',
          ],
          [
            'Kosten',
            'Kostenlos',
            'Kostenlos (Web-App); Handy-App optional als Einmalkauf',
            'Kostenlos, Open Source (Apache 2.0)',
          ],
          [
            'Rechenwelt',
            'Deutsch; DIN VDE / IEC, dokumentiertes Modell mit Quellenangaben',
            'Deutsch/Englisch; an NEC- und ABYC-Werte angelehnte Bemessung',
            'Neutral — keine Rechenregeln',
          ],
        ],
        note: 'Was in dieser Tabelle für VoltPlan und draw.io steht, sind die Angaben auf den Seiten der Anbieter (siehe Quellen). „Nicht ausgewiesen" heißt: Der Anbieter nennt die Funktion nicht — nicht, dass sie versteckt doch existiert.',
      },
    },
    {
      id: '12v-planer',
      heading: '12V-Planer: die Prüfung steht im Mittelpunkt',
      body: [
        'Der 12V-Planer ist für genau einen Fall gebaut: die komplette Elektrik eines Campers oder Selbstausbaus. Bauteile wie LiFePO4-Batterie, Ladebooster, MPPT-Regler und Sicherungskasten werden gesetzt und verbunden — wahlweise verdrahtet die Funktion „Automatisch verbinden" Batterie, Sammelschienen und Sicherungskasten selbst. Jede Leitung bekommt ihren Querschnitt aus zwei Grenzen (Strombelastbarkeit nach DIN VDE 0298-4 mit dokumentiertem Derating und Spannungsabfall), und der Plan wird geprüft statt nur gezeichnet: Spannungsabfall in den Stufen 1/3/4 %, Sicherung nach der Kette I_B ≤ I_n ≤ I_z, Abstand des Schutzorgans zur Quelle, Abschaltvermögen gegen den geschätzten Kurzschlussstrom, Vollständigkeit der Energiebilanz.',
        'Dazu kommen die zwei Ausgaben, die beim Ausbau Geld kosten, wenn sie fehlen: die Energiebilanz (Tagesverbrauch gegen Solar-, Fahr- und Landstrom-Ertrag, mit Entladetiefe je Chemie) und die Stückliste mit Leitungslängen, Querschnitten und Sicherungen. Der 230-V-Zweig wird als eigener Abschnitt mit RCBO- und Schutzleiter-Modell geführt. Der Plan bleibt lokal im Browser; es gibt kein Konto und keinen Server-Upload, geteilt wird als PNG oder als Link mit dem Plan im Adress-Hash.',
        'Die Grenzen, ehrlich: nur 12 V und 24 V, keine Boot- oder Offgrid-Vorlagen, generische Bauteile statt Hersteller-Katalog — wer sein konkretes Victron-Gerät mit Datenblattwerten im Plan will, ist bei VoltPlan besser aufgehoben. Wie ein fertiger Plan hier aussieht, zeigt der [Beispiel-Schaltplan mit Landstrom, LiFePO4 und Solar](/camper-elektrik/schaltplan-beispiel/).',
      ],
      links: [{ href: '/planer/', label: '12V-Planer öffnen und Vorlage laden' }],
    },
    {
      id: 'voltplan',
      heading: 'VoltPlan: die breitere DC-Werkstatt',
      body: [
        'VoltPlan deckt den größeren Raum ab: 12 V, 24 V und 48 V, Camper und Wohnmobil ebenso wie Boot und Marine, Offgrid-Solar und Tiny House. Der Katalog enthält echte Herstellerkomponenten — nach Anbieterangaben unter anderem Victron-MPPTs, Renogy-Lader, Blue-Sea-Sicherungsblöcke und LiFePO4-Pakete — mit ihren Spannungen, Strömen und Anschlüssen; eigene Komponenten lassen sich anlegen. Verbundene Leitungen bekommen automatisch den Querschnitt (3-%-Spannungsfall-Regel, AWG oder mm²) und einen Sicherungsvorschlag (125 % der Dauerlast, begrenzt durch die Kabelbelastbarkeit, inklusive Bauform wie Flach, MIDI, ANL oder Class T). Überlastete Leitungen werden markiert, Verschaltungsfehler — etwa ein Solarmodul ohne Laderegler — gemeldet, und die Reihen- und Parallelschaltung von Modulen wird aufgelöst.',
        'Stark ist auch das Drumherum: Export als PNG, SVG und Druck, ein Lese-Link, den Empfänger ohne Konto öffnen, Vorlagen für Camper, Boot und Offgrid sowie separate Rechner (Kabel, Batteriebank, Wechselrichter). Die Bemessung lehnt sich an NEC- und ABYC-Werte an — für Boote und den internationalen Kontext ein echtes Argument. Die Web-App ist kostenlos und ohne Anmeldung nutzbar; ein Konto speichert Projekte, und eine Handy-App gibt es als Einmalkauf.',
        'Für den deutschsprachigen Camper-Ausbau mit DIN-VDE-Fragen ist der Blick andersherum: Die Normwelt des 12V-Planers (DIN VDE 0298-4, RCBO-Modell, dokumentierte Annahmen auf Deutsch) passt näher an das, was Werkstätten und Prüfer hierzulande erwarten. Das ist kein Qualitätsurteil, sondern eine Frage des Regelwerks, nach dem der eigene Ausbau abgenommen wird.',
      ],
    },
    {
      id: 'drawio',
      heading: 'draw.io: das ehrliche Zeichenwerkzeug',
      body: [
        'draw.io (diagrams.net) ist das universelle Diagramm-Werkzeug: kostenlos, Open Source unter Apache 2.0, ohne Konto, mit Echtzeit-Zusammenarbeit und Export nach PNG, SVG und PDF; Dateien lassen sich lokal oder in Cloud-Laufwerken speichern. Für Ablaufpläne, Netzwerkskizzen, Grundrisse und jede Dokumentation, die kein reiner Schaltplan ist, ist es die richtige Wahl — und selbst Dateien aus dem Jahr 2005 lädt die aktuelle Version noch.',
        'Nur eines ist draw.io nicht: ein Elektrik-Programm. Es kennt weder Strom noch Länge einer Leitung; Querschnitt, Sicherung und Spannungsabfall müssen in einem Rechner daneben ermittelt und von Hand in die Linie geschrieben werden. Genau an dieser Doppelpflege scheitern Schaltpläne in der Praxis: Der Verbraucher wird getauscht, die Zahl an der Leitung bleibt die alte. Wer einen formalen Normschaltplan mit Symbolbibliothek braucht, greift ohnehin zu KiCad oder QElectroTech; wer die Camper-Elektrik rechnen lassen will, zu einem der beiden Spezialisten oben.',
      ],
    },
    {
      id: 'entscheidung',
      heading: 'Entscheidung in vier Fragen',
      list: {
        ordered: true,
        items: [
          'Planst du ein Boot, eine 48-V-Anlage oder willst du konkrete Herstellergeräte im Plan? → VoltPlan.',
          'Planst du einen Camper-Selbstausbau und brauchst Energiebilanz, Prüfbericht und Stückliste für die Bestellung? → 12V-Planer.',
          'Brauchst du den Plan als Dokumentation im Team, mit Kommentaren, Versionen und mehr als nur Elektrik? → draw.io daneben, nicht stattdessen.',
          'Landstrom und 230 V sind dir wichtig? → Beide Spezialisten bilden die 230-V-Seite ab; der 12V-Planer führt sie als eigenen Zweig mit Schutzmodell, VoltPlan unterstützt Landstrom und Wechselrichter-Ausgang. Abnehmen muss den 230-V-Teil in jedem Fall eine Elektrofachkraft.',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Beide Spezialwerkzeuge sind kostenlos — die ehrlichste Entscheidungshilfe ist der eigene Ausbau: dasselbe Setup in beiden anlegen (je eine Vorlage laden, Werte anpassen) und vergleichen, welcher Prüfbericht die Fragen beantwortet, die du tatsächlich hast. Hier geht es zum [12V-Planer mit fertiger Kastenwagen-Vorlage](/planer/?template=kastenwagen).',
      },
    },
    {
      id: 'methodik',
      heading: 'Wie dieser Vergleich entstanden ist',
      body: [
        'Die Angaben zu VoltPlan stammen von den deutschsprachigen Seiten des Anbieters (Startseite und „Schaltplan online erstellen", abgerufen am 24.11.2026), die Angaben zu draw.io von drawio.com (abgerufen am 24.11.2026). Die Angaben zum 12V-Planer stammen aus dem eigenen Rechenmodell und Produktcode; Methodik, Quellen und Grenzen des Modells stehen offen auf der Seite „Über 12V-Planer". Es wurden keine Testgeräte gekauft, keine Provisionen vereinbart und keine Funktion behauptet, die ein Anbieter nicht selbst ausweist.',
        'Programme ändern sich. Wer eine Zeile dieser Tabelle anders erlebt, findet auf der Kontaktseite den kurzen Weg zur Korrektur — ein Vergleich, der nicht korrigiert wird, veraltet zur Werbung.',
      ],
    },
  ],
  faq: [
    {
      question: 'Welches Programm ist das beste für einen Camper-Schaltplan?',
      answer:
        'Es gibt nicht das eine beste, sondern das passende: Für den Camper-Selbstausbau mit Energiebilanz, Prüfbericht und Stückliste nach DIN-VDE-Modell der 12V-Planer; für Boot, 48 V und echte Hersteller-Bauteile VoltPlan; für allgemeine Diagramme und Team-Dokumentation draw.io. Alle drei sind kostenlos, die Entscheidung kostet also nur die Zeit, das eigene Setup in den zwei Spezialisten anzulegen.',
    },
    {
      question: 'Was ist der Unterschied zwischen 12V-Planer und VoltPlan?',
      answer:
        'Beide zeichnen und berechnen Camper-Elektrik kostenlos im Browser. VoltPlan ist breiter: 12–48 V, Camper, Boot und Offgrid, Katalog mit echten Herstellergeräten, SVG-Export, Bemessung an NEC/ABYC angelehnt. Der 12V-Planer ist auf den Camper zugeschnitten: Energiebilanz und Stückliste gehören dazu, geprüft wird nach DIN VDE 0298-4 mit Spannungsabfall-Stufen (1/3/4 %), der 230-V-Zweig hat ein eigenes Schutzmodell, und der Plan bleibt ohne Konto lokal im Browser.',
    },
    {
      question: 'Reicht draw.io für den Camper-Schaltplan?',
      answer:
        'Zum Zeichnen ja, zum Planen nein. draw.io kennt keine Ströme und Leitungslängen: Querschnitt, Sicherung und Spannungsabfall musst du daneben rechnen und von Hand eintragen — und bei jeder Änderung erneut. Für die Dokumentation drumherum (Abläufe, Grundrisse, Team-Kommentare) ist draw.io dagegen das bessere Werkzeug und obendrein Open Source.',
    },
    {
      question: 'Kosten 12V-Planer, VoltPlan und draw.io etwas?',
      answer:
        'Nein, alle drei sind in der hier verglichenen Form kostenlos: Der 12V-Planer läuft ohne Konto im Browser, die VoltPlan-Web-App ist nach Anbieterangabe dauerhaft kostenlos (die Handy-App ist ein optionaler Einmalkauf), und draw.io ist kostenlos und Open Source (Apache 2.0).',
    },
    {
      question: 'Ersetzt eines der Programme die Elektrofachkraft?',
      answer:
        'Nein, keines. Die Programme planen und prüfen das Modell; Einbau, mechanische Verlegung und die Abnahme der 230-V-Anlage (Einspeisung, Schutzmaßnahmen, Erstprüfung) gehören in die Hand einer Elektrofachkraft. Ein geprüfter Plan ist dafür die Gesprächsgrundlage, nicht der Ersatz.',
    },
  ],
  related: [
    { href: '/camper-elektrik/schaltplan/', label: 'Schaltplan zeichnen: Aufbau und Prüfung' },
    {
      href: '/camper-elektrik/schaltplan-beispiel/',
      label: 'Beispiel-Schaltplan mit Landstrom, LiFePO4 und Solar',
      description: 'Ein fertiger Plan zum Ansehen — so sieht das Ergebnis im 12V-Planer aus.',
    },
    { href: '/camper-elektrik/230v/', label: '230-V-Anlage im Camper: Landstrom und FI-Schutz' },
    { href: '/planer/', label: '12V-Planer öffnen' },
    { href: '/ueber-12v-planer/', label: 'Über 12V-Planer: Methodik und Grenzen' },
  ],
  sources: [
    {
      label: 'VoltPlan — Anbieterangaben',
      detail:
        'voltplan.app/de und voltplan.app/de/schaltplan-online-erstellen (abgerufen 24.11.2026): Spannungen 12/24/48 V, Hersteller-Katalog, 3-%-Regel, 125-%-Sicherungsvorschlag, Export PNG/SVG, Lese-Link, „für immer kostenlos", NEC/ABYC-Anlehnung.',
    },
    {
      label: 'draw.io — Anbieterangaben',
      detail:
        'drawio.com (abgerufen 24.11.2026): universelles Diagramm-Werkzeug, Apache 2.0 Open Source, kein Konto nötig, Export PNG/SVG/PDF, Echtzeit-Zusammenarbeit.',
    },
    {
      label: '12V-Planer — eigenes Modell',
      detail:
        'Rechenmodell `lib/electrical.ts` (DIN VDE 0298-4 B2 mit 70 % Derating, Spannungsfall-Stufen 1/3/4 %, I_B ≤ I_n ≤ I_z, Schutzorgan 0,2 m nach ISO 13297:2020 § 8.1) und Produktcode `components/planner/`.',
    },
  ],
  assumptions: [
    'Der Vergleich beschreibt die Web-Anwendungen, nicht die optionale Handy-App von VoltPlan.',
    'Anbieterangaben sind der Stand vom 24.11.2026; Funktionsumfänge können sich ändern.',
  ],
  limits: [
    'Es wurden keine bezahlten Tests durchgeführt und keine Mitbewerber-Funktionen nachgemessen — verglichen werden die ausgewiesenen Funktionen und das eigene, offenliegende Modell.',
    'Kein Programm ersetzt die Elektrofachkraft, insbesondere nicht für den 230-V-Teil.',
  ],
};
