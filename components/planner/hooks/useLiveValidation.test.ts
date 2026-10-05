import { act, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useLiveValidation, type ValidationWarning } from './useLiveValidation';
import { textContaining } from '../../../test-helpers/matchers'; // AUDIT T1
import { performAutoWiring } from '../../../lib/autoWire';
import { isStarterBattery } from '../../../lib/autoWire/validation';
import { TEMPLATE_AUTARK } from '../templates';
import { type Node, type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../../edges/CableEdge';
import { clearCableRoutes, publishCableRouteFinalValidation } from '../../edges/utils/cableRouteStore';

/**
 * Befunde der Verifikations-Engine tragen `verify-`-IDs. Dieses Helferchen
 * hält die Tests der PLANER-Regeln frei von Engine-Befunden: Beide Quellen
 * speisen dieselbe Liste (so gewollt), aber die Engine hat ihre eigenen Tests
 * in `lib/verify/` — hier wird nur geprüft, was diese Datei beisteuert.
 */
const plannerWarnings = (warnings: ValidationWarning[]) =>
  warnings.filter((w) => !w.id.startsWith('verify-'));

describe('useLiveValidation', () => {
  it('leitet gesperrte Kantenkonflikte aus der Final-Validation als klickbare Warnungen ab', () => {
    act(() => clearCableRoutes());
    publishCableRouteFinalValidation({
      status: 'INVALID',
      counts: {
        edgeNodeCollisions: 1,
        edgeEdgeOverlaps: 0,
        clearanceViolations: 0,
        lockedRouteViolations: 1,
      },
      violations: [
        {
          invariant: 'I1',
          edgeId: 'locked-wire',
          otherId: 'obstacle',
          detail: 'Segment trifft das Bauteil obstacle.',
        },
      ],
      lockedRouteViolations: [
        {
          code: 'ROUTE-LOCK-ENDPOINT',
          edgeId: 'locked-wire',
          detail: 'Der gespeicherte Weg endet nicht am aktuellen Anschluss.',
        },
      ],
      edgeCount: 1,
    });
    const nodes: Node[] = [
      { id: 'battery', type: 'battery', position: { x: 0, y: 0 }, data: { capacity: 100 } },
      { id: 'load', type: 'consumer', position: { x: 300, y: 0 }, data: { watts: 60 } },
    ];
    const edges: Edge<CableEdgeData>[] = [
      {
        id: 'locked-wire',
        source: 'battery',
        target: 'load',
        data: {
          intent: 'locked',
          locked: true,
          lockedWaypoints: [
            { x: 10, y: 10 },
            { x: 20, y: 10 },
          ],
        },
      },
    ];
    const { result } = renderHook(() => useLiveValidation(nodes, edges));
    const collision = result.current.find((warning) => warning.id.startsWith('route-lock-I1-locked-wire'));
    const endpoint = result.current.find((warning) => warning.id === 'ROUTE-LOCK-ENDPOINT-locked-wire');
    expect(collision).toEqual(
      expect.objectContaining({
        category: 'routing',
        focusType: 'edge',
        focusId: 'locked-wire',
        type: 'critical',
      })
    );
    expect(endpoint).toEqual(
      expect.objectContaining({
        category: 'routing',
        focusType: 'edge',
        focusId: 'locked-wire',
        ruleId: 'ROUTE-LOCK-ENDPOINT',
      })
    );
    act(() => clearCableRoutes());
  });

  it('should return empty warnings for empty nodes and edges', () => {
    const { result } = renderHook(() => useLiveValidation([], []));
    expect(result.current).toEqual([]);
  });

  it('should return empty warnings if nodes or edges are undefined', () => {
    // @ts-expect-error bewusst undefined für Robustheitstest übergeben
    const { result } = renderHook(() => useLiveValidation(undefined, undefined));
    expect(result.current).toEqual([]);
  });

  describe('Rule A5: Parallelschaltung inkompatibler Batterie-Chemien (AUTO-003)', () => {
    const battery = (id: string, chemistry: string): Node => ({
      id,
      type: 'battery',
      data: { label: `Batterie ${id}`, chemistry, capacity: 100 },
      position: { x: 0, y: 0 },
    });

    it('warnt kritisch bei AGM ‖ Gel auf einer Plus-Parallel-Kante', () => {
      const nodes = [battery('1', 'AGM'), battery('2', 'Gel')];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus', targetHandle: 'plus' },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id === 'battery-parallel-chemistry-e1-2');
      expect(warning).toEqual(
        expect.objectContaining({
          category: 'safety',
          type: 'critical',
          ruleId: 'AUTO-003-parallel-chemistry',
          measuredValue: 'AGM ‖ Gel',
        })
      );
    });

    it('LiFePO4 ‖ LiFePO4 bleibt zulässig (keine Chemie-Warnung)', () => {
      const nodes = [battery('1', 'LiFePO4'), battery('2', 'LiFePO4')];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus', targetHandle: 'plus' },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges as never));
      expect(result.current.some((w) => w.id.startsWith('battery-parallel-chemistry'))).toBe(false);
    });

    it('Serien-Kante (plus↔minus) löst NICHT die Chemie-Regel aus (dafür A3)', () => {
      const nodes = [battery('1', 'AGM'), battery('2', 'Gel')];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus', targetHandle: 'minus' },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.some((w) => w.id === 'battery-parallel-chemistry-e1-2')).toBe(false);
    });
  });

  describe('Rule A6: MPPT-Voc-Fenster bei Kälte (ELE-007)', () => {
    const panel = (id: string, data: Record<string, unknown>): Node => ({
      id,
      type: 'solar',
      data,
      position: { x: 0, y: 0 },
    });

    it('warnt kritisch, wenn Kalt-Voc des Strings das Regler-Fenster überschreitet', () => {
      // 2 × 22 V STC in Serie; TK −0,35 %/K, T_min −20 °C → 2 · 22 · 1,1575 ≈ 50,9 V.
      const nodes = [
        panel('p1', { label: 'Panel 1', watts: 100, voc: 22 }),
        panel('p2', { label: 'Panel 2', watts: 100, voc: 22 }),
        {
          id: 'm',
          type: 'mpptController',
          data: { label: 'MPPT', amps: 20, maxPvVoltage: 50 },
          position: { x: 0, y: 0 },
        },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 's-p1-p2', source: 'p1', target: 'p2' }, // Serie
        { id: 's-p2-m', source: 'p2', target: 'm' },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id === 'solar-voc-window-m');
      expect(warning).toEqual(
        expect.objectContaining({
          category: 'safety',
          type: 'critical',
          ruleId: 'ELE-007-voc-window',
          measuredValue: textContaining('51 V'),
        })
      );
    });

    it('bleibt still, wenn Kalt-Voc im Fenster liegt', () => {
      const nodes = [
        panel('p1', { label: 'Panel 1', watts: 100, voc: 22 }),
        {
          id: 'm',
          type: 'mpptController',
          data: { label: 'MPPT', amps: 20, maxPvVoltage: 60 },
          position: { x: 0, y: 0 },
        },
      ];
      const edges: Edge<CableEdgeData>[] = [{ id: 's-p1-m', source: 'p1', target: 'm' }];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.some((w) => w.id === 'solar-voc-window-m')).toBe(false);
    });

    it('fordert fehlende Voc-Datenblattwerte als Hinweis an (nicht still schätzen)', () => {
      const nodes = [
        panel('p1', { label: 'Panel 1', watts: 100 }), // ohne voc
        {
          id: 'm',
          type: 'mpptController',
          data: { label: 'MPPT', amps: 20, maxPvVoltage: 50 },
          position: { x: 0, y: 0 },
        },
      ];
      const edges: Edge<CableEdgeData>[] = [{ id: 's-p1-m', source: 'p1', target: 'm' }];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id === 'solar-voc-missing-m');
      expect(warning).toEqual(
        expect.objectContaining({
          type: 'info',
          ruleId: 'ELE-007-voc-missing-data',
        })
      );
    });

    it('ohne maxPvVoltage am Regler ist das Eingangsfenster UNBEWERTET (nicht still „ok“)', () => {
      // AUDIT ELE-008: Vorher endete die Schleife hier mit `return` — der
      // „Voc fehlt“-Hinweis im else-Zweig war für genau diesen Fall
      // unerreichbar, und ein MPPT-String ohne Eingangsfenster blieb stumm.
      const nodes = [
        panel('p1', { label: 'Panel 1', watts: 100, voc: 40 }),
        { id: 'm', type: 'mpptController', data: { label: 'MPPT', amps: 20 }, position: { x: 0, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [{ id: 's-p1-m', source: 'p1', target: 'm' }];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const unknown = result.current.find((w) => w.ruleId === 'ELE-007-voc-window-unknown');
      expect(unknown).toBeDefined();
      expect(unknown!.type).toBe('warning');
      expect(unknown!.measuredValue).toContain('fehlt');
      // Keine Falschmeldung: es wird kein Fensterverstoß behauptet.
      expect(result.current.some((w) => w.ruleId === 'ELE-007-voc-window')).toBe(false);
    });
  });

  describe('Quellschutz (0,2-m-Regel) — Engine-Regel AMP-003 statt Planer-Regel', () => {
    /**
     * Die Planer-Regel „missing-fuse-*“ ist entfernt. Die 0,2-m-Regel steht in
     * der Regelmatrix der Engine (`AMP-003`) und rechnet dort mit Länge,
     * Querschnitt, Domäne und Schutzorgan. Diese Tests halten die Übergabe
     * fest — inklusive der Zusage, dass KEINE zweite Implementierung derselben
     * Aussage danebensteht: ohne die frühere Doppelmeldung „Quellschutz fehlt“
     * und ohne Engines Befund zu wiederholen.
     */
    const battery: Node = {
      id: 'b',
      type: 'battery',
      data: { label: 'Batterie', capacity: 100, chemistry: 'LiFePO4', internalResistanceMilliOhm: 15 },
      position: { x: 0, y: 0 },
    };
    const consumer: Node = {
      id: 'c',
      type: 'consumer',
      data: { label: 'Kühli', watts: 60 },
      position: { x: 100, y: 0 },
    };
    const cable = (data: Record<string, unknown>): Edge<CableEdgeData>[] => [
      { id: 'e1', source: 'b', target: 'c', sourceHandle: 'plus', targetHandle: 'plus', data },
    ];

    it('meldet 2 m ungeschützte Leitung ab der Quelle als kritischen Befund', () => {
      const { result } = renderHook(() =>
        useLiveValidation([battery, consumer], cable({ crossSection: 2.5, length: 2 }))
      );

      const warning = result.current.find((w) => w.ruleId === 'AMP-003-source-protection-position');
      expect(warning).toEqual(
        expect.objectContaining({
          category: 'safety',
          type: 'critical',
          focusId: 'e1',
          focusType: 'edge',
          measuredValue: '2',
          expectedValue: '0,2',
          unit: 'm',
        })
      );
      expect(warning!.message).toContain('ohne Schutzorgan');
      // Abhilfe kommt als fertiger Vorschlag aus dem Ereignis (kein zweiter Textpfad).
      expect(warning!.remedy).toContain('Sicherung');
      expect(warning!.source).toContain('ISO 10133');
    });

    it('meldet dieselbe Aussage nicht mehr unter der alten Planer-ID', () => {
      const { result } = renderHook(() =>
        useLiveValidation([battery, consumer], cable({ crossSection: 2.5, length: 2 }))
      );
      expect(result.current.filter((w) => w.id.startsWith('missing-fuse'))).toEqual([]);
    });

    it('meldet mit Sicherung keine AMP-003-Verletzung (ohne Länge keine erfundene)', () => {
      const { result } = renderHook(() =>
        useLiveValidation([battery, consumer], cable({ crossSection: 2.5, length: 2, fuseSize: 10 }))
      );
      const violations = result.current.filter(
        (w) => w.ruleId === 'AMP-003-source-protection-position' && w.type !== 'info'
      );
      expect(violations).toEqual([]);
    });

    it('ohne Querschnitt und Länge bleibt die ungeschützte Länge „nicht entscheidbar“', () => {
      // Die Engine erfindet keine Länge: Ohne Eingaben ist der 0,2-m-Vergleich
      // nicht führbar — der Befund ist ein Hinweis auf die Lücke, keine
      // Behauptung über eine Verletzung.
      const { result } = renderHook(() => useLiveValidation([battery, consumer], cable({})));
      const gap = result.current.find(
        (w) => w.ruleId === 'AMP-003-source-protection-position' && w.type === 'info'
      );
      expect(gap).toBeDefined();
      expect(gap!.unverified).toBe(true);
    });
  });

  describe('Rule B: Overloaded Solar Regulator', () => {
    it('should generate warning if total solar watts exceeds MPPT capacity', () => {
      const nodes: Node[] = [
        { id: '1', type: 'solar', data: { watts: 400 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'solar', data: { watts: 400 }, position: { x: 0, y: 0 } },
        {
          id: '3',
          type: 'mpptController',
          // maxPvVoltage gesetzt: hier geht es um die Leistungs-Regel, nicht um
          // das (separat geprüfte) Eingangsfenster.
          data: { amps: 30, maxPvVoltage: 100 },
          position: { x: 100, y: 0 },
        }, // MPPT capacity = 30 * 12 / 0.85 = ~423.5W
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));
      const warnings = plannerWarnings(result.current);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toEqual(
        expect.objectContaining({
          id: 'solar-overload',
          category: 'estimation',
          type: 'warning',
          message: textContaining('Solarregler unterdimensioniert'),
        })
      );
    });

    it('should not generate warning if total solar watts is within MPPT capacity', () => {
      const nodes: Node[] = [
        { id: '1', type: 'solar', data: { watts: 100 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'solar', data: { watts: 100 }, position: { x: 0, y: 0 } },
        {
          id: '3',
          type: 'mpptController',
          data: { amps: 30, maxPvVoltage: 100 },
          position: { x: 100, y: 0 },
        }, // MPPT capacity = 30 * 12 / 0.85 = ~423.5W
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(plannerWarnings(result.current)).toEqual([]);
    });
  });

  describe('Energiebilanz — Engine-Regel PWR-001 statt Planer-Regel „battery-capacity“', () => {
    /**
     * Die Planer-Regel „battery-capacity“ ist entfernt: Tagesbedarf gegen
     * nutzbare Kapazität rechnet die Engine (Peukert-gewichtet, mit
     * Datenblattfeldern aus `lib/peukert.ts`). Sie ist eine
     * Verfügbarkeitsaussage (EFFICIENCY_WARNING), keine Personengefahr —
     * deshalb erscheint sie als Warnung, nicht als kritischer Befund.
     */
    it('meldet knappe Kapazität als Warnung der Engine', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { capacity: 100 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { watts: 300, hours: 5 }, position: { x: 100, y: 0 } },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));

      const warning = result.current.find((w) => w.ruleId === 'PWR-001-energy-balance');
      expect(warning).toEqual(
        expect.objectContaining({
          category: 'estimation',
          type: 'warning',
          unit: 'Ah',
          measuredValue: '117,19',
          expectedValue: '90',
        })
      );
      expect(warning!.message).toContain('Energiebilanz');
    });

    it('bleibt still, wenn die nutzbare Kapazität den Tagesbedarf deckt', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { capacity: 150 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { watts: 300, hours: 5 }, position: { x: 100, y: 0 } },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(result.current.filter((w) => w.ruleId === 'PWR-001-energy-balance')).toEqual([]);
    });

    it('meldet fehlende Verbrauchsangaben als „nicht entscheidbar“, nicht als Pass', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { capacity: 50 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { watts: 300 }, position: { x: 100, y: 0 } },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));

      const gap = result.current.find((w) => w.ruleId === 'PWR-001-energy-balance');
      expect(gap?.type).toBe('info');
      expect(gap?.unverified).toBe(true);
      expect(gap?.focusId).toBe('2');
      expect(gap?.message).toContain('Nutzungsdauer');
    });
  });

  describe('Rule E: DC-DC Charger Connection', () => {
    it('should warn if dcdcCharger is missing input or output', () => {
      const nodes: Node[] = [
        { id: '1', type: 'dcdcCharger', data: { label: 'Booster' }, position: { x: 0, y: 0 } },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));
      const warnings = plannerWarnings(result.current);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.id).toBe('dcdc-unconnected-1');
    });

    it('should not warn if dcdcCharger has input and output', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'dcdcCharger', data: {}, position: { x: 0, y: 0 } },
        { id: '3', type: 'battery', data: {}, position: { x: 0, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: '1', target: '2', data: {} },
        { id: 'e2', source: '2', target: '3', data: {} },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter((w) => w.id.includes('dcdc-unconnected'))).toHaveLength(0);
    });
  });

  /**
   * Rule E2 (TOPO-002) — Prüfbericht 2026-09-28.
   *
   * Regel E prüfte nur, DASS Ein- und Ausgang existieren; ihre Meldung
   * versprach zusätzlich den „Aufbaubatterie-Pfad (Ausgang)". Genau der war
   * ungeprüft: Eine Kante Booster → Schiene genügte, auch wenn die Schiene mit
   * keiner Aufbaubatterie verbunden war. Diese Tests halten beides fest — den
   * gemeldeten Fall UND den AutoWire-Vertrag (dort darf nichts stehen).
   */
  describe('Rule E2 (TOPO-002): Ladebooster erreicht die Aufbaubatterie', () => {
    const starterBattery: Node = {
      id: 'starter',
      type: 'battery',
      data: { label: 'Starterbatterie' },
      position: { x: 0, y: 0 },
    };
    const houseBattery: Node = {
      id: 'house',
      type: 'battery',
      data: { role: 'house', label: 'Aufbaubatterie 200 Ah' },
      position: { x: 0, y: 0 },
    };
    const booster: Node = {
      id: 'booster',
      type: 'dcdcCharger',
      data: { label: 'Booster' },
      position: { x: 0, y: 0 },
    };
    const plusRail: Node = {
      id: 'plus-rail',
      type: 'busbar',
      data: { label: 'Plus-Schiene' },
      position: { x: 0, y: 0 },
    };
    const minusRail: Node = {
      id: 'minus-rail',
      type: 'busbar',
      data: { label: 'Minus-Schiene' },
      position: { x: 0, y: 0 },
    };
    const edge = (
      id: string,
      source: string,
      target: string,
      data: Record<string, unknown> = {}
    ): Edge<CableEdgeData> => ({ id, source, target, data });

    it('warnt, wenn der Booster nur die Starterseite erreicht', () => {
      // Schienen vorhanden, aber OHNE Verbindung zur Aufbaubatterie — der
      // gemeldete Fall: „geladen wird nur die Starterseite".
      const nodes = [starterBattery, booster, plusRail, minusRail, houseBattery];
      const edges = [
        edge('e-starter-plus', 'starter', 'booster'),
        edge('e-starter-minus', 'starter', 'booster'),
        edge('e-booster-plus', 'booster', 'plus-rail'),
        edge('e-booster-minus', 'booster', 'minus-rail'),
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id === 'dcdc-house-path-booster');
      expect(warning).toEqual(
        expect.objectContaining({
          category: 'topology',
          type: 'warning',
          ruleId: 'TOPO-002-dcdc-house-path',
          focusId: 'booster',
          focusType: 'node',
          measuredValue: '0 erreichbare Aufbaubatterien',
        })
      );
      expect(warning!.message).toContain('kein Pfad');
    });

    it('bleibt still, wenn die Aufbaubatterie an denselben Schienen hängt', () => {
      const nodes = [starterBattery, booster, plusRail, minusRail, houseBattery];
      const edges = [
        edge('e-starter-plus', 'starter', 'booster'),
        edge('e-booster-plus', 'booster', 'plus-rail'),
        edge('e-booster-minus', 'booster', 'minus-rail'),
        edge('e-house-plus', 'house', 'plus-rail'),
        edge('e-house-minus', 'house', 'minus-rail'),
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter((w) => w.ruleId === 'TOPO-002-dcdc-house-path')).toEqual([]);
    });

    it('meldet ehrlich, wenn im Plan gar keine Aufbaubatterie existiert', () => {
      const nodes = [starterBattery, booster, plusRail, minusRail];
      const edges = [
        edge('e-starter-plus', 'starter', 'booster'),
        edge('e-booster-plus', 'booster', 'plus-rail'),
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id === 'dcdc-no-house-battery-booster');
      expect(warning?.ruleId).toBe('TOPO-002-dcdc-house-path');
      expect(warning!.message).toContain('keine Aufbaubatterie');
    });

    it('schweigt bei unvollständigem Anschluss — das meldet Regel E', () => {
      const { result } = renderHook(() => useLiveValidation([booster], []));
      expect(result.current.filter((w) => w.ruleId === 'TOPO-002-dcdc-house-path')).toEqual([]);
      expect(result.current.some((w) => w.id === 'dcdc-unconnected-booster')).toBe(true);
    });

    it('feuert im echten AutoWire-Plan, sobald die Verbindung zur Aufbaubatterie fehlt', () => {
      // Der gemeldete Fall in Reinform: Der Plan ist vollständig verdrahtet,
      // nur die Hausseite hängt an den Schienen nicht mehr dran (Kante gelöscht
      // oder nie entstanden). Regel E schweigt weiter — der Booster hat ja
      // Ein- und Ausgang —, genau deshalb braucht es diese Prüfung.
      const base = TEMPLATE_AUTARK as unknown as { nodes: Node[]; edges: Edge<CableEdgeData>[] };
      const wired = performAutoWiring(base.nodes, base.edges)!;
      const houseIds = new Set(
        wired.nodes.filter((n) => n.type === 'battery' && !isStarterBattery(n as never)).map((n) => n.id)
      );
      expect(houseIds.size, 'Aufbaubatterie im verdrahteten Plan').toBeGreaterThan(0);
      const withoutHouseSide = (wired.edges as Edge<CableEdgeData>[]).filter(
        (e) => !houseIds.has(e.source) && !houseIds.has(e.target)
      );
      const { result } = renderHook(() =>
        useLiveValidation(wired.nodes as Node[], withoutHouseSide as never)
      );
      const warning = result.current.find((w) => w.ruleId === 'TOPO-002-dcdc-house-path');
      expect(warning, 'Booster-Pfadmeldung nach Trennung der Hausseite').toBeDefined();
      expect(warning!.id).toContain('dcdc-house-path');
    });

    it('AutoWire-Pläne erfüllen die Pfadprüfung (kein stiller Durchlauf, kein Fehlalarm)', () => {
      const base = TEMPLATE_AUTARK as unknown as { nodes: Node[]; edges: Edge<CableEdgeData>[] };
      const wired = performAutoWiring(base.nodes, base.edges);
      if (!wired) throw new Error('performAutoWiring ohne Ergebnis');
      // Kontrollprobe gegen einen vakuösen Test: Ohne Booster und ohne
      // Aufbaubatterie im verdrahteten Plan prüft der Test gar nichts.
      expect(wired.nodes.some((n) => n.type === 'dcdcCharger')).toBe(true);
      expect(wired.nodes.some((n) => n.type === 'battery')).toBe(true);
      const { result } = renderHook(() => useLiveValidation(wired.nodes as Node[], wired.edges as never));
      expect(result.current.filter((w) => w.ruleId === 'TOPO-002-dcdc-house-path')).toEqual([]);
    });
  });

  describe('AUDIT ELE-002/003/005/009', () => {
    it('warnt kritisch bei direkter Solar→Batterie-Verbindung (ELE-009)', () => {
      const nodes: Node[] = [
        { id: 'p1', type: 'solar', data: { label: 'Panel', watts: 200 }, position: { x: 0, y: 0 } },
        { id: 'b1', type: 'battery', data: { label: 'Batterie', capacity: 100 }, position: { x: 0, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'direct', source: 'p1', target: 'b1', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id === 'solar-direct-direct');
      expect(warning).toBeDefined();
      expect(warning?.ruleId).toBe('ELE-009-solar-direct');
    });

    it('warnt bei BMS-Dauerstromüberschreitung', () => {
      const nodes: Node[] = [
        {
          id: 'b1',
          type: 'battery',
          data: { label: 'Batterie', capacity: 100, bmsContinuousDischarge: 50, nominalVoltage: 12.8 },
          position: { x: 0, y: 0 },
        },
        {
          id: 'i1',
          type: 'inverter',
          data: { label: 'Inverter', continuousPower: 1500 },
          position: { x: 0, y: 0 },
        },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'inv', source: 'b1', target: 'i1', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.some((w) => w.id.startsWith('bms-discharge-b1'))).toBe(true);
    });

    it('meldet die BMS-Überschreitung als KRITISCH, nicht als Hinweis', () => {
      const nodes: Node[] = [
        {
          id: 'b1',
          type: 'battery',
          data: { label: 'Batterie', capacity: 100, bmsContinuousDischarge: 50, nominalVoltage: 12.8 },
          position: { x: 0, y: 0 },
        },
        {
          id: 'i1',
          type: 'inverter',
          data: { label: 'Inverter', continuousPower: 1500 },
          position: { x: 0, y: 0 },
        },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'inv', source: 'b1', target: 'i1', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id.startsWith('bms-discharge-b1'));
      expect(warning?.type).toBe('critical');
      expect(warning?.category).toBe('safety');
      expect(warning?.ruleId).toBe('ELE-005-bms-discharge');
    });

    // V2-LIMIT-001: Vorher wurde AUSSCHLIESSLICH das BMS geprüft. Jede andere
    // eingetragene Bauteilgrenze war unsichtbar.
    describe('Rule CMP: Bauteilgrenzen (V2-LIMIT-001)', () => {
      const overloadedBusbar = (rating: number): Node[] => [
        {
          id: 'b1',
          type: 'battery',
          data: { label: 'Batterie', capacity: 200, nominalVoltage: 12.8 },
          position: { x: 0, y: 0 },
        },
        {
          id: 'rail',
          type: 'busbar',
          data: { label: 'Plus-Schiene', role: 'positive', rating },
          position: { x: 0, y: 0 },
        },
        {
          id: 'i1',
          type: 'inverter',
          data: { label: 'Wechselrichter', continuousPower: 2000 },
          position: { x: 0, y: 0 },
        },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: 'b1', target: 'rail', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
        { id: 'e2', source: 'rail', target: 'i1', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
      ];

      it('eine überlastete Sammelschiene ist ein kritischer Befund', () => {
        const { result } = renderHook(() => useLiveValidation(overloadedBusbar(100), edges));
        const warning = result.current.find((w) => w.id === 'component-limit-rail');
        expect(warning?.type).toBe('critical');
        expect(warning?.ruleId).toBe('ELE-010-component-limit');
        expect(warning?.expectedValue).toBe('max. 100 A');
        expect(warning?.focusType).toBe('edge');
      });

      it('eine ausreichend dimensionierte Schiene erzeugt keinen Befund', () => {
        const { result } = renderHook(() => useLiveValidation(overloadedBusbar(300), edges));
        expect(result.current.some((w) => w.id === 'component-limit-rail')).toBe(false);
      });

      it('ohne eingetragene Grenze wird nichts behauptet (kein Lärm)', () => {
        const nodes = overloadedBusbar(100).map((node) =>
          node.id === 'rail' ? { ...node, data: { label: 'Plus-Schiene', role: 'positive' } } : node
        );
        const { result } = renderHook(() => useLiveValidation(nodes, edges));
        expect(result.current.some((w) => w.id === 'component-limit-rail')).toBe(false);
      });

      it('Nennbetrieb an der Grenze ist kein Befund (30-A-Regler liefert 30 A)', () => {
        const nodes: Node[] = [
          {
            id: 'b1',
            type: 'battery',
            data: { label: 'Batterie', capacity: 100, nominalVoltage: 12.8 },
            position: { x: 0, y: 0 },
          },
          { id: 'm1', type: 'mpptController', data: { label: 'MPPT', amps: 30 }, position: { x: 0, y: 0 } },
          { id: 's1', type: 'solar', data: { label: 'Panel', watts: 384 }, position: { x: 0, y: 0 } },
        ];
        const solarEdges: Edge<CableEdgeData>[] = [
          { id: 'e1', source: 's1', target: 'm1', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
          { id: 'e2', source: 'm1', target: 'b1', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
        ];
        const { result } = renderHook(() => useLiveValidation(nodes, solarEdges));
        expect(result.current.some((w) => w.id === 'component-limit-m1')).toBe(false);
      });
    });

    it('warnt bei ungültigen negativen Watt-Werten', () => {
      const nodes: Node[] = [
        { id: 'c1', type: 'consumer', data: { label: 'Gerät', watts: -60 }, position: { x: 0, y: 0 } },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(result.current.some((w) => w.id === 'invalid-load-c1-watts')).toBe(true);
    });
  });

  describe('Mischspannung (ELE-008) — Planer-Regel, nicht Engine-Regel', () => {
    const node = (id: string, type: string, data: Record<string, unknown>): Node => ({
      id,
      type,
      position: { x: 0, y: 0 },
      data,
    });

    it('warnt bei Mischspannungsplan (ELE-008) — über das ECHTE Feld nominalVoltage', () => {
      // AUDIT ELE-006: Das Fixture benutzte `voltage`; der Produktivcode las
      // genau dieses Phantomfeld (`Number(b.data?.voltage) || 12`) und bekam
      // deshalb IMMER 12 V — die Regel konnte nie feuern, der Test war grün.
      const nodes = [
        node('b1', 'battery', { nominalVoltage: 12 }),
        node('b2', 'battery', { nominalVoltage: 24 }),
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));
      const warning = result.current.find((w) => w.ruleId === 'ELE-008-mixed-voltage');
      expect(warning).toBeDefined();
      expect(warning!.measuredValue).toMatch(/12 V/);
      expect(warning!.measuredValue).toMatch(/24 V/);
    });
  });
});
