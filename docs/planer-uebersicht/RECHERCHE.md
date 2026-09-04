# Übersichtlichkeit im Elektroplaner — umfassende Recherche, Maßnahmenkatalog und View-Konzept

**Stand:** 2026-09-04 · **Branch der Session:** `arena/01a06c27-camp` (Basis `375f485`)
**Analysierte Code-Stände:** Session-Basis `375f485` **und** aktueller Default-Branch `feature/react-flow-cable-editor-…` (`c504ce2`, Stand 03.09.2026)
**Begleitmaterial:** interaktiver Prototyp unter [`prototyp/index.html`](./prototyp/index.html) (9 umschaltbare Ansichten, dieselbe Beispieldatenquelle)

---

## 0 · Management-Summary

Der Planer ist handwerklich stark (Orthogonal-Routing, VDE-Modell, Undo/Redo, Touch, A11y, Dark-Theme).
Die Unübersichtlichkeit entsteht **nicht** durch schlechte Komponenten, sondern durch vier strukturelle Entscheidungen:

1. **Eine Darstellungsform für alles.** Der mehrlinige Free-Canvas ist gleichzeitig Übersicht, Detailplan,
   Prüfdokument und Installationshilfe. Die Elektrotechnik löst das seit Jahrzehnten anders:
   über *Darstellungsarten* (einpolig/mehrpolig, aufgelöst/zusammenhängend) und *Planarten*
   (Übersichtsschaltplan, Stromlaufplan, Klemmen-/Kabelplan, Installationsplan) — jeweils eigene,
   umschaltbare Sichten auf **dieselbe** Datenquelle [1](https://www.elekrechner.com/ratgeber/grundlagen/schaltplan-grundlagen), [4](https://www.ksv-koblenz.de/blog/wie-erstellt-man-einen-schaltplan-nach-din-en-61082/).
2. **Permanente Vollinformation.** Jede Ader trägt dauerhaft ein Label, jede Node immer die volle Karte.
   Dadurch konkurrieren auf derselben Fläche Struktur- und Detailinformation (Overplotting an Busbar-Sternen).
3. **Keine zweite Leseebene.** Es gibt keine Tabellen-/Listenansicht (Stromkreise, Kabelliste, Stückliste als
   Positionen) und keine Blatt-/Druckebene — dabei sind genau das die Formate, in denen geplant, gekauft und gebaut wird.
4. **Chrome-Konkurrenz.** Toolbar, Domänen-Chips, Metrics-Card, Expert-Panel, Statusbar und Help-FAB
   belegen alle vier Canvas-Ränder gleichzeitig; die Zeichenfläche verliert Ruhe.

**Kernempfehlung:** Ein **View-System** einführen — der Graph bleibt *Single Source of Truth*,
Ansichten sind **pure Derivationen** davon (read-only oder editierend), umschaltbar über eine
View-Leiste und persistiert je Plan. Die wirkungsvollsten Einzelmaßnahmen in Reihenfolge:

| # | Maßnahme | Wirkung | Aufwand |
|---|----------|---------|---------|
| 1 | **Einlinien-/Übersichtsmodus** (einpolig, Adern-Kerbe, Zonenbänder) | Linienmenge −47 % (43→23), Struktur sofort lesbar | M |
| 2 | **Label-Dichte steuerbar** (Kabel-Labels default nur Hauptleitungen + Hover/Selektion) | entfernt sofortiges Overplotting | S |
| 3 | **Stromkreis-Raster** (Sicherung → Verbraucher → Kabel → Ah/Tag) | die Sicht, in der erweitert & gesucht wird | S |
| 4 | **Kabelliste** mit Kabel-IDs (IEC-81346-Prinzip), sortierbar, CSV | Bruchfreie Referenz Plan ↔ Tabelle ↔ Kabelmarker | S–M |
| 5 | **Energiebilanz-Ansicht** (Verbrauch vs. Ertrag, Sommer/Winter) | beantwortet „reicht meine Anlage?“ in 3 s | S |
| 6 | **Review-Modus** (Warnungen als geführte Liste mit Zoom-to-Issue) | Prüfung wird zum Arbeitsablauf | S |
| 7 | **Blatt-/Druckansicht** (A4, Schriftfeld, 3 Blätter, `@media print`) | aus dem Spielzeug wird ein Dokument | M |
| 8 | **Stromschienen-Ansicht** (aufgelöste Darstellung, Ladder) | kreuzungsfreie Fehlersuche-Ansicht | L |

Der Prototyp zeigt alle acht plus Verlegeplan und Split-Vergleich — zum Anfassen und Entscheiden.

---

## 1 · Methodik

1. **Code-Audit beider Stände:** kompletter Planer-Stack (`components/planner/**`, `components/nodes/**`,
   `components/edges/**`, `store/**`, `lib/**`) auf Session-Basis *und* Default-Branch gelesen;
   zusätzlich `docs/INVENTORY.md`, `agent.md`, `AGENTS.md`, ADRs (`docs/adr/0001–0006`),
   Design-Relaunch-Doku und die Playwright-Screenshots (`planer-1440/768/375`, hell/dunkel) ausgewertet.
2. **Normen-/Fachrecherche:** DIN EN 60617 (Symbole), DIN EN 61082 (Dokumentation/Schriftfeld),
   DIN EN 81346 / IEC 81346 (Referenzkennzeichnung), IEC 60446 (Aderfarben), Darstellungsarten der
   Elektrotechnik, VDE-0100-721-Bezug des Projekts (`lib/vde-standards.ts`).
3. **UX-/Visualisierungsrecherche:** Shneidermans Mantra *„Overview first, zoom and filter, details-on-demand“*
   [1](https://www.cs.umd.edu/hcil/trs/96-13/96-13.html), Clutter-Reduktion/Edge-Bundling
   [2](https://blog.tomsawyer.com/force-directed-edge-bundling-for-graph-visualization),
   React-Flow-spezifische Usability-Patterns (Gruppierung, kontextuelle Labels, Hierarchien)
   [9](https://www.synergycodes.com/webbook/building-usable-and-accessible-diagrams-with-react-flow).
4. **Wettbewerbs-/Vorbildanalyse:** VoltPlan, Wireframe (usewireframe), EPLAN/AutoCAD Electrical,
   KiCad/EasyEDA, draw.io, Victron-Dokumentation, yFiles-Feature-Set.
5. **Prototypbau:** 9 Ansichten über *einer* Beispieldatenquelle (22 Bauteile, 23 Kabel/52 Adern),
   um Optionen vergleichbar und entscheidbar zu machen statt sie nur zu beschreiben.

> **Hinweis zur Branch-Situation:** Die Session-Basis `375f485` enthält den Planer-Stand *vor* dem
> Design-Relaunch „Werft“ und vor der Routing-Mission (u. a. alte `Planner.tsx`-Struktur, Bezier-Kanten,
 *dauerhafte* Edge-Labels, kein Undo/Redo, kein Onboarding). Der Default-Branch `c504ce2` ist der
> produktive Stand. Alle Befunde unten beziehen sich, wo nicht anders vermerkt, auf `c504ce2`;
> Maßnahmen, die dort bereits umgesetzt sind, sind als **✅ vorhanden** markiert und werden *nicht* erneut vorgeschlagen.

---

## 2 · Ist-Zustand

### 2.1 Was der Planer heute bereits kann (Auswahl, Default-Branch)

| Bereich | Vorhanden | Stelle |
|---|---|---|
| Ansichtswechsel Elektrik/Wasser | ✅ Tabs + mobile Bottom-Tabs | `PlannerDashboard.tsx`, `PlannerInner.tsx` |
| Domänen-Filter 12V/230V/Solar (dimmen), Trassen-Highlight, Backbone-Rahmen | ✅ | `ui/CanvasDisplayOptions.tsx`, `utils/domainFilter.ts`, `utils/backbone*.ts` |
| Fokus-Nachbarschaft & Stromkreis-Trace (transient, selektionsgebunden) | ✅ | `utils/focusHighlight.ts`, `utils/circuitTrace.ts` |
| Auto-Layout (dagre, 5 Funktionsränge) + AutoWire mit VDE-Bemaßung | ✅ | `utils/layout.ts`, `lib/autoWire/*` |
| Orthogonales Kabel-Routing mit Qualitätsmetriken (Kreuzungen ≤ 2, Clearance ≥ 12 px) | ✅ | `components/edges/utils/*`, `docs/ROUTING-INVARIANTS.md`, ADR 0003 |
| Undo/Redo, Shortcuts (`?`-Overlay), Kontextmenü, Onboarding, Vorlagen | ✅ | `PlannerInner.tsx`, `ui/ShortcutOverlay.tsx`, `ui/CanvasContextMenu.tsx`, `OnboardingWizard.tsx`, `templates.ts` |
| Live-Validierung + WarningCenter + ExpertPanel | ✅ | `hooks/useLiveValidation.ts`, `ui/WarningCenter.tsx`, `ExpertPanel.tsx` |
| Responsive 3-Spalten-Layout, Slide-over-Inspector, Touch-Gesten | ✅ | `PlannerInner.tsx`, `hooks/useLongPressNodeDrag.ts` |
| Dark-Engineering-Theme (System-Präferenz), Statusbar, Metrics-Card | ✅ | `hooks/usePlannerTheme.ts`, ADR 0005, `ui/PlannerStatusBar.tsx`, `ui/FloatingMetricsCard.tsx` |
| Stückliste (Modal, Typ-Zähler + Kabelmeter je Querschnitt), PNG-Export | ✅ | `BOMModal.tsx`, `PlannerDashboard.onExportImage` |

### 2.2 Befunde — warum es trotzdem unübersichtlich wirkt

| ID | Befund | Beleg (Default-Branch) |
|----|--------|------------------------|
| **B1** | **Mehrlinien-Default:** jede 12-V-Verbindung = 2 Kanten (+/−), 230 V = 3 Adern. Bei 23 logischen Kabeln sind das 43 gezeichnete Linien (Beispielplan des Prototyps). Kein einpoliger Modus existiert. | `templates.ts` (`e-batt-plus`/`e-batt-minus`), `CableEdge.tsx` je Kante |
| **B2** | **Dauerlabels:** Kabel-Labels sind am Desktop permanent sichtbar; an Sammelsternen (Busbar, Sicherungskasten) überlagern sie sich. Kompakt-Modus gilt nur < sm. | `CableEdge.tsx` („am Desktop immer sichtbar, auf Handy nur bei Auswahl/Tap“) |
| **B3** | **Eine freie Fläche für alles:** 12 V, 230 V, Solar, PE, Leerrohr und Wasser teilen sich denselben Canvas; Ordnung entsteht nur implizit über dagre-Ränge. Zonen/Funktionsbereiche sind nicht sichtbar. | `utils/layout.ts` (`LAYOUT_TYPE_ORDER`), `FlowCanvas.tsx` |
| **B4** | **Ansichten = nur elektrisch/wasser + Dimm-Chips.** Filter *dimmen*, sie schaffen keine alternative Darstellungsform. Keine Tabellen-, Blatt-, Orts- oder Bilanzansicht. | `uiSlice.ts` (`viewMode: 'electric' \| 'water'`), `CanvasDisplayOptions.tsx` |
| **B5** | **Kennzahlen verstreut:** Metrics-Card, Expert-Panel, Warning-Center, Inspector, Toasts. Eine Energiebilanz je Stromkreis (Ah/Tag) gibt es nirgends als Liste. | `FloatingMetricsCard.tsx`, `ExpertPanel.tsx`, `WarningCenter.tsx` |
| **B6** | **Kein Dokumentationslevel:** Export = PNG des Viewports (`html-to-image`). Kein `@media print`, kein `@page`, kein PDF/SVG/CSV, kein Schriftfeld, keine Blätter. | `PlannerDashboard.tsx`, `app/globals.css` (kein Print-CSS), `package.json` (keine PDF-Lib) |
| **B7** | **Keine Referenzkennzeichnung:** keine Bauteil-Tags, keine Kabelnummern. Die Stückliste zählt Typen (`3x consumer`), nicht Positionen; Kabellängen nur summiert je Querschnitt. | `BOMModal.tsx`, `exportBOM()` |
| **B8** | **MiniMap ohne Semantik-Legende:** farblich nach Domäne, aber keine Zonen, keine Legende, kein Viewport-Kontexttext. | `FlowCanvas.tsx` (`nodeColor=…`), `domainFilter.ts` |
| **B9** | **Layout-Einbahnstraße:** nur dagre LR; Richtung nicht wählbar; „Aufräumen“ verwirft manuelle Ordnung; kein Layout-Memory je Ansicht; keine Swimlanes/Rails. | `utils/layout.ts`, `PlannerDashboard.runLayout` |
| **B10** | **Fokus-Werkzeuge transient:** Nachbar-Fokus & Trace hängen an Selektion/Hover; kein persistenter „nur dieser Stromkreis“-Modus, kein Isolieren. | `focusHighlight.ts`, `circuitTrace.ts` |
| **B11** | **Medienbruch Wasser↔Elektrik:** die Wasserpumpe existiert doppelt (Water-Node *und* 12-V-Consumer „Wasserpumpe“), ohne Verknüpfung; der 230-V-Teil ist nur dimmbar, nie eigenständig lesbar. | `templates.ts` (`cons-pump`), Water-Nodes |
| **B12** | **Keine Stromkreis-Sicht:** Zuordnung Sicherung → Verbraucher → Kabel → Verbrauch ist nur durch Graph-Lesen erschließbar. | — (fehlt) |
| **B13** | **Konstanter Detailgrad:** M8-1 hat Zoom-Stufen bewusst entfernt; jede Node rendert immer die volle Karte. Richtig zum Editieren, aber ohne Overview-Stufe skaliert die Fläche schlecht. | `ui/NodePresentation.tsx` (Kommentar M8-1) |
| **B14** | **Chrome-Konkurrenz:** Toolbar oben, Chips rechts oben, Metrics-Card/Expert-Panel unten, Statusbar unten, Help-FAB rechts unten — alle vier Ränder belegt; ab 1280 px zusätzlich dritte Spalte. | `PlannerInner.tsx`, `FlowCanvas.tsx`-Panels |
| **B15** | **Ableitungs-Perf:** Routing + Validierung laufen bei jeder Mutation; zusätzliche abgeleitete Sichten brauchen memoisierte Selektoren, sonst leidet die Drag-Performance. | `components/edges/utils/routingCache.ts`, `hooks/useLiveValidation.ts` |

**Zwischenfazit:** Die Hebel liegen in *Darstellungsformen und Leseebenen*, nicht in weiteren Canvas-Features.
Genau dort setzt der Maßnahmenkatalog an.

---

## 3 · Grundlagen & Leitplanken

### 3.1 Normen: Darstellungs- und Planarten als Vorbild für das View-System

Die Elektrotechnik trennt seit jeher **Darstellungsart** und **Planart** — beides sind *Ansichten auf dieselbe Anlage*:

| Konzept | Bedeutung | Übertrag auf den Planer |
|---|---|---|
| **Mehrpolig / einpolig** | alle Adern einzeln vs. eine Linie mit Adernzahl-Kerbe | Detail-Canvas (heute) vs. **Einlinien-Übersicht** (A1) |
| **Zusammenhängend / aufgelöst** | Bauteil mechanisch beisammen vs. nach Stromwegen gezeichnet („Stromwege möglichst gerade und kreuzungsfrei“) | Free-Canvas vs. **Stromschienen-Ansicht** (A2/B4) |
| **Übersichtsschaltplan** | nur wesentliche Teile, Energieverteilung | Default-Overview für Einsteiger |
| **Stromlaufplan** | vollständige Verdrahtung | Detail-Canvas |
| **Klemmen-/Kabelplan, Stromkreisliste** | tabellarische Zuordnungen | **Kabelliste** (A4), **Stromkreis-Raster** (A3) |
| **Installationsplan** | räumliche Lage im Grundriss | **Verlegeplan** (A5) |
| **Schriftfeld/Blätter** (DIN EN 61082) | Projekt, Blatt, Rev, Datum, Prüfer; Blattnavigation mit Querverweisen | **Blatt-/Druckansicht** (A7) |
| **Referenzkennzeichnung** (DIN EN 81346: `=A1+B2-K3:5`) | ein eindeutiges Kürzel pro Objekt, projektweit, in *allen* Dokumenten gleich | **Kabel-IDs & Bauteil-Tags** (C4) — dieselbe ID in Plan, Tabelle und Kabelmarker |

Quellen: Darstellungsarten und Normenüberblick [1](https://www.elekrechner.com/ratgeber/grundlagen/schaltplan-grundlagen),
Planarten im Überblick [3](https://wechseljetzt.de/stromlaufplan),
DIN-EN-61082-Anforderungen inkl. Schriftfeld und Blattaufbau [4](https://www.ksv-koblenz.de/blog/wie-erstellt-man-einen-schaltplan-nach-din-en-61082/),
IEC 81346 RDS („BOM, circuit diagram, terminal plan and labelling use the *same* reference designation“)
[5](https://www.ctb.co.at/en/knowledge/iec-81346-reference-designation-system/),
Cable Schedule als generiertes Tabellendokument [1](https://industrialmonitordirect.com/blogs/knowledgebase/electrical-cad-drawing-process-for-industrial-control-panels).

### 3.2 UX- & Visualisierungsprinzipien

- **Shneiderman-Mantra:** *Overview first, zoom and filter, details-on-demand* [1](https://www.cs.umd.edu/hcil/trs/96-13/96-13.html).
  Der Planer startet heute im Detail (= „details first“). Einlinien-Übersicht + Zoom-in auf Detail ist die norm- und UX-konforme Reihenfolge.
- **Clutter-Reduktion:** Linienmenge und Labeldichte sind die dominierenden Clutter-Faktoren in Node-Link-Diagrammen;
  Bündelung/aggregierte Kanten erhöhen Lesbarkeit deutlich [2](https://blog.tomsawyer.com/force-directed-edge-bundling-for-graph-visualization).
  Im Planer: Plus/Minus-Paare bündeln (A1/C6), Labels reduzieren (C2).
- **Progressive Disclosure & Hierarchisierung:** Gruppen ein-/ausklappbar halten, kontextuelle Labels statt Dauerlabels,
  wichtige Knoten visuell hervorheben [9](https://www.synergycodes.com/webbook/building-usable-and-accessible-diagrams-with-react-flow).
- **Gestalt/Chunking:** sichtbare Zonen (Common Region) gruppieren ohne Linien; Funktionsbänder machen die
  Systemlogik (Quelle→Laden→Speichern→Verteilen→Verbrauchen) ohne Lesen erfassbar (B3).
- **Farbsicherheit:** Rot/Grün-Kombinationen (heute u. a. PE grün vs. DC rot) sind für ~8 % der Männer problematisch;
  IEC 60446 nennt für DC Braun (+) / Hellblau (−), Praxis DC rot/schwarz, PE grün-gelb **mit Strich-Punkt-Muster**
  [3](https://industrialmonitordirect.com/blogs/knowledgebase/iec-cable-color-codes-for-industrial-automation-wiring).
  Empfehlung: Farbe **plus** Linienmuster **plus** Legende (C5).
- **Touch & A11y bleiben Pflicht:** alles Neue mit ≥ 44 px Targets, Tastatur, `aria-*` — der Standard, den
  `docs/INVENTORY.md` setzt, gilt auch für neue Ansichten.

### 3.3 Domänenlogik des Camper-Ausbaus

Fachlich korrekte Lesereihenfolge, an der sich Zonen, Layout-Ränge und Einlinien-Bänder orientieren sollten
(vgl. auch die 5-Ränge-Klassifikation in `utils/layout.ts` und Busbar-Best-Practice „schwere Lasten in die Mitte“
[3](https://www.thevanconversion.com/post/this-is-the-best-electrical-system-for-a-van-conversion-complete-overview)):

`Quellen (PV, Landstrom, Starter) → Laden (MPPT, DC-DC, AC-Lader) → Speichern (Batterie, Shunt) → Verteilen (Busbars, Sicherungskasten) → Verbrauchen (12 V / 230 V)` — plus Querschnittsthemen **PE/Masse** und **Verlegeort/Leerrohr** als eigene Ebenen.

---

## 4 · Wettbewerb & Vorbilder

| Werkzeug | Was es für Übersicht tut | Übernehmbar für Camp |
|---|---|---|
| **VoltPlan** (Browser-DC-Planer) | auto Wire-Gauge/Fuse, Überlast sofort rot markiert, Export PNG/SVG, Read-only-Share-Link, Vorlagen | Label-Reduktion + Share-Link (G4), „flag overloaded run in red“ als Dauerzustand statt Modal |
| **Wireframe / usewireframe** | „30+ safety validations“, BOM-Export, Templates, Workshop-Exports mit Branding | Review-Modus (A8) als Verkaufsargument; BOM als Positionen (F2) |
| **EPLAN / AutoCAD Electrical** | projektweite Referenzkennzeichnung, automatische Kabelnummern, Klemmenplan, Cable Schedule *aus der Schematik-Datenbank generiert*, Blattnavigation mit Querverweisen | A4/C4/F4/G1 — das Vorbild für „Plan und Liste sind zwei Sichten derselben DB“ |
| **KiCad / EasyEDA** | getrennte Editoren für Schema/Layout, Netzlisten-Ansicht, DRC-Panel | Trennung „Schema-Ansicht“ vs. „Orts-Ansicht“ (A5), DRC ≈ Live-Validierung (vorhanden) |
| **draw.io / Lucidchart** | Ebenen (Layers), Seiten/Blätter, Stencils | Ebenen-Schalter (Domänen als echte Ebenen statt Dimmen), Blätter (A7) |
| **Victron-Dokumentation** | systematische Einlinien-Systemdiagramme je Konfiguration | Stil-Vorbild für A1 (klare Blöcke, eine Linie, Pfeilrichtung Energiefluss) |
| **yFiles (SDK-Referenz)** | Edge-Bundling, Group-Folding, Zoom-to-Selection, indikatorbasierte Highlights | C6 (Bündel), B5 (Folding), E4/E6 |

Lehre: Alle reifen Werkzeuge besitzen **mehrere synchronisierte Sichten auf eine Datenquelle** — genau das fehlt Camp bisher.

---

## 5 · Maßnahmenkatalog

Legende Aufwand: **S** ≤ 1 Tag · **M** 2–4 Tage · **L** 1–2 Wochen · **XL** > 2 Wochen (jeweils inkl. Tests).
„Phase“ verweist auf die Roadmap in § 7. ✅ = bereits vorhanden (nicht erneut umsetzen).

### A · Umschaltbare Ansichten (View-Modi)

| ID | Maßnahme | Inhalt / Nutzen (Befund) | Aufwand | Phase |
|----|----------|--------------------------|---------|-------|
| A1 | **Einlinien-Übersicht (einpolig)** | Eine Linie pro Kabel mit Adern-Kerbe (2/3), Hauptleitungen fett, Zonenbänder der Funktionsränge; Detailgrad schaltbar („Struktur“ / „mit Werten“). Löst B1, B3, B12; −47 % Linien (43→23 im Beispielplan). | M | 1 |
| A2 | **Stromschienen-Ansicht (aufgelöst)** | +12-V-Schiene oben, 0-V unten, je Sicherungskreis ein senkrechter Abgang mit Sicherungssymbol; AC-Block separat. Kreuzungsfrei by construction; die Fehlersuche-Ansicht. Löst B3, B11, B12. | L | 2 |
| A3 | **Stromkreis-Raster** | Zeile pro Kreis: Sicherungswert, Verbraucher, Kabel (mm²/m/adrig), Ah/Tag, Status; Summenfuß mit Autarkie. Löst B5, B12. | S | 1 |
| A4 | **Kabelliste (Kabelverzeichnis)** | Sortierbare Tabelle: `-W01…`, Von/Nach, Funktion, Adern, mm², m, Sicherung, Stromkreis, Verlegeort, Status; CSV-Export; Zeile↔Kante synchron highlightbar. Löst B6, B7. | S–M | 1 |
| A5 | **Verlegeplan (Ortsebene)** | Grundriss + Dach-Ebene, Einbauorte, Leerrohr-Trassen mit Füllgrad; Brücke Plan↔Einbau. Löst B3, B11 (Ort), Conduit-Wissen wird räumlich. | L | 3 |
| A6 | **Energiebilanz** | Ah/Tag je Verbraucher vs. Ertrag (Solar/Fahrzeit/Landstrom), Saisonumschalter, Autarkie-Klartext. Löst B5. | S | 1 |
| A7 | **Blatt-/Druckansicht** | A4-Blätter 1 Übersicht / 2 Stromkreise / 3 Kabelliste, Schriftfeld (Projekt, Blatt, Rev, Datum, Prüfer, Norm), Blattnavigation, `@media print` + `@page`. Löst B6. | M | 2 |
| A8 | **Review-Modus** | WarningCenter → geführte Liste: je Hinweis Severity, Normverweis, „Zoom zum Bauteil“, Abhaken-Status; Fortschrittsanzeige „3 von 5 geprüft“. Löst B5, B14 (ein Ort statt verstreuter Hinweise). | S | 1 |
| A9 | **Fokus-/Isolationsmodus** | Persistenter Modus „nur dieser Stromkreis/diese Nachbarschaft“: Rest wird ausgeblendet (nicht nur gedimmt), Breadcrumb zeigt Kontext, Escape zurück. Löst B10. | S | 1 |
| A10 | **Sync-Split-Ansichten** | Graph + Tabelle (Master-Detail) nebeneinander; Auswahl synchronisiert beide Richtungen. Optional Elektrik+Wasser parallel. Löst B4, B11. | M | 2 |
| A11 | **Präsentations-/Zen-Modus** | Alle Panels/Chips/Cards aus, nur Plan + Legende; für Screenshots, Workshop, Beamer. Löst B14. | S | 1 |
| A12 | **Blattnavigation für große Pläne** | Auto-Paginierung in logische Blätter (DC-Verteilung, AC-Block, Solar) mit Querverweisen an den Schnittkanten (EPLAN-Prinzip). | L | 3 |
| A13 | **24-h-Simulationsansicht** | Zeitachse: Verbrauchskurve vs. Ladequellen über den Tag (Saison), Batterie-SoC-Verlauf. Macht Auslegung *erlebbar*. | M | 3 |
| A14 | **Vergleichsmodus (intern)** | Vorher/Nachher-Split für Layout-/Ansichtsentscheide und PR-Demos (im Prototyp enthalten). | S | optional |

### B · Layout & Anordnung

| ID | Maßnahme | Inhalt / Nutzen | Aufwand | Phase |
|----|----------|-----------------|---------|-------|
| B1 | **ELK.js ergänzen** | Layered-Layout mit Ports, orthogonalem Routing und *Compound/Subflow*-Layout; Web-Worker. Ergänzt die eigene Routing-Engine dort, wo Gruppen ins Spiel kommen (B5). | M | 2 |
| B2 | **Layout-Richtung wählbar** | LR (heute) / TB; je Ansicht & Plan persistiert. TB passt besser für Stromschienen-ähnliche Lesarten und hohe Pläne. | S | 1 |
| B3 | **Funktionszonen sichtbar** | Hintergrund-Bänder/-Regionen mit Labels (Quellen…Verbrauchen), in Einlinien- und Detailansicht; Nodes snapen in ihre Zone. Löst B3. | M | 1 |
| B4 | **Rail-Layout-Option** | Auto-Layout-Variante „Bus-Rails“: Plus/Minus als durchgehende Schienen, Abgänge senkrecht — Vorstufe zu A2, aber editierbar im Canvas. | L | 2 |
| B5 | **Kollabierbare Gruppen** | Subflows: „Solar-Array“, „230-Block“, „Sicherungskasten + Kreise“; zusammengefasst = Überblick, aufgeklappt = Detail. | M | 2 |
| B6 | **Layout-Memory** | Manuelle und automatische Anordnung getrennt speichern; Umschalter „mein Layout / aufgeräumt“ ohne Datenverlust. Löst B9. | S | 1 |
| B7 | **Align & Distribute + Helper Lines** | Ausrichten/Verteilen für Auswahl, Führungslinien beim Drag (RF-Beispiele). | S | 2 |
| B8 | **Drop-Kollisionsfix** | Bestehende `collision.ts` nutzen: beim Drop überlappende Nodes automatisch verschieben. | S | 1 |

### C · Informationsdesign auf der Fläche

| ID | Maßnahme | Inhalt / Nutzen | Aufwand | Phase |
|----|----------|-----------------|---------|-------|
| C1 | **Detailgrad-Stufen (semantischer Zoom)** | Overview: Symbol+Name; Medium: +Kernwert; Detail: volle Karte — *nutzersteuerbar* (nicht zoom-automatisch, damit M8-1-Erkenntnis gilt). Löst B13. | M | 2 |
| C2 | **Label-Dichte-Setting** | Default: Labels nur an Hauptleitungen + bei Hover/Selektion; Stufen „aus / kern / voll“. Sofort weniger Overplotting. Löst B2. | S | 0 |
| C3 | **Symbole & Kurzcodes im Canvas** | `NodeSymbol`-Icons + Codes (BAT, MPPT, FUSE …) in Overview-Stufe und MiniMap-Tooltips. | S | 1 |
| C4 | **Kennzeichnung sichtbar schaltbar** | Kabel-IDs `-W01…`, Bauteil-Tags (`-G1`, `-F1`, `-A1`) optional einblenden; IDs entstehen automatisch aus der Graph-Topologie (IEC-81346-Prinzip). Löst B7. | M | 2 |
| C5 | **Farb-+Muster-System & Legende** | Funktion primär (DC/AC/Solar/PE), Polarität sekundär über Muster (Minus gestrichelt, PE Strich-Punkt); permanente, einklappbare Legende; rot-grün-sicher. | S | 1 |
| C6 | **Adern-Bündelung an Sammelsternen** | Plus/Minus-Paar als *eine* Bündellinie mit Zähl-Kerbe, aufklappbar auf Einzeldarstellung (Kante ↔ Paar). Kernstück von A1 im Detail-Canvas. | M | 2 |
| C7 | **Status als Badge** | Warnungen am Node als kleine Ikone mit Zähler statt Farbfläche; Klick → Review-Modus (A8). | S | 1 |
| C8 | **Einheiten-/Typo-Policy** | Mono für alle Werte (existiert teils), Einheiten konsistent über `lib/units`; Label-Hierarchie Name > Wert > Meta. | S | 1 |

### D · App-Layout, Panels & Navigation

| ID | Maßnahme | Inhalt / Nutzen | Aufwand | Phase |
|----|----------|-----------------|---------|-------|
| D1 | **Rechtes Dock mit Tabs** | Eigenschaften \| Prüfhinweise \| Stückliste \| Fachwissen — ein Ort statt Floating-Cards. Löst B5, B14. | M | 2 |
| D2 | **Linkes Panel: Katalog + „Im Plan“** | Zweiter Tab listet platzierte Bauteile (Suche, Jump-to, Zähler je Typ). Löst Orientierung bei vielen Nodes. | S | 1 |
| D3 | **Command-Palette (Strg+K)** | Alle Aktionen + Jump-to-Element typisierbar; entlastet Toolbar. | M | 2 |
| D4 | **Toolbar konsolidieren** | Primär: Ansicht, Auto-Layout, Undo; kontextsensitiv bei Selektion; Rest ins Menü. Löst B14. | S | 1 |
| D5 | **Statusbar ausbauen** | Ansicht-Name, aktive Filter, Zoom, Umfang, Speicherzeitpunkt (CAD-Anmutung, existiert als Basis). | S | 1 |
| D6 | **Breadcrumb bei Fokus** | „Plan › Verteilung › F2 Kühlschrank“ mit Zurück-Ebene. | S | 2 |
| D7 | **Onboarding um Ansichtswahl erweitern** | „Wie möchtest du starten? Freiheit / geführt / Tabelle“ — setzt Default-View je Nutzertyp. | S | 2 |

### E · Filter, Fokus & Suche

| ID | Maßnahme | Inhalt / Nutzen | Aufwand | Phase |
|----|----------|-----------------|---------|-------|
| E1 | **Suche über platzierte Bauteile** | Suchfeld findet Nodes *im Plan*, Jump + Highlight + optional Fokus. | S | 1 |
| E2 | **Filter mit Zählern** | Typ/Zone/Status-Chips („6 Verbraucher“, „2 Warnungen“) statt reiner Domänen-Chips. | S | 1 |
| E3 | **Hover am Sicherungskasten** | hebt zugehörige Kreiskanten hervor (Trace-Logik reuse). | S | 1 |
| E4 | **Trace als Toggle** | „Pfad verfolgen“ persistenter Modus (circuitTrace reuse), nicht nur an Selektion gebunden. Löst B10. | S | 1 |
| E5 | **Legende permanent** | einklappbares Legenden-Panel (Farben, Muster, Symbole, Zonen). | S | 1 |
| E6 | **MiniMap-Semantik** | Zonen-Rechtecke, deutlichere Viewport-Box, Domänen-Legende daneben. | S | 1 |

### F · Tabellen & Listen

| ID | Maßnahme | Inhalt / Nutzen | Aufwand | Phase |
|----|----------|-----------------|---------|-------|
| F1 | **Kabelliste** | siehe A4 (Sortierung, Filter, CSV, Sync-Highlight). | S–M | 1 |
| F2 | **Stückliste als Positionen** | jede Node/Edge als Position mit Menge, Spec, VDE-Hinweis; Summen je Querschnitt; Einkaufs-Export (CSV/Markdown). Löst B7. | M | 2 |
| F3 | **Stromkreisliste mit Reserve** | je Kreis: Ist-Ah, Sicherung, Reserve bis Kastengrenze; „welche Sicherung hat noch Luft?“. | S | 1 |
| F4 | **Anschluss-/Klemmenliste** | je Bauteil: welche Ader (ID, Funktion) an welchem Handle; Grundlage für Beschriftungsetiketten. | M | 3 |

### G · Ausgabe: Druck, Export, Teilen

| ID | Maßnahme | Inhalt / Nutzen | Aufwand | Phase |
|----|----------|-----------------|---------|-------|
| G1 | **Print-CSS + A4-Blätter** | siehe A7; `@page { size: A4 }`, Druck scope auf Blatt-Ansicht. | M | 2 |
| G2 | **SVG-Export** | Vektor statt Pixel-PNG (skalierbar für Doku/Forum). | S | 2 |
| G3 | **PDF via Browserdruck** | ohne Dependency; „Als PDF speichern“ = Strg+P-Dialog auf Blattansicht. | S | 2 |
| G4 | **Share-Link** | Plan als komprimierter State in der URL (read-only Ansicht); gut für Forums-Support. | M | 3 |
| G5 | **JSON/DXF-Export** | Maschinenlesbar für Werkstatt/Weiterverarbeitung. | L | optional |

### H · Technik, Performance, Qualität

| ID | Maßnahme | Inhalt / Nutzen | Aufwand | Phase |
|----|----------|-----------------|---------|-------|
| H1 | **View-Registry + pure Derivationen** | Architektur § 6: `planView` im UI-Slice, `derive*`-Funktionen, Read-only- vs. Edit-Views. Fundament für A/*. | M | 1 |
| H2 | **Memoisierte Selektoren** | abgeleitete Sichten (Single-Line, Kreise, Kabelliste) als cacheable Selectors; Invalidierung bei Graph-Änderung. Löst B15. | M | 1 |
| H3 | **Render-Budget prüfen** | `onlyRenderVisibleElements`/Virtualisierung für 100+ Nodes evaluieren. | S | 2 |
| H4 | **View-Zustand persistieren** | `persistence.ts` um `planView`, Label-Dichte, Layout-Memory je Plan erweitern. | S | 1 |
| H5 | **Tests je Ansicht** | Property-Tests: Single-Line-Bijektion (keine Information verloren), Kreis-Vollständigkeit; E2E-Screenshots je Ansicht (CI-Infra existiert). | M | 1–2 |
| H6 | **A11y je Ansicht** | Tastatur-Navigation in Tabellen, `aria-current` an View-Tabs, Fokus-Falle in Docks; INVENTORY-Zeile je neuem Element. | S | laufend |

---

## 6 · Architektur-Vorschlag: das View-System

**Prinzip:** *Ein Graph, viele Sichten.* Der Store bleibt Quelle; Ansichten sind entweder
**(a) Derivationen** (read-only, eigene Renderer) oder **(b) Projection-Configs** (derselbe ReactFlow-Canvas,
andere Nodes/Edges/Styles). Editierbarkeit bleibt im Detail-Canvas; alle anderen Sichten sind primär Lesesichten,
ausgewählte (Kabelliste-Werte, Stromkreis-Umbenennung) dürfen zurückschreiben.

```ts
// store/slices/uiSlice.ts — Erweiterung (Skizze)
export type PlanView =
  | 'detail'      // heutiger Canvas (mehrpolig, editierbar)
  | 'singleline'  // einpolige Übersicht            (A1)
  | 'rails'       // aufgelöste Stromschienen        (A2)
  | 'circuits'    // Stromkreis-Raster               (A3)
  | 'cables'      // Kabelliste                      (A4)
  | 'floor'       // Verlegeplan                     (A5)
  | 'energy'      // Energiebilanz                   (A6)
  | 'sheet';      // Druckblätter                    (A7)

planView: PlanView;              // persistiert (persistence.ts)
setPlanView: (v: PlanView) => void;
labelDensity: 'off' | 'core' | 'full';   // C2
layoutMemory: 'manual' | 'auto';         // B6
```

```ts
// components/planner/views/derive.ts — pure Funktionen, testbar (Skizze)
export type SingleLineEdge = { id: string; a: string; b: string; conductors: 1|2|3;
  cs: number; len: number; fuse?: number; domain: Domain; circuit?: string };

export function deriveSingleLine(nodes: Node[], edges: Edge<CableEdgeData>[]): SingleLineEdge[] {
  const key = (e: Edge) => [e.source, e.target].sort().join('→') + ':' + (e.sourceHandle?.includes('minus') ? 'neg' : 'pos-pair');
  // Plus/Minus-Paare derselben Verbindung zu EINER einpoligen Kante mergen,
  // AC-L/N/PE zu einer 3-adrigen; PE-Einzelleitungen bleiben 1-adrig.
  ...
}
export function deriveCircuits(nodes, edges): CircuitRow[]   // ab Sicherungskasten-Outgoing
export function deriveCableSchedule(nodes, edges): CableRow[] // inkl. auto IDs -W01… (stabil sortiert)
```

**Renderer-Strategie:**
- `detail`, `singleline` (editier-light), `rails`-Vorstufe: ReactFlow (`singleline` als Projection: gemergte Edges, eigener Edge-Type mit Adern-Kerbe).
- `rails`, `floor`, `energy`, `sheet`: eigene SVG/HTML-Renderer **ohne** ReactFlow (kein Drag-Ballast, druckfreundlich).
- `circuits`, `cables`: HTML-Tabellen mit Selection-Sync in den Store (`setSelectedNodes`), sodass „Zeile klicken = Node fokussieren“ gratis funktioniert (`focusElement` existiert).

**Sync-Regel:** Selektion ist ansichtübergreifend dieselbe Store-Größe; Tabellenzeilen und Graph-Nodes
markieren sich gegenseitig. View-Wechsel erhält Selektion, wo sinnvoll (A9 bricht sie bewusst).

**Testbarkeit:** jede `derive*`-Funktion ist pure → Property-Tests (Vitest-Konvention des Repos):
*Rundlauf* (detail → singleline → detail verlustfrei), *Vollständigkeit* (jede Edge genau in einem Kreis/einer Kabelzeile),
*Stabilität* (IDs ändern sich nicht bei Layout-Änderung).

---

## 7 · Roadmap & Priorisierung

**Bewertungsmatrix (Wirkung auf Übersichtlichkeit × Implementierungsaufwand):**

| | Wirkung hoch | Wirkung mittel |
|---|---|---|
| **Aufwand S** | C2, A3, A6, A8, A9, E1–E5, B6, D2, D4 | C7, C8, D5, B8 |
| **Aufwand M** | **A1**, A4/F1, A7/G1, D1, C6, B3 | C1, C4, F2, D3, B1, A10 |
| **Aufwand L+** | **A2**, A5 | B4, A12, G5 |

**Phase 0 — Quick Wins (≤ 1 Woche, ohne Architektur):**
C2 Label-Dichte · E5 Legende · D4 Toolbar-Konsolidierung · A11 Zen-Modus · B6 Layout-Memory · C7 Status-Badges.
*Akzeptanz:* Screenshot 1440 px: kein Label-Overlapping am Busbar-Stern; Canvas-Ränder ≥ 1 Seite chrome-frei.

**Phase 1 — View-Fundament + die vier Lesesichten (2–3 Wochen):**
H1/H2/H4 Architektur · **A1 Einlinie** · **A3 Stromkreise** · **A4/F1 Kabelliste** · **A6 Energiebilanz** · A8 Review · A9 Fokus · E1/E2 Suche+Filter · B3 Zonenbänder · H5 Tests.
*Akzeptanz:* View-Leiste mit 6 Sichten, persistiert; Single-Line zeigt ≤ 55 % der Linien des Detail-Canvas bei identischer Information (Property-Test; Beispielplan: 23 von 43); E2E-Screenshots je Ansicht in CI.

**Phase 2 — Tiefe Darstellungsformen & Chrome (3–4 Wochen):**
A2 Stromschienen · B4 Rail-Layout · B5 Gruppen · C1 Detailgrade · C4 Kennzeichnung · C6 Bündel · A7/G1–G3 Blätter+Druck+SVG/PDF · D1 Dock · D3 Palette · A10 Sync-Split · B1 ELK · F2 Stückliste-Positionen.
*Akzeptanz:* Ausdruck Blatt 1–3 als PDF ohne Chrome; Stromschienen-Ansicht kreuzungsfrei für Referenzplan (`routingScenarios.ts`); Dock ersetzt ≥ 2 Floating-Cards.

**Phase 3 — Orts- & Dokumensebene (optional, nach Nutzerfeedback):**
A5 Verlegeplan · A12 Blattnavigation · A13 24-h-Simulation · F4 Klemmenliste · G4 Share-Link · G5 DXF.
*Akzeptanz:* Verlegeplan nutzt dieselbe Grafiksprache wie der Dach-Planer; Share-Link rendert read-only in allen Ansichten.

**Messgrößen für Erfolg (vorher/nachher messbar):**
Linien pro Plan (Ziel ≤ 55 % im Default-Overview) · Label-Dichte (Labels/100 px²) · Kreuzungen (bestehende Metrik) ·
„Zeit bis Antwort: Welche Sicherung versorgt den Kühlschrank?“ (Nutzertest, Ziel < 5 s) · Druck/PDF-Existenz (binär).

---

## 8 · Prototyp (Begleitmaterial dieser Recherche)

`docs/planer-uebersicht/prototyp/index.html` — **eine** HTML-Datei, ohne Build, lokal öffnbar oder statisch servbar
(z. B. `python3 -m http.server --directory docs/planer-uebersicht/prototyp`).

Enthaltene Ansichten (Tabs oben, rechts je Ansicht ein Info-Drawer mit Befund-Bezug, Norm, Aufwand, Repo-Stellen):

1. **Status quo** — mehrlinig mit Dauerlabels und Domänen-Chips (die heute existierenden Filter funktionieren im Prototyp).
2. **Einlinien-Übersicht** — einpolig, Adern-Kerben, Zonenbänder, Detailgrad „Struktur / mit Werten“.
3. **Stromschienen (aufgelöst)** — +12-V-/0-V-Schiene, Sicherungsabgänge, separater AC-Block.
4. **Stromkreise** — Sicherungsraster mit Ah/Tag und Saisonumschalter.
5. **Kabelliste** — sortierbare Tabelle mit `-W`-IDs und CSV-Kopie.
6. **Verlegeplan** — Grundriss + Dach-Ebene mit Leerrohr-Trassen.
7. **Energiebilanz** — Verbrauch vs. Ertrag, Sommer/Winter, Autarkie.
8. **Druckblatt** — A4 mit Schriftfeld, Blättern 1–3, `Strg+P`-Scope.
9. **Vergleich** — Split mehrlinig vs. einpolig inkl. Linienzahl-Delta.

Beispieldaten: 22 Bauteile, 23 logische Kabel = 52 Adern (realistischer Mid-Size-Ausbau) — bewusst dieselbe
Quelle für alle Ansichten, um das Derivations-Prinzip (§ 6) zu demonstrieren.
**Grenzen:** Der Prototyp ist Entscheidungs- und Kommunikationsmedium, kein Produktcode: kein Routing-Engine-Ersatz,
keine Editierung, vereinfachte Symbolik. Die Linienführung im Status quo ist schematisch, nicht die echte Orthogonal-Engine.

---

## 9 · Offene Entscheidungen (Product)

1. **Default-Ansicht nach Onboarding:** Detail-Canvas (Kontinuität) oder Einlinien-Übersicht (Lesbarkeit first)? Empfehlung: Einlinie für Einsteiger-Vorlagen, Detail für Profi-Modus.
2. **Editierbarkeit der Einlinien-Ansicht:** read-only mit „Zum Detail“-Sprung (einfacher) oder editier-light (Nodes ziehen, Werte ändern)?
3. **Wasser-Integration:** eigene Ansicht bleiben lassen oder Pumpen/etc. als Domäne in Elektrik-Ansichten spiegeln (B11)?
4. **Kennzeichnungstiefe:** nur Kabel-IDs (`-W01`) oder volles IEC-81346-Schema (`=C1+B2-F1:3`) für Profi-Modus?
5. **Blatt-Formate:** A4 hoch (Forum/Druck) plus A3 quer (Werkstatt-Wand) als Option?

---

## 10 · Quellen

**Repo (Default-Branch `c504ce2`):** `docs/INVENTORY.md`, `agent.md` (Missionen D-1…D-9, R-1…R-11), `AGENTS.md`,
`docs/adr/0002–0006`, `docs/ROUTING-INVARIANTS.md`, `components/planner/**`, `components/edges/utils/**`, `store/slices/*`,
Screenshots `docs/design/relaunch/*/planer-*.png`.

**Normen & Fachliteratur (Web):**
- Darstellungsarten/Planarten: [elekrechner.com](https://www.elekrechner.com/ratgeber/grundlagen/schaltplan-grundlagen), [wechseljetzt.de](https://wechseljetzt.de/stromlaufplan), [IKZ-PDF](https://www.ikz.de/uploads/media/329--12-13.pdf)
- DIN EN 61082/81346: [ksv-koblenz.de](https://www.ksv-koblenz.de/blog/wie-erstellt-man-einen-schaltplan-nach-din-en-61082/), [ctb.co.at (IEC 81346 RDS)](https://www.ctb.co.at/en/knowledge/iec-81346-reference-designation-system/)
- Cable Schedule/Wire Numbering (EPLAN-Praxis): [industrialmonitordirect.com](https://industrialmonitordirect.com/blogs/knowledgebase/electrical-cad-drawing-process-for-industrial-control-panels)
- Aderfarben IEC 60446: [industrialmonitordirect.com](https://industrialmonitordirect.com/blogs/knowledgebase/iec-cable-color-codes-for-industrial-automation-wiring), [cableizer.com](https://www.cableizer.com/documentation/c_color/)
- UX/Visualisierung: [Shneiderman, „The Eyes Have It“](https://www.cs.umd.edu/hcil/trs/96-13/96-13.html), [Edge-Bundling-Survey-Einführung](https://blog.tomsawyer.com/force-directed-edge-bundling-for-graph-visualization), [Synergy Codes: usable diagrams with React Flow](https://www.synergycodes.com/webbook/building-usable-and-accessible-diagrams-with-react-flow)
- React Flow Layouting/Subflows/Expand-Collapse: [reactflow.dev/learn/layouting](https://reactflow.dev/learn/layouting/layouting), [Sub Flows](https://reactflow.dev/learn/layouting/sub-flows), [ELK-Optionsreferenz (KT-Doc)](https://gist.github.com/PCoelho/8496d811ef9c0c66526e2d9cc316c7a2)
- Domänenwissen Camper: [voltplan.app (RV-Schematic-Guide)](https://voltplan.app/blog/rv-wiring-schematic-from-scratch), [thevanconversion.com (Busbar-Best-Practice)](https://www.thevanconversion.com/post/this-is-the-best-electrical-system-for-a-van-conversion-complete-overview), [usewireframe.com](https://usewireframe.com/commercial)
