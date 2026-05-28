import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Package, Zap, ScanSearch, LayoutGrid, Camera, Sun, Snowflake } from 'lucide-react';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../lib/store';
import { toPng } from 'html-to-image';
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
    <div className="flex items-center gap-1">
      <Button
        variant={viewMode === 'electric' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('electric')}
        className={viewMode === 'electric' ? 'bg-orange-500 hover:bg-orange-600' : ''}
      >
        Elektrik-Schaltplan
      </Button>
      <Button
        variant={viewMode === 'water' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('water')}
        className={viewMode === 'water' ? 'bg-cyan-500 hover:bg-cyan-600' : ''}
      >
        Wasser & Sanitär
      </Button>
    </div>
  );
}

function ActionsSection({
  season,
  setSeason,
  exportBOM,
  autoWireSystem,
  checkSchematic,
  onLayout,
  onExportError,
}: {
  season: 'summer' | 'winter';
  setSeason: (season: 'summer' | 'winter') => void;
  exportBOM: () => void;
  autoWireSystem: () => void;
  checkSchematic: () => void;
  onLayout: () => void;
  onExportError: (msg: string) => void;
}) {
  const handleExportBOM = useCallback(() => {
    exportBOM();
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
      onExportError('Bild-Export fehlgeschlagen. Bitte versuche es erneut.');
    });
  }, [onExportError]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Segmented Action Buttons */}
      <div className="flex bg-stone-100/50 p-1 rounded-lg border border-stone-200/60 backdrop-blur-sm gap-1">
        <Button variant="ghost" size="sm" onClick={handleExportBOM} className="gap-1.5 text-orange-700 hover:bg-white hover:shadow-sm">
          <Package className="w-4 h-4" /> Stückliste
        </Button>
        <Button variant="ghost" size="sm" onClick={() => autoWireSystem()} className="gap-1.5 text-yellow-700 hover:bg-white hover:shadow-sm">
          <Zap className="w-4 h-4" /> Auto-Wire
        </Button>
        <Button variant="ghost" size="sm" onClick={checkSchematic} className="gap-1.5 text-red-700 hover:bg-white hover:shadow-sm">
          <ScanSearch className="w-4 h-4" /> KI-Check
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onLayout()} className="gap-1.5 text-indigo-700 hover:bg-white hover:shadow-sm">
          <LayoutGrid className="w-4 h-4" /> Aufräumen
        </Button>
        <Button variant="ghost" size="sm" onClick={onExportImage} className="gap-1.5 text-green-700 hover:bg-white hover:shadow-sm">
          <Camera className="w-4 h-4" /> Bild Export
        </Button>
      </div>

      {/* Season Toggle */}
      <div className="flex items-center gap-1 bg-stone-100/50 p-1 rounded-lg border border-stone-200/60 backdrop-blur-sm">
        <Button
          variant={season === 'summer' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSeason('summer')}
          className={`gap-1.5 ${season === 'summer' ? 'bg-yellow-400 text-yellow-900 shadow-sm' : ''}`}
        >
          <Sun className="w-4 h-4" /> Sommer
        </Button>
        <Button
          variant={season === 'winter' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSeason('winter')}
          className={`gap-1.5 ${season === 'winter' ? 'bg-blue-400 text-blue-900 shadow-sm' : ''}`}
        >
          <Snowflake className="w-4 h-4" /> Winter
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
    <div className="ml-auto pl-3 border-l border-border flex items-center">
      <Button
        variant={isProMode ? 'default' : 'outline'}
        size="sm"
        onClick={toggleProMode}
        className={isProMode ? 'bg-blue-500 hover:bg-blue-600' : ''}
      >
        {isProMode ? 'Profi-Modus An' : 'Profi-Modus Aus'}
      </Button>
    </div>
  );
}

// --- Main Component ---

export function PlannerDashboard() {
  const [exportError, setExportError] = useState<string | null>(null);

  const {
    viewMode,
    setViewMode,
    season,
    setSeason,
    exportBOM,
    autoWireSystem,
    checkSchematic,
    onLayout,
    systemMessage,
    setSystemMessage,
    nodes,
    edges,
    waterNodes,
    waterEdges,
  } = usePlannerStore(useShallow((state) => ({
    viewMode: state.viewMode,
    setViewMode: state.setViewMode,
    season: state.season,
    setSeason: state.setSeason,
    exportBOM: state.exportBOM,
    autoWireSystem: state.autoWireSystem,
    checkSchematic: state.checkSchematic,
    onLayout: state.onLayout,
    systemMessage: state.systemMessage,
    setSystemMessage: state.setSystemMessage,
    nodes: state.nodes,
    edges: state.edges,
    waterNodes: state.waterNodes,
    waterEdges: state.waterEdges,
  })));

  const { isProMode, toggleProMode } = useAppStore();
  const warnings = useLiveValidation(nodes, edges, waterNodes, waterEdges);

  return (
    <div className="relative flex flex-nowrap items-center gap-2 bg-card border-b border-border px-2 py-1 shrink-0 w-full overflow-x-auto">
      <div className="flex flex-nowrap items-center gap-2 flex-grow">
        <NavigationSection viewMode={viewMode} setViewMode={setViewMode} />

        <ActionsSection
          season={season}
          setSeason={setSeason}
          exportBOM={exportBOM}
          autoWireSystem={autoWireSystem}
          checkSchematic={checkSchematic}
          onLayout={onLayout}
          onExportError={(msg) => { setExportError(msg); setTimeout(() => setExportError(null), 5000); }}
        />

        <ProModeSection isProMode={isProMode} toggleProMode={toggleProMode} />
      </div>

      {exportError && (
        <div className="absolute top-full mt-2 left-4 z-50 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm font-semibold shadow-lg animate-in fade-in slide-in-from-top-2">
          🚨 {exportError}
        </div>
      )}

      {systemMessage && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 p-3 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-sm font-semibold shadow-lg animate-in fade-in slide-in-from-top-2">
          <span>ℹ️ {systemMessage}</span>
          <Button variant="ghost" size="sm" onClick={() => setSystemMessage(null)} className="h-6 px-2 hover:bg-blue-100 text-blue-800" aria-label="Systemnachricht schließen">OK</Button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="absolute top-full mt-2 right-4 z-50 flex flex-col gap-2">
          {warnings.map((w) => (
            <div key={w.id} className={`p-3 rounded-lg shadow-lg border text-sm font-semibold max-w-md animate-in fade-in slide-in-from-right-2 ${
              w.category === 'safety' ? 'bg-red-50 text-red-800 border-red-200' :
              w.category === 'topology' ? 'bg-orange-50 text-orange-800 border-orange-200' :
              w.category === 'monitoring' ? 'bg-blue-50 text-blue-800 border-blue-200' :
              'bg-purple-50 text-purple-800 border-purple-200'
            }`}>
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
