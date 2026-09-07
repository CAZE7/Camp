'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const DynamicPlannerInner = dynamic(() => import('./PlannerInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-moss"></div>
    </div>
  ),
});

export default function Planner() {
  return <DynamicPlannerInner />;
}
