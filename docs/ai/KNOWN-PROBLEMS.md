# KNOWN-PROBLEMS

Nur **echte, im Code nachweisbare** Probleme. Keine Wunschliste, keine allgemeinen TODOs.
Jeder Eintrag ist am 2026-09-09 gegen den Code geprüft.

Legende Severity: **hoch** = Agent kann falschen Code ändern / falsche Sicherheit annehmen ·
**mittel** = Qualitäts- oder Konsistenzrisiko · **niedrig** = Komfort/Doku.

---

## DOC-001 — `docs/ROUTING-V2.md` beschreibt gelöschte Verzeichnisse

- **AREA:** Dokumentation / Routing
- **FILE:** `docs/ROUTING-V2.md`
- **DESCRIPTION:** Die Spec nennt `lib/planner/geometry`, `lib/planner/routing-core` und
  `lib/planner/routing-v2` als verbindliche Basis. Beide Routing-Verzeichnisse sind **gelöscht**
  (ADR 0014); der Produktivpfad ist `components/edges/utils/routeAll.ts` + `lib/routing/`.
  Die Spec ist außerdem als `FROZEN` markiert und beschreibt ELK als „nicht im Produktivpfad“,
  obwohl ADR 0018 den ELK-Layout-Pass produktiv verdrahtet hat.
- **CURRENT BEHAVIOR:** Ein Agent, der nur die Spec liest, sucht Code, den es nicht gibt.
- **EXPECTED BEHAVIOR:** Spec oder Verweis zeigt auf den realen Pfad; ELK-Status ist aktuell.
- **SEVERITY:** hoch
- **WORKAROUND:** Diese Datei ([ROUTING-CONTEXT.md](./ROUTING-CONTEXT.md)) ist autoritativ.
- **RELATED TEST:** `scripts/routing/architecture.test.ts` („die zweite Routing-Engine ist
  entfernt“) — der Test sichert den Code, nicht die Doku.
- **RELATED ISSUE:** ADR 0014, ADR 0018; historisch AUDIT ROUTE-003.

---

## DOC-002 — Veraltete Zähler im Kommentar von `finalValidation.ts` — **behoben 2026-09-09**

- **STATUS:** behoben. Der Kopfkommentar nennt jetzt den gemessenen Stand (0/0/0) und
  verweist für die Historie auf ADR 0017/0019/0020; die Ratchet lebt im Test.
- **AREA:** Dokumentation im Code / Routing
- **FILE:** `lib/routing/finalValidation.ts` (Dateikopf)
- **DESCRIPTION:** Der Kommentar nennt als gemessenen Stand „**72 × I1, 37 × I2, 13 × I3**“
  über die sechs Golden-Master-Pläne. Gemessen mit `npm run routing:audit` (2026-09-09) sind es
  **0 / 0 / 0**.
- **CURRENT BEHAVIOR:** Ein Agent nimmt an, das Routing verletze die Final-Invariante massiv,
  und „repariert“ etwas, das längst behoben ist — oder senkt versehentlich die Ratchet-Grenze.
- **EXPECTED BEHAVIOR:** Der Kommentar nennt den aktuellen Messwert und das Datum.
- **SEVERITY:** hoch
- **WORKAROUND:** `npm run routing:audit` ausführen; Ratchet-Grenzen stehen in
  `scripts/routing/finalValidation.test.ts` (derzeit 0).
- **RELATED TEST:** `scripts/routing/finalValidation.test.ts`
- **RELATED ISSUE:** ADR 0017, ROUTE-BUG-Serie 2026-09-09.

---

## DOC-003 — Veraltete Zahlen im `README.md` — **behoben 2026-09-09**

- **STATUS:** behoben. `README.md` nennt jetzt 2018 Tests / 145 Dateien, React Flow
  (`@xyflow/react`) 12.11 und als Routing-Engine den produktiven globalen Pass
  (`components/edges/utils/routeAll.ts`) statt des Legacy-Moduls `orthogonalRouting.ts`.
