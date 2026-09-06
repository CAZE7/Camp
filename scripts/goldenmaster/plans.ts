import type { Node, Edge } from 'reactflow';
import type { CableEdgeData } from '../../components/edges/CableEdge';
import { TEMPLATE_MINIMALIST, TEMPLATE_AUTARK } from '../../components/planner/templates';

/**
 * WP-0b (#402): Eingabepläne des Golden Masters.
 *
 * Sechs repräsentative Pläne (simple, camper, solar, inverter, acdc, complex),
 * deren Pipeline-Ergebnisse (AutoWire → Electrical → Routing) als Fixtures in
 * `knownPlans/` eingefroren sind. Die Pläne sind bewusst statisch und
 * deterministisch definiert — zwei davon nutzen die eingecheckten
 * Planner-Templates, die übrigen decken gezielt einzelne Domänenpfade ab
 * (Solar-Kreis, Inverter-DC/AC-Grenze, Landstrom/AC-Lader).
 *
 * NICHT ändern, ohne den Golden Master neu zu erfassen (`npm run
 * goldenmaster:capture`) und die Änderung im Change Ledger zu begründen.
 */

export type GoldenPlanInput = {
  nodes: Node[];
  edges: Edge<CableEdgeData>[];
};

/** Kleinster sinnvoller Plan: Batterie → Sicherung → zwei Verbraucher. */
const SIMPLE: GoldenPlanInput = {
  nodes: [
    {
      id: 'battery-1',
      type: 'battery',
      position: { x: 80, y: 160 },
      data: { label: '12V Batterie', capacity: 100, chemistry: 'AGM' },
    },
    {
      id: 'fusebox-1',
      type: 'fuse',
      position: { x: 380, y: 160 },
      data: { label: 'Sicherungskasten' },
    },
    {
      id: 'cons-light',
      type: 'consumer',
      position: { x: 680, y: 80 },
      data: { label: 'LED-Beleuchtung', watts: 20 },
    },
    {
      id: 'cons-pump',
      type: 'consumer',
      position: { x: 680, y: 280 },
      data: { label: 'Wasserpumpe', watts: 40 },
    },
  ] as Node[],
  edges: [],
};

/** Solar-Ladekreis: Panel → MPPT → Batterie → Verbraucher (Solar-Domäne). */
const SOLAR: GoldenPlanInput = {
  nodes: [
    {
      id: 'solar-1',
      type: 'solar',
      position: { x: 80, y: 60 },
      data: { label: '200W Solar', watts: 200 },
    },
    {
      id: 'mppt-1',
      type: 'mpptController',
      position: { x: 380, y: 60 },
      data: { label: 'MPPT Solarregler', amps: 20 },
    },
    {
      id: 'battery-1',
      type: 'battery',
      position: { x: 380, y: 300 },
      data: { label: '100Ah Lithium', capacity: 100, chemistry: 'LiFePO4' },
    },
    {
      id: 'cons-fridge',
      type: 'consumer',
      position: { x: 680, y: 300 },
      data: { label: 'Kompressorkühlschrank', watts: 60 },
    },
  ] as Node[],
  edges: [],
};

/** DC/AC-Grenze: Batterie → Inverter → 230-V-Verbraucher, daneben 12-V-Last. */
const INVERTER: GoldenPlanInput = {
  nodes: [
    {
      id: 'battery-1',
      type: 'battery',
      position: { x: 80, y: 200 },
      data: { label: '200Ah Lithium', capacity: 200, chemistry: 'LiFePO4' },
    },
    {
      id: 'inverter-1',
      type: 'inverter',
      position: { x: 480, y: 80 },
      data: { label: '1000W Inverter', watts: 1000, continuousPower: 1000 },
    },
    {
      id: 'cons-230v',
      type: 'consumer230v',
      position: { x: 880, y: 80 },
      data: { label: '230V Steckdose', watts: 600 },
    },
    {
      id: 'cons-light',
      type: 'consumer',
      position: { x: 480, y: 360 },
      data: { label: 'LED-Beleuchtung', watts: 20 },
    },
  ] as Node[],
  edges: [],
};

/** Landstrom-Pfad: Shore Power → AC-Lader → Batterie; Inverter + AC/DC-Lasten. */
const ACDC: GoldenPlanInput = {
  nodes: [
    {
      id: 'shore-1',
      type: 'shorePower',
      position: { x: 80, y: 60 },
      data: { label: 'Landstrom CEE' },
    },
    {
      id: 'accharger-1',
      type: 'acBatteryCharger',
      position: { x: 380, y: 60 },
      data: { label: 'AC-Ladegerät', amps: 25 },
    },
    {
      id: 'battery-1',
      type: 'battery',
      position: { x: 380, y: 320 },
      data: { label: '150Ah Lithium', capacity: 150, chemistry: 'LiFePO4' },
    },
    {
      id: 'inverter-1',
      type: 'inverter',
      position: { x: 680, y: 60 },
      data: { label: '1500W Inverter', watts: 1500, continuousPower: 1500 },
    },
    {
      id: 'cons-230v',
      type: 'consumer230v',
      position: { x: 980, y: 60 },
      data: { label: 'Induktionskochfeld', watts: 1200 },
    },
    {
      id: 'cons-fridge',
      type: 'consumer',
      position: { x: 680, y: 360 },
      data: { label: 'Kompressorkühlschrank', watts: 60 },
    },
  ] as Node[],
  edges: [],
};

export const GOLDEN_PLANS: Record<string, GoldenPlanInput> = {
  simple: SIMPLE,
  camper: TEMPLATE_MINIMALIST as GoldenPlanInput,
  solar: SOLAR,
  inverter: INVERTER,
  acdc: ACDC,
  complex: TEMPLATE_AUTARK as GoldenPlanInput,
};
