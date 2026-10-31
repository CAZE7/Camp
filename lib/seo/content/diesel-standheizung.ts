/**
 * lib/seo/content/diesel-standheizung.ts — Cluster-Seite `/heizung-daemmung/diesel-standheizung/`.
 *
 * Spoke des Pillars `/heizung-daemmung/`. Alle Zahlen sind die im Projekt
 * bereits verwendeten Modellwerte (Gebläse 2,9 A / 35 W / 8 h = 280 Wh,
 * Betrieb 10–40 W, Spannungsfall-Grenze 4 % = 0,48 V bei 12 V). Keine
 * erfundenen Normwerte: Einbau und Abgas bleiben ausdrücklich außerhalb.
 */

import type { SeoPageContent } from '../types';

export const DIESEL_STANDHEIZUNG_CONTENT: SeoPageContent = {
  path: '/heizung-daemmung/diesel-standheizung/',
  slug: 'diesel-standheizung',
  topicId: 'diesel-standheizung',
  kind: 'cluster',
  title: 'Diesel-Standheizung im Camper: 2 kW oder 4 kW?',
  absoluteTitle: true,
  description:
    'Diesel-Standheizung dimensionieren: Heizleistung, Stromverbrauch des Gebläses, Absicherung, Kabelquerschnitt und typische Fehler — mit Rechenweg.',
  h1: 'Diesel-Standheizung: Leistung, Strom und Absicherung',
  lead: 'Eine Diesel-Standheizung heizt mit Kraftstoff aus dem Tank — Strom braucht sie nur für Gebläse, Pumpe und Zündglühen. Genau dieser kleine Verbrauch entscheidet über Kabelquerschnitt, Sicherung und die Frage, wie lange die Batterie im Winter durchhält.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.6,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'kernantwort',
      heading: 'Wie viel Strom braucht eine Diesel-Standheizung?',
      body: [
        'Im Betrieb liegen Diesel-Standheizungen je nach Leistung typisch bei 10–29 W (2 kW) oder 10–57 W (4 kW) — das Gebläse ist der Hauptverbraucher, dazu kommen Kraftstoffpumpe und Zündglühen. Beim Start zieht die Heizung für 2–3 Minuten etwa 6–12 A.',
        'Für die Energiebilanz zählt die Laufzeit, nicht die Heizleistung. Im Beispielhaushalt der Stromverbrauch-Tabelle steht das Gebläse mit 2,9 A über 8 Stunden: das sind rund 35 W und 280 Wh je Tag — nach der Kühlbox der zweitgrößte Verbraucher und deutlich mehr als Licht oder Wasserpumpe.',
        'Der Denkfehler, der daraus entsteht: Die Heizung wird als reiner Stromverbraucher eingeplant, obwohl nur das Gebläse von der Batterie kommt. Die Wärme selbst kommt aus dem Diesel. Wer das verwechselt, dimensioniert die Batterie viel zu groß — oder die Leitung für das Gebläse viel zu klein.',
      ],
      callout: {
        tone: 'info',
        text: '[Heizlast-Rechner öffnen](/tools/heizung/) — Fahrzeugmaße, Dämmung und Wunschtemperatur eingeben und sehen, welche Heizleistung das Fahrzeug wirklich braucht.',
      },
    },
    {
      id: 'leistung',
      heading: '2 kW oder 4 kW: die Auslegung',
      body: [
        'Die passende Leistung kommt aus der Heizlast, nicht aus dem Zubehörkatalog. Die Heizlast folgt aus Oberfläche, U-Wert der Dämmung und Temperaturdifferenz — bei 2–3 kW hat eine 4-kW-Heizung Reserve; erst über 4 kW wird sie knapp.',
        'Wer zu klein heizt, erreicht die Wunschtemperatur möglicherweise nicht und lässt die Heizung dauerhaft auf hoher Stufe laufen — das kostet Komfort und Gebläselaufzeit. Verrußung entsteht eher durch Kurzbetrieb und Teillast. Wer zu groß heizt, läuft häufig im Taktbetrieb mit kurzen Abrissen.',
        'Die Reihenfolge ist deshalb: erst Dämmung und Heizlast, dann die Heizung. Der [Heizlast-Rechner](/tools/heizung/) liefert die Zahl, die 2-kW- oder 4-kW-Auslegung ist die Antwort darauf.',
      ],
      table: {
        caption: 'Herstellerangaben für gängige Diesel-Standheizungen (Beispiele)',
        head: ['Gerät', 'Heizleistung', 'Kraftstoffverbrauch', 'Startstrom'],
        rows: [
          ['Autoterm Air 2D', '2,0 kW', '0,10–0,24 l/h', '6–12 A (2–3 min)'],
          ['Autoterm Air 4D', '4,0 kW', '0,12–0,51 l/h', '6–12 A (2–3 min)'],
        ],
        note: 'Herstellerangaben; die Werte sind geräte- und einbauabhängig. Autoterm nennt eine Betriebshöhe bis 4.200 m, Webasto-Geräte ohne Höhenkit oft bis 1.500 m. Höhenlimit, Wartungsintervall und Fehlercodes stehen im Datenblatt des konkreten Geräts.',
      },
      links: [
        {
          href: '/heizung-daemmung/',
          label: 'Heizung im Camper planen — Überblick',
          description: 'Dämmung, Heizsysteme im Vergleich und die Heizlast-Rechnung.',
        },
        {
          href: '/camper-elektrik/stromverbrauch/',
          label: 'Stromverbrauch typischer Verbraucher',
          description: 'Tabelle mit Gebläse, Kühlbox und Licht — inklusive Wh je Tag.',
        },
      ],
    },
    {
      id: 'stromversorgung',
      heading: 'Stromversorgung, Kabelquerschnitt und Sicherung',
      body: [
        'Das Gebläse hängt an der Bordbatterie über eine eigene, abgesicherte Leitung. Der Querschnitt folgt aus Strom und Kabellänge — nicht aus dem nächstbesten Restkabel. Bei 2,9 A über mehrere Meter bleibt der Querschnitt klein, aber die Leitung führt oft durch den halben Fahrzeugboden, und dort summiert sich der Spannungsfall.',
        'Der Spannungsfall ist bei dieser Heizung kein Komfortthema: In der Glühphase ist die Heizung empfindlich. Die Heizung schaltet typischerweise bei etwa 10,5 V für mehr als 20 s ab; ein Spannungsfall von 4 % (0,48 V) kann zusammen mit einer entladenen Batterie dazu führen, dass die Klemmenspannung unter diese Schwelle fällt. Die konkrete Schwelle steht im Datenblatt. Eine Heizung, die nachts abstellt, wird oft für einen Defekt gehalten — und ist eine zu lange oder zu dünne Leitung.',
        'Die Sicherung gehört so nah wie möglich an den Pol der Batterie. Zwischen Pol und Sicherung sitzt der einzige Abschnitt, der im Fehlerfall nicht abgeschaltet wird.',
      ],
      links: [
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: 'Kabelquerschnitt-Tabelle 12 V',
          description: 'Strom × Länge → Querschnitt, mit Spannungsfall.',
        },
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherung berechnen 12 V',
          description: 'Sicherungswert und Position am Pol.',
        },
        {
          href: '/camper-elektrik/spannungsabfall/',
          label: 'Spannungsabfall bei 12 V',
          description: 'Warum lange Leitungen die Heizung abschalten lassen.',
        },
        {
          href: '/planer/',
          label: 'Camper-Elektroplaner öffnen',
          description: 'Heizung als Verbraucher setzen und die Leitung gleich mitrechnen.',
        },
      ],
    },
    {
      id: 'abgas',
      heading: 'Abgas, Luft und Zulassung',
      body: [
        'Abgas und Verbrennungsluft werden nach außen geführt, mit Abstand zu Fenstern, Türen und Ansaugöffnungen. Unterflurführung ist zulässig, wenn die Mündung frei ausbläst, nicht in Fahrtrichtung zeigt, nicht im Sprühbereich der Räder liegt und die Herstellervorgaben eingehalten werden. Die Verlegung der Abgasleitung ist der Teil, an dem eine Diesel-Standheizung gefährlich werden kann; sie gehört zur Abnahme durch eine Fachwerkstatt oder Prüforganisation.',
        'Für die Zulassung zählt die Dokumentation: wo die Heizung sitzt, wie Abgas und Kraftstoffleitung geführt sind, welche Freigaben vorliegen. Die Seite [Wohnmobilzulassung](/wohnmobilzulassung/) erklärt, welche Unterlagen für die Prüforganisation nötig sind.',
        'Der Vergleich der Systeme (Diesel, Gas, Elektro) steht auf der Pillar-Seite. Die Gasheizung braucht eine G 607-Prüfung; die Diesel-Standheizung braucht keine G 607-Prüfung, wohl aber eine fachgerechte Abgasführung und, je nach Nutzung, die Freigabe des Geräts für den Betrieb während der Fahrt.',
      ],
    },
    {
      id: 'winter',
      heading: 'Energiebilanz im Winter',
      body: [
        'Im Winter läuft das Gebläse Stunden, die Kühlbox seltener. Der Tagesbedarf verschiebt sich also zwischen den Verbrauchern, statt nur zu steigen. Wer zwei autarke Wintertage planen will, rechnet 280 Wh Gebläsestrom je Heiznacht in die Energiebilanz ein — dann fehlt der Puffer nicht für Licht und Wasser.',
        '[Erfahrung] Die niedrige Stufe über Nacht statt Dauerbetrieb hat bei mir den Tagesbedarf um rund 140 Wh gesenkt — bei knapp bemessener Batterie genau der Unterschied auf einen zusätzlichen autarken Tag.',
      ],
      links: [
        {
          href: '/camper-elektrik/batterie/',
          label: 'Batterie dimensionieren',
          description: 'Kapazität aus Verbrauch und Autarkietagen.',
        },
        {
          href: '/rechner/batteriekapazitaet/',
          label: 'Batteriekapazität berechnen',
          description: 'Verbraucherliste in Ah und Wh umrechnen.',
        },
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler bei der Diesel-Standheizung',
      list: {
        items: [
          'Heizung nach Bauchgefühl dimensioniert statt nach Heizlast — die 2-kW-Auslegung kann im gut gedämmten Fahrzeug reichen; bei schlechter Dämmung oder großen Fahrzeugen ist sie zu knapp.',
          'Heizung als Stromverbraucher für die Heizleistung eingeplant: Die Wärme kommt aus Diesel, nur Gebläse und Pumpe kommen von der Batterie.',
          'Lange, dünne Gebläseleitung ohne Spannungsfall gerechnet — die Heizung reißt in der Glühphase ab.',
          'Sicherung weit weg vom Batteriepol statt direkt am Pol.',
          'Abgasleitung ohne Abstand zu Fenstern, Türen oder Ansaugöffnungen geführt.',
          'Heizungsstrom in der Winter-Energiebilanz vergessen.',
        ],
      },
    },
    {
      id: 'grenzen',
      heading: 'Was diese Seite nicht leistet',
      list: {
        items: [
          'Keine Einbauanleitung — Abgas, Kraftstoffleitung und Elektroanschluss sind sicherheitskritisch und gehören in Fachwerkstatt oder Prüforganisation.',
          'Keine Rechtsauskunft zur Zulassung oder zur Tragfähigkeit von Halterungen.',
          'Keine Herstellerfreigabe: Bauteile, Halter und Führungswinkel sind nach den Unterlagen des Heizungsherstellers zu montieren.',
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Braucht eine Diesel-Standheizung Strom?',
      answer:
        'Ja — für Gebläse, Kraftstoffpumpe und Zündglühen, je nach Leistung typisch 10–29 W (2 kW) oder 10–57 W (4 kW); beim Start kurz 6–12 A. Die Wärme selbst entsteht aus Diesel, nicht aus der Batterie.',
    },
    {
      question: 'Reicht eine 2-kW-Diesel-Standheizung im Camper?',
      answer:
        'Das entscheidet die Heizlast aus Fahrzeuggröße, Dämmung und Wunschtemperatur. In einem gut gedämmten Kastenwagen kann sie reichen; bei 2–3 kW hat eine 4-kW-Heizung Reserve, erst über 4 kW wird sie knapp.',
    },
    {
      question: 'Wie hoch ist der Stromverbrauch einer Standheizung pro Nacht?',
      answer:
        'Im Beispiel des Projekt-Rechners zieht das Gebläse 2,9 A über 8 Stunden — rund 35 W und damit etwa 280 Wh je Heiznacht. Das gehört in die Energiebilanz, sonst fehlt die Kapazität für Licht und Wasserpumpe.',
    },
    {
      question: 'Warum schaltet meine Diesel-Standheizung nach dem Start wieder ab?',
      answer:
        'Häufige Ursache ist Unterspannung in der Glühphase. Die Heizung schaltet typischerweise bei etwa 10,5 V für mehr als 20 s ab; ein Spannungsfall von 4 % (0,48 V) kann zusammen mit einer entladenen Batterie unter diese Schwelle führen. Die konkrete Schwelle steht im Datenblatt; die Leitung ist dann oft zu lang oder zu dünn für den Strom.',
    },
  ],
  related: [
    { href: '/heizung-daemmung/', label: 'Heizung im Camper planen — Überblick' },
    { href: '/tools/heizung/', label: 'Heizlast-Rechner öffnen' },
    { href: '/camper-elektrik/stromverbrauch/', label: 'Stromverbrauch typischer Verbraucher' },
    { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
    { href: '/wohnmobilzulassung/', label: 'Wohnmobilzulassung: Unterlagen und Ablauf' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modellwerte des 12V-Elektroplaners',
      detail:
        'Gebläse 2,9 A über 8 h (≈ 35 W, 280 Wh) als Beispielwert aus dem Planer; Betriebsspanne 2 kW 10–29 W / 4 kW 10–57 W; Unterspannungsabschaltung typischerweise 10,5 V (Datenblatt). Keine Messwerte an einem konkreten Gerät.',
    },
    {
      label: 'Heizlast-Ansatz',
      detail:
        'Heizlast aus Oberfläche, U-Wert und Temperaturdifferenz, umgesetzt im Heizlast-Rechner `/tools/heizung/`.',
    },
  ],
  assumptions: [
    'Die Stromwerte gelten für die im Rechner hinterlegte Auslegung eines Gebläses mit 2,9 A bei 12 V. Abweichende Heizungen haben abweichende Datenblätter.',
    'Die Heizlast-Zahlen stammen aus dem vereinfachten U-Wert-Ansatz ohne Wärmebrücken und ohne Lüftungswärmeverlust.',
  ],
  limits: [
    'Keine Aussage zu Einbauorten, Halterungen, Abgasanlagen oder Zulässigkeit im Einzelfall.',
    'Keine Messwerte: Alle Verbrauchsangaben sind Modellwerte des Rechners.',
    'Keine Heizlastberechnung nach DIN EN 12831.',
  ],
};
