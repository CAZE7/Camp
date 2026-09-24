import type { ValidationWarning } from '../hooks/useLiveValidation';
import type { PlannerFlowNode } from '../../nodes/types';

/**
 * Geführter Planungsablauf — die Antwort auf „Was soll ich als Nächstes tun?“.
 *
 * Der Planer ist technisch breit (AutoWire, Routing, Validierung, Stückliste),
 * aber die Oberfläche beantwortete bisher nicht, in welchem Schritt sich die
 * Planung befindet. Dieses Modul liefert die fünf Schritte als REINE
 * Ableitung aus dem Planzustand: keine Seiteneffekte, kein React, damit die
 * Reihenfolge deterministisch und testbar bleibt (Rule D: UI rechnet nicht).
 *
 * Bewusst KEINE Zoom-/Darstellungslogik: Detailgrad bleibt Aufgabe von
 * `ui/NodePresentation.tsx` (M8-1 — eine Darstellung für den ganzen Zoombereich).
 */

export const GUIDED_STEP_IDS = ['define', 'components', 'connect', 'verify', 'result'] as const;

export type GuidedStepId = (typeof GUIDED_STEP_IDS)[number];

export type GuidedStepStatus = 'done' | 'current' | 'todo';

/** Primäraktion des aktuellen Schritts — ausgeführt von `GuidedPlanRail`. */
export type GuidedStepAction = 'autowire' | 'warnings' | 'bom' | 'none';

export interface GuidedStep {
  id: GuidedStepId;
  /** Kurzer Schrittname für die Fortschrittsleiste. */
  label: string;
  /** Ein Satz, der den Schritt erklärt (kein Fachjargon). */
  hint: string;
  /** Wahr, wenn die fachliche Bedingung des Schritts erfüllt ist. */
  complete: boolean;
  status: GuidedStepStatus;
  /** Messbare Begründung für den Zustand, z. B. „2 von 3 Verbrauchern verbunden“. */
  detail: string;
  action: { label: string; kind: GuidedStepAction };
}

export interface GuidedPlanSteps {
  steps: GuidedStep[];
  /** 1-basierter Index des ersten unvollständigen Schritts (5 = alles erledigt). */
  currentStep: number;
  /** Anzahl erfüllter Schritte — für „3 von 5 erledigt“. */
  completedCount: number;
  /** Der Schritt, dessen Aktion der Nutzer als Nächstes ausführen soll. */
  activeStep: GuidedStep;
}

/** Bauteile, die ohne Batterie keinen Sinn ergeben — Schritt 1. */
const SOURCE_SET: ReadonlySet<string> = new Set(['battery']);

/** Schutz/Verteilung: mindestens eines davon gehört in jede Anlage — Schritt 2. */
export const GUIDED_CORE_TYPES = ['fuse', 'busbar', 'shunt'] as const;

/** Verbraucher (12 V und 230 V) — Schritt 3. */
export const GUIDED_CONSUMER_TYPES = ['consumer', 'consumer230v'] as const;

const CORE_SET: ReadonlySet<string> = new Set(GUIDED_CORE_TYPES);
const CONSUMER_SET: ReadonlySet<string> = new Set(GUIDED_CONSUMER_TYPES);

function countTypes(nodes: PlannerFlowNode[], types: ReadonlySet<string>): number {
  return nodes.reduce((count, node) => (types.has(String(node.type)) ? count + 1 : count), 0);
}

/** Wie viele Verbraucher hängen an mindestens einer Leitung? */
function connectedConsumers(nodes: PlannerFlowNode[], edges: readonly GuidedEdgeRef[]): number {
  const touched = new Set<string>();
  for (const edge of edges) {
    touched.add(edge.source);
    touched.add(edge.target);
  }
  return nodes.reduce(
    (count, node) => (CONSUMER_SET.has(String(node.type)) && touched.has(node.id) ? count + 1 : count),
    0
  );
}

/**
 * Rückmeldung nach „Automatisch verbinden" — eine Quelle für denselben Satz,
 * egal ob die Aktion aus der Schrittleiste oder aus der Toolbar kommt.
 * AutoWire selbst entscheidet weiterhin in `lib/autoWire` (Rule D).
 */
export function autoWireFeedbackFor(nodes: PlannerFlowNode[]): {
  type: 'success' | 'error';
  message: string;
} {
  const hasBattery = nodes.some((node) => node.type === 'battery');
  return hasBattery
    ? { type: 'success', message: 'Automatische Verkabelung und Dimensionierung abgeschlossen.' }
    : { type: 'error', message: 'Platziere zuerst eine Batterie.' };
}

/**
 * Minimaler struktureller Kantenauszug: Die Schritte brauchen nur, WER mit WEM
 * verbunden ist — nicht die Kabeldaten. So bleibt das Modul unabhängig von der
 * React-Flow-Kantenform und direkt testbar.
 */
export interface GuidedEdgeRef {
  source: string;
  target: string;
}

