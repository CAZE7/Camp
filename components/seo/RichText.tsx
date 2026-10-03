import Link from 'next/link';

/**
 * components/seo/RichText.tsx — Fließtext mit internen Verweisen.
 *
 * Die Inhalte in `lib/seo/content/` sind reine Zeichenketten (kein JSX, damit
 * die Datenschicht ohne React auskommt). Interne Verweise stehen darin in der
 * Schreibweise `[Anzeigetext](/ziel/)` — derselbe Text bleibt damit lesbar,
 * prüfbar und für die Inventarisierung auswertbar.
 *
 * Bewusst eng: Nur Ziele, die mit `/` beginnen, werden zu Verweisen. Ein
 * externer Link würde hier als Text erscheinen — die Inhalte enthalten keine,
 * und ein Link, der aussieht wie Markup, aber nicht funktioniert, wäre
 * schlimmer als einer, der sichtbar Text bleibt.
 */

export type RichTextSegment = { kind: 'text'; value: string } | { kind: 'link'; value: string; href: string };

const LINK_PATTERN = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

/** Zerlegt einen Text in Abschnitte und interne Verweise (rein, testbar). */
export function richTextSegments(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ kind: 'text', value: text.slice(cursor, index) });
    segments.push({ kind: 'link', value: match[1] ?? '', href: match[2] ?? '/' });
    cursor = index + match[0].length;
  }

  if (cursor < text.length) segments.push({ kind: 'text', value: text.slice(cursor) });
  return segments.length > 0 ? segments : [{ kind: 'text', value: text }];
}

/**
 * Rendert einen Text. Der Verweis erhält einen beschreibenden Ankertext aus
 * dem Inhalt (nie „hier klicken") — die Unterstreichung bleibt sichtbar, weil
 * sie im Fließtext das einzige Merkmal für einen Link ist.
 */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {richTextSegments(text).map((segment, index) =>
        segment.kind === 'link' ? (
          <Link
            key={`${segment.href}-${index}`}
            href={segment.href}
            className="underline underline-offset-2 hover:text-ink"
          >
            {segment.value}
          </Link>
        ) : (
          <span key={`text-${index}`}>{segment.value}</span>
        )
      )}
    </>
  );
}
