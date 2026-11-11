'use client';

import React, { useState } from 'react';
import { Droplets, Frame, Minimize2, Redo2, Undo2, Zap } from 'lucide-react';

import { usePlannerStore } from '../../../store/usePlannerStore';
import { CanvasDisplayOptions } from './CanvasDisplayOptions';
import { PlannerModeSwitch } from './PlannerModeSwitch';
import type { Domain } from '../utils/domainFilter';

/**
 * Werkzeugzone des Handy-Schaltplans — IM Fluss, nicht darüber (Spec §6.2).
 *
 * Zwei Zeilen im Hochformat: Verlauf/Zoom, dann Planbereich und Modus. Im
 * flachen Querformat (Höhe ≤ 500 px) bleibt es eine waagerecht scrollbare
 * Zeile. „Darstellung“ ist ein zugeklappter Bereich DIESER Zone: Aufklappen
 * vergrößert die Zone und verkleinert die Fläche — es entsteht kein
 * `fixed`-Popover über dem Plan.
 *
 * Die Modus-Erklärung steht als eine gekürzte Zeile hier (voller Satz in
 * `title` und `aria-label`), damit das schwebende Kärtchen im Canvas auf dem
 * Handy entfallen kann.
 */
export function PhoneCanvasTools({
  zoomPercent,
  onFitView,
  onOpenDetail,
  activeDomains,
  onToggleDomain,
}: {
  zoomPercent: number;
  onFitView: () => void;
  /** Öffnet die Eigenschaften der aktuellen Auswahl als volle Ebene. */
  onOpenDetail: () => void;
  activeDomains: Set<Domain>;
  onToggleDomain: (domain: Domain) => void;
}) {
  const undo = usePlannerStore((state) => state.undo);
  const redo = usePlannerStore((state) => state.redo);
  const canUndo = usePlannerStore((state) => state.canUndo);
  const canRedo = usePlannerStore((state) => state.canRedo);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const setViewMode = usePlannerStore((state) => state.setViewMode);
  const plannerMode = usePlannerStore((state) => state.plannerMode);
  const setPlannerMode = usePlannerStore((state) => state.setPlannerMode);
  const focusMode = usePlannerStore((state) => state.focusMode);
  const setFocusMode = usePlannerStore((state) => state.setFocusMode);
  const trunkMode = usePlannerStore((state) => state.trunkMode);
  const setTrunkMode = usePlannerStore((state) => state.setTrunkMode);
  const backboneGrouping = usePlannerStore((state) => state.backboneGrouping);
  const setBackboneGrouping = usePlannerStore((state) => state.setBackboneGrouping);
  const detailLevel = usePlannerStore((state) => state.detailLevel);
  const setDetailLevel = usePlannerStore((state) => state.setDetailLevel);
  const [displayOpen, setDisplayOpen] = useState(false);
  const selectionCount = usePlannerStore((state) => state.selectedNodes.length + state.selectedEdges.length);

  const caption =
    plannerMode === 'physisch'
      ? 'Physisch: Wo liegt es? Leitungslängen sind eingeblendet (Schätzmaßstab 100 px = 1 m).'
      : plannerMode === 'pruefung'
        ? 'Prüfung: Stimmt es? Bauteile und Leitungen mit Befunden sind markiert, unauffällige abgedunkelt.'
        : 'Planung: Was gehört elektrisch zusammen?';

  const zoomIn = () => window.dispatchEvent(new CustomEvent('planner-zoom-in'));
  const zoomOut = () => window.dispatchEvent(new CustomEvent('planner-zoom-out'));

  return (
    <div
      data-testid="phone-canvas-toolbar"
      // Die Zone liegt IM Fluss und darf die Fläche nicht auffressen. Im
      // flachen Querformat (393 px hoch) schob der aufgeklappte Bereich
      // „Darstellung“ die Zeichenfläche auf 0 px und lief unter die Fußleiste
      // (gemessen 852×393). Deshalb scrollt die Zone ab einer Höhengrenze in
      // sich (`overscroll-behavior: contain`) — der Deckel setzt CSS, weil er
      // von der Fensterhöhe abhängt (33dvh, nie bis zur Fußleiste).
      className="planner-phone-toolbar flex shrink-0 flex-col overflow-y-auto overscroll-contain border-b border-border bg-surface-panel"
    >
      <div className="flex items-center gap-1 overflow-x-auto overscroll-x-contain px-2 py-1">
        <button
          type="button"
          data-testid="mobile-undo"
          onClick={undo}
          disabled={!canUndo}
          aria-label="Rückgängig"
          className="cad-btn cad-btn--line min-h-11 min-w-11 shrink-0 justify-center"
        >
          <Undo2 size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="mobile-redo"
          onClick={redo}
          disabled={!canRedo}
          aria-label="Wiederholen"
          className="cad-btn cad-btn--line min-h-11 min-w-11 shrink-0 justify-center"
        >
          <Redo2 size={18} aria-hidden="true" />
        </button>
        <span className="cad-toolbar__sep shrink-0" aria-hidden="true" />
        <button
          type="button"
          data-testid="phone-zoom-out"
          aria-label="Verkleinern"
          onClick={zoomOut}
          className="cad-btn cad-btn--line min-h-11 min-w-11 shrink-0 justify-center"
        >
          −
        </button>
        <span
          className="min-w-10 shrink-0 text-center text-xs text-ink-soft tabular-nums"
          data-testid="phone-zoom"
        >
          {Math.round(zoomPercent)} %
        </span>
        <button
          type="button"
          data-testid="phone-zoom-in"
          aria-label="Vergrößern"
          onClick={zoomIn}
          className="cad-btn cad-btn--line min-h-11 min-w-11 shrink-0 justify-center"
        >
          +
        </button>
        <button
          type="button"
          // Alte Kennung bewusst beibehalten: Die E2E-Suite misst „Übersicht“
          // seit der ersten Handy-Runde unter `mobile-overview`; die Aktion
          // ist dieselbe (`planner-fit-view`, volle Ansicht).
          data-testid="mobile-overview"
          onClick={onFitView}
          className="cad-btn cad-btn--line min-h-11 shrink-0"
        >
          Übersicht
        </button>
        {/*
          Eigenschaften der Auswahl. Im Handy-Entwurf öffnete ein ZWEITES
          Antippen auf dem Schaltplan das Detail (Spec §7); auf einer
          Zeichenfläche mit Pan- und Verbindungsgesten ist ein Doppeltipp
          jedoch nicht verlässlich von „zwei Verbindungsversuchen“ zu
          unterscheiden. Der Weg ist deshalb ein sichtbarer Knopf — dieselbe
          Ebene, dieselbe Store-Auswahl, nur ohne Gestenrisiko.
        */}
        <button
          type="button"
          data-testid="phone-open-detail"
          onClick={onOpenDetail}
          disabled={selectionCount === 0}
          aria-label={
            selectionCount > 0
              ? `Eigenschaften der Auswahl öffnen, ${selectionCount} Element${selectionCount === 1 ? '' : 'e'}`
              : 'Eigenschaften der Auswahl öffnen'
          }
          className="cad-btn cad-btn--line min-h-11 shrink-0"
        >
          Details{selectionCount > 0 ? ` (${selectionCount})` : ''}
        </button>
        <button
          type="button"
          data-testid="phone-display-toggle"
          aria-expanded={displayOpen}
          aria-controls="phone-display-options"
          onClick={() => setDisplayOpen((open) => !open)}
          className="cad-btn cad-btn--line min-h-11 shrink-0"
        >
          Darstellung
        </button>
        <button
          type="button"
          data-testid="phone-focus-toggle"
          aria-pressed={focusMode}
          aria-label={focusMode ? 'Fokusmodus verlassen' : 'Vollbild (Fokusmodus)'}
          onClick={() => setFocusMode(!focusMode)}
          className="cad-btn cad-btn--line min-h-11 min-w-11 shrink-0 justify-center"
        >
          {focusMode ? <Minimize2 size={18} aria-hidden="true" /> : <Frame size={18} aria-hidden="true" />}
        </button>
      </div>

      <div className="flex items-center gap-1 border-t border-rule px-2 py-1">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'electric'}
          aria-label="Elektrikplan anzeigen"
          data-testid="phone-viewmode-electric"
          onClick={() => setViewMode('electric')}
          className={`cad-btn min-h-11 min-w-11 shrink-0 justify-center ${
            viewMode === 'electric' ? 'cad-btn--active' : 'cad-btn--line'
          }`}
        >
          <Zap size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'water'}
          aria-label="Wasserplan anzeigen"
          data-testid="phone-viewmode-water"
          onClick={() => setViewMode('water')}
          className={`cad-btn min-h-11 min-w-11 shrink-0 justify-center ${
            viewMode === 'water' ? 'cad-btn--active' : 'cad-btn--line'
          }`}
        >
          <Droplets size={16} aria-hidden="true" />
        </button>
        <span className="cad-toolbar__sep shrink-0" aria-hidden="true" />
        <div className="min-w-0 shrink-0">
          <PlannerModeSwitch mode={plannerMode} onSelect={setPlannerMode} />
        </div>
      </div>

      <p
        data-testid="planner-mode-caption"
        title={caption}
        aria-label={caption}
        className="truncate border-t border-rule px-2 py-1 text-xs text-ink-soft"
      >
        {caption}
      </p>

      {displayOpen && (
        <div
          id="phone-display-options"
          data-testid="phone-display-options"
          className="border-t border-border p-2"
        >
          <CanvasDisplayOptions
            variant="flow"
            activeDomains={activeDomains}
            onToggleDomain={onToggleDomain}
            trunkMode={trunkMode}
            onToggleTrunkMode={() => setTrunkMode(!trunkMode)}
            backboneGrouping={backboneGrouping}
            onToggleBackboneGrouping={() => setBackboneGrouping(!backboneGrouping)}
            detailLevel={detailLevel}
            onSelectDetailLevel={setDetailLevel}
          />
        </div>
      )}
    </div>
  );
}
