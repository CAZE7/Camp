# ARCHITECTURE-CHANGES (Routing V2)

**Status: `FROZEN`** — Review-Dokumentation und Migrations-Roadmap.

Dieses Dokument beantwortet systematisch die Review-Punkte und beschreibt, wie die
Architektur von dem im Repo vorhandenen Legacy-Stand zu V2 geführt wird. Es ist bewusst
**Spec-first**: Der Code ist noch nicht gegen diese Spec migriert; `IMPLEMENTATION-V2.md`
enthält die Reihenfolge.

---

## 0. Ausgangszustand (Ist-Befund)

> **Implementierungs-Update (2026-09-06):** Routing V2 ist vollständig implementiert
> und in die App eingebunden. `npm run verify:routing-v2` (Gates G1–G7 plus Unit- und
> Industrial-Stress-Test), `npm test` (alle Vitest-Suiten), `tsc --noEmit` und
> `npm run build` sind grün. Store/Canvas nutzen `routeEdgesV2` und `rerouteV2`;
> `onLayoutV2` bindet ELK mit Dagre-Fallback als Live-Layout-Engine an; `CableEdge`
> rendert die von Routing V2 erzeugte Polylinie. Das Industrial-Fixture
> (20 Knoten / 23 Kanten) liefert 0 Edge-Node-Collisions, 0 Edge-Edge-Overlaps,
> 0 Crossings, `minClearance=16`, deterministisch bei ~1,2 s pro Pass.
> `.github/workflows/verify.yml` erzwingt die Gates auf Push/PRs. Details in
> `IMPLEMENTATION-V2.md` § 3.
> Der Abschnitt 0 beschreibt weiterhin den ursprünglichen Legacy-Befund, damit die
> Review-Punkte nachvollziehbar bleiben.

Der Checkout enthält aktuell den Legacy-Stand:

- `lib/planner/domain.ts` — `[key: string]: any`, `PlannerEdge<Data = Record<string, any>>`, `style?: any`
- `lib/planner/electrical.ts` — typisiert schwach, nutzt teilweise `any` in VDE-Fassade
- `lib/planner/routing.ts` — Verbindungsregeln, kein Geometrie-Routing
- `lib/planner/layout.ts` — minimaler Dagre-Einsatz
- `lib/vde-standards.ts` — SINGLE SOURCE OF TRUTH (Legacy) mit `as any` in Validierung
- **nicht vorhanden:** `lib/planner/routingV2/*`, `lib/planner/geometry/*`,
  `lib/planner/layout-engine/*`, `lib/planner/domainModel.ts`, `lib/planner/tokens.ts`,
  `scripts/measure_planner_v2.ts`, `docs/*`
- **nicht vorhanden:** Router-Logik A*/Kostenmodell/Orchestrator/LaneRegistry/Hopping

Daher sind die Review-Punkte über die **Zielarchitektur** zu verstehen.

---

## 1. Antworten auf die 11 Review-Punkte

### Punkt 1 — Routing V2 ist nicht wirklich ein vollständiger A*-Router

**Befund:** `selectBestPath` ruft `routeCost({ path: c }, DEFAULT_COST_WEIGHTS)` mit
`collision = 0`, `laneCongestion = 0`, `hops = 0`.

**Ziel (verbindlich):** `selectBestPath` übergibt die simulierten Kollisionen,
Lane-Belegung und Hop-Prüfung. Das Kostenmodell ist dann wirklich entscheidungsrelevant.

**Spec-Abschnitt:** `ROUTING-V2.md` § 6.
**Umsetzung:** `geometry/collision.ts` (Simulation) + `routing-core/costModel.ts`
(echte Gewichte) + `routing-v2/orchestrator.ts`.

---

### Punkt 2 — Die eigentliche Geometrie wird nicht als Routing-Suchraum verwendet

**Befund:** nur `0 / +offset / -offset` Kandidaten; Hindernisse werden nicht im
Suchmodell berücksichtigt; alter A* und V2 nicht zusammengeführt.

**Ziel:** `geometry/corridor.ts` baut aus Knoten-BBoxes + `edgeNodeSpacing` einen
orthogonalen Kanal-Graphen; `routing-core/astar.ts` sucht darin. Hindernisse blockieren
Segmente hart (Clearance-Verletzung = `collision = ∞`).

**Spec-Abschnitt:** `ROUTING-V2.md` § 4–5.

---

### Punkt 3 — LaneRegistry ist nicht deterministisch genug

**Befund:** `lane = edges.size; edges.add(edgeId)` hängt von `acquire()`-Reihenfolge ab.

