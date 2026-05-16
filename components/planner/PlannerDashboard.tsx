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
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../lib/store';
import { toPng } from 'html-to-image';
import { useReactFlow } from 'reactflow';
import { useLiveValidation } from './hooks/useLiveValidation';

// --- Subcomponents ---

function NavigationSection({
  viewMode,
  setViewMode,
}: {
  viewMode: 'electric' | 'water';
  setViewMode: (mode: 'electric' | 'water') => void;
}) {
  return (
    <div className="flex items-center gap-1 pointer-events-auto">
      <Button
        variant={viewMode === 'electric' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('electric')}
        className={`min-h-[48px] md:min-h-0 ${viewMode === 'electric' ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
      >
        Elektrik-Schaltplan
      </Button>
      <Button
        variant={viewMode === 'water' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('water')}
        className={`min-h-[48px] md:min-h-0 ${viewMode === 'water' ? 'bg-cyan-500 hover:bg-cyan-600' : ''}`}
      >
        Wasser & Sanitär
      </Button>
    </div>
  );
}

function ActionsSection({
  fitView,
  season,
  setSeason,
  exportBOM,
  autoWireSystem,
  checkSchematic,
  onLayout,
}: {
  fitView: (options?: any) => void;
  season: 'summer' | 'winter';
  setSeason: (season: 'summer' | 'winter') => void;
  exportBOM: () => void;
  autoWireSystem: (fitView: (options?: any) => void) => void;
  checkSchematic: () => void;
  onLayout: (fitView: (options?: any) => void) => void;
}) {
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
    <div className="pointer-events-auto flex items-center gap-2 flex-wrap">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="font-semibold min-h-[48px] md:min-h-0">
            Aktionen
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="rounded-lg min-w-52">
          <DropdownMenuItem onClick={handleExportBOM} className="cursor-pointer text-orange-700 font-medium rounded-md py-3 md:py-1.5">
            Stückliste an KI senden
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => autoWireSystem(fitView)} className="cursor-pointer text-yellow-700 font-medium rounded-md py-3 md:py-1.5">
            Automatisch Verkabeln & Absichern
          </DropdownMenuItem>
          <DropdownMenuItem onClick={checkSchematic} className="cursor-pointer text-red-700 font-medium rounded-md py-3 md:py-1.5">
            Schaltplan von KI prüfen lassen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onLayout(fitView)} className="cursor-pointer text-indigo-700 font-medium rounded-md py-3 md:py-1.5">
            Schaltplan aufräumen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportImage} className="cursor-pointer text-green-700 font-medium rounded-md py-3 md:py-1.5">
            Als Bild speichern
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Season Toggle */}
      <div className="flex items-center gap-1">
        <Button
          variant={season === 'summer' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSeason('summer')}
          className={`min-h-[48px] md:min-h-0 ${season === 'summer' ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500' : ''}`}
        >
          Sommer
        </Button>
        <Button
          variant={season === 'winter' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSeason('winter')}
          className={`min-h-[48px] md:min-h-0 ${season === 'winter' ? 'bg-blue-400 text-blue-900 hover:bg-blue-500' : ''}`}
        >
          Winter
        </Button>
      </div>
    </div>
  );
}

function ProModeSection({
  isProMode,
  toggleProMode,
}: {
  isProMode: boolean;
  toggleProMode: () => void;
}) {
  return (
    <div className="ml-auto pointer-events-auto pl-3 border-l border-border flex items-center">
      <Button
        variant={isProMode ? 'default' : 'outline'}
        size="sm"
        onClick={toggleProMode}
        className={`min-h-[48px] md:min-h-0 ${isProMode ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
      >
        {isProMode ? 'Profi-Modus An' : 'Profi-Modus Aus'}
      </Button>
    </div>
  );
}

// --- Main Component ---

export function PlannerDashboard() {
  const { fitView } = useReactFlow();

  const {
    viewMode,
    setViewMode,
    season,
    setSeason,
    exportBOM,
    autoWireSystem,
    checkSchematic,
    onLayout,
    nodes,
    edges,
  } = usePlannerStore(useShallow((state) => ({
    viewMode: state.viewMode,
    setViewMode: state.setViewMode,
    season: state.season,
    setSeason: state.setSeason,
    exportBOM: state.exportBOM,
    autoWireSystem: state.autoWireSystem,
    checkSchematic: state.checkSchematic,
    onLayout: state.onLayout,
    nodes: state.nodes,
    edges: state.edges,
  })));

  const { isProMode, toggleProMode } = useAppStore();
  const warnings = useLiveValidation(nodes, edges);

  return (
    <div className="absolute top-16 md:top-4 left-4 z-10 flex flex-wrap gap-3 bg-card shadow-lg rounded-lg p-3 pointer-events-none w-[calc(100%-2rem)] border border-border">
      <NavigationSection viewMode={viewMode} setViewMode={setViewMode} />

      <ActionsSection
        fitView={fitView}
        season={season}
        setSeason={setSeason}
        exportBOM={exportBOM}
        autoWireSystem={autoWireSystem}
        checkSchematic={checkSchematic}
        onLayout={onLayout}
      />

      <ProModeSection isProMode={isProMode} toggleProMode={toggleProMode} />
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)]">
      <div className="flex flex-wrap gap-3 bg-card shadow-lg rounded-lg p-3 border border-border">
        <NavigationSection viewMode={viewMode} setViewMode={setViewMode} />

        <ActionsSection
          fitView={fitView}
          season={season}
          setSeason={setSeason}
          exportBOM={exportBOM}
          autoWireSystem={autoWireSystem}
          checkSchematic={checkSchematic}
          onLayout={onLayout}
        />

        <ProModeSection isProMode={isProMode} toggleProMode={toggleProMode} />
      </div>

      {warnings.length > 0 && (
        <div className="flex flex-col gap-2 pointer-events-auto">
          {warnings.map((w) => (
            <div key={w.id} className={`p-3 rounded-lg shadow-md border text-sm font-semibold max-w-md ${
              w.type === 'critical' ? 'bg-red-50 text-red-800 border-red-200' :
              w.type === 'warning' ? 'bg-orange-50 text-orange-800 border-orange-200' :
              'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
