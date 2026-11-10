'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider, useStore as useFlowStore } from '@xyflow/react';
import { usePlannerDarkMode } from './planner/hooks/usePlannerTheme';
import '@xyflow/react/dist/style.css';
import { PlannerSidebar } from './planner/PlannerSidebar';
import { PlannerInspector } from './planner/PlannerInspector';
import { PlannerDashboard } from './planner/PlannerDashboard';
import { FlowCanvas } from './planner/FlowCanvas';
import { PlannerStatusBar } from './planner/ui/PlannerStatusBar';
import { usePlannerEntryPlan } from './planner/hooks/usePlannerEntryPlan';
import {
  PlannerPhoneHeader,
  PlannerPhoneLayer,
  PlannerPhoneMessageBar,
  PlannerPhoneNav,
  PHONE_CHROME_QUERY,
  PHONE_SHELL_ATTRIBUTE,
  type PhoneView,
} from './planner/ui/PlannerPhoneShell';
import { PhoneCanvasTools } from './planner/ui/PhoneCanvasTools';

import { ErrorBoundary } from './ErrorBoundary';
import { PlannerCrashFallback } from './planner/ui/PlannerCrashFallback';
import { ExpertPanel } from './planner/ExpertPanel';
import { OnboardingWizard } from './planner/OnboardingWizard';
import { ShortcutOverlay } from './planner/ui/ShortcutOverlay';
import { ConfirmDialogHost, requestConfirm } from './ui/ConfirmDialog';
import { CanvasSkeleton } from './ui/Skeleton';
import { Minimize2, X } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { usePlannerStore } from '../store/usePlannerStore';
import { forgetAuxiliaryBrowserStorage, hasPlannerStorage, restoreFirstVisit } from '../store/freshVisit';
import { subscribePlannerStorageCleared } from '../store/storage';

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
    <ErrorBoundary fallback={(reset) => <PlannerCrashFallback onRetry={reset} />}>
      <ReactFlowProvider>
        <PlannerShell />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}