**Ziel:** Lane wird aus einer stabilen sortierten Key-Sequenz abgeleitet:
`topologicalOrder → targetPosition → edgeId` (siehe § 7 in `ROUTING-V2.md`).
Insertions-Reihenfolge ändert das Ergebnis nicht.

**Konsequenz:** `LaneRegistry` ist eine **reine deterministische Funktion** der
Kantenmenge, nicht ein Zustand mit transienten IDs.

---

### Punkt 4 — Tokens sind besser, aber noch nicht das vollständige Token-Modell

**Ziel:** `lib/planner/tokens.ts` definiert **explizit**:

- `cableClearance = 12`
- `edgeEdgeSpacing = 12`
- `edgeNodeSpacing = 24` (= `cableClearance * 2`)
- `edgeNodeBetweenLayers = 24`
- `crossDomainSpacing = 24`
- `componentComponentSpacing = 24`
- `stubMin = 24`, `stubMax = 48`, `laneGrid = 16`, `bendRadius = 8`

**ELK und Collision Engine lesen dieselben Werte**, damit „eine gemeinsame Wahrheit“
gilt. ELK speist nicht mehr heuristisch `GEOMETRY.cableClearance * 2`, sondern nutzt
das vollständige Mapping.

**Spec-Abschnitt:** `ARCHITECTURE-V2.md` § 4 und § 6.3.

---

### Punkt 5 — ELK ist da, aber die ELK-Nutzung ist noch relativ rudimentär

**Befund:** aktuell nur algorithm/direction/nodeNode/edgeNode.

**Ziel:** Full-Mapping nach `ARCHITECTURE-V2.md` § 6.3:

- `elk.edgeRouting: ORTHOGONAL`
- `elk.layered.mergeEdges: false`
- `elk.layered.nodePlacement.strategy: BRANDES_KOEPF`
- `elk.layered.nodePlacement.favorStraightEdges: true`
- `elk.layered.crossingMinimization.strategy: LAYER_SWEEP`
- `elk.spacing.edgeEdge`, `edgeNodeBetweenLayers`, `componentComponent`
- `elk.padding` aus `cableClearance`

**Grenze (wichtig):** ELK erzeugt das _Rohlayout_. Die finale Kantengeometrie kommt aus
Routing-V2. ELK wird nie als Ersatz für den Kollisions-/Routing-Layer verwendet.

---

### Punkt 6 — Crossing Hopping vorhanden, aber Gesamtpipeline nicht vollständig gekoppelt

**Befund:** bisher Reihenfolge „Route bauen → Collision Detection → Hop nachträglich“.

**Ziel:** feste Kopplung (siehe `ROUTING-V2.md` § 6, § 8):

```
Kandidaten bauen
→ Kollisionen simulieren
→ Kosten berechnen
→ besten Kandidaten wählen
→ verbleibende Crossings hoppen
```

Crossings werden bei der Auswahl bereits über `hop`-Kosten bestraft; `hopping.ts` löst
nur noch die nicht vermeidbaren Kreuzungen.

---

### Punkt 7 — domain.ts ist noch nicht vollständig „clean“

**Ziel:** `domainModel.ts` ersetzt `domain.ts` für die Fachdomäne. Kein
`[key: string]: any`, kein `PlannerEdge<Data = Record<string, any>>`,
kein `style?: any`, kein `markerEnd?: any`, kein `FitViewCallback = (...) => any`.

`domain.ts` bleibt als **Legacy-Fassade** für UI/Adapter erhalten, wird aber nie von
neuen Tiefenmodulen (Routing/Geometry/Collision/ELK) importiert.

---

### Punkt 8 — Validation verwendet weiterhin any

**Ziel:** `lib/planner/vde/validation.ts` vollständig typisiert. Alle `as any`
entfallen durch `type guards` (`isBatteryNode`, `isInverterNode`, `isShorePowerNode`).

**Spec:** `ARCHITECTURE-V2.md` § 8.

---

### Punkt 9 — Alte Kompatibilitätsschicht existiert weiterhin (bestätigt)

**Ziel:** Das ist akzeptabel — als **Adapter/Fassade**. Aber die Legacy-Schicht darf
die neue Architektur **nicht** prägen.

Eine neue Datei darf `lib/planner/domain.ts` / `lib/vde-standards.ts` **nicht** direkt
importieren. `domain-boundaries.test.ts` erzwingt das.

---

### Punkt 10 — Spec-/Dokumentationsstruktur fehlt im Export

**Ziel:** Diese Dateien werden jetzt eingerichtet:

- `docs/ARCHITECTURE-V2.md`
- `docs/ROUTING-V2.md`
- `docs/ARCHITECTURE-CHANGES.md`
- `docs/IMPLEMENTATION-V2.md`

**Vorgehen:** Erst Spec einfrieren, dann implementieren. Änderungen an der Spec laufen
über PRs und werden in `ARCHITECTURE-CHANGES.md` geloggt.

---

### Punkt 11 — Exit Conditions werden noch nicht vollständig gemessen

**Ziel:** `scripts/measure_planner_v2.ts` wird zu einer **Gate-Suite**, nicht nur zu
einer Architekturgrenzen-Messung. Gates G1–G10 in `ARCHITECTURE-V2.md` § 10.

Diese Gates sind konsistent mit den Review-Anforderungen:

- max. Edge-Node collision = 0
- max. Edge-Edge overlap = 0
- min. clearance >= 12
- deterministic layout = true
- crossing count <= threshold
- hop correctness = 100%
- performance <= X ms

---

## 2. Vergleich Ist → Ziel (Zusammenfassung)

| Aspekt               | Ist (im Repo)                                               | Ziel V2                                                                                       |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Domain-Typen         | `domain.ts`, viel `any`                                     | `domainModel.ts`, strikt typisiert                                                            |
| Tokens               | teilweise in `vde-standards.ts` / UI                        | `tokens.ts` (alle Geometrie-Werte)                                                            |
| Validierung          | `lib/vde-standards.ts` mit `as any`                         | `lib/planner/vde/validation.ts` typisiert                                                     |
| Routing              | Verbindungsregeln / einfache Dagre-Placement                | Geometrie-Korridore + A* + Kostenmodell                                                       |
| Routing-Auswahl      | optimiert grob nur Länge/Biegungen                          | optimiert Länge, Biegungen, Kollisionen, Lanes, Hops                                          |
| LaneRegistry         | nicht vorhanden / insertionsabhängig                        | deterministisch aus stabilem Ranking                                                          |
| Crossings            | nicht als Kostenfaktor in Auswahl                           | Kostenfaktor bei Auswahl + Hopping nur im Nachlauf                                            |
| ELK                  | minimal (algorithm, direction, 2 spacing)                   | volles Token-Mapping, Grenze: nur Rohlayout                                                   |
| Architektur-Boundary | `domain.ts` importiert nichts Schlimmes, aber `any` überall | `domainModel.ts` strickt, Boundary-Tests                                                      |
| Abnahme              | keine Gate-Messung                                          | `measure_planner_v2.ts` mit G1–G10                                                            |
| Doku                 | fehlt                                                       | `docs/ARCHITECTURE-V2.md`, `ROUTING-V2.md`, `ARCHITECTURE-CHANGES.md`, `IMPLEMENTATION-V2.md` |

---

## 3. Schwerwiegende Punkte (Priorität)

1. **Routing-Suchraum** (Punkt 2) — höchste Priorität, weil Routing sonst nicht gegen
   Hindernisse funktioniert.
2. **Kostenrelevanz** (Punkt 1 & 6) — Engine vorhanden, aber Entscheidung nicht
   kostengetrieben → inakzeptabel.
3. **Determinismus der LaneRegistry** (Punkt 3) — Voraussetzung für deterministisches
   Re-Layout.
4. **Token-Vollständigkeit & ELK-Mapping** (Punkt 4 & 5) — nötig für „eine Wahrheit“.
5. **Typen sauber / Any entfernen** (Punkt 7 & 8) — mittlere Bedeutung, schnell
   umsetzbar.
6. **Exit-Gates** (Punkt 11) — definiert, was „fertig“ heißt.

---

## 4. Migrationslog

### Woche 0 (Spec-Freeze)

- [x] `docs/ARCHITECTURE-V2.md` angelegt
- [ ] Runtime-Typen `domainModel.ts` + `tokens.ts` definieren (abgestimmt mit
      `domain-boundaries.test.ts`)
- [ ] `docs/ROUTING-V2.md` final reviewen
- [ ] `docs/IMPLEMENTATION-V2.md` für Umsetzung übernehmen
- [ ] Reviewpunkt 11 Gates als Checkbox absegnen (Thresholds)

### Woche 1 (Domain & Tokens)

- [ ] `lib/planner/tokens.ts` (GEOMETRY + COST_WEIGHTS)
- [ ] `lib/planner/domainModel.ts` (strict types, kein any)
- [ ] `lib/planner/graph/topology.ts` (stabile topologische Ordnung)
- [ ] `lib/planner/graph/nodeLookup.ts`
- [ ] `lib/planner/domain-boundaries.test.ts` (fehlende bzw. noch prüfende Imports)

