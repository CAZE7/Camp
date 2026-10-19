'use client';

import React, { useEffect, useState } from 'react';
import { ReactFlowProvider, useStore as useFlowStore } from '@xyflow/react';
import { usePlannerDarkMode } from './planner/hooks/usePlannerTheme';
import '@xyflow/react/dist/style.css';
import { PlannerSidebar } from './planner/PlannerSidebar';
import { PlannerInspector } from './planner/PlannerInspector';
import { PlannerDashboard } from './planner/PlannerDashboard';
import { FlowCanvas } from './planner/FlowCanvas';
import { PlannerStatusBar } from './planner/ui/PlannerStatusBar';
import { ErrorBoundary } from './ErrorBoundary';
import { ExpertPanel } from './planner/ExpertPanel';
import { OnboardingWizard } from './planner/OnboardingWizard';
import { ShortcutOverlay } from './planner/ui/ShortcutOverlay';
import { ConfirmDialogHost, requestConfirm } from './ui/ConfirmDialog';
import { CanvasSkeleton } from './ui/Skeleton';
import {
  Frame,
  Layers,
  Map as MapIcon,
  Minimize2,
  Settings2,
  Droplets,
  X,
  Undo2,
  Redo2,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { usePlannerStore } from '../store/usePlannerStore';

/**
 * Layout-Container des Planers — drei Geräteklassen, ein DOM-Baum.
 *
 * Die Umschaltung passiert bewusst in CSS (Tailwind-Breakpoints) und nicht in
 * JavaScript: so stimmt das Layout schon beim ersten Frame (kein Flackern nach
 * der Hydration) und es gibt keine „falsche“ Geräteklasse beim Fenster-Resize.
 *
 *  < 768 px  (Handy)   : Zeichenfläche füllt den Arbeitsbereich; Palette und
 *                        Eigenschaften legen sich als Blätter darüber
 *                        (`max-md:absolute inset-0`, Umschaltung über die
 *                        Fußleiste). Der Canvas bleibt montiert — er behält
 *                        seine gemessene Größe und ist nach dem Schließen
 *                        sofort wieder bedienbar.
 *  768–1279 px (Tablet): Palette (260 px) + Canvas; Inspector als Slide-over
 *                        von rechts (320 px, mit Backdrop).
 *  ≥ 1280 px (Desktop) : feste 3 Spalten — Palette 248 px | Canvas flex-1
 *                        (min. 600 px) | Eigenschaften 288 px (ab 1536: 320 px).
 *
 * Aufbau der Anwendungsshell (oben nach unten): Menüleiste, Werkzeugleiste,
 * Arbeitsbereich (Palette | Zeichenfläche | Eigenschaften), Statuszeile. Nur
 * Panels scrollen — die Seite selbst nie (Höhe aus `app/globals.css`:
 * `100dvh` mit `100vh`-Rückfall, `overflow: hidden`).
 *
 * Warum der Inspector erst ab 1280 px andockt (und nicht ab 1024 px):
 * 1024 − 248 − 288 = 488 px Canvas. Das verletzt die geforderte Mindestbreite
 * von 600 px und macht den Plan unbrauchbar. Zwischen 768 und 1279 px bleibt
 * er deshalb Slide-over; der Canvas behält dort die volle Restbreite.
 *
 * Warum auf dem Handy Blätter statt Tabs (M12):
 * Vorher ersetzte der Katalog die Zeichenfläche (`hidden`). Das war nicht nur
 * ein Wechsel der Ansicht: React Flow verlor seine gemessene Größe, ein
 * hinzugefügtes Bauteil wartete 30 Frames auf eine messbare Pane
 * (`PANE_WAIT_FRAMES`) und landete ohne sie auf einem festen Raster. Als Blatt
 * bleibt die Zeichenfläche die ganze Zeit im Layout — der Zusatz sitzt sofort
 * dort, wo der Nutzer ihn erwartet, und die Geste (Pan/Pinch) arbeitet auf
 * einer unveränderten Größe weiter.
 */
/**
 * Die Provider-Grenze liegt VOR dem eigentlichen Shell-Baum: `useStore` aus
 * React Flow (Zoom für die Statuszeile) ist nur innerhalb eines
 * `ReactFlowProvider` erlaubt. Läge der Aufruf in derselben Komponente, die den
 * Provider rendert, gäbe es keinen Kontext — deshalb zwei Ebenen.
 */
export default function PlannerInner() {
  return (
    <ReactFlowProvider>
      <PlannerShell />
    </ReactFlowProvider>
  );
}

function PlannerShell() {
  const [activeTab, setActiveTab] = useState<'sidebar' | 'canvas' | 'inspector'>('canvas');
  const hasOnboarded = useAppStore((state) => state.hasOnboarded);
  const setViewMode = usePlannerStore((state) => state.setViewMode);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const isInspectorOpen = usePlannerStore((state) => state.isInspectorOpen);
  const setInspectorOpen = usePlannerStore((state) => state.setInspectorOpen);
  const focusMode = usePlannerStore((state) => state.focusMode);
  const setFocusMode = usePlannerStore((state) => state.setFocusMode);
  const selectionCount = usePlannerStore((state) => state.selectedNodes.length + state.selectedEdges.length);
  const canUndo = usePlannerStore((state) => state.canUndo);
  const canRedo = usePlannerStore((state) => state.canRedo);
  const undo = usePlannerStore((state) => state.undo);
  const redo = usePlannerStore((state) => state.redo);
  const showMobileOverview = usePlannerStore((state) =>
    state.viewMode === 'water' ? state.waterNodes.length > 8 : state.nodes.length > 8
  );
  const zoom = useFlowStore((state) => state.transform[2] ?? 1);

  // Auswahl öffnet den Inspector, leere Auswahl schließt ihn — dokumentierte
  // Slide-over-Semantik unterhalb des Andock-Breakpoints. Das Effect hängt an
  // der Auswahl-SIGNATUR, nicht an ihrer Länge (Tausch A→B bleibt offen).
  const selectionSignature = usePlannerStore((state) =>
    [...state.selectedNodes.map((n) => n.id), ...state.selectedEdges.map((e) => e.id)].join('|')
  );
  useEffect(() => {
    setInspectorOpen(selectionSignature !== '');
  }, [selectionSignature, setInspectorOpen]);

  // Fokusmodus: Die Seite dahinter darf nicht scrollen, solange der Planer das
  // Fenster hält (eigenständige Anwendung, kein Dokumentenfluss).
  useEffect(() => {
    if (!focusMode) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [focusMode]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // `event.target` kann auch das Document sein (kein fokussiertes Element)
      // — dann gibt es kein `matches`, und der Handler darf trotzdem nicht werfen.
      const target = event.target as HTMLElement | null;
      if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) usePlannerStore.getState().redo();
        else usePlannerStore.getState().undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        usePlannerStore.getState().redo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        // Der Plan wird ohnehin laufend lokal gespeichert; Ctrl+S bestätigt das
        // nur sichtbar, statt den Browser-Speichern-Dialog zu öffnen.
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('planner-save'));
      } else if (event.key === 'Escape') {
        // Ein offener Dialog (Stückliste, Reset-Rückfrage, Onboarding) hat
        // Vorrang — sonst würden zwei Ebenen gleichzeitig schließen.
        if (document.querySelector('[role="dialog"]')) return;
        const state = usePlannerStore.getState();
        if (state.focusMode) {
          state.setFocusMode(false);
          return;
        }
        // Escape hebt zuerst die Auswahl auf (Standard-Bedeutung). Der
        // Inspector schließt dadurch auf allen Geräteklassen über den
        // Auswahl-Effekt — die dritte Spalte selbst bleibt am Desktop als
        // Layout erhalten, statt als Ganzes einzuklappen.
        state.setSelectedNodes([]);
        state.setSelectedEdges([]);
        state.setInspectorOpen(false);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        const state = usePlannerStore.getState();
        if (state.selectedNodes.length > 0 || state.selectedEdges.length > 0) {
          event.preventDefault();
          void requestConfirm(
            'Ausgewählte Elemente wirklich löschen? Du kannst die Aktion anschließend rückgängig machen.'
          ).then((ok) => {
            if (ok) usePlannerStore.getState().deleteSelected();
          });
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleMobileAdd = () => setActiveTab('canvas');

  /**
   * Blatt-Umschaltung der Fußleiste (Handy).
   *
   * `Bauteile` und `Details` sind dort keine Seiten mehr, sondern Blätter über
   * der Zeichenfläche: Ein zweiter Tipp auf denselben Eintrag schließt wieder,
   * ein Tipp auf `Elektrik`/`Wasser` ebenfalls. Auf Tablet und Desktop werden
   * dieselben Schalter zu Spalten-/Overlay-Schaltern — deshalb setzt jede
   * Aktion zusätzlich den Store-Zustand, den die Geräteklassen ab 768 px lesen.
   */
  const togglePanel = (panel: 'sidebar' | 'inspector') => {
    setActiveTab((current) => (current === panel ? 'canvas' : panel));
    if (panel === 'sidebar') usePlannerStore.getState().setSidebarOpen(true);
    if (panel === 'inspector') usePlannerStore.getState().setInspectorOpen(true);
  };

  const closePanels = () => setActiveTab('canvas');

  /**
   * „Bauteile hinzufügen" aus der Schrittleiste (UX-Reset 2026-09).
   *
   * Der Katalog ist je Geräteklasse etwas anderes: Auf dem Handy ein eigener
   * Tab, ab 768 px eine einklappbare Spalte. Beides wird hier bedient, danach
   * geht der Fokus ins Suchfeld — der nächste Schritt ist damit ohne Suchen
   * erreichbar. Der Fokus liegt im Frame danach, weil der Tab-Bereich auf dem
   * Handy erst mit diesem Render sichtbar wird.
   */
  useEffect(() => {
    const openCatalog = () => {
      setActiveTab('sidebar');
      usePlannerStore.getState().setSidebarOpen(true);
      window.requestAnimationFrame(() => {
        document.getElementById('component-search')?.focus();
      });
    };
    window.addEventListener('planner-open-catalog', openCatalog);
    return () => window.removeEventListener('planner-open-catalog', openCatalog);
  }, []);

  // 56 px Kantenlänge – deutlich über den geforderten 44 px Touch-Target.
  const navClass = (active: boolean) =>
    `relative flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active ? 'bg-accent text-foreground' : 'text-muted-foreground'
    }`;

  /**
   * Eigenschaften-Spalte: auf jeder Geräteklasse dieselbe Box, drei Zustände.
   *
   *  < 768 px  : Blatt über dem Arbeitsbereich (`max-md:absolute inset-0`),
   *              Sichtbarkeit über den Fußleisten-Schalter (`activeTab`).
   *  768–1279  : Slide-over von rechts, 320 px, mit Backdrop (`md:fixed`).
   *  ≥ 1280 px : dritte Spalte; eingeklappt bleibt sie als 0-px-Spalte im
   *              Layout (kein Overlay, kein Schatten), `invisible` nimmt sie
   *              aus der Tastatur-Reihenfolge.
   *
   * `max-md:`-Varianten sind Absicht: Ohne sie würde das mobile `inset-0` auch
   * am Tablet greifen und das Slide-over auf volle Breite ziehen.
   */
  const inspectorClass = [
    'min-h-0 flex-col bg-surface-panel',
    activeTab === 'inspector' ? 'max-md:absolute max-md:inset-0 max-md:z-40 max-md:flex' : 'max-md:hidden',
    isInspectorOpen
      ? 'md:fixed md:inset-y-0 md:right-0 md:z-40 md:flex md:w-80 md:flex-none md:border-l md:border-border'
      : 'md:hidden',
    isInspectorOpen
      ? 'xl:static xl:z-auto xl:flex xl:w-[288px] xl:flex-none 2xl:w-[320px]'
      : 'xl:static xl:invisible xl:flex xl:w-0 xl:flex-none xl:overflow-hidden xl:border-l-0',
  ].join(' ');

  const isDarkPlanner = usePlannerDarkMode();

  /**
   * Dokument-Sperre: Der Planer IST das Dokument auf `/planer/`, kein Abschnitt
   * einer Seite. `html`/`body` dürfen deshalb nicht mitscrollen — sonst schiebt
   * ein Touch-Drag am Canvas-Rand die gesamte Anwendung samt Werkzeugleiste aus
   * dem Bild (Gummiband-Effekt) und die Scrollposition ist nach dem Schließen
   * eines Panels eine andere als davor. Die Klasse wird nur hier gesetzt und
   * beim Unmount entfernt; alle anderen Routen bleiben unberührt.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('planner-root-active');
    return () => root.classList.remove('planner-root-active');
  }, []);

  return (
    <div
      data-testid="planner-shell"
      data-panel-open={activeTab === 'canvas' ? 'false' : 'true'}
      data-active-tab={activeTab}
      className={`planner-shell relative flex h-dvh min-h-0 w-full shrink-0 flex-col overflow-hidden bg-background font-sans ${focusMode ? 'planner-shell--focus' : ''} ${isDarkPlanner ? 'dark' : ''}`.trimEnd()}
    >
      {!hasOnboarded && <OnboardingWizard />}
      <ShortcutOverlay />
      <ConfirmDialogHost />
      {focusMode && (
        <button
          type="button"
          data-testid="focus-mode-exit"
          onClick={() => setFocusMode(false)}
          className="planner-focus-exit cad-btn cad-btn--line min-h-11 min-w-11 justify-center"
          aria-label="Fokusmodus verlassen"
          title="Fokusmodus verlassen"
        >
          <Minimize2 size={18} aria-hidden="true" />
        </button>
      )}

      {/* Chrome: Menüleiste + Werkzeugleiste (+ geführte Schrittleiste). */}
      <PlannerDashboard />

      <div
        data-testid="planner-workspace"
        // `relative`: Bezug für die Blätter auf dem Handy und für die
        // Panel-Umschalter, die als absolut positionierte Griffe auf der
        // Panelkante sitzen. Bezug ist damit der Arbeitsbereich — nicht die
        // Anwendungsshell, sonst lägen sie unter der Menüleiste.
        className="planner-workspace relative flex min-h-0 min-w-0 flex-1 flex-col md:flex-row"
      >
        {/* Kein `w-auto`: die exakte Spaltenbreite (260 px Tablet / 248 px
            Desktop) setzt das einklappbare Panel selbst, damit „eingeklappt“
            auch wirklich 0 px Spaltenbreite bedeutet. */}
        <div
          data-testid="planner-sidebar-slot"
          className={`min-h-0 w-full flex-1 md:flex md:w-fit md:flex-none ${
            activeTab === 'sidebar'
              ? 'max-md:absolute max-md:inset-0 max-md:z-40 max-md:flex max-md:flex-col'
              : 'hidden md:flex'
          }`}
        >
          <PlannerSidebar onMobileAdd={handleMobileAdd} onCloseMobile={closePanels} />
        </div>

        {/* Zeichenfläche: auf jeder Breite sichtbar und montiert. `isolate`
            hält die schwebenden Canvas-Griffe (Undo/Redo, Expertenschalter,
            z-50) in dieser Spalte — sie dürfen nicht über die Blätter des
            Handys zeichnen, die eine Ebene höher liegen. */}
        <div
          data-testid="planner-canvas-column"
          className="isolate flex min-w-0 flex-1 flex-col xl:min-w-[600px]"
        >
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <React.Suspense fallback={<CanvasSkeleton />}>
              {/* Fehlergrenze: Ein Werfen in einer Node-/Routing-Komponente
                  reißt nicht mehr die ganze Planer-Seite. Der Plan liegt im
                  Store/localStorage und bleibt über Katalog und Export
                  erreichbar. */}
              <ErrorBoundary
                fallback={
                  <div
                    role="alert"
                    className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-6 text-center"
                  >
                    <p className="panel-title">Fehler</p>
                    <p className="text-sm font-semibold text-foreground">
                      Die Planansicht konnte nicht dargestellt werden.
                    </p>
                    <p className="max-w-md text-xs text-muted-foreground">
                      Dein Plan ist nicht verloren — er liegt lokal gespeichert. Prüfe ihn über die Stückliste
                      oder exportiere ihn, dann lade die Seite neu.
                    </p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="cad-btn cad-btn--line min-h-11"
                    >
                      Seite neu laden
                    </button>
                  </div>
                }
              >
                <FlowCanvas />
              </ErrorBoundary>
            </React.Suspense>
            <ExpertPanel />
          </div>

          {/* Statuszeile unter der Zeichenfläche: Cursor, Zoom, Raster,
              Prüfstatus — wie in Konstruktionswerkzeugen üblich. */}
          <PlannerStatusBar zoom={zoom} />
        </div>

        {/* Backdrop nur im Slide-over-Bereich (768–1279 px). Ab 1280 px ist der
            Inspector eine normale Spalte und darf den Canvas nicht abdecken. */}
        {isInspectorOpen && (
          // Reine Zeiger-Affordanz: `aria-hidden`, damit Screenreader nicht
          // zwei gleichnamige „Schließen“-Elemente ansagen. Der barrierefreie
          // Weg sind der Schließen-Knopf im Panel und die Escape-Taste.
          <div
            data-testid="inspector-backdrop"
            aria-hidden="true"
            onClick={() => setInspectorOpen(false)}
            className="fixed inset-0 z-30 hidden bg-ink/25 md:block xl:hidden"
          />
        )}

        <aside
          id="inspector-panel"
          data-testid="inspector-panel"
          className={inspectorClass}
          aria-label="Eigenschaften"
        >
          {/* Kopfzeile des Overlays — auf dem Handy (Blatt) und am Tablet
              (Slide-over) derselbe Weg nach draußen. Am Desktop gehört sie zur
              Spalte und entfällt (`xl:hidden`). */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2 xl:hidden">
            <span className="panel-title">Eigenschaften</span>
            <button
              type="button"
              onClick={() => {
                setInspectorOpen(false);
                closePanels();
              }}
              className="cad-btn h-11 w-11 justify-center"
              aria-label="Eigenschaften schließen"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <PlannerInspector />
        </aside>
      </div>

      {/* Touch-Undo/Redo bleibt über dem Canvas erreichbar, ohne die fünf
          Bottom-Tabs auf 375 px zusammenzuquetschen. Sichtbar deaktivierte
          Zustände spiegeln die History des Stores unmittelbar. */}
      {activeTab === 'canvas' && (
        <div
          className="planner-mobile-history absolute bottom-20 left-3 z-50 flex gap-1 md:hidden"
          role="group"
          aria-label="Änderungen rückgängig machen oder wiederholen"
        >
          <button
            type="button"
            data-testid="mobile-undo"
            onClick={undo}
            disabled={!canUndo}
            className="cad-btn cad-btn--line h-12 w-12 justify-center"
            aria-label="Rückgängig"
            title="Rückgängig"
          >
            <Undo2 size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="mobile-redo"
            onClick={redo}
            disabled={!canRedo}
            className="cad-btn cad-btn--line h-12 w-12 justify-center"
            aria-label="Wiederholen"
            title="Wiederholen"
          >
            <Redo2 size={18} aria-hidden="true" />
          </button>
          {showMobileOverview && (
            <button
              type="button"
              data-testid="mobile-overview"
              onClick={() => window.dispatchEvent(new CustomEvent('planner-fit-view'))}
              className="cad-btn cad-btn--line flex h-12 items-center gap-2 px-3"
              aria-label="Planübersicht anzeigen"
              title="Planübersicht anzeigen"
            >
              <MapIcon size={18} aria-hidden="true" />
              Übersicht
            </button>
          )}
        </div>
      )}

      {/* Fußleiste: nur Handy. Fünf Ziele in einer Zeile —
          `planner-bottom-nav` ergänzt die iOS-Safe-Area, damit der
          Home-Indicator nichts überdeckt.

          `Bauteile` und `Details` sind Blatt-Schalter (`aria-expanded`), keine
          Seiten: Die Zeichenfläche bleibt darunter im Layout und montiert.
          `Elektrik`/`Wasser` wählen den Planbereich und schließen ein offenes
          Blatt mit — vorher war der Bereichswechsel auf dem Handy hinter dem
          Katalog „versteckt“, weil der Katalog die Zeichenfläche ersetzte. */}
      <nav
        data-testid="planner-bottom-nav"
        className="planner-bottom-nav z-50 flex shrink-0 items-center border-t border-border bg-surface-panel md:hidden"
        aria-label="Planerbereiche"
      >
        <button
          type="button"
          data-testid="nav-tab-sidebar"
          onClick={() => togglePanel('sidebar')}
          className={navClass(activeTab === 'sidebar')}
          aria-expanded={activeTab === 'sidebar'}
          aria-controls="component-palette-panel"
        >
          <Layers size={20} aria-hidden="true" />
          <span>Bauteile</span>
        </button>
        <button
          type="button"
          data-testid="nav-tab-electric"
          onClick={() => {
            closePanels();
            setViewMode('electric');
          }}
          className={navClass(activeTab === 'canvas' && viewMode === 'electric')}
          aria-current={activeTab === 'canvas' && viewMode === 'electric' ? 'page' : undefined}
        >
          <Zap size={20} aria-hidden="true" />
          <span>Elektrik</span>
        </button>
        <button
          type="button"
          data-testid="nav-tab-water"
          onClick={() => {
            closePanels();
            setViewMode('water');
          }}
          className={navClass(activeTab === 'canvas' && viewMode === 'water')}
          aria-current={activeTab === 'canvas' && viewMode === 'water' ? 'page' : undefined}
        >
          <Droplets size={20} aria-hidden="true" />
          <span>Wasser</span>
        </button>
        <button
          type="button"
          data-testid="nav-tab-inspector"
          onClick={() => togglePanel('inspector')}
          className={navClass(activeTab === 'inspector')}
          aria-expanded={activeTab === 'inspector'}
          aria-controls="inspector-panel"
          // Ohne Auswahl bleibt der sichtbare Name „Details“ der zugängliche
          // Name — mit Auswahl nennt die Ansage Zahl und Ziel.
          aria-label={
            selectionCount > 0
              ? `Eigenschaften öffnen, ${selectionCount} Element${selectionCount === 1 ? '' : 'e'} ausgewählt`
              : undefined
          }
        >
          <Settings2 size={20} aria-hidden="true" />
          <span>Details</span>
          {selectionCount > 0 && (
            <span
              className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center border border-border bg-surface-panel px-0.5 text-xs leading-none text-foreground"
              aria-hidden="true"
            >
              {selectionCount > 9 ? '9+' : selectionCount}
            </span>
          )}
        </button>
        {/* Fokusmodus auch auf dem Handy: der Planer nimmt sich den
            Bildschirm, wenn der Nutzer das will — kein Zwangs-Vollbild. */}
        <button
          type="button"
          data-testid="nav-tab-focus"
          onClick={() => setFocusMode(!focusMode)}
          className={navClass(focusMode)}
          // `aria-pressed` trägt den Zustand; der sichtbare Name „Fokus“ bleibt
          // der zugängliche Name (kein Label, das ihn überschreibt).
          aria-pressed={focusMode}
          title={focusMode ? 'Fokusmodus verlassen' : 'Vollbild (Fokusmodus)'}
        >
          {focusMode ? <Minimize2 size={20} aria-hidden="true" /> : <Frame size={20} aria-hidden="true" />}
          <span>Fokus</span>
        </button>
      </nav>
    </div>
  );
}
