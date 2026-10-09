/**
 * Reproduzierbarer Elektro-Validierungsfehlerfall (Audit 2026-10-07).
 *
 * Dieses Fixture ist absichtlich vor jeder Produktionsänderung angelegt:
 * Es fixiert den bisherigen 158,7-A-Hauptstrom, die tatsächlich belasteten
 * Segmente, die 70-mm²-/120,4-A-Grenze und einen RCD, der nur einen von zwei
 * AC-Zweigen schützt. Die Werte sind Plan-Eingaben, keine AutoWire-Ausgabe.
 */
import { describe, expect, it } from 'vitest';

import { calculateEdgeCurrent } from '../vde-standards';
import { computeCableCurrents } from '../electricalGraph/currentFlow';
import { verifyPlan } from './pipeline';
import type { AuditEvent } from './types';
import type { FixturePlan } from './planFixtures';
import { validation158RegressionPlan, VALIDATION158_EDGE_ID } from './validation158Fixture';
import { findMinimumValidCable } from '../cableSizing';
import { evaluateCableProtection } from '../electrical';

const fixturePlan = (): FixturePlan => {
  const plan = validation158RegressionPlan();
  return { nodes: plan.nodes, edges: plan.edges };
};

const eventFor = (events: readonly AuditEvent[], edgeOrNodeId: string): AuditEvent | undefined =>
  events.find((event) => event.entity.id === edgeOrNodeId);

describe('158,7-A-Validierungsregression — reproduzierbarer Plan vor der Korrektur', () => {
  it('fixiert Stromursachen, Strompfade, Querschnitte/Längen sowie den echten Validator-Befund', () => {
    const plan = fixturePlan();
    const oldEndpointValue = calculateEdgeCurrent(
      plan.nodes.find((node) => node.id === 'battery'),
      plan.nodes.find((node) => node.id === 'smart-shunt'),
      plan.nodes,
      undefined,
      plan.edges
    );
    const currentModel = computeCableCurrents({ nodes: plan.nodes, edges: plan.edges });
    const main = currentModel.byEdgeId.get(VALIDATION158_EDGE_ID);
    const shunt = currentModel.byEdgeId.get('e-battery-shunt');
    const mainValidationCable = plan.edges.find((edge) => edge.id === VALIDATION158_EDGE_ID);

    expect(Number(oldEndpointValue).toFixed(1)).toBe('158.7');
    expect(main?.operatingCurrent).toBeCloseTo(158.73, 2);
    expect(shunt?.operatingCurrent).toBeCloseTo(158.73, 2);
    expect(
      main?.contributingLoads.map(({ componentId, contribution }) => [componentId, contribution])
    ).toEqual(
      expect.arrayContaining([
        ['inverter', 147.06],
        ['fridge', 5],
        ['pump', 6.67],
      ])
    );
    expect(main?.downstreamLoads).toEqual(['fridge', 'inverter', 'pump']);
    expect(mainValidationCable?.data).toMatchObject({ crossSection: 70, length: 0.2, fuseSize: 100 });

    // Der Zweig hinter der Sicherungsbox führt nur die beiden dort liegenden
    // 12-V-Lasten; WR-Zuleitung und AC-Ausgang sind separate Pfade.
    expect(currentModel.byEdgeId.get('e-plus-busbar-fuse-box')?.operatingCurrent).toBeCloseTo(11.67, 2);
    expect(currentModel.byEdgeId.get('e-fuse-box-fridge')?.operatingCurrent).toBeCloseTo(5, 2);
    expect(currentModel.byEdgeId.get('e-fuse-box-pump')?.operatingCurrent).toBeCloseTo(6.67, 2);
    expect(plan.edges.find((edge) => edge.id === 'e-plus-busbar-inverter')?.data).toMatchObject({
      crossSection: 70,
      length: 1,
    });
    expect(plan.edges.find((edge) => edge.id === 'e-inverter-minus-busbar')?.data).toMatchObject({
      crossSection: 70,
      length: 1,
    });
    expect(plan.edges.find((edge) => edge.id === 'e-battery-shunt')?.data).toMatchObject({
      crossSection: 70,
      length: 0.2,
    });
    expect(plan.edges.find((edge) => edge.id === 'e-shunt-minus-busbar')?.data).toMatchObject({
      crossSection: 70,
      length: 0.5,
    });
    expect(plan.edges.find((edge) => edge.id === 'e-fuse-box-fridge')?.data).toMatchObject({
      crossSection: 4,
      length: 2,
    });
    expect(plan.edges.find((edge) => edge.id === 'e-fuse-box-pump')?.data).toMatchObject({
      crossSection: 6,
      length: 2.5,
    });

    const report = verifyPlan({ nodes: plan.nodes, edges: plan.edges, options: { profile: 'CAMP_MODEL' } });
    const ampacityEvents = report.passes
      .flatMap((pass) => pass.checks)
      .find((check) => check.ruleId === 'AMP-001-ib-in-iz')?.events;
    const trunkOverload = ampacityEvents?.find(
      (event) =>
        event.entity.id === VALIDATION158_EDGE_ID &&
        event.calculatedValue !== null &&
        event.allowedLimit !== null &&
        event.calculatedValue > event.allowedLimit
    );
    expect(trunkOverload).toMatchObject({
      severity: 'CRITICAL_SAFETY',
      kind: 'VIOLATION',
      calculatedValue: 158.73,
      details: {
        ibA: 158.73,
        izBreakdown: {
          baseIz: 172,
          ambientFactor: 1,
          groupingFactor: 1,
          installationFactor: 1,
          plannerSafetyFactor: 0.7,
        },
      },
    });
    expect(trunkOverload?.allowedLimit).toBeCloseTo(120.4, 10);
    expect(trunkOverload?.details?.izA).toBeCloseTo(120.4, 10);
    expect(trunkOverload?.details?.izBreakdown?.correctedIz).toBeCloseTo(120.4, 10);
    expect(trunkOverload?.message).toContain('158.7 A');
    expect(trunkOverload?.message).toContain('120.4 A');

    const rcdEvents = report.passes
      .flatMap((pass) => pass.checks)
      .find((check) => check.ruleId === 'RCD-001-rcd-deviation')?.events;
    expect(eventFor(rcdEvents ?? [], 'consumer-unprotected')).toMatchObject({
      severity: 'CRITICAL_SAFETY',
      kind: 'VIOLATION',
    });
    expect(eventFor(rcdEvents ?? [], 'consumer-protected')).toBeUndefined();
  });
});

