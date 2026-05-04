import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { toPng } from 'html-to-image';
import { useReactFlow } from 'reactflow';

export function PlannerDashboard() {
  const { fitView } = useReactFlow();
  const viewMode = usePlannerStore((state) => state.viewMode);
  const setViewMode = usePlannerStore((state) => state.setViewMode);
  const season = usePlannerStore((state) => state.season);
  const setSeason = usePlannerStore((state) => state.setSeason);

  const exportBOM = usePlannerStore((state) => state.exportBOM);
  const autoWireSystem = usePlannerStore((state) => state.autoWireSystem);
  const checkSchematic = usePlannerStore((state) => state.checkSchematic);
  const onLayout = usePlannerStore((state) => state.onLayout);

  const { isProMode, toggleProMode } = useAppStore();

  const handleExportBOM = useCallback(() => {
    exportBOM();
    // Dispatch event to show the BOM Modal in FlowCanvas component instead
    const event = new CustomEvent('show-bom-modal');
    window.dispatchEvent(event);
  }, [exportBOM]);

  const onExportImage = useCallback(() => {
    const reactFlowWrapper = document.querySelector('.react-flow') as HTMLElement;
    if (!reactFlowWrapper) return;

    toPng(reactFlowWrapper, {
      filter: (node) => {
        if (
          node?.classList?.contains('react-flow__panel') ||
          node?.classList?.contains('react-flow__controls') ||
          node?.classList?.contains('react-flow__minimap')
        ) {
          return false;
        }
        return true;
      },
    }).then((dataUrl) => {
      const link = document.createElement('a');
      link.download = 'schaltplan.png';
      link.href = dataUrl;
      link.click();
    }).catch((err) => {
      console.error('Failed to export image', err);
    });
  }, []);

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-4 bg-white/80 backdrop-blur-md shadow-xl rounded-xl p-4 pointer-events-none w-[calc(100%-2rem)]">
      <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center border border-slate-200 overflow-hidden mr-4 pointer-events-auto flex-wrap">
        <Link href="/">
          <Button variant="ghost" className="rounded-none border-r border-slate-200 px-6 font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all hover:-translate-x-1 h-full">
            ← Zurück
          </Button>
        </Link>
        <button
          className={`px-4 py-2 font-semibold text-sm transition-colors ${viewMode === 'electric' ? 'bg-orange-500 text-white' : 'bg-transparent text-gray-600 hover:bg-gray-50/50'}`}
          onClick={() => setViewMode('electric')}
        >
          Elektrik-Schaltplan
        </button>
        <button
          className={`px-4 py-2 font-semibold text-sm transition-colors ${viewMode === 'water' ? 'bg-cyan-500 text-white' : 'bg-transparent text-gray-600 hover:bg-gray-50/50'}`}
          onClick={() => setViewMode('water')}
        >
          Wasser & Sanitär
        </button>
      </div>

      <div className="pointer-events-auto flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-white font-semibold">
              Aktionen
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white/95 backdrop-blur-md border border-gray-200 shadow-xl rounded-xl p-2 min-w-56">
            <DropdownMenuItem onClick={handleExportBOM} className="cursor-pointer hover:bg-orange-50 text-orange-700 font-medium rounded-lg p-2 mb-1">
              Stückliste an KI senden
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => autoWireSystem(fitView)} className="cursor-pointer hover:bg-yellow-50 text-yellow-700 font-medium rounded-lg p-2 mb-1">
              Automatisch Verkabeln & Absichern
            </DropdownMenuItem>
            <DropdownMenuItem onClick={checkSchematic} className="cursor-pointer hover:bg-red-50 text-red-700 font-medium rounded-lg p-2 mb-1">
              Schaltplan von KI prüfen lassen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onLayout(fitView)} className="cursor-pointer hover:bg-indigo-50 text-indigo-700 font-medium rounded-lg p-2 mb-1">
              Schaltplan aufräumen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportImage} className="cursor-pointer hover:bg-green-50 text-green-700 font-medium rounded-lg p-2">
              Als Bild speichern
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="bg-white/80 backdrop-blur-md rounded shadow-xl flex items-center border border-gray-200 overflow-hidden flex-wrap">
          <button
            className={`px-4 py-2 font-semibold text-sm transition-colors ${season === 'summer' ? 'bg-yellow-400 text-yellow-900' : 'bg-transparent text-gray-600 hover:bg-gray-50/50'}`}
            onClick={() => setSeason('summer')}
          >
            Sommer
          </button>
          <button
            className={`px-4 py-2 font-semibold text-sm transition-colors ${season === 'winter' ? 'bg-blue-400 text-blue-900' : 'bg-transparent text-gray-600 hover:bg-gray-50/50'}`}
            onClick={() => setSeason('winter')}
          >
            Winter
          </button>
        </div>
      </div>

      <div className="ml-auto pointer-events-auto pl-4 border-l border-gray-300 flex items-center">
        <button
          onClick={toggleProMode}
          className={`font-semibold py-2 px-4 rounded-xl shadow-xl transition-colors border backdrop-blur-md ${isProMode ? 'bg-blue-500/90 hover:bg-blue-600/90 text-white border-blue-600' : 'bg-white/80 hover:bg-gray-50/90 text-gray-700 border-gray-200'}`}
        >
          {isProMode ? 'Profi-Modus An' : 'Profi-Modus Aus'}
        </button>
      </div>
    </div>
  );
}
