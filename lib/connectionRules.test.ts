import { describe, it, expect } from 'vitest';
import { isConnectionAllowed, type ConnectionNode } from './connectionRules';

/**
 * AUDIT ARCH-002: Charakter-Tests der Verbindungsregeln — reine Funktion,
 * kein Store nötig. Die Fälle spiegeln die bisherige Store-Implementierung
 * 1:1 (Verhaltens-Charakterisierung vor dem Refactoring).
 */

const node = (id: string, type: string, data: Record<string, unknown> = {}): ConnectionNode => ({
  id,
  type,
  data,
});
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
    node('gray2', 'grayWaterTank'),
    node('fresh', 'freshWaterTank'),
    node('sink', 'sink'),
    node('pump', 'pump'),
    // AUDIT V1: Typen, die der Planer nicht (oder nicht hier) kennt.
    node('roofwin', 'roofWindow'),
    node('unknown', 'dachluke'),
    node('lifelife', 'battery', { chemistry: 'LiFePO4' }),
    node('agm', 'battery', { chemistry: 'AGM' }),
    node('plusRail', 'busbar', { role: 'positive', label: 'Plus-Schiene' }),
    node('minusRail', 'busbar', { role: 'negative', label: 'Minus-Schiene' }),
    node('unlabeledRail', 'busbar', {}),
    node('mppt', 'mpptController'),
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
    // Vorher stand hier `conn('gray', 'gray')` → true: dieselbe Knoten-ID auf
    // beiden Seiten, also ein Self-Loop. Der Test belegte damit unbeabsichtigt
    // das fail-open-Verhalten (AUDIT V1). Erlaubt ist eine echte Verbindung.
    expect(check(conn('fresh', 'pump'), { viewMode: 'water' })).toBe(true);
    expect(check(conn('gray', 'gray2'), { viewMode: 'water' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AUDIT V1 — Deny-by-default
// ---------------------------------------------------------------------------
describe('V1 — Verbindungsregeln sind deny-by-default', () => {
  // Die fünf Fälle, die vor der Härtung alle ALLOWED waren.
  it('lehnt einen Self-Loop ab (Quelle = Ziel)', () => {
    expect(check(conn('bat', 'bat', 'plus', 'plus'))).toBe(false);
    expect(check(conn('con', 'con', 'minus', 'minus'))).toBe(false);
    expect(check(conn('gray', 'gray'), { viewMode: 'water' })).toBe(false);
  });

  it('lehnt unbekannte Bauteiltypen ab statt sie als DC_12V durchzuwinken', () => {
    expect(check(conn('unknown', 'bat', 'plus', 'plus'))).toBe(false);
    expect(check(conn('bat', 'unknown', 'plus', 'plus'))).toBe(false);
  });

  it('lehnt nicht-elektrische Bauteile im Stromplan ab (Dachfenster → Batterie)', () => {
    expect(check(conn('roofwin', 'bat', 'plus', 'plus'))).toBe(false);
    expect(check(conn('bat', 'roofwin', 'plus', 'plus'))).toBe(false);
  });

  it('lehnt fehlende Endpunkte ab', () => {
    expect(check(conn('', 'bat', 'plus', 'plus'))).toBe(false);
    expect(check(conn('bat', '', 'plus', 'plus'))).toBe(false);
    // Knoten-ID, die im Plan nicht existiert:
    expect(
      isConnectionAllowed({
        connection: conn('bat', 'gibt-es-nicht', 'plus', 'plus'),
        getNode: (id) => nodes.get(id),
        viewMode: 'electric',
        activeEdges: [],
      })
    ).toBe(false);
  });

  it('lehnt Bauteile des falschen Modus ab', () => {
    // Wasserbauteil im Stromplan und umgekehrt.
    expect(check(conn('pump', 'bat', 'plus', 'plus'))).toBe(false);
    expect(check(conn('bat', 'con', 'plus', 'plus'), { viewMode: 'water' })).toBe(false);
  });

  it('lehnt Batterie ‖ Batterie anderer Chemie ab (Parität zu AUTO-003)', () => {
    expect(check(conn('lifelife', 'agm', 'plus', 'plus'))).toBe(false);
    expect(check(conn('agm', 'lifelife', 'plus', 'plus'))).toBe(false);
    // Positivkontrolle: gleiche Chemie bleibt erlaubt, sonst wäre der Test
    // auch durch ein pauschales Batterie-Verbot grün.
    expect(check(conn('bat', 'bat2', 'plus', 'plus'))).toBe(true);
    // Bekannte Chemie ↔ unbekannte Chemie fällt auf die Familienregel zurück
    // (Blei ↔ Nicht-Blei blockiert, innerhalb der Familie erlaubt) — exakt das
    // dokumentierte AUTO-003-Verhalten. Bewusst KEINE eigene Verschärfung hier:
    // Ziehen und AutoWire müssen dieselbe Autorität benutzen
    // (`chemistriesParallelSafe`), sonst entsteht der nächste Drift.
    expect(check(conn('agm', 'bat2', 'plus', 'plus'))).toBe(false); // Blei ↔ Nicht-Blei
    expect(check(conn('lifelife', 'bat2', 'plus', 'plus'))).toBe(true); // beides Nicht-Blei
  });

  it('lehnt Plus-Schiene ↔ Minus-Schiene ab (Kurzschluss über die Batterie)', () => {
    // Gleicher Handle-Name, entgegengesetzte Rolle — die Polaritätsregel sieht
    // das nicht (AUDIT AW-RAIL-01).
    expect(check(conn('plusRail', 'minusRail', 'plus', 'plus'))).toBe(false);
    expect(check(conn('minusRail', 'plusRail', 'minus', 'minus'))).toBe(false);
    // Positivkontrolle: gleiche Rolle und unbekannte Rolle bleiben erlaubt.
    expect(check(conn('plusRail', 'unlabeledRail', 'plus', 'plus'))).toBe(true);
  });

  it('Polarität kommt aus der Rollen-Tabelle, nicht aus dem Handle-Namen', () => {
    // `includes('plus')` machte aus Fantasie-Ids Pole: 'in-plus' galt als Plus.
    expect(check(conn('bat', 'con', 'plus', 'in-plus'))).toBe(false);
    expect(check(conn('bat', 'con', 'surplus', 'plus'))).toBe(false);
    // Die echten Handle-Ids der Bauteile bleiben erlaubt:
    expect(check(conn('bat', 'con', 'plus', 'plus'))).toBe(true);
    expect(check(conn('con', 'bat', 'minus', 'minus'))).toBe(true);
  });

  it('Solar bleibt an den Laderegler angebunden (Domäne Solar ↔ DC als Brücke)', () => {
    expect(check(conn('sol1', 'mppt', 'plus', 'plus'))).toBe(true);
    expect(check(conn('sol1', 'sol2', 'plus', 'minus'))).toBe(true); // String
    expect(check(conn('sol1', 'bat', 'plus', 'plus'))).toBe(false);
    expect(check(conn('sol1', 'shore', 'plus', 'plus'))).toBe(false); // Solar ↔ AC
  });
});
