import { useCallback, useMemo, useEffect, useRef } from 'react';
import {
  type Node,
  type NodeChange,
  type OnNodesChange,
  applyNodeChanges,
  useNodesState,
} from '@xyflow/react';
import { type OnNodeResize, type RoofNodeData } from '@/components/nodes/types';
import { type VehicleTemplate } from '@/lib/vehicleTemplates';
import { SAFE_MARGINS, validateRoofNodes } from '../validation';
import { saveDachState, serializeDachState, type DachPlanState } from '../dachState';
import { useAppStore } from '@/lib/store';

export function useDachNodes(selectedVehicle: VehicleTemplate) {
  // v12: `useNodesState` ist über den NODE-Typ generisch, nicht über die Datenform.
  const [nodes, setNodes] = useNodesState<Node<RoofNodeData>>([]);
  const { setCalculatedSolarWatts } = useAppStore();

  const onNodeResize: OnNodeResize = useCallback(
    (event, { id, width, height }) => {
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
    },
    [setNodes]
  );

  const initialNodes: Node<RoofNodeData>[] = useMemo(
    () => [
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
          onNodeResize,
        },
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
        data: { watts: 200, width: 100, height: 60, onNodeResize },
      },
    ],
    [selectedVehicle, onNodeResize]
  );

  // Set initial nodes or reset on vehicle change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  const validateNodes = useCallback(
    (nds: Node<RoofNodeData>[]) => {
      return validateRoofNodes(nds, selectedVehicle);
    },
    [selectedVehicle]
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds: Node<RoofNodeData>[]) => {
        const nextNodes = applyNodeChanges(changes, nds);
        return validateNodes(nextNodes);
      });
    },
    [setNodes, validateNodes]
  );

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.selected && (n.type === 'roofSolar' || n.type === 'roofWindow'));
  }, [nodes]);

  const updateSelectedNodeWatts = useCallback(
    (watts: number) => {
      if (!selectedNode || selectedNode.type !== 'roofSolar') return;
      setNodes((nds: Node<RoofNodeData>[]) =>
        nds.map((node) => {
          if (node.id === selectedNode.id) {
            return {
              ...node,
              data: {
                ...node.data,
                watts,
              },
            };
          }
          return node;
        })
      );
    },
    [selectedNode, setNodes]
  );

  const updateSelectedNodeWidth = useCallback(
    (widthCm: number) => {
      if (!selectedNode) return;
      setNodes((nds: Node<RoofNodeData>[]) => {
        const nextNodes = nds.map((node) => {
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
                width: widthCm,
              },
            };
          }
          return node;
        });
        return validateNodes(nextNodes);
      });
    },
    [selectedNode, setNodes, validateNodes]
  );

  const updateSelectedNodeHeight = useCallback(
    (heightCm: number) => {
      if (!selectedNode) return;
      setNodes((nds: Node<RoofNodeData>[]) => {
        const nextNodes = nds.map((node) => {
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
                height: heightCm,
              },
            };
          }
          return node;
        });
        return validateNodes(nextNodes);
      });
    },
    [selectedNode, setNodes, validateNodes]
  );

  /*
   * Persistenz: Die Anordnung überlebt den Wechsel in den Schaltplan und
   * zurück (früher blieb nur die Watt-Summe im globalen Store, das Dach
   * selbst war danach leer). Gespeichert wird erst, wenn der Stand des
   * aktuellen Fahrzeugs „gesetzt" ist: Der erste Effektlauf nach Mount
   * oder Fahrzeugwechsel gehört dem Zurücksetzen auf die Startanordnung
   * bzw. dem Anwenden eines wiederhergestellten Stands — ihn zu speichern
   * würde den geretteten Stand mit dem Startzustand überschreiben.
   */
  const persistArmedRef = useRef(false);
  useEffect(() => {
    persistArmedRef.current = false;
  }, [selectedVehicle.id]);
  useEffect(() => {
    if (!persistArmedRef.current) {
      persistArmedRef.current = true;
      return;
    }
    saveDachState(serializeDachState(selectedVehicle.id, nodes));
  }, [nodes, selectedVehicle.id]);

  /**
   * Einen gespeicherten oder per Link geteilten Stand anwenden. Die
   * Hintergrundfläche kommt immer frisch aus der Fahrzeugvorlage (Maße!),
   * die platzierten Elemente erhalten Callback und Prüfvermerke neu.
   * Fremde Fahrzeugstände lehnt die Funktion ab — der Aufrufer stellt
   * vorher das Fahrzeug um.
   */
  const applyDachState = useCallback(
    (state: DachPlanState): boolean => {
      if (state.vehicleId !== selectedVehicle.id) return false;
      const background = initialNodes[0];
      if (!background) return false;
      const restored: Node<RoofNodeData>[] = state.nodes.map((saved) => ({
        id: saved.id,
        type: saved.type,
        position: saved.position,
        width: saved.width,
        height: saved.height,
        style: { width: saved.width, height: saved.height },
        data: { ...saved.data, onNodeResize },
      }));
      setNodes(validateNodes([background, ...restored]));
      return true;
    },
    [initialNodes, onNodeResize, selectedVehicle.id, setNodes, validateNodes]
  );

  const totalRoofSolarWatts = useMemo(() => {
    let total = 0;
    for (const n of nodes) {
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
    onNodeResize,
    applyDachState,
  };
}
