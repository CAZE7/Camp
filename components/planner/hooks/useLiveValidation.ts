import { useMemo } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../../edges/CableEdge';
import { getEdgeDomain } from '../../../lib/electrical';
import { SOLAR_DESIGN_MIN_TEMPERATURE_C, stringColdVocOf } from '../../../lib/solar'; // ELE-007
import { chemistriesParallelSafe } from '../../../lib/autoWire/primitives'; // AUTO-003
import {
  FUSE_BREAKING_CAPACITY_A,
  bankShortCircuitCurrentA,
  breakingCapacityAOf,
  shortCircuitAtFuseA,
} from '../../../lib/shortCircuit'; // DOM-002
import {
  UPSTREAM_IMPEDANCE_ASSUMPTION_OHM,
  acSourceKindOf,
  evaluateAcEdgeProtection,
} from '../../../lib/acProtection'; // DOM-001

import { getSystemVoltage } from '../utils/voltage';
import { calculateEdgeCurrent } from '../../../lib/vde-standards';

export interface ValidationWarning {
  id: string;
  category: 'safety' | 'topology' | 'monitoring' | 'estimation';
  type: 'critical' | 'warning' | 'info';
  message: string;
  /** Kurzer, laienverständlicher Titel für die Warn-Zentrale. */
  title?: string;
  /** ID der betroffenen Komponente/Leitung, die "Beheben" im Plan fokussiert. */
  focusId?: string;
  /** Ob focusId eine Node oder eine Kante (Leitung) ist. */
  focusType?: 'node' | 'edge';
  /**
   * Strukturierte Messwerte (AUDIT UX-001): Gemessener Ist-Wert der Regel,
   * erwarteter Grenzwert und Einheit — statt nur Prosa im message-String.
   * `ruleId` benennt die Regel maschinenlesbar, `source` die fachliche
   * Grundlage (Modellannahme oder Norm-Kontext).
   */
  ruleId?: string;
  measuredValue?: string;
  expectedValue?: string;
  unit?: string;
  source?: string;
}

