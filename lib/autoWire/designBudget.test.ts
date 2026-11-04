/**
 * P0 / V2-BMS-002 — BMS als Design-Constraint (Review 2026-11).
 *
 * Der Kernbefund: `sizeDcEdges` dimensionierte gegen den Laststrom, die
 * BMS-Grenze war nur eine nachgelagerte Live-Warnung. Diese Tests nageln
 * fest, dass AutoWire einen Überschreitungsfall KRITISCH im Review meldet,
 * die vier Aussagen (Kabel / Sicherung / Batterie / Gesamtsystem) trennt und
 * trotzdem NICHT auf das BMS-Budget herunterdimensioniert.
 */
import { describe, expect, it } from 'vitest';
import { evaluateDesignBudget, addDesignBudgetConflicts, DESIGN_BUDGET_RULES } from './designBudget';
import { createConflictCollector, hasCriticalConflict } from './conflicts';
import type { CableEdge } from './primitives';
import type { Node } from '../domain/graph';
import { performAutoWiring } from '../autoWire';
import type { Volts } from '../units';

const SYS_VOLTAGE = 12.8 as Volts;

const battery = (overrides: Record<string, unknown> = {}): Node => ({
  id: 'bat',
  type: 'battery',
  position: { x: 0, y: 0 },
  data: {
    label: 'Aufbaubatterie',
    capacity: 100,
    chemistry: 'LiFePO4',
    nominalVoltage: 12.8,
    bmsContinuousDischarge: 50,
    bmsContinuousCharge: 50,
    ...overrides,
  },
});

/** Batterie → Schiene → Verbraucher; 720 W ⇒ 60 A bei 12 V Entladeschluss. */
const plan = (
  options: { watts?: number; bms?: number | null; crossSection?: number; fuseSize?: number } = {}
) => {
  const { watts = 720, bms = 50, crossSection = 35, fuseSize = 63 } = options;
  const nodes: Node[] = [
    battery(
      bms === null
        ? { bmsContinuousDischarge: undefined, bmsContinuousCharge: undefined }
        : { bmsContinuousDischarge: bms }
    ),
    { id: 'bus', type: 'busbar', position: { x: 300, y: 0 }, data: { rating: 200 } },
    { id: 'load', type: 'consumer', position: { x: 600, y: 0 }, data: { watts } },
  ];
  const cable = (id: string, source: string, target: string, handle: string, extra = {}): CableEdge => ({
    id,
    source,
    target,
    sourceHandle: handle,
    targetHandle: handle,
    data: { edgeDomain: 'DC_12V', crossSection, length: 1, ...extra },
  });
  const edges: CableEdge[] = [
    cable('e-plus', 'bat', 'bus', 'plus', { fuseSize }),
    cable('e-minus', 'bus', 'bat', 'minus'),
    cable('e-load-plus', 'bus', 'load', 'plus'),
    cable('e-load-minus', 'bus', 'load', 'minus'),
  ];
  return { nodes, edges };
};

