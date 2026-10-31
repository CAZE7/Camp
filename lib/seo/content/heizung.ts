/**
 * lib/seo/content/heizung.ts — Pillar-Seite `/heizung-daemmung/`.
 *
 * Die Hauptseite für Heizung und Dämmung im Camper. Verlinkt auf den
 * Heizlast-Rechner (`/tools/heizung/`) und auf alle Spokes des Clusters
 * C5 (Heizung & Dämmung). Keine eigenen Rechenwerte hier — die Rechnung
 * passiert im Tool und in den jeweiligen Spokes.
 *
 * Information Gain: Eigene Heizlast-Beispielrechnung, Praxis-Entscheidung
 * zur Dämmung, Normverweise (DIN VDE 0100-721 für 230-V-Heizungen).
 */

import type { SeoPageContent } from '../types';

export const HEIZUNG_CONTENT: SeoPageContent = {
  path: '/heizung-daemmung/',
  slug: 'heizung-daemmung',
  topicId: 'heizung',
  kind: 'pillar',
  title: 'Heizung im Camper: Heizleistung, Dämmung und Standheizung',
  absoluteTitle: true,
  description:
    'Wie viel Heizleistung braucht dein Camper? Heizlast-Rechner, Dämmung, Diesel-Standheizung und der Vergleich von Heizsystemen — mit Rechenweg.',
  h1: 'Heizung im Camper planen',
  lead: 'Die Heizung steht nicht allein — sie hängt von Dämmung, Fahrzeuggröße und Wunschtemperatur ab. Diese Seite verknüpft Heizlast-Rechner, Dämmung und Heizsysteme zu einer Planung.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'kernantwort',
      heading: 'Wie viel Heizleistung braucht ein Camper?',
      body: [
        'Die Heizleistung folgt der U-Wert-Rechnung der Dämmung, der Fahrzeuggröße und dem Temperaturunterschied zwischen innen und außen. Bei 2–3 kW hat eine 4-kW-Standheizung noch Reserve; erst über 4 kW wird sie knapp. Für einen H2L2 mit 19 mm Dämmung und 85 % Abdeckung rechnet das Modell etwa 2,0 kW — dann ist eine 2-kW-Heizung grenzwertig.',
        'Das Modell rechnet die Heizlast aus Oberfläche, U-Wert und Temperaturdifferenz. Dämmung ist deshalb kein optionales Extra, sondern die erste Heizungsentscheidung: Je besser gedämmt, desto kleiner die Heizung.',
        'Eine Diesel-Standheizung braucht Strom für Gebläse, Pumpe und Zündglühen. Herstellerangaben für gängige Geräte: 2-kW-Geräte typisch 10–29 W, 4-kW-Geräte 10–57 W; beim Start etwa 6–12 A für 2–3 Minuten. Über eine kalte Winter-Nacht summiert sich das auf mehrere hundert Wattstunden — das gehört in die Energiebilanz.',
      ],
      callout: {
        tone: 'info',
        text: '[Heizlast-Rechner öffnen](/tools/heizung/) — Fahrzeugmaße, Dämmung und Wunschtemperatur eingeben und die nötige Heizleistung in Watt bestimmen.',
      },
    },
    {
      id: 'heizlast',
      heading: 'Heizlast berechnen: der Rechner',
      body: [
        'Der Heizlast-Rechner auf dieser Seite nimmt Fahrzeuggröße, Dämmstärke und Wunschtemperatur und liefert die nötige Heizleistung in Watt. Er ist der Ausgangspunkt für jede Heizungsentscheidung — ob Diesel-Standheizung, Gas oder Elektroheizung.',
        'Das Ergebnis ist eine Planungszahl, keine Garantie. Tatsächliches Heizverhalten hängt von Wind, Sonnenstrahlung, Belegung und Lüftungsverhalten ab.',
      ],
      links: [
        {
          href: '/tools/heizung/',
          label: 'Heizlast-Rechner öffnen',
          description: 'Fahrzeugmaße, Dämmung und Wunschtemperatur eingeben und Heizleistung bestimmen.',
        },
      ],
    },
    {
      id: 'daemmung',
      heading: 'Dämmung: die erste Heizungsentscheidung',
      body: [
        'Dämmung bestimmt den U-Wert der Fahrzeughülle und damit den Wärmeverlust. Je geringer der U-Wert, desto weniger Heizleistung braucht die Anlage. Die Wahl des Materials (Armaflex, PIR, XPS, Schafwolle) beeinflusst nicht nur den U-Wert, sondern auch Gewicht, Feuchteverhalten und Einbauaufwand.',
        'Kondenswasser ist ein zentrales Risiko bei der Dämmung: Wird warme, feuchte Luft an kalte Metallflächen geführt, kann sie im Dämmaufbau kondensieren. Bei offenzelligen Dämmstoffen muss die Feuchteführung deshalb geplant werden; eine Dampfbremse auf der warmen Seite kann sinnvoll sein, muss aber luftdicht ausgeführt werden. Geschlossenzellige Dämmstoffe mit verklebten Stößen wirken selbst als Dampfbremse.',
        '[Erfahrung] Bei der Dämmung meines Fahrzeugs habe ich die Feuchteführung geplant und die Dämmung an den kalten Flächen geschlossen ausgeführt. Offene Fugen und undichte Anschlüsse sind der Punkt, an dem Feuchte in den Aufbau gelangt.',
      ],
      links: [
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: 'Kabelquerschnitt berechnen',
          description: 'Welcher Querschnitt für welche Heizungsleitung?',
        },
      ],
    },
    {
      id: 'heizsysteme',
      heading: 'Heizsysteme im Vergleich',
      body: [
        'Die drei gängigen Systeme im Camper sind Diesel-Standheizung, Gasheizung und Elektroheizung. Sie unterscheiden sich in Anschaffungskosten, Verbrauch, Einbauaufwand und Zulassungsrelevanz.',
        'Die Diesel-Standheizung heizt mit Kraftstoff aus dem Fahrzeugtank und braucht Strom nur für das Gebläse. Die Gasheizung ist unabhängig vom Motor, braucht aber eine G 607-Prüfung. Die Elektroheizung ist einfach zu installieren, braucht aber viel Batteriekapazität oder Landstrom.',
      ],
      callout: {
        tone: 'warning',
        text: 'Die 230-V-Anlage (Landstrom, Wechselrichter-Ausgang mit Steckdosen) errichtet, ändert und prüft eine Elektrofachkraft nach DIN VDE 0100-721.',
      },
      links: [
        {
          href: '/heizung-daemmung/diesel-standheizung/',
          label: 'Diesel-Standheizung im Camper',
          description: 'Einbau, Abgas, Stromverbrauch und 2-kW- vs. 4-kW-Auslegung.',
        },
      ],
    },
    {
      id: 'strom',
      heading: 'Stromverbrauch der Heizung',
      body: [
        'Eine Diesel-Standheizung braucht Strom für Gebläse, Pumpe und Zündglühen — 2-kW-Geräte typisch 10–29 W, 4-kW-Geräte 10–57 W; beim Start kurz 6–12 A. Über eine kalte Winter-Nacht summiert sich das auf mehrere hundert Wattstunden.',
        'Der Stromverbrauch der Heizung gehört in die Energiebilanz des Campers. Wer zwei Tage autark stehen will, rechnet den Heizstrom mit ein — sonst fehlt die Kapazität für Kühlbox und Licht.',
        '[Beispiel] Das Gebläse ist im Planer mit 2,9 A über 8 Stunden angesetzt — bei 12 V sind das etwa 35 W und 280 Wh. Das ist ein Modellwert, keine Messung an einem konkreten Gerät.',
      ],
      links: [
        {
          href: '/camper-elektrik/stromverbrauch/',
          label: 'Stromverbrauch typischer Verbraucher',
          description: 'Tabelle mit Heizungsgebläse und anderen 12-V-Verbrauchern.',
        },
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: 'Kabelquerschnitt berechnen',
          description: 'Welcher Querschnitt für welche Heizungsleitung?',
        },
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler bei Heizung und Dämmung',
      list: {
        items: [
          'Dämmung ohne geplante Feuchteführung: Feuchte kann im Dämmaufbau kondensieren und das Fahrzeug von innen beschädigen.',
          'Heizung nach Gefühl dimensioniert: Eine 2-kW-Heizung kann in einem gut gedämmten Kastenwagen reichen; in einem schlecht gedämmten Fahrzeug ist sie oft zu knapp.',
          'Wärmebrücken vergessen: Fenster, Rippen und Metallverstärkungen leiten Wärme nach außen und schaffen lokale Kältepunkte.',
          'Keine Umluft eingeplant: Ohne Luftzirkulation staut sich die Hitze um den Heizer, der Rest des Fahrzeugs bleibt kalt.',
          'Dieselheizung ohne Abstand zu Fenstern, Türen oder Ansaugöffnungen: Abgas muss nach außen und nach Herstellervorgabe geführt werden.',
        ],
      },
    },
    {
      id: 'grenzen',
      heading: 'Was diese Seite nicht leistet',
      list: {
        items: [
          'Keine Heizlastberechnung für ein konkretes Fahrzeug ohne Fahrzeugmaße und Dämmwerte.',
          'Keine Einbauanleitung für Diesel-Standheizungen — Abgas und Kraftstoffleitung sind sicherheitskritisch.',
          'Keine Rechtsauskunft zur Zulassung von Heizsystemen — Prüforganisation und Herstellerunterlagen sind maßgeblich.',
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Wie viel Heizleistung braucht ein Camper?',
      answer:
        'Das folgt aus Fahrzeuggröße, Dämmung und Wunschtemperatur. Der Heizlast-Rechner berechnet die nötige Leistung in Watt aus Oberfläche, U-Wert und Temperaturdifferenz. Ohne diese Angaben ist jede Zahl eine Schätzung.',
    },
    {
      question: 'Welche Dämmung ist die beste für den Camper?',
      answer:
        'Es gibt nicht die eine beste Dämmung. Armaflex ist dünn und feuchtigkeitsunempfindlich, PIR und XPS haben gute λ-Werte, Schafwolle reguliert Feuchte. Die Wahl hängt von Einbauraum, Gewicht und Kondensatrisiko ab.',
    },
    {
      question: 'Braucht eine Diesel-Standheizung Strom?',
      answer:
        'Ja, für Gebläse, Pumpe und Zündglühen — 2-kW-Geräte typisch 10–29 W, 4-kW-Geräte 10–57 W; beim Start kurz 6–12 A. Über eine Nacht summiert sich das auf mehrere hundert Wattstunden und gehört in die Energiebilanz.',
    },
  ],
  related: [
    { href: '/tools/heizung/', label: 'Heizlast-Rechner öffnen' },
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/stromverbrauch/', label: 'Stromverbrauch typischer Verbraucher' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Heizlast-Modell',
      detail:
        'Heizlast aus Oberfläche, U-Wert und Temperaturdifferenz — umgesetzt im Heizlast-Rechner `/tools/heizung/`.',
    },
    {
      label: 'Dämmwerte',
      detail:
        'λ-Werte und U-Werte je Material sind Herstellerangaben oder Normwerte — als solche gekennzeichnet.',
    },
  ],
  assumptions: [
    'Der Heizlast-Rechner nutzt einen vereinfachten U-Wert-Ansatz; den Lüftungswärmeverlust berücksichtigt er mit n = 0,5–1,0 h⁻¹. Wärmebrücken werden nicht separat modelliert.',
    'Die Ergebnisse sind Planungszahlen, keine Ersatz für eine bauliche Heizlastberechnung nach DIN EN 12831.',
  ],
  limits: [
    'Keine Einbauanleitung für Heizsysteme.',
    'Keine Zulassungsauskunft für Diesel- oder Gasheizungen.',
    'Keine Berücksichtigung von Solargewinn oder internen Wärmequellen (Personen, Geräte).',
  ],
};
