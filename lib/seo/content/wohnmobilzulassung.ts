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
    'Wohnmobilzulassung für Selbstausbauer: Voraussetzungen, Ablauf, Kosten, Nachteile und die Elektrik-Dokumentation für den TÜV.',
  h1: 'Wohnmobilzulassung für Selbstausbauer',
  lead: 'Wer einen Camper selbst ausbaut und als Wohnmobil zulassen will, braucht mehr als einen TÜV-Termin. Diese Seite zeigt Voraussetzungen, Ablauf und die Dokumentation, die geprüft wird.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'gedanke',
      heading: 'Zulassung ist kein Formsatz, sondern ein Prüfprozess',
      body: [
        'Die Wohnmobilzulassung verwandelt ein Nutzfahrzeug in ein Wohnfahrzeug. Damit ist nicht nur der Fahrzeugbrief geändert, sondern auch die Art, wie das Fahrzeug genutzt, besteuert und versichert werden darf.',
        'Der Ablauf folgt einer festen Reihenfolge: Ausbau dokumentieren, Fahrzeug prüfen lassen, Eintragung in die Zulassungsbescheinigung. Jeder Schritt baut auf dem vorherigen auf — wer einen überspringt, steht vor verschlossenen Türen.',
      ],
    },
    {
      id: 'voraussetzungen',
      heading: 'Voraussetzungen für die Wohnmobilzulassung',
      body: [
        'Das Fahrzeug muss als Wohnmobil erkennbar sein: Eine fest eingebaute Kochstelle, Sitze, Liegefläche und Stauraum gehören zum Mindestumfang. Eine Induktionsplatte allein reicht nicht — sie zählt als mobiles Gerät, nicht als fest eingebaute Kochstelle.',
        'Das Fahrzeug muss sicher im Straßenverkehr sein: Beleuchtung, Bremsen, Reifen und die Zuladung müssen den Vorschriften entsprechen.',
        'Die Elektrik muss dokumentiert sein: Schaltplan, Kabelquerschnitte und Sicherungen sind Prüfthema bei der TÜV-Abnahme.',
      ],
    },
    {
      id: 'ablauf',
      heading: 'Ablauf der Zulassung',
      body: [
        'Zuerst wird der Ausbau fertiggestellt und dokumentiert. Dann folgt die Abnahme durch eine Prüforganisation (TÜV, DEKRA, GTÜ), die das Fahrzeug auf Wohnmobiltauglichkeit prüft. Nach erfolgter Prüfung erfolgt die Eintragung bei der Zulassungsstelle.',
        'Die Prüfung umfasst die Verkehrssicherheit, die Zuladung, die Elektrik und — falls vorhanden — die Gasanlage (G-607).',
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
        'Wohnmobile unterliegen anderen Regeln als Transporter: Tempolimits, Maut und Versicherung können sich ändern. Die Zuladung wird enger bemessen, und manche Stellplätze unterscheiden zwischen Wohnmobil und Transporter.',
        'Der Steuersatz für Wohnmobile ist günstiger als für Transporter — das ist der Hauptvorteil. Dafür gelten strengere Regeln bei der Nutzung und bei Änderungen am Fahrzeug.',
      ],
    },
    {
      id: 'elektrik-doku',
      heading: 'Elektrik-Dokumentation für den TÜV',
      body: [
        'Die Elektrik ist ein zentrales Prüfthema: Schaltplan, Kabelquerschnitte, Sicherungen und die Einbauorte der Bauteile müssen dokumentiert sein. Eine EMV-Betrachtung (elektromagnetische Verträglichkeit) gehört ebenfalls dazu.',
        'Wer die Elektrik nicht dokumentiert, bekommt keine Eintragung — unabhängig davon, ob die Anlage technisch einwandfrei ist.',
        '[Erfahrung] Beim TÜV-Termin für meinen Ducato fehlte anfangs die Kabelquerschnitts-Liste im Schaltplan. Der Prüfer hat die Eintragung zurückgestellt. Erst mit der automatischen Stückliste aus dem Elektroplaner wurde die Elektrik akzeptiert. Foto: TÜV-Schaltplan mit Kabelverzeichnis aus dem Elektroplaner.',
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
          'Kochstelle nicht fest eingebaut: Eine Induktionsplatte als mobiles Gerät zählt nicht für die Zulassung.',
          'Keine Elektrik-Dokumentation: Ohne Schaltplan und Kabelverzeichnis keine Eintragung.',
          'Zuladung falsch berechnet: Leergewicht plus Ausbau plus Beladung muss unter dem zulässigen Gesamtgewicht bleiben.',
          'Gasanlage ohne G-607-Prüfung: Bei Gasinstallation Pflicht für die Zulassung.',
          'Keine Zwangsentlüftung: Wohnmobile brauchen eine Mindestlüftungsfläche.',
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
          'Keine Checkliste für die Gasanlage (G-607) — das ist ein eigenes Thema.',
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
        'Nein, nicht als einzige. Eine fest eingebaute Kochstelle muss fest im Fahrzeug verankert sein. Eine Induktionsplatte, die einfach nur aufgestellt wird, zählt nicht.',
    },
    {
      question: 'Welche Dokumente braucht der TÜV für die Elektrik?',
      answer:
        'Schaltplan, Kabelquerschnitte, Sicherungsplan und Einbauorte der Bauteile. Eine EMV-Betrachtung gehört ebenfalls dazu. Der Elektroplaner erzeugt Schaltplan und Stückliste aus dem Plan.',
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
        '§ 19 Abs. 2 i. V. m. § 21 StVZO, TÜV Rheinland Merkblatt 740, TÜV NORD Checkliste für die Wohnmobilzulassung.',
    },
    {
      label: 'Elektrik-Dokumentation',
      detail: 'Schaltplan, Kabelquerschnitte, Sicherungen, EMV — erzeugt aus dem Camper-Elektroplaner.',
    },
  ],
  assumptions: [
    'Die Angaben gelten für Deutschland. Österreich und die Schweiz haben andere Regelungen.',
    'Die Kosten sind Schätzwerte und können je nach Prüforganisation und Region abweichen.',
  ],
  limits: [
    'Keine Rechtsauskunft für den Einzelfall.',
    'Keine Aussagen zu Gasanlage und G-607-Prüfung.',
    'Keine Checkliste für spezifische Fahrzeugmodelle.',
  ],
};
