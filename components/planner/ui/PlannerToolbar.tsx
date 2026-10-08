'use client';

import React from 'react';
import {
  Camera,
  FileDown,
  Frame,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Network,
  Package,
  Redo2,
  ScanSearch,
  Undo2,
  Wand2,
  Zap,
  Droplets,
} from 'lucide-react';
import type { PlannerBusy, PlannerMenuGroup } from '../hooks/usePlannerActions';
import type { PlannerMenuId } from '../hooks/usePlannerActions';

/**
 * Werkzeugleiste: die primären Aktionen des Planers, dauerhaft sichtbar.
 *
 * Reihenfolge folgt der Arbeitsfolge (Bauen → Verdrahten → Ordnen → Prüfen →
 * Ausgeben), Trenner gruppieren sie. Genau EINE Aktion ist hervorgehoben
 * („Automatisch verbinden") — und auch sie über Rahmen, nicht über eine
 * Farbfläche: Farbe bleibt in dieser Oberfläche der Aussage vorbehalten
 * (Fehler/Warnung/OK/Auswahl).
 */

export interface PlannerToolbarProps {
  busy: PlannerBusy;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoWire: () => void;
  onTidy: () => void;
  onCheck: () => void;
  onBom: () => void;
  onExport: () => void;
  viewMode: 'electric' | 'water';
  onSelectViewMode: (mode: 'electric' | 'water') => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  /** Überlauf `⋯` — sekundäre Aktionen, gleiche Quelle wie die Menüleiste. */
  overflow: PlannerMenuGroup[];
  openMenu: PlannerMenuId | 'more' | null;
  onOpenMenu: (menu: PlannerMenuId | 'more' | null) => void;
  /** Rechts: Speicherzustand und Prüf-Einstiege (Prüfsiegel, Hinweiszahl). */
  statusArea?: React.ReactNode;
}

