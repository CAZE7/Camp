/**
 * lib/seo/content/beispiele/grosses-autark-setup.ts — Beispiel-Seite
 * `/beispiele/grosses-autark-setup/` zur Planer-Vorlage
 * „Großes Autark-Setup" (`TEMPLATE_AUTARK`, Deep-Link `?template=autark`).
 *
 * Diese Seite ist das Datenblatt der Vorlage: Bauteile, jede Leitung mit
 * Länge/Querschnitt/Sicherung, Tagesenergie, FAQ. Die Schwester-Seite
 * `/camper-elektrik/schaltplan-beispiel/` zeigt denselben Plan als Skizze
 * und erklärt die Lesart — hier steht, was drin ist; dort, wie man ihn
 * liest. Alle Werte: `components/planner/templates.ts` bzw. W × h aus
 * ihren Startwerten; der Test `beispiele.test.ts` hält das fest.
 */

import type { SeoPageContent } from '../../types';

export const BEISPIEL_AUTARK_CONTENT: SeoPageContent = {
  path: '/beispiele/grosses-autark-setup/',
  slug: 'grosses-autark-setup',
  topicId: 'beispiel-grosses-autark-setup',
  kind: 'cluster',
  title: 'Autark-Schaltplan mit Landstrom, 400 W Solar & 200 Ah',
  absoluteTitle: true,
  description:
    'Großes Autark-Setup als Schaltplan: 200 Ah LiFePO4, 400 W Solar, 20-A-Booster, 16-A-Landstrom, Standheizung und 600-W-Wechselrichter mit FI/LS.',
  h1: 'Großes Autark-Setup: Schaltplan mit Landstrom und 400 W Solar',
  lead: 'Für lange Standzeiten und den Winter kombiniert dieses Beispiel aus dem 12V-Planer drei Ladewege: 400 W Solar an einem 35-A-MPPT, einen 20-A-Ladebooster und 16-A-Landstrom. Die 200-Ah-LiFePO4-Batterie ist mit 100 A Class T auf 70 mm² abgesichert. Ein 600-W-Wechselrichter versorgt 230-V-Verbraucher, ergänzt um Kühlschrank, Standheizung und Dachlüfter auf 12 V.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-11',
  sections: [
    {
      id: 'bauteile',
      heading: 'Die Bauteile der Vorlage',
      body: [
        'Die größte der drei Vorlagen — ausgelegt auf Standzeiten ohne Stellplatz-Strom, mit Landstrom als drittem Ladeweg für den Winter.',
      ],
      table: {
        caption: 'Bauteile der Vorlage „Großes Autark-Setup" (Startwerte, keine Produktdaten)',
        head: ['Bauteil', 'Wert in der Vorlage'],
        rows: [
          ['Bordbatterie', '200 Ah LiFePO4, 12,8 V, internes BMS'],
          ['Starterbatterie', '90 Ah AGM, 12 V'],
          ['Solarmodul', '400 W (Arbeitspunkt 31 V / 12,9 A, Voc 37 V, Isc 13,7 A)'],
          ['MPPT-Solarregler', '35 A, max. 75 V PV-Eingang'],
          ['DC-DC-Ladebooster', '20 A'],
          ['Landstrom', '16 A, mit FI/RCD, Netzform TN-S'],
          ['Plus- und Minus-Sammelschiene', 'je eine'],
          ['Sicherungskasten', '40 A (MIDI)'],
          ['Wechselrichter', '600 W Dauerleistung, 10 W Leerlauf, mit FI/RCD'],
          ['Kompressorkühlschrank', '60 W, 8 h/Tag'],
          ['Standheizung', '40 W, 3 h/Tag'],
          ['MaxxFan (Dachlüfter)', '40 W, 4 h/Tag'],
          ['E-Bike-Lader / Reisekocher (230 V)', '500 W, 0,5 h/Tag'],
        ],
      },
    },
    {
      id: 'verkabelung',
      heading: 'Verkabelung und Absicherung',
      table: {
        caption: 'Leitungen der Vorlage „Großes Autark-Setup": Länge, Querschnitt, Sicherung',
        head: ['Leitung', 'Länge', 'Querschnitt', 'Sicherung / Schutz'],
        rows: [
          ['Bordbatterie + → Plus-Sammelschiene', '0,5 m', '70 mm²', '100 A Class T'],
          ['Bordbatterie − → Minus-Sammelschiene', '0,5 m', '70 mm²', '–'],
          ['Solar → MPPT', '4 m', '10 mm²', '25 A ATO'],
          ['MPPT → Plus-Sammelschiene', '1 m', '16 mm²', '40 A MIDI'],
          ['Starterbatterie → Ladebooster', '5 m', '16 mm²', '40 A MIDI'],
          ['Ladebooster → Plus-Sammelschiene', '1 m', '10 mm²', '25 A ATO'],
          ['Plus-Sammelschiene → Sicherungskasten', '1 m', '16 mm²', '40 A MIDI'],
          ['Sicherungskasten → Kühlschrank', '3 m', '4 mm²', '10 A ATO'],
          ['Sicherungskasten → Standheizung', '4 m', '4 mm²', '15 A ATO'],
          ['Sicherungskasten → MaxxFan', '3 m', '2,5 mm²', '10 A ATO'],
          ['Plus-Sammelschiene → Wechselrichter +', '1 m', '35 mm²', '60 A Class T'],
          ['Minus-Sammelschiene → Wechselrichter −', '1 m', '35 mm²', '–'],
          ['Wechselrichter → 230-V-Verbraucher', '2 m', '2,5 mm²', 'FI/LS (RCBO) B10, Typ B, 6 kA'],
          ['Landstrom → Wechselrichter', '2 m', '2,5 mm²', 'FI/LS (RCBO) B16, Typ B, 6 kA'],
        ],
        note: 'Tagesenergie aus den Startwerten: 480 + 120 + 160 + 250 = 1.010 Wh, ohne Leerlauf des Wechselrichters.',
      },
      callout: {
        tone: 'info',
        text: 'Genau dieser Plan liegt als Vorlage im Planer: [Im Planer öffnen](/planer/?template=autark) — verkabelt und bereit zum Anpassen. Als Skizze mit Lese-Anleitung steht er auf der Seite [Beispiel-Schaltplan: Landstrom, LiFePO4 und Solar](/camper-elektrik/schaltplan-beispiel/).',
      },
    },
    {
      id: 'hinweise',
      heading: 'Worauf du bei diesem Aufbau achten solltest',
      subsections: [
        {
          heading: 'Der Hauptstrang bleibt unter 100 A',
          body: [
            'Laut Auslegung in der Vorlage fließen im ungünstigsten Fall 58,8 A Wechselrichter-Eingang, 11,7 A DC-Lasten und 22,2 A Booster-Eingang gleichzeitig — zusammen 92,7 A. Das passt zu 70 mm² und 100 A Class T. Einen größeren Wechselrichter darfst du nicht ohne neue Hauptsicherung einsetzen; der Planer meldet das.',
          ],
        },
        {
          heading: 'Standheizung braucht stabile Spannung',
          body: [
            '4 mm² auf 4 m mit 15 A ATO: Zu viel Spannungsabfall in der Glühphase kann die Heizung abschalten. Der Planer meldet mehr als 3 % als Verstoß und mehr als 4 % als kritisch (κ = 58 m/(Ω·mm²)) — bei der Heizungsleitung lohnt der Blick auf den Prozentwert.',
          ],
        },
        {
          heading: 'Solar und Regler zusammen prüfen',
          body: [
            'Ein Arbeitspunkt von 31 V und eine Voc von 37 V stehen gegen 75 V maximale PV-Spannung. Wenn du weitere Module in Reihe ergänzt, prüft der Planer die Kälte-Leerlaufspannung gegen diese Grenze.',
          ],
        },
        {
          heading: '230 V und Landstrom sind Sache der Elektrofachkraft',
          body: [
            'In der Vorlage sind beide 230-V-Leitungen über FI/LS mit Typ B geschützt (B16 Landstrom, B10 Verbraucher). Die Landstrominstallation muss nach DIN VDE 0100-721 eine Elektrofachkraft errichten und prüfen. Mehr dazu unter [230 V im Camper](/camper-elektrik/230v/).',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Wie groß sollte die Batterie für ein Wintersetup im Camper sein?',
      answer:
        'Diese Vorlage nutzt 200 Ah LiFePO4 bei rund 1.010 Wh Tagesbedarf aus den Startwerten. Mit deinen eigenen Verbrauchern rechnet der 12V-Planer Energiebilanz und Autarkie neu.',
    },
    {
      question: 'Wie wird Landstrom im Camper-Schaltplan abgesichert?',
      answer:
        'In diesem Beispiel mit 16 A, FI/RCD am Einspeisepunkt und einem FI/LS B16 Typ B auf der 2,5-mm²-Leitung zum Wechselrichter. Errichten und prüfen muss die 230-V-Anlage eine Elektrofachkraft nach DIN VDE 0100-721.',
    },
    {
      question: 'Welcher Querschnitt passt zu einem 600-W-Wechselrichter an 12 V?',
      answer:
        'In der Vorlage sind es 35 mm² über 1 m mit 60 A Class T an der Plus-Sammelschiene. Andere Längen oder Leistungen rechnet der Planer neu.',
    },
    {
      question: 'Warum hat der Ladebooster hier nur 20 A?',
      answer:
        'Damit der Batterie-Hauptstrang im ungünstigsten Fall unter 100 A bleibt. Mit Wechselrichter, DC-Lasten und Booster-Eingang sind es zusammen 92,7 A. Ein größerer Booster braucht eine neue Auslegung des Hauptstrangs.',
    },
  ],
  related: [
    { href: '/beispiele/', label: 'Alle Schaltplan-Beispiele ansehen' },
    {
      href: '/camper-elektrik/schaltplan-beispiel/',
      label: 'Diesen Plan als Skizze ansehen',
      description: 'Prinzipskizze mit Lese-Anleitung und Prüfungsliste zu genau diesem Aufbau.',
    },
    {
      href: '/beispiele/autarker-kastenwagen/',
      label: 'Autarker Kastenwagen: LiFePO4, Solar und Ladebooster',
    },
    { href: '/camper-elektrik/230v/', label: '230-V-Anlage im Camper: Landstrom und FI-Schutz' },
    { href: '/planer/', label: '12V-Planer öffnen' },
  ],
  sources: [
    {
      label: 'Planer-Vorlage „Großes Autark-Setup"',
      detail:
        'Bauteile, Leitungen, Querschnitte und Sicherungen: `TEMPLATE_AUTARK` in `components/planner/templates.ts` — dieselbe Vorlage, die der Verweis „Im Planer öffnen" lädt.',
    },
  ],
  assumptions: [
    'Die Startwerte (Leistungen, Stunden pro Tag) sind Annahmen der Vorlage für einen sinnvollen Erststart, keine Produktdaten.',
    'Die Tagesenergie ist die Multiplikation der Startwerte (W × h) ohne Wechselrichter-Leerlauf; Verluste rechnet der Planer in der Energiebilanz.',
  ],
  limits: [
    'Der Plan ist ein Single-Line-Schema und keine Einbauanleitung; Verlegung, Scheuerschutz und Klemmen zeigt er nicht.',
    'Die 230-V-Seite samt Landstrom muss eine Elektrofachkraft errichten und prüfen.',
  ],
};
