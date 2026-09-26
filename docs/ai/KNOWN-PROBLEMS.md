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

## ROUTE-001 — `LaneRegistry` ist nicht an den Produktiv-Router angebunden

- **AREA:** Routing
- **FILE:** `lib/routing/rules/laneRegistry.ts`
- **DESCRIPTION:** Die Registry (`LaneRegistry`, `corridorFor`, `assign`, `assignByEdge`) wird
  ausschließlich von ihrem eigenen Test importiert. Der Produktiv-Router vergibt Lanes weiter
  über `portFanOut.assignFanOut` (Port-Ebene) und die Ausweich-Heuristik
  `ALTERNATIVE_ROUTE_GAP` (±48/±96 px, `ALTERNATIVE_LANE_STEP = 3`).
- **CURRENT BEHAVIOR:** Korridor-Lanes sind nicht stabil registriert; die Ausweich-Trassen
  stammen aus einer Heuristik, nicht aus der Registry.
- **EXPECTED BEHAVIOR:** Registry-Lanes steuern Ausweich- und Bündel-Trassen (Zielbild WP-5/WP-8).
- **SEVERITY:** mittel
- **WORKAROUND:** Lanes nur über `lib/routing/rules/portFanOut.ts` ändern — dort liegt die
  wirksame Mechanik.
