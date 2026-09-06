import { Node } from 'reactflow';
import { BatteryNodeData } from '../../nodes/types';

/**
 * Dynamically calculates the nominal system voltage based on the batteries present in the graph.
 * Defaults to 12.8V (typical LiFePO4) if no explicit voltage or battery is found.
 */
export function getSystemVoltage(nodes: Node[]): number {
  const batteries = nodes.filter(n => n.type === 'battery');
  if (batteries.length === 0) return 12.8;

  // Try to find an explicit nominalVoltage set on any battery
  for (const b of batteries) {
    const data = b.data as BatteryNodeData;
    if (data.nominalVoltage) {
      return Number(data.nominalVoltage);
    }
  }

  // Fallback to chemistry-based estimation
  const firstBatteryData = batteries[0].data as BatteryNodeData;
  const chem = firstBatteryData.chemistry?.toLowerCase();
  
  if (chem === 'agm' || chem === 'lead' || chem === 'gel') {
    return 12.0;
  }
  
  // Default for lifepo4 and others
  return 12.8;
}
