/**
 * lib/vde-standards.ts
 *
 * ZENTRALE API für alle VDE-Normen, die im Elektroplanner verwendet werden.
 *
 * Die thermische Basis (Normreihe, Strombelastbarkeit, Sicherungsgrenzen,
 * Querschnittsberechnung) kommt unverändert aus `lib/electrical.ts` und wird
 * hier re-exportiert. Diese Datei ergänzt die Werte, die früher an mehreren
 * Stellen dupliziert waren:
 *   - Systemspannung und Kantenströme (getSystemVoltage, calculateEdgeCurrent)
 *   - Leerrohr/Kabelkanal (DIN EN 61386, 60%-Füllgrad)
 *   - Wechselrichter-/Solar-/Batterie-Kennwerte
 *
 * Aufgeräumt (Mission 4):
 * =======================
 * Die frühere zweite Validierungs-API (validateSchematic/validateCableEdge/
 * validateBatteryNode/…, calculateWire) sowie die drei parallelen
 * Sicherungstabellen (VDE_CURRENT_CAPACITY, VDE_STANDARD_FUSES,
 * VDE_CONSERVATIVE_FUSES) wurden entfernt — sie wurden von keinem
 * Produktionscode aufgerufen und widersprachen der aktiven Sicherungslogik
 * (selectFuseSize + FUSE_MAP aus electrical.ts). Die Live-Prüfung der App ist
 * `useLiveValidation` (components/planner/hooks/useLiveValidation.ts), die
 * Kabel-Fehleranzeige `collectEdgeErrors` (components/edges/CableEdge.tsx).
 *
 * Einheiten (seit K1b)
 * ====================
 * Alle rechnenden Funktionen dieses Moduls arbeiten mit den Branded Types aus
 * `lib/units.ts` (`Amps`, `Volts`, `Mm2`, `Meters`, `Watts`). Damit kann der
 * Compiler vertauschte Argumente ablehnen — `calculateEdgeCurrent(strom,
 * spannung)` kompiliert nicht.
 *
 * Werte aus `node.data` / `edge.data` (React Flow, localStorage) sind
 * `unknown`-nah und werden mit `quantityOr(...)` geprüft eingelesen.
 * Unbrauchbare Werte (negativ, NaN, Text) werden zu 0 bzw. zum
 * dokumentierten Ersatzwert — genau wie vorher `Number(x) || 0`, nur
 * jetzt an einer benannten Stelle.
 */

export {
  VDE_SIZES,
  VDE_SIZES as VDE_CROSS_SECTIONS,
  VDE_AMPACITY as VDE_AMPACITY_RAW,
  DERATE_FACTOR,
  FUSE_MAP as VDE_FUSE_MAP,
  calculateMaxFuse as calculateMaxFuseBase,
  lookupThermalCrossSection as lookupThermalCrossSectionBase,
  calculateCrossSection as calculateCrossSectionBase,
  calculateStrokeWidth,
  getEdgeDomain,
  getHandleDomain,
} from './electrical';
import { VDE_SIZES } from './electrical';

import type { Node, Edge } from 'reactflow';
import {
  addAmps,
  addWatts,
  amps,
  currentFromPower,
  divideAmps,
  maxAmps,
  maxWatts,
  parseQuantity,
  quantityOr,
  volts,
  watts,
  ZERO_AMPS,
  ZERO_WATTS,
  type Amps,
  type Mm2,
  type Scalar,
  type Volts,
  type Watts,
} from './units';

// Keep a typed local alias so consumers can write `VDECrossSection`.
// electrical.ts does not mark VDE_SIZES `as const`, so this is `number`.
export type VDECrossSection = typeof VDE_SIZES[number];

// ============================================================================
// LEERROHR / KABELKANAL (60% Maximum nach VDE 0100-520)
// ============================================================================

/**
 * Standard-Leerrohr-Innendurchmesser nach DIN EN 61386 (EN 20 – EN 50).
 * Werte in mm (Innendurchmesser).
 */
export const VDE_CONDUIT_INNER_DIAMETERS: Record<string, number> = {
  'EN 20': 16.9,
  'EN 25': 21.4,
  'EN 32': 28.1,
  'EN 40': 37.7,
  'EN 50': 47.2,
};

/** Maximal zulässiger Füllgrad eines Leerrohrs nach VDE 0100-520. */
export const VDE_MAX_CONDUIT_FILL_PERCENT = 60;

