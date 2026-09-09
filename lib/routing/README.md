# `lib/routing/` — Routing-Regeln, Geometrie, Invarianten

## What is this?

Die **regelbasierte** Seite des Kabel-Routings: Tokens, pure Geometrie, Kollisionsmodell,
Lane-Mechanik, Kostenmodell und die Invariantenprüfung. Dieses Verzeichnis erzeugt **keine**
fertigen Kabelwege — das macht der globale Pass in
`components/edges/utils/routeAll.ts`, der diese Module konsumiert.

Schichten (wie in `docs/ROUTING-V2.md` spezifiziert):

```
tokens.ts        Schicht 0 – einzige Quelle aller Abstände
geometry/        Schicht 1 – pure Primitives (Punkt, Rect, Segment, Polyline)
rules/           Schicht 2 – Collision, Fan-Out, CostModel, Hopping (+ LaneRegistry)
invariants.ts    Schicht 4 – I1–I7 Checker
finalValidation.ts  Schicht 4 – binäres Gate (VALID / INVALID)
elk/             Layout – einzige elkjs-Anbindung
```

## What is the public API?

| Symbol                                                                                                                                                       | Datei                   | Zweck                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------- |
| `ROUTING_TOKENS`, `LEGACY_ROUTING_TOKENS`                                                                                                                    | `tokens.ts`             | alle Routing-Abstände                                                       |
| `generateElkLayoutOptions()`, `generateElkInteractiveOptions()`                                                                                              | `tokens.ts`             | ELK-Optionen **generiert** aus Tokens                                       |
| `alternativeRouteGap()`, `ALTERNATIVE_LANE_STEP`                                                                                                             | `tokens.ts`             | Ausweich-Parallelen (±48/±96 px)                                            |
| `classifyCollision`, `classifySegmentAgainstNode`, `classifySegmentAgainstSegment`                                                                           | `rules/collision.ts`    | **die** Kollisionsquelle                                                    |
| `assignFanOut`, `portNormal`, `portCross`, `fanOutPortIndices`                                                                                               | `rules/portFanOut.ts`   | Lane-Vergabe am Port-Bündel                                                 |
| `COST_WEIGHTS`, `segmentExtraCost`, `preferredLaneBonus`                                                                                                     | `rules/costModel.ts`    | Kostenmatrix (nur `crossing` heute wirksam)                                 |
| `resolveHops`, `routingPriority`, `hopRadius`                                                                                                                | `rules/hopping.ts`      | wer hüpft, wo sitzt der Bogen                                               |
| `LaneRegistry`, `corridorFor`, `assignByEdge`                                                                                                                | `rules/laneRegistry.ts` | Korridor-Lanes — **nicht im Produktivpfad**                                 |
| `checkInvariants` + `checkEdgeNodeCollisions`/`checkEdgeEdgeOverlaps`/`checkClearance`/`checkUTurnAtHandle`/`checkStubs`/`checkSegmentLengths`/`checkStairs` | `invariants.ts`         | I1–I7                                                                       |
| `countCrossings`, `serializeRoutes`, `requiredStubLength`                                                                                                    | `invariants.ts`         | I10 / I9 / Hilfsgrößen                                                      |
| `validateFinalRouting`, `totalViolations`, `formatFinalValidation`                                                                                           | `finalValidation.ts`    | Final-Gate                                                                  |
| `layoutWithElk`, `createElkSession`, `ElkTimeoutError`                                                                                                       | `elk/runner.ts`         | ELK-Ausführung                                                              |
| `buildHananGridMasks`-Äquivalente Geometrie                                                                                                                  | `geometry/*`            | `segmentsCross`, `segmentsOverlap`, `mergeCloseBends`, `inflateObstacle`, … |

## What does it own?

- **Die eine Definitionsstelle für Abstände** (`tokens.ts`).
- **Die eine Kollisionsbegriffswelt** (`rules/collision.ts`).
- **Die Invarianten I1–I7** und das binäre Final-Gate.
- **Die einzige elkjs-Anbindung** (`elk/runner.ts`, gebündelt).

## What must not happen here?

1. Kein Import aus `components/`, `store/`, `app/`, `benchmarks/` (Rule A,
   Test: `scripts/architecture/libBoundary.test.ts`).
2. Keine Abstands-Zahl außerhalb `tokens.ts` (Rule E, Test:
   `scripts/routing/architecture.test.ts`).
3. Kollision niemals als **endliche** Kostengröße führen — `overlap: Infinity` ist Pflicht
   (Rule I).
4. Keine eigene Abstands-/Kollisionsdefinition in `invariants.ts` — sie leitet aus
   `rules/collision.ts` ab (ADR 0019).
5. Kein React, kein DOM, keine Browser-APIs; alles muss unter Node (Skripte, Golden Master)
   laufen.
6. Kein zweiter elkjs-Import, nur `elkjs/lib/elk.bundled.js` (Rule J).

## Which tests protect it?

| Datei                                                                  | Schutz                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `lib/routing/tokens.test.ts`                                           | Spec-Werte eingefroren, ELK-Config-Sync, Konsumenten-Drift-Guards |
| `lib/routing/geometry/geometry.test.ts`, `segmentSpatialIndex.test.ts` | Segment-/Rechteck-/Polyline-Primitives                            |
| `lib/routing/rules/collision.test.ts`                                  | Klassen hard/soft/weighted/none, Domänenregeln                    |
| `lib/routing/rules/portFanOut.test.ts`                                 | deterministische Lane-Vergabe                                     |
| `lib/routing/rules/costModel.test.ts`                                  | Kostenmatrix, Konsistenz zum Kollisionsmodell                     |
| `lib/routing/rules/hopping.test.ts`                                    | Prioritätsformel, Gleichstand, Lock-Verhalten                     |
| `lib/routing/rules/laneRegistry.test.ts`                               | Lane-Stabilität (Modul ist nicht angebunden)                      |
| `lib/routing/invariants.test.ts`, `invariantsCollisionParity.test.ts`  | I1–I7 + Parität zum Kollisionsmodell                              |
| `scripts/routing/finalValidation.test.ts`                              | Ratchet über die sechs Referenzpläne                              |
| `scripts/routing/architecture.test.ts`                                 | eine Quelle je Zuständigkeit                                      |
| `lib/routing/elk/elk.test.ts`, `ab-compare.test.ts`                    | ELK-Vertrag, A/B-Vergleich                                        |

Weitere Details: [`docs/ai/ROUTING-CONTEXT.md`](../../docs/ai/ROUTING-CONTEXT.md).
