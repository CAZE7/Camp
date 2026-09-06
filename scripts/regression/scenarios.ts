import type { Node } from 'reactflow';
import type { RouteEdgeRef } from '../../components/edges/utils/routeAll';

/**
 * WP-11 (#400): Die 15 Regressions-Szenarien — Fixtures auf PLAN-Ebene.
 *
 * Anders als `routingScenarios.ts` (einzelne Kante gegen Hindernisse) sind
 * das hier vollständige Pläne: Nodes + explizite Kanten, geroutet über
 * `routeAllCables` (Bestandsrouter) bzw. den ELK-Pass. Die Golden Layouts
 * (`goldenLayouts.json`) frieren die exakte Trassenstruktur ein — nicht
 * „kein Crash", sondern „für diesen Input exakt diese Wegpunkte".
 *
 * Bewusst statisch: keine Zufallswerte, keine AutoWire-Abhängigkeit —
 * die Kanten sind explizit, damit jedes Szenario genau die Topologie
 * prüft, für die es benannt ist.
 *
 * Die dynamischen Szenarien 13–15 (Drag, Undo/Redo, Pass-Wechsel) haben
 * zusätzlich Verhaltens-Tests in `regression.test.ts`; ihre Endzustände
 * sind hier als Fixtures eingefroren.
 */

export type RegressionScenario = {
  /** Stabile ID — zugleich Dateiname der SVG-Ausgabe. */
  id: string;
  title: string;
  /** Was dieses Szenario absichert. */
  rationale: string;
  nodes: Node[];
  edges: RouteEdgeRef[];
};

const node = (id: string, type: string, x: number, y: number): Node =>
  ({
    id,
    type,
    position: { x, y },
    width: 192,
    height: 120,
    data: {},
  }) as Node;

const edge = (
  id: string,
  source: string,
  target: string,
  handle: 'plus' | 'minus' = 'plus'
): RouteEdgeRef => ({
  id,
  source,
  target,
  sourceHandle: handle,
  targetHandle: handle,
});

/** 1 — kleinster Fall: eine Batterie, ein Verbraucher, Plus + Minus. */
const BATT_1: RegressionScenario = {
  id: 'p01-batterie-1-verbraucher',
  title: '1 Batterie + 1 Verbraucher',
  rationale: 'Der Normalfall — gerade Plus-/Minus-Trasse ohne Hindernis.',
  nodes: [node('batt', 'battery', 80, 160), node('cons', 'consumer', 560, 160)],
  edges: [edge('e-plus', 'batt', 'cons', 'plus'), edge('e-minus', 'batt', 'cons', 'minus')],
};

/** 2 — Verteilung auf 10 Verbraucher in zwei Spalten. */
const BATT_10: RegressionScenario = {
  id: 'p02-batterie-10-verbraucher',
  title: '1 Batterie + 10 Verbraucher',
  rationale: 'Fächerung eines Ports auf viele Ziele — Lane-Vergabe unter Last.',
  nodes: [
    node('batt', 'battery', 40, 640),
    node('fuse', 'fuse', 360, 640),
    ...Array.from({ length: 10 }, (_, i) =>
      node(`cons-${i}`, 'consumer', 720 + (i % 2) * 320, Math.floor(i / 2) * 280 + 40)
    ),
  ],
  edges: [
    edge('e-batt-fuse', 'batt', 'fuse'),
    ...Array.from({ length: 10 }, (_, i) => edge(`e-fuse-cons-${i}`, 'fuse', `cons-${i}`)),
  ],
};

/** 3 — Busbar + Fan-out (WP-9): Reihenfolge am Port folgt der Zielhöhe. */
const BUSBAR_FANOUT: RegressionScenario = {
  id: 'p03-busbar-fanout',
  title: 'Busbar + Fan-out',
  rationale: 'Stubs am Sammelport dürfen sich nicht überkreuzen (#398).',
  nodes: [
    node('batt', 'battery', 40, 480),
    node('bus', 'fuse', 400, 480),
    node('cons-a', 'consumer', 800, 40),
    node('cons-b', 'consumer', 800, 340),
    node('cons-c', 'consumer', 800, 640),
    node('cons-d', 'consumer', 800, 940),
    node('cons-e', 'consumer', 800, 1240),
  ],
  edges: [
    edge('e-batt-bus', 'batt', 'bus'),
    edge('e-bus-a', 'bus', 'cons-a'),
    edge('e-bus-b', 'bus', 'cons-b'),
    edge('e-bus-c', 'bus', 'cons-c'),
    edge('e-bus-d', 'bus', 'cons-d'),
    edge('e-bus-e', 'bus', 'cons-e'),
  ],
};

