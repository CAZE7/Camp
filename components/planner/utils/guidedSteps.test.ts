import { describe, expect, it } from 'vitest';
import { autoWireFeedbackFor, evaluateGuidedSteps, GUIDED_STEP_IDS, type GuidedEdgeRef } from './guidedSteps';
import type { ValidationWarning } from '../hooks/useLiveValidation';
import type { PlannerFlowNode } from '../../nodes/types';

/** Minimaler Node-Baukasten: die Schritte lesen nur `id` und `type`. */
function node(id: string, type: string): PlannerFlowNode {
  return { id, type, position: { x: 0, y: 0 }, data: {} };
}

function edge(id: string, source: string, target: string): GuidedEdgeRef {
  return { id, source, target } as GuidedEdgeRef;
}

const critical: ValidationWarning = {
  id: 'missing-fuse-1',
  category: 'safety',
  type: 'critical',
  message: 'Hauptsicherung fehlt.',
};
const hint: ValidationWarning = {
  id: 'voltage-drop-1',
  category: 'estimation',
  type: 'info',
  message: 'Spannungsfall hoch.',
};

describe('evaluateGuidedSteps', () => {
  it('nennt bei leerem Plan Schritt 1 als aktuellen Schritt', () => {
    const plan = evaluateGuidedSteps({ nodes: [], edges: [], warnings: [] });

    expect(plan.steps.map((step) => step.id)).toEqual([...GUIDED_STEP_IDS]);
    expect(plan.currentStep).toBe(1);
    expect(plan.completedCount).toBe(0);
    expect(plan.activeStep.id).toBe('define');
    expect(plan.steps[0]!.status).toBe('current');
    expect(plan.steps[1]!.status).toBe('todo');
  });

  it('zählt die Batterie als Schritt 1 und Schutz/Verteilung als Schritt 2', () => {
    const withBattery = evaluateGuidedSteps({
      nodes: [node('b1', 'battery')],
      edges: [],
      warnings: [],
    });
    expect(withBattery.currentStep).toBe(2);
    expect(withBattery.steps[0]!.status).toBe('done');

    const withFuse = evaluateGuidedSteps({
      nodes: [node('b1', 'battery'), node('f1', 'fuse')],
      edges: [],
      warnings: [],
    });
    expect(withFuse.currentStep).toBe(3);
    expect(withFuse.completedCount).toBe(2);
  });

  it('verlangt für Schritt 3 verbundene Verbraucher, nicht nur platzierte', () => {
    const unconnected = evaluateGuidedSteps({
      nodes: [node('b1', 'battery'), node('f1', 'fuse'), node('c1', 'consumer')],
      edges: [],
      warnings: [],
    });
    expect(unconnected.currentStep).toBe(3);
    expect(unconnected.activeStep.detail).toBe('0 von 1 Verbraucher verbunden.');

    const connected = evaluateGuidedSteps({
      nodes: [node('b1', 'battery'), node('f1', 'fuse'), node('c1', 'consumer')],
      edges: [edge('e1', 'b1', 'f1'), edge('e2', 'f1', 'c1')],
      warnings: [],
    });
    expect(connected.steps[2]!.complete).toBe(true);
    expect(connected.steps[2]!.detail).toBe('1 von 1 Verbraucher verbunden.');
    // Ohne offene Hinweise ist die Prüfung erfüllt — der Ablauf endet beim Ergebnis.
    expect(connected.currentStep).toBe(5);
  });

  it('lässt einen Schritt erst gelten, wenn alle davor erledigt sind', () => {
    // Verbraucher verbunden, aber weder Batterie noch Sicherung im Plan:
    // „Verbinden" darf nicht als erledigt gelten, sonst springt die Leiste.
    const plan = evaluateGuidedSteps({
      nodes: [node('c1', 'consumer'), node('c2', 'consumer')],
      edges: [edge('e1', 'c1', 'c2')],
      warnings: [],
    });

    expect(plan.steps.map((step) => step.complete)).toEqual([false, false, false, false, false]);
    expect(plan.currentStep).toBe(1);
    expect(plan.completedCount).toBe(0);
  });

  it('hält Schritt 4 offen, solange ein kritisches Problem besteht', () => {
    const plan = evaluateGuidedSteps({
      nodes: [node('b1', 'battery'), node('f1', 'fuse'), node('c1', 'consumer')],
      edges: [edge('e1', 'b1', 'f1'), edge('e2', 'f1', 'c1')],
      warnings: [critical, hint],
    });

    expect(plan.currentStep).toBe(4);
    expect(plan.activeStep.detail).toBe('1 kritisches Problem offen.');
    expect(plan.steps[4]!.complete).toBe(false);
  });

  it('meldet Hinweise ohne kritisches Problem als erledigte Prüfung', () => {
    const plan = evaluateGuidedSteps({
      nodes: [node('b1', 'battery'), node('f1', 'fuse'), node('c1', 'consumer')],
      edges: [edge('e1', 'b1', 'f1'), edge('e2', 'f1', 'c1')],
      warnings: [hint],
    });

    expect(plan.currentStep).toBe(5);
    expect(plan.activeStep.id).toBe('result');
    expect(plan.completedCount).toBe(5);
    expect(plan.activeStep.action.kind).toBe('bom');
    // Hinweise blockieren den Ablauf nicht, bleiben aber benannt.
    expect(plan.steps[3]!.detail).toBe('Kein kritisches Problem, 1 Hinweis.');
  });

  it('zählt einen Verbraucher erst als verbunden, wenn eine Kante in ihn zeigt', () => {
    // Kante zeigt VOM Verbraucher weg: keine Einspeisung, Schritt 3 bleibt offen.
    const outgoingOnly = evaluateGuidedSteps({
      nodes: [node('b1', 'battery'), node('f1', 'fuse'), node('c1', 'consumer')],
      edges: [edge('e1', 'b1', 'f1'), edge('e2', 'c1', 'f1')],
      warnings: [],
    });
    expect(outgoingOnly.steps[2]!.complete).toBe(false);
    expect(outgoingOnly.steps[2]!.detail).toBe('0 von 1 Verbraucher verbunden.');

    const incoming = evaluateGuidedSteps({
      nodes: [node('b1', 'battery'), node('f1', 'fuse'), node('c1', 'consumer')],
      edges: [edge('e1', 'b1', 'f1'), edge('e2', 'f1', 'c1')],
      warnings: [],
    });
    expect(incoming.steps[2]!.complete).toBe(true);
  });

  it('gibt jedem Schritt eine ausführbare Primäraktion', () => {
    const plan = evaluateGuidedSteps({ nodes: [], edges: [], warnings: [] });

    // Keine Leiste ohne Knopf: Jeder Schritt beantwortet „Was soll ich tun?".
    // Ein `none` gibt es im Typ `GuidedStepAction` gar nicht mehr — der
    // Compiler verbietet den Zustand, dieser Test hält die Zuordnung fest.
    expect(plan.steps.map((step) => step.action.kind)).toEqual([
      'catalog',
      'catalog',
      'autowire',
      'warnings',
      'bom',
    ]);
    expect(plan.steps.every((step) => step.action.label.trim().length > 0)).toBe(true);
  });

  it('weist jedem offenen Schritt genau einen aktuellen Schritt zu', () => {
    const plan = evaluateGuidedSteps({
      nodes: [node('b1', 'battery')],
      edges: [],
      warnings: [],
    });
    const current = plan.steps.filter((step) => step.status === 'current');
    expect(current).toHaveLength(1);
    expect(plan.steps.filter((step) => step.status === 'done')).toHaveLength(plan.completedCount);
  });
});

describe('autoWireFeedbackFor', () => {
  it('verlangt eine Batterie, bevor AutoWire etwas melden darf', () => {
    expect(autoWireFeedbackFor([])).toEqual({
      type: 'error',
      message: 'Platziere zuerst eine Batterie.',
    });
    expect(autoWireFeedbackFor([node('b1', 'battery')])).toEqual({
      type: 'success',
      message: 'Automatische Verkabelung und Dimensionierung abgeschlossen.',
    });
  });
});
