/**
 * lib/seo/content/laden.ts — Pillar-Seite `/camper-elektrik/laden/`.
 *
 * Hauptseite zum Laden im Camper: Ladebooster, Landstrom, 230 V und
 * Lichtmaschine. Verlinkt auf die Spokes des Clusters C4 (Laden:
 * Ladebooster, Landstrom, 230 V). Keine eigenen Rechenwerte — die Rechnung
 * passiert im Planer und in den jeweiligen Spokes.
 */

import type { SeoPageContent } from '../types';

export const LADEN_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/laden/',
  slug: 'laden',
  topicId: 'laden',
  kind: 'pillar',
  title: 'Laden im Camper: Ladebooster, Landstrom und 230 V',
  absoluteTitle: true,
  description:
    'Wie lädt die Bordbatterie im Camper? Ladebooster, Lichtmaschine, Landstrom und Wechselrichter — mit Vergleich, Absicherung und Rechenweg.',
  h1: 'Laden im Camper planen',
  lead: 'Die Bordbatterie muss unterwegs, am Stellplatz und zu Hause geladen werden. Diese Seite zeigt, welche Ladequelle wann sinnvoll ist — und wie sie sicher abgesichert wird.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'gedanke',
      heading: 'Drei Ladequellen, drei Aufgaben',
      body: [
        'Im Camper laden an drei Orten: während der Fahrt über die Lichtmaschine, am Stellplatz über Landstrom und optional über Solar. Jede Quelle hat ihre Stärken — und ihre Grenzen.',
        'Die Lichtmaschine lädt nur während der Fahrt und ist ohne Ladebooster keine geregelte Ladequelle für LiFePO4. Landstrom braucht eine Einspeisung und eine Elektrofachkraft. Solar lädt nur, wenn die Sonne scheint. Die Mischung macht die Autarkie.',
      ],
    },
    {
      id: 'ladebooster',
      heading: 'Ladebooster: die Brücke von Lichtmaschine zu Bordbatterie',
      body: [
        'Der Ladebooster (DC-DC-Lader) regelt den Ladestrom von der Lichtmaschine zur Bordbatterie. Ohne ihn begrenzt nur der eigene Widerstand der Lichtmaschine den Strom — die Lima kann überhitzen, die Batterie lädt unreguliert.',
        'Besonders bei Euro-6-Fahrzeugen mit intelligenter Lichtmaschine (varsvarabler Ladespannung, Rekuperation) ist ein Booster nötig: Die Lichtmaschine liefert nicht immer genug Spannung, um die Bordbatterie vollständig zu laden.',
        'Der Booster wird nach Batteriekapazität und Ladeziel dimensioniert: 30 A für kleinere Anlagen, 50 A für größere Batterien und schnelles Laden.',
      ],
      links: [
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: 'Kabelquerschnitt berechnen',
          description: 'Welcher Querschnitt für welche Booster-Leitung?',
        },
      ],
    },
    {
      id: 'lichtmaschine',
      heading: 'Lichtmaschine und intelligente Lichtmaschine',
      body: [
        'Ältere Fahrzeuge haben eine klassische Lichtmaschine mit fester Ladespannung. Neubere Euro-6-Fahrzeuge arbeiten mit intelligenter Lichtmaschine: Die Ladespannung variiert je nach Betriebszustand, und bei Rekuperation kann sie kurzzeitig ansteigen.',
        'Eine einfache Trennrelais-Verbindung reicht bei intelligenter Lichtmaschine nicht mehr. Der Booster regelt den Strom unabhängig von der Lima-Spannung und schützt sowohl Lima als auch Batterie.',
      ],
    },
    {
      id: 'landstrom',
      heading: 'Landstrom: CEE-Einspeisung, FI und LS',
      body: [
        'Am Campingplatz oder zu Hause lädt ein Ladegerät über Landstrom. Die Einspeisung am Fahrzeug braucht eine CEE-Dose, einen FI-Schutzschalter und einen Leitungsschutzschalter.',
        'Die 230-V-Anlage im Fahrzeug ist eine Elektroinstallation und darf nur von einer Elektrofachkraft errichtet, geändert und geprüft werden.',
        'Ladegerät und Booster können parallel arbeiten: Der Booster lädt während der Fahrt, das Landstrom-Ladegerät am Stellplatz.',
      ],
      callout: {
        tone: 'warning',
        text: 'Die 230-V-Anlage (Landstrom, Wechselrichter-Ausgang mit Steckdosen) errichtet, ändert und prüft eine Elektrofachkraft nach DIN VDE 0100-721.',
      },
      links: [
        {
          href: '/camper-elektrik/230v/',
          label: '230-V-Anlage und Landstrom',
          description: 'CEE-Einspeisung, FI-Schutz, Absicherung und Abnahme.',
        },
      ],
    },
    {
      id: 'ladegeraet',
      heading: 'Landstrom-Ladegerät: welche Leistung?',
      body: [
        'Ein Ladegerät wird nach Batteriekapazität und gewünschter Ladezeit gewählt. Als Faustregel im Modell: 10 % der Nennkapazität als Ladestrom (bei 100 Ah also 10 A) für schonendes Laden, mehr für schnelles Nachladen.',
        'Das Ladegerät muss zur Batteriechemie passen: LiFePO4 braucht ein Ladegerät mit LiFePO4-Kennlinie, kein Blei-Ladegerät.',
      ],
    },
    {
      id: 'booster-oder-relais',
      heading: 'Ladebooster oder Trennrelais?',
      body: [
        'Ein Trennrelais schaltet die Bordbatterie bei laufendem Motor zur Lichtmaschine durch. Es ist einfach und günstig, aber unreguliert: Die Lichtmaschine bestimmt den Strom, und bei intelligenter Lichtmaschine lädt die Batterie nicht vollständig.',
        'Der Ladebooster regelt den Strom aktiv und passt sich an Batterie und Lichtmaschine an. Er kostet mehr, lädt aber effizienter und sicherer.',
        'Empfehlung: Bei LiFePO4 oder intelligenter Lichtmaschine immer Booster. Bei einfachen Anlagen mit AGM kann ein Trennrelais ausreichen.',
        '[Erfahrung] Ich habe anfangs ein Trennrelais in meinem Ducato verbaut — bei der intelligenten Lichtmaschine des Euro 6 wurde die Bordbatterie nie voll. Erst mit einem 30-A-Ladebooster kommt sie auf 100 %. Foto: Ladebooster im Schaltplan des 12V-Elektroplaners.',
      ],
      links: [
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: 'Kabelquerschnitt berechnen',
          description: 'Welcher Querschnitt für Booster und Batterie?',
        },
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherungen richtig wählen',
          description: 'Wo das Schutzorgan sitzt und welche Kette gilt.',
        },
      ],
    },
    {
      id: 'absicherung',
      heading: 'Absicherung der Ladewege',
      body: [
        'Jeder Ladeweg braucht seine eigene Absicherung: Die Leitung vom Booster zur Batterie wird nach dem Booster-Strom abgesichert, die Landstrom-Zuleitung nach dem Ladegerät.',
        'Die Sicherung folgt der Leitung (I_B ≤ I_n ≤ I_z), nicht dem Verbraucher. Wer den Booster nachrüstet, muss auch die Zuleitung zum Booster absichern.',
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler beim Laden',
      list: {
        items: [
          'LiFePO4 an ein Blei-Ladegerät hängen — lädt nie vollständig.',
          'Lichtmaschine ohne Booster an die Bordbatterie koppeln — Lima überhitzt bei hohen Strömen.',
          'Trennrelais bei intelligenter Lichtmaschine — Batterie lädt nicht voll.',
          'Keine Absicherung zwischen Booster und Batterie — die Zuleitung ist ungeschützt.',
          '230-V-Anlage selbst installiert — lebensgefährlich und nicht versichert.',
        ],
      },
    },
    {
      id: 'grenzen',
      heading: 'Was diese Seite nicht leistet',
      list: {
        items: [
          'Keine Einbauanleitung für Ladebooster oder Landstrom-Einspeisung.',
          'Keine Aussagen zu spezifischen Herstellerprodukten ohne Datenblatt.',
          'Keine Rechtsauskunft zur Zulassung von Ladeanlagen.',
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Brauche ich immer einen Ladebooster?',
      answer:
        'Bei LiFePO4 oder intelligenter Lichtmaschine (Euro 6) ja. Bei einfachen Anlagen mit AGM und klassischer Lichtmaschine kann ein Trennrelais ausreichen — lädt aber langsamer und unregulierter.',
    },
    {
      question: 'Welche Größe Ladebooster für 100 Ah?',
      answer:
        'Als Faustregel: 10–20 % der Nennkapazität als Ladestrom. Bei 100 Ah sind das 10–20 A, bei 200 Ah 20–40 A. Für schnelleres Laden 30 A oder 50 A — passend zur Batterie und zur Lichtmaschine.',
    },
    {
      question: 'Darf ich Landstrom selbst anschließen?',
      answer:
        'Nein. Die 230-V-Anlage (Landstrom-Einspeisung, FI-Schutz, Steckdosen) errichtet, ändert und prüft eine Elektrofachkraft nach DIN VDE 0100-721.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/ladebooster/', label: 'Ladebooster: Größe, Anschluss, Absicherung' },
    {
      href: '/camper-elektrik/ladebooster-vergleich/',
      label: 'Ladebooster im Praxisvergleich: Victron, Votronic und andere',
      description: 'Erfahrungsbericht zum Wechsel des Boosters — mit ehrlichen Vor- und Nachteilen.',
    },
    { href: '/camper-elektrik/230v/', label: '230-V-Anlage und Landstrom' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modellwerte für Laden',
      detail:
        'Ladestrom als Faustregel 10 % der Nennkapazität · LiFePO4 mit 90 % Entladetiefe · Ladezeit-Aufschlag 1,15 im elektroplaner-camper.de-Modell.',
    },
  ],
  assumptions: [
    'Die Empfehlungen gelten für 12-V-Systeme; 24-V-Systeme halbieren die Ströme bei gleicher Leistung.',
    'Keine Aussagen zu spezifischen Lichtmaschinenmodellen ohne Datenblatt.',
  ],
  limits: ['Keine Einbauanleitung für Ladebooster.', 'Keine Aussagen zur Fahrzeugzulassung bei Nachrüstung.'],
};
