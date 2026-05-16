import { useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { CableEdgeData } from '../../edges/CableEdge';

export interface ValidationWarning {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
}

export function useLiveValidation(nodes: Node[], edges: Edge<CableEdgeData>[]) {
  return useMemo(() => {
    const warnings: ValidationWarning[] = [];

    if (!nodes || !edges) return warnings;

    // --- Rule A: Missing Fuse on High Power Component ---
    // Look for edges coming from battery, inverter, solar charger on positive line
    edges.forEach((edge) => {
      if (edge.sourceHandle?.includes('plus') || edge.targetHandle?.includes('plus')) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        const isHighPowerSource = sourceNode?.type === 'battery' || sourceNode?.type === 'inverter' || sourceNode?.type === 'charger';
        const isNotFuseBoxTarget = targetNode?.type !== 'fuse' && targetNode?.type !== 'busbar';

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
    const chargers = nodes.filter(n => n.type === 'charger');

    if (solarNodes.length > 0 && chargers.length > 0) {
      const totalSolarWatts = solarNodes.reduce((acc, node) => acc + (Number(node.data.watts) || 0), 0);
      const mpptCapacity = chargers.reduce((acc, node) => acc + (Number(node.data.amps) || 0), 0) * 12; // roughly Max Watts

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
        const hours = Number(node.data.hours) || 4; // default to 4 hours if not set
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

    return warnings;
  }, [nodes, edges]);
}