function PlannerShell() {
  const [activeTab, setActiveTab] = useState<'sidebar' | 'canvas' | 'inspector'>('canvas');
  /**
   * Handy-Ansicht (Spezifikation §5–§7): Startansicht ist **Bauteile**.
   *
   * Der Zustand liegt hier und nicht im Store: Er ist reine Darstellung des
   * Geräts, nicht Teil des Plans, und darf einen Reload nicht überleben
   * (ein gespeicherter „Mehr“-Zustand wäre beim nächsten Öffnen eine
   * Überraschung). Ein Ansichtswechsel wird nicht persistiert.
   */
  const [phoneView, setPhoneView] = useState<PhoneView>('bauteile');
  const [phoneChrome, setPhoneChrome] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE_CHROME_QUERY);
    const apply = () => setPhoneChrome(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  const hasOnboarded = useAppStore((state) => state.hasOnboarded);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const isInspectorOpen = usePlannerStore((state) => state.isInspectorOpen);
  const setInspectorOpen = usePlannerStore((state) => state.setInspectorOpen);
  const focusMode = usePlannerStore((state) => state.focusMode);
  const setFocusMode = usePlannerStore((state) => state.setFocusMode);
  const zoom = useFlowStore((state) => state.transform[2] ?? 1);
  // Einstieg: geteilter Plan (#plan=) → Vorlage (?template=) → Beispiel-Setup
  // beim ersten Besuch. Keine Stufe überschreibt einen eigenen Plan still.
  const { notice: entryNotice, dismissNotice: dismissEntryNotice } = usePlannerEntryPlan();
  const plannerNodeCount = usePlannerStore((state) => state.nodes.length);
  const plannerWaterNodeCount = usePlannerStore((state) => state.waterNodes.length);

  /**
   * Einstiegsmeldung → Meldungsplatz.
   *
   * Vorher lag „Beispiel geladen: …“ als absolut positionierter Streifen über
   * den Karten, blieb nach einem Vorlagenwechsel stehen und widersprach der
   * Erfolgsmeldung der neuen Vorlage (Ist-Befund 2026-11-10). Jetzt schreibt
   * der Einstieg in DENSELBEN Platz wie jede Aktionsmeldung; eine frische
   * Aktionsmeldung hat Vorrang (`resolvePlannerMessage`), und der Text ist an
   * den aktuellen Plan gebunden (der Hook verwirft ihn beim Leeren).
   */
  const setPlannerMessage = usePlannerStore((state) => state.setPlannerMessage);
  useEffect(() => {
    if (!entryNotice) return;
    setPlannerMessage({
      type: entryNotice.type,
      message: entryNotice.message,
    });
  }, [entryNotice, setPlannerMessage]);

  // „Beispiel geladen“ beschreibt den Plan auf der Fläche. Wird er geleert
  // (Assistent, Datei → Neuer Plan), ist die Aussage falsch — sie lag dann
  // als 44-px-Streifen über dem leeren Zustand und verdeckte dessen Text.
  // Fehlermeldungen bleiben stehen, bis sie geschlossen werden.
  useEffect(() => {
    if (!entryNotice || entryNotice.type === 'error') return;
    if (plannerNodeCount === 0 && plannerWaterNodeCount === 0) {
      dismissEntryNotice();
    }
  }, [entryNotice, plannerNodeCount, plannerWaterNodeCount, dismissEntryNotice]);

  // „Clear site data“ leert localStorage, während der Plan noch im Speicher
  // der offenen Seite liegt. Ohne diese Wache schreibt der Flush ihn zurück
  // und der Assistent bleibt aus. IndexedDB, Cache und Service Worker halten
  // hier keinen Plan — sie werden beim Leeren mit vergessen.
  useEffect(() => {
    let seen = hasPlannerStorage();
    if (!seen) void forgetAuxiliaryBrowserStorage();
    const restore = () => {
      seen = false;
      restoreFirstVisit();
      void forgetAuxiliaryBrowserStorage();
    };
    const unsubscribe = subscribePlannerStorageCleared(() => restore());
    const timer = window.setInterval(() => {
      const present = hasPlannerStorage();
      if (seen && !present) restore();
      else seen = present;
    }, 400);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

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

  const handleMobileAdd = () => {
    // Der Einstiegsstatus ist nur bis zur ersten Bearbeitung nützlich. Er liegt
    // über der Zeichenfläche und könnte sonst einen Anschluss verdecken, der
    // direkt nach dem Hinzufügen per Touch gewählt werden soll. Fehlermeldungen
    // bleiben dagegen stehen, bis sie ausdrücklich geschlossen werden.
    if (entryNotice && entryNotice.type !== 'error') {
      dismissEntryNotice();
    }
    // Handy: Nach dem Hinzufügen öffnet sich das Detail des neuen Bauteils
    // (Spec §6.1, Schritt 2). Der Auswahl-Effekt hat den Inspector bereits
    // geöffnet — hier wird nur die Ebene sichtbar, in der er liegt.
    setActiveTab(phoneChrome ? 'inspector' : 'canvas');
  };

  const closePanels = () => setActiveTab('canvas');

  /**
   * Handy: Katalog und Detail sind volle Ebenen über der Ansicht.
   *
   * Der Katalog ist der BESTEHENDE (`Sidebar`) — dieselbe Suche, dieselben
   * Kategorien, dieselbe Einfügeposition („am sichtbaren Mittelpunkt“). Er
   * wird nur anders geöffnet: als Blatt über der Ansicht, nicht als Spalte.
   * Nach dem Hinzufügen schließt `handleMobileAdd` das Blatt und die Ansicht
   * „Schaltplan“ zeigt den neuen Knoten dort, wo er eingefügt wurde
   * (Spec §6.1, Schritt 1–3 übernimmt der bestehende Auswahl-Effekt).
   */
  const openPhoneCatalog = () => {
    setActiveTab('sidebar');
    usePlannerStore.getState().setSidebarOpen(true);
    window.requestAnimationFrame(() => document.getElementById('component-search')?.focus());
  };
  const openPhoneDetail = () => {
    setActiveTab('inspector');
    usePlannerStore.getState().setInspectorOpen(true);
  };

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
  /**
   * Eigenschaften-Spalte: auf jeder Geräteklasse dieselbe Box, drei Zustände.
   *
   *  < 768 px  : Blatt über dem Arbeitsbereich (`max-md:absolute inset-0`),
   *              Sichtbarkeit über den Fußleisten-Schalter (`activeTab`).
   *  768–1279  : Slide-over von rechts, 320 px, mit Backdrop (`md:fixed`).
   *              Es beginnt unter Menü- und Werkzeugleiste, damit Prüfbericht
   *              und andere Kopfleisten-Knöpfe nicht unter dem Blatt liegen.
   *  ≥ 1280 px : dritte Spalte; eingeklappt bleibt sie als 0-px-Spalte im
   *              Layout (kein Overlay, kein Schatten), `invisible` nimmt sie
   *              aus der Tastatur-Reihenfolge.
   *
   * `max-md:`-Varianten sind Absicht: Ohne sie würde das mobile `inset-0` auch
   * am Tablet greifen und das Slide-over auf volle Breite ziehen.
   */
  const inspectorClass = [
    'min-h-0 flex-col bg-surface-panel',
    activeTab === 'inspector' ? 'max-md:absolute max-md:inset-0 max-md:z-sheet max-md:flex' : 'max-md:hidden',
    isInspectorOpen
      ? 'md:fixed md:bottom-0 md:right-0 md:top-[calc(var(--cad-menubar-h)+var(--cad-toolbar-h))] md:z-sheet md:flex md:w-80 md:flex-none md:border-l md:border-border'
      : 'md:hidden',
    isInspectorOpen
      ? 'xl:static xl:z-auto xl:flex xl:w-[288px] xl:flex-none 2xl:w-[320px]'
      : 'xl:static xl:invisible xl:flex xl:w-0 xl:flex-none xl:overflow-hidden xl:border-l-0',
  ].join(' ');

  const isDarkPlanner = usePlannerDarkMode();

  const projectName = viewMode === 'water' ? 'Wasserplan' : 'Elektrikplan';
  const entryMessage = entryNotice ? { type: entryNotice.type, message: entryNotice.message } : null;
  /** Katalog/Detail sind auf dem Handy volle Ebenen (Spec §7) — dann schweigt die Ansicht. */
  const sheetOpen = activeTab !== 'canvas';
  const activeDomainList = usePlannerStore((state) => state.activeDomains);
  const toggleDomain = usePlannerStore((state) => state.toggleDomain);
  const activeDomains = useMemo(() => new Set(activeDomainList), [activeDomainList]);

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
      // Handy-Hülle: Der Arbeitsbereich bleibt montiert, aber die schwebenden
      // Canvas-Griffe gehören zur Desktop-Bedienung und entfallen (CSS).
      {...{ [PHONE_SHELL_ATTRIBUTE]: phoneChrome ? 'true' : 'false' }}
      className={`planner-shell relative flex h-dvh min-h-0 w-full shrink-0 flex-col overflow-hidden bg-background font-sans ${focusMode ? 'planner-shell--focus' : ''} ${isDarkPlanner ? 'dark' : ''}`.trimEnd()}
    >
      {!hasOnboarded && <OnboardingWizard />}
      <ConfirmDialogHost />
      <ShortcutOverlay />
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

      {/*
        Zwei Geräteklassen, ein Baum: Ab `md` (und ohne flaches Fenster) steht
        die bestehende Chrome-Leiste. Darunter übernimmt die Handy-Hülle mit
        eigener Kopfzeile, vier Ansichten und Fußleiste (Spezifikation §5).
        Beide lesen denselben Store; die Grenze ist derselbe Ausdruck wie in
        `PHONE_CHROME_QUERY` — kein zweites Kriterium.
      */}
      {!phoneChrome && (
        <div data-testid="planner-desktop-chrome" className="flex shrink-0 flex-col">
          <PlannerDashboard />
        </div>
      )}
      {phoneChrome && <PlannerPhoneHeader projectName={projectName} />}

      <div
        data-testid="planner-workspace"
        // `relative`: Bezug für die Blätter auf dem Handy und für die
        // Panel-Umschalter, die als absolut positionierte Griffe auf der
        // Panelkante sitzen. Bezug ist damit der Arbeitsbereich — nicht die
        // Anwendungsshell, sonst lägen sie unter der Menüleiste.
        className="planner-workspace relative flex min-h-0 min-w-0 flex-1 flex-col md:flex-row"
        // Handy: Liegt eine Ansicht über der Fläche, ist die Fläche darunter
        // unsichtbar und NICHT bedienbar (Spec §5/§7). `inert` nimmt sie
        // gleichzeitig aus der Tastatur-Reihenfolge und dem Baum der
        // Screenreader — ohne sie auszuhängen (React Flow behält seine
        // gemessene Pane-Größe).
        inert={phoneChrome && phoneView !== 'schaltplan' && !sheetOpen ? true : undefined}
        aria-hidden={phoneChrome && phoneView !== 'schaltplan' && !sheetOpen ? true : undefined}
      >
        {/* Kein `w-auto`: die exakte Spaltenbreite (260 px Tablet / 248 px
            Desktop) setzt das einklappbare Panel selbst, damit „eingeklappt“
            auch wirklich 0 px Spaltenbreite bedeutet. */}
        <div
          data-testid="planner-sidebar-slot"
          className={`min-h-0 w-full flex-1 md:flex md:w-fit md:flex-none ${
            activeTab === 'sidebar'
              ? 'max-md:absolute max-md:inset-0 max-md:z-sheet max-md:flex max-md:flex-col'
              : 'hidden md:flex'
          }`}
        >
          <PlannerSidebar onMobileAdd={handleMobileAdd} onCloseMobile={closePanels} />
        </div>

        {/* Zeichenfläche: auf jeder Breite sichtbar und montiert. `isolate`
            hält die schwebenden Canvas-Griffe (Undo/Redo, Expertenschalter,
            z-chrome) in dieser Spalte — sie dürfen nicht über die Blätter des
            Handys zeichnen, die eine Ebene höher liegen. */}
        <div
          data-testid="planner-canvas-column"
          className="isolate flex min-h-0 min-w-0 flex-1 flex-col xl:min-w-[600px]"
        >
          {/* Werkzeugzone des Handy-Schaltplans: liegt IM Fluss über der
              Fläche (Spec §6.2) und nur in der Ansicht „Schaltplan“ — sonst
              wäre sie hinter Katalog/Detail eine zweite, unsichtbare Leiste.
              Bei offenem Fokusmodus entfällt sie wie Kopf und Fuß. */}
          {phoneChrome && phoneView === 'schaltplan' && !focusMode && (
            <PhoneCanvasTools
              zoomPercent={zoom * 100}
              onFitView={() =>
                window.dispatchEvent(new CustomEvent('planner-fit-view', { detail: { full: true } }))
              }
              onOpenDetail={openPhoneDetail}
              activeDomains={activeDomains}
              onToggleDomain={toggleDomain}
            />
          )}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <React.Suspense fallback={<CanvasSkeleton />}>
              {/* Fehlergrenze: Ein Werfen in einer Node-/Routing-Komponente
                  reißt nicht mehr die ganze Planer-Seite. Der Plan liegt im
                  Store/localStorage und bleibt über Katalog und Export
                  erreichbar. */}
              <ErrorBoundary
                fallback={(reset) => (
                  <PlannerCrashFallback
                    title="Die Planansicht konnte nicht dargestellt werden."
                    description="Dein Plan ist nicht verloren — sichere die gespeicherten Rohdaten als Backup oder setze den Plan zurück."
                    onRetry={reset}
                  />
                )}
              >
                <FlowCanvas />
              </ErrorBoundary>
            </React.Suspense>
            <ExpertPanel />
          </div>

          {/* Statuszeile unter der Zeichenfläche: Cursor, Zoom, Raster,
              Prüfstatus — wie in Konstruktionswerkzeugen üblich. In der
              Handy-Hülle gibt es sie nicht: Dort trägt die Werkzeugzone den
              Zoom, der Fuß die Prüfzahl (Spec §5.2). */}
          {!phoneChrome && <PlannerStatusBar zoom={zoom} />}
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
            className="absolute inset-0 z-chrome hidden bg-ink/25 md:block xl:hidden"
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

      {/*
        Handy-Ansichten über der Fläche (Spec §6). Die Zeichenfläche bleibt
        darunter montiert und gemessen; sie wird `inert`, solange eine andere
        Ansicht sichtbar ist — genau eine Ebene ist bedienbar. „Schaltplan“
        braucht keine eigene Ansicht: Dort IST die Fläche die Ansicht.
      */}
      {phoneChrome && phoneView !== 'schaltplan' && !sheetOpen && (
        <PlannerPhoneLayer
          view={phoneView}
          onSelectView={setPhoneView}
          entryMessage={entryMessage}
          onOpenCatalog={openPhoneCatalog}
          onOpenDetail={openPhoneDetail}
        />
      )}

      {/* Auf dem Schaltplan ist die Fläche selbst die Ansicht — der
          Meldungsplatz steht dann im Fluss darunter, nicht in einer Ebene
          darüber (Spec §5.3). */}
      {phoneChrome && (phoneView === 'schaltplan' || sheetOpen) && (
        <PlannerPhoneMessageBar entryMessage={entryMessage} />
      )}

      {phoneChrome && (
        <PlannerPhoneNav
          activeView={phoneView}
          // Ein Fußziel schließt offene Blätter (Katalog/Detail): Danach ist
          // genau die gewählte Ansicht sichtbar (Spec §7, „eine Ebene“).
          onSelectView={(view) => {
            closePanels();
            setPhoneView(view);
          }}
        />
      )}
    </div>
  );
}