/** Reihenfolge der Schwere für die Sortierung in der Warn-Zentrale. */
export const SEVERITY_ORDER: Record<ValidationWarning['type'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Reine Plan-Validierung (ohne Hook-Bindung) — erzeugt die Liste der
 * `ValidationWarning`s für einen Knoten-/Kantenstand. Die Live-Validierung
 * (`useLiveValidation`) ist nur noch ein `useMemo`-Wrapper darüber; auch die
 * Kabelliste (Status-Spalte) und Tests nutzen die pure Funktion.
 */
export function computeValidationWarnings(nodes: Node[], edges: Edge<CableEdgeData>[]) {
  const warnings: ValidationWarning[] = [];

  if (!nodes || !edges) return warnings;

  // Single-pass node classification and indexing O(N) to avoid 8x nodes.filter scans
  const nodeMap = new Map<string, Node>();
  const shorePowerNodes: Node[] = [];
  const solarNodes: Node[] = [];
  const chargers: Node[] = [];
  const batteries: Node[] = [];
  const consumers: Node[] = [];
  const inverters: Node[] = [];
  const dcdcChargers: Node[] = [];
  const shunts: Node[] = [];

  for (const node of nodes) {
    nodeMap.set(node.id, node);

    switch (node.type) {
      case 'shorePower':
        shorePowerNodes.push(node);
        break;
      case 'solar':
      case 'roofSolar':
        solarNodes.push(node);
        break;
      case 'charger':
      case 'mpptController':
        chargers.push(node);
        break;
      case 'battery':
        batteries.push(node);
        break;
      case 'consumer':
      case 'consumer230v':
        consumers.push(node);
        break;
      case 'inverter':
        inverters.push(node);
        break;
      case 'dcdcCharger':
        dcdcChargers.push(node);
        break;
      case 'shunt':
        shunts.push(node);
        break;
    }
  }

  // Pre-build target and source edge maps O(E) to eliminate O(N*E) nested array scans
  const edgesByTarget = new Map<string, Edge<CableEdgeData>[]>();
  const edgesBySource = new Map<string, Edge<CableEdgeData>[]>();

  // ELE-008: Mischspannungsplan verhindern
  if (batteries.length > 1) {
    const voltages = new Set(batteries.map((b) => Number(b.data?.voltage) || 12));
    if (voltages.size > 1) {
      warnings.push({
        id: 'mixed-voltage-batteries',
        category: 'topology',
        type: 'critical',
        title: 'Mischspannung (12 V / 24 V)',
        message:
          'Batterien mit unterschiedlichen Nennspannungen im Plan. Dies ist gefährlich und wird vom Berechnungsmodell nicht unterstützt.',
        ruleId: 'ELE-008-mixed-voltage',
        measuredValue: Array.from(voltages).join(' V, ') + ' V',
        expectedValue: 'einheitliche Spannung',
        unit: 'V',
      });
    }
  }

  for (const edge of edges) {
    let targetList = edgesByTarget.get(edge.target);
    if (!targetList) {
      targetList = [];
      edgesByTarget.set(edge.target, targetList);
    }
    targetList.push(edge);

    let sourceList = edgesBySource.get(edge.source);
    if (!sourceList) {
      sourceList = [];
      edgesBySource.set(edge.source, sourceList);
    }
    sourceList.push(edge);
  }

  // --- Rule A: Quellschutz-Regel ---
  // Look for edges coming from battery, inverter, solar charger on positive line
  edges.forEach((edge) => {
    if (edge.data?.edgeDomain === 'AC_230V') return; // Skip DC fuse warning for AC edges
    if (edge.sourceHandle?.includes('plus')) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      const isHighPowerSource =
        sourceNode?.type === 'battery' ||
        sourceNode?.type === 'inverter' ||
        sourceNode?.type === 'solar' ||
        sourceNode?.type === 'roofSolar' ||
        ['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(sourceNode?.type as string);
      const isProtectedTarget = targetNode?.type === 'fuse';

      if (isHighPowerSource && !isProtectedTarget) {
        if (!edge.data?.fuseSize) {
          warnings.push({
            id: `missing-fuse-${edge.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Sicherung fehlt',
            focusId: edge.id,
            focusType: 'edge',
            message: `⚠️ Kritisch: Quellschutz fehlt! Die Leitung von ${sourceNode?.data?.label || sourceNode?.type} muss direkt am Anfang abgesichert werden (Kabel-Sicherung oder Sicherungsblock).`,
          });
        }
      }
    }
  });

  const sysVoltage = getSystemVoltage(nodes);

  // --- Rule A3: Verpolte Gleichspannungs-Quellen (AUDIT ELE-003) ---
  // Die Polaritäts-Ausnahme für battery×battery / solar×solar in
  // isValidConnection erlaubt plus↔minus-Kanten (Serienverschaltung).
  // Ohne separates Serien-Modell ist dieselbe Kante eine VERPOLTE
  // PARALLELSCHALTUNG, sobald beide Quellen zusätzlich auf gemeinsamen
  // Schienen liegen — im realen Fahrzeug ein Kurzschluss im kA-Bereich.
  // Die Kante wird daher nie still akzeptiert: kritische Warnung mit
  // Klartext, was elektrisch passiert.
  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) return;
    const isBatteryPair = sourceNode.type === 'battery' && targetNode.type === 'battery';
    const isSolarPair =
      (sourceNode.type === 'solar' || sourceNode.type === 'roofSolar') &&
      (targetNode.type === 'solar' || targetNode.type === 'roofSolar');
    if (!isBatteryPair && !isSolarPair) return;
    const reversed =
      (edge.sourceHandle?.includes('plus') && edge.targetHandle?.includes('minus')) ||
      (edge.sourceHandle?.includes('minus') && edge.targetHandle?.includes('plus'));
    if (!reversed) return;
    warnings.push({
      id: `reversed-polarity-${edge.id}`,
      category: 'safety',
      type: 'critical',
      title: 'Polarität vertauscht',
      focusId: edge.id,
      focusType: 'edge',
      ruleId: 'ELE-003-reversed-polarity',
      measuredValue: `${edge.sourceHandle} → ${edge.targetHandle}`,
      expectedValue: 'plus → plus / minus → minus',
      unit: '',
      source: 'Polaritätsmodell (Physik): verpolte Parallelschaltung = Kurzschluss',
      message: `⚠️ Kritisch: Polarität vertauscht! ${
        isBatteryPair ? 'Zwei Batterien' : 'Zwei Solarpanele'
      } sind plus auf minus verbunden. Als Parallelschaltung ist das ein direkter Kurzschluss; eine Serienschaltung (z. B. 24 V) ist im Planer nicht modelliert — trenne diese Verbindung und verbinde gleiche Pole (plus→plus, minus→minus).`,
    });
  });

  // --- Rule A5: Parallelschaltung inkompatibler Batterie-Chemien (AUTO-003) ---
  // Auto-Wire legt AGM ‖ Gel nicht mehr auf die Schiene, aber Nutzer-Kanten
  // sind weiterhin frei ziehbar: plus↔plus / minus↔minus zwischen Batterien
  // ist eine Parallelschaltung — bei unterschiedlichen Chemien mit
  // verschiedenen Ladeschlussspannungen lädt ein Partner dauerüber/unter.
  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (sourceNode?.type !== 'battery' || targetNode?.type !== 'battery') return;
    const sPlus = edge.sourceHandle?.includes('plus') ?? false;
    const tPlus = edge.targetHandle?.includes('plus') ?? false;
    const sMinus = edge.sourceHandle?.includes('minus') ?? false;
    const tMinus = edge.targetHandle?.includes('minus') ?? false;
    const isParallel = (sPlus && tPlus) || (sMinus && tMinus);
    if (!isParallel) return; // plus↔minus = Serienfall, dafür gibt es A3
    if (chemistriesParallelSafe(sourceNode, targetNode)) return;
    warnings.push({
      id: `battery-parallel-chemistry-${edge.id}`,
      category: 'safety',
      type: 'critical',
      title: 'Batterie-Chemien nicht parallel-sicher',
      focusId: edge.id,
      focusType: 'edge',
      ruleId: 'AUTO-003-parallel-chemistry',
      measuredValue: `${String(sourceNode.data?.chemistry || '?')} ‖ ${String(
        targetNode.data?.chemistry || '?'
      )}`,
      expectedValue: 'identische Chemie (z. B. AGM ‖ AGM)',
      unit: '',
      source: 'Modell: Ladeschlussspannungen/Fenster je Chemie (AGM ~14,4–14,7 V, Gel ~14,1–14,4 V)',
      message: `⚠️ Kritisch: „${sourceNode.data?.label || 'Batterie'}“ (${String(
        sourceNode.data?.chemistry || '?'
      )}) und „${targetNode.data?.label || 'Batterie'}“ (${String(
        targetNode.data?.chemistry || '?'
      )}) sind parallel geschaltet. Unterschiedliche Chemien haben unterschiedliche Ladeschlussspannungen — ein Partner wird dauerhaft über- oder unterladen (Sulfatierung/Gasung). Trenne die Verbindung oder verwende identische Chemien.`,
    });
  });

  // --- Rule A6: MPPT-Voc-Fenster bei Kälte (AUDIT ELE-007) ---
  // Der Regler muss die KALT-Leerlaufspannung des Strings verkraften:
  // Voc(T_min) = Voc_STC · (1 + |TK| · (25 °C − T_min)), Modell-T_min = −20 °C.
  // Geprüft wird, sobald der Regler ein maxPvVoltage-Eintrag hat; fehlen
  // Panel-Voc-Datenblattwerte, fordert eine Hinweis-Warnung sie an (still
  // überschätzen wäre die alte, unsichere Variante).
  nodes.forEach((mppt) => {
    if (mppt.type !== 'mpptController') return;
    const maxPvVoltage = Number((mppt.data as Record<string, unknown> | undefined)?.maxPvVoltage || 0);
    if (maxPvVoltage <= 0) return;
    // Erreichbare Panels per BFS über alle Kanten ab dem Regler.
    const adjacent = new Map<string, string[]>();
    edges.forEach((edge) => {
      if (!adjacent.has(edge.source)) adjacent.set(edge.source, []);
      if (!adjacent.has(edge.target)) adjacent.set(edge.target, []);
      adjacent.get(edge.source)!.push(edge.target);
      adjacent.get(edge.target)!.push(edge.source);
    });
    const visited = new Set<string>([mppt.id]);
    const queue = [mppt.id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const next of adjacent.get(currentId) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    const connectedNodes = nodes.filter((n) => visited.has(n.id));
    const { stringVoc, missingVoc } = stringColdVocOf(connectedNodes, edges);
    const worst = stringVoc.length > 0 ? Math.max(...stringVoc) : 0;
    if (worst > maxPvVoltage) {
      warnings.push({
        id: `solar-voc-window-${mppt.id}`,
        category: 'safety',
        type: 'critical',
        title: 'MPPT-Eingangsspannung zu klein für Kalt-Voc',
        focusId: mppt.id,
        focusType: 'node',
        ruleId: 'ELE-007-voc-window',
        measuredValue: `Voc kalt ≈ ${Math.round(worst)} V (bei ${SOLAR_DESIGN_MIN_TEMPERATURE_C} °C)`,
        expectedValue: `max. ${maxPvVoltage} V`,
        unit: 'V',
        source: 'Modellannahme: Voc(T_min) = Voc_STC · (1 + |TK|·ΔT); TK-Default −0,35 %/K (c-Si)',
        message: `⚠️ Kritisch: Die Leerlaufspannung des Solar-Strings steigt in der Kälte auf ≈ ${Math.round(
          worst
        )} V (Auslegungstemperatur ${SOLAR_DESIGN_MIN_TEMPERATURE_C} °C) — der Laderegler „${
          (mppt.data as Record<string, unknown>)?.label || 'MPPT'
        }“ erlaubt aber max. ${maxPvVoltage} V. Überspannung zerstört den Regler. Strings kürzen (weniger Panels in Serie) oder Regler mit höherem PV-Eingangsbereich wählen.`,
      });
    } else if (missingVoc) {
      warnings.push({
        id: `solar-voc-missing-${mppt.id}`,
        category: 'estimation',
        type: 'info',
        title: 'Solar-Voc-Datenblattwerte fehlen',
        focusId: mppt.id,
        focusType: 'node',
        ruleId: 'ELE-007-voc-missing-data',
        measuredValue: 'Voc nicht angegeben',
        expectedValue: 'Voc (STC) je Panel',
        unit: 'V',
        source: 'Modell: Voc-Fensterprüfung nur mit Datenblattwert (schätzen wäre unehrlich)',
        message: `ℹ️ Hinweis: Für die Kalt-Voc-Prüfung des Ladereglers fehlt bei mindestens einem Panel der Datenblattwert „Leerlaufspannung Voc“. Trage ihn im Panel-Inspektor ein, damit das Eingangsfenster geprüft werden kann.`,
      });
    }
  });

  // --- Rule A4: RCD/FI am Wechselrichter-Kreis (AUDIT AC-001) ---
  // Rule A2 prüft nur Landstrom-Nodes. Ein Plan „Batterie → Wechselrichter
  // → 230-V-Verbraucher" ohne jedes Fehlerstrom-Schutzorgan erzeugte
  // KEINE Warnung — dabei führt der Inverter-Kreis dieselbe Gefahr
  // (Berührungsschutz 230 V) wie die Landstromseite.
  const acAdjacency = new Map<string, string[]>();
  const addAcLink = (from: string, to: string): void => {
    const list = acAdjacency.get(from) ?? [];
    list.push(to);
    acAdjacency.set(from, list);
  };
  for (const edge of edges) {
    const s = nodeMap.get(edge.source)?.type;
    const t = nodeMap.get(edge.target)?.type;
    const domain = edge.data?.edgeDomain ?? getEdgeDomain(s, t, edge.sourceHandle, edge.targetHandle);
    if (domain !== 'AC_230V') continue;
    addAcLink(edge.source, edge.target);
    addAcLink(edge.target, edge.source);
  }
  const acReachable = (startId: string): Set<string> => {
    const visited = new Set<string>();
    const queue = [startId];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined || visited.has(current)) continue;
      visited.add(current);
      for (const next of acAdjacency.get(current) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }
    return visited;
  };
  inverters.forEach((inverter) => {
    if (inverter.data?.hasRcd) return;
    const island = acReachable(inverter.id);
    let consumerCount = 0;
    island.forEach((id) => {
      if (nodeMap.get(id)?.type === 'consumer230v') consumerCount += 1;
    });
    if (consumerCount === 0) return;
    warnings.push({
      id: `inverter-missing-rcd-${inverter.id}`,
      category: 'safety',
      type: 'critical',
      title: 'FI-Schutz am Wechselrichter fehlt',
      focusId: inverter.id,
      focusType: 'node',
      ruleId: 'AC-001-inverter-rcd',
      measuredValue: `${consumerCount} × 230-V-Verbraucher ohne FI`,
      expectedValue: 'RCD/FI ≤ 30 mA (Typ A) im AC-Ausgangskreis',
      unit: '',
      source: 'Schutz bei indirektem Berühren, 230-V-Fahrzeugkreis (DIN VDE 0100-721-Kontext)',
      message: `⚠️ Kritisch: Der Wechselrichter „${
        inverter.data?.label || 'Wechselrichter'
      }“ speist ${consumerCount} 230-V-Verbraucher, der AC-Kreis hat aber keinen FI-Schutzschalter (RCD ≤ 30 mA, Typ A). Auch ohne Landstrom besteht Berührungsgefahr an 230 V. Lass diese Schutzmaßnahme von einer Elektrofachkraft einplanen.`,
    });
  });

  // --- Rule A2: RCD / FI-Pflicht an Landstrom (DIN VDE 0100-721) ---
  shorePowerNodes.forEach((sp) => {
    if (!sp.data?.hasRcd) {
      warnings.push({
        id: `missing-rcd-${sp.id}`,
        category: 'safety',
        type: 'critical',
        title: 'FI-Schutzschalter fehlt',
        focusId: sp.id,
        focusType: 'node',
        ruleId: 'A2-shore-rcd',
        measuredValue: 'kein FI',
        expectedValue: 'RCD <= 30 mA',
        unit: 'mA',
        source: 'DIN VDE 0100-721 (Landstromanschluss Wohnmobil)',
        message: `Am Landstromanschluss „${sp.data?.label || 'Landstrom'}" fehlt ein FI-Schutzschalter mit höchstens 30 mA (RCD ≤ 30 mA). Nach DIN VDE 0100-721 ist dieser zwingend vorgeschrieben — Stromschlaggefahr. Lass den 230-V-Schutz von einer Elektrofachkraft einplanen.`,
      });
    }
  });

  // --- Rule A4: Direktes Solar an DC (ohne MPPT) ---
  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) return;

    const isSourceSolar = sourceNode.type === 'solar' || sourceNode.type === 'roofSolar';
    const isTargetSolar = targetNode.type === 'solar' || targetNode.type === 'roofSolar';

    if (isSourceSolar || isTargetSolar) {
      const otherNode = isSourceSolar ? targetNode : sourceNode;
      const isOtherSolar = otherNode.type === 'solar' || otherNode.type === 'roofSolar';
      const isCharger = otherNode.type === 'mpptController' || otherNode.type === 'charger';
      const isFuse = otherNode.type === 'fuse';
      const isConduit = otherNode.type === 'conduit';
      const isGround = otherNode.type === 'ground'; // Solar minus to ground is sometimes OK

      if (!isOtherSolar && !isCharger && !isFuse && !isConduit && !isGround) {
        const solarNode = isSourceSolar ? sourceNode : targetNode;
        warnings.push({
          id: `solar-direct-${edge.id}`,
          category: 'topology',
          type: 'critical',
          title: 'Solar ohne Laderegler',
          message: `Kritisch: Das Solarmodul "${solarNode.data?.label || 'Solar'}" ist direkt mit "${otherNode.data?.label || otherNode.type}" verbunden. Solarmodule müssen zwingend über einen Laderegler (MPPT) an das System angeschlossen werden!`,
          focusId: edge.id,
          focusType: 'edge',
          ruleId: 'ELE-009-solar-direct',
          measuredValue: `Solar → ${otherNode.type}`,
          expectedValue: 'Solar → Laderegler',
          unit: '',
        });
      }
    }
  });

  // --- Rule B: Overloaded Solar Regulator ---
  if (solarNodes.length > 0 && chargers.length > 0) {
    const totalSolarWatts = solarNodes.reduce((acc, node) => acc + (Number(node.data.watts) || 0), 0);
    const mpptCapacity = chargers.reduce((acc, node) => acc + (Number(node.data.amps) || 0), 0) * sysVoltage;

    if (totalSolarWatts > mpptCapacity) {
      warnings.push({
        id: 'solar-overload',
        category: 'estimation',
        type: 'warning',
        title: 'Solarregler zu klein',
        focusId: chargers[0]?.id,
        focusType: 'node',
        message: `⚠️ Hinweis: Solarregler unterdimensioniert (Solar: ~${totalSolarWatts}W, MPPT max: ~${Math.round(mpptCapacity)}W).`,
      });
    }
  }

  // --- Rule BMMS: BMS-Dauerstromgrenzen (AUDIT ELE-005) ---
  // Die Batterie-/BMS-Grenzwerte sind im Datenmodell vorhanden, wurden aber
  // nie geprüft. Eine 50-A-BMS-Batterie mit einem 1,5-kW-Wechselrichter
  // (~138 A) wäre sonst ein „sicherer“ AutoWire-Plan. Bei explizit
  // eingetragener Grenze prüfen wir die berechneten DC-Ströme der
  // Batterie-Hauptleitungen.
  for (const battery of batteries) {
    const dischargeLimit = Number((battery.data as Record<string, unknown>)?.bmsContinuousDischarge || 0);
    const chargeLimit = Number((battery.data as Record<string, unknown>)?.bmsContinuousCharge || 0);
    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      const isBatterySourcePlus = edge.source === battery.id && !!edge.sourceHandle?.includes('plus');
      const isBatteryTargetPlus = edge.target === battery.id && !!edge.targetHandle?.includes('plus');
      if (!isBatterySourcePlus && !isBatteryTargetPlus) continue;
      const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage, edges);
      if (dischargeLimit > 0 && isBatterySourcePlus && I > dischargeLimit) {
        warnings.push({
          id: `bms-discharge-${battery.id}-${edge.id}`,
          category: 'safety',
          type: 'critical',
          title: 'Batterie-/BMS-Dauerstrom überschritten',
          focusId: battery.id,
          focusType: 'node',
          ruleId: 'ELE-005-bms-discharge',
          measuredValue: `${Math.round(I)} A`,
          expectedValue: `max. ${dischargeLimit} A`,
          unit: 'A',
          source: 'Batteriemodell: bmsContinuousDischarge (BMS-Grenze)',
          message: `⚠️ Kritisch: Die Leitung von „${
            battery.data?.label || 'Batterie'
          }“ wird mit ≈${Math.round(I)} A belastet, das BMS erlaubt dauerhaft nur ${dischargeLimit} A. Kabeldimensionierung und Sicherung schützen das Kabel, nicht das BMS — die Batterie kann abgeschaltet werden oder Schaden nehmen.`,
        });
      }
      if (chargeLimit > 0 && isBatteryTargetPlus && I > chargeLimit) {
        warnings.push({
          id: `bms-charge-${battery.id}-${edge.id}`,
          category: 'safety',
          type: 'critical',
          title: 'Batterie-/BMS-Ladestrom überschritten',
          focusId: battery.id,
          focusType: 'node',
          ruleId: 'ELE-005-bms-charge',
          measuredValue: `${Math.round(I)} A`,
          expectedValue: `max. ${chargeLimit} A`,
          unit: 'A',
          source: 'Batteriemodell: bmsContinuousCharge (BMS-Grenze)',
          message: `⚠️ Kritisch: Der Ladezweig zu „${
            battery.data?.label || 'Batterie'
          }“ führt ≈${Math.round(I)} A, das BMS erlaubt dauerhaft nur ${chargeLimit} A Ladestrom.`,
        });
      }
    }
  }

  // --- Rule A7: Kurzschlussstrom vs. Abschaltvermögen (AUDIT DOM-002) ---
  // Erster Modellschnitt mit geschätztem Ik (Batterie-Innenwiderstand oder
  // Chemie-Faustformel) und typischen Abschaltvermögen je Bauform —
  // Modellgrenzen und Quellenlage: lib/shortCircuit.ts. Geprüft werden nur
  // Batterie-Plus-Ausgänge mit eingetragener Sicherung: genau dort ist die
  // Sicherung das Trennorgan zwischen dem höchsten Fehlerstrom des Plans
  // und der Installation.
  {
    const bankIk = bankShortCircuitCurrentA(batteries, sysVoltage);
    let fuseTypeNotePushed = false;
    for (const battery of batteries) {
      if (bankIk === null) break; // Bank nicht schätzbar → ehrlich schweigen
      for (const edge of edges) {
        const isBatterySourcePlus = edge.source === battery.id && !!edge.sourceHandle?.includes('plus');
        if (!isBatterySourcePlus) continue;
        const edgeData = edge.data as
          | {
              fuseSize?: number;
              fuseType?: string;
              fuseBreakingCapacity?: number;
              fuseOffset?: number;
              crossSection?: number;
            }
          | undefined;
        if (!(Number(edgeData?.fuseSize) > 0)) continue;
        const capacity = breakingCapacityAOf(edgeData?.fuseType, edgeData?.fuseBreakingCapacity, sysVoltage);
        const ikAtFuse = shortCircuitAtFuseA(
          batteries,
          edgeData?.fuseOffset,
          edgeData?.crossSection,
          sysVoltage
        );
        if (ikAtFuse === null) continue;
        if (capacity === null) {
          // Ohne Bauform/Datenblatt ist das Abschaltvermögen nicht
          // bewertbar — einmal pro Plan als Hinweis (kein Warn-Spam je Kante).
          if (!fuseTypeNotePushed && bankIk > FUSE_BREAKING_CAPACITY_A.ato) {
            fuseTypeNotePushed = true;
            warnings.push({
              id: 'sc-fuse-type-unknown',
              category: 'estimation',
              type: 'warning',
              title: 'Abschaltvermögen der Hauptsicherung unbekannt',
              focusId: battery.id,
              focusType: 'node',
              ruleId: 'DOM-002-fuse-type-unknown',
              measuredValue: `≈ ${(bankIk / 1000).toFixed(1)} kA`,
              expectedValue: 'Bauform bzw. Datenblatt-Abschaltvermögen angeben',
              unit: 'kA',
              source: 'Modell: geschätzter Bank-Kurzschlussstrom (lib/shortCircuit.ts)',
              message: `Hinweis: Die Batteriebank kann im Kurzschlussfall ≈ ${(bankIk / 1000).toFixed(1)} kA liefern (geschätzt aus Innenwiderstand/Faustformel). Ohne Bauform der Hauptsicherung (ATO/MIDI/MEGA/ANL/MRBF/Class T) ist ihr Abschaltvermögen hier nicht geprüft — im Leitungs-Inspektor eintragen.`,
            });
          }
          continue;
        }
        if (ikAtFuse > capacity) {
          warnings.push({
            id: `sc-breaking-${edge.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Abschaltvermögen der Sicherung zu gering',
            focusId: edge.id,
            focusType: 'edge',
            ruleId: 'DOM-002-breaking-capacity',
            measuredValue: `≈ ${Math.round(ikAtFuse)} A`,
            expectedValue: `≤ ${capacity} A`,
            unit: 'A',
            source:
              'ABYC-E-11-AIC-Anforderung; Bauform-Tabelle lib/shortCircuit.ts (typische Herstellerwerte, UNVERIFIED)',
            message: `⚠️ Kritisch: Die Sicherung (Abschaltvermögen ${capacity} A) kann den geschätzten Kurzschlussstrom der Bank am Einbauort (≈ ${Math.round(ikAtFuse)} A) nicht sicher trennen. Bauform mit höherem Abschaltvermögen wählen (z. B. Class T ≈ 20 kA) oder Datenblatt-Wert eintragen.`,
          });
        }
      }
    }
  }

  // --- Rule A8: AC-Abschaltbedingung / Mehrleiter-Schutz (AUDIT DOM-001) ---
  // Bisher waren AC-Kanten Einleiter-Abstraktionen mit einem Zahlenfeld
  // als „Sicherung". Jetzt wird die Abschaltbedingung (IEC 60364-4-41,
  // TN: Zs·Ia ≤ U0, 2/3-Regel) geschätzt bewertet: Leitungsanteil über
  // Phase+PE (Tabelle 54.2), vorgelagerte Netzimpedanz als deklarierte
  // Annahme. Sonderfälle ehrlich: Wechselrichter-Ausgang (elektronisch
  // begrenzt) und 30-mA-FI am Einspeisepunkt (oder RCBO) decken den
  // Fehlerschutz. FI-Deckung ≠ Messpflicht-Freischein: 'rcd-covered'
  // bleibt ein Hinweis, kein OK.
  {
    const anyUpstreamRcd = [...shorePowerNodes, ...chargers].some((n) => n.data?.hasRcd === true);
    let acProtectionNotePushed = false;
    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      const isAc =
        (edge.data?.edgeDomain ??
          getEdgeDomain(sourceNode?.type, targetNode?.type, edge.sourceHandle, edge.targetHandle)) ===
        'AC_230V';
      if (!isAc) continue;

      // Wechselrichter-Ausgänge erzeugen bewusst KEINEN Statushinweis:
      // das „Auto-Wired-Plan ist meldungsfrei"-Versprechen (Szenario-Tests)
      // gilt weiter; das Modelllimit steht sichtbar am Kanten-Chip
      // (elektronisch begrenzt → Hersteller-Datenblatt beachten). Die
      // Schätzung selbst verweigert dort ebenfalls ('inverter-limited').
      const sourceKind = acSourceKindOf(sourceNode?.type);

      const rated = Number(edge.data?.fuseSize);
      if (!(rated > 0)) continue; // ungesicherte AC-Kante: bestehender Status quo (FI/LS-Hinweis im Chip)
      const assessment = evaluateAcEdgeProtection({
        ratedCurrentA: rated,
        descriptor: edge.data?.acProtection,
        lengthM: typeof edge.data?.length === 'number' ? edge.data.length : undefined,
        crossSection: typeof edge.data?.crossSection === 'number' ? edge.data.crossSection : undefined,
        sourceKind,
        upstreamRcd: anyUpstreamRcd,
      });

      const fmt = (value: number | null) => (value === null ? '—' : `≈ ${value.toFixed(2)} Ω`);
      const base = {
        focusId: edge.id,
        focusType: 'edge' as const,
        unit: 'Ω',
        source: `Schätzung nach IEC 60364-4-41 (Zs·Ia ≤ U0, 2/3-Regel); vorgelagert angenommen ${UPSTREAM_IMPEDANCE_ASSUMPTION_OHM} Ω, PE nach IEC 60364-5-54 Tab. 54.2; lib/acProtection.ts`,
      };
      switch (assessment.verdict) {
        case 'fail':
          warnings.push({
            ...base,
            id: `ac-trip-${edge.id}`,
            category: 'safety',
            type: 'critical',
            title: 'AC-Abschaltbedingung nicht gesichert (Schleifenimpedanz)',
            ruleId: 'DOM-001-trip-condition',
            measuredValue: fmt(assessment.zsEstimateOhm),
            expectedValue: `≤ ${assessment.zsMaxOhm?.toFixed(2)} Ω (Ia = ${Math.round(assessment.iaA ?? 0)} A)`,
            message: `⚠️ Kritisch: ${assessment.reason} Die geschätzte magnetische Abschaltung des LS-Schalters ist im Fehlerfall nicht gesichert — 30-mA-FI am Landstromanschluss aktivieren oder FI/LS (RCBO) statt LS wählen, Schleifenimpedanz vor Ort messen lassen. Ohne FI kann ein Körperschluss die Leitung dauerhaft gefährlich spannungsführend halten.`,
          });
          break;
        case 'borderline':
          warnings.push({
            ...base,
            id: `ac-trip-${edge.id}`,
            category: 'estimation',
            type: 'warning',
            title: 'AC-Abschaltbedingung knapp (Leitungslänge treibt Schleifenimpedanz)',
            ruleId: 'DOM-001-trip-borderline',
            measuredValue: fmt(assessment.zsEstimateOhm),
            expectedValue: `≤ ${assessment.zsMaxOhm?.toFixed(2)} Ω`,
            message: `Hinweis: ${assessment.reason} Die Abschaltung hängt damit an der angenommenen Netzimpedanz — Schleifenimpedanz messen lassen oder Leitung kürzen/verstärken.`,
          });
          break;
        case 'rcd-covered':
          warnings.push({
            ...base,
            id: `ac-trip-rcd-${edge.id}`,
            category: 'estimation',
            type: 'info',
            title: 'AC-Fehlerschutz über 30-mA-FI gedeckt (TN-Grenze überschritten)',
            ruleId: 'DOM-001-trip-rcd-covered',
            measuredValue: fmt(assessment.zsEstimateOhm),
            expectedValue: `≤ ${assessment.zsMaxOhm?.toFixed(2)} Ω`,
            message: `Hinweis: ${assessment.reason}`,
          });
          break;
        case 'ok-with-assumption':
          break; // geprüft & still — die Annahmen stehen im source-String anderer Meldungen
        case 'not-modeled': {
          if (!acProtectionNotePushed) {
            acProtectionNotePushed = true;
            warnings.push({
              ...base,
              id: 'ac-protection-not-modeled',
              category: 'estimation',
              type: 'info',
              title: 'AC-Schutzorgan ohne Bauform — Abschaltbedingung unbewertet',
              focusId: edge.id,
              focusType: 'edge',
              ruleId: 'DOM-001-protection-not-modeled',
              measuredValue: 'Sicherung als Zahl',
              expectedValue: 'Bauform (LS/RCBO), Charakteristik B/C, Icn 6/10 kA',
              source:
                'DOM-001: AC-Schutzdaten fehlen — Bewertung erst mit Datenblatt-Angaben (Edge-Inspektor)',
              message: `Hinweis: Für mindestens eine 230-V-Leitung ist die Sicherung nur als Bemessungsstrom eingetragen. Bauform (LS oder FI/LS), Charakteristik (B/C) und Abschaltvermögen im Leitungs-Inspektor angeben — erst dann wird die Abschaltbedingung geschätzt geprüft (IEC 60898-1 / 60364-4-41).`,
            });
          }
          break;
        }
      }
    }
  }

  // --- Rule C: Battery Capacity Alert ---
  if (batteries.length > 0 && consumers.length > 0) {
    const totalBatteryAh = batteries.reduce((acc, node) => acc + (Number(node.data.capacity) || 0), 0);

    // Calculate daily Ah consumption using dynamic system voltage
    const totalDailyAh = consumers.reduce((acc, node) => {
      const watts = Number(node.data.watts) || 0;
      const hours = Number(node.data.hours) || 4; // default to 4 hours
      return acc + (watts * hours) / sysVoltage;
    }, 0);

    if (totalDailyAh > totalBatteryAh) {
      warnings.push({
        id: 'battery-capacity',
        category: 'estimation',
        type: 'info',
        title: 'Batterie könnte knapp werden',
        focusId: batteries[0]?.id,
        focusType: 'node',
        message: `💡 Tipp: Deine Batterie könnte knapp werden. Verbrauch: ~${Math.round(totalDailyAh)}Ah/Tag (geschätzt), Batterie: ${totalBatteryAh}Ah.`,
      });
    }
  }

  // --- Rule G: Inverter Protection ---
  inverters.forEach((inverter) => {
    const targetEdges = edgesByTarget.get(inverter.id) || [];
    const incomingPlusEdges = targetEdges.filter((e) => e.targetHandle?.includes('plus'));
    const incomingMinusEdges = targetEdges.filter((e) => e.targetHandle?.includes('minus'));

    if (incomingMinusEdges.length === 0) {
      warnings.push({
        id: `inverter-no-minus-${inverter.id}`,
        category: 'topology',
        type: 'warning',
        title: 'Wechselrichter: Minus fehlt',
        focusId: inverter.id,
        focusType: 'node',
        message: `⚠️ Hinweis: Dem Wechselrichter fehlt die Rückleitung (Minuspol).`,
      });
    }

    incomingPlusEdges.forEach((edge) => {
      let isProtected = false;
      if (edge.data?.fuseSize) {
        isProtected = true;
      } else {
        const sourceNode = nodeMap.get(edge.source);
        if (sourceNode?.type === 'fuse') {
          isProtected = true;
        }
      }

      if (!isProtected) {
        warnings.push({
          id: `inverter-unprotected-${edge.id}`,
          category: 'safety',
          type: 'critical',
          title: 'Wechselrichter ohne Sicherung',
          focusId: edge.id,
          focusType: 'edge',
          message: `⚠️ Kritisch: Direkter Batterie-zu-Inverter-Pfad! Der Wechselrichter muss zwingend über eine eigene Sicherung abgesichert sein.`,
        });
      }
    });
  });

  // --- Rule E: DC-DC Charger Connection ---
  dcdcChargers.forEach((charger) => {
    const hasInput = (edgesByTarget.get(charger.id)?.length ?? 0) > 0;
    const hasOutput = (edgesBySource.get(charger.id)?.length ?? 0) > 0;

    if (!hasInput || !hasOutput) {
      warnings.push({
        id: `dcdc-unconnected-${charger.id}`,
        category: 'topology',
        type: 'warning',
        title: 'Ladebooster nicht komplett',
        focusId: charger.id,
        focusType: 'node',
        message: `💡 Hinweis: Der Ladebooster (DC-DC) scheint nicht vollständig angeschlossen zu sein. Bitte Starterseite (Eingang) und Aufbaubatterie-Pfad (Ausgang) prüfen.`,
      });
    }
  });

  // --- Rule F: Der Shunt wird umgangen ---
  // Nur die Aufbaubatterie, an der der Shunt hängt. Die Starterbatterie
  // des Ladeboosters führt Minus fachgerecht direkt und ist kein Bypass.
  if (shunts.length > 0) {
    const shuntBatteryIds = new Set<string>();
    for (const shunt of shunts) {
      const connectedEdges = [...(edgesByTarget.get(shunt.id) || []), ...(edgesBySource.get(shunt.id) || [])];
      for (const edge of connectedEdges) {
        const otherId = edge.source === shunt.id ? edge.target : edge.source;
        if (nodeMap.get(otherId)?.type === 'battery') {
          shuntBatteryIds.add(otherId);
        }
      }
    }
    const isStarterBatteryNode = (n: Node | undefined) => /starter/i.test(String(n?.data?.label || ''));
    const isMonitoredBattery = (n: Node | undefined) => {
      if (!n || n.type !== 'battery' || isStarterBatteryNode(n)) return false;
      if (shuntBatteryIds.size === 0) return true;
      return shuntBatteryIds.has(n.id);
    };

    edges.forEach((edge) => {
      const targetNode = nodeMap.get(edge.target);
      const sourceNode = nodeMap.get(edge.source);

      const sourceIsMonitoredMinus = isMonitoredBattery(sourceNode) && !!edge.sourceHandle?.includes('minus');
      const targetIsMonitoredMinus = isMonitoredBattery(targetNode) && !!edge.targetHandle?.includes('minus');

      if (sourceIsMonitoredMinus || targetIsMonitoredMinus) {
        const otherNode = sourceIsMonitoredMinus ? targetNode : sourceNode;
        if (otherNode && otherNode.type !== 'shunt' && otherNode.type !== 'battery') {
          warnings.push({
            id: `shunt-bypass-${edge.id}`,
            category: 'monitoring',
            type: 'critical',
            title: 'Shunt wird umgangen',
            focusId: edge.id,
            focusType: 'edge',
            message: `⚠️ Kritisch: Der Shunt wird umgangen! Relevante Minus-Verbindungen (wie von ${otherNode.data?.label || otherNode.type}) dürfen nicht am Shunt vorbei direkt an Batterie-Minus hängen.`,
          });
        }
      }
    });
  }

  // --- Rule DATA: Ungültige Last-/Stromwerte (AUDIT ELE-009) ---
  // Negative Werte und NaN dürfen nicht still als 0 A verschwinden. Das
  // würde Kabel und Sicherung zu klein erscheinen lassen, während das Gerät
  // real Leistung zieht.
  for (const node of nodes) {
    const data = node.data as Record<string, unknown> | undefined;
    for (const field of ['watts', 'amps'] as const) {
      const raw = data?.[field];
      if (raw === undefined || raw === null || raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        warnings.push({
          id: `invalid-load-${node.id}-${field}`,
          category: 'safety',
          type: 'critical',
          title: 'Ungültiger Last-/Stromwert',
          focusId: node.id,
          focusType: 'node',
          ruleId: 'DATA-001-invalid-load-value',
          measuredValue: String(raw),
          expectedValue: 'endlicher Wert ≥ 0',
          source: 'Datenmodell: watts/amps ≥ 0 (Import-/Altdaten-Validierung)',
          message: `⚠️ Kritisch: Bei „${node.data?.label || node.type}“ ist ${
            field === 'watts' ? 'die Leistung' : 'der Strom'
          } ungültig (${String(raw)}). Der Wert wird intern als 0 A behandelt und kann zu dünn dimensionierte Leitungen verbergen. Korrigiere die Angabe im Inspektor.`,
        });
      }
    }
  }

  return warnings;
}

export function useLiveValidation(nodes: Node[], edges: Edge<CableEdgeData>[]) {
  return useMemo(() => computeValidationWarnings(nodes, edges), [nodes, edges]);
}
