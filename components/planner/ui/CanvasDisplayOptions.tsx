import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaCapabilities';
import { usePlannerStore } from '../../../store/usePlannerStore';
import type { PlannerDetailLevel } from '../../../store/slices/types';
import { DOMAINS, DOMAIN_COLORS, DOMAIN_LABELS, type Domain } from '../utils/domainFilter';

/** The canvas gets narrow before the page reaches Tailwind's xl breakpoint. */
const COMPACT_CANVAS_CONTROLS_QUERY = '(max-width: 1279px)';
/** Ab hier dockt der Inspector an und entzieht dem Canvas 288–320 px —
 *  die Chip-Reihe hätte dann trotz breitem Fenster keinen Platz mehr. */
const INSPECTOR_DOCK_QUERY = '(min-width: 1280px)';

type CanvasDisplayOptionsProps = {
  activeDomains: Set<Domain>;
  onToggleDomain: (domain: Domain) => void;
  trunkMode: boolean;
  onToggleTrunkMode: () => void;
  backboneGrouping: boolean;
  onToggleBackboneGrouping: () => void;
  /** Detailgrad der Bauteilkarten (`overview` = Symbol + Name). */
  detailLevel: PlannerDetailLevel;
  onSelectDetailLevel: (level: PlannerDetailLevel) => void;
};

const DETAIL_OPTIONS: { level: PlannerDetailLevel; label: string; title: string }[] = [
  { level: 'overview', label: 'Übersichtlich', title: 'Nur Symbol und Name — für große Pläne' },
  { level: 'detail', label: 'Mit Werten', title: 'Volle Karte mit Messwerten' },
];

type ToggleButtonProps = {
  pressed: boolean;
  onClick: () => void;
  children: string;
  /** Leitungs-/Akzentfarbe des Chips als CSS-Ton (Token-Variable). */
  tint: string;
  title?: string;
};

/**
 * Filter-Chip im Werft-Stil: flache Panel-Fläche, Status über getönte
 * Fläche + Rand in Leitungsfarbe — nicht über gesättigte Volltonflächen
 * (die dominierten das Canvas und standen im Widerspruch zur Text-Regel
 * „ein Akzent, Ruhe zuerst“). Die Volltonfarbe bleibt als Punkt erhalten.
 */
function ToggleButton({ pressed, onClick, children, tint, title }: ToggleButtonProps) {
  const style: CSSProperties = pressed
    ? {
        backgroundColor: `color-mix(in srgb, ${tint} 14%, var(--surface-panel))`,
        borderColor: tint,
        color: 'var(--text-high)',
      }
    : { borderColor: 'var(--rule)', color: 'var(--text-med)' };
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      title={title}
      style={style}
      className="flex min-h-11 items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tint }} />
      {children}
    </button>
  );
}

