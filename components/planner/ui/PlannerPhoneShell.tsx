'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Layers,
  LayoutTemplate,
  MoreHorizontal,
  ScanSearch,
  Workflow,
} from 'lucide-react';

import { usePlannerStore } from '../../../store/usePlannerStore';
import { useAppStore } from '../../../lib/store';
import { SaveIndicator } from './SaveIndicator';
import {
  PlannerMessageSlot,
  resolvePlannerMessage,
  useDialogOpen,
  type PlannerMessage,
} from './PlannerMessageSlot';
import { usePlannerActions, type PlannerActions } from '../hooks/usePlannerActions';
import { useLiveValidation, useVerificationReport, type ValidationWarning } from '../hooks/useLiveValidation';
import { verificationSummary } from '../utils/verificationWarnings';
import { VerificationSeal } from './VerificationSeal';
import { nextStepSummary } from '../utils/verificationActions';
import { PLANNER_TEMPLATES } from '../templates';
import { PHONE_CHROME_QUERY as PHONE_CHROME_QUERY_SOURCE } from './breakpoints';
import { requestConfirm } from '../../ui/ConfirmDialog';

/**
 * Handy-Hülle des Planers — vier Ansichten, ein Meldungsplatz, eine Fußleiste.
 *
 * Spezifikation §5–§8 („Mobile Planer Design“, PR #610) und Erweiterung §16.
 * Die Hülle hat eine andere Informationsarchitektur als Desktop und Tablet
 * (Liste statt Fläche, Ansichten statt Menüs). Sie liegt deshalb in eigenen
 * Komponenten; das Desktop-Markup (`PlannerDashboard`) bleibt unverändert.
 *
 * Grenze: `(max-width: 767px), (max-height: 500px)` — dieselbe Abfrage wie
 * beim Erscheinen der Hülle (`PlannerInner`), siehe `PHONE_CHROME_QUERY`.
 *
 * Die Zeichenfläche bleibt in JEDER Ansicht montiert und im Layout: Sie wird
 * beim Ansichtswechsel nicht ausgehängt (sonst verliert React Flow seine
 * gemessene Pane-Größe) — sie liegt unter der Ansicht und wird `inert`.
 */

export type PhoneView = 'bauteile' | 'schaltplan' | 'pruefung' | 'mehr';

export const PHONE_CHROME_QUERY = PHONE_CHROME_QUERY_SOURCE;

/**
 * Markierung der Anwendungsshell für die Handy-Hülle.
 *
 * Die Hülle bringt eigene Werkzeuge mit (Zoom, Undo, Modus, Darstellung).
 * Damit die schwebenden Canvas-Griffe (React-Flow-`Controls`, MiniMap,
 * Undo-Leiste, Experten-FAB, Modus-/Ansichtskärtchen) nicht ein zweites Mal
 * über der Fläche liegen, setzt `PlannerInner` dieses Attribut an der Shell.
 * `app/globals.css` blendet die Griffe danach aus — CSS ist hier die eine
 * Wahrheit, weil dieselbe Grenze auch `md:`-Klassen betrifft.
 */
export const PHONE_SHELL_ATTRIBUTE = 'data-phone-shell';

export const PHONE_VIEW_TESTIDS: Record<PhoneView, string> = {
  bauteile: 'nav-tab-bauteile',
  schaltplan: 'nav-tab-schaltplan',
  pruefung: 'nav-tab-pruefung',
  mehr: 'nav-tab-mehr',
};

export const PHONE_VIEW_LABELS: Record<PhoneView, string> = {
  bauteile: 'Bauteile',
  schaltplan: 'Schaltplan',
  pruefung: 'Prüfung',
  mehr: 'Mehr',
};

/** Kopfzeile: Home, Projektname, Speicherzustand — sonst nichts (Spec §5.1). */
export function PlannerPhoneHeader({ projectName }: { projectName: string }) {
  const nodes = usePlannerStore((state) => state.nodes);
  const edges = usePlannerStore((state) => state.edges);
  const waterNodes = usePlannerStore((state) => state.waterNodes);
  const waterEdges = usePlannerStore((state) => state.waterEdges);
  const revision = useMemo(
    () => [nodes, edges, waterNodes, waterEdges],
    [nodes, edges, waterNodes, waterEdges]
  );
  return (
    <header
      data-testid="planner-phone-header"
      className="planner-phone-header flex shrink-0 items-center gap-2 border-b border-border bg-surface-panel px-2 py-1"
    >
      <Link
        href="/"
        aria-label="Zur Startseite"
        title="Zur Startseite"
        className="cad-btn min-h-11 min-w-11 justify-center"
      >
        <Home size={18} aria-hidden="true" />
      </Link>
      <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-foreground">
        {projectName}
      </span>
      <SaveIndicator revision={revision} />
    </header>
  );
}

