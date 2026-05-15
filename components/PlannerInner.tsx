"use client";

import React from 'react';
import { PlannerSidebar } from './planner/PlannerSidebar';
import { PlannerInspector } from './planner/PlannerInspector';
import { PlannerDashboard } from './planner/PlannerDashboard';
import { FlowCanvas } from './planner/FlowCanvas';
import { ExpertPanel } from './planner/ExpertPanel';
import { OnboardingWizard } from './planner/OnboardingWizard';
import { useAppStore } from '../lib/store';

export default function PlannerInner() {
  const hasOnboarded = useAppStore((state) => state.hasOnboarded);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans relative">
      {!hasOnboarded && <OnboardingWizard />}
      <PlannerSidebar />
      <div className="flex-1 h-full relative overflow-hidden flex flex-col">
        <PlannerDashboard />
        <React.Suspense fallback={<div className="flex-1 flex items-center justify-center bg-stone-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div></div>}>
          <FlowCanvas />
        </React.Suspense>
        {/* Floating Expert Knowledge Panel — reads from store independently, never re-renders FlowCanvas */}
        <ExpertPanel />
      </div>
      <PlannerInspector />
    </div>
  );
}
