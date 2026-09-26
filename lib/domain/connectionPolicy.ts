/**
 * lib/domain/connectionPolicy.ts — Deny-by-default-Grundlage der
 * Verbindungsregeln (AUDIT V1).
 *
 * Warum diese Datei existiert
 * ===========================
 * `isConnectionAllowed` (lib/connectionRules.ts) war **fail-open**: Alles, was
 * keine der wenigen expliziten Negativregeln traf, galt als erlaubt. Fünf
 * messbare Folgen:
 *
 *   1. Dachfenster → Batterie                    ALLOWED
 *   2. unbekannter/fehlender Bauteiltyp → Batterie ALLOWED
 *   3. Verbraucher → Batterie (fremder Modus)     ALLOWED
 *   4. Batterie ‖ Batterie anderer Chemie         ALLOWED
 *   5. Self-Loop (Quelle = Ziel)                  ALLOWED
 *
 * Ein unbekannter Typ lieferte über `getHandleDomain(undefined, …)` konservativ
 * `DC_12V` — „konservativ" heißt hier: dieselbe Domäne wie fast alles andere,
 * also kein Blocker. Die Domänen-Trennung konnte nur greifen, wenn BEIDE
 * Endpunkte bekannt waren.
 *
 * Deny-by-default braucht eine Liste dessen, was der Planer kennt. Diese Liste
 * liegt hier und NICHT in `components/registry/builtinComponents.ts`: Nach
 * ARCH-001/ADR-0008 darf `lib/` nicht von `components/` abhängen (die Registry
 * sagt selbst: „Sie ersetzt keine Fachlogik"). Deshalb gilt dasselbe Muster wie
 * bei `lib/domain/handleDomains.ts` — die Tabelle gehört der Domäne, und ein
 * Test (`connectionPolicy.test.ts`) vergleicht sie gegen die Registry. Eine
 * dritte Kopie kann so nicht unbemerkt entstehen.
 */

import { SOLAR_NODE_TYPES } from './handleDomains';

/** Betriebsart, in der eine Verbindung gezogen wird. */
export type ConnectionMode = 'electric' | 'water';

/**
 * Elektrische Bauteiltypen — Spiegel von `components/registry` (alle Specs mit
 * `mode: 'electric'`) plus `roofSolar`. Das Dach-Solarmodul hat keinen
 * Component-Spec (es ist ein Fahrzeug-Dachelement, kein Katalog-Bauteil), ist
 * aber elektrisch vollwertig: Strings, Panel→MPPT, Solar-Dimensionierung.
 */
export const ELECTRIC_NODE_TYPES: readonly string[] = [
  'battery',
  'shunt',
  'busbar',
  'mpptController',
  'dcdcCharger',
  'acBatteryCharger',
  'solar',
  'charger',
  'inverter',
  'shorePower',
  'consumer',
  'consumer230v',
  'fuse',
  'ground',
  'conduit',
  ...SOLAR_NODE_TYPES.filter((type) => type !== 'solar'), // 'roofSolar'
];

/** Wasser-Bauteiltypen — Spiegel der Registry-Specs mit `mode: 'water'`. */
export const WATER_NODE_TYPES: readonly string[] = [
  'freshWaterTank',
  'grayWaterTank',
  'pump',
  'accumulator',
  'preFilter',
  'sink',
  'shower',
];

/**
 * Bekannte, aber bewusst NICHT verbindbare Typen: Dachelemente ohne
 * Anschluss. Ein Dachfenster hat keine elektrische Funktion — dass es
 *verbindbar war, ist Befund V1/1.
 */
export const NON_CONNECTABLE_NODE_TYPES: readonly string[] = ['roofWindow', 'roofBackground'];

/**
 * Polarität eines Handles — Rolle statt Namensvergleich (AUDIT V1).
 *
 * Vorher entschied `handleId.includes('plus')`: Ein Handle `plus-main`,
 * `plus2` oder `surplus` wäre als Plus-Pol gelesen worden, `minus` in
 * `minus-sensor` likewise. Die Handle-Ids der Bauteile sind in der Registry
 * deklariert und kurz (`plus`, `minus`, `ac_in`, `in`, `out`) — exakter
 * Vergleich ist damit streng UND korrekt. `null` = keine DC-Polarität
 * (AC-Anschluss, Wasser, Leerrohr): dort gilt die Polaritätsregel nicht.
 */
export type HandlePolarity = 'plus' | 'minus' | null;

export function handlePolarity(handleId: string | null | undefined): HandlePolarity {
  if (handleId === 'plus') return 'plus';
  if (handleId === 'minus') return 'minus';
  return null;
}

/**
 * Ist dieser Bauteiltyp im aktiven Modus überhaupt verbindbar?
 *
 * Drei Ablehnungsgründe, alle ausdrücklich: unbekannter Typ (Import-Tippfehler,
 * entferntes Bauteil), Typ ohne Anschlüsse (Dachelement) und Typ des falschen
 * Modus (Wasserbauteil im Stromplan).
 */
export function isConnectableNodeType(nodeType: string | undefined, mode: ConnectionMode): boolean {
  if (typeof nodeType !== 'string' || nodeType === '') return false;
  if (NON_CONNECTABLE_NODE_TYPES.includes(nodeType)) return false;
  return mode === 'water' ? WATER_NODE_TYPES.includes(nodeType) : ELECTRIC_NODE_TYPES.includes(nodeType);
}

/** Rolle einer Sammelschiene: Plus-, Minus-Schiene oder unbekannt. */
export type BusbarRole = 'positive' | 'negative' | 'unknown';

/**
 * Rolle einer Sammelschiene aus `data.role`, ersatzweise aus dem Label —
 * dieselbe Reihenfolge wie `looksLikePlusBusbar`/`looksLikeMinusBusbar` in
 * lib/autoWire/validation.ts (eine Logik, zwei Verbraucher).
 *
 * Warum das hier gebraucht wird: Plus-Schiene ↔ Minus-Schiene ist ein
 * direkter Kurzschluss über die Batterie. Die Polaritätsregel sieht ihn
 * NICHT, weil beide Schienen denselben Handle-Namen tragen können
 * (`plus` an der Plus-Schiene → `plus` an der Minus-Schiene): gleicher Name,
 * entgegengesetzte Rolle.
 */
export function busbarRoleOf(data: Record<string, unknown> | undefined): BusbarRole {
  const role = typeof data?.role === 'string' ? data.role : '';
  if (role === 'positive' || role === 'negative') return role;
  const label = typeof data?.label === 'string' ? data.label : '';
  if (/minus|negativ/i.test(label)) return 'negative';
  if (/plus|positiv/i.test(label)) return 'positive';
  return 'unknown';
}
