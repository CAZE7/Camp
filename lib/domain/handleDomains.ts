/**
 * lib/domain/handleDomains.ts — EINE Domänen-Autorität für Handles (AUDIT ELE-007).
 *
 * Vorher beantworteten **zwei** Funktionen dieselbe Frage mit zwei Tabellen:
 *
 *   - `getHandleDomain` (Ziehen/`isValidConnection`) prüfte rollenblind:
 *     alles in `AC_HANDLES = ['plus','ac_out','L','ac','output','ac_in']`
 *     galt als 230 V — auch `ac_in`, obwohl das ein *Ziel*-Handle ist.
 *   - `getEdgeDomain` (Speichern/Sizing/Anzeige) prüfte rollenbewusst:
 *     `AC_SOURCE_HANDLES = ['plus','ac_out','L','ac','output']`,
 *     `AC_TARGET_HANDLES = ['ac_in']`.
 *
 * Damit war `getHandleDomain('inverter','ac_in','source') = AC_230V`, während
 * `getEdgeDomain('inverter', 'battery', 'ac_in', …) = DC_12V` ergab: beim
 * Ziehen galt eine Domäne, nach dem Speichern eine andere. Dazu kam eine
 * dritte Kopie der Zuordnung als statisches `domain`-Feld in
 * `components/registry/builtinComponents.ts`.
 *
 * Diese Datei ist die eine Quelle. `lib/electrical.ts` re-exportiert die
 * Funktionen unverändert (`getEdgeDomain`/`getHandleDomain`), die Registry
 * wird dagegen getestet (`lib/domain/handleDomains.test.ts` vergleicht jedes
 * deklarierte Handle der Bauteil-Registry gegen `handleDomain`) — eine
 * vierte Kopie kann so nicht mehr unbemerkt entstehen.
 *
 * Domänenlogik:
 *  - Solar-Knoten (`solar`, `roofSolar`) ⇒ 'Solar' (nicht hier, sondern in
 *    `getEdgeDomain`, weil es eine Kanten-, keine Handle-Eigenschaft ist).
 *  - `shorePower`/`consumer230v` ⇒ AC_230V an jedem Handle.
 *  - Wechselrichter: linke Seite (Ziel-Handles `plus`/`minus`) = 12-V-DC,
 *    rechte Seite (Quell-Handles `plus`/`ac_out`/`L`/`ac`/`output`) = 230 V,
 *    das Netz-Ziel `ac_in` = 230 V.
 *  - `acBatteryCharger` ist bewusst gemischt: nur das `plus`-**Ziel** ist
 *    Landstrom (AC), der Ladeausgang (`plus`/`minus` als Quelle) ist DC.
 *    Eine Pauschale entzog die DC-Ausgangsleitung der DC-Dimensionierung
 *    (AUDIT-AUTOWIRE Issue 4).
 */

export type HandleDomainValue = 'DC_12V' | 'AC_230V';

export type HandleType = 'source' | 'target';

/** 230-V-Knoten: jedes Handle ist AC. */
export const AC_NODE_TYPES: readonly string[] = ['shorePower', 'consumer230v'];

/** Solar-Knoten: Domäne 'Solar' (eigene Kategorie, s. getEdgeDomain). */
export const SOLAR_NODE_TYPES: readonly string[] = ['solar', 'roofSolar'];

/** Wechselrichter-Zielhandles der Batterieseite (12 V). */
export const INVERTER_DC_TARGET_HANDLES: readonly string[] = ['plus', 'minus'];

/** Wechselrichter-Quellhandles der 230-V-Seite. */
export const INVERTER_AC_SOURCE_HANDLES: readonly string[] = ['plus', 'ac_out', 'L', 'ac', 'output'];

/** Wechselrichter-Zielhandle der 230-V-Netzseite (Landstrom-Eingang). */
export const INVERTER_AC_TARGET_HANDLES: readonly string[] = ['ac_in'];

/** AC-Zielhandles des Mischdomänen-Ladegeräts (Landstrom). */
export const AC_BATTERY_CHARGER_AC_TARGET_HANDLES: readonly string[] = ['plus'];

const isIn = (list: readonly string[], value: string | null | undefined): boolean =>
  typeof value === 'string' && list.includes(value);

/**
 * Domäne **eines Handles** einer Komponente — die Funktion, die beim Ziehen
 * (`isValidConnection`) und beim Anlegen der Kante gelten muss.
 *
 * Unbekannte Knoten/Handles sind DC_12V (konservativ: DC-Regeln sind die
 * strengeren, was Querschnitt und Sicherung angeht).
 */
export function handleDomain(
  nodeType: string | undefined,
  handleId: string | null | undefined,
  handleType: HandleType | undefined
): HandleDomainValue {
  if (!nodeType) return 'DC_12V';
  if (AC_NODE_TYPES.includes(nodeType)) return 'AC_230V';

  if (nodeType === 'acBatteryCharger') {
    // Nur die Landstrom-Zuführung ist AC; alles andere (Ladeausgang) ist DC.
    return handleType === 'target' && isIn(AC_BATTERY_CHARGER_AC_TARGET_HANDLES, handleId)
      ? 'AC_230V'
      : 'DC_12V';
  }

  if (nodeType === 'inverter') {
    if (handleType === 'target') {
      return isIn(INVERTER_AC_TARGET_HANDLES, handleId) ? 'AC_230V' : 'DC_12V';
    }
    return isIn(INVERTER_AC_SOURCE_HANDLES, handleId) ? 'AC_230V' : 'DC_12V';
  }

  return 'DC_12V';
}

/**
 * Domäne **einer Kante** aus beiden Endpunkten — dieselbe Tabelle, nur
 * richtungsbewusst auf Quell- und Zielseite angewandt.
 */
export function edgeDomainOf(
  sourceNodeType: string | undefined,
  targetNodeType: string | undefined,
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined
): HandleDomainValue {
  if (handleDomain(sourceNodeType, sourceHandle, 'source') === 'AC_230V') return 'AC_230V';
  if (handleDomain(targetNodeType, targetHandle, 'target') === 'AC_230V') return 'AC_230V';
  return 'DC_12V';
}