function DisplayToggles({
  activeDomains,
  onToggleDomain,
  trunkMode,
  onToggleTrunkMode,
  backboneGrouping,
  onToggleBackboneGrouping,
  detailLevel,
  onSelectDetailLevel,
  compact = false,
}: CanvasDisplayOptionsProps & { compact?: boolean }) {
  const layoutClass = compact ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-1.5';

  // Im Popover trägt bereits das Panel (id="canvas-display-options-panel")
  // Rolle und Namen — eine zweite benannte Gruppe darin wäre ein duplizierter
  // Accessibility-Name (strict-mode-Verstoß im E2E). Kompakt bleibt die
  // Chips-Gruppe daher ohne eigenes Label.
  return (
    <div className={layoutClass} {...(compact ? {} : { role: 'group', 'aria-label': 'Anzeige und Filter' })}>
      {DOMAINS.map((domain) => (
        <ToggleButton
          key={domain}
          pressed={activeDomains.has(domain)}
          onClick={() => onToggleDomain(domain)}
          tint={DOMAIN_COLORS[domain]}
          title={`Domäne ${DOMAIN_LABELS[domain]} ein- oder ausblenden`}
        >
          {DOMAIN_LABELS[domain]}
        </ToggleButton>
      ))}
      <ToggleButton
        pressed={trunkMode}
        onClick={onToggleTrunkMode}
        tint="var(--wire-ac)"
        title="Hauptrouten (Batterie → Sicherungskasten → Verteilung) hervorheben"
      >
        Trassen
      </ToggleButton>
      <ToggleButton
        pressed={backboneGrouping}
        onClick={onToggleBackboneGrouping}
        tint="var(--oxide)"
        title="Rahmen und Label für den Hauptstromkreis ein- oder ausblenden"
      >
        Hauptstromkreis
      </ToggleButton>

      {/* Detailgrad (UX-Reset 2026-09 / RECHERCHE C1): Bei 30–50 Bauteilen ist
          die volle Karte das größte Lesbarkeitsproblem. Der Schalter ist
          bewusst NUTZERGESTEUERT — M8-1 hat zoom-automatische Stufen entfernt,
          weil beim Zoomen umschlagende Karten desorientieren. */}
      <div
        role="group"
        aria-label="Detailgrad der Bauteile"
        className={compact ? 'col-span-2 flex gap-2' : 'flex w-full gap-1.5'}
      >
        {DETAIL_OPTIONS.map((option) => (
          <button
            key={option.level}
            type="button"
            data-testid={`detail-level-${option.level}`}
            aria-pressed={detailLevel === option.level}
            onClick={() => onSelectDetailLevel(option.level)}
            title={option.title}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded border border-rule px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-ink"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Keeps five persistent display toggles out of the way on a phone or a narrow
 * tablet canvas. The former always-visible chip row covered the canvas hint at
 * 768 px and offered 28 px targets. A labelled 44 px trigger now opens the
 * same controls as an intentional, thumb-friendly popover.
 */
export function CanvasDisplayOptions(props: CanvasDisplayOptionsProps) {
  const compactViewport = useMediaQuery(COMPACT_CANVAS_CONTROLS_QUERY);
  const inspectorDocked = usePlannerStore((state) => state.isInspectorOpen);
  const dockBreakpoint = useMediaQuery(INSPECTOR_DOCK_QUERY);
  /**
   * UX-Reset 2026-09: Domänen-Filter, Trassen und Hauptstromkreis sind
   * Expertenwerkzeuge. Im geführten Modus liegen sie deshalb hinter dem
   * „Ansicht"-Auslöser statt als dauerhafte Chip-Reihe auf dem Plan —
   * dieselben Schalter, ein bewusster Klick. Im Expertenmodus bleibt die
   * Chip-Reihe auf breitem Canvas direkt erreichbar.
   */
  const guidedMode = usePlannerStore((state) => state.guidedMode);
  const compact = compactViewport || (dockBreakpoint && inspectorDocked) || guidedMode;
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // AUDIT T1 (react-hooks/set-state-in-effect): „Kein Kompakt-Modus -> kein
  // Popover“ zur Render-Zeit statt in einem zweiten Commit.
  const [syncedCompact, setSyncedCompact] = useState(compact);
  if (syncedCompact !== compact) {
    setSyncedCompact(compact);
    if (!compact) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (!compact) {
    return (
      <div className="rounded border border-border bg-surface-panel/95 p-1.5 shadow-sm">
        <DisplayToggles {...props} />
      </div>
    );
  }

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        data-testid="canvas-display-options"
        aria-expanded={open}
        aria-controls="canvas-display-options-panel"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Ansicht
      </button>

      {open && (
        <div
          id="canvas-display-options-panel"
          role="group"
          aria-label="Anzeige und Filter"
          className="absolute right-0 top-full z-[70] mt-2 w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-border bg-card p-3 shadow-2xl"
        >
          <div className="mb-2 flex min-h-11 items-center justify-between gap-3 border-b border-border pb-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Planansicht</p>
              <p className="text-xs text-muted-foreground">Filter und Hervorhebungen</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ansichtsoptionen schließen"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <DisplayToggles {...props} compact />
        </div>
      )}
    </div>
  );
}
