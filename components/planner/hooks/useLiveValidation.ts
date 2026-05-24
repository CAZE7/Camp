import { useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { CableEdgeData } from '../../edges/CableEdge';

export interface ValidationWarning {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
}

export function useLiveValidation(
  nodes: Node[],
  edges: Edge<CableEdgeData>[],
  waterNodes?: Node[],
  waterEdges?: Edge[]
) {
  return useMemo(() => {
    const warnings: ValidationWarning[] = [];

    if (!nodes || !edges) return warnings;

    // --- Rule A: Missing Fuse on High Power Component ---
    // Look for edges coming from battery, inverter, solar charger on positive line
    edges.forEach((edge) => {
      if (edge.data?.edgeDomain === 'AC_230V') return; // Skip DC fuse warning for AC edges
      if (edge.sourceHandle?.includes('plus')) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        const isHighPowerSource = sourceNode?.type === 'battery' || sourceNode?.type === 'inverter' || ['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(sourceNode?.type as string);
        const isNotFuseBoxTarget = targetNode?.type !== 'fuse' && targetNode?.type !== 'busbar' && targetNode?.type !== 'shunt';

        if (isHighPowerSource && isNotFuseBoxTarget) {
          if (!edge.data?.fuseSize) {
             warnings.push({
               id: `missing-fuse-${edge.id}`,
               type: 'critical',
               message: `⚠️ Kritisch: Sicherung fehlt an Verbindung von ${sourceNode?.data?.label || sourceNode?.type}!`,
             });
          }
        }
      }
    });

    // --- Rule B: Overloaded Solar Regulator ---
    const solarNodes = nodes.filter(n => n.type === 'solar');
    const chargers = nodes.filter(n => ['charger', 'mpptController'].includes(n.type as string));

    if (solarNodes.length > 0 && chargers.length > 0) {
      const totalSolarWatts = solarNodes.reduce((acc, node) => acc + (Number(node.data.watts) || 0), 0);
      const mpptCapacity = chargers.reduce((acc, node) => acc + (Number(node.data.amps) || 0), 0) * 12; // MPPT capacity in Watts (amps × system voltage)

      if (totalSolarWatts > mpptCapacity) {
        warnings.push({
          id: 'solar-overload',
          type: 'warning',
          message: `⚠️ Hinweis: Solarregler unterdimensioniert (Solar: ${totalSolarWatts}W, MPPT max: ~${mpptCapacity}W).`,
        });
      }
    }

    // --- Rule C: Battery Capacity Alert ---
    const batteries = nodes.filter(n => n.type === 'battery');
    const consumers = nodes.filter(n => n.type === 'consumer' || n.type === 'consumer230v');

    if (batteries.length > 0 && consumers.length > 0) {
      const totalBatteryAh = batteries.reduce((acc, node) => acc + (Number(node.data.capacity) || 0), 0);

      // Calculate daily Ah consumption assuming 12V and average usage
      const totalDailyAh = consumers.reduce((acc, node) => {
        const watts = Number(node.data.watts) || 0;
        const hours = Number(node.data.hours) || 4; // default to 4 hours
        return acc + ((watts * hours) / 12);
      }, 0);

      if (totalDailyAh > totalBatteryAh) {
        warnings.push({
          id: 'battery-capacity',
          type: 'info',
          message: `💡 Tipp: Deine Batterie könnte knapp werden. Verbrauch: ~${Math.round(totalDailyAh)}Ah/Tag, Batterie: ${totalBatteryAh}Ah.`,
        });
      }
    }

    // --- Rule D: Direct Battery → Consumer/Inverter Without Protection ---
    edges.forEach((edge) => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const isBattery = sourceNode.type === 'battery';
      const isUnprotectedTarget =
        targetNode.type === 'consumer' ||
        targetNode.type === 'consumer230v' ||
        targetNode.type === 'inverter';

      if (isBattery && isUnprotectedTarget && !edge.data?.fuseSize) {
        warnings.push({
          id: `direct-battery-${edge.id}`,
          type: 'critical',
          message: `⚠️ Kritisch: Verbraucher direkt an Batterie ohne Sicherung!`,
        });
      }
    });

    return warnings;
  }, [nodes, edges, waterNodes, waterEdges]);
}
