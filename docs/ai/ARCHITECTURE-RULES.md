# ARCHITECTURE-RULES

Verbindliche Schichtenregeln für CAMP. **Autorität:** dieses Dokument beschreibt die Regeln;
die _Durchsetzung_ liegt in ausführbaren Tests. Eine Regel ohne Test ist eine Konvention und
ist unten als solche markiert.

Regeln aus den ADRs (`docs/adr/`) sind hier nur aufgenommen, wenn sie auch **umsetzbar und
eingehalten** sind. Wo Code und ADR auseinanderlaufen, steht das in
[KNOWN-PROBLEMS.md](./KNOWN-PROBLEMS.md).

---

## A. Schichten

```
app/          Seiten (Next App Router)      – darf alles unten importieren
components/   UI + React-Flow-Adapter       – darf lib/ und store/ importieren
store/        Zustand-Store, Persistenz     – darf lib/ importieren
lib/          Domäne: Electrical, Routing,  – darf NUR lib/ importieren
              AutoWire, Units
```

### Rule A — `lib/` importiert keine App-Schicht. **(erzwungen)**

`lib/**` (Produktivcode, ohne `*.test.ts`) darf nicht aus `components/`, `store/`, `app/`
oder `benchmarks/` importieren.

- Datei: `lib/domain/graph.ts`, `lib/domain/cableEdgeData.ts` sind die Typ-Grenze.
- Test: `scripts/architecture/libBoundary.test.ts`
- Allowlist: **leer** und soll leer bleiben. Jeder neue Eintrag braucht Begründung + Heilungspfad.
- Grund: ADR 0008. Historisch importierte `lib/` React-Flow- und Komponententypen; das wurde
  aufgelöst (ARCH-001).

### Rule B — Domänenlogik kennt kein React. **(erzwungen Teil / Konvention)**

- `lib/**` läuft ohne React zur Laufzeit (Golden-Master-Pipeline, Skripte).
- React-Flow-Typen dürfen in `lib/` **nicht** vorkommen; die strukturell kompatiblen
  Ersatztypen stehen in `lib/domain/graph.ts`.
- Umgekehrt gilt: UI darf `lib/` benutzen, aber **keine** elektrische Berechnung selbst
  implementieren.

### Rule C — Routing verändert keine elektrische Semantik. **(Konvention, testgestützt)**

Der Routing-Pass schreibt ausschließlich Geometrie (`PathResult` im Route-Cache).
`edge.data.crossSection`, `fuseSize`, `edgeDomain`, `length` werden von AutoWire/Sizing
geschrieben — **nie** vom Router.

- Testgestützt: `scripts/goldenmaster/goldenMaster.test.ts` friert `electrical` getrennt von
  `routing` ein.
- Ausnahme (bewusst, READ-ONLY): `routePlan` **liest** `edge.data.edgeDomain`, `crossSection`
  und `locked` für die Hop-Priorität (`lib/routing/rules/hopping.ts`).

### Rule D — UI implementiert keine elektrischen Berechnungen. **(Konvention)**

Alle elektrischen Werte kommen aus `lib/units.ts`, `lib/electrical.ts`, `lib/vde-standards.ts`,
`lib/solar.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`, `lib/autoWire/sizing.ts`.
Anzeige-Helfer (`components/edges/utils/voltageDrop.ts`,
`components/planner/utils/voltage.ts`) dürfen **nur** delegieren.

### Rule E — Keine relevante Routing-Zahl außerhalb der Tokens. **(testgestützt)**

Routing-Abstände, Fallback-Geometrie, A*-Kostenlimits, Suchbudgets und das lokale
Hindernisfenster kommen aus `lib/routing/tokens.ts`.

- Erzwungen: nur `lib/routing/tokens.ts` definiert `cableClearance` als Zahl
  (`scripts/routing/architecture.test.ts`).
- Erzwungen: Router-Konstanten sind Re-Exports bzw. Ableitungen der Tokens
  (`lib/routing/tokens.test.ts`).
- Fachliche Gewichte bleiben im Cost Model (`COST_FACTORS`), weil sie keine
  Geometrie-Tokens sind.
- Layout-Tokens (`lib/planner/layout-engine/tokens.ts`) **leiten ab**, sie definieren nicht.

### Rule F — Sicherheit hat Vorrang vor Schönheit. **(Konvention, testgestützt)**

