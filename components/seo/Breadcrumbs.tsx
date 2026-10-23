import Link from 'next/link';

import { cn } from '@/lib/utils';

import { topicTrail } from '@/lib/seo/topics';

/**
 * components/seo/Breadcrumbs.tsx — sichtbare Brotkrumenspur.
 *
 * Sie kommt aus dem Themenbaum (`lib/seo/topics.ts`) und nicht aus einem
 * zweiten Verzeichnis: Wer die Seite `lifepo4` unter `batterie` einordnet,
 * bekommt die Spur „Startseite → Camper-Elektrik → Batterie → LiFePO4" ohne
 * weitere Pflege. Die strukturierte Beschreibung benutzt dieselbe Liste
 * (`breadcrumbNode`), damit Anzeige und Markup nicht auseinanderlaufen können.
 *
 * Die letzte Station ist die aktuelle Seite: Sie wird als Text mit
 * `aria-current="page"` ausgegeben, nicht als Verweis auf sich selbst.
 */

export type Crumb = { name: string; path: string };

/**
 * Themenweg mit Seiten. Themen ohne eigene Seite (etwa „Ausbau") werden
 * ausgelassen — eine Brotkrume ohne Ziel wäre ein toter Verweis.
 */
export function topicTrailWithPaths(topicId: string): Crumb[] {
  return topicTrail(topicId)
    .filter((topic) => typeof topic.path === 'string')
    .map((topic) => ({ name: topic.label, path: topic.path as string }));
}

/**
 * Baut die Spur einer Seite: Themenweg, danach die Seite selbst (falls sie
 * nicht schon die letzte Station ist). Die Startseite steht immer am Anfang.
 */
export function breadcrumbsFor(page: { path: string; h1: string; topicId: string }): Crumb[] {
  const items: Crumb[] = topicTrailWithPaths(page.topicId);

  if (items.length === 0 || items[items.length - 1]!.path !== page.path) {
    items.push({ name: page.h1, path: page.path });
  }
  if (items[0]?.path !== '/') items.unshift({ name: 'Startseite', path: '/' });

  // Doppelte Stationen (Thema und Seite mit gleichem Pfad) fallen zusammen.
  return items.filter((item, index) => items.findIndex((other) => other.path === item.path) === index);
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Pfad">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li
              key={item.path}
              // Mobil bleibt nur die letzte Ebene stehen („← Solar" statt drei
              // umbrechender Zeilen) — Designkonzept 2026-10, Navigation.
              className={cn('flex items-center gap-2', !isCurrent && 'hidden sm:flex')}
            >
              {index > 0 && !isCurrent && (
                <span aria-hidden="true" className="hidden sm:inline">
                  /
                </span>
              )}
              {isCurrent && items.length > 1 && (
                <Link
                  href={items[items.length - 2]!.path}
                  aria-label={`Zurück zu ${items[items.length - 2]!.name}`}
                  className="text-ink-soft hover:text-ink sm:hidden"
                >
                  ←
                </Link>
              )}
              {isCurrent ? (
                <span aria-current="page" className="text-ink">
                  {item.name}
                </span>
              ) : (
                <Link href={item.path} className="underline-offset-2 hover:text-ink hover:underline">
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
