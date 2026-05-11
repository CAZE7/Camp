"use client";

import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { DachPlanerFlow } from './components/DachPlanerFlow';

export default function DachPlanerPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-sans overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between z-20 sticky top-0 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2">
              ← Zurück
            </Button>
          </Link>
          <div className="h-6 w-px bg-border mx-2" />
          <h1 className="text-xl font-black flex items-center gap-3 tracking-tight">
            <span className="bg-gradient-to-br from-orange-400 to-red-500 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg text-lg">☀️</span>
            Dachflächen-Planer <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2 uppercase tracking-widest">Pro</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">Status</span>
            <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live Sync Aktiv
            </span>
          </div>
        </div>
      </div>

      {/* Flow */}
      <div className="flex-1 relative overflow-hidden">
        <ReactFlowProvider>
          <DachPlanerFlow />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
