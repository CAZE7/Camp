import {
  calculateWire,
  VDE_INVERTER_EFFICIENCY,
} from '../vde-standards';
import type { CablePlannerEdge, PlannerNode } from './domain';

export const AUTO_WIRE_MISSING_BATTERY_MESSAGE = 'Bitte zuerst eine Batterie platzieren';
export const AUTO_WIRE_MULTIPLE_BATTERIES_MESSAGE =
  'Auto-Wire unterstützt derzeit nur eine Batterie pro 12-V-System';

type AutoWireOk = {
  ok: true;
  nodes: PlannerNode[];
  edges: CablePlannerEdge[];
};

type AutoWireError = {
  ok: false;
  message: string;
  nodes: PlannerNode[];
  edges: CablePlannerEdge[];
};

export type AutoWireResult = AutoWireOk | AutoWireError;

export type AutoWireOptions = {
  idFactory?: () => string;
  edgeIdPrefix?: string;
};

const defaultIdFactory = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  return typeof randomUUID === 'function'
    ? randomUUID.call(globalThis.crypto)
    : `node-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

function nodeLabel(node: PlannerNode): string {
  return String(node.data?.label ?? '');
}

function isChargerLabel(node: PlannerNode, term: string): boolean {
  return node.type === 'charger' && nodeLabel(node).toLowerCase().includes(term);
}

function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function planAutoWiring(
  inputNodes: PlannerNode[],
  options: AutoWireOptions = {}
): AutoWireResult {
  const idFactory = options.idFactory ?? defaultIdFactory;
  const edgeIdPrefix = options.edgeIdPrefix ?? 'e-auto';

  const batteryNodes = inputNodes.filter((node) => node.type === 'battery');
  const batteryNode = batteryNodes[0];
  if (!batteryNode) {
    return {
      ok: false,
      message: AUTO_WIRE_MISSING_BATTERY_MESSAGE,
      nodes: inputNodes,
      edges: [],
    };
  }
  if (batteryNodes.length > 1) {
    return {
      ok: false,
      message: AUTO_WIRE_MULTIPLE_BATTERIES_MESSAGE,
      nodes: inputNodes,
      edges: [],
    };
  }

  const batteryPosition = batteryNode.position ?? { x: 0, y: 0 };
  const currentNodes = [...inputNodes];
  const generatedEdges: CablePlannerEdge[] = [];
  let edgeIdCounter = 1;

  const ensureNode = (
    type: string,
    label: string,
    offsetX: number,
    offsetY: number,
    extraData: Record<string, unknown> = {}
  ): PlannerNode => {
    let node = currentNodes.find(
      (candidate) => candidate.type === type && candidate.data?.label === label
    );

    if (!node) {
      node = {
        id: idFactory(),
        type,
        position: {
          x: batteryPosition.x + offsetX,
          y: batteryPosition.y + offsetY,
        },
        data: { label, ...extraData },
      };
      currentNodes.push(node);
    }

    return node;
  };

  const connect = (
    sourceId: string,
    targetId: string,
    currentA = 0,
    length = 2
  ) => {
    const { crossSection, fuseSize } = calculateWire(currentA, length);

    generatedEdges.push({
      id: `${edgeIdPrefix}-${edgeIdCounter++}`,
      source: sourceId,
      target: targetId,
      sourceHandle: 'plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length, crossSection, fuseSize },
    });

    generatedEdges.push({
      id: `${edgeIdPrefix}-${edgeIdCounter++}`,
      source: sourceId,
      target: targetId,
      sourceHandle: 'minus',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: { length, crossSection },
    });
  };

  const busbarNode = ensureNode('busbar', 'Main Busbar', 300, 0);
  const fuseBoxNode = ensureNode('fuse', '12V Sicherungskasten', 300, 200, {
    rating: 100,
  });
  const shuntNode = ensureNode('shunt', 'Smart Shunt', 150, 0);

  const batteryCapacity = readNumber(batteryNode.data?.capacity, 100);
  const maxDischargeA = batteryCapacity;
  connect(batteryNode.id, shuntNode.id, maxDischargeA, 0.5);
  connect(shuntNode.id, busbarNode.id, maxDischargeA, 0.5);

  const inverters = currentNodes.filter((node) => node.type === 'inverter');
  for (const inverter of inverters) {
    const inverterWatts = readNumber(
      inverter.data?.watts ?? inverter.data?.continuousPower,
      1000
    );
    const inverterAmps = inverterWatts / 12 / VDE_INVERTER_EFFICIENCY;
    connect(busbarNode.id, inverter.id, inverterAmps, 1);
  }

  connect(
    busbarNode.id,
    fuseBoxNode.id,
    readNumber(fuseBoxNode.data?.rating, 100),
    1
  );

  const solars = currentNodes.filter(
    (node) => node.type === 'solar' || node.type === 'roofsolar' || node.type === 'roofSolar'
  );
  if (solars.length > 0) {
    const mpptNode = ensureNode('charger', 'MPPT Laderegler', 150, -200, {
      amps: 30,
    });

    for (const solar of solars) {
      const solarWatts = readNumber(solar.data?.watts, 100);
      connect(solar.id, mpptNode.id, solarWatts / 12, 5);
    }

    connect(mpptNode.id, busbarNode.id, readNumber(mpptNode.data?.amps, 30), 2);
  }

  const boosters = currentNodes.filter((node) => isChargerLabel(node, 'ladequelle'));
  for (const booster of boosters) {
    connect(booster.id, busbarNode.id, readNumber(booster.data?.amps, 30), 3);
  }

  const plainChargers = currentNodes.filter(
    (node) =>
      node.type === 'charger' &&
      !isChargerLabel(node, 'mppt') &&
      !isChargerLabel(node, 'ladequelle')
  );
  for (const charger of plainChargers) {
    connect(charger.id, busbarNode.id, readNumber(charger.data?.amps, 30), 3);
  }

  const consumers = currentNodes.filter((node) => node.type === 'consumer');
  for (const consumer of consumers) {
    connect(fuseBoxNode.id, consumer.id, (Number(consumer.data?.watts) || 0) / 12, 3);
  }

  return {
    ok: true,
    nodes: currentNodes,
    edges: generatedEdges,
  };
}
