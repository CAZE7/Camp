import { describe, expect, it } from 'vitest';
import { addClassFlag, hasClassFlag, withClassFlag } from './classFlags';

/**
 * Regression (Bug 2026-09-26, „object recreation“): Jede reine
 * Darstellungs-Transformation (Fokus, Strompfad, Domänen-Filter) erzeugte für
 * jedes Element ein neues Objekt — bei jedem Hover, jedem Domänen-Klick und
 * während eines Drags in jedem Frame. React Flow 12 übernimmt einen Knoten nur
 * bei identischem Objekt unverändert in seinen internen Bestand (`adoptUserNodes`,
 * `checkEquality`) und misst ihn sonst neu; über die Layout-Signatur folgt ein
 * weiterer Routing-Lauf.
 *
 * Die Marke selbst muss dabei idempotent sein: Sonst wächst der Klassen-String
 * bei jedem Durchlauf (`planner-domain-dim planner-domain-dim …`) und das
 * Aussehen hinge davon ab, wie oft eine Anzeige-Funktion lief.
 */

const item = (className?: string) => ({ id: 'a', className, data: {} });

describe('classFlags', () => {
  it('erkennt eine Marke nur als ganzes Wort', () => {
    expect(hasClassFlag('planner-focus-dim', 'planner-focus-dim')).toBe(true);
    expect(hasClassFlag('a planner-focus-dim b', 'planner-focus-dim')).toBe(true);
    expect(hasClassFlag('planner-focus-dim-extra', 'planner-focus-dim')).toBe(false);
    expect(hasClassFlag(undefined, 'planner-focus-dim')).toBe(false);
    expect(hasClassFlag('', 'planner-focus-dim')).toBe(false);
  });

  it('hängt eine Marke genau einmal an', () => {
    expect(addClassFlag('keep-me', 'planner-domain-dim')).toBe('keep-me planner-domain-dim');
    expect(addClassFlag('keep-me planner-domain-dim', 'planner-domain-dim')).toBe(
      'keep-me planner-domain-dim'
    );
    expect(addClassFlag(undefined, 'planner-domain-dim')).toBe('planner-domain-dim');
    expect(addClassFlag('', 'planner-domain-dim')).toBe('planner-domain-dim');
  });

  it('gibt bei unveränderter Marke dasselbe Objekt zurück', () => {
    const node = item('keep-me');
    const flagged = withClassFlag(node, 'planner-focus-active');

    expect(flagged).not.toBe(node);
    expect(flagged.className).toBe('keep-me planner-focus-active');
    // Zweiter Durchlauf: dasselbe Objekt, kein Klassen-Wachstum.
    expect(withClassFlag(flagged, 'planner-focus-active')).toBe(flagged);
    expect(withClassFlag(flagged, 'planner-focus-active').className).toBe('keep-me planner-focus-active');
    // Der Eingang bleibt unangetastet (keine In-place-Mutation).
    expect(node.className).toBe('keep-me');
  });

  it('kombiniert mehrere Marken stabil (Fokus + Domäne + Kollision)', () => {
    const node = item('card');
    const first = withClassFlag(withClassFlag(node, 'planner-focus-dim'), 'planner-domain-dim');
    const second = withClassFlag(withClassFlag(first, 'planner-focus-dim'), 'planner-domain-dim');

    expect(first.className).toBe('card planner-focus-dim planner-domain-dim');
    expect(second).toBe(first);
  });
});
