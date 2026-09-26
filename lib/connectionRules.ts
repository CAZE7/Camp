/**
 * lib/connectionRules.ts — reine Verbindungsregeln (AUDIT ARCH-002, V1).
 *
 * Die fachlichen Entscheidungen von `isValidConnection` (Domänen-Trennung
 * AC/DC, Polarität, Serien-Exception, Wasser-Sonderfälle, Duplikat-Verbot)
 * lebten im Store-Slice — nur über den Store testbar und unsichtbar für
 * Regel-Vergleiche gegen `collectEdgeErrors` (Konsistenz ungeschützt).
 * Hier sind sie eine reine Funktion; der Store (store/slices/graphSlice.ts)
 * delegiert 1:1.
 *
 * DENY-BY-DEFAULT (AUDIT V1)
 * ==========================
 * Bis zu dieser Fassung war die Funktion **fail-open**: erlaubt war alles, was
 * keine der expliziten Negativregeln traf. Messbare Folgen — alle fünf
 * Verbindungen wurden durchgewinkt:
 *
 *   Dachfenster → Batterie, unbekannter Typ → Batterie, Verbraucher → Batterie
 *   aus fremdem Modus, Batterie ‖ Batterie anderer Chemie, Self-Loop.
 *
 * Der Grund war strukturell: Ein unbekannter Knoten lieferte über
 * `getHandleDomain(undefined, …)` den Default `DC_12V` — „konservativ" heißt an
 * dieser Stelle „dieselbe Domäne wie fast alles andere", die Domänen-Trennung
 * konnte also nur greifen, wenn BEIDE Endpunkte bekannt waren. Die Reihenfolge
 * ist deshalb umgedreht: Zuerst werden die Existenzfragen beantwortet (zwei
 * verschiedene, bekannte, im aktiven Modus verbindbare Endpunkte), danach
 * folgen die fachlichen Negativregeln. Der Default ist NEIN.
 *
 * Die Typ- und Rollen-Tabellen liegen in `lib/domain/connectionPolicy.ts`
 * (Deny-by-default braucht eine Liste dessen, was der Planer kennt) und werden
 * dort gegen die Bauteil-Registry getestet — `lib/` darf nach ARCH-001 nicht
 * von `components/` abhängen.
 *
 * BEWUSST ERLAUBT (dokumentierte Modellgrenze, kein Versehen):
 * `consumer → battery` gleichpolig bleibt zulässig. Das Modell kennt auf
 * DC-Handles keine Quell-/Senken-Semantik: AutoWire erzeugt selbst
 * `Schiene → Verbraucher` (Plus) und `Verbraucher → Schiene` (Minus-Rückleiter),
 * und der Rückleiter eines Verbrauchers zur Batterie ist fachlich korrekt.
 * Ein Verbot bräuchte ein Rollenmodell je Bauteiltyp — das ist eine eigene
 * Entscheidung, keine Nebenwirkung dieser Härtung.
 */

import type { Edge, PlannerConnection } from './domain/graph';
import { getHandleDomain } from './electrical';
import {
  busbarRoleOf,
  handlePolarity,
  isConnectableNodeType,
  type ConnectionMode,
} from './domain/connectionPolicy';
import { chemistriesParallelSafe } from './autoWire/primitives';

/**
 * Schmale Node-Sicht — der Store reicht seine nodesMap-Werte durch.
 * `data` wird für Rollen-Entscheidungen gelesen (Sammelschiene Plus/Minus,
 * Batterie-Chemie), ist aber optional: Knoten ohne Daten sind keine
 * Sonderrolle, sondern fallen auf die dokumentierten Defaults.
 */
export type ConnectionNode = {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
};

export interface ConnectionRulesInput {
  connection: PlannerConnection;
  /** Knoten-Suche für Quelle/Ziel (aus beliebiger Map). */
  getNode: (id: string) => ConnectionNode | undefined;
  viewMode: ConnectionMode;
  /** Kanten des aktiven Modus (für Duplikat-Prüfung). */
  activeEdges: Pick<Edge, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>[];
}

/**
 * Darf diese Verbindung gezogen werden? Reine Funktion ohne Store-Zugriff.
 *
 * Reihenfolge: Existenzfragen (Deny-by-default) → Domäne → Fachregeln →
 * Duplikat. Jede Ablehnung ist ein `return false`; erlaubt wird erst am Ende.
 */
