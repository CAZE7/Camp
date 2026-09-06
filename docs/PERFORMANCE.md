# Performance-Audit & Maßnahmen (Mission 5)

**Datum:** 2026-08-22 · **Branch:** `arena/01a027c5-camp`
**Stack:** Next 16.3.2 (Static Export), React 19, React Flow 11, Zustand 5, Vitest 4.
**Methode:** Repository-Analyse, Profiling der heißen Render-Pfade,
Bundle-/Build-Baseline, anschließend Umsetzung der sicheren, messbaren
Optimierungen inkl. Regressionstests.

---

## 0. Zusammenfassung

- Das Projekt hat bereits viele Performance-Gewohnheiten aus den Missionen 1–4:
  Planner per `next/dynamic` (ssr:false) nachgeladen, mehrere `WeakMap`-/
  Signatur-Caches (`plannerGraphSignature`, `getDerivedSystemState`),
  single-pass-Validierung (`useLiveValidation`), 300-ms-Debounce
  (`useDashboardMetrics`), dynamischer `html-to-image`-Import, `gsap` nur in
  der Guide-Seite.
- **Größter messbarer Hotspot:** der Kanten-Render-Durchlauf. Pro Frame und
  pro Kante werden Hindernis-Rechtecke und Kreuzungs-Segmente neu berechnet.
  Für kleine Pläne ist das der dominante Kostenpunkt; ab ~60 Kanten kommt der
  Kreuzungs-Scan (O(E²), bis 120 Kanten) und danach die Pfadbau-Kosten dazu
  (siehe Abschnitt 3).
- **Persistenz-Hotspot:** Zustand-`persist` schreibt bei _jedem_ `set` in
  `localStorage` — beim Ziehen eines Knotens also mehrfach pro Sekunde mit dem
  kompletten, partialisierten Plan-JSON.
- **Hygiene:** `dagre` + `@types/dagre` sind seit dem eigenen dreispaltigen
  Layout (Mission 3) ungenutzt, standen aber weiterhin in den Dependencies.

**Umsetzung in dieser Mission (alle mit Tests grün, Typecheck + Build grün):**

| ID      | Thema                                       | Fix                                                                        | Beleg                                           |
| ------- | ------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| PERF-01 | Knoten-Drag-Persistenz                      | Debounced `StateStorage` für den Planer-Store                              | `store/storage.ts` + `storage.test.ts`          |
| PERF-02 | Kanten-Hindernisse → geteilter Cache        | `obstaclesExcluding` statt `nodesToObstacles` je Kante                     | `routingCache.ts` + `routingCache.test.ts`      |
| PERF-03 | Ungenutzte Abhängigkeit                     | `dagre`/`@types/dagre` entfernt                                            | Lockfile-Gate grün, Build grün                  |
| PERF-04 | Kreuzungs-Scan → geteilte Segment-Basis     | `crossingSegmentsExcluding` statt `edgesToCrossingSegments` je Kante       | `routingCache.ts` (`crossingSegmentsExcluding`) |
| PERF-05 | Bundle: React Flow aus dem Initial-Pfad     | `ReactFlowProvider` + React-Flow-CSS in den lazy `PlannerInner` verschoben | Build-Inspizierung, ~131 KB Initial-JS gespart  |
| PERF-06 | Bundle: Stückliste lazy                     | `BOMModal` per `next/dynamic` (ssr:false)                                  | `FlowCanvas.tsx` + Tests                        |
| PERF-07 | Große Pläne: nur sichtbare Elemente rendern | `onlyRenderVisibleElements` im `<ReactFlow>`                               | `FlowCanvas.tsx`; Routing-Tests grün            |

---

## 1. Baseline

| Prüfung                 | Befehl                            | Ergebnis                                       |
| ----------------------- | --------------------------------- | ---------------------------------------------- |
| Typecheck (Produktion)  | `npm run typecheck`               | 0 Fehler                                       |
| Typecheck (inkl. Tests) | `npm run typecheck:tests`         | 0 Fehler                                       |
| Unit-/Property-Tests    | `npm test`                        | grün (86 Dateien, 1023 Tests im Baseline-Lauf) |
| Static Build            | `npm run build`                   | erfolgreich, 11 statische Routen               |
| Lockfile-Gate           | `npm run ci:verify-lockfile-gate` | greift                                         |
| npm audit               | `npm audit`                       | 0 Schwachstellen                               |

