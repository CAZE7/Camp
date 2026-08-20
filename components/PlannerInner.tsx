"use client";

import React, { useState } from 'react';
import { PlannerSidebar } from './planner/PlannerSidebar';
import { PlannerInspector } from './planner/PlannerInspector';
import { PlannerDashboard } from './planner/PlannerDashboard';
import { FlowCanvas } from './planner/FlowCanvas';
import { ExpertPanel } from './planner/ExpertPanel';
import { OnboardingWizard } from './planner/OnboardingWizard';
import { Settings2, Zap, Droplets, Flame } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { usePlannerStore } from '../store/usePlannerStore';
import { useRouter } from 'next/navigation';
import Chat from './Chat';

export default function PlannerInner() {
  const [activeTab, setActiveTab] = useState<'sidebar' | 'canvas' | 'inspector'>('canvas');
  const hasOnboarded = useAppStore((state) => state.hasOnboarded);
  const setViewMode = usePlannerStore((state) => state.setViewMode);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const router = useRouter();

  // Triggered when an item is added on mobile to automatically switch to the canvas
  const handleMobileAdd = () => {
    setActiveTab('canvas');
  };

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 w-full bg-background overflow-hidden font-sans relative planner-mobile-container">
      {!hasOnboarded && <OnboardingWizard />}

      {/* Sidebar Area */}
      <div className={`lg:flex h-full w-full lg:w-auto ${activeTab === 'sidebar' ? 'flex' : 'hidden lg:flex'} flex-1 lg:flex-none`}>
        <PlannerSidebar onMobileAdd={handleMobileAdd} />
      </div>

      {/* Main Canvas Area */}
      <div className={`lg:flex flex-1 flex-col min-w-0 ${activeTab === 'canvas' ? 'flex' : 'hidden lg:flex'}`}>
        <PlannerDashboard />
        <div className="flex flex-col flex-1 h-full overflow-hidden relative">
          <React.Suspense fallback={<div className="flex-1 flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
            <FlowCanvas />
          </React.Suspense>
          {/* Floating Expert Knowledge Panel — reads from store independently, never re-renders FlowCanvas */}
          <ExpertPanel />
        </div>
      </div>

      {/* Inspector Area */}
      <div className={`lg:flex h-full w-full lg:w-auto ${activeTab === 'inspector' ? 'flex' : 'hidden lg:flex'} flex-1 lg:flex-none`}>
        <PlannerInspector />
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <Chat />

      <div className="lg:hidden flex flex-row items-center justify-around bg-card border-t border-border p-2 z-50 shrink-0">
        <button
          onClick={() => {
            setActiveTab('canvas');
            setViewMode('electric');
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${(activeTab === 'canvas' || activeTab === 'sidebar') && viewMode === 'electric' ? 'text-primary bg-accent' : 'text-muted-foreground hover:bg-accent/60'}`}
          aria-label="Elektrik"
        >
          <Zap size={24} />
          <span className="text-[10px] font-semibold mt-1">Elektrik</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('canvas');
            setViewMode('water');
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${(activeTab === 'canvas' || activeTab === 'sidebar') && viewMode === 'water' ? 'text-primary bg-accent' : 'text-muted-foreground hover:bg-accent/60'}`}
          aria-label="Wasser"
        >
          <Droplets size={24} />
          <span className="text-[10px] font-semibold mt-1">Wasser</span>
        </button>
        <button
          onClick={() => router.push('/tools/heizung')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors text-muted-foreground hover:bg-accent/60`}
          aria-label="Heizung"
        >
          <Flame size={24} />
          <span className="text-[10px] font-semibold mt-1">Heizung</span>
        </button>
        <button
          onClick={() => setActiveTab('inspector')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${activeTab === 'inspector' ? 'text-primary bg-accent' : 'text-muted-foreground hover:bg-accent/60'}`}
          aria-label="Details"
        >
          <Settings2 size={24} />
          <span className="text-[10px] font-semibold mt-1">Details</span>
        </button>
      </div>
    </div>
  );
}
