import { Position } from 'reactflow';
import type { OrthogonalPathInput, Rect, Segment } from './orthogonalRouting';

/**
 * components/edges/utils/routingScenarios.ts
 *
 * Reproduzierbare Routing-Szenarien (AGENTS.md K3).
 *
 * Diese Datei ist reine Testdaten-Definition: keine Zufallswerte, keine
 * Uhrzeit, keine Abhängigkeit von React Flow zur Laufzeit. Sie ist die
 * gemeinsame Quelle für
 *
 *   1. die Invarianten-Tests (`orthogonalRouting.invariants.test.ts`),
 *   2. die visuelle Galerie (`npm run routing:gallery` → docs/routing-gallery/).
 *
 * Erwartungen pro Szenario
 * ========================
 * `obstacleFree`   Der Pfad darf keine Hindernis-Box schneiden.
 *                  `false` bedeutet: begründete Ausnahme (siehe `exception`).
 * `maxDetourRatio` Obergrenze für Pfadlänge / Manhattan-Distanz. Damit ist
 *                  „begrenzte Pfadlänge“ eine Zahl statt eines Gefühls.
 */

export type RoutingScenario = {
  /** Stabile ID — zugleich Dateiname in der Galerie. */
  id: string;
  /** Was dieses Szenario prüft. */
  title: string;
  /** Warum es im Produkt vorkommt. */
  rationale: string;
  input: OrthogonalPathInput;
  obstacleFree: boolean;
  /** Begründung, falls `obstacleFree === false`. */
  exception?: string;
  maxDetourRatio: number;
};

const node = (x: number, y: number, width = 192, height = 120): Rect => ({ x, y, width, height });

/** Waagerechte Fremdleitung für Kreuzungs-Szenarien. */
const horizontalWire = (y: number, from: number, to: number): Segment => [
  { x: from, y },
  { x: to, y },
];

