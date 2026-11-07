import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatteryBankSection } from './BatteryBankSection';
import { type NodeDataPatch, type PlannerFlowNode, type TypedNode } from '../nodes/types';
import { deriveBatteryBanks } from '../../lib/electricalGraph/batteryBank';
import { getSystemVoltage } from '../../lib/vde-standards';
import { performAutoWiring } from '../../lib/autoWire';

/**
 * AUD-001 — der Release-Blocker des Product-Readiness-Audits.
 *
 * Das Bank-Modell verlangte eine ERKLÄRTE Verschaltung (`bankId` +
 * `bankTopology`), aber keine Oberfläche konnte sie setzen. AutoWire lief
 * deshalb in `AUTO-BANK-001` und ließ die zweite Aufbaubatterie unverbunden;
 * der Konflikttext verlangte Felder, die es in der UI nicht gab. Der Normalfall
 * „zwei Aufbaubatterien" war nur durch Editieren der Projektdatei lösbar.
 *
 * Diese Tests nageln die geschlossene Kette fest: UI schreibt die Felder →
 * Modell leitet die Bank ab → AutoWire verdrahtet sie. Und sie halten die
 * fachliche Grenze fest: eine Serienbank wird NICHT als wählbar angeboten,
 * sondern sichtbar als nicht unterstützt ausgewiesen.
 */

const battery = (id: string, data: Record<string, unknown> = {}): PlannerFlowNode =>
  ({
    id,
    type: 'battery',
    position: { x: 0, y: 0 },
    data: { label: id, capacity: 100, chemistry: 'LiFePO4', role: 'house', ...data },
  }) as PlannerFlowNode;

const asBatteryNode = (node: PlannerFlowNode): TypedNode<'battery'> =>
  node as unknown as TypedNode<'battery'>;

describe('BatteryBankSection — AUD-001 Bank-Erklärung in der Oberfläche', () => {
  const onUpdateNodeData = vi.fn<(id: string, patch: NodeDataPatch) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bietet die Verschaltung als Feld an (das fehlende Eingabefeld des Befunds)', () => {
    render(<BatteryBankSection node={asBatteryNode(battery('bat1'))} onUpdateNodeData={onUpdateNodeData} />);
    expect(screen.getByLabelText('Verschaltung')).toBeTruthy();
  });

  it('schreibt beim Wechsel auf „parallel" bankTopology UND einen Bank-Namen', () => {
    render(<BatteryBankSection node={asBatteryNode(battery('bat1'))} onUpdateNodeData={onUpdateNodeData} />);

    fireEvent.change(screen.getByLabelText('Verschaltung'), { target: { value: 'parallel' } });

    expect(onUpdateNodeData).toHaveBeenCalledWith(
      'bat1',
      expect.objectContaining({ bankTopology: 'parallel', bankId: 'Aufbau' })
    );
  });

  it('übernimmt eine bereits erklärte Bank statt einen zweiten Namen zu erfinden', () => {
    const first = battery('bat1', { bankId: 'Wohnen', bankTopology: 'parallel' });
    const second = battery('bat2');
    render(
      <BatteryBankSection
        node={asBatteryNode(second)}
        nodes={[first, second]}
        onUpdateNodeData={onUpdateNodeData}
      />
    );

    fireEvent.change(screen.getByLabelText('Verschaltung'), { target: { value: 'parallel' } });

    expect(onUpdateNodeData).toHaveBeenCalledWith(
      'bat2',
      expect.objectContaining({ bankTopology: 'parallel', bankId: 'Wohnen' })
    );
  });

  it('entfernt die Bank-Zugehörigkeit beim Wechsel auf „single" (keine stille Parallel-Behauptung)', () => {
    const node = battery('bat1', { bankId: 'Aufbau', bankTopology: 'parallel' });
    render(<BatteryBankSection node={asBatteryNode(node)} onUpdateNodeData={onUpdateNodeData} />);

    fireEvent.change(screen.getByLabelText('Verschaltung'), { target: { value: 'single' } });

    expect(onUpdateNodeData).toHaveBeenCalledWith(
      'bat1',
      expect.objectContaining({ bankTopology: 'single', bankId: undefined })
    );
  });

  it('zeigt die abgeleiteten Bank-Kennwerte aus DEMSELBEN Modell (Anzeige folgt der Rechnung)', () => {
    const first = battery('bat1', {
      bankId: 'Aufbau',
      bankTopology: 'parallel',
      bmsContinuousDischarge: 100,
    });
    const second = battery('bat2', {
      bankId: 'Aufbau',
      bankTopology: 'parallel',
      bmsContinuousDischarge: 100,
    });
    const nodes = [first, second];
    const model = deriveBatteryBanks(nodes, getSystemVoltage(nodes));
    const bank = model.banks.find((candidate) => candidate.id === 'Aufbau');

    render(
      <BatteryBankSection node={asBatteryNode(first)} nodes={nodes} onUpdateNodeData={onUpdateNodeData} />
    );

    const summary = screen.getByTestId('battery-bank-summary');
    // 2 × 100 Ah parallel ⇒ 200 Ah; BMS-Grenzen addieren nur vollständig.
    expect(bank?.capacityAh).toBe(200);
    expect(summary.textContent).toContain('200 Ah');
    expect(summary.textContent).toContain('2 Batterien');
  });

  it('bietet keine Serien-Verschaltung zur Wahl an (kein halb unterstützter Zustand)', () => {
    render(<BatteryBankSection node={asBatteryNode(battery('bat1'))} onUpdateNodeData={onUpdateNodeData} />);
    const select = screen.getByLabelText('Verschaltung') as HTMLSelectElement;
    const values = [...select.options].map((option) => option.value);
    expect(values).toContain('parallel');
    expect(values).toContain('single');
    expect(values).not.toContain('series');
    expect(values).not.toContain('series-parallel');
  });

  it('weist eine importierte Serien-Deklaration sichtbar als nicht unterstützt aus', () => {
    const node = battery('bat1', { bankId: '24V', bankTopology: 'series' });
    render(<BatteryBankSection node={asBatteryNode(node)} onUpdateNodeData={onUpdateNodeData} />);

    expect(screen.getByTestId('battery-bank-series-unsupported')).toBeTruthy();
    // Und es gibt einen Ausweg zurück in einen erklärbaren Zustand.
    fireEvent.click(screen.getByRole('button', { name: /Deklaration zurücksetzen/i }));
    expect(onUpdateNodeData).toHaveBeenCalledWith(
      'bat1',
      expect.objectContaining({ bankTopology: undefined, bankId: undefined })
    );
  });

  it('erklärt Starterbatterien statt Bank-Felder anzubieten', () => {
    const node = battery('starter', { role: 'starter' });
    render(<BatteryBankSection node={asBatteryNode(node)} onUpdateNodeData={onUpdateNodeData} />);
    expect(screen.queryByLabelText('Verschaltung')).toBeNull();
    expect(screen.getByText(/nicht Teil der Aufbaubank/i)).toBeTruthy();
  });
});

