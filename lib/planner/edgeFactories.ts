import { VDE_MIN_CROSS_SECTION } from '../vde-standards';
import type { CablePlannerEdge, PlannerConnection, WaterPlannerEdge } from './domain';

export function createCableEdgeFromConnection(connection: PlannerConnection, id: string): CablePlannerEdge | null {
  if (!connection.source || !connection.target) return null;
  return {
    id, source: connection.source, target: connection.target,
    sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle,
    type: 'cableEdge', data: { length: 3, crossSection: VDE_MIN_CROSS_SECTION },
  };
}

export function createWaterPipeEdgeFromConnection(connection: PlannerConnection, id: string): WaterPlannerEdge | null {
  if (!connection.source || !connection.target) return null;
  return {
    id, source: connection.source, target: connection.target,
    sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle,
    type: 'waterPipe', data: {},
  };
}
