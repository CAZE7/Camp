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
  LayoutTemplate,
  Share2,
  ChevronDown,
} from 'lucide-react';
import type { PlannerBusy, PlannerMenuGroup } from '../hooks/usePlannerActions';
import type { PlannerMenuId } from '../hooks/usePlannerActions';
import { handleMenuKeyDown } from './menuKeyboard';
import { PLANNER_TEMPLATES } from '../templates';

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
  /** Kopiert den teilbaren Plan-Link in die Zwischenablage. */
  onShare?: () => void;
  /** Lädt eine Vorlage aus `PLANNER_TEMPLATES`. */
  onLoadTemplate?: (templateId: string) => void;
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
  /** Unter 768 px: der Menü-Knopf am Anfang derselben Zeile. */
  leading?: React.ReactNode;
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
      /* `planner-toolbar-sheet`: Auf dem Handy hängt die Liste nicht mehr an
         ihrem Auslöser (sie würde bei 320 px rechts aus dem Bild laufen),
         sondern liegt als Blatt über der Fußleiste — vollständig im Bild.
         Ab 768 px bleibt sie das gewohnte Dropdown unter dem Knopf. */
      className="cad-menu planner-toolbar-sheet left-auto right-0"
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
                <span className="min-w-0 flex-1 whitespace-normal text-left">{item.label}</span>
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

/**
 * Auffälliger Einstieg „Vorlage laden“ — auch im geführten Modus sichtbar,
 * weil eine volle Zeichenfläche der schnellste Weg aus der Ratlosigkeit
 * einer leeren ist. Die Einträge kommen aus `PLANNER_TEMPLATES` (dieselbe
 * Liste wie Onboarding und Deep-Links).
 */