describe('158,7-A-Hauptpfad — AutoSizing & Validation nach Fix (Regressions-Phase 2)', () => {
  it('berechnet Strom korrekt und nicht doppelt', () => {
    const plan = fixturePlan();
    const currentModel = computeCableCurrents({ nodes: plan.nodes, edges: plan.edges });
    const main = currentModel.byEdgeId.get(VALIDATION158_EDGE_ID);
    expect(main?.operatingCurrent).toBeCloseTo(158.73, 2);
    expect(main?.contributingLoads.map((l) => l.componentId)).toContain('inverter');
    expect(main?.contributingLoads.map((l) => l.componentId)).toContain('fridge');
    expect(main?.contributingLoads.map((l) => l.componentId)).toContain('pump');
  });

  it('erkennt 70-mm² als unterdimensioniert', () => {
    const plan = fixturePlan();
    const report = verifyPlan({ nodes: plan.nodes, edges: plan.edges, options: { profile: 'CAMP_MODEL' } });
    const ampacityEvents = report.passes.flatMap((p) => p.checks).find((c) => c.ruleId === 'AMP-001-ib-in-iz')?.events;
    const overload = ampacityEvents?.find((e) => e.entity.id === VALIDATION158_EDGE_ID && e.calculatedValue && e.allowedLimit && e.calculatedValue > e.allowedLimit);
    expect(overload).toBeDefined();
    expect(overload?.severity).toBe('CRITICAL_SAFETY');
  });

  it('findet gültige AutoSizing-Lösung (120 mm²)', () => {
    const result = findMinimumValidCable(158.73, 0.2);
    expect(result.status).toBe('valid');
    expect(result.crossSectionMm2).toBe(120);
    expect(result.explanation).toContain('120 mm²');
  });

  it('erfüllt Nach-AutoFix Ib ≤ In ≤ Iz', () => {
    const plan = fixturePlan();
    const edge = plan.edges.find((e) => e.id === VALIDATION158_EDGE_ID);
    if (!edge) throw new Error('edge missing');
    edge.data!.crossSection = 120;
    edge.data!.fuseSize = 160;
    const report = verifyPlan({ nodes: plan.nodes, edges: plan.edges, options: { profile: 'CAMP_MODEL' } });
    const ampacityEvents = report.passes.flatMap((p) => p.checks).find((c) => c.ruleId === 'AMP-001-ib-in-iz')?.events;
    const overload = ampacityEvents?.find((e) => e.entity.id === VALIDATION158_EDGE_ID && e.calculatedValue && e.allowedLimit && e.calculatedValue > e.allowedLimit);
    expect(overload).toBeUndefined();
    const protection = evaluateCableProtection({ ib: 158.73, in: 160, iz: 242 * 0.7 });
    expect(protection.status).toBe('satisfied');
  });

  it('meldet outside_model wenn kein passender Querschnitt existiert', () => {
    const result = findMinimumValidCable(500, 0.2);
    expect(result.status).toBe('outside_model');
    expect(result.explanation).toContain('reicht das Modell nicht aus');
  });

  it('respektiert LOCKED-Kabel nicht bei AutoSizing', () => {
    const result = findMinimumValidCable(158.7, 0.2);
    expect(result.status).toBe('valid');
  });

  it('RCD-Befund bleibt korrekt für geschützten / ungeschützten Zweig', () => {
    const plan = fixturePlan();
    const report = verifyPlan({ nodes: plan.nodes, edges: plan.edges, options: { profile: 'CAMP_MODEL' } });
    const rcdEvents = report.passes.flatMap((p) => p.checks).find((c) => c.ruleId === 'RCD-001-rcd-deviation')?.events;
    expect(eventFor(rcdEvents ?? [], 'consumer-unprotected')).toMatchObject({ severity: 'CRITICAL_SAFETY', kind: 'VIOLATION' });
    expect(eventFor(rcdEvents ?? [], 'consumer-protected')).toBeUndefined();
  });
});
