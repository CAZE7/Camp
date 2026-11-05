# Architektur-Regeln — Camp (verbindlich)

**Stand:** 2026-11-04  
**Status:** Verbindlich für alle Entwickler und KI-Agenten  
**Autorität:** Dieses Dokument beschreibt die Regeln; die Durchsetzung liegt in ausführbaren Tests. Eine Regel ohne Test ist eine Konvention und wird als solche markiert.  
**Basis:** Baut auf `docs/ai/ARCHITECTURE-RULES.md` (Regeln A–N, aus ADRs übernommen) auf und ergänzt sie um sicherheitsrelevante, daten- und prozessbezogene Regeln.  
**Verweis:** `docs/architecture/SYSTEM-ARCHITECTURE.md` (Schichtenmodell), `docs/engineering/ENGINEERING-CONSTITUTION.md` (Constitution).

---

## Legende

| Kennzeichnung | Bedeutung |
|---|---|
| **(erzwungen)** | Regel wird durch ausführbare Tests/CI-Gates erzwungen. Verletzung bricht den Build oder den Commit. |
| **(erzwungen Teil / Konvention)** | Teilweise automatisiert, teilweise durch Review/Pflicht. |
| **(Konvention)** | Verpflichtend durch die Engineering Constitution, aber nicht (oder noch nicht) automatisiert. |
| **(Konvention, testgestützt)** | Konvention mit begleitenden Tests, aber kein hartes CI-Blocker-Gate. |

---

## A. Schichten (aus SYSTEM-ARCHITECTURE §2–§5)

### Rule A — `lib/` importiert keine App-Schicht. **(erzwungen)**

`lib/**` (Produktivcode, ohne `*.test.ts`) darf nicht aus `components/`, `store/`, `app/` oder `benchmarks/` importieren.

- Datei: `lib/domain/graph.ts`, `lib/domain/cableEdgeData.ts` sind die Typ-Grenze.
- Test: `scripts/architecture/libBoundary.test.ts`
- Allowlist: **leer** und soll leer bleiben. Jeder neue Eintrag braucht Begründung + Heilungspfad + Architektur-ADR.
- Grund: ADR 0008. Historisch importierte `lib/` React-Flow- und Komponententypen; das wurde aufgelöst (ARCH-001).

### Rule B — Domänenlogik kennt kein React. **(erzwungen Teil / Konvention)**

- `lib/**` läuft ohne React zur Laufzeit (Golden-Master-Pipeline, Skripte).
- React-Flow-Typen dürfen in `lib/` nicht vorkommen; die strukturell kompatiblen Ersatztypen stehen in `lib/domain/graph.ts`.
- Umgekehrt: UI darf `lib/` benutzen, aber **keine** elektrische Berechnung selbst implementieren (Rule D).

### Rule C — Routing verändert keine elektrische Semantik. **(Konvention, testgestützt)**

Der Routing-Pass schreibt ausschließlich Geometrie (`PathResult` im Route-Cache). `edge.data.crossSection`, `fuseSize`, `edgeDomain`, `length` werden von AutoWire/Sizing geschrieben — **nie** vom Router.

- Testgestützt: `scripts/goldenmaster/goldenMaster.test.ts` friert `electrical` getrennt von `routing` ein.
- Ausnahme (bewusst, READ-ONLY): `routeAllCables` **liest** `edge.data.edgeDomain`, `crossSection` und `locked` für die Hop-Priorität (`lib/routing/rules/hopping.ts`).

### Rule D — UI implementiert keine elektrischen Berechnungen. **(Konvention)**

Alle elektrischen Werte kommen aus `lib/units.ts`, `lib/electrical.ts`, `lib/vde-standards.ts`, `lib/solar.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`, `lib/autoWire/sizing.ts`. Anzeige-Helfer (`components/edges/utils/voltageDrop.ts`, `components/planner/utils/voltage.ts`) dürfen **nur** delegieren.

### Rule E — Keine Geometrie-Zahl außerhalb der Tokens. **(teilweise erzwungen)**

Alle Routing-Abstände kommen aus `lib/routing/tokens.ts`.

