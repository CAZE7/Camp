import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  createConflictCollector,
  hasCriticalConflict,
  EMPTY_AUTO_WIRE_REPORT,
  type AutoWireConflict,
  type AutoWireConflictSeverity,
} from './conflicts';

/**
 * V2-CONFLICT: Der Sammler ist die einzige Stelle, an der AutoWire sagt
 * „das habe ich NICHT entschieden" bzw. „das widerspricht einer Regel".
 * Zwei Eigenschaften entscheiden über seinen Wert:
 *
 *   1. DETERMINISMUS — zweimal derselbe Lauf, zweimal derselbe Bericht.
 *      Sonst flackert die Warn-Zentrale bei jedem Rendern.
 *   2. VOLLSTÄNDIGKEIT — ein gemeldeter Konflikt darf nicht verschwinden,
 *      auch nicht durch Deduplizierung einer NICHT identischen Meldung.
 */

const conflict = (patch: Partial<AutoWireConflict> = {}): AutoWireConflict => ({
  kind: 'pinned-edge-violates-rule',
  severity: 'warning',
  ruleId: 'ELE-001',
  message: 'Verbindung widerspricht Regel ELE-001.',
  edgeIds: ['e1'],
  nodeIds: ['n1'],
  ...patch,
});

describe('V2-CONFLICT: createConflictCollector', () => {
  it('leerer Lauf ergibt einen leeren Bericht (nicht null)', () => {
    expect(createConflictCollector().report()).toEqual(EMPTY_AUTO_WIRE_REPORT);
  });

  it('meldet jeden Konflikt genau einmal — dieselbe Regel an derselben Kante ist EIN Befund', () => {
    const collector = createConflictCollector();
    collector.add(conflict());
    collector.add(conflict({ message: 'Andere Formulierung, gleiche Aussage.' }));
    expect(collector.report().conflicts).toHaveLength(1);
  });

  it('unterscheidet Befunde nach Kante — zwei Kanten sind zwei Befunde', () => {
    const collector = createConflictCollector();
    collector.add(conflict({ edgeIds: ['e1'] }));
    collector.add(conflict({ edgeIds: ['e2'] }));
    expect(collector.report().conflicts.map((entry) => entry.edgeIds)).toEqual([['e1'], ['e2']]);
  });

  it('dedupliziert unabhängig von der Reihenfolge der IDs innerhalb eines Befunds', () => {
    const collector = createConflictCollector();
    collector.add(conflict({ edgeIds: ['e2', 'e1'], nodeIds: ['n2', 'n1'] }));
    collector.add(conflict({ edgeIds: ['e1', 'e2'], nodeIds: ['n1', 'n2'] }));
    const report = collector.report();
    expect(report.conflicts).toHaveLength(1);
    // Und der Bericht trägt die IDs sortiert — die Anzeige darf nicht von der
    // Einfügereihenfolge abhängen.
    expect(report.conflicts[0]?.edgeIds).toEqual(['e1', 'e2']);
    expect(report.conflicts[0]?.nodeIds).toEqual(['n1', 'n2']);
  });

  it('sortiert kritisch vor Warnung vor Hinweis', () => {
    const collector = createConflictCollector();
    collector.add(conflict({ severity: 'info', ruleId: 'A', edgeIds: ['e9'] }));
    collector.add(conflict({ severity: 'critical', ruleId: 'B', edgeIds: ['e8'] }));
    collector.add(conflict({ severity: 'warning', ruleId: 'C', edgeIds: ['e7'] }));
    expect(collector.report().conflicts.map((entry) => entry.severity)).toEqual([
      'critical',
      'warning',
      'info',
    ]);
  });

  it('offene Fragen werden dedupliziert und sortiert', () => {
    const collector = createConflictCollector();
    collector.ask('Zwei 12-V-Batterien: parallel oder seriell?');
    collector.ask('AC-Quelle für „Kühlschrank" wählen.');
    collector.ask('Zwei 12-V-Batterien: parallel oder seriell?');
    expect(collector.report().questions).toEqual([
      'AC-Quelle für „Kühlschrank" wählen.',
      'Zwei 12-V-Batterien: parallel oder seriell?',
    ]);
  });

  it('hasCriticalConflict unterscheidet Blockade von Hinweis', () => {
    const warn = createConflictCollector();
    warn.add(conflict({ severity: 'warning' }));
    expect(hasCriticalConflict(warn.report())).toBe(false);

    const blocker = createConflictCollector();
    blocker.add(conflict({ severity: 'critical', kind: 'load-exceeds-limit' }));
    expect(hasCriticalConflict(blocker.report())).toBe(true);
  });

  // BEFUND V2-CONFLICT-002: Vorher gewann die ZUERST gemeldete Schwere.
  it('dieselbe Tatsache in zwei Schweregraden: die stärkere Aussage gewinnt', () => {
    const infoFirst = createConflictCollector();
    infoFirst.add(conflict({ severity: 'info' }));
    infoFirst.add(conflict({ severity: 'critical' }));

    const criticalFirst = createConflictCollector();
    criticalFirst.add(conflict({ severity: 'critical' }));
    criticalFirst.add(conflict({ severity: 'info' }));

    expect(infoFirst.report().conflicts[0]?.severity).toBe('critical');
    expect(criticalFirst.report()).toEqual(infoFirst.report());
  });

  it('der Bericht ist eine Momentaufnahme: spätere Meldungen ändern ihn nicht', () => {
    const collector = createConflictCollector();
    collector.add(conflict());
    const first = collector.report();
    collector.add(conflict({ edgeIds: ['e2'] }));
    expect(first.conflicts).toHaveLength(1);
    expect(collector.report().conflicts).toHaveLength(2);
  });
});

