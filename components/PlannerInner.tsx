"use client";

import React, { useState } from 'react';
import { PlannerSidebar } from './planner/PlannerSidebar';
import { PlannerInspector } from './planner/PlannerInspector';
import { PlannerDashboard } from './planner/PlannerDashboard';
import { FlowCanvas } from './planner/FlowCanvas';
import { ExpertPanel } from './planner/ExpertPanel';
import { ListPlus, LayoutTemplate, Settings2 } from 'lucide-react';

export default function PlannerInner() {
  const [activeTab, setActiveTab] = useState<'sidebar' | 'canvas' | 'inspector'>('canvas');

  // Triggered when an item is added on mobile to automatically switch to the canvas
  const handleMobileAdd = () => {
    setActiveTab('canvas');
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-background overflow-hidden font-sans relative planner-mobile-container">

      {/* Sidebar Area */}
      <div className={`md:flex h-full ${activeTab === 'sidebar' ? 'block' : 'hidden md:block'} flex-1 md:flex-none`}>
        <PlannerSidebar onMobileAdd={handleMobileAdd} />
      </div>

      {/* Main Canvas Area */}
      <div className={`md:flex flex-1 h-full relative overflow-hidden flex-col ${activeTab === 'canvas' ? 'flex' : 'hidden md:flex'}`}>
        <PlannerDashboard />
        <React.Suspense fallback={<div className="flex-1 flex items-center justify-center bg-stone-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div></div>}>
          <FlowCanvas />
        </React.Suspense>
        {/* Floating Expert Knowledge Panel — reads from store independently, never re-renders FlowCanvas */}
        <ExpertPanel />
      </div>

      {/* Inspector Area */}
      <div className={`md:flex h-full ${activeTab === 'inspector' ? 'block' : 'hidden md:block'} flex-1 md:flex-none`}>
        <PlannerInspector />
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden flex flex-row items-center justify-around bg-card border-t border-border p-2 z-50 shrink-0">
        <button
          onClick={() => setActiveTab('sidebar')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${activeTab === 'sidebar' ? 'text-emerald-600 bg-emerald-50' : 'text-muted-foreground hover:bg-stone-100'}`}
          aria-label="Bauteile"
        >
          <ListPlus size={24} />
          <span className="text-[10px] font-semibold mt-1">Bauteile</span>
        </button>
        <button
          onClick={() => setActiveTab('canvas')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${activeTab === 'canvas' ? 'text-emerald-600 bg-emerald-50' : 'text-muted-foreground hover:bg-stone-100'}`}
          aria-label="Plan"
        >
          <LayoutTemplate size={24} />
          <span className="text-[10px] font-semibold mt-1">Plan</span>
        </button>
        <button
          onClick={() => setActiveTab('inspector')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${activeTab === 'inspector' ? 'text-emerald-600 bg-emerald-50' : 'text-muted-foreground hover:bg-stone-100'}`}
          aria-label="Details"
        >
          <Settings2 size={24} />
          <span className="text-[10px] font-semibold mt-1">Details</span>
        </button>
      </div>
    </div>
  );
}
