# ADR 0013 — React Flow 12 (`@xyflow/react`) als Canvas-Paketlinie

**Status:** angenommen · **Datum:** 2026-09-06 · **Bezug:** agent.md S-1, ADR 0002 (erweitert), ADR 0007

## Kontext

Der Planner lief auf `reactflow@11`. Diese Paketlinie ist die alte Auslieferung
von React Flow; weiterentwickelt wird sie als `@xyflow/react` (v12) — mit
React-19-Unterstützung und überarbeitetem Node-Measurement. Zwei Routing-V2-
Arbeitspakete hängen daran: **WP-7 (#395, Kreuzungs-Hopping)** und **WP-8
(#397, lokales Re-Routing)** fassen `CableEdge`, `nodeTypes`/`edgeTypes` und die
Messschicht an. Ohne vorherige Migration wäre dieselbe Arbeit zweimal fällig —
deshalb steht S-1 im Arbeitsplan (`docs/AGENT-PLAN-ROUTING-V2.md`, Abschnitt
„Stack-Track“) vor beiden Paketen.

Der API-Bruch, der uns betrifft, ist nicht die Umbenennung des Pakets, sondern
der **Umzug der gemessenen Geometrie**:

| Angabe            | v11                     | v12                                       |
| ----------------- | ----------------------- | ----------------------------------------- |
| gemessene Größe   | `node.width/height`     | `node.measured.width/height`              |
| absolute Position | `node.positionAbsolute` | `internalNode.internals.positionAbsolute` |
| Handle-Rechtecke  | `node.handleBounds`     | `internalNode.internals.handleBounds`     |
| Store-Nodes       | `state.nodeInternals`   | `state.nodeLookup`                        |

`node.width/height` existieren in v12 weiterhin, meinen dort aber die vom Nutzer
_gesetzten_ Maße — nicht die gemessenen. Ein stilles Weiterlesen hätte die
Hindernis-Rechtecke des Routings auf die Fallback-Maße (192 × 120) zurückfallen
lassen: Kabel wären durch Knoten gelaufen, ohne dass ein Test rot wird, weil die
Fixtures die flachen Felder selbst setzen.

## Entscheidung

1. **Paketwechsel `reactflow@11` → `@xyflow/react@12`.** Kein Parallelbetrieb,
   keine Kompatibilitäts-Shims auf Importebene — der Import-Pfad wird überall
   umgestellt (inkl. `@xyflow/react/dist/style.css`).
2. **Ein Adapter für Node-Geometrie:** `components/edges/utils/nodeGeometry.ts`
   ist die einzige Stelle, die weiß, wo Größe, absolute Position und
   Handle-Rechtecke stehen. Sie liest zuerst die v12-Quelle und fällt auf die
   flache Form zurück. Die Routing-Engine bekommt weiterhin nur Zahlen
   (Architektur-Prinzip 3, ADR 0007 bleibt unberührt).
3. **Die flache Form bleibt gültige Eingabe** — nicht aus Nostalgie, sondern
   weil `knownPlans/`, die Golden Layouts, die Routing-Szenarien und
   gespeicherte Pläne Knoten so beschreiben. Ein Bibliotheks-Update darf den
   Golden Master nicht verschieben.
4. **Typen statt `any`:** v12 typisiert `Node['data']` als
   `Record<string, unknown>` (v11: `any`). Store und UI führen deshalb
   `PlannerFlowNode = Node<CommonNodeData>` (`components/nodes/types.ts`);
   Kanten-Props laufen über den Kanten-Typ (`EdgeProps<CableEdgeType>`) statt
   über die Datenform.

## Konsequenzen

**Gut**

- WP-7 und WP-8 sind entsperrt und laufen gegen die aktuelle API.
- Die Messgrenze ist an einer Stelle beschrieben und getestet
  (`nodeGeometry.test.ts`) statt an neun Aufrufstellen dupliziert.
- Der Typwechsel von `any` auf `Record<string, unknown>` hat mehrere stille
  `any`-Pfade in Inspektoren sichtbar gemacht; sie sind jetzt typisiert.

**Schlecht / Preis**

- Der Adapter kennt zwei Formen. Das ist bewusst — die zweite Form ist die
  Persistenz-/Fixture-Grenze, nicht Alt-Ballast. Fällt die flache Form
  irgendwann weg, müssen `knownPlans/` und die Golden Layouts neu erzeugt
  werden (Begründungspflicht laut Change Ledger).
- v12 verlangt `position` auf jedem Knoten (`adoptUserNodes`), wo v11 es
  stillschweigend duldete. Ein Test-Fixture war betroffen und wurde
  vervollständigt.

## Alternativen

- **Auf v11 bleiben:** kostenlos heute, teuer bei WP-7/WP-8 (zweimal dieselbe
  UI-Arbeit) und dauerhaft ohne Wartung der Paketlinie.
- **Kompatibilitätsschicht statt Adapter** (v12-Nodes beim Eintritt in die
  Routing-Pipeline in die flache v11-Form kopieren): eine Kopie pro Frame im
  heißesten Pfad — verstößt gegen ADR 0012 (16-ms-Budget) ohne Gegenwert.
- **Nur Import-Rename, `node.width` weiterlesen:** grün in CI, falsch im
  Browser (siehe Kontext).

## Verifikation

- `npm run check` grün (Lint, Prettier, Typecheck Prod + Tests, 1695 Tests).
- Golden Master und Routing-Regression byte-identisch — kein stiller
  Routing-Wechsel.
- `npm run perf:edge-routing`: Median 2,38 ms gegen 16-ms-Budget (ADR 0012).
- `npm run build` (Static Export) grün.
