import React from 'react';
import { useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { getLayoutedElements } from '../utils/layout';

export function useAutoWire(
  nodes: Node[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  edges: Edge[],
  setEdges: React.Dispatch<React.SetStateAction<Edge<any>[]>>,
  fitView: (options?: any) => void
) {
  return useCallback(() => {
    const batteryNode = nodes.find((n) => n.type === 'battery');
    if (!batteryNode) {
      alert('Bitte zuerst eine Batterie platzieren');
      return;
    }

    let currentNodes = [...nodes];
    let newEdges: Edge[] = [];
    let edgeIdCounter = 1;

    // Helper to generate missing nodes
    const ensureNode = (
      type: string,
      label: string,
      offsetX: number,
      offsetY: number,
      extraData: any = {}
    ) => {
      let node = currentNodes.find(
        (n) => n.type === type || (n.data && n.data.label === label)
      );
      if (!node) {
        node = {
          id: crypto.randomUUID(),
          type,
          position: {
            x: batteryNode.position.x + offsetX,
            y: batteryNode.position.y + offsetY,
          },
          data: { label, ...extraData },
        };
        currentNodes.push(node);
      }
      return node;
    };

    // Helper to calculate wire cross section according to VDE
    const calculateWire = (I: number, length: number = 2) => {
      const calculatedA = (I * (length * 2)) / (58 * 0.24);
      const minRequiredA = Math.max(1.5, calculatedA);
      const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0];
      const crossSection =
        VDE_SIZES.find((size) => size >= minRequiredA) || 70.0;

      let fuseSize = 15;
      if (crossSection === 1.5) fuseSize = 15;
      else if (crossSection === 2.5) fuseSize = 20;
      else if (crossSection === 4.0) fuseSize = 30;
      else if (crossSection === 6.0) fuseSize = 40;
      else if (crossSection === 10.0) fuseSize = 60;
      else if (crossSection === 16.0) fuseSize = 80;
      else if (crossSection === 25.0) fuseSize = 100;
      else if (crossSection === 35.0) fuseSize = 150;
      else if (crossSection === 50.0) fuseSize = 200;
      else if (crossSection >= 70.0) fuseSize = 250;

      return { crossSection, fuseSize, length };
    };

    // Helper to connect two nodes with plus and minus edges
    const connect = (
      sourceId: string,
      targetId: string,
      I: number = 0,
      length: number = 2
    ) => {
      const { crossSection, fuseSize } = calculateWire(I, length);
      newEdges.push({
        id: `e-auto-${edgeIdCounter++}`,
        source: sourceId,
        target: targetId,
        sourceHandle: 'plus',
        targetHandle: 'plus',
        type: 'cableEdge',
        data: { length, crossSection, fuseSize },
      });
      newEdges.push({
        id: `e-auto-${edgeIdCounter++}`,
        source: sourceId,
        target: targetId,
        sourceHandle: 'minus',
        targetHandle: 'minus',
        type: 'cableEdge',
        data: { length, crossSection },
      });
    };

    // Schritt 1: Falls Main Busbar und 12V Sicherungskasten fehlen, generiere sie.
    const busbarNode = ensureNode('busbar', 'Main Busbar', 300, 0);
    const fuseBoxNode = ensureNode('fuse', '12V Sicherungskasten', 300, 200, {
      rating: 100,
    });

    // Generiere Smart Shunt falls fehlt
    const shuntNode = ensureNode('shunt', 'Smart Shunt', 150, 0);

    // Schritt 2 (Core Power): Verbinde Batterie -> Smart Shunt -> Main Busbar.
    const batteryCapacity = Number(batteryNode.data.capacity) || 100;
    const maxDischargeA = batteryCapacity; // Assume 1C discharge rate
    connect(batteryNode.id, shuntNode.id, maxDischargeA, 0.5);
    connect(shuntNode.id, busbarNode.id, maxDischargeA, 0.5);

    // Schritt 3 (Heavy Loads): Wechselrichter -> Main Busbar, 12V Sicherungskasten -> Main Busbar.
    const inverters = currentNodes.filter((n) => n.type === 'inverter');
    inverters.forEach((inverter) => {
      const inverterWatts = Number(inverter.data.watts) || 1000;
      const inverterAmps = inverterWatts / 12 / 0.85; // 15% loss
      connect(busbarNode.id, inverter.id, inverterAmps, 1);
    });

    // Connect Fuse Box to Busbar
    connect(
      busbarNode.id,
      fuseBoxNode.id,
      Number(fuseBoxNode.data.rating) || 100,
      1
    );

    // Schritt 4 (Charging): Solarmodul(e) -> MPPT Laderegler -> Main Busbar, Ladebooster -> Main Busbar.
    const solars = currentNodes.filter(
      (n) => n.type === 'solar' || n.type === 'roofsolar'
    );
    if (solars.length > 0) {
      const mpptNode = ensureNode('charger', 'MPPT Laderegler', 150, -200, {
        amps: 30,
      });
      solars.forEach((solar) => {
        const solarWatts = Number(solar.data.watts) || 100;
        const solarAmps = solarWatts / 12;
        connect(solar.id, mpptNode.id, solarAmps, 5); // Solar -> MPPT
      });
      // MPPT -> Busbar
      connect(
        mpptNode.id,
        busbarNode.id,
        Number(mpptNode.data.amps) || 30,
        2
      );
    }

    const boosters = currentNodes.filter(
      (n) =>
        n.type === 'charger' &&
        (n.data.label as string)?.toLowerCase().includes('ladequelle')
    );
    boosters.forEach((booster) => {
      connect(
        booster.id,
        busbarNode.id,
        Number(booster.data.amps) || 30,
        3
      );
    });

    const plainChargers = currentNodes.filter(
      (n) =>
        n.type === 'charger' &&
        !(n.data.label as string)?.toLowerCase().includes('mppt') &&
        !(n.data.label as string)?.toLowerCase().includes('ladequelle')
    );
    plainChargers.forEach((charger) => {
      connect(
        charger.id,
        busbarNode.id,
        Number(charger.data.amps) || 30,
        3
      );
    });

    // Schritt 5 (Consumers): 12V Verbraucher -> 12V Sicherungskasten.
    const consumers = currentNodes.filter((n) => n.type === 'consumer');
    consumers.forEach((consumer) => {
      const I = (Number(consumer.data.watts) || 0) / 12;
      connect(fuseBoxNode.id, consumer.id, I, 3); // Default length 3m for consumers
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      currentNodes,
      newEdges,
      'LR'
    );
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        fitView({ duration: 800 });
      });
    }
  }, [nodes, edges, fitView, setNodes, setEdges]);
}