export interface GuidedPlanInput {
  nodes: PlannerFlowNode[];
  edges: readonly GuidedEdgeRef[];
  warnings: ValidationWarning[];
}

/**
 * Leitet die fünf Planungsschritte aus dem Elektrikplan ab.
 *
 * Reihenfolge der Zustände: alle erfüllten Schritte sind `done`, der erste
 * unerfüllte ist `current`, der Rest `todo`. Dadurch ist die Leiste immer
 * konsistent — auch wenn ein Nutzer Schritte überspringt (dann ist der erste
 * offene Schritt der aktuelle, die späteren bleiben offen).
 */
export function evaluateGuidedSteps({ nodes, edges, warnings }: GuidedPlanInput): GuidedPlanSteps {
  const hasSource = countTypes(nodes, SOURCE_SET) > 0;
  const coreCount = countTypes(nodes, CORE_SET);
  const consumerCount = countTypes(nodes, CONSUMER_SET);
  const wiredConsumers = connectedConsumers(nodes, edges);
  const criticalCount = warnings.filter((warning) => warning.type === 'critical').length;
  const warningCount = warnings.filter((warning) => warning.type !== 'critical').length;

  // Rohbedingungen je Schritt — OHNE Reihenfolge.
  const rawConditions = [
    hasSource,
    coreCount > 0,
    consumerCount > 0 && wiredConsumers >= consumerCount,
    criticalCount === 0,
    true, // Schritt 5 ist das Ergebnis: verfügbar, sobald die vier davor stehen.
  ];

  /**
   * Ein geführter Ablauf ist kumulativ: Ein Schritt gilt erst als erledigt,
   * wenn alle davor erledigt sind. Ohne diese Prefix-Regel meldete „Prüfen"
   * „erledigt" für einen leeren Plan (keine kritischen Probleme — weil es
   * nichts zu prüfen gab) und die Leiste sprang mitten im Aufbau ans Ende.
   */
  const complete = rawConditions.reduce<boolean[]>((acc, condition, index) => {
    acc.push(index === 0 ? condition : acc[index - 1]! && condition);
    return acc;
  }, []);

  const details = [
    hasSource ? 'Batterie ist im Plan.' : 'Noch keine Batterie im Plan.',
    coreCount > 0
      ? `${coreCount} Schutz-/Verteilungsbauteil${coreCount === 1 ? '' : 'e'} vorhanden.`
      : 'Sicherung, Sammelschiene oder Shunt fehlt noch.',
    consumerCount === 0
      ? 'Noch keine Verbraucher im Plan.'
      : `${wiredConsumers} von ${consumerCount} Verbraucher${consumerCount === 1 ? '' : 'n'} verbunden.`,
    nodes.length === 0
      ? 'Erst Bauteile platzieren, dann prüfen.'
      : criticalCount > 0
        ? `${criticalCount} kritische${criticalCount === 1 ? 's Problem' : ' Probleme'} offen.`
        : warningCount > 0
          ? `Kein kritisches Problem, ${warningCount} Hinweis${warningCount === 1 ? '' : 'e'}.`
          : 'Keine offenen Hinweise.',
    complete[4] ? 'Plan ist vollständig und geprüft.' : 'Noch nicht alle Schritte erledigt.',
  ];

  const labels = ['Anlage', 'Kern', 'Verbinden', 'Prüfen', 'Ergebnis'];
  const hints = [
    'Jede Anlage startet mit der Aufbaubatterie.',
    'Hauptsicherung, Sammelschiene oder Shunt schützen die Leitung.',
    'Verbinde Quellen, Schutz und Verbraucher — oder lass den Planer rechnen.',
    'Prüfung von Topologie, Polarität, Querschnitt und Sicherungen.',
    'Stückliste, Kabel und Berechnungen für Einkauf und Einbau.',
  ];
  const actions: GuidedStep['action'][] = [
    { label: 'Bauteile öffnen', kind: 'none' },
    { label: 'Bauteile öffnen', kind: 'none' },
    { label: 'Automatisch verbinden', kind: 'autowire' },
    { label: 'Prüfung öffnen', kind: 'warnings' },
    { label: 'Stückliste öffnen', kind: 'bom' },
  ];

  const firstOpenIndex = complete.findIndex((value) => !value);
  const currentIndex = firstOpenIndex === -1 ? complete.length - 1 : firstOpenIndex;

  const steps: GuidedStep[] = labels.map((label, index) => ({
    id: GUIDED_STEP_IDS[index]!,
    label,
    hint: hints[index]!,
    complete: complete[index]!,
    status: complete[index]! ? 'done' : index === currentIndex ? 'current' : 'todo',
    detail: details[index]!,
    action: actions[index]!,
  }));

  return {
    steps,
    currentStep: currentIndex + 1,
    completedCount: complete.filter(Boolean).length,
    activeStep: steps[currentIndex]!,
  };
}
