# `lib/autoWire*` — automatisches Verdrahten

## What is this?

AutoWire baut aus einer Bauteilliste eine verdrahtete, dimensionierte und abgesicherte
Topologie. Reine Domänenlogik: kein React, kein React-Flow-Runtime, keine Seiteneffekte.

```
lib/autoWire.ts            Fassade + Orchestrierung (performAutoWiring)
lib/autoWire/primitives.ts Konstanten, geprüftes Lesen aus edge.data, Drop-Formeln, Chemie-Regeln
lib/autoWire/validation.ts Topologie-Klassifikation (Starter, Busbar, Solar, AC)
lib/autoWire/routing.ts    Rails, Knoten-/Kantenerzeugung, Nutzerkanten-Heilung
lib/autoWire/sizing.ts     Querschnitt, Sicherungen, AC-Sizing, Bauformen
lib/autoWire/placement.ts  Platzierung selbst erzeugter Knoten (16-px-Raster)
```

## What is the public API?

| Symbol                                                                              | Datei           | Zweck                                       |
| ----------------------------------------------------------------------------------- | --------------- | ------------------------------------------- |
| `performAutoWiring(nodes, existingEdges?)`                                          | `autoWire.ts`   | **Einstieg.** `{nodes, edges} \| null`      |
| `AUTO_EDGE_PREFIX`                                                                  | `primitives.ts` | `'e-auto-'` — Kennzeichen aller Auto-Kanten |
| `sizeDcEdges`, `applyFuseSizes`, `applyFuseTypes`, `sizeAcEdges`                    | `sizing.ts`     | Sizing-Stufen                               |
| `cumulativeDropAt`, `relevantCumulativeDrop`                                        | `sizing.ts`     | Spannungsfall am Knoten                     |
| `acCurrentA`                                                                        | `sizing.ts`     | AC-Strom einer Kante (Insel-BFS)            |
| `resolveRails`, `healUserEdges`, `pickHouseBattery`                                 | `routing.ts`    | Topologie-Bausteine                         |
| `applyFlowLayout`                                                                   | `placement.ts`  | Platzierung **nur** selbst erzeugter Knoten |
| `edgeLength`, `edgeCrossSection`, `crossSectionForDrop`, `nextStandardCrossSection` | `primitives.ts` | geprüftes Lesen / Normreihe                 |
| `chemistriesParallelSafe`                                                           | `primitives.ts` | Parallelschaltbarkeit zweier Akkus          |
| `isAcEdge`, `isSolarEdge`, `isStarterBattery`                                       | `validation.ts` | Klassifikation                              |

## What does it own?

- Die **Zieltopologie**: Batterie+ → Schiene → Sicherungskasten → Verbraucher;
  Batterie− → Shunt → Minus-Schiene; Solar nur über Laderegler; Masse ≥ 16 mm².
- Das **Sizing** jeder Kante (Querschnitt, Sicherung, Bauform, AC-Schutzorgan).
- Die **Heilung** unsicherer Nutzerkanten (`healUserEdges`).
- Die **Platzierung** selbst erzeugter Knoten.

## What must not happen here?

1. **Kein Routing.** Kabelgeometrie gehört ausschließlich in
   `components/edges/utils/routeAll.ts`.
2. **Kein Verschieben von Nutzerknoten.** `applyFlowLayout` arbeitet nur auf
   `autoCreatedNodeIds`.
3. **Kein automatisches Setzen von `hasRcd`.** Ein gesetzter FI würde einen fehlenden FI
   verschleiern.
4. **Kein Verkleinern von Nutzerquerschnitten** — „nie verkleinern“ ist hart, auch oberhalb
   von 70 mm².
5. **Keine Serienverschaltung** (24 V) — nicht modelliert; verpolte Akku-Paare werden
   **entfernt**, nicht umgedeutet.
6. **Kein stilles Raten.** Fehlen Daten (z. B. Bank-Ik nicht schätzbar), wird **nichts**
   gestempelt.
7. Keine UI-Abhängigkeit: `lib/` importiert keine App-Schicht (Rule A).

## Which tests protect it?

| Datei                                       | Schutz                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `lib/autoWire.test.ts` (1424)               | Topologie, Heilung, Solar, AC, Idempotenz, Crash-Regressionen                                            |
| `lib/autoWire/sizing.test.ts`               | Querschnitt, Sicherung, Drop-Budgets, Solar-Faktoren                                                     |
| `lib/autoWire/placement.test.ts`            | Raster, Flussrichtung, Überlappungsfreiheit                                                              |
| `lib/vde-properties.test.ts`                | **G5** Idempotenz · **G6** AC/DC-Trennung + „jede Kante dimensioniert“ · **G7** `sizeDcEdges`-Konvergenz |
| `scripts/goldenmaster/goldenMaster.test.ts` | Ergebnis aller sechs Referenzpläne eingefroren                                                           |
| `scripts/routing/finalValidation.test.ts`   | Routing-Invarianten auf dem auto-verdrahteten Plan                                                       |
| `store/usePlannerStore*.test.ts`            | Store-Integration, Nutzerkanten-Erhalt, Historie                                                         |

## Fehlerverhalten

`performAutoWiring` gibt `null` zurück, wenn kein Akku im Plan ist. Alles andere wird
**markiert**, nicht verschwiegen: `dropWarning`, `fuseWarning`, fehlende Bauform.
Es wirft im Normalbetrieb nicht (Länge 0 und AC-Querschnitt > 70 mm² sind abgesichert).

Weitere Details: [`docs/ai/AUTOWIRE-CONTEXT.md`](../../docs/ai/AUTOWIRE-CONTEXT.md).
