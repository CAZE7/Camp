import { useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { CableEdgeData } from '../../edges/CableEdge';

import { getSystemVoltage } from '../utils/voltage';

export interface ValidationWarning {
  id: string;
  category: 'safety' | 'topology' | 'monitoring' | 'estimation';
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

    // --- Rule A: Quellschutz-Regel ---
    // Look for edges coming from battery, inverter, solar charger on positive line
    edges.forEach((edge) => {
      if (edge.data?.edgeDomain === 'AC_230V') return; // Skip DC fuse warning for AC edges
      if (edge.sourceHandle?.includes('plus')) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        const isHighPowerSource = sourceNode?.type === 'battery' || sourceNode?.type === 'inverter' || ['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(sourceNode?.type as string);
        const isProtectedTarget = targetNode?.type === 'fuse';

        if (isHighPowerSource && !isProtectedTarget) {
          if (!edge.data?.fuseSize) {
             warnings.push({
               id: `missing-fuse-${edge.id}`,
               category: 'safety',
               type: 'critical',
               message: `⚠️ Kritisch: Quellschutz fehlt! Die Leitung von ${sourceNode?.data?.label || sourceNode?.type} muss direkt am Anfang abgesichert werden (Kabel-Sicherung oder Sicherungsblock).`,
             });
          }
        }
      }
    });

    const sysVoltage = getSystemVoltage(nodes);

    // --- Rule B: Overloaded Solar Regulator ---
    const solarNodes = nodes.filter(n => n.type === 'solar');
    const chargers = nodes.filter(n => ['charger', 'mpptController'].includes(n.type as string));

    if (solarNodes.length > 0 && chargers.length > 0) {
      const totalSolarWatts = solarNodes.reduce((acc, node) => acc + (Number(node.data.watts) || 0), 0);
      const mpptCapacity = chargers.reduce((acc, node) => acc + (Number(node.data.amps) || 0), 0) * sysVoltage;

      if (totalSolarWatts > mpptCapacity) {
        warnings.push({
          id: 'solar-overload',
          category: 'estimation',
          type: 'warning',
          message: `⚠️ Hinweis: Solarregler unterdimensioniert (Solar: ~${totalSolarWatts}W, MPPT max: ~${Math.round(mpptCapacity)}W).`,
        });
      }
    }

    // --- Rule C: Battery Capacity Alert ---
    const batteries = nodes.filter(n => n.type === 'battery');
    const consumers = nodes.filter(n => n.type === 'consumer' || n.type === 'consumer230v');

    if (batteries.length > 0 && consumers.length > 0) {
      const totalBatteryAh = batteries.reduce((acc, node) => acc + (Number(node.data.capacity) || 0), 0);

      // Calculate daily Ah consumption using dynamic system voltage
      const totalDailyAh = consumers.reduce((acc, node) => {
        const watts = Number(node.data.watts) || 0;
        const hours = Number(node.data.hours) || 4; // default to 4 hours
        return acc + ((watts * hours) / sysVoltage);
      }, 0);

      if (totalDailyAh > totalBatteryAh) {
        warnings.push({
          id: 'battery-capacity',
          category: 'estimation',
          type: 'info',
          message: `💡 Tipp: Deine Batterie könnte knapp werden. Verbrauch: ~${Math.round(totalDailyAh)}Ah/Tag (geschätzt), Batterie: ${totalBatteryAh}Ah.`,
        });
      }
    }

    // --- Rule G: Inverter Protection ---
    const inverters = nodes.filter(n => n.type === 'inverter');
    inverters.forEach(inverter => {
      const incomingPlusEdges = edges.filter(e => e.target === inverter.id && e.targetHandle?.includes('plus'));
      const incomingMinusEdges = edges.filter(e => e.target === inverter.id && e.targetHandle?.includes('minus'));
      
      if (incomingMinusEdges.length === 0) {
        warnings.push({
          id: `inverter-no-minus-${inverter.id}`,
          category: 'topology',
          type: 'warning',
          message: `⚠️ Hinweis: Dem Wechselrichter fehlt die Rückleitung (Minuspol).`,
        });
      }

      incomingPlusEdges.forEach(edge => {
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
            category: 'safety',
            type: 'critical',
            message: `⚠️ Kritisch: Direkter Batterie-zu-Inverter-Pfad! Der Wechselrichter muss zwingend über eine eigene Sicherung abgesichert sein.`,
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
          category: 'topology',
          type: 'warning',
          message: `💡 Hinweis: Der Ladebooster (DC-DC) scheint nicht vollständig angeschlossen zu sein. Bitte Starterseite (Eingang) und Aufbaubatterie-Pfad (Ausgang) prüfen.`,
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
               category: 'monitoring',
               type: 'critical',
               message: `⚠️ Kritisch: Smart Shunt Bypass! Relevante Minus-Verbindungen (wie von ${otherNode.data?.label || otherNode.type}) dürfen nicht am Shunt vorbei direkt an Batterie-Minus hängen.`,
             });
          }
        }
      });
    }

    return warnings;
  }, [nodes, edges, waterNodes, waterEdges]);
}