Rangfolge der Garantien im Router (wörtlich aus `components/edges/utils/pathfinding.ts`,
`searchOnce`):

1. volle Bauteil-Freigabe + Trassensperre
2. volle Freigabe ohne Trassensperre
3. gelockerte Freigabe („Stub-Recht“) + Trassensperre
4. gelockerte Freigabe ohne Trassensperre

Zwei Kabel auf einer Trasse (I2) sind ein Schönheitsfehler; ein Kabel am Bauteil (I3) ist ein
Regelverstoß. Deshalb: **I3 schlägt I2.**

---

## B. Eine Quelle je Zuständigkeit

### Rule G — Eine Quelle für Kabelgeometrie. **(erzwungen, ADR 0014)**

Der Renderer bezieht seine Polyline **ausschließlich** aus dem zentralen Routing-Orchestrator
`routePlan()` über `useCableRoute()`. `routeAllCables()` ist nur der typisierte Map-Kompatibilitätsadapter
für ältere Skripte/Tests; er enthält keine zweite Routinglogik.

- `routePlan()` ist der Produktionsvertrag: Normalize → Route → Hopping → Geometry Normalization
  → Final Validation → Return (`{ routes, validation }`).
- React-Flow-Komponenten dürfen keine Route berechnen. Fehlt im Adapter ein veröffentlichter
  Plan, ist der Renderzustand leer; es gibt keinen lokalen Einzelkanten-Fallback.
- Verboten: Produktionscode liest `edge.data.geometry`
  (Test: `scripts/routing/architecture.test.ts`).
- `lib/planner/routing-v2/` und `lib/planner/routing-core/` sind **gelöscht** und dürfen
  nirgends importiert werden (Test wie oben).
- `lib/planner/routingV2Adapter.ts` darf **Knotenpositionen** erzeugen, aber keine Kabelgeometrie.

### Rule H — Eine Quelle für Kollision und Abstand. **(erzwungen, ADR 0015/0019)**

Kollisionsurteile entstehen in `lib/routing/rules/collision.ts` (`classifyCollision`,
`classifySegmentAgainstNode`, `classifySegmentAgainstSegment`).

- `lib/routing/invariants.ts` (I1/I2/I3) und `lib/routing/finalValidation.ts` leiten ihre
  harten Urteile daraus ab — sie besitzen **keine** eigene Abstandsdefinition.
- `RoutingDomain` wird im Orchestrator aus dem Planner-/Hop-Domain-Metadatum abgeleitet;
  `checkDomainClearance()` und `segmentExtraCost()` rufen für Domänenpaare dieselbe
  `classifyDomainAwareSegments()`-Regel auf.
- Der A*-Innenloop (`pathfinding.ts`) nutzt das billigere äquivalente `segmentHitsRect`
  (Performance); die eine materielle Begriffsquelle bleibt das Modell.

### Rule I — Kollision ist verboten, nicht teuer. **(erzwungen)**

`overlap` im Kostenmodell ist `Infinity`. Eine endliche Zahl als Kollisionsgewicht ist ein
Fehler und bricht den Test (`scripts/routing/architecture.test.ts`).
Begründung: „sehr teuer“ lässt sich überstimmen, `Infinity` nicht. Echte Kreuzungen bleiben
`soft`: erlaubt, aber im Primärscore kostenpflichtig; sie erzeugen keine elektrische Verbindung.

Das vollständige `segmentExtraCost`-Modell wirkt produktiv: Overlap/Domain-Clearance
entscheidet hart; soft/weighted/nearby-Kosten entscheiden nach der geometrischen
Basisfunktion bei Gleichstand. Dadurch beeinflusst das Modell reale Kandidaten, ohne die
historisch verifizierte Route wegen einer rein sekundären Qualitätsdifferenz umzuschreiben.

### Rule J — LaneRegistry ist eine deterministische Produktionspräferenz. **(testgestützt)**

`routePlan()` baut vor der Kandidatenwahl aus `LaneRegistry` eine stabile Korridorpräferenz.
Die Sortierung ist `topologicalOrder → targetPosition → edgeId`; Render-/Array-Reihenfolge und
Zufall dürfen keine Lane-Zuordnung beeinflussen. Port-Fan-Out und Korridor-Lane sind getrennte
Regeln. Test: `components/edges/utils/routeAll.test.ts` (inklusive 100 permutierter Läufe).

