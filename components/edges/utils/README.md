# `components/edges/utils/` — Router-Engine und Render-Anbindung

## What is this?

Der **ausführende** Teil des Kabel-Routings und alles, was die fertigen Wege in SVG übersetzt.
Hier liegen die Engines; die Regeln, Geometrie-Primitives und Invarianten kommen aus
`lib/routing/` (siehe dessen README).

```
routeAll.ts          GLOBALER PASS (Produktivpfad) — routeAllCables, Port-Fan-Out-Gruppen
pathfinding.ts       Einzelroute: Katalog → Hanan-A* → Fallback (findCablePath)
cableRouteStore.ts   React-Anbindung, Cache, Drossel, Live-Final-Report
nudge.ts             Überlappungen paralleler Trassen auflösen
pathUtils.ts         Waypoints → SVG (mit Hop-Bögen), Label-Geometrie
nodeGeometry.ts      React-Flow-12-Adapter (measured/internals/handleBounds)
routableNodes.ts     Präsentations-Grenze: welche Knoten der Router sehen darf
routingDebug.ts      Diagnose des Live-Routings (NEXT_PUBLIC_ROUTING_DEBUG=1)
voltageDrop.ts       Anzeige-Größen einer Kante (delegiert an lib/)
orthogonalRouting.ts LEGACY-Router (nur Galerie + Tests) — siehe unten
routingScenarios.ts  25 konstruierte Galerie-Szenarien
routingQuality.ts    Qualitätsmetriken (kein Gate, nutzt den Legacy-Router)
```

## Der Produktivpfad

```
<FlowCanvas>  →  <CableRouteSync/>  (cableRouteStore.ts)
                   │ Signatur aus Node-Geometrie + Kantentopologie
                   ▼
             routeAllCables(nodes, edges)      routeAll.ts
                   │  je Kante: findCablePath  pathfinding.ts
                   │            Katalog → hananAStar → Fallback
                   │  danach:   nudge → mergeCloseBends → resolveHops → Crossings
                   ▼
             publishCableRoutes()  →  useCableRoute(id)  →  <CableEdge> SVG
```

**Nicht** im Produktivpfad: `orthogonalRouting.ts`. Siehe unten und
[`docs/ai/LEGACY.md`](../../../docs/ai/LEGACY.md).

## What is the public API?

| Symbol                                                                           | Datei                | Zweck                                                   |
| -------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------- |
| `routeAllCables(nodes, edges)`                                                   | `routeAll.ts`        | **Einstieg des globalen Passes**                        |
| `resolveHandlePoint(node, handleId, kind, flow?)`                                | `routeAll.ts`        | Port-Punkt + Richtung (Flussrichtung)                   |
| `portFanOutLanes(edges, resolve)`                                                | `routeAll.ts`        | Lane-Vergabe je (Bauteil, Seite)                        |
| `findCablePath(request)`                                                         | `pathfinding.ts`     | Einzelroute (`usedSearch: catalog\|astar\|fallback`)    |
| `catalogCandidates`, `bestFreeCatalog`, `portFrame`                              | `pathfinding.ts`     | Katalog + Stub-Geometrie                                |
| `routeDefectScore(points)`                                                       | `pathfinding.ts`     | Mängel-Strafe (Kehren, Kurzsegmente, Selbstüberlappung) |
| `buildHananGridMasks(xs, ys, solids)`                                            | `pathfinding.ts`     | Blockade-Markierung (PERF-001)                          |
| `nodesToObstacles`, `nodeObstacleMap`                                            | `pathfinding.ts`     | Hindernis-Boxen inkl. Handle-Ausrisse                   |
| `pathfindingFallbackCount`, `resetPathfindingTelemetry`, `clearPathfindingCache` | `pathfinding.ts`     | Telemetrie/Cache                                        |
| `CableRouteSync`, `useCableRoute`, `useCableRouteFinalValidation`                | `cableRouteStore.ts` | Render-Anbindung                                        |
| `nodeLayoutSignature`, `edgeTopologySignature`, `createThrottledRunner`          | `cableRouteStore.ts` | Invalidierung, Drossel (100 ms)                         |
| `isPresentationOnlyNode`, `routableNodes`, `collectRoutableNodes`                | `routableNodes.ts`   | Darstellungs-Knoten aus dem Routing-Input entfernen     |
| `routingDebugEnabled`, `logRoutingRun`, `formatRoutingDebugRun`                  | `routingDebug.ts`    | Diagnose pro Routing-Lauf (standardmäßig aus)           |
| `nudgeOrthogonalPaths(paths, {obstacles})`                                       | `nudge.ts`           | Trassen separieren                                      |
| `waypointsToPath`, `waypointsToPathWithHops`, `polylineMidpoint`                 | `pathUtils.ts`       | SVG-Erzeugung                                           |
| `edgeDropInputs`, `hasVoltageDropError`                                          | `voltageDrop.ts`     | Anzeige-Größen (delegiert an `lib/`)                    |