/** 4 — parallele Verbraucher: vier Kanten teilen sich denselben Korridor. */
const PARALLEL_CONSUMERS: RegressionScenario = {
  id: 'p04-parallele-verbraucher',
  title: 'Parallele Verbraucher',
  rationale: 'Gemeinsamer Korridor — Lanes liegen im laneGrid nebeneinander statt übereinander.',
  nodes: [
    node('fuse', 'fuse', 40, 480),
    node('cons-a', 'consumer', 640, 120),
    node('cons-b', 'consumer', 640, 360),
    node('cons-c', 'consumer', 640, 600),
    node('cons-d', 'consumer', 640, 840),
  ],
  edges: [
    edge('e-a', 'fuse', 'cons-a'),
    edge('e-b', 'fuse', 'cons-b'),
    edge('e-c', 'fuse', 'cons-c'),
    edge('e-d', 'fuse', 'cons-d'),
  ],
};

/** 5 — Solar-Ladekreis. */
const SOLAR_MPPT: RegressionScenario = {
  id: 'p05-solar-mppt',
  title: 'Solar + MPPT',
  rationale: 'Vertikaler Domänenpfad Panel → Regler → Batterie.',
  nodes: [
    node('solar', 'solar', 80, 40),
    node('mppt', 'mpptController', 480, 40),
    node('batt', 'battery', 480, 400),
    node('cons', 'consumer', 880, 400),
  ],
  edges: [
    edge('e-solar-mppt', 'solar', 'mppt'),
    edge('e-mppt-batt', 'mppt', 'batt'),
    edge('e-batt-cons', 'batt', 'cons'),
  ],
};

/** 6 — DC/AC-Grenze am Inverter. */
const INVERTER: RegressionScenario = {
  id: 'p06-inverter',
  title: 'Inverter',
  rationale: 'DC-Seite und AC-Seite desselben Geräts, getrennte Trassen.',
  nodes: [
    node('batt', 'battery', 80, 300),
    node('inv', 'inverter', 520, 80),
    node('ac-cons', 'acConsumer', 960, 80),
    node('dc-cons', 'consumer', 520, 520),
  ],
  edges: [
    edge('e-batt-inv', 'batt', 'inv'),
    edge('e-inv-ac', 'inv', 'ac-cons'),
    edge('e-batt-dc', 'batt', 'dc-cons'),
  ],
};

/** 7 — AC/DC-Mischung: Landstrom, Lader, Batterie, Inverter. */
const ACDC_MIX: RegressionScenario = {
  id: 'p07-acdc-mischung',
  title: 'AC/DC-Mischung',
  rationale: 'Zwei Domänen im selben Plan — Trassen bleiben getrennt.',
  nodes: [
    node('shore', 'shorePower', 40, 40),
    node('charger', 'charger', 440, 40),
    node('batt', 'battery', 440, 400),
    node('inv', 'inverter', 880, 400),
    node('ac-cons', 'acConsumer', 1320, 400),
    node('dc-cons', 'consumer', 880, 760),
  ],
  edges: [
    edge('e-shore-charger', 'shore', 'charger'),
    edge('e-charger-batt', 'charger', 'batt'),
    edge('e-batt-inv', 'batt', 'inv'),
    edge('e-inv-ac', 'inv', 'ac-cons'),
    edge('e-batt-dc', 'batt', 'dc-cons'),
  ],
};

/** 8 — enger Raum: schmale Gasse zwischen zwei Blöcken. */
const TIGHT_SPACE: RegressionScenario = {
  id: 'p08-enger-raum',
  title: 'Enger Raum',
  rationale: 'Die Trasse muss durch eine schmale, aber ausreichende Gasse.',
  nodes: [
    node('batt', 'battery', 40, 300),
    node('block-a', 'fuse', 400, 80),
    node('block-b', 'fuse', 400, 520),
    node('cons', 'consumer', 800, 300),
  ],
  edges: [edge('e-batt-cons', 'batt', 'cons')],
};

/** 9 — Node direkt im Trassenweg. */
const NODE_IN_PATH: RegressionScenario = {
  id: 'p09-node-im-weg',
  title: 'Node direkt im Trassenweg',
  rationale: 'Der gerade Weg ist blockiert — Umfahrung statt Durchschuss.',
  nodes: [
    node('batt', 'battery', 40, 200),
    node('blocker', 'fuse', 440, 200),
    node('cons', 'consumer', 840, 200),
  ],
  edges: [edge('e-batt-cons', 'batt', 'cons')],
};

/** 10 — mehrere parallele Trassen zwischen zwei Reihen. */
const PARALLEL_CORRIDORS: RegressionScenario = {
  id: 'p10-parallele-trassen',
  title: 'Mehrere parallele Trassen',
  rationale: 'Drei unabhängige Paare — Korridore bleiben getrennt und stabil.',
  nodes: [
    node('src-a', 'battery', 40, 40),
    node('src-b', 'battery', 40, 400),
    node('src-c', 'battery', 40, 760),
    node('dst-a', 'consumer', 720, 40),
    node('dst-b', 'consumer', 720, 400),
    node('dst-c', 'consumer', 720, 760),
  ],
  edges: [edge('e-a', 'src-a', 'dst-a'), edge('e-b', 'src-b', 'dst-b'), edge('e-c', 'src-c', 'dst-c')],
};

