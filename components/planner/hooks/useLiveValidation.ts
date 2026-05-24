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
        const isNotFuseBoxTarget = targetNode?.type !== 'fuse';

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

    // --- Rule D (Replaced by Rule G): Inverter Protection ---
    const inverters = nodes.filter(n => n.type === 'inverter');
    inverters.forEach(inverter => {
      const incomingEdges = edges.filter(e => e.target === inverter.id && e.targetHandle?.includes('plus'));
      
      incomingEdges.forEach(edge => {
        let isProtected = false;
        if (edge.data?.fuseSize) {
          isProtected = true;
        } else {
          const sourceNode = nodes.find(n => n.id === edge.source);
          if (sourceNode?.type === 'fuse') {
             isProtected = true;
          }
        }
        
        if (!isProtected) {
          warnings.push({
            id: `inverter-unprotected-${edge.id}`,
            type: 'critical',
            message: `⚠️ Kritisch: Der Wechselrichter muss zwingend über eine Sicherung (Kabel-Sicherung oder Sicherungs-Element) abgesichert sein!`,
          });
        }
      });
    });

    // --- Rule E: DC-DC Charger Connection ---
    const dcdcChargers = nodes.filter(n => n.type === 'dcdcCharger');
    dcdcChargers.forEach(charger => {
      const hasInput = edges.some(e => e.target === charger.id);
      const hasOutput = edges.some(e => e.source === charger.id);
      
      if (!hasInput || !hasOutput) {
        warnings.push({
          id: `dcdc-unconnected-${charger.id}`,
          type: 'warning',
          message: `💡 Hinweis: Der Ladebooster (DC-DC) scheint nicht vollständig angeschlossen zu sein (Eingang zur Starterbatterie / Ausgang zur Aufbaubatterie prüfen).`,
        });
      }
    });

    // --- Rule F: Smart Shunt Bypass ---
    const shunts = nodes.filter(n => n.type === 'shunt');
    if (shunts.length > 0) {
      edges.forEach(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        const sourceNode = nodes.find(n => n.id === edge.source);
        
        const isBatteryMinusConnection = 
          (targetNode?.type === 'battery' && edge.targetHandle?.includes('minus')) ||
          (sourceNode?.type === 'battery' && edge.sourceHandle?.includes('minus'));
          
        if (isBatteryMinusConnection) {
          const otherNode = sourceNode?.type === 'battery' ? targetNode : sourceNode;
          if (otherNode && otherNode.type !== 'shunt' && otherNode.type !== 'battery') {
             warnings.push({
               id: `shunt-bypass-${edge.id}`,
               type: 'critical',
               message: `⚠️ Kritisch: Smart Shunt wird umgangen! Das Gerät "${otherNode.data?.label || otherNode.type}" ist direkt am Batterie-Minuspol angeschlossen.`,
             });
          }
        }
      });
    }

    return warnings;
  }, [nodes, edges, waterNodes, waterEdges]);
}