/**
 * Kabelaußendurchmesser pro Querschnitt in mm (gilt für FLYY/FLRY-Leitungen).
 * Wird für die Leerrohr-Füllgradberechnung benötigt.
 */
export const VDE_CABLE_OUTER_DIAMETERS: Record<number, number> = {
  1.5: 2.4,
  2.5: 3.0,
  4.0: 3.7,
  6.0: 4.3,
  10.0: 6.5,
  16.0: 8.3,
  25.0: 10.4,
  35.0: 11.6,
  50.0: 13.5,
  70.0: 15.5,
  95.0: 18.0,
  120.0: 20.0,
};

/**
 * Berechnet den Füllgrad eines Leerrohrs bei gegebenen Kabeln.
 *
 * @param conduitType Schlüssel aus VDE_CONDUIT_INNER_DIAMETERS (z.B. 'EN 20')
 * @param cableCrossSections Liste der Querschnitte der verlegten Kabel
 * @returns Füllgrad in Prozent (0–100+)
 */
export function calculateConduitFillPercent(
  conduitType: keyof typeof VDE_CONDUIT_INNER_DIAMETERS,
  cableCrossSections: readonly Mm2[]
): number {
  const innerDiameter = VDE_CONDUIT_INNER_DIAMETERS[conduitType];
  if (!innerDiameter) return 0;

  const innerArea = Math.PI * Math.pow(innerDiameter / 2, 2);

  const totalCableArea = cableCrossSections.reduce((acc, cs) => {
    const outerDiam = VDE_CABLE_OUTER_DIAMETERS[cs] ?? VDE_CABLE_OUTER_DIAMETERS[2.5];
    return acc + Math.PI * Math.pow(outerDiam / 2, 2);
  }, 0);

  return (totalCableArea / innerArea) * 100;
}

/**
 * Findet das kleinste Leerrohr, das die Kabel mit
 * <= VDE_MAX_CONDUIT_FILL_PERCENT aufnehmen kann.
 *
 * @returns Empfohlener Leerrohr-Typ oder null, wenn keiner passt
 */
export function recommendConduitType(cableCrossSections: readonly Mm2[]): string | null {
  for (const [type, diameter] of Object.entries(VDE_CONDUIT_INNER_DIAMETERS)) {
    const innerArea = Math.PI * Math.pow(diameter / 2, 2);
    const totalCableArea = cableCrossSections.reduce((acc, cs) => {
      const outerDiam = VDE_CABLE_OUTER_DIAMETERS[cs] ?? VDE_CABLE_OUTER_DIAMETERS[2.5];
      return acc + Math.PI * Math.pow(outerDiam / 2, 2);
    }, 0);
    if ((totalCableArea / innerArea) * 100 <= VDE_MAX_CONDUIT_FILL_PERCENT) {
      return type;
    }
  }
  return null;
}

// ============================================================================
// WECHSELRICHTER, SOLAR, BATTERIE
// ============================================================================

/**
 * Typischer Wirkungsgrad eines 12V→230V-Wechselrichters.
 * Hersteller-Angaben liegen meist bei 85–93%. 0.85 = 15% Verlust ist konservativ.
 */
export const VDE_INVERTER_EFFICIENCY: Scalar = 0.85;

/**
 * Winter-Ertragsfaktor für Solarmodule (ca. 35% des Sommerertrags).
 */
export const VDE_SOLAR_WINTER_REDUCTION = 0.35;

/**
 * Typische MPP-Spannung (Vmp) eines 12V-Solarmoduls in Volt.
 * Module liefern nicht bei Systemspannung, sondern bei ~18V.
 */
export const VDE_SOLAR_VMP_VOLTAGE: Volts = volts(18);

/**
 * Ladezeit-Derating (CC/CV-Knick, Wärme, Alterung). 1.15 = +15%.
 */
export const VDE_CHARGE_DERATING_FACTOR = 1.15;

/**
 * Maximal zulässige Entladungstiefe (Depth of Discharge, DoD)
 * je nach Batterie-Chemie.
 */
export const VDE_BATTERY_DOD: Record<string, number> = {
  LiFePO4: 0.9,
  AGM: 0.5,
  Gel: 0.5,
  Blei: 0.3,
};

// ============================================================================
// SYSTEMSPANNUNG & KANTENSTRÖME (EINZIGE QUELLE FÜR STROM-BERECHNUNGEN)
// ============================================================================

