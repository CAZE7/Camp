import Link from 'next/link';

import { AUTHOR_PROFILE_PATH, authorByline } from '@/lib/author';

/**
 * Autorenzeile am Fuß einer Inhaltsseite.
 *
 * Warum eine eigene Komponente: Die Zeile stand zuerst im Transparenzblock.
 * Der rendert aber nur, wenn eine Seite Quellen, Annahmen oder Grenzen hat —
 * bei allen anderen Seiten wäre die Urheberschaft unsichtbar geblieben, obwohl
 * sie im JSON-LD stand. Eine Angabe, die nur im Maschinenformat existiert,
 * hilft dem Leser nicht.
 *
 * Der Stand (`contentRevision`) bleibt bewusst daneben: Beides beantwortet die
 * Frage „wie aktuell und von wem ist das hier?“.
 */
export function AuthorNote({ contentRevision }: { contentRevision?: string }) {
  return (
    <p className="caption-xs mt-4 text-ink-soft">
      {authorByline()} · <Link href={AUTHOR_PROFILE_PATH}>Wer schreibt hier</Link>
      {contentRevision ? `. Inhaltlicher Stand: ${contentRevision}` : ''}. Keine fachliche Prüfung durch
      Dritte — Rechenwege, Quellen und Grenzen stehen offen, siehe{' '}
      <Link href="/ueber-elektroplaner/">Über Elektroplaner</Link>.
    </p>
  );
}
