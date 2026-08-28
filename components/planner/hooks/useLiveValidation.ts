import { useMemo } from 'react';
import { type Node, type Edge } from 'reactflow';
import { type CableEdgeData } from '../../edges/CableEdge';

import { getSystemVoltage } from '../utils/voltage';

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
}

/** Reihenfolge der Schwere für die Sortierung in der Warn-Zentrale. */
export const SEVERITY_ORDER: Record<ValidationWarning['type'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function useLiveValidation(nodes: Node[], edges: Edge<CableEdgeData>[]) {
  return useMemo(() => {
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
          ['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(
            sourceNode?.type as string
          );
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
          message: `⚠️ Kritisch: Am Landstromanschluss „${sp.data?.label || 'Landstrom'}" fehlt ein FI-Schutzschalter (RCD ≤ 30 mA). Nach DIN VDE 0100-721 ist dieser zwingend vorgeschrieben — Stromschlaggefahr!`,
        });
      }
    });

    // --- Rule B: Overloaded Solar Regulator ---
    if (solarNodes.length > 0 && chargers.length > 0) {
      const totalSolarWatts = solarNodes.reduce((acc, node) => acc + (Number(node.data.watts) || 0), 0);
      const mpptCapacity =
        chargers.reduce((acc, node) => acc + (Number(node.data.amps) || 0), 0) * sysVoltage;

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
        const connectedEdges = [
          ...(edgesByTarget.get(shunt.id) || []),
          ...(edgesBySource.get(shunt.id) || []),
        ];
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

        const sourceIsMonitoredMinus =
          isMonitoredBattery(sourceNode) && !!edge.sourceHandle?.includes('minus');
        const targetIsMonitoredMinus =
          isMonitoredBattery(targetNode) && !!edge.targetHandle?.includes('minus');

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

    return warnings;
  }, [nodes, edges]);
}
