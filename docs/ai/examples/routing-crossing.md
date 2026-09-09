# Beispiel: Routing mit Kreuzung

Kreuzungen sind **erlaubt**, Overlaps **verboten** (ADR 0009). Dieses Beispiel zeigt, was ein
Agent erwarten darf — und was nicht.

## Input

Szenario `p11-zwangskreuzung` (`scripts/regression/scenarios.ts`):

```
src-top    (battery,  40/40)  ─────────────▶ dst-bottom (consumer, 720/500)
src-bottom (battery, 40/500)  ─────────────▶ dst-top    (consumer, 720/40)
```

Zwei Kanten, vier Knoten, keine Hindernisse zwischen den Trassen.

## Erwartete Topologie / Geometrie

Beide Kanten queren einander — eine Kreuzung ist **topologisch unvermeidbar**.
Erwartet wird ein **Z- oder L-Verlauf**, der im rechten Winkel kreuzt, ohne kollineare
Überdeckung.

## Erwartetes elektrisches Ergebnis

Kein Bezug — das Routing verändert keine elektrischen Werte (Rule C). Die `edgeDomain` bleibt
`DC_12V`, Querschnitt und Sicherung bleiben unangetastet.

## Erwartetes Routing-Verhalten

| Prüfung                            | Erwartung                                                         |
| ---------------------------------- | ----------------------------------------------------------------- |
| **I1** (Segment × fremdes Bauteil) | 0                                                                 |
| **I2** (kollineare Überdeckung)    | **0** — die beiden Trassen liegen nicht aufeinander               |
| **I3** (Clearance ≥ 12 px)         | 0                                                                 |
| **I4** (U-Turn am Handle)          | 0                                                                 |
| **I5/I6** (Stub/Segment-Minima)    | 0                                                                 |
| **I7** (Treppenmuster)             | 0                                                                 |
| Kreuzungen                         | **1** (genau eine, nicht mehr — Invariante I10)                   |
| `usedSearch`                       | `catalog` (Z-Form ist kollisionsfrei und damit manhattan-optimal) |
| Determinismus                      | byte-identisch bei Doppellauf                                     |

**Hopping:** Eine der beiden Kanten zeichnet am Schnittpunkt einen Bogen. Wer hüpft, entscheidet
`resolveHops` — bei Gleichstand die **lexikografisch größere Edge-ID** (`hoppingEdgeId`).
Beide Kanten sind hier ranglos (`domain` unbekannt, kein Backbone, kein Querschnitt) → der
Tie-Breaker greift: `e-up` hüpft (da `e-down` < `e-up`).

Der Hop ist **reine Darstellung**: Waypoints, Länge, Bends und Crossings ändern sich nicht.

## Erwartete Validierung

- `validateFinalRouting` → **`VALID`** (0 Verletzungen).
- Keine Fehler-Chips auf den Leitungen.
- `components/planner/ui/RoutingStatusBadge.tsx` zeigt „gültig“.

## Was hier NICHT erwartet wird

- Kein Versuch, die Kreuzung um jeden Preis zu vermeiden (Kosten 120 px-Äquivalent, kein
  Verbot). Ein Umweg von > 120 px wäre teurer als die Kreuzung.
- Keine Änderung der Reihenfolge: die Arbeitsreihenfolge ist die Store-Reihenfolge, nicht
  sortiert nach Länge (ein entsprechender Versuch verschlechterte die Referenzpläne messbar).

## Relevante Tests

- `scripts/regression/regression.test.ts` → `p11-zwangskreuzung`
  (Golden Layout + Metrik-Budget Δ ≤ 0 + SVG-Byte-Vergleich)
- `scripts/regression/regression.test.ts` → `p12-backbone-kreuzung`
  (Backbone bleibt gerade, Abzweig hüpft)
- `lib/routing/rules/hopping.test.ts` (Prioritätsformel, Gleichstand, Lock)
- `lib/routing/rules/collision.test.ts` (`segmentsCross` → `soft`)
- `lib/routing/invariants.test.ts` (I2 vs. Port-Bündel-Ausnahme)
- `docs/routing-gallery/14-crossing-avoidance.svg`, `15-crossing-dense-grid.svg` (Legacy-Router!)
