# AGENT-PLAN: ROUTING-V2

> Arbeitsplan für Coding-AI (Jules / Copilot / Agenten).
> Ausführung streng sequenziell: **ein Workpackage = ein PR.**
> Details je Workpackage stehen im referenzierten Issue — dieser Plan definiert Reihenfolge,
> Regeln und Verifikation, nicht die Fachinhalte.
> **Revision 2026-09-06:** Abgleich mit agent.md-Tracks S/P (Rev. 2 der Spec) —
> WP-8 absorbiert P-1/P-2/P-5, WP-4 erhält den P-6-Worker-Vertrag, WP-11 das P-7-Perf-Gate,
> neuer Abschnitt „Stack-Track“ zur S-1-Sequenz.

## Grundregeln (immer gültig)

1. **Quelle der Wahrheit ist `docs/ROUTING-V2.md`** (Rev. 2, eingefroren per Freeze-Gate).
   Bei Widerspruch: Spec > Code > Issues. Spec-Änderungen nur via ADR + Change Ledger.
2. **Freeze-Gate:** WP-1 … WP-11 starten erst, wenn WP-0a, WP-0b, WP-0c abgeschlossen sind.
3. **Ein PR verändert genau eine Verantwortung.** Bestehende Tests bleiben grün — kein
   Test wird gelockert oder gelöscht, außer das WP definiert es explizit.
4. **Keine Hardcodes:** alle Geometriewerte kommen aus den Design Tokens (WP-1).
   Keine neuen Abhängigkeiten ohne Issue-Kommentar vorher.
5. **Bottom-up:** nichts an UI/Store anfassen, bevor die darunterliegende Schicht grün ist.
6. **Bei unlösbarem Konflikt: STOPP** → Befund als Kommentar ins Issue, keine Eigenlösung.
7. Jeder PR: `Closes #<Issue>` + WP-Nummer im Titel + Verifikations-Output im PR-Body.

## Stack-Track (agent.md S-1…S-5, paralleler Strang)

- **S-1 (React Flow 12) muss VOR WP-7 und WP-8 gemerged sein** — diese WPs berühren die
  RF-API (`CableEdge`, `nodeTypes`/`edgeTypes`, CSS); sonst doppelter Migrationsaufwand.
  Akzeptanz aus agent.md: `npm run check` grün; Drag, Auto-Wire, Undo/Redo unverändert;
  Invarianten-Tests und visuelle Baselines ohne Diff. Kann parallel zu Phase 0/1 laufen.
- S-2 (Tailwind v4), S-3 (lucide), S-4 (Export): unabhängig von Routing V2.
- S-5 (ADR 0003): wird in WP-4 miterledigt.

## Kontext vor Start (lesen, nicht ändern)

- `docs/ROUTING-V2.md` — Spezifikation Rev. 2 (Architekturvertrag, Tokens, Kollisionsmodell,
  Invarianten, Exit-Conditions, S/P-Zuordnung Abschnitt 16)
- Epic `#389` — Exit-Conditions und Freeze-Gate
- `docs/ROUTING-INVARIANTS.md` — bestehende Invarianten, bleiben gültig
- `docs/adr/` — bestehende ADRs; ADR 0003 wird in WP-4 aktualisiert
- `AGENTS.md` / `agent.md` — Missionskonventionen des Repos (inkl. S/P-Tracks)

## Ausführungsreihenfolge

```text
WP-0a #401  Architecture Contract & Dependency Map   ┐
WP-0b #402  Golden Master (knownPlans/)              ├ Phase 0 — Freeze-Gate
WP-0c #403  Change Ledger & ADR-Basis                ┘
WP-1  #390  Design Tokens                             ┐
WP-2  #392  Geometrie-Primitives  (zuerst im Code!)   ├ Phase 1 — Foundation
WP-3  #391  Kollisionsmodell                           ┘
WP-4  #393  ELK Adapter (elkjs, Worker, A/B, ADR)     ┐
WP-5  #394  LaneRegistry                              │
WP-6  #396  A*-Kostenmodell                           │
WP-7  #395  Kreuzungs-Hopping (erst nach S-1!)        ├ Phase 2 — Routing V2
WP-8  #397  Re-Routing & Drag-Performance (P-1/2/5)   │
WP-9  #398  Port Fan-Out                              │
WP-10 #399  Invarianten-Suite                         │
WP-11 #400  Regression, Golden Layouts, Perf-Gate     ┘
```

Hinweise zur Reihenfolge:

- Issue #390 ist numerisch vor #392 geschnitten, aber **WP-2 (Geometrie) ist die
  Code-Voraussetzung für WP-3 (Kollisionsmodell)** — WP-2 muss vor WP-3 gemerged sein.
- **S-1 (React Flow 12) vor WP-7/WP-8** — siehe Stack-Track.

## Workpackages

### WP-0a — #401 Architecture Contract & Dependency Map
- **Ziel:** `docs/ARCHITECTURE-V2.md` (Schichtenmodell, Prinzipien, Dependency Map, Datei-Katalog)
- **Wichtig:** Nur Verstehen und Dokumentieren — **kein Code-Umbau in diesem PR.**
- **Werkzeuge:** `knip.ts` vorhanden; Aufrufgraph/Kopplungen können damit und per
  Code-Trace erhoben werden.

### WP-0b — #402 Golden Master
- **Ziel:** `knownPlans/` (simple, camper, solar, inverter, acdc, complex) + Capture-Skript
  + Vergleichs-Harness (identisch oder bewusst besser)
- **Wichtig:** Fixtures müssen mit dem **aktuellen** System erzeugt werden — vor jedem
  anderen Code-Change.

### WP-0c — #403 Change Ledger & ADR-Basis
- **Ziel:** `docs/ARCHITECTURE-CHANGES.md` + ADR-0007…0010 + ADR 0003-Statusupdate

