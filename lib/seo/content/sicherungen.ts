/**
 * lib/seo/content/sicherungen.ts — Cluster-Seite
 * `/camper-elektrik/sicherungen/`.
 *
 * Bauformen und Abschaltvermögen kommen aus `lib/shortCircuit.ts` (dort mit
 * Quellenlage dokumentiert) — diese Seite zitiert das Modell, sie erfindet
 * keine Herstellerdaten.
 */

import {
  FUSE_MAP,
  FUSE_MAX_UNPROTECTED_LENGTH_M,
  STANDARD_FUSE_SIZES,
  VDE_AMPACITY,
  VDE_SIZES,
  designAmpacity,
} from '@/lib/electrical';
import { FUSE_BREAKING_CAPACITY_A, FUSE_TYPE_LABELS } from '@/lib/shortCircuit';

import type { SeoPageContent } from '../types';

const NORM_ROWS = VDE_SIZES.filter((size) => size <= 25).map((size) => [
  `${size.toFixed(1).replace('.', ',')} mm²`,
  `${VDE_AMPACITY[size] ?? '—'} A`,
  `${designAmpacity(size).toFixed(1).replace('.', ',')} A`,
  `${FUSE_MAP[size] ?? '—'} A`,
]);

const FORMAT_ROWS = (
  Object.keys(FUSE_BREAKING_CAPACITY_A) as Array<keyof typeof FUSE_BREAKING_CAPACITY_A>
).map((type) => [FUSE_TYPE_LABELS[type], `${FUSE_BREAKING_CAPACITY_A[type].toLocaleString('de-DE')} A`]);

/**
 * Kleinster Modellquerschnitt je Norm-Nennstrom: der erste Querschnitt, dessen
 * größte zulässige Sicherung den Nennstrom noch trägt.
 */
const RATING_ROWS = STANDARD_FUSE_SIZES.filter((rating) => rating <= 60).map((rating) => {
  const smallest = VDE_SIZES.find((crossSection) => (FUSE_MAP[crossSection] ?? 0) >= rating);
  return [`${rating} A`, smallest === undefined ? '—' : `${smallest.toFixed(1).replace('.', ',')} mm²`];
});

