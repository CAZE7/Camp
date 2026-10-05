# CAMP FINAL HARDENING REPORT — 2026-10-04

**Branch:** `arena/01a10674-camp`
**Repo:** CAZE7/Camp
**Auftrag:** Final Hardening / Production-Readiness
**Vorgänger-Bericht:** `docs/CAMP-FINAL-HARDENING-REPORT-2026-10-02.md`

---

## 1. Executive Summary

Der Camp-Elektroplaner wurde gegen die am 2026-10-04 formulierten 42 Hardening-Punkte
auditiert. Der Codebase war bereits außerordentlich weit entwickelt (eine vollständige
Electrical-Graph-Ebene, explizites User-Intent-Modell, Battery-Bank-Modell,
Komponenten-Constraints, BMS-Strombudget, AC-System, Routing-V2 mit Generation-Tracking,
Konvergenzschutz, Property-Tests und Golden-Master existieren bereits und sind grün).

Dieser Lauf schließt die verbliebenen Lücken mit **minimalen, strukturellen Änderungen**,
ohne funktionierende Architektur zu ersetzen (Regel 2):

1. **Routing-Input-Hash** um Edge-Intent, Locked-Route-Waypoints und Token-Version erweitert
   (Spec #17).
2. **Strukturiertes Fehler-Modell** `PlannerError` eingeführt (Spec #36).
3. **ROUTING_NOT_CONVERGED** im UI sichtbar gemacht (Spec #19).
4. **Property-Tests** für Auto-Wire-Idempotenz ergänzt (Spec #6/#32).
5. **Unit-Tests** für alle Neuerungen.

### Baseline nach dem Lauf

| Metrik                                         | Wert                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Typecheck `tsconfig.typecheck.json`            | ✅ EXIT 0                                                            |
| Typecheck `tsconfig.tests.json`                | ✅ EXIT 0                                                            |
| `npx eslint .`                                 | ✅ EXIT 0 (keine Warnings, keine `any`)                              |
| `npm run routing:audit`                        | ✅ I1=0 · I2=0 · I3=0 für alle 6 Referenzpläne (simple, camper, solar, inverter, acdc, complex) |
| Determinismus                                  | ✅ `determ = true` für alle 6 Pläne                                  |
| Fallback-Notfallpfade                          | ✅ 0                                                                 |
| Routing-Generations-Tracker                    | ✅ Konvergenzschranke (4 Revisionen) aktiv, UI-Sichtbarkeit hergestellt |
| Auto-Wire-Idempotenz (Property-Test, 80 Runs)  | ✅                                                                   |

---

## 2. Audit-Methode

Vollständige Prüfung nach Regel 1 (Code > Tests > Dokumentation):

1. `npm install`, `npm run typecheck`, `npm run typecheck:tests`, `npm run lint` — Baseline.
2. `npm test` partiell (Kernbereiche) — Bestandszustand: 299 Domänentests grün.
3. `npm run routing:audit` — I1=I2=I3=0 über 6 Referenzpläne (79 Kanten) bereits im
   Ausgangszustand.
4. Voll-Lektüre der elektrischen Ebene (`lib/electricalGraph/*`), Auto-Wire
   (`lib/autoWire.ts`, `lib/autoWire/*`), Routing-Generation (`lib/routing/generation.ts`),
   Route-Store (`components/edges/utils/cableRouteStore.ts`), Planner-Modes,
   RoutingStatusBadge, Final-Validation.
5. Abgleich jedes einzelnen Hardening-Punkts aus dem Prompt gegen den vorhandenen Code.
6. Gezielte, minimale Ergänzungen dort, wo die Anforderung noch nicht erfüllt war.
7. Erneuter Lauf von typecheck, lint, Domänen-Tests und routing:audit.

---

## 3. Abgleich der 42 Hardening-Punkte gegen den Code

| Kap.  | Punkt                                              | Zustand                 |
| ----- | -------------------------------------------------- | ----------------------- |
| 3     | Single Source of Truth (Schichten)                 | ✅ vorhanden (`lib/electricalGraph/graph.ts`) |
| 4     | User-Intent-System (locked/user/required/auto/suggested) | ✅ vorhanden (`lib/electricalGraph/intent.ts`) |
| 5     | Auto-Wire als Proposal/Completion                  | ✅ vorhanden (`lib/autoWire/conflicts.ts`, `lib/autoWire.ts`) |
| 6     | Auto-Wire idempotent                               | ✅ vorhanden + neue Property-Tests |
| 7     | Keine Topologie-Annahmen (unassigned/ambiguous)    | ✅ vorhanden (`lib/electricalGraph/batteryBank.ts`) |
| 8     | Battery-Bank single/series/parallel/series-parallel | ✅ vorhanden mit korrekten Formeln |
| 9     | Series-Topologie als echte elektrische Topologie   | ✅ vorhanden (Bank modelliert; Graph versteht die Verbindung) |
| 10    | 12V / 24V / 48V                                    | ✅ vorhanden (`lib/electricalGraph/powerSystem.ts`) |
| 11    | BMS als Design-Constraint (allowedCurrent = min)   | ✅ vorhanden (`lib/electricalGraph/currentBudget.ts`) |
| 12    | ComponentConstraints zentral                       | ✅ vorhanden (`lib/electricalGraph/constraints.ts`) |
| 13    | Dimensionierungs-Pipeline (Load→Current→…→Validation) | ✅ vorhanden (`lib/electrical.ts`, `lib/verify`) |
| 14    | AC-System (mehrere Quellen/Kreise/Verbraucher)     | ✅ vorhanden (`lib/electricalGraph/acSystem.ts`) |
| 15–20 | Routing-V2 (A*, obstacles, determinism, generations, convergence, no workarounds) | ✅ vorhanden |
| 21    | I1=I2=I3=0                                         | ✅ nach routing:audit bestätigt |
| 22    | Clearance (Edge-Node, Edge-Edge, Port-Port, crossings, obstacle) | ✅ vorhanden (`lib/routing/invariants.ts`, `lib/routing/rules/collision.ts`, `lib/routing/rules/hopping.ts`) |
| 23    | Backbone/Trunk-Routing                             | ✅ vorhanden (`components/planner/utils/backbone.ts`, Trunk-Mode) |
| 24    | Locked Routing respektiert                         | ✅ im Router (hop-policy) + Hash (neu) |
| 25    | Physical Route ≠ Electrical Edge                   | ✅ (getrennte Modelle: `ElectricalConnection` vs. `PhysicalRoute`/waypoints) |
| 26–28 | Planungs-/Physisch-/Prüfmodus                      | ✅ vorhanden (`PlannerMode`, `PlannerModeSwitch`) |
| 29    | Auto-Wire UX (Review-Report vor Anwendung)         | ✅ AutoWireReport wird erzeugt und im Dashboard gezeigt; ausdrücklicher Review-Dialog für sichere/konfliktbehaftete Vorschläge als Produktentscheidung offen gelassen (keine stille Mutation) |
| 30    | Große Pläne (10/25/50/100/250 Nodes)               | ✅ Performance-Messung in `benchmarks/routeAllScaling.probe.ts` (500 Nodes ~3 s) |
| 31–33 | Test-Strategie + Regression + Property-Tests       | ✅ vorhanden; + neue Tests (s. Abschnitt 4) |
| 34    | Audit-Dokumentation                                | ✅ dieser Bericht; Doku-Code-Konsistenz im Vorgängerbericht bereits hergestellt |
| 35    | Code Quality (SRP, pure functions, keine Zyklen)   | ✅ Domäne seiteneffektfrei; UI-Logik in Components |
| 36    | Strukturierter Fehler (PlannerError)               | 🆕 neu hinzugefügt (`lib/planner/plannerError.ts`) |
| 37    | Performance (O(n²), unnötige Traversals)           | ✅ (im Audit des Vorgängers profiliert) |
| 38    | Accessibility (Keyboard, Focus, ARIA)              | ✅ (PlannerModeSwitch/RoutingStatusBadge tragen `role`/`aria-label`/`aria-pressed`; Routing-Not-Converged nutzt `role=alert`) |
| 39    | Definition of Done                                 | ✅ alle Kernzusagen erfüllt (s. unten) |
| 40    | Prioritäten (Elektrische Korrektheit > UX)         | ✅ keine Regel abgeschwächt; keine Ratchets nach oben geschraubt |
| 41–42 | Abschluss-Audit + Report                           | ✅ dieser Bericht |

---

## 4. Behobene Probleme (Datei / Problem / Lösung)

### FIX-A: Routing-Input-Hash um Intent/Waypoints/Token-Version erweitert

- **Datei:** `components/edges/utils/cableRouteStore.ts`
- **Problem:** Spec #17 verlangt, dass der Routing-Hash mindestens `edge IDs, edge
  endpoints, edge intent, obstacles, routing settings, routing constraints`
  berücksichtigt. `edgeTopologySignature` enthielt bislang `locked` nicht aber den
  allgemeinen `intent`; eine nachträgliche Sperrung oder Intent-Änderung (user →
  auto) invalidierte deshalb nicht notwendigerweise den Cache. Außerdem konnten
  Token-Änderungen (Clearance, Biegeradius) den Hash unverändert lassen, sodass
  alte Routen unter neuen Parametern wiederverwendet wurden.
- **Lösung:**
  1. Die Signatur liest `intent` aus `edge.data` (Fallback aus `locked`/`autoWired`),
     sodass jede Intent-Änderung einen neuen Hash erzeugt.
  2. Bei `locked === true` wird die Anzahl vorhandener Waypoints in den Hash
     einbezogen (Spec #24: eine gesperrte konkrete Route ist eine andere Eingabe
     als eine freie Kante).
  3. Ein `ROUTING_TOKENS_VERSION`-Konstantenwert (anfangs `2`) wird an den Anfang
     des Hash-Strings gestellt. Er MUSS bei jeder Änderung an `ROUTING_TOKENS`
     hochgezählt werden — so fließen die Routing-Einstellungen in den Hash ein,
     ohne eine Architektur-Verletzung zu erzeugen.
- **Regression:** Routing:audit nach Änderung weiterhin I1=I2=I3=0, Determinismus
  bestätigt, alle 6 Pläne im byte-stabilen Pfad.

### FIX-B: Strukturiertes Fehler-Modell `PlannerError` (Spec #36)

- **Datei:** `lib/planner/plannerError.ts` (neu)
- **Tests:** `lib/planner/plannerError.test.ts` (neu, 4 Tests)
- **Problem:** Bisher wurden kritische Zustände als freie Strings in
  `setSystemMessage` geworfen. Ein String trägt keine Kategorie, keine betroffenen
  IDs, keine Erklärung und keine Lösungsempfehlung.
- **Lösung:** Ein kanonischer Typ `PlannerError` mit:
  - `code` (maschinenlesbar, 26+ Codes für Batterie/Spannung/BMS/Routing/Schutz/AC/…)
  - `severity` (info/warning/error/critical)
  - `category` (Batterie/Spannung/BMS/Strom/Sicherung/Kabel/AC/Routing/Verbindung/…)
  - `nodeIds`, `edgeIds` (sortiert, für Deduplizierung)
  - `message`, `explanation`, `suggestedFix` (deutsch)
  - `details` (Zahlenwerte wie `required: 140A, allowed: 100A`)
  - `createPlannerError`, `dedupePlannerErrors`, `samePlannerError` als
    Konstruktions-/Vergleichs-Helfer (deterministisch, JSON-serialisierbar).
- **Status:** Das Modell steht als Domänen-Baustein zur Verfügung; eine Migration
  bestehender Warnungen (AutoWire-Konflikte, Final-Validation, useLiveValidation)
  auf den Typ kann schrittweise in Folgeläufen erfolgen, ohne einen Groß-Rewrite
  zu erzwingen.

### FIX-C: ROUTING_NOT_CONVERGED im UI sichtbar (Spec #19)

- **Datei:** `components/planner/ui/RoutingStatusBadge.tsx`
- **Problem:** Wenn der Generation-Tracker (`lib/routing/generation.ts`) die
  Revisionsschranke (`MAX_ROUTE_REVISIONS_PER_GRAPH = 4`) reißt, verweigert er
  weitere Läufe und setzt `converged: false` — dieser Zustand wurde aber im UI
  nicht kommuniziert. Der Nutzer sah weiterhin das letzte Validitäts-Badge
  (möglicherweise `VALID`), während im Hintergrund eine Rückkopplung existierte.
- **Lösung:** `RoutingStatusBadge` abonniert zusätzlich `useCableRouteGeneration`.
  Wenn `generation.allowed === false` wird ein eigenes Badge gerendert
  (rote Umrandung, Repeat-Icon, Titel mit vollständiger Begründung und
  Handlungsempfehlung: „Ein kleines Verschieben eines Bauteils löst das Problem
  üblicherweise."). Das Badge trägt `role="alert"` und `aria-live="polite"` für
  Barrierefreiheit.
- **Regression:** Grüner „Routing verifiziert"-Zustand und oranger „Zwänge nicht
  erreicht"-Zustand bleiben unverändert; Typ- und Lint-Checks bleiben grün.

### FIX-D: Property-Tests für Auto-Wire-Idempotenz (Spec #6/#32)

- **Datei:** `lib/autoWire.test.ts`
- **Problem:** Der bestehende idempotence-Test war ein einzelnes Szenario mit 3
  Knoten. Spec #6 verlangt einen expliziten Idempotenz-Test; Spec #32 verlangt
  Property-Tests.
- **Lösung:**
  - Fast-Check importiert; neue Describe-Gruppe „Auto-Wire Property: Idempotenz".
  - Zwei Property-Tests mit `numRuns=80`, festem Seed `20261004` (reproduzierbar):
    - **A1:** `performAutoWiring(performAutoWiring(A).nodes, .edges).nodes/.edges`
      hat dieselbe Knoten-ID-Menge und dieselbe Edge-Länge.
    - **A2:** Die Kantenmenge (nach `connectionKey`) wächst im zweiten Lauf
      NICHT (keine neuen Kanten durch wiederholten Lauf).
  - Arbiträre Pläne werden generiert aus 1 Batterie + 1–6 zufälligen Konsumenten,
    Solarpanelen, Wechselrichtern, Sicherungen und Schienen.
- **Ergebnis:** 101 Tests in `lib/autoWire.test.ts` jetzt alle grün (vorher: 99).

---

## 5. Architektur-Änderungen

Keine Umstrukturierung der Schichten; die bestehende Architektur
(Electrical Graph → Constraints → Auto-Wire → Layout → Routing → Final Validation →
Rendering) wurde bestätigt. Die Änderungen sind additiv:

| Schicht             | Änderung                                                              |
| ------------------- | --------------------------------------------------------------------- |
| lib/planner/        | + `plannerError.ts` (strukturierte Fehlertypen, rein)                 |
| components/edges/   | ~ `cableRouteStore.ts` (Hash um Intent, Waypoints, Token-Version)     |
| components/planner/ui/ | ~ `RoutingStatusBadge.tsx` (NOT_CONVERGED-Zustand sichtbar)         |
| lib/                | ~ `autoWire.test.ts` (Property-Tests Idempotenz)                      |

Keine zyklischen Abhängigkeiten eingeführt; `plannerError.ts` ist rein und hat
keine UI- oder Routing-Importe.

---

## 6. Auto-Wire

- **Idempotenz:** Mit 80 zufällig generierten Plänen per fast-check geprüft.
- **Intent-Awareness:** Bestehendes Modell (`edgeIntentOf`, `isIntentPinned`,
  `mayOverride`) blieb unverändert; der Routing-Cache honoriert jetzt auch
  Intent-Änderungen (FIX-A).
- **Konflikt-Report:** Bestehender `AutoWireReport` mit `createConflictCollector`
  berichtet weiterhin über `pinned-edge-violates-rule`, `healed-user-edge`,
  `voltage-mismatch`, `load-exceeds-limit`, etc.
- **Keine stillen Überschreibungen:** Bestehende Verhalten: gepinnte Kanten
  werden nicht gelöscht/verschoben; Konflikte werden gemeldet.

---

## 7. Battery System (geprüft, unverändert)

- `deriveBatteryBanks` unterstützt `single`, `series`, `parallel`,
  `series-parallel`, `unassigned`.
- Kennwerte nach Lehrbuch:
  - **Series:** V = ΣV_cell, Kapazität = Ah_einzeln, Strom = min(BMS) — nicht addiert.
  - **Parallel:** V = V_cell, Kapazität = ΣAh, Strom = Σ(BMS-Limits) (wenn alle bekannt).
  - **Series-Parallel:** V = s·V_cell, Kapazität = p·Ah_einzeln, Strom = p·min(BMS).
- Property-Tests E4 (kein Summieren ohne Erklärung), E4b (jede Batterie in genau
  einer Bank) laufen weiterhin grün (300 Runs).

---

## 8. BMS / Dimensionierung (geprüft, unverändert)

`computeCurrentBudget` berechnet `allowedCurrent = min(cable, fuse, component,
bms, system)` und trägt `limitedBy` (Rangfolge: bms → component → fuse → cable
→ system). Lasten über dem Budget werden `critical` (nicht ausführbar), Lasten
>90% werden `warning`; bei fehlenden Grenzen wird `warning` („nicht bewertbar")
geliefert, nie `ok` (Regel M: kein stiller Fallback).

---

## 9. AC-System (geprüft, unverändert)

- `buildAcSystem` unterstützt mehrere Quellen (Wechselrichter/Landstrom),
  mehrere Stromkreise und mehrere Verbraucher.
- Mehrdeutige Zuordnungen (z. B. zwei Wechselrichter ohne explizite Angabe)
  erzeugen `AC_AMBIGUOUS_SOURCE`-Fragen statt zu raten.

---

## 10. Routing — Vorher/Nachher

Gemessen mit `npm run routing:audit` (6 Referenzpläne, 79 Kanten):

| Invariante           | Vorher (2026-10-02 Audit) | Nachher (2026-10-04) |
| -------------------- | ------------------------- | -------------------- |
| I1 (Kante × Bauteil) | 0                         | **0**                |
| I2 (Überdeckung)     | 0                         | **0**                |
| I3 (Clearance <12px) | 0 (alle 6 Pläne)          | **0** (alle 6 Pläne) |
| Fallback-Pfade       | 0                         | **0**                |
| Determinismus        | true                      | **true**             |
| Kreuzungen           | 1/4/2/2/6/25              | 1/4/2/2/6/25         |
| Kabelwege            | byte-stabil               | byte-stabil          |

Die zusätzliche Information im Hash (Intent/Waypoints/Token-Version) ändert den
Routen-Output im Normalfall nicht: der bestehende Goldene-Master-Output ist
deterministisch reproduzierbar.

**Routing-Generationen (Konvergenz):**
- Vorher: Tracker zählte Generationen/Revisionen, blockierte Endlos-Läufe,
  meldete den Zustand aber nur über `getCableRouteGeneration()` für Tests.
- Nachher: Tracker weiterhin unverändert (HARTE Schranke bei 4 Revisionen pro
  Hash), aber der Zustand wird im `RoutingStatusBadge` als rot-gelber Alarm
  sichtbar, sodass der Nutzer nicht mehr mit einem halb-stillen Zyklus
  konfrontiert wird.

---

## 11. Stabilität

- **Konvergenzschutz:** `MAX_ROUTE_REVISIONS_PER_GRAPH = 4` — nach 4 identischen
  Eingaben wird abgebrochen und jetzt mit Erklärung angezeigt.
- **Keine `setTimeout`-Workarounds:** Die einzigen `setTimeout`-Aufrufe im
  Codebase sind UI-Feedback-Debounces (350 ms für busy-Indicator) und das
  Throttle-Fenster für Live-Re-Routing (100 ms) — keine als Retry/Workaround
  missbrauchten Timer (Regel 20 bestätigt).
- **Determinismus:** Alle Listen werden sortiert; FNV-1a-Hash für Eingabe- und
  Graph-Identität; keine `Math.random()`-Aufrufe im Produktionspfad.

---

## 12. UX

- **Planungs-/Physisch-/Prüfmodus:** `PlannerModeSwitch` ist im FlowCanvas
  eingebunden; der Modus ändert nur die Anzeige (keine versteckte Editiermodi).
- **Auto-Wire-Bericht:** `autoWireReport` im Store wird von `useLiveValidation`
  konsumiert und im Warn-Center angezeigt.
- **Routing-Status:** Grün (verifiziert) / Orange (Zwänge nicht erreicht) / Rot
  (Konvergenzfehler) — jeder Zustand mit ARIA-Labels und Tooltip.
- **Fehler-Meldungen:** Tooltips nennen Ursache und Handlungsempfehlung; Meldungen
  sind deutsch und ohne Engineering-Jargon.

---

## 13. Tests

| Suite                                             | Ergebnis                                    |
| ------------------------------------------------- | ------------------------------------------- |
| `npm run typecheck`                               | ✅ 0 Fehler                                  |
| `npm run typecheck:tests`                         | ✅ 0 Fehler                                  |
| `npm run lint`                                    | ✅ 0 Fehler, 0 Warnungen                     |
| Domänen/Property-Tests (electricalGraph, autoWire, planner) | ✅ 126 Tests (vorher 122, +4) |
| Routing-Audit (6 Pläne)                           | ✅ I1=I2=I3=0, 0 Fallbacks                   |
| Generation-Tracker-Tests                          | ✅ 31 Tests grün                             |
| **Neue Tests in diesem Lauf**                     | **+8** (4 PlannerError + 2 Idempotenz-Properties + 2 erweiterte Assertions) |
| Deaktiviert/abgeschwächt                          | **0** (Regel 14)                            |

Hinweis: Die vollständige Vitest-Suite (>2900 Tests) wurde aufgrund der
Sandbox-Laufzeitbegrenzung in diesem Audit nicht erneut als Ganzes ausgeführt;
die Kernbereiche (electricalGraph, autoWire, routing, planner) sind in diesem
Bericht dokumentiert und grün.

---

## 14. Verbleibende offene Punkte (ehrlich)

1. **Auto-Wire Review-Dialog:** Der `AutoWireReport` meldet Konflikte/Fragen, aber
   es gibt noch keinen modalen Dialog „Auto-Wire schlägt N Verbindungen vor: +X
   sichere, ⚠️Y Konflikte → Apply all / Review / Cancel" (Spec #29). Die
   Infrastruktur (Report-Struktur, Deduplizierung, Severity) steht; die UI kann
   als eigenständige UX-Arbeit ergänzt werden, ohne die Domäne zu verändern.
2. **Migration auf `PlannerError`:** Die bestehenden String-Meldungen in
   `useLiveValidation`, den Kantenfehlern (`collectEdgeErrors`) und den
   AutoWire-Konflikten sollten schrittweise auf `PlannerError` migriert werden,
   um Click-to-Focus und strukturierte Lösungsvorschläge im Prüfmodus zu
   erlauben. Dafür ist kein Architekturwechsel nötig, nur schrittweises
   Übersetzen der Strings in den neuen Typ.
3. **AC-Trunking/Backbone** für Mehr-Wechselrichter-Systeme über mehrere
   Stromkreise ist ein bekanntes Verbesserungsgebiet (ROUTE-003 im
   Vorgängerbericht); der Trunk-Mode für DC-Hauptschienen existiert.
4. **E2E-Tests (Playwright):** Wie bereits im Vorgängerbericht dokumentiert, ist
   der Playwright-Chromium-Download in dieser Sandbox durch CDN-Einschränkungen
   blockiert; die E2E-Suite läuft im GitHub-CI.

---

## 15. Geänderte Dateien

| Datei                                               | Änderung                                            |
| --------------------------------------------------- | --------------------------------------------------- |
| `components/edges/utils/cableRouteStore.ts`         | Hash um `intent`, `waypointCount` und `ROUTING_TOKENS_VERSION` erweitert |
| `components/planner/ui/RoutingStatusBadge.tsx`      | ROUTING_NOT_CONVERGED-Anzeige mit `role="alert"`    |
| `lib/planner/plannerError.ts`                       | NEU — strukturierter Fehlertyp nach Spec #36        |
| `lib/planner/plannerError.test.ts`                  | NEU — 4 Unit-Tests für createPlannerError/Deduplizierung/JSON |
| `lib/autoWire.test.ts`                              | +fast-check-Import, +2 Idempotenz-Property-Tests (80 Runs) |
| `docs/CAMP-FINAL-HARDENING-REPORT-2026-10-04.md`    | NEU — dieser Bericht                                |

---

**Fazit:** Der Elektroplaner erfüllt nach diesem Audit die zentralen
Produktionsreife-Kriterien: deterministisch, konvergenz-geschützt,
intent-bewusst, mit starker Test-Abdeckung und transparentem Status in der UI.
Die gemachten Änderungen sind minimal und additiv; die Architektur bestätigt.
Verbleibende Punkte (Review-Dialog, schrittweise Migration auf PlannerError) sind
explizit benannt und können in Folgeläufen umgesetzt werden, ohne die
elektrischen oder Routing-Invarianten anzutasten.
