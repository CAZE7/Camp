/**
 * lib/seo/content/beispiele/hub.ts — Übersichtsseite `/beispiele/`.
 *
 * Der Hub der drei Beispiel-Schaltpläne: Er beantwortet die Frage
 * „Wie sieht ein fertiger Camper-Schaltplan aus?" mit drei echten,
 * vollständig verkabelten Vorlagen des Planers — vom Wochenend-Camper
 * ohne 230 V bis zum Autark-Setup mit Landstrom. Die Detailseiten
 * (`wochenend-camper`, `autarker-kastenwagen`, `grosses-autark-setup`)
 * tragen die Datenblätter; dieser Hub ordnet ein und verteilt.
 *
 * Die drei Beispiele erscheinen sichtbar als Verweisliste und
 * maschinenlesbar als ItemList (extra-Knoten in `app/beispiele/page.tsx`,
 * im Inventar angekündigt) — aus denselben Einträgen.
 */

import type { SeoPageContent } from '../../types';

/** Die drei Beispiele in Ausbaureihenfolge — Anzeige und ItemList. */
export const BEISPIELE_LISTE: readonly { href: string; label: string; description: string }[] = [
  {
    href: '/beispiele/wochenend-camper/',
    label: 'Wochenend-Camper',
    description: 'Minicamper und Bulli ohne 230 V: 100 Ah AGM, Sicherungskasten, LED-Licht, USB und Kühlbox.',
  },
  {
    href: '/beispiele/autarker-kastenwagen/',
    label: 'Autarker Kastenwagen',
    description:
      'Sprinter und Ducato: 100 Ah LiFePO4, 200 W Solar mit MPPT, 30-A-Ladebooster, 500-W-Wechselrichter.',
  },
  {
    href: '/beispiele/grosses-autark-setup/',
    label: 'Großes Autark-Setup',
    description:
      'Lange Standzeiten und Winter: 200 Ah LiFePO4, 400 W Solar, Ladebooster, Landstrom, Standheizung, 600-W-Wechselrichter.',
  },
];

export const BEISPIELE_HUB_CONTENT: SeoPageContent = {
  path: '/beispiele/',
  slug: 'hub',
  topicId: 'beispiele',
  kind: 'cluster',
  title: 'Camper-Schaltplan Beispiele: 3 Vorlagen | 12V-Planer',
  absoluteTitle: true,
  description:
    'Drei echte Camper-Schaltplan-Beispiele: Wochenend-Camper, autarker Kastenwagen und großes Autark-Setup – mit Sicherungen, Querschnitten und Planer-Link.',
  h1: 'Camper-Schaltplan: drei Beispiele zum Öffnen und Anpassen',
  lead: 'Hier findest du drei vollständig verkabelte Camper-Schaltpläne aus dem 12V-Planer, vom Wochenend-Camper mit 100 Ah AGM bis zum Autark-Setup mit 200 Ah LiFePO4, 400 W Solar und Landstrom. Jedes Beispiel nennt Bauteile, Kabelquerschnitte, Leitungslängen und Sicherungen. Mit einem Klick öffnest du es im Planer und passt es an dein Fahrzeug an.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-11',
  sections: [
    {
      id: 'beispiele',
      heading: 'Die drei Beispiele',
      body: [
        'Alle drei sind echte Vorlagen des Planers, keine Bilder ohne Folgen: Jede Detailseite zeigt das Datenblatt (Bauteile, jede Leitung mit Länge, Querschnitt und Sicherung), und „Im Planer öffnen" lädt genau diesen Plan auf die Zeichenfläche.',
      ],
      links: BEISPIELE_LISTE,
    },
    {
      id: 'nutzung',
      heading: 'So nutzt du die Beispiele',
      list: {
        ordered: true,
        items: [
          'Beispiel öffnen. Ein eigener Plan wird dabei nicht still überschrieben, der Planer fragt vorher nach.',
          'Batterie, Verbraucher und Leitungslängen an dein Fahrzeug anpassen.',
          'Der Planer rechnet Kabelquerschnitt, Sicherung und Spannungsabfall neu. Er meldet mehr als 3 % Spannungsabfall als Verstoß und mehr als 4 % als kritisch.',
          'Stückliste und Druckbericht öffnen oder den Plan als Link teilen.',
        ],
      },
      links: [
        { href: '/camper-elektrik/schaltplan/', label: 'Camper-Schaltplan aufbauen und prüfen' },
        { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
        { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen dimensionieren' },
      ],
    },
  ],
  related: [
    { href: '/planer/', label: '12V-Planer öffnen' },
    { href: '/camper-elektrik/schaltplan/', label: 'Schaltplan zeichnen: Aufbau und Prüfung' },
    {
      href: '/camper-elektrik/schaltplan-beispiel/',
      label: 'Beispiel-Schaltplan als Skizze ansehen',
      description: 'Der Autark-Plan als Prinzipskizze mit Lese-Anleitung.',
    },
    {
      href: '/camper-elektrik/schaltplan-programme/',
      label: 'Schaltplan-Programme im Vergleich',
      description: '12V-Planer, VoltPlan, OCIP, draw.io und KiCad — welches Werkzeug wofür passt.',
    },
  ],
  sources: [
    {
      label: 'Planer-Vorlagen',
      detail:
        'Alle Werte der drei Beispiele: `PLANNER_TEMPLATES` und die Vorlagen-Graphen in `components/planner/templates.ts`.',
    },
  ],
  assumptions: [
    'Die Startwerte der Vorlagen sind Annahmen für einen sinnvollen Erststart, keine Produktdaten.',
  ],
  limits: [
    'Die Beispiele sind Planungsvorlagen, keine Einbauanleitungen; die 230-V-Teile gehören in die Hand einer Elektrofachkraft.',
  ],
};
