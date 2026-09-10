# Routing V2 — Integrations- und Abschlussbericht

**Stand:** 2026-09-10

**Branch:** `arena/01a087f9-camp`

**Status:** Produktionsintegration und Härtungsrunde verifiziert; Legacy ist außerhalb des
Produktionspfads isoliert, Domain-Clearance ist hart validiert, und das vollständige
Kostenmodell wirkt als baseline-preserving Kandidatenrang.

## 1. Ergebnis in einem Satz

CAMP hat jetzt genau einen produktiven Kabelrouting-Einstiegspunkt: `routePlan()` in
`components/edges/utils/routeAll.ts`. Er normalisiert Eingaben, routet den vollständigen
Plan, führt Hopping und Geometrienormalisierung aus, validiert die zurückgegebene Geometrie
und gibt `{ routes, validation }` zurück. `routeAllCables()` ist nur noch ein
Map-Kompatibilitätsadapter.

## 2. Routing-Wahrheiten

1. **Geometrie:** `PathResult.waypoints` ist die einzige Geometriequelle. SVG-Pfade und
   Hop-Darstellung werden daraus abgeleitet; React Flow berechnet keine Route.
2. **Produktionsorchestrierung:** `routePlan()` ist der einzige vollständige Pass:
   Normalize → Candidate Generation → Collision/Clearance → Cost/Lane Preference →
   Pathfinding → Hopping → Geometry Normalization → Final Validation → Return.
3. **Kollision:** Die gemeinsame Collision Engine in `lib/routing/rules/collision.ts`
   definiert hard/soft/weighted/none. Node-Kollision und kollineare Overlaps bleiben hart;
   echte Crossings sind erlaubt, kosten aber im Primärscore und erzeugen keine elektrische
   Verbindung.
4. **Kosten:** `segmentExtraCost()` klassifiziert dynamische Nachbarsegmente über den
   gemeinsamen `SegmentSpatialIndex` mit der vollständigen hard/soft/weighted/none-Matrix.
   Overlap und konfigurierte Domain-Clearance werden hart verworfen; Crossings bleiben erlaubt
   und kostenpflichtig. Weighted/Nearby sind der sekundäre Kostenrang nach geometrischem
   Gleichstand; `preferredLaneBonus()` ist der letzte deterministische Tie-Break.
5. **Lanes:** Port-Fan-Out ist die lokale Anschlussregel. `LaneRegistry` liefert im
   Orchestrator eine stabile Korridorpräferenz; Reihenfolge ist
   `topologicalOrder → targetPosition → edgeId`, nie Render- oder Array-Reihenfolge.
6. **Electrical:** Routing liest `edgeDomain`, `crossSection` und `locked` ausschließlich
   für Hopping-Priorität. Es schreibt keine elektrischen Werte.
7. **ELK:** ELK/Dagre bleiben globales Node-Layout. ELK-Routen/Junctions sind keine
   Kabelrouting-Wahrheit.
8. **Validation:** `routePlan()` validiert genau die Waypoints, die es zurückgibt. Der
   Report enthält auch die domänenbewusste I3-Prüfung; `RoutedEdge.domain` wird nur aus
   Routing-Metadaten abgeleitet und verändert keine elektrische Semantik. Der Report wird im
   `cableRouteStore` ohne zweiten Produktions-Validierungspfad publiziert.

## 3. Vorher / Nachher

| Bereich          | Vorher                                                                       | Nachher                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Einstieg         | `routeAllCables()` als Map-Rückgabe; Validierung separat im Store            | `routePlan()` mit `{ routes, validation }`; Adapter bleibt für alte Aufrufer                                                     |
| UI-Adapter       | `CableEdge` konnte bei fehlendem Store-Eintrag eine einzelne Route berechnen | `CableEdge` rendert nur veröffentlichte Store-Geometrie; kein lokaler Routing-Fallback                                           |
| Final Validation | Store berechnete den Report erneut aus den Routen                            | Orchestrator validiert vor dem Return; Store publiziert denselben Report                                                         |
| LaneRegistry     | eigenes Modul ohne Produktionskonsument                                      | `buildPreferredLanes()` registriert Korridore vor der Kandidatenwahl                                                             |
| Collision/Cost   | Cost- und Collision-Regeln waren überwiegend isolierte Regeln/Tests          | `SegmentSpatialIndex` + `segmentExtraCost` klassifizieren Produktionskandidaten; hard collision priorisiert sicherere Kandidaten |
| Determinismus    | einzelne Aufrufer übergaben Eingaben in unterschiedlicher Reihenfolge        | Nodes und Edges werden im Orchestrator nach stabiler ID normalisiert                                                             |
| Legacy           | `orthogonalRouting.ts` blieb neben dem Produktionspfad                       | weiterhin klar als Galerie-/Test-Legacy isoliert; keine vorzeitige Löschung                                                      |