### Rule K — Eine elkjs-Anbindung, gebündelt. **(erzwungen, ADR 0016)**

`elkjs` wird ausschließlich von `lib/routing/elk/runner.ts` geladen, und nur als
`elkjs/lib/elk.bundled.js` (die ungebündelte Variante verlangt `web-worker` und bricht den
Dev-Server). Alle anderen Layout-Pfade gehen über `layoutWithElk()` /
`lib/planner/layout-engine/elk.ts`.

---

## C. Verhalten

### Rule L — Routing ist deterministisch. **(erzwungen, ADR 0010)**

Gleiche Eingabe ⇒ byte-identisches Ergebnis. Tie-Breaker ist immer die Edge-ID
(`String.localeCompare`), niemals `Math.random()`, niemals Objekt-Identität.

Belege: `scripts/goldenmaster/goldenMaster.test.ts` (Doppellauf byte-identisch),
`scripts/regression/regression.test.ts` (Szenarien 13–15: Drag/Undo-Redo/Pass-Wechsel),
`npm run routing:audit` (Spalte `determ`).

### Rule M — Crossings sind erlaubt, Overlaps sind verboten. **(erzwungen, ADR 0009)**

- `edge × edge` **echte Kreuzung** → Klasse `soft` → Kosten, nicht Verbot.
- `edge × edge` **kollineare Überdeckung** → Klasse `hard` → Verbot.
- `edge × node` → Klasse `hard` → Verbot.
- Touch (Berührung ohne echte Kreuzung) ist **kein** Overlap und **kein** Crossing.

Quelle: `lib/routing/rules/collision.ts`.

### Rule N — Kein stiller Fallback bei sicherheitskritischen Werten. **(Konvention, testgestützt)**

- `lib/units.ts` **wirft** (`RangeError`/`TypeError`) statt 0 einzusetzen.
- Unbekannte/fehlende Elektro-Daten werden als **offen gemeldet**, nicht geschätzt
  (z. B. „Abschaltvermögen unbekannt“ statt „passt schon“).
- Routing-Ausnahmen werden **sichtbar gemacht** (`PathResult.fallbackHitsObstacles`,
  `PathResult.tightMarginUsed`) statt verworfen.

### Rule O — Ungültige Daten sind kein gültiger Zustand. **(Konvention)**

`lib/nodeSchema.ts` + `store/slices/persistence.ts`: bekannte Felder mit falschem Laufzeit-Typ
werden **entfernt** (nicht durch 0 ersetzt); unbekannte Felder bleiben erhalten.

---

## D. Arbeitsregeln ohne Test-Gate (Konventionen)

| ID  | Regel                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-1 | Kein `any`, kein `@ts-ignore`, kein `as unknown as` als Dauerzustand.                                                                                            |
| O-2 | Neue Konstante mit physikalischer/geom. Bedeutung gehört in `lib/routing/tokens.ts` (Routing) bzw. neben ihre Normtabelle (Electrical) — nie inline ins Modul.   |
| O-3 | Jeder Bugfix braucht einen Regressionstest; jede Verhaltensänderung einen Ledger-Eintrag (`docs/ARCHITECTURE-CHANGES.md`).                                       |
| O-4 | Keine Tests löschen oder abschwächen, damit CI grün wird. Baselines nur senken, wenn der Plan **messbar besser** wird — mit Begründung.                          |
| O-5 | TODOs tragen ein Area-Tag: `TODO[ROUTING]:`, `TODO[ELECTRICAL]:`, `TODO[UX]:`, `TODO[PERF]:`. Nackte `TODO` sind unzulässig. (Derzeit: **keine** TODOs im Code.) |

---

## E. Prüfbefehle je Regel

| Regel           | Befehl                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| A               | `npx vitest run scripts/architecture/libBoundary.test.ts`                                              |
| E, G, H, I, J   | `npx vitest run scripts/routing/architecture.test.ts`                                                  |
| E (Werte/Drift) | `npx vitest run lib/routing/tokens.test.ts`                                                            |
| K, L            | `npm run test:goldenmaster` · `npm run test:regression` · `npm run routing:audit`                      |
| M               | `npx vitest run lib/routing/rules/collision.test.ts` · `npx vitest run lib/routing/invariants.test.ts` |
| F               | `npm run routing:audit` (Spalten I1–I3, fallback)                                                      |
