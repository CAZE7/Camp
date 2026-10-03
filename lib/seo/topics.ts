/**
 * lib/seo/topics.ts — der Themenbaum von Camp.
 *
 * Die Architektur ist bewusst ein Baum und kein Etikettensatz: Eine
 * Unterseite kennt ihr Elternthema, daraus entsteht die Brotkrumenspur
 * („Start → Camper-Elektrik → Kabelquerschnitt") und daraus wiederum die
 * Prüfung, ob zwischen Pillar und Cluster wirklich ein Verweis steht (§27).
 *
 * Zwei Regeln, die hier festgeschrieben sind:
 *   1. Tiefe ist erlaubt, aber begründet: `lifepo4` und `agm` hängen unter
 *      `batterie`, `mppt` unter `solar` — weil sie ohne diesen Kontext nicht
 *      zu erklären sind. Alle übrigen Elektrik-Themen hängen direkt am Pillar.
 *   2. Ein Thema ohne Seite hat trotzdem einen Eintrag, wenn es einen Platz
 *      in der Navigation hat (`rechner`, `vertrauen`) — der Inventar-Test
 *      verlangt umgekehrt, dass jede Seite ein bekanntes Thema nennt.
 */

export type TopicId = string;

export type Topic = {
  id: TopicId;
  /** Anzeigename in Brotkrumen, Verweislisten und Navigation. */
  label: string;
  /** Elternthema; ohne Angabe ist das Thema eine Wurzel. */
  parent?: TopicId;
  /** Pillar-Seite des Themas (Pfad im Export), falls sie existiert. */
  path?: string;
  /** Rolle im Graph — Pillars verbinden, Cluster vertiefen. */
  role: 'wurzel' | 'pillar' | 'cluster' | 'nebenbereich';
  /** Ein Satz, was den Nutzer hier erwartet (auch im Pillar-Raster sichtbar). */
  summary: string;
};

