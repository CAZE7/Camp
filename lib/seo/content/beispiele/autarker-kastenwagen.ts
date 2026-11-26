/**
 * lib/seo/content/beispiele/autarker-kastenwagen.ts — Beispiel-Seite
 * `/beispiele/autarker-kastenwagen/` zur Planer-Vorlage
 * „Autarker Kastenwagen" (`TEMPLATE_KASTENWAGEN`, Deep-Link
 * `?template=kastenwagen`). Das ist zugleich das Beispiel-Setup, das beim
 * ersten Öffnen des Planers auf der Zeichenfläche liegt
 * (`STARTER_TEMPLATE_ID`).
 *
 * Alle Werte stammen aus der Vorlage (`components/planner/templates.ts`,
 * Topologie des Allrounders mit den eigenen Sicherungswerten des
 * Kastenwagens) oder sind die Multiplikation ihrer Startwerte (W × h).
 * Der Test `beispiele.test.ts` hält Seite und Vorlage aneinander fest.
 */

import type { SeoPageContent } from '../../types';

export const BEISPIEL_KASTENWAGEN_CONTENT: SeoPageContent = {
  path: '/beispiele/autarker-kastenwagen/',
  slug: 'autarker-kastenwagen',
  topicId: 'beispiel-autarker-kastenwagen',
  kind: 'cluster',
  title: 'Kastenwagen-Schaltplan: LiFePO4, Solar & Ladebooster',
  absoluteTitle: true,
  description:
    'Kastenwagen-Schaltplan: 100 Ah LiFePO4, 200 W Solar mit 30-A-MPPT, 30-A-Ladebooster und 500-W-Wechselrichter – mit Querschnitten und Sicherungen.',
  h1: 'Autarker Kastenwagen: Schaltplan mit LiFePO4, Solar und Ladebooster',
  lead: 'Ein autarker Kastenwagen-Schaltplan verbindet Solar, Ladebooster und Bordbatterie über eine gemeinsame Plus- und Minus-Sammelschiene. Von dort gehen Sicherungskasten und Wechselrichter ab. Die Vorlage im 12V-Planer nutzt 100 Ah LiFePO4 mit 100-A-Class-T-Hauptsicherung auf 70 mm², 200 W Solar an einem 30-A-MPPT, einen 30-A-Ladebooster und einen 500-W-Wechselrichter. Es ist das Setup, das beim ersten Öffnen des Planers geladen ist.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-11',
  sections: [
    {
      id: 'bauteile',
      heading: 'Die Bauteile der Vorlage',
      body: [
        'Das klassische Sprinter-/Ducato-Setup: zwei Ladewege (Solar und Fahrt), ein Wechselrichter für gelegentliche 230 V, vier 12-V-Verbraucher.',
      ],
      table: {
        caption: 'Bauteile der Vorlage „Autarker Kastenwagen" (Startwerte, keine Produktdaten)',
        head: ['Bauteil', 'Wert in der Vorlage'],
        rows: [
          ['Bordbatterie', '100 Ah LiFePO4, 12,8 V, internes BMS'],
          ['Starterbatterie', '90 Ah AGM, 12 V'],
          ['Solarmodul', '200 W (Arbeitspunkt 18 V / 11,1 A, Voc 22,5 V, Isc 11,7 A)'],
          ['MPPT-Solarregler', '30 A, max. 75 V PV-Eingang'],
          ['DC-DC-Ladebooster', '30 A'],
          ['Plus- und Minus-Sammelschiene', 'je eine'],
          ['Sicherungskasten', '40 A'],
          ['Wechselrichter', '500 W Dauerleistung, 6 W Leerlauf, mit FI/RCD'],
          ['Kompressorkühlschrank', '60 W, 8 h/Tag'],
          ['Wasserpumpe', '40 W, 0,5 h/Tag'],
          ['LED-Beleuchtung', '20 W, 4 h/Tag'],
          ['230-V-Steckdose', '300 W, 1 h/Tag'],
        ],
      },
    },
    {
      id: 'verkabelung',
      heading: 'Verkabelung und Absicherung',
      table: {
        caption: 'Leitungen der Vorlage „Autarker Kastenwagen": Länge, Querschnitt, Sicherung',
        head: ['Leitung', 'Länge', 'Querschnitt', 'Sicherung / Schutz'],
        rows: [
          ['Bordbatterie + → Plus-Sammelschiene', '0,5 m', '70 mm²', '100 A Class T'],
          ['Bordbatterie − → Minus-Sammelschiene', '0,5 m', '70 mm²', '–'],
          ['Solarmodul → MPPT', '3 m', '6 mm²', '20 A ATO'],
          ['MPPT → Plus-Sammelschiene', '1 m', '10 mm²', '30 A ATO'],
          ['Starterbatterie → Ladebooster', '5 m', '16 mm²', '40 A MIDI'],
          ['Ladebooster → Plus-Sammelschiene', '1 m', '16 mm²', '40 A MIDI'],
          ['Plus-Sammelschiene → Sicherungskasten', '1 m', '16 mm²', '40 A MIDI'],
          ['Sicherungskasten → Kühlschrank', '3 m', '4 mm²', '10 A ATO'],
          ['Sicherungskasten → Wasserpumpe', '4 m', '2,5 mm²', '10 A ATO'],
          ['Sicherungskasten → LED-Beleuchtung', '5 m', '1,5 mm²', '5 A ATO'],
          ['Plus-Sammelschiene → Wechselrichter +', '1 m', '25 mm²', '60 A Class T'],
          ['Minus-Sammelschiene → Wechselrichter −', '1 m', '25 mm²', '–'],
          ['Wechselrichter → 230-V-Steckdose', '2 m', '2,5 mm²', 'FI/LS (RCBO) B10, Typ B, 6 kA'],
        ],
        note: 'Tagesenergie aus den Startwerten: 480 + 20 + 80 + 300 = 880 Wh, ohne Leerlauf des Wechselrichters.',
      },
      callout: {
        tone: 'info',
        text: 'Genau dieser Plan liegt als Vorlage im Planer: [Im Planer öffnen](/planer/?template=kastenwagen) — verkabelt und bereit zum Anpassen.',
      },
    },
    {
      id: 'hinweise',
      heading: 'Worauf du bei diesem Aufbau achten solltest',
      subsections: [
        {
          heading: 'Jede Ladequelle beidseitig absichern',
          body: [
            'Der Ladebooster hat 40-A-MIDI-Sicherungen auf der Starter- und auf der Bordbatterieseite. Die Leitung kann von beiden Batterien aus gespeist werden — deshalb gehört an beide Enden ein Schutzorgan.',
          ],
        },
        {
          heading: 'Wechselrichter als eigener Abgang',
          body: [
            'Er hängt mit 25 mm² und 60 A Class T direkt an der Sammelschiene, nicht am Sicherungskasten. Der Sicherungskasten ist nur mit 40 A angebunden und würde den Wechselrichterstrom nicht tragen.',
          ],
        },
        {
          heading: 'Solar-Leerlaufspannung prüfen',
          body: [
            'Ein Modul mit Voc 22,5 V liegt weit unter der 75-V-Grenze des MPPT. Wenn du Module in Reihe schaltest, steigt die Leerlaufspannung — bei Kälte zusätzlich. Der Planer prüft die Kälte-Leerlaufspannung gegen die Reglergrenze.',
          ],
        },
        {
          heading: 'Spannungsabfall entscheidet über den Querschnitt',
          body: [
            'Der Planer rechnet mit κ = 58 m/(Ω·mm²): bis 1 % im Zielbereich, Planungsgrenze 3 %, darüber Verstoß, über 4 % kritisch. Lange Leitungen, etwa die 5 m von der Starterbatterie zum Booster, brauchen deshalb einen größeren Querschnitt.',
          ],
        },
        {
          heading: '230 V nur vom Fachbetrieb',
          body: [
            'Die Steckdose hinter dem Wechselrichter ist in der Vorlage über einen FI/LS (B10, Typ B) geschützt. Aufbau und Erstprüfung der 230-V-Seite gehören in die Hände einer Elektrofachkraft — mehr dazu auf der Seite [230 V im Camper](/camper-elektrik/230v/).',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Welche Hauptsicherung braucht eine 100-Ah-LiFePO4-Batterie im Kastenwagen?',
      answer:
        'In dieser Vorlage sind es 100 A Class T auf 70 mm² und 0,5 m Leitung zur Plus-Sammelschiene. Class T wird gewählt, weil sie hohe Kurzschlussströme einer Lithiumbatterie sicher abschaltet.',
    },
    {
      question: 'Wie wird ein 30-A-Ladebooster abgesichert?',
      answer:
        'Mit je einer 40-A-MIDI-Sicherung auf beiden Seiten: 16 mm² über 5 m von der Starterbatterie und 16 mm² über 1 m zur Sammelschiene.',
    },
    {
      question: 'Welcher Querschnitt passt zum 500-W-Wechselrichter?',
      answer:
        'In der Vorlage sind es 25 mm² über 1 m, abgesichert mit 60 A Class T direkt an der Plus-Sammelschiene. Wenn du die Leistung oder die Länge änderst, rechnet der 12V-Planer neu.',
    },
    {
      question: 'Ist das der Plan, der beim ersten Öffnen des 12V-Planers erscheint?',
      answer:
        'Ja. „Autarker Kastenwagen" ist das Beispiel-Setup beim ersten Besuch. Mit „Im Planer öffnen" lädst du ihn jederzeit neu.',
    },
  ],
  related: [
    { href: '/beispiele/', label: 'Alle Schaltplan-Beispiele ansehen' },
    {
      href: '/beispiele/grosses-autark-setup/',
      label: 'Großes Autark-Setup: Landstrom und 400 W Solar',
    },
    { href: '/camper-elektrik/schaltplan/', label: 'Schaltplan zeichnen: Aufbau und Prüfung' },
    { href: '/planer/', label: '12V-Planer öffnen' },
  ],
  sources: [
    {
      label: 'Planer-Vorlage „Autarker Kastenwagen"',
      detail:
        'Bauteile, Leitungen, Querschnitte und Sicherungen: `TEMPLATE_KASTENWAGEN` in `components/planner/templates.ts` — dieselbe Vorlage, die der Verweis „Im Planer öffnen" lädt.',
    },
  ],
  assumptions: [
    'Die Startwerte (Leistungen, Stunden pro Tag) sind Annahmen der Vorlage für einen sinnvollen Erststart, keine Produktdaten.',
    'Die Tagesenergie ist die Multiplikation der Startwerte (W × h) ohne Wechselrichter-Leerlauf; Verluste rechnet der Planer in der Energiebilanz.',
  ],
  limits: [
    'Der Plan ist ein Single-Line-Schema und keine Einbauanleitung; Verlegung, Scheuerschutz und Klemmen zeigt er nicht.',
    'Die 230-V-Seite muss eine Elektrofachkraft errichten und prüfen.',
  ],
};
