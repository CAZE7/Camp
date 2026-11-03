# ADR 0039 — Datenschutzerklärung nach Art. 13 und belegte Änderungsdaten

**Status:** umgesetzt · **Datum:** 2026-10-28 · **Bezug:** ADR 0001, ADR 0021,
`docs/seo/RESEARCH-SEITENAUFBAU-2026-10-27.md` §2.4/§4.2 (Punkte 1 und 5)

## Kontext

Zwei offene Punkte aus dem Seitenaufbau-Audit trafen dieselbe Frage: Was darf
die Seite über sich selbst behaupten?

**Datenschutzerklärung.** `/datenschutz/` war eine Kurzfassung mit 134 Wörtern,
die nur die lokale Speicherung nannte — ohne benannte verantwortliche Stelle,
ohne Zwecke, ohne Rechtsgrundlagen, ohne Rechte, ohne Aufsichtsbehörde. Statt
einer Erklärung stand dort eine Notiz an den Betreiber („bitte den finalen Text
mit einer Rechtsberatung abgleichen"). Art. 13 DSGVO verlangt konkrete Angaben;
die Seite erfüllte keine davon.

**Änderungsdaten.** Die Sitemap führte bewusst keinen `lastModified`-Wert, das
JSON-LD kein `dateModified`. Die Begründung im Code war: ein aus der Build-Zeit
abgeleiteter Zeitstempel behauptet bei jedem Bau eine Änderung, die niemand
vorgenommen hat.

## Entscheidung

### 1. Die Datenschutzerklärung beschreibt den Code, nicht einen Vertragstext

Jeder Satz muss am Baum prüfbar sein:

| Aussage der Seite                | Beleg im Baum                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| Verantwortlicher, Anschrift, Kon | `lib/siteLegal.ts` (`SITE_LEGAL`, dieselbe Quelle wie das Impressum)                |
| Speicherschlüssel                | `lib/storageKeys.ts` — importiert, nicht abgetippt                                  |
| „keine Cookies, keine Analyse"   | `app/datenschutz/page.test.tsx` durchsucht `app/`, `components/`, `lib/`, `store`   |
| „keine fremden Server"           | alle Schriften aus `@fontsource`, CSP erlaubt `connect-src` nur die eigene Herkunft |
| „keine Chat-Schnittstelle"       | ADR 0021: Assistent und `/api/chat` entfernt                                        |

Der Test prüft Vollständigkeit (Art. 13 Abs. 1 und 2, Art. 77) und die
Übereinstimmung mit dem Code. Die rechtliche Bewertung kann kein Unit-Test
leisten. Die Gegenprobe ist neu: Der Test sammelt alle Quelldateien und
verlangt, dass in ihnen kein Analyse-Client, kein Cookie-Zugriff und kein
Drittanbieter-Skript vorkommt. Kommt je einer hinzu, wird der Test rot, bevor
die Aussage falsch wird.

Aufsichtsbehörde: Der Hamburgische Beauftragte für Datenschutz und
Informationsfreiheit, Ludwig-Erhard-Str. 22, 20459 Hamburg (verifiziert am
2026-10-28 über datenschutz-hamburg.de und die Adressliste des BfDI). Die
Anschrift steht ausgeschrieben im Test: Eine falsche Behörde ist eine
Falschangabe im Rechtstext und soll auffallen, statt in einer Variable
mitzuwandern.

### 2. `lastModified`/`dateModified` nur mit belegtem Tag

Neues optionales Feld `lastReviewed` im Seiteninventar (`YYYY-MM-DD`), das in
die Sitemap (`lastModified`) und ins JSON-LD (`dateModified`) wandert — aber nur,
wenn ein Mensch es setzt, und nur mit einer Begründung am Eintrag.

Gesetzt ist es für fünf Seiten, deren sichtbarer Text sich in einem
nachprüfbaren Commit geändert hat:

| Seite             | Datum        | Beleg                                                       |
| ----------------- | ------------ | ----------------------------------------------------------- |
| `/`               | `2026-10-28` | Commit `0b794ab` — Einordnung und FAQ ersetzt               |
| `/tools/dach/`    | `2026-10-28` | Commit `0b794ab` — Erklärblock ergänzt (243 → 752 Wörter)   |
| `/tools/heizung/` | `2026-10-28` | Commit `0b794ab` — Erklärblock ergänzt (472 → 1 024 Wörter) |
| `/impressum/`     | `2026-10-28` | Commit `a3e885e` — Anbieterkennzeichnung gefüllt            |
| `/datenschutz/`   | `2026-10-28` | diese Fassung ersetzt die 134-Wort-Kurzfassung              |

Die übrigen Seiten tragen kein Datum. Ein fehlender Zeitstempel ist die
korrekte Auskunft über eine Seite, deren letzte inhaltliche Änderung niemand
belegen kann; ein geratener ist eine Behauptung im Maschinenformat.

### 3. Warum kein abgeleitetes Datum (Build-Zeit oder Git)

Beides wurde geprüft und verworfen:

- **Build-Zeit** behauptet bei jedem Deployment eine Änderung an jeder Seite.
- **Git-Commit-Datum** ist im CI nicht verlässlich: `.github/workflows/deploy.yml`
  checkt ohne `fetch-depth: 0` aus, ein `git log -1 -- <datei>` liefert dann die
  Historie der flachen Kopie. Nachgemessen in der Entwicklungsumgebung
  (`git rev-parse --is-shallow-repository` → `true`): `git log -1` liefert für
  `lib/seo/content/pillar.ts`, `lib/seo/content/kabelquerschnitt.ts`,
  `app/datenschutz/page.tsx` und `app/impressum/page.tsx` **denselben**
  Zeitstempel `2026-10-27T16:47:49+01:00` — das Datum des Klons, nicht der
  Datei. Zusätzlich misst ein Commit-Datum auch Refactorings als
  „Inhaltsänderung", was genau die Ungenauigkeit erzeugt, wegen der
  Suchmaschinen `lastmod` ignorieren.

`fetch-depth: 0` ist damit **nicht** erforderlich; es wäre nur die
Voraussetzung für einen Weg, der hier abgelehnt wurde.

### 4. Font-Preload: React verdoppelt `<link rel="preload">`

Beim Nachmessen von M11-6 (Inter/Outfit vorladen) zeigte der Export einen
Fehler, den man der Seite nicht ansieht: Die vier vorgeladenen Schriften standen
**achtmal** im Dokumentkopf. Ursache ist React 19: Ein `<link rel="preload">`
gilt als Ressourcen-Hinweis und wird zusätzlich zu seiner Stelle im Baum in den
Kopf gehoben. Im Kopf und im Body ergab das je zwei Kopien.

Entscheidung: `preload()` aus `react-dom` statt `<link>`-Elementen. Die API
dedupliziert über den Pfad und erzeugt genau ein Element je Datei (gemessen:
vier statt acht). Der Export-Audit prüft die Form seitdem dauerhaft
(`FONT-PRELOAD-ANZAHL`, `-DOPPELT`, `-FEHLT`, `-TYP`, `-CORS`).

## Folgen

- Die Sitemap trägt Zeitstempel an fünf von 37 Einträgen. Jeder Eintrag bleibt
  ohne Datum gültig, und ein Datum ist kein Ranking-Hebel.
- `app/sitemap.test.ts` prüft die Regel anstelle der Abwesenheit: gültiges
  Kalenderdatum, Mitternacht UTC, nicht in der Zukunft, nicht vor Projektbeginn,
  und jedes Datum muss im Inventar belegt sein. Der Test verlangt außerdem, dass
  die Liste kein Datum an jeder Seite trägt — sonst wäre der Wert wieder eine
  Behauptung.
- Ändert sich der sichtbare Text einer Seite, gehört `lastReviewed` mitgezogen —
  wie `contentRevision` bei den Inhaltsseiten. Beides ist Handarbeit; dafür ist
  der Wert nachprüfbar.
- Die Datenschutzerklärung ist kein statischer Text mehr: Sie liest Anbieter und
  Speicherschlüssel aus dem Code und wird rot, wenn der Code etwas anderes tut
  als sie verspricht.
- Font-Preloads laufen über `preload()`; ein `<link rel="preload">` im Baum
  erzeugt eine Dublette und wird vom Export-Audit gemeldet.
