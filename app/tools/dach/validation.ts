import { Node } from 'reactflow';
import { RoofNodeData } from '@/components/nodes/types';
import { VehicleTemplate } from '@/lib/vehicleTemplates';

export const SAFE_MARGINS = {
  front: 15, // cm
  rear: 5,   // cm
  left: 5,   // cm
  right: 5,  // cm
};

export const validateRoofNodes = (
  nds: Node<RoofNodeData>[],
  selectedVehicle: VehicleTemplate
): Node<RoofNodeData>[] => {
  const roofW_px = selectedVehicle.roofWidth * 200;
  const roofH_px = selectedVehicle.roofLength * 200;

  const safeMinX = SAFE_MARGINS.left * 2;
  const safeMaxX = roofW_px - (SAFE_MARGINS.right * 2);
  const safeMinY = SAFE_MARGINS.front * 2;
  const safeMaxY = roofH_px - (SAFE_MARGINS.rear * 2);

  return nds.map((node: Node<RoofNodeData>) => {
    if (node.id === 'background') return node;

    const nodeW = node.width || (node.type === 'roofSolar' ? 200 : 80);
    const nodeH = node.height || (node.type === 'roofSolar' ? 120 : 80);

    const isOutside =
      node.position.x < safeMinX ||
      node.position.y < safeMinY ||
      (node.position.x + nodeW) > safeMaxX ||
      (node.position.y + nodeH) > safeMaxY;

    if (node.data.isInvalid !== isOutside) {
      return { ...node, data: { ...node.data, isInvalid: isOutside } };
    }
    return node;
  });
};
