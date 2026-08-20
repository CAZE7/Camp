"use client";

import React, { useState } from 'react';
import { PlannerSidebar } from './planner/PlannerSidebar';
import { PlannerInspector } from './planner/PlannerInspector';
import { PlannerDashboard } from './planner/PlannerDashboard';
import { FlowCanvas } from './planner/FlowCanvas';
import { ExpertPanel } from './planner/ExpertPanel';
import { OnboardingWizard } from './planner/OnboardingWizard';
import { Settings2, Zap, Droplets, Flame, Plus } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { usePlannerStore } from '../store/usePlannerStore';
import { useRouter } from 'next/navigation';


export default function PlannerInner() {
  const [activeTab, setActiveTab] = useState<'sidebar' | 'canvas' | 'inspector'>('canvas');
  const hasOnboarded = useAppStore((state) => state.hasOnboarded);
  const setViewMode = usePlannerStore((state) => state.setViewMode);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const router = useRouter();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) usePlannerStore.getState().redo();
        else usePlannerStore.getState().undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        usePlannerStore.getState().redo();
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
  const navClass = (active: boolean) => `flex min-h-14 min-w-14 flex-col items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent'}`;

  return (
    <div className="planner-mobile-container relative flex h-dvh min-h-0 w-full flex-1 flex-col overflow-hidden bg-background font-sans lg:flex-row">
      {!hasOnboarded && <OnboardingWizard />}

      <div className={`h-full w-full flex-1 lg:flex lg:w-auto lg:flex-none ${activeTab === 'sidebar' ? 'flex' : 'hidden'}`}>
        <PlannerSidebar onMobileAdd={handleMobileAdd} />
      </div>

      <div className={`min-w-0 flex-1 flex-col lg:flex ${activeTab === 'canvas' ? 'flex' : 'hidden'}`}>
        <PlannerDashboard />
        <div className="relative flex h-full flex-1 flex-col overflow-hidden">
          <React.Suspense fallback={<div className="flex flex-1 items-center justify-center bg-background" role="status" aria-label="Planer wird geladen"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary motion-reduce:animate-none" /></div>}>
            <FlowCanvas />
          </React.Suspense>
          <ExpertPanel />
        </div>
      </div>

      <div className={`h-full w-full flex-1 lg:flex lg:w-auto lg:flex-none ${activeTab === 'inspector' ? 'flex' : 'hidden'}`}>
        <PlannerInspector />
      </div>



      <nav className="z-50 flex shrink-0 items-center justify-around border-t border-border bg-card p-1 lg:hidden" aria-label="Planerbereiche">
        <button type="button" onClick={() => setActiveTab('sidebar')} className={navClass(activeTab === 'sidebar')} aria-current={activeTab === 'sidebar' ? 'page' : undefined}>
          <Plus size={22} aria-hidden="true" />
          <span>Bauteile</span>
        </button>
        <button type="button" onClick={() => { setActiveTab('canvas'); setViewMode('electric'); }} className={navClass(activeTab === 'canvas' && viewMode === 'electric')} aria-current={activeTab === 'canvas' && viewMode === 'electric' ? 'page' : undefined}>
          <Zap size={22} aria-hidden="true" />
          <span>Elektrik</span>
        </button>
        <button type="button" onClick={() => { setActiveTab('canvas'); setViewMode('water'); }} className={navClass(activeTab === 'canvas' && viewMode === 'water')} aria-current={activeTab === 'canvas' && viewMode === 'water' ? 'page' : undefined}>
          <Droplets size={22} aria-hidden="true" />
          <span>Wasser</span>
        </button>
        <button type="button" onClick={() => setActiveTab('inspector')} className={navClass(activeTab === 'inspector')} aria-current={activeTab === 'inspector' ? 'page' : undefined}>
          <Settings2 size={22} aria-hidden="true" />
          <span>Details</span>
        </button>
        <button type="button" onClick={() => router.push('/tools/heizung')} className={navClass(false)}>
          <Flame size={22} aria-hidden="true" />
          <span>Heizung</span>
        </button>
      </nav>
    </div>
  );
}