export const SICHERUNGEN_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/sicherungen/',
  slug: 'sicherungen',
  topicId: 'sicherungen',
  kind: 'cluster',
  title: 'Sicherungen im Camper: Ort, Größe und Bauform',
  absoluteTitle: true,
  description:
    'Welche Sicherung gehört an welches Kabel? Ort am Batteriepol, Größe nach Leitungsgrenze, Bauform nach Kurzschlussstrom — mit Tabelle und Beispiel.',
  h1: 'Sicherungen im Camper richtig dimensionieren',
  lead: 'Eine Sicherung schützt nicht das Gerät, sondern die Leitung — und sie sitzt so nah wie möglich an der Batterie. Wer diese beiden Sätze beherzigt, hat den größten Teil der Fehlerquellen schon vermieden.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'schutzziel',
      heading: 'Was eine Sicherung schützt — und was nicht',
      body: [
        'Ein Kurzschluss in einer ungeschützten 2,5-mm²-Leitung an einer 100-Ah-LiFePO4 wird zur Heizung: Der Batteriestrom ist hoch genug, um das Kupfer in Sekunden auf Zündtemperatur zu bringen. Die Sicherung soll genau das verhindern — sie schützt die LEITUNG, nicht das Gerät dahinter.',
        'Ein zweites Missverständnis betrifft die Richtung: Eine zu kleine Sicherung schützt nicht besser, sie löst im Normalbetrieb aus. Eine zu große schützt nicht mehr, weil sie den Leiter thermisch überlastet zulässt. Die Größe liegt deshalb in einem Fenster — der Kette I_B ≤ I_n ≤ I_z.',
      ],
      definitions: [
        {
          term: 'I_B',
          description: 'Betriebsstrom des Kreises — was der Verbraucher im Dauerbetrieb zieht.',
        },
        { term: 'I_n', description: 'Nennstrom der Sicherung.' },
        {
          term: 'I_z',
          description:
            'Belastbarkeit der Leitung mit dem Derating des Modells (Tabellenwert × 0,7). Bei 2,5 mm² sind das 16,1 A.',
        },
      ],
    },
    {
      id: 'ort',
      heading: 'Der Ort: unmittelbar am Batteriepol',
      body: [
        `Die Sicherung sitzt unmittelbar am Pluspol der Batterie, bevor die erste Leitung ungeschützt geführt wird. Der Planer prüft dafür ${FUSE_MAX_UNPROTECTED_LENGTH_M * 100} cm ab der Quelle — den Wert aus ISO 10133:2000 § 8.1, der für kleine Boote gilt und in der Camper-Praxis weit verbreitet ist. DIN VDE 0100-721 verlangt den Überstromschutz ebenfalls nahe der Batterie, nennt aber keine Länge.`,
        'Praktisch bedeutet das: Die Leitung vom Pol zum Verteiler oder zum Trennschalter ist selbst ein Kabel, das geschützt werden muss. Sie wird am Pol abgesichert — nicht erst im Verteiler, denn genau die Strecke dazwischen ist die ungeschützte.',
      ],
      callout: {
        tone: 'warning',
        text: 'Eine Sicherung hinter einem Schalter schützt die Leitung zwischen Pol und Schalter nicht. Wer aus Bequemlichkeit im Verteiler absichert, hat genau dort keine Absicherung, wo der Kurzschlussstrom am größten ist.',
      },
    },
    {
      id: 'groesse',
      heading: 'Die Größe: erst der Leiter, dann der Verbraucher',
      table: {
        caption: 'Leitungsgrenzen des Modells (DIN VDE 0298-4, Verlegeart B2, Derating 0,7)',
        head: ['Querschnitt', 'Tabelle', 'Design (×0,7)', 'Größte Sicherung'],
        rows: NORM_ROWS,
        note: 'Bei 2,5 mm² liegt das Fenster zwischen dem Betriebsstrom und 16 A. Ein Verbraucher mit 12 A bekommt also eine 15-A-Sicherung, nicht 20 A.',
      },
      body: [
        'Die letzte Spalte ist die Obergrenze, nicht die Empfehlung. Die konkrete Größe ist der kleinste Normwert, der über dem Betriebsstrom liegt und die Leitung nicht überlastet — bei 10 A auf 6 mm² also 10 A, bei 10 A auf 1,5 mm² dagegen 16 A, weil die Leitung mehr nicht schützt.',
        'Wer eine größere Sicherung braucht, braucht zuerst ein dickeres Kabel. Das ist die einzige Richtung, in der die Kette verschoben werden darf.',
      ],
      subsections: [
        {
          heading: 'Nennströme und der kleinste Querschnitt, der sie noch schützt',
          body: [
            'Die Tabelle ordnet übliche Nennströme dem jeweils kleinsten Querschnitt zu, der sie nach dem Modell noch schützt. Sie ist als Orientierung gedacht: Der Hersteller des konkreten Schutzorgans nennt zusätzlich Auslösekennlinien (flink, träge, Zeit-Strom-Kurve), die das Modell nicht abbildet.',
          ],
        },
      ],
    },
    {
      id: 'nennstroeme',
      heading: 'Nennströme und passender Mindestquerschnitt',
      table: {
        caption: 'Kleinster Modellquerschnitt je Nennstrom (Auszug)',
        head: ['Nennstrom', 'Schützt ab Querschnitt'],
        rows: RATING_ROWS,
        note: 'Anders gelesen: Eine 30-A-Sicherung auf 6 mm² schützt diese Leitung mit 26,6 A Design-Belastbarkeit nicht mehr — hier gehört 10 mm² (36,4 A) darunter.',
      },
    },
    {
      id: 'bauform',
      heading: 'Die Bauform: Abschaltvermögen entscheidet',
      body: [
        'Der Nennstrom ist die halbe Antwort. Eine Sicherung muss den Kurzschlussstrom, der an ihrem Einbauort fließen kann, sicher abschalten — sonst entsteht ein Lichtbogen, den sie nicht löscht. Das Datenblatt nennt dafür das Abschaltvermögen; die Modelltabelle gibt typische Ankerwerte je Bauform.',
      ],
      table: {
        caption:
          'Typisches DC-Abschaltvermögen je Bauform (Modellwerte, Herstellerdatenblätter bei ≤ 32 V DC)',
        head: ['Bauform', 'Abschaltvermögen (typisch)'],
        rows: FORMAT_ROWS,
        note: 'ATO nur bis 30 A Nennstrom erhältlich; darüber entscheiden MEGA, ANL, MRBF oder Class T. Das Datenblatt des konkreten Produkts schlägt die Tabelle.',
      },
      subsections: [
        {
          heading: 'Warum nicht immer Class T?',
          body: [
            'Class T schaltet typischerweise 20 000 A ab und ist damit das Dach für Lithium-Spitzenbänke. Die Modellpolitik wählt trotzdem die kleinste Bauform, deren Abschaltvermögen den Kurzschlussstrom am Einbauort trägt: Höheres Abschaltvermögen bedeutet physikalisch längere, energiereichere Lichtbögen beim Abschalten und größere Bauformen — nicht automatisch einen besseren Schutz für eine kleine Anlage.',
          ],
        },
      ],
    },
    {
      id: 'beispiele',
      heading: 'Zwei Rechenbeispiele',
      list: {
        ordered: true,
        items: [
          'Kühlschrank, 8 A Dauerstrom, 4 m einfache Leitungslänge: Der Spannungsfall fordert 3,1 mm² → gewählt 4 mm² (ΔU 0,28 V = 2,3 %). Die Leitung trägt 21 A, die größte zulässige Sicherung ist 20 A — gewählt wird die 10-A-Sicherung am Pol, weil sie über dem Betriebsstrom liegt.',
          'Wechselrichter, 1 000 W bei 12 V: Der Eingangsstrom liegt bei rund 98 A (Wirkungsgrad 0,85, Entladeschlussspannung 12,0 V). Über 1,5 m fordert der Spannungsfall nur 14,1 mm² — maßgeblich ist die Strombelastbarkeit: 98 A verlangen 70 mm² (Design 120,4 A). Größte zulässige Sicherung: 100 A. Dazu gehört die Prüfung des Kurzschlussstroms gegen das Abschaltvermögen dieser Sicherung.',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Das zweite Beispiel ist der klassische Fall: Der Querschnitt folgt dem Spannungsfall, die Sicherung folgt der Leitung — und wenn beide zusammen nicht passen, ist die Anlage nicht ausführbar. Der Planer markiert solche Kanten statt sie zu übergehen. [Camper-Elektroplaner öffnen](/elektrik-planung/#planer).',
      },
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Sicherung im Verteiler statt am Pol — die ungeschützte Strecke bleibt bestehen.',
          'Sicherung nach Verbraucherdatenblatt statt nach Leitung wählen.',
          'Abschaltvermögen ignorieren: Eine 100-A-Flachsicherung mit 1 000 A Abschaltvermögen kann an einer großen LiFePO4-Bank überfordert sein.',
          'Rückleitungen mitabsichern, aber die Plusseite ungeschützt lassen — die Masse wird nicht abgesichert, die Plusleitung schon.',
          'Sammelschienen ohne eigene Absicherung abgreifen: Jeder Abzweig braucht den Schutz, der zu seinem Querschnitt passt.',
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Wo muss die Sicherung in der 12-V-Anlage sitzen?',
      answer:
        'Unmittelbar am Pluspol der Batterie, vor der ersten ungeschützten Leitungsstrecke. Der Planer prüft 0,2 m ab der Quelle (ISO 10133:2000 § 8.1); DIN VDE 0100-721 verlangt den Überstromschutz nahe der Batterie, ohne eine Länge zu nennen. Die Sicherung schützt die Leitung — ihre Größe folgt deshalb dem Querschnitt und nicht dem Verbraucher.',
    },
    {
      question: 'Welche Sicherung gehört zu welchem Kabelquerschnitt?',
      answer:
        'Die größte zulässige Sicherung folgt der Design-Belastbarkeit des Leiters (Tabellenwert × 0,7): 1,5 mm² → 10 A, 2,5 mm² → 16 A, 4 mm² → 20 A, 6 mm² → 25 A, 10 mm² → 32 A. Die tatsächliche Größe ist der kleinste Normwert über dem Betriebsstrom — bei 8 A auf 4 mm² also 10 A.',
    },
    {
      question: 'Reicht eine Sicherung für die ganze Anlage?',
      answer:
        'Nein. Abgesichert wird jede Leitung einzeln, beginnend mit der Hauptleitung am Batteriepol, danach jeder Abzweig mit dem Schutz, der zu seinem Querschnitt passt. Eine gemeinsame Sicherung würde nur die stärkste Leitung schützen und alle dünneren Abzweige ungeschützt lassen.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
    { href: '/camper-elektrik/spannungsabfall/', label: 'Spannungsabfall bei 12 V' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/camper-elektrik/schaltplan/', label: 'Schaltplan zeichnen' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'DIN VDE 0100-430',
      detail: 'Schutz bei Überstrom: Koordination von Betriebsstrom, Sicherung und Leitungsbelastbarkeit.',
    },
    {
      label: 'DIN VDE 0298-4',
      detail: 'Strombelastbarkeit der Leitungen (Verlegeart B2, Derating 0,7 im Modell).',
    },
    {
      label: 'ISO 10133:2000 § 8.1',
      detail: `Schutzorgan am Quellpunkt bei Kleinspannungs-Gleichstromanlagen; der Planer prüft daraus ${FUSE_MAX_UNPROTECTED_LENGTH_M * 100} cm.`,
    },
    {
      label: 'Abschaltvermögen in der Auslieferung',
      detail:
        'Die Ankerwerte je Bauform stehen in `lib/shortCircuit.ts` — mit Quellenangabe (Herstellerdatenblätter) und dem Hinweis, dass das Datenblatt des konkreten Produkts vorgeht.',
    },
  ],
  assumptions: [
    'Die Sicherung ist ein Modell der Bauform, nicht eines konkreten Produkts: Auslösekennlinien und Alterung bildet das Modell nicht ab.',
    'Abschaltvermögen sind typische Herstelleranker, keine Zusage eines bestimmten Bauteils.',
  ],
  limits: [
    'Die Auswahl der Bauform ersetzt keinen Blick ins Datenblatt — vor allem bei Lithium-Bänken mit hohem Kurzschlussstrom.',
    'Der Kurzschlussstrom wird im Planer geschätzt (Batterie-Innenwiderstand, Leitungswiderstand); die Schätzung ist konservativ, aber keine Messung.',
    '230-V-Schutzeinrichtungen (Leitungsschutzschalter, RCD) folgen einer eigenen Betrachtung.',
  ],
};