export function isConnectionAllowed(input: ConnectionRulesInput): boolean {
  const { connection, getNode, viewMode, activeEdges } = input;

  // ── 1. Existenzfragen: ohne zwei verschiedene bekannte Endpunkte geht nichts
  const sourceId = connection.source;
  const targetId = connection.target;
  if (!sourceId || !targetId) return false;
  // Self-Loop: topologisch sinnlos, ließ Spannungsfall-Rekursionen über eine
  // Null-Länge-Kante laufen. `onConnect` fing ihn ab — `isValidConnection`
  // nicht, jeder andere Aufrufer (Heilung, Programmcode) konnte ihn ziehen.
  if (sourceId === targetId) return false;

  const sourceNode = getNode(sourceId);
  const targetNode = getNode(targetId);
  // Unbekannter/fehlender Knoten: vorher lieferte die Domänen-Funktion für
  // `undefined` den Default DC_12V und die Verbindung galt als erlaubt.
  if (!sourceNode || !targetNode) return false;
  // Typ muss bekannt UND im aktiven Modus verbindbar sein (Dachfenster und
  // Dachhintergrund haben keine Anschlüsse; ein Wasserbauteil gehört nicht in
  // den Stromplan und umgekehrt).
  if (!isConnectableNodeType(sourceNode.type, viewMode)) return false;
  if (!isConnectableNodeType(targetNode.type, viewMode)) return false;

  if (viewMode === 'water') {
    if (sourceNode.type === 'grayWaterTank' && targetNode.type === 'sink') {
      return false;
    }
  } else {
    // ── 2. Strikte Domänen-Trennung
    const sourceDomain = getHandleDomain(sourceNode.type, connection.sourceHandle, 'source');
    const targetDomain = getHandleDomain(targetNode.type, connection.targetHandle, 'target');
    // 'Solar' ist seit AUDIT N2 eine eigene Domäne auf Handle-Ebene, aber kein
    // eigener Stromkreis: Die einzige zulässige Brücke ist Panel → Laderegler
    // (fachlich unten entschieden). Solar ↔ 230 V bleibt verboten.
    const solarToDcBridge =
      (sourceDomain === 'Solar' && targetDomain === 'DC_12V') ||
      (sourceDomain === 'DC_12V' && targetDomain === 'Solar');
    if (sourceDomain !== targetDomain && !solarToDcBridge) {
      return false; // Blocker!
    }

    // ── 3. Polarität über die Rollen-Tabelle, nicht über Handle-Namen
    // Vorher: `handleId.includes('plus')`. Damit war `surplus` ein Plus-Pol und
    // `in`/`plus` je nach Richtung einmal blockiert, einmal erlaubt.
    const sourcePolarity = handlePolarity(connection.sourceHandle);
    const targetPolarity = handlePolarity(connection.targetHandle);

    // Serien-Exception NUR für Solarmodule (Solar-Strings sind modelliert).
    // Batterie×Batterie plus↔minus wird bewusst NICHT erlaubt: Der Planer
    // hat kein 24-V-Serienmodell. Dieselbe Kante ist bei gemeinsamer Minus-
    // Schiene (AutoWire) ein direkter Kurzschluss des Batteriepakets —
    // AUDIT ELE-001.
    const isSolarType = (type?: string): boolean => type === 'solar' || type === 'roofSolar';
    const isSeriesException = isSolarType(sourceNode.type) && isSolarType(targetNode.type);

    // AC nutzt L/N/PE, nicht plus/minus — DC-Polarität nur im DC/Solar-Kreis.
    const isAcCircuit = sourceDomain === 'AC_230V' || targetDomain === 'AC_230V';
    if (!isAcCircuit && !isSeriesException && sourcePolarity !== targetPolarity) {
      return false; // Polaritäts-Mismatch: strikt blockiert
    }

    // Direkte Solar↔Batterie- und Solar↔Verbraucher-Verbindungen sind fachlich
    // falsch: Ein Solarmodul speist nie ohne Laderegler eine Batterie und nie
    // direkt ein 12-V-Gerät. Zulässig sind Solar↔Solar (Strings) und
    // Solar↔MPPT/Laderegler. AUDIT ELE-002.
    const sourceSolar = isSolarType(sourceNode.type);
    const targetSolar = isSolarType(targetNode.type);
    const solarPair = sourceSolar && targetSolar;
    const isSolarController = (type?: string): boolean => type === 'mpptController' || type === 'charger';
    if (
      (sourceSolar && !solarPair && !isSolarController(targetNode.type)) ||
      (targetSolar && !solarPair && !isSolarController(sourceNode.type))
    ) {
      return false;
    }

    // ── 4. Batterie ‖ Batterie: nur bei parallelsicherer Chemie (AUDIT AUTO-003)
    // AutoWire verweigert dieselbe Verbindung beim automatischen Verdrahten
    // (AGM ‖ Gel ‖ LiFePO4 ‖ Li-Ion vertragen sich nicht: Ladeschlussspannung,
    // Innenwiderstand, Spannungsfenster). Beim Ziehen war sie erlaubt — die
    // Live-Validierung meldete den Widerspruch erst, nachdem die Kante im Plan
    // stand. Gleiche Prüfung, gleiche Logik (`chemistriesParallelSafe`),
    // früherer Zeitpunkt.
    if (sourceNode.type === 'battery' && targetNode.type === 'battery') {
      if (!chemistriesParallelSafe(sourceNode, targetNode)) return false;
    }

    // ── 5. Plus-Schiene ↔ Minus-Schiene ist ein Kurzschluss über die Batterie
    // (AUDIT AW-RAIL-01). Die Polaritätsregel sieht ihn nicht, wenn beide
    // Schienen denselben Handle-Namen tragen (`plus` → `plus`): gleicher Name,
    // entgegengesetzte Rolle. Die Rolle steht in `data.role`, ersatzweise im
    // Label — dieselbe Logik wie `resolveRails` in lib/autoWire/routing.ts.
    if (sourceNode.type === 'busbar' && targetNode.type === 'busbar') {
      const sourceRole = busbarRoleOf(sourceNode.data);
      const targetRole = busbarRoleOf(targetNode.data);
      if (sourceRole !== 'unknown' && targetRole !== 'unknown' && sourceRole !== targetRole) {
        return false;
      }
    }
  }

  // ── 6. Bereits vorhandene identische Verbindung nicht still akzeptieren.
  const duplicate = activeEdges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.targetHandle === connection.targetHandle
  );
  if (duplicate) return false;

  // Bewusst KEINE generische Zyklusprüfung: Ein funktionierender Stromkreis
  // ist topologisch immer ein Zyklus (Plus-Leitung hin, Minus-Rückleitung
  // zurück). Die Prüfung blockierte den Rückleiter consumer− → battery−,
  // sobald die Plus-Leitung battery+ → consumer+ existierte. Der
  // Spannungsfall-Walk (cumulativeDropAt) ist gegen echte Zyklen abgesichert.

  return true;
}
