import type { PlannerNode, PlannerNodeData, PlannerPosition } from './domain';
import { defaultDataForKind, type PlannerNodeKind } from './domainModel';

export type CreatePlannerNodeInput = {
  id: string;
  type: string;
  label?: string;
  position: PlannerPosition;
};

/**
 * Liefert die fachlichen Standarddaten für eine Knotenart.
 *
 * Delegiert an das zentrale, typisierte Domain-Modell
 * (`domainModel.defaultDataForKind`) und ergänzt das Label. Damit gibt es
 * nur EINE Quelle für die Default-Daten — keine Duplikation mehr.
 */
export function getDefaultNodeData(type: string, label?: string): PlannerNodeData {
  const data: PlannerNodeData = defaultDataForKind(type as PlannerNodeKind) as PlannerNodeData;
  return { ...data, label };
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
