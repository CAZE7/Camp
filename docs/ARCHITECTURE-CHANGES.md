# ARCHITECTURE-CHANGES — Change Ledger

> Revisionssicheres Verzeichnis aller Architekturentscheidungen und -änderungen
> von CAMP/Routing V2. **Konvention:** Architektur-Änderungen (Schichtenmodell,
> Contract-Prinzipien, eingefrorene Spec `docs/ROUTING-V2.md`, Routing-Regelwerk)
> nur mit Eintrag hier + ggf. neuer ADR in `docs/adr/`. PRs ohne Ledger-Eintrag,
> die den Contract berühren, werden abgelehnt (Review-Checkliste in
> `docs/ARCHITECTURE-V2.md` §2).

Format: neueste Einträge oben. Jeder Eintrag: Datum, Bezug (ADR/WP/Issue), Kurzbegründung.

---

## 2026-09-06 (S-1, Stack-Track)

- **ADR-0013** React Flow 12 (`@xyflow/react`) als Canvas-Paketlinie — Voraussetzung für WP-7 (#395) und WP-8 (#397) laut `docs/AGENT-PLAN-ROUTING-V2.md` (Stack-Track). Paketwechsel `reactflow@11` → `@xyflow/react@12`; **ADR 0002 dadurch erweitert** (v11-Bindung aufgehoben), ADR 0007 unberührt (RF bleibt UI-Adapter). (agent.md S-1)
- **Messgrenze zentralisiert** — `components/edges/utils/nodeGeometry.ts` ist die einzige Stelle, die gemessene Größe (`measured`), absolute Position (`internals.positionAbsolute`) und Handle-Rechtecke liest; die flache v11-Form bleibt gültige Eingabe, weil `knownPlans/`, Golden Layouts und gespeicherte Pläne Knoten so beschreiben. Verhalten unverändert: Golden Master + Routing-Regression byte-identisch. (ADR 0013)
- **Store-/UI-Typen geschärft** — v12 typisiert `Node['data']` als `Record<string, unknown>` (v11: `any`); Store und Inspektoren führen `PlannerFlowNode = Node<CommonNodeData>`, Kanten-Props laufen über den Kanten-Typ (`EdgeProps<CableEdgeType>`). Kein neuer `any`-Pfad. (ADR 0013)

## 2026-09-06 (WP-6, WP-9 … WP-11)

- **ADR-0012** Perf-Budget 16 ms Main-Thread/Frame am 100+-Kanten-Referenzplan — `npm run perf:edge-routing` ist jetzt ein hartes Gate (Median über 30 Läufe, Exit-Code 1 bei Überschreitung). Absorbiert agent.md P-7. In `quality.yml` (und dem Spiegel `docs/ci/workflows/quality.yml`) als blockierender Schritt direkt nach dem Coverage-Schritt eingetragen. (WP-11, #400)
- **Golden Layouts eingefroren** — `scripts/regression/goldenLayouts.json` + deterministische SVGs in `docs/routing-regression/`: 15 Szenarien (#400), Wegpunkt-genau + Metrik-Budget „Delta ≤ 0“ (Kreuzungen/Bends/Länge; Clearance-Verstöße = 0). Refresh nur via `npm run regression:capture` + PR-Begründung. (WP-11, #400)
- **Invarianten-Suite CI-blockierend** — `lib/routing/invariants.ts` prüft I1–I7 aus ROUTING-V2.md §12 für BEIDE Pässe; ELK strikt (I1–I4, I7 = 0), Bestandsrouter als Ratchet-Baseline (nur Abbau erlaubt, Behebung WP-7/WP-8 nach S-1). I9-Determinismus per Doppel-Lauf. (WP-10, #399)
- **Port-Fan-Out zentralisiert** — `lib/routing/rules/portFanOut.ts`: eine Sortierquelle für Stub-Reihenfolge am Port UND ELK-FIXED_ORDER-Portindizes; `routeAll.portOrderedLaneOffsets` delegiert (verhaltensidentisch, Golden Master byte-gleich). (WP-9, #398)
- **A\*-Kostenmodell aus Tokens** — `lib/routing/rules/costModel.ts`: alle Gewichte aus `laneGrid` generiert, Sync-Test gegen den Legacy-Wert (crossing = 120); `pathfinding.scorePath` konsumiert `COST_WEIGHTS.crossing`. Vollintegration in den A*-Pass folgt mit WP-8. (WP-6, #396)

## 2026-09-06 (WP-2 … WP-4)

- **ADR-0011** ELK Layered (elkjs) als globaler Layout-Pass — A/B-Gate bestanden (Kreuzungen 53→13, Bends 199→92 über die 6 Golden-Master-Pläne); Konfiguration aus Tokens generiert; Worker-Vertrag P-6 (letzte Anfrage gewinnt); bestehender Router bleibt Fallback. Erledigt agent.md S-5. (WP-4, #393)
- **ADR-0003 als „erweitert/überlagert“ markiert** — gilt weiter für Fallback-Router und inkrementellen Pass. (WP-4, #393)
- **Neue Abhängigkeit `elkjs`** (EPL-2.0) — Begründung und Nachweis in ADR 0011; nur via dynamischem Import geladen (Bundle-Budget M11-5). Issue-Kommentar war wegen fehlender Schreibrechte des CI-Tokens nicht möglich; Ankündigung dokumentiert hier + ADR.
- **Kollisionsmodell fixiert** — `classifyCollision()` / `RoutingConstraint` / `domainSeparationRules` in `lib/routing/rules/`; ELK- und A*-Pass konsumieren dasselbe Modell. (WP-3, #391)
- **Geometrie-Schicht eingezogen** — `lib/routing/geometry/` (pure Functions); Router re-exportieren, `segmentsIntersect` u. a. nicht mehr doppelt gepflegt. Verhalten unverändert (Golden Master grün). (WP-2, #392)

## 2026-09-06

- **ADR-0007** React Flow bleibt UI-Adapter — RF ist Canvas + Interaktion, keine Fachlogik. (WP-0c, #403)
- **ADR-0008** Domain Model wird unabhängig von React Flow — Planner Domain nutzt RF-Typen nur als Übergangs-Datentyp, langfristig eigenes Modell. (WP-0c, #403)
- **ADR-0009** Crossings sind erlaubt, Overlaps verboten — Kollisionsmodell-Kernregel: Overlap = HARD, Crossing = SOFT/Optimierungsziel. (WP-0c, #403)
- **ADR-0010** Routing ist deterministisch — gleicher Input ⇒ identischer Output, für beide Pässe (ELK + A*); Grundlage von Golden Master, Golden Layouts und LaneRegistry. (WP-0c, #403)
- **ADR-0003 Statusvermerk** — „Orthogonales Routing statt Wegfindung“ bleibt gültig für den inkrementellen Pass, wird aber im Zuge der ELK-Adoption (WP-4, #393) als **teilweise überlagert** markiert; die endgültige Markierung + neue ELK-ADR erfolgt in WP-4 (agent.md S-5).
- **Verworfen:** Negotiated Congestion / PathFinder als Routing-Verfahren — Overkill für die Graphgröße (100–300 Kanten); ELK Layered + Hanan-A* decken das Ziel ab (ROUTING-V2.md §1, Nicht-Ziel).
- **Architecture Contract fixiert** — `docs/ARCHITECTURE-V2.md` (WP-0a, #401): Schichtenmodell, 4 Prinzipien, Dependency Map, Datei-Katalog. Reviews prüfen dagegen.
- **Golden Master eingefroren** — `knownPlans/` (WP-0b, #402): 6 Pläne, Pipeline-Fixtures des Ist-Systems (Input → AutoWire → Electrical → Routing). V2-Ergebnisse müssen identisch oder bewusst besser sein (Begründung im PR + hier).