describe('evaluateDesignBudget — vier getrennte Aussagen', () => {
  it('Kabel trägt, Sicherung passt, Batterie kann NICHT liefern ⇒ BMS ist die kleinste Grenze', () => {
    const { nodes, edges } = plan();
    const verdict = evaluateDesignBudget(nodes, edges, SYS_VOLTAGE, 'bat');

    expect(verdict.requiredCurrent).toBeCloseTo(60, 6);
    expect(verdict.cableCanCarry).toBe(true);
    expect(verdict.fuseSuitable).toBe(true);
    expect(verdict.batteryCanSupply).toBe(false);
    expect(verdict.budget.limitedBy).toBe('bms');
    expect(verdict.budget.allowedCurrent).toBe(50);
    expect(verdict.assessment).toBe('critical');
    expect(verdict.feasibility.feasible).toBe(false);
  });

  it('ohne BMS-Angabe ist die Lieferfähigkeit nicht bewertbar — kein stilles „ok"', () => {
    const { nodes, edges } = plan({ bms: null });
    const verdict = evaluateDesignBudget(nodes, edges, SYS_VOLTAGE, 'bat');
    expect(verdict.bmsLimit).toBeUndefined();
    expect(verdict.batteryCanSupply).toBeUndefined();
    expect(verdict.notAssessable.join(' ')).toContain('BMS-Dauerentladestrom');
  });

  it('Grenzen fehlen ⇒ kein erfundener Ersatzwert', () => {
    const { nodes, edges } = plan();
    const bareEdges = edges.map((edge) => ({
      ...edge,
      data: { edgeDomain: 'DC_12V' as const },
    })) as CableEdge[];
    const verdict = evaluateDesignBudget(nodes, bareEdges, SYS_VOLTAGE, 'bat');
    expect(verdict.cableLimit).toBeUndefined();
    expect(verdict.fuseLimit).toBeUndefined();
    expect(verdict.notAssessable.length).toBeGreaterThan(1);
  });

  it('parallele Bank addiert die BMS-Grenzen statt zu raten', () => {
    const { nodes, edges } = plan({ watts: 1020, bms: 50, crossSection: 70, fuseSize: 100 });
    const withSecondBattery: Node[] = nodes.map((node) =>
      node.type === 'battery'
        ? { ...node, data: { ...node.data, bankId: 'bank-a', bankTopology: 'parallel' } }
        : node
    );
    withSecondBattery.push({
      id: 'bat2',
      type: 'battery',
      position: { x: 0, y: 200 },
      data: {
        capacity: 100,
        chemistry: 'LiFePO4',
        nominalVoltage: 12.8,
        bmsContinuousDischarge: 50,
        bankId: 'bank-a',
        bankTopology: 'parallel',
      },
    });
    const withSecondEdge: CableEdge[] = [
      ...edges,
      {
        id: 'e-plus-2',
        source: 'bat2',
        target: 'bus',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        data: { edgeDomain: 'DC_12V', crossSection: 70, fuseSize: 100, length: 1 },
      },
    ];
    const verdict = evaluateDesignBudget(withSecondBattery, withSecondEdge, SYS_VOLTAGE, 'bat');
    expect(verdict.bankId).toBe('bank-a');
    expect(verdict.bmsLimit).toBe(100);
    expect(verdict.batteryCanSupply).toBe(true);
    expect(verdict.assessment).toBe('ok');
  });
});

describe('addDesignBudgetConflicts — AutoWire-Review', () => {
  it('Überschreitung ⇒ kritischer Befund mit Lösungswegen', () => {
    const { nodes, edges } = plan();
    const collector = createConflictCollector();
    addDesignBudgetConflicts(nodes, edges, SYS_VOLTAGE, 'bat', collector);
    const report = collector.report();

    expect(hasCriticalConflict(report)).toBe(true);
    const conflict = report.conflicts.find((c) => c.ruleId === DESIGN_BUDGET_RULES.exceeded)!;
    expect(conflict.severity).toBe('critical');
    expect(conflict.message).toContain('Kabel kann die Last tragen');
    expect(conflict.message).toContain('Sicherung passend');
    expect(conflict.message).toContain('Batterie kann die Last NICHT liefern');
    expect(conflict.message).toContain('NICHT geeignet');
    expect(conflict.message).toContain('Batteriebank mit höherem');
    expect(conflict.edgeIds).toContain('e-plus');
    expect(conflict.nodeIds).toContain('bat');
  });

  it('fehlender BMS-Wert ⇒ Warnung + offene Frage, kein kritisches BMS-Urteil', () => {
    const { nodes, edges } = plan({ bms: null });
    const collector = createConflictCollector();
    addDesignBudgetConflicts(nodes, edges, SYS_VOLTAGE, 'bat', collector);
    const report = collector.report();

    expect(report.conflicts.some((c) => c.ruleId === DESIGN_BUDGET_RULES.exceeded)).toBe(false);
    expect(report.conflicts.some((c) => c.ruleId === DESIGN_BUDGET_RULES.missingBms)).toBe(true);
    expect(report.questions.join(' ')).toContain('Dauerentladestrom');
    expect(report.conflicts.find((c) => c.ruleId === DESIGN_BUDGET_RULES.missingBms)!.message).toContain(
      'nicht bewertbar'
    );
  });

  it('knappe Reserve am BMS ⇒ Warnung, kein kritischer Konflikt', () => {
    const { nodes, edges } = plan({ watts: 660, bms: 60 }); // 55 A > 90 % von 60 A
    const collector = createConflictCollector();
    addDesignBudgetConflicts(nodes, edges, SYS_VOLTAGE, 'bat', collector);
    const report = collector.report();
    expect(report.conflicts.some((c) => c.ruleId === DESIGN_BUDGET_RULES.headroom)).toBe(true);
    expect(hasCriticalConflict(report)).toBe(false);
  });
});

