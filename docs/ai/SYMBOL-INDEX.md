# SYMBOL-INDEX

Die wichtigsten Symbole: **Symbol · File · Purpose · Called By · Tests**.
Kein Anspruch auf Vollständigkeit — es fehlen bewusst UI-Helfer und reine Rendertypen.

---

## AutoWire

| Symbol                            | File                         | Purpose                                              | Called By                                | Tests                                                 |
| --------------------------------- | ---------------------------- | ---------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| `performAutoWiring`               | `lib/autoWire.ts`            | Gesamtlauf: Topologie + Sizing + Platzierung         | `store/slices/graphSlice.ts`             | `lib/autoWire.test.ts`, `vde-properties.test.ts` (G5) |
| `sizeDcEdges`                     | `lib/autoWire/sizing.ts`     | Querschnitt je DC-Kante (thermisch + Drop, iterativ) | `performAutoWiring`                      | `lib/autoWire/sizing.test.ts`, G7                     |
| `applyFuseSizes`                  | `lib/autoWire/sizing.ts`     | Sicherungsnennstrom je Plus-Kante                    | dto.                                     | dto.                                                  |
| `applyFuseTypes`                  | `lib/autoWire/sizing.ts`     | Bauform aus Bank-Ik                                  | dto.                                     | `lib/shortCircuit.test.ts`                            |
| `sizeAcEdges`                     | `lib/autoWire/sizing.ts`     | AC-Querschnitt, AC-Schutzorgan, AC-Sicherung         | dto.                                     | `lib/autoWire/sizing.test.ts`                         |
| `acCurrentA`                      | `lib/autoWire/sizing.ts`     | AC-Strom einer Kante (Insel-BFS)                     | `sizeAcEdges`, `voltageDrop.ts`          | dto.                                                  |
| `cumulativeDropAt`                | `lib/autoWire/sizing.ts`     | kumulierter Spannungsfall am Knoten                  | `relevantCumulativeDrop`, Store          | `lib/autoWire/sizing.test.ts`                         |
| `relevantCumulativeDrop`          | `lib/autoWire/sizing.ts`     | Versorgungs-Pfad-Drop (Fallback: beliebiger Pfad)    | `sizeDcEdges`                            | dto.                                                  |
| `applyFlowLayout`                 | `lib/autoWire/placement.ts`  | Platzierung **selbst erzeugter** Knoten              | `performAutoWiring`                      | `lib/autoWire/placement.test.ts`                      |
| `resolveRails`                    | `lib/autoWire/routing.ts`    | Plus-/Minus-Schiene (find-or-create)                 | `performAutoWiring`                      | `lib/autoWire.test.ts`                                |
| `healUserEdges`                   | `lib/autoWire/routing.ts`    | Nutzer-Kanten heilen/entfernen                       | dto.                                     | dto.                                                  |
| `pickHouseBattery`                | `lib/autoWire/routing.ts`    | Aufbaubatterie wählen                                | dto.                                     | dto.                                                  |
| `addDcEdge` / `addAcEdge`         | `lib/autoWire/routing.ts`    | Kantenerzeugung mit Duplikatschutz                   | dto.                                     | dto.                                                  |
| `edgeLength` / `edgeCrossSection` | `lib/autoWire/primitives.ts` | geprüftes Lesen aus `edge.data`                      | Sizing, Validierung                      | `lib/autoWire/sizing.test.ts`                         |
| `crossSectionForDrop`             | `lib/autoWire/primitives.ts` | Minimalquerschnitt für ein Drop-Budget               | `sizeDcEdges`                            | dto.                                                  |
| `nextStandardCrossSection`        | `lib/autoWire/primitives.ts` | Aufrunden auf Normreihe (nie verkleinern)            | Sizing                                   | dto.                                                  |
| `chemistriesParallelSafe`         | `lib/autoWire/primitives.ts` | Parallelschaltbarkeit zweier Akkus                   | `performAutoWiring`, `useLiveValidation` | `lib/autoWire.test.ts`, `useLiveValidation.test.ts`   |
| `isAcEdge` / `isSolarEdge`        | `lib/autoWire/validation.ts` | Domänen-Klassifikation                               | Sizing, Routing                          | `lib/autoWire.test.ts`                                |

