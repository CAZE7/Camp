import { Node } from 'reactflow';
import { RoofNodeData } from '@/components/nodes/types';
import { VehicleTemplate } from '@/lib/vehicleTemplates';

export const SAFE_MARGINS = {
  front: 15, // cm
  rear: 5,   // cm
  left: 5,   // cm
  right: 5,  // cm
};

// 1 cm = 2 px; Dachmaße in m → px = m * 100 cm/m * 2 px/cm = * 200.
const CM_TO_PX = 2;
const M_TO_PX = 100 * CM_TO_PX; // 200

type RoofBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/**
 * Berechnet die AABB-Bounds eines Dach-Knotens in Pixeln. Nutzt explizite
 * `width`/`height`, sonst einen plausiblen Typ-Default.
 */
function getNodeBounds(node: Node<RoofNodeData>): RoofBounds | null {
  if (node.id === 'background') return null;
  const w = node.width ?? (node.type === 'roofSolar' ? 200 : 80);
  const h = node.height ?? (node.type === 'roofSolar' ? 120 : 80);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + w,
    bottom: node.position.y + h,
  };
}

/** AABB-Überlappungstest mit 1 px Toleranz für Gleitkomma-Ungenauigkeiten. */
function boundsOverlap(a: RoofBounds, b: RoofBounds): boolean {
  return !(
    a.right <= b.left + 1 ||
    b.right <= a.left + 1 ||
    a.bottom <= b.top + 1 ||
    b.bottom <= a.top + 1
  );
}

/**
 * Prüft gegen die Safe-Margins und auf Überlappung zwischen allen belegten
 * Dach-Elementen (Solarmodule, Dachfenster, Dachhauben, …). Kennzeichnet
 * Verstöße über `data.isInvalid` bzw. `data.overlapWith`.
 */
export const validateRoofNodes = (
  nds: Node<RoofNodeData>[],
  selectedVehicle: VehicleTemplate
): Node<RoofNodeData>[] => {
  const roofW_px = selectedVehicle.roofWidth * M_TO_PX;
  const roofH_px = selectedVehicle.roofLength * M_TO_PX;

  const safeMinX = SAFE_MARGINS.left * CM_TO_PX;
  const safeMaxX = roofW_px - SAFE_MARGINS.right * CM_TO_PX;
  const safeMinY = SAFE_MARGINS.front * CM_TO_PX;
  const safeMaxY = roofH_px - SAFE_MARGINS.rear * CM_TO_PX;

  // 1. Bounds pro Knoten einmal berechnen.
  const itemNodes = nds.filter(n => n.id !== 'background');
  const boundsById = new Map<string, RoofBounds>();
  for (const node of itemNodes) {
    const b = getNodeBounds(node);
    if (b) boundsById.set(node.id, b);
  }

  // 2. Paarweise Überlappungsprüfung.
  const overlappingIds = new Set<string>();
  const items = itemNodes.filter(n => boundsById.has(n.id));
  for (let i = 0; i < items.length; i++) {
    const a = boundsById.get(items[i].id)!;
    for (let j = i + 1; j < items.length; j++) {
      const b = boundsById.get(items[j].id)!;
      if (boundsOverlap(a, b)) {
        overlappingIds.add(items[i].id);
        overlappingIds.add(items[j].id);
      }
    }
  }

  return nds.map((node: Node<RoofNodeData>) => {
    if (node.id === 'background') return node;

    const bounds = boundsById.get(node.id);
    const nodeW = node.width ?? (node.type === 'roofSolar' ? 200 : 80);
    const nodeH = node.height ?? (node.type === 'roofSolar' ? 120 : 80);

    const isOutside =
      node.position.x < safeMinX ||
      node.position.y < safeMinY ||
      (node.position.x + nodeW) > safeMaxX ||
      (node.position.y + nodeH) > safeMaxY;

    const isOverlapping = overlappingIds.has(node.id);
    const isInvalid = isOutside || isOverlapping;

    // Referenzgleichheit, wenn sich nichts geändert hat (kein Re-Render).
    const prevOverlap = node.data.overlapWith === true;
    if (node.data.isInvalid === isInvalid && prevOverlap === isOverlapping) {
      return node;
    }

    return {
      ...node,
      data: { ...node.data, isInvalid, overlapWith: isOverlapping },
    };
  });
};
