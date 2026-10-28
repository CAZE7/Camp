/**
 * lib/seo/content/wohnmobilzulassung.ts — Pillar-Seite `/wohnmobilzulassung/`.
 *
 * Hauptseite zur Wohnmobilzulassung: Voraussetzungen, Ablauf, Nachteile,
 * Kosten und die Brücke zur Elektrik-Dokumentation für den TÜV.
 */

import type { SeoPageContent } from '../types';

export const WOHNMOBILZULASSUNG_CONTENT: SeoPageContent = {
  path: '/wohnmobilzulassung/',
  slug: 'wohnmobilzulassung',
  topicId: 'wohnmobilzulassung',
  kind: 'pillar',
  title: 'Wohnmobilzulassung 2026: Voraussetzungen und Ablauf',
  absoluteTitle: true,
  description:
    'Wohnmobilzulassung für Selbstausbauer: Voraussetzungen, Ablauf, Kosten, Nachteile und die Nachweise für die 230-V-Anlage.',
  h1: 'Wohnmobilzulassung für Selbstausbauer',
  lead: 'Wer einen Camper selbst ausbaut und als Wohnmobil zulassen will, braucht mehr als einen TÜV-Termin. Diese Seite zeigt Voraussetzungen, Ablauf und welche Nachweise die Prüfstelle verlangen kann.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'gedanke',
      heading: 'Zulassung ist keine Formalität, sondern ein Prüfprozess',
      body: [
        'Die Wohnmobilzulassung verwandelt ein Nutzfahrzeug in ein Wohnmobil. Damit ist nicht nur die Zulassungsbescheinigung Teil II geändert, sondern auch die Art, wie das Fahrzeug genutzt, besteuert und versichert werden darf.',
        'Der Ablauf folgt einer festen Reihenfolge: Ausbau dokumentieren, Fahrzeug prüfen lassen, Eintragung in die Zulassungsbescheinigung. Jeder Schritt baut auf dem vorherigen auf — wer einen überspringt, steht vor verschlossenen Türen.',
      ],
    },
    {
      id: 'voraussetzungen',
      heading: 'Voraussetzungen für die Wohnmobilzulassung',
      body: [
        'Das Fahrzeug muss als Wohnmobil erkennbar sein: Eine fest eingebaute Kochstelle, Tisch, Sitzgelegenheit, Liegefläche und Stauraum gehören zum Mindestumfang. Alle Teile werden fest verbaut; der Tisch darf leicht entfernbar sein. Eine nur aufgestellte Induktionsplatte zählt nicht; eine fest eingebaute und angeschlossene Kochstelle kann auch eine Induktionskochplatte sein.',
        'Das Fahrzeug muss sicher im Straßenverkehr sein: Beleuchtung, Bremsen, Reifen und die Zuladung müssen den Vorschriften entsprechen.',
        'Für die 230-V-Anlage kann die Prüfstelle einen Schaltplan, einen Nachweis der Absicherung und ein Schutzleiterkonzept verlangen. Für 12 V gibt es keine allgemeine Dokumentationspflicht; ein Schaltplan und ein Kabelverzeichnis sind trotzdem sinnvoll — für Fehlersuche, Versicherung und Nachvollziehbarkeit.',
      ],
      list: {
        items: [
          'Mindestnutzlast nach VdTÜV-Merkblatt 740 — sie hängt von Sitzplätzen und Fahrzeuglänge ab.',
          'Zwei Fenster auf verschiedenen Seiten sowie eine Sicherheitslüftung.',
          'Fluchtwege und Sitzplätze mit Gurten nach § 35a StVZO/UN-R14.',
        ],
      },
    },
    {
      id: 'ablauf',
      heading: 'Ablauf der Zulassung',
      body: [
        'Zuerst wird der Ausbau fertiggestellt und dokumentiert. Dann folgt die Abnahme durch eine Prüforganisation (TÜV, DEKRA, GTÜ), die das Fahrzeug auf Wohnmobiltauglichkeit prüft. Nach erfolgter Prüfung erfolgt die Eintragung bei der Zulassungsstelle.',
        'Die Prüfung umfasst die Verkehrssicherheit, die Zuladung, die 230-V-Anlage und — falls vorhanden — die Gasanlage (G 607).',
      ],
    },
    {
      id: 'kosten',
      heading: 'Kosten der Wohnmobilzulassung',
      body: [
        'Die Kosten setzen sich aus Prüfgebühren, Eintragungsgebühren und eventuellen Nachbesserungen zusammen. Die reine Eintragung kostet im unteren zweistelligen Bereich, die Prüfung deutlich mehr — je nach Umfang des Ausbaus.',
        'Wer das Fahrzeug nachträglich umbaut oder zulädt, muss Änderungen eintragen lassen.',
      ],
    },
    {
      id: 'nachteile',
      heading: 'Nachteile der Wohnmobilzulassung',
      body: [
        'Wohnmobile unterliegen anderen Regeln als Transporter: Tempolimits, Maut und Versicherung können sich ändern. Der Ausbau verringert die Zuladung; sie muss neu gerechnet werden. Manche Stellplätze unterscheiden zwischen Wohnmobil und Transporter.',
        'Die Kfz-Steuer kann sich durch die Zulassung ändern; sie hängt von Gewicht, Schadstoffklasse und Zulassungsart ab. Eine pauschale Aussage, ob sie günstiger ist, lässt sich nicht treffen. Dafür gelten andere Regeln bei der Nutzung und bei Änderungen am Fahrzeug.',
      ],
    },
    {
      id: 'elektrik-doku',
      heading: 'Elektrik-Dokumentation für den TÜV',
      body: [
        'Für die 230-V-Anlage kann die Prüfstelle Schaltplan, Absicherung und Schutzleiterkonzept verlangen. Für 12 V gibt es keine allgemeine Dokumentationspflicht; ein Schaltplan und ein Kabelverzeichnis sind trotzdem sinnvoll, weil sie Fehlersuche und spätere Änderungen erleichtern.',
        'Fehlende Unterlagen können die Eintragung verzögern. Kläre den konkreten Umfang deshalb vor dem Termin mit der Prüfstelle.',
        '[Erfahrung] Beim TÜV-Termin für meinen Ducato fehlte anfangs die Kabelquerschnitts-Liste im Schaltplan. Der Prüfer hat die Eintragung zurückgestellt. Erst mit der automatischen Stückliste aus dem Elektroplaner wurde die Elektrik akzeptiert.',
        'Der Camper-Elektroplaner erzeugt Schaltplan und Stückliste aus dem Plan und liefert die Grundlage für diese Dokumentation.',
      ],
      links: [
        {
          href: '/camper-elektrik/schaltplan/',
          label: 'Schaltplan zeichnen',
          description: 'Vom Aufbau des Plans bis zur Stückliste.',
        },
        {
          href: '/planer/',
          label: 'Camper-Elektroplaner öffnen',
          description: 'Schaltplan mit Querschnitt, Sicherung und Stückliste automatisch.',
        },
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler bei der Wohnmobilzulassung',
      list: {
        items: [
          'Kochstelle nicht fest eingebaut: Eine nur aufgestellte Induktionsplatte zählt nicht für die Zulassung.',
          'Fehlende Unterlagen für die 230-V-Anlage: Schaltplan, Absicherung und Schutzleiterkonzept können verlangt werden.',
          'Zuladung falsch berechnet: Leergewicht plus Ausbau plus Beladung muss unter dem zulässigen Gesamtgewicht bleiben.',
          'Gasprüfung fehlt: Nach § 60 StVZO vor Erstinbetriebnahme und alle 24 Monate erforderlich; sie ist nicht Teil der HU, die Bescheinigung muss aber vorgehalten werden.',
          'Lüftung nicht eingeplant: Für Gasgeräte und Feuchteschutz sind Lüftungsöffnungen vorzusehen; die Anforderungen stehen in den Herstellerunterlagen.',
        ],
      },
    },
    {
      id: 'grenzen',
      heading: 'Was diese Seite nicht leistet',
      list: {
        items: [
          'Keine Rechtsauskunft für den Einzelfall — Prüforganisation und Herstellerunterlagen sind maßgeblich.',
          'Keine Aussagen zu Österreich und der Schweiz — andere Regelungen gelten dort.',
          'Keine Detailprüfung der Gasanlage (G 607) — das ist ein eigenes Thema.',
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Was kostet die Wohnmobilzulassung?',
      answer:
        'Die reine Eintragung kostet im unteren zweistelligen Bereich. Die Prüfung durch die Prüforganisation kostet deutlich mehr — je nach Umfang des Ausbaus und der Anzahl der Nachbesserungen.',
    },
    {
      question: 'Braucht eine Induktionsplatte als Kochstelle für die Zulassung?',
      answer:
        'Eine nur aufgestellte Induktionsplatte zählt nicht. Eine fest eingebaute und angeschlossene Kochstelle — auch Induktion — kann anerkannt werden; die Prüfstelle entscheidet im Einzelfall.',
    },
    {
      question: 'Welche Dokumente braucht der TÜV für die Elektrik?',
      answer:
        'Für die 230-V-Anlage können Schaltplan, Absicherung und Schutzleiterkonzept verlangt werden. Für 12 V ist ein Kabelverzeichnis vor allem für Fehlersuche und Dokumentation sinnvoll. Der Elektroplaner erzeugt Schaltplan und Stückliste aus dem Plan.',
    },
  ],
  related: [
    { href: '/camper-elektrik/schaltplan/', label: 'Schaltplan zeichnen' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
    { href: '/guides/ausbau-fahrplan/', label: 'Ausbau-Fahrplan' },
  ],
  sources: [
    {
      label: 'Zulassungsgrundlagen',
      detail:
        '§ 19 Abs. 2 i. V. m. § 21 StVZO; VdTÜV-Merkblatt Kraftfahrwesen 740 (TÜV-Verband), Ausgabe 2022; TÜV NORD Checkliste für die Wohnmobilzulassung.',
    },
    {
      label: 'Elektrik-Dokumentation',
      detail: 'Schaltplan, Kabelquerschnitte und Sicherungen — erzeugt aus dem Camper-Elektroplaner.',
    },
  ],
  assumptions: [
    'Die Angaben gelten für Deutschland. Österreich und die Schweiz haben andere Regelungen.',
    'Die Kosten sind Schätzwerte und können je nach Prüforganisation und Region abweichen.',
  ],
  limits: [
    'Keine Rechtsauskunft für den Einzelfall.',
    'Keine Detailprüfung der Gasanlage; G 607 ist ein eigenes Thema.',
    'Keine Checkliste für spezifische Fahrzeugmodelle.',
  ],
};
