import { Node } from 'reactflow';
import { RoofNodeData } from '@/components/nodes/types';
import { VehicleTemplate } from '@/lib/vehicleTemplates';

export const SAFE_MARGINS = {
  front: 15, // cm
  rear: 5,   // cm
  left: 5,   // cm
  right: 5,  // cm
};

type RoofNode = Node<RoofNodeData>;

function nodeRect(node: RoofNode): { x: number; y: number; w: number; h: number } {
  const w = node.width || (node.type === 'roofSolar' ? 200 : 80);
  const h = node.height || (node.type === 'roofSolar' ? 120 : 80);
  return { x: node.position.x, y: node.position.y, w, h };
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  // Zwei Rechtecke überlappen, wenn sie nicht vollständig nebeneinander
  // oder übereinander liegen.
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Prüft alle Dach-Komponenten gegen den sicheren Bereich und auf
 * gegenseitige Überlappung. Setzt `isInvalid`, wenn eine Komponente
 * außerhalb liegt, und `isOverlapping`, wenn sie eine andere schneidet.
 */
export const validateRoofNodes = (
  nds: RoofNode[],
  selectedVehicle: VehicleTemplate
): RoofNode[] => {
  const roofW_px = selectedVehicle.roofWidth * 200;
  const roofH_px = selectedVehicle.roofLength * 200;

  const safeMinX = SAFE_MARGINS.left * 2;
  const safeMaxX = roofW_px - (SAFE_MARGINS.right * 2);
  const safeMinY = SAFE_MARGINS.front * 2;
  const safeMaxY = roofH_px - (SAFE_MARGINS.rear * 2);

  const relevant = nds.filter((node) => node.id !== 'background');
  const rects = new Map(relevant.map((node) => [node.id, nodeRect(node)]));

  const overlapping = new Set<string>();
  for (let i = 0; i < relevant.length; i++) {
    const a = relevant[i];
    const ra = rects.get(a.id)!;
    for (let j = i + 1; j < relevant.length; j++) {
      const b = relevant[j];
      const rb = rects.get(b.id)!;
      if (rectsOverlap(ra, rb)) {
        overlapping.add(a.id);
        overlapping.add(b.id);
      }
    }
  }

  return nds.map((node: RoofNode) => {
    if (node.id === 'background') return node;

    const rect = rects.get(node.id)!;
    const isOutside =
      rect.x < safeMinX ||
      rect.y < safeMinY ||
      rect.x + rect.w > safeMaxX ||
      rect.y + rect.h > safeMaxY;
    const isOverlapping = overlapping.has(node.id);

    const nextData = { ...node.data };
    let changed = false;
    if (nextData.isInvalid !== isOutside) {
      nextData.isInvalid = isOutside;
      changed = true;
    }
    // Überlappung nur als Flag schreiben, wenn sie aktiv ist oder zuvor
    // aktiv war (zurücksetzen). Ein initial fehlendes Feld bleibt leer,
    // damit bestehende Knotenreferenzen nicht unnötig ersetzt werden.
    if (isOverlapping || nextData.isOverlapping) {
      nextData.isOverlapping = isOverlapping;
      changed = true;
    }
    if (changed) {
      return { ...node, data: nextData };
    }
    return node;
  });
};

export const isAnyRoofNodeInvalid = (nds: RoofNode[]): boolean =>
  nds.some((node) => node.id !== 'background' && (node.data?.isInvalid || node.data?.isOverlapping));
