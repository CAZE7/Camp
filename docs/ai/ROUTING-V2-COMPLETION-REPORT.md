# Routing V2 — Integrations- und Abschlussbericht

**Stand:** 2026-09-09  
**Branch:** `arena/01a087f9-camp`  
**Status:** Produktionsintegration verifiziert; Legacy-Entfernung und vollständige Kostenmatrix bleiben bewusst offen.

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
   gemeinsamen `SegmentSpatialIndex`. Harte Overlaps werden gegenüber einer kollisionsfreien
   Kandidatenroute nicht bevorzugt. `preferredLaneBonus()` zieht bei Gleichstand zur
   deterministischen LaneRegistry-Präferenz.
5. **Lanes:** Port-Fan-Out ist die lokale Anschlussregel. `LaneRegistry` liefert im
   Orchestrator eine stabile Korridorpräferenz; Reihenfolge ist
   `topologicalOrder → targetPosition → edgeId`, nie Render- oder Array-Reihenfolge.
6. **Electrical:** Routing liest `edgeDomain`, `crossSection` und `locked` ausschließlich
   für Hopping-Priorität. Es schreibt keine elektrischen Werte.
7. **ELK:** ELK/Dagre bleiben globales Node-Layout. ELK-Routen/Junctions sind keine
   Kabelrouting-Wahrheit.
8. **Validation:** `routePlan()` validiert genau die Waypoints, die es zurückgibt. Der
   Report wird im `cableRouteStore` ohne zweiten Produktions-Validierungspfad publiziert.

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
  `segmentExtraCost`-Hard-Collision-Klassifikation und `preferredLaneBonus` in der
  Kandidatenbewertung.
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
          |       +--> primary score: length + bends + crossings
          |       +--> hard-overlap ordering + preferred-lane tie-break
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

| Gate / Kommando                                                                                        | Ergebnis                                                                                                                    |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                     | grün                                                                                                                        |
| `npm run test:goldenmaster -- --reporter=dot`                                                          | **13/13 grün**                                                                                                              |
| `npm run test:regression -- --reporter=dot`                                                            | **50/50 grün**                                                                                                              |
| `npx vitest run lib/routing/invariants.test.ts components/edges/utils/routeAll.test.ts --reporter=dot` | **56/56 grün**                                                                                                              |
| `npm run routing:audit`                                                                                | sechs Referenzpläne; I1–I7 jeweils 0, harte Kollisionen 0, Fallback 0, deterministisch true, 79 Kanten, 48 echte Kreuzungen |

Die Cost-Model-Änderung wurde gegen Golden Master und Regression geprüft. Eine probeweise
Aufwertung der weichen `segmentExtraCost`-Summen zum primären Tie-Break veränderte die
`simple`-Golden-Route und verschlechterte `p02` auf 14 statt 5 Crossings; diese Änderung
wurde deshalb verworfen. Es wurden weder Assertions abgeschwächt noch Baselines neu
aufgezeichnet.

## 7. Offene Probleme / kontrollierte nächste Schritte

1. **ROUTE-002:** Soft-/Weighted-Kosten werden klassifiziert, sind aber noch nicht der
   primäre Kandidatenvergleich. Ein nächster Schritt braucht einen eigenen Messlauf und darf
   Baselines nur bei nachgewiesener Verbesserung ändern.
2. **ROUTE-003:** Domänenspezifische Clearance (`electrical ↔ water`, `ac230 ↔ dc12`) ist
   als Regel vorhanden, aber noch nicht je Kantenpaar im Produktionsrouter verdrahtet.
3. **ROUTE-004:** Einige Such- und Frame-Budgetwerte sind noch nicht vollständig als Tokens
   bzw. Drift-Guards modelliert.
4. **Legacy:** `components/edges/utils/orthogonalRouting.ts` und zugehörige Galerie-/Tests
   bleiben bis zu einem separaten Beweis isoliert. Sie sind nicht Teil von `routePlan()` und
   werden nicht aus dem Renderpfad aufgerufen.
5. **Nudge:** `nudgeOrthogonalPaths` unterstützt einen stabilen `laneOrder`-Parameter,
   verwendet im Produktionspass aber bewusst keine zweite Lane-Geometrie. Die wirksame
   Registry-Integration sitzt in der Kandidatenpräferenz.

## 8. Abschlussentscheidung

Die erste Integrationsstufe ist für den Produktionsvertrag abnahmefähig: ein Entry-Point,
keine UI-Routinglogik, deterministische Routen, aktive Final Validation und grüne Golden-,
Regression- und Invariant-Gates. Die Gesamtmigration ist **nicht** als vollständige
Legacy-Entfernung oder vollständige Kostenmatrix abgeschlossen; diese Punkte bleiben als
explizite, testbare Folgearbeiten dokumentiert.
