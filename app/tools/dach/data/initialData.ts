import { Node, Edge } from "reactflow";

export const initialNodes: Node[] = [
  {
    id: "dach-node-1",
    type: "dachNode",
    position: { x: 150, y: 100 },
    data: {
      label: "Dach-Element",
    },
  },
];

export const initialEdges: Edge[] = [];