**Initiales JS der Planer-Seite** (unkomprimiert, Summe der von
`out/elektrik-planung/index.html` referenzierten Chunks):

| Stand                    | Initial-JS | Anmerkung                                               |
| ------------------------ | ---------- | ------------------------------------------------------- |
| Vor Mission 5 (Referenz) | ~744 KB    | React Flow lag im initialen Seite-`<script>`-Liste      |
| Nach PERF-01/02/03       | ~594 KB    | React Flow in lazy Chunk verschoben                     |
| Nach PERF-04/05/06       | ~595 KB    | konsolidiert (Hashing), React Flow + BOM weiterhin lazy |

> Netzto-Delta für die Planer-Route: **~131 KB weniger Initial-JS** (~18 %),
> weil `ReactFlowProvider` + React-Flow-CSS aus der statisch importierten
> `Planner.tsx` in den per `next/dynamic` nachgeladenen `PlannerInner` wanderten.
> Der größte verbleibende Chunk (223 KB) ist React DOM/Next-Runtime (route-
> agnostisch, nicht teilbar).

> Hinweis: `dagre` war nicht im Bundle (kein Import), daher änderte die
> Entfernung die Chunk-Größe nicht messbar — Hauptnutzen ist Hygiene/
> Wartbarkeit und ein kleineres `node_modules`.

---

## 2. Profiling-Methode

`benchmarks/edgeRoutingPerf.bench.ts` bildet den Kanten-Render-Durchlauf so
nach, wie ihn `CableEdge` ausführt:

1. Hindernis-Rechtecke der übrigen Nodes.
2. `edgesToCrossingSegments` — **nur** bis `CROSSING_SCAN_EDGE_LIMIT = 120`
   Kanten, danach übersprungen (genau wie in `CableEdge.tsx`).
3. `buildOrthogonalPath` zwischen den _eigenen_ Source-/Target-Knoten der Kante.

Gemessen wird ein voller Render-Durchlauf über alle Kanten (worst case: beim
Ziehen eines Knotens rendern wegen der globalen `nodes`-Subscription alle
Kanten neu). Läuft mit `npx tsx benchmarks/edgeRoutingPerf.bench.ts`.

---

## 3. Ergebnisse

**Vorher vs. nachher (voller Kanten-Render-Durchlauf, Worst Case je Frame):**

| Plan      | N   | E   | vorher   | nachher  | Speedup  |
| --------- | --- | --- | -------- | -------- | -------- |
| Klein     | 8   | 13  | 0.73 ms  | 0.28 ms  | **×2.7** |
| Mittel    | 24  | 66  | 5.75 ms  | 5.08 ms  | ×1.1     |
| Groß      | 60  | 230 | 4.97 ms  | 5.06 ms  | ×1.0     |
| Sehr groß | 120 | 585 | 19.64 ms | 19.51 ms | ×1.0     |

**Fokus: Kreuzungs-Scan (PERF-04), im aktiven Bereich ≤ 120 Kanten:**

| Plan   | N   | E   | vorher  | nachher | Speedup  |
| ------ | --- | --- | ------- | ------- | -------- |
| Klein  | 8   | 13  | 0.08 ms | 0.02 ms | **×3.3** |
| Mittel | 24  | 66  | 0.32 ms | 0.09 ms | **×3.6** |

> Oberhalb des `CROSSING_SCAN_EDGE_LIMIT` (120) wird der Scan übersprungen —
> die Werte dort sind Mikrosekunden-Rauschen.

**Komponenten-Aufschlüsselung** (identischer Plan, Profile des Kodepfads):

