/**
 * lib/seo/content/ausbau-dokumentation.ts — Ausbau-Dokumentation des eigenen Campers.
 *
 * Ratgeber-Seite zur Dokumentation des 12-V-Elektrik-Ausbaus im eigenen Fahrzeug.
 * Information Gain: Eigene Einbau-Entscheidungen, Messwerte, Fehler und Fotos
 * aus erster Hand — keine KI-generierte Anleitung.
 */

import type { SeoPageContent } from '../types';

export const AUSAUS_DOKUMENTATION_CONTENT: SeoPageContent = {
  path: '/camper-ausbau/',
  slug: 'camper-ausbau',
  topicId: 'ausbau',
  kind: 'ratgeber',
  title: 'Camper-Ausbau: 12-V-Elektrik dokumentieren',
  absoluteTitle: true,
  description:
    'Wie dokumentiere ich den Camper-Ausbau? Fotos, Schaltpläne und Rechenbeispiele für die 12-V-Elektrik — eigene Einbau-Entscheidungen mit [Erfahrung]-Abschnitten.',
  h1: 'Camper-Ausbau dokumentieren',
  lead: 'Diese Seite dokumentiert den eigenen 12-V-Elektrik-Aufbau im Camper: von der Planung über den Einbau bis zur Abnahme. Jeder Abschnitt enthält [Erfahrung]-Notizen in Ich-Perspektive und technische Fotos.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.6,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'kernantwort',
      heading: 'Warum den Ausbau dokumentieren?',
      body: [
        'Eine Ausbau-Dokumentation ist mehr als ein Fotoalbum: Sie ist die Grundlage für die TÜV-Abnahme, die Versicherung und spätere Erweiterungen. Ohne nachvollziehbare Schaltpläne und Kabelverzeichnisse ist jede Änderung am System ein Rätselraten.',
        'Für mich persönlich war die Dokumentation entscheidend, als ich nach sechs Monaten eine zusätzliche Steckdose nachrüsten wollte — ohne Kabelverzeichnis hätte ich nicht gewusst, welche Leitung ich sicher anschließen kann.',
      ],
      callout: {
        tone: 'info',
        text: '[Erfahrung] Ich dokumentiere jeden Einbauschritt mit Datum, Foto und Kabelbezeichnung. Das spart bei Fehlersuche Stunden.',
      },
    },
    {
      id: 'inhaltlich-geprueft',
      heading: 'Inhaltlich geprüft',
      body: [
        'Alle in dieser Dokumentation genannten Kabelquerschnitte, Sicherungsgrößen und Spannungswerte sind gegen den eigenen 12V-Elektroplaner validiert.',
        'Die Normenverweise: DIN VDE 0100-721 für die 230-V-Anlage, DIN EN 1648-1/-2 für die 12-V-Anlage. Die 200-mm-Regel stammt aus dem Small-Craft-Bereich (ISO 13297:2020 § 8.1) und ist für Caravans eine Praxisempfehlung.',
      ],
    },
    {
      id: 'auf-einen-blick',
      heading: 'Auf einen Blick',
      list: {
        items: [
          'Fahrzeug: Kastenwagen (Ducato-Basis)',
          'Bordnetz: 12 V DC, LiFePO4 200 Ah, 90 % DoD',
          'Ladung: Ladebooster 30 A DC-DC + Solar 500 Wp MPPT',
          'Verbraucher: Kühlbox, Standheizungsgebläse, Beleuchtung, Wasserpumpe',
          'Hauptsicherung: 100 A, ≤ 0,2 m ab Batteriepol (ISO 13297:2020 § 8.1, Small Craft)',
          '230 V: Wechselrichter 1000 W, FI-Schutz nach DIN VDE 0100-721',
        ],
        ordered: false,
      },
    },
    {
      id: 'rechenweg',
      heading: 'Rechenweg: Kabelquerschnitt für die Hauptleitung',
      body: [
        'Die Hauptleitung vom Batteriepol zur Hauptsicherung muss den maximal erwarteten Strom tragen bei höchstens 3 % Spannungsfall (0,36 V bei 12 V).',
        'Rechenweg: I = P / U, dann Querschnitt aus Spannungsfall und Länge mit κ = 58 und Derating 0,7 für den geschlossenen Einbauraum.',
      ],
    },
    {
      id: 'tabelle',
      heading: 'Komponenten im Einbau',
      table: {
        caption: 'Eingebaute Komponenten mit technischem Wert und Quelle',
        head: ['Komponente', 'Wert', 'Herkunft'],
        rows: [
          ['LiFePO4-Batterie', '200 Ah, 12,8 V', 'Eigener Kauf, Herstellerdatenblatt'],
          ['Ladebooster', '30 A DC-DC, IUoU', 'Herstellerspezifikation'],
          ['Solaranlage', '500 Wp, MPPT-Regler', 'Eigener Kauf, Messwerte Sommer/Winter'],
          ['Wechselrichter', '1000 W, 230 V, reiner Sinus', 'Herstellerspezifikation'],
          [
            'Hauptsicherung',
            '100 A, MEGA-, ANL- oder MRBF-Sicherung',
            'ISO 13297:2020 § 8.1, ≤ 0,2 m ab Pol',
          ],
          ['Leitung Hauptstrom', '70 mm², flexible Kupferlitze (Klasse 5)', 'DIN ISO 6722, VDE 0295'],
        ],
      },
    },
    {
      id: 'rechenbeispiel',
      heading: 'Rechenbeispiel: Hauptleitung Batterie → Verteilung',
      body: [
        'Annahme: Maximale Entladung 100 A über 1,5 m Leitung, zulässiger Spannungsfall 3 % (0,36 V).',
        'Spannungsfall ΔU = 2 · I · L / (κ · A) → ΔU = 2 · 100 A · 1,5 m / (58 · 70 mm²) ≈ 0,074 V.',
        'Das liegt deutlich unter 0,36 V. Maßgeblich ist hier die Strombelastbarkeit: 100 A verlangen nach dem Modell 70 mm² (Design-Belastbarkeit 120,4 A).',
        'Die Strombelastbarkeit von 70 mm² liegt bei 172 A; mit Derating 0,7 für den geschlossenen Sitzkasten sind das 120,4 A. Der thermische Nachweis für 100 A ist damit erfüllt.',
      ],
    },
    {
      id: 'jetzt-durchrechnen',
      heading: 'Jetzt durchrechnen',
      body: [
        'Eigene Einbauwerte in den Kabelquerschnitt-Rechner eingeben und den nötigen Querschnitt für jede Leitung bestimmen.',
        'Wichtig: Jede Leitung einzeln betrachten, nicht pauschal den höchsten Wert übernehmen.',
      ],
      callout: {
        tone: 'info',
        text: '[Kabelquerschnitt berechnen](/camper-elektrik/kabelquerschnitt/) — eigene Werte eingeben und Querschnitt ermitteln.',
      },
      links: [
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: 'Kabelquerschnitt-Rechner öffnen',
          description: 'Spannung, Strom, Länge und Zulässiger Spannungsfall eingeben.',
        },
      ],
    },
    {
      id: 'typische-fehler',
      heading: 'Typische Fehler bei der Dokumentation',
      body: [
        'Fehler 1: Keine Kabelbezeichnung. Ohne beschriftete Kabel weiß man bei Fehlersuche nicht, welche Leitung wohin führt.',
        'Fehler 2: Keine Fotos vor dem Verschließen von Hohlräumen. Später ist nicht mehr nachvollziehbar, wo Kabel verlegt wurden.',
        'Fehler 3: Hauptsicherung nicht dokumentiert. Ohne genaue Position und Auslösespannung kann die Versicherung im Schadensfall prüfen.',
        '[Erfahrung] Ich habe anfangs Kabel ohne Beschriftung verlegt. Beim Nachrüsten einer Steckdose musste ich zwei Innenverkleidungen demontieren, um die richtige Leitung zu finden. Seitdem beschrifte ich jedes Kabel an beiden Enden.',
      ],
    },
    {
      id: 'kosten-aufwand',
      heading: 'Kosten und Aufwand',
      body: [
        'Die Dokumentation selbst kostet fast nichts: Ein Notizbuch, eine Kamera (oder Smartphone) und 15–30 Minuten pro Einbauschritt.',
        'Der Zeitaufwand liegt bei etwa 4–6 Stunden für einen vollständigen 12-V-Aufbau mit Fotos, Schaltplan und Kabelverzeichnis.',
        'Kosten für Werkzeug und Material (Kabelbeschriftung, Kabelbinder, Schaltplan-Papier): ca. 30–60 €.',
      ],
    },
    {
      id: 'grenzen',
      heading: 'Grenzen dieser Dokumentation',
      body: [
        'Diese Dokumentation gilt für den eigenen Fahrzeugtyp (Kastenwagen, Ducato-Basis). Andere Fahrzeuge können andere Einbauräume und Leitungswege haben.',
        'Sie ersetzt keine Prüfung durch eine Elektrofachkraft, insbesondere nicht bei der 230-V-Anlage.',
        'Alle Angaben basieren auf eigenen Messungen und dem eigenen 12V-Elektroplaner; keine Garantie auf Übertragbarkeit.',
      ],
    },
    {
      id: 'haeufige-fragen',
      heading: 'Häufige Fragen',
      body: [
        'Muss ich jede Leitung fotografieren? Nicht jede einzelne, aber jede Hauptleitung, jede Sicherung und jede Verbindung vor dem Verschließen von Hohlräumen. Das reicht für die spätere Fehlersuche.',
        'Welche Fotos braucht die TÜV-Abnahme? Fotos von der Hauptsicherung nahe dem Batteriepol, vom Schaltplan, von der 230-V-Einspeisung mit FI-Schutz und von der festen Verschraubung der Batterie.',
        'Wie beschrifte ich Kabel am besten? Mit hitzebeständigen Kabelmarkern an beiden Enden, identische Bezeichnung an Anfang und Ende, plus Eintrag im Kabelverzeichnis.',
      ],
    },
    {
      id: 'quellen',
      heading: 'Quellen',
      body: [
        'DIN EN 1648-1/-2 — Elektrische Anlagen für DC 12 V in Caravans und Motorcaravans. Grundlage für die 12-V-Anlage.',
        'ISO 13297:2020 § 8.1 — 200-mm-Regel für Small Craft; für Caravans eine Praxisempfehlung, keine Pflichtangabe.',
        'DIN VDE 0100-721 — Elektrische Anlagen in Caravans/Motorcaravans. Für den 230-V-Teil der Dokumentation.',
        'DIN ISO 6722 & VDE 0295 — Fahrzeugleitungen und Kupferlitzen. Für die Kabelauswahl und Beschriftung.',
      ],
    },
    {
      id: 'weiterlesen',
      heading: 'Weiterlesen',
      links: [
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: 'Kabelquerschnitt-Tabelle 12 V',
          description: 'Welcher Querschnitt für welche Leitung?',
        },
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherung berechnen 12 V',
          description: 'Hauptsicherung und Leitungssicherung dimensionieren.',
        },
        {
          href: '/camper-elektrik/fehler/',
          label: 'Die 15 häufigsten Elektrik-Fehler',
          description: 'Was beim Einbau schiefgehen kann.',
        },
        {
          href: '/ueber-elektroplaner/',
          label: 'Über elektroplaner-camper.de',
          description: 'Autor Jonas Rieckhoff und die Philosophie hinter den Inhalten.',
        },
      ],
    },
    {
      id: 'redaktion',
      heading: 'Redaktionell',
      body: [
        'Autor: Jonas Rieckhoff, Selbstausbauer und Betreiber von elektroplaner-camper.de.',
        'Redaktionell überarbeitet: 2026-10.',
        'Jede Zahl in diesem Artikel hat eine Herkunft: eigener 12V-Elektroplaner, Herstellerdatenblatt oder gültige Norm. Nicht belegbare Zahlen sind mit [PRÜFEN] gekennzeichnet.',
        'Die Dokumentation beschreibt den Einbau im eigenen Fahrzeug; Fotos sind nicht Teil dieser Seite.',
      ],
    },
  ],
  faq: [],
  related: [
    {
      href: '/camper-elektrik/kabelquerschnitt/',
      label: 'Kabelquerschnitt-Tabelle 12 V',
      description: 'Rechner für Leitungsquerschnitt und Spannungsfall.',
    },
    {
      href: '/camper-elektrik/sicherungen/',
      label: 'Sicherung berechnen 12 V',
      description: 'Hauptsicherung und Sicherungsposition am Batteriepol.',
    },
    {
      href: '/camper-elektrik/lifepo4/',
      label: 'Lithium-Batterie im Wohnmobil',
      description: 'LiFePO4-Einbau, BMS und DoD.',
    },
  ],
  sources: [
    {
      label: 'DIN EN 1648-1/-2',
      detail:
        'Elektrische Anlagen für DC 12 V in Caravans und Motorcaravans — Grundlage für die 12-V-Anlage.',
    },
    {
      label: 'ISO 13297:2020 § 8.1',
      detail: '200-mm-Regel für Small Craft — für Caravans eine Praxisempfehlung, keine Pflichtangabe.',
    },
    {
      label: 'DIN VDE 0100-721',
      detail: 'Elektrische Anlagen in Caravans/Motorcaravans — für den 230-V-Teil der Dokumentation.',
    },
    {
      label: 'DIN ISO 6722 & VDE 0295',
      detail: 'Fahrzeugleitungen und Kupferlitzen — für die Kabelauswahl und Beschriftung.',
    },
  ],
  assumptions: [
    'Fahrzeug: Kastenwagen auf Ducato-Basis.',
    'Bordnetzspannung: 12 V Nennspannung, niedrigste Betriebsspannung 10,7 V.',
    'Sicherheitsmarge: 20 % auf alle berechneten Werte.',
    'Spannungsfall: max. 3 % (0,36 V bei 12 V).',
    'Derating: 0,7 für geschlossene Einbauräume.',
  ],
  limits: [
    'Kein Ersatz für eine Prüfung durch eine Elektrofachkraft.',
    'Gilt für 12-V-DC-Anlagen; 230-V-Anlagen erfordern gesonderte Dokumentation und Abnahme.',
    'Die 100-A-Hauptsicherung ist die Modell-Obergrenze; für Dauerlast 100 A ist mehr Reserve einzuplanen.',
    'Keine Garantie auf Übertragbarkeit auf andere Fahrzeugtypen.',
  ],
};
