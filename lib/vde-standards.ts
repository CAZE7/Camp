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

// Lokales Binding: der Re-Export oben bindet nichts in diesen Scope.
import { getEdgeDomain } from './electrical';

import type { Node, Edge } from './domain/graph'; // ARCH-001: Domäne statt React-Flow-Typen
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

/**
 * Maximal zulässiger Füllgrad eines Leerrohrs.
 *
 * AUDIT NORM-001: Der frühere Wert 60 % war mit „VDE 0100-520" beziffert,
 * aber in keiner auffindbaren Quelle belegt. Üblich und belegt ist max. 40 %
 * der Rohrquerschnittsfläche im DIN-VDE-0100-520-Kontext (bzw. nach
 * DIN 18015-1 max. ⅓ bei Einzeladern / ½ bei Mantelleitungen). Konservativ
 * auf 40 % korrigiert — ein zu klein empfohlenes Rohr ist ein Wärme- und
 * Zugentlastungsproblem, ein größer gewähltes unkritisch.
 */
export const VDE_MAX_CONDUIT_FILL_PERCENT = 40;

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

// Fallback-Invariante einmal beweisen statt überall kaschieren: Die
// Leerrohr-Rechnung fällt für unbekannte Querschnitte auf 2,5 mm² zurück —
// ein Tabellenstand ohne diesen Eintrag wäre ein Laufzeit-Alarmsignal.
const VDE_FALLBACK_CABLE_OUTER_DIAMETER: number = (() => {
  const d = VDE_CABLE_OUTER_DIAMETERS[2.5];
  if (d === undefined) {
    throw new Error('VDE_CABLE_OUTER_DIAMETERS ohne 2.5-Eintrag — Leerrohr-Fallback ungültig');
  }
  return d;
})();

/** Kabelaußendurchmesser in mm; unbekannte Querschnitte fallen auf 2,5 mm² zurück. */
export function cableOuterDiameter(cs: Mm2): number {
  return VDE_CABLE_OUTER_DIAMETERS[cs] ?? VDE_FALLBACK_CABLE_OUTER_DIAMETER;
}

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
    return acc + Math.PI * Math.pow(cableOuterDiameter(cs) / 2, 2);
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
      return acc + Math.PI * Math.pow(cableOuterDiameter(cs) / 2, 2);
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

// Referenz-Chemie (LiFePO4) einmal beweisen — die nutzbare-Kapazität-Rechnung
// fällt für unbekannte Chemie-Strings darauf zurück (noUncheckedIndexedAccess).
export const VDE_DOD_REFERENCE: number = (() => {
  const reference = VDE_BATTERY_DOD.LiFePO4;
  if (reference === undefined) throw new Error('VDE_BATTERY_DOD ohne LiFePO4-Eintrag — Referenz ungültig');
  return reference;
})();

// ============================================================================
// SYSTEMSPANNUNG & KANTENSTRÖME (EINZIGE QUELLE FÜR STROM-BERECHNUNGEN)
// ============================================================================

/**
 * Startbatterie / Starterbatterie / Starter battery — nicht die Aufbaubatterie.
 *
 * Lebt hier (statt in lib/autoWire.ts), damit getSystemVoltage dieselbe
 * Label-Priorität wie pickHouseBattery verwenden kann, ohne dass
 * lib/vde-standards.ts von lib/autoWire.ts abhängt (Zirkularität).
 * lib/autoWire.ts re-exportiert die Funktion unverändert.
 */
export const isStarterBatteryLabel = (label: unknown): boolean => /start/i.test(String(label || ''));

/**
 * AUDIT AUTO-003: Starter-Klassifikation mit explizitem role-Feld vor der
 * Label-Heuristik (dieselbe Priorität wie isStarterBattery in
 * lib/autoWire/validation.ts — zwei Wahrheiten vermeiden).
 */
export const isStarterBatteryNode = (node: Node): boolean => {
  const role = (node.data as Record<string, unknown> | undefined)?.role;
  if (role === 'starter') return true;
  if (role === 'house') return false;
  return isStarterBatteryLabel((node.data as { label?: unknown })?.label);
};

/**
 * Nominale Netzspannung des 230-V-Kreises (DIN VDE 0100-721).
 */
export const AC_SYSTEM_VOLTAGE: Volts = volts(230);