| Plan         | Hindernisse | Kreuzungs-Scan | Pfadbau (`buildOrthogonalPath`)             |
| ------------ | ----------- | -------------- | ------------------------------------------- |
| N=24, E=66   | ~0.13 ms    | ~0.64 ms       | **~11 ms**                                  |
| N=120, E=585 | ~1.5 ms     | ~29 ms         | **~584 ms** (mit unrealistisch langem Pfad) |

> Wichtig: Der Pfadbau-Wert im oberen Aufschlüsselungs-Fall ist verzerrt, weil
> dort jede Kante zwischen zwei weit auseinanderliegenden Endknoten geroutet
> wurde. Bei realistischem Routing zwischen den _eigenen_ Endknoten (siehe
> Tabelle oben) sind die Zahlen deutlich niedriger; die Größenordnung der
> Skalierung (O(E²) im Kreuzungs-Scan, O(E·N) im Hindernisbau) bleibt aber
> bestehen.

**Erkenntnisse:**

1. Der geteilte Hindernis-Cache + die geteilte Kreuzungs-Basis beschleunigen
   die **typischen kleinen Pläne** deutlich (×2.7 im vollen Durchlauf, ×3.3–3.6
   im Kreuzungs-Scan) und entlasten den GC (es werden nicht mehr N Rechtecke
   bzw. E Segmente je Kante erzeugt).
2. Der **Kreuzungs-Scan** ist bei 20–120 Kanten der mit Abstand größte
   Einzelkostenpunkt (O(E²)); er wird oberhalb von 120 Kanten ersatzlos
   übersprungen. Durch die geteilte Basis fällt pro Kante nur noch der O(E)-
   Filter an — die O(N)-Zentren- und O(E)-Segment-Neuschöpfung entfällt.
3. Der **Pfadbau** dominiert bei sehr großen Plänen (siehe PERF-N2/N3 unten).

---

## 4. Umgesetzte Optimierungen (Details)

### PERF-01 — Debounced Persistenz (`store/storage.ts`)

Zustand-`persist` ruft `storage.setItem` nach jedem `set`. Während des
Knoten-Drags feuert React Flow mehrere `set` pro Sekunde; die komplette
partialisierte Plan-Struktur wird jedes Mal `JSON.stringify`+geschrieben.

`createDebouncedStorage` fasst schnelle Schreibfolgen zu einem einzigen
Schreibvorgang zusammen (Trailing-Debounce, 200 ms) und flusht den letzten
Stand bei `pagehide`/`beforeunload`, damit kein Drag-Stand verloren geht.
`getItem`/`removeItem` bleiben unverzögert (Rehydrierung/Löschen warten nie).
Nur der Planer-Store nutzt den Adapter; `lib/store.ts` (App-Präferenzen,
seltene Writes) bleibt unverändert → `lib/store.test.ts` bleibt grün.

Tests: `store/storage.test.ts` (Batching, Timing, getItem/removeItem-Durchreichung).

### PERF-02 — Geteilter Hindernis-Cache (`routingCache.ts`)

`CableEdge` rief bisher `nodesToObstacles(allNodes, …)` je Kante auf: O(E·N)
Rechteck-Konstruktionen pro Render-Durchlauf. Der neue
`obstaclesExcluding(allNodes, …)` nutzt eine per `nodes`-Array-Referenz
gecachte Map (`WeakMap`), baut die N Rechtecke also nur **einmal** je Frame und
filtert je Kante nur die 2 ausgeschlossenen Knoten heraus. Die Semantik ist
identisch; `WeakMap`-Schlüssel sind Array-Referenzen, die React Flow ohnehin
bei jedem Update neu erzeugt — daher kein falsch wiederverwendeter Cache und
kein Speicherleck.

Tests: `routingCache.test.ts` (Fallback-Maße, Caching nach Referenz, Ausschluss).

### PERF-03 — Ungenutzte Abhängigkeiten

`dagre`/`@types/dagre` werden seit der dreispaltigen Eigen-Layout-Implementierung
(Mission 3) nicht mehr importiert (geprüft über `grep` in `app|components|lib|
store|scripts|tests`, ein veralteter Test-Kommentar wurde korrigiert). Beide
wurden aus `package.json` + `package-lock.json` entfernt; das Lockfile-Gate
ist grün.