/**
 * Fußnavigation: vier Ziele, je mindestens 56 × 56 px (Spec §5.2).
 *
 * Der Badge an „Prüfung“ ist die bestehende Zahl kritischer Befunde — sie
 * steht zusätzlich im `aria-label`, damit sie nicht nur eine Farbe ist.
 * Quelle ist der bereits synchronisierte `plannerErrors`-Bestand des Stores;
 * diese Leiste rechnet bewusst keine Prüfung nach.
 */
export function PlannerPhoneNav({
  activeView,
  onSelectView,
}: {
  activeView: PhoneView;
  onSelectView: (view: PhoneView) => void;
}) {
  const criticalCount = usePlannerStore(
    (state) => state.plannerErrors.filter((error) => error.severity === 'critical').length
  );
  const icons: Record<PhoneView, React.ReactNode> = {
    bauteile: <Layers size={20} aria-hidden="true" />,
    schaltplan: <Workflow size={20} aria-hidden="true" />,
    pruefung: <ScanSearch size={20} aria-hidden="true" />,
    mehr: <MoreHorizontal size={20} aria-hidden="true" />,
  };
  const order: PhoneView[] = ['bauteile', 'schaltplan', 'pruefung', 'mehr'];

  return (
    <nav
      data-testid="planner-bottom-nav"
      className="planner-bottom-nav z-chrome flex shrink-0 items-center border-t border-border bg-surface-panel"
      aria-label="Planerbereiche"
    >
      {order.map((view) => {
        const active = activeView === view;
        const badge = view === 'pruefung' ? criticalCount : 0;
        const label = PHONE_VIEW_LABELS[view];
        return (
          <button
            key={view}
            type="button"
            // Dynamisch, aber mit stabilem Präfix — dieselbe Kennung wie im
            // Vertragstest (`components/e2eSelectors.test.tsx`).
            data-testid={`nav-tab-${view}`}
            aria-current={active ? 'page' : undefined}
            aria-label={badge > 0 ? `${label}, ${badge} kritisch` : undefined}
            onClick={() => onSelectView(view)}
            className={`relative flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              active ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
          >
            {icons[view]}
            <span>{label}</span>
            {badge > 0 ? (
              <span
                className="absolute top-1 right-1 flex min-h-4 min-w-4 items-center justify-center border border-border bg-surface-panel px-0.5 text-xs leading-none text-foreground"
                aria-hidden="true"
              >
                {badge > 9 ? '9+' : badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export interface PlannerPhoneViewProps {
  view: Exclude<PhoneView, 'schaltplan'>;
  actions: PlannerActions;
  onSelectView: (view: PhoneView) => void;
  onOpenCatalog: () => void;
  onOpenDetail: () => void;
}

export interface PlannerPhoneLayerProps {
  view: Exclude<PhoneView, 'schaltplan'>;
  onSelectView: (view: PhoneView) => void;
  onOpenCatalog: () => void;
  onOpenDetail: () => void;
}

/**
 * Handy-Ebene: die Ansicht (falls ≠ Schaltplan).
 *
 * Der Meldungsplatz liegt NICHT hier, sondern in der Hülle (`PlannerInner`):
 * Er muss unter jeder Ansicht im Fluss stehen und die Ansicht nach oben
 * schieben; im Layer schwebte er über der Zeichenfläche (gemessen 375×667).
 *
 * Beides lag einmal HIER, weil der Platz unter JEDER Ansicht stehen muss — auch
 * unter dem Schaltplan (Spec §5.3: Verbindungshinweise benutzen denselben
 * Platz). Auf dem Desktop sitzt derselbe Platz unter der Werkzeugleiste.
 */
export function PlannerPhoneLayer({
  view,
  onSelectView,
  onOpenCatalog,
  onOpenDetail,
}: PlannerPhoneLayerProps) {
  const actions = usePhoneActions();
  return (
    <div
      data-testid="planner-phone-layer"
      className="absolute inset-0 z-sheet flex min-h-0 flex-col bg-surface-panel"
    >
      {/* `flex-1` + `min-h-0`: Die Ansicht füllt die Fläche, der Meldungsplatz
          nimmt nur seine eigene Höhe. Er schiebt die Ansicht nach oben,
          statt sie zu überdecken (Spec §5.3). */}
      <PlannerPhoneView
        view={view}
        actions={actions}
        onSelectView={onSelectView}
        onOpenCatalog={onOpenCatalog}
        onOpenDetail={onOpenDetail}
      />
      {/* Der Meldungsplatz steht NICHT hier, sondern einmal in der Hülle
          (`PlannerInner`): Er muss die Ansicht nach oben schieben (Spec §5.3).
          Im Layer schwebte er über der Zeichenfläche — nach dem Schließen des
          Katalogs lag er dort bei y = 532, während der Arbeitsbereich bis
          616 px wuchs und ihn verdeckte (gemessen 375×667). */}
    </div>
  );
}

/**
 * Der EINE Meldungsplatz der Handy-Hülle.
 *
 * Reihenfolge (Spec §5.3): eine Meldung, im Fluss zwischen Ansicht und
 * Fußleiste. Ist ein Dialog offen, bleibt der Platz leer und der Text wartet
 * im Store. Eine Aktionsmeldung hat Vorrang vor dem Einstiegstext — nie
 * stehen zwei planbezogene Aussagen gleichzeitig da (AC-O2).
 */
export function PlannerPhoneMessageBar({ entryMessage }: { entryMessage: PlannerMessage | null }) {
  const message = usePlannerStore((state) => state.plannerMessage);
  const setMessage = usePlannerStore((state) => state.setPlannerMessage);
  const dialogOpen = useDialogOpen();
  return (
    <PlannerMessageSlot
      message={resolvePlannerMessage(message, entryMessage)}
      onDismiss={() => setMessage(null)}
      hidden={dialogOpen}
      className="planner-message-slot--phone"
    />
  );
}

/**
 * Aktionen der Handy-Hülle — derselbe Hook wie die Chrome-Leiste, damit
 * Handler und `data-testid`s identisch bleiben (Spec §6.4). Der Hook wird nur
 * auf dem Handy aufgerufen; am Desktop bleibt es bei EINER Instanz in
 * `PlannerDashboard` (kein zweites Menümodell).
 */
function usePhoneActions(): PlannerActions {
  const nodes = usePlannerStore((state) => state.nodes);
  const edges = usePlannerStore((state) => state.edges);
  const autoWireReport = usePlannerStore((state) => state.autoWireReport);
  const setPlannerMessage = usePlannerStore((state) => state.setPlannerMessage);
  const report = useVerificationReport(nodes, edges);
  const warnings = useLiveValidation(nodes, edges, report, autoWireReport);
  return usePlannerActions({
    warnings,
    onFeedback: setPlannerMessage,
    onRequestReset: () => {
      void requestConfirm(
        'Neuen leeren Plan starten? Alle Komponenten und Leitungen werden entfernt. Du kannst die Aktion mit Strg+Z oder dem Rückgängig-Button rückgängig machen.'
      ).then((ok) => {
        if (ok) usePlannerStore.getState().clearPlan?.();
      });
    },
  });
}

/**
 * Inhalt einer Handy-Ansicht über der (montierten) Zeichenfläche.
 *
 * Der Meldungsplatz liegt hier als letztes Flex-Kind: Er schiebt die Ansicht
 * nach oben, statt sie zu überdecken (Spec §5.3).
 */
export function PlannerPhoneView({
  view,
  actions,
  onSelectView,
  onOpenCatalog,
  onOpenDetail,
}: PlannerPhoneViewProps) {
  return (
    <section
      data-testid="planner-phone-view"
      data-phone-view={view}
      aria-label={PHONE_VIEW_LABELS[view]}
      className="planner-phone-view flex min-h-0 flex-1 flex-col"
    >
      {view === 'bauteile' && <PhonePartsList onOpenCatalog={onOpenCatalog} onOpenDetail={onOpenDetail} />}
      {view === 'pruefung' && <PhoneCheckView onSelectView={onSelectView} />}
      {view === 'mehr' && <PhoneMoreView actions={actions} />}
    </section>
  );
}

/** Ansicht **Bauteile** — Startansicht (Spec §6.1), gesetzte Bauteile des Bereichs. */
function PhonePartsList({
  onOpenCatalog,
  onOpenDetail,
}: {
  onOpenCatalog: () => void;
  onOpenDetail: () => void;
}) {
  const nodes = usePlannerStore((state) => state.nodes);
  const waterNodes = usePlannerStore((state) => state.waterNodes);
  const edges = usePlannerStore((state) => state.edges);
  const waterEdges = usePlannerStore((state) => state.waterEdges);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const selectedNodes = usePlannerStore((state) => state.selectedNodes);
  const setSelectedNodes = usePlannerStore((state) => state.setSelectedNodes);
  const setSelectedEdges = usePlannerStore((state) => state.setSelectedEdges);

  const list = viewMode === 'water' ? waterNodes : nodes;
  const wires = viewMode === 'water' ? waterEdges : edges;

  if (list.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-base font-semibold text-foreground">Fang mit deiner Batterie an</h2>
        <p className="max-w-xs text-sm text-ink-soft">
          Ein Plan entsteht von der Quelle zu den Verbrauchern. Setze zuerst eine Batterie — alles Weitere
          baut darauf auf.
        </p>
        <button
          type="button"
          data-testid="phone-add-battery"
          onClick={onOpenCatalog}
          className="cad-btn cad-btn--primary min-h-11"
        >
          Batterie hinzufügen
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <h2 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
          {viewMode === 'water' ? 'Wasser' : 'Elektrik'} · {list.length}{' '}
          {list.length === 1 ? 'Bauteil' : 'Bauteile'} · {wires.length}{' '}
          {wires.length === 1 ? 'Leitung' : 'Leitungen'}
        </h2>
        <button
          type="button"
          onClick={onOpenCatalog}
          className="cad-btn cad-btn--line min-h-11"
          data-testid="phone-add"
        >
          Hinzufügen
        </button>
      </div>
      <ul
        data-testid="phone-parts-list"
        className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain"
      >
        {list.map((node) => {
          const selected = selectedNodes.some((entry) => entry.id === node.id);
          const label = String((node.data as { label?: string } | undefined)?.label ?? node.type ?? node.id);
          return (
            <li key={node.id}>
              <button
                type="button"
                data-testid={`phone-part-${node.id}`}
                aria-current={selected ? 'true' : undefined}
                onClick={() => {
                  setSelectedNodes([node]);
                  setSelectedEdges([]);
                  onOpenDetail();
                }}
                className={`flex min-h-14 w-full items-center gap-2 px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  selected ? 'bg-accent' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{label}</span>
                  <span className="block truncate text-xs text-ink-soft">{node.type ?? 'Bauteil'}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-soft" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <p
        className="shrink-0 border-t border-border px-3 py-2 text-xs text-ink-soft"
        data-testid="phone-selection-hint"
      >
        {selectedNodes.length === 0
          ? 'Zeile antippen öffnet die Eigenschaften.'
          : `${selectedNodes.length} Element${selectedNodes.length === 1 ? '' : 'e'} gewählt.`}
      </p>
    </div>
  );
}

/**
 * Ansicht **Prüfung** — der volle Bericht als eigene Ansicht (Spec §6.3).
 *
 * Inhalt aus den bestehenden Quellen: Warnliste der Live-Validierung, Verdikt
 * und nächster Schritt der Verifikations-Engine. Dieses Modul rechnet nichts
 * nach und formuliert keine Norm.
 */
function PhoneCheckView({ onSelectView }: { onSelectView: (view: PhoneView) => void }) {
  const nodes = usePlannerStore((state) => state.nodes);
  const edges = usePlannerStore((state) => state.edges);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const autoWireReport = usePlannerStore((state) => state.autoWireReport);
  const focusElement = usePlannerStore((state) => state.focusElement);
  const report = useVerificationReport(nodes, edges);
  const summary = useMemo(() => verificationSummary(report), [report]);
  const next = useMemo(() => nextStepSummary(report), [report]);
  const warnings = useLiveValidation(nodes, edges, report, autoWireReport);

  const showInCanvas = (warning: ValidationWarning) => {
    if (warning.focusId && warning.focusType) focusElement(warning.focusId, warning.focusType);
    onSelectView('schaltplan');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <h2 className="text-sm font-bold text-foreground">Prüfung</h2>
        <p
          className={`text-xs font-semibold ${summary.tone === 'bad' ? 'text-warn-critical' : 'text-moss'}`}
          data-testid="phone-check-verdict"
        >
          {summary.label}
        </p>
        <p className="text-xs text-ink-soft">{next}</p>
        {/* Siegel und Prüfbericht: Am Desktop sitzt das Siegel in der
            Werkzeugleiste, die es in der Hülle nicht gibt (Spec §5.2). Ohne
            diesen Zugang wäre der Bericht — Verdikt, Abdeckung, Modellgrenzen,
            Zertifikat — auf dem Handy unerreichbar; die Fußleiste trägt nur die
            Zahl. Dasselbe Bauteil, dieselbe Zusammenfassung, kein zweiter
            Rechenweg. */}
        <div className="mt-1">
          <VerificationSeal summary={summary} nextStep={next} />
        </div>
      </div>
      {warnings.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Keine offenen Befunde.</p>
          <p className="max-w-xs text-xs text-ink-soft">
            Der Bericht wird bei jeder Änderung neu gerechnet. Was der Plan nicht entscheiden kann, steht als
            Lücke im Bericht — nicht als „in Ordnung“.
          </p>
        </div>
      ) : (
        <ul
          data-testid="phone-check-list"
          className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain"
        >
          {warnings.map((warning) => (
            <li key={warning.id} className="px-3 py-2">
              <p className="text-sm font-semibold text-foreground">{warning.title ?? warning.message}</p>
              {warning.title && warning.message && (
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{warning.message}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-semibold ${
                    warning.type === 'critical'
                      ? 'text-warn-critical'
                      : warning.type === 'warning'
                        ? 'text-warn-warning'
                        : 'text-warn-info'
                  }`}
                >
                  {warning.type === 'critical'
                    ? 'Kritisch'
                    : warning.type === 'warning'
                      ? 'Warnung'
                      : 'Hinweis'}
                </span>
                {warning.focusId && (
                  <button
                    type="button"
                    onClick={() => showInCanvas(warning)}
                    className="cad-btn cad-btn--line min-h-11 text-xs"
                  >
                    Im Schaltplan zeigen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {viewMode === 'water' && (
        <p className="shrink-0 border-t border-border px-3 py-2 text-xs text-ink-soft">
          Wasserplan: Es gelten die Wasser-Hinweise; die elektrische Trassenprüfung läuft hier nicht.
        </p>
      )}
    </div>
  );
}

/**
 * Ansicht **Mehr** — die einzige Stelle für Plan-Aktionen (Spec §6.4).
 *
 * Quelle ist `usePlannerActions` im Elternbauteil: dieselben Handler und
 * `data-testid`s wie Desktop, hier genau einmal sichtbar (AC-K1).
 */
function PhoneMoreView({ actions }: { actions: PlannerActions }) {
  const detailLevel = usePlannerStore((state) => state.detailLevel);
  const setDetailLevel = usePlannerStore((state) => state.setDetailLevel);
  const season = usePlannerStore((state) => state.season);
  const setSeason = usePlannerStore((state) => state.setSeason);
  const setHasOnboarded = useAppStore((state) => state.setHasOnboarded);
  const [resetOpen, setResetOpen] = useState(false);

  const row = (label: string, hint: string | undefined, onClick: () => void, testId: string) => (
    <button
      key={testId}
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-soft" aria-hidden="true" />
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <h2 className="text-sm font-bold text-foreground">Mehr</h2>
        <p className="text-xs text-ink-soft">Aktionen und Einstellungen — alles an einem Ort.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        <section aria-label="Automatik">
          <p className="px-3 pt-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">Automatik</p>
          {row(
            'Automatisch verbinden',
            'Vorschlag berechnen und erst nach Bestätigung übernehmen',
            actions.runAutoWire,
            'action-autowire'
          )}
          {row(
            'Anordnung anpassen',
            'Leitungen bleiben, wie sie sind',
            () => void actions.runLayoutV2(),
            'action-layout-v2-menu'
          )}
          {row(
            'Kabelwege optimieren',
            'Geräte bleiben stehen',
            actions.runOptimizeRouting,
            'action-optimize-routing'
          )}
          {row('Prüfung', 'Befunde und Empfehlungen', actions.runCheck, 'action-check')}
          {row('Am Raster ausrichten', 'grobe Ordnung ohne ELK', actions.runGridLayout, 'action-layout')}
        </section>

        <section aria-label="Vorlagen">
          <p className="px-3 pt-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">Vorlagen</p>
          <div className="px-3 py-2">
            {PLANNER_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                data-testid={`action-template-${template.id}`}
                onClick={() => actions.loadTemplate(template.id)}
                className="mb-2 flex w-full items-start gap-2 border border-border bg-surface-panel px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <LayoutTemplate size={16} className="mt-0.5 shrink-0 text-oxide" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{template.label}</span>
                  <span className="block text-xs text-ink-soft">{template.description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-label="Ausgabe">
          <p className="px-3 pt-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">Ausgabe</p>
          {row('Stückliste', '', actions.openBom, 'action-bom')}
          {row(
            'Plan als Bild exportieren',
            'PNG, für Foren und Doku',
            () => void actions.exportImage(),
            'action-export-image'
          )}
          {row(
            'Link zum Plan kopieren',
            'Enthält den ganzen Plan',
            () => void actions.sharePlan(),
            'action-share-plan'
          )}
          {row('Projekt speichern (.json)', '', actions.saveProject, 'action-project-save')}
          {row('Projekt öffnen (.json)', '', () => void actions.openProject(), 'action-project-open')}
          {/* Kein zweiter Katalog-Einstieg: „Hinzufügen“ steht genau einmal in
              der Ansicht **Bauteile** (Spec §6.1, AC-K1). */}
        </section>

        <section aria-label="Darstellung">
          <p className="px-3 pt-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">Darstellung</p>
          {row(
            detailLevel === 'detail' ? 'Messwerte ausblenden' : 'Messwerte einblenden',
            'Detailgrad der Bauteilkarte',
            () => setDetailLevel(detailLevel === 'detail' ? 'overview' : 'detail'),
            'phone-detail-level'
          )}
          <div className="flex gap-2 border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={() => setSeason('summer')}
              aria-pressed={season === 'summer'}
              className={`cad-btn min-h-11 flex-1 ${season === 'summer' ? 'cad-btn--active' : 'cad-btn--line'}`}
            >
              Sommer
            </button>
            <button
              type="button"
              onClick={() => setSeason('winter')}
              aria-pressed={season === 'winter'}
              className={`cad-btn min-h-11 flex-1 ${season === 'winter' ? 'cad-btn--active' : 'cad-btn--line'}`}
            >
              Winter
            </button>
          </div>
        </section>

        <section aria-label="Hilfe">
          <p className="px-3 pt-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">Hilfe</p>
          {row(
            'Hilfe & Fachwissen',
            'Experten-Panel',
            () => window.dispatchEvent(new CustomEvent('planner-open-expert-panel')),
            'action-help'
          )}
          {row('Tastaturkürzel', '', actions.openShortcuts, 'action-shortcuts')}
          {row('Einführung erneut öffnen', '', () => setHasOnboarded(false), 'phone-onboarding')}
        </section>

        <section aria-label="Plan">
          <p className="px-3 pt-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">Plan</p>
          {row(
            'Neuen leeren Plan starten',
            'Fragt vor dem Ersetzen',
            () => setResetOpen(true),
            'action-reset'
          )}
          {resetOpen && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
              <span className="min-w-0 flex-1 text-xs text-ink-soft">Neuen leeren Plan starten?</span>
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                className="cad-btn cad-btn--line min-h-11"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  const store = usePlannerStore.getState();
                  store.clearPlan?.();
                  setResetOpen(false);
                  // Dieselbe Rückmeldung wie am Desktop (`PlannerDashboard`):
                  // Ohne sie bleibt die Einstiegsmeldung stehen, obwohl der
                  // Plan leer ist (im Handy-Lauf gemessen). Der Meldungsplatz
                  // liegt in der Hülle und zeigt sie sofort.
                  store.setPlannerMessage?.({
                    type: 'success',
                    message: 'Leerer Plan gestartet.',
                    actionLabel: 'Rückgängig',
                    onAction: store.undo,
                  });
                }}
                className="cad-btn cad-btn--line min-h-11 border-destructive text-destructive"
              >
                Plan leeren
              </button>
            </div>
          )}
        </section>

        <section aria-label="Am Desktop verfügbar" className="px-3 py-3">
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Am Desktop verfügbar</p>
          <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed text-ink-soft">
            <li>MiniMap und Werkzeugleiste mit Zoom</li>
            <li>Eigenschaften als feste Spalte neben dem Plan</li>
            <li>Menüleiste mit Datei, Bearbeiten, Ansicht, Werkzeuge, Planung, Hilfe</li>
            <li>Vollständige Statuszeile unter dem Plan</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
