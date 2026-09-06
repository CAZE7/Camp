import type { CableFunction, CablePlannerEdge, PlannerNode } from './domain';
import { getHandlePolarity } from './handles';

export function findNode(nodes: PlannerNode[], id?: string | null): PlannerNode | undefined {
  if (!id) return undefined;
  return nodes.find((node) => node.id === id);
}

export function inferCableCurrentA(
  nodes: PlannerNode[],
  edge: Pick<CablePlannerEdge, 'source' | 'target'>,
  fallbackToTotalConsumers = true
): number {
  const sourceNode = findNode(nodes, edge.source);
  const targetNode = findNode(nodes, edge.target);

  if (sourceNode?.type === 'consumer') {
    return (Number(sourceNode.data?.watts) || 0) / 12;
  }
  if (targetNode?.type === 'consumer') {
    return (Number(targetNode.data?.watts) || 0) / 12;
  }
  if (sourceNode?.type === 'charger') {
    return Number(sourceNode.data?.amps) || 0;
  }
  if (targetNode?.type === 'charger') {
    return Number(targetNode.data?.amps) || 0;
  }

  if (!fallbackToTotalConsumers) return 0;

  return nodes
    .filter((node) => node.type === 'consumer')
    .reduce((sum, node) => sum + (Number(node.data?.watts) || 0) / 12, 0);
}

export function inferCableFunction(
  nodes: PlannerNode[],
  edge: Pick<CablePlannerEdge, 'source' | 'target' | 'sourceHandle' | 'targetHandle' | 'data'>,
  currentA: number
): CableFunction {
  if (edge.data?.cableFunction) return edge.data.cableFunction;

  const sourceNode = findNode(nodes, edge.source);
  const targetNode = findNode(nodes, edge.target);
  const sourceType = sourceNode?.type;
  const targetType = targetNode?.type;
  const sourceLabel = String(sourceNode?.data?.label ?? '').toLowerCase();
  const targetLabel = String(targetNode?.data?.label ?? '').toLowerCase();
  const sourcePolarity = getHandlePolarity(edge.sourceHandle);
  const targetPolarity = getHandlePolarity(edge.targetHandle);

  if (sourcePolarity === 'minus' || targetPolarity === 'minus') return 'negative';
  if (sourceType === 'solar' || targetType === 'solar') return 'solar';
  if (sourceType === 'shorePower' || targetType === 'shorePower') return 'shore';
  if (sourceType === 'inverter' || targetType === 'inverter') return 'inverter';
  if (sourceType === 'busbar' || targetType === 'busbar') return 'busbar';
  if (sourceType === 'fuse' || targetType === 'fuse') return 'main';
  if (sourceType === 'charger' || targetType === 'charger') {
    if (sourceLabel.includes('mppt') || targetLabel.includes('mppt')) return 'charging';
    return 'charging';
  }
  if (sourceType === 'battery' && (targetType === 'consumer' || targetType === 'inverter')) {
    return 'positive';
  }
  if (targetType === 'battery' && (sourceType === 'consumer' || sourceType === 'inverter')) {
    return 'negative';
  }
  if (currentA >= 20) return 'main';
  return 'secondary';
}

export function strokeWidthForCrossSection(crossSection: number): number {
  if (crossSection <= 1.5) return 2;
  if (crossSection <= 4) return 4;
  if (crossSection <= 6) return 6;
  return 10;
}