## 4. Geänderte Dateien

### Produktionscode

- `components/edges/utils/routeAll.ts` — `routePlan`, zentrale Final Validation,
  LaneRegistry-Präferenz, deterministische Normalisierung; `routeAllCables` delegiert.
- `components/edges/utils/pathfinding.ts` — gemeinsamer `SegmentSpatialIndex`,
  vollständige Kostenrangfolge inklusive Domain-Clearance, Lane-Tie-Break, Token-Härtung
  und React-Flow-Handle-Adapter ohne Legacy-Import.
- `components/edges/utils/routeAll.ts` — deterministisches HopDomain→RoutingDomain-Mapping,
  Domain-Metadaten im Kandidatenpass und Final Validation.
- `lib/routing/invariants.ts` — `RoutedEdge.domain` und `checkDomainClearance()` mit
  Port-/Stub-Ausnahmen über die gemeinsame Collision Engine.
- `lib/routing/rules/costModel.ts` — Domain-Metadaten und diagnostische
  `domainClearanceViolations`.
- `lib/routing/tokens.ts` — Node-Fallbacks, Such-/Kostenlimits und Region-Pad als zentrale
  Routing-Tokens.
- `components/edges/utils/cableRouteStore.ts` — konsumiert `routePlan` und publiziert dessen
  Report.
- `components/edges/CableEdge.tsx` — React-Flow-Adapter ohne direkte Routingberechnung.
- `lib/routing/rules/laneRegistry.ts` — Produktionsanbindung im Modulvertrag dokumentiert.

### Tests und Dokumentation

- `components/edges/utils/routeAll.test.ts` — Produktions-Entry-Point, Report und 100
  permutierte deterministische Läufe.
- `docs/ai/CODE-MAP.md` — Orchestrator, LaneRegistry und Store-Fluss aktualisiert.
- `docs/ai/ROUTING-CONTEXT.md` — tatsächliche Pipeline, API und Routing-Wahrheiten aktualisiert.
- `docs/ai/ARCHITECTURE-RULES.md` — zentrale Wahrheit, React-Flow-Grenze, Lanes und Crossings.
- `docs/ai/KNOWN-PROBLEMS.md` — ROUTE-001 behoben; ROUTE-002 als bewusste Restgrenze präzisiert.
- `docs/ai/ROUTING-V2-COMPLETION-REPORT.md` — dieser Bericht.

## 5. Architekturdiagramm

```text
Planner Domain / Connections
          |
          v
routePlan()  [Normalize: stable node/edge IDs]
          |
          +--> portFanOut + LaneRegistry preferred corridors
          |
          +--> candidate generation / Hanan-A*
          |       |
          |       +--> shared Collision Engine + SegmentSpatialIndex
          |       +--> domain metadata → 24-px pair clearance
          |       +--> geometric score → full weighted model → lane tie-break
          |       +--> hard-overlap/domain-clearance ordering
          |
          +--> Hopping (existing priority rules)
          +--> nudge + mergeCloseBends
          +--> Final Validation on returned waypoints
          |
          +--> { routes, validation }
                    |
                    v
             cableRouteStore
                    |
                    v
          React Flow Adapter / CableEdge / SVG

ELK/Dagre ----------------------> global node layout only
Electrical ---------------------> reads routing metadata; routing writes no electrical semantics
```

## 6. Verifizierte Tests und Befunde

