import { describe, it, expect } from 'vitest';
import { isConnectionAllowed, type ConnectionNode } from './connectionRules';

/**
 * AUDIT ARCH-002: Charakter-Tests der Verbindungsregeln — reine Funktion,
 * kein Store nötig. Die Fälle spiegeln die bisherige Store-Implementierung
 * 1:1 (Verhaltens-Charakterisierung vor dem Refactoring).
 */

const node = (id: string, type: string): ConnectionNode => ({ id, type });
const nodes = new Map<string, ConnectionNode>(
  [
    node('bat', 'battery'),
    node('con', 'consumer'),
    node('shore', 'shorePower'),
    node('c230', 'consumer230v'),
    node('sol1', 'solar'),
    node('sol2', 'solar'),
    node('bat2', 'battery'),
    node('gray', 'grayWaterTank'),
    node('sink', 'sink'),
  ].map((n) => [n.id, n])
);

const conn = (
  source: string,
  target: string,
  sourceHandle?: string | null,
  targetHandle?: string | null
) => ({
  source,
  target,
  sourceHandle,
  targetHandle,
});

const check = (
  connection: ReturnType<typeof conn>,
  opts: Partial<{
    viewMode: 'electric' | 'water';
    activeEdges: {
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }[];
  }> = {}
) =>
  isConnectionAllowed({
    connection,
    getNode: (id) => nodes.get(id),
    viewMode: opts.viewMode ?? 'electric',
    activeEdges: opts.activeEdges ?? [],
  });

describe('ARCH-002 — Verbindungsregeln als reine Funktion (lib/connectionRules.ts)', () => {
  it('blockiert AC/DC-Domänen-Mischung strikt', () => {
    expect(check(conn('shore', 'con', 'plus', 'plus'))).toBe(false); // AC-Quelle → DC-Verbraucher
    expect(check(conn('bat', 'c230', 'plus', 'plus'))).toBe(false); // DC-Quelle → AC-Verbraucher
  });

  it('erlaubt gleichpolige DC-Verbindungen', () => {
    expect(check(conn('bat', 'con', 'plus', 'plus'))).toBe(true);
    expect(check(conn('bat', 'con', 'minus', 'minus'))).toBe(true);
  });

  it('blockiert Polaritäts-Mismatch im DC-Kreis', () => {
    expect(check(conn('bat', 'con', 'plus', 'minus'))).toBe(false);
    expect(check(conn('bat', 'con', 'minus', 'plus'))).toBe(false);
  });

  it('Serial-Exception nur für Solarmodule; Batterie-Serie ist blockiert (AUDIT ELE-001)', () => {
    expect(check(conn('bat', 'bat2', 'plus', 'minus'))).toBe(false);
    expect(check(conn('sol1', 'sol2', 'minus', 'plus'))).toBe(true);
    // Aber nicht zwischen verschiedenen Typen:
    expect(check(conn('sol1', 'con', 'plus', 'minus'))).toBe(false);
  });

  it('blockiert direkte Solar↔Batterie und Solar↔Verbraucher-Verbindungen (AUDIT ELE-002)', () => {
    expect(check(conn('sol1', 'bat2', 'plus', 'plus'))).toBe(false);
    expect(check(conn('bat2', 'sol1', 'plus', 'plus'))).toBe(false);
  });

  it('AC-Kanten (shore↔consumer230v) kennen keine plus/minus-Polarität', () => {
    expect(check(conn('shore', 'c230', 'plus', 'plus'))).toBe(true);
    expect(check(conn('shore', 'c230', 'neutral', 'line'))).toBe(true);
  });

  it('blockiert Duplikate derselben Verbindung', () => {
    const existing = [{ source: 'bat', target: 'con', sourceHandle: 'plus', targetHandle: 'plus' }];
    expect(check(conn('bat', 'con', 'plus', 'plus'), { activeEdges: existing })).toBe(false);
    // Andere Handle-Kombination ist keine Duplikat:
    expect(check(conn('bat', 'con', 'minus', 'minus'), { activeEdges: existing })).toBe(true);
  });

  it('Wasser-Modus: Grauwasser → Spüle ist blockiert, Rest erlaubt', () => {
    expect(check(conn('gray', 'sink'), { viewMode: 'water' })).toBe(false);
    expect(check(conn('gray', 'gray'), { viewMode: 'water' })).toBe(true);
  });
});
