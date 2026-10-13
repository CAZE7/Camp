'use client';

import React from 'react';
import { Check, ChevronRight, Package, Plus, ScanSearch, SlidersHorizontal, Zap } from 'lucide-react';
import type { ValidationWarning } from '../hooks/useLiveValidation';
import type { PlannerFlowNode } from '../../nodes/types';
import { evaluateGuidedSteps, type GuidedEdgeRef, type GuidedStepAction } from '../utils/guidedSteps';
import { useCableRouteFinalValidation } from '../../edges/utils/cableRouteStore';
import type { VerificationVerdict } from '../../../lib/verify/types';

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
  /** Prüfbericht-Verdikt (Schritt „Ergebnis“). */
  verdict: VerificationVerdict;
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
  verdict,
  onOpenCatalog,
  onAutoWire,
  onOpenWarnings,
  onOpenBom,
  onSwitchToExpertMode,
}: GuidedPlanRailProps) {
  // Routing-Gate: nur `VALID` gilt als fehlerfrei. `undefined` heißt „noch kein
  // Routing-Ergebnis“ und zählt ebenfalls als nicht bestätigt.
  const routing = useCableRouteFinalValidation();
  const plan = evaluateGuidedSteps({
    nodes,
    edges,
    warnings,
    verdict,
    routingValid: routing?.status === 'VALID',
  });
  const critical = warnings.filter((warning) => warning.type === 'critical').length;
  const hints = warnings.length - critical;

  const runAction = (kind: GuidedStepAction) => {
    if (kind === 'catalog') onOpenCatalog();
    else if (kind === 'autowire') onAutoWire();
    else if (kind === 'warnings') onOpenWarnings();
    else onOpenBom();
  };

  const ActiveIcon = ACTION_ICONS[plan.activeStep.action.kind];
  const compactActionLabel =
    plan.activeStep.action.kind === 'catalog'
      ? plan.activeStep.id === 'define'
        ? 'Batterie'
        : 'Schutz'
      : plan.activeStep.action.kind === 'autowire'
        ? 'Verbinden'
        : plan.activeStep.action.kind === 'warnings'
          ? 'Prüfen'
          : 'Stückliste';

  // EIN Planstatus statt sieben Warnmechanismen: dieselben Zähler, die auch die
  // Warn-Zentrale nutzt — hier nur als Zusammenfassung mit demselben Klickziel.
  const status =
    critical > 0
      ? {
          tone: 'text-destructive',
          label: `${critical} kritische${critical === 1 ? 's Problem' : ' Probleme'}`,
        }
      : hints > 0
        ? { tone: 'text-warning', label: `${hints} Hinweis${hints === 1 ? '' : 'e'}` }
        : {
            tone: 'text-success',
            label: edges.length > 0 ? `${edges.length} Verbindungen geprüft` : 'Noch keine Verbindungen',
          };

  return (
    <nav
      data-testid="guided-rail"
      aria-label="Planungsablauf"
      className="cad-rail pointer-events-none w-full shrink-0 border-b border-border bg-surface-panel px-3 py-1.5"
    >
      {/* Mobil: Zähler statt fünf Labels — die Leiste soll auf 375 px nicht zur
          dritten Chrome-Zeile werden. `display:none` nimmt die Liste darunter
          auf kleinen Breiten aus dem Accessibility-Tree, darum ist dieser
          Zähler nicht `aria-hidden`. */}
      <span
        data-testid="guided-progress-compact"
        className="cad-rail__compact min-w-0 truncate text-xs font-semibold text-foreground md:hidden"
      >
        Schritt {plan.currentStep} von {plan.steps.length} — {plan.activeStep.label}
      </span>

      <ol className="cad-rail__steps hidden min-w-0 md:flex" data-testid="guided-steps">
        {plan.steps.map((step, index) => {
          const isCurrent = step.status === 'current';
          return (
            <li
              key={step.id}
              data-testid={`guided-step-${step.id}`}
              data-status={step.status}
              aria-current={isCurrent ? 'step' : undefined}
              title={`${step.label}: ${step.detail}`}
              className={`cad-rail__step ${
                isCurrent
                  ? 'cad-rail__step--current'
                  : step.status === 'done'
                    ? 'cad-rail__step--done'
                    : 'cad-rail__step--upcoming'
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

      {/* Ab md steht der Fortschritt in der Liste daneben — hier bleibt nur die
          Begründung, sonst stünde dieselbe Information zweimal in einer Zeile. */}
      <p className="cad-rail__detail hidden min-w-0 truncate text-xs text-muted-foreground lg:block">
        {plan.activeStep.detail}
      </p>

      {/* Ohne offene Hinweise gibt es in der Warn-Zentrale keinen Dialog —
          ein Klickbarer Chip wäre dann ein toter Klick. Deshalb: Status zum
          Lesen, Knopf nur, wenn es etwas zu zeigen gibt. */}
      {warnings.length === 0 ? (
        <span
          data-testid="guided-plan-status"
          role="status"
          className={`cad-rail__status pointer-events-auto hidden min-h-9 items-center gap-1 border border-rule-strong bg-surface-panel px-2 text-xs xl:flex ${status.tone}`}
        >
          {status.label}
        </span>
      ) : (
        <button
          type="button"
          data-testid="guided-plan-status"
          onClick={onOpenWarnings}
          className={`cad-rail__status pointer-events-auto hidden min-h-9 items-center gap-1 border border-rule-strong bg-surface-panel px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex ${status.tone}`}
          title="Planstatus anzeigen"
        >
          {status.label}
        </button>
      )}

      <button
        type="button"
        data-testid="guided-primary-action"
        onClick={() => runAction(plan.activeStep.action.kind)}
        aria-label={plan.activeStep.action.label}
        title={plan.activeStep.action.label}
        className="cad-rail__primary cad-btn cad-btn--primary pointer-events-auto min-h-11"
      >
        <ActiveIcon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="cad-rail__action-label">
          <span className="cad-rail__action-label-full">{plan.activeStep.action.label}</span>
          <span className="cad-rail__action-label-compact" aria-hidden="true">
            {compactActionLabel}
          </span>
        </span>
      </button>

      <button
        type="button"
        data-testid="guided-expert-toggle"
        onClick={onSwitchToExpertMode}
        aria-label="Freie Bearbeitung öffnen"
        className="cad-rail__expert cad-btn cad-btn--ghost pointer-events-auto min-h-11 text-muted-foreground"
        title="Schrittleiste ausblenden und frei im Plan arbeiten"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden lg:inline">Expertenmodus</span>
      </button>
    </nav>
  );
}
