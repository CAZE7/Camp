import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import {
  Package,
  Zap,
  ScanSearch,
  LayoutGrid,
  Camera,
  Sun,
  Snowflake,
  MoreHorizontal,
  Maximize2,
  Undo2,
  Redo2,
  Loader2,
  Trash2,
  Wrench,
  Check,
  Circle,
} from 'lucide-react';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { useShallow } from 'zustand/react/shallow';
import { getNodesBounds, getViewportForBounds } from 'reactflow';
import { useLiveValidation, type ValidationWarning } from './hooks/useLiveValidation';
import { WarningCenter } from './ui/WarningCenter';
import { calculateConduitFillPercent, VDE_MAX_CONDUIT_FILL_PERCENT } from '../../lib/vde-standards';
import { mm2, quantityOr } from '../../lib/units';

function NavigationSection({
  viewMode,
  setViewMode,
}: {
  viewMode: 'electric' | 'water';
  setViewMode: (mode: 'electric' | 'water') => void;
}) {
  return (
    <div className="hidden items-center gap-1 lg:flex" role="tablist" aria-label="Planbereich wählen">
      <Button
        variant={viewMode === 'electric' ? 'default' : 'ghost'}
        size="sm"
        role="tab"
        aria-selected={viewMode === 'electric'}
        onClick={() => setViewMode('electric')}
        className="min-h-11"
      >
        <Zap className="mr-1 h-4 w-4" aria-hidden="true" />
        Elektrik
      </Button>
      <Button
        variant={viewMode === 'water' ? 'default' : 'ghost'}
        size="sm"
        role="tab"
        aria-selected={viewMode === 'water'}
        onClick={() => setViewMode('water')}
        className="min-h-11"
      >
        Wasser
      </Button>
    </div>
  );
}

interface ActionFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

function relativeSaveTime(date: Date | null): string {
  if (!date) return 'noch nicht in dieser Sitzung';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'gerade eben';
  return `vor ${minutes} Minute${minutes === 1 ? '' : 'n'}`;
}

