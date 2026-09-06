import { cn } from '@/lib/utils';

/**
 * D-8: Skeleton-Platzhalter für wartende Inhalte (z. B. dynamischer
 * Canvas-Import). Reine Präsentation: flache Fläche auf Panel-Ton,
 * dezentes Pulsieren — `prefers-reduced-motion` lässt ihn statisch
 * (siehe .skeleton-Regel im reduced-motion-Block von globals.css).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton', className)} />;
}

/** Galeriemuster: Canvas-Platzhalter mit Raster-Andeutung. */
export function CanvasSkeleton() {
  return (
    <div role="status" aria-label="Planer wird geladen" className="flex h-full w-full flex-col gap-3 p-4">
      <Skeleton className="h-8 w-64" />
      <div className="relative flex-1 border border-rule bg-surface-canvas">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(var(--canvas-grid) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            opacity: 0.35,
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Skeleton className="h-24 w-48" />
          <Skeleton className="h-24 w-48" />
        </div>
      </div>
      <Skeleton className="h-6 w-72" />
    </div>
  );
}