---

## Electrical

| Symbol                                       | File                                            | Purpose                                    | Called By                          | Tests                                              |
| -------------------------------------------- | ----------------------------------------------- | ------------------------------------------ | ---------------------------------- | -------------------------------------------------- |
| `calculateEdgeCurrent`                       | `lib/vde-standards.ts`                          | **einzige** Stromquelle                    | AutoWire, `CableEdge`, Validierung | `vde-standards.test.ts`, `vde-consistency.test.ts` |
| `getSystemVoltage`                           | `lib/vde-standards.ts`                          | Systemspannung (Aufbaubatterie zuerst)     | überall                            | `vde-standards.test.ts`, `vde-properties.test.ts`  |
| `dischargeFloorVoltage`                      | `lib/vde-standards.ts`                          | Entladeschlussspannung (0,9375 × U)        | `calculateEdgeCurrent`             | dto.                                               |
| `calculateAcEdgeCurrent`                     | `lib/vde-standards.ts`                          | AC-Strom über Insel-BFS                    | Anzeige/Validierung                | dto.                                               |
| `calculateCrossSection`                      | `lib/electrical.ts`                             | Querschnitt aus Drop + thermisch           | AutoWire, Anzeige                  | `electrical.test.ts`, G4                           |
| `selectFuseSize`                             | `lib/electrical.ts`                             | Sicherungsnennstrom (nie über Kabelgrenze) | AutoWire, Validierung              | `electrical.test.ts`, G1/G2                        |
| `isFuseFeasible`                             | `lib/electrical.ts`                             | „ist dieser Querschnitt absicherbar?“      | Validierung                        | `electrical.test.ts`                               |
| `calculateMaxFuse` / `maxFuseForDisplay`     | `lib/electrical.ts`                             | Kabelgrenze (streng / anzeigesicher)       | Sizing, Anzeige                    | `electrical.test.ts`                               |
| `lookupThermalCrossSection`                  | `lib/electrical.ts`                             | thermischer Mindestquerschnitt             | `calculateCrossSection`, Sizing    | dto.                                               |
| `getEdgeDomain` / `getHandleDomain`          | `lib/electrical.ts`                             | Domänenzuordnung (eine Quelle)             | Store, AutoWire, Anzeige           | `electrical.test.ts`, G6                           |
| `voltageDrop` / `crossSectionForVoltageDrop` | `lib/units.ts`                                  | ΔU = I·2L/(κ·A) und Umkehrung              | Primitives, Anzeige                | `units.test.ts`, G3                                |
| `edgeDropInputs` / `hasVoltageDropError`     | `components/edges/utils/voltageDrop.ts`         | Anzeige-Größen einer Kante (delegiert nur) | `CableEdge`, `FlowCanvas`          | `voltageDrop.test.ts`                              |
| `calculateConduitFillPercent`                | `lib/vde-standards.ts`                          | Leerrohr-Füllgrad (40 %)                   | ExpertPanel/Validierung            | `vde-standards.test.ts`                            |
| `collectEdgeErrors`                          | `components/edges/CableEdge.tsx`                | Kanten-Fehler (9 Regeln)                   | `CableEdge`                        | `CableEdge.test.tsx`                               |
| `useLiveValidation`                          | `components/planner/hooks/useLiveValidation.ts` | Plan-Warnungen (23 Regeln)                 | Dashboard, WarningCenter           | `useLiveValidation.test.ts`                        |

### Solar / Batterie / Schutz