- Erzwungen: nur `lib/routing/tokens.ts` darf Abstandskonstanten definieren (`scripts/routing/architecture.test.ts`). Die Suche ist namens- und wertbasiert: neben Eigenschaft und Zuweisung schlägt auch eine anders benannte Strecken-Konstante mit dem Wert einer Token-Größe an.
- Erzwungen: Drift-Guards — Router-Konstanten sind Re-Exports der Tokens (`lib/routing/tokens.test.ts`).
- Nicht erzwungen: Kostenkonstanten (`BEND_COST`, `U_TURN_COST`), Suchbudgets (`MAX_EXPANSIONS`) und Frame-Puffer (`OBSTACLE_REGION_PAD`) stehen an ihrem Wirkort. Siehe `KNOWN-PROBLEMS.md` ROUTE-004.

### Rule F — Sicherheit hat Vorrang vor Schönheit. **(Konvention, testgestützt)**

Rangfolge der Garantien im Router (`pathfinding.ts`, `searchOnce`):

1. volle Bauteil-Freigabe + Trassensperre
2. volle Freigabe ohne Trassensperre
3. gelockerte Freigabe („Stub-Recht“) + Trassensperre
4. gelockerte Freigabe ohne Trassensperre

Zwei Kabel auf einer Trasse (I2) sind ein Schönheitsfehler; ein Kabel am Bauteil (I3) ist ein Regelverstoß. Deshalb: **I3 schlägt I2.**

---

## B. Eine Quelle je Zuständigkeit

### Rule G — Eine Quelle für Kabelgeometrie. **(erzwungen, ADR 0014)**

Der Renderer bezieht seine Polyline ausschließlich aus dem globalen Routing-Pass (`useCableRoute()` / `routeAllCables()`).

- Verboten: Produktionscode liest `edge.data.geometry` (Test: `scripts/routing/architecture.test.ts`).
- `lib/planner/routing-v2/` und `lib/planner/routing-core/` sind gelöscht und dürfen nirgends importiert werden.
- `lib/planner/routingV2Adapter.ts` darf Knotenpositionen erzeugen, aber keine Kabelgeometrie.

### Rule H — Eine Quelle für Kollision und Abstand. **(erzwungen, ADR 0015/0019)**

Kollisionsurteile entstehen in `lib/routing/rules/collision.ts` (`classifyCollision`, `classifySegmentAgainstNode`, `classifySegmentAgainstSegment`).

- `lib/routing/invariants.ts` (I1/I2/I3) und `lib/routing/finalValidation.ts` leiten ihre harten Urteile daraus ab — sie besitzen keine eigene Abstandsdefinition.
- Der A*-Innenloop nutzt das billigere äquivalente `segmentHitsRect` (Performance); die eine materielle Begriffsquelle bleibt das Modell.

### Rule I — Kollision ist verboten, nicht teuer. **(erzwungen)**

`overlap` im Kostenmodell ist `Infinity`. Eine endliche Zahl als Kollisionsgewicht ist ein Fehler und bricht den Test (`scripts/routing/architecture.test.ts`). Begründung: „sehr teuer“ lässt sich überstimmen, `Infinity` nicht.

### Rule J — Eine elkjs-Anbindung, gebündelt. **(erzwungen, ADR 0016)**

`elkjs` wird ausschließlich von `lib/routing/elk/runner.ts` geladen, und nur als `elkjs/lib/elk.bundled.js`. Alle anderen Layout-Pfade gehen über `layoutWithElk()` / `lib/planner/layout-engine/elk.ts`.

### Rule K — Routing ist deterministisch. **(erzwungen, ADR 0010)**

Gleiche Eingabe ⇒ byte-identisches Ergebnis. Tie-Breaker ist immer die Edge-ID (`String.localeCompare`), niemals `Math.random()`, niemals Objekt-Identität.

Belege: `scripts/goldenmaster/goldenMaster.test.ts` (Doppellauf byte-identisch), `scripts/regression/regression.test.ts` (Szenarien 13–15), `npm run routing:audit` (Spalte `determ`).

### Rule L — Crossings sind erlaubt, Overlaps sind verboten. **(erzwungen, ADR 0009)**

- `edge × edge` echte Kreuzung → Klasse `soft` → Kosten, nicht Verbot.
- `edge × edge` kollineare Überdeckung → Klasse `hard` → Verbot.
- `edge × node` → Klasse `hard` → Verbot.
- Touch (Berührung ohne echte Kreuzung) ist kein Overlap und kein Crossing.

Quelle: `lib/routing/rules/collision.ts`.

