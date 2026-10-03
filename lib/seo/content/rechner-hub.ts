/**
 * lib/seo/content/rechner-hub.ts — Übersicht `/rechner/`.
 *
 * Die Übersicht führt ALLE Rechenwerkzeuge der Auslieferung zusammen, auch die
 * bestehenden (`/elektrik-planung/`, `/tools/heizung/`, `/tools/dach/`). Damit
 * gibt es genau eine Seite, die „welche Rechner gibt es?" beantwortet — eine
 * zweite Liste wäre eine zweite Wahrheit.
 */

import type { SeoPageContent } from '../types';

export const RECHNER_HUB_CONTENT: SeoPageContent = {
  path: '/rechner/',
  slug: 'rechner',
  topicId: 'rechner',
  kind: 'rechner',
  title: 'Rechner für den Camper-Ausbau',
  absoluteTitle: true,
  description:
    'Alle Rechner für den Camper-Ausbau an einer Stelle: Kabelquerschnitt, Spannungsabfall, Batteriekapazität, Solar, Heizlast und Dachbelegung.',
  h1: 'Rechner für den Camper-Ausbau',
  lead: 'Sechs Rechenwerkzeuge für die häufigsten Fragen beim Ausbau — vom Kabelquerschnitt bis zur Heizlast. Jeder Rechner nennt seine Formel, seine Annahmen und die Grenzen seines Modells; die Zahlen sind dieselben, die der Elektroplaner verwendet.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.9,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'elektrik',
      heading: 'Elektrik: Kabel, Spannung, Batterie, Solar',
      body: [
        'Die vier elektrischen Rechner bauen aufeinander auf: Der Kabelquerschnitt folgt aus Strom und Länge, der Spannungsabfall bewertet eine gewählte Leitung, die Batterie folgt aus dem Tagesbedarf, die Solarinsel aus demselben Bedarf und dem Ertrag.',
      ],
      definitions: [
        {
          term: 'Kabelquerschnitt',
          description:
            'Wählt den Querschnitt nach Spannungsfall und Strombelastbarkeit und nennt die passende Sicherung. Auf der Themenseite mit Formel, Normreihe und Beispielen.',
        },
        {
          term: 'Spannungsabfall',
          description:
            'Bewertet eine vorhandene Leitung in Volt und Prozent — mit Tabelle, wie weit welcher Querschnitt trägt.',
        },
        {
          term: 'Batteriekapazität',
          description:
            'Rechnet Tagesbedarf, Autarkietage und Entladetiefe in eine Nennkapazität um — inklusive Peukert-Effekt.',
        },
        {
          term: 'Solaranlage',
          description:
            'Ermittelt Modulleistung und Panelanzahl aus Tagesbedarf, Ertrag und Jahreszeit — mit getrennter Winterrechnung.',
        },
      ],
      links: [
        { href: '/camper-elektrik/kabelquerschnitt/', label: '12V-Kabelquerschnitt berechnen' },
        { href: '/rechner/spannungsabfall-12v/', label: 'Spannungsabfall-Rechner öffnen' },
        { href: '/camper-elektrik/spannungsabfall/', label: 'Spannungsabfall bei 12 V verstehen' },
        { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
        { href: '/rechner/solaranlage/', label: 'Solaranlage berechnen' },
      ],
    },
    {
      id: 'waerme-und-dach',
      heading: 'Wärme und Dach',
      definitions: [
        {
          term: 'Heizlast',
          description:
            'Leitet die nötige Heizleistung aus Fahrzeuggröße, Dämmung und Wunschtemperatur ab und ordnet sie gängigen Heizgeräten zu.',
        },
        {
          term: 'Dachbelegung',
          description:
            'Platziert Panels und Dachluken auf der Dachfläche und summiert die Solarleistung — die mechanische Prüfung zur Solarrechnung.',
        },
      ],
      links: [
        { href: '/tools/heizung/', label: 'Heizlast-Rechner öffnen' },
        { href: '/tools/dach/', label: 'Dach-Planer öffnen' },
      ],
    },
    {
      id: 'planer',
      heading: 'Der Planer rechnet das ganze System',
      body: [
        'Einzelrechner beantworten Einzelfragen. Der Camper-Elektroplaner verbindet sie: Bauteile setzen, verdrahten lassen — Querschnitt, Sicherung, Spannungsfall und Energiebilanz werden je Leitung geprüft, die Stückliste entsteht aus dem Plan.',
      ],
      links: [
        { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
        { href: '/camper-elektrik/schaltplan/', label: 'Schaltplan zeichnen: Aufbau und Prüfung' },
      ],
      callout: {
        tone: 'info',
        text: 'Alle Rechner laufen im Browser, ohne Anmeldung. Berechnete Werte lassen sich im Planer an den Bauteilen eintragen — dort greifen sie in die Prüfungen ein.',
      },
    },
    {
      id: 'methodik',
      heading: 'Woher die Zahlen kommen',
      body: [
        'Die Rechner und der Planer benutzen dasselbe Modell: Kupfer-Leitfähigkeit κ = 58 m/(Ω·mm²) bei 20 °C, Strombelastbarkeiten nach DIN VDE 0298-4 (Verlegeart B2) mit Derating 0,7, Entladetiefen und Peukert-Exponenten je Chemie sowie die Solar- und Wechselrichter-Kennwerte der Auslieferung. Wo eine Größe eine Annahme ist, steht sie als Annahme in der Rechnung und als Eingabe im Rechner — nicht im Kleingedruckten.',
      ],
      links: [
        { href: '/ueber-werft/', label: 'Über Werft: Methodik, Quellen und Grenzen' },
        { href: '/camper-elektrik/', label: 'Camper-Elektrik planen: der Weg durch das Thema' },
      ],
    },
  ],
  faq: [
    {
      question: 'Welcher Rechner zuerst?',
      answer:
        'Mit dem Tagesbedarf anfangen: Er ist die Eingabe für Batterie und Solar. Danach die Leitungen — der Kabelquerschnitt folgt aus dem Strom der Verbraucher. Die Heizlast ist davon unabhängig und lässt sich parallel rechnen.',
    },
    {
      question: 'Sind die Rechner kostenlos?',
      answer:
        'Ja, ohne Anmeldung und ohne Registrierung. Die Rechner laufen vollständig im Browser; es werden keine Eingaben an einen Server übertragen.',
    },
    {
      question: 'Ersetzen die Rechner eine Fachkraft?',
      answer:
        'Nein. Die Rechner prüfen rechnerische Zusammenhänge — Spannungsfall, Strombelastbarkeit, Absicherung, Energiebilanz. Die 230-V-Anlage braucht eine Elektrofachkraft für Aufbau und Abnahme, und mechanische Fragen (Verlegung, Scheuerschutz, Brandverhalten) sind keine Rechengrößen.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
    { href: '/rechner/solaranlage/', label: 'Solaranlage berechnen' },
    { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
    { href: '/camper-elektrik/spannungsabfall/', label: 'Spannungsabfall berechnen' },
    { href: '/tools/heizung/', label: 'Heizlast-Rechner' },
    { href: '/tools/dach/', label: 'Dach-Planer' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Modell der Auslieferung',
      detail:
        'Alle Rechner verwenden `lib/electrical.ts`, `lib/cableSizing.ts`, `lib/batterySizing.ts`, `lib/solarSizing.ts`, `lib/peukert.ts` und `lib/vde-standards.ts` — dieselben Module, die der Planer prüft.',
    },
  ],
  assumptions: ['Jeder Rechner nennt seine Annahmen auf seiner Seite; die Übersicht wiederholt sie nicht.'],
  limits: [
    'Die Rechner ersetzen keine Abnahme und keine mechanische Beurteilung.',
    'Kein Rechner kennt das konkrete Bauteil: Datenblattwerte des Herstellers gehen den Modellwerten vor.',
  ],
};