| Symbol                           | File                  | Purpose                                           | Tests                             |
| -------------------------------- | --------------------- | ------------------------------------------------- | --------------------------------- |
| `solarDesignCurrentOf`           | `lib/solar.ts`        | Designstrom 1,25 × Isc                            | `lib/solar.test.ts`               |
| `solarFuseFloorOf`               | `lib/solar.ts`        | Sicherungs-Untergrenze 1,5625 × Isc               | dto.                              |
| `solarColdVocOf`                 | `lib/solar.ts`        | Voc(−20 °C) mit TK-Default −0,35 %/K              | dto.                              |
| `stringColdVocOf`                | `lib/solar.ts`        | String-Kalt-Voc für die MPPT-Fensterprüfung       | dto., `useLiveValidation.test.ts` |
| `solarDropBasisVoltageOf`        | `lib/solar.ts`        | Drop-Basis 18 V (MPP)                             | dto.                              |
| `peukertCapacityFactor`          | `lib/peukert.ts`      | Peukert-Kapazitätsfaktor                          | `lib/peukert.test.ts`             |
| `bankShortCircuitCurrentA`       | `lib/shortCircuit.ts` | Ik der Bank (Parallelschätzung)                   | `lib/shortCircuit.test.ts`        |
| `shortCircuitAtFuseA`            | `lib/shortCircuit.ts` | Ik am Sicherungseinbauort                         | dto.                              |
| `breakingCapacityAOf`            | `lib/shortCircuit.ts` | wirksames Abschaltvermögen (Datenblatt > Tabelle) | dto.                              |
| `evaluateAcEdgeProtection`       | `lib/acProtection.ts` | AC-Abschaltbedingung (Zs·Ia ≤ U0)                 | `lib/acProtection.test.ts`        |
| `protectiveEarthCrossSectionMm2` | `lib/acProtection.ts` | PE nach IEC 60364-5-54 Tab. 54.2                  | dto.                              |

---

## Routing

| Symbol                                          | File                                        | Purpose                                         | Called By                                 | Tests                                                     |
| ----------------------------------------------- | ------------------------------------------- | ----------------------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `routeAllCables`                                | `components/edges/utils/routeAll.ts`        | **globaler Routing-Pass**                       | `cableRouteStore`, Skripte, Golden Master | `routeAll.test.ts`, `routeAllCollisionGuarantee.test.ts`  |
| `portFanOutLanes`                               | `components/edges/utils/routeAll.ts`        | Lane-Vergabe je (Bauteil, Seite)                | `routeAllCables`                          | `routeAll.test.ts`                                        |
| `resolveHandlePoint`                            | `components/edges/utils/routeAll.ts`        | Port-Punkt + Flussrichtung                      | dto.                                      | dto.                                                      |
| `findCablePath`                                 | `components/edges/utils/pathfinding.ts`     | Einzelroute: Katalog → A* → Fallback            | `routeAllCables`, `CableEdge`             | `pathfinding.test.ts`, `routingCache.test.ts`             |
| `catalogCandidates` / `bestFreeCatalog`         | dto.                                        | Katalogpfade (Gerade/L/Z/U)                     | `searchOnce`                              | dto.                                                      |
| `portFrame`                                     | dto.                                        | Stubs, Lane-Punkte, Richtungen                  | Katalog + A*                              | dto.                                                      |
| `hananAStar`                                    | dto.                                        | A* auf dem Hanan-Grid mit Knickkosten           | `searchFrame`                             | dto.                                                      |
| `buildHananGridMasks`                           | dto.                                        | Blockade-Markierung per Indexbereich (PERF-001) | `hananAStar`                              | `hananGridMasks.test.ts`                                  |
| `routeDefectScore`                              | dto.                                        | Mängel-Strafe (I4/I6/Selbstüberlappung)         | Auswahl + Nachbearbeitung                 | `pathfinding.test.ts`                                     |
| `nodesToObstacles` / `nodeObstacleMap`          | dto.                                        | Hindernis-Boxen (inkl. Handle-Ausrisse)         | Routing, Skripte                          | `pathfinding.test.ts`, `nodeGeometry.test.ts`             |
| `nudgeOrthogonalPaths`                          | `components/edges/utils/nudge.ts`           | Überlappungen paralleler Trassen lösen          | `routeAllCables`                          | `nudge.test.ts`                                           |
| `mergeCloseBends`                               | `lib/routing/geometry/polyline.ts`          | Treppen/Ministufen auflösen (I7)                | `routeAllCables`                          | `geometry.test.ts`                                        |
| `waypointsToPath` / `waypointsToPathWithHops`   | `components/edges/utils/pathUtils.ts`       | Waypoints → SVG (mit Hop-Bögen)                 | `CableEdge`                               | `pathUtils.test.ts`                                       |
| `CableRouteSync` / `useCableRoute`              | `components/edges/utils/cableRouteStore.ts` | Render-Anbindung, Drossel, Signaturen           | `FlowCanvas`, `CableEdge`                 | `cableRouteStore.test.ts`                                 |
| `nodeLayoutSignature` / `edgeTopologySignature` | dto.                                        | inhaltsbasierte Invalidierung (R-9)             | `CableRouteSync`                          | dto.                                                      |
| `classifyCollision`                             | `lib/routing/rules/collision.ts`            | Kollisionklassifikation (eine Quelle)           | `invariants`, `pathfinding`, Kostenmodell | `collision.test.ts`                                       |
| `assignFanOut`                                  | `lib/routing/rules/portFanOut.ts`           | Lane-Vergabe am Port-Bündel                     | `routeAllCables`                          | `portFanOut.test.ts`                                      |
| `resolveHops` / `routingPriority`               | `lib/routing/rules/hopping.ts`              | wer hüpft, wo sitzt der Bogen                   | `routeAllCables`                          | `hopping.test.ts`                                         |
| `LaneRegistry`                                  | `lib/routing/rules/laneRegistry.ts`         | Korridor-Lanes — **nicht im Produktivpfad**     | nur Tests                                 | `laneRegistry.test.ts`                                    |
| `checkInvariants` / `checkEdgeNodeCollisions` … | `lib/routing/invariants.ts`                 | I1–I7 Checker                                   | Final-Gate, Audit, Live-Report            | `invariants.test.ts`, `invariantsCollisionParity.test.ts` |
| `validateFinalRouting`                          | `lib/routing/finalValidation.ts`            | binäres Final-Gate                              | `cableRouteStore`, CI                     | `scripts/routing/finalValidation.test.ts`                 |
| `ROUTING_TOKENS`                                | `lib/routing/tokens.ts`                     | einzige Abstandsquelle                          | Routing, Layout, Placement                | `tokens.test.ts`                                          |
| `generateElkLayoutOptions`                      | `lib/routing/tokens.ts`                     | ELK-Optionen **generiert** aus Tokens           | ELK-Runner                                | dto.                                                      |
| `layoutWithElk` / `createElkSession`            | `lib/routing/elk/runner.ts`                 | einzige elkjs-Anbindung                         | `layout-engine/elk.ts`, Skripte           | `elk.test.ts`                                             |
| `applyAdvancedLayout`                           | `lib/planner/routingV2Adapter.ts`           | ELK mit Dagre-Fallback (nur Positionen)         | `graphSlice.onLayoutV2`                   | `routingV2Adapter.test.ts`                                |
| `isBackboneConnection`                          | `components/planner/utils/backbone.ts`      | Trasse (Batterie/Busbar/Shunt/Fuse)             | Hopping                                   | `backbone.test.ts`                                        |
| `buildRoutingQualityReport`                     | `components/edges/utils/routingQuality.ts`  | Qualitätsmetriken (kein Gate)                   | Diagnose                                  | `routingQuality.test.ts`                                  |

