import type { PlannerNode, PlannerPosition } from './domain';

export type CreatePlannerNodeInput = {
  id: string;
  type: string;
  label?: string;
  position: PlannerPosition;
};

export function getDefaultNodeData(type: string, label?: string): PlannerNode['data'] {
  const data: PlannerNode['data'] = { label };

  if (type === 'battery') {
    return { ...data, capacity: 100, chemistry: 'LiFePO4' };
  }
  if (type === 'consumer') {
    return { ...data, watts: 50, hours: 2 };
  }
  if (type === 'charger') {
    return { ...data, amps: 10 };
  }
  if (type === 'fuse') {
    return { ...data, rating: 30 };
  }
  if (type === 'shorePower') {
    return { ...data, hasRcd: false };
  }
  if (type === 'consumer230v') {
    return { ...data, watts: 1000, hours: 0.5 };
  }
  if (type === 'solar') {
    return { ...data, voltage: 18, amps: 5 };
  }

  return data;
}

export function createPlannerNode({
  id,
  type,
  label,
  position,
}: CreatePlannerNodeInput): PlannerNode {
  return {
    id,
    type,
    position,
    data: getDefaultNodeData(type, label),
  };
}
