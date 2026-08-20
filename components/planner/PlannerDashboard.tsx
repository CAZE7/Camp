import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Package, Zap, ScanSearch, LayoutGrid, Camera, Sun, Snowflake, MoreHorizontal, Maximize2 } from 'lucide-react';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useShallow } from 'zustand/react/shallow';
import { useLiveValidation, ValidationWarning } from './hooks/useLiveValidation';
import { WarningCenter } from './ui/WarningCenter';
import { Node as FlowNode } from 'reactflow';

// --- Subcomponents ---

function NavigationSection({
  viewMode,
  setViewMode,
}: {
  viewMode: 'electric' | 'water';
  setViewMode: (mode: 'electric' | 'water') => void;
}) {
  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Ansicht wählen">
      <Button
        variant={viewMode === 'electric' ? 'default' : 'ghost'}
        size="sm"
        role="tab"
        aria-selected={viewMode === 'electric'}
        onClick={() => setViewMode('electric')}
      >
        Elektrik-Schaltplan
      </Button>
      <Button
        variant={viewMode === 'water' ? 'default' : 'ghost'}
        size="sm"
        role="tab"
        aria-selected={viewMode === 'water'}
        onClick={() => setViewMode('water')}
      >
        Wasser &amp; Sanitär
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
  nodes,
}: {
  season: 'summer' | 'winter';
  setSeason: (season: 'summer' | 'winter') => void;
  exportBOM: () => void;
  autoWireSystem: () => void;
  checkSchematic: () => void;
  onLayout: () => void;
  onExportError: (msg: string) => void;
  nodes: FlowNode[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleExportBOM = useCallback(() => {
    exportBOM();
    const event = new CustomEvent('show-bom-modal');
    window.dispatchEvent(event);
  }, [exportBOM]);

  const onFitView = useCallback(() => {
    window.dispatchEvent(new CustomEvent('planner-fit-view'));
  }, []);

  const onExportImage = useCallback(() => {
    // Lazy-load, damit html-to-image nicht im initialen Bundle landet
    import('html-to-image').then(({ toPng }) => {
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
        let msg = 'Bild-Export fehlgeschlagen.';
        if (err?.name === 'SecurityError') {
          msg = 'Export blockiert: Canvas enthält Cross-Origin-Inhalte. Lade die Seite neu ohne externe Bilder.';
        } else if (nodes.length === 0) {
          msg = 'Nichts zu exportieren — platziere zuerst Komponenten auf dem Plan.';
        } else {
          msg = 'Bild-Export fehlgeschlagen. Reduziere die Plan-Größe oder versuche es mit Firefox/Chrome.';
        }
        onExportError(msg);
      });
    });
  }, [onExportError, nodes]);

  const runAndClose = (fn: () => void) => () => { fn(); setMenuOpen(false); };

  return (
    <div className="flex items-center gap-2">
      {/* Primäraktion — der wichtigste erste Klick für Einsteiger */}
      <Button
        variant="default"
        size="sm"
        onClick={() => autoWireSystem()}
        className="gap-1.5"
        title="Automatisch Verkabeln & Absichern — berechnet Querschnitte und Sicherungen nach VDE"
      >
        <Zap className="w-4 h-4" /> Auto-Wire &amp; Absichern
      </Button>

      <Button variant="outline" size="sm" onClick={onFitView} className="gap-1.5" title="Ganzen Plan einpassen">
        <Maximize2 className="w-4 h-4" /> <span className="hidden md:inline">Übersicht</span>
      </Button>

      {/* Overflow-Menü — Sekundäraktionen & Saison */}
      <div className="relative" ref={menuRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMenuOpen((v) => !v)}
          className="gap-1.5"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Weitere Aktionen"
        >
          <MoreHorizontal className="w-4 h-4" /> Mehr
        </Button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute top-full right-0 mt-2 z-50 w-64 rounded-xl border border-border bg-card p-2 shadow-2xl animate-in fade-in slide-in-from-top-2"
          >
            <button role="menuitem" onClick={runAndClose(handleExportBOM)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent">
              <Package className="w-4 h-4" /> Stückliste
            </button>
            <button role="menuitem" onClick={runAndClose(checkSchematic)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent">
              <ScanSearch className="w-4 h-4" /> KI-Check
            </button>
            <button role="menuitem" onClick={runAndClose(() => onLayout())} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent">
              <LayoutGrid className="w-4 h-4" /> Aufräumen
            </button>
            <button role="menuitem" onClick={runAndClose(onExportImage)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent">
              <Camera className="w-4 h-4" /> Bild Export
            </button>

            <div className="my-1 border-t border-border" />
            <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Jahreszeit</p>
            <div className="flex gap-1 px-2 pb-1">
              <Button
                variant={season === 'summer' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSeason('summer')}
                className="flex-1 gap-1.5"
              >
                <Sun className="w-4 h-4" /> Sommer
              </Button>
              <Button
                variant={season === 'winter' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSeason('winter')}
                className="flex-1 gap-1.5"
              >
                <Snowflake className="w-4 h-4" /> Winter
              </Button>
            </div>
          </div>
        )}
      </div>
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
    focusElement,
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
    focusElement: state.focusElement,
    nodes: state.nodes,
    edges: state.edges,
    waterNodes: state.waterNodes,
    waterEdges: state.waterEdges,
  })));

  const warnings = useLiveValidation(nodes, edges, waterNodes, waterEdges);

  const handleFix = useCallback((w: ValidationWarning) => {
    if (w.focusId && w.focusType && focusElement) {
      focusElement(w.focusId, w.focusType);
    }
  }, [focusElement]);

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
          nodes={nodes}
        />
      </div>

      {/* Gebündelte Warn-Zentrale — einziger fester Ort für alle Live-Warnungen */}
      <div className="ml-auto pl-2 shrink-0">
        <WarningCenter warnings={warnings} onFix={handleFix} />
      </div>

      {exportError && (
        <div className="absolute top-full mt-2 left-4 z-50 p-3 rounded-lg bg-warn-critical-bg text-warn-critical border border-warn-critical-border text-sm font-semibold shadow-lg animate-in fade-in slide-in-from-top-2">
          {exportError}
        </div>
      )}

      {systemMessage && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 p-3 rounded-lg bg-warn-info-bg text-warn-info border border-warn-info-border text-sm font-semibold shadow-lg animate-in fade-in slide-in-from-top-2">
          <span>{systemMessage}</span>
          <Button variant="ghost" size="sm" onClick={() => setSystemMessage(null)} className="h-6 px-2" aria-label="Systemnachricht schließen">OK</Button>
        </div>
      )}
    </div>
  );
}