function ToolButton({
  label,
  hint,
  icon: Icon,
  onClick,
  disabled,
  testId,
  active,
  className = '',
}: {
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      {...(testId ? { 'data-testid': testId } : {})}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={hint ? `${label} (${hint})` : label}
      title={hint ? `${label} (${hint})` : label}
      className={`cad-btn tool-btn ${active ? 'cad-btn--active' : ''} ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
    </button>
  );
}

function OverflowMenu({ groups, onClose }: { groups: PlannerMenuGroup[]; onClose: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [onClose]);

  return (
    <div ref={ref} className="cad-menu left-auto right-0" role="menu" aria-label="Weitere Aktionen">
      {groups.map((group, index) => (
        <React.Fragment key={group.label ?? `g${index}`}>
          {index > 0 && <div className="cad-menu__sep" role="separator" />}
          {group.label && <p className="cad-menu__label">{group.label}</p>}
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                {...(item.testId ? { 'data-testid': item.testId } : {})}
                disabled={item.disabled}
                onClick={() => {
                  item.run();
                  onClose();
                }}
                className={`cad-menu__item ${item.danger ? 'text-destructive' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.checked && (
                  <span className="cad-menu__check" aria-hidden="true">
                    ◆
                  </span>
                )}
                {item.hint && <span className="cad-menu__hint">{item.hint}</span>}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

export function PlannerToolbar({
  busy,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoWire,
  onTidy,
  onCheck,
  onBom,
  onExport,
  viewMode,
  onSelectViewMode,
  focusMode,
  onToggleFocusMode,
  overflow,
  openMenu,
  onOpenMenu,
  statusArea,
}: PlannerToolbarProps) {
  return (
    <div className="cad-toolbar" role="toolbar" aria-label="Werkzeuge" data-testid="planner-toolbar">
      <div className="cad-toolbar__group">
        <ToolButton
          label="Rückgängig"
          hint="Strg+Z"
          icon={Undo2}
          onClick={onUndo}
          disabled={!canUndo}
          testId="toolbar-undo"
          className="hidden md:inline-flex"
        />
        <ToolButton
          label="Wiederholen"
          hint="Strg+Y"
          icon={Redo2}
          onClick={onRedo}
          disabled={!canRedo}
          testId="toolbar-redo"
          className="hidden md:inline-flex"
        />
      </div>

      <span className="cad-toolbar__sep" aria-hidden="true" />

      <div className="cad-toolbar__group">
        <button
          type="button"
          data-testid="action-autowire"
          onClick={onAutoWire}
          disabled={busy !== null}
          className="cad-btn cad-btn--primary"
          data-tooltip="Verbindungen, Querschnitte und Sicherungen automatisch berechnen"
          title="Verbindungen, Querschnitte und Sicherungen automatisch berechnen"
        >
          {busy === 'wire' ? (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Wand2 className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden lg:inline">Automatisch verbinden</span>
          {/* Schmal: technisch kurz, aber deutsch — der Knopf ist die
              Hauptaktion, ein englischer Arbeitstitel wäre hier ein Fremdkörper. */}
          <span className="lg:hidden">Auto-verbinden</span>
        </button>

        <button
          type="button"
          data-testid="action-tidy"
          onClick={onTidy}
          disabled={busy !== null}
          className="cad-btn hidden lg:inline-flex"
          title="Plan automatisch anordnen (ELK, bei Ausfall Raster-Layout). Rückgängig ist möglich."
        >
          {busy === 'layoutV2' ? (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          )}
          <span>Plan ordnen</span>
        </button>
      </div>

      <span className="cad-toolbar__sep hidden md:block" aria-hidden="true" />

      <div className="cad-toolbar__group hidden md:flex">
        <ToolButton label="Plan prüfen" hint="Befunde und Empfehlungen" icon={ScanSearch} onClick={onCheck} />
        <ToolButton label="Stückliste" hint="Bauteile und Leitungen" icon={Package} onClick={onBom} />
        <ToolButton
          label="Plan als Bild exportieren"
          icon={busy === 'export' ? Loader2 : Camera}
          onClick={onExport}
        />
      </div>

      <span className="cad-toolbar__sep hidden md:block" aria-hidden="true" />

      <div className="cad-toolbar__group">
        <div className="hidden items-center gap-0.5 md:flex" role="tablist" aria-label="Planbereich wählen">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'electric'}
            aria-label="Elektrikplan anzeigen"
            title="Elektrikplan anzeigen"
            data-testid="viewmode-electric"
            onClick={() => onSelectViewMode('electric')}
            className={`cad-btn ${viewMode === 'electric' ? 'cad-btn--active' : ''}`}
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">Elektrik</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'water'}
            aria-label="Wasserplan anzeigen"
            title="Wasserplan anzeigen"
            data-testid="viewmode-water"
            onClick={() => onSelectViewMode('water')}
            className={`cad-btn ${viewMode === 'water' ? 'cad-btn--active' : ''}`}
          >
            <Droplets className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">Wasser</span>
          </button>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {statusArea}
        <ToolButton
          label={focusMode ? 'Fokusmodus verlassen' : 'Vollbild (Fokusmodus)'}
          icon={focusMode ? FileDown : Frame}
          onClick={onToggleFocusMode}
          active={focusMode}
          testId="action-focus-mode"
          className="hidden md:inline-flex"
        />
        <div className="relative">
          <button
            type="button"
            data-testid="action-more"
            aria-label="Weitere Aktionen"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'more'}
            onClick={() => onOpenMenu(openMenu === 'more' ? null : 'more')}
            className={`cad-btn tool-btn ${openMenu === 'more' ? 'cad-btn--active' : ''}`}
            data-tooltip="Weitere Aktionen"
            title="Weitere Aktionen"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
          {openMenu === 'more' && <OverflowMenu groups={overflow} onClose={() => onOpenMenu(null)} />}
        </div>
      </div>
    </div>
  );
}

/** Netz-/Querschnitts-Symbol für den Überlauf (bewusst funktional, kein Dekor). */
export { Network };
