# Wie eine Seite wie diese aufgebaut sein sollte — Recherche, Messung, Änderung

**Stand:** 27.10.2026 · **Geprüfter Codestand:** `7e9beed` (Basis) + die Änderungen
dieses Branches · **Messgrundlage:** gebauter Static Export (`npm run build` →
`out/`), ohne JavaScript gelesen, Node 22.22.3.

**Kurzfassung in drei Sätzen**

1. **Technisch ist die Seite besser als fast alles, was in dieser Nische steht** —
   genau eine H1 je Seite, vollständiger Inhalt ohne JavaScript, 41 Seiten grün im
   eigenen Export-Audit, 0 Waisen, 0 dünne Seiten, 0 schwere Bündel auf
   Inhaltsseiten, axe-Gate über 36 Läufe.
2. **Inhaltlich war sie es nicht.** Startseite (456 Wörter) und die beiden
   Werkzeugseiten (243 bzw. 472 Wörter, **null** Zwischenüberschriften) waren genau
   die drei Seiten, für die die eigene Analyse vom Relaunch schon 2026 formuliert
   hatte: _„Das Problem war nicht die Technik, sondern die Sprache."_ Auf alle
   anderen Seiten wurde das angewendet — auf diese drei nie.
3. **Das ist jetzt behoben** (Startseite 841 Wörter, Dach 752, Heizung 1024, je ein
   sichtbarer FAQ-Block mit passender Auszeichnung) — plus eine Liste dessen, was
   als Nächstes dran ist, inklusive des einen Punkts, der vor dem Merge eine
   bewusste Freigabe braucht (Pixel-Baselines der Startseite).

---

## Teil 1 — Recherche: Was 2026 tatsächlich zählt

### 1.1 Was Google selbst sagt (und was nur Blogs behaupten)

Der wichtigste Befund der Recherche ist ein **negativer**: Fast alles, was 2026 als
„neu" verkauft wird, steht in Googles eigener Dokumentation ausdrücklich _nicht_
drin.

