/**
 * lib/seo/content/agm.ts — Cluster-Seite `/camper-elektrik/agm/`.
 */
import { PEUKERT_EXPONENT } from '@/lib/peukert';
import { BATTERY_RI_MILLIOHM_AT_100AH } from '@/lib/shortCircuit';
import { VDE_BATTERY_DOD } from '@/lib/vde-standards';

import type { SeoPageContent } from '../types';

const AGM_DOD = Math.round((VDE_BATTERY_DOD.AGM ?? 0.5) * 100);

export const AGM_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/agm/',
  slug: 'agm',
  topicId: 'agm',
  kind: 'cluster',
  title: 'AGM und Gel im Camper: 50 % Entladetiefe richtig planen',
  absoluteTitle: true,
  description:
    'AGM und Gel im Camper: 50 % Entladetiefe, Peukert-Effekt, Ladungsverhalten und der ehrliche Vergleich zur LiFePO4 — mit Rechenbeispiel und Gewichtsabschätzung.',
  h1: 'AGM und Gel im Camper planen',
  lead: 'AGM und Gel sind robust, günstig und in fast jedem Fahrzeug zu finden. Ihre Grenze ist die Entladetiefe: Nutzbar ist nur die Hälfte der Nennkapazität — wer das einplant, plant ehrlich.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.7,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'entladetiefe',
      heading: `Nutzbar sind ${AGM_DOD} % — und warum das doppelte Kapazität bedeutet`,
      body: [
        `Das Modell rechnet AGM und Gel mit ${AGM_DOD} % Entladetiefe, Nassblei mit 30 %. Für 1 000 Wh Tagesbedarf und einen autarken Tag heißt das: rund 167 Ah Nennkapazität statt 93 Ah bei LiFePO4. Dazu kommt das Gewicht — Blei liegt bei rund 30 kg je 100 Ah.`,
        'Die Entladetiefe ist keine Herstellerwillkür: Tiefentladung verkürzt die Lebensdauer von Bleibatterien deutlich. Wer regelmäßig bis 80 % entlädt, bezahlt das über die Zyklenzahl.',
      ],
      callout: {
        tone: 'info',
        text: `Die Entladetiefen stehen als Modellwerte in Camp (AGM ${AGM_DOD} %, Gel ${AGM_DOD} %, Nassblei 30 %). Die Herstellerangabe der konkreten Batterie geht vor — sie steht im Datenblatt.`,
      },
    },
    {
      id: 'peukert',
      heading: 'Peukert bei Bleibatterien',
      body: [
        `AGM liegt im Modell bei einem Peukert-Exponenten von ${PEUKERT_EXPONENT.AGM}, Gel bei ${PEUKERT_EXPONENT.Gel} — beide höher als Lithium (${PEUKERT_EXPONENT.LiFePO4}). Praktisch bedeutet das: Eine 100-Ah-AGM, die nominell auf 5 A Entladestrom normiert ist, liefert bei 40 A Strom nur noch 77,9 % ihrer Kapazität.`,
        `Zusammen mit der Entladetiefe bleiben aus 100 Ah dann 39,0 Ah nutzbar. Wer eine große Last betreibt, merkt das deutlich — deshalb gehört der Peukert-Effekt in jede Bleiplanung mit Wechselrichter oder Kompressor.`,
      ],
    },
    {
      id: 'laden',
      heading: 'Laden: die Bleikennlinie ist der Maßstab',
      body: [
        'Bleibatterien brauchen eine Ladekennlinie mit Konstantstrom-, Konstantspannungs- und Erhaltungsphase. Wichtig für die Planung: Eine Bleibatterie wird nur dann voll, wenn die Ladespannung hoch genug ist und genug Zeit bleibt. Kurze Fahrten mit voller Lichtmaschinenspannung laden weniger, als die Amperestunden-Anzeige vermuten lässt.',
      ],
      list: {
        items: [
          'Ladespannung passend zur Chemie: AGM und Gel unterscheiden sich in der zulässigen Ladespannung — Gel ist empfindlicher gegen zu hohe Spannung.',
          'Lichtmaschine ohne Booster lädt über die lange Leitung nur mit mäßigem Strom: Der Querschnitt und damit der Spannungsfall begrenzen den Ladestrom.',
          'Landstrom-Ladegeräte halten Blei über die Erhaltungsladung fit — Lithium braucht diese Phase nicht.',
          'Solar ohne MPPT verliert bei Blei einen erheblichen Teil der Modulleistung, weil die Modulspannung über der Batteriespannung liegt.',
        ],
      },
      links: [
        {
          href: '/camper-elektrik/mppt/',
          label: 'MPPT-Laderegler für 12-V-Bleibänke auslegen',
          description: 'Warum PWM bei Blei Modulleistung verschenkt.',
        },
      ],
    },
    {
      id: 'vergleich',
      heading: 'AGM oder LiFePO4?',
      definitions: [
        {
          term: 'Nutzbare Energie je Kilogramm',
          description:
            'Lithium liefert bei gleichem Gewicht zwei- bis dreimal so viel nutzbare Kapazität. Bei Fahrzeugen mit begrenzter Zuladung ist das das entscheidende Kriterium.',
        },
        {
          term: 'Kurzschlussstrom und Absicherung',
          description: `Der Innenwiderstands-Anker liegt bei AGM mit ${BATTERY_RI_MILLIOHM_AT_100AH.AGM} mΩ je 100 Ah höher als bei LiFePO4 (${BATTERY_RI_MILLIOHM_AT_100AH.LiFePO4} mΩ) — Bleibänke stellen geringere Ansprüche an das Abschaltvermögen der Sicherung.`,
        },
        {
          term: 'Ladeverhalten und Kälte',
          description:
            'Blei lädt auch bei Kälte, braucht aber eine vollständige Kennlinie und mehr Zeit. Lithium lädt unter 0 °C gar nicht, dafür sehr schnell, wenn es warm genug ist.',
        },
        {
          term: 'Kosten',
          description:
            'Je nutzbarer Kilowattstunde ist AGM günstiger, je Kilogramm und je Zyklus ist Lithium günstiger. Die Rechnung kippt mit der Nutzungsdauer.',
        },
      ],
      body: [
        'Für ein Wochenendfahrzeug mit Landstromanschluss ist AGM oft die vernünftige Wahl: robust, einfach zu laden, günstig. Für ein Reisefahrzeug mit Solar und hohem Verbrauch rechnet sich Lithium über Gewicht und nutzbare Kapazität.',
      ],
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Mit der Nennkapazität rechnen — die Hälfte ist bei AGM nicht verfügbar.',
          'Zwei Batterien aus verschiedenen Baujahren parallel schalten: Die ältere bestimmt die nutzbare Kapazität.',
          'Gel mit AGM-Ladespannung laden: Gel nimmt zu hohe Spannungen übel.',
          'Bleibatterien dauerhaft teilentladen lagern — Sulfatierung kostet dauerhaft Kapazität.',
          'Den Peukert-Effekt bei Wechselrichterbetrieb ignorieren und sich über die kurze Laufzeit wundern.',
        ],
      },
    },
    {
      id: 'naechster-schritt',
      heading: 'Nächster Schritt',
      links: [
        { href: '/camper-elektrik/batterie/', label: 'Camper-Batterie dimensionieren' },
        { href: '/camper-elektrik/lifepo4/', label: 'LiFePO4 im Camper' },
        { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
        { href: '/rechner/solaranlage/', label: 'Solaranlage berechnen' },
        { href: '/elektrik-planung/#planer', label: 'Camper-Elektroplaner öffnen' },
      ],
    },
  ],
  faq: [
    {
      question: 'Wie viel nutzbare Kapazität hat eine 100-Ah-AGM-Batterie?',
      answer:
        'Nach dem Modell 50 Ah bei schonender Entladung mit 5 A. Bei 40 A Entladestrom kommen nur 39 Ah heraus, weil der Peukert-Effekt die entnehmbare Kapazität zusätzlich mindert. Für eine lange Lebensdauer sollte die Entladetiefe eher unter 50 % bleiben.',
    },
    {
      question: 'Was ist der Unterschied zwischen AGM und Gel?',
      answer:
        'Beide sind verschlossene Bleibatterien mit 50 % Entladetiefe im Modell; Gel hat den höheren Peukert-Exponenten (1,15 gegenüber 1,12) und reagiert empfindlicher auf zu hohe Ladespannung. Für die Kapazitätsbemessung ändert das wenig — für die Wahl des Ladegeräts viel.',
    },
    {
      question: 'Lohnt sich der Umstieg von AGM auf LiFePO4?',
      answer:
        'Rechnerisch ja, wenn Gewicht oder Autarkie knapp sind: Bei gleicher Nennkapazität liefert Lithium 80 % mehr nutzbare Energie bei weniger als der Hälfte des Gewichts. Der Umstieg ist aber kein Batterietausch allein — Ladegerät, Sicherung (Abschaltvermögen) und Laderegler müssen dazu passen.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/camper-elektrik/lifepo4/', label: 'LiFePO4 im Camper' },
    { href: '/camper-elektrik/solar/', label: 'Solar im Camper auslegen' },
    { href: '/camper-elektrik/mppt/', label: 'MPPT-Laderegler' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
  ],
  sources: [
    {
      label: 'Modellwerte für Blei',
      detail:
        'Entladetiefe 50 % (AGM/Gel) und 30 % (Nassblei) in `lib/vde-standards.ts`; Peukert-Exponenten 1,12 und 1,15 in `lib/peukert.ts`; Innenwiderstands-Anker 5 und 6 mΩ je 100 Ah in `lib/shortCircuit.ts`.',
    },
    {
      label: 'Ladespannungen',
      detail:
        'Nicht im Modell enthalten — die Angaben zur Ladekennlinie stammen aus Herstellerdatenblättern und sind hier als solche benannt.',
    },
  ],
  assumptions: [
    'Der Peukert-Exponent ist ein chemiespezifischer Faustwert; ein Datenblattwert schlägt ihn.',
    'Die Gewichtsangaben dienen der Größenordnung, nicht der Zuladungsrechnung.',
  ],
  limits: [
    'Sulfatierung, Zyklenzahl und Alterung sind nicht modelliert.',
    'Die zulässige Zuladung des Fahrzeugs ist keine elektrische Frage und wird hier nicht bewertet.',
  ],
};
