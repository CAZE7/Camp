import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatteryBankSection } from './BatteryBankSection';
import { type NodeDataPatch, type PlannerFlowNode, type TypedNode } from '../nodes/types';
import { deriveBatteryBanks } from '../../lib/electricalGraph/batteryBank';
import { getSystemVoltage } from '../../lib/vde-standards';
import { performAutoWiring } from '../../lib/autoWire';

/**
 * Vollständige Bedienkette der Batteriebank — die sechs Fälle, die ein Nutzer
 * tatsächlich durchläuft.
 *
 * Leitplanke: Die Oberfläche darf NIEMALS eine gültige Bank suggerieren,
 * während AutoWire oder die Verifikation eine andere Topologie verwenden.
 * Deshalb prüft jeder Fall beides: was die Sektion anzeigt, und was das
 * Modell bzw. AutoWire daraus macht.
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

/** Wendet einen UI-Patch auf die Node-Liste an — wie der Store es täte. */
const applyPatch = (nodes: PlannerFlowNode[], id: string, patch: NodeDataPatch): PlannerFlowNode[] =>
  nodes.map((node) => {
    if (node.id !== id) return node;
    const data: Record<string, unknown> = { ...node.data, ...patch };
    // Der Store entfernt gesetzte undefined-Felder nicht; das Modell muss
    // damit umgehen. Wir lassen sie bewusst stehen.
    return { ...node, data } as PlannerFlowNode;
  });

const modelOf = (nodes: PlannerFlowNode[]) => deriveBatteryBanks(nodes, getSystemVoltage(nodes));

const renderSection = (
  nodes: PlannerFlowNode[],
  focusId: string,
  onUpdate: (id: string, patch: NodeDataPatch) => void
) => {
  const focus = nodes.find((node) => node.id === focusId)!;
  return render(<BatteryBankSection node={asBatteryNode(focus)} nodes={nodes} onUpdateNodeData={onUpdate} />);
};