function TemplateMenuButton({ onLoadTemplate }: { onLoadTemplate: (templateId: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        data-testid="action-templates"
        aria-label="Vorlage laden"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="cad-btn cad-btn--primary"
        data-tooltip="Fertiges Setup laden und anpassen"
        title="Fertiges Setup laden und anpassen"
      >
        <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
        <span className="tb-label tb-label--kurz">Vorlage</span>
        <span className="tb-label tb-label--mittel">Vorlage laden</span>
        <ChevronDown className="cad-template-chevron h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div className="cad-menu left-0 right-auto" role="menu" aria-label="Vorlage laden">
          <p className="cad-menu__label">Fertiges Setup als Startpunkt</p>
          {PLANNER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              role="menuitem"
              data-testid={`toolbar-template-${template.id}`}
              onClick={() => {
                onLoadTemplate(template.id);
                setOpen(false);
                buttonRef.current?.focus();
              }}
              className="cad-menu__item"
            >
              <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{template.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AutoWireButton({
  busy,
  viewMode,
  onAutoWire,
  className = '',
}: {
  busy: PlannerBusy;
  viewMode: 'electric' | 'water';
  onAutoWire: () => void;
  className?: string;
}) {
  const water = viewMode === 'water';
  return (
    <button
      type="button"
      data-testid="action-autowire"
      onClick={onAutoWire}
      disabled={busy !== null}
      aria-label={
        water ? 'Auto-verbinden: nur im Elektrikplan verfügbar' : 'Auto-verbinden: Vorschlag prüfen'
      }
      className={`cad-btn cad-btn--primary min-h-11 shrink-0 whitespace-nowrap ${className}`}
      data-tooltip={
        water
          ? 'Nur im Elektrikplan — Wasserleitungen verbindest du von Hand'
          : 'Vorschlag berechnen, prüfen und erst nach Bestätigung übernehmen'
      }
      title={
        water
          ? 'Nur im Elektrikplan — Wasserleitungen verbindest du von Hand'
          : 'Vorschlag berechnen, prüfen und erst nach Bestätigung übernehmen'
      }
    >
      {busy === 'wire' ? (
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <Wand2 className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="tb-label tb-label--kurz">Vorschau</span>
      <span className="tb-label tb-label--mittel">Vorschlag prüfen</span>
      <span className="tb-label tb-label--lang">Automatisch verbinden · Vorschau</span>
    </button>
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
  onShare,
  onLoadTemplate,
  viewMode,
  onSelectViewMode,
  focusMode,
  guidedMode,
  onToggleFocusMode,
  overflow,
  openMenu,
  onOpenMenu,
  statusArea,
  leading,
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
      {/*
        Zwei Zonen statt einer Scroll-Fläche (M12):
        `__actions` darf waagerecht durchlaufen, `__status` wird nie
        weggescrollt. Vorher lagen Verlauf, Ausgabe und Statuschips im selben
        Scrollbereich: Bei 320 px war der Inhalt 356 px breit, das `⋯`-Menü
        stand unsichtbar rechts außerhalb — sekundäre Aktionen waren damit
        unerreichbar, und die Leiste scrollte zusätzlich senkrecht (60 px Inhalt
        in 44 px Höhe), sodass Knöpfe abgeschnitten wirkten.
      */}
      <div className="cad-toolbar__actions">
        {leading}
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

        {/* Vorlagen und Teilen stehen auch im geführten Modus: Sie sind der
          Einstieg (volle Fläche statt leerer) und der Ausgang (Plan ins Forum)
          — keine Experten-Aktionen, die man verstecken müsste. */}
        {(onLoadTemplate || onShare || guidedMode) && (
          <>
            <span className="cad-toolbar__sep" aria-hidden="true" />
            <div className="cad-toolbar__group">
              {onLoadTemplate && <TemplateMenuButton onLoadTemplate={onLoadTemplate} />}
              {guidedMode && (
                <AutoWireButton
                  busy={busy}
                  viewMode={viewMode}
                  onAutoWire={onAutoWire}
                  className="cad-autowire-phone"
                />
              )}
              {onShare && (
                <ToolButton
                  label="Link zum Plan kopieren"
                  visibleLabel="Teilen"
                  showLabel
                  hint="Plan als Link weitergeben (ohne Konto)"
                  icon={Share2}
                  onClick={onShare}
                  testId="action-share"
                />
              )}
            </div>
          </>
        )}

        {!guidedMode && (
          <>
            <span className="cad-toolbar__sep cad-toolbar__desktop-sep" aria-hidden="true" />

            <div className="cad-toolbar__group">
              <AutoWireButton busy={busy} viewMode={viewMode} onAutoWire={onAutoWire} />

              <button
                type="button"
                data-testid="action-tidy"
                onClick={onTidy}
                disabled={busy !== null}
                className="cad-btn cad-toolbar__desktop-tidy"
                title="Plan ordnen: Bauteile automatisch übersichtlich anordnen. Rückgängig ist möglich."
              >
                {busy === 'layoutV2' ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                )}
                <span>Plan automatisch ordnen</span>
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
            {/* Symbole plus Beschriftung ab 1536 px: Die Wörter kosten
                zusammen 103 px. Gemessen bei 1920 px lief die Leiste damit
                20 px über, *solange* gleichzeitig die langen Statuszusätze
                sichtbar waren — deshalb erscheinen die Zusätze erst ab
                1980 px (§7a) und die Beschriftung bleibt im DOM, wie der
                Komponententest (`getByText('Elektrik')`) sie verlangt. */}
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
              <span className="hidden 2xl:inline">Elektrik</span>
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
              <span className="hidden 2xl:inline">Wasser</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rechts festgenagelt: Status und der Zugang zu allen sekundären
          Aktionen. Dieses Feld kennt kein `overflow-x` — es bleibt sichtbar. */}
      <div className="cad-toolbar__status" data-testid="planner-toolbar-status">
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
            className={`cad-btn tool-btn min-h-11 min-w-11 shrink-0 justify-center ${openMenu === 'more' ? 'cad-btn--active' : ''}`}
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
