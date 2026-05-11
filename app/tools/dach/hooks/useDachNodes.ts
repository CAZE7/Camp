import { useCallback, useMemo, useEffect } from 'react';
import { Node, NodeChange, OnNodesChange, applyNodeChanges, useNodesState } from 'reactflow';
import { OnNodeResize, RoofNodeData } from '@/components/nodes/types';
import { VehicleTemplate } from '@/lib/vehicleTemplates';
import { SAFE_MARGINS, validateRoofNodes } from '../validation';
import { useAppStore } from '@/lib/store';

export function useDachNodes(selectedVehicle: VehicleTemplate) {
  const [nodes, setNodes, onNodesChangeReactFlow] = useNodesState<RoofNodeData>([]);
  const { setCalculatedSolarWatts } = useAppStore();

  const onNodeResize: OnNodeResize = useCallback((event, { id, width, height }) => {
    setNodes((nds: Node<RoofNodeData>[]) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            width,
            height,
            style: {
              ...node.style,
              width,
              height,
            },
            data: {
              ...node.data,
              width: width / 2, // px to cm
              height: height / 2, // px to cm
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const initialNodes: Node<RoofNodeData>[] = useMemo(() => [
    {
      id: 'background',
      type: 'roofBackground',
      position: { x: 0, y: 0 },
      draggable: false,
      selectable: false,
      width: selectedVehicle.roofWidth * 200, // m to px (100cm/m * 2px/cm)
      height: selectedVehicle.roofLength * 200,
      style: {
        width: selectedVehicle.roofWidth * 200,
        height: selectedVehicle.roofLength * 200,
      },
      data: {
        width: selectedVehicle.roofWidth * 100, // m to cm
        height: selectedVehicle.roofLength * 100,
        safeMargins: SAFE_MARGINS,
        onNodeResize
      }
    },
    {
      id: 'solar-1',
      type: 'roofSolar',
      position: { x: 40, y: 100 }, // px (20cm * 2, 50cm * 2)
      width: 200, // px (100cm * 2)
      height: 120, // px (60cm * 2)
      style: {
        width: 200,
        height: 120,
      },
      data: { watts: 200, width: 100, height: 60, onNodeResize }
    }
  ], [selectedVehicle, onNodeResize]);

  // Set initial nodes or reset on vehicle change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  const validateNodes = useCallback((nds: Node<RoofNodeData>[]) => {
    return validateRoofNodes(nds, selectedVehicle);
  }, [selectedVehicle]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds: Node<RoofNodeData>[]) => {
        const nextNodes = applyNodeChanges(changes, nds);
        return validateNodes(nextNodes as Node<RoofNodeData>[]);
      });
    },
    [setNodes, validateNodes]
  );

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.selected && (n.type === 'roofSolar' || n.type === 'roofWindow'));
  }, [nodes]);

  const updateSelectedNodeWatts = useCallback((watts: number) => {
    if (!selectedNode || selectedNode.type !== 'roofSolar') return;
    setNodes((nds: Node<RoofNodeData>[]) =>
      nds.map(node => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              watts
            }
          };
        }
        return node;
      })
    );
  }, [selectedNode, setNodes]);

  const updateSelectedNodeWidth = useCallback((widthCm: number) => {
    if (!selectedNode) return;
    setNodes((nds: Node<RoofNodeData>[]) => {
      const nextNodes = nds.map(node => {
        if (node.id === selectedNode.id) {
          const nextWidth = widthCm * 2;
          return {
            ...node,
            width: nextWidth,
            style: {
              ...node.style,
              width: nextWidth,
            },
            data: {
              ...node.data,
              width: widthCm
            }
          };
        }
        return node;
      });
      return validateNodes(nextNodes);
    });
  }, [selectedNode, setNodes, validateNodes]);

  const updateSelectedNodeHeight = useCallback((heightCm: number) => {
    if (!selectedNode) return;
    setNodes((nds: Node<RoofNodeData>[]) => {
      const nextNodes = nds.map(node => {
        if (node.id === selectedNode.id) {
          const nextHeight = heightCm * 2;
          return {
            ...node,
            height: nextHeight,
            style: {
              ...node.style,
              height: nextHeight,
            },
            data: {
              ...node.data,
              height: heightCm
            }
          };
        }
        return node;
      });
      return validateNodes(nextNodes);
    });
  }, [selectedNode, setNodes, validateNodes]);

  const totalRoofSolarWatts = useMemo(() => {
    let total = 0;
    const len = nodes.length;
    for (let i = 0; i < len; i++) {
      const n = nodes[i];
      if (n.type === 'roofSolar' && !n.data.isInvalid) {
        const data = n.data as { watts?: number } | undefined;
        total += data?.watts || 0;
      }
    }
    return total;
  }, [nodes]);

  useEffect(() => {
    setCalculatedSolarWatts(totalRoofSolarWatts);
  }, [totalRoofSolarWatts, setCalculatedSolarWatts]);

  return {
    nodes,
    setNodes,
    onNodesChange,
    selectedNode,
    updateSelectedNodeWatts,
    updateSelectedNodeWidth,
    updateSelectedNodeHeight,
    totalRoofSolarWatts,
    validateNodes,
    onNodeResize
  };
}
