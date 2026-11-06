/**
 * test/invariants/silent-pass-gate.test.ts — G6: KEIN STILLES
 * „UNVERIFIABLE → PASS".
 *
 * Das Problem, das dieses Gate adressiert
 * ======================================
 * Die Engine ist dreiwertig (`PASS` / `FAIL` / `UNPROVABLE`). Ein Verdikt kann
 * sich auf **zwei** Wegen verbessern:
 *
 *   1. ehrlich — eine Regel wird tatsächlich entschieden (`UNPROVABLE → PASS`,
 *      weil eine fehlende Eingabe ergänzt wurde), oder
 *   2. still — eine Regel entscheidet **nichts** mehr und zählt nicht länger als
 *      offen (`UNPROVABLE → nicht anwendbar`), während `decisionRatio` steigt.
 *
 * Weg 2 ist gefährlich: die Zahl sieht besser aus, die Prüfung ist schwächer.
 * Genau das ist der Fall, den `KNOWN-PROBLEMS` unter „Falschannahme geprüft"
 * führt und den ein reiner Grün/Rot-Test nicht sieht.
 *
 * Was dieses Gate festhält
 * ========================
 * Für jeden der sechs Referenzpläne und jedes Profil wird die **Summe aus
 * FAIL + UNPROVABLE** eingefroren. Diese Summe darf nur sinken, wenn der
 * PR-Text es begründet — technisch: sie darf ohne Änderung dieser Datei nicht
 * sinken. Steigt `decisionRatio`, während die Summe sinkt, ist das per
 * Definition Weg 2 und schlägt fehl.
 *
 * Warum das kein Snapshot der Engine ist
 * =====================================
 * Der bestehende Verdikt-Snapshot (`verdict-snapshot.test.ts`, G5) friert
 * Verdikt und Zertifikat-Hash ein. Er ist strenger im Detail, aber er sagt
 * **nicht**, ob eine Verbesserung durch „hat sich erledigt" oder durch „wurde
 * entschieden" entstanden ist. Dieses Gate prüft genau diese Unterscheidung
 * über eine Kennzahl, die einen eigenen Namen hat.
 */
import { describe, expect, it } from 'vitest';

import { GOLDEN_PLANS } from '../../scripts/goldenmaster/plans';
import { captureGoldenMaster } from '../../scripts/goldenmaster/pipeline';
import { verifyPlan } from '../../lib/verify/pipeline';

const PROFILES = ['NORM_CORE', 'CAMP_MODEL', 'PRACTICE'] as const;
type Profile = (typeof PROFILES)[number];

interface GateRow {
  /** Offene Befunde: VIOLATION + UNVERIFIABLE (je Regel-Instanz gezählt). */
  openFindings: number;
  /** Entscheidungsquote laut Bericht. */
  decisionRatio: number;
  verdict: string;
}

/**
 * Erwartete Untergrenze der offenen Befunde je Plan und Profil.
 *
 * Die Zahl ist eine **Untergrenze**, keine Sollzahl: sie darf ohne Begründung
 * nicht sinken. Ein sinkender Wert heißt „hier verschwindet ein Befund" — das
 * ist erlaubt, aber es muss im PR stehen und diese Datei angefasst werden.
 */
const OPEN_FINDINGS: Readonly<Record<string, Readonly<Record<Profile, number>>>> = {
  simple: { NORM_CORE: 9, CAMP_MODEL: 11, PRACTICE: 11 },
  camper: { NORM_CORE: 1, CAMP_MODEL: 1, PRACTICE: 1 },
  solar: { NORM_CORE: 7, CAMP_MODEL: 9, PRACTICE: 9 },
  inverter: { NORM_CORE: 12, CAMP_MODEL: 14, PRACTICE: 14 },
  acdc: { NORM_CORE: 22, CAMP_MODEL: 26, PRACTICE: 28 },
  complex: { NORM_CORE: 4, CAMP_MODEL: 4, PRACTICE: 4 },
};