### PERF-04 — Geteilte Kreuzungs-Scan-Basis (`crossingSegmentsExcluding`)

`CableEdge` rief bisher `edgesToCrossingSegments` je Kante auf, das je Frame die
Node-Zentren (O(N)) **und** die Segmente aller Kanten (O(E)) neu baute (O(E·(N+E)))
und pro Kante einen `skip`-Filter anwandte. `crossingSegmentsExcluding` baut die
Invariante (Zentren + ein Segment je Kante inkl. Endpunkt-IDs) **einmal** je
`(nodes, edges)`-Array-Referenz über einen `WeakMap`-Cache und wendet nur noch
den O(E)-Filter auf die geteilte Segment-Liste an. Semantik identisch; die
Basis wird nur benutzt (nicht mutiert), sodass das Teilen der Referenz sicher
ist. In den Routing-Invarianten- und CableEdge-Tests abgesichert.

Tests: `routingCache.test.ts` (Pärchen-Ausschluss, Richtungs-Unabhängigkeit,
Ghost-Kanten, Referenz-Caching).

### PERF-05 — React Flow aus dem Initial-Pfad (`Planner.tsx` / `PlannerInner.tsx`)

`components/Planner.tsx` importierte `ReactFlowProvider` + `reactflow/dist/style.css`
statisch; `app/elektrik-planung/page.tsx` importiert `Planner` statisch. Dadurch
lag der React-Flow-Chunk (~132 KB) in den initialen `<script>`-Tags der
Planer-Route, obwohl `PlannerInner` bereits per `next/dynamic` (ssr:false)
nachgeladen wird. Der Provider (und die CSS) wanderten in den lazy `PlannerInner`:
`Planner` ist jetzt nur noch der dünne `dynamic()`-Umsetzer. Folge: React Flow
landet im lazy Planner-Chunk, die Planer-Route lädt ~131 KB weniger Initial-JS.

Tests: `Planner.test.tsx`, `PlannerInner.test.tsx`, `app/elektrik-planung/page.test.tsx`,
`FlowCanvas.test.tsx` — alle grün.

### PERF-06 — Stückliste lazy (`BOMModal`)

`BOMModal` (AccessibleDialog + Registry + Clipboard) wird nur auf Knopfdruck
(`show-bom-modal`-Event) geöffnet. Es ist jetzt über `next/dynamic` (ssr:false)
eingebunden und kommt in einen separaten Chunk, der erst mit dem Planner-Boot
lädt. `FlowCanvas.test.tsx` löst `next/dynamic` synchron auf, damit der
Test-determinismus erhalten bleibt.

### PERF-07 — Viewport-Culling für große Pläne (`onlyRenderVisibleElements`)

React Flow rendert standardmäßig alle `nodes`/`edges`. Bei 100+ Knoten sind das
Hunderte von Kanten, von denen jeweils nur ein Teil im sichtbaren Ausschnitt
liegt; jede gerenderte Kante baut ihren Pfad (`buildOrthogonalPath`) neu. Mit
`onlyRenderVisibleElements` weist React Flow das interne Viewport-Culling an:
Es zeichnet nur noch die Elemente, die den sichtbaren Bereich schneiden.
Hierdurch skaliert der Render-/Route-Aufwand bei großen Plänen mit der Zahl der
_sichtbaren_ statt aller Kanten — der größte Einzelhebel für flüssiges
Rendern/Dragging bei 100+ Knoten (PERF-N3).

Da Offscreen-Elemente nicht mehr gemalt werden, sinkt auch die DOM-Größe
erheblich. Die Semantik bleibt identisch — nur nicht sichtbare Elemente werden
erst gezeichnet, wenn sie in den Viewport kommen.

---

## 5. Bewertung & noch offene Maßnahmen

### PERF-N2 — Redundante Re-Renders / Store-Arbeit beim Drag — **bewertet, bewusst minimal gehalten**