- **AREA:** Dokumentation
- **FILE:** `README.md`
- **DESCRIPTION:** Das README nennt „1265 Tests, 101 Dateien“ (tatsächlich **2018 / 145**)
  und „React Flow 11“ (tatsächlich `@xyflow/react` 12.11.6, ADR 0013).
- **CURRENT BEHAVIOR:** Falsche Baseline für jeden, der das README als Stand nimmt.
- **EXPECTED BEHAVIOR:** Zahlen aus dem letzten Lauf, mit Datum.
- **SEVERITY:** mittel
- **WORKAROUND:** `npm test` bzw. `package.json` lesen.
- **RELATED TEST:** —

---

## DOC-004 — `docs/ROUTING-INVARIANTS.md` beschreibt die falsche Engine

- **AREA:** Dokumentation / Routing
- **FILE:** `docs/ROUTING-INVARIANTS.md`, `components/edges/utils/orthogonalRouting.ts`
- **DESCRIPTION:** Das Dokument definiert die Invarianten **R1–R7** für
  `buildOrthogonalPath()` / `orthogonalWaypoints()`. Diese Engine ist **nicht** im Render-Pfad;
  sie wird nur noch von Tests und vom Galerie-Generator benutzt.
- **CURRENT BEHAVIOR:** Ein Agent kann R1–R7 „reparieren“ und damit Tests stabilisieren, die
  nicht das rendern, was der Nutzer sieht.
- **EXPECTED BEHAVIOR:** R1–R7 klar als **Legacy-Engine-Invarianten** markiert; I1–I10 als die
  produktiven.
