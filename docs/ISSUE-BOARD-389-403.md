# Issue-Board-Status #389–#403 (Routing V2 / Camp V2)

Stand: 2026-09-09 · Basis: Default-Branch
`feature/react-flow-cable-editor-7322653268250495059` (PRs #404, #406, #416,
#417, #421, #423, #424, #425, #426) · Erstellt als Teil der Board-Hygiene (agent.md A-6).

## Zweck & Einschränkung

Die Issues #389–#403 (Epic „Routing V2" + „Camp V2 · Phase 0") sind auf GitHub
**alle noch offen**, obwohl der Track im Code umgesetzt ist — die Arbeits-PRs
wurden über Arena-Session-Branches gemergt, ohne `Closes #…` im Titel, und die
Abnahme-Listen in den Issue-Bodies wurden nie abgehakt.

**Der Agent-Token dieses Repos hat kein `issues:write`** (GitHub meldet
„Resource not accessible by integration" — am 09.09.2026 per Test-Kommentar auf
#400 verifiziert). Kommentieren und Schließen muss daher ein Nutzer/Admin
übernehmen oder ein Token mit `issues:write` verwenden. Dieses Dokument liefert
je Issue den Befund und eine kopierfertige Kommentar-Vorlage.

Vorgehen: Für jedes Issue den Kommentar einfügen, dann ggf. mit `gh issue close
<Nr> --repo CAZE7/Camp` schließen (oder `gh issue edit` zum Anhaken). Bei
Abweichungen vom beschriebenen Stand: nicht schließen, sondern Abweichung im
Issue dokumentieren.

## Übersicht

| Issue | WP                              | Empfehlung                   | Beleg (Kurzform)                                                        |
| ----- | ------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| #389  | Epic Routing V2                 | **annotieren, offen lassen** | Kern erledigt; Rest-Exit-Punkte → AGENTS.md M11-5/M11-9                 |
| #390  | WP-1 Design-Tokens              | schließen                    | `lib/routing/tokens.ts` + Drift-Guard-Test                              |
| #391  | WP-3 Kollisionsmodell           | schließen                    | `lib/routing/rules/collision.ts`, ADR 0019                              |
| #392  | WP-2 Geometrie-Primitives       | schließen                    | `lib/routing/geometry/*`                                                |
| #393  | WP-4 ELK-Adapter                | schließen                    | `lib/routing/elk/*`, ADR 0011/0016/0018, ADR-0003-Update                |
| #394  | WP-5 LaneRegistry               | schließen                    | `lib/routing/rules/laneRegistry.ts`                                     |
| #395  | WP-7 Kreuzungs-Hopping          | schließen                    | `lib/routing/rules/hopping.ts`, Hop-Bögen in `pathUtils.ts`             |
| #396  | WP-6 A*-Kostenmodell            | schließen                    | `lib/routing/rules/costModel.ts`                                        |
| #397  | WP-8 Re-Routing & Drag          | **annotieren, offen lassen** | Konsolidierung ADR 0014/0019/0020; P-1/P-2/P-5 in agent.md weiter offen |
| #398  | WP-9 Port Fan-Out               | schließen                    | `lib/routing/rules/portFanOut.ts`                                       |
| #399  | WP-10 Invarianten-Suite         | schließen                    | `lib/routing/invariants*.ts`, CI-integriert                             |
| #400  | WP-11 Regression/Golden/Perf    | schließen                    | `docs/routing-regression/` (15 SVGs), Perf-Gate in `quality.yml`        |
| #401  | WP-0a Architektur-Contract      | schließen                    | `docs/ARCHITECTURE-V2.md`, `docs/ARCHITECTURE-CHANGES.md`               |
| #402  | WP-0b Golden Master             | schließen                    | `knownPlans/` (6 Fixtures), `scripts/goldenmaster/`                     |
| #403  | WP-0c Change Ledger & ADR-Basis | schließen                    | ADR 0001–0020, Ledger in `ARCHITECTURE-CHANGES.md`, ADR-0003-Update     |

---

## #389 — Epic: Routing V2 (offen lassen, annotieren)

Umgesetzt: alle Workpackages #390–#403 sind im Code abgeschlossen (siehe deren
Einträge unten), der Track ist gemergt (PRs #404/#406/#417/#421/#423/#424/#426)
und durch CI-Gates abgesichert (`quality.yml`: Unit-/Komponententests,
Perf-Gate, E2E, Static Export).

Noch offene Epic-Exit-Punkte, die bewusst NICHT über dieses Epic laufen:

- „Lighthouse ≥ 90 hält (elkjs dynamischer Import, Web Worker)" → agent.md
  M11-5 (Performance-Gate) — dort weiter offen.
- „Main-Thread ≤ 16 ms/Frame am 100+-Kanten-Referenzplan" (App-Ebene, M11-9):
  das Router-Budget ist als Perf-Gate in CI aktiv (#400), das App-Frame-Gate
  ist M11-9 in AGENTS.md.
- „ELK-A/B auf Routing-Gallery: Kreuzungen/Bends besser oder gleich" →
  `lib/routing/elk/ab-compare.test.ts` (A/B gegen Bestands-Router).

> **Kommentar-Vorlage #389:**
> „Der komplette Workpackage-Track (WP-0a…WP-11, #390–#403) ist umgesetzt und
> über PRs #404/#406/#417/#421/#423/#424/#426 in den Default-Branch gemergt;
> ADR 0011–0020 dokumentieren die Entscheidungen, `quality.yml` erzwingt
> Tests, Perf-Gate und E2E. Ich lasse das Epic bewusst offen, bis die zwei
> app-weiten Exit-Punkte (Lighthouse ≥ 90 = agent.md M11-5; App-Frame-Budget
> 16 ms = M11-9) dort als erledigt markiert sind — die Einzel-WPs schließe
> ich jeweils mit ihrem Befund. Siehe docs/ISSUE-BOARD-389-403.md."

---

## #390 — WP-1: Design-Tokens (schließen)

Beleg: `lib/routing/tokens.ts` (alle Geometrie-Konstanten, Single Source of
Truth), `lib/routing/tokens.test.ts` (Config-Sync-/Drift-Guard-Test: ELK-
Optionsstruktur wird über `generateElkLayoutOptions()` generiert, schlägt bei
Abweichung/Hardcode fehl). Datei-Kopf dokumentiert die WP-Zuordnung.

> **Kommentar-Vorlage #390:**
> „WP-1 erledigt: `lib/routing/tokens.ts` ist die einzige Quelle der
> Routing-Geometriewerte (cableClearance, stubMin, laneGrid, …); die
> ELK-Optionsstruktur wird daraus generiert. Der Drift-Guard
> `lib/routing/tokens.test.ts` schlägt bei Abweichung oder Hardcode fehl.
> Kostenwerte leiten sich in `lib/routing/rules/costModel.ts` aus denselben
> Tokens ab. Abnahme-Liste damit erfüllt; Details: docs/ROUTING-INVARIANTS.md
> und docs/ISSUE-BOARD-389-403.md. Schließe hiermit."

---

## #391 — WP-3: Kollisionsmodell (schließen)

Beleg: `lib/routing/rules/collision.ts` (`CollisionClass`, harte/gewichtete
Klassen), `lib/routing/rules/collision.test.ts`, `domainSeparationRules`
in der Domänen-Schicht; ADR 0009 (Crossings erlaubt, Overlaps verboten) und
ADR 0019 (Final-Gate konsumiert das Kollisionsmodell); Paritäts-Test
`lib/routing/invariantsCollisionParity.test.ts` (I1 hard edge×node ⇔ Modell).

> **Kommentar-Vorlage #391:**
> „WP-3 erledigt: Kollisionsmodell (`lib/routing/rules/collision.ts`) mit
> harten (edge×node, Overlap) und gewichteten Klassen; beide Router-Pässe
> und das Final-Gate lesen es (ADR 0009, ADR 0019); Paritäts-Test
> `invariantsCollisionParity.test.ts` beweist die Übereinstimmung von
> Invariante I1 und Modellklasse hard. Schließe hiermit."

---

## #392 — WP-2: Geometrie-Primitives (schließen)

Beleg: `lib/routing/geometry/` (segments, rects, polyline, Intersection/
Abstand/Kollinearität/Crossing-Detection, `segmentSpatialIndex.ts`), Tests
`geometry.test.ts`/`segmentSpatialIndex.test.ts` inkl. Grenzfälle
(kollinear, Touch, Punkt-auf-Segment); Migration des Bestands aus
`components/edges/utils` dokumentiert in ADR 0014 (eine Quelle für
Kabelgeometrie) und PR #425 (DOM-001-Geometrie-Migration).

> **Kommentar-Vorlage #392:**
> „WP-2 erledigt: Geometrie-Schicht `lib/routing/geometry/` als pure
> Funktionen (Segment-Intersection, Abstände, Kollinearität, Crossing-
> Detection, Stub-Minimum, Bend-Merge, Lane-Berechnung) inkl.
> Spatial-Index. Alle Folge-WPs (#391/#394–#398) bauen darauf auf; die
> Bestands-Geometrie wurde dorthin migriert (ADR 0014, PR #425). Schließe
> hiermit."

---

## #393 — WP-4: ELK-Adapter (schließen)

Beleg: `lib/routing/elk/` (graph.ts, runner.ts mit Worker-Vertrag P-6
„letzte Anfrage gewinnt", elk.test.ts, ab-compare.test.ts A/B gegen den
Bestands-Router); UI-Produktivbetrieb als Knoten-Layout-Pass mit
Dagre-Fallback und Timeout (ADR 0018, PR #417/#426);
ADR 0011 (ELK Layered als globaler Pass), ADR 0016 (eine elkjs-Anbindung);
ADR 0003 trägt den Statusvermerk „erweitert/überlagert" (agent.md S-5,
erledigt 2026-09-06). ELK-`routes`/`junctions` werden bewusst nicht
konsumiert — Geometrie gehört exklusiv dem A*-Pass (ADR 0014).

> **Kommentar-Vorlage #393:**
> „WP-4 erledigt: ELK-Adapter (`lib/routing/elk/`) mit Worker-Vertrag P-6
> (letzte Anfrage gewinnt), A/B-Vergleich (`ab-compare.test.ts`) und
> Dagre-Fallback; ELK ist als produktiver Layout-Pass verdrahtet (ADR 0011/
> 0016/0018, PRs #417/#426); ADR 0003 wurde als ‚erweitert/überlagert'
> markiert (agent.md S-5). Die optionale Voll-Auslagerung der Routing-
> Pipeline in einen Worker bleibt als agent.md P-6 separat offen. Schließe
> hiermit."

---

## #394 — WP-5: Deterministisches Lane-System (schließen)

Beleg: `lib/routing/rules/laneRegistry.ts` mit stabiler Sortierung
(topo-Reihenfolge → Zielposition → stabile ID als Tie-Breaker);
`laneRegistry.test.ts` (14 Fälle: Determinismus bei permutierter
Anmelde-Reihenfolge, kein Lane-Flip, Idempotenz für Undo/Redo, offset =
laneIndex × laneGrid aus Token).

> **Kommentar-Vorlage #394:**
> „WP-5 erledigt: `lib/routing/rules/laneRegistry.ts` leitet Lanes als
> reine deterministische Funktion der Kantenmenge ab (topo → Zielposition
> → stabile ID); `laneRegistry.test.ts` beweist identische Zuordnung bei
> permutierter Registrierung und Lane-Stabilität über Undo/Redo.
> Schließe hiermit."

---

## #395 — WP-7: Kreuzungs-Hopping (schließen)

Beleg: `lib/routing/rules/hopping.ts` (Prioritäts-Hopping nach
routingPriority; Backbone bleibt gerade), `hopping.test.ts`;
Rendering als Halbkreis-Bogen in `components/edges/utils/pathUtils.ts`
(Hop-Commands auf den gerouteten Pfaden) — Kreuzung optisch ≠ Verbindung.
Verweis im Code: `CableEdge.tsx` dokumentiert die Konsolidierung auf den
einen globalen Pass (PRs #421/#423, ADR 0014).

> **Kommentar-Vorlage #395:**
> „WP-7 erledigt: Kreuzungs-Hopping mit routingPriority
> (`lib/routing/rules/hopping.ts` + Tests); verbleibende Kreuzungen werden
> als Halbkreis-Bögen gerendert (`pathUtils.ts`) und sind damit optisch
> von Verbindungen unterscheidbar. Backbone-Priorität ist über die
> Routing-Konsolidierung (ADR 0014) abgesichert. Schließe hiermit."

---

## #396 — WP-6: A*-Kostenmodell aus Tokens (schließen)

Beleg: `lib/routing/rules/costModel.ts` (Kostenmatrix: overlap = verboten,
Clearance/Crossing/Lane-Klassen, Werte aus Tokens abgeleitet, keine
Handpflege), `costModel.test.ts` (20 Fälle: jede Kostenklasse einzeln +
Kombinationen); Konsistenz mit Kollisionsmodell via ADR 0019.

> **Kommentar-Vorlage #396:**
> „WP-6 erledigt: Kostenmodell des inkrementellen Passes
> (`lib/routing/rules/costModel.ts`) mit der Spec-Matrix (overlap = hard,
> Clearance/Crossing/Lane abgestuft); alle Werte werden aus
> `lib/routing/tokens.ts` abgeleitet — keine hartcodierten Kosten.
> Schließe hiermit."

---

## #397 — WP-8: Lokales Re-Routing & Drag-Performance (offen lassen, annotieren)

Befund: Die WP-8-Zielarchitektur (Affected-Set P-1, Zwei-Stufen-Drag P-2,
gescoptes Nudging P-5) wurde im Zuge der Routing-Konsolidierung
(PRs #421/#423/#424/#426, ADR 0014/0019/0020) durch einen **einzigen
globalen Routing-Pass** mit Cache- und Invalidierungslogik ersetzt
(`components/edges/utils/cableRouteStore.ts`, `routingCache.ts`,
`routeAll.ts`, `nudge.ts`; Re-Route während des Draggens gedrosselt,
R-9-Tests grün). Die in agent.md als „Routing-Performance" geführten
Tracks P-1/P-2/P-5 sind dort **weiterhin offen** — der Status-Widerspruch
zwischen dieser Issue-Absorption und agent.md ist nicht aufgelöst.
Deshalb: Annotation statt Schließen; nach Abschluss des P-Tracks neu
bewerten. Messbarer Router-Perf-Teil ist bereits in CI (#400 Perf-Gate,
`edgeRoutingPerf.bench.ts` in quality.yml).

> **Kommentar-Vorlage #397:**
> „WP-8-Befund 2026-09-09: Die ursprünglich absorbierte P-1/P-2/P-5-Logik
> ist durch die Routing-Konsolidierung überholt — Routing läuft heute über
> einen globalen Pass mit Cache/Invalidierung und gedrosseltem Re-Route
> während des Draggens (ADR 0014/0019/0020, PRs #421/#423/#424/#426).
> agent.md führt P-1 (Affected-Set), P-2 (Zwei-Stufen) und P-5
> (Nudging-Scope) aber weiterhin als offen; das Router-Perf-Gate ist über
> #400 in CI aktiv. Ich lasse das Issue offen, bis der P-Track in agent.md
> abgeschlossen ist, und schließe es dann mit Verweis hierauf."

---

## #398 — WP-9: Port Fan-Out (schließen)

Beleg: `lib/routing/rules/portFanOut.ts` + `portFanOut.test.ts`
(deterministische Sortierung mehrerer Kanten an einem Handle,
Bündel-Zentrierung, token-basierte Lane-Offsets).

> **Kommentar-Vorlage #398:**
> „WP-9 erledigt: Port-Fan-Out (`lib/routing/rules/portFanOut.ts`) sortiert
> Kanten an einem Handle deterministisch und bündelt sie zentriert um die
> innere Lane — keine Kreuzung direkt an der Quelle; Tests in
> `portFanOut.test.ts`. Schließe hiermit."

---

## #399 — WP-10: Routing-Invarianten als Testsuite (schließen)

Beleg: `lib/routing/invariants.ts` + `invariants.test.ts`

- `invariantsCollisionParity.test.ts` (I1 ⇔ Modellklasse hard),
  `components/edges/utils/orthogonalRouting.invariants.test.ts` (Bestands-
  Router), Schwellen aus Tokens (#390); beide Pässe (ELK-Output und A*-
  Output) werden über die finalen Gates geprüft (ADR 0015 harte
  Final-Invariante, ADR 0019); CI läuft `npm run test:coverage` über alle
  Suiten (quality.yml, Blocker bei Verletzung); Golden-Regression
  (ADR 0015, PR #421: I1 72 → 0; PR #426: 179 → 0 Verstöße).

> **Kommentar-Vorlage #399:**
> „WP-10 erledigt: Invarianten-Suite als Testmodule
> (`lib/routing/invariants.test.ts`, Paritäts- und Bestands-Invarianten)
> gegen beide Pässe, Schwellen aus den Tokens; CI-integriert als Blocker.
> ADR 0015 (harte Final-Invariante) und ADR 0019 dokumentieren den Stand;
> die Korrektur-Kampagnen senkten die Verstöße auf 0 (PRs #421/#426).
> Schließe hiermit."

---

## #400 — WP-11: Regression-Suite, Golden Layouts & Perf-Gate (schließen)

Beleg: 15 Golden-Layout-Szenarien als SVG-Fixtures in `docs/routing-regression/`
(p01…p15 exakt nach Szenarienliste des Issues, inkl. p13 „drag zentraler
Node", p14 „undo-redo", p15 „pass-wechsel"), geprüft über
`scripts/regression/regression.test.ts` (Abweichung = Fail);
Metrik-Report über `routingQuality.ts`-Suite; Perf-Gate
`benchmarks/edgeRoutingPerf.bench.ts` mit festem Budget läuft in der
Quality-Pipeline (`.github/workflows/quality.yml`, Job-Schritt „Perf-Gate
Kanten-Routing (WP-11 / #400)", Budget-Begründung: ADR 0012).

> **Kommentar-Vorlage #400:**
> „WP-11 erledigt: 15 Golden-Layout-Szenarien als Fixtures in
> docs/routing-regression/ (Abweichung = CI-Fail, scripts/regression/
> regression.test.ts), Metrik-Report über die routingQuality-Suite, und
> das Perf-Gate edgeRoutingPerf.bench.ts mit festem Budget ist in der
> Quality-Pipeline aktiv (ADR 0012). Schließe hiermit."

---

## #401 — WP-0a: Architecture Contract & Dependency Map (schließen)

Beleg: `docs/ARCHITECTURE-V2.md` (eingefrorene Referenzarchitektur:
Schichtenmodell, Architektur-Prinzipien, Boundary-Gates G1–G10),
`docs/ARCHITECTURE-CHANGES.md` (Review-Dokumentation, FROZEN),
`docs/AGENT-PLAN-ROUTING-V2.md`; umgesetzt ab PR #404.

> **Kommentar-Vorlage #401:**
> „WP-0a erledigt: Architecture Contract in docs/ARCHITECTURE-V2.md
> eingefroren (Schichtenmodell, Prinzipien, Gates), Review-Abgleich in
> docs/ARCHITECTURE-CHANGES.md; die Dependency-Boundaries werden durch
> Tests erzwungen (z. B. domain-boundaries, lib/-Coverage-Gate).
> Schließe hiermit."

---

## #402 — WP-0b: Golden Master absichern (schließen)

Beleg: `knownPlans/` mit allen 6 Fixtures (simple, camper, solar, inverter,
acdc, complex); Capture-Pipeline `scripts/goldenmaster/` (capture.ts,
pipeline.ts, plans.ts, goldenMaster.test.ts — Baseline-Suite läuft in CI
über `npm run test:coverage`); Vergleichs-Harness: „identisch oder bewusst
besser + Begründung" (dokumentierte Neuerfassungen im Change Ledger,
z. B. ELE-007/DOM-001/DOM-002 am 08.09.2026).

> **Kommentar-Vorlage #402:**
> „WP-0b erledigt: 6 knownPlans-Fixtures committed, Capture-Pipeline in
> scripts/goldenmaster/ (reproduzierbar, npm run goldenmaster:capture),
> Baseline-Suite läuft in CI und verlangt ‚identisch oder bewusst besser
> mit Begründung' (Begründungen im Change Ledger, docs/ARCHITECTURE-
> CHANGES.md). Schließe hiermit."

---

## #403 — WP-0c: Change Ledger & ADR-Basis (schließen)

Beleg: ADR-Basis `docs/adr/0001–0020` (0007–0010 aus WP-0c, 0011–0020 aus
Routing V2); Change-Ledger-Abschnitt in `docs/ARCHITECTURE-CHANGES.md`
(initialer WP-0c-Eintrag am 09.09.2026 nachgetragen); ADR 0003
Statusupdate „erweitert/überlagert" (2026-09-06); Konvention
„Spec-Änderungen nur via ADR + Change Ledger" dokumentiert in
`docs/AGENT-PLAN-ROUTING-V2.md` (Grundregel 1).

> **Kommentar-Vorlage #403:**
> „WP-0c erledigt: ADR-0007…0010 als Basis verfasst (docs/adr/), ADR-0003-
> Statusupdate gesetzt (agent.md S-5), Change-Ledger-Abschnitt in
> docs/ARCHITECTURE-CHANGES.md existiert — der initiale WP-0c-Eintrag
> wurde am 09.09.2026 nachgetragen (docs/ISSUE-BOARD-389-403.md).
> Schließe hiermit."

---

## Verifikation (Stand 2026-09-09, auf dem Default-Branch ausgeführt)

- `npm run check` grün (lint, format, typecheck, 146 Vitest-Dateien).
- `quality.yml`-Äquivalente lokal grün; E2E (Planner-flow, Controls,
  Responsive) 14 passed / 6 skipped (mobile, projektspezifisch).
- Perf-Gate `npm run perf:edge-routing` und Golden-Master-/Regression-
  Suiten sind Teil der CI-Gates; bei Bedarf lokal wiederholbar.

## Verwandte Dokumente

- `docs/ROUTING-V2.md` — Spec Rev. 2 + Implementierungsstand
- `docs/ROUTING-INVARIANTS.md` — Invarianten (Kostenmodell, Lanes, Clearance)
- `docs/adr/0001–0020` — Entscheidungs-Ledger
- `agent.md` (A-3/A-6) und `docs/ci/pages-deploy-handoff-prompt.md` —
  Aufgaben mit fehlenden Agent-Rechten
