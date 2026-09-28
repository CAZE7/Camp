import { describe, expect, it } from 'vitest';
import { probeGoldenPlan, probeScenario, type LaneProbe } from './laneProbe';

/**
 * ROUTE-002 Teil 3 (`preferredLaneBonus`): Die Probe ist das Werkzeug der
 * Entscheidung — sie muss laufen und strukturell stimmen.
 *
 * Der Bonus wurde in vier Varianten verdrahtet und gemessen (Dokumentation und
 * Zahlen in `docs/ai/KNOWN-PROBLEMS.md`, ROUTE-002 „Teil 3"): Die Probe findet
 * echtes Potenzial (ELK-Pfad 50 freie, ungenutzte Registry-Linien; Fest-Raster
 * 22), aber jede Realisierung kostet an anderer Stelle mehr, als sie bringt —
 * im Fest-Raster steigt `complex` um 44 px Kabellänge, und die Längen-Ratchet
 * verbietet ausdrücklich, dafür die Baseline anzuheben. Ausgeliefert wurde
 * deshalb nur die Probe.
 *
 * Dieser Test friert bewusst KEINE Layout-Zahlen ein (die bewegen sich mit
 * jedem bewussten Layout-Schritt). Er sichert, dass
 *
 *   1. die Probe auf beiden Datenbasen läuft (Referenzplan + Szenario),
 *   2. jedes Ideal-Segment in genau einem Bucket landet,
 *   3. `staggeredFree` eine Teilmenge von `freeUnused` ist,
 *   4. unbekannte Namen `null` liefern statt zu werfen.
 *
 * Fällt der Router künftig so, dass gefundene freie Linien ungenutzt bleiben,
 * ist das kein Testfehler — dann ist DIESE Entscheidung neu zu prüfen.
 */

const bucketSum = (r: LaneProbe): number => r.used + r.freeUnused + r.occupied;

describe('Lane-Probe — Werkzeug für die preferredLaneBonus-Entscheidung', () => {
  it('Referenzplan (ELK-Pfad): Buckets summieren sich, Zahlen sind plausibel', async () => {
    const probe = await probeGoldenPlan('complex');
    expect(probe).not.toBeNull();
    const r = probe!;
    expect(bucketSum(r)).toBe(r.idealSegments);
    expect(r.staggeredFree).toBeLessThanOrEqual(r.freeUnused);
    expect(r.freeUnused).toBeGreaterThanOrEqual(0);
    expect(r.corridors).toBeGreaterThan(0);
  }, 300000);

  it('Regressions-Szenario (Fest-Raster): läuft und ist konsistent', () => {
    const probe = probeScenario('p03-busbar-fanout');
    expect(probe).not.toBeNull();
    const r = probe!;
    expect(bucketSum(r)).toBe(r.idealSegments);
    expect(r.staggeredFree).toBeLessThanOrEqual(r.freeUnused);
  }, 120000);

  it('unbekannte Namen liefern null statt zu werfen', () => {
    expect(probeScenario('gibt-es-nicht')).toBeNull();
  });
});
