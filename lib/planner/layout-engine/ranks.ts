/**
 * lib/planner/layout-engine/ranks.ts
 *
 * Rollen-Rang eines Bauteils — die fachliche Schichtenfolge des Planers,
 * unabhängig von der UI:
 *
 * | Rang | Rolle                          | Beispiele                                   |
 * | ---- | ------------------------------ | ------------------------------------------- |
 * | 0    | Quellen                        | Solar, Landstrom, Frischwassertank          |
 * | 1    | Wandler                        | MPPT, Ladebooster, Ladegerät, Pumpe         |
 * | 2    | Speicher & Hauptverteilung     | Batterie, Shunt, Schienen, Sicherungskasten |
 * | 3    | Wechselrichter                 | Wechselrichter                              |
 * | 4    | Verbraucher & Masse            | 12-V-/230-V-Lasten, Ground                  |
 *
 * WARUM DAS HIER STEHT (Finding 2026-09-27, P1): Der Rang war bis dahin nur
 * eine Sortierhilfe des „Aufräumens" (`components/planner/utils/layout.ts`)
 * und erreichte ELK nie. „Plan ordnen" legte die Karten deshalb allein nach
 * Topologie und Kreuzungsminimum — fachlich richtig oft, aber ohne die
 * Rollenfolge als Nebenbedingung: Ein Wandler konnte neben der Batterie
 * landen, obwohl die Quelle davor gehört. Der Rang wird jetzt als
 * INTERACTIVE-Layering-Seed in ELK eingespeist (ADR 0024); `layers` dürfen
 * ihn nur noch in `lib/` definieren, damit UI-Sortierung und Layout dieselbe
 * Wahrheit benutzen (lib-Grenze, Rule K).
 */

/** Rang 0 — Quellen. */
const PRIMARY_SOURCE_TYPES = new Set(['solar', 'roofSolar', 'shorePower', 'freshWaterTank']);

/** Rang 1 — Wandler (Laden, Pumpen, Filter). */
const CHARGER_CONVERTER_TYPES = new Set([
  'mpptController',
  'dcdcCharger',
  'acBatteryCharger',
  'charger',
  'preFilter',
  'pump',
]);

/** Rang 2 — Speicher und Hauptverteilung. */
const CORE_DISTRIBUTION_TYPES = new Set(['battery', 'shunt', 'busbar', 'fuse', 'conduit', 'accumulator']);

/** Rang 3 — Wechselrichter (eigene Stufe vor den 230-V-Lasten). */
const INVERTER_TYPES = new Set(['inverter']);

/** Rang 4 — Verbraucher und Masse. */
const CONSUMER_TYPES = new Set(['consumer', 'consumer230v', 'sink', 'shower', 'grayWaterTank', 'ground']);

/** Anzahl der Rollen-Ränge (0…4). */
export const LAYOUT_RANK_COUNT = 5;

/** Standardrang: unbekannte Typen zählen zur Verteilung (wie bisher). */
export const LAYOUT_DEFAULT_RANK = 2;

/** Rollen-Rang eines Bauteiltyps; unbekannt ⇒ {@link LAYOUT_DEFAULT_RANK}. */
export function getLayoutRank(kind: string | null | undefined): number {
  if (!kind) return LAYOUT_DEFAULT_RANK;
  if (PRIMARY_SOURCE_TYPES.has(kind)) return 0;
  if (CHARGER_CONVERTER_TYPES.has(kind)) return 1;
  if (CORE_DISTRIBUTION_TYPES.has(kind)) return 2;
  if (INVERTER_TYPES.has(kind)) return 3;
  if (CONSUMER_TYPES.has(kind)) return 4;
  return LAYOUT_DEFAULT_RANK;
}