export const TOPICS: readonly Topic[] = [
  {
    id: 'start',
    label: 'Startseite',
    path: '/',
    role: 'wurzel',
    summary: 'Einstieg: Reihenfolge, Werkzeuge und Wissensseiten.',
  },
  {
    id: 'camper-elektrik',
    label: 'Camper-Elektrik',
    path: '/camper-elektrik/',
    role: 'pillar',
    summary: 'Elektrik im Camper planen: von der Batterie über Kabel und Sicherungen bis zum Schaltplan.',
  },
  {
    id: 'kabelquerschnitt',
    label: 'Kabelquerschnitt',
    parent: 'camper-elektrik',
    path: '/camper-elektrik/kabelquerschnitt/',
    role: 'cluster',
    summary: 'Welche Leitung gehört an welchen Verbraucher? Querschnitt über Strom und Länge bestimmen.',
  },
  {
    id: 'spannungsabfall',
    label: 'Spannungsabfall',
    parent: 'camper-elektrik',
    path: '/camper-elektrik/spannungsabfall/',
    role: 'cluster',
    summary: 'Wie viel Spannung verliert eine Leitung, und wann wird es für den Verbraucher zu wenig?',
  },
  {
    id: 'sicherungen',
    label: 'Sicherungen',
    parent: 'camper-elektrik',
    path: '/camper-elektrik/sicherungen/',
    role: 'cluster',
    summary: 'Wo sitzt die Sicherung, wie groß darf sie sein und was schützt sie eigentlich?',
  },
  {
    id: 'batterie',
    label: 'Batterie',
    parent: 'camper-elektrik',
    path: '/camper-elektrik/batterie/',
    role: 'cluster',
    summary: 'Kapazität, Entladetiefe und Nutzungsdauer der Aufbaubatterie richtig bemessen.',
  },
  {
    id: 'lifepo4',
    label: 'LiFePO4',
    parent: 'batterie',
    path: '/camper-elektrik/lifepo4/',
    role: 'cluster',
    summary: 'Lithium-Eisenphosphat im Camper: Entladetiefe, BMS, Temperaturen und Ladegrenzen.',
  },
  {
    id: 'agm',
    label: 'AGM',
    parent: 'batterie',
    path: '/camper-elektrik/agm/',
    role: 'cluster',
    summary: 'AGM und Gel: 50 % Entladetiefe, Ladekennlinie und der Vergleich mit LiFePO4.',
  },
  {
    id: 'solar',
    label: 'Solar',
    parent: 'camper-elektrik',
    path: '/camper-elektrik/solar/',
    role: 'cluster',
    summary: 'Wie viel Modulleistung deckt den Tagesverbrauch — im Sommer und im Winter?',
  },
  {
    id: 'mppt',
    label: 'MPPT-Laderegler',
    parent: 'solar',
    path: '/camper-elektrik/mppt/',
    role: 'cluster',
    summary: 'Laderegler auslegen: Spannungsfenster, Kalt-Leerlaufspannung, Ströme und Sicherungen.',
  },
  {
    id: 'wechselrichter',
    label: 'Wechselrichter',
    parent: 'camper-elektrik',
    path: '/camper-elektrik/wechselrichter/',
    role: 'cluster',
    summary: '230 V aus 12 V: Wirkungsgrad, Leerlaufverbrauch, Kabel und Absicherung.',
  },
  {
    id: '230v',
    label: '230-V-Anlage',
    parent: 'camper-elektrik',
    path: '/camper-elektrik/230v/',
    role: 'cluster',
    summary: 'Landstrom im Fahrzeug: Einspeisung, FI-Schutz, Absicherung und Abnahme.',
  },
  {
    id: 'schaltplan',
    label: 'Schaltplan',
    parent: 'camper-elektrik',
    path: '/camper-elektrik/schaltplan/',
    role: 'cluster',
    summary: 'Vom Aufbau des Plans bis zur Stückliste — und wie daraus die Verdrahtung wird.',
  },
  {
    id: 'rechner',
    label: 'Rechner',
    path: '/rechner/',
    role: 'nebenbereich',
    summary: 'Alle Rechenwerkzeuge an einer Stelle: Kabel, Spannung, Batterie, Solar, Heizlast.',
  },
  {
    id: 'dachplanung',
    label: 'Dachplanung',
    path: '/tools/dach/',
    role: 'nebenbereich',
    summary: 'Solarpanels und Dachluken auf der Dachfläche platzieren und die Gesamtleistung ablesen.',
  },
  {
    id: 'heizlast',
    label: 'Heizlast',
    path: '/tools/heizung/',
    role: 'nebenbereich',
    summary: 'Nötige Heizleistung aus Fahrzeuggröße, Dämmung und Wunschtemperatur bestimmen.',
  },
  {
    id: 'ausbau',
    label: 'Ausbau',
    role: 'nebenbereich',
    summary: 'Reihenfolge, Gewerke und Wissen rund um den Ausbau des Fahrzeugs.',
  },
  {
    id: 'vertrauen',
    label: 'Über Werft',
    path: '/ueber-werft/',
    role: 'nebenbereich',
    summary: 'Wie Camp rechnet, worauf es sich stützt und wo die Grenzen des Modells liegen.',
  },
  {
    id: 'rechtliches',
    label: 'Rechtliches',
    role: 'nebenbereich',
    summary: 'Impressum und Datenschutz.',
  },
];

const BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]));

/** Thema zu seiner Kennung; unbekannte Kennungen sind ein Programmierfehler. */
export function topicOf(id: TopicId): Topic {
  const topic = BY_ID.get(id);
  if (!topic) throw new Error(`Unbekanntes Thema "${id}" — topics.ts ergänzen`);
  return topic;
}

/** Kennungen der direkten Kinder eines Themas in Deklarationsreihenfolge. */
export function childTopics(id: TopicId): Topic[] {
  return TOPICS.filter((topic) => topic.parent === id);
}

/**
 * Weg von der Wurzel bis zum Thema (einschließlich) — Grundlage der
 * Brotkrumenspur. Ein Zyklus wäre ein Programmierfehler und wirft.
 */
export function topicTrail(id: TopicId): Topic[] {
  const trail: Topic[] = [];
  const seen = new Set<TopicId>();
  let current: Topic = topicOf(id);
  while (true) {
    if (seen.has(current.id)) throw new Error(`Themenschleife bei "${current.id}"`);
    seen.add(current.id);
    trail.unshift(current);
    if (!current.parent) return trail;
    current = topicOf(current.parent);
  }
}
