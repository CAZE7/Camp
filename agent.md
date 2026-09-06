# Übergabe: GitHub-Pages-Deploy

Dieses Dokument enthält nur Aufgaben, die mit den Rechten des aktuellen Agents
nicht abgeschlossen werden können. Verbindliche Projektregeln stehen in
`AGENTS.md`; der ausführbare Prompt liegt in
`docs/ci/pages-deploy-handoff-prompt.md`.

## Befund am 02.09.2026

- Default-Branch: `feature/react-flow-cable-editor-7322653268250495059`.
- Pages nutzt `build_type: workflow` und diesen Branch als Quelle.
- Die Umgebung `github-pages` erlaubt aktuell genau diesen Branch.
- PR [#377](https://github.com/CAZE7/Camp/pull/377) enthält den geprüften
  Patch. Der Push des echten Workflow-Fixes wurde abgelehnt:
  `refusing to allow a GitHub App to create or update workflow ... without
workflows permission`.

## Offene Aufgaben

- [x] **A-1 Workflow-Fix anwenden:** Den Patch aus PR #377 als echte Änderung
      in `.github/workflows/deploy.yml`, `docs/ci/workflows/deploy.yml` und
      `scripts/ci/workflows.test.ts` übernommen. Dabei `branches` auf den aktuellen
      Default-Branch und `cancel-in-progress: false` beibehalten.
- [x] **A-2 GitHub-Einstellungen geprüft:** Unter _Settings → Pages_ `GitHub
Actions` und aktiver Default-Branch als Quelle bestätigt.
- [ ] **A-3 Schutzregeln prüfen:** Für den aktiven Default-Branch Pull Request,
      Review und die beiden CI-Checks verpflichtend machen. Keine Regel lockern,
      nur damit ein roter Check grün wird.
- [x] **A-4 Nachweis führen:** Deploy beobachten und Startseite sowie
      mindestens ein `/_next/static/...`-Asset mit HTTP 200 prüfen.
- [x] **A-5 Aufräumen:** Temporäre `patches/2026-09-01-pages-deploy-fix.patch`
      entfernt.

## Design-Relaunch „Werft“ (Autodesk-Niveau)

Zielbild: ruhige, präzise CAD-Optik — neutrale Flächen, 1-px-Linien, ein Akzent
(`--oxide`), technische Typo (Inter + IBM Plex Mono), hell und dunkel.
Erweitert M11-1 aus AGENTS.md auf die gesamte Seite. Pro Aufgabe ein Commit;
Vorher/Nachher-Screenshots (375/768/1440 px) im PR — Merge erst nach optischer
Freigabe durch den Nutzer.

- [x] **D-1 Token-Fundament:** `app/globals.css` als einzige Farbquelle:
      Surface-Skala (canvas/panel/raised), `--rule` für Linien, `--oxide` als
      Akzent, Semantik-Tokens (ok/warn/error), `.dark`-Variante. Tailwind-Theme
      mappt alle Tokens. Abnahme: Code-Suche findet keine Hex-/rgb-Werte
      außerhalb von globals.css; hell+dunkel konform zu WCAG AA.
- [x] **D-2 Typo- & Raster-System:** Type-Scale 12/13/14/16/20/24/32; Inter für
      UI, Outfit nur für Display-Headlines, IBM Plex Mono für Werte/Maße.
      4-px-Abstandsraster in tailwind.config.ts dokumentiert und angewendet.
- [x] **D-3 App-Shell:** SiteHeader als schmale Top-Bar (h-12, sticky, Mark +
      Nav mit aktivem Unterstrich, Aktionen rechts), SiteFooter konsistent;
      einheitlicher Container und Seitenrhythmus über `/`, `/tools/*`,
      `/guides/*`, Impressum, Datenschutz.
- [x] **D-4 Planer-Canvas:** dunkle neutrale Zeichenfläche mit Punktraster;
      Node-Cards neu (1-px-Border, Radius 4, Icon + Titel + Mono-Spec-Zeile,
      Status als 2-px-Akzentleiste); Handles 12 px mit Hover; Kanten 2 px,
      abgerundet; Selektion in Akzent; MiniMap/Controls im gleichen Stil.
- [x] **D-5 Panel-System:** Sidebar/Inspector/ExpertPanel/PlannerDashboard mit
      einheitlichem Aufbau: Panel-Header (h-10, Label 11 px uppercase),
      Sektionen mit Divider, Padding 12/16, Buttons im Toolbar-Stil.
      Inspector-Breakpoints bleiben (Slide-over < 1280 px, Dock 288/320 px).
- [x] **D-6 Toolbar & Shortcuts:** Icon-Toolbar (lucide) mit Tooltips und
      Shortcut-Badges; `?`-Overlay (M11-3) im gleichen Design.
- [x] **D-7 Startseite & Aufbau:** Hero mit klarem Nutzenversprechen, drei
      Tool-Karten (Elektrik/Dach/Heizung) im selben Card-System, Guide-Teaser;
      klare Hierarchie (ein H1, konsistente CTAs, einheitliche Sektionen).
- [x] **D-8 Zustände & Micro-UX:** focus-visible-Ringe in Akzentfarbe,
      150-ms-Transitions, Empty-States, Skeletons, gestaltete ErrorBoundary.
- [x] **D-9 Visuelle Regression:** Playwright-Screenshots der Kernrouten
      (hell+dunkel, 375/768/1440 px) als CI-Check; Lighthouse A11y ≥ 95.

## Routing-Qualität Elektroplaner

Ziel: Kabelverlegung logisch und ruhig — Flussrichtung, wenige Biegungen,
keine U-Turns, keine vermeidbaren Kreuzungen. Baut auf M11-2/M11-3 aus
AGENTS.md auf. Pro Aufgabe ein Commit; jeder Fix mit Regressionstest;
Vorher/Nachher-Screenshots (375/768/1440 px) im PR — Merge erst nach
optischer Freigabe durch den Nutzer.

- [x] **R-1 Routing-Messung zuerst:** Qualitäts-Dashboard für Referenzpläne in
      `routingScenarios.ts`: Gesamtkabellänge vs. Manhattan-Optimum (Ziel
      ≤ 1,3×), Biegungen und U-Turns je Kante, Kreuzungen (Ziel ≤ 2),
      Clearance-Verletzungen (< 12 px). Report als Vitest-Modul plus Tabelle
      im PR. Keine Fix-Aufgabe gilt ohne Metrik-Nachweis als fertig.
- [x] **R-2 Kostenfunktion kalibrieren:** `BEND_COST` (80) und `U_TURN_COST`
      (400) gegen die Distanzeinheiten des Hanan-A* prüfen und Einheiten
      dokumentieren. Invariante: Gerade < L < Z < Zickzack; U-Turn ist immer
      die teuerste lokale Entscheidung. Tests in
      `orthogonalRouting.invariants.test.ts`.
- [x] **R-3 Fallback härten:** Bei Erreichen von `MAX_EXPANSIONS` (48 000)
      muss der Fallback orthogonal bleiben, Clearance halten und geloggt
      werden (Warnung plus Zähler). Fallback-Quote im Referenzplan = 0.
      Budget-/Grid-Strategie anpassen, statt Qualität fallen zu lassen.
- [x] **R-4 Kreuzungs-Scan skalierbar:** Das Überspringen ab
      `CROSSING_SCAN_EDGE_LIMIT` entfällt — Spatial-Index (Grid/Quadtree)
      statt O(n²)-Ausstieg. Kreuzungen ≤ 2 gilt für Pläne jeder Größe;
      Regressionstest mit einem 100+-Kanten-Plan.
- [x] **R-5 Trassen-System vereinheitlichen:** Parallele Trassen (±40/±80 px)
      und `PARALLEL_LANE_SPREAD` (16) zu einem Lane-System konsolidieren;
      `parallelLaneOffset` und `polarityPathOffset` nutzen dieselbe Logik.
      Gleiche Korridore bündeln statt streuen.
- [x] **R-6 Globale Nachoptimierung:** Nach dem Einzel-Routing ein
      `routeAll`-Pass: Kantenreihenfolge an Ports tauschen, um Kreuzungen
      aufzulösen; gemeinsame Segmente auf gemeinsame Lanes ausrichten;
      `simplifyWaypoints` und `dedupe` verifizieren (kein Punkt-Verlust,
      keine Kollisionsänderung). Deterministische Reihenfolge, Test mit
      fixem Seed.
- [x] **R-7 Port- und Stub-Logik:** Handle-Seite nach Flussrichtung wählen
      (Quelle → Verteilung → Verbraucher); `ROUTE_MIN_STUB` (24 px) immer
      einhalten; kein U-Turn direkt am Handle. Test: kein Stub < 24 px,
      kein Richtungswechsel im Stub-Bereich.
- [x] **R-8 AutoWire-Platzierung (M11-2):** Knoten in Flussrichtung auf dem
      16-px-Raster platzieren, mit konsistenten Abständen; optional
      dagre-Auto-Layout direkt nach dem Verdrahten. Metrik als Test:
      Kabellänge ≤ 1,3× Manhattan-Optimum, keine Kante mit > 2
      Richtungswechseln ohne Grund.
- [x] **R-9 Cache- und Re-Routing-Korrektheit:** `routingCache` und
      `cableRouteStore` bei Move/Resize/Delete/Connect invalidieren; keine
      veralteten Pfade nach Undo/Redo. Re-Route während des Draggens
      (gedrosselt), damit der Pfad live logisch bleibt. Tests für jede
      Invalidierungsquelle.
- [x] **R-10 Hindernis-Präzision:** `NODE_FALLBACK_WIDTH/HEIGHT` (192/120)
      durch gemessene Node-Bounds ersetzen; Labels und Handles in die
      Hindernis-Rechtecke aufnehmen; `OBSTACLE_MARGIN` (14) konsistent zum
      Clearance-Ziel ≥ 12 px. Test: keine Kante schneidet einen Node
      inklusive Label.
- [x] **R-11 Visuelle Abnahme & Doku:** Routing-Gallery um reale Nutzerpläne
      (vorher/nachher) erweitern; Playwright-Screenshots (375/768/1440 px)
      als CI-Check; Routing-Invarianten in `docs/` dokumentieren
      (Kostenmodell, Lanes, Clearance). Merge erst nach optischer Freigabe.

## Stack-Modernisierung

Ziel: veraltete oder überholte Abhängigkeiten auf die aktiv gepflegte Linie
heben, ohne Verhalten zu ändern (Befund: Code-Analyse vom 05.09.2026). Pro
Aufgabe ein Commit; Abnahme über `npm run check` plus Playwright-Baselines
(375/768/1440 px, hell+dunkel); kein Merge bei unbeabsichtigtem visuellem
Diff.

- [ ] **S-1 React Flow 12 (`@xyflow/react`):** `reactflow@^11` ist die alte,
      nur noch gepflegte Paketlinie; v12 läuft als `@xyflow/react` weiter und
      bringt React-19-Support und Render-Verbesserungen am Canvas. Migration
      nach offiziellem Guide: Imports (`store/slices/persistence.ts`, Hooks,
      `CableEdge`), `nodeTypes`/`edgeTypes` und CSS-Einbindung prüfen.
      Abnahme: `npm run check` grün; Drag, Auto-Wire und Undo/Redo unverändert;
      Routing-Invarianten-Tests und visuelle Baselines ohne Diff.
- [ ] **S-2 Tailwind CSS v4:** v3.4 auf v4 (Oxide-Engine, schnellere Builds,
      CSS-first-Theme). Upgrade-Codemod laufen lassen; Tokens aus
      `tailwind.config.ts` nach `@theme` in `globals.css` überführen (bleibt
      einzige Farbquelle, D-1); `tailwindcss-animate` durch `tw-animate-css`
      ersetzen. Risiko: geänderte Border-/Ring-/Shadow-Defaults. Abnahme:
      Baselines aktualisiert und optisch freigegeben; Build-Zeit
      vorher/nachher notiert.
- [ ] **S-3 lucide-react aktualisieren:** 0.446.x (Stand 09/2024) auf die
      aktuelle 1.x-Linie. Umbenannte Icons über Release-Notes und Typecheck
      finden. Abnahme: Build, Tests und visuelle Baselines grün; kein
      Bundle-Wachstum (Tree-Shaking prüfen).
- [ ] **S-4 Bild-Export modernisieren:** `html-to-image` (nur PNG-Viewport)
      gegen SnapDOM/modern-screenshot als Drop-in prüfen — Aufrufstelle in
      `PlannerDashboard.tsx` ist bereits lazy und im Test gemockt. Zusätzlich
      Print-Stylesheet (`@media print`, `@page`) für den Plan (Befund B6).
      Abnahme: Export-E2E grün; Export-Zeit vorher/nachher gemessen; kein
      Eintritt in den Initial-Bundle-Pfad (dynamischer Import bleibt).
- [ ] **S-5 ADR 0003 nachziehen:** „Orthogonales Routing statt Wegfindung“
      ist überlagert, seit `findCablePath` kontrollierte Wegfindung (Hanan-A*)
      enthält. ADR-Status auf „erweitert“ setzen und auf
      `docs/ROUTING-INVARIANTS.md` verweisen. Abnahme: kein Widerspruch
      zwischen ADR, AGENTS.md und Invarianten-Doku.

## Routing-Performance

Baut auf R-4/R-9 und PERF-02/PERF-04 auf. Jede Aufgabe mit Vorher/Nachher-
Werten aus `benchmarks/edgeRoutingPerf.bench.ts` am 100+-Kanten-Referenzplan;
keine Aufgabe gilt ohne Bench-Nachweis als fertig (Konvention aus R-1).

- [ ] **P-1 Betroffenheits-Analyse (Affected-Set):** Re-Route nur für Kanten
      am gezogenen Knoten plus Kanten, deren Pfad-Bounding-Box die alte oder
      neue Node-BBox schneidet (Abfrage über `SegmentSpatialIndex`).
      `nodeLayoutSignature` bleibt global, die Invalidierung wird selektiv.
      Abnahme: Bench zeigt O(betroffene Kanten) statt O(E) beim Drag;
      Invarianten- und Gallery-Tests grün; keine veralteten Pfade (R-9 bleibt
      erfüllt).
- [ ] **P-2 Zwei-Qualitäts-Stufen im Drag:** Während des Ziehens schnelle
      Vorschau (Bestandspfad beziehungsweise L-Stub), voller `routeAll`-Pass
      mit Nudging erst beim Drag-Ende (gedrosselt, 100–150 ms). Abnahme:
      konstante Frame-Zeit im Drag-Bench; Endqualität identisch zur
      Szenario-Gallery.
- [ ] **P-3 Viewport-Culling prüfen:** `onlyRenderVisibleElements` am
      FlowCanvas evaluieren. Wechselwirkung beachten: Der PNG-Export liest
      das DOM — Culling beim Export kurz aufheben oder Export-Ausschnitt
      explizit rendern. Abnahme: Export-E2E unverändert grün; gerenderte
      Kantenzahl bei großem Plan sinkt messbar.
- [ ] **P-4 Validierung von Position entkoppeln (B15):** `useLiveValidation`
      an `edgeTopologySignature` koppeln statt an jede Mutation; nur der
      Spannungsfall (`voltageDrop.ts`) braucht Geometrie und wird gedrosselt
      nachgezogen. Abnahme: Test mit Lauf-Zähler — reines Verschieben löst
      keine Topologie-Validierung aus; Längenänderung aktualisiert den
      Spannungsfall verzögert korrekt.
- [ ] **P-5 Nudging scopen:** `nudgeOrthogonalPaths` nur auf Lanes betroffener
      Trassen anwenden (setzt P-1 voraus). Abnahme: routingGallery ohne Diff;
      Bench-Verbesserung notiert.
- [ ] **P-6 Routing im Web Worker (optional):** Reine Pipeline
      (`pathfinding.ts`, `orthogonalRouting.ts`) in einen Worker auslagern;
      Übergabe strukturiert klonen oder als Flat-Arrays; bei schnellem Drag
      gewinnt die letzte Anfrage (keine Race-Pfade). Erst nach P-1–P-5.
      Abnahme: Main-Thread ≤ 16 ms/Frame am 100+-Kanten-Plan (M11-9); Pfade
      identisch zur synchronen Variante (Gallery).
- [ ] **P-7 Benchmark-Gate im CI:** `edgeRoutingPerf.bench.ts` mit festem
      Budget am 100+-Kanten-Referenzplan in die Quality-Pipeline (passt zu
      M11-5/M11-9). Abnahme: CI schlägt bei Budget-Überschreitung fehl;
      Budget-Wert im Benchmark-ADR begründet.
