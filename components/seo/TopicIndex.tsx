import Link from 'next/link';

import { pagesOfTopicChildren } from '@/lib/seo/inventory';
import { childTopics, topicOf } from '@/lib/seo/topics';

/**
 * components/seo/TopicIndex.tsx — das Verzeichnis der Unterthemen.
 *
 * Es liest die Seiten aus dem Inventar und die Kurzbeschreibungen aus dem
 * Themenbaum. Damit ist die Pillar→Cluster-Verlinkung keine Fleißarbeit, die
 * beim nächsten neuen Thema vergessen wird: Ein neues Thema mit Seite
 * erscheint hier automatisch — und die Prüfung „Pillar verlinkt Cluster"
 * hat immer etwas zu prüfen.
 */
export function TopicIndex({ topicId }: { topicId: string }) {
  const pages = pagesOfTopicChildren(topicId);
  const groups = [
    { id: topicId, heading: topicOf(topicId).label, entries: pages },
    ...childTopics(topicId)
      .map((child) => ({ id: child.id, heading: child.label, entries: pagesOfTopicChildren(child.id) }))
      .filter((group) => group.entries.length > 0),
  ].filter((group) => group.entries.length > 0);

  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="themen-titel" className="scroll-mt-20">
      <h2 id="themen-titel" className="font-display text-xl font-semibold text-ink">
        Alle Themen dieser Übersicht
      </h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.id}>
            <h3 className="panel-title">{group.heading}</h3>
            <ul className="mt-2 divide-y divide-rule border border-rule bg-bone">
              {group.entries.map((page) => (
                <li key={page.path}>
                  <Link
                    href={page.path}
                    className="flex min-h-11 flex-col justify-center px-4 py-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-oxide"
                  >
                    <span className="font-medium text-ink">{page.h1}</span>
                    <span className="caption-xs mt-0.5 text-ink-soft">{topicOf(page.topicId).summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