describe('AUD-001 — geschlossene Kette: UI-Eingabe → Modell → AutoWire', () => {
  it('verdrahtet zwei Aufbaubatterien, sobald die Parallelbank erklärt ist', () => {
    const base = [
      battery('bat1', { capacity: 100 }),
      battery('bat2', { capacity: 100 }),
      { id: 'load', type: 'consumer', position: { x: 400, y: 0 }, data: { watts: 120 } } as PlannerFlowNode,
    ];

    // Vorher: ohne Erklärung bleibt die zweite Batterie unverbunden.
    const before = performAutoWiring(base, []);
    const bat2Before = before!.edges.filter((edge) => edge.source === 'bat2' || edge.target === 'bat2');
    expect(bat2Before).toHaveLength(0);
    expect(before!.report.conflicts.some((conflict) => conflict.ruleId === 'AUTO-BANK-001')).toBe(true);

    // Nachher: genau die Felder, die BatteryBankSection schreibt.
    const declared = base.map((node) =>
      node.type === 'battery'
        ? ({ ...node, data: { ...node.data, bankId: 'Aufbau', bankTopology: 'parallel' } } as PlannerFlowNode)
        : node
    );
    const after = performAutoWiring(declared, []);
    const bat2After = after!.edges.filter((edge) => edge.source === 'bat2' || edge.target === 'bat2');

    expect(bat2After.length).toBeGreaterThan(0);
    expect(after!.report.conflicts.some((conflict) => conflict.ruleId === 'AUTO-BANK-001')).toBe(false);

    // Und das Modell leitet dieselbe Bank ab, die die UI anzeigt.
    const model = deriveBatteryBanks(declared, getSystemVoltage(declared));
    const bank = model.banks.find((candidate) => candidate.id === 'Aufbau');
    expect(bank?.topology).toBe('parallel');
    expect(bank?.capacityAh).toBe(200);
  });

  it('nennt im Konflikttext den Weg in der Oberfläche statt roher Feldnamen', () => {
    const nodes = [battery('bat1'), battery('bat2')];
    const result = performAutoWiring(nodes, []);
    const conflict = result!.report.conflicts.find((candidate) => candidate.ruleId === 'AUTO-BANK-001');

    expect(conflict).toBeDefined();
    expect(conflict?.message).toContain('Batteriebank');
    expect(conflict?.message).not.toContain('„bankId"');
    expect(conflict?.message).not.toContain('„bankTopology"');
  });
});