describe('Batteriebank — Bedienkette über alle Fälle', () => {
  const onUpdate = vi.fn<(id: string, patch: NodeDataPatch) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Fall 1: einzelne Aufbaubatterie braucht keine Bank und wirft keine Frage auf', () => {
    const nodes = [battery('bat1')];
    const model = modelOf(nodes);
    expect(model.questions).toHaveLength(0);
    expect(model.banks).toHaveLength(1);
    expect(model.banks[0]!.topology).toBe('single');

    // Das Feld steht bewusst auf „noch nicht erklärt": bei einer einzelnen
    // Batterie gibt es nichts zu entscheiden. Entscheidend ist, dass das
    // Modell daraus `single` macht und keine Frage stellt — die UI darf hier
    // keine Bank vorgaukeln.
    renderSection(nodes, 'bat1', onUpdate);
    expect((screen.getByLabelText('Verschaltung') as HTMLSelectElement).value).toBe('');
    expect(modelOf(nodes).banks[0]!.topology).toBe('single');
  });

  it('Fall 2: zwei parallele Batterien — UI, Modell und AutoWire stimmen überein', () => {
    let nodes = [battery('bat1'), battery('bat2')];

    // Ohne Erklärung: mehrdeutig, keine Bank-Bildung.
    expect(modelOf(nodes).questions.length).toBeGreaterThan(0);

    // Der Nutzer erklärt BEIDE als dieselbe Parallelbank.
    for (const id of ['bat1', 'bat2']) {
      onUpdate.mockClear();
      const view = renderSection(nodes, id, onUpdate);
      fireEvent.change(screen.getByLabelText('Verschaltung'), { target: { value: 'parallel' } });
      const [patchId, patch] = onUpdate.mock.calls[0]!;
      nodes = applyPatch(nodes, patchId, patch);
      view.unmount();
    }

    const model = modelOf(nodes);
    expect(model.questions).toHaveLength(0);
    const bank = model.banks.find((entry) => entry.batteryIds.length === 2);
    expect(bank).toBeDefined();
    expect(bank!.topology).toBe('parallel');
    // 2 × 100 Ah parallel ⇒ 200 Ah bei gleicher Spannung.
    expect(bank!.capacityAh).toBe(200);

    // AutoWire darf jetzt nicht mehr an der Bank scheitern.
    const result = performAutoWiring(nodes, []);
    const bankConflict = result?.report.conflicts.find((conflict) =>
      String(conflict.ruleId ?? '').includes('AUTO-BANK-001')
    );
    expect(bankConflict).toBeUndefined();
  });

  it('Fall 3: mehrere getrennte Bänke bleiben getrennt', () => {
    const nodes = [
      battery('a1', { bankId: 'Bank A', bankTopology: 'parallel' }),
      battery('a2', { bankId: 'Bank A', bankTopology: 'parallel' }),
      battery('b1', { bankId: 'Bank B', bankTopology: 'parallel' }),
      battery('b2', { bankId: 'Bank B', bankTopology: 'parallel' }),
    ];
    const model = modelOf(nodes);
    expect(model.banks).toHaveLength(2);
    expect(model.bankOfBattery.get('a1')).not.toBe(model.bankOfBattery.get('b1'));
    for (const bank of model.banks) {
      expect(bank.capacityAh).toBe(200);
    }

    renderSection(nodes, 'a1', onUpdate);
    expect(screen.getByTestId('battery-bank-summary').textContent).toMatch(/200/);
  });

  it('Fall 4: nachträgliche Änderung einer Bank wird sofort in der Anzeige wirksam', () => {
    const before = [
      battery('bat1', { bankId: 'Aufbau', bankTopology: 'parallel' }),
      battery('bat2', { bankId: 'Aufbau', bankTopology: 'parallel' }),
    ];
    expect(modelOf(before).banks[0]!.capacityAh).toBe(200);

    // Eine Batterie verlässt die Bank (eigener Kreis).
    const after = applyPatch(before, 'bat2', { bankTopology: 'single', bankId: undefined });
    const model = modelOf(after);
    expect(model.banks).toHaveLength(2);
    for (const bank of model.banks) {
      expect(bank.capacityAh).toBe(100);
    }
  });

  it('Fall 5: Umstellung von parallel auf einzeln setzt die Bank-Felder zurück', () => {
    const nodes = [
      battery('bat1', { bankId: 'Aufbau', bankTopology: 'parallel' }),
      battery('bat2', { bankId: 'Aufbau', bankTopology: 'parallel' }),
    ];
    renderSection(nodes, 'bat1', onUpdate);
    fireEvent.change(screen.getByLabelText('Verschaltung'), { target: { value: 'single' } });

    const [id, patch] = onUpdate.mock.calls[0]!;
    expect(id).toBe('bat1');
    expect(patch.bankTopology).toBe('single');
    expect(patch.bankId).toBeUndefined();

    // Nach dem Zurücksetzen darf die Batterie nicht weiter als Bankmitglied
    // gezählt werden.
    const after = applyPatch(nodes, id, patch);
    const model = modelOf(after);
    expect(model.bankOfBattery.get('bat1')).not.toBe(model.bankOfBattery.get('bat2'));
  });

  it('Fall 6: importierte Serienbank wird NICHT als gültige Wahl angeboten', () => {
    const nodes = [
      battery('s1', { bankId: '24V', bankTopology: 'series', bankSeries: 2 }),
      battery('s2', { bankId: '24V', bankTopology: 'series', bankSeries: 2 }),
    ];
    renderSection(nodes, 's1', onUpdate);

    // Die Sektion zeigt den nicht unterstützten Zustand …
    expect(screen.getByTestId('battery-bank-series-unsupported')).toBeTruthy();

    // … und bietet gar kein Auswahlfeld an, sondern einen Rückbau. So kann
    // die UI eine Serienbank nicht als gültige Wahl bestätigen.
    expect(screen.queryByLabelText('Verschaltung')).toBeNull();
    const reset = screen.getByRole('button', { name: /Deklaration zurücksetzen/i });
    fireEvent.click(reset);
    const [id, patch] = onUpdate.mock.calls[0]!;
    expect(id).toBe('s1');
    expect(patch.bankTopology).toBeUndefined();
    expect(patch.bankId).toBeUndefined();
    expect(patch.bankSeries).toBeUndefined();
  });
});
