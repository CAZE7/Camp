/**
 * lib/seo/opportunities.ts — die Anfrage-Ebene.
 *
 * Jede Zeile ist eine Nutzerfrage („Query") mit der Suchintention, der Seite,
 * die sie bedienen soll, und der Lücke, die bleibt. Diese Liste ist die
 * Arbeitsgrundlage für neue Inhalte und wird regelmäßig gegen die echten
 * Suchdaten der Search Console gehalten (siehe docs/seo/SEARCH-CONSOLE.md).
 *
 * WICHTIG — Ehrlichkeit der Daten: Die hier hinterlegten Query-Formulierungen
 * sind MODELLANNAHMEN (Fachsprache, Branchenbegriffe, Support-Fragen), keine
 * Messwerte. Erst ein Eintrag mit `source: 'search-console'` ist belegt. Die
 * Prüfung verlangt deshalb, dass jede abgedeckte Query auf eine ausgelieferte
 * Seite zeigt — sie behauptet nicht, dass eine Query ein Suchvolumen hat.
 */

import type { PriorityTier } from './types';

/** Woher die Query stammt — Annahme oder echte Search-Console-Daten. */
export type OpportunitySource = 'annahme' | 'search-console';

/** Suchintention, nicht Keyword-Klasse (§5). */
export type IntentType = 'rechner' | 'ratgeber' | 'vergleich' | 'planung' | 'vertrauen';

/** Was mit der Query geschehen soll (§17). */
export type OpportunityAction =
  | 'keine'
  | 'neue-seite'
  | 'seite-erweitern'
  | 'seiten-zusammenlegen'
  | 'titel-verbessern'
  | 'verlinkung-verbessern'
  | 'rechner-bauen'
  | 'beispiel-ergaenzen';

/** Abdeckung einer Query durch die aktuelle Auslieferung. */
export type Coverage = 'abgedeckt' | 'teilweise' | 'luecke';

export type Opportunity = {
  id: string;
  /** Repräsentative Formulierung der Anfrage. */
  query: string;
  intent: IntentType;
  /** Zieldatei im Export; `null`, wenn es noch keine Seite gibt. */
  page: string | null;
  coverage: Coverage;
  /** Was fehlt — in einem Satz, konkret. */
  gap: string | null;
  priority: PriorityTier;
  action: OpportunityAction;
  source: OpportunitySource;
};

/**
 * Die Liste. Gruppiert nach Thema, sortiert nach Priorität — dieselbe
 * Reihenfolge, in der die Arbeit sinnvoll ist.
 */