/**
 * Ermittelt die nominale Systemspannung anhand der Batterien im Plan.
 * Default 12.8V (typisch LiFePO4) ohne explizite Angabe.
 */
export const DEFAULT_SYSTEM_VOLTAGE: Volts = volts(12.8);
export const LEAD_SYSTEM_VOLTAGE: Volts = volts(12.0);

export function getSystemVoltage(nodes: Node[], preferredBatteryId?: string): Volts {
  const batteries = nodes.filter((n) => n.type === 'battery');
  if (batteries.length === 0) return DEFAULT_SYSTEM_VOLTAGE;

  // Die Aufbaubatterie (Auto-Wire) hat Vorrang; mit mehreren Batterien wäre
  // sonst die nominale Spannung einer irrelevanten/parallelgeschalteten
  // Batterie (z. B. einer 24-V-Zweitbatterie) Auslegungsgrundlage.
  const ordered = preferredBatteryId
    ? [
        ...batteries.filter((b) => b.id === preferredBatteryId),
        ...batteries.filter((b) => b.id !== preferredBatteryId),
      ]
    : batteries;

  // Explizite nominalVoltage an der Vorrangbatterie gewinnt.
  // `node.data` stammt aus localStorage/JSON — daher geprüft einlesen und
  // unbrauchbare Werte (0, negativ, Text) überspringen statt sie zu übernehmen.
  for (const b of ordered) {
    const nominalVoltage = parseQuantity((b.data as { nominalVoltage?: unknown })?.nominalVoltage, volts);
    if (nominalVoltage !== null && nominalVoltage > 0) {
      return nominalVoltage;
    }
  }

  // Fallback: chemiebasierte Schätzung der Vorrangbatterie
  const first = ordered[0];
  const chemistry = String((first.data as { chemistry?: string })?.chemistry || '').toLowerCase();
  if (chemistry === 'agm' || chemistry === 'lead' || chemistry === 'gel') {
    return LEAD_SYSTEM_VOLTAGE;
  }

  // Default für LiFePO4 und unbekannte Chemien
  return DEFAULT_SYSTEM_VOLTAGE;
}

/**
 * Berechnet den Nennstrom einer Kante aus den verbundenen Komponenten.
 *
 * DIESE Funktion ist die EINZIGE Strom-Quelle für Kabel-Dimensionierung und
 * Live-Validierung (CableEdge, calculatePathVoltageDrop, Auto-Wire). Dadurch
 * kann Auto-Wire exakt die Ströme dimensionieren, die die Validierung später
 * verwendet — Abweichungen (z.B. "Sicherung zu klein") sind damit
 * ausgeschlossen, solange die Komponentendaten unverändert bleiben.
 *
 * Prioritäten (physikalische Begründung):
 *   1. totalAmps — explizit gesetzter Gesamtstrom (z.B. Hauptleitungen)
 *   2. Solar-Kante: Panel-Strom (watts / Vmp). Die Zuleitung vom Panel zum
 *      Laderegler trägt den PANEL-Strom, nicht die Nennleistung des Reglers.
 *   3. 12V-Verbraucher: watts / Systemspannung
 *   4. Wechselrichter (DC-Seite): watts / Systemspannung / Wirkungsgrad
 *   5. Generische amps-Angabe (Laderegler, Booster, AC-Ladegeräte)
 *   6. Fallback: max(Last, Ladung) — Batterie-Hauptleitungen führen
 *      bidirektionalen Strom; Panel-Strom zählt nur ohne Laderegler
 */
