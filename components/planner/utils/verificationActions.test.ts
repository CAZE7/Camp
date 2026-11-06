/**
 * components/planner/utils/verificationActions.test.ts
 *
 * Prüft den Ratgeber gegen **echte** Engine-Berichte, nicht gegen erfundene
 * Ereignisse. Ein Ratgeber, der nur mit handgebauten Eingaben funktioniert,
 * hilft im Planer nicht.
 */
import { describe, expect, it } from 'vitest';

import type { Node } from '../../../lib/domain/graph';
import type { Edge } from '@xyflow/react';
import type { CableEdgeData } from '../../../lib/domain/cableEdgeData';
import { verifyPlan } from '../../../lib/verify';
import { actionFor, nextStepSummary, verificationActions, type ActionKind } from './verificationActions';
import { PLANNER_VERIFICATION_OPTIONS } from './verificationWarnings';

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data }) as unknown as Node;

const edge = (
  id: string,
  source: string,
  target: string,
  data: Record<string, unknown> = {}
): Edge<CableEdgeData> =>
  ({
    id,
    source,
    target,
    sourceHandle: 'plus',
    targetHandle: 'plus',
    data,
  }) as unknown as Edge<CableEdgeData>;

const report = (nodes: Node[], edges: Edge<CableEdgeData>[]) =>
  verifyPlan({ nodes, edges, options: { ...PLANNER_VERIFICATION_OPTIONS } });

describe('verificationActions — jeder offene Befund hat einen nächsten Schritt', () => {
  it('der typische Einsteigerplan liefert Handlungen statt einer Wand aus „nicht bewertbar"', () => {
    // Batterie → Sicherung → Kühlschrank, ohne Leistungsangabe am Verbraucher.
    const plan = report(
      [
        node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }),
        node('fuse', 'fuseBox', {}),
        node('load', 'consumer', { name: 'Kompressorkühlschrank' }),
      ],
      [
        edge('e1', 'bat', 'fuse', { length: 0.3, crossSection: 16, fuseSize: 40 }),
        edge('e2', 'fuse', 'load', { length: 4, crossSection: 2.5, fuseSize: 10 }),
      ]
    );

    expect(plan.verdict).toBe('INCOMPLETE');
    const groups = verificationActions(plan);
    expect(groups.length, 'ohne Handlungen ist der Befund eine Sackgasse').toBeGreaterThan(0);

    const all = groups.flatMap((group) => group.actions);
    expect(all.length).toBeGreaterThan(0);

    // Jede Handlung ist konkret: ein Satz, ein Ziel, eine Kategorie.
    for (const action of all) {
      expect(action.instruction.length, `${action.ruleId}: Handlung zu knapp`).toBeGreaterThan(30);
      expect(['node', 'edge', 'none'], action.ruleId).toContain(action.target);
      expect(action.kind).not.toBe('');
    }

    // Und mindestens eine davon nennt konkret, WAS fehlt.
    expect(all.some((action) => /Leistung|Länge|Querschnitt|Strom|Dauer/i.test(action.instruction))).toBe(
      true
    );
  });

  it('keine Handlung ohne Zuordnung (kind „unknown") bei den Regeln, die im Plan vorkommen', () => {
    const plan = report(
      [
        node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }),
        node('load', 'consumer', { watts: 60 }),
      ],
      [edge('e1', 'bat', 'load', { length: 4, crossSection: 2.5, fuseSize: 10 })]
    );
    const unknown = verificationActions(plan)
      .filter((group) => group.kind === 'unknown')
      .flatMap((group) => group.actions);
    expect(
      unknown.map((action) => action.ruleId),
      'diese Regeln haben keinen Handlungshinweis — Tabelle in verificationActions.ts ergänzen'
    ).toEqual([]);
  });

  it('Verstöße stehen vor fehlenden Angaben, Modellgrenzen stehen zuletzt', () => {
    const plan = report(
      [
        node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }),
        node('load', 'consumer', { watts: 600 }),
      ],
      [edge('e1', 'bat', 'load', { length: 5, crossSection: 2.5, fuseSize: 10 })]
    );
    const kinds = verificationActions(plan).map((group) => group.kind);
    const rank = (kind: ActionKind) =>
      ['fix-violation', 'fill-input', 'datasheet', 'model-limit', 'unknown'].indexOf(kind);
    for (let index = 1; index < kinds.length; index += 1) {
      expect(rank(kinds[index]!), `Reihenfolge: ${kinds.join(' → ')}`).toBeGreaterThanOrEqual(
        rank(kinds[index - 1]!)
      );
    }
  });

  it('reine Abdeckungs-Ereignisse erzeugen keine Handlung', () => {
    // Ein leerer Plan erzeugt sieben Abdeckungs-Ereignisse. Sie melden nichts
    // über ein Bauteil — eine Handlung wäre hier eine Lüge („trag etwas ein",
    // obwohl es gar kein Bauteil gibt).
    const empty = verifyPlan({
      nodes: [],
      edges: [],
      options: { ...PLANNER_VERIFICATION_OPTIONS },
    });
    expect(verificationActions(empty)).toEqual([]);
    for (const event of empty.events) expect(actionFor(event)).toBeNull();
  });

  it('der nächste Schritt ist ein Satz, nicht eine Zahl', () => {
    const plan = report(
      [node('bat', 'battery', { capacity: 100 }), node('load', 'consumer', {})],
      [edge('e1', 'bat', 'load', { length: 2, crossSection: 2.5 })]
    );
    const summary = nextStepSummary(plan);
    expect(summary.length).toBeGreaterThan(30);
    expect(summary).toMatch(/Schritt|ändern|fachlich|erfüllt/i);
  });

  it('eine Modellgrenze wird als solche benannt, nicht als Aufgabe', () => {
    // Ein nicht modelliertes Bauteil ist keine Eingabe, die der Nutzer
    // nachholen kann. Der Unterschied muss in der Kategorie stehen.
    const plan = report(
      [
        node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }),
        node('mystery', 'unbekannterTyp', {}),
      ],
      [edge('e1', 'bat', 'mystery', { length: 2, crossSection: 2.5, fuseSize: 10 })]
    );
    const actions = verificationActions(plan).flatMap((group) => group.actions);
    const unmodeled = actions.filter((action) => action.ruleId === 'SYN-002-unmodeled-component');
    if (unmodeled.length > 0) {
      expect(unmodeled[0]!.kind).toBe('model-limit');
      expect(unmodeled[0]!.instruction).toMatch(/nicht abgebildet|fachlich/i);
    }
  });
});
