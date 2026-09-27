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

### 2026-09-25 — Vierte Fassung: AC-Stempel zurückgenommen, Nicht-Ausführbarkeit sichtbar (AUDIT ELE-004/ELE-009)

`npm run goldenmaster:capture` bewusst ausgeführt; die Fixtures enthalten
gegenüber der dritten Fassung **zwei** Deltas, sonst nichts (Ids, Geometrie,
Routing, Ströme byte-identisch):

1. **Der AC-Stempel ist weg.** `acProtection: { kind: 'mcb',
characteristic: 'B', breakingCapacityKA: 6 }` wurde von `sizeAcEdges`
   erfunden und in JEDE AC-Kante geschrieben. Zwei Gründe, das
   zurückzunehmen:
   - Ein Plan, der ein Schutzorgan enthält, das niemand ausgewählt hat,
     behauptet eine Geräteauswahl. Der Inspector zeigte „LS B, 6 kA“ als
     wäre es eine Bestandsaufnahme — es war ein Default.
   - Ausgerechnet **B ist für die Abschaltbedingung die optimistische
     Annahme**: B löst bei 5 × I_n aus, C bei 10 × I_n. Mit B rechnet
     `lib/acProtection.ts` also ein Zs,max, das die Anlage leichter
     durchwinkt als eine C-Anlage es täte (Zs,max(B16) = 1,917 Ω gegenüber
     Zs,max(C16) = 0,958 Ω). Die Begründung der dritten Fassung
     („konservativer Marktstandard“) traf für das Abschaltvermögen zu, nicht
     für die Charakteristik.
     Statt eines stillen Stempels gibt es jetzt eine **sichtbare Annahme**:
     Fehlt der Deskriptor, rechnet die Prüfung konservativ mit C/6 kA, setzt
     `descriptorAssumed: true` und meldet einmalig
     `DOM-001-descriptor-assumed` („LS C, 6 kA (Annahme)“). Fehlt die Länge
     oder der Querschnitt, lautet das Ergebnis `not-modeled` mit
     `limitation`-Kennung statt eines stillen `lengthM ?? 0`-Durchlaufs.
2. **`fuseWarning` auf allen DC-Kanten.** `markInfeasibleSizing`
   (`lib/autoWire/sizing.ts`, aufgerufen nach `applyFuseSizes`) markiert jede
   Leitung, die mit diesem Querschnitt nicht ausführbar ist — Plus-Leiter
   schutzbezogen (keine Normsicherung trägt den Strom: `I_B > FUSE_MAP[cs]`),
   Minus-Leiter thermisch (`I_B > I_z = 0,7 × Tabellenwert`). Betroffen im
   Referenzplan `acdc`: `e-auto-1…5` (152,06 A auf 70 mm² → I_z 120,4 A,
   maxFuse 100 A), `e-auto-8/9` (147,06 A). Die Kante trug die Information
   vorher gar nicht — und wo sie sie trug, las sie niemand (AUDIT ELE-009).

Begründung „bewusst besser, weil …“: Die Fixtures zeigen jetzt denselben
Sachstand, den die Oberfläche anzeigt (E1/E2/E9). Neu abgesichert durch
`scripts/goldenmaster/electricalPlausibility.test.ts` — es prüft über allen
sechs Plänen, dass (a) keine Kante unmarkiert über ihrer design-Belastbarkeit
liegt, (b) kein Marker ohne Grenzverletzung gesetzt ist, (c) automatisch
gewählte Sicherungen Last und Leiter koordinieren (I_B ≤ I_n ≤ FUSE_MAP[cs])
und (d) keine Pipeline AC-Schutzorgan-Daten erfindet. Der Test wäre gegen die
dritte Fassung rot gewesen: genau das war der Befund.

### 2026-09-25 — Fünfte Fassung: Kanten-Herkunft als Datenfeld, Nutzerdaten ohne Whitelist (AUDIT D1/D2)

`npm run goldenmaster:capture` — alle sechs Referenzpläne neu erfasst. Der Diff
gegenüber der vierten Fassung ist **rein additiv**: 60× `"autoWired": true`
(Auto-Kanten) und 19× `"autoWired": false` (Nutzerkanten). Ids, Geometrie,
Routing, Ströme, Spannungsfall und SVGs sind byte-identisch; der
`routing`-Block und die Metriken des Vergleichs blieben unberührt.

Zwei Befunde, eine Ursache — die Kante wurde beim AutoWire-Lauf **neu
aufgebaut** statt durchgereicht:

1. **D1 (Datenverlust).** `performAutoWiring` erzeugte die `data` jeder
   Nutzerkante aus einer Whitelist von vier Feldern (`length`, `crossSection`,
   `fuseSize`, `edgeDomain`). Alles andere verschwand bei _jedem_ Klick auf
   „Automatisch verbinden" — darunter die vom Nutzer eingetragenen
   Datenblattwerte `fuseType`, `fuseOffset`, `fuseBreakingCapacity` und
   `acProtection` sowie die Marker `dropWarning`/`fuseWarning`. Neu:
   `data: { ...e.data }` (Durchreichen), nur `length` wird wie bisher
   nachgeschätzt. `applyFuseTypes` respektiert vorhandene Angaben weiterhin
   (es überspringt Kanten mit `fuseType`/`fuseBreakingCapacity`), die
   Datenblattwerte des Nutzers schlagen also nach wie vor die Automatik.
2. **D2 (Identität über einen String).** Ob eine Kante „Auto" oder „Nutzer"
   war, entschied `id.startsWith('e-auto-')`. Eine Nutzerkante mit einer
   zufällig so beginnenden Id (Import, Hand-Edit, Fremd-Tool) wurde gelöscht
   und durch zwei Auto-Kanten ersetzt. Neu: `data.autoWired: boolean` ist die
   Autorität — gesetzt vom Schreibpfad (`store/slices/graphSlice.ts`,
   `autoWired: false`), von `addDcEdge`/`addAcEdge` (`true`) und von
   `performAutoWiring` auf jeder überlebenden Nutzerkante. Der Präfix-Vergleich
   bleibt als ausdrücklich kommentierter Migrations-Fallback in
   `isAutoWiredEdge` (`lib/autoWire/primitives.ts`) und greift **nur**, solange
   das Flag fehlt — also genau für Pläne, die vor dieser Fassung gespeichert
   wurden. Ohne ihn würden alte Auto-Kanten zu Nutzerkanten und als Doppelte
   stehen bleiben.

Begründung „bewusst besser, weil …": Die Fixtures dokumentieren jetzt die
Herkunft jeder Kante als Datenfeld, statt sie aus einem Id-Präfix raten zu
lassen — derselbe Sachstand, den die Oberfläche und der Persistenzvertrag
brauchen. Abgesichert durch `lib/autoWire.test.ts` →
„Persistenzvertrag Nutzerkante (AUDIT D1/D2)": Key-Mengen-Vergleich vor/nach
`performAutoWiring`, Erhalt der Datenblattwerte, Überleben einer Nutzerkante
mit Auto-Id, plus **zwei Positivkontrollen** (Querschnitt wird weiterhin
nachdimensioniert; echte Auto-Kanten früherer Läufe werden weiterhin ersetzt —
Idempotenz).

### 2026-09-25 — Sechste Fassung: Einheiten, Speicherversagen, Längenherkunft, Abschaltvermögen (AUDIT S1/D3/L1/N1/N3/T7)

Sechs Befunde aus dem Dritt-Audit zu PR #451. Gemeinsames Muster: eine Zahl
oder ein Zustand wurde **behauptet**, wo das Modell ihn nicht belegen konnte —
und die Stelle, die es hätte wissen müssen, schwieg.

1. **S1 (Einheitslücke Temperaturkoeffizient).** Das Feld war mit „%/K"
   beschriftet und schrieb den Wert unverändert nach `node.data.tempCoefficient`,
   während `lib/solar.ts` mit einem **Bruch** rechnete (Default −0,0035). Ein
   22-V-Panel mit eingetragenen −0,35 ergab Faktor 16,75 und damit 368,5 V
   Kalt-Voc statt 25,5 V — Faktor 14,5 auf die Prüfung des MPPT-Eingangsfensters.
   Neu: `solarTempCoefficientPerKelvin()` normalisiert an einer Stelle
   (|Wert| ≥ 0,05 ⇒ Prozentangabe ⇒ /100), die UI zeigt %/K und schreibt den
   Bruch, `lib/solar.ts` und `lib/nodeSchema.ts` nennen den Bruch als
   kanonische Speichereinheit. Zweitbefund derselben Zeile: bei +60 °C wurde der
   Korrekturfaktor negativ und `Math.pow` warf einen **RangeError** in der
   Live-Validierung. `solarColdVocOf` gibt jetzt `null` zurück, und
   `stringColdVocOf` unterscheidet zwei Ursachen mit je einem eigenen Flag:
   `missingVoc` (kein Datenblattwert) und `uncomputableVoc` (Wert da, aber
   Koeffizient unsinnig) — die Live-Validierung meldet beides getrennt
   (`ELE-007-voc-missing-data` Info, `ELE-007-voc-uncomputable` Warnung).
2. **D3 (Speicherversagen ohne Zeugen).** `flush()` schrieb alle Schlüssel in
   einem `try` — ein `QuotaExceededError` beim ersten Schlüssel warf den Timer
   um, die übrigen Werte blieben ungeschrieben, und die UI zeigte weiter einen
   gespeicherten Plan. Neu: try/catch **je Schlüssel**, fehlgeschlagene Werte
   bleiben in `pending` und werden beim nächsten Tick erneut versucht,
   `visibilitychange → hidden` flushet (letzter sicherer Zeitpunkt mobil), und
   ein Modul-Signal (`getSaveFailure`/`subscribeSaveFailure`, bewusst NICHT im
   persistierten Store) trägt den Zustand über `useSaveFailure()` in einen
   `role="alert"`-Banner im `FlowCanvas`. Die Meldung dedupliziert nach
   Schlüssel+Text und erlischt, sobald wieder geschrieben werden kann.
3. **L1 (erfundene Längen in der Stückliste).** `edgeLengthM` nahm den
   eingetragenen Wert und fragte nie nach der Route. AutoWire trägt als Länge
   die **Luftlinie** aus der Knotengeometrie ein, der Router kennt den
   Verlegeweg: im Referenzplan `camper` standen 22,10 m eingetragen gegen
   38,05 m geroutet — Faktor 1,72. Neu: `edgeLengthOf()` liefert Länge **und
   Quelle** (`stored`/`routed`/`fallback`); liegen beide Quellen vor, zählt die
   größere (Material wird zu kurz bestellt, nicht zu lang), und eine Abweichung
   über 10 % wird im Dialog benannt — ebenso jede Platzhalterlänge als das, was
   sie ist: erfunden. Die Annahmen reisen im kopierten JSON mit.
4. **N1 (unerreichbare Abschaltvermögens-Prüfung).** `I_p = U0/Zs` war durch
   `UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0,8` bei ≈ 0,29 kA gedeckelt; die UI
   bietet 6 und 10 kA an — der Vergleich `I_p > Icn` konnte für kein real
   erfasstes Gerät kippen. Neu, zweigeteilt: (a) `supplyProspectiveIkA`, ein
   angegebener/gemessener Kurzschlussstrom der Einspeisung (Feld am
   Landstrom-Knoten, optional und löschbar), schlägt beide Annahmen und macht
   die Prüfung scharf — bei I_k = 6 kA fällt ein 4,5-kA-Gerät durch;
   (b) `UPSTREAM_IMPEDANCE_MIN_OHM = 0,15` als Niederimpedanz-Grenze derselben
   Einspeisung. Reicht Icn nur für den hochohmigen Fall, trägt das Verdikt
   `limitation: 'breaking-capacity-reach'` und sagt die Grenze im Klartext —
   vorher stand dort ein `ok-with-assumption` ohne Hinweis (Nebenbefund des
   Audits). Die Abschalt**bedingung** (Zs·Ia ≤ U0) rechnet unverändert gegen
   0,8 Ω: kein Zweckwechsel der Annahme.