export function calculateEdgeCurrent(
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  nodes: Node[],
  sysVoltage?: Volts
): Amps {
  const sData = sourceNode?.data as Record<string, unknown> | undefined;
  const tData = targetNode?.data as Record<string, unknown> | undefined;
  const voltage = sysVoltage ?? getSystemVoltage(nodes);

  /** Leistung aus `node.data` — negative/ungültige Angaben zählen als 0 W. */
  const loadOf = (data: Record<string, unknown> | undefined): Watts =>
    quantityOr(data?.watts, watts, ZERO_WATTS);
  /** Strom aus `node.data` — negative/ungültige Angaben zählen als 0 A. */
  const currentOf = (data: Record<string, unknown> | undefined): Amps =>
    quantityOr(data?.amps, amps, ZERO_AMPS);
  /** I = P / U mit der Systemspannung. */
  const currentAt = (load: Watts, at: Volts): Amps => currentFromPower(load, at);

  // 1. Expliziter Gesamtstrom (manuell gesetzt oder von Auto-Wire berechnet)
  const sourceTotal = parseQuantity(sData?.totalAmps, amps);
  if (sData?.totalAmps !== undefined) return sourceTotal ?? ZERO_AMPS;
  const targetTotal = parseQuantity(tData?.totalAmps, amps);
  if (tData?.totalAmps !== undefined) return targetTotal ?? ZERO_AMPS;

  const isSolarType = (type: string | undefined): boolean => type === 'solar' || type === 'roofSolar';

  // 2. Solar-Zuleitung: trägt den Panel-Strom, nicht die Regler-Nennleistung
  if (isSolarType(sourceNode?.type)) return currentAt(loadOf(sData), VDE_SOLAR_VMP_VOLTAGE);
  if (isSolarType(targetNode?.type)) return currentAt(loadOf(tData), VDE_SOLAR_VMP_VOLTAGE);

  // 3. 12V-Verbraucher
  if (sourceNode?.type === 'consumer') return currentAt(loadOf(sData), voltage);
  if (targetNode?.type === 'consumer') return currentAt(loadOf(tData), voltage);

  // 4. Wechselrichter (DC-Eingangsstrom inkl. Verlusten)
  // Die DC-Zuleitung trägt den tatsächlichen 230-V-Laststrom, nicht die
  // (oft nur Nenn-)Leistung des Inverters: max(Nennlast des WR,
  // Summe aller angeschlossenen 230-V-Verbraucher). `continuousPower` ist
  // die relevante Dauerleistung, `watts` nur der Fallback für alte Pläne.
  const acConsumerLoad = (): Watts => {
    let total: Watts = ZERO_WATTS;
    for (const n of nodes) {
      if (n.type === 'consumer230v') {
        total = addWatts(
          total,
          quantityOr((n.data as Record<string, unknown>)?.watts, watts, ZERO_WATTS)
        );
      }
    }
    return total;
  };
  const inverterLoad = (data: Record<string, unknown> | undefined): Watts => {
    const own = quantityOr(data?.continuousPower || data?.watts, watts, ZERO_WATTS);
    return maxWatts(own, acConsumerLoad());
  };
  if (sourceNode?.type === 'inverter') {
    return divideAmps(currentAt(inverterLoad(sData), voltage), VDE_INVERTER_EFFICIENCY);
  }
  if (targetNode?.type === 'inverter') {
    return divideAmps(currentAt(inverterLoad(tData), voltage), VDE_INVERTER_EFFICIENCY);
  }

  // 5. Generische Ampere-Angabe (Laderegler, Booster, AC-Ladegeräte)
  if (sData?.amps !== undefined && sourceNode?.type !== 'battery') return currentOf(sData);
  if (tData?.amps !== undefined && targetNode?.type !== 'battery') return currentOf(tData);

  // 6. Fallback: Systemaggregate über alle Komponenten
  // Batterie-Hauptleitungen führen bidirektionalen Strom → max(Last, Ladung).
  // Panel-Strom zählt nur, wenn kein Laderegler die Leistung bereits abbildet.
  let totalConsumerAmps: Amps = ZERO_AMPS;
  let totalChargerAmps: Amps = ZERO_AMPS;
  const hasMppt = nodes.some((n) => n.type === 'mpptController' || n.type === 'charger');
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const nData = n.data as Record<string, unknown> | undefined;
    if (n.type === 'consumer') {
      totalConsumerAmps = addAmps(totalConsumerAmps, currentAt(loadOf(nData), voltage));
    } else if (n.type === 'inverter') {
      totalConsumerAmps = addAmps(
        totalConsumerAmps,
        divideAmps(currentAt(loadOf(nData), voltage), VDE_INVERTER_EFFICIENCY)
      );
    } else if (['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(n.type as string)) {
      totalChargerAmps = addAmps(totalChargerAmps, currentOf(nData));
    } else if (isSolarType(n.type) && !hasMppt) {
      totalChargerAmps = addAmps(totalChargerAmps, currentAt(loadOf(nData), VDE_SOLAR_VMP_VOLTAGE));
    }
  }

  return maxAmps(totalConsumerAmps, totalChargerAmps);
}