/**
 * AUDIT ELE-005: Faktor zwischen Nenn- und Entladeschlussspannung.
 *
 * Dimensionierungsströme dürfen nicht mit der NOMINALspannung gerechnet
 * werden: am Entladeende einer LiFePO4-Zelle (3,0 V statt 3,2 V) liefert
 * dieselbe Leistung bis zu 6,7 % mehr Strom (12,8 V → 12,0 V). Alle
 * leistungsabhängigen DC-Ströme (Verbraucher, Wechselrichter-Eingang)
 * werden daher mit dieser floor-Spannung gerechnet — konservativ und
 * ehrlich, statt nominal und systematisch zu niedrig.
 *
 * Bewusste Modellannahme (keine Normkopie): 3,0 V/Zelle LiFePO4. Für
 * Blei (LEAD_SYSTEM_VOLTAGE 12,0 V nominal) ergibt der Faktor 11,25 V —
 * auch das liegt auf der sicheren Seite. Wer eine andere Zellchemie
 * annimmt, muss diesen Faktor anpassen.
 */
export const VDE_DISCHARGE_VOLTAGE_FACTOR = 0.9375; // 12,8 V → 12,0 V

/** AUDIT ELE-005: Entladeschlussspannung (Strom-Maximum) zur Nennspannung. */
export const dischargeFloorVoltage = (nominal: Volts): Volts => volts(nominal * VDE_DISCHARGE_VOLTAGE_FACTOR);

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
    : [
        // Ohne explizite Vorwahl gilt die Aufbaubatterie als Auslegungs-
        // grundlage — exakt dieselbe Priorität wie pickHouseBattery in
        // lib/autoWire.ts. Vorher entschied die Node-Reihenfolge: stand eine
        // 24-V-Starterbatterie vor der 12-V-Aufbaubatterie, wurden ALLE
        // DC-Berechnungen (Anzeige, Live-Validierung, Spannungsfall) mit der
        // falschen Spannung geführt.
        ...batteries.filter((b) => !isStarterBatteryNode(b)),
        ...batteries.filter((b) => isStarterBatteryNode(b)),
      ];

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
  if (!first) return DEFAULT_SYSTEM_VOLTAGE;
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
 *   3. 12V-Verbraucher: watts / Entladeschlussspannung (ELE-005)
 *   4. Wechselrichter (DC-Seite): Insel-230V-Last bzw. Dauerleistung,
 *      geteilt durch Entladeschlussspannung × Wirkungsgrad (ELE-005)
 *   5. Generische amps-Angabe (Laderegler, Booster, AC-Ladegeräte)
 *   6. Fallback: max(Last, Ladung) — Batterie-Hauptleitungen führen
 *      bidirektionalen Strom; Panel-Strom zählt nur ohne Laderegler
 */
