import { Breadcrumbs, type Crumb } from '@/components/seo/Breadcrumbs';

import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { cn } from '@/lib/utils';

/**
 * components/brand/PageShell.tsx — die eine Seitenbasis (Designkonzept 2026-10).
 *
 * Vorher baute jede Seite ihr Gerüst selbst: `min-h-screen flex flex-col`,
 * eigener Kopf, eigener Fuß, eigene Breite. Die Folgen standen im Audit:
 * Seiten ohne Fuß (z. B. `/ki-assistent`), Seiten mit leerem Band unter dem
 * Inhalt (Impressum), Seiten mit anderer Lesekante.
 *
 * Hier stehen die drei Varianten aus dem Konzept:
 *  - `article` — Text und Wissen: Kopf, Brotkrumen, Lesespalte, Fuß.
 *  - `tool`    — Rechner und Werkzeuge: dieselbe Basis, aber volle Breite
 *                für die Werkfläche; der erklärende Text bleibt darunter.
 *  - `app`     — der Planer: eigene App-Shell ohne Website-Kopf und -Fuß,
 *                aber mit derselben Höhenlogik (`h-dvh`, ein Scrollbereich).
 *
 * Höhe: `min-h-dvh` statt `min-h-screen` (die Browserleisten des Handys
 * zählen mit), `flex-1` für den Inhalt, Fuß immer am unteren Rand. Kurze
 * Seiten (404, Impressum) legen ihren Inhalt vertikal mittig statt ein leeres
 * Band unter den Text zu setzen.
 */
export type PageShellVariant = 'article' | 'tool' | 'app';

export interface PageShellProps {
  variant?: PageShellVariant;
  /** Brotkrumen unter dem Kopf — auf jeder Seite, mobil nur die letzte Ebene. */
  breadcrumbs?: readonly Crumb[];
  /** Kurze Seiten mittig stellen, statt Leere unter den Text zu legen. */
  center?: boolean;
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
  /** Feste Leiste unter dem Inhalt (z. B. Schnellnavigation auf dem Handy). */
  bottomNav?: React.ReactNode;
}

export function PageShell({
  variant = 'article',
  breadcrumbs,
  center = false,
  children,
  className,
  mainClassName,
  bottomNav,
}: PageShellProps) {
  if (variant === 'app') {
    // Der Planer bringt seine eigene Menü-/Werkzeug-/Statusleiste mit.
    return (
      <div className={cn('flex h-dvh flex-col overflow-hidden bg-paper text-ink', className)}>{children}</div>
    );
  }

  return (
    <div className={cn('flex min-h-dvh flex-col bg-paper text-ink', className)}>
      <SiteHeader />
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="border-b border-rule bg-surface-panel">
          <div className="mx-auto w-full max-w-5xl px-5 py-2">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>
      )}
      <main
        id="main"
        className={cn(
          'flex-1',
          variant === 'tool' ? 'flex flex-col' : undefined,
          center ? 'flex flex-col justify-center' : undefined,
          mainClassName
        )}
      >
        {children}
      </main>
      <SiteFooter />
      {bottomNav}
    </div>
  );
}