- **RELATED TEST:** `lib/routing/rules/laneRegistry.test.ts` (grün, aber ohne Produktionswirkung)
- **RELATED ISSUE:** WP-5 (#394) / WP-8, dokumentiert im Modulkommentar.

---

## ROUTE-002 — Kostenmodell nur teilweise angebunden

- **AREA:** Routing
- **FILE:** `lib/routing/rules/costModel.ts`
- **DESCRIPTION:** `segmentExtraCost` und `preferredLaneBonus` werden **nur von Tests**
  aufgerufen. Im Produktivpfad nutzt `pathfinding.ts` ausschließlich
  `COST_WEIGHTS.crossing` (120) in `scorePath`.
- **CURRENT BEHAVIOR:** Clearance-Verletzungen, Nachbar-Lanes und Registry-Bonus sind im
  A*-Lauf **nicht** bepreist; nur Kreuzungen fließen in die Kosten ein.
- **EXPECTED BEHAVIOR:** vollständige Kostenfunktion im inkrementellen Pass (Zielbild WP-6/WP-8).
- **SEVERITY:** mittel
- **WORKAROUND:** Kostenänderungen nur an `scorePath`/`routeDefectScore` vornehmen — nur dort
  wirken sie heute.
- **RELATED TEST:** `lib/routing/rules/costModel.test.ts`
- **RELATED ISSUE:** WP-6 (#396).

---

## ROUTE-003 — Domänen-Trennregeln sind nicht angebunden

- **AREA:** Routing / Domäne
- **FILE:** `lib/routing/rules/collision.ts` (`buildDomainSeparationRules`,
  `classifyDomainAwareSegments`, `requiredClearanceBetween`)
- **DESCRIPTION:** Die Paarregeln (`electrical ↔ water`, `ac230 ↔ dc12` → 24 px) existieren und
  sind getestet, werden aber vom Produktiv-Router **nicht** verwendet. Dort gilt einheitlich
  `cableClearance` (12 px).
- **CURRENT BEHAVIOR:** Wasser- und Elektroleitungen können im Routing näher als 24 px
  zusammenlaufen; die Regel ist wirkungslos.
- **EXPECTED BEHAVIOR:** Router wertet die Paarregel je Kantenpaar aus.
- **SEVERITY:** mittel
- **WORKAROUND:** Bei Arbeiten an der Domänentrennung zuerst den Konsumenten schaffen —
  die Regel ist fertig, die Anbindung fehlt.
- **GEMESSENE WIRKUNG (2026-09-09, `npm run routing:domain-probe`):**
  84 gemischte Kantenpaare in den sechs Referenzplänen (inverter 9, acdc 33, complex 42).
  Davon **12 kreuzend** (acdc 4, complex 8) und **0 in zu enger Parallellage**.
  → Eine Clearance-Regel mit 24 px würde die heutigen Trassen **nicht** verändern.
  → Nur wenn die Regel auch Kreuzungen verbieten würde, verschöben sich 12 Paare — das
  widerspricht ADR 0009 (Kreuzungen erlaubt, Überdeckungen verboten).
  → Empfehlung: Anbindung als **Clearance** (wie I3, nur mit 24 px für gemischte Paare).
  Der sichtbare Nutzen entsteht erst, wenn Wasser-Rohre geroutet werden
  (`electrical ↔ water`); auf reinen Elektro-Plänen bleibt er bei null.
- **RELATED TEST:** `lib/routing/rules/collision.test.ts`, `npm run routing:domain-probe`
  (`scripts/routing/domainProbe.ts`)
- **RELATED ISSUE:** ROUTING-V2 §4.2.

---

## ROUTE-004 — Geometrie-Zahlen außerhalb der Tokens

- **AREA:** Routing
- **FILE:** `components/edges/utils/pathfinding.ts` (`searchFrame`), `components/edges/utils/routeAll.ts`
- **DESCRIPTION:** Mehrere Routing-Zahlen stehen nicht in `lib/routing/tokens.ts` und sind
  **nicht** drift-gesichert:
  - `const CLEARANCE_GOAL = 12;` in `searchFrame` (dupliziert `cableClearance`),
  - `extraXs.push(minX - 16, maxX + 16)` / `extraYs` (entspricht `laneGrid`),
  - `OBSTACLE_REGION_PAD = 240` in `routeAll.ts`,
  - `BEND_COST = 80`, `U_TURN_COST = 400`, `MAX_EXPANSIONS = 48_000`,
    `MAX_ACCEPTABLE_CROSSINGS = 2` in `pathfinding.ts`.
- **CURRENT BEHAVIOR:** Eine Token-Änderung wirkt nicht auf diese Stellen; umgekehrt können sie
  unbemerkt von den Tokens abweichen.
- **EXPECTED BEHAVIOR:** Alle geometrischen Werte aus `lib/routing/tokens.ts` oder mit
  Drift-Guard-Test.
- **SEVERITY:** mittel
- **WORKAROUND:** Vor einer Wertänderung **alle** genannten Stellen mitändern;
  `lib/routing/tokens.test.ts` erweitern.
- **RELATED TEST:** `lib/routing/tokens.test.ts` (deckt nur die Re-Export-Konstanten ab)
- **STATUS (2026-09-10):** Teilweise behoben — `CLEARANCE_GOAL` → `cableClearance`-Token,
  Kontur-Puffer → `laneGrid`-Token, `OBSTACLE_REGION_PAD` →
  `LEGACY_ROUTING_TOKENS.obstacleRegionPad` mit Drift-Guard (≥ 2 × `alternativeRouteGap()`),
  Test in `tokens.test.ts` erweitert. Verbleibt: `BEND_COST`, `U_TURN_COST`,
  `MAX_EXPANSIONS`, `MAX_ACCEPTABLE_CROSSINGS` (kostenmodell-seitige Werte,
  passen bewusst nicht in das reine Geometrie-Token-Modell — Eindokumentieren
  oder eigene Kosten-Tokens sind separat zu entscheiden).

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

## ARCH-002 — Legacy-Router lebt weiter (628 Zeilen + zwei Testdateien)

- **AREA:** Routing / Legacy
- **FILE:** `components/edges/utils/orthogonalRouting.ts`
- **DESCRIPTION:** `buildOrthogonalPath`, `orthogonalWaypoints`, `avoidObstacles` werden nur von
  `routingGallery.test.ts`, `orthogonalRouting*.test.ts`, `routingQuality.ts` und
  `scripts/routing/generate-gallery.ts` benutzt — **nicht** von `FlowCanvas`/`CableEdge`.
- **CURRENT BEHAVIOR:** Zwei Routing-Engines im Baum; die Galerie zeigt Geometrie, die nicht
  gerendert wird.
- **EXPECTED BEHAVIOR:** Eine Engine (ADR 0014) oder klare Kennzeichnung als Galerie-Werkzeug.
- **SEVERITY:** mittel
- **WORKAROUND:** [LEGACY.md](./LEGACY.md) beachten; Galerie-Änderungen nie als
  Verhaltenänderung am Planer verkaufen.
- **RELATED TEST:** `components/edges/utils/orthogonalRouting.test.ts`,
  `orthogonalRouting.invariants.test.ts`, `routingGallery.test.ts`

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
- **TEILWEISE UMGESETZT (2026-09-25, AUDIT P1):** Vorher maß das CI-Gate ausschließlich
  `buildOrthogonalPath` — den **Legacy-Router**, den die Fläche seit ADR 0014 nicht mehr
  zeichnet. `npm run perf:edge-routing` misst jetzt zusätzlich die **Live-Pipeline**
  (`routeAllCables` auf demselben Referenzplan N=36/E=134): Median **≈ 29 ms**, p90 ≈ 40 ms
  auf der Entwicklungsmaschine — also rund doppelt über dem 16-ms-Frame-Budget. Das Gate
  läuft deshalb als **Ratchet** (60 ms, Exit-Code bei Überschreitung), nicht als Behauptung:
  der Ist-Zustand ist festgehalten und Rückfall verboten; das Ziel bleibt 16 ms und wird
  durch echte Optimierung (nicht durch Anheben) erreicht. Offen bleibt die
  Skalierungsspitze N≈500 (≈2 s, s. Tabelle).
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

## ELE-003 — Golden Master nutzt für AC-Kanten die DC-Stromfunktion — **behoben 2026-09-25**

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
- **FIX (2026-09-25):** `captureGoldenMaster` benutzt für AC-Kanten dieselbe Funktion wie die
  Anzeige (`acCurrentA`, `lib/autoWire/sizing.ts`). Die Fixtures tragen jetzt den echten
  Leitungsstrom (`inverter`: `e-auto-ac-10` = 2,61 A statt 98,04 A). Der zweite, nie
  konsumierte Rechenweg `calculateAcEdgeCurrent` (`lib/vde-standards.ts`) wurde entfernt
  (AUDIT ELE-009) — es gibt genau EINEN AC-Strompfad.
- **WORKAROUND (historisch):** `electrical.edgeCurrents` in `knownPlans/*.json` bei AC-Kanten nicht als
  „Strom der Leitung“ lesen. Für elektrische Aussagen die Anzeige-Pfade prüfen.
- **RELATED TEST:** `scripts/goldenmaster/goldenMaster.test.ts`,
  `components/edges/utils/voltageDrop.test.ts`, `lib/vde-consistency.test.ts`
- **RELATED ISSUE:** ELE-005/ELE-006-Folge (zwei Stromfunktionen für AC).

---

## TEST-001 — E2E-Gate blockierte 16 Tage lang jeden Deploy — **behoben 2026-09-26**

- **AREA:** Tests / Deployment
- **FILE:** `tests/e2e/touch.spec.ts`, `components/planner/FlowCanvas.tsx`,
  `.github/workflows/quality.yml`, `.github/workflows/deploy.yml`
- **DESCRIPTION:** Der Eintrag behauptete bis heute „im CI **grün**" und belegte das
  mit PR #428 vom 09.09.2026. Diese Aussage war falsch und hat einen realen
  Ausfall verdeckt: Die Deploy-Runs 277 (25.09.), 278 (25.09.) und 279 (26.09.)
  scheiterten alle im Job `End-to-End (Playwright)` am Schritt `E2E-Tests`;
  `Pages-Build` und `Deploy` standen auf `skipped`. Letzter grüner Deploy war
  Run 276 am **10.09.2026**. Ausgelöst durch `1f173c1` (geführter Planungsmodus,
  24.09.): `placeAtCanvasCenter` übergab die View an `findNearestFreePosition`,
  das belegte Flächen umgeht — und durfte dabei über den sichtbaren Rand
  hinausgehen. Bei 393 px Breite landete das Busbar-Handle geometrisch bei
  `y=85`, die `.react-flow`-Fläche beginnt aber erst bei `y=142` (darunter:
  Header 53 px + Schrittleiste 89 px). Der Tap traf deshalb den
  `pointer-events-auto`-Button der Leiste (`GuidedPlanRail.tsx:163`).
- **CURRENT BEHAVIOR (behoben):** `FlowCanvas.tsx` prüft nach jedem Zusatz, ob der
  neue Knoten samt seiner 44-px-Touch-Trefferfläche (`NODE_TOUCH_MARGIN`) im
  sichtbaren Pane liegt, und fit die View **nur dann** nach. Ein Zusatz, der
  ohnehin sichtbar ist, springt weiterhin nicht — die bewusste Entscheidung aus
  dem Kommentar zu `PANE_WAIT_FRAMES` bleibt erhalten.
- **EXPECTED BEHAVIOR:** Der Deploy-Pfad ist nur durch funktionale Defekte blockiert,
  nicht durch Pixel-Drift. Siehe unten.
- **SEVERITY:** hoch (funktional: 16 Tage keine Veröffentlichung; zusätzlich
  Doku-Lüge an der Stelle, die den Ausfall hätte melden müssen)
- **BELEG (2026-09-26, lokal reproduziert und fixiert):**
  `npx playwright test tests/e2e/touch.spec.ts --project=touch-pixel5` →
  **7 passed** nach dem Fix (zuvor `1 failed`, zweimal hintereinander
  deterministisch, kein Flake). Volle Suite: 109 passed, 0 failed.
- **ZWEITE URSACHE (strukturell, ebenfalls behoben):** `deploy.yml` hängt mit
  `needs: quality` am Quality-Gate, und dieses Gate führte den Pixel-Vergleich
  im selben Job aus wie die Funktionaltests. Damit hatte ein einzelner
  Baseline-Diff dieselbe Macht wie ein echter Produktfehler. Der Pixel-Vergleich
  läuft jetzt als eigener Job `visual` mit `continue-on-error: true` — er meldet
  (roter Job, Annotation, Diff-Artefakt), aber stoppt die Veröffentlichung nicht
  mehr. Die funktionalen Szenarien bleiben blockierend.
  **Wichtig:** Die Baselines sind NICHT veraltet — ein Abgleich der
  `desktop-1440`-Spezifikation gegen die ausgelieferten `-linux.png` aus
  `9cf9194` (06.09.) ging 10/10 durch. Der Ausfall war allein der Touch-Defekt.
- **DRITTE URSACHE (warum niemand es sah):** Der Smoke-Check prüfte ausschließlich
  `HTTP 200` auf der Startseite. Eine ausgelieferte **Altversion** beantwortet das
  mit 200. Der Check prüft jetzt, dass alle im Build referenzierten Bundle-Dateinamen
  in der ausgelieferten Seite stecken, und dass ein Bundle unter seinem Base-Pfad
  antwortet. Gegenprobe auf die live stehende Version von 2026-09-10:
  `fehlend: 1rf7cpxz7j1km.js turbopack-2mu24kaq2df4v.js` → ROT (korrekt);
  Live gegen Live → GRÜN (kein False-Positive).
- **VIERTES (verwandter Befund, behoben):** `scripts/ci/verify-lockfile-gate.mjs`
  startete `execFileSync('npm.cmd', …)`. Seit den Node-Sicherheitspatches wirft das
  auf Windows `EINVAL`; der Catch las das als „npm ci ist gescheitert" — das Skript
  meldete den Hauptfall als BESTANDEN, obwohl npm nie gelaufen war. Es ist zudem in
  keinem Workflow aufgerufen worden. Jetzt `spawnSync` mit Befehlsstring, und als
  Schritt `Lockfile-Gate bewiesen?` im Quality Gate verdrahtet.
- **WORKAROUND:** keiner mehr nötig.
- **RELATED TEST:** `scripts/ci/workflows.test.ts` (erzwingt die 1:1-Kopie von
  `docs/ci/workflows/`), `tests/e2e/touch.spec.ts`
- **RELATED ISSUE:** AGENTS.md §9 (Touch First-Class), M11-2 (Platzierung),
  AUDIT T7 (Deploy-Trigger), `docs/CI.md`

---

## Keine TODOs im Code

`grep -rn "TODO\|FIXME\|HACK\|XXX"` über `app/`, `components/`, `lib/`, `store/`, `scripts/`,
`tests/` (ohne Testdateien) liefert **keinen Treffer**. Neue Markierungen bitte mit Area-Tag:
`TODO[ROUTING]:`, `TODO[ELECTRICAL]:`, `TODO[UX]:`, `TODO[PERF]:` — nie als nacktes
`TODO` ohne Area-Tag.

---

## AUDIT-2026-09-25 — Nacharbeit dokumentiert (Branch `arena/01a0d77d-camp`)

Die externe Durchsicht vom 2026-09-25 (Tier 1–6) ist in derselben Reihenfolge
bearbeitet worden, in der ihre Befunde den Nutzer treffen. Was erledigt ist,
steht hier bewusst NICHT als „Problem“ weiter, sondern mit Datum im
Change Ledger (`docs/ARCHITECTURE-CHANGES.md` → „Vierte Fassung“) bzw. in den
Einträgen oben:

- **ELE-001 (Anzeige rechnete mit dem empfohlenen statt dem verlegten
  Querschnitt)** — behoben; `assessCableSelection` ist die eine Quelle, das
  Kanten-Label warnt sichtbar, `voltageDrop.test.ts` hält die Invariante fest.
- **AC-Schutzorgan-Stempel (ELE-004)** — entfernt; fehlender Deskriptor ist
  jetzt eine sichtbare Annahme (C/6 kA, `descriptorAssumed`).
- **Stille Fallbacks (ELE-003/005/008/009)** — fehlende Länge/Querschnitt ⇒
  `not-modeled` mit `limitation`; `nominalVoltage` statt Phantomfeld;
  `fuseWarning`/`dropWarning` werden gelesen und als kritische Hinweise
  angezeigt; `calculateAcEdgeCurrent` (0 Konsumenten) entfernt.
- **Kupfer-Kennwerte (ELE-010)** — `lib/materials.ts` ist die eine Quelle.
- **Gates (G1/G2/G3)** — Pfad-Separatoren plattformunabhängig; die
  Architektur-Regeln sind prüfbare Funktionen mit Positivkontrollen
  (`scripts/architecture/rulesSelfCheck.test.ts`); `routing:audit` gibt einen
  Exit-Code zurück (I1/Orthogonalität/Fallback/Determinismus). **Offen:**
  Der zugehörige CI-Schritt in `.github/workflows/quality.yml` ließ sich nicht
  pushen — die GitHub-App der Session hat keine `workflows`-Berechtigung. Die
  Zeile muss einmal von Hand ergänzt werden:
  `run: npm run routing:audit` vor dem Perf-Gate.
- **Barrierefreiheit (A1/A4/A5/A6)** — Tastaturfokus im Canvas sichtbar,
  Label-Kontrast auf `--ink`, Schwere als Wort, Live-Region immer vorhanden.
- **Chat/Endpunkt (S1/S2)** — kein clientseitiges „Secret“ mehr, keine
  System-Rolle aus dem Client, Rate-Limit begrenzt, Persistenz ohne
  Prototyp-Verschmutzung.

**Weiter offen (bewusst, nicht still):**

1. **PERF-001/P5:** Die Live-Pipeline liegt mit ≈29 ms (Median, N=36/E=134)
   über dem 16-ms-Ziel; das Gate hält den Ist-Zustand als Ratchet fest. Die
   Optimierung selbst (Kostenmodell/A*-Innenloop) braucht einen eigenen ADR.
2. **ELE-002:** Die vorgelagerte Netzimpedanz (0,8 Ω) bleibt eine Annahme; sie
   ist jetzt zusätzlich Eingang der Abschaltvermögen-Prüfung
   (`prospectiveIkA`) und wird im Meldungstext benannt.
3. **A2/A3:** Das axe-E2E-Gate schließt den Canvas weiterhin aus (eigenes
   Bedienmodell); die Kontrakte dafür sind jetzt als Unit-Gates festgehalten
   (`lib/designTokens.test.ts` → „AUDIT A1/A2“). Ein axe-Lauf MIT Canvas ist
   erst sinnvoll, wenn die Node-Struktur semantisch benannt ist.
4. **A7:** Die Touch-Simulation der E2E-Suite deckt noch nicht alle
   Gesten ab (Zoom/Rotation) — unverändert.
5. **Hebel 4 (vollständig):** Die Positivkontrollen laufen in-memory gegen die
   Regelfunktionen; ein Test, der die Regeln gegen ein temporäres Verzeichnis
   mit echten Dateien laufen lässt, steht noch aus.