describe('performAutoWiring — BMS als Design-Constraint (Review-Beispiel)', () => {
  const reviewPlan = (bms?: number) =>
    [
      {
        id: 'bat',
        type: 'battery',
        position: { x: 0, y: 0 },
        data: {
          label: '12,8-V-Batterie',
          capacity: 100,
          chemistry: 'LiFePO4',
          nominalVoltage: 12.8,
          ...(bms === undefined ? {} : { bmsContinuousDischarge: bms, bmsContinuousCharge: bms }),
        },
      },
      {
        id: 'inv',
        type: 'inverter',
        position: { x: 400, y: 0 },
        data: { label: '1500-W-Wechselrichter', continuousPower: 1500, watts: 1500 },
      },
      {
        id: 'ac',
        type: 'consumer230v',
        position: { x: 800, y: 0 },
        data: { label: 'Kaffeemaschine', watts: 900 },
      },
    ] as Node[];

  it('12,8 V · 50-A-BMS · 1500 W ⇒ kritischer BMS-Konflikt im Review', () => {
    const result = performAutoWiring(reviewPlan(50));
    expect(result).not.toBeNull();
    const conflict = result!.report.conflicts.find((c) => c.ruleId === DESIGN_BUDGET_RULES.exceeded)!;
    expect(conflict).toBeDefined();
    expect(conflict.severity).toBe('critical');
    expect(conflict.message).toContain('BMS-Grenze');
    expect(conflict.message).toContain('Batterie kann die Last NICHT liefern');
    expect(hasCriticalConflict(result!.report)).toBe(true);

    // Die physikalische Dimensionierung bleibt beim LASTSTROM: kein
    // Herunterkappen auf 50 A, das Kabel wäre sonst gefährlich unterbemessen.
    const mainPlus = result!.edges.find((edge) => edge.source === 'bat' && edge.sourceHandle === 'plus')!;
    expect(mainPlus.data?.crossSection).toBeGreaterThan(35);
    expect(mainPlus.data?.fuseSize).toBeGreaterThan(50);
  });

  it('ausreichendes BMS ⇒ kein BMS-Konflikt', () => {
    const result = performAutoWiring(reviewPlan(300));
    expect(result).not.toBeNull();
    expect(result!.report.conflicts.some((c) => c.ruleId === DESIGN_BUDGET_RULES.exceeded)).toBe(false);
  });

  it('ohne BMS-Angabe ⇒ offene Frage statt „geeignet"', () => {
    const result = performAutoWiring(reviewPlan());
    expect(result!.report.questions.join(' ')).toContain('Dauerentladestrom');
    expect(result!.report.conflicts.some((c) => c.ruleId === DESIGN_BUDGET_RULES.missingBms)).toBe(true);
  });

  it('deterministisch: zwei Läufe liefern dieselben BMS-Befunde', () => {
    const first = performAutoWiring(reviewPlan(50))!.report;
    const second = performAutoWiring(reviewPlan(50))!.report;
    expect(first.conflicts).toEqual(second.conflicts);
  });
});