describe('V2-CONFLICT: Eigenschaften', () => {
  const severities: AutoWireConflictSeverity[] = ['critical', 'warning', 'info'];
  const arbConflict = fc
    .record({
      severity: fc.constantFrom(...severities),
      ruleId: fc.constantFrom('ELE-001', 'ELE-002', 'AUTO-BANK-001', 'AUTO-AC-001'),
      edgeIds: fc.uniqueArray(fc.constantFrom('e1', 'e2', 'e3'), { maxLength: 3 }),
      nodeIds: fc.uniqueArray(fc.constantFrom('n1', 'n2', 'n3'), { maxLength: 3 }),
    })
    .map(({ severity, ruleId, edgeIds, nodeIds }) =>
      conflict({ severity, ruleId, edgeIds, nodeIds, message: `${ruleId} verletzt` })
    );

  /**
   * E9: Die Einfügereihenfolge darf den Bericht nicht verändern. AutoWire
   * durchläuft seine Phasen in fester Folge — aber eine Umsortierung der
   * Phasen (oder ein zusätzlicher Melder) darf die Warn-Zentrale nicht
   * umsortieren, sonst wandern Befunde beim nächsten Release ohne Grund.
   */
  it('E9: der Bericht ist unabhängig von der Meldereihenfolge', () => {
    fc.assert(
      fc.property(fc.array(arbConflict, { maxLength: 12 }), (conflicts) => {
        const forward = createConflictCollector();
        for (const entry of conflicts) forward.add(entry);
        const backward = createConflictCollector();
        for (const entry of [...conflicts].reverse()) backward.add(entry);
        expect(backward.report()).toEqual(forward.report());
      }),
      { numRuns: 300, seed: 20261004, verbose: false }
    );
  });

  /** E10: Deduplizierung darf keinen fachlich anderen Befund schlucken. */
  it('E10: verschiedene (kind, ruleId, Kanten, Knoten) bleiben getrennte Befunde', () => {
    fc.assert(
      fc.property(fc.array(arbConflict, { maxLength: 12 }), (conflicts) => {
        const collector = createConflictCollector();
        for (const entry of conflicts) collector.add(entry);
        const distinct = new Set(
          conflicts.map(
            (entry) =>
              `${entry.kind}|${entry.ruleId}|${[...entry.edgeIds].sort().join(',')}|${[...entry.nodeIds]
                .sort()
                .join(',')}`
          )
        );
        expect(collector.report().conflicts).toHaveLength(distinct.size);
      }),
      { numRuns: 300, seed: 20261004, verbose: false }
    );
  });
});
