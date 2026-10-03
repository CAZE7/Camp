/**
 * lib/seo/content/lifepo4.ts — Cluster-Seite `/camper-elektrik/lifepo4/`.
 *
 * Die Seite bleibt bei dem, was das Modell wirklich weiß: Entladetiefe,
 * Peukert-Exponent, Entladeschlussspannung, Innenwiderstands-Anker für die
 * Kurzschlussabschätzung. Ladespannungen und Temperaturfenster einzelner
 * Produkte stehen NICHT im Modell — sie werden deshalb als Herstellerangabe
 * benannt und nicht als Camp-Wert ausgegeben.
 */

import { sizeBattery } from '@/lib/batterySizing';
import { PEUKERT_EXPONENT } from '@/lib/peukert';
import { BATTERY_RI_MILLIOHM_AT_100AH } from '@/lib/shortCircuit';
import { VDE_DISCHARGE_VOLTAGE_FACTOR } from '@/lib/vde-standards';

import type { SeoPageContent } from '../types';

/** Beispiel: derselbe Tagesbedarf in beiden Chemien. */
const DAILY_WH = 1000;
const lifepo4 = sizeBattery({
  dailyEnergyWh: DAILY_WH,
  autonomyDays: 1,
  systemVoltageV: 12,
  chemistry: 'LiFePO4',
});
const agm = sizeBattery({ dailyEnergyWh: DAILY_WH, autonomyDays: 1, systemVoltageV: 12, chemistry: 'AGM' });

const COMPARISON_ROWS = [
  [
    'LiFePO4',
    `${lifepo4.recommendedNominalAh} Ah`,
    '90 %',
    'rund 12,5 kg je 100 Ah',
    `${PEUKERT_EXPONENT.LiFePO4}`,
  ],
  ['AGM', `${agm.recommendedNominalAh} Ah`, '50 %', 'rund 30 kg je 100 Ah', `${PEUKERT_EXPONENT.AGM}`],
];

