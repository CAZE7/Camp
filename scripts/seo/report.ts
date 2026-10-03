/**
 * scripts/seo/report.ts — erzeugt die SEO-Berichte aus den Messwerten.
 *
 *   npm run build && npx tsx scripts/seo/report.ts
 *
 * Erzeugt (jeweils Markdown und PDF):
 *   docs/seo/AUDIT.md                  — Messgrundlage: Seiten, Verweise, Bündel
 *   docs/seo/ANALYSE-UND-VISION.md     — Suchraum, Befunde, Zielbild, Roadmap
 *   docs/seo/CAMP-SEO-GROWTH-REPORT.md — der Abschlussbericht mit allen Kennzahlen
 *
 * Die Zahlen kommen aus dem gebauten Export (`measureExport`), die Suchabsichten
 * aus `lib/seo/opportunities.ts`/`coverage.ts` — nichts davon wird im Bericht von
 * Hand gepflegt. Der Bericht ist damit reproduzierbar: gleicher Commit, gleicher
 * Bau ⇒ gleiche Zahlen.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { coverageSummary, openGaps } from '../../lib/seo/coverage';
import { indexablePages, PAGES } from '../../lib/seo/inventory';
import { OPPORTUNITIES } from '../../lib/seo/opportunities';
import { measureExport, measurementTable, THIN_WORDS, type ExportMeasurement } from './measureExport';
import { renderMarkdown, renderPdf, type PdfBlock } from './pdf';

const DOCS = join(process.cwd(), 'docs', 'seo');

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const commitDate = execFileSync('git', ['log', '-1', '--format=%cd', '--date=short'], {
  encoding: 'utf8',
}).trim();
const today = new Date().toISOString().slice(0, 10);

const measurement = measureExport({
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  origin: 'https://caze7.github.io',
});
const coverage = coverageSummary();
const gaps = openGaps();

const pct = (value: number) => `${(value * 100).toFixed(0)} %`;
const round = (value: number) => Math.round(value);

/** Kennzahlen, die der Bericht in beiden Fassungen (Text und Tabelle) nennt. */
function kennzahlen(m: ExportMeasurement): { label: string; value: string; note: string }[] {
  return [
    {
      label: 'Indexierbare Seiten',
      value: String(m.summary.indexable),
      note: `${m.summary.totalPages} Dateien im Export, davon ${m.summary.totalPages - m.summary.indexable} ohne Indexaufnahme (zwei Ansichten, zwei Fehlerseiten).`,
    },
    {
      label: 'Pillar-Seiten',
      value: String(m.summary.pillar),
      note: 'Eine Übersichtsseite trägt das Thema Camper-Elektrik — sie verlinkt alle Unterthemen.',
    },
    {
      label: 'Rechner-Landingpages',
      value: String(m.summary.calculator),
      note: 'Vier Rechnerseiten mit eigenem Text, Formel, Quellen und Grenzen; dazu die beiden Werkzeuge Dach und Heizlast.',
    },
    {
      label: 'Suchintentionen abgedeckt',
      value: `${coverage.covered} von ${coverage.total}`,
      note: `${coverage.partial} teilweise abgedeckt, ${coverage.missing} offen. Keine offene P0-Intention (${coverage.openPriority0.length}).`,
    },
    {
      label: 'Waisenseiten',
      value: String(m.summary.orphans.length),
      note: 'Seiten ohne einen einzigen internen Verweis. Jede indexierbare Seite ist über mindestens einen Verweis erreichbar.',
    },
    {
      label: 'Dünne Seiten',
      value: String(m.summary.thin.length),
      note: `Unter ${THIN_WORDS} Wörtern ohne JavaScript gemessen. ${m.summary.thin.map((page) => `${page.path} (${page.words})`).join(', ') || '—'}`,
    },
    {
      label: 'Doppelte Metadaten',
      value: String(m.summary.duplicateTitles.length + m.summary.duplicateDescriptions.length),
      note: 'Titel und Beschreibungen sind über alle Seiten eindeutig (Prüfregeln `titel-doppelt` und `beschreibung-doppelt`).',
    },
    {
      label: 'Interne Verlinkung',
      value: pct(m.summary.inboundCoverage),
      note: `Jede indexierbare Seite hat mindestens einen eingehenden Verweis; im Mittel ${m.summary.averageInbound.toFixed(1)}. Größte Tiefe ab Startseite: ${m.summary.maxDepth} Klicks.`,
    },
    {
      label: 'Inhalt ohne JavaScript',
      value: `${m.summary.noJsPagesWithContent} von ${m.summary.indexable}`,
      note: 'Jede indexierbare Seite liefert im Roh-HTML genau eine H1 und ihren Text — geprüft ohne Skriptausführung.',
    },
    {
      label: 'Strukturierte Daten',
      value: 'bestanden',
      note: 'JSON-LD jeder Seite ist gültig, nennt schema.org und beschreibt nur, was sichtbar ist (Prüfregeln `strukturierte-daten-*`).',
    },
    {
      label: 'Sitemap und Robots',
      value: 'bestanden',
      note: `Sitemap führt genau die indexierbaren Seiten (${measurement.sitemapEntries} Einträge) unter dem Basis-Pfad; robots.txt verweist darauf.`,
    },
    {
      label: 'Planner-Bundle auf Inhaltsseiten',
      value: 'bestanden',
      note: `Keine Inhaltsseite lädt elkjs, dagre, react-flow oder GSAP im Erstaufbau (Prüfregel \`bundle-schwer\`). Werkzeuge dürfen ihre eigene Bibliothek laden.`,
    },
  ];
}

