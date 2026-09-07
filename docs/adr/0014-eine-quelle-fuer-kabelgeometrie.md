# ADR 0014: Eine einzige Quelle für Kabelgeometrie

Status: Akzeptiert (2026-09-07, Konsolidierung nach Merge #420)

## Kontext

Nach dem Zusammenführen der beiden Entwicklungslinien (`main` und
`feature/react-flow-cable-editor-…`, PR #420) existierten **zwei
vollständige, gleichzeitig aktive Routing-Engines**:

|                              | Welt A — `lib/planner/routing-v2`                       | Welt B — `lib/routing/rules`                                      |
| ---------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Wer hüpft an einer Kreuzung? | `hopTarget()` = lexikografischer **Edge-ID-Vergleich**  | `routingPriority()` = Domäne + Backbone + Querschnitt + Lock (§8) |
| Overlap                      | `collision: 100_000` — sehr teuer, aber **wählbar**     | `overlap: Infinity` + sofortiger Abbruch — **unmöglich**          |
| Mindestabstand beim Hop      | Parameter `minGap` entgegengenommen, dann `void minGap` | aus `laneGrid` abgeleiteter `hopRadius`                           |
| Weg in die UI                | `graphSlice.routeEdgesV2()` → `edge.data.geometry`      | `CableRouteSync` → `routeAllCables()` → `useCableRoute()`         |

Beide schrieben in denselben Renderer. In `CableEdge.tsx` galt:

```ts
// Routing V2: explizit berechnete Polyline hat Vorrang.
const routedPoints = data?.geometry?.points;
if (routedPoints && routedPoints.length >= 2) {
  /* Welt A */
}
if (globalRoute) {
  /* Welt B — nur noch Fallback */
}
```

**Die schwächere Engine überstimmte damit still die ausgereifte.** Welt B
rechnete bei jeder Layout-Änderung vollständig mit — inklusive
Prioritäts-Hopping, Lane-Registry und Fan-Out — und ihr Ergebnis wurde
verworfen, sobald Welt A Geometrie geliefert hatte.

Besonders tückisch: Die Tests, die das gewünschte Verhalten belegen
(`routeAll.test.ts`: _„meldet den Hop nur für die dünnere Leitung“_, _„die
Backbone-Verbindung bleibt gerade, der Abzweig hüpft“_), waren die ganze
Zeit **grün**. Sie prüften Welt B direkt — an dem Renderer vorbei, der
ihr Ergebnis nicht benutzte. Ein grünes Gate belegte also Verhalten, das
beim Nutzer nie ankam.

## Entscheidung

**Kabelgeometrie hat genau eine Quelle: den globalen Routing-Pass in
`lib/routing/rules`, angetrieben von `components/edges/utils/cableRouteStore`.**

Konkret:

1. `CableEdge` und `WaterPipeEdge` lesen ausschließlich `useCableRoute(id)`.
   Das Feld `data.geometry` wird nicht mehr ausgewertet.
2. `lib/planner/routing-v2/` und `lib/planner/routing-core/` sind entfernt.
3. `routingV2Adapter` liefert **nur noch Knotenpositionen** (ELK, Dagre als
   Fallback) und reicht Kanten unverändert durch.
4. `graphSlice` routet nicht mehr bei Graph-Mutationen; die Geometrie
   entsteht reaktiv über die Layout-Signatur in `CableRouteSync`.
5. `rerouteV2` entfällt ersatzlos — manuelles Neurouten ist überflüssig,
   wenn der Pass reaktiv ist.

### Warum Welt B und nicht Welt A?

Weil die geforderte Fachlogik dort bereits vollständig und getestet
vorliegt. Sie musste nicht geschrieben, nur freigelegt werden:

```text
routingPriority = domainPriority + backboneWeight + crossSectionWeight + manualLockWeight
                      0…300           0 / 1000          0…280              0 / 10000
```

Die Staffelung garantiert die fachliche Aussage „Backbone bleibt gerade,
Abzweig hüpft“: ein 70-mm²-Abzweig (280) kann einen Trunk (1000) nicht zum
Hüpfen zwingen. `routeAll.ts` füttert die Regel mit den echten Merkmalen
der Leitung (`edgeDomain`, `crossSection`, `locked`, `isBackboneConnection`).

Ein ID-Vergleich ist zwar deterministisch (ADR 0010), aber **fachlich
willkürlich** — er ist nur als Tie-Breaker bei exaktem Prioritätsgleichstand
zulässig, und genau dort setzt Welt B ihn auch ein.

### Warum nur eine Quelle, nicht „zwei mit klarer Vorrangregel“?

Eine Vorrangregel hätte den Widerspruch nicht aufgelöst, sondern nur
dokumentiert. Zwei Engines bedeuten zwei Wahrheiten über dieselbe
Kreuzung — und damit die Frage, welche der beiden ein Test eigentlich
belegt. Bei Regeln mit Sicherheitsbezug ist das nicht tragbar
(AGENTS.md K6: keine unbelegten Qualitätsbehauptungen).

## Konsequenzen

**Positiv**

- Prioritäts-Hopping nach §8 wirkt erstmals produktiv beim Nutzer.
- Overlaps sind auf dem aktiven Pfad hart verboten (`Infinity`), nicht
  nur teuer — die Voraussetzung für die harte Final-Invariante.
- Ein Rechendurchlauf pro Layout-Änderung statt zwei.
- Bestehende Tests sagen wieder etwas über das aus, was gerendert wird.

**Negativ / offen**

- Das ELK-Layout in `applyAdvancedLayout` ist weiterhin an keinen
  UI-Knopf verdrahtet (`onLayoutV2` wird von keiner Komponente gerufen).
  Das ist Bestandslage, kein Ergebnis dieser Änderung.
- `lib/planner/vde/` dupliziert `lib/vde-standards.ts` und hat keine
  externen Nutzer — dieselbe Doppel-Wahrheits-Klasse, hier bewusst nicht
  angefasst (eigenes Vorhaben, s. unten).
- Die harte Final-Invariante (`edge×node = 0`, `edge×edge = 0`,
  `clearance = 0` ⇒ `routingStatus = INVALID`) ist **noch nicht** als
  verpflichtender Abschluss-Schritt verdrahtet. `lib/routing/invariants.ts`
  existiert; sie zum Gate zu machen ist der nächste Schritt.
- Das Domain-Modell trägt weiterhin nur `crossSection` + `length`. Eine
  belastbare normative Auslegung braucht Leitungstyp, Verlegeart,
  Bündelung, Umgebungstemperatur und Schutzorgan — separates Vorhaben.

## Verweise

- ADR 0009 — Crossings erlaubt, Overlaps verboten
- ADR 0010 — Routing ist deterministisch
- ADR 0011 — ELK-Layered als globaler Layout-Pass
- `docs/ROUTING-V2.md` §8 (Prioritätsformel), §9 (Kostenmatrix)