### WP-1 — #390 Design Tokens
- **Ziel:** Token-Modell + ELK-Config-Generator + Config-Sync-Test
- **Migration:** `OBSTACLE_MARGIN`, `ROUTE_MIN_STUB`, `ROUTE_BORDER_RADIUS`, ±40/±80-Parallelen → Tokens
- **Wichtig:** Bestehendes Token-System **erweitern** (RGB-Triplet-Zwillinge aus M11-1
  mit Drift-Guard, D-1: `globals.css` einzige Farbquelle) — nicht ersetzen.

### WP-2 — #392 Geometrie-Primitives
- **Ziel:** `lib/routing/geometry/` als Pure Functions (Intersect, Distanzen, Kollinearität,
  Stub, Bend-Merge, Lane-Berechnung)
- **Wichtig:** Geometrie aus `pathUtils.ts` / `segmentSpatialIndex.ts` **migrieren**, nicht
  neu erfinden. Grenzfall-Tests: kollinear, Touch, Punkt-auf-Segment.
- **Handle-Geometrie:** Handles sitzen ±22 px außerhalb der Node-Karte (M11-1) —
  `inflateObstacle()` muss die Handle-Ausrisse einrechnen.

### WP-3 — #391 Kollisionsmodell
- **Ziel:** `classifyCollision()` + `CollisionClass`/`RoutingConstraint` + `domainSeparationRules`
- **Baut auf:** WP-1 (Tokens), WP-2 (Primitives). Beide Router konsumieren dasselbe Modell.

### WP-4 — #393 ELK Adapter
- **Ziel:** elkjs-Integration (Konfiguration aus Spec-Abschnitt 6), Web Worker + Timeout,
  Fallback auf bestehenden Router, ELK-A/B auf Routing-Gallery
- **Worker-Vertrag (P-6):** Übergabe strukturiert klonen oder als Flat-Arrays; letzte
  Anfrage gewinnt (keine Race-Pfade)
- **Zusätzlich:** neue ADR zur ELK-Adoption (erledigt agent.md S-5), ADR 0003 als überlagert markieren
- **Gate:** A/B muss Kreuzungen/Bends besser oder gleich zeigen — sonst STOPP + Befund ins Issue.

### WP-5 — #394 LaneRegistry
- **Ziel:** deterministische Lanes (3-Stufen-Sortierung), ersetzt ±40/±80-Heuristik

### WP-6 — #396 A*-Kostenmodell
- **Ziel:** Kostenmatrix aus Spec-Abschnitt 9, Werte aus Tokens, `segmentSpatialIndex` als Basis

### WP-7 — #395 Kreuzungs-Hopping
- **Ziel:** routingPriority + Hop-Rendering (Prioritätsregel aus Spec-Abschnitt 8)
- **Voraussetzung:** S-1 (React Flow 12) gemerged

### WP-8 — #397 Lokales Re-Routing & Drag-Performance
- **Ziel:** absorbiert agent.md P-1/P-2/P-5 (Details im Issue):
  Affected-Set (Bounding-Box, O(betroffene Kanten) statt O(E)) · Zwei-Qualitäts-Stufen
  (L-Stub-Vorschau im Drag, voller Pass am Drag-Ende gedrosselt 100–150 ms) ·
  gescopedes Nudging (nur betroffene Lanes)
- **Voraussetzung:** S-1 (React Flow 12) gemerged; Worker-Auslagerung (P-6) erst danach

### WP-9 — #398 Port Fan-Out
- **Ziel:** deterministische Sortierung nach Zielposition + stabiler ID

### WP-10 — #399 Invarianten-Suite
- **Ziel:** alle 10 Invarianten aus Spec-Abschnitt 12, für **beide** Pässe, CI-Blocker

### WP-11 — #400 Regression-Suite, Golden Layouts & Perf-Gate
- **Ziel:** 15 Szenarien als Fixtures, Golden-Layout-Dateien, Metrik-Budget Delta ≤ 0,
  visuelle Regression via Playwright
- **Perf-Gate (P-7):** `edgeRoutingPerf.bench.ts` mit festem Budget am 100+-Kanten-
  Referenzplan in die Quality-Pipeline; Budget-Wert im Benchmark-ADR begründet
- **Voraussetzung:** WP-5 (Determinismus) und WP-10 (Invarianten) gemerged

## Verifikation (vor jedem PR)

```bash
npm run typecheck
npm run lint
npm test                # vitest — volle Suite
npx playwright test     # e2e, routing-relevant
npm run test:goldenmaster   # ab WP-0b vorhanden: Diff gegen knownPlans/
npx vitest bench         # ab WP-11: Perf-Gate (edgeRoutingPerf.bench.ts)
```

- WP-4 zusätzlich: Lighthouse ≥ 90 prüfen (elkjs dynamischer Import, Bundle-Budget)
- WP-11 zusätzlich: Gallery-Regeneration (`scripts/routing/generate-gallery.ts`) und Metrik-Report

## PR-Format

- Titel: `routing-v2/wp-<n>: <kurzbeschreibung>`
- Body: Closes-Referenz, Was geändert wurde, Verifikations-Output (kompakt),
  Abweichungen von der Spec (falls diskutiert — sonst: keine)

## Stop-Kriterien (sofort anhalten, Issue-Kommentar schreiben)

- Eine Invariante aus Spec-Abschnitt 12 ist nicht erfüllbar.
- Ein Test müsste gelockert/gelöscht werden, um grün zu werden.
- Eine neue Abhängigkeit wäre nötig.
- Die Spec ist an einer Stelle mehrdeutig → keine Interpretation eigenmächtig treffen.
- Ein PR würde mehr als eine Verantwortung verändern.
