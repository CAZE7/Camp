'use client';

import React from 'react';
import { Check, ChevronRight, Package, Plus, ScanSearch, SlidersHorizontal, Zap } from 'lucide-react';
import type { ValidationWarning } from '../hooks/useLiveValidation';
import type { PlannerFlowNode } from '../../nodes/types';
import { evaluateGuidedSteps, type GuidedEdgeRef, type GuidedStepAction } from '../utils/guidedSteps';

/**
 * Geführte Planungsleiste — die sichtbare Antwort auf „Was kommt als Nächstes?".
 *
 * UX-Reset 2026-09: Der Planer hat AutoWire, Routing, Validierung und Stückliste
 * gleichzeitig angeboten, aber nie gesagt, in welchem Schritt die Planung steht.
 * Diese Leiste zeigt genau EINEN nächsten Schritt plus dessen Primäraktion; die
 * Werkzeugkasten-Aktionen bleiben im `⋯`-Menü (Expertenmodus schaltet die Leiste
 * ganz ab).
 *
 * Jeder Schritt hat eine ausführbare Aktion — auch Schritt 1. Eine Leiste, die
 * „Schritt 1 von 5" sagt und keinen Knopf anbietet, beantwortet die Frage nicht,
 * die sie stellt.
 *
 * Die Komponente rechnet selbst nichts Elektrisches (Rule D): Der Fortschritt
 * kommt aus `evaluateGuidedSteps`, die Hinweise aus `useLiveValidation`.
 */
export interface GuidedPlanRailProps {
  nodes: PlannerFlowNode[];
  edges: readonly GuidedEdgeRef[];
  warnings: ValidationWarning[];
  /** Öffnet den Bauteilkatalog (mobile: Tab; Desktop: Spalte auf + Fokus Suche). */
  onOpenCatalog: () => void;
  onAutoWire: () => void;
  onOpenWarnings: () => void;
  onOpenBom: () => void;
  onSwitchToExpertMode: () => void;
}

const ACTION_ICONS: Record<GuidedStepAction, React.ComponentType<{ className?: string }>> = {
  catalog: Plus,
  autowire: Zap,
  warnings: ScanSearch,
  bom: Package,
};

export function GuidedPlanRail({
  nodes,
  edges,
  warnings,
  onOpenCatalog,
  onAutoWire,
  onOpenWarnings,
  onOpenBom,
  onSwitchToExpertMode,
}: GuidedPlanRailProps) {
  const plan = evaluateGuidedSteps({ nodes, edges, warnings });
  const critical = warnings.filter((warning) => warning.type === 'critical').length;
  const hints = warnings.length - critical;

  const runAction = (kind: GuidedStepAction) => {
    if (kind === 'catalog') onOpenCatalog();
    else if (kind === 'autowire') onAutoWire();
    else if (kind === 'warnings') onOpenWarnings();
    else onOpenBom();
  };

  const ActiveIcon = ACTION_ICONS[plan.activeStep.action.kind];

  // EIN Planstatus statt sieben Warnmechanismen: dieselben Zähler, die auch die
  // Warn-Zentrale nutzt — hier nur als Zusammenfassung mit demselben Klickziel.
  const status =
    critical > 0
      ? { tone: 'text-signal', label: `${critical} kritische${critical === 1 ? 's Problem' : ' Probleme'}` }
      : hints > 0
        ? { tone: 'text-copper', label: `${hints} Hinweis${hints === 1 ? '' : 'e'}` }
        : {
            tone: 'text-moss',
            label: edges.length > 0 ? `${edges.length} Verbindungen geprüft` : 'Noch keine Verbindungen',
          };

  return (
    <nav
      data-testid="guided-rail"
      aria-label="Planungsablauf"
      className="flex w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface-panel px-3 py-1.5"
    >
      {/* Mobil: Zähler statt fünf Labels — die Leiste soll auf 375 px nicht zur
          dritten Chrome-Zeile werden. `display:none` nimmt die Liste darunter
          auf kleinen Breiten aus dem Accessibility-Tree, darum ist dieser
          Zähler nicht `aria-hidden`. */}
      <span
        data-testid="guided-progress-compact"
        className="min-w-0 truncate text-xs font-semibold text-foreground sm:hidden"
      >
        Schritt {plan.currentStep} von {plan.steps.length} — {plan.activeStep.label}
      </span>

      <ol
        className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1 sm:flex"
        data-testid="guided-steps"
      >
        {plan.steps.map((step, index) => {
          const isCurrent = step.status === 'current';
          return (
            <li
              key={step.id}
              data-testid={`guided-step-${step.id}`}
              data-status={step.status}
              aria-current={isCurrent ? 'step' : undefined}
              title={`${step.label}: ${step.detail}`}
              className={`flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${
                isCurrent
                  ? 'bg-accent text-foreground'
                  : step.status === 'done'
                    ? 'text-moss'
                    : 'text-muted-foreground'
              }`}
            >
              {step.status === 'done' ? (
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <span aria-hidden="true" className="shrink-0 tabular-nums">
                  {index + 1}
                </span>
              )}
              <span className="truncate">{step.label}</span>
              <span className="sr-only">
                {step.status === 'done' ? ' (erledigt)' : isCurrent ? ' (aktueller Schritt)' : ' (offen)'}
              </span>
              {index < plan.steps.length - 1 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>

      {/* Ab sm steht der Fortschritt in der Liste daneben — hier bleibt nur die
          Begründung, sonst stünde dieselbe Information zweimal in einer Zeile. */}
      <p className="hidden min-w-0 text-xs text-muted-foreground sm:block">{plan.activeStep.detail}</p>

      <button
        type="button"
        data-testid="guided-plan-status"
        onClick={onOpenWarnings}
        className={`flex min-h-9 items-center gap-1 rounded border border-border bg-card px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${status.tone}`}
        title="Planstatus anzeigen"
      >
        {status.label}
      </button>

      <button
        type="button"
        data-testid="guided-primary-action"
        onClick={() => runAction(plan.activeStep.action.kind)}
        className="flex min-h-9 items-center gap-1.5 rounded bg-primary px-3 text-xs font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ActiveIcon className="h-3.5 w-3.5" />
        {plan.activeStep.action.label}
      </button>

      <button
        type="button"
        data-testid="guided-expert-toggle"
        onClick={onSwitchToExpertMode}
        className="flex min-h-9 items-center gap-1 rounded px-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Schrittleiste ausblenden und frei im Plan arbeiten"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden lg:inline">Expertenmodus</span>
      </button>
    </nav>
  );
}
