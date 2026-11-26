/**
 * lib/seo/content/beispiele/wochenend-camper.ts — Beispiel-Seite
 * `/beispiele/wochenend-camper/` zur Planer-Vorlage „Wochenend-Camper"
 * (`TEMPLATE_MINIMALIST`, Deep-Link `?template=wochenende`).
 *
 * Jede Zahl auf dieser Seite — Bauteile, Längen, Querschnitte,
 * Sicherungen, Tagesenergie — steht in der Vorlage
 * (`components/planner/templates.ts`) oder ist die reine Multiplikation
 * ihrer Startwerte (W × h). Der Test `beispiele.test.ts` hält Seite und
 * Vorlage aneinander fest. Die Startwerte sind laut Vorlagen-Kommentar
 * Annahmen für einen sinnvollen Erststart, keine Produktdaten — so steht
 * es auch im Text.
 */

import type { SeoPageContent } from '../../types';

export const BEISPIEL_WOCHENEND_CONTENT: SeoPageContent = {
  path: '/beispiele/wochenend-camper/',
  slug: 'wochenend-camper',
  topicId: 'beispiel-wochenend-camper',
  kind: 'cluster',
  title: 'Wochenend-Camper Schaltplan: Beispiel mit 100 Ah AGM',
  absoluteTitle: true,
  description:
    'Schaltplan für den Wochenend-Camper ohne 230 V: 100 Ah AGM, 25-A-Hauptsicherung am Pol, Sicherungskasten, LED, USB und Kühlbox – im 12V-Planer öffnen.',
  h1: 'Wochenend-Camper: Schaltplan-Beispiel ohne 230 V',
  lead: 'Für einen Wochenend-Camper ohne 230 V reicht ein einfacher Schaltplan: eine Bordbatterie, eine Hauptsicherung direkt am Pol und ein Sicherungskasten mit einzeln abgesicherten Verbrauchern. Die Vorlage im 12V-Planer nutzt dafür eine 100-Ah-AGM-Batterie mit 25-A-Class-T-Hauptsicherung (16 mm², 0,2 m). Dazu kommen LED-Licht (5 A), USB-Steckdosen (10 A) und Kühlbox (10 A) an ATO-Sicherungen.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-11',
  sections: [
    {
      id: 'bauteile',
      heading: 'Die Bauteile der Vorlage',
      body: [
        'Sechs Bauteile, kein Schnickschnack — das ist die kleinste der drei Vorlagen und der richtige Start für Minicamper und Bulli ohne Landstrom und Wechselrichter.',
      ],
      table: {
        caption: 'Bauteile der Vorlage „Wochenend-Camper" (Startwerte, keine Produktdaten)',
        head: ['Bauteil', 'Wert in der Vorlage'],
        rows: [
          ['Bordbatterie', '100 Ah, AGM, 12 V Nennspannung'],
          ['Massepunkt', 'eigener Massepunkt'],
          ['Sicherungskasten', 'ATO, 25 A'],
          ['LED-Beleuchtung', '20 W, 4 h/Tag'],
          ['USB-Steckdosen', '36 W, 2 h/Tag'],
          ['Kühlbox', '45 W, 8 h/Tag'],
        ],
      },
    },
    {
      id: 'verkabelung',
      heading: 'Verkabelung und Absicherung',
      table: {
        caption: 'Leitungen der Vorlage „Wochenend-Camper": Länge, Querschnitt, Sicherung',
        head: ['Leitung', 'Länge', 'Querschnitt', 'Sicherung'],
        rows: [
          ['Batterie + → Sicherungskasten', '0,2 m', '16 mm²', '25 A Class T (am Pol)'],
          ['Batterie − → Massepunkt', '1 m', '16 mm²', '–'],
          ['Sicherungskasten → LED-Beleuchtung', '5 m', '2,5 mm²', '5 A ATO'],
          ['Sicherungskasten → USB-Steckdosen', '3 m', '2,5 mm²', '10 A ATO'],
          ['Sicherungskasten → Kühlbox', '2 m', '4 mm²', '10 A ATO'],
        ],
        note: 'Tagesenergie aus den Startwerten: 80 + 72 + 360 = 512 Wh — reine Multiplikation der Vorlagenwerte (W × h). Das ist eine Annahme, die du im Planer an deine Geräte anpasst.',
      },
      callout: {
        tone: 'info',
        text: 'Genau dieser Plan liegt als Vorlage im Planer: [Im Planer öffnen](/planer/?template=wochenende) — verkabelt und bereit zum Anpassen.',
      },
    },
    {
      id: 'hinweise',
      heading: 'Worauf du bei diesem Aufbau achten solltest',
      subsections: [
        {
          heading: 'Hauptsicherung direkt am Pol',
          body: [
            'Die 25-A-Class-T-Sicherung sitzt 0,2 m hinter dem Pluspol. ISO 13297:2020 § 8.1 fordert das Schutzorgan nahe am Quellpunkt, bei Wasserfahrzeugen innerhalb von 200 mm; für Caravans ist das eine Praxisempfehlung, die der Planer prüft.',
          ],
        },
        {
          heading: 'Selektivität: nur der betroffene Kreis löst aus',
          body: [
            '25 A vorn und höchstens 10 A in den Abgängen ergibt ein Verhältnis von 2,5 — über dem Mindestverhältnis 1,6, das der Planer prüft. Ein Kurzschluss im Kühlbox-Kreis löst also nur dessen Sicherung aus, nicht die Hauptsicherung.',
          ],
        },
        {
          heading: 'Die Sicherung schützt die Leitung, nicht das Gerät',
          body: [
            'Wenn du einen Verbraucher tauschst oder die Leitung verlängerst, rechnet der Planer Querschnitt und Spannungsabfall neu (κ = 58 m/(Ω·mm²)): bis 1 % im Zielbereich, Planungsgrenze 3 %, darüber Verstoß, über 4 % kritisch.',
          ],
        },
        {
          heading: 'Keine Ladequelle in der Vorlage',
          body: [
            'Die Batterie wird in diesem Beispiel extern geladen. Wenn du während der Fahrt laden willst, ergänze im Planer einen Ladebooster — wie im Beispiel [Autarker Kastenwagen](/beispiele/autarker-kastenwagen/).',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Welche Hauptsicherung braucht ein einfacher Camper-Schaltplan?',
      answer:
        'In diesem Beispiel sind es 25 A Class T, direkt am Pluspol der 100-Ah-AGM-Batterie, auf 16 mm² und 0,2 m Leitung. Die Abgänge dahinter sind mit 5 A und 10 A ATO abgesichert, damit nur die betroffene Sicherung auslöst.',
    },
    {
      question: 'Reicht 2,5 mm² für LED-Licht und USB im Camper?',
      answer:
        'In der Vorlage ja: LED-Licht mit 20 W auf 5 m und USB mit 36 W auf 3 m laufen über je 2,5 mm². Bei längeren Leitungen oder mehr Leistung rechnet der 12V-Planer den Spannungsabfall neu und meldet mehr als 3 % als Verstoß.',
    },
    {
      question: 'Brauche ich für einen Wochenend-Camper 230 V?',
      answer:
        'Nein. Dieses Beispiel kommt ganz ohne Wechselrichter und Landstrom aus. Licht, USB und Kühlbox laufen direkt mit 12 V über den Sicherungskasten.',
    },
    {
      question: 'Kann ich das Beispiel an meinen Bulli anpassen?',
      answer:
        'Ja. Über „Im Planer öffnen" lädst du die Vorlage im 12V-Planer, kostenlos und ohne Konto. Ein bereits gespeicherter eigener Plan wird nicht still überschrieben, der Planer fragt vorher nach.',
    },
  ],
  related: [
    { href: '/beispiele/', label: 'Alle Schaltplan-Beispiele ansehen' },
    {
      href: '/beispiele/autarker-kastenwagen/',
      label: 'Autarker Kastenwagen: LiFePO4, Solar und Ladebooster',
    },
    { href: '/camper-elektrik/schaltplan/', label: 'Schaltplan zeichnen: Aufbau und Prüfung' },
    { href: '/planer/', label: '12V-Planer öffnen' },
  ],
  sources: [
    {
      label: 'Planer-Vorlage „Wochenend-Camper"',
      detail:
        'Bauteile, Leitungen, Querschnitte und Sicherungen: `TEMPLATE_MINIMALIST` in `components/planner/templates.ts` — dieselbe Vorlage, die der Verweis „Im Planer öffnen" lädt.',
    },
  ],
  assumptions: [
    'Die Startwerte (Leistungen, Stunden pro Tag) sind Annahmen der Vorlage für einen sinnvollen Erststart, keine Produktdaten.',
    'Die Tagesenergie ist die reine Multiplikation der Startwerte (W × h); Ladeverluste rechnet der Planer in der Energiebilanz.',
  ],
  limits: [
    'Der Plan ist ein Single-Line-Schema und keine Einbauanleitung; Verlegung, Scheuerschutz und Klemmen zeigt er nicht.',
  ],
};