| Gate / Kommando                                                                                                                                                              | Ergebnis                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                                                                           | grün                                                                                                                        |
| `npm run typecheck:tests`                                                                                                                                                    | grün                                                                                                                        |
| `npm test -- --reporter=dot`                                                                                                                                                 | **2026/2026 grün**, 145 Testdateien                                                                                         |
| `npm run lint` / `npm run format:check`                                                                                                                                      | grün                                                                                                                        |
| `npm run check`                                                                                                                                                              | grün; enthält Lint, Format, beide Typechecks und Coverage-Gate                                                              |
| `npm run build`                                                                                                                                                              | grün; Next Production Build erstellt, `/api/chat` bleibt bekannter statischer-Export-Befund (ARCH-001)                      |
| `npm run test:goldenmaster -- --reporter=dot`                                                                                                                                | **13/13 grün**                                                                                                              |
| `npm run test:regression -- --reporter=dot`                                                                                                                                  | **50/50 grün**                                                                                                              |
| `npx vitest run lib/routing/rules/costModel.test.ts lib/routing/invariants.test.ts --reporter=dot`                                                                           | **59/59 grün**; Domain-Cost und harte Domain-Final-Validation enthalten                                                     |
| `npx vitest run components/edges/utils/pathfinding.test.ts components/edges/utils/routeAll.test.ts components/edges/utils/routeAllCollisionGuarantee.test.ts --reporter=dot` | **71/71 grün**                                                                                                              |
| `npx vitest run scripts/routing/architecture.test.ts --reporter=dot`                                                                                                         | **8/8 grün**; Legacy-Orthogonalrouter/Cache außerhalb des Produktionspfads                                                  |
| `npm run routing:audit`                                                                                                                                                      | sechs Referenzpläne; I1–I7 jeweils 0, harte Kollisionen 0, Fallback 0, deterministisch true, 79 Kanten, 48 echte Kreuzungen |
| `npm run routing:domain-probe`                                                                                                                                               | 84 gemischte Segmentpaare, 12 echte Kreuzungen, 0 Clearance-Verstöße ohne Kreuzung                                          |
| `npm audit --omit=optional`                                                                                                                                                  | 0 Vulnerabilities                                                                                                           |
| `git diff --check`                                                                                                                                                           | sauber                                                                                                                      |
| `npm run audit:dead-code`                                                                                                                                                    | **Exit 0**; speicherschonender Wrapper, keine unbestätigten Dead-Code-/Dependency-Befunde                                   |

Die Cost-Model-Änderung wurde gegen Golden Master und Regression geprüft. Eine probeweise
globale Priorisierung der weichen `segmentExtraCost`-Summen vor der geometrischen Route
veränderte die `simple`-Golden-Route und verschlechterte `p02` auf 14 statt 5 Crossings.
Die produktive Lösung ist deshalb lexikographisch: harte Regeln zuerst, geometrische
Primärkosten danach, vollständige gewichtete Modellkosten als realer Tie-Break für
geometrisch gleichwertige Kandidaten, dann Lane-Bonus. Es wurden weder Assertions
abgeschwächt noch Baselines neu aufgezeichnet.

## 7. Restbefunde / bewusst nicht verschleierte Grenzen

1. **Legacy:** `components/edges/utils/orthogonalRouting.ts`, `routingCache.ts` und die
   Galerie-/Qualitätsmodule bleiben als nicht-produktives Referenzmaterial im Baum. Das ist
   durch `scripts/routing/architecture.test.ts` abgesichert; eine spätere Löschung braucht
   nur noch eine Produktentscheidung zur Galerie.
2. **Kostenrang:** Das vollständige Kostenmodell ist produktiv wirksam, aber bewusst nach der
   geometrischen Primärkostenfunktion gerankt. Das verhindert Baseline-Drift durch eine
   sekundäre Nähepräferenz; harte Sicherheitsregeln haben ohnehin Vorrang.
3. **Nudge:** `nudgeOrthogonalPaths` unterstützt einen stabilen `laneOrder`-Parameter,
   verwendet im Produktionspass aber bewusst keine zweite Lane-Geometrie. Die wirksame
   Registry-Integration sitzt in der Kandidatenpräferenz.
4. **E2E:** Lokale Playwright-Ausführung bleibt abhängig von der Browserinstallation; der
   CI-Beleg steht in `KNOWN-PROBLEMS.md` `TEST-001`.

## 8. Abschlussentscheidung

Die Härtungsrunde ist für den Produktionsvertrag abnahmefähig: ein Entry-Point,
keine UI-Routinglogik, deterministische Routen, aktive Domain-aware Final Validation,
Token-Governance, produktiv wirksames vollständiges Kostenmodell sowie grüne Golden-,
Regression-, Architektur- und Invariant-Gates. Legacy-Dateien bleiben ausschließlich als
isoliertes Galerie-/Benchmark-Material bestehen; es gibt keine zweite Produktionswahrheit.
