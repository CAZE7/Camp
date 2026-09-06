# AGENT-PLAN: ROUTING-V2

> Arbeitsplan für Coding-AI (Jules / Copilot / Agenten).
> Ausführung streng sequenziell: **ein Workpackage = ein PR.**
> Details je Workpackage stehen im referenzierten Issue — dieser Plan definiert Reihenfolge,
> Regeln und Verifikation, nicht die Fachinhalte.

## Grundregeln (immer gültig)

1. **Quelle der Wahrheit ist `docs/ROUTING-V2.md`** (eingefroren per Freeze-Gate).
   Bei Widerspruch: Spec > Code > Issues. Spec-Änderungen nur via ADR + Change Ledger.
2. **Freeze-Gate:** WP-1 … WP-11 starten erst, wenn WP-0a, WP-0b, WP-0c abgeschlossen sind.
3. **Ein PR verändert genau eine Verantwortung.** Bestehende Tests bleiben grün — kein
   Test wird gelockert oder gelöscht, außer das WP definiert es explizit.
4. **Keine Hardcodes:** alle Geometriewerte kommen aus den Design Tokens (WP-1).
   Keine neuen Abhängigkeiten ohne Issue-Kommentar vorher.
5. **Bottom-up:** nichts an UI/Store anfassen, bevor die darunterliegende Schicht grün ist.
6. **Bei unlösbarem Konflikt: STOPP** → Befund als Kommentar ins Issue, keine Eigenlösung.
7. Jeder PR: `Closes #<Issue>` + WP-Nummer im Titel + Verifikations-Output im PR-Body.

## Kontext vor Start (lesen, nicht ändern)

- `docs/ROUTING-V2.md` — Spezifikation (Architekturvertrag, Tokens, Kollisionsmodell,
  Invarianten, Exit-Conditions)
- Epic `#389` — Exit-Conditions und Freeze-Gate
- `docs/ROUTING-INVARIANTS.md` — bestehende Invarianten, bleiben gültig
- `docs/adr/` — bestehende ADRs; ADR 0003 wird in WP-4 aktualisiert
- `AGENTS.md` / `agent.md` — Missionskonventionen des Repos

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
WP-7  #395  Kreuzungs-Hopping                         ├ Phase 2 — Routing V2
WP-8  #397  Lokales Re-Routing                        │
WP-9  #398  Port Fan-Out                              │
WP-10 #399  Invarianten-Suite                         │
WP-11 #400  Regression-Suite & Golden Layouts         ┘
```

Hinweis zur Reihenfolge: Issue #390 ist numerisch vor #392 geschnitten, aber **WP-2
(Geometrie) ist die Code-Voraussetzung für WP-3 (Kollisionsmodell)** — beide Reihenfolgen
(WP-1→WP-2 oder parallel) sind zulässig, WP-2 muss nur vor WP-3 gemerged sein.

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

### WP-2 — #392 Geometrie-Primitives
- **Ziel:** `lib/routing/geometry/` als Pure Functions (Intersect, Distanzen, Kollinearität,
  Stub, Bend-Merge, Lane-Berechnung)
- **Wichtig:** Geometrie aus `pathUtils.ts` / `segmentSpatialIndex.ts` **migrieren**, nicht
  neu erfinden. Grenzfall-Tests: kollinear, Touch, Punkt-auf-Segment.

### WP-3 — #391 Kollisionsmodell
- **Ziel:** `classifyCollision()` + `CollisionClass`/`RoutingConstraint` + `domainSeparationRules`
- **Baut auf:** WP-1 (Tokens), WP-2 (Primitives). Beide Router konsumieren dasselbe Modell.

### WP-4 — #393 ELK Adapter
- **Ziel:** elkjs-Integration (Konfiguration aus Spec-Abschnitt 6), Web Worker + Timeout,
  Fallback auf bestehenden Router, ELK-A/B auf Routing-Gallery
- **Zusätzlich:** neue ADR zur ELK-Adoption, ADR 0003 als überlagert markieren
- **Gate:** A/B muss Kreuzungen/Bends besser oder gleich zeigen — sonst STOPP + Befund ins Issue.

### WP-5 — #394 LaneRegistry
- **Ziel:** deterministische Lanes (3-Stufen-Sortierung), ersetzt ±40/±80-Heuristik

### WP-6 — #396 A*-Kostenmodell
- **Ziel:** Kostenmatrix aus Spec-Abschnitt 9, Werte aus Tokens, `segmentSpatialIndex` als Basis

### WP-7 — #395 Kreuzungs-Hopping
- **Ziel:** routingPriority + Hop-Rendering (Prioritätsregel aus Spec-Abschnitt 8)

### WP-8 — #397 Lokales Re-Routing
- **Ziel:** minimaler Scope (Kanten des bewegten Nodes + betroffene alte/neue Segmente),
  Re-Routing-Zähler als Test

### WP-9 — #398 Port Fan-Out
- **Ziel:** deterministische Sortierung nach Zielposition + stabiler ID

### WP-10 — #399 Invarianten-Suite
- **Ziel:** alle 10 Invarianten aus Spec-Abschnitt 12, für **beide** Pässe, CI-Blocker

### WP-11 — #400 Regression-Suite & Golden Layouts
- **Ziel:** 15 Szenarien als Fixtures, Golden-Layout-Dateien, Metrik-Budget Delta ≤ 0,
  visuelle Regression via Playwright
- **Voraussetzung:** WP-5 (Determinismus) und WP-10 (Invarianten) gemerged

## Verifikation (vor jedem PR)

```bash
npm run typecheck
npm run lint
npm test                # vitest — volle Suite
npx playwright test     # e2e, routing-relevant
npm run test:goldenmaster   # ab WP-0b vorhanden: Diff gegen knownPlans/
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