### Woche 2 (Geometrie/Collision)

- [ ] `geometry/collision.ts` (Edge-node, Edge-edge)
- [ ] `geometry/corridor.ts` (Suchraum)
- [ ] `geometry/lanes.ts` (deterministische LaneRegistry)
- [ ] Tests: deterministisch, insertion-order-unabhängig, clearances

### Woche 3 (Routing-Core)

- [ ] `routing-core/costModel.ts` (echte Gewichte + Default-COST_WEIGHTS aus tokens)
- [ ] `routing-core/astar.ts`
- [ ] `routing-core/candidates.ts`
- [ ] Tests: Hindernis-Blockierung, Kostenwahl, Kollisionsvermeidung

### Woche 4 (Orchestrator + Hopping)

- [ ] `routing-v2/orchestrator.ts` (Pipeline korrekt gekoppelt, selectBestPath mit
      Simulationseingaben)
- [ ] `routing-v2/hopping.ts` (nur verbleibende Crossings, Nachher-Prüfung)
- [ ] Tests: `collision`/`laneCongestion`/`hops` fließen in `routeCost`.
- [ ] Tests: Verhalten auf 20-Knoten-Beispiel

### Woche 5 (Layout-Engine)

- [ ] `layout-engine/contract.ts`
- [ ] `layout-engine/elk.ts` (volles Mapping aus tokens.ts)
- [ ] `layout-engine/dagre.ts` (Fallback)
- [ ] Tests: deterministisch, ELK-Mapping, Adapter-Boundary

### Woche 6 (Validation & Boundary)

- [ ] `vde/validation.ts` (typisiert, kein any)
- [ ] `vde/index.ts` (re-export, Fassade für altes `lib/vde-standards.ts`)
- [ ] Legacy-Boundary-Tests (verbotene Imports)

### Woche 7 (Gate-Suite)

- [ ] `scripts/measure_planner_v2.ts` → Gate-Suite G1–G10
- [ ] CI-Script (`npm run verify:routing-v2`)
- [ ] Fehlende Architektur-/Doku-Referenzen in `README`/`docs` verlinken

---

## Change Ledger

### 2026-09-08 — ROUTE-003 erledigt: ELK produktiv verdrahtet + Final-Gate liest das Kollisionsmodell

Kein Golden-Master-Recapture nötig (kein Geometrie-/Dimensionierungs-Delta).
Zwei Architektur-Entscheidungen (`docs/adr/0018`, `docs/adr/0019`), Befund-Text
und Beweise in `AUDIT-EXTREM-2026-09.md` → „Siebte Nachbearbeitung":

1. **ELK-Pass UI-produktiv (ADR 0018):** Toolbar-/Menü-Eintrag „Strukturieren
   (ELK)" (`data-testid="action-layout-v2"`) ruft die zuvor UI-tote
   `onLayoutV2`. Neu: Sequenz-Guard „letzte Anfrage gewinnt" (P-6) im Store,
   `isLayoutPending` erst beim jüngsten Lauf zurück, Undo-History +
   Fit-View-Dispatch wie beim klassischen Aufräumen, Wasser-Ansicht
   mitbedient (`kind: 'waterPipe'` war im Engine-Vertrag längst vorgesehen).
   `applyAdvancedLayout` meldet `engine: 'elk' | 'dagre'` — der einst stille
   Dagre-Fallback ist jetzt im UI-Feedback lesbar. Bewusst nicht konsumiert:
   ELK-`routes`/`junctions` (Geometrie bleibt exklusiv im A\*-Pass, ADR 0014).
2. **Final-Gate konsumiert `classifyCollision` (ADR 0019):** I1/I2/I3 in
   `lib/routing/invariants.ts` sind Ableitungen von
   `classifySegmentAgainstNode`/`classifySegmentAgainstSegment`
   (hard ⇒ I1/I2, weighted ⇒ I3) statt eigener `geometry`-Begriffe — drei
   Begriffswelten → zwei, wobei die A\*-Fassung dokumentiert äquivalent bleibt
   (PERF-001: Modell-Aufruf im Innenloop wäre der belegte 95-%-Laufzeitpfad
   bei identischer Entscheidung). Zahlen: LEGACY_BASELINE + Ratchet ohne
   Nachzug grün.

