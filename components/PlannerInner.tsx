"use client";

import React from 'react';
import { PlannerSidebar } from './planner/PlannerSidebar';
import { PlannerInspector } from './planner/PlannerInspector';
import { PlannerDashboard } from './planner/PlannerDashboard';
import { FlowCanvas } from './planner/FlowCanvas';
import { ExpertPanel } from './planner/ExpertPanel';

export default function PlannerInner() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans relative">
      <PlannerSidebar />
      <div className="flex-1 h-full relative overflow-hidden flex flex-col">
        <PlannerDashboard />
        <FlowCanvas />
        {/* Floating Expert Knowledge Panel — reads from store independently, never re-renders FlowCanvas */}
        <ExpertPanel />
      </div>
      <PlannerInspector />
    </div>
  );
}