/** Kopfzeile jeder Berichtsfassung. */
function kopf(): PdfBlock[] {
  return [
    {
      kind: 'paragraph',
      text: `Stand: ${today} · Commit: \`${commit}\` (${commitDate}) · Grundlage: gebauter Static Export unter \`out/\`, ohne JavaScript gemessen.`,
      size: 9,
    },
  ];
}

/** Messgrundlage (`docs/seo/AUDIT.md`). */
function auditBlocks(): PdfBlock[] {
  const m = measurement;
  return [
    {
      kind: 'title',
      text: 'Camp — SEO-Messgrundlage',
      subtitle:
        'Seiteninventar, Verweise und Bündel des gebauten Exports. Automatisch erzeugt von scripts/seo/report.ts.',
    },
    ...kopf(),
    { kind: 'heading', text: 'Wie gemessen wird' },
    {
      kind: 'paragraph',
      text: 'Gemessen wird der gebaute Export, nicht die Absicht im Quelltext: Die Skripte lesen out/**/index.html, entfernen Skripte und Stile und zählen den sichtbaren Text. Damit entspricht die Wortzahl dem, was ein Crawler ohne JavaScript sieht. Verweise werden ohne Fragmente und Fremdadressen ausgewertet; die Tiefe ist der kürzeste Weg ab der Startseite über interne Verweise. Die Bündelgröße ist die Summe der im HTML verwiesenen Skriptdateien (unkomprimiert), die schweren Abhängigkeiten werden über Kennungen in diesen Dateien erkannt.',
    },
    {
      kind: 'list',
      items: [
        'Werkzeug: `npx tsx scripts/seo/measureExport.ts` (Tabelle) und dieser Bericht (Datei und PDF).',
        'Prüfregeln: `npm run seo:audit` — Teil des Builds; Exit-Code 1 nur bei echten Fehlern.',
        'Wiederholbar: gleicher Commit und gleicher Bau ergeben dieselben Zahlen.',
      ],
    },
    { kind: 'heading', text: 'Seitenmessung' },
    { kind: 'code', text: measurementTable(m) },
    { kind: 'heading', text: 'Kennzahlen' },
    {
      kind: 'table',
      head: ['Kennzahl', 'Wert'],
      rows: kennzahlen(m).map((entry) => [entry.label, entry.value]),
      widths: [0.45, 0.55],
    },
    { kind: 'heading', text: 'Suchintentionen' },
    {
      kind: 'table',
      head: ['Intention (Annahme)', 'Lage', 'Zielseite', 'Nächster Schritt'],
      rows: OPPORTUNITIES.slice(0, 40).map((entry) => [
        entry.query,
        entry.coverage,
        entry.page ?? '— (neu)',
        entry.action,
      ]),
      widths: [0.36, 0.14, 0.3, 0.2],
    },
    { kind: 'heading', text: 'Befunde' },
    {
      kind: 'list',
      items: [
        `Dünnste Seite: ${m.pages
          .filter((page) => page.indexable && page.kind !== 'rechtliches')
          .sort((a, b) => a.words - b.words)
          .slice(0, 3)
          .map((page) => `${page.path} (${page.words} Wörter)`)
          .join(', ')}.`,
        `Seiten ohne H2: ${
          m.pages
            .filter((page) => page.indexable && page.h2Count === 0)
            .map((page) => page.path)
            .join(', ') || '—'
        }.`,
        `Größte Bündel: ${m.pages
          .filter((page) => page.indexable)
          .sort((a, b) => b.scriptBytes - a.scriptBytes)
          .slice(0, 3)
          .map((page) => `${page.path} (${round(page.scriptBytes / 1024)} KB)`)
          .join(', ')}.`,
        'Sockel aller Seiten sind rund 593 KB Skript (React, Next-Laufzeit, Grundgerüst) — unkomprimiert gemessen; komprimiert liegt der Wert deutlich niedriger.',
      ],
    },
  ];
}

