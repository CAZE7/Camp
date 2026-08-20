import { describe, it, expect } from 'vitest';
import { validateRoofNodes, SAFE_MARGINS } from './validation';
import { Node } from 'reactflow';
import { RoofNodeData } from '@/components/nodes/types';
import { VehicleTemplate } from '@/lib/vehicleTemplates';

describe('validateRoofNodes', () => {
  const mockVehicle: VehicleTemplate = {
    id: 'test-vehicle',
    brand: 'Test',
    model: 'Vehicle',
    version: 'L1H1',
    length: 5,
    width: 2,
    height: 2,
    roofLength: 4,  // 800px
    roofWidth: 1.5, // 300px
  };

  const roofW_px = mockVehicle.roofWidth * 200; // 300
  const roofH_px = mockVehicle.roofLength * 200; // 800

  const safeMinX = SAFE_MARGINS.left * 2; // 10
  const safeMaxX = roofW_px - (SAFE_MARGINS.right * 2); // 300 - 10 = 290
  const safeMinY = SAFE_MARGINS.front * 2; // 30
  const safeMaxY = roofH_px - (SAFE_MARGINS.rear * 2); // 800 - 10 = 790

  const createNode = (
    id: string,
    x: number,
    y: number,
    type: string = 'roofSolar',
    width: number = 200,
    height: number = 120,
    isInvalid: boolean = false
  ): Node<RoofNodeData> => ({
    id,
    type,
    position: { x, y },
    width,
    height,
    data: {
      width: width / 2,
      height: height / 2,
      isInvalid,
      onNodeResize: () => {}
    },
    selected: false,
    draggable: true,
  });

  describe('Background Node', () => {
    it('should ignore background node', () => {
      const bgNode = createNode('background', 0, 0, 'roofBackground', roofW_px, roofH_px);
      const result = validateRoofNodes([bgNode], mockVehicle);
      expect(result[0]).toEqual(bgNode);
    });
  });

  describe('Safe Margins Validation', () => {
    it('should mark node as valid if completely inside safe margins', () => {
      // Top-left just inside safe margins
      const validNode = createNode('node-1', safeMinX, safeMinY, 'roofSolar', 100, 100);
      const result = validateRoofNodes([validNode], mockVehicle);
      expect(result[0].data.isInvalid).toBe(false);

      // Bottom-right just inside safe margins
      const validNode2 = createNode('node-2', safeMaxX - 100, safeMaxY - 100, 'roofSolar', 100, 100);
      const result2 = validateRoofNodes([validNode2], mockVehicle);
      expect(result2[0].data.isInvalid).toBe(false);
    });

    it('should mark node as invalid if outside safe margins (left)', () => {
      const invalidNode = createNode('node-1', safeMinX - 1, safeMinY, 'roofSolar', 100, 100);
      const result = validateRoofNodes([invalidNode], mockVehicle);
      expect(result[0].data.isInvalid).toBe(true);
    });

    it('should mark node as invalid if outside safe margins (right)', () => {
      const invalidNode = createNode('node-1', safeMaxX - 99, safeMinY, 'roofSolar', 100, 100); // 290 - 99 + 100 = 291 > 290
      const result = validateRoofNodes([invalidNode], mockVehicle);
      expect(result[0].data.isInvalid).toBe(true);
    });

    it('should mark node as invalid if outside safe margins (front/top)', () => {
      const invalidNode = createNode('node-1', safeMinX, safeMinY - 1, 'roofSolar', 100, 100);
      const result = validateRoofNodes([invalidNode], mockVehicle);
      expect(result[0].data.isInvalid).toBe(true);
    });

    it('should mark node as invalid if outside safe margins (rear/bottom)', () => {
      const invalidNode = createNode('node-1', safeMinX, safeMaxY - 99, 'roofSolar', 100, 100); // 790 - 99 + 100 = 791 > 790
      const result = validateRoofNodes([invalidNode], mockVehicle);
      expect(result[0].data.isInvalid).toBe(true);
    });
  });

  describe('Fallback Dimensions', () => {
    it('should handle missing width and height falling back to default', () => {
      const nodeWithoutSize: Node<RoofNodeData> = {
        id: 'node-1',
        type: 'roofSolar',
        position: { x: safeMaxX - 199, y: safeMaxY - 119 }, // Default width 200, height 120. Right edge: max - 199 + 200 > max.
        data: {
          width: 100,
          height: 60,
          onNodeResize: () => {}
        },
        selected: false,
        draggable: true,
      };

      // safeMaxX - 199 + 200 = safeMaxX + 1 > safeMaxX -> invalid
      const resultInvalid = validateRoofNodes([nodeWithoutSize], mockVehicle);
      expect(resultInvalid[0].data.isInvalid).toBe(true);

      const validNodeWithoutSize: Node<RoofNodeData> = {
        id: 'node-2',
        type: 'roofSolar',
        position: { x: safeMaxX - 200, y: safeMaxY - 120 }, // Exactly fitting default size 200x120
        data: {
          width: 100,
          height: 60,
          onNodeResize: () => {}
        },
        selected: false,
        draggable: true,
      };
      const resultValid = validateRoofNodes([validNodeWithoutSize], mockVehicle);
      expect(resultValid[0].data.isInvalid).toBe(false);
    });
  });

  describe('State Mutation', () => {
    it('should not mutate original node object if state does not change', () => {
      const validNode = createNode('node-1', safeMinX, safeMinY, 'roofSolar', 100, 100, false);
      const result = validateRoofNodes([validNode], mockVehicle);
      expect(result[0]).toBe(validNode); // exact reference match
    });

    it('should mutate node object only if state changes', () => {
      const invalidNode = createNode('node-1', safeMinX - 10, safeMinY, 'roofSolar', 100, 100, false);
      const result = validateRoofNodes([invalidNode], mockVehicle);
      expect(result[0]).not.toBe(invalidNode); // reference changed
      expect(result[0].data.isInvalid).toBe(true);
    });
  });

  describe('Overlap Detection', () => {
    it('marks two overlapping solar panels', () => {
      const a = createNode('a', safeMinX, safeMinY, 'roofSolar', 100, 100);
      const b = createNode('b', safeMinX + 50, safeMinY + 50, 'roofSolar', 100, 100);
      const result = validateRoofNodes([a, b], mockVehicle);
      expect(result.find((n) => n.id === 'a')?.data.isOverlapping).toBe(true);
      expect(result.find((n) => n.id === 'b')?.data.isOverlapping).toBe(true);
    });

    it('does not mark side-by-side non-overlapping panels', () => {
      const a = createNode('a', safeMinX, safeMinY, 'roofSolar', 80, 80);
      const b = createNode('b', safeMinX + 90, safeMinY, 'roofSolar', 80, 80);
      const result = validateRoofNodes([a, b], mockVehicle);
      expect(result.find((n) => n.id === 'a')?.data.isOverlapping).toBeFalsy();
      expect(result.find((n) => n.id === 'b')?.data.isOverlapping).toBeFalsy();
    });
  });
});
