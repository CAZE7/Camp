"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'], display: 'swap' });

export default function DachPlanerPage() {
  return (
    <div className="flex flex-col min-h-screen bg-stone-50 font-sans overflow-hidden">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-6 py-4 flex items-center justify-between z-20 sticky top-0 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 rounded-xl border-stone-200 bg-white shadow-sm hover:bg-stone-50">
              ← Zurück
            </Button>
          </Link>
          <div className="h-6 w-px bg-stone-200 mx-2" />
          <h1 className={cn("text-xl md:text-2xl font-black flex items-center gap-3 tracking-tight text-stone-800", outfit.className)}>
            <span className="bg-stone-100 border border-stone-200 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-sm text-xl">☀️</span>
            Dach-Planer <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full ml-2 uppercase tracking-widest font-bold">Pro</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none mb-1">Status</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live Sync Aktiv
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-stone-100/50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full rounded-3xl border border-stone-200 bg-white p-10 shadow-sm">
          <h2 className="text-3xl font-black text-stone-900 mb-4">Dach-Planer</h2>
          <p className="text-base text-stone-600 mb-6">
            Dieses Feature ist momentan nicht verfügbar. Bitte nutze eine andere Seite oder
            kehre später zurück.
          </p>
          <Link href="/">
            <Button variant="secondary" size="sm">Zurück zur Startseite</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