## What does it own?

- Die **Reihenfolge** der Routing-Garantien (volle Freigabe > Trassensperre).
- Die **Auswahl** `catalog` vs. `astar` vs. `fallback` und die Sichtbarkeit von Ausnahmen
  (`fallbackHitsObstacles`, `tightMarginUsed`).
- Die **Invalidierung** des Route-Caches (inhaltsbasierte Signaturen statt Positionssumme).
- Die **Übersetzung** Wegpunkte → SVG (einschließlich Hop-Bögen).

## What must not happen here?

0. **Kein Darstellungs-Knoten im Router.** Der Hauptstromkreis-Rahmen (und jedes
   künftige Overlay) ist kein Hindernis, kein Port und kein Prüfgegenstand
   (Rule P, ADR 0022). Die Grenze ist `routableNodes.ts`; `routeAllCables`,
   `computeCableRouteFinalValidation` und `CableRouteSync` filtern selbst, damit
   kein Aufrufer die Regel vergessen kann. Gegenprobe in
   `routeAll.test.ts` / `cableRouteStore.test.ts`.
1. **Keine elektrische Semantik ändern.** Routing schreibt keine `crossSection`, `fuseSize`
   oder `edgeDomain` (Rule C). Es liest sie nur für die Hop-Priorität.
2. **Kein Lesen von `edge.data.geometry`** — verboten per
   `scripts/routing/architecture.test.ts` (ADR 0014).
3. **Keine Abstands-Zahl** — alle Werte kommen aus `lib/routing/tokens.ts` (Rule E).
4. **Kein `Math.random`, kein ungeordnetes Iterieren** — Determinismus ist Pflicht (ADR 0010).
5. **Kein UI-State** im Router: `routeAllCables` ist eine reine Funktion; React lebt in
   `cableRouteStore.ts`.
6. **Keine Änderung am Legacy-Router als „Routing-Fix“ verkaufen** — er rendert nicht.

## Legacy: `orthogonalRouting.ts`

`buildOrthogonalPath` / `orthogonalWaypoints` / `avoidObstacles` sind der erste Router des
Projekts. Konsumenten heute: `scripts/routing/generate-gallery.ts`,
`routingQuality.ts` und drei Testdateien. **Nicht** vom Canvas.
Zugehörige Invarianten: **R1–R7** in `docs/ROUTING-INVARIANTS.md` — nicht zu verwechseln mit
**I1–I10** in `lib/routing/invariants.ts`.

## Which tests protect it?

| Datei                                                        | Schutz                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `routeAll.test.ts`                                           | globaler Pass, Fan-Out, Tubes, Fenster-Nachzug              |
| `routeAllCollisionGuarantee.test.ts`                         | ROUTE-001: markierter Fallback statt lautloser Durchroutung |
| `pathfinding.test.ts` (801)                                  | Katalog, A*, Kehren, Kurzsegmente, Cache, Seedszenen        |
| `hananGridMasks.test.ts`                                     | Äquivalenz der Index-Markierung zur alten Schleife          |
| `nudge.test.ts`, `pathUtils.test.ts`, `nodeGeometry.test.ts` | Nachbearbeitung, SVG, Geometrie-Adapter                     |
| `cableRouteStore.test.ts`                                    | Signaturen, Drossel, Live-Report, Darstellungs-Grenze       |
| `routableNodes.test.ts`                                      | Präsentations-Grenze (Typ + `data.presentationOnly`)        |
| `routingDebug.test.ts`                                       | Diagnoseformat inkl. „gemessen ⇄ nicht gemessen“            |
| `routingGallery.test.ts`                                     | 25 Galerie-Szenarien (Legacy-Router)                        |
| `routingQuality.test.ts`                                     | Qualitätsmetriken (Legacy-Router)                           |
| `scripts/routing/finalValidation.test.ts`                    | I1–I3 Ratchet über die Referenzpläne                        |
| `scripts/regression/regression.test.ts`                      | 15 Szenarien: Layout, Metrik, SVG, Verhalten                |

Weitere Details: [`docs/ai/ROUTING-CONTEXT.md`](../../../docs/ai/ROUTING-CONTEXT.md).