---

## Store / Infrastruktur

| Symbol                     | File                               | Purpose                          | Tests                      |
| -------------------------- | ---------------------------------- | -------------------------------- | -------------------------- |
| `usePlannerStore`          | `store/usePlannerStore.ts`         | Zustand-Store (Slices + persist) | `usePlannerStore*.test.ts` |
| `isConnectionAllowed`      | `lib/connectionRules.ts`           | Verbindungsregeln (pure)         | `connectionRules.test.ts`  |
| `migratePlannerPersisted`  | `store/slices/persistence.ts`      | defensive Migration              | `persistence.test.ts`      |
| `sanitizeNodeDataBySchema` | `lib/nodeSchema.ts`                | Feld-Schema für `node.data`      | `nodeSchema.test.ts`       |
| `plannerGraphSignature`    | `store/slices/graphInternals.ts`   | Cache-Signatur (Drop-Cache)      | `usePlannerStore*.test.ts` |
| `createDebouncedStorage`   | `store/storage.ts`                 | Schreib-Debounce 200 ms          | `storage.test.ts`          |
| `newEntityId`              | `lib/id.ts`                        | IDs ohne Secure-Context          | `id.test.ts`               |
| `captureGoldenMaster`      | `scripts/goldenmaster/pipeline.ts` | Golden-Master-Erfassung          | `goldenMaster.test.ts`     |