5. **N3 (Doku-Zahl gegen eigenes Gate).** AGENTS.md §3.8 versprach für
   `npm run perf:edge-routing` „Median ≤ 16 ms" — derselbe Befehl fährt zwei
   Gates: Render-Pfad ≤ 16 ms (gemessen ≈ 3,3 ms) und Live-Pfad
   (`routeAllCables`) mit einem **Ratchet** von 60 ms (gemessen ≈ 40 ms).
   Die Dokumentation beschreibt jetzt beide Grenzen und sagt, warum die zweite
   ein Ratchet ist und wer es nach unten zieht.
6. **T7 (stiller Trigger-Rot).** `deploy.yml` trägt unter `on.push.branches`
   eine handgeschriebene Liste (GitHub Actions wertet dort keine Ausdrücke aus),
   die Jobs prüfen dagegen `github.event.repository.default_branch`. Wird der
   Default-Branch umbenannt, triggert der Workflow **gar nicht mehr**: kein
   Fehlschlag, keine Meldung, nur kein Deploy. Neu:
   `scripts/ci/verifyDeployTrigger.ts` (npm `ci:verify-deploy-trigger`) läuft
   als Schritt im Quality Gate und vergleicht Liste gegen den tatsächlichen
   Default-Branch; bei Abweichung, Wildcards, leerer Liste oder unlesbarer
   Trigger-Sektion scheitert es mit Handlungsanweisung. Ohne Repo-Kontext
   (lokal) prüft es nur die Form — und sagt das, statt still durchzuwinken.

Begründung „bewusst besser, weil …": Jede der sechs Stellen nennt jetzt ihre
Quelle oder ihre Grenze. Die Tests pinnen die Nähte, an denen die Befunde
saßen, nicht die Symptome: `lib/solar.test.ts` + `components/inspector/NodeInspectors.test.tsx`
(S1: Anzeige %/K ↔ Bruch ↔ Kalt-Voc, Ende-zu-Ende 25,465 V statt 368,5 V),
`store/storage.test.ts` + `components/planner/hooks/useSaveFailure.test.tsx`
(D3: Retry nach Quota, ein kaputter Schlüssel blockiert die anderen nicht,
Signal → React-Update), `components/planner/BOMModal.test.tsx` (L1: größere
Länge gewinnt, Widerspruch benannt, Platzhalter als erfunden gekennzeichnet,
Route ohne Eintrag ist keine Annahme), `lib/acProtection.test.ts` (N1: zweiter
Term, Reichweitengrenze, I_k-Angabe macht 4,5 kA zum Fail, unsinnige Angaben
fallen auf die Annahme zurück), `components/ui/ValidatingInput.test.tsx`
(optionales Feld bleibt löschbar — der Sync-Effekt holte den geleerten Wert
sonst zurück), `scripts/ci/verifyDeployTrigger.test.ts` + `scripts/ci/workflows.test.ts`
(T7: Wächterlogik und seine Verankerung im Gate).

Kein Golden-Master-Recapture nötig: Ids, Geometrie, Routing, Ströme,
Spannungsfall und SVGs bleiben unberührt (BOM und AC-Bewertung sind keine
Teile der erfassten Plan-Dateien).

### 2026-09-26 — Siebte Fassung: Lint-Gate mit Typinformation + react-hooks v7 (AUDIT T1)

