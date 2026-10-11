'use client';

import React from 'react';
import {
  Camera,
  Frame,
  LayoutGrid,
  Loader2,
  Minimize2,
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
import { handleMenuKeyDown } from './menuKeyboard';

/**
 * Werkzeugleiste: die primären Aktionen des Planers, dauerhaft sichtbar.
 *
 * Im Expertenmodus folgt die Reihenfolge der Arbeitsfolge (Bauen → Verdrahten →
 * Ordnen → Prüfen → Ausgeben), Trenner gruppieren die Aktionen. Im geführten
 * Modus zeigt nur die Schrittleiste die nächste Primäraktion; die Werkzeugleiste
 * bleibt auf Verlauf, Ansichtswechsel und Prüfstatus reduziert. Der Akzent bleibt
 * semantisch: Farbe steht für Fehler/Warnung/OK/Auswahl, nicht für Dekor.
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
  guidedMode: boolean;
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
  visibleLabel,
  showLabel = false,
  className = '',
}: {
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  active?: boolean;
  visibleLabel?: string;
  showLabel?: boolean;
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
      className={`cad-btn tool-btn ${active ? 'cad-btn--active' : ''} ${showLabel ? 'tool-btn--labeled' : ''} ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {showLabel && <span className="tool-btn__label">{visibleLabel ?? label}</span>}
    </button>
  );
}

function OverflowMenu({
  groups,
  onClose,
}: {
  groups: PlannerMenuGroup[];
  onClose: (restoreFocus?: boolean) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const onPointerDown = (event: MouseEvent) => {
      const menuRegion = ref.current?.parentElement;
      if (menuRegion && !menuRegion.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="cad-menu left-auto right-0"
      role="menu"
      aria-label="Weitere Aktionen"
      onKeyDown={(event) => handleMenuKeyDown(event, onClose)}
    >
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
                  onClose(true);
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
  guidedMode,
  onToggleFocusMode,
  overflow,
  openMenu,
  onOpenMenu,
  statusArea,
}: PlannerToolbarProps) {
  const moreButtonRef = React.useRef<HTMLButtonElement>(null);
  const closeMore = React.useCallback(
    (restoreFocus = false) => {
      onOpenMenu(null);
      if (restoreFocus) moreButtonRef.current?.focus();
    },
    [onOpenMenu]
  );

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
          className="cad-toolbar__desktop-tool hidden md:inline-flex"
        />
        <ToolButton
          label="Wiederholen"
          hint="Strg+Y"
          icon={Redo2}
          onClick={onRedo}
          disabled={!canRedo}
          testId="toolbar-redo"
          className="cad-toolbar__desktop-tool hidden md:inline-flex"
        />
      </div>

      {!guidedMode && (
        <>
          <span className="cad-toolbar__sep cad-toolbar__desktop-sep" aria-hidden="true" />

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
              className="cad-btn cad-toolbar__desktop-tidy"
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

          <span className="cad-toolbar__sep cad-toolbar__desktop-sep" aria-hidden="true" />

          <div className="cad-toolbar__group cad-toolbar__desktop-group">
            <ToolButton
              label="Plan prüfen"
              visibleLabel="Prüfen"
              showLabel
              hint="Befunde und Empfehlungen"
              icon={ScanSearch}
              onClick={onCheck}
            />
            <ToolButton
              label="Stückliste"
              visibleLabel="Stückliste"
              showLabel
              hint="Bauteile und Leitungen"
              icon={Package}
              onClick={onBom}
            />
            <ToolButton
              label="Plan als Bild exportieren"
              visibleLabel="Export"
              showLabel
              icon={busy === 'export' ? Loader2 : Camera}
              onClick={onExport}
            />
          </div>

          <span className="cad-toolbar__sep cad-toolbar__desktop-sep" aria-hidden="true" />
        </>
      )}

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
          icon={focusMode ? Minimize2 : Frame}
          onClick={onToggleFocusMode}
          active={focusMode}
          testId="action-focus-mode"
          className="cad-toolbar__desktop-tool hidden md:inline-flex"
        />
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeMore();
          }}
        >
          <button
            ref={moreButtonRef}
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
          {openMenu === 'more' && <OverflowMenu groups={overflow} onClose={closeMore} />}
        </div>
      </div>
    </div>
  );
}

/** Netz-/Querschnitts-Symbol für den Überlauf (bewusst funktional, kein Dekor). */
export { Network };