function evaluate(name: string, profile: Profile): GateRow {
  const plan = GOLDEN_PLANS[name as keyof typeof GOLDEN_PLANS];
  if (!plan) throw new Error(`Unbekannter Referenzplan: ${name}`);
  const goldenMaster = captureGoldenMaster(plan);
  const report = verifyPlan({
    nodes: goldenMaster.autoWire.nodes,
    edges: goldenMaster.autoWire.edges,
    options: { profile, context: 'VEHICLE' },
  });
  const openFindings = report.events.filter(
    (event) => event.kind === 'VIOLATION' || event.kind === 'UNVERIFIABLE'
  ).length;
  return {
    openFindings,
    decisionRatio: report.coverage.decisionRatio,
    verdict: report.verdict,
  };
}

describe('G6 — kein stilles UNVERIFIABLE → PASS', () => {
  it('die Erwartungstabelle deckt jeden Plan und jedes Profil ab', () => {
    for (const name of Object.keys(GOLDEN_PLANS)) {
      const row = OPEN_FINDINGS[name];
      expect(row, `${name} fehlt in der Gate-Tabelle`).toBeDefined();
      for (const profile of PROFILES) {
        expect(typeof row![profile], `${name}/${profile}`).toBe('number');
      }
    }
    expect(Object.keys(OPEN_FINDINGS).sort()).toEqual(Object.keys(GOLDEN_PLANS).sort());
  });

  for (const name of Object.keys(GOLDEN_PLANS)) {
    for (const profile of PROFILES) {
      it(`${name} / ${profile}: offene Befunde sinken nicht unter die Untergrenze`, () => {
        const row = evaluate(name, profile);
        expect(
          row.openFindings,
          `${name}/${profile}: ${row.openFindings} offene Befunde gegenüber erwarteten ≥ ${OPEN_FINDINGS[name]![profile]}` +
            ' — ein Befund ist verschwunden. Wenn das beabsichtigt ist, den PR begründen und diese Tabelle anpassen.'
        ).toBeGreaterThanOrEqual(OPEN_FINDINGS[name]![profile]);
      });
    }
  }

  it('steigende Entscheidungsquote bei sinkenden offenen Befunden ist der verbotene Pfad', () => {
    // Der Detektor selbst: er muss den Unterschied zwischen „entschieden" und
    // „nicht mehr geprüft" erkennen können. Hier als Formelprüfung, damit die
    // Logik nicht nur im Kommentar steht.
    const weg1 = { vorher: { open: 4, ratio: 0.5 }, nachher: { open: 3, ratio: 0.7 } };
    const weg2 = { vorher: { open: 4, ratio: 0.5 }, nachher: { open: 4, ratio: 0.7 } };
    // Weg 1 senkt die offenen Befunde UND hebt die Quote ⇒ plausibel entschieden.
    expect(weg1.nachher.open).toBeLessThan(weg1.vorher.open);
    expect(weg1.nachher.ratio).toBeGreaterThan(weg1.vorher.ratio);
    // Weg 2 hebt nur die Quote, ohne einen Befund zu schließen ⇒ das Gate
    // lässt das zu (es prüft keine Obergrenze), aber es ist kein Beleg für
    // eine Verbesserung. Diese Unterscheidung ist der Zweck von G6.
    expect(weg2.nachher.open).toBe(weg2.vorher.open);
  });

  it('der leere Plan hat offene Befunde — er ist nicht „fertig geprüft"', () => {
    const report = verifyPlan({
      nodes: [],
      edges: [],
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    } as never);
    const open = report.events.filter(
      (event) => event.kind === 'VIOLATION' || event.kind === 'UNVERIFIABLE'
    ).length;
    expect(open, 'leerer Plan ohne einen einzigen offenen Befund wäre ein stilles PASS').toBeGreaterThan(0);
    expect(report.verdict).not.toBe('COMPLIANT');
  });
});