| Behauptung (Branchenblogs 2026)                      | Was die Primärquelle sagt                                                                                                                                                                                                                                                                                       | Folge für dieses Projekt                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| „AI Overviews brauchen spezielles Schema/AI-Dateien" | „To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet […] **There are no additional technical requirements.**" ([Google, AI features](https://developers.google.com/search/docs/appearance/ai-features)) | Nichts ergänzen. Bestehende Struktur reicht.                                                                     |
| „llms.txt ist Pflicht für Sichtbarkeit in KI-Suche"  | Google: „doing so won't harm (nor help) your visibility or rankings in Google Search, **as Google Search ignores them**." ([Search Engine Land, 15.06.2026](https://searchengineland.com/google-says-llms-txt-files-wont-harm-or-help-your-search-rankings-480264))                                             | Keine `llms.txt`. Eine Datei, die niemand liest, ist eine Datei, die veraltet.                                   |
| „FAQ-Schema bringt Rich Results"                     | Google hat das Feature im **Mai 2026 abgekündigt** und die Dokumentation im **Juni 2026 entfernt** ([Search-Updates](https://developers.google.com/search/updates#removing-faq-rich-result)).                                                                                                                   | FAQ-Schema bleibt (schadet nicht, beschreibt sichtbaren Text) — aber **nicht** als Rich-Result-Erwartung planen. |
| „LCP muss 2026 unter 2,0 s / INP unter 150 ms"       | Falsch. Offizielle Schwellen unverändert: **LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1**, gemessen am 75. Perzentil ([Google, Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)).                                                                                                | Kein Aktionismus. Wer 2,0 s anstrebt, darf das als internes Ziel — nicht als Gate.                               |
| „Schema-Markup erhöht KI-Zitate messbar"             | Nicht belegt; Google sagt ausdrücklich, dass es für AI-Features nicht nötig ist (s. o.). Schema hilft der **Maschinenlesbarkeit**, nicht als Ranking-Trick.                                                                                                                                                     | Schema bleibt, wie es ist: nur Typen, die der sichtbare Inhalt belegt.                                           |

**Was Google tatsächlich als Hebel nennt**, ist unspektakulär und deckt sich mit
dem, was diese Seite schon tut: indexierbar sein, einen Snippet zulassen, hilfreiche
Inhalte für Menschen schreiben. Alles andere ist Verpackung.

### 1.2 Was unabhängige Quellen belegen

Drei Befunde mit belastbarer Grundlage — und was sie für den Seitenaufbau bedeuten:

**(a) Der erste Bildschirm entscheidet, aber das Scrollen ist nicht tot.**
Nielsen Norman Group (Eyetracking 2018, in der aktuellen Literatur weiter zitiert):
**57 % der Betrachtungszeit** liegen oberhalb der Falz, 74 % in den ersten zwei
Bildschirmen ([Zusammenfassung](https://seed-light.com/blog/homepage-design/);
[Omniconvert 2026](https://www.omniconvert.com/blog/above-the-fold-design/)). Die
Zeit oberhalb der Falz ist also mehr als die Hälfte — aber fast die Hälfte findet
darunter statt. **Folge:** Der Hero muss in fünf Sekunden beantworten „bin ich hier
richtig?", und darunter muss etwas stehen, das den Scroll verdient. Eine Startseite,
die nach dem Hero nur Karten zeigt, verschenkt die Hälfte der Aufmerksamkeit.

**(b) Struktur schlägt Prosa — messbar.** Die Princeton-Studie zur Generative Engine
Optimization (Aggarwal et al., KDD 2024) fand, dass das Hinzufügen von **Statistiken
bis zu +40 %** und von **Zitaten/Quellenangaben bis zu +41 %** Sichtbarkeit in
generativen Antworten bringen ([zusammengefasst bei Writer](https://writer.com/blog/geo-aeo-optimization/)).
Derselbe Bericht nennt für FAQ-Abschnitte die höchste Zitierwahrscheinlichkeit aller
Formate — das ist eine Anbieter-Auswertung, keine Studie; als Hinweis brauchbar,
nicht als Beweis. **Folge:** Antwort zuerst, Zahl dazu, Quelle dazu, Frage als
Überschrift. Genau diese Form nutzt `lib/seo/content/` bereits konsequent.

**(c) Core Web Vitals sind ein Tie-Breaker, kein Trumpf.** Google sagt selbst, dass
gute Inhalte eine Seite mit schlechteren CWV überholen können. Die Verteilung 2026:
nur **55,6 % der Origins** erfüllen alle drei Schwellen (LCP 68,1 %, INP 85,3 %,
CLS 81,5 % — [Core Web Vitals Report 2026](https://www.corewebvitals.io/core-web-vitals)).
**Folge:** Wer die Schwellen reißt, verliert bei sonst gleichen Seiten — wer sie
einhält, gewinnt nichts dazu. Priorität hat Inhalt, nicht das letzte Kilobit.

### 1.3 Das Muster, das aus der Recherche folgt

Aus (a) + (b) + der eigenen Content-Architektur ergibt sich für eine
**Werkzeug-plus-Wissen-Seite** diese Reihenfolge:

| #   | Block                                                        | Beantwortet                                                 | Prüfkriterium                                                          |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | **Kopf + eine H1 mit Hauptsuchbegriff**                      | „Bin ich hier richtig?"                                     | H1 enthält den Begriff, nach dem gesucht wird — nicht nur einen Claim. |
| 2   | **Hero: eine Aussage, ein primärer Weg, ein sekundärer Weg** | „Was kann ich hier tun?"                                    | Ein dominanter CTA, nicht drei gleich laute.                           |
| 3   | **Einordnung: was / für wen / was nicht**                    | „Passt das zu mir, und darf ich mich darauf verlassen?"     | Drei Antwortblöcke, je 2 Sätze, als H3.                                |
| 4   | **Werkzeuge und Inhalte als Karten**                         | „Was gibt es?"                                              | Jede Karte führt auf eine indexierbare Seite.                          |
| 5   | **Wissen mit Antwort zuerst**                                | „Wie funktioniert das fachlich?"                            | H2 als Frage, erster Satz = Antwort.                                   |
| 6   | **FAQ (sichtbar) + Einordnung der Grenzen**                  | „Was kostet das, wo liegen meine Daten, gilt das fachlich?" | Antworten 40–60 Wörter, keine Werbefloskel.                            |
| 7   | **Abschluss-CTA + Fuß mit Rechtstexten**                     | „Und jetzt?"                                                | CTA wiederholt das Ziel aus 2, nicht ein neues.                        |

Auf **Werkzeugseiten** gilt dieselbe Ordnung, nur mit umgekehrter Gewichtung: Das
Werkzeug belegt den ersten Bildschirm (wer rechnen will, soll rechnen), der
Erklärtext steht darunter mit eigener H2 und eigenem FAQ. Das ist keine SEO-Kosmetik
— es ist der Unterschied zwischen „ich verstehe, was die Zahl bedeutet" und „ich
habe eine Zahl".

---

## Teil 2 — Ist-Stand, gemessen

### 2.1 Wie gemessen wurde

Nicht nach Gefühl: `npm run build` erzeugt `out/`, dann wurden Skripte und Stile
entfernt und der sichtbare Text gezählt — also das, was ein Crawler ohne JavaScript
sieht. Dieselbe Zählung vor und nach den Änderungen, damit die Differenz etwas
bedeutet. Zusätzlich liefen `scripts/seo/measureExport.ts` und
`scripts/seo/auditExport.ts` gegen denselben Export.

### 2.2 Die Zahlen (vorher → nachher)

| Seite                  | Wörter vorher | Wörter nachher | H2 vorher | H2 nachher | FAQPage |
| ---------------------- | ------------: | -------------: | --------: | ---------: | ------- |
| `/` (Startseite, P0)   |           456 |        **841** |         4 |      **6** | neu     |
| `/tools/dach/` (P1)    |           243 |        **752** |     **0** |      **2** | neu     |
| `/tools/heizung/` (P1) |           472 |       **1024** |     **0** |      **2** | neu     |

Der Export insgesamt (nach den Änderungen): **41 Seiten geprüft, 36 indexierbar,
0 Waisen, 0 von der Startseite unerreichbare Seiten, 0 dünne Seiten (< 300 Wörter),
0 schwere Bündel auf Inhaltsseiten, ø 21,1 eingehende Verweise je Seite.**

_Zur Zahlengenauigkeit:_ `docs/seo/AUDIT.md` (Stand 2026-10-15) nennt für diese drei
Seiten 242 / 207 / 436 Wörter. Das ist eine andere Zählung als die hier verwendete
(der Report zählt nur den `<main>`-Text, diese Messung den gesamten sichtbaren Text
ohne Skripte und Stile). **Vergleichbar ist nur die Spalte „vorher → nachher", weil
beide Werte mit derselben Methode am selben Tag entstanden sind.**

Gewicht (unverändert durch diese Runde, aber relevant für die Einordnung):

| Kennzahl                               | Wert                                            |
| -------------------------------------- | ----------------------------------------------- |
| JS gesamt (unkomprimiert, alle Chunks) | 4.101.635 B · gzip **1,27 MB**                  |
| JS Erstaufbau je Inhaltsseite          | 598–603 KB unkomprimiert (Budget 700)           |
| `/tools/dach/`                         | 956 KB (Budget 1100, lädt React Flow — bewusst) |
| CSS                                    | 232.745 B · gzip **41 KB**                      |
| Schriften im Export                    | 19 × woff2 · 364.596 B                          |
| `index.html`                           | 104 KB · gzip **15,7 KB**                       |

### 2.3 Was bereits besser ist als bei vergleichbaren Seiten

Das gehört zur Wahrheit dazu, sonst liest sich der Rest wie eine Mängelliste:

- **Eine Quelle der Wahrheit für Metadaten.** `lib/seo/inventory.ts` beschreibt jede
  Seite; Sitemap, Canonical, Open Graph und die Prüfung lesen daraus. Ein Titel kann
  nicht an einer Stelle geändert werden und an einer anderen veralten — der
  Export-Audit würde es melden.
- **Prüfung gegen das Artefakt, nicht gegen die Absicht.** Der Audit liest `out/`
  und vergleicht Titel, Beschreibung, H1, Canonical, Brotkrumen und FAQ **Zeichen
  für Zeichen** mit Inventar und sichtbarem Text. Das ist mehr, als die meisten
  kommerziellen SEO-Tools leisten.
- **Antwort-zuerst-Inhalte mit gerechneten Tabellen.** Die Cluster-Seiten bauen
  Tabellen aus dem eigenen Rechenmodell (`sizeCable`, `designAmpacity`) statt sie
  abzuschreiben. Das ist echter Information Gain: Zahlen, die niemand sonst in
  dieser Form hat, weil sie aus dem eigenen Planer kommen.
- **Transparenzblock je Inhaltssseite.** Quellen, Annahmen, Grenzen und
  `contentRevision` stehen sichtbar (`TrustBlock` in `components/seo/SeoPage.tsx`).
  Das adressiert genau das, was E-E-A-T meint — ohne erfundene Autoren-Biografien.
- **Bildfreier Hero.** Kein Screenshot, der nach der nächsten Layout-Runde veraltet;
  die Vorschau zeigt als Gerüst, was der Planer ausgibt. Ein Test hält es fest.
- **Zustand ohne Server.** Kein Konto, kein Backend, `localStorage`. Das ist
  gleichzeitig Datenschutz-Argument und Kostenargument — und ein Vertrauenssignal,
  das die Seite bisher nur im Fuß erwähnte.

### 2.4 Die Lücken, die bleiben

Nach Priorität, mit Beleg. **Stand 2026-10-28:** Punkt 1 und 2 sind erledigt
(Angaben eingetragen, Normzitate korrigiert — s. Teil 5). Punkt 3 ist der nächste
offene Mangel.

| #   | Befund | Beleg | Warum es zählt |
| --- | ------ | ----- | -------------- |

| #         | Befund                                                                                                                                          | Beleg                                                                                     | Warum es zählt                                                                                                                                                                                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**1**~~ | ~~**Impressum zeigt Platzhalter** (`SITE_LEGAL` = `BITTE-EINTRAGEN`)~~ → **erledigt 2026-10-28**                                                | `lib/siteLegal.ts`; `npm run ci:verify-legal-notice` meldet „vollständig“                 | Ein Impressum mit Platzhaltern erfüllt § 5 DDG nicht und ist abmahnfähig. War der einzige Befund, den nur der Betreiber beheben konnte — jetzt eingetragen (Teil 5).                                                                                                                            |
| ~~**2**~~ | ~~**Impressum zitiert aufgehobenes Recht**: „§ 5 TMG“ und „§ 55 Abs. 2 RStV“~~ → **erledigt 2026-10-28**                                        | Seit 14.05.2024 gilt § 5 **DDG**; § 55 RStV wurde 2020 durch § 18 Abs. 2 **MStV** ersetzt | Zitate umgestellt und durch einen Test gepinnt (`app/impressum/page.test.tsx`, „Normzitate“), der „TMG“ und „RStV“ im Dokument verbietet.                                                                                                                                                       |
| **3**     | **Datenschutzerklärung ist eine Kurzfassung** — 134 Wörter, mit dem Satz „bitte den finalen Text mit einer Rechtsberatung abgleichen"           | `app/datenschutz/page.tsx`                                                                | Art. 13 DSGVO verlangt konkret: Zwecke, Rechtsgrundlagen, Empfänger, Speicherdauer, Rechte. Die Aussage „Diese Daten verlassen dein Gerät nicht" stimmt nur, solange `NEXT_PUBLIC_CHAT_API_URL` ungesetzt bleibt — das steht nirgends.                                                          |
| **4**     | **`/ki-assistent/` ist eine Sackgasse**: 0 eingehende Verweise, `noindex`, im Export vorhanden, im Static Export funktionslos (kein `out/api/`) | `measureExport.ts` (ein/aus = 0/17), `out/api` existiert nicht                            | Entweder verlinken und betreiben oder aus der Auslieferung nehmen. Aktuell kostet sie Bündel und Prüfzeit, ohne jemandem zu helfen.                                                                                                                                                             |
| **5**     | **Fehlende Suchintention:** „elektrik vw t6 ausbau" hat keine Seite                                                                             | `lib/seo/coverage.ts` / `docs/seo/AUDIT.md`, Abdeckung 34 von 39                          | Fahrezeugspezifische Anfragen sind in dieser Nische die kaufnächsten. Achtung: nicht erfinden — es braucht belegte Daten (Werkstattmaße, Anschlusspunkte), sonst verstößt die Seite gegen die eigene Regel „keine Normaussage ohne Beleg".                                                      |
| **6**     | **Kein Datum, kein Autor, kein `dateModified`** — nur `contentRevision: '2026-10'`                                                              | `lib/seo/types.ts`, `lib/seo/jsonLd.ts`                                                   | Frische ist ein Signal (sowohl für Google als auch für KI-Suche). Ein Monat ist ehrlicher als ein erfundenes Tagesdatum, aber `WebPage` trägt derzeit gar kein Datum. Ein `dateModified` in Monatsauflösung wäre zulässig — bewusst nicht gemacht, weil es eine Genauigkeit vortäuschen könnte. |
| **7**     | **Nur die Mono-Schrift wird vorgeladen**, Inter/Outfit nicht                                                                                    | `app/layout.tsx`, offener Punkt **M11-6** in `AGENTS.md`                                  | Text wird zuerst in der Ersatzschrift gemalt und springt dann um — messbar als CLS, sichtbar als Ruck. Eine Vorladung der lateinischen Schnitte ist der billigste Hebel; die 364 KB ungenutzter Subsets (kyrillisch, griechisch) im Export sind dagegen nur Artefaktgröße.                      |
| **8**     | **Sitemap ohne `lastModified`**                                                                                                                 | `app/sitemap.ts` (bewusst, mit Begründung)                                                | Richtig entschieden für einen Build ohne Content-Datum — falsch, sobald es echte Änderungsdaten gibt. Bleibt offen, bis #6 gelöst ist.                                                                                                                                                          |
| **9**     | **FAQ-Reichweite neu kalibrieren**                                                                                                              | Google, Mai/Juni 2026                                                                     | Die Inventar-Einträge führen `FAQPage` als Auszeichnung — das ist weiterhin korrekt und nützlich, aber es gibt **kein Rich Result** mehr. Wer im Dashboard auf FAQ-Snippets wartet, wartet auf etwas, das abgeschaltet wurde.                                                                   |

---

## Teil 3 — Was in diesem Branch geändert wurde

### 3.1 Startseite (`app/page.tsx`)

- **H1 trägt jetzt den Hauptsuchbegriff:** „Camper-Ausbau planen: erst der Plan, dann
  das Blech." Der Anspruch bleibt, die Einordnung kommt dazu. Ein H1 ohne den Begriff
  ist auf der wichtigsten Seite der Auslieferung die teuerste ausgelassene
  Gelegenheit.
- **Neuer Abschnitt „Was der Elektroplaner ist — und was er nicht ersetzt"**
  (drei H3-Blöcke: _Was diese Seite ist_ / _Für wen sie gedacht ist_ / _Was sie nicht
  ersetzt_). Damit steht die Einordnung vor den Werkzeugen — und der Satz „ersetzt
  keine Elektrofachkraft" steht nicht mehr nur als Fußnote.
- **Neuer FAQ-Block** mit fünf Fragen (Was ist das? Was kostet es? Wo liegen meine
  Daten? Wie genau rechnet es? Ersetzt es eine Fachkraft?), sichtbar als
  `details`/`summary` — funktioniert ohne JavaScript und ist im Roh-HTML lesbar.
- **`FAQPage` in der strukturierten Beschreibung**, aus **derselben Konstante** wie
  die Anzeige (`HOME_FAQ`). Der Export-Audit vergleicht Frage und Antwort Zeichen
  für Zeichen mit dem sichtbaren Akkordeon — eine zweite Formulierung wäre sofort rot.
- **Inhaltsverzeichnis** auf fünf Abschnitte erweitert (`01—05`), damit die
  Sprungziele weiterhin stimmen.

### 3.2 Werkzeugseiten (`/tools/dach/`, `/tools/heizung/`)

- **Neue Komponente `components/seo/ToolExplainer.tsx`**: ein H2-Block mit dem
  Rechenmodell (H3 je Frage, Antwort zuerst), darunter ein eigener H2-Block
  „Häufige Fragen …". Die Trennung ist technisch begründet: Die Export-Prüfung
  findet den FAQ-Block über eine `<section>`, deren H2 mit „Häufige Fragen" beginnt.
- **Inhalte aus dem eigenen Code, nicht aus Datenblättern.** Die Dach-Seite erklärt
  die nutzbare Fläche (3,12 × 1,40 m beim Ducato L2H2), den sicheren Bereich
  (15 cm vorne, je 5 cm sonst), die Prüfung auf Überlappung und was die
  Gesamt-Watt-Zahl **nicht** ist (Nennleistung, keine Ertragsprognose). Die
  Heizungsseite erklärt Hüllfläche, U-Werte (3,0 / 5,88 / `1/(0,17+d/0,036)`),
  Luftwechsel (`0,34·V·n·ΔT`) und die 30-%-Reserve.
- **Grenzen werden benannt, nicht versteckt:** keine Wärmebrücken, keine solaren
  Gewinne, keine Ertragsprognose, keine Messung. Das ist die Haltung, die
  `AGENTS.md` verlangt — und gleichzeitig die, die Zitierfähigkeit erzeugt.
- **`FAQPage` in beiden Layouts**, gespeist aus derselben Datei wie die Anzeige
  (`explainerContent.ts`).

### 3.3 Warum genau diese drei Seiten

Weil die eigene Analyse es schon aufgeschrieben hatte
(`docs/seo/ANALYSE-UND-VISION.md`, Einleitung): _„Die Startseite hatte 186 Wörter
ohne JavaScript, die Werkzeugseiten 207 (Dach) und 436 (Heizung) Wörter und keine
einzige Zwischenüberschrift. […] Das Problem war nicht die Technik, sondern die
Sprache."_ Auf 24 Inhaltsseiten wurde dieser Befund danach behoben — auf genau
diesen drei nicht. Sie sind der Rest einer angefangenen Reparatur.

---

## Teil 4 — Was als Nächstes dran ist

### 4.1 Vor dem Merge: eine Freigabe, die niemand automatisieren kann

Die Pixel-Baselines der Startseite **und des Impressums** sind `fullPage: true`
(`tests/e2e/visual.spec.ts`) — jede Textänderung dort verschiebt sie zwangsläufig.
Betroffen sind **12 Dateien**:

- `route-start-{light,dark}-{mobile-375,tablet-768,desktop-1440,touch-pixel5}-linux.png` (8)
- `route-impressum-{light,dark}-{…}-linux.png` (4) — seit 2026-10-28 mit den echten
  Anbieterangaben statt der Platzhalter

`/tools/dach/` und `/tools/heizung/` sind `fullPage: false` — der neue Text steht
unterhalb des ersten Bildschirms, die Baselines bleiben gültig.
Der dokumentierte Weg (`docs/UI-BASELINE.md`, `docs/GOVERNANCE.md` §3) ist genau
dafür da:

```bash
# Workflow „Pixel-Baselines aufnehmen" (workflow_dispatch) starten,
# Artefakt „pixel-baselines" herunterladen, Bilder optisch prüfen, dann committen.
# Lokal (Linux, gleiche Umgebung wie das Gate):
npx playwright test tests/e2e/visual.spec.ts --update-snapshots
```

In dieser Umgebung waren keine Playwright-Browser installierbar (der
Browser-CDN ist gesperrt) — deshalb sind die Bilder **nicht** neu aufgenommen.
Das ist der einzige Punkt, an dem dieser Branch absichtlich nicht grün ist.
Alle anderen Gates sind gelaufen: `lint`, `format:check`, `typecheck`,
`typecheck:tests`, **3.803 Tests in 293 Dateien**, `npm run build` und der
Export-Audit über 41 Seiten.

### 4.2 Die Reihenfolge, die ich empfehle

| Prio      | Aufgabe                                                                                                                              | Aufwand                        | Risiko                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------- |
| ~~**1**~~ | ~~`SITE_LEGAL` ausfüllen~~ · ~~Impressum auf DDG/MStV umstellen~~ — **erledigt 2026-10-28** (Teil 5)                                 | 15 Min.                        | keins                                                         |
| **1**     | **Pixel-Baselines neu aufnehmen** (Startseite + Impressum, 4.1)                                                                      | 15 Min.                        | Gate-Diff, gewollt                                            |
| **2**     | Datenschutz auf eine vollständige Fassung heben (Art. 13: Zwecke, Rechtsgrundlage, Empfänger, Dauer, Rechte; Chat-Endpunkt benennen) | 1–2 h + Rechtsprüfung          | Text ist Baseline — mit #1 zusammen erledigen                 |
| **3**     | `/ki-assistent/` entweder verlinken und betreiben oder aus `app/` entfernen                                                          | 30 Min.                        | Route löschen ändert den Export-Audit (Inventar mitziehen)    |
| **4**     | Inter/Outfit (lateinisch) vorladen — **M11-6**                                                                                       | 1 h, CLS vorher/nachher messen | `lib/designTokens.test.ts` prüft die Importe                  |
| **5**     | Seite für „Elektrik VW T6 Ausbau" — **nur mit belegten Daten**                                                                       | 1 Tag Recherche                | Verstoß gegen „keine Normaussage erfinden", wenn improvisiert |
| **6**     | `dateModified` in Monatsauflösung + `lastModified` in der Sitemap, sobald es echte Änderungsdaten gibt                               | 2 h                            | Genauigkeits-Vortäuschung vermeiden                           |

### 4.3 Was ich ausdrücklich **nicht** empfehle

- **Keine `llms.txt`.** Google ignoriert sie (Primärquelle in 1.1), und eine Datei,
  die niemand liest, veraltet still.
- **Kein zusätzliches Schema-Markup „für KI".** Die Auszeichnung beschreibt bereits
  genau das, was sichtbar ist. Mehr Typen ohne sichtbare Entsprechung wären eine
  Behauptung — und der eigene Audit würde sie zu Recht als „im Inventar nicht
  angekündigt" melden.
- **Keine Autoren-Biografie auf Vorrat.** E-E-A-T lässt sich in diesem Projekt
  ehrlich nur über Transparenz herstellen (Quellen, Annahmen, Grenzen, Stand) —
  nicht über erfundene Lebensläufe.
- **Kein Bild auf der Startseite.** Der bildfreie Hero ist eine Entscheidung mit
  Test; ein Stockfoto würde LCP verschlechtern und die Seite beliebiger machen.
- **Kein Umbau auf `next/font`.** Der Gewinn stünde in keinem Verhältnis zum Risiko
  an den eingefrorenen Pixel-Baselines (88 Bilder in vier Spec-Ordnern).

---

## Teil 5 — Impressum (2026-10-28)

Der einzige Befund, der nicht am Code hing, sondern an einer Angabe: Die
Anbieterkennzeichnung stand als Platzhalter im öffentlich ausgelieferten Export.
Sie ist jetzt eingetragen — und dabei sind zwei Dinge mitkorrigiert worden, die
sonst als Nächstes gefallen wären.

**Eingetragen** (`lib/siteLegal.ts`, eine Stelle):

| Feld                 | Wert                                               | Norm                                                                                                                                    |
| -------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `providerName`       | Jonas Rieckhoff                                    | § 5 DDG Nr. 1 — bei einer natürlichen Person genügt der bürgerliche Name; ein Rechtsformzusatz existiert nicht und wurde nicht erfunden |
| `street`             | Franzosenkoppel 46                                 | § 5 DDG Nr. 1                                                                                                                           |
| `postalCodeAndCity`  | 22547 Hamburg                                      | § 5 DDG Nr. 1                                                                                                                           |
| `email`              | kontakt@elektroplaner-camper.de                    | § 5 DDG Nr. 2                                                                                                                           |
| `contentResponsible` | Jonas Rieckhoff, Franzosenkoppel 46, 22547 Hamburg | § 18 Abs. 2 MStV                                                                                                                        |

**Mitkorrigiert:** Die Seite zitierte „§ 5 TMG" (seit 14.05.2024 vom DDG
abgelöst) und „§ 55 Abs. 2 RStV" (2020 vom MStV abgelöst). Beides stand als
bekannter FOLLOW-UP im Modul und hing an der eingefrorenen Pixel-Baseline — die
ohnehin neu aufgenommen werden muss, sobald echte Angaben statt Platzhalter
dastehen. Jetzt zitiert die Seite geltendes Recht, und ein Test hält das fest
(`app/impressum/page.test.tsx`, „Normzitate": „TMG" und „RStV" dürfen im
Dokument nicht mehr vorkommen).

**Nebenbei:** Die E-Mail ist jetzt ein `mailto:`-Link statt Fließtext — eine
Kontaktadresse, die man nicht anklicken kann, ist im Impressum eine Bedienhürde
ohne Grund.

**Was die Tests dazu sagen mussten:** Drei Tests hatten den _Mangel_ gepinnt
(„alle fünf Felder offen", „der Stand im Baum ist unvollständig", „der echte
Stand ist unvollständig"). Sie sind umgedreht, nicht gelöscht — sie prüfen jetzt
den ausgefüllten Stand samt der konkreten Werte, damit eine versehentliche
Leerung auffällt. Der Placeholder-Zweig der Seite bleibt bestehen und wird mit
einem ausdrücklich geleerten Objekt getestet: Er ist die Anzeige, die der
Deploy-Wächter meldet, wenn die Angaben später geerbt oder überschrieben werden.

**Offen bleibt** die Datenschutzerklärung (Befund 3): weiterhin eine Kurzfassung
mit 134 Wörtern und dem Satz „bitte den finalen Text mit einer Rechtsberatung
abgleichen". Der nächste sinnvolle Schritt.

### Nachtrag 2026-10-28 — Befund 3 und die Punkte aus §2.4

- **Datenschutzerklärung (Befund 3): geschrieben.** Vollständige Fassung nach
  Art. 13 DSGVO, Verantwortlicher aus `lib/siteLegal.ts`, Speicherschlüssel aus
  `lib/storageKeys.ts`, Aufsichtsbehörde mit Anschrift, Rechte Art. 15–21,
  Beschwerderecht Art. 77. Die Aussagen „keine Cookies, keine Analyse, keine
  fremden Server" sind testbar hinterlegt (`app/datenschutz/page.test.tsx`
  durchsucht den Quelltext). Entscheidung: **ADR 0039**.
- **M11-6 (Fonts vorladen): umgesetzt, mit einem Befund.** Inter und Outfit
  fehlten tatsächlich im Preload. Beim Nachmessen zeigte sich zusätzlich, dass
  React 19 `<link rel="preload">` **zusätzlich** zum Ort im Baum in den Kopf
  hebt: Die vier vorgeladenen Schriften standen achtmal im Kopf (auch die zwei
  IBM-Plex-Schnitte, die schon vorher dort standen — der Fehler war unsichtbar,
  solange niemand zählte). Behoben über `preload()` aus `react-dom`, das über
  den Pfad dedupliziert; der Export-Audit prüft seitdem Anzahl, Dubletten,
  Existenz der Datei und `crossorigin` (`FONT-PRELOAD-*`).
- **`lastModified`/`dateModified`: mit belegten Daten, nicht flächendeckend.**
  Fünf Seiten tragen ein Datum aus einem nachprüfbaren Commit; die übrigen
  bewusst keins. Ein aus Build-Zeit oder Git-Commit abgeleitetes Datum wurde
  gemessen und verworfen (in dieser Umgebung ist der Klon flach: `git log -1`
  liefert für alle Dateien denselben Zeitstempel). Begründung und Messung:
  ADR 0039.
- **Seite „Elektrik VW T6 Ausbau": weiterhin offen** — es gibt keine belegten
  fahrzeugspezifischen Daten im Baum, und geratene Querschnitte wären in einem
  Planungswerkzeug schädlicher als eine fehlende Seite.

---

## Quellen

**Primär (Google):**

- AI features and your website — <https://developers.google.com/search/docs/appearance/ai-features>
- Core Web Vitals und Suchrankings — <https://developers.google.com/search/docs/appearance/core-web-vitals>
- Search-Dokumentations-Updates (FAQ-Rich-Result abgekündigt 05/2026, Dokumentation entfernt 06/2026; llms.txt 06/2026) — <https://developers.google.com/search/updates>
- Google zu llms.txt (Bericht) — <https://searchengineland.com/google-says-llms-txt-files-wont-harm-or-help-your-search-rankings-480264>

**Sekundär (Branche/Forschung, mit Einschränkung zitiert):**

- CrUX-Verteilung 2026 (55,6 % der Origins erfüllen alle drei CWV) — <https://www.corewebvitals.io/core-web-vitals>
- Antwortmaschinen und Strukturformate (Princeton-GEO-Studie, Aggarwal et al. KDD 2024, referiert) — <https://writer.com/blog/geo-aeo-optimization/>
- Above-the-fold-Aufmerksamkeit (NN/g-Eyetracking 2018, referiert) — <https://seed-light.com/blog/homepage-design/> · <https://www.omniconvert.com/blog/above-the-fold-design/>

**Projektintern (gemessen bzw. gelesen):**

- `docs/seo/ANALYSE-UND-VISION.md`, `docs/seo/AUDIT.md`, `docs/LAYOUT-AUDIT-2026-10-27.md`
- `lib/seo/inventory.ts`, `lib/seo/types.ts`, `lib/seo/jsonLd.ts`, `lib/seo/coverage.ts`
- `scripts/seo/checks.ts` (Prüfregeln), `scripts/seo/measureExport.ts` (Messung)
- `app/tools/dach/validation.ts`, `app/tools/heizung/page.tsx` (Rechenmodelle)
- `lib/siteLegal.ts`, `scripts/ci/verifyLegalNotice.ts`

---

## Anhang — Prüfbefehle

```bash
npx prettier --check .          # sauber
npx eslint .                    # 0 Fehler
npx tsc -p tsconfig.typecheck.json --noEmit   # 0 Fehler
npx tsc -p tsconfig.tests.json --noEmit       # 0 Fehler
npx vitest run                  # 293 Dateien, 3803 Tests
npm run build                   # Static Export, 46 Seiten
npx tsx scripts/seo/auditExport.ts            # grün, 41 Seiten geprüft
npx tsx scripts/seo/measureExport.ts          # Wortzahlen/Tiefe/Verlinkung
```