/** 11 — Zwangskreuzung: Quellen/Ziele über Kreuz. */
const FORCED_CROSSING: RegressionScenario = {
  id: 'p11-zwangskreuzung',
  title: 'Zwangskreuzung',
  rationale: 'Topologisch unvermeidbare Kreuzung — genau eine, nicht mehr (Invariante 10).',
  nodes: [
    node('src-top', 'battery', 40, 40),
    node('src-bottom', 'battery', 40, 500),
    node('dst-top', 'consumer', 720, 40),
    node('dst-bottom', 'consumer', 720, 500),
  ],
  edges: [edge('e-down', 'src-top', 'dst-bottom'), edge('e-up', 'src-bottom', 'dst-top')],
};

/** 12 — Kreuzung mit Backbone: Steigleitung quert die Haupttrasse. */
const BACKBONE_CROSSING: RegressionScenario = {
  id: 'p12-backbone-kreuzung',
  title: 'Kreuzung mit Backbone',
  rationale: 'Lange Haupttrasse, ein Abzweig muss sie queren — sauber im rechten Winkel.',
  nodes: [
    node('batt', 'battery', 40, 400),
    node('end', 'consumer', 1240, 400),
    node('top', 'solar', 640, 40),
    node('bottom', 'consumer', 640, 760),
  ],
  edges: [edge('e-backbone', 'batt', 'end'), edge('e-quer', 'top', 'bottom')],
};

/** 13 — Drag eines zentralen Nodes: Endzustand nach dem Verschieben. */
const DRAG_CENTRAL: RegressionScenario = {
  id: 'p13-drag-zentraler-node',
  title: 'Drag eines zentralen Nodes',
  rationale:
    'Fixiert den Endzustand NACH dem Verschieben des Verteilers (bus um +160 px nach unten gegenüber p03); der Verhaltens-Test prüft zusätzlich Drag-und-Zurück = byte-identisch.',
  nodes: [
    node('batt', 'battery', 40, 480),
    node('bus', 'fuse', 400, 640),
    node('cons-a', 'consumer', 800, 40),
    node('cons-b', 'consumer', 800, 340),
    node('cons-c', 'consumer', 800, 640),
    node('cons-d', 'consumer', 800, 940),
    node('cons-e', 'consumer', 800, 1240),
  ],
  edges: BUSBAR_FANOUT.edges,
};

/** 14 — Undo/Redo: Basiszustand; der Verhaltens-Test macht Mutation + Revert. */
const UNDO_REDO: RegressionScenario = {
  id: 'p14-undo-redo',
  title: 'Undo / Redo',
  rationale:
    'Routing ist zustandslos: Plan ändern und zurücknehmen liefert byte-identische Trassen (Verhaltens-Test in regression.test.ts).',
  nodes: [
    node('batt', 'battery', 80, 200),
    node('fuse', 'fuse', 480, 200),
    node('cons-a', 'consumer', 880, 40),
    node('cons-b', 'consumer', 880, 400),
  ],
  edges: [
    edge('e-batt-fuse', 'batt', 'fuse'),
    edge('e-fuse-a', 'fuse', 'cons-a'),
    edge('e-fuse-b', 'fuse', 'cons-b'),
  ],
};

/** 15 — Pass-Wechsel ELK → A* → ELK: mittlerer Plan für beide Pässe. */
const PASS_SWITCH: RegressionScenario = {
  id: 'p15-pass-wechsel',
  title: 'ELK → A* → ELK',
  rationale:
    'Beide Pässe routen denselben Plan; der ELK-Pass ist idempotent und sein Golden Layout ist zusätzlich eingefroren (Verhaltens-Test in regression.test.ts).',
  nodes: [
    node('batt', 'battery', 40, 400),
    node('fuse', 'fuse', 400, 400),
    node('inv', 'inverter', 760, 120),
    node('cons-a', 'consumer', 1120, 120),
    node('cons-b', 'consumer', 760, 680),
    node('cons-c', 'consumer', 1120, 680),
  ],
  edges: [
    edge('e-batt-fuse', 'batt', 'fuse'),
    edge('e-fuse-inv', 'fuse', 'inv'),
    edge('e-inv-a', 'inv', 'cons-a'),
    edge('e-fuse-b', 'fuse', 'cons-b'),
    edge('e-fuse-c', 'fuse', 'cons-c'),
  ],
};

export const REGRESSION_SCENARIOS: readonly RegressionScenario[] = [
  BATT_1,
  BATT_10,
  BUSBAR_FANOUT,
  PARALLEL_CONSUMERS,
  SOLAR_MPPT,
  INVERTER,
  ACDC_MIX,
  TIGHT_SPACE,
  NODE_IN_PATH,
  PARALLEL_CORRIDORS,
  FORCED_CROSSING,
  BACKBONE_CROSSING,
  DRAG_CENTRAL,
  UNDO_REDO,
  PASS_SWITCH,
];