export const ROUTING_SCENARIOS: readonly RoutingScenario[] = [
  {
    id: '01-direct-right-left',
    title: 'Gerade Strecke Rechts → Links',
    rationale: 'Der Normalfall: Batterie links, Verbraucher rechts daneben.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 0,
      targetPosition: Position.Left,
    },
    obstacleFree: true,
    maxDetourRatio: 1.05,
  },
  {
    id: '02-vertical-offset',
    title: 'Versatz in der Höhe',
    rationale: 'Zwei Komponenten auf unterschiedlichen Reihen.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 260,
      targetPosition: Position.Left,
    },
    obstacleFree: true,
    maxDetourRatio: 1.05,
  },
  {
    id: '03-backwards-loop',
    title: 'Ziel liegt hinter der Quelle',
    rationale: 'Rückführung zur Minus-Schiene, die links vom Verbraucher sitzt.',
    input: {
      sourceX: 400,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 0,
      targetY: 0,
      targetPosition: Position.Left,
    },
    obstacleFree: true,
    // Schlaufe außen herum: Weg ist länger als die Luftlinie.
    maxDetourRatio: 6,
  },
  {
    id: '04-diagonal-source-target',
    title: 'Diagonale Quelle/Ziel',
    rationale: 'Solarpanel oben links, Laderegler unten rechts.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Bottom,
      targetX: 380,
      targetY: 320,
      targetPosition: Position.Left,
    },
    obstacleFree: true,
    maxDetourRatio: 1.05,
  },
  {
    id: '05-vertical-stack',
    title: 'Senkrechter Stapel',
    rationale: 'Sicherungskasten unter der Plus-Schiene.',
    input: {
      sourceX: 100,
      sourceY: 0,
      sourcePosition: Position.Bottom,
      targetX: 100,
      targetY: 400,
      targetPosition: Position.Top,
    },
    obstacleFree: true,
    maxDetourRatio: 1.05,
  },
  {
    id: '06-single-obstacle',
    title: 'Ein Hindernis in der Bahn',
    rationale: 'Ein Bauteil steht genau zwischen Quelle und Ziel.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 600,
      targetY: 0,
      targetPosition: Position.Left,
      obstacles: [node(220, -60)],
    },
    obstacleFree: true,
    maxDetourRatio: 2.2,
  },
  {
    id: '07-two-obstacles',
    title: 'Zwei Hindernisse hintereinander',
    rationale: 'Enge Reihe aus Sicherungskasten und Shunt.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 900,
      targetY: 0,
      targetPosition: Position.Left,
      obstacles: [node(200, -60), node(560, -60)],
    },
    obstacleFree: true,
    maxDetourRatio: 2.6,
  },
  {
    id: '08-obstacle-above',
    title: 'Hindernis oberhalb der Ideallinie',
    rationale: 'Detour muss die nähere Seite wählen (unten herum).',
    input: {
      sourceX: 0,
      sourceY: 200,
      sourcePosition: Position.Right,
      targetX: 600,
      targetY: 200,
      targetPosition: Position.Left,
      obstacles: [node(250, 150)],
    },
    obstacleFree: true,
    maxDetourRatio: 2.2,
  },
  {
    id: '09-labyrinth-3-rows',
    title: 'Labyrinth aus drei versetzten Reihen',
    rationale: 'Dicht bebauter Plan — der Klassiker für Kabelsalat.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 1000,
      targetY: 0,
      targetPosition: Position.Left,
      obstacles: [node(180, -80), node(460, -40), node(740, -80)],
    },
    obstacleFree: true,
    maxDetourRatio: 3,
  },
  {
    id: '10-labyrinth-vertical-gap',
    title: 'Labyrinth mit engem Durchlass',
    rationale: 'Zwischen zwei Bauteilen bleibt nur ein schmaler Spalt.',
    input: {
      sourceX: 0,
      sourceY: 100,
      sourcePosition: Position.Right,
      targetX: 700,
      targetY: 100,
      targetPosition: Position.Left,
      obstacles: [node(300, -140), node(300, 180)],
    },
    obstacleFree: true,
    maxDetourRatio: 2.5,
  },
  {
    id: '11-parallel-lane-0',
    title: 'Parallele Kabel — Lane 0',
    rationale: 'Erste von drei Leitungen im selben Kabelkanal.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 500,
      targetY: 120,
      targetPosition: Position.Left,
      offset: 0,
    },
    obstacleFree: true,
    maxDetourRatio: 1.1,
  },
  {
    id: '12-parallel-lane-plus-16',
    title: 'Parallele Kabel — Lane +16 px',
    rationale: 'Zweite Leitung, um eine Lane versetzt (Mission-1-Entscheidung).',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 500,
      targetY: 120,
      targetPosition: Position.Left,
      offset: 16,
    },
    obstacleFree: true,
    maxDetourRatio: 1.2,
  },
  {
    id: '13-parallel-lane-minus-16',
    title: 'Parallele Kabel — Lane −16 px',
    rationale: 'Dritte Leitung in der Gegenrichtung versetzt.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 500,
      targetY: 120,
      targetPosition: Position.Left,
      offset: -16,
    },
    obstacleFree: true,
    maxDetourRatio: 1.2,
  },
  {
    id: '14-crossing-avoidance',
    title: 'Ausweichen bei vielen Kreuzungen',
    rationale: 'Über der Ideallinie liegen fünf fremde Leitungen.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 600,
      targetY: 0,
      targetPosition: Position.Left,
      crossingSegments: [
        horizontalWire(-200, 100, 100),
        horizontalWire(-200, 200, 200),
        horizontalWire(-200, 300, 300),
        horizontalWire(-200, 400, 400),
        horizontalWire(-200, 500, 500),
      ],
    },
    obstacleFree: true,
    maxDetourRatio: 1.1,
  },
  {
    id: '15-crossing-dense-grid',
    title: 'Dichtes Kreuzungsgitter',
    rationale: 'Zehn senkrechte Fremdleitungen queren die Bahn.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 800,
      targetY: 40,
      targetPosition: Position.Left,
      crossingSegments: Array.from({ length: 10 }, (_, index): Segment => [
        { x: 60 + index * 70, y: -200 },
        { x: 60 + index * 70, y: 200 },
      ]),
    },
    obstacleFree: true,
    maxDetourRatio: 1.4,
  },
  {
    id: '16-target-top-entry',
    title: 'Eintritt von oben',
    rationale: 'Verbraucher, dessen Anschluss oben sitzt.',
    input: {
      sourceX: 0,
      sourceY: 300,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 0,
      targetPosition: Position.Top,
    },
    obstacleFree: true,
    maxDetourRatio: 1.1,
  },
  {
    id: '17-target-bottom-entry-with-obstacle',
    title: 'Eintritt von unten mit Hindernis',
    rationale: 'Massepunkt unter einem Bauteil.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 400,
      targetPosition: Position.Bottom,
      obstacles: [node(300, 200)],
    },
    obstacleFree: true,
    maxDetourRatio: 2.5,
  },
  {
    id: '18-same-point',
    title: 'Quelle und Ziel am selben Punkt',
    rationale: 'Degenerierter Fall (kann bei überlappenden Nodes auftreten).',
    input: {
      sourceX: 100,
      sourceY: 100,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 100,
      targetPosition: Position.Left,
    },
    obstacleFree: true,
    // Manhattan-Distanz ist 0 → Verhältnis nicht definiert, deshalb großzügig.
    maxDetourRatio: Number.POSITIVE_INFINITY,
  },
  {
    id: '19-very-short-hop',
    title: 'Sehr kurze Verbindung',
    rationale: 'Batterie → Shunt, 20 cm im Plan.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 24,
      targetY: 0,
      targetPosition: Position.Left,
    },
    obstacleFree: true,
    maxDetourRatio: 1.05,
  },
  {
    id: '20-enclosed-target',
    title: 'Umschlossenes Ziel',
    rationale: 'Das Ziel liegt in einer Box, die es vollständig umschließt (z. B. Node im Leerrohr-Rahmen).',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 500,
      targetY: 0,
      targetPosition: Position.Left,
      obstacles: [{ x: 420, y: -160, width: 320, height: 320 }],
    },
    // Begründete Ausnahme: das Ziel liegt INNERHALB des Hindernisses. Ein
    // hindernisfreier Pfad existiert nicht — die Leitung muss die Box
    // betreten. Der Router darf hier nicht endlos ausweichen.
    obstacleFree: false,
    exception: 'Ziel liegt innerhalb der Hindernis-Box; ein kollisionsfreier Pfad ist geometrisch unmöglich.',
    maxDetourRatio: 4,
  },
  {
    id: '21-source-enclosed',
    title: 'Umschlossene Quelle',
    rationale: 'Gegenstück zu 20 — die Quelle steckt in der Box.',
    input: {
      sourceX: 500,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 1000,
      targetY: 0,
      targetPosition: Position.Left,
      obstacles: [{ x: 420, y: -160, width: 320, height: 320 }],
    },
    obstacleFree: false,
    exception: 'Quelle liegt innerhalb der Hindernis-Box; der Austritt kreuzt sie zwangsläufig.',
    maxDetourRatio: 4,
  },
  {
    id: '22-stress-scene',
    title: 'Stressszene: 12 Hindernisse, 12 Fremdleitungen',
    rationale: 'Großer Plan — prüft, dass der Router terminiert und stabil bleibt.',
    input: {
      sourceX: -100,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 1400,
      targetY: 200,
      targetPosition: Position.Left,
      obstacles: Array.from({ length: 12 }, (_, index) =>
        node(80 + (index % 6) * 220, -120 + Math.floor(index / 6) * 260)
      ),
      crossingSegments: Array.from({ length: 12 }, (_, index): Segment => [
        { x: 40 + index * 110, y: -300 },
        { x: 40 + index * 110, y: 400 },
      ]),
    },
    obstacleFree: true,
    maxDetourRatio: 4,
  },
  {
    id: '23-obstacle-touching-source',
    title: 'Hindernis direkt an der Quelle',
    rationale: 'Nachbarbauteil klebt am Anschluss.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 600,
      targetY: 0,
      targetPosition: Position.Left,
      obstacles: [node(30, -60)],
    },
    obstacleFree: true,
    maxDetourRatio: 3,
  },
  {
    id: '24-long-haul',
    title: 'Lange Strecke quer durch den Plan',
    rationale: 'Heck-Batterie zum Fahrerhaus.',
    input: {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 2400,
      targetY: 600,
      targetPosition: Position.Left,
      obstacles: [node(600, 100), node(1400, 400)],
    },
    obstacleFree: true,
    maxDetourRatio: 1.6,
  },
  {
    id: '25-bottom-to-top',
    title: 'Von unten nach oben mit Gegenrichtung',
    rationale: 'Dachdurchführung: Panel oben, Regler unten.',
    input: {
      sourceX: 200,
      sourceY: 400,
      sourcePosition: Position.Bottom,
      targetX: 200,
      targetY: 0,
      targetPosition: Position.Top,
    },
    obstacleFree: true,
    maxDetourRatio: 5,
  },
];

/** Manhattan-Distanz zwischen Quelle und Ziel eines Szenarios. */
export const manhattanDistance = (input: OrthogonalPathInput): number =>
  Math.abs(input.targetX - input.sourceX) + Math.abs(input.targetY - input.sourceY);