- **SEVERITY:** hoch
- **WORKAROUND:** [LEGACY.md](./LEGACY.md) + [ROUTING-CONTEXT.md §4.5](./ROUTING-CONTEXT.md#45-routing-invarianten).
- **RELATED TEST:** `components/edges/utils/orthogonalRouting.invariants.test.ts`,
  `orthogonalRouting.test.ts`, `routingGallery.test.ts`

---

## DOC-005 — `scripts/routing/audit.ts` verweist auf eine nicht existierende Gate-Testdatei — **behoben 2026-09-09**

- **STATUS:** behoben. Der Kopfkommentar nennt jetzt die realen Gates
  (`finalValidation.test.ts`, `regression.test.ts`) statt `routingQualityGate.test.ts`.
- **AREA:** Dokumentation / Routing
- **FILE:** `scripts/routing/audit.ts` (Kopfkommentar, Zeilen ~10–14)
- **DESCRIPTION:** Der Kommentar behauptet, „dieselben Zahlen prüft
  `routingQualityGate.test.ts` hart“. Diese Datei **existiert nicht**
  (`grep -rn routingQualityGate --include=*.ts` trifft nur den Kommentar selbst).
  Das harte Gate ist heute `scripts/routing/finalValidation.test.ts` (I1–I3 Ratchet)
  zusammen mit `scripts/regression/regression.test.ts`.
- **CURRENT BEHAVIOR:** Ein Agent sucht die Datei, findet sie nicht und vermutet ein
  fehlendes Gate — oder „repariert“ den Kommentar durch Anlegen einer neuen Testdatei.
- **EXPECTED BEHAVIOR:** Kommentar nennt die realen Gates; das Skript bleibt reine Diagnose.
- **SEVERITY:** niedrig
- **WORKAROUND:** [TESTING-CONTEXT.md §9.2](./TESTING-CONTEXT.md) listet die echten Gates;
  `npm run routing:audit` ist Diagnose, nicht Gate.
- **RELATED TEST:** `scripts/routing/finalValidation.test.ts`,
  `scripts/regression/regression.test.ts`

---

## ROUTE-001 — `LaneRegistry`-Anbindung — **behoben 2026-09-09**

- **STATUS:** behoben für den Produktionsvertrag. `routePlan()` baut vor der Kandidatenwahl
  über `buildPreferredLanes()` eine deterministische Korridorpräferenz aus der Registry;
  `preferredLaneBonus` beeinflusst den Tie-Break. Das lokale Port-Fan-Out bleibt bewusst eine
  getrennte Regel. `routeAllCables()` ist nur noch ein delegierender Adapter.
- **AREA:** Routing
- **FILE:** `lib/routing/rules/laneRegistry.ts`, `components/edges/utils/routeAll.ts`,
  `components/edges/utils/pathfinding.ts`
- **VERIFICATION:** `components/edges/utils/routeAll.test.ts` prüft permutierte Eingaben und
  100 stabile Produktionsläufe; Golden Master, Regression und Invariant-Ratchet bleiben grün.
- **REMAINING LIMIT:** Die Registry ersetzt nicht die historische ±48/±96-Ausweichstrategie
  (`ALTERNATIVE_ROUTE_GAP`). Sie liefert eine stabile Präferenz, keine zweite Geometrie-Engine.

---

## ROUTE-002 — Kostenmodell produktiv verdrahtet — **behoben 2026-09-09**

- **STATUS:** behoben. `segmentExtraCost()` läuft im Produktions-Kandidatenvergleich gegen
  den gemeinsamen `SegmentSpatialIndex`. Overlap und konfigurierte Domain-Clearance werden
  hart verworfen; Crossings bleiben soft und kostenpflichtig. Weighted-/Nearby-Kosten bilden
  die vollständige sekundäre Kostenfunktion nach Gleichstand der geometrischen Primärkosten;
  `preferredLaneBonus` ist der letzte deterministische Tie-Break.
- **AREA:** Routing
- **FILE:** `lib/routing/rules/costModel.ts`, `components/edges/utils/pathfinding.ts`
- **VERIFICATION:** Golden Master 13/13, Regression 50/50 und die Cost-Model-/Pathfinding-Tests
  grün; keine Baseline wurde abgeschwächt oder neu aufgezeichnet.
- **RELATED TEST:** `lib/routing/rules/costModel.test.ts`,
  `components/edges/utils/pathfinding.test.ts`, `scripts/goldenmaster/goldenMaster.test.ts`

---

## ROUTE-003 — Domänen-Trennregeln produktiv verdrahtet — **behoben 2026-09-09**

- **STATUS:** behoben. `routeAll.ts` mappt `HopDomain` deterministisch auf `RoutingDomain`,
  reicht Domänenmetadaten an die Kandidatenbewertung weiter und validiert sie im finalen
  `checkDomainClearance()`. `electrical ↔ water` und `ac230 ↔ dc12` verlangen 24 px;
  gemeinsame Port-Stubs sind die einzige dokumentierte Ausnahme. Crossings bleiben erlaubt
  und erzeugen keine elektrische Verbindung.
- **VERIFICATION:** `lib/routing/rules/costModel.test.ts` enthält den Produktionsmetadatenfall;
  `lib/routing/invariants.test.ts` prüft die harte Final-Validation. Golden Master 13/13,
  Regression 50/50 und `npm run routing:audit` (I1–I7 = 0) bleiben grün.
- **RELATED FILES:** `lib/routing/rules/collision.ts`, `lib/routing/invariants.ts`,
  `lib/routing/finalValidation.ts`, `components/edges/utils/{routeAll,pathfinding}.ts`.

---

## ROUTE-004 — Routing-Geometrie zentralisiert — **behoben 2026-09-09**

- **STATUS:** behoben für alle relevanten Produktionswerte. Clearance-Ziel und Grid-Rand
  lesen `ROUTING_TOKENS`; Node-Fallback-Größen, Suchkosten/-limits und das lokale
  Hindernisfenster sind ebenfalls Tokenfelder. Cost-Faktoren bleiben bewusst im Cost Model,
  weil sie fachliche Gewichte und keine Geometrie-Tokens sind.
- **RELATED TEST:** `lib/routing/tokens.test.ts`, `scripts/routing/architecture.test.ts`

---

## ARCH-001 — Server-Route und Postgres-Pool im statischen Export

- **AREA:** Architektur
- **FILE:** `app/api/chat/route.ts`, `lib/db.ts`, `components/Chat.tsx`, `app/ki-assistent/page.tsx`
- **DESCRIPTION:** `next.config.ts` setzt `output: 'export'` (ADR 0001: kein Backend).
  Trotzdem existieren eine API-Route mit `pg`-Pool (`lib/db.ts`, `OPENAI_API_KEY`) und die
  Seite `/ki-assistent`, die `<Chat>` gegen `NEXT_PUBLIC_CHAT_API_URL || '/api/chat'` rendert.
- **CURRENT BEHAVIOR (gemessen 2026-09-09):**
  - `npm run build` weist `/api/chat` als **`ƒ` (Dynamic, server-rendered on demand)** aus —
    der Export enthält **kein** `out/api` (geprüft).
  - Ohne gesetzte `NEXT_PUBLIC_CHAT_API_URL` sendet die Seite ins Leere (404) und wirkt dabei
    funktionsfähig.
  - `.env.example` behauptete „No environment variables are required“ — die Variable war dort
    nicht dokumentiert (mit ADR 0021 ergänzt).
  - Abgesichert ist die Route nur durch Unit-Tests mit gemocktem `pg` (578 Zeilen):
    grün, aber ohne Bezug zum ausgelieferten Artefakt.
- **EXPECTED BEHAVIOR:** Entweder externer Endpunkt + dokumentierte Konfiguration, oder
  Route/Seite entfernen.
- **SEVERITY:** hoch (funktional), niedrig (Sicherheit: kein Secret im Repo)
- **WORKAROUND:** Nicht als lauffähiges Feature behandeln. Vor Änderungen prüfen, ob der
  KI-Assistent Teil des Produkts sein soll.
- **RELATED TEST:** `app/api/chat/route.test.ts` (578 Zeilen, komplett gemockt),
  `components/Chat.test.tsx`
- **RELATED ISSUE:** ADR 0001, **ADR 0021** (Entscheidungsvorlage, offen).

---

## ARCH-002 — Legacy-Router bleibt als isoliertes Galerie-Material (bewusst, kein Produktionsproblem)

- **AREA:** Routing / Legacy
- **FILE:** `components/edges/utils/orthogonalRouting.ts`
- **DESCRIPTION:** `buildOrthogonalPath`, `orthogonalWaypoints`, `avoidObstacles` werden nur von
  `routingGallery.test.ts`, `orthogonalRouting*.test.ts`, `routingQuality.ts` und
  `scripts/routing/generate-gallery.ts` benutzt — **nicht** von `FlowCanvas`/`CableEdge`.
- **STATUS:** isoliert und getestet. Der Produktivpfad enthält keinen Import von
  `orthogonalRouting.ts` oder `routingCache.ts`; die Legacy-Dateien werden nur von Galerie-,
  Qualitäts- und Benchmark-Code verwendet.
- **CURRENT BEHAVIOR:** Die Galerie zeigt weiterhin eine bewusst separate Referenzgeometrie,
  die nicht gerendert wird.
- **EXPECTED BEHAVIOR:** Keine Nutzung im Produktivpfad; Entfernung bleibt eine optionale
  spätere Aufräumarbeit, falls die Galerie ersetzt wird.
- **SEVERITY:** niedrig
- **WORKAROUND:** [LEGACY.md](./LEGACY.md) beachten; Galerie-Änderungen nie als
  Verhaltenänderung am Planer verkaufen.
- **RELATED TEST:** `scripts/routing/architecture.test.ts` (Produktivimport-Gate),
  `components/edges/utils/orthogonalRouting.test.ts`, `routingGallery.test.ts`

---

## PERF-001 — Große Pläne liegen über dem Frame-Budget (kein Gate-Bruch)

- **AREA:** Performance
- **FILE:** `benchmarks/edgeRoutingPerf.bench.ts`, `benchmarks/routeAllScaling.probe.ts`,
  `components/edges/utils/cableRouteStore.ts`
- **DESCRIPTION:** ADR 0012 bindet das 16-ms-Budget **ausdrücklich an den Referenzplan
  N=36 / E=134** — nicht an jede Plangröße. Große Pläne liegen darüber:

  | Messung                             | Plan        | Wert                            | Budget     |
  | ----------------------------------- | ----------- | ------------------------------- | ---------- |
  | `npm run perf:edge-routing` (Gate)  | N=36 E=134  | Median **2,57 ms**, p90 2,67 ms | 16 ms → OK |
  | dto., Durchlauf „Sehr groß“         | N=120 E=585 | **21,3 ms**                     | über 16 ms |
  | `npm run perf:route-scaling`, Kette | N=100 E=99  | 13,8 ms (0,14 ms/Kante)         | —          |
  | dto.                                | N=500 E=499 | 215 ms (0,43 ms/Kante)          | —          |
  | dto., Worst Case Spannkanten        | N=250 E=125 | 121 ms (0,97 ms/Kante)          | —          |
  | dto.                                | N=500 E=250 | 2 125 ms (8,50 ms/Kante)        | —          |

  (Medians aus 3 Läufen, 2026-09-09; die Scaling-Probe meldet min/max mit.)

- **CURRENT BEHAVIOR:** Große Pläne werden im Live-Betrieb durch die 100-ms-Drossel
  (`ROUTE_THROTTLE_MS`) erträglich, nicht durch Laufzeit. Ab N≈500 mit planweiten Kanten
  übersteigt ein einzelner vollständiger Durchlauf die Drossel deutlich (≈2 s).
- **EXPECTED BEHAVIOR:** Entweder ein zweiter, dokumentierter Messpunkt im Gate
  (nicht-blockierend) oder eine Optimierung mit eigenem ADR. **Kein** stilles Anheben des
  Budgets und kein Entfernen des Gates.
- **SEVERITY:** mittel
- **WORKAROUND:** Drossel nutzen; Änderungen am A\*-Innenloop immer mit beiden Benchmarks
  gegenmessen. Einzelmessungen großer Pläne streuen um Faktor >2 — immer den Median nehmen.
- **RELATED TEST:** `npm run perf:edge-routing` (CI-Gate), `npm run perf:route-scaling` (Probe)
- **RELATED ISSUE:** ADR 0012, historisch AUDIT PERF-001 (Region-Filter; sechsstellig → ms).

---

## ELE-001 — Fahrzeug-Leitungskontext ist nicht modelliert

- **AREA:** Electrical
- **FILE:** `lib/electrical.ts` (`VDE_AMPACITY`)
- **DESCRIPTION:** Die Belastbarkeitstabelle folgt DIN VDE 0298-4, Verlegeart B2, 2 belastete
  Adern, 30 °C (Kupfer/PVC). Der Fahrzeugkontext (FLRY, DIN EN 1648-2 / ISO 6722) und die
  individuellen Korrekturfaktoren (0298-4 Tab. 3/4) sind **nicht** modelliert; stattdessen gilt
  pauschal `DERATE_FACTOR = 0.7`. Die Werte 50/70 mm² weichen von einer verbreiteten Referenz
  leicht ab und sind unverändert übernommen (Golden Master).
- **CURRENT BEHAVIOR:** Konservative Näherung — im Code ehrlich kommentiert (AUDIT NORM-003).
- **EXPECTED BEHAVIOR:** Entweder Fahrzeugtabelle + echte Korrekturfaktoren oder die jetzige,
  dokumentierte Annahme.
- **SEVERITY:** mittel (Fachlichkeit, nicht Code-Fehler)
- **WORKAROUND:** Keine Werte „verbessern“, ohne den Golden Master neu zu erfassen und die
  Quelle zu benennen.
- **RELATED TEST:** `lib/electrical.test.ts`, `lib/vde-properties.test.ts` (G1)
- **RELATED ISSUE:** AUDIT NORM-003.

---

## ELE-002 — Vorgelagerte Netzimpedanz der AC-Abschaltbedingung ist eine Annahme

- **AREA:** Electrical / AC
- **FILE:** `lib/acProtection.ts` (`UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0.8`)
- **DESCRIPTION:** Die Schleifenimpedanz-Schätzung (IEC 60364-4-41, `Zs · Ia ≤ U0`, 2/3-Regel)
  nimmt 0,8 Ω bis zur Einspeisestelle an (CEE-16-A-Näherung). Der Kommentar weist den Wert
  ausdrücklich als **UNVERIFIED** aus.
- **CURRENT BEHAVIOR:** `fail`/`borderline` hängen an dieser Annahme; ein Messwert vor Ort
  schlägt sie.
- **EXPECTED BEHAVIOR:** pflegbare Annahme oder explizit „nicht bewertbar“.
- **SEVERITY:** mittel
- **WORKAROUND:** Die Meldungstexte nennen die Annahme; sie niemals als Messersatz ausgeben.
- **RELATED TEST:** `lib/acProtection.test.ts`

---

## DOM-004 — Kantendaten werden beim Laden nicht schemageprüft

- **AREA:** Domäne / Persistenz
- **FILE:** `store/slices/persistence.ts` (`sanitizeEdgeData`)
- **DESCRIPTION:** Die Migration wendet `lib/nodeSchema` nur auf `node.data` an.
  `sanitizeEdgeData` prüft lediglich, dass `data` ein Objekt ist. Falsch getippte Felder in
  `edge.data` (z. B. `crossSection: '2,5'`, `fuseSize: 'ja'`) überleben den Rehydrate.
- **CURRENT BEHAVIOR:** Die Leseseite fängt vieles ab (`quantityOr`, `Number(...)`, Marker-Kurzschluss),
  aber nicht alles, und nicht an einer benannten Stelle.
- **EXPECTED BEHAVIOR:** deklaratives Feld-Schema für `edge.data`, symmetrisch zu `node.data`.
- **SEVERITY:** mittel
- **WORKAROUND:** Beim Lesen von `edge.data` immer `parseQuantity`/`quantityOr` bzw. die
  Marker-Kurzschlüsse aus `lib/autoWire/validation.ts` nutzen.
- **RELATED TEST:** `store/slices/persistence.test.ts`, `lib/nodeSchema.test.ts`

---

## DOM-005 — `CableEdgeData.geometry` ist ein totes Feld

- **AREA:** Domäne / Routing
- **FILE:** `lib/domain/cableEdgeData.ts`
- **DESCRIPTION:** `geometry?: {points}` ist deklariert, wird aber von **keinem** Produktivcode
  gelesen — `scripts/routing/architecture.test.ts` verbietet das Lesen ausdrücklich (ADR 0014).
  Es ist das Einfallstor der entfernten zweiten Routing-Engine.
- **CURRENT BEHAVIOR:** Das Feld ist Teil des persistierten Schemas, ohne Wirkung.
- **EXPECTED BEHAVIOR:** Entfernen oder als ausdrücklich verboten markieren.
- **SEVERITY:** niedrig
- **WORKAROUND:** Nicht lesen, nicht schreiben (es gibt kein `Polyline` mehr, das es füllt).
- **RELATED TEST:** `scripts/routing/architecture.test.ts`

---

## ELE-003 — Golden Master nutzt für AC-Kanten die DC-Stromfunktion

- **AREA:** Electrical / Harness
- **FILE:** `scripts/goldenmaster/pipeline.ts` (`captureGoldenMaster`, Stufe 2)
- **DESCRIPTION:** `electrical.edgeCurrents` wird für **alle** Kanten mit
  `calculateEdgeCurrent(...)` berechnet — der DC-Funktion. Für AC-Kanten mit einem
  Wechselrichter als Quelle greift Priorität 4 und liefert den **DC-Eingangsstrom** des
  Wechselrichters. Im Plan `inverter` steht für die AC-Kante `e-auto-ac-10`
  (WR → 230-V-Steckdose, 600 W) deshalb **98,04 A** im Fixture — der tatsächliche AC-Strom
  wäre ≈ 2,6 A.
- **CURRENT BEHAVIOR:** Die Anzeige (`components/edges/utils/voltageDrop.ts` → `acCurrentA`) und
  `sizeAcEdges` benutzen für AC-Kanten die AC-Funktion; der Golden Master nicht. Beide Welten
  sind also im Fixture nicht deckungsgleich.
- **EXPECTED BEHAVIOR:** Der Harness sollte für AC-Kanten dieselbe Quelle wie die Anzeige
  benutzen (`acCurrentA` / `calculateAcEdgeCurrent`) — oder die Abweichung explizit als
  „DC-Seitenstrom“ kennzeichnen.
- **SEVERITY:** mittel
- **WORKAROUND:** `electrical.edgeCurrents` in `knownPlans/*.json` bei AC-Kanten nicht als
  „Strom der Leitung“ lesen. Für elektrische Aussagen die Anzeige-Pfade prüfen.
- **RELATED TEST:** `scripts/goldenmaster/goldenMaster.test.ts`,
  `components/edges/utils/voltageDrop.test.ts`, `lib/vde-consistency.test.ts`
- **RELATED ISSUE:** ELE-005/ELE-006-Folge (zwei Stromfunktionen für AC).

---

## TEST-001 — E2E-Suite lokal nicht ausgeführt (im CI **grün**)

- **AREA:** Tests
- **FILE:** `tests/e2e/*.spec.ts`, `docs/E2E-TESTS.md`
- **DESCRIPTION:** Die Playwright-Suite ist vollständig geschrieben und im CI eingebunden
  (`quality.yml`, Job `e2e`, Chromium). In der Entwicklungsumgebung war der Browser-Download
  blockiert; ein lokaler Beleg fehlt weiterhin.
- **CURRENT BEHAVIOR:** E2E-Ergebnisse stammen aus dem CI, nicht vom lokalen Lauf.
- **EXPECTED BEHAVIOR:** lokaler Lauf möglich (`npm run e2e:install` setzt Netzwerkzugang voraus).
- **SEVERITY:** niedrig (kein Risiko für die Aussagekraft — der CI-Beleg existiert)
- **BELEG (2026-09-09, PR #428):** Beide Jobs der Quality-Pipeline liefen grün —
  `Typecheck, Tests & Build` in 3:29 min, `End-to-End (Playwright)` in 2:53 min.
  Die E2E-Suite ist damit nicht nur geschrieben, sondern **ausgeführt und bestanden**.
- **WORKAROUND:** Selektor-Vertrag ohne Browser prüfen: `components/e2eSelectors.test.tsx`.
- **RELATED TEST:** `tests/e2e/*` (a11y, planner-flow, persistence, responsive, touch,
  controls-overlap, expert-panel, visual)

---

## TEST-002 — Knip-Dead-Code-Audit scheitert lokal an Speicherlimit

- **AREA:** Tests / Tooling
- **FILE:** `knip.ts`, `package.json` (`audit:dead-code`)
- **DESCRIPTION:** `npm run audit:dead-code` und der reduzierte Lauf `npx knip --include files`
  brechen in der lokalen Sandbox während `oxc-parser` mit `RangeError: Array buffer allocation failed`
  ab. Der Fehler tritt vor einer Befundliste auf; es wurde kein Dead-Code-Befund als Ergebnis
  interpretiert.
- **CURRENT BEHAVIOR:** Typecheck, Lint, Format, Build und die vollständige Vitest-Suite sind
  unabhängig grün; nur dieser speicherintensive Audit-Lauf ist in dieser Umgebung nicht
  ausführbar.
- **EXPECTED BEHAVIOR:** Knip in CI oder einer Umgebung mit ausreichendem Speicher ausführen.
- **SEVERITY:** niedrig (Tooling; kein Produktionsbefund)
- **RELATED TEST:** `npm run audit:dead-code` (lokal nicht bestanden, reproduziert am 2026-09-09)

---

## Keine TODOs im Code

`grep -rn "TODO\|FIXME\|HACK\|XXX"` über `app/`, `components/`, `lib/`, `store/`, `scripts/`,
`tests/` (ohne Testdateien) liefert **keinen Treffer**. Neue Markierungen bitte mit Area-Tag:
`TODO[ROUTING]:`, `TODO[ELECTRICAL]:`, `TODO[UX]:`, `TODO[PERF]:` — nie als nacktes
`TODO` ohne Area-Tag.
