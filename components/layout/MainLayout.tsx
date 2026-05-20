"use client";

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePlannerStore } from '@/store/usePlannerStore';
import NavigationSidebar from '@/components/NavigationSidebar';
import { Sidebar } from '@/components/Sidebar';
import { Zap, Flame, Droplets, User, Plus, X, Award, CheckCircle, MapPin, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const setViewMode = usePlannerStore((state) => state.setViewMode);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const nodes = usePlannerStore((state) => state.nodes);
  const waterNodes = usePlannerStore((state) => state.waterNodes);

  const [isNodePickerOpen, setIsNodePickerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleNavClick = (tab: 'electric' | 'heating' | 'water' | 'profile') => {
    if (tab === 'electric') {
      setViewMode('electric');
      router.push('/elektrik-planung');
    } else if (tab === 'water') {
      setViewMode('water');
      router.push('/elektrik-planung');
    } else if (tab === 'heating') {
      router.push('/tools/heizung');
    } else if (tab === 'profile') {
      setIsProfileOpen(true);
    }
  };

  // Determine active tab
  const isElectricActive = pathname === '/elektrik-planung' && viewMode === 'electric';
  const isWaterActive = pathname === '/elektrik-planung' && viewMode === 'water';
  const isHeatingActive = pathname === '/tools/heizung';

  const isPlannerRoute = pathname.startsWith('/elektrik-planung') || pathname.startsWith('/tools');

  return (
    <div className="min-h-screen w-full relative">
      {/* Desktop Sidebar (visible on screens >= 768px) */}
      {isPlannerRoute && (
        <div className="hidden md:block">
          <NavigationSidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        </div>
      )}

      {/* Main content wrapper */}
      <main className={`${isPlannerRoute ? (sidebarCollapsed ? 'md:pl-14' : 'md:pl-[17rem]') : ''} min-h-screen transition-all duration-300 relative z-10 pb-20 md:pb-0`}>
        {children}
      </main>



      {/* Floating Action Button (FAB) (visible on screens < 768px on planner page) */}
      {pathname === '/elektrik-planung' && (
        <button
          onClick={() => setIsNodePickerOpen(true)}
          className="md:hidden fixed bottom-20 right-6 z-[110] w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-950/20 active:scale-90 hover:scale-105 transition-all touch-manipulation"
          aria-label="Komponente hinzufügen"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Node Picker Modal */}
      {isNodePickerOpen && (
        <div className="md:hidden fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[200] flex flex-col justify-end transition-opacity duration-300">
          <div className="bg-white rounded-t-[2.5rem] w-full max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-slide-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-stone-100 shrink-0">
              <div>
                <h3 className="font-black text-stone-800 text-lg leading-tight">Bauteil hinzufügen</h3>
                <p className="text-xs text-stone-400 mt-0.5 font-medium">Wähle eine Komponente für deine Arbeitsfläche</p>
              </div>
              <button
                onClick={() => setIsNodePickerOpen(false)}
                className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 active:scale-90 transition-transform touch-manipulation"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body containing the Sidebar list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <Sidebar mode={viewMode} onMobileAdd={() => setIsNodePickerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Premium Profile Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm flex flex-col shadow-2xl overflow-hidden relative animate-scale-up border border-stone-200">
            {/* Background pattern */}
            <div className="h-28 bg-stone-800 relative flex items-end px-6 pb-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
              <button
                onClick={() => setIsProfileOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform touch-manipulation"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Avatar & Title */}
            <div className="px-6 pb-6 relative flex flex-col items-center">
              <div className="w-24 h-24 rounded-full border-[6px] border-white bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md -mt-12 z-10 select-none text-white">
                <User className="w-10 h-10" />
              </div>
              
              <h3 className="font-black text-xl text-stone-800 mt-3 flex items-center gap-1.5">
                Camper-Pionier
                <Award className="w-5 h-5 text-amber-500 fill-amber-500" />
              </h3>
              <span className="text-[10px] uppercase tracking-widest font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5 mt-1">
                Senior Ausbauer
              </span>

              <div className="w-full grid grid-cols-2 gap-3 mt-6">
                <div className="bg-stone-50 border border-stone-200/50 p-3 rounded-2xl flex flex-col items-center text-center">
                  <Gauge className="w-5 h-5 text-emerald-600 mb-1" />
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Elektro-Geräte</span>
                  <span className="text-lg font-black text-stone-800 mt-0.5">{nodes.length}</span>
                </div>
                <div className="bg-stone-50 border border-stone-200/50 p-3 rounded-2xl flex flex-col items-center text-center">
                  <Droplets className="w-5 h-5 text-cyan-600 mb-1" />
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Wasser-Knoten</span>
                  <span className="text-lg font-black text-stone-800 mt-0.5">{waterNodes.length}</span>
                </div>
              </div>

              <div className="w-full bg-emerald-50/50 border border-emerald-100/80 p-4 rounded-2xl mt-4 space-y-2.5">
                <div className="flex items-center gap-2.5 text-stone-600 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>VDE Norm-Prüfung: Aktiviert</span>
                </div>
                <div className="flex items-center gap-2.5 text-stone-600 text-xs font-semibold">
                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Camper: VW Crafter L3H2 (Vorlage)</span>
                </div>
              </div>

              <p className="text-center text-xs text-stone-400 mt-6 italic font-medium">
                &quot;Die Straße ruft, aber die Sicherheit fährt mit!&quot;
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