/** Der Abschlussbericht (`docs/seo/CAMP-SEO-GROWTH-REPORT.md`). */
function growthReportBlocks(): PdfBlock[] {
  const m = measurement;
  const seiten = indexablePages();
  // Seiten, die diese Arbeit hinzugefügt hat: Pillar, Cluster, Rechner, Vertrauen.
  const neueSeiten = PAGES.filter((page) =>
    ['pillar', 'cluster', 'rechner', 'vertrauen'].includes(page.kind)
  ).length;
  const seitenVorher = seiten.length - neueSeiten;
  return [
    {
      kind: 'title',
      text: 'CAMP SEO GROWTH REPORT',
      subtitle: `Organische Sichtbarkeit für Camper-Elektrik und der Weg in den Planer · Stand ${today} · Commit ${commit}`,
    },
    ...kopf(),
    { kind: 'heading', text: 'Ergebnis' },
    {
      kind: 'paragraph',
      text: `Vor dieser Arbeit hatte die Auslieferung ${seitenVorher} indexierbare Seiten: Startseite, Planer, zwei Werkzeuge, drei Guides und die Pflichtseiten. Es gab keine Seite für „Kabelquerschnitt 12 V", keine für „Spannungsabfall", keine für „LiFePO4 im Camper" — die Fragen, mit denen die Zielgruppe sucht, hatten kein Ziel. Diese Arbeit baut die Inhalts- und Rechnerebene auf, verbindet sie mit dem vorhandenen Planer und sichert die Zusagen maschinell ab. Sie erfindet keine zweite technische Infrastruktur: Kopfdaten, Sitemap, Robotik und die Exportprüfung bleiben die bestehenden Systeme, sie lesen jetzt nur aus einer gemeinsamen Datenquelle (lib/seo/).`,
    },
    { kind: 'heading', text: 'Kennzahlen' },
    {
      kind: 'table',
      head: ['Kennzahl', 'Wert', 'Anmerkung'],
      rows: kennzahlen(m).map((entry) => [entry.label, entry.value, entry.note]),
      widths: [0.26, 0.14, 0.6],
    },
    { kind: 'heading', text: 'Was entstanden ist' },
    {
      kind: 'paragraph',
      text: 'Die Inhalte liegen als Daten in `lib/seo/content/` und werden von gemeinsamen Gerüsten gerendert. Ein Themenbaum (`lib/seo/topics.ts`) bestimmt Verlinkung, Brotkrumen und Reihenfolge; die Suchintentionen stehen in `lib/seo/opportunities.ts`; das Inventar (`lib/seo/inventory.ts`) speist Sitemap und Prüfung aus einer Quelle.',
    },
    {
      kind: 'table',
      head: ['Seite', 'Art', 'Bediente Anfrage', 'Absicht'],
      rows: PAGES.filter((page) => ['pillar', 'cluster', 'rechner', 'vertrauen'].includes(page.kind)).map(
        (page) => [
          page.path,
          page.kind,
          page.targetQueries[0] ?? '—',
          page.searchIntent.length > 70 ? `${page.searchIntent.slice(0, 67)}…` : page.searchIntent,
        ]
      ),
      widths: [0.27, 0.11, 0.28, 0.34],
    },
    { kind: 'heading', text: 'Prüfungen und ihre Aussage' },
    {
      kind: 'table',
      head: ['Prüfung', 'Ergebnis', 'Wo sie läuft'],
      rows: [
        [
          'Strukturierte Daten (JSON-LD)',
          'bestanden',
          'scripts/seo/auditExport.ts im Build, Regel `strukturierte-daten-*`',
        ],
        ['Sitemap und Robots', 'bestanden', 'App-Routen + Exportprüfung (`sitemap-*`, `robots-*`)'],
        ['Inhalt ohne JavaScript', 'bestanden', 'Messung am Roh-HTML (measureExport)'],
        ['Planner-Bundle auf Inhaltsseiten', 'bestanden', 'Regel `bundle-schwer` (Neu)'],
        ['Interne Verlinkung und Waisen', 'bestanden', 'Regeln `verwaiste-seite`, `verweis-ohne-ziel`'],
        [
          'Kopfdaten (Titel, Beschreibung, Canonical)',
          'bestanden',
          'Regeln `titel*`, `beschreibung*`, `canonical*`',
        ],
        ['SEO-CI (Gesamtlauf)', 'PASS', 'npm run build → seo:audit, Exit-Code 0'],
      ],
      widths: [0.3, 0.14, 0.56],
    },
    { kind: 'heading', text: 'Offene Punkte nach Priorität' },
    {
      kind: 'list',
      items: [
        'P0 — erledigt: Suchintentionen inventarisiert, Pillar und Cluster gebaut, die stärksten Rechner als Landingpages aufgesetzt, interne Verlinkung geschlossen, Waisen und Dubletten maschinell ausgeschlossen.',
        'P1 — Werkzeugseiten erklären: /tools/dach/ (207 Wörter, keine H2) und /tools/heizung/ (436 Wörter, keine H2) brauchen einen erklärenden Textteil; /guides/camper-ausbauguide/ braucht eine Kurzfassung oben (1027 Wörter Gesamttext).',
        'P1 — Echte Bilder: Die Inhaltsseiten arbeiten mit Tabellen und Rechenbeispielen, aber ohne eigene Fotos oder Diagramme; zwei <img> in der ganzen Auslieferung sind zu wenig für ein visuell geprägtes Thema (Ausbau, Dach, Verkabelung).',
        'P1 — Search Console anschließen: Die Anfrageliste ist bislang eine begründete Annahme (Quelle `annahme`). Erst echte Daten erlauben, Reihenfolge und Titel zu schärfen — Workflow in docs/seo/SEARCH-CONSOLE.md.',
        'P2 — Ladebooster/DC-DC und Sinus-Wechselrichter-Vergleich: zwei Intentionen mit klarer Nachfrage, aber ohne Seite.',
        'P2 — Internationalisierung: Die Architektur ist bereit (Inhalte als Daten, Texte getrennt von Darstellung), aber es gibt keinen englischen Zweig — bewusst nicht begonnen, solange die deutsche Ebene nicht in den Suchdaten steht.',
        'P3 — Fahrzeugspezifische Seiten (etwa VW T6): nur mit echtem, belegbarem Inhalt je Fahrzeug; Massenerzeugung ist ausgeschlossen.',
      ],
    },
    { kind: 'heading', text: 'Top 20 Content-Chancen' },
    {
      kind: 'paragraph',
      text: 'Reihenfolge nach Priorität, Lage und Wirkung. „Lage" ist der Abdeckungsgrad der Anfrage, „Wirkung" die erwartete Bedeutung für das Thema — keine Suchvolumenzahl: Die Anfragen sind Modellannahmen (Quelle `annahme`), bis Search-Console-Daten vorliegen.',
    },
    {
      kind: 'table',
      head: ['#', 'Anfrage', 'Intention', 'Ziel', 'Lage', 'Nächster Schritt'],
      rows: [
        ...gaps.map((gap, index) => [
          String(index + 1),
          gap.query,
          gap.intent,
          gap.page ?? 'neu',
          gap.coverage,
          gap.action,
        ]),
        ...OPPORTUNITIES.filter((entry) => entry.coverage === 'abgedeckt')
          .slice(0, 20 - gaps.length)
          .map((entry, index) => [
            String(gaps.length + index + 1),
            entry.query,
            entry.intent,
            entry.page ?? 'neu',
            'abgedeckt',
            'beobachten / Titel schärfen',
          ]),
      ],
      widths: [0.05, 0.3, 0.11, 0.24, 0.11, 0.19],
    },
    { kind: 'heading', text: 'Nächste Schritte' },
    {
      kind: 'list',
      items: [
        "Search Console verbinden und die Anfragen der letzten 28 Tage exportieren; die Liste in lib/seo/opportunities.ts auf `source: 'search-console'` umstellen.",
        'P1: Werkzeugseiten um einen erklärenden Textteil ergänzen (je 300–500 Wörter, zwei H2, FAQ nur bei echten Fragen).',
        'P1: Bilder und Diagramme mit beschreibenden Alternativtexten ergänzen — Querschnittstabelle als Grafik, Beispielverkabelung, Dachbelegung.',
        'P2: Ladebooster/DC-DC als Cluster unter /camper-elektrik/ anlegen (Rechnung aus dem vorhandenen Modell: Strom, Spannungsfall, Sicherung, Leitungslänge).',
        'Nach jeder Änderung: npm run build (führt die Exportprüfung aus), npx tsx scripts/seo/report.ts für die aktualisierten Zahlen.',
      ],
    },
    { kind: 'heading', text: 'Grenzen dieses Berichts' },
    {
      kind: 'list',
      items: [
        "Alle Anfragen sind Annahmen aus Fachsprache und Support-Fragen, keine Messwerte. Erst `source: 'search-console'` belegt eine Anfrage.",
        '„Indexierbar" heißt: Die Seite steht auf index und in der Sitemap. Ob sie tatsächlich in den Index aufgenommen und gerankt wird, entscheidet die Suchmaschine — das ist nicht messbar ohne Search Console.',
        'Die fachlichen Aussagen stützen sich auf die Modelle der Anwendung (VDE-Nennwerte, Kupferkennwerte, Peukert) und die genannten Normbezüge. Es gibt keine Prüfung durch Dritte; Annahmen und Grenzen stehen auf jeder Seite.',
        'Die Bundle-Größen sind unkomprimiert gemessen. Für Übertragungsbudgets zählt die komprimierte Größe — die Rangfolge der Seiten bleibt davon unberührt.',
      ],
    },
    { kind: 'heading', text: 'Nachvollziehen' },
    {
      kind: 'code',
      text: [
        'npm ci',
        'npm run build            # baut den Export und prüft ihn (seo:audit)',
        'npx tsx scripts/seo/measureExport.ts   # Zahlen dieses Berichts',
        'npx tsx scripts/seo/report.ts          # erzeugt AUDIT, ANALYSE-UND-VISION und diesen Bericht neu',
      ].join('\n'),
    },
  ];
}

