# ARCHITECTURE-V2 — Architecture Contract & Dependency Map

> **WP-0a (#401), Phase 0 des Routing-V2-Plans** (`docs/AGENT-PLAN-ROUTING-V2.md`).
> Dieses Dokument ist der verbindliche Architekturvertrag für CAMP V2 und die
> Bestandsaufnahme des Ist-Zustands (Stand 2026-09-06). Es dokumentiert — es baut
> **nichts** um. Jeder V2-PR wird gegen die Prinzipien in Abschnitt 2 reviewt.
> Änderungen am Contract nur via ADR + Eintrag im Change Ledger
> (`docs/ARCHITECTURE-CHANGES.md`).

---

## 1. Schichtenmodell (Zielbild)

```text
UI                          (Next.js-Seiten, Panels, Inspector, Sidebar)
 ↓
React Flow Adapter          (FlowCanvas, CableEdge/WaterPipeEdge, Node-Komponenten,
                             CableRouteSync — alles, was RF-Typen/Hooks anfasst)
 ↓
Planner Domain
   ├── AutoWire             (lib/autoWire + lib/autoWire/*)
   ├── Electrical           (lib/electrical, lib/vde-standards, lib/units)
   └── Validation           (VDE-Prüfungen, strukturierte Regel-/Fehlerobjekte)
 ↓
Routing Engine              (Geometrie → Routing Rules → Router; V2: lib/routing/*)
 ↓
Layout / Rendering          (Pfad-Strings, Lanes, Labels, Hops)
```

Innerhalb der Routing Engine gelten drei Unterschichten (ROUTING-V2.md §2.3):

```text
1. Geometry      — pure Geometrie-Primitives, kein Domänenwissen
2. Routing Rules — Tokens, Kollisionsklassen, Lanes, Kostenmodell (router-agnostisch)
3. Domain Rules  — fachliche Trennregeln (domainSeparationRules)
```

## 2. Architektur-Prinzipien (Contract, Review-Checkliste)

Jeder PR muss diese vier Fragen mit **Ja** beantworten können:

1. **React Flow kennt keine Elektrofachlogik.**
   Kein RF-Adapter-Code (Edges, Nodes, Canvas) berechnet Querschnitte, Ströme,
   Sicherungen oder VDE-Regeln — er ruft die Planner Domain auf und rendert deren
   Ergebnis.
2. **AutoWire kennt kein React.**
   `lib/autoWire*` importiert aus `reactflow` ausschließlich **Typen**
   (`import type { Node }`), niemals Laufzeit-Werte, Hooks oder Komponenten.
3. **Routing kennt keine UI.**
   Die Routing Engine erhält Geometrie (Rects, Punkte, Handles) und Kantenreferenzen
   und liefert Pfade/Waypoints. Sie liest weder Zustand aus Stores noch rendert sie.
4. **Validierung liefert strukturierte Regeln/Fehler.**
   Prüfungen geben maschinenlesbare Ergebnisse zurück (Regel-ID, betroffene
   Entität, Grenzwert, Ist-Wert) — keine vorformatierten UI-Strings als einzige
   Wahrheit.

Zusätzlich (aus AGENT-PLAN, immer gültig):

- Geometriewerte kommen aus Design Tokens (WP-1) — keine Hardcodes.
- Ein PR verändert genau eine Verantwortung; bestehende Tests bleiben grün.
- Bottom-up: Geometry → Rules → Algorithms → Domain → Store → UI.

## 3. Ist-Zustand: Modul-Landkarte

### 3.1 Routing-Pipeline (Aufrufgraph, vereinfacht)

```text
FlowCanvas (RF-Adapter)
 └─ <CableRouteSync>                        components/edges/utils/cableRouteStore.ts
     ├─ liest RF-Store (nodeInternals, edges) → Layout-/Topologie-Signatur (R-9)
     ├─ createThrottledRunner (100 ms)      — Drossel + trailing run
     └─ routeAllCables(nodes, edges)        components/edges/utils/routeAll.ts
         ├─ resolveHandlePoint()            — Handle-Punkt + Orientierung (R-7)
         ├─ portOrderedLaneOffsets()        — Fan-Out-Reihenfolge am Port (R-6)
         ├─ findCablePath()                 components/edges/utils/pathfinding.ts
         │   ├─ Katalog (routeWaypoints)    components/edges/utils/orthogonalRouting.ts
         │   ├─ Hanan-A* (searchOnce)       — bei Katalog-Kollision
         │   ├─ Modul-Cache (Map, Key aus Request)
         │   └─ crossingSegments            components/edges/utils/routingCache.ts
         │       └─ SegmentSpatialIndex     components/edges/utils/segmentSpatialIndex.ts
         ├─ alignSharedCorridors()          — Korridor-Bündelung (8-px-Halbton)
         └─ nudgeOrthogonalPaths()          components/edges/utils/nudge.ts
     └─ publishCableRoutes(Map<id, PathResult>)  — Modul-Singleton + Listener

CableEdge / WaterPipeEdge (RF-Adapter)
 ├─ useCableRoute(id)                       — Subscription auf den Routen-Store
 └─ Fallback ohne globale Route: findCablePath() direkt (pro Kante, useMemo)
```

### 3.2 Domain-Pipeline

```text
graphSlice.autoConnect()
 └─ performAutoWiring(nodes, edges)         lib/autoWire.ts
     ├─ buildDictionaries / ensureNode / addDcEdge / addAcEdge   lib/autoWire/routing.ts
     ├─ healUserEdges / resolveRails / pickHouseBattery          lib/autoWire/routing.ts
     ├─ applyFlowLayout (16-px-Raster, R-8)                      lib/autoWire/placement.ts
     ├─ sizeDcEdges / sizeAcEdges / applyFuseSizes               lib/autoWire/sizing.ts
     │   ├─ calculateEdgeCurrent / getSystemVoltage              lib/vde-standards.ts
     │   ├─ calculateCrossSection / selectFuseSize               lib/electrical.ts
     │   └─ cumulativeDropAt / relevantCumulativeDrop            lib/autoWire/sizing.ts
     └─ isAcEdge / isSolarEdge / isStarterBattery                lib/autoWire/validation.ts
```

## 4. Dependency Map (Bestandsaufnahme)

### 4.1 Wer besitzt welchen Zustand?

| Zustand                                                     | Besitzer                                                                 | Konsumenten                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| Nodes/Edges (elektrisch + Wasser), History, UI-Flags        | `store/usePlannerStore.ts` (zustand, persist) via `graphSlice`/`uiSlice` | UI, FlowCanvas, CableEdge (Selektoren)       |
| RF-interne Node-Messungen (`nodeInternals`, `handleBounds`) | React Flow Store                                                         | CableRouteSync, resolveHandlePoint           |
| Geroutete Pfade (`Map<edgeId, PathResult>`)                 | Modul-Singleton in `cableRouteStore.ts` (`current` + Listener)           | CableEdge, WaterPipeEdge via `useCableRoute` |
| Pfad-Cache (Request-Key → PathResult)                       | Modul-`Map` in `pathfinding.ts` (LRU-artig begrenzt)                     | findCablePath                                |
| Hindernis-/Segment-Caches                                   | WeakMap/Module in `routingCache.ts`                                      | crossingSegments*, obstaclesExcluding        |
| Abgeleiteter Systemzustand (nodesMap, totalWatts)           | WeakMap-Caches in `store/slices/graphInternals.ts`                       | getDerivedSystemState, CableEdge-Selektoren  |
| Spannungsfall-Cache (`pathDropCache`)                       | WeakMap in `graphInternals.ts` (Signatur ignoriert Positionen)           | relevantCumulativeDrop-Aufrufer              |
| Komponenten-Spezifikationen                                 | `components/registry/componentRegistry.ts` (Registry-Map)                | Nodes, Handles, Domänenlogik                 |

### 4.2 Seiteneffekte & Mutationen

| Ort                                               | Effekt                                                                                                                      | Bewertung für V2                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `cableRouteStore.publishCableRoutes`              | globaler Singleton-Publish außerhalb React/zustand                                                                          | bleibt als Mechanik (P-6-Worker-Vertrag ersetzt später die Berechnungsseite)                   |
| `pathfinding.ts` Modul-Cache                      | verdeckter globaler Zustand; Invalidierung nur über Key-Inhalt                                                              | V2: Cache hinter Engine-Fassade, Key aus vollständiger Signatur                                |
| `graphSlice` `set(...)`-Aufrufe (42×)             | einziger legitimer Mutationspunkt des Plans                                                                                 | bleibt; Domain-Funktionen selbst mutieren nicht                                                |
| `performAutoWiring`                               | arbeitet auf **Kopien** (`map`-Klone), gibt neue Arrays zurück — pure bis auf `newEntityId()` (Zufalls-IDs für neue Knoten) | ID-Erzeugung ist die einzige Nichtdeterminismus-Quelle; Golden Master normalisiert sie (WP-0b) |
| `applyFlowLayout`                                 | verschiebt nur automatisch erzeugte Knoten, deterministisch                                                                 | bleibt                                                                                         |
| `nudgeOrthogonalPaths`                            | mutiert übergebene Waypoint-Arrays in place                                                                                 | V2 (WP-8): gescoped auf betroffene Lanes; Signatur beibehalten                                 |
| WeakMap-Caches (`graphInternals`, `routingCache`) | an Array-Referenzen gebunden, Invalidierung durch neue Referenzen                                                           | bewährtes Muster, bleibt                                                                       |

### 4.3 Doppelte Regeln / doppelt gepflegte Werte (Migrationsziel WP-1/WP-2)

| Wert                                    | Vorkommen                                                                                                                        | Soll (V2)                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ROUTE_BORDER_RADIUS = 10`              | `orthogonalRouting.ts:32`, `pathfinding.ts:27`, `SMOOTH_STEP_BORDER_RADIUS` in `pathUtils.ts`                                    | ein Token (WP-1); V2-Ziel `bendRadius = 8` wird erst mit Bend-Merge (WP-2) aktiv |
| `ROUTE_MIN_STUB = 24`                   | `orthogonalRouting.ts:33`, `pathfinding.ts:28`                                                                                   | Token `stubMin`                                                                  |
| `OBSTACLE_MARGIN = 14`                  | `orthogonalRouting.ts:34`, `pathfinding.ts:29`                                                                                   | Token (≥ `cableClearance` 12, testgesichert)                                     |
| Node-Fallback 192×120                   | `orthogonalRouting.ts`, `pathfinding.ts`, `routeAll.ts` (`NODE_W/H`), `planner/utils/layout.ts`                                  | eine Quelle                                                                      |
| 16-px-Raster                            | `PARALLEL_LANE_SPREAD` (pathUtils), `NUDGE_GAP` (nudge), `U_TURN_LANE_SPREAD = 2·16` (pathfinding), `AUTO_WIRE_GRID` (placement) | Token `laneGrid`                                                                 |
| Ausweich-Parallelen ±48/±96             | `ALTERNATIVE_ROUTE_GAP = 48` (pathfinding; historisch „±40/±80“)                                                                 | `3 × laneGrid`, später LaneRegistry (WP-5)                                       |
| Halbton-Raster 8 px                     | `LANE_GRID = 8` in `routeAll.ts`                                                                                                 | `laneGrid / 2`                                                                   |
| AC-Handle-Listen (`ac_in`, `ac_out`, …) | `lib/electrical.ts` (getEdgeDomain + getHandleDomain) und Registry (`builtinComponents.ts`)                                      | eine Quelle (Registry), Electrical konsumiert                                    |
| Routing-Konstanten in zwei Routern      | Katalog-Router (`orthogonalRouting.ts`) und A*-Router (`pathfinding.ts`) definieren Kosten/Margins jeweils selbst                | Schicht 2 „Routing Rules“ — beide Router konsumieren dieselben Regeln            |

## 5. Datei-Katalog (Kern-Dateien)

| Datei                                           | Aufgabe                                                   | Bleiben   | Ändern                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `components/edges/utils/pathfinding.ts`         | Hanan-A*, Katalog-Fallback, Pfad-Cache, Kostenmodell      | teilweise | ja — Kostenmodell → WP-6 (Tokens), Geometrie → WP-2, Cache hinter Engine-Fassade                          |
| `components/edges/utils/orthogonalRouting.ts`   | Katalog-Routing (Z/L/U-Wege), Detours, Waypoint-Erzeugung | teilweise | ja — bleibt Fallback-Router (WP-4), Konstanten → Tokens, Geometrie → WP-2                                 |
| `components/edges/utils/routeAll.ts`            | globaler Pass: Handles, Fan-Out, Korridore, Nudging       | teilweise | ja — Fan-Out → WP-9, Korridore → LaneRegistry (WP-5), Re-Routing-Scope → WP-8                             |
| `components/edges/utils/pathUtils.ts`           | Lane-/Label-Offsets, Pfad-Strings                         | teilweise | ja — Geometrie migriert nach `lib/routing/geometry/` (WP-2)                                               |
| `components/edges/utils/segmentSpatialIndex.ts` | Raster-Index für Segmente                                 | ja        | ja — Basis des A*-Kostenmodells (WP-6), zieht nach `lib/routing/`                                         |
| `components/edges/utils/nudge.ts`               | Parallelverschiebung überlappender Segmente               | ja        | ja — gescoped (WP-8/P-5)                                                                                  |
| `components/edges/utils/cableRouteStore.ts`     | Routen-Singleton, Signaturen, Throttle, `CableRouteSync`  | ja        | ja — Worker-Anbindung (P-6), Affected-Set (WP-8)                                                          |
| `components/edges/utils/routingCache.ts`        | Hindernis-/Kreuzungs-Caches                               | ja        | ja — Invalidierung an Engine-Fassade                                                                      |
| `components/edges/CableEdge.tsx`                | Kanten-Rendering, Labels, Fehlerzustand                   | ja        | stark — Hop-Rendering (WP-7), RF-12-API (S-1), Fallback-Routing raus, konsumiert nur noch Engine-Ergebnis |
| `store/slices/graphSlice.ts`                    | Plan-Zustand, History, autoConnect, Layout-Trigger        | ja        | ja — Re-Routing-Trigger (WP-8), keine Fachlogik-Zunahme                                                   |
| `lib/autoWire.ts` + `lib/autoWire/*`            | Verdrahtung, Platzierung, Dimensionierung                 | ja        | wenig — Contract-konform (kein React); ID-Determinismus für Golden Master beachten                        |
| `lib/electrical.ts`                             | Querschnitt/Sicherung/Domänen                             | ja        | splitten — Berechnung vs. Domänen-Klassifikation (Registry als Quelle der Handle-Domänen)                 |
| `lib/vde-standards.ts`                          | VDE-Modell, Systemspannung, Kantenströme                  | ja        | splitten — Regeln (Validation) von Berechnung trennen; strukturierte Fehler                               |
| `components/registry/*`                         | Komponenten-/Handle-Spezifikationen                       | ja        | erweitern — einzige Quelle für Handle-Domänen und Port-Reihenfolge (`FIXED_ORDER`, WP-9)                  |
| `components/planner/utils/layout.ts`            | dagre-freies Spalten-Layout (E-CAD-Ränge)                 | ja        | ja — Ränge/Ordnung als Input für ELK-`considerModelOrder` (WP-4)                                          |
| `components/planner/FlowCanvas.tsx`             | RF-Canvas, Drag-Handling, `CableRouteSync`-Einbau         | ja        | ja — Zwei-Qualitäts-Stufen beim Drag (WP-8/P-2), RF 12 (S-1)                                              |

## 6. Verstöße gegen den Contract im Ist-Zustand (Befund, kein Umbau)

1. **CableEdge routet selbst** (Fallback ohne globale Route: `findCablePath` im
   `useMemo`) — UI-Schicht ruft die Routing-Engine direkt pro Kante. V2: die Engine
   liefert immer; der Adapter rendert nur (WP-8 stellt Vorschau-Qualität bereit).
2. **Routing lebt unter `components/edges/utils/`** — physisch in der Adapter-Schicht,
   logisch Engine. V2: Migration nach `lib/routing/` (schrittweise, WP-2 beginnt).
3. **Domänenwissen doppelt**: AC-Handle-Listen in `lib/electrical.ts` und Registry
   (Abschnitt 4.3). V2: Registry ist die Quelle.
4. **Geometriewerte mehrfach definiert** (Abschnitt 4.3). V2: WP-1 Tokens.
5. **`getEdgeDomain`-Heuristik** (Typ-Namen wie `solar`, `shorePower` hart codiert)
   statt Registry-Spezifikation — funktional korrekt, aber zwei Wahrheiten.

Kein Verstoß gefunden bei: AutoWire (importiert nur RF-Typen), Store-Slices
(Mutationen ausschließlich über `set`), Validation-Rückgaben der Sizing-Schicht.

## 7. Werkzeuge der Erhebung

- Code-Trace über Import-Graph (`grep`-Analyse aller `import`-Kanten der Kern-Dateien).
- `knip.ts` (Dead-Code-/Dependency-Audit, `npm run audit:dead-code`) — Einstiegspunkte
  und Projektumfang wie dort konfiguriert; Befunde sind Prüf-, keine Löschliste.
- Bestehende Invarianten: `docs/ROUTING-INVARIANTS.md`, Tests in
  `components/edges/utils/*.test.ts` (bleiben unverändert gültig).