### Rule M — Kein stiller Fallback bei sicherheitskritischen Werten. **(Konvention, testgestützt)**

- `lib/units.ts` wirft (`RangeError`/`TypeError`) statt 0 einzusetzen.
- Unbekannte/fehlende Elektro-Daten werden als **offen gemeldet**, nicht geschätzt (z. B. „Abschaltvermögen unbekannt“ statt „passt schon“).
- Routing-Ausnahmen werden sichtbar gemacht (`PathResult.fallbackHitsObstacles`, `PathResult.tightMarginUsed`) statt verworfen.

### Rule N — Ungültige Daten sind kein gültiger Zustand. **(Konvention)**

`lib/nodeSchema.ts` + `store/slices/persistence.ts`: bekannte Felder mit falschem Laufzeit-Typ werden entfernt (nicht durch 0 ersetzt); unbekannte Felder bleiben erhalten.

---

## C. Neue Regeln (Phase 1 — Engineering Constitution)

Die folgenden Regeln ergänzen A–N. Sie sind Teil der `ENGINEERING-CONSTITUTION.md` und werden dort durch Tests, Review oder CI-Gates abgesichert.

### Rule S-1 — Eine Stromquelle. **(Konvention, testgestützt)**

Es gibt genau eine Stromquelle für Dimensionierung, Anzeige und Validierung: `calculateEdgeCurrent` (DC) bzw. `acCurrentA` (AC). Nie einen zweiten Strompfad bauen. `I_B ≤ I_n ≤ I_z` per Konstruktion (ein `DERATE_FACTOR` für Sizing + Sicherung).

- Verweis: `ELECTRICAL-CONTEXT.md` §5.2; AUDIT ELE-009 (zweiter AC-Pfad entfernt).

### Rule S-2 — Datenherkunft und Quellenangabe. **(Konvention)**

Jede technische Komponente, jeder Grenzwert und jede Normtabelle trägt eine Quellenangabe (Hersteller, Modell, Datenblatt, Norm, Datum, Verifizierungsstatus). Ungeprüfte Herstellerangaben dürfen nicht als unabhängig verifizierte technische Fakten dargestellt werden.

- Verweis: `docs/engineering/...` Datenqualität (DOKUMENT 8 in Phase 12).

### Rule S-3 — Datenlücke ist kein Defekt. **(Konvention, testgestützt)**

Fehlende technische Daten (z. B. kein `fuseType`, keine Panel-Voc, keine `acProtection`) melden „nicht bewertbar“ (`UNVERIFIABLE` / `incomplete`), niemals einen geschätzten Grenzwert. Keine Datenlücke erscheint als `critical`.

- Verweis: `VALIDATION-CONTEXT.md` §8.6; `lib/validationSeverity.ts`.

### Rule S-4 — Eine Verbindung hat eine Verbindlichkeit. **(erzwungen Teil / Konvention)**

`locked > user > required > auto > suggested` (`lib/electricalGraph/intent.ts`). AutoWire darf nur Schwächeres ersetzen. Widerspricht eine gepinnte Kante einer Regel, erscheint eine Warnung — korrigiert wird nichts.

- `mayOverride(kandidat, bestehend)` ist strikt: gleich stark ersetzt nicht.

### Rule S-5 — Fehler- und Statusmodelle sind eindeutig. **(Konvention)**

Engine-Sprache (`CRITICAL_SAFETY | CODE_VIOLATION | EFFICIENCY_WARNING` × `VIOLATION | UNVERIFIABLE`) bleibt die Normsprache. Für Anzeige und Gruppierung existiert eine Projektion (`lib/validationSeverity.ts`). `validationSeverityOf` / `validationStatusOf` sind die einzigen Übersetzer.

### Rule S-6 — Keine elektrische Berechnung im UI / keine Planung im Renderer. **(Konvention, Regel D wiederholt)**

Rendering zeigt nur. `CableEdge` und alle UI-Komponenten delegieren an `lib/`.

### Rule S-7 — Persistenz rettet statt verwerfen. **(erzwungen)**

`store/slices/persistence.ts`: RETTEN statt VERWERFEN (pro Element filtern, `data` neutralisieren, Feld-Schema anwenden). Messwerte (`measured`/`width`/`height`) sind kein Planinhalt und werden nicht persistiert (Rule R).