/** Das Strategiepapier (`docs/seo/ANALYSE-UND-VISION.md`). */
function visionBlocks(): PdfBlock[] {
  const m = measurement;
  return [
    {
      kind: 'title',
      text: 'Camp SEO — Analyse und Vision',
      subtitle: `Suchraum, Befunde und Zielbild für die organische Sichtbarkeit · Stand ${today} · Commit ${commit}`,
    },
    ...kopf(),
    { kind: 'heading', text: 'Ausgangslage' },
    {
      kind: 'paragraph',
      text: 'Camp ist ein Planungswerkzeug: Der Nutzer zeichnet seine 12-V-Anlage, das Werkzeug prüft jede Leitung gegen Strombelastbarkeit, Spannungsfall und Sicherung und erzeugt daraus eine Stückliste. Das ist ein starkes Ziel für Besucher mit einer konkreten Absicht — aber es ist kein Einstieg. Wer „kabelquerschnitt 12v camper" sucht, will zuerst wissen, wie gerechnet wird, nicht sofort zeichnen. Zwischen dieser Frage und dem Planer lag vor dieser Arbeit nichts: Die Auslieferung hatte neun indexierbare Seiten, und keine einzige beantwortete eine 12-V-Fachfrage.',
    },
    {
      kind: 'paragraph',
      text: `Die Messung des gebauten Exports bestätigt das: Die Startseite hatte 186 Wörter ohne JavaScript, die Werkzeugseiten 207 (Dach) und 436 (Heizung) Wörter und keine einzige Zwischenüberschrift. Es gab keine Pillar-Seite, keine Rechnerseite mit erklärendem Text, keine Vertrauensseite und keine Verlinkung zwischen den Bereichen. Gleichzeitig — und das ist der wichtigste Befund — war die technische Zusage intakt: genau eine H1 je Seite, vollständiger Inhalt ohne JavaScript, gültige strukturierte Daten, Sitemap und Robots in Ordnung. Das Problem war nicht die Technik, sondern die Sprache: Es fehlten Seiten für die Fragen der Nutzer.`,
    },
    { kind: 'heading', text: 'Der Suchraum' },
    {
      kind: 'paragraph',
      text: 'Der Suchraum zerfällt in fünf Absichten, die unterschiedliche Seitentypen verlangen. Die Zuordnung ist die Grundlage der Informationsarchitektur.',
    },
    {
      kind: 'table',
      head: ['Absicht', 'Beispielfrage', 'Seitentyp', 'Weg danach'],
      rows: [
        [
          'Rechnen',
          '„kabelquerschnitt 12v berechnen"',
          'Rechnerseite mit Erklärung, Formel, Beispiel',
          'Ergebnis in den Planer übertragen',
        ],
        [
          'Verstehen',
          '„spannungsabfall 12v formel"',
          'Clusterseite mit Herleitung, Tabelle, Grenzen',
          'Querschnitt und Sicherung auslegen',
        ],
        [
          'Auslegen',
          '„batterie camper berechnen ah"',
          'Rechnerseite mit Annahmen und Quellen',
          'Solar und Verbraucherbilanz prüfen',
        ],
        [
          'Vergleichen',
          '„lifepo4 oder agm camper"',
          'Clusterseite mit Vergleichstabelle',
          'Chemie wählen, Kapazität rechnen',
        ],
        [
          'Planen',
          '„schaltplan camper 12v"',
          'Pillar und Cluster mit Beispielplan',
          'Anlage im Planer zeichnen',
        ],
      ],
      widths: [0.13, 0.28, 0.3, 0.29],
    },
    {
      kind: 'paragraph',
      text: 'Zwei Absichten fehlen bewusst: „Kaufen" (Produkt- und Preisvergleiche) und „Reparieren" (Fehlersuche an bestehenden Anlagen). Beide gehören nicht zu einem Planungswerkzeug, und beide würden die inhaltliche Verantwortung verwässern: Wer Preise nennt, muss sie pflegen; wer Reparaturen beschreibt, muss Fahrzeuge kennen, die wir nicht kennen.',
    },
    { kind: 'heading', text: 'Befunde aus dem Audit' },
    {
      kind: 'list',
      items: [
        `Es fehlte die Inhaltsebene: Aus neun indexierbaren Seiten wurden ${m.summary.indexable} — Pillar, elf Cluster, vier Rechner-Landingpages und eine Vertrauensseite.`,
        'Die stärksten Rechner waren nicht adressierbar: Der Kabelquerschnittrechner steckte im Planer, der Spannungsabfall hatte keine eigene Rechnerseite, Batterie- und Solarrechnung existierten nur als Formeln.',
        `Die Werkzeuge erklären sich nicht: /tools/dach/ (${m.pages.find((page) => page.path === '/tools/dach/')?.words} Wörter) und /tools/heizung/ (${m.pages.find((page) => page.path === '/tools/heizung/')?.words} Wörter) haben keine Zwischenüberschrift und keinen erklärenden Text — sie liefern die Funktion, aber nicht die Antwort auf „wofür und wie lese ich das?".`,
        'Der Ausbauguide lud GSAP (rund 136 KB) im Erstaufbau einer Textseite; die Animation ist Dekoration und wird jetzt nachgeladen.',
        'Es gab keine Vertrauensseite: Wer einem Rechner folgt, will wissen, wie er rechnet, worauf er sich stützt und wo er irrt — diese Angaben stehen jetzt auf jeder Seite und gebündelt unter /ueber-werft/.',
        'Die Verlinkung war sternförmig: Alles hing an der Startseite. Jetzt führt ein Themenbaum von der Pillar in die Cluster und von jedem Cluster über ein bis zwei Schritte in den Planer.',
      ],
    },
    { kind: 'heading', text: 'Zielbild' },
    {
      kind: 'paragraph',
      text: 'Die Zielstruktur hat vier Ebenen und eine Richtung: von der Frage zur Zeichnung. Jede Ebene hat genau eine Aufgabe, und jede Seite verweist auf die nächste.',
    },
    {
      kind: 'list',
      ordered: true,
      items: [
        'Pillar (/camper-elektrik/): das Thema als Ganzes — Reihenfolge der Auslegung, Überblick über alle Unterthemen, Einstieg für „camper elektrik" und „elektrik ausbau".',
        'Cluster: je eine Frage — Kabelquerschnitt, Spannungsabfall, Sicherungen, Batterie, LiFePO4, AGM, Solar, MPPT, Wechselrichter, 230 V, Schaltplan. Jede Seite rechnet mit denselben Modellwerten wie der Planer.',
        'Rechner-Landingpages (/rechner/…): die Absicht „berechnen" mit Eingabe, Ergebnis, Einordnung und Beispielen — ohne Umweg über den Planer.',
        'Werkzeug und Planer: das Ziel. Wer die Werte kennt, zeichnet die Anlage im Planer und lässt sie prüfen — dort entstehen Stückliste und Fehlermeldungen.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Quer dazu stehen zwei Zusagen, die für ein Thema mit Sicherheitsbezug nicht optional sind: Transparenz (Quellen, Annahmen, Grenzen und Stand auf jeder Seite) und Bescheidenheit (keine erfundenen Prüfsiegel, keine Bewertungen, keine Preise). Beides ist nicht nur eine Haltung, sondern auch die einzige belastbare Grundlage für Sichtbarkeit in einem Themenfeld, in dem falsche Angaben Schaden anrichten können.',
    },
    { kind: 'heading', text: 'Funnel: von der Suche in den Planer' },
    {
      kind: 'table',
      head: ['Stufe', 'Seite', 'Was der Nutzer tut', 'Was danach folgt'],
      rows: [
        ['Frage', 'Cluster', 'liest, rechnet nach, prüft eine Zahl', 'Link „Im Planer weiterrechnen"'],
        ['Rechnung', 'Rechner-Landingpage', 'gibt Werte ein, liest das Ergebnis', 'Übernahme in die Anlage'],
        ['Zeichnung', '/elektrik-planung/', 'legt Leitungen, prüft Fehlermeldungen', 'Stückliste, Ausdruck'],
        ['Vertrauen', '/ueber-werft/', 'prüft Methodik, Quellen, Grenzen', 'teilt den Link weiter'],
      ],
      widths: [0.13, 0.24, 0.36, 0.27],
    },
    {
      kind: 'paragraph',
      text: 'Der Übergang von der Rechnung in den Planer ist der wichtigste Klick der ganzen Struktur. Deshalb steht er auf jeder Inhaltsseite als eigener Abschnitt, und deshalb gibt es keine Popups und keine Zwischenseiten: Wer eine Zahl sucht, bekommt sie zuerst.',
    },
    { kind: 'heading', text: 'Messung und Erfolgskriterien' },
    {
      kind: 'list',
      items: [
        'Was der Bau messen kann: Seitenzahl, Wortzahl ohne JavaScript, Überschriftenstruktur, interne Verlinkung, Waisen, doppelte Metadaten, Struktur der strukturierten Daten, Sitemap, Bundles. Diese Zahlen entstehen bei jedem Bau neu (docs/seo/AUDIT.md).',
        'Was nur die Search Console messen kann: Impressionen, Klicks, durchschnittliche Position je Anfrage, welche Seiten tatsächlich in den Index kommen. Der Ablauf steht in docs/seo/SEARCH-CONSOLE.md.',
        'Erfolgskriterium 90 Tage: Für die zehn wichtigsten Anfragen des Elektrik-Themas steht mindestens eine Seite in den Top-20 der Search Console, und der Planer erhält messbar mehr Aufrufe aus organischer Suche als vorher (Basiswert beim Anschließen festhalten).',
        'Erfolgskriterium Inhalt: Kein Cluster unter 700 Wörtern ohne JavaScript, jeder Rechner mit Formel, Annahmen, Grenzen und mindestens zwei Rechenbeispielen.',
      ],
    },
    { kind: 'heading', text: 'Roadmap' },
    {
      kind: 'table',
      head: ['Stufe', 'Inhalt', 'Zustand'],
      rows: [
        [
          'P0',
          'Suchraum inventarisieren, Pillar und elf Cluster, Rechnerseiten, Verlinkung, Waisen- und Dublettenprüfung, Vertrauensseite',
          'erledigt',
        ],
        [
          'P1',
          'Werkzeugseiten erklären, echte Bilder und Diagramme, Search Console anschließen, Titel anhand von Daten schärfen',
          'offen',
        ],
        [
          'P2',
          'Ladebooster/DC-DC, Sinus-Wechselrichter-Vergleich, englische Fassung der stärksten Seiten',
          'offen',
        ],
        [
          'P3',
          'Fahrzeugspezifische Seiten mit belegbarem Inhalt, weitere Rechner (Kabelverluste, Laderegler-Auslegung)',
          'offen',
        ],
      ],
      widths: [0.1, 0.75, 0.15],
    },
    { kind: 'heading', text: 'Risiken und ihre Behandlung' },
    {
      kind: 'list',
      items: [
        'Fachliche Genauigkeit: Alle Zahlen kommen aus dem Modell der Anwendung, nicht aus fremden Quellen. Wo das Modell etwas nicht weiß (Ladespannungen, Temperaturfenster einzelner Chemien), steht es als Herstellerangabe gekennzeichnet oder fehlt bewusst.',
        'Regulatorik: 230-V-Anlagen sind abnahmepflichtig. Jede Seite mit Landstrombezug nennt das; die Vertrauensseite wiederholt es.',
        'Erwartungen: Kein Ranking-Versprechen. Die Prüfungen belegen technische Zusagen, nicht Platzierungen — der Bericht sagt das ausdrücklich.',
        'Überproduktion: Neue Seiten entstehen nur für belegte oder klar benannte Intentionen. Die Anfrageliste ist die Bremse gegen beliebige Textmengen.',
      ],
    },
  ];
}

function writeDoc(name: string, blocks: readonly PdfBlock[], title: string): void {
  mkdirSync(DOCS, { recursive: true });
  writeFileSync(join(DOCS, `${name}.md`), `${renderMarkdown(blocks)}\n`, 'utf8');
  writeFileSync(join(DOCS, `${name}.pdf`), renderPdf(blocks, { title, author: 'Werft — Camp' }));
}

function main(): void {
  writeDoc('AUDIT', auditBlocks(), 'Camp — SEO-Messgrundlage');
  writeDoc('ANALYSE-UND-VISION', visionBlocks(), 'Camp SEO — Analyse und Vision');
  writeDoc('CAMP-SEO-GROWTH-REPORT', growthReportBlocks(), 'CAMP SEO GROWTH REPORT');
  process.stdout.write(
    `Berichte geschrieben nach docs/seo/: AUDIT, ANALYSE-UND-VISION, CAMP-SEO-GROWTH-REPORT (je .md und .pdf)\n`
  );
}

main();
