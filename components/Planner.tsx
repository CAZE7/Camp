"use client";

import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';

import { PlannerSidebar } from './planner/PlannerSidebar';
import { PlannerInspector } from './planner/PlannerInspector';
import { PlannerDashboard } from './planner/PlannerDashboard';
import { FlowCanvas } from './planner/FlowCanvas';
import { ExpertPanel } from './planner/ExpertPanel';

function PlannerInner() {
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

export default function Planner() {
  return (
    <ReactFlowProvider>
      <PlannerInner />
    </ReactFlowProvider>
  );
}
