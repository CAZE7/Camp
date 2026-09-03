import type { Node } from 'reactflow';
import { getNodeLayoutSize } from './layout';

export const BACKBONE_GROUP_ID = '__planner-backbone-group';
const CORE_TYPES = new Set(['battery', 'shunt', 'busbar', 'fuse']);
const PADDING_X = 44;
const PADDING_TOP = 56;
const PADDING_BOTTOM = 36;

/** Adds a presentation-only React Flow node behind the main circuit. */
export function withBackboneGroup(nodes: Node[], enabled: boolean): Node[] {
  if (!enabled) return nodes;
  const core = nodes.filter((node) => node.type && CORE_TYPES.has(node.type));
  if (core.length < 2) return nodes;

  const left = Math.min(...core.map((node) => node.position.x));
  const top = Math.min(...core.map((node) => node.position.y));
  const right = Math.max(...core.map((node) => node.position.x + getNodeLayoutSize(node).width));
  const bottom = Math.max(...core.map((node) => node.position.y + getNodeLayoutSize(node).height));

  const group: Node = {
    id: BACKBONE_GROUP_ID,
    type: 'backboneGroup',
    position: { x: left - PADDING_X, y: top - PADDING_TOP },
    data: { label: 'Hauptstromkreis' },
    style: {
      width: right - left + PADDING_X * 2,
      height: bottom - top + PADDING_TOP + PADDING_BOTTOM,
    },
    selectable: false,
    draggable: false,
    connectable: false,
    focusable: false,
    deletable: false,
    zIndex: -10,
    className: 'planner-backbone-group-node',
  };
  return [group, ...nodes];
}