function SaveIndicator({ revision }: { revision: unknown[] }) {
  const [saved, setSaved] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const first = useRef(true);
  const [, forceMinuteUpdate] = useState(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setSavedAt(new Date());
      return;
    }
    setSaved(false);
    const timer = window.setTimeout(() => {
      setSaved(true);
      setSavedAt(new Date());
    }, 450);
    return () => window.clearTimeout(timer);
    // The four graph references are the persisted planner revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, revision);

  useEffect(() => {
    const interval = window.setInterval(() => forceMinuteUpdate((value) => value + 1), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const detail = saved ? `Zuletzt gespeichert: ${relativeSaveTime(savedAt)}` : 'Ungespeicherte Änderungen';
  return (
    <span
      data-testid="save-indicator"
      role="status"
      aria-live="polite"
      aria-label={detail}
      title={detail}
      className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-2 text-xs font-semibold ${
        saved ? 'border-success/40 bg-success/10 text-success' : 'border-copper/50 bg-copper/10 text-copper'
      }`}
    >
      {saved ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Circle className="h-3 w-3 fill-current" aria-hidden="true" />
      )}
      <span className="hidden 2xl:inline">{saved ? 'Gespeichert' : 'Ungespeichert'}</span>
    </span>
  );
}

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Strg+Z', label: 'Rückgängig' },
  { keys: 'Entf', label: 'Löschen' },
  { keys: 'Strg+S', label: 'Speichern' },
];

/**
 * Sichtbare Tastaturkürzel in der Toolbar (WCAG 3.3.5 „Hilfe“).
 * Nur ab 1280 px eingeblendet — darunter fehlt der Platz, und Touch-Geräte
 * haben in der Regel keine Tastatur.
 */
function KeyboardShortcutHints() {
  return (
    <ul className="hidden items-center gap-1 2xl:flex" aria-label="Tastaturkürzel">
      {SHORTCUTS.map((shortcut) => (
        <li key={shortcut.keys} className="flex items-center gap-1 text-xs text-muted-foreground">
          <kbd className="rounded border border-border bg-accent px-1.5 py-0.5 font-mono text-xs text-foreground">
            {shortcut.keys}
          </kbd>
          <span className="hidden 2xl:inline">{shortcut.label}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionsSection({
  season,
  setSeason,
  autoWireSystem,
  onLayout,
  nodes,
  warnings,
  setFeedback,
  undo,
  redo,
  canUndo,
  canRedo,
  onRequestReset,
}: {
  season: 'summer' | 'winter';
  setSeason: (season: 'summer' | 'winter') => void;
  autoWireSystem: () => void;
  onLayout: () => void;
  nodes: import('reactflow').Node[];
  warnings: ValidationWarning[];
  setFeedback: (feedback: ActionFeedback) => void;
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onRequestReset: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<'export' | 'wire' | 'layout' | 'check' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const setHasOnboarded = useAppStore((state) => state.setHasOnboarded);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleExportBOM = useCallback(() => {
    // Das BOMModal liest den Store selbst und öffnet sich über dieses Event.
    window.dispatchEvent(new CustomEvent('show-bom-modal'));
    setMenuOpen(false);
  }, []);

  const runAutoWire = () => {
    setBusy('wire');
    autoWireSystem();
    const hasBattery = nodes.some((node) => node.type === 'battery');
    setFeedback({
      type: hasBattery ? 'success' : 'error',
      message: hasBattery
        ? 'Automatische Verkabelung und Dimensionierung abgeschlossen.'
        : 'Platziere zuerst eine Batterie.',
    });
    window.setTimeout(() => setBusy(null), 350);
  };

  const runLayout = () => {
    setBusy('layout');
    onLayout();
    setMenuOpen(false);
    setFeedback({
      type: 'success',
      message: 'Plan in drei Funktionsspalten aufgeräumt. Rückgängig ist möglich.',
    });
    window.setTimeout(() => setBusy(null), 350);
  };

  const runCheck = () => {
    setBusy('check');
    // Die Prüfung läuft live (useLiveValidation); der Button öffnet nur die
    // Warn-Zentrale. Der frühere 'check-schematic'-Dispatch hatte keinen
    // Listener und wurde entfernt.
    if (warnings.length > 0) {
      window.dispatchEvent(new CustomEvent('open-warning-center'));
      setFeedback({
        type: 'info',
        message: `${warnings.length} Hinweis${warnings.length === 1 ? '' : 'e'} gefunden. Die Prüfliste wurde geöffnet.`,
      });
    } else {
      setFeedback({ type: 'success', message: 'Lokale Planprüfung abgeschlossen: aktuell keine Hinweise.' });
    }
    window.setTimeout(() => setBusy(null), 350);
    setMenuOpen(false);
  };

  const onExportImage = useCallback(async () => {
    setBusy('export');
    setMenuOpen(false);
    try {
      const { toPng } = await import('html-to-image');
      const reactFlowWrapper = document.querySelector('.react-flow') as HTMLElement | null;
      if (!reactFlowWrapper) throw new Error('Planfläche nicht gefunden');
      const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
      const viewport = reactFlowWrapper.querySelector<HTMLElement>('.react-flow__viewport');
      const bounds =
        nodes.length > 0
          ? getNodesBounds(nodes)
          : { x: 0, y: 0, width: reactFlowWrapper.clientWidth, height: reactFlowWrapper.clientHeight };
      const imageWidth = Math.max(640, Math.ceil(bounds.width + 160));
      const imageHeight = Math.max(480, Math.ceil(bounds.height + 160));
      const transform = getViewportForBounds(bounds, imageWidth, imageHeight, 0.5, 2, 0.12);
      const dataUrl = await toPng(viewport || reactFlowWrapper, {
        backgroundColor: paper,
        pixelRatio: 2,
        cacheBust: true,
        width: imageWidth,
        height: imageHeight,
        style: viewport
          ? {
              width: `${imageWidth}px`,
              height: `${imageHeight}px`,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
            }
          : undefined,
        filter: (node) =>
          !(
            node?.classList?.contains('react-flow__panel') ||
            node?.classList?.contains('react-flow__controls') ||
            node?.classList?.contains('react-flow__minimap')
          ),
      });
      const link = document.createElement('a');
      link.download = 'werft-schaltplan.png';
      link.href = dataUrl;
      link.click();
      setFeedback({ type: 'success', message: 'Bild in hoher Auflösung exportiert.' });
    } catch (error) {
      // M6-4: statt console.error (vom Nutzer unsichtbar) zeigt das Dashboard
      // die Ursache direkt; die Fehlerklasse bleibt im Meldungstext erhalten.
      const message =
        nodes.length === 0
          ? 'Nichts zu exportieren – platziere zuerst Komponenten.'
          : error instanceof Error && error.name === 'SecurityError'
            ? 'Export blockiert: Der Plan enthält externe Inhalte.'
            : `Bild-Export fehlgeschlagen${
                error instanceof Error && error.name ? ` (${error.name})` : ''
              }. Passe die Ansicht an und versuche es erneut.`;
      setFeedback({ type: 'error', message });
    } finally {
      setBusy(null);
    }
  }, [nodes, setFeedback]);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Button
        data-testid="action-autowire"
        onClick={runAutoWire}
        disabled={busy !== null}
        className="min-h-11 min-w-11 gap-1.5 px-3"
        title="Verbindungen, Querschnitte und Sicherungen automatisch berechnen"
        aria-label="Automatisch verbinden"
      >
        {busy === 'wire' ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        <span className="hidden lg:inline">Automatisch verbinden</span>
      </Button>

      {/* Unter 768 px stehen die runden Canvas-Aktionen direkt über der
          Bottom-Navigation; ab Tablet bleiben beide History-Richtungen hier. */}
      <Button
        data-testid="toolbar-undo"
        variant="outline"
        size="icon"
        onClick={undo}
        disabled={!canUndo}
        className="hidden h-11 w-11 md:inline-flex"
        aria-label="Rückgängig"
        title="Rückgängig"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        data-testid="toolbar-redo"
        variant="outline"
        size="icon"
        onClick={redo}
        disabled={!canRedo}
        className="hidden h-11 w-11 md:inline-flex"
        aria-label="Wiederholen"
        title="Wiederholen"
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        onClick={() => window.dispatchEvent(new CustomEvent('planner-fit-view'))}
        className="hidden min-h-11 gap-1.5 lg:inline-flex"
        title="Ganzen Plan einpassen"
      >
        <Maximize2 className="h-4 w-4" />
        <span>Übersicht</span>
      </Button>
      <Button
        variant="outline"
        onClick={runLayout}
        disabled={busy !== null}
        className="hidden min-h-11 gap-1.5 lg:inline-flex"
        title="Plan automatisch anordnen"
      >
        <LayoutGrid className="h-4 w-4" />
        <span>Aufräumen</span>
      </Button>

      <div className="relative" ref={menuRef}>
        <Button
          data-testid="action-more"
          variant="outline"
          size="icon"
          onClick={() => setMenuOpen((value) => !value)}
          className="h-11 w-11"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Weitere Aktionen"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-[70] mt-2 w-72 rounded-xl border border-border bg-card p-2 shadow-2xl sm:left-auto sm:right-0"
          >
            <button
              role="menuitem"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('planner-fit-view'));
                setMenuOpen(false);
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Maximize2 className="h-4 w-4" />
              Übersicht
            </button>
            <button
              role="menuitem"
              data-testid="action-layout"
              onClick={runLayout}
              disabled={busy !== null}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <LayoutGrid className="h-4 w-4" />
              Aufräumen
            </button>
            <button
              role="menuitem"
              data-testid="action-bom"
              onClick={handleExportBOM}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Package className="h-4 w-4" />
              Stückliste
            </button>
            <button
              role="menuitem"
              data-testid="action-check"
              onClick={runCheck}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ScanSearch className="h-4 w-4" />
              Plan lokal prüfen
            </button>
            <button
              role="menuitem"
              onClick={onExportImage}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {busy === 'export' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Bild exportieren
            </button>

            <div className="my-2 border-t border-border" />
            <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Jahreszeit
            </p>
            <div className="flex gap-1 px-2 pb-2">
              <Button
                variant={season === 'summer' ? 'default' : 'ghost'}
                onClick={() => setSeason('summer')}
                className="min-h-11 flex-1 gap-1"
                aria-pressed={season === 'summer'}
              >
                <Sun className="h-4 w-4" />
                Sommer
              </Button>
              <Button
                variant={season === 'winter' ? 'default' : 'ghost'}
                onClick={() => setSeason('winter')}
                className="min-h-11 flex-1 gap-1"
                aria-pressed={season === 'winter'}
              >
                <Snowflake className="h-4 w-4" />
                Winter
              </Button>
            </div>
            <p className="px-3 pb-2 text-xs text-muted-foreground">
              Winter berücksichtigt weniger Solarertrag und höheren Heizbedarf.
            </p>

            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setHasOnboarded(false);
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Wrench className="h-4 w-4" />
              Einführung erneut öffnen
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onRequestReset();
              }}
              className="hover:bg-signal/5 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-4 w-4" />
              Neuen leeren Plan starten
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PlannerDashboard() {
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const {
    viewMode,
    setViewMode,
    season,
    setSeason,
    autoWireSystem,
    onLayout,
    focusElement,
    nodes,
    edges,
    waterNodes,
    waterEdges,
    waterWarning,
    undo,
    redo,
    canUndo,
    canRedo,
    clearPlan,
  } = usePlannerStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
      season: state.season,
      setSeason: state.setSeason,
      autoWireSystem: state.autoWireSystem,
      onLayout: state.onLayout,
      focusElement: state.focusElement,
      nodes: state.nodes,
      edges: state.edges,
      waterNodes: state.waterNodes,
      waterEdges: state.waterEdges,
      waterWarning: state.waterWarning,
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      clearPlan: state.clearPlan,
    }))
  );

  const liveWarnings = useLiveValidation(nodes, edges);
  const warnings = useMemo(() => {
    const supplemental: ValidationWarning[] = [];
    nodes
      .filter((node) => node.type === 'shorePower' && !node.data?.hasRcd)
      .forEach((node) =>
        supplemental.push({
          id: `rcd-${node.id}`,
          category: 'safety',
          type: 'critical',
          title: 'FI-Schutzschalter fehlt',
          focusId: node.id,
          focusType: 'node',
          message:
            'Am Landstromanschluss fehlt ein FI-Schutzschalter mit höchstens 30 mA. Ohne ihn besteht bei einem Fehler Stromschlaggefahr. Lass den 230-V-Schutz von einer Elektrofachkraft ergänzen.',
        })
      );
    nodes
      .filter((node) => node.type === 'inverter')
      .forEach((node) => {
        const selectedDeviceIds = new Set<string>(node.data?.concurrentDevices || []);
        const total = nodes.reduce(
          (sum, candidate) =>
            selectedDeviceIds.has(candidate.id) ? sum + (Number(candidate.data?.watts) || 0) : sum,
          0
        );
        if (Number(node.data?.continuousPower) > 0 && total > Number(node.data?.continuousPower))
          supplemental.push({
            id: `inverter-overload-${node.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Wechselrichter überlastet',
            focusId: node.id,
            focusType: 'node',
            message: `Die gleichzeitig ausgewählten Geräte benötigen ${total} W, der Wechselrichter liefert dauerhaft nur ${node.data.continuousPower} W. Reduziere die gleichzeitige Nutzung oder plane ein stärkeres Gerät.`,
          });
      });
    nodes
      .filter((node) => node.type === 'conduit')
      .forEach((node) => {
        const conduitType = String(node.data?.conduitType || 'EN 20');
        const assigned = new Set<string>(node.data?.assignedEdges || []);
        // Persistenzgrenze: `edge.data.crossSection` kommt aus dem Store und
        // wird hier geprüft in mm² überführt (Standardkabel 2.5 mm² als Ersatz).
        const crossSections = edges
          .filter((edge) => assigned.has(edge.id))
          .map((edge) => quantityOr(edge.data?.crossSection, mm2, mm2(2.5)));
        const fill = calculateConduitFillPercent(conduitType, crossSections);
        if (fill > VDE_MAX_CONDUIT_FILL_PERCENT)
          supplemental.push({
            id: `conduit-overfill-${node.id}`,
            category: 'safety',
            type: 'warning',
            title: 'Leerrohr zu voll',
            focusId: node.id,
            focusType: 'node',
            message: `Das Leerrohr ist zu ${fill.toFixed(0)} Prozent gefüllt. Verwende ein größeres Rohr oder verteile die Kabel auf mehrere Rohre.`,
          });
      });
    if (waterWarning)
      supplemental.push({
        id: 'water-flow-hint',
        category: 'topology',
        type: 'info',
        title: 'Wasserfluss verbessern',
        message: `${waterWarning} Ergänze zwischen Pumpe und Entnahmestelle ein Druckausgleichsgefäß.`,
      });
    return [...liveWarnings, ...supplemental];
  }, [liveWarnings, nodes, edges, waterWarning]);

  const handleFix = useCallback(
    (warning: ValidationWarning) => {
      if (warning.focusId && warning.focusType) focusElement(warning.focusId, warning.focusType);
    },
    [focusElement]
  );

  // Ctrl+S wird in PlannerInner abgefangen (kein Browser-Speichern-Dialog) und
  // hier sichtbar bestätigt — der Plan liegt ohnehin laufend im Local Storage.
  useEffect(() => {
    const onSave = () =>
      setFeedback({
        type: 'success',
        message: 'Plan gespeichert: Änderungen liegen automatisch in diesem Browser.',
      });
    window.addEventListener('planner-save', onSave);
    return () => window.removeEventListener('planner-save', onSave);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <>
      <header className="relative flex w-full shrink-0 flex-nowrap items-center gap-2 overflow-visible border-b border-border bg-card px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-visible">
          <NavigationSection viewMode={viewMode} setViewMode={setViewMode} />
          <ActionsSection
            season={season}
            setSeason={setSeason}
            autoWireSystem={autoWireSystem}
            onLayout={onLayout}
            nodes={viewMode === 'water' ? waterNodes : nodes}
            warnings={warnings}
            setFeedback={setFeedback}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onRequestReset={() => setResetOpen(true)}
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          {/* Tastaturkürzel sichtbar machen (Desktop): Nutzer sollen sie nicht
              raten müssen. Auf Touch-Geräten ohne Tastatur wird nichts angezeigt. */}
          <KeyboardShortcutHints />
          <SaveIndicator revision={[nodes, edges, waterNodes, waterEdges]} />
          <span
            className="hidden rounded-full border border-border bg-accent px-2 py-1 text-xs font-semibold text-foreground xl:inline"
            title="Die Jahreszeit beeinflusst Solarertrag und Heizverbrauch"
          >
            {season === 'summer' ? '☀ Sommer' : '❄ Winter'}
          </span>
          <WarningCenter warnings={warnings} onFix={handleFix} />
        </div>

        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            aria-live={feedback.type === 'error' ? 'assertive' : 'polite'}
            className={`fixed left-1/2 top-16 z-50 w-11/12 max-w-md -translate-x-1/2 rounded-lg border p-3 text-sm font-semibold shadow-lg ${
              feedback.type === 'error'
                ? 'bg-signal/5 border-signal text-signal'
                : feedback.type === 'success'
                  ? 'bg-moss/10 border-moss text-moss'
                  : 'bg-oxide/10 border-oxide text-oxide'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{feedback.message}</span>
              {feedback.actionLabel && feedback.onAction && (
                <Button
                  data-testid="feedback-action"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-current bg-card"
                  onClick={() => {
                    feedback.onAction?.();
                    setFeedback(null);
                  }}
                >
                  {feedback.actionLabel}
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      <AccessibleDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Neuen leeren Plan starten?"
        description="Alle Komponenten und Leitungen werden entfernt. Du kannst die Aktion mit Strg+Z oder dem Rückgängig-Button rückgängig machen."
        className="max-w-md"
      >
        <div className="flex flex-col-reverse gap-3 p-5 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setResetOpen(false)} className="min-h-11">
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              clearPlan?.();
              setResetOpen(false);
              setFeedback({
                type: 'success',
                message: 'Leerer Plan gestartet.',
                actionLabel: 'Rückgängig',
                onAction: undo,
              });
            }}
            className="min-h-11"
          >
            Plan leeren
          </Button>
        </div>
      </AccessibleDialog>
    </>
  );
}