Bewusst NICHT in dieser Scheibe: Geometrie-Migration
`components/edges/utils → lib/routing` (Allowlist-Typkante) — eigenes Projekt,
siehe „Verbleibend" im Audit.

### 2026-09-08 — Golden-Master-Neuerfassung (AUDIT ELE-007 + DOM-002, Branch `arena/01a0818b-camp`)

`npm run goldenmaster:capture` bewusst ausgeführt; alle 7 Fixtures neu eingefroren.
Begründung „bewusst besser, weil …":

1. **ELE-007 (Solar-Drop-Budget):** Solar-Zuleitungen (Panel → MPPT) werden jetzt
   gegen die MPP-Basis 18 V dimensioniert/bewertet statt gegen die 12,8-V-
   Systemreferenz. Betroffen: Plan `solar` (Panel-Kanten 16 mm² → 10 mm²).
   Der alte Stand überschätzte den Prozentfall um ~40 % — konservativ, aber
   falsch bemessen.
2. **DOM-002 (Sicherungs-Bauform):** Auto-Wire vergibt jetzt `fuseType`
   (`applyFuseTypes` in `lib/autoWire/sizing.ts`): kleinste Bauform, deren
   typisches Abschaltvermögen den geschätzten Bank-Kurzschlussstrom am
   Einbauort trägt (`lib/shortCircuit.ts`; ≈ 4,3 kA bei 100 Ah LiFePO4 →
   Class T; kleine AGM-Bank → MRBF/MEGA/ATO). Ohne diesen Stempel meldete
   der neue Kurzschluss-Check (Rule A7) in jedem Auto-Plan „Abschaltvermögen
   unbekannt". Delta: reine Zusatzfelder `fuseType` (+ die zwei Solar-
   Querschnitte), keine Id-/Geometrie-/Safety-Verschlechterung.

### 2026-09-08 — Zweite Fassung: AIC-Tabelle verifiziert (DOM-002-Nachpflege)

Erneutes `npm run goldenmaster:capture`, Diff ausschließlich `fuseType`-Stempel
(`simple`/`camper`: mrbf → anl; `solar`: classT → anl; `inverter`/`acdc`:
classT → mrbf; `complex` unverändert), keine Querschnitts-/Geometrie-Änderung.
Begründung „bewusst besser, weil …": die Bauform-Tabelle in `lib/shortCircuit.ts`
ruht jetzt auf verifizierten Hersteller-Datenblattankern (Littelfuse-Blatt:
ATO 1 kA, MEGA/MIDI 2 kA @32 VDC; Blue-Sea-„Quick Guide to Fuses": ANL 6 kA,
Class T 20 kA, MRBF spannungsabhängig 10/5/2 kA @14/32/58 VDC) statt auf
Faustwerten (MRBF war 3 kA angenommen), und `applyFuseTypes` wählt das
KLEINSTE wirksame Abschaltvermögen ≥ geschätztem Ik (spannungsabhängig
sortiert) — kürzester Lichtbogen, Class T als Dach. Details:
`AUDIT-EXTREM-2026-09.md` → „Sechste Nachbearbeitung".

### 2026-09-08 — Dritte Fassung: AC-Schutzorgan gestempelt (DOM-001)

Erneutes `npm run goldenmaster:capture`; der Gesamt-Diff der Fixtures enthält
jetzt drei durch Tests abgesicherte, bewusste Deltas — sonst nichts
(Ids/Geometrie/Routing byte-identisch):

1. `fuseType`-Stempel auf DC-Kanten (siehe DOM-002-Einträge oben),
2. `solar`: zwei Querschnitte 16 → 10 mm² (siehe ELE-007-Eintrag oben),
3. **DOM-001:** `acProtection: { kind: 'mcb', characteristic: 'B',
breakingCapacityKA: 6 }` auf genau den sechs AC-Kanten (je Plan eine).
   Begründung „bewusst besser, weil …": `sizeAcEdges` stempelt das
   230-V-Schutzorgan mit (LS, Charakteristik B, 6 kA nach IEC 60898-1 —
   konservativer Marktstandard, Nutzer-Einträge werden nie überschrieben).
   Erst mit diesem Datenblatt-Satz wird Rule A8 (geschätzte
   Abschaltbedingung Zs·Ia ≤ U0, 2/3-Regel, PE nach IEC 60364-5-54
   Tab. 54.2; `lib/acProtection.ts`) für Auto-Pläne aktiv statt nur als
   Info „nicht modelliert". Das schließt die Lücke, dass AC-Kanten eine
   Sicherung als nackte Zahl ohne Typ/Charakteristik/Abschaltvermögen
   trugen.