export function calculateEdgeCurrent(
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  nodes: Node[],
  sysVoltage?: Volts,
  edges?: Edge[]
): Amps {
  const sData = sourceNode?.data as Record<string, unknown> | undefined;
  const tData = targetNode?.data as Record<string, unknown> | undefined;
  const voltage = sysVoltage ?? getSystemVoltage(nodes);

  /** AUDIT ELE-005: Ströme aus Leistung mit der Entladeschlussspannung
   *  rechnen — am leeren Akku ist der Strom am höchsten, und genau den
   *  muss Leitung und Sicherung aushalten. */
  const floor = dischargeFloorVoltage(voltage);
  /** Leistung aus `node.data` — negative/ungültige Angaben zählen als 0 W. */
  const loadOf = (data: Record<string, unknown> | undefined): Watts =>
    quantityOr(data?.watts, watts, ZERO_WATTS);
  /** Strom aus `node.data` — negative/ungültige Angaben zählen als 0 A. */
  const currentOf = (data: Record<string, unknown> | undefined): Amps =>
    quantityOr(data?.amps, amps, ZERO_AMPS);
  /** I = P / U mit der Entladeschlussspannung (ELE-005). */
  const currentAt = (load: Watts, at: Volts = floor): Amps => currentFromPower(load, at);

  // 1. Expliziter Gesamtstrom (manuell gesetzt oder von Auto-Wire berechnet).
  //    Ein vorhanden, aber unparsebarer Wert (Altbestand/Import) wird nicht
  //    als 0 A interpretiert — 0 A würde Spannungsfall und Sicherungsprüfung
  //    stillschweigend entscharfen. Ohne vertrauenswürdigen Wert fällt die
  //    Berechnung auf die physikalische Herleitung (P/U bzw. A) zurück.
  const sourceTotal = parseQuantity(sData?.totalAmps, amps);
  if (sourceTotal !== null) return sourceTotal;
  const targetTotal = parseQuantity(tData?.totalAmps, amps);
  if (targetTotal !== null) return targetTotal;

  const isSolarType = (type: string | undefined): boolean => type === 'solar' || type === 'roofSolar';

  // 2. Solar-Zuleitung: trägt den Panel-Strom, nicht die Regler-Nennleistung
  if (isSolarType(sourceNode?.type)) return currentAt(loadOf(sData), VDE_SOLAR_VMP_VOLTAGE);
  if (isSolarType(targetNode?.type)) return currentAt(loadOf(tData), VDE_SOLAR_VMP_VOLTAGE);

  // 3. 12V-Verbraucher (ELE-005: P / Entladeschlussspannung)
  if (sourceNode?.type === 'consumer') return currentAt(loadOf(sData));
  if (targetNode?.type === 'consumer') return currentAt(loadOf(tData));

  // 4. Wechselrichter (DC-Eingangsstrom inkl. Verlusten)
  // Die DC-Zuleitung trägt den tatsächlichen 230-V-Laststrom, nicht die
  // (oft nur Nenn-)Leistung des Inverters: max(Nennlast des WR,
  // 230-V-Verbraucher DIESSES Wechselrichters). `continuousPower` ist
  // die relevante Dauerleistung, `watts` nur der Fallback für alte Pläne.
  //
  // AUDIT ELE-005: Vorher wurde die Summe ALLER consumer230v im GESAMTEN
  // Plan verwendet — unabhängig von der Konnektivität. Ein 500-W-WR neben
  // einem (unverbundenen oder fremden) 1500-W-Verbraucher wurde auf
  // 137,9 A statt 46 A dimensioniert. Mit übergebener Kantenliste wird
  // die 230-V-Insel des Wechselrichters per BFS ermittelt; ohne Kanten
  // (Legacy-Anzeigepfade) bleibt die globale Summe als konservativer
  // Over-Schätzer — nie zu niedrig, aber dokumentiert ungenau.
  const acConsumerLoad = (inverter: Node | undefined): Watts => {
    if (!inverter || !edges || edges.length === 0) {
      // Globaler Fallback (konservativ: Insel-Summe ≤ globale Summe).
      let total: Watts = ZERO_WATTS;
      for (const n of nodes) {
        if (n.type === 'consumer230v') {
          total = addWatts(total, quantityOr((n.data as Record<string, unknown>)?.watts, watts, ZERO_WATTS));
        }
      }
      return total;
    }
    // BFS über AC-Kanten ab dem Wechselrichter: nur elektrisch
    // verbundene 230-V-Verbraucher zählen zu SEINER Last.
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const visited = new Set<string>([inverter.id]);
    const queue: string[] = [inverter.id];
    let total: Watts = ZERO_WATTS;
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const edge of edges) {
        if (edge.source !== currentId && edge.target !== currentId) continue;
        const domain =
          (edge.data as { edgeDomain?: 'DC_12V' | 'AC_230V' | 'Solar' } | undefined)?.edgeDomain ??
          getEdgeDomain(
            nodeById.get(edge.source)?.type,
            nodeById.get(edge.target)?.type,
            edge.sourceHandle,
            edge.targetHandle
          );
        if (domain !== 'AC_230V') continue;
        const otherId = edge.source === currentId ? edge.target : edge.source;
        if (visited.has(otherId)) continue;
        visited.add(otherId);
        const other = nodeById.get(otherId);
        if (other?.type === 'consumer230v') {
          total = addWatts(
            total,
            quantityOr((other.data as Record<string, unknown>)?.watts, watts, ZERO_WATTS)
          );
        }
        queue.push(otherId);
      }
    }
    return total;
  };
  const inverterLoad = (data: Record<string, unknown> | undefined, owner: Node | undefined): Watts => {
    const own = quantityOr(data?.continuousPower || data?.watts, watts, ZERO_WATTS);
    return maxWatts(own, acConsumerLoad(owner));
  };
  if (sourceNode?.type === 'inverter') {
    return divideAmps(currentAt(inverterLoad(sData, sourceNode)), VDE_INVERTER_EFFICIENCY);
  }
  if (targetNode?.type === 'inverter') {
    return divideAmps(currentAt(inverterLoad(tData, targetNode)), VDE_INVERTER_EFFICIENCY);
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
  for (const n of nodes) {
    const nData = n.data as Record<string, unknown> | undefined;
    if (n.type === 'consumer') {
      totalConsumerAmps = addAmps(totalConsumerAmps, currentAt(loadOf(nData)));
    } else if (n.type === 'inverter') {
      // Derselbe Lastansatz wie im Direktpfad (Priorität 4): max(Nennlast des
      // Wechselrichters, 230-V-Last SEINER Insel) — `continuousPower` ist die
      // relevante Dauerleistung, `watts` nur der Fallback für alte Pläne.
      // ELE-005: Mit Kantenliste wird die Insel per BFS ermittelt; ohne
      // bleibt die globale Summe pro WR konservativ (nie zu niedrig).
      totalConsumerAmps = addAmps(
        totalConsumerAmps,
        divideAmps(currentAt(inverterLoad(nData, n)), VDE_INVERTER_EFFICIENCY)
      );
    } else if (['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(n.type as string)) {
      totalChargerAmps = addAmps(totalChargerAmps, currentOf(nData));
    } else if (isSolarType(n.type) && !hasMppt) {
      totalChargerAmps = addAmps(totalChargerAmps, currentAt(loadOf(nData), VDE_SOLAR_VMP_VOLTAGE));
    }
  }

  return maxAmps(totalConsumerAmps, totalChargerAmps);
}

/**
 * Nennstrom einer 230-V-Kante in Ampere.
 *
 * Die AC-Seite wird nicht über die Batterie-Systemspannung dimensioniert,
 * sondern über die 230-V-Verbraucher (consumer230v) *hinter der Quelle der
 * Kante*: Landstrom (shorePower) bzw. Wechselrichter-AC-Ausgang. Dazu wird
 * der Graph entlang der AC-Kanten ab der Quell-Node ungerichtet durchlaufen
 * (BFS) — ungerichtet, damit auch umgekehrt gezeichnete Kanten (Verbraucher
 * → Quelle) den Kreis korrekt finden. Eine Abzweigleitung trägt damit nur
 * ihre eigene Last, nicht pauschal den Gesamtplan. Ohne erreichbare 230-V-
 * Last ergibt sich 0 A (Mindestquerschnitt 1,5 mm² bleibt bestehen).
 *
 * Eine Kante gilt als AC, wenn ihre gespeicherte Domäne AC ist oder die
 * Topologie (getEdgeDomain) sie als AC ausweist — exakt die Zuordnung, die
 * auch Anzeige und Validierung verwenden.
 */
export function calculateAcEdgeCurrent(sourceId: string | undefined, nodes: Node[], edges: Edge[]): Amps {
  const nodeMap = new Map<string, Node>();
  for (const node of nodes) {
    if (node) nodeMap.set(node.id, node);
  }

  // Domäne liegt typoffen im Datenfeld (CableEdgeData o. ä.) — geprüft lesen.
  const domainOf = (edge: Edge): unknown => (edge.data as Record<string, unknown> | undefined)?.edgeDomain;
  const isAcEdge = (edge: Edge): boolean => {
    if (domainOf(edge) === 'AC_230V') return true;
    if (domainOf(edge) === 'DC_12V') return false;
    const s = nodeMap.get(edge.source)?.type;
    const t = nodeMap.get(edge.target)?.type;
    return getEdgeDomain(s, t, edge.sourceHandle, edge.targetHandle) === 'AC_230V';
  };

  // Ungerichtete Adjazenz über AC-Kanten.
  const acAdjacency = new Map<string, string[]>();
  const addLink = (from: string, to: string): void => {
    const list = acAdjacency.get(from) ?? [];
    list.push(to);
    acAdjacency.set(from, list);
  };
  for (const edge of edges) {
    if (!isAcEdge(edge)) continue;
    addLink(edge.source, edge.target);
    addLink(edge.target, edge.source);
  }

  const visited = new Set<string>();
  const queue: string[] = sourceId ? [sourceId] : [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of acAdjacency.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  let total: Watts = ZERO_WATTS;
  visited.forEach((id) => {
    const node = nodeMap.get(id);
    if (node?.type === 'consumer230v') {
      total = addWatts(total, quantityOr((node.data as Record<string, unknown>)?.watts, watts, ZERO_WATTS));
    }
  });
  if (total > ZERO_WATTS) {
    return currentFromPower(total, AC_SYSTEM_VOLTAGE);
  }

  // AUDIT ELE-006: Kein 230-V-Verbraucher in der AC-Insel heißt NICHT
  // „kein Strom". Eine Landstrom-Zuleitung zu einem AC-Ladegerät trägt
  // dessen Ladestrom, eine Dosenleitung mindestens den Anschlusswert —
  // vorher standen solche Kanten bei 0 A (keine Animation, Spannungsfall
  // 0 %), während die AutoWire-Dimensionierung (acCurrentA) korrekt
  // dimensionierte. Semantik dieser Funktion bleibt „tatsächlicher Strom
  // auf der Leitung"; die Capability-Sicht (Nennlast Wechselrichter) macht
  // weiterhin ausschließlich die Dimensionierung.
  let connectionCurrent: Amps = ZERO_AMPS;
  visited.forEach((id) => {
    const node = nodeMap.get(id);
    if (!node) return;
    if (node.type === 'acBatteryCharger') {
      connectionCurrent = maxAmps(
        connectionCurrent,
        quantityOr((node.data as Record<string, unknown>)?.amps, amps, ZERO_AMPS)
      );
    }
    if (node.type === 'shorePower') {
      const raw = Number((node.data as Record<string, unknown>)?.rating);
      if (Number.isFinite(raw) && raw > 0) {
        connectionCurrent = maxAmps(connectionCurrent, amps(raw));
      }
    }
  });
  return connectionCurrent;
}
