'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const DynamicPlannerInner = dynamic(() => import('./PlannerInner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen w-full bg-background">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-moss"></div>
    </div>
  ),
});

export default function Planner() {
  return <DynamicPlannerInner />;
}