Das Gate nannte sich „Industriestandard" (AGENTS.md M6-1), lief aber **ohne
Typinformation**: `tseslint.configs.recommended` sieht weder ein `any`, das über
eine Assertion hereinkommt, noch ein verworfenes Promise, noch den Vergleich
unvergleichbarer Typen. Die Konfiguration trug diese Entscheidung sogar als
Kommentar („bewusst keine type-checked Rule-Sets … für die Team-Latenz zu
teuer") — unbelegt. Dazu: ARCH-001 (Schichtgrenze `lib/**`) existierte nur als
Test, der Determinismus-Anspruch aus AGENTS.md §3.6 war gar nicht erzwingbar,
und react-hooks lief in der Fassung von zwei Regeln.

Neu: `recommendedTypeChecked` + ProjectService, `no-restricted-imports` und
`no-restricted-syntax` für die beiden Hausregeln, react-hooks v7
(`configs.flat['recommended-latest']`).

1. **Messung statt Behauptung.** Gleiche Maschine, gleicher Baum: 8 s ohne
   Typinformation, ~30 s mit. Im CI unkritisch (das Quality Gate läuft dort
   ohnehin Minuten), lokal über den Watch-Modus tragbar. Der Preis eines
   nicht-typbewussten Gates ist höher als seine Laufzeit: `no-floating-promises`
   findet im Static Export unsichtbar abgebrochene Speicher-/Clipboard-Vorgänge,
   `no-unsafe-*` findet `any`, das über eine DOM-Grenze hereinkommt — beides
   Klassen, die `tsc` per Design nicht meldet und die Tests nur zufällig sehen.
2. **252 Befunde auf dem Vorher-Stand** (reproduzierbar: Worktree auf
   `8bbdde9` + diese Konfiguration; 52 Dateien, alles Errors):

   | Befunde | Regel                             |
   | ------: | :-------------------------------- |
   |      68 | `no-unsafe-member-access`         |
   |      52 | `no-unsafe-assignment`            |
   |      33 | `no-base-to-string`               |
   |      20 | `no-unsafe-call`                  |
   |      16 | `no-unsafe-return`                |
   |      15 | `no-unsafe-argument`              |
   |      14 | `restrict-template-expressions`   |
   |       9 | `react-hooks/set-state-in-effect` |
   |       8 | `no-misused-promises`             |
   |       5 | `no-floating-promises`            |
   |       4 | `require-await`                   |
   |       3 | `no-duplicate-type-constituents`  |
   |       3 | `unbound-method`                  |
   |       2 | `react-hooks/immutability`        |

3. **144 real behoben, 108 dokumentiert aufgeschoben.** Die 108 sitzen in vier
   Dateien Werft-Altbestand (`app/api/chat/route.ts` + `route.test.ts`,
   `lib/db.test.ts`, `components/Chat.test.tsx`), deren gemeinsame Ursache
   `any` in den AI-SDK-Mocks ist. Sie tragen einen Disable-Header, der Ursache,
   Geltungsbereich und FOLLOW-UP nennt; `--fix` hat die Header auf genau die
   verletzten `no-unsafe-*`-Regeln gestutzt (fünf überflüssige Einträge weg).
   Die abgeleiteten Regeln einzeln zu verbieten, ohne die Ursache zu beheben,
   hätte 100+ Einzel-Disables erzeugt — der Block ist die Grenze des
   aufgeschobenen Bereichs, nicht seine Auflösung.
4. **`lib/safeText.ts`: eine Stelle, an der Modellwerte zu Text werden.** Die
   33 `no-base-to-string`- und 14 `restrict-template-expressions`-Befunde kamen
   aus Warnmeldungen, Sortierschlüsseln, Cache-Signaturen und AutoWire-Ids, die
   per Template-Literal aus `data?: Record<string, unknown>` (React-Flow-Sicht:
   `{}`) gebaut wurden — ein Objekt wird dort stillschweigend zu
   `[object Object]`, und zwar genau in den Meldungen, die der Nutzer lesen
   soll. `safeText` ist **join-kompatibel** (`true` → `'true'`, `NaN` → `'NaN'`,
   `null`/`undefined` → Fallback): `store/slices/graphInternals.ts` baut aus
   denselben Werten Cache-Signaturen, jede andere Stringifizierung hätte
   bestehende Caches invalidiert — ein Verhaltensunterschied, den niemand
   bestellt hat. Der Beweis steht im Golden Master: 13 Referenzpläne,
   byte-identisch, **ohne** Neuerfassung. `nodeLabelOf` (Anzeigename) trennt
   ausdrücklich zwischen Nutzertext und Signaturschlüssel: Letzterer darf nicht
   auf den Knotentyp ausweichen, weil er zwischen Läufen stabil bleiben muss.
   Die Live-Validierung hat daneben eigene Anzeige-Helfer (`displayText`,
   `nodeLabel`, `nodeField`) mit Anzeige-Konvention (`ja`/`nein`,
   nicht-endliche Zahlen → Fallback) — zwei Verträge, zwei Funktionen;
   `diagnosticText` (Diagnose ungültiger Eingaben) ist identisch und liegt
   deshalb nur noch einmal in `lib/safeText.ts`.
5. **Promises: `void` mit Begründung statt stiller Verwurf.** `FlowCanvas`
   hatte 4 `no-floating-promises` und 3 `no-misused-promises` — React Flow gibt
   für `fitView`/`setCenter`/`setViewport` Promises zurück, die als
   Event-Handler-Rückgabe „misused" sind. Eine Viewport-Animation ist
   fire-and-forget: nichts nachzuholen, kein Nutzerfehler zu melden. `void`
   markiert die Absicht, ein `.catch` hätte einen Fehlerpfad erfunden.
   `graphSlice.onCustomDrop` war der inhaltlich schwerste Befund:
   `event as CustomEvent` ist `CustomEvent<any>`, Typ/Label/Watts liefen
   ungeprüft in `addNode`. Neu wird die Detail-Form an der DOM-Grenze geprüft;
   ein Drop ohne verwertbaren Typ legt keinen Knoten an (wie `onDrop`).
6. **`no-unnecessary-type-assertion` bleibt AUS — mit belegtem Fehlalarm.**
   `screen.getByLabelText(/x/i) as HTMLInputElement` meldet die Regel als
   „ändert den Typ nicht", `tsc` bricht ohne den Cast mit TS2339 ab
   (`Property 'value' does not exist on type 'HTMLElement'`). Ursache ist die
   generische Signatur `getByLabelText<T extends HTMLElement = HTMLElement>`:
   typescript-eslint sieht vor und nach der Assertion denselben Typ, `tsc`
   nicht. Nachgewiesen an `app/tools/heizung/page.test.tsx` plus Minimal-Repro
   (ein Import, ein Cast, ein `.value`-Zugriff). Ein `--fix` dieser Regel
   löscht **notwendige** Casts und macht beide Typecheck-Profile rot
   (24 Stellen). Ein Gate, das nötige Casts entfernt, ist schlechter als keines
   — `tsc` bleibt hier autoritativ, und `no-explicit-any` (hart, M6-1) deckt
   dieselbe Fehlerklasse an der Wurzel ab. Es ist die einzige Regel des Sets,
   die ausgeschaltet ist; die Begründung steht in `eslint.config.mjs`.
7. **Hausregeln als Lint-Regeln.** ARCH-001 (ADR 0008): `lib/**` darf nicht aus
   `components/`, `store/`, `app/`, `benchmarks/` importieren — bisher nur
   `scripts/architecture/libBoundary.test.ts`, der einen Verstoß erst **nach**
   dem Commit sieht; als Lint-Regel schlägt er beim Schreiben fehl. Testdateien
   sind ausgenommen (Harness-Nutznießer dürfen beide Seiten ziehen) — dieselbe
   Ausnahme, dieselbe Begründung wie im Test. AGENTS.md §3.6: kein
   `Math.random` in `lib/routing/**` (Invariante I-Determinismus; Zufall macht
   die byte-exakten Golden-Master wertlos). Der Riegel gilt dem Router, nicht
   dem Repo: `lib/id.ts` behält seinen dokumentierten Zufalls-Fallback für Ids.
8. **react-hooks v7: 12 Befunde, alle behoben — keine davon mit Disable.**
   Zwei Hinweise zur Konfiguration: Es muss
   `reactHooks.configs.flat['recommended-latest']` sein; die Variante ohne
   `.flat` ist das alte eslintrc-Format (`plugins: ['react-hooks']`) und lässt
   ESLint 10 beim Laden der Flat Config hart abbrechen, nicht warnen. Und das
   Set ist nicht kostenlos: 2× `immutability` (`BOMModal`: die
   `useState`-Deklarationen für `copied`/`copyError` standen **unter** dem
   Effekt, der sie schreibt — Reihenfolge getauscht, sonst nichts) und
   10× `set-state-in-effect`, durchweg die Klasse „lokaler State folgt einem
   Prop oder abgeleiteten Wert".
   Umgestellt auf das offizielle Muster: Vergleichszustand + **bedingtes**
   `setState` während des Renders — ein Commit statt zwei, und der
   Zwischenzustand (erst Prop-alt gerendert, dann korrigiert) verschwindet:

   | Stelle                               | Auslöser                                          | Folge                                                         |
   | :----------------------------------- | :------------------------------------------------ | :------------------------------------------------------------ |
   | `app/tools/dach/page.tsx`            | `placementCount`                                  | Onboarding schließt                                           |
   | `components/Inspector.tsx`           | neuer `node`                                      | Label übernehmen                                              |
   | `components/planner/ExpertPanel.tsx` | `currentKnowledge`                                | `expandedTip` auf 0                                           |
   | `hooks/useLongPressNodeDrag.ts`      | `!enabled`                                        | Node entsperren (Effekt hängt weiterhin nur die Listener aus) |
   | `ui/CanvasDisplayOptions.tsx`        | `!compact`                                        | Popover zu                                                    |
   | `ui/WarningCenter.tsx`               | keine Warnungen                                   | Popover zu                                                    |
   | `ui/ValidatingInput.tsx`             | value/localValue/error/allowEmpty/clearedOptional | Anzeige nachziehen, Marke löschen                             |
   | `ui/ValidatingNumberInput.tsx`       | value/isFocused                                   | Anzeige nachziehen (nicht beim Tippen)                        |

   Zwei Sonderfälle mit eigener Begründung:
   `components/planner/hooks/usePlannerTheme.ts` liest die Media-Query jetzt
   über `useSyncExternalStore` — die Quelle ist objektiv extern
   (`MediaQueryList`), `getSnapshot` liefert `mql.matches`, `subscribe` hängt
   den change-Listener an. Der „Initial sync (SSR/hydration safety)"-Effekt und
   damit der zweite Render-Durchlauf fallen weg, der Server-Snapshot bleibt
   `false` (unverändert hell).
   Bei `ValidatingInput`/`ValidatingNumberInput` trägt der Vergleichszustand
   **alle** alten Effekt-Abhängigkeiten, nicht nur `value`. Nur auf `value` zu
   keyen hätte das Verhalten geändert, wenn die Eltern den Prop nicht
   zurückspielen — genau der Fall, für den die sechste Fassung die Marke
   `clearedOptional` eingeführt hat („optionales Feld bleibt löschbar",
   `components/ui/ValidatingInput.test.tsx`). Auch die Reihenfolge der beiden
   alten Effekte ist erhalten: erst Anzeige aus dem Prop nachziehen, dann die
   Marke löschen.

9. **Test-Helfer statt `any`-Matchern.** `expect.stringContaining` und
   `expect.closeTo` sind in den Vitest-4-Typings `any` — jede Verwendung war
   ein `no-unsafe-assignment`. `test-helpers/matchers.ts` legt
   `textContaining`/`closeTo` als typisierte Wrapper darüber (ein Ort, ein
   Cast), `test-helpers/reactflowMocks.ts` bekam `MockBaseEdgeProps`. Dazu:
   typisierte `matchMedia`-Stubs, `vi.spyOn` statt ungebundener
   Methodenreferenzen (`unbound-method`), gebundenes `crypto.randomUUID`,
   `void act(...)` statt verworfener Promises.

Begründung „bewusst besser, weil …": Ein Gate, das seine eigene Behauptung
nicht prüft, ist teurer als keines — es erzeugt Vertrauen, das der Baum nicht
einlöst. Die 144 behobenen Befunde sind keine Stilfragen: `[object Object]` in
einer Warnmeldung, ein ungeprüftes `CustomEvent<any>` im Drop-Pfad, verworfene
Promises im Static Export und zehn Stellen, die bei jeder Prop-Änderung zweimal
renderten, sind Sachfehler, die ohne Typinformation unsichtbar bleiben. Die
einzige ausgeschaltete Regel ist mit Repro belegt und begründet, die einzigen
Disables sind vier Dateien Altbestand mit Ursache und FOLLOW-UP im Header.

Nachweis: `npx eslint .` → **0 Errors / 0 Warnings** (inkl. react-hooks v7);
`tsc -p tsconfig.typecheck.json` und `tsc -p tsconfig.tests.json` clean;
`npx prettier --check .` clean; `npx vitest run` → 159 Dateien / 2230 Tests;
`npm run test:goldenmaster` → 13 Pläne byte-identisch **ohne** Neuerfassung
(`safeText` ist join-kompatibel, die Render-Zeit-Abgleiche ändern keinen
Commit-Inhalt); `npm run test:regression` → 50 Tests.

### 2026-09-26 — Achte Fassung: Verbindungen, Domänen, Zahlen-Eingabe, Impressum (AUDIT V1/N2/S2/S4, A2)

Die restlichen Punkte des Dritt-Audits zu PR #451. Umgesetzt wurden sie in
diesem Branch **vor** T1 (siebte Fassung); das Ledger zählt die Reihenfolge der
Dokumentation, nicht die der Commits. Gemeinsames Muster der ersten vier: eine
Regel behauptete Strenge, während ihr Default „ja" sagte.

1. **V1 — Verbindungsregeln waren fail-open.** `isValidConnection` erlaubte
   alles, was keine der wenigen expliziten Negativregeln traf. Fünf messbare
   Folgen, alle durchgewinkt: Dachfenster → Batterie, unbekannter/fehlender
   Bauteiltyp → Batterie, Verbraucher → Batterie im fremden Modus,
   Batterie ‖ Batterie anderer Chemie, Self-Loop (Quelle = Ziel). Die Ursache
   war strukturell: Ein unbekannter Knoten lieferte über
   `getHandleDomain(undefined, …)` den Default `DC_12V` — „konservativ" heißt an
   dieser Stelle „dieselbe Domäne wie fast alles andere", die Domänen-Trennung
   konnte also nur greifen, wenn **beide** Endpunkte bekannt waren. Neu ist die
   Reihenfolge umgedreht: erst die Existenzfragen (zwei verschiedene, bekannte,
   im aktiven Modus verbindbare Endpunkte), dann die fachlichen Negativregeln —
   der Default ist NEIN. Deny-by-default braucht eine Liste dessen, was der
   Planer kennt; die liegt in `lib/domain/connectionPolicy.ts` und **nicht** in
   `components/registry/builtinComponents.ts`, weil `lib/` nach ARCH-001 nicht
   von `components/` abhängen darf. `connectionPolicy.test.ts` vergleicht die
   Tabelle in beide Richtungen gegen die Registry und gegen die deklarierten
   Node-Typen der App — eine dritte Kopie kann so nicht unbemerkt entstehen.
   Bewusst **erlaubt** bleibt `consumer → battery` gleichpolig: Das Modell kennt
   auf DC-Handles keine Quell-/Senken-Semantik, AutoWire erzeugt selbst
   `Schiene → Verbraucher` (Plus) und `Verbraucher → Schiene` (Minus-Rückleiter),
   und ein Verbot bräuchte ein Rollenmodell je Bauteiltyp — eine eigene
   Entscheidung, keine Nebenwirkung dieser Härtung (im Code als Modellgrenze
   dokumentiert).
2. **N2 — `handleDomain` kannte die Domäne Solar nicht.** Der Rückgabetyp war
   `'DC_12V' | 'AC_230V'`, Solar-Knoten liefen als `DC_12V`, während
   `getEdgeDomain` dieselbe Kante als `'Solar'` einstufte — zwei Wahrheiten über
   dieselbe Kante (gemessen: `solar/plus/source → handle=DC_12V, edge=Solar`).
   Neu: `HandleDomainValue = 'DC_12V' | 'AC_230V' | 'Solar'`,
   `SOLAR_NODE_TYPES = ['solar', 'roofSolar']` als eine gemeinsame Liste, und
   dieselbe Vorrangfolge Solar → AC → DC wie in `getEdgeDomain`. Handle- und
   Kanten-Sicht widersprechen sich nicht mehr; die Polarität kommt aus der
   Rollen-Tabelle, nicht aus einem Namens-Präfix.
3. **S2 — die Zahlen-Eingabe las einen Präfix.** `parseFloat("2,5")` ergibt `2`
   (Dezimalkomma ignoriert), `parseFloat("2.5mm")` ergibt `2.5` (Einheit
   verschluckt). In beiden Fällen meldete das Feld einen gültigen Wert, der ein
   anderer war als der getippte — bei Leitungsquerschnitten und
   Sicherungsströmen eine Unterdimensionierung mit dem Anschein von Korrektheit.
   Neu: `parseDecimalString` (`lib/units.ts`) liefert nur dann eine Zahl, wenn
   der **gesamte** Text eine Zahl ist, sonst `null`; `parseFloat`-Verhalten ist
   dort ausdrücklich verboten und begründet. Akzeptiert werden Dezimalkomma und
   -punkt, Tausenderzeichen (Leer, geschützt, schmal), Unicode-Minus (U+2212)
   und Vorzeichen — alles echte Copy-Paste-Eingaben aus Tabellenkalkulationen,
   kein Müll. Abgelehnt: `""`, `"abc"`, `"2.5mm"`, `"1,2,3"`, `"1.23.456"`,
   `"--1"`. `parseQuantity` liest unbekannte Werte (Formular, geladenes JSON,
   `node.data`) ausschließlich darüber.
4. **S4 — Kürzung galt als Tatsache.** Ganzzahlige Felder prüften mit
   `parseInt`: `"2.5"` wurde zu `2` gekürzt und als gültig gemeldet. Neu:
   `Number.isInteger`-Prüfung mit eigener Meldung, und `INPUT_ERROR_MESSAGES`
   ist die **eine** Quelle für UI und Tests (`required`, `invalidNumber`,
   `integerRequired`) — vorher standen dieselben Sätze als Literale in beiden,
   und ein Test konnte die Anzeige nicht von der Logik unterscheiden.
5. **A2 — axe-Ausschluss des Canvas: beantwortet, nicht offen.** Der Befund
   lautete, das Barrierefreiheits-Gate klammere mit `.react-flow` ausgerechnet
   die komplexeste Oberfläche aus. Sachstand: `builder.exclude('.react-flow')`
   gilt nur für `/elektrik-planung/`, nur dem Editor-Canvas, und ist sowohl im
   Spec-Header als auch an der Stelle selbst begründet — React Flow ist eine
   Zeiger-/Tastatur-Anwendung (Pfeiltasten-Verschieben, Verbindungsmodus) und
   kein Dokumenten-Fließtext; Dokumentstruktur-Regeln (z. B. `region` je
   verschachteltem Node-Element) beschreiben dort nicht das Bedienmodell. Die
   restliche Planer-Shell bleibt vollständig im Gate, alle vier geprüften Seiten
   laufen mit `wcag2a/aa` + `wcag21a/aa` und scheitern an `critical`/`serious`.
   Das Bedienmodell des Canvas ist davon unabhängig getestet:
   `components/planner/FlowCanvas.test.tsx` (ARIA-Status `aria-pressed` an den
   Umschaltern, `aria-label` an den Zeiger-Zielen, Katalog-Eintrag per Tastatur
   **und** Tap) sowie `components/planner/utils/flowInteraction.test.ts`
   (Interaktionen, die eine Hardware-Tastatur voraussetzen, sind auf Touch
   abgeschaltet statt unerreichbar). Keine Code-Änderung in dieser Fassung.
   FOLLOW-UP, falls gewünscht: ein eigenes axe-Regelprofil für den Canvas —
   das wäre eine neue Prüfung, nicht die Reparatur eines Gate-Lochs.
6. **Impressum-Placeholder — ein Ort für die Angaben, ein Wächter im Deploy.**
   Die Seite stand seit dem Relaunch als Placeholder im Baum (`Werft —
Projekt-Placeholder`, `kontakt@example.org`, „Bitte hier eintragen"), und
   nichts hat es gemeldet — dabei wird sie öffentlich ausgeliefert (Static
   Export auf GitHub Pages), und eine unvollständige Anbieterkennzeichnung ist
   nach § 5 DDG abmahnfähig. Erfinden lassen sich die Angaben nicht (ein
   erfundener Betreiber wäre schlimmer als ein Platzhalter: rechtswidrig **und**
   plausibel). Neu, dreiteilig:
   - `lib/siteLegal.ts` — die fünf Pflichtangaben als Daten, mit
     `LEGAL_PLACEHOLDER`-Marke und `missingLegalFields()`/`isProviderComplete()`.
     Ein halb ausgefülltes Impressum zählt als unvollständig, weil es
     vollständig aussieht und niemand mehr nachsieht (dasselbe Muster wie
     `ok-with-assumption` ohne Hinweis, AUDIT N1).
   - `app/impressum/page.tsx` zeigt die echten Angaben, sobald sie da sind, und
     bis dahin **zeichenidentisch** die bisherigen Aufforderungstexte — dieser
     Zweig ist Teil der eingefrorenen Pixel-Baseline
     (`tests/e2e/visual.spec.ts-snapshots/route-impressum-{light,dark}.png`),
     ein Textwechsel dort verschiebt das visuelle Gate und braucht UI-Freigabe.
   - `scripts/ci/verifyLegalNotice.ts` (`npm run ci:verify-legal-notice`) nennt
     die offenen Felder mit Bezeichner, Grund und Ort und läuft als Schritt im
     **Deploy**-Workflow (`deploy.yml`, Job `build`, nach `npm ci`, vor dem
     Build) — Meldung im Log, als Run-Annotation (`::warning`) und in der
     Step-Summary. Bewusst nicht im Quality Gate: Ein Pull Request ist keine
     Veröffentlichung.
     Stufe per Env: `LEGAL_NOTICE_GATE=warn` (Default, Betreiber-Entscheidung
     2026-09-26) meldet und lässt den Deploy laufen, `LEGAL_NOTICE_GATE=block`
     stoppt ihn bei offenen Angaben; ein unbekannter Wert fällt auf `warn`
     zurück **und sagt das** (keine stille dritte Stufe). Die Umschaltung ist
     getestet, `warn` ist also eine eingestellte Stufe und kein zahnloser
     Hinweis. Folge für den Betrieb: Der Deploy läuft, die öffentliche Seite
     zeigt bis zum Eintragen der Angaben ihre Platzhalter-Texte — und jeder
     Deploy-Lauf schreibt die fehlenden Felder in seine Zusammenfassung.
     FOLLOW-UP: Die sichtbaren Zitate lauten noch § 5 TMG und § 55 Abs. 2 RStV —
     gültig sind § 5 DDG (seit 05/2024) und § 18 Abs. 2 MStV. Die Korrektur
     ändert den gerenderten Text und damit die Pixel-Baseline; sie gehört
     zusammen mit dem Eintragen der Angaben in einen freigegebenen UI-Schritt
     (`npx playwright test tests/e2e/visual.spec.ts --update-snapshots`).

Begründung „bewusst besser, weil …": Vier der sechs Punkte waren dieselbe
Fehlerklasse wie die übrigen Audit-Befunde — eine Prüfung, die im Zweifel für
die Eingabe entscheidet (fail-open bei Verbindungen, Präfix-Lesen bei Zahlen,
Kürzen statt Ablehnen, Platzhalter ohne Meldung). Ein Planungswerkzeug, das
falsche Verbindungen erlaubt und „2.5mm" als 2,5 A liest, erzeugt keine
sichtbaren Fehler, sondern plausible falsche Pläne. Der Wächter fürs Impressum
ist deshalb im Deploy und nicht im Quality Gate verankert, weil nur dort aus dem
Mangel ein Rechtsrisiko wird — und weil ein Gate, das die Entwicklung blockiert,
abgeschaltet wird statt benutzt zu werden. Die Stufe des Impressum-Wächters ist
`warn` statt `block` — ebenfalls eine Betreiber-Entscheidung: Die fünf Angaben
kann nur er liefern, und ein Block würde die gesamte Veröffentlichung für ein
Dokument stoppen, das er selbst nachtragen muss. Sichtbar bleibt der Mangel
trotzdem an der Stelle, an der er zum Rechtsrisiko wird (Deploy-Run), und
`LEGAL_NOTICE_GATE=block` ist eine getestete Env-Variable entfernt.

Nachweis: `lib/connectionRules.test.ts` (V1: Self-Loop, unbekannter Typ,
Dachfenster → Batterie, fehlende Endpunkte, falscher Modus, Chemie-Parität zu
AUTO-003, Plus-Schiene ↔ Minus-Schiene, Polarität aus der Rollen-Tabelle) und
`lib/domain/connectionPolicy.test.ts` (Tabelle gegen Registry **und** gegen die
deklarierten Node-Typen, beide Richtungen), `lib/domain/handleDomains.test.ts`
(N2), `lib/units.test.ts` (S2/S4: locale-tolerant, aber streng — ganze
Eingabe oder `null`) und `components/ui/ValidatingInput.test.tsx` (S4: Kürzung
ist keine Tatsache; optionales Feld bleibt löschbar), `lib/siteLegal.test.ts` +
`scripts/ci/verifyLegalNotice.test.ts` (Prüflogik, Stufen-Umschaltung
`warn`/`block` inkl. unbekanntem Wert **und** Verankerung im Deploy-Workflow,
einschließlich der begründeten Abwesenheit im Quality Gate) +
`app/impressum/page.test.tsx` (beide Anzeige-Zweige, keine Marke im gerenderten
Text). **Hinweis zur Auslieferung (2026-09-26).** Zwei Änderungen dieses Branches
liegen als Patch bei (`workflow-changes.patch`) und sind im gepushten Baum
bewusst **nicht** enthalten: die Workflow-Schritte selbst
(`.github/workflows/quality.yml` für den Deploy-Trigger-Wächter, AUDIT T7, und
`.github/workflows/deploy.yml` für den Impressum-Wächter), ihre 1:1-Spiegelung
in `docs/ci/workflows/` und die beiden Wiring-Tests
(`scripts/ci/deployTriggerWiring.test.ts`, `scripts/ci/legalNoticeWiring.test.ts`).
Grund: Die GitHub-App des Agenten darf ohne `workflows`-Berechtigung keine
Workflow-Dateien pushen (`remote rejected`). Wäre nur ein Teil gepusht worden,
hätte die Spiegelungsprüfung (`scripts/ci/workflows.test.ts`) oder die
Wiring-Tests rot gestanden. Beide Wächter-Skripte selbst sind im Baum,
getestet und lokal lauffähig (`npm run ci:verify-deploy-trigger`,
`npm run ci:verify-legal-notice`); sie sind bis zum Anwenden des Patches nur
nicht im CI verdrahtet. `git apply workflow-changes.patch` stellt den
vollständigen Zustand her — Workflow, Spiegelung und Wiring-Tests zusammen,
der Baum ist davor und danach grün.

Gate (`npm run check` vollständig, plus Build): `npx eslint .` 0 Errors /
0 Warnings, beide `tsc`-Profile, `prettier --check`, `npx vitest run` →
162 Testdateien / 2249 Tests, Coverage-Schwelle `lib/**` gehalten
(Zeilen 98,3 %, Zweige 91,6 %, Funktionen 98,5 %, Statements 96,6 %; die neuen
Module `lib/siteLegal.ts`, `lib/safeText.ts`, `lib/domain/connectionPolicy.ts`
je 100 %), Golden Master 13 byte-identisch ohne Neuerfassung, Regression 50,
`npm run build` → 13 statische Seiten, `/impressum/` im gebauten HTML
unverändert und ohne Platzhalter-Marke.

### 2026-09-26 — Neunte Fassung: Darstellungs-Knoten sind kein Routing-Input (Bug „0 ↔ 20 Zwänge“)

Der Planer zeigte ein pendelndes Routing-Badge („Routing verifiziert“ ↔
„Routing: 20 Zwänge nicht erreicht“) und sichtbar neu verlegte Kabel. Kein
Timer, kein periodisches Auto-Wire — die Ursache lag in der Verbindung aus
React Flow, Node-Darstellung und Live-Router. Zwei Fehler griffen ineinander:

1. **Der Hauptstromkreis-Rahmen lief im Router mit.** `withBackboneGroup()`
   erzeugt einen Knoten `type: 'backboneGroup'` mit dem Kommentar
   „presentation-only“ — er landete aber als Prop in `<ReactFlow>`, damit in
   React Flows `nodeLookup`, und `CableRouteSync` las `[...nodeLookup.values()]`
   ungefiltert. Der Rahmen war damit Hindernis (`routeAllCables`) **und**
   Prüfgegenstand (`validateFinalRouting`). Er umschließt die Kern-Bauteile:
   Jede Leitung, die ein Kern-Bauteil verlässt, schneidet seinen Rand und
   zählte als I1 — obwohl kein Kabel durch ein Bauteil läuft. Das waren die 20.
2. **Seine Geometrie hing an der DOM-Messung.** React Flow 12 übernimmt einen
   Knoten nur bei **identischem** Objekt unverändert (`adoptUserNodes`,
   `checkEquality`); sonst baut es den internen Knoten neu auf und setzt
   `measured` auf den Wert des neuen Objekts — `undefined`, weil der Rahmen nie
   in den Planner-Store zurückgeschrieben wird. Der ResizeObserver maß danach
   erneut. 844 × 392 und der 192 × 120-Fallback sind zwei Hindernisbilder und
   damit zwei Validierungs-Reports: das sichtbare 0 ↔ 20. Dasselbe Muster traf
   auf Touch-Geräten **alle** Knoten, weil `interactiveNodes` bei jedem
   Store-Schreibvorgang neue Objekte erzeugte (`{ ...node, className }` bzw.
   `dragHandle`).

Behoben (ADR 0022, Rule P in `docs/ai/ARCHITECTURE-RULES.md`):

- **Grenze statt Konvention:** `components/edges/utils/routableNodes.ts`
  (`isPresentationOnlyNode` / `routableNodes` / `collectRoutableNodes`). Der
  Rahmen trägt `data.presentationOnly === true` **und** seinen UI-Typ, damit
  auch gespeicherte Pläne ohne Marker geschützt sind.
- **Filterung an der Grenze, nicht an der Aufrufstelle:** `routeAllCables`
  filtert seinen Eingang selbst, `computeCableRouteFinalValidation` ebenfalls;
  `CableRouteSync` filtert zusätzlich die Layout-Signatur (eine Änderung, die
  den Router nicht betrifft, darf keinen Lauf auslösen). `collidingNodeIds`
  nutzt jetzt dieselbe Grenze statt einer zweiten Kopie des Typs.
- **Identitätsstabilität als Vertrag:** `withBackboneGroup` liefert für
  unveränderte Kern-Geometrie dasselbe Rahmen-Objekt (Geometrie-Key-Cache) und
  trägt zusätzlich `width`/`height` — seine Box hängt nicht mehr an einer
  DOM-Messung. Die Interaktions-Flags (`planner-node-collision`,
  `node-drag-armed`, `dragHandle`) laufen über
  `components/planner/utils/nodeInteractionState.ts` (WeakMap-Cache): gleicher
  Basis-Knoten plus gleiche Flags ⇒ dasselbe Objekt.
- **Diagnose zuschaltbar:** `components/edges/utils/routingDebug.ts` schreibt
  pro Lauf Anzahl gerouteter/übersprungener Knoten plus die Änderung gegenüber
  dem vorherigen Lauf (`id x,y:B×H → x,y:B×H`, `—` = nicht gemessen). Aktiv mit
  `NEXT_PUBLIC_ROUTING_DEBUG=1` oder `globalThis.__PLANNER_ROUTING_DEBUG__ = true`;
  standardmäßig aus (Konsole bleibt still, `console.warn` als erlaubter Kanal).
- `nodeGeometry.ts` bekam `nodeGeometrySnapshot()` — die Diagnose liest
  Messwerte damit weiterhin ausschließlich an der Messgrenze
  (`app/handleGeometry.test.ts` verbietet Direktzugriffe).

Bewusst **nicht** angefasst: `performAutoWiring` (nachweislich nicht die
periodische Ursache) und der Routing-Algorithmus selbst. Der Perf-Ratchet
bleibt bei 60 ms (gemessen 41,7 ms, unverändert zum Stand davor); die
Golden-Master-Pläne und die Regressions-SVGs sind byte-identisch, der
`routing:audit` bleibt bei I1–I7 = 0 / fallback 0.

Nachweis: `components/edges/utils/routableNodes.test.ts` (Grenze, Identität,
`data.presentationOnly` nur bei `true`), `routeAll.test.ts` (derselbe Plan
routet mit und ohne Rahmen **identisch**; ein echtes Bauteil an derselben
Stelle ändert die Routen — Kontrollprobe), `cableRouteStore.test.ts` (der
Rahmen erzeugt keine I1-Verletzung und keine Signaturänderung; dieselbe Box als
Bauteil schon), `components/planner/utils/backboneGroup.test.ts` (gleiche
Geometrie ⇒ dasselbe Objekt), `nodeInteractionState.test.ts` (Flags erzeugen
höchstens eine Variante je Basis-Knoten), `routingDebug.test.ts` (Format inkl.
Erkennung „gemessen ⇄ nicht gemessen“, `app/handleGeometry.test.ts` weiter grün.

Gate (`npm run check` + Build): `npx eslint .` 0 Errors / 0 Warnings, beide
`tsc`-Profile, `prettier --check`, `npx vitest run` → 165 Testdateien /
2279 Tests, Golden Master 13 byte-identisch ohne Neuerfassung, Regression 50,
`npx tsx scripts/routing/audit.ts` I1–I7 = 0 / fallback 0,
`npm run perf:edge-routing` Live-Pfad 41,7 ms (≤ 60 ms).

### 2026-09-26 — Zehnte Fassung: Identität statt Neubau im Change-Pfad (Rule Q/R)

Nach der neunten Fassung blieb die Frage, **warum** der Rahmen überhaupt in zwei
Hindernisbildern existieren konnte. Die Antwort ist eine Eigenschaft des
Change-Pfads, nicht des Routers — und sie betrifft den ganzen Graphen:

1. **No-Op-Changes erzeugten neuen Zustand.** `applyNodeChanges`/
   `applyEdgeChanges` geben **immer** ein neues Array zurück, auch bei
   Änderungslisten ohne Treffer. Real gemessen: React Flow meldet über seinen
   ResizeObserver `dimensions`-Changes für **jeden** gemounteten Knoten — auch
   für den Darstellungs-Rahmen, den der Planner-Store nicht kennt. Die Liste
   lief durch `onNodesChange`, fand kein Element und wurde verworfen; übrig
   blieb eine neue Array-Referenz. Folge: jeder
   `usePlannerStore((s) => s.nodes)`-Konsument rendert (u. a. jede `CableEdge`),
   die identitätsgebundenen Caches (`getDerivedSystemState`, `getObstacleMap`,
   `CROSSING_BASE_CACHE`, Routing-Nachbarschaft) bauen sich neu auf, React Flow
   adoptiert die Nodes erneut. Nebenbei flackerte der Speicher-Indikator, weil
   er an genau diesen vier Array-Referenzen hängt.
2. **Anzeige-Transformationen bauten alle Elemente neu.** `focusHighlight`
   (Hover/Drag), `circuitTrace` (Strompfad) und `domainFilter` (Domänen-Filter)
   erzeugten per `{ ...node, className }` für **jedes** Element ein neues
   Objekt — bei jedem Render, und der Strompfad hängt an den Store-Arrays, also
   auch während eines Drags in jedem Frame. React Flow übernimmt einen Knoten
   nur bei **identischem** Objekt unverändert (`adoptUserNodes`,
   `checkEquality`); jede Kopie führt zum Neuaufbau **und zur Neuvermessung**.
   `circuitTrace` war zudem nicht idempotent: `[className, flag].join(' ')`
   hängte die Marke bei jedem Durchlauf erneut an (`… dim dim dim`).
3. **Messwerte wanderten in die Persistenz.** `partialize` schrieb `nodes` samt
   `measured`/`width`/`height`; `migratePlannerPersisted` nahm sie beim Laden
   zurück. Ein gespeicherter Messwert behauptet in der nächsten Sitzung eine
   Größe, die nie gemessen wurde: `fitView`/`translateExtent` starten mit dem
   alten Kasten, und bis der ResizeObserver korrigiert, routet der A*-Pass um
   eine Box, die es so nicht mehr gibt — dieselbe Fehlerklasse wie der Rahmen,
   der als „nicht gemessen" zwischen zwei Hindernisbildern pendelte.

Behoben:

- **Change-Handler schreiben nur bei Wirkung** (`store/slices/graphSlice.ts`,
  Helfer `sameElements`/`affectsStructure` in `store/slices/graphInternals.ts`):
  `if (!affectsStructure(changes) && sameElements(prev, next)) return state`.
  zustand 5 überspringt die Benachrichtigung, wenn der Zustand identisch ist —
  das ist der einzige vollständige No-Op. `add`/`remove` bleiben immer
  strukturell (ein `remove` für eine unbekannte ID räumt weiterhin verwaiste
  Kanten auf und schreibt History).
- **Darstellungs-Marken identitätsstabil und idempotent:**
  `components/planner/utils/classFlags.ts` (`hasClassFlag`, `addClassFlag`,
  `withClassFlag`) ist jetzt die eine Quelle für alle drei Transformationen
  (Fokus, Strompfad, Domänen-Filter) — Wortvergleich statt Substring, Marke
  genau einmal, sonst **dasselbe Objekt**.
- **Messwerte sind kein Planinhalt** (Rule R):
  `stripNodeMeasurement` in `store/slices/persistence.ts` entfernt
  `measured`/`width`/`height` beim Speichern **und** beim Laden
  (Copy-on-write, dieselbe Referenz wenn nichts zu entfernen ist);
  `initialWidth`/`initialHeight` bleiben, sie sind eine Nutzerangabe. Der
  Darstellungs-Rahmen ist davon nicht betroffen: er **berechnet** seine Box aus
  der Kern-Geometrie (`backboneGroup.ts`, Geometrie-Key-Cache) und trägt sie als
  `width`/`height` — genau deshalb darf er nicht von einer Messung abhängen.
  ⚠ `store/slices/persistence.ts` steht in `AGENTS.md` §6 unter „DO NOT TOUCH
  (nur mit Tests + expliziter Review)" — die Änderung ist testgedeckt
  (4 neue Tests) und hier begründet; sie braucht die explizite Review.

Bewusst **nicht** geändert: keine `useEffect`-Schleife und kein
`useMemo`/`useCallback`-Fehlgebrauch gefunden (die Kandidaten
`useViewportHelper`, `FlowCanvas`-Memos, `markErrorEdgesZIndex` geben bereits
stabile Referenzen zurück bzw. sind korrekt abhängig). `useReactFlow().setNodes`
/`setEdges` ruft der Planer nirgends auf; `'replace'`-Changes entstehen
ausschließlich in React Flows eigener Queue (`getElementsDiffChanges`) und
laufen durch denselben Handler. Kein sichtbares Verhalten ändert sich: gleiche
Klassen, gleiche Reihenfolge, gleiche Geometrie.

Nachweis (Rule Q/R): `store/slices/changeNoise.test.ts` (6 Tests: unbekannte
`dimensions`/`select`-IDs lassen Store-Objekt und Arrays identisch — auch für
Wasser; eine echte Messung schreibt `measured` **und** `width`/`height` und
lässt Geschwister identisch; `remove` für unbekannte ID bleibt strukturell und
schreibt History), `persistence.test.ts` (4 neue Tests „Messwerte sind kein
Planinhalt": Speichern, Laden aus Altbestand, `initialWidth` bleibt,
Wasser-Graph), `components/planner/utils/classFlags.test.ts` (4 Tests),
`focusHighlight.test.ts`, `circuitTrace.test.ts` (Identität + Idempotenz),
`domainFilter`-Suite weiter grün.

Gate: `npx vitest run` → 167 Testdateien / 2297 Tests, beide `tsc`-Profile,
`eslint`, `prettier`, Golden Master 13 byte-identisch, Regression 50,
`routing:audit` I1–I7 = 0 / fallback 0, `perf:edge-routing` 41,7 ms (≤ 60 ms).

### 2026-09-26 — Elfte Fassung: Auch Aktions-Pfade schreiben nur mit Wirkung (Rule Q, Nachtrag)

Der Sweep über alle Stellen, die Knoten-/Kantenobjekte neu bauen, fand drei
weitere Fälle derselben Fehlerklasse — diesmal in **Aktionen**, nicht in
Change-Handlern:

1. **`focusElement` („Beheben“ aus der Warn-Zentrale)** markierte jedes Element
   per `map((e) => ({ ...e, selected: … }))` neu. Ein Klick auf „Beheben“
   erzeugte damit für **alle** Knoten und Kanten neue Objekte; React Flow
   adoptierte und maß neu, die Layout-Signatur folgte mit einem weiteren
   Routing-Lauf. Zusätzlich galt `undefined !== false` als Änderung: Elemente
   ohne `selected`-Feld bekamen selbst dann ein neues Objekt, wenn gar keine
   Marke gesetzt war. Neu: `withSelection()` (fehlendes `selected` zählt als
   „nicht markiert“; gleiche Marke ⇒ dasselbe Objekt) und `keepIfSame()` für die
   unbeteiligten Listen; ist schon alles wie gewünscht (z. B. wiederholtes
   „Beheben“ an derselben Leitung), bleibt der Zustand unberührt.
2. **`deleteSelected` ohne Auswahl** schrieb einen Zustand samt **Undo-Schritt**
   für eine Löschung, die nie stattgefunden hat — der Nutzer drückt danach
   „Rückgängig“ und es passiert nichts. Jetzt: früher Ausstieg, wenn weder
   Knoten noch Kanten markiert sind.
3. **id-adressierte Daten-Aktionen** (`updateNodeData`, `handleChangeLength`,
   `-FuseSize`, `-FuseOffset`, `-FuseType`, `-AcProtection`) bauen ihre Listen
   über `map`/`filter`. Findet keine ID, entstand ein inhaltlich identisches
   Array — plus Snapshot. Neu: `withHistoryIfChanged` (`graphInternals.ts`)
   vergleicht den Patch elementweise per Identität und läuft nur bei echter
   Änderung in den normalen Pfad (Snapshot, `canUndo`). Der Validierungs-Zweig,
   der bei ungültigen Eingaben schon die **alte** Liste zurückgibt
   (AUDIT ELE-004/DOM-001/002), erzeugt damit ebenfalls keinen Phantom-Schritt
   mehr.

Nachweis (`store/slices/changeNoise.test.ts`, jetzt 15 Tests): wiederholtes
„Beheben“ desselben Knotens/der Leitung ⇒ Zustandsobjekt identisch; Fokus
markiert nur den Ziel-Knoten (unbeteiligte Knoten, Wasser-Graph und Kanten
bleiben dieselben Objekte); fremde Marke wird entfernt, ohne die übrigen
Elemente zu ersetzen; `deleteSelected`/`updateNodeData`/`handleChangeLength`
ohne Wirkung ⇒ Zustand identisch **und** `historyPast` unverändert; zwei
Kontrollproben (bekannte ID schreibt weiterhin mit Undo-Schritt; Löschen mit
Auswahl bleibt strukturell). Der Startzustand der Suite setzt jetzt auch
`selectedNodes`/`selectedEdges` zurück — vorher trug ein Test die Marke des
vorherigen weiter.

Gate: `npx vitest run` → 167 Testdateien / 2306 Tests, `npm run check` grün
(lint, prettier, beide `tsc`-Profile, Coverage).

### 2026-09-27 — Zwölfte Fassung: Prüfbericht-Meldungen ohne Widersprüche (UX-001-Nacharbeit)

Ein Nutzer schickte den Text der Warn-Zentrale und sieben Screenshots. Kein
Rechenfehler, aber vier Stellen, an denen die App sich selbst widersprach oder
etwas versprach, das es nicht gibt. Alle vier sind behoben, jede mit Test.

1. **Doppelte/erfremdete Einheiten.** `measuredValue` trägt die Einheit längst
   selbst („306 A“, „≈ 0,83 kA“, „70 mm²“), `unit` wiederholte sie — auf dem
   Bildschirm stand **„Ist: 306 A A“**. Der AC-Rumpf setzte `unit: 'Ω'` für
   _alle_ DOM-001-Befunde und hängte Ohm an einen Textwert: „Ist: LS C, 6 kA
   (Annahme) **Ω**“. Ebenso „Ist: maxPvVoltage fehlt **V**“, „2 × ohne Angabe
   **V**“, „kein FI **mA**“. Jetzt: `unit` nur bei echten Größen (AC-Familie
   bekommt Ω nur an den Zs-Befunden, kA am Reichweiten-Hinweis, sonst `''`), und
   die Anzeige hängt die Einheit nur an nackte Zahlen (neuer Export
   `valueWithUnit`).
2. **Falscher Lösungshinweis.** `nextStep()` prüfte
   `startsWith('solar-voc-window')` — das trifft auch
   `solar-voc-window-unknown-<id>`. Die Warnung „maximale PV-Eingangsspannung
   nicht eingetragen“ bekam damit die Anleitung „weniger Panels in Serie“.
   Reihenfolge ist jetzt Semantik (UNKNOWN zuerst) und für
   `thermal-overload`, `fuse-not-possible`, `cross-section-undersized`,
   `drop-not-solvable`, `solar-voc-uncomputable` und die beiden
   AC-Datenlücken gibt es eigene Hinweise.
3. **Empfehlung außerhalb der Normreihe.** Die thermische Überlast empfahl „den
   nächsten Normquerschnitt über 70 mm²“ — `VDE_SIZES` endet bei 70 mm²
   (Iz_design 120,4 A), die Stufe existiert im Modell nicht (dieselbe
   Ehrlichkeit, die schon `fuse-not-possible` hatte: Last aufteilen,
   parallellegen, 24/48 V). Gleiches im `drop-not-solvable`-Text.
4. **Zwei Zahlen, beide „kritisch“ genannt.** Das Abzeichen zeigte
   `warnings.length` mit dem Wort der schwersten Stufe („18 Kritisch“), während
   die Leiste darunter „14 kritische Probleme offen“ meldete. Jetzt nennt es die
   kritische Zahl vorn und die Gesamtzahl dahinter („14 von 18 kritisch“), und
   nur wenn nichts kritisch ist, steht dort die Gesamtzahl mit der Schwere-
   Wortwahl der schwersten Stufe; der `aria-label` trägt beide Zahlen.
   Dazu die Folge-Zeile: Datenlücken meldeten „Folge: Reichweite, Ladezeit oder
   Leistung können schlechter sein als erwartet“ (Kategorie `estimation`) — bei
   „AC-Schutzorgan ohne Datenblatt“ oder „MPPT-Eingangsspannung fehlt“ ist die
   zutreffende Folge „ungeprüft“ (`isUnverifiedFinding`, benannte Liste statt
   `missing`-Heuristik, damit „Sicherung fehlt“ weiter die Sicherheitsfolge hat).
5. **Chip-Widerspruch auf derselben Leitung.** Auf einer 70-mm²-Leitung mit
   100-A-Sicherung stand „Max: 100A“ neben dem Chip „Sicherung zu klein!“ —
   ohne Zahlen nicht von einem Widerspruch zu unterscheiden. Der Chip nennt
   jetzt beide Werte: „Sicherung zu klein (100A < 306A Last)!“.

6. **Handlungsanweisung ohne Handlung.** Das Routing-Badge riet im
   Schlechtfall: „Bitte Leitungen umlegen bzw. Abstände vergrößern.“ Seit
   ADR 0014 werden Kabel ausschließlich automatisch verlegt — es gibt keinen
   Griff, mit dem man eine Trasse von Hand verschiebt (im FlowCanvas ist nur
   `edgesFocusable` gesetzt, kein `onEdgeUpdate`/`reconnect`). Die erste
   Hälfte des Satzes war also nicht befolgbar. Der Hinweis nennt jetzt den
   echten Hebel: Bauteile mit mehr Abstand zueinander verschieben, danach
   läuft das Routing erneut. Die Zahl selbst („n Zwänge nicht erreicht“ =
   I1+I2+I3 aus `validateFinalRouting`) bleibt unverändert ehrlich; sie ist
   weiterhin eine Messung des letzten Laufs, keine Schätzung.

Bewusst **nicht** angefasst: das Strommodell. `calculateEdgeCurrent` schätzt die
Last auf Verteil-Leitungen weiterhin konservativ über die Plansumme (Fallback 6),
weil eine topologische Lastzuordnung das Strommodell, die AutoWire-Dimensionierung
und damit alle sieben Golden-Master-Fixtures ändert — das ist ein eigener
Change mit Recapture, nicht ein Begleitschaden einer Textkorrektur. Das Szenario
ist reproduziert und festgeschrieben (`useLiveValidation.test.ts`, „Prüfbericht:
3000-W-Wechselrichter an 12 V“): 3000 W / 12,0 V / 0,85 ≈ 294 A plus ~12 A
DC-Last = 306 A auf dem Batterie-Hauptstrang, 70 mm² (120,4 A) ⇒ Kaskade aus
„thermisch überlastet“ und „keine Normsicherung“ — arithmetisch korrekt, und ab
jetzt ohne die vier Widersprüche oben.

Nachweis: `components/planner/ui/WarningCenter.test.tsx` (17 Tests:
Wert/Einheit inkl. „306 A A“-Regression, Abzeichen-Zahlen, `nextStep`-Zuordnung,
`consequence`-Zuordnung, `valueWithUnit`), `useLiveValidation.test.ts`
(55 Tests: Einheiten-Disziplin der AC-Familie, `mixed-voltage-unknown`,
`thermal-overload`-Text, Bericht-Szenario), `CableEdge.test.tsx` (24),
`RoutingStatusBadge.test.tsx` (4, inkl. „keine Handlung ohne Handlungsmöglichkeit“)
und `store/usePlannerStoreExtended.test.ts` unverändert grün.

Gate: `npx vitest run` → 167 Testdateien / 2332 Tests, `npm run typecheck`,
`npm run typecheck:tests`, `npx eslint .`, `npx prettier --check` grün. Golden
Master und Regression unberührt (keine Geometrie, keine Dimensionierung, keine
Fixture berührt). Die 6 zusätzlichen Tests (5 in `lib/autoWire.test.ts`, 1 in
`store/usePlannerStoreExtended.test.ts`) gehören zur dreizehnten Fassung.

### 2026-09-27 — Dreizehnte Fassung: Auto-Wire lässt Nutzereingaben an seinen Kanten stehen (AUDIT D3)

Der Nutzer meldete: „wenn ich bei den 5 meter 2 meter eingebe und dann auto wire
drücke springt er wieder auf 5 meter zurück“. Kein Anzeigefehler:
`performAutoWiring` ersetzt bei jedem Lauf **seine** Kanten (Idempotenz) und baute
sie dabei mit den festen Planungslängen aus `addDcEdge` neu auf (Batterie→Schiene
0,2 m, Panel→Regler 5 m, Verbraucher 3 m). Jede Eingabe im Leitungs-Inspektor war
damit Wegwerfarbeit.

Die Reparatur folgt dem bestehenden Besitz-Vertrag (AUDIT D1/D2) und dehnt ihn
auf die Auto-Kanten selbst aus: Deren **Nutzerangaben** werden über die
Verbindung geschlüsselt (`connectionKey`, nicht die bei jedem Lauf neu vergebene
ID) in den nächsten Lauf übernommen.

- `length` — Tatsache der Verkabelung (wie `watts` am Verbraucher); sie fließt in
  die Neuberechnung ein, statt sie einzufrieren (kürzere Leitung darf den
  Querschnitt senken, längere ihn heben).
- `fuseOffset`, `fuseType`, `fuseBreakingCapacity`, `acProtection` —
  Datenblattwerte des Schutzorgans, die `applyFuseTypes` ohnehin als
  Nutzerangabe respektiert.
- Querschnitt, Sicherungsgröße und die Warnmarker bleiben berechnet — sonst
  würde „Automatisch verbinden“ nichts mehr nachrechnen; die Gegenprobe
  („0,5 mm² wird hochdimensioniert“) steht im Test.

Der D2-Migrationstest für Altpläne prüft den unverwechselbaren Inhalt jetzt am
Querschnitt statt an der Länge: Die Länge ist ab dieser Fassung kein Beweis für
„nicht ersetzt“ mehr.

Nachweis: `lib/autoWire.test.ts` (90 Tests; +5: eingegebene Länge überlebt den
Lauf, Länge wirkt auf die Dimensionierung, Querschnitt wird weiter gerechnet,
Schutzorgan-Daten überleben, unveränderte Auto-Kante behält ihre 5 m),
`store/usePlannerStoreExtended.test.ts` (59 Tests; +1: UI-Pfad verdrahten →
`handleChangeLength` → verdrahten). Beide Tests fallen ohne die Übernahme (in
einer Sitzung gegengeprüft).

Gate: `npx vitest run` → 167 Testdateien / 2332 Tests, `npm run typecheck`,
`npm run typecheck:tests`, `npx eslint .`, `npx prettier --check` grün. Golden
Master unberührt (keine Geometrie, keine Dimensionierung, keine Fixture trägt
eine abweichende Nutzerlänge ein).

### 2026-09-27 — Vierzehnte Fassung: Platzierung — vier Befunde an einem Symptom (AUDIT D4)

Der Nutzer meldete: „Der Router ist nicht das Problem — die Platzierung ist es.",

mit vier belegten Ursachen. Alle vier sind im Code bestätigt und behoben; der
A*-Router selbst blieb unangetastet (`npm run routing:audit`: I1–I7 = 0,
Fallback 0, größter Umweg-Faktor 1,65, keine 180°-Wenden).

1. **AutoWire setzte sein Raster absolut am Canvas-Ursprung**
   (`lib/autoWire/placement.ts`). Die automatisch erzeugten Bauteile (Schienen,
   Sicherungskasten, Shunt) standen deshalb unabhängig davon, wo der Plan des
   Nutzers lag, bei (0,0) — die Kabel folgten der Platzierung quer über die
   Karte (Nutzer-Messung: 12.512 px statt 704 px auf derselben Anlage).
   `flowAnchor()` nimmt jetzt die linke obere Ecke der nicht verschobenen
   Bauteile als Bezug und rundet sie auf das **globale** Spalten-/Zeilenraster
   (288/192) ab — dadurch ist die Rasterlage unabhängig von der
   Planposition (Determinismus, ADR 0010), und Pläne nahe dem Ursprung
   behalten exakt die bisherige Platzierung.
2. **ELK bekam die Token-Defaults 120 × 80 statt der gemessenen Kartengrößen**
   und schrieb sie anschließend als `width`/`height` auf die Knoten zurück
   (`lib/planner/routingV2Adapter.ts`). Folge: Karten überlappten nach „Plan
   ordnen", und der Router bekam zu kleine Hindernisboxen (Leitungen durch
   Karten). Der Adapter liest jetzt `node.measured` (React Flow 12 hält dort
   die gemessene Größe) und schreibt **nur noch Positionen** zurück.
3. **ELK bekam keine Ports** (`lib/planner/layout-engine/`). `buildElkGraph`
   setzt `elk.portConstraints: 'FIXED_ORDER'` nur, wenn ein Knoten Ports
   mitbringt — ohne sie durfte ELK Karten so anordnen, dass Leitungen an der
   falschen Kartenseite ankommen. `ports.ts` liefert die Anschlussseiten je
   Bauteiltyp (Eingänge WEST, Ausgänge EAST, `plus` vor `minus`,
   Wechselrichter-`ac_in` NORTH) samt **graphweit eindeutigen** Port-IDs; der
   Vertrag (`LayoutPort`, `sourcePort`/`targetPort`) ist dokumentiert und die
   Registry-Parität getestet.
4. **„Aufräumen" ignorierte die Kanten** (`components/planner/utils/layout.ts`).
   Die Typ-Stapelung bleibt Basis, aber der Planer prüft jetzt drei Varianten
   (Stapelung, Barycenter-Ordnung, Barycenter + Spalten-Versatz) und wählt die
   mit der kürzesten Kabellänge (Proxymaß). Gleichstand behält die bisherige
   Ordnung — das Aufräumen wird also nie schlechter als vorher.

**Messungen** (über `scripts/goldenmaster/pipeline.ts`, echter Router; sechs
Referenzpläne, Summe):

| Größe                                      | vorher    | nachher             |
| ------------------------------------------ | --------- | ------------------- |
| Kabelweg, Plan am Ursprung                 | 30.269 px | 30.269 px           |
| Kabelweg, derselbe Plan bei (1200, 800)    | 88.693 px | 29.789 px           |
| Final-Invariante I1/I2/I3, Plan verschoben | 4         | 0                   |
| Kabellänge „Aufräumen" (Proxymaß)          | 56.988 px | 48.228 px (−15,4 %) |

Überlappungen: 0 vor und nach dem Aufräumen. Der Nutzer-Fall (Karten relativ
zueinander verschieben) verliert damit die Positionsabhängigkeit der
Kabellänge vollständig.

Nachweis: `lib/autoWire/placement.test.ts` (17 Tests; +2: Auto-Bauteile folgen
einer Planverschiebung, kein Auto-Bauteil landet fernab des Plans — beide
fallen mit dem Ursprungs-Anker), `lib/planner/routingV2Adapter.test.ts`
(6 Tests; gemessene Maße 192/132 werden durchgereicht, keine Größe
zurückgeschrieben, Anschlüsse mit Seiten und `FIXED_ORDER` im ELK-Graphen,
echtes elkjs akzeptiert die Port-Verweise), `lib/planner/layout-engine/ports.test.ts`
(6 Tests; Registry-Parität, Seiten-Konvention, Eindeutigkeit der Port-IDs,
echtes elkjs dockt die Landstromleitung an der OBEREN und die AC-Leitung an
der RECHTEN Kante des Wechselrichters an), `components/planner/utils/layout.test.ts`
(10 Tests; +3: Kanten verkürzen die Kabellänge, keine Überlappung,
Determinismus). Alle vier Gegenproben sind in der Sitzung gefahren: ohne Fix
fällt jeweils genau der neue Test.

Gate: `npx vitest run` → 168 Testdateien / 2346 Tests, `npm run typecheck`,
`npm run typecheck:tests`, `npx eslint .`, `npx prettier --check` grün.

**Golden Master und Regression bleiben unberührt — kein Recapture.** Der neue
Anker rundet auf das globale Raster; die sechs Referenzpläne liegen bei
x ≥ 80, y ≥ 60, ihr Anker ist also weiterhin (0,0) und die Platzierung
identisch. Geprüft mit `npm run test:goldenmaster` (13/13) und
`npm run test:regression` (50/50) — die eingefrorene Wahrheit (AGENTS.md §6,
`knownPlans/*`, `scripts/goldenmaster/snapshots/*`,
`scripts/regression/__snapshots__/*`) blieb damit unverändert; eine
Neuerfassung nach AGENTS.md §5 Nr. 6 war nicht nötig.

### 2026-09-27 — Fünfzehnte Fassung: ELK-Kartenabstand, Beschriftung, sichtbare Kabellänge (ADR 0023)

Der Nutzer hat die Analyse der Vierzehnten Fassung präzisiert und dazu eigene
Messungen vorgelegt. Zwei davon sind bestätigt und haben die Richtung bestimmt:

- **Nicht das Raster ist der Hebel für die Router-Invarianten.** Fünf
  translationsinvariante Platzierungsvarianten zerbrachen jeweils I2/I3/I6, und
  „schon eine reine X-Verschiebung des Rasters erzeugt 12-px-Segmente“. Das ist
  nachgemessen und reproduziert: `acdc` liefert bei Δ(8, 8) ein 12-px-Segment
  (I6 + I7). Entscheidend ist der **relative** Versatz zwischen Auto-Raster und
  Karten, nicht die absolute Phase — eine **reine Übersetzung** des fertigen
  Layouts (Nutzer- und Auto-Knoten gemeinsam) um (8, 8), (13, 0) und (1200, 800)
  lässt I1–I7 auf allen sechs Referenzplänen bei **0**. Der Flow-Anker der
  Vierzehnten Fassung bleibt deshalb, aber seine Wirkung ist jetzt vermessen und
  begrenzt: Er beseitigt an jeder geprüften Planposition die **harten**
  Überdeckungen (Σ(I1..I3) vorher 5/3/4/2 bei Δ(296,196)/(600,400)/(1200,800)/(2400,0)
  → **0**) und senkt den Kabelweg um bis zu 68 % (102.837 → 32.610 px); er macht
  die Platzierung **nicht** invarianter als das Raster erlaubt (Σ Qualitätsmeldungen
  I4–I7 25 → 24, in Einzelpositionen beidseitig).
- **Der Hebel ist die ELK-Fütterung.** Korrekt gefüttert ist ELK über 2–44 %
  kürzer (gleiche Metrik `routeAllCables`) — simple 2.697 → 2.520 px · camper
  3.805 → 3.734 · solar 3.200 → 2.496 · inverter 3.888 → 2.188 · acdc 5.770 →
  4.557 · complex 10.909 → 7.470 (Σ 30.269 → 22.965 px, −24 %).

Drei Lücken sind geschlossen, eine ist dokumentiert:

1. **ELK bekam für den Kartenabstand seinen Default (~10 px)** statt der
   Port-Freigabe (ROUTE-BUG-32 = `stubMin + laneGrid + cableClearance` = 52 px).
   Der Wert ist jetzt ein Token (`ROUTING_TOKENS.portFacingClearance`, ADR 0023),
   `PORT_FACING_CLEARANCE` liest ihn nur noch, und `generateElkLayoutOptions`
   setzt `spacing.nodeNode` sowie `spacing.nodeNodeBetweenLayers`. Gemessen über
   die sechs Referenzpläne (ELK-Platzierung + echter Router):

   | ELK-Abstand   | I1  | I2  | I3  | Σ   | Kabelweg  |
   | ------------- | --- | --- | --- | --- | --------- |
   | ELK-Default   | 3   | 21  | 17  | 41  | 18.431 px |
   | Port-Freigabe | 0   | 9   | 1   | 10  | 22.965 px |

   I1 fällt auf 0, I3 von 17 auf 1; der längere Weg ist der Preis dafür, dass
   zwischen zwei Karten überhaupt verlegt werden kann. Nachweis:
   `lib/planner/layout-engine/elkSpacing.test.ts` (echtes ELK, misst den
   Kartenabstand; Gegenprobe ohne Option: `Kartenabstand 20 px < Port-Freigabe
52 px`), `lib/routing/tokens.test.ts` (Token-Summe + Options-Generator).

2. **Die Kabelbeschriftung lag auf fremden Karten.** `edgeLabelNudge` trennt nur
   Labels desselben Kantenpaars; der Anker war der Trassenmittelpunkt. Gemessen
   über die sechs Referenzpläne: **17 Beschriftungen auf fremden Karten**. Neu:
   `labelAnchorClearOfNodes` sucht entlang der Leitung den nächstgelegenen freien
   Punkt (Label-Box 112 × 28 px); Ergebnis **0**. Bleibt keine freie Stelle, bleibt
   der Mittelpunkt — ein verdecktes Label ist besser als eines ohne Bezug.
   Nachweis: `components/edges/utils/routeAll.test.ts` (4 neue Tests, u. a. der
   Sechs-Plan-Lauf; Gegenprobe ohne den Fix: 17 Fundstellen).
3. **Die Kabellänge stand in keinem Bericht.** `routingQuality.ts` misst den
   Legacy-Router (LEGACY L-1), der Umweg-Faktor ist gegen die Platzierung blind —
   ein Plan mit 14.752 px Kabelweg blieb grün. Jetzt führt
   `npm run routing:audit` die Spalten `Kabelweg`/`laengste`, und
   `scripts/routing/cableLength.test.ts` hält die absolute Länge je Referenzplan
   als Ratchet plus die Positionsunabhängigkeit (±15 %; mit dem Flow-Anker
   Σ 29.789 px gegenüber 30.269 px am Ursprung, ohne ihn fällt der Test).

**Dokumentiert statt versteckt:** `ROUTE-006` (`docs/ai/KNOWN-PROBLEMS.md`) hält
die Restfehler fest — kurze Segmente bei verschobenen Plänen (keine Überdeckung)
und die 9 I2 + 1 I3 der ELK-Platzierung (Trassenüberdeckungen, überwiegend am
gemeinsamen Port). Nebenbei korrigiert: `ROUTING-CONTEXT.md` verwies für die
Domänen-Trennregeln auf ein nicht existierendes `ROUTE-005` — der Eintrag heißt
`ROUTE-003`.

Gate: `npx vitest run` → 170 Testdateien / 2359 Tests, `npm run typecheck`,
`npm run typecheck:tests`, `npx eslint .`, `npx prettier --check` grün.

**Golden Master und Regression bleiben unberührt — kein Recapture.** Der
Kartenabstand wirkt nur im ELK-Pfad („Plan ordnen"), die Beschriftung ist reine
Darstellung, und der Flow-Anker liefert am Ursprung exakt die eingefrorene
Platzierung (Anker (0,0) für alle sechs Pläne). Geprüft mit
`npm run test:goldenmaster` (13/13) und `npm run test:regression` (50/50).

### 2026-09-27 — Sechzehnte Fassung: Rollen-Schichten als ELK-Nebenbedingung + Kreuzungs-Ratchet (ADR 0024)

Der Nutzer hat die nächsten zwei Punkte priorisiert (P1): die fachliche
Rang-Logik als ELK-Nebenbedingung einspeisen und die Kreuzungszahl dauerhaft
begrenzen.

1. **Rollen-Schichten erreichen ELK (ADR 0024).** Die fünfstufige Rangfolge
   (Quelle → Wandler → Verteilung → Wechselrichter → Verbraucher) lebte nur im
   UI-Aufräumen; `ElkLayoutEngine` setzte alle Knoten auf `x = 0` und ließ ELK
   allein nach Kreuzungsminimum legen. Jetzt lebt die Rang-Tabelle in
   `lib/planner/layout-engine/ranks.ts` (das Aufräumen importiert sie — eine
   Wahrheit), `ElkPlan.ranked` wählt `generateElkRankedOptions`
   (`layering.strategy: INTERACTIVE`, `considerModelOrder.strategy:
PREFER_EDGES`) und `LAYOUT_TOKENS.rankSpacing` ist der Seed:
   `x = Rang × rankSpacing`. Gemessen über die sechs Referenzpläne
   (ELK-Platzierung → Produktiv-Router → Kreuzungen):

   | Optionen                                        | Σ Kreuzungen     |
   | ----------------------------------------------- | ---------------- |
   | ohne Rang-Seed (vorher)                         | 41               |
   | `interactive` mit `semiInteractive`             | 44               |
   | `interactive` ohne `semiInteractive`            | 47               |
   | layering INTERACTIVE + `PREFER_EDGES` (gewählt) | **36**           |
   | gewählt + `y`-Seed (Index bzw. Ist-Position)    | 36 (wirkungslos) |

   Im Produktivpfad (`applyAdvancedLayout` → `routeAllCables` → Kreuzungen)
   sinkt die Summe **42 → 34**: solar 3 → 0 · complex 17 → 11 · camper 6 → 4 ·
   acdc 8 → 6, dazu simple 4 → 5 und inverter 4 → 8. Die Summe sinkt deutlich,
   einzelne Pläne werden um wenige Kreuzungen schlechter — die Ratchet steht
   deshalb auf dem gemessenen Stand nach dieser Änderung (kein Wunschwert).
   `semiInteractive` bleibt aus, weil es die Reihenfolge innerhalb der Schicht
   einfriert und die Minimierung aufhebt (Σ 36 → 44, gemessen).

2. **Kreuzungen sind ab jetzt eine Grenze.** `npm run routing:audit` führt je
   Plan eine Ratchet (`CROSSING_RATCHET`, Stand der Messung: simple 2 · camper 5
   · solar 2 · inverter 2 · acdc 8 · complex 29); Überschreitung ⇒ Exit 1,
   Unterschreitung ⇒ Nachzieh-Hinweis. Die Audit-Zahlen selbst sind unverändert
   — sie messen den AutoWire-Pfad, der ELK-Pfad ist nicht Teil des Audits. Die
   Test-Ratchet für beide Router-Pässe existierte bereits
   (`lib/routing/invariants.test.ts`).

3. **Die Kabellänge ist messbar.** `npm run routing:audit` zeigt je Plan `Kabelweg` und
   `laengste` Leitung, `scripts/routing/cableLength.test.ts` hält die ABSOLUTE Länge je
   Referenzplan als Ratchet (plus Positionstest ±15 %; gegen die alte Platzierung fällt er).
   Vorher maß nur `routingQuality.ts` — und zwar den Legacy-Router, weshalb der Nutzerfall
   („alles grün bei 14.752 px“) durch jedes Gate fiel.

Nachweis: `lib/planner/layout-engine/rankLayers.test.ts` (4 Tests:
Rang-Tabelle, Einheit mit dem Aufräumen, x-Seed + Optionen im ELK-Graphen,
echtes ELK hält Quelle < Speicher < Wechselrichter < Verbraucher),
`lib/routing/tokens.test.ts` (+1: die gerankten Optionen enthalten
`INTERACTIVE`/`PREFER_EDGES`, aber kein `semiInteractive`).

**Nicht in dieser Scheibe (P2, bewusst offen):** die vollständige Anbindung
des Kostenmodells (`ROUTE-002`: `segmentExtraCost`/`preferredLaneBonus` haben
weiterhin nur Test-Konsumenten) und das Rest-I2 der ELK-Geometrie
(`ROUTE-006`, Zielbild `LaneRegistry`, `ROUTE-001`). Beide ändern die
Produktiv-Geometrie und damit die eingefrorene Wahrheit
(`knownPlans/*`, `scripts/regression/__snapshots__/*`) — das ist ein eigener,
einzeln begründeter Recapture-Schritt nach AGENTS.md §5 Nr. 6, kein Beifang.

Gate: `npx vitest run` → 171 Testdateien / 2364 Tests, `npm run typecheck`,
`npm run typecheck:tests`, `npx eslint .`, `npx prettier --check` grün.

**Golden Master und Regression bleiben unberührt — kein Recapture.** Der
Rang-Seed wirkt ausschließlich im ELK-Platzierungspfad; die Referenzpläne
laufen ohne ELK. Beide Suiten sind Teil des vollen Laufs
(`npm run test:goldenmaster` 13/13, `npm run test:regression` 50/50).

### 2026-09-27 — Siebzehnte Fassung: Kantenkosten kommen aus dem Kostenmodell (ROUTE-002, Teil 1)

Die beiden Nutzer-Prioritäten P1 (Rollen-Schichten, Kreuzungs-Ratchet) sind in
der Sechzehnten Fassung erledigt. In derselben Scheibe ist der erste Teil des
P2-Punkts `ROUTE-002` gefolgt: Der Produktivrouter optimiert „knick- und
kreuzungsarm“ — die Preise dafür standen aber als lokale Konstanten in
`components/edges/utils/pathfinding.ts` (`BEND_COST = 80`, `U_TURN_COST = 400`),
während nur die Kreuzung (`COST_WEIGHTS.crossing = 120`) aus dem generierten
Kostenmodell kam.

1. **Das Modell ist die Quelle.** `CostWeights` hat jetzt `bend` und `uTurn`,
   `COST_FACTORS` die Ableitungen `bendPerLaneGrid: 5` und
   `uTurnPerLaneGrid: 25`. `pathfinding.ts` liest sie:
   `BEND_COST = COST_WEIGHTS.bend`, `U_TURN_COST = COST_WEIGHTS.uTurn`. Die
   Werte sind **wertgleich** zu den bisherigen Hardcodes (5 × 16 = 80,
   25 × 16 = 400; die Kehre bleibt so teuer wie eine Clearance-Verletzung) —
   Golden Master und Regression bleiben deshalb unberührt, **kein Recapture**.
   Damit ist auch der ROUTE-004-Rest „`BEND_COST`/`U_TURN_COST` außerhalb der
   Tokens“ geschlossen; offen bleiben nur `MAX_EXPANSIONS` (Suchbudget) und
   `MAX_ACCEPTABLE_CROSSINGS` (Abbruchschwelle) — beides keine Preise.

2. **Die verbleibende Hälfte ist vermessen, nicht vergessen.** `segmentExtraCost`
   und `preferredLaneBonus` haben weiterhin keinen Produktiv-Konsumenten. Die
   Messung über die sechs Referenzpläne (Produktivpfad, geroutete Trassen,
   Paare **verschiedener** Kanten) zeigt, warum ein Anschließen kein Stecker
   ist:

   | Klasse                        | Paare | Bedeutung im Bestand                                   |
   | ----------------------------- | ----- | ------------------------------------------------------ |
   | `hard` (kollinear)            | 47    | **alle** Port-Bündel-Ausnahme (ADR 0009), echte I2 = 0 |
   | `weighted` (Touch/Clearance)  | 82    | Port-Nähe, kein Verstoß                                |
   | `nearby` (< Clearance + Lane) | 121   | gewollte Bündel-Lanes (16-px-Raster)                   |
   | `soft` (Kreuzung)             | 48    | exakt die Audit-Kreuzungen (2/5/2/2/8/29)              |

   Ein blindes `hard ⇒ Infinity` würde 47 legitime gemeinsame Stubs als
   unmöglich verwerfen; `nearbyLane` (16 px je Paar) würde gegen die bewusst
   gebündelten Trassen drücken. Vor dem Produktiv-Einsatz muss die
   Stub-Kenntnis des Nachbarn in das Modell (die Ausnahme lebt heute in
   `checkEdgeEdgeOverlaps`, `lib/routing/invariants.ts`), der Lane-Bonus
   braucht die LaneRegistry (`ROUTE-001`). Beides steht als Teil 2 in
   `KNOWN-PROBLEMS.md` (`ROUTE-002`) und ist bewusst **nicht** Teil dieser
   Scheibe: es ändert die Produktiv-Geometrie und braucht einen eigenen,
   einzeln begründeten Recapture-Schritt (AGENTS.md §5 Nr. 6).

Nachweis: `lib/routing/rules/costModel.test.ts` (20 Tests — u. a.
Faktor-Ableitung für `bend`/`uTurn`, Ordnung Kehre > Kreuzung > Biegung >
Nah-Lane und die Abgrenzung zur Port-Bündel-Ausnahme) und
`components/edges/utils/pathfinding.test.ts` (51 Tests — Sync von
`BEND_COST`/`U_TURN_COST` mit dem Modell).

Gate: `npx vitest run` → 171 Testdateien / 2369 Tests, `npm run typecheck`,
`npm run typecheck:tests`, `npx eslint .`, `npx prettier --check` grün.
