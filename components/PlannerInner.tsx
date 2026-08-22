"use client";

import React, { useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { PlannerSidebar } from './planner/PlannerSidebar';
import { PlannerInspector } from './planner/PlannerInspector';
import { PlannerDashboard } from './planner/PlannerDashboard';
import { FlowCanvas } from './planner/FlowCanvas';
import { ExpertPanel } from './planner/ExpertPanel';
import { OnboardingWizard } from './planner/OnboardingWizard';
import { Settings2, Zap, Droplets, Flame, Plus, X, Undo2, Redo2 } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { usePlannerStore } from '../store/usePlannerStore';
import { useRouter } from 'next/navigation';

/**
 * Layout-Container des Planers — drei Geräteklassen, ein DOM-Baum.
 *
 * Die Umschaltung passiert bewusst in CSS (Tailwind-Breakpoints) und nicht in
 * JavaScript: so stimmt das Layout schon beim ersten Frame (kein Flackern nach
 * der Hydration) und es gibt keine „falsche“ Geräteklasse beim Fenster-Resize.
 *
 *  < 768 px  (Handy)   : ein Bereich sichtbar, Umschaltung über die Bottom-Tabs.
 *  768–1279 px (Tablet): Sidebar (260 px) + Canvas; Inspector als Slide-over
 *                        von rechts (320 px, mit Backdrop).
 *  ≥ 1280 px (Desktop) : feste 3 Spalten — Sidebar 280 px | Canvas flex-1
 *                        (min. 600 px) | Inspector 288 px (ab 1536 px: 320 px).
 *
 * Warum der Inspector erst ab 1280 px andockt (und nicht ab 1024 px):
 * 1024 − 280 − 320 = 424 px Canvas. Das verletzt die geforderte Mindestbreite
 * von 600 px und macht den Plan unbrauchbar. Zwischen 1024 und 1279 px bleibt
 * er deshalb Slide-over; der Canvas behält 744 px. Details im PR-Text.
 */
export default function PlannerInner() {
  const [activeTab, setActiveTab] = useState<'sidebar' | 'canvas' | 'inspector'>('canvas');
  const hasOnboarded = useAppStore((state) => state.hasOnboarded);
  const setViewMode = usePlannerStore((state) => state.setViewMode);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const isInspectorOpen = usePlannerStore((state) => state.isInspectorOpen);
  const setInspectorOpen = usePlannerStore((state) => state.setInspectorOpen);
  const selectionCount = usePlannerStore(
    (state) => state.selectedNodes.length + state.selectedEdges.length
  );
  const canUndo = usePlannerStore((state) => state.canUndo);
  const canRedo = usePlannerStore((state) => state.canRedo);
  const undo = usePlannerStore((state) => state.undo);
  const redo = usePlannerStore((state) => state.redo);
  const router = useRouter();

  // Auswahl öffnet den Inspector, Klick auf leere Fläche (= Auswahl leer)
  // schließt ihn wieder. Am Desktop ist das nur ein Ein-/Ausklappen der
  // dritten Spalte, auf dem Tablet das Öffnen/Schließen des Slide-overs.
  useEffect(() => {
    setInspectorOpen(selectionCount > 0);
  }, [selectionCount, setInspectorOpen]);

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
        // Escape hebt zuerst die Auswahl auf (Standard-Bedeutung). Der
        // Inspector schließt dadurch auf allen Geräteklassen über den
        // Auswahl-Effekt — die dritte Spalte selbst bleibt am Desktop als
        // Layout erhalten, statt als Ganzes einzuklappen.
        const state = usePlannerStore.getState();
        state.setSelectedNodes([]);
        state.setSelectedEdges([]);
        state.setInspectorOpen(false);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        const state = usePlannerStore.getState();
        if (state.selectedNodes.length > 0 || state.selectedEdges.length > 0) {
          event.preventDefault();
          if (window.confirm('Ausgewählte Elemente wirklich löschen? Du kannst die Aktion anschließend rückgängig machen.')) state.deleteSelected();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleMobileAdd = () => setActiveTab('canvas');

  // 56 px Kantenlänge – deutlich über den geforderten 44 px Touch-Target.
  const navClass = (active: boolean) => `flex min-h-14 min-w-14 flex-col items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent'}`;

  const inspectorClass = [
    // Handy: vollflächiger Tab-Bereich.
    'min-h-0 w-full flex-1 flex-col bg-card',
    activeTab === 'inspector' ? 'flex' : 'hidden',
    // Tablet/kleiner Desktop: Slide-over von rechts, 320 px, über dem Canvas.
    isInspectorOpen
      ? 'md:fixed md:inset-y-0 md:right-0 md:z-40 md:flex md:w-80 md:flex-none md:border-l md:border-border md:shadow-2xl'
      : 'md:hidden',
    // Ab 1280 px echte dritte Spalte (kein Overlay, kein Schatten).
    isInspectorOpen
      ? 'xl:static xl:z-auto xl:flex xl:w-[288px] xl:flex-none xl:shadow-none 2xl:w-[320px]'
      : 'xl:static xl:flex xl:w-0 xl:flex-none xl:overflow-hidden xl:border-l-0 xl:shadow-none',
  ].join(' ');

  return (
    <ReactFlowProvider>
    <div data-testid="planner-shell" className="planner-shell relative flex h-dvh min-h-0 w-full shrink-0 flex-col overflow-hidden bg-background font-sans md:flex-row">
      {!hasOnboarded && <OnboardingWizard />}

      {/* Kein `w-auto`: die exakte Spaltenbreite (260 px Tablet / 280 px Desktop)
          setzt das einklappbare Panel selbst, damit „eingeklappt“ auch wirklich
          0 px Spaltenbreite bedeutet. */}
      <div
        className={`min-h-0 w-full flex-1 md:w-fit md:flex md:flex-none ${activeTab === 'sidebar' ? 'flex' : 'hidden'}`}
      >
        <PlannerSidebar onMobileAdd={handleMobileAdd} />
      </div>

      <div data-testid="planner-canvas-column" className={`min-w-0 flex-1 flex-col md:flex xl:min-w-[600px] ${activeTab === 'canvas' ? 'flex' : 'hidden'}`}>
        <PlannerDashboard />
        <div className="relative flex h-full flex-1 flex-col overflow-hidden">
          <React.Suspense fallback={<div className="flex flex-1 items-center justify-center bg-background" role="status" aria-label="Planer wird geladen"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary motion-reduce:animate-none" /></div>}>
            <FlowCanvas />
          </React.Suspense>
          <ExpertPanel />
        </div>
      </div>

      {/* Backdrop nur im Slide-over-Bereich (768–1279 px). Ab 1280 px ist der
          Inspector eine normale Spalte und darf den Canvas nicht abdecken. */}
      {isInspectorOpen && (
        // Reine Zeiger-Affordanz: `aria-hidden`, damit Screenreader nicht zwei
        // gleichnamige „Schließen“-Elemente ansagen. Der barrierefreie Weg sind
        // der Schließen-Knopf im Panel und die Escape-Taste.
        <div
          data-testid="inspector-backdrop"
          aria-hidden="true"
          onClick={() => setInspectorOpen(false)}
          className="fixed inset-0 z-30 hidden bg-ink/25 md:block xl:hidden"
        />
      )}

      <aside data-testid="inspector-panel" className={inspectorClass} aria-label="Eigenschaften">
        {/* Schließen-Knopf gehört zum Overlay, nicht zur Spalte. */}
        <div className="hidden shrink-0 items-center justify-between border-b border-border px-3 py-2 md:flex xl:hidden">
          <span className="text-sm font-semibold text-foreground">Eigenschaften</span>
          <button
            type="button"
            onClick={() => setInspectorOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Eigenschaften schließen"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <PlannerInspector />
      </aside>

      {/* Touch-Undo/Redo bleibt über dem Canvas erreichbar, ohne die fünf
          Bottom-Tabs auf 375 px zusammenzuquetschen. Sichtbar deaktivierte
          Zustände spiegeln die History des Stores unmittelbar. */}
      {activeTab === 'canvas' && (
        <div className="absolute bottom-20 right-3 z-50 flex gap-2 md:hidden" role="group" aria-label="Änderungen rückgängig machen oder wiederholen">
          <button
            type="button"
            data-testid="mobile-undo"
            onClick={undo}
            disabled={!canUndo}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Rückgängig"
            title="Rückgängig"
          >
            <Undo2 size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="mobile-redo"
            onClick={redo}
            disabled={!canRedo}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Wiederholen"
            title="Wiederholen"
          >
            <Redo2 size={20} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Bottom-Navigation: nur Handy. `planner-bottom-nav` ergänzt die
          iOS-Safe-Area, damit der Home-Indicator nichts überdeckt. */}
      <nav data-testid="planner-bottom-nav" className="planner-bottom-nav z-50 flex shrink-0 items-center justify-around border-t border-border bg-card p-1 md:hidden" aria-label="Planerbereiche">
        <button type="button" data-testid="nav-tab-sidebar" onClick={() => setActiveTab('sidebar')} className={navClass(activeTab === 'sidebar')} aria-current={activeTab === 'sidebar' ? 'page' : undefined}>
          <Plus size={22} aria-hidden="true" />
          <span>Bauteile</span>
        </button>
        <button type="button" data-testid="nav-tab-electric" onClick={() => { setActiveTab('canvas'); setViewMode('electric'); }} className={navClass(activeTab === 'canvas' && viewMode === 'electric')} aria-current={activeTab === 'canvas' && viewMode === 'electric' ? 'page' : undefined}>
          <Zap size={22} aria-hidden="true" />
          <span>Elektrik</span>
        </button>
        <button type="button" data-testid="nav-tab-water" onClick={() => { setActiveTab('canvas'); setViewMode('water'); }} className={navClass(activeTab === 'canvas' && viewMode === 'water')} aria-current={activeTab === 'canvas' && viewMode === 'water' ? 'page' : undefined}>
          <Droplets size={22} aria-hidden="true" />
          <span>Wasser</span>
        </button>
        <button type="button" data-testid="nav-tab-inspector" onClick={() => setActiveTab('inspector')} className={navClass(activeTab === 'inspector')} aria-current={activeTab === 'inspector' ? 'page' : undefined}>
          <Settings2 size={22} aria-hidden="true" />
          <span>Details</span>
        </button>
        <button type="button" onClick={() => router.push('/tools/heizung')} className={navClass(false)}>
          <Flame size={22} aria-hidden="true" />
          <span>Heizung</span>
        </button>
      </nav>
    </div>
    </ReactFlowProvider>
  );
}
