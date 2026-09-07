'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePlannerStore } from '@/store/usePlannerStore';
import NavigationSidebar from '@/components/NavigationSidebar';
import { Sidebar } from '@/components/Sidebar';
import { Droplets, User, Plus, X, Award, CheckCircle, MapPin, Gauge } from 'lucide-react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const viewMode = usePlannerStore((state) => state.viewMode);
  const nodes = usePlannerStore((state) => state.nodes);
  const waterNodes = usePlannerStore((state) => state.waterNodes);

  const [isNodePickerOpen, setIsNodePickerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isPlannerRoute = pathname.startsWith('/elektrik-planung') || pathname.startsWith('/tools');

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col">
      {/* Desktop Sidebar (visible on screens >= 768px) */}
      {isPlannerRoute && (
        <div className="hidden lg:block">
          <NavigationSidebar
            isCollapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>
      )}

      {/* Main content wrapper */}
      <main
        className={`${isPlannerRoute ? (sidebarCollapsed ? 'lg:pl-14' : 'lg:pl-[17rem]') : ''} relative z-10 flex min-h-0 flex-1 flex-col pb-20 transition-all duration-300 lg:pb-0`}
      >
        {children}
      </main>

      {/* Floating Action Button (FAB) (visible on screens < 768px on planner page) */}
      {pathname === '/elektrik-planung' && (
        <button
          onClick={() => setIsNodePickerOpen(true)}
          className="fixed bottom-20 right-6 z-[110] flex h-14 w-14 touch-manipulation items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-950/20 transition-all hover:scale-105 active:scale-90 lg:hidden"
          aria-label="Komponente hinzufügen"
        >
          <Plus className="h-7 w-7" />
        </button>
      )}

      {/* Node Picker Modal */}
      {isNodePickerOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end bg-stone-900/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden">
          <div className="animate-slide-up relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[2.5rem] bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-6 pb-3 pt-5">
              <div>
                <h3 className="text-lg font-black leading-tight text-stone-800">Bauteil hinzufügen</h3>
                <p className="mt-0.5 text-xs font-medium text-stone-400">
                  Wähle eine Komponente für deine Arbeitsfläche
                </p>
              </div>
              <button
                onClick={() => setIsNodePickerOpen(false)}
                className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-transform active:scale-90"
                aria-label="Schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Body containing the Sidebar list */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Sidebar mode={viewMode} onMobileAdd={() => setIsNodePickerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Premium Profile Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-900/60 p-6 backdrop-blur-sm">
          <div className="animate-scale-up relative flex w-full max-w-sm flex-col overflow-hidden rounded-[2.5rem] border border-stone-200 bg-white shadow-2xl">
            {/* Background pattern */}
            <div className="relative flex h-28 items-end bg-stone-800 px-6 pb-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15),transparent)]" />
              <button
                onClick={() => setIsProfileOpen(false)}
                className="absolute right-4 top-4 flex h-9 w-9 touch-manipulation items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition-transform hover:bg-white/30 active:scale-90"
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Avatar & Title */}
            <div className="relative flex flex-col items-center px-6 pb-6">
              <div className="z-10 -mt-12 flex h-24 w-24 select-none items-center justify-center rounded-full border-[6px] border-white bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md">
                <User className="h-10 w-10" />
              </div>

              <h3 className="mt-3 flex items-center gap-1.5 text-xl font-black text-stone-800">
                Camper-Pionier
                <Award className="h-5 w-5 fill-amber-500 text-amber-500" />
              </h3>
              <span className="mt-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                Senior Ausbauer
              </span>

              <div className="mt-6 grid w-full grid-cols-2 gap-3">
                <div className="flex flex-col items-center rounded-2xl border border-stone-200/50 bg-stone-50 p-3 text-center">
                  <Gauge className="mb-1 h-5 w-5 text-emerald-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Elektro-Geräte
                  </span>
                  <span className="mt-0.5 text-lg font-black text-stone-800">{nodes.length}</span>
                </div>
                <div className="flex flex-col items-center rounded-2xl border border-stone-200/50 bg-stone-50 p-3 text-center">
                  <Droplets className="mb-1 h-5 w-5 text-cyan-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Wasser-Knoten
                  </span>
                  <span className="mt-0.5 text-lg font-black text-stone-800">{waterNodes.length}</span>
                </div>
              </div>

              <div className="mt-4 w-full space-y-2.5 rounded-2xl border border-emerald-100/80 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-stone-600">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>VDE Norm-Prüfung: Aktiviert</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-semibold text-stone-600">
                  <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>Camper: VW Crafter L3H2 (Vorlage)</span>
                </div>
              </div>

              <p className="mt-6 text-center text-xs font-medium italic text-stone-400">
                &quot;Die Straße ruft, aber die Sicherheit fährt mit!&quot;
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