export const OPPORTUNITIES: readonly Opportunity[] = [
  // ── Camper-Elektrik: die Mitte des Themas ────────────────────────────────
  {
    id: 'elektrik-planen',
    query: 'camper elektrik planen',
    intent: 'planung',
    page: '/camper-elektrik/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'schaltplan-camper',
    query: 'schaltplan camper 12v',
    intent: 'planung',
    page: '/camper-elektrik/schaltplan/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'elektroplaner',
    query: 'wohnmobil elektrik planer online',
    intent: 'planung',
    page: '/elektrik-planung/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },

  // ── Kabel und Absicherung ────────────────────────────────────────────────
  {
    id: 'kabelquerschnitt-berechnen',
    query: '12v kabelquerschnitt berechnen',
    intent: 'rechner',
    page: '/camper-elektrik/kabelquerschnitt/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'kabelquerschnitt-camper-welcher',
    query: 'welchen kabelquerschnitt camper',
    intent: 'ratgeber',
    page: '/camper-elektrik/kabelquerschnitt/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'spannungsabfall-12v',
    query: 'spannungsabfall 12v berechnen',
    intent: 'rechner',
    page: '/camper-elektrik/spannungsabfall/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'sicherung-camper',
    query: 'camper sicherung richtig dimensionieren',
    intent: 'ratgeber',
    page: '/camper-elektrik/sicherungen/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'sicherung-groesse-kabel',
    query: 'welche sicherung bei welchem kabelquerschnitt',
    intent: 'rechner',
    page: '/camper-elektrik/sicherungen/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },

  // ── Batterie ─────────────────────────────────────────────────────────────
  {
    id: 'batterie-dimensionieren',
    query: 'camper batterie dimensionieren',
    intent: 'planung',
    page: '/camper-elektrik/batterie/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'batteriekapazitaet-berechnen',
    query: 'batteriekapazität camper berechnen ah',
    intent: 'rechner',
    page: '/rechner/batteriekapazitaet/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'lifepo4-camper',
    query: 'lifepo4 camper dimensionieren',
    intent: 'ratgeber',
    page: '/camper-elektrik/lifepo4/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'agm-oder-lifepo4',
    query: 'agm oder lifepo4 camper',
    intent: 'vergleich',
    page: '/camper-elektrik/agm/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P1',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'agm-entladetiefe',
    query: 'agm batterie camper entladetiefe',
    intent: 'ratgeber',
    page: '/camper-elektrik/agm/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P1',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'peukert-camper',
    query: 'peukert effekt camper batterie',
    intent: 'ratgeber',
    page: '/camper-elektrik/batterie/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P2',
    action: 'keine',
    source: 'annahme',
  },

  // ── Solar ────────────────────────────────────────────────────────────────
  {
    id: 'solar-wie-viel-watt',
    query: 'camper solar wie viel watt',
    intent: 'rechner',
    page: '/rechner/solaranlage/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'solar-auslegen-winter',
    query: 'solar camper winter auslegung',
    intent: 'ratgeber',
    page: '/camper-elektrik/solar/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'mppt-auslegen',
    query: 'mppt laderegler camper auslegen',
    intent: 'ratgeber',
    page: '/camper-elektrik/mppt/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P1',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'mppt-oder-pwm',
    query: 'mppt oder pwm laderegler unterschied',
    intent: 'vergleich',
    page: '/camper-elektrik/mppt/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P1',
    action: 'keine',
    source: 'annahme',
  },

  // ── 230 V und Wandlung ───────────────────────────────────────────────────
  {
    id: 'wechselrichter-auslegen',
    query: 'wechselrichter camper auslegen kabel',
    intent: 'ratgeber',
    page: '/camper-elektrik/wechselrichter/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P1',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'wechselrichter-strom',
    query: 'wie viel strom zieht ein wechselrichter 12v',
    intent: 'rechner',
    page: '/camper-elektrik/wechselrichter/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P1',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: '230v-fi-schutz',
    query: '230v camper fi schutzschalter',
    intent: 'ratgeber',
    page: '/camper-elektrik/230v/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P1',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'landstrom-camper',
    query: 'landstrom anschluss camper cee',
    intent: 'ratgeber',
    page: '/camper-elektrik/230v/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P2',
    action: 'keine',
    source: 'annahme',
  },

  // ── Heizung, Dach, Ausbau ────────────────────────────────────────────────
  {
    id: 'heizlast-berechnen',
    query: 'heizlast wohnmobil berechnen',
    intent: 'rechner',
    page: '/tools/heizung/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P1',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'standheizung-groesse',
    query: 'welche standheizung für welches fahrzeug',
    intent: 'ratgeber',
    page: '/tools/heizung/',
    coverage: 'teilweise',
    gap: 'Der Rechner nennt die Leistung, aber die Seite erklärt nicht, wie die Wahl zwischen Diesel, Gas und Elektro abläuft.',
    priority: 'P2',
    action: 'seite-erweitern',
    source: 'annahme',
  },
  {
    id: 'dach-solar-belegen',
    query: 'wie viele solarpanels passen aufs dach',
    intent: 'planung',
    page: '/tools/dach/',
    coverage: 'teilweise',
    gap: 'Die Belegung ist interaktiv, aber es fehlen die Fahrzeugmaße und die Reihenfolge-Empfehlung als Text.',
    priority: 'P2',
    action: 'beispiel-ergaenzen',
    source: 'annahme',
  },
  {
    id: 'ausbau-reihenfolge',
    query: 'camper ausbau reihenfolge gewerke',
    intent: 'planung',
    page: '/guides/ausbau-fahrplan/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P2',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'ausbau-guide-elektrik',
    query: 'camper ausbau guide elektrik',
    intent: 'ratgeber',
    page: '/guides/camper-ausbauguide/',
    coverage: 'teilweise',
    gap: 'Der Guide erklärt Elektrik im Überblick, verlinkt aber noch nicht systematisch in das Elektrik-Cluster.',
    priority: 'P1',
    action: 'verlinkung-verbessern',
    source: 'annahme',
  },

  // ── Vertrauen ────────────────────────────────────────────────────────────
  {
    id: 'werft-methodik',
    query: 'wie genau rechnet der camper planer',
    intent: 'vertrauen',
    page: '/ueber-werft/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P1',
    action: 'keine',
    source: 'annahme',
  },

  // ── Offene Lücken (bewusst als Lücke geführt) ────────────────────────────
  {
    id: 'fahrzeug-spezifisch',
    query: 'elektrik vw t6 ausbau',
    intent: 'planung',
    page: null,
    coverage: 'luecke',
    gap: 'Fahrzeugspezifische Seiten fehlen. Sie lohnen erst mit echtem, fahrzeugspezifischem Inhalt (Maße, Anschlusspunkte, Besonderheiten) — sonst entstehen austauschbare Textseiten.',
    priority: 'P3',
    action: 'neue-seite',
    source: 'annahme',
  },
  {
    id: 'lichtmaschine-booster',
    query: 'ladebooster camper lichtmaschine dimensionieren',
    intent: 'ratgeber',
    page: null,
    coverage: 'luecke',
    gap: 'Ladebooster (DC-DC) ist im Modell nur als Ladequelle vorhanden; eine eigene Seite mit Auslegung fehlt.',
    priority: 'P2',
    action: 'neue-seite',
    source: 'annahme',
  },
  {
    id: 'wechselrichter-vergleich',
    query: 'sinus wechselrichter unterschied reiner sinus',
    intent: 'vergleich',
    page: '/camper-elektrik/wechselrichter/',
    coverage: 'teilweise',
    gap: 'Die Sinusfrage wird in einer FAQ beantwortet, aber nicht mit Beispielen belegt.',
    priority: 'P2',
    action: 'beispiel-ergaenzen',
    source: 'annahme',
  },
  {
    id: 'rechner-uebersicht',
    query: 'rechner camper ausbau',
    intent: 'rechner',
    page: '/rechner/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P1',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'spannungsabfall-rechner',
    query: 'spannungsabfall rechner 12v',
    intent: 'rechner',
    page: '/rechner/spannungsabfall-12v/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P0',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'start-ueberblick',
    query: 'camper ausbau planung online',
    intent: 'planung',
    page: '/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P2',
    action: 'keine',
    source: 'annahme',
  },
  {
    id: 'holzausbau',
    query: 'holzausbau camper unterbau',
    intent: 'ratgeber',
    page: '/guides/holzausbau/',
    coverage: 'abgedeckt',
    gap: null,
    priority: 'P3',
    action: 'keine',
    source: 'annahme',
  },
];

/** Queries zu einer Seite — Eingabe für das Inventar. */
export const queriesForPage = (path: string): readonly string[] =>
  OPPORTUNITIES.filter((entry) => entry.page === path).map((entry) => entry.query);

/** Alle Queries einer Prioritätsstufe. */
export const opportunitiesOfPriority = (priority: PriorityTier): readonly Opportunity[] =>
  OPPORTUNITIES.filter((entry) => entry.priority === priority);
