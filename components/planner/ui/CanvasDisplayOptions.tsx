import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaCapabilities';
import { DOMAINS, DOMAIN_COLORS, DOMAIN_LABELS, type Domain } from '../utils/domainFilter';

/** The canvas gets narrow before the page reaches Tailwind's xl breakpoint. */
const COMPACT_CANVAS_CONTROLS_QUERY = '(max-width: 1279px)';

type CanvasDisplayOptionsProps = {
  activeDomains: Set<Domain>;
  onToggleDomain: (domain: Domain) => void;
  trunkMode: boolean;
  onToggleTrunkMode: () => void;
  backboneGrouping: boolean;
  onToggleBackboneGrouping: () => void;
};

type ToggleButtonProps = {
  pressed: boolean;
  onClick: () => void;
  children: string;
  activeClassName: string;
  title?: string;
  style?: CSSProperties;
};

function ToggleButton({ pressed, onClick, children, activeClassName, title, style }: ToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      title={title}
      style={style}
      className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        pressed ? activeClassName : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
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
  compact = false,
}: CanvasDisplayOptionsProps & { compact?: boolean }) {
  const layoutClass = compact ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-1.5';

  return (
    <div className={layoutClass} role="group" aria-label="Anzeige und Filter">
      {DOMAINS.map((domain) => {
        const active = activeDomains.has(domain);
        return (
          <ToggleButton
            key={domain}
            pressed={active}
            onClick={() => onToggleDomain(domain)}
            activeClassName="text-on-signal"
            style={active ? { backgroundColor: DOMAIN_COLORS[domain] } : undefined}
          >
            {DOMAIN_LABELS[domain]}
          </ToggleButton>
        );
      })}
      <ToggleButton
        pressed={trunkMode}
        onClick={onToggleTrunkMode}
        title="Hauptrouten (Batterie → Sicherungskasten → Verteilung) hervorheben"
        activeClassName="bg-ink text-bone"
      >
        Trassen
      </ToggleButton>
      <ToggleButton
        pressed={backboneGrouping}
        onClick={onToggleBackboneGrouping}
        title="Rahmen und Label für den Hauptstromkreis ein- oder ausblenden"
        activeClassName="bg-copper text-bone"
      >
        Hauptstromkreis
      </ToggleButton>
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
  const compact = useMediaQuery(COMPACT_CANVAS_CONTROLS_QUERY);
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!compact) setOpen(false);
  }, [compact]);

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
      <div className="bg-card/95 rounded-lg border border-border p-1.5 shadow-sm">
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
        className="bg-card/95 flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Ansicht
      </button>

      {open && (
        <div
          id="canvas-display-options-panel"
          role="group"
          aria-label="Anzeige und Filter"
          className="absolute right-0 top-full z-[70] mt-2 w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-border bg-card p-3 shadow-2xl"
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