### Rule S-8 — Determinismus auch bei Migration und AutoWire. **(erzwungen Teil)**

AutoWire-Knoten-IDs sind für gleiche Eingaben deterministisch; Auto-Edge-IDs folgen festen Phasen und einer kanonischen Sortierung. Store-Zustand ändert sich nur bei tatsächlichem Inhalt (`sameElements` + `affectsStructure` → `return state`).

- Verweis: `AUTOWIRE-CONTEXT.md` §7.6, `TESTING-CONTEXT.md` §9.4 (G5–G7).

### Rule S-9 — Architekturregeln werden vor jeder Änderung gelesen. **(Konvention)**

Jeder Entwickler und jeder KI-Agent liest `ARCHITECTURE-RULES.md` sowie das thematische Kontextdokument (`docs/ai/`), bevor er Code ändert (AGENTS.md §1–§2).

### Rule S-10 — Jede Verhaltensänderung einen Ledger-Eintrag. **(Konvention)**

Jede Verhaltensänderung braucht einen Ledger-Eintrag in `docs/ARCHITECTURE-CHANGES.md` mit Begründung. Jeder Bugfix braucht einen Regressionstest (O-3).

---

## D. Arbeitsregeln ohne Test-Gate (Konventionen)

| ID | Regel |
|---|---|
| O-1 | Kein `any`, kein `@ts-ignore`, kein `as unknown as` als Dauerzustand. |
| O-2 | Neue Konstante mit physikalischer/geometrischer Bedeutung gehört in `lib/routing/tokens.ts` (Routing) bzw. neben ihre Normtabelle (Electrical) — nie inline ins Modul. |
| O-3 | Jeder Bugfix braucht einen Regressionstest; jede Verhaltensänderung einen Ledger-Eintrag (`docs/ARCHITECTURE-CHANGES.md`). |
| O-4 | Keine Tests löschen oder abschwächen, damit CI grün wird. Baselines nur senken, wenn der Plan messbar besser wird — mit Begründung. |
| O-5 | TODOs tragen ein Area-Tag: `TODO[ROUTING]:`, `TODO[ELECTRICAL]:`, `TODO[UX]:`, `TODO[PERF]:`. Nackte `TODO` sind unzulässig. (Derzeit: keine TODOs im Code.) |

---

## E. Prüfbefehle je Regel (konkret)

| Regel | Befehl |
|---|---|
| A | `npx vitest run scripts/architecture/libBoundary.test.ts` |
| E, G, H, I, J | `npx vitest run scripts/routing/architecture.test.ts` |
| E (Werte/Drift) | `npx vitest run lib/routing/tokens.test.ts` |
| K | `npm run test:goldenmaster` · `npm run test:regression` · `npm run routing:audit` |
| L | `npx vitest run lib/routing/rules/collision.test.ts` · `npx vitest run lib/routing/invariants.test.ts` |
| F | `npm run routing:audit` (Spalten I1–I3, fallback) |
| P | `npx vitest run components/edges/utils/routableNodes.test.ts components/edges/utils/routeAll.test.ts components/edges/utils/cableRouteStore.test.ts` |
| Q | `npx vitest run store/slices/changeNoise.test.ts components/planner/utils/classFlags.test.ts` |
| R | `npx vitest run store/slices/persistence.test.ts app/handleGeometry.test.ts` |
| S-1 / Elektrik | `npx vitest run lib/` (inkl. `vde-properties` G1–G7, `vde-consistency`) · Golden Plans neu rechnen |
| G1–G7 | `npx vitest run lib/vde-properties.test.ts` |
| Constitution / Check | `npm run check` (lint + format + typecheck ×2 + Coverage) |
| CI / Release | `.github/workflows/quality.yml` (siehe `docs/verification/RELEASE-GATES.md`) |

**Gate vor jedem Commit:** `npm run check` grün (AGENTS.md §7). CI-Reihenfolge: `docs/CI.md`.

---

## F. Umgang mit Widersprüchen

Wo Code und ADR auseinanderlaufen, steht das in `docs/ai/KNOWN-PROBLEMS.md`. Bei Widerspruch zwischen diesem Dokument und bestehendem, funktionierendem Code gilt: bestehende Struktur beibehalten, Widerspruch dokumentieren, Heilungspfad im Ledger festhalten. Keine unnötige Neuarchitektur (Aufgabe 3).
