import { Node, Edge } from 'reactflow';
import CableEdge, { CableEdgeData } from '../edges/CableEdge';
import BatteryNode from '../nodes/BatteryNode';
import ConsumerNode from '../nodes/ConsumerNode';
import ChargerNode from '../nodes/ChargerNode';
import FuseNode from '../nodes/FuseNode';
import ShorePowerNode from '../nodes/ShorePowerNode';
import Consumer230VNode from '../nodes/Consumer230VNode';
import InverterNode from '../nodes/InverterNode';
import SolarNode from '../nodes/SolarNode';
import GroundNode from '../nodes/GroundNode';
import ConduitNode from '../nodes/ConduitNode';
import BusbarNode from '../nodes/BusbarNode';
import ShuntNode from '../nodes/ShuntNode';

export const NODE_TYPES = {
  battery: BatteryNode,
  consumer: ConsumerNode,
  charger: ChargerNode,
  fuse: FuseNode,
  shorePower: ShorePowerNode,
  consumer230v: Consumer230VNode,
  inverter: InverterNode,
  solar: SolarNode,
  ground: GroundNode,
  conduit: ConduitNode,
  busbar: BusbarNode,
  shunt: ShuntNode,
};

export const EDGE_TYPES = { cableEdge: CableEdge };

/**
 * M8-1: Zoom-Stufen abgeschafft – immer Full-Detail.
 *
 * ReactFlow verwaltet intern ein Zoom-Level, das per Mausrad/-
 * Pinch-Steuerung geändert werden kann und beim letzten
 * "fitView"-Aufruf initialisiert wird. Vor M8-1 gab es drei
 * konfigurierbare Stufen (Mini/Compact/Full), die abhängig vom
 * aktuellen Zoom bestimmte Node-Inhalte ausgeblendet haben.
 *
 * Ab sofort wird kein stufenweises Conditional-Rendering mehr
 * verwendet. NodePresentation.tsx dient als zentrale
 * Referenzkomponente, die ausschließlich den Full-Detail-Modus
 * implementiert. Die Konstanten hier legen die technische
 * Restriktionen fest, die garantieren, dass jede Zoom-Stufe
 * die vollen Details anzeigt (bzw. nur einen
 * nicht-zerstückelnden Minimalfaktor erlaubt).
 */
export const MIN_ZOOM = 0.25;        // unter diesem Faktor wird kein
                                    // weitergezoomt (Performance/
                                    // Lesbarkeit)
export const MAX_ZOOM = 2.0;         // Maximum, sonst wird auf
                                    // FitView zurückgesetzt
export const ZOOM_STEP = 0.05;       // Schrittweite für Mausrad-Steuerung

/**
 * Empfohlene Minimalbreite für alle Node-Karten, damit
 * Label bei starkem Runterzoom nicht überlappen.
 * Sollte in allen Node-Komponenten als min-w-<Wert> verwendet
 * werden.
 */
export const NODE_MIN_WIDTH = 192;   // px – entspricht in etwa
                                    // Tailwind w-48 (192px) als
                                    // absolute Mindestbreite
/**
 * Details: Label-Kollision bei parallelen Kanten.
 * Kabel-Label sollten um mindestens diesen Abstand vom
 * Kantenpfad versetzt sein, damit sie nicht übereinander
 * kleben, wenn zwei parallele Kanten denselben Weg nutzen.
 */
export const EDGE_LABEL_OFFSET_Y = 24;  // px – Zusatzversatz
                                        // für Minus-Handles
export const EDGE_LABEL_OFFSET_Y_PLUS = 16; // px – für Plus-Handles
                                        // (kleinere Verschiebung)

/**
 * M8-1: Voll-Detail-Modus – Referenz für alle Nodes.
 *
 * NODE_DETAIL_LEVEL steuert, ob Node-Komponenten alle Details
 * anzeigen ('full') oder stufenweise reduzieren (in früheren
 * Versionen: 'mini' | 'compact'). Seit M8-1 gibt es nur noch
 * den Wert 'full', da die Zoom-Stufen abgeschafft wurden.
 * NodePresentation.tsx und alle konkreten Node-Implementierungen
 * nutzen diese Konstante als Implementierungs-Referenz.
 */
export const NODE_DETAIL_LEVEL = 'full' as const;
export type NodeDetailLevel = typeof NODE_DETAIL_LEVEL;

/**
 * FULL_DETAIL_LABELS – zentrale Liste der Label, die im
 * Voll-Detail-Modus in Node-Karten dargestellt werden.
 * Dient als Dokumentations-Referenz und kann von Tests oder
 * anderen Komponenten zur Konsistenzprüfung verwendet werden.
 */
export const FULL_DETAIL_LABELS: ReadonlyArray<string> = [
  'Kapazität',
  'Chemie',
  'Ladeleistung',
  'Spannung',
  'Strom',
  'Leistung',
  'Nutzung',
  'Effizienz',
  'Sicherung',
  'RCD',
  'Batteriemonitor',
  'Arbeitsspannung',
  'Stromstärke',
  'Dauerleistung',
  'Breite',
  'Länge',
  'Leistung (Wp)',
  'Rohrtyp',
  'Zugewiesene Kabel',
] as const;

export const initialNodes: Node[] = [
  {
    id: 'battery',
    type: 'battery',
    position: { x: 100, y: 100 },
    data: { capacity: 100, chemistry: 'LiFePO4' },
  },
  {
    id: 'fuse-box',
    type: 'default',
    position: { x: 400, y: 100 },
    data: { label: 'Sicherungskasten' },
    style: { border: '1px solid #777', padding: 10, borderRadius: 5, background: '#fff' }
  },
  {
    id: 'consumer-1',
    type: 'consumer',
    position: { x: 700, y: 50 },
    data: { watts: 60, hours: 12 },
  },
  {
    id: 'charger-1',
    type: 'charger',
    position: { x: 100, y: 300 },
    data: { amps: 30 },
  },
];

export const initialEdges: Edge<CableEdgeData>[] = [
  {
    id: 'e-battery-fuse',
    source: 'battery',
    target: 'fuse-box',
    type: 'cableEdge',
    data: {
      length: 3,
      crossSection: 6,
    },
  },
  {
    id: 'e-fuse-consumer',
    source: 'fuse-box',
    target: 'consumer-1',
    type: 'cableEdge',
    data: {
      length: 5,
      crossSection: 2.5,
    },
  },
  {
    id: 'e-charger-battery',
    source: 'charger-1',
    target: 'battery',
    type: 'cableEdge',
    data: {
      length: 2,
      crossSection: 10,
    },
  },
];