export const LIFEPO4_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/lifepo4/',
  slug: 'lifepo4',
  topicId: 'lifepo4',
  kind: 'cluster',
  title: 'LiFePO4 im Camper: Kapazität, BMS und Grenzen',
  absoluteTitle: true,
  description:
    'LiFePO4 im Camper einsetzen: 90 % Entladetiefe, Peukert-Faktor, Entladeschlussspannung, BMS und Kurzschlussstrom — mit Rechenbeispiel.',
  h1: 'LiFePO4 im Camper einsetzen',
  lead: 'Lithium-Eisenphosphat liefert fast die doppelte nutzbare Kapazität einer AGM bei weniger als der Hälfte des Gewichts. Der Preis dafür sind Ansprüche an das Ladegerät, an die Absicherung und an den sicheren Einbau — diese Seite benennt sie konkret.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'nutzbar',
      heading: 'Was 90 % Entladetiefe praktisch bedeuten',
      body: [
        'Das Modell rechnet LiFePO4 mit 90 % Entladetiefe — bei einer 100-Ah-Batterie also 90 Ah nutzbar gegenüber 50 Ah bei AGM. Derselbe Tagesbedarf braucht dadurch weniger als die halbe Nennkapazität, und weil Lithium zusätzlich leichter ist, sinkt das Gewicht auf einen Bruchteil.',
      ],
      table: {
        caption: `Beispiel: ${DAILY_WH} Wh Tagesbedarf, ein autarker Tag, 12-V-System (Modellrechnung)`,
        head: [
          'Chemie',
          'Empfohlene Nennkapazität',
          'Entladetiefe',
          'Gewicht (Richtwert)',
          'Peukert-Exponent',
        ],
        rows: COMPARISON_ROWS,
        note: 'Gewichte sind verbreitete Richtwerte je Chemie und dienen nur der Größenordnung — das Modell kennt keine Masse.',
      },
      links: [
        {
          href: '/rechner/batteriekapazitaet/',
          label: 'Kapazität für deinen Tagesbedarf berechnen',
          description: 'Wattstunden, Autarkietage, Chemie — mit Peukert-Faktor.',
        },
      ],
    },
    {
      id: 'spannung',
      heading: 'Spannungslage: 12,8 V nominal, 12,0 V am Entladeende',
      body: [
        'Ein LiFePO4-Block mit vier Zellen hat 12,8 V Nennspannung. Das Modell rechnet Ströme deshalb auf 12,0 V am Entladeende — ' +
          `${(VDE_DISCHARGE_VOLTAGE_FACTOR * 100).toFixed(2).replace('.', ',')} % der Nennspannung. Für die Praxis heißt das: Der Spannungsunterschied zwischen voll und leer ist bei Lithium klein, und genau darum sind Restkapazitätsschätzungen über die Spannung unzuverlässig.`,
        'Diese flache Kennlinie ist auch der Grund, warum ein Wechselrichter an Lithium länger „stark" bleibt — und warum er am Ende ohne Vorwarnung abschaltet, wenn das BMS die Entladeschlussspannung zieht.',
      ],
      callout: {
        tone: 'warning',
        text: 'Die Abschaltschwellen des BMS sind nicht Teil des Modells. Wer die nutzbare Kapazität vollständig ausreizen will, muss die Schwellen des konkreten BMS kennen — sonst plant er mit 90 Ah und bekommt 80.',
      },
    },
    {
      id: 'strom',
      heading: 'Strom: hohe Entladeströme und der Kurzschlussfall',
      body: [
        'Lithium-Batterien haben einen deutlich kleineren Innenwiderstand als Bleibatterien. Das ist im Betrieb erwünscht (weniger Spannungsfall unter Last), im Kurzschlussfall aber gefährlich: Der mögliche Kurzschlussstrom liegt um ein Vielfaches höher, und die Sicherung muss ihn abschalten können. Das Modell setzt für LiFePO4 einen Innenwiderstands-Anker von ' +
          `${BATTERY_RI_MILLIOHM_AT_100AH.LiFePO4} mΩ je 100 Ah an (inklusive typischem BMS-Anteil) und leitet daraus den Kurzschlussstrom am Sicherungseinbauort ab.`,
        'Als Folge gilt: Die Sicherung wird nach Nennstrom UND Abschaltvermögen gewählt. Eine einfache Flachsicherung reicht am Batteriepol regelmäßig nicht aus — dort gehört eine Bauform mit passendem Abschaltvermögen hin, andernfalls ist der Plan nicht ausführbar.',
      ],
      links: [
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherungen nach Nennstrom und Abschaltvermögen wählen',
          description: 'Bauformen mit typischem Abschaltvermögen und die Kette I_B ≤ I_n ≤ I_z.',
        },
      ],
    },
    {
      id: 'peukert',
      heading: 'Peukert bei Lithium',
      body: [
        `Mit einem Exponenten von ${PEUKERT_EXPONENT.LiFePO4} fällt der Peukert-Effekt geringer aus als bei Blei, verschwindet aber nicht: Bei 40 A Entladestrom bleiben aus 100 Ah rund 90,1 % der Kapazität nutzbar — die 90 Ah Entladetiefe gelten also nicht mehr ganz.`,
        'Wer eine große Last (Wechselrichter, Induktionsfeld, Kaffeemaschine) betreibt, sollte deshalb nicht mit der Nennkapazität rechnen, sondern mit dem, was bei diesem Strom wirklich entnehmbar ist. Der Rechner weist den Faktor aus, statt ihn zu verschweigen.',
      ],
    },
    {
      id: 'laden',
      heading: 'Laden: eigene Kennlinie, eigene Geräte',
      body: [
        'LiFePO4 wird mit Konstantstrom bis zur Ladeschlussspannung und danach mit Konstantspannung geladen; die genauen Werte stehen im Datenblatt des Herstellers und nicht in diesem Modell. Zwei Konsequenzen sind unabhängig vom Produkt:',
      ],
      list: {
        items: [
          'Ein Laderegler oder Ladegerät mit Blei-Kennlinie lädt Lithium nie vollständig und kann bei dauerhafter Erhaltungsladung schaden — das Ladegerät muss zur Chemie passen.',
          'Die Lichtmaschine ist keine geregelte Ladequelle für Lithium: Ohne Booster (DC-DC-Ladegerät) begrenzt nur ihr eigener Widerstand den Strom, und die Lima kann überhitzen.',
          'Bei Kälte nimmt eine LiFePO4-Zelle unterhalb von rund 0 °C keinen Ladestrom an. Wer im Winter lädt, braucht eine beheizte Batterie oder ein BMS mit Temperaturschutz.',
        ],
      },
      callout: {
        tone: 'info',
        text: 'Ladespannung, Temperaturfenster und Zyklenzahlen sind Produktdaten. Camp gibt sie nicht als eigene Werte aus — die Datenblattangabe des Herstellers ist die Quelle.',
      },
    },
    {
      id: 'fehler',
      heading: 'Typische Fehler',
      list: {
        items: [
          'Lithium an ein Blei-Ladegerät hängen und sich über die fehlende Vollladung wundern.',
          'Die Absicherung nach dem alten Blei-Plan beibehalten — der Kurzschlussstrom ist jetzt ein anderer.',
          'Batterien unterschiedlicher Kapazität oder Marken parallel schalten: Das BMS arbeitet unabhängig, die Ströme verteilen sich ungleich.',
          'Serienverschaltung ohne Balancer planen: Vier 12-V-Blöcke in Reihe brauchen eine ladungsausgleichende Elektronik.',
          'Die Kabelquerschnitte verkleinern, weil „Lithium weniger Spannungsfall hat" — der Querschnitt folgt der Leitung und der Absicherung, nicht der Chemie.',
        ],
      },
    },
    {
      id: 'naechster-schritt',
      heading: 'Nächster Schritt',
      links: [
        { href: '/camper-elektrik/batterie/', label: 'Camper-Batterie dimensionieren' },
        { href: '/camper-elektrik/agm/', label: 'AGM und Gel im Vergleich' },
        { href: '/camper-elektrik/mppt/', label: 'MPPT-Laderegler auslegen' },
        { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
        { href: '/elektrik-planung/#planer', label: 'Camper-Elektroplaner öffnen' },
      ],
    },
  ],
  faq: [
    {
      question: 'Wie tief darf eine LiFePO4-Batterie im Camper entladen werden?',
      answer:
        'Das Modell rechnet mit 90 % Entladetiefe. In der Praxis begrenzt das BMS die Entladung über die Entladeschlussspannung, und bei Kälte sinkt die nutzbare Kapazität zusätzlich. Wer die 90 % ausnutzen will, muss die Abschaltschwellen des konkreten BMS kennen.',
    },
    {
      question: 'Ist LiFePO4 im Winter ein Problem?',
      answer:
        'Beim Laden ja: Unterhalb von rund 0 °C nimmt die Zelle keinen Ladestrom an, und ein BMS mit Temperaturschutz blockiert ihn. Entladen ist bei Kälte mit verringerter Kapazität möglich. Wer im Winter lädt, braucht eine beheizte Batterie, einen temperierten Einbauort oder ein BMS, das die Ladung sperrt, bis die Batterie warm genug ist.',
    },
    {
      question: 'Braucht LiFePO4 einen anderen Kabelquerschnitt?',
      answer:
        'Der Querschnitt folgt dem Strom und dem Spannungsfall, nicht der Chemie. Was sich ändert, ist die Absicherung: Der Kurzschlussstrom ist deutlich höher, deshalb muss die Sicherung ein passendes Abschaltvermögen haben — bei LiFePO4-Bänken ist das regelmäßig eine Bauform ab MIDI/MEGA, nicht die Flachsicherung.',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/batterie/', label: 'Batterie dimensionieren' },
    { href: '/camper-elektrik/agm/', label: 'AGM und Gel im Camper' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/camper-elektrik/mppt/', label: 'MPPT-Laderegler auslegen' },
    { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität berechnen' },
  ],
  sources: [
    {
      label: 'Modellwerte für LiFePO4',
      detail:
        'Entladetiefe 90 % (`VDE_BATTERY_DOD`), Peukert-Exponent 1,05 (`lib/peukert.ts`), Innenwiderstands-Anker 3 mΩ je 100 Ah (`lib/shortCircuit.ts`).',
    },
    {
      label: 'Temperatur- und Ladegrenzen',
      detail:
        'Nicht im Modell enthalten — die Angaben zum Temperaturfenster und zur Ladespannung stammen aus Herstellerdatenblättern und sind hier als solche benannt.',
    },
  ],
  assumptions: [
    'Die Entladeschlussspannung folgt dem Modellfaktor 0,9375 auf die Nennspannung.',
    'Der Innenwiderstands-Anker ist eine Faustformel für die Kurzschlussabschätzung; ein Datenblattwert schlägt ihn.',
  ],
  limits: [
    'Ladespannung, Balancerverhalten und Zyklenzahl einzelner Produkte sind nicht modelliert.',
    'Zellspannungsdrift, BMS-Regelverhalten und Selbsterwärmung sind keine Rechengrößen dieser Seite.',
    'Die Auswahl einer Batterie ist auch eine Frage der Einbausituation (Temperatur, Belüftung, Befestigung) — das ist keine Rechnung.',
  ],
};
