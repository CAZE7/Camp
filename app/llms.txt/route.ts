import { PAGES } from '@/lib/seo/inventory';
import type { PageEntry } from '@/lib/seo/types';
import { siteUrl } from '@/lib/site';

/**
 * `/llms.txt` — Kurzübersicht der Seite für Sprachmodell-Agenten.
 *
 * Warum es die Datei gibt: Google braucht sie nicht (die eigene Anleitung sagt,
 * für AI Overviews und AI Mode sei weder neues Markup noch eine solche Datei
 * erforderlich), und ein Ranking-Signal ist sie nicht. Für die anderen
 * Engines zählt sie trotzdem: Sie liefert in einer Anfrage, was ein Agent
 * sonst aus mehreren Seiten zusammenklauben müsste, und die
 * Agent-Readiness-Prüfungen (Is Agentic, Frase) führen sie als Fundstelle.
 * Der Aufwand ist eine Route ohne Datenpflege.
 *
 * Warum sie erzeugt und nicht geschrieben wird: Eine handgepflegte Datei wäre
 * nach der nächsten neuen Seite falsch, und niemand merkt es — genau der
 * Fehler, den dieses Projekt bei Sitemap und Inventar schon einmal hatte. Die
 * Einträge kommen deshalb aus `lib/seo/inventory.ts`; Seiten, die im Inventar
 * fehlen, fehlen auch hier. `scripts/seo/auditExport.ts` prüft den gebauten
 * Export zusätzlich gegen das Inventar.
 *
 * Was NICHT in die Datei gehört: erfundene Zahlen, Werbeversprechen und
 * Suchbegriff-Wiederholungen. Ein Agent, der die Seite falsch beschreibt,
 * schadet mehr als eine fehlende Datei.
 */

export const dynamic = 'force-static';

/** Die Gruppen, in denen die Seiten erscheinen — nach Aufgabe, nicht nach URL. */
const GRUPPEN: ReadonlyArray<{ titel: string; kinds: ReadonlyArray<PageEntry['kind']> }> = [
  { titel: 'Planer und Werkzeuge', kinds: ['start', 'werkzeug', 'ansicht'] },
  { titel: 'Rechner', kinds: ['rechner'] },
  { titel: 'Wissen', kinds: ['pillar', 'cluster', 'ratgeber'] },
  { titel: 'Rechtliches', kinds: ['rechtliches'] },
];

/** Eine Zeile je Seite: Name, absolute Adresse, ein Satz Zweck. */
const zeile = (page: PageEntry): string => `- [${page.h1}](${siteUrl(page.path)}): ${page.description}`;

const abschnitt = (titel: string, seiten: readonly PageEntry[]): string =>
  seiten.length === 0 ? '' : `## ${titel}\n\n${seiten.map(zeile).join('\n')}\n`;

export function GET(): Response {
  const indexierbar = PAGES.filter((page) => page.indexability === 'index');
  const gruppen = GRUPPEN.map((gruppe) =>
    abschnitt(
      gruppe.titel,
      indexierbar.filter((page) => gruppe.kinds.includes(page.kind))
    )
  ).filter((text) => text !== '');

  const zeilen = [
    '# Elektroplaner',
    '',
    '> Kostenloses Planungswerkzeug für die Camper-Elektrik: 12-V-Leitungen dimensionieren, Batterie und Solar auslegen, Dach belegen und Heizlast berechnen — im Browser, ohne Konto.',
    '',
    'Elektroplaner ist eine deutschsprachige Web-Anwendung für den Ausbau von Wohnmobilen und Campingbussen. Die Planung läuft vollständig im Browser: Es gibt kein Konto, keine Anmeldung und keinen Server, auf dem Pläne liegen. Die Rechner arbeiten mit offengelegten Annahmen und nennen die Grenzen des Modells.',
    '',
    ...gruppen,
    '## Fakten zur Anwendung',
    '',
    '- Kostenlos, ohne Anmeldung, ohne Abo.',
    '- Pläne werden im `localStorage` des Browsers gespeichert und nicht übertragen.',
    '- Keine Cookies, keine Werbung, keine Reichweitenmessung.',
    '- Deutschsprachig; die Rechenwege und die zugrunde gelegten Normen stehen offen unter [Über Elektroplaner](' +
      siteUrl('/ueber-elektroplaner/') +
      ').',
    '- Keine Chat-Schnittstelle: Die Seite sendet keine Eingaben an ein Sprachmodell.',
    '',
    '## Über diese Datei',
    '',
    'Diese Datei wird beim Build aus dem Seiteninventar (`lib/seo/inventory.ts`) erzeugt und listet jede indexierbare Seite mit einem Satz. Sie ersetzt keinen Inhalt — die Seiten selbst sind ohne JavaScript vollständig lesbar.',
    '',
  ];

  return new Response(zeilen.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