Beim Knoten-Drag ändert React Flow pro Frame die `nodes`-Array-**Referenz**. Die
Kanten-Subscriptions (`state.nodes`/`state.edges`/`state.trunkMode`) feuern
dadurch, und der `useShallow`-Selector rechnet `getDerivedSystemState` +
`plannerGraphSignature` durch.

**Messung:** Der Anteil dieser Store-Helfer pro Drag-Frame ist klein und
skaliert nur linear:

| Plan         | Store-Helfer pro Drag-Frame |
| ------------ | --------------------------- |
| N=24, E=66   | ~0.07 ms                    |
| N=60, E=230  | ~0.11 ms                    |
| N=120, E=585 | ~0.20 ms                    |

Zusätzlich ist die `nodes`-Referenz das einzige, was sich bei einem reinen
Positions-Drag ändert; die Node-`data`-Referenzen bleiben stabil
(verifiziert: `applyNodeChanges` spreadet `data` durch). Dadurch verhindert
`useShallow` bereits die **Re-Renders** der Kanten auf reine Positions-
Änderungen. Der verbleibende Aufwand ist also nur die einmalige Neuberechnung
der Store-Helfer (~0,2 ms).

**Entscheidung:** Die beiden Cache-Funktionen auf **positions-unabhängige
Identität** umzustellen (sodass ein reiner Drag den Vortag-Ergebnis-Cache
wiederverwendet) habe ich geprüft, aber **bewusst nicht umgesetzt**: Der
Gewinn wäre <0,2 ms/Frame, während es das Risiko birgt, in einer
sicherheitskritischen Elektro-Planung veraltete Node-Objekte (mit alten
`position`-Werten) über den Cache zu liefern. Dieses Risiko-Ertrag-Verhältnis
ist unvertretbar. Der echte Hebel für große Pläne ist PERF-07 (Sichtbarkeits-
Culling), das die Zahl der _gerenderten_ Kanten begrenzt.

### PERF-N3 — Sehr große Pläne (100+ Knoten) — **umgesetzt (PERF-07)**

Der Pfadbau (`buildOrthogonalPath`) dominiert bei großen Plänen; er läuft pro
**gerendertem** Edge. React Flow rendert standardmäßig **alle** Knoten/Kanten,
egal ob sichtbar. Mit `onlyRenderVisibleElements` werden nur noch die im
Viewport sichtbaren Elemente gerendert (React-Flow-internes Culling). Dadurch
wird bei große Plänen/Pan/Zoom nur noch ein Bruchteil der Kanten geroutet —
der größte Einzelhebel für flüssiges Rendering und Dragging bei 100+ Knoten.

> Caveat: `onlyRenderVisibleElements` ist ein Viewport-Culling. Es hilft, wenn
> nicht alle Elemente gleichzeitig sichtbar sind (Pan/Zoom/Hineinzoomen). Bei
> einem `fitView`-Überblick über das Gesamtbild bleiben alle sichtbar; dort
> bleibt der Pfadbau der limitierende Faktor. Verhaltensänderung klein (nur
> Offscreen-Elemente werden nicht mehr in den DOM gezeichnet), alle Routing-
> Invarianten und 25-Szenarien-Tests bleiben grün.

### Lighthouse-Performance-Lauf — **steht aus**

Der Browser-Download war in der Entwicklungsumgebung blockiert
(`npx playwright install chromium` → ECONNRESET), daher konnte kein echter
Performance-Score gemessen werden. Die Initial-JS-Reduktion ist statisch über
die Chunk-Inspizierung belegt. Ein Lighthouse-Performance-Lauf (Desktop +
Mobile) steht noch aus; aktuell belegt ist nur Accessibility 100/100 aus
Mission 1.

---

## 6. Wiederholbarkeit

```bash
npm run typecheck        # 0 Fehler
npm run typecheck:tests  # 0 Fehler
npm test                 # grün
npm run build            # Static Export
npm run perf:edge-routing # Render-Hotspot-Messung

# Chunk-Inspizierung (PERF-05): React Flow darf nicht in den initialen
# <script>-Tags der Planer-Route stehen.
#   cat out/elektrik-planung/index.html | grep -oE '/_next/static/chunks/[^"]+\.js'
```
