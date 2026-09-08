# CAMP — EXTREME FULL-SYSTEM AUDIT (2026-09-06)

**Branch:** `arena/01a078c9-camp` (Baseline `e5bef44`) · **Auditor:** Senior Electrical Engineer / VDE-IEC-Prüfer / Systems & Software Architect / QA / Security / Safety
**Methode:** 13 Pässe (Discovery → Architecture → Electrical → Normative → AutoWire → Routing → Domain → Persistence → Security → Testing → Adversarial → Regression → Cross-Check). Jeder technische Befund wurde **zur Laufzeit gegen den echten Code reproduziert** (tsx-Probes + Fuzzing, 400 randomisierte Graphen). Baseline: 1751/1751 Tests grün, `tsc` grün.

---

## ENDRESULT — STATUSBLOCK

```
OVERALL STATUS:      NOT SAFE (als Planungsgrundlage für reale Installationen unzureichend geprüft)
VDE STATUS:          NOT VERIFIED (Normbezüge teilweise falsch zugeordnet / unbelegt)
PRODUCTION READINESS: NOT READY

CRITICAL FINDINGS:   4   (P0)
HIGH FINDINGS:       12  (P1)
MEDIUM FINDINGS:     14  (P2)
LOW FINDINGS:        9   (P3/P4)
```

> Grüne Tests, grünes TypeScript und funktionierende UI sind **kein** Nachweis für Korrektheit. Mehrere P0/P1-Befunde existieren **trotz** 1751 grüner Tests — u. a. weil ein Test namens „Kabelgrenze bleibt unter der **derateten** Strombelastbarkeit" tatsächlich gegen die **un**deratete Tabelle prüft (`lib/vde-standards.test.ts:65`).

---

## BLOCKING ISSUES (vor produktivem Einsatz zwingend beheben)

| #   | Finding   | Kern                                                                                                                                                                                                                 | Status 2026-09-07                                                                                              |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | ELE-001   | Sicherungs-/Belastbarkeits­koordination intern widersprüchlich: FUSE_MAP liegt für **jeden** Querschnitt **über** der zur Dimensionierung verwendeten (derateten) Belastbarkeit. `In ≤ Iz` wird im Modell gebrochen. | ✅ BEHOBEN — FUSE_MAP abgeleitet (größte Sicherung ≤ Iz×0,7), Invariant-Test fixesiert die Koordination        |
| 2   | ELE-002   | Thermische Sättigung bei >120 A: 70 mm² wird still ausgewählt, selbst wenn der Strom die eigene (deratete UND ab 173 A auch die rohe) Belastbarkeit übersteigt — **ohne Warnung** (nur fuseWarning bei I > 160 A).   | ✅ BEHOBEN — `collectEdgeErrors` meldet „Leitung thermisch überlastet (I > X)"                                 |
| 3   | ELE-003   | Verpolte Batterie-Parallelschaltung (plus→minus zwischen zwei Aufbaubatterien) wird ohne jede Warnung akzeptiert („Series-Exception"). Im realen Fahrzeug = Kurzschluss.                                             | ✅ BEHOBEN (Modellgrenze bleibt: Serien-String nicht geprüft) — Live-Regel A3 „Polarität vertauscht", kritisch |
| 4   | CRASH-001 | AutoWire crasht mit `RangeError` bei AC-Nutzerkanten mit Querschnitt > 70 mm² (Import/Altdaten) — genau der Fall, den der DC-Pfad explizit abfängt. App-Aktion „Auto-Verdrahten" bricht ab.                          | ✅ BEHOBEN — sizeAcEdges normiert; Regressionstest 95/0/NaN/3 „wirft nie"                                      |

---

## FIX-STATUS — NACHBEARBEITUNG 2026-09-07 (gleiche Session, Working Tree)

**Basis:** Audit-Befunde von Commit `e5bef44`; Fixes uncommitted im Working Tree.
**Nachweis:** 1755/1755 Tests grün (vorher 1751, 15 Tests bewusst an das neue
Koordinationsmodell angepasst + neue Beweis-Tests), `tsc --noEmit` grün,
`npm run build` (statischer Export) grün. Golden Master bewusst neu eingefroren
(Begründung im Change Ledger `docs/ARCHITECTURE-CHANGES.md`, 2026-09-07).

| Finding            | Status                                                                           | Maßnahme (Datei)                                                                                                                                                                                                                                                                                                                                | Beweis-Test                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ELE-001 / NORM-002 | ✅ BEHOBEN                                                                       | FUSE_MAP aus Ampacity×0,7 **abgeleitet** (`lib/electrical.ts`); Zitate durch ehrliche Modell-Doku ersetzt                                                                                                                                                                                                                                       | `electrical.test.ts` „Sicherungsgrenze liegt NIEMALS über der Dimensionierungs-Belastbarkeit"; `vde-properties.test.ts` Shrinking-Anker |
| ELE-002            | ✅ BEHOBEN                                                                       | Thermisch-Überlast-Fehler in `collectEdgeErrors` (`CableEdge.tsx`)                                                                                                                                                                                                                                                                              | Szenario-Tests (AssertZeroWarnings greift auf collectEdgeErrors durch)                                                                  |
| ELE-003            | ✅ BEHOBEN (mit dokumentierter Grenze: echte Serien-Strings weiter unmodelliert) | Regel A3 Verpolungs-Warnung kritisch (`useLiveValidation.ts`)                                                                                                                                                                                                                                                                                   | `useLiveValidation.test.ts`                                                                                                             |
| ELE-004            | ✅ TEILWEISE                                                                     | `fuseOffset` (m) an Kante pflegbar + Fehler bei >0,2 m (`EdgeInspector`, `graphSlice.handleChangeFuseOffset`, `CableEdge`)                                                                                                                                                                                                                      | `persistence/Extended`-Suite grün; Feldvalidierung finite/≥0                                                                            |
| ELE-005            | ✅ BEHOBEN                                                                       | Insel-BFS für Wechselrichter-Last (optionaler `edges`-Parameter durch alle Call-Sites) + Entladeschlussspannung 0,9375×U_nom (`lib/vde-standards.ts`)                                                                                                                                                                                           | `vde-standards.test.ts` „ELE-005: zählt … Insel" + `dischargeFloorVoltage`                                                              |
| ELE-006            | ✅ BEHOBEN (Anzeige-Seite)                                                       | ExpertPanel nutzt continuousPower + Floor-Spannung; calculateAcEdgeCurrent-Fallback auf charger.amps/shore.rating                                                                                                                                                                                                                               | `vde-standards.test.ts` AC-Tests, `ExpertPanel.test.tsx`                                                                                |
| ELE-007            | ✅ BEHOBEN                                                                       | `lib/solar.ts`: Isc (Datenblatt oder Schätzung 1,25×Imp), Designstrom 1,25×Isc, Sicherungsfloor 1,5625×Isc (NEC 690.8×690.9, Quellendoku in Dateikopf), Kalt-Voc Voc(−20 °C) mit TK-Default −0,35 %/K; MPPT-Voc-Fensterprüfung als Live-Regel A6; voc/isc/tempCoefficient/maxPvVoltage pflegbar                                                 | `lib/solar.test.ts` (8 Tests), `useLiveValidation.test.ts` A6 (4 Tests), `autoWire.test.ts` Solar-Fuse (2 Tests)                        |
| AC-001             | ✅ BEHOBEN                                                                       | Kritische Regel für Inverter-AC-Insel ohne FI; `hasRcd` am Inverter pflegbar (Checkbox + Hinweiskarte)                                                                                                                                                                                                                                          | `useLiveValidation.test.ts`, Szenario 3/4/5                                                                                             |
| CRASH-001          | ✅ BEHOBEN                                                                       | sizeAcEdges normiert Alt-/Importquerschnitte (nie verkleinern, >70 auf 70-mm²-Bestung + Warnmarke)                                                                                                                                                                                                                                              | `autoWire.test.ts` „CRASH-001: wirft nie … (95/0/NaN/3)"                                                                                |
| AUTO-001           | ✅ BEHOBEN                                                                       | Länge-0-Guard in `crossSectionForDrop` (`primitives.ts`)                                                                                                                                                                                                                                                                                        | `autoWire.test.ts`                                                                                                                      |
| AUTO-002           | ✅ BEHOBEN                                                                       | Negative Länge → Fehlerchip + Fallback physicalDistance/2 m (`CableEdge.tsx`, `voltageDrop.ts`)                                                                                                                                                                                                                                                 | Suite grün                                                                                                                              |
| AUTO-003           | ✅ BEHOBEN                                                                       | `chemistriesParallelSafe` (AGM‖Gel und LiFePO4‖Li-Ion blockiert, bekannte Chemien exakt, Unbekannte alter Blei/Li-Fallback); Live-Regel A5 für Nutzer-Kanten (kritisch); `role`-Feld ('starter'/'house') gewinnt über Label-Heuristik (isStarterBattery + getSystemVoltage); Gel-Option + Rollen-Auswahl im Inspector                           | `autoWire.test.ts` (AGM‖Gel nicht auf Schiene, AGM‖AGM weiter parallel, role-Priorität), `useLiveValidation.test.ts` A5 (3 Tests)       |
| AUTO-004           | ✅ DOKUMENTIERT                                                                  | ADR-0010 „Geltungsbereich": elektrisch deterministisch, IDs nicht byte-identisch                                                                                                                                                                                                                                                                | `docs/adr/0010-…md`                                                                                                                     |
| NORM-001           | ✅ BEHOBEN                                                                       | Füllgrad 40 % (0100-520-Kontext + 18015-1 dokumentiert)                                                                                                                                                                                                                                                                                         | `vde-standards.test.ts` „Maximaler Füllgrad ist 40 %"                                                                                   |
| NORM-003           | ✅ DOKUMENTIERT                                                                  | Ampacity-Quellen ehrlich benannt (B2-30°C-Näherung, 50/70-Abweichung, FLLY nicht modelliert)                                                                                                                                                                                                                                                    | Code-Kommentar `electrical.ts`                                                                                                          |
| PERSIST-001        | ✅ BEHOBEN                                                                       | Harte Shape-Validierung + sanitize bei Migration                                                                                                                                                                                                                                                                                                | `persistence.test.ts`                                                                                                                   |
| CACHE-001          | ✅ BEHOBEN                                                                       | Signatur um continuousPower/capacity/hours/rating/hasRcd erweitert                                                                                                                                                                                                                                                                              | `graphInternals`-Suite grün                                                                                                             |
| PERF-001           | ✅ BEHOBEN (2026-09-08 auch Fix b: Worst Case 203 s → 1,3 s)                     | A*-Hindernisfilter pro Kante (PAD 240 px) + `itemBySegment`-Index; 08.09.: `buildHananGridMasks` Index-Bereichsmarkierung statt Zelle×Solid, `segmentHitsAny` ohne verworfene Clearance-Distanz (bitweise äquivalent), `countCrossings`-BBox-Vorfilter                                                                                          | `hananGridMasks.test.ts` (240-Board-Äquivalenz-Fuzz), Probe `benchmarks/routeAllScaling.probe.ts`, Suite 1890/1890                      |
| PERF-002           | — (Positivbefund)                                                                | —                                                                                                                                                                                                                                                                                                                                               | —                                                                                                                                       |
| ROUTE-001          | ✅ GEHÄRTET (2026-09-08)                                                         | Fallback-Kollisionen zählbar gekennzeichnet (`fallbackHitsObstacles`, überlebt jetzt den RouteAll-Rebuild); 08.09.: `ownObstacles` — nur die eigene Box wird verworfen, fremde Klebe-Boxen bleiben Hindernis (vorher lautlos durchroutet); I1 zählt die Verletzung im Final-Validation-Report; Ausnahmen (b)/(c) bleiben begründet dokumentiert | `routeAllCollisionGuarantee.test.ts`, `pathfinding.test.ts` ROUTE-001-Block                                                             |
| ROUTE-002          | ✅ TEILWEISE (Index-Teil behoben)                                                | crossingSegmentsNear nutzt Identitäts-Map; Gerade-Modell- vs. echte-Polyline-Kreuzung bleibt Näherung (dokumentiert)                                                                                                                                                                                                                            | Routing-Suite                                                                                                                           |
| ROUTE-003          | ✅ DOKUMENTIERT                                                                  | Implementierungs-Statusnotiz in `ROUTING-V2.md` (ELK nicht im Produktivpfad)                                                                                                                                                                                                                                                                    | —                                                                                                                                       |
| ROUTE-004          | — (Positivbefund, dokumentiert)                                                  | —                                                                                                                                                                                                                                                                                                                                               | —                                                                                                                                       |
| DOM-001/002        | ✅ DOKUMENTIERT (Modellgrenzen)                                                  | ExpertPanel-Abschnitt „Was der Planer NICHT leistet"; AC-Chip ehrlich („real ausführen: 3-adrig"; FI „wird hier nicht geprüft")                                                                                                                                                                                                                 | —                                                                                                                                       |
| DOM-003            | ✅ BEHOBEN                                                                       | Deklaratives Runtime-Schema `lib/nodeSchema.ts` (Feldtabelle je Bauteiltyp, Enum-/Typ-Prüfung); Persistenz-Migration entfernt falsch getippte bekannte Felder, Unbekannte bleiben (Forward-Kompat.)                                                                                                                                             | `nodeSchema.test.ts` (6 Tests), `persistence.test.ts` DOM-003-Fall                                                                      |
| UX-001             | ✅ BEHOBEN (vollständig)                                                         | ValidationWarning strukturiert (s.o.); `collectEdgeErrors` liefert jetzt `EdgeError[]` mit ruleId/severity/measuredValue/expectedValue/unit/source statt reiner Strings — Chips, Tests und WarningCenter konsumieren dieselben Objekte                                                                                                          | `usePlannerStoreExtended.test.ts` (EdgeError-getrosten Helper), `CableEdge.test.tsx`                                                    |
| UX-002             | ✅ BEHOBEN                                                                       | ExpertPanel-Texte auf Engine-Werte (DoD 90/50, FUSE_MAP-Werte, 70-mm²-Sättigung)                                                                                                                                                                                                                                                                | `ExpertPanel.test.tsx`                                                                                                                  |
| UX-003             | ✅ BEHOBEN                                                                       | Chip-Formulierungen ohne Modell-Anspruch                                                                                                                                                                                                                                                                                                        | —                                                                                                                                       |

**Zweiter Nachtrag 2026-09-07 (P2–P4-Block):** ELE-007, AUTO-003, DOM-003, ARCH-001
(Typ-Ebene: lib/ importiert keine @xyflow/react-/components-Typen mehr; neue Domänen-
Typen `lib/domain/graph.ts`, CableEdgeData nach `lib/domain/cableEdgeData.ts` verschoben;
bewusster Rest: `lib/routing/elk/ab-compare.ts` + `costModel.ts` importieren Runtime-seitig
aus components — ELK bleibt Vergleichs-/Scriptschicht, nicht Produktionspfad), ARCH-002
(`lib/connectionRules.ts` reine Funktion, Store delegiert), UX-001-Rest (EdgeError[]).
Solar-Spezial-Drop-Budget (Audit-Fix-Punkt 4) bewusst NICHT umgestellt: Solar-Spannungsfall
weiterhin gegen 12,8-V-Referenz gerechnet = überschätzt den Prozentwert konservativ
(dokumentiert in lib/solar.ts + sizing.ts).

**Dritte Nachbearbeitung 2026-09-08 (Branch `arena/01a0818b-camp`):** PERF-001 Fix (b) und
ROUTE-001-Härtung aus der FIX-Empfehlung umgesetzt (Details + Messwerte: `docs/adr/0015-harte-final-invariante.md`,
Nachtrag 2026-09-08). Profilbefund vorab: ~95 % der Worst-Case-Laufzeit lag NICHT im A*, sondern in
pro Segment×Box gerechneten, dann verworfenen Clearance-Distanzen (`distanceSegmentToRect`) —
jetzt bitweise äquivalent ohne Distanz; das Hanan-Grid wird per Indexbereich markiert. Neuer
Worst Case aus derselben Probe: 250 Knoten mit planweiten Spannkanten 203 s → 1,3 s; Audit-Szenario
(500-Knoten-Kette) ~1,55 s → ~0,15 s. ROUTE-001: `PathRequest.ownObstacles` — der Produktionspfad
verwirft nur noch die eigene Node-Box; überlappende Fremd-Nodes werden nicht mehr lautlos
durchroutet, sondern laufen als markierter Fallback (`fallbackHitsObstacles`, durch den
RouteAll-Rebuild hindurch erhalten) und stehen als I1-Verletzung im Final-Validation-Report.
1890/1890 Tests grün (davon 8 neue Beweis-Tests), `tsc` App+Tests grün, Golden Master unverändert.

**Vierte Nachbearbeitung 2026-09-08 (Fortsetzung Branch `arena/01a0818b-camp`):**
ELE-004, ELE-007 und das erste DOM-002-Modellstück abgearbeitet.

- **ELE-004 (20-cm-Sicherungsregel, normativ verankert):** Die Grenze ist als
  benannte Konstante `FUSE_MAX_UNPROTECTED_LENGTH_M` = 0,2 m samt Quellenanker
  `FUSE_MAX_UNPROTECTED_SOURCE` in `lib/electrical.ts` verankert —
  **ISO 10133:2000 §8.1** (Wortlaut geprüft: Sicherung „within 200 mm of the
  source of power", Ausnahme durchgehende Schutzummantelung) und **ABYC E-11
  §11.10.1.1.1** (7 in = 178 mm, UNVERIFIED-Einordnung ehrlich mitgeführt; die
  2012er-ISO-Auflage nennt keinen mm-Wert mehr, DIN VDE 0100-721 keinen
  konkreten Abstand — beides im Konstanten-Kommentar festgehalten). Der alte
  Kommentar „nicht VDE…" wurde entfernt; beide Checks in `CableEdge.tsx` und
  alle drei Warn-/Hinweistexte (Chip, Detail, EdgeInspector) beziehen sich auf
  die Konstante — 200 mm/178 mm Werte stimmen jetzt überein.
- **ELE-007 (Solar-Spannungsfall auf MPP-Basis):** `solarDropBasisVoltageOf()`
  (lib/solar.ts) liefert die Vmp-Auslegungsspannung (18 V, bestehende
  `VDE_SOLAR_VMP_VOLTAGE`); `edgeDropInputs` (Anzeige) und `sizeDcEdges`
  (AutoWire, beide Loops) bewerten Panel-Zuleitungen dagegen statt gegen
  12,8 V — der Prozentfall wird nicht mehr konservativ um ~40 % überschätzt.
  Fachlich nur der Planidealfall: Kennzahlen Vmp/Voc pro Panel sind nicht im
  Datenmodell (`data.voltage` bleibt Legacy-Nennfeld, nicht Vmp — im
  Dokkommentar festgehalten); die Last-Nacherschleife am Systembudget bleibt
  bewusst unverändert. Golden-Master-Delta: Plan `solar` Panel-Kanten
  16 mm² → 10 mm² (siehe Ledger unten).
- **DOM-002 (erstes Modellstück Kurzschluss/Abschaltvermögen):** neues Modul
  `lib/shortCircuit.ts` — Batterie-Innenwiderstand aus Datenblatt
  (`internalResistance`, mΩ; Batterie-Schema + Inspektor-Feld) oder
  Faustformel je Chemie (3/5/6 mΩ @ 100 Ah für LiFePO4/AGM/Gel, UNVERIFIED-
  markiert), Bank-Ik als Parallelschätzung (ohne Starterbatterie), Ik am
  Sicherungseinbauort gedämpft über Pol→Sicherung-Leitung (fuseOffset +
  Querschnitt), Abschaltvermögen aus Bauform-Tabelle (ATO 1 kA … Class T
  20 kA, typische Herstellerwerte, UNVERIFIED) oder explizitem
  `fuseBreakingCapacity`. Neue Live-Regel **A7** in `useLiveValidation`
  (`DOM-002-breaking-capacity` = critical, `DOM-002-fuse-type-unknown` =
  Hinweis einmal pro Plan). Damit Auto-Pläne nicht pauschal „Typ unbekannt"
  melden, stempelt Auto-Wire die Bauform gleich mit (`applyFuseTypes` in
  `lib/autoWire/sizing.ts`: kleinste tragende Bauform; ≥ 32 A kein ATO;
  AC-Kanten ausgenommen). Neuer EdgeInspector-Select „Sicherungs-Bauform"
  (`handleChangeFuseType`, defensiv gegen unbekannte Strings validiert).
  Bewusst NICHT enthalten (steht im ExpertPanel-Text): Peukert, temperatur-/
  SoC-abhängiges Ri, I²t/Selektivität, 230-V-Mehrleitermodell (DOM-001).
- **Golden Master bewusst neu eingefroren** (`npm run goldenmaster:capture`,
  7 Fixtures): Delta = `fuseType`-Stempel auf allen Auto-Kanten + die zwei
  Solar-Querschnitte; keine Id-/Geometrie-Änderungen. Ledger-Eintrag in
  `docs/ARCHITECTURE-CHANGES.md`.
- **Nachweis:** 1932/1932 Tests grün (42 neue: lib/shortCircuit.test.ts,
  lib/autoWire/sizing.test.ts; A7-Regel, edgeDropInputs-Solarbasis, ELE-004-
  Regel+Konstanten-Pins, Store-Handler-Pins), `tsc` App+Tests grün,
  ESLint/Prettier sauber.

**Fünfte Nachbearbeitung 2026-09-08 (Fortsetzung Branch `arena/01a0818b-camp`):**
ARCH-Rest und Wasser-Negativ-Tests abgearbeitet; dabei ein echter Produktiv-Befund gefunden und behoben.

- **ARCH-Rest (lib/routing/elk Runtime-Import) geschlossen:** `ab-compare.ts`
  importierte den Bestandsrouter zur Laufzeit aus `components/` (ADR-0008-
  Verstoß). Gelöst per Dependency Injection — das A/B-Harness bekommt
  `routeAllCables` vom aufrufenden Test herein (Testdateien dürfen lib-
  seitig components ziehen, Präzedenz `lib/autoWire/placement.test.ts`).
  Zusätzlich der type-only-Import in `lib/planner/routingV2Adapter.ts` von
  der UI-Reexport-Fassade direkt auf `lib/domain/cableEdgeData` (ARCH-001-
  Heimatort) umgehängt. Verbleibende bekannte Typkante
  (costModel → SegmentSpatialIndex) ist mit Begründung/Heilungspfad in einer
  Allowlist hinterlegt. **Neuer Guard:** `scripts/architecture/
libBoundary.test.ts` scannt alle lib-Produktivdateien und verbietet jeden
  components/store/app/benchmarks-Import außer allowgelisteten — Rückfall
  unmöglich; die Allowlist kann nur schrumpfen (Verfall wird rot).
- **Wasser-Negativ-Tests + gefundene Lücke:** Die Negativ-Test-Serie
  (Store-Ebene) belegte: `isValidConnection` blockiert Grauwasser→Spüle
  korrekt — **aber `onConnect` rief die Regel nie auf**; jeder Nicht-UI-
  Aufrufer konnte die Gegen-Wasserlinie real anlegen (React Flow prüft nur
  im Drag-Pfad). Fix: `onConnect` beglaubigt die Verbindung jetzt selbst
  über die reine Funktion (Defense in Depth); der Negativ-Test beweist die
  vorherige Lücke über Zustandsprüfung und sichert den Fix. Dazu positiv
  festgeschrieben: Pumpe→Spüle ohne Accumulator setzt den Hinweis
  (waterWarning), Solar→Batterie bleibt im Produktivpfad blockiert
  (ELE-002-Beweis auf Store-Ebene).
- **Nachweis:** 1938/1938 Tests grün (+6: zwei Boundary-Guards, vier
  Negativ-/Lücken-Tests), `tsc` App+Tests grün, ESLint 0 Fehler, Golden
  Master unverändert (kein Produktivverhalten geändert außer der eben
  geschlossenen Lücke, die nie SOLL-Verhalten war).

**Verbleibend (bewusst offen, priorisiert):** ROUTE-003 (ELK-Produktivverdrahtung —
eigenes Architekturprojekt, inkl. Geometrie-Migration components/edges/utils → lib/routing
mit Abbau der Allowlist-Typkante), DOM-001 (230-V-Mehrleiter-Modell), DOM-002-
Nachpflege (Datenblattwerte statt UNVERIFIED-Tabelle; Peukert sowie temperatur-/
SoC-abhängiges Ri). Der Statusblock oben (NOT SAFE / NOT READY)
bezieht sich auf die **audierte Baseline** und bleibt als historisches Dokument unverändert;
alle 4 BLOCKING ISSUES sind behoben — eine erneute vollständige Freigabeprüfung steht aus.

---

## A. EXECUTIVE SUMMARY

CAMP ist ein **elektrischer Planer für Camper-Anlagen** (12 V DC / 230 V AC / Solar) auf Next.js 16 + React 19 + React Flow 12 + Zustand, als statischer Export ohne Backend. Die Codequalität ist überdurchschnittlich: getaggte Einheiten (`lib/units.ts`), zentrale VDE-Tabellen, ein durchdachtes AutoWire-Backbone (Batterie → Sicherung → Schienen → Shunt), deterministische Routing-Geometrie, Golden-Master-/Regressions-Harness, 1751 grüne Tests, Coverage-Gate auf `lib/**`.

Das Audit **bestätigt nicht** „VDE-konform". Die elektrische Kette enthält eine **beweisbare, systematische Inkonsistenz in der Schutzkoordination** (ELE-001): Dieselbe Codebasis verwendet zwei verschiedene „zulässige Leiterströme" — zur Querschnittswahl `Iz = 0,7 × Tabellenwert`, zur Sicherungswahl `In ≤ FUSE_MAP ≈ 0,93 × Tabellenwert`. Zwischen beiden liegt ein **unbelegter Graubereich von ~33 %**, in dem die Software eine Sicherung empfiehlt, die nach der eigenen Dimensionierungslogik den Leiter nicht (mehr) schützt. Dazu kommen: fehlende Warnung bei thermisch unmöglicher Dimensionierung oberhalb 70 mm² (ELE-002), akzeptierte Verpolung paralleler Batterien (ELE-003), ein AutoWire-Crash auf Altdaten (CRASH-001), ein Cache-Bug, der Warnungen nach `continuousPower`-Änderungen einfrieren lässt (CACHE-001), zwei konkurrierende AC-Stromfunktionen mit 0-A-Anzeige (ELE-006), ein Performance-Cliff (500 Knoten ≈ 81 s Routing), sowie **falsch zugeordnete bzw. unbelegte Normangaben** (FUSE_MAP „DIN VDE 0298-4", Leerrohr-Füllgrad „60 % nach VDE 0100-520") und Fachtexte, die den eigenen Tabellen widersprechen (SSOT-002).

Nicht modelliert (fachliche Limitierungen, die sichtbar dokumentiert werden müssen): Sicherungsposition entlang der Leitung, Isc/kalte Voc bei Solar, Kurzschlussstrom/Abschaltvermögen, Batterie-C-Rate/Peukert, PE-Querschnittsregeln und Mehrleitermodell auf der 230-V-Seite, MPPT-Voc-Fenster, Unterspannungsverhalten (Entladeende) der Batterie. Die Routing-Engine (Hanan-A*, Kollisionsgeometrie, Hops, Lanes) ist weitgehend korrekt und deterministisch — aber die harte „Edge×Node = verboten"-Garantie gilt **nicht ausnahmslos** (Fallback-Pfad, 2-px-Stub-Ausnahme), und das V2-Kollisionsmodell (`classifyCollision`) ist im Produktiv-Router **nicht** eingebunden (nur in Invarianten-/Regressions-Skripten); ELK ist nicht in der App verdrahtet, obwohl die Doku den ELK-Pass als „globalen Layout-Pass" mit Router-„Fallback" beschreibt.

**Gesamturteil:** Solides Planungs-/Visualisierungswerkzeug mit ernstzunehmender Ingenieurdisziplin — aber **nicht** als Ersatz für eine normengeprüfte Auslegung geeignet. „VDE-konform" darf die App nicht ausgeben (tut sie an mehreren Stellen implizit über Normzitate).

---

## B. CRITICAL FINDINGS (P0)

### ELE-001 — Sicherungs-/Leiter-Koordination: FUSE_MAP widerspricht der Dimensionierungs-Belastbarkeit

```
ID:            ELE-001
SEVERITY:      CRITICAL (P0)
CATEGORY:      Electrical / Fuse–Cable Coordination
FILE:          lib/electrical.ts
LINE:          17–31 (DERATE_FACTOR, VDE_AMPACITY, FUSE_MAP), 126 (lookupThermalCrossSection), 100–113 (selectFuseSize)
FUNCTION:      lookupThermalCrossSection / selectFuseSize / applyFuseSizes (lib/autoWire/sizing.ts:252–295)

TITLE:         Die zulässige Sicherung (FUSE_MAP) liegt für jeden Querschnitt über dem bei der Dimensionierung
               zugrunde gelegten (derateten) Leiterstrom — das Modell verletzt damit seine eigene In ≤ Iz-Koordination.

OBSERVATION:   Dimensionierung: benötigt wird Tabellenwert ≥ I / 0.7 (DERATE_FACTOR), d. h. Iz_design = 0.7 × VDE_AMPACITY[s].
               Sicherung: erlaubt ist In bis FUSE_MAP[s]. Laufender Nachweis (Probe P1, alle 10 Querschnitte):
                 1.5mm²: Iz_design 11.5A vs. maxFuse 16A   | 10mm²: 36.4A vs. 50A  | 35mm²: 77.7A vs. 100A
                 2.5mm²: 16.1A vs. 20A                     | 16mm²: 48.3A vs. 63A  | 50mm²: 95.2A vs. 125A
                 4mm²:   21.0A vs. 25A                     | 25mm²: 63.0A vs. 80A  | 70mm²: 120.4A vs. 160A
                 6mm²:   26.6A vs. 32A
               In jedem Fall: FUSE_MAP[s] > 0.7 × VDE_AMPACITY[s] — z. T. um 39 % (70mm²).

WHY IT IS A PROBLEM:
               Es existieren zwei widersprüchliche Wahrheiten über denselben Leiter. Beispiel 25 mm²:
               Last 62 A → thermische Auswahl wählt 25 mm² (63 A deratet ≥ 62 A, „passend").
               applyFuseSizes wählt In = 80 A (FUSE_MAP[25]=80 ≥ 63). Damit trägt die Sicherung 27 % mehr
               Strom, als der Leiter nach der eigenen Auslegungsannahme darf. Ob das im realen Aufbau
               (Verlegeart, Temperatur) zulässig ist, entscheidet nicht der Code, sondern die Installation —
               die Software legt sich aber auf beide Werte gleichzeitig fest.

TECHNICAL IMPACT:
               applyFuseSizes sizeDcEdges und CableEdge-Validierung nutzen FUSE_MAP; lookupThermalCrossSection
               nutzt 0.7×Ampacity. Beide Pfade laufen im selben AutoWire-Lauf nacheinander über dieselbe Kante.

ELECTRICAL / SAFETY IMPACT:
               Kann zu einer Planung führen, in der der Überstromschutz den Leiter nach dem eigenen
               Dimensionierungsmodell nicht schützt (Überlast → Erwärmung → Brandrisiko).

EXPECTED BEHAVIOR:
               Eine einzige, quellenbelegte Iz-Definition; Koordinationsregel I_B ≤ I_n ≤ I_z durchgängig
               aus derselben Tabelle + dokumentierten Korrekturfaktoren (Temperatur, Häufung, Verlegeart).

CURRENT BEHAVIOR:
               Iz_design = 0.7 × Tabelle (nur Querschnittswahl), I_n_max ≈ 0.93 × Tabelle (Schutzwahl).

PROOF / REPRODUCTION:
               tsx-Probe P1 (siehe oben), jede Zeile = FUSE_MAP[s] > VDE_AMPACITY[s] × 0.7 == true.

RELEVANT FORMULA:
               Koordination: I_B ≤ I_n ≤ I_z = I_tab · f_T · f_H (DIN VDE 0100-430 / DIN EN 60364-4-43-Konzept).

NORM / SOURCE: DIN VDE 0100-430 (Schutz bei Überstrom, Leiter-Schutzorgan-Koordination); DIN VDE 0298-4
               (Belastbarkeiten — Verlegeart/Korrekturfaktoren). Der Code-Kommentar „DIN VDE 0298-4: max fuse
               ratings per conductor cross-section" ist eine **falsche Quellenzuordnung**: 0298-4 enthält keine
               Sicherungsgrenztabelle; die Zahlen entsprechen gängiger Installationspraxis (B16 auf 1.5mm² …).
CONFIDENCE:    VERIFIED (Widerspruch code-beweisbar); normative Bewertung der Einzelwerte: UNVERIFIED.

RECOMMENDED FIX:
               1) Einheitliches Iz-Modell: Tabelle + explizite Korrekturfaktoren (Umgebungstemperatur, Häufung,
               Isolation) statt Pauschal-0.7; FUSE_MAP aus derselben (korrigierten) Iz ableiten und per Test
               `FUSE_MAP[s] <= Iz(s)` erzwingen (der existierende Test prüft fälschlich gegen die ROh-Tabelle
               und heißt trotzdem „deratet" — vde-standards.test.ts:65).
               2) Solange keine Faktoren modelliert sind: konservativ FUSE_MAP auf 0.7×Tabelle deckeln
               (16→11A? nein: besser Dimensionierung ohne 0.7 fahren und Derating als dokumentierte
               Randbedingung entfernen) — Hauptsache: eine Wahrheit.

REQUIRED TEST: Property: für alle s: FUSE_MAP[s] ≤ Iz_design(s); Integration: Laststrom = Iz_design →
               gewählte Sicherung ≤ Iz_design.

REGRESSION RISK: Mittel — FUSE_MAP-Deckelung ändert AutoWire-/Golden-Master-Ergebnisse (bewusste
               Änderung mit Recapture dokumentieren).
```

### ELE-002 — Thermische Sättigung oberhalb 70 mm²: stille Unterdimensionierung ohne Warnung

```
ID:            ELE-002
SEVERITY:      CRITICAL (P0)
CATEGORY:      Electrical / Cable Sizing
FILE:          lib/electrical.ts (LINE 123–129), lib/autoWire/sizing.ts (LINE 60–91, sizeEdge)
FUNCTION:      lookupThermalCrossSection / sizeEdge

TITLE:         Ab ~121 A Dauerstrom liefert lookupThermalCrossSection klaglos 70 mm² — selbst wenn der Strom
               die deratete (120,4 A) und ab ~173 A sogar die rohe Belastbarkeit (172 A) übersteigt.
               dropWarning/fuseWarning bleiben aus.

OBSERVATION:   `const size = VDE_SIZES.find(...); return size || 70.0;` — Sättigung ohne Fehlerkanal.
               Laufzeitnachweis (Probe A): Inverter 1900 W @ 12,8 V / η 0,85 → I_DC = 174,6 A.
               sizeDcEdges → crossSection = 70 mm², dropWarning = false. 70 mm²: rohe Ampacity 172 A < 174,6 A.
               fuseWarning wird erst bei I > 160 A von applyFuseSizes gesetzt (isFuseFeasible); im Bereich
               120,4–160 A gibt es GAR keine Warnung (Beispiel: I = 155 A → 70 mm², Sicherung 160 A, Chip „ok").

WHY IT IS A PROBLEM:
               Die Normreihe endet bei 70 mm²; die Realität nicht. Wer >120 A Dauerstrom plant (1500–2000-W-
               Inverter sind in Campern Standard) erhält eine Leitung, die nach dem eigenen Modell überlastet
               ist, ohne dass eine Warnzentrale/Marke es sagt. Der einzige Signalpfad ist der Chip
               „Sicherung zu klein!" (ab I>160A) — ein Zufallstreffer, keine Systematik.

ELECTRICAL / SAFETY IMPACT:
               Direkt: Überlastbarer Leiter mit „grünem" Plan. Hoch.

EXPECTED BEHAVIOR:
               thermWarning (analog dropWarning) sobald I > Iz_design(gewählter Querschnitt); bei Sättigung:
               „Strom über Capability der Normreihe — Paralleelleitung/24-V-System/WR-Verlagerung prüfen".

CURRENT BEHAVIOR: Stille 70-mm²-Kappung.

PROOF / REPRODUCTION: tsx-Probe A (1900 W → 70 mm², keine Warnung), Code read electrical.ts:129.

RELEVANT FORMULA: I_z(70mm², design) = 172 A × 0.7 = 120.4 A < 174.6 A = I_B.

NORM / SOURCE: DIN VDE 0100-430 / DIN VDE 0298-4 (I_B ≤ I_z). Paralleelleitungen: 0100-430 (gleiche Länge/
               Querschnitt/Impedanz, gemeinsame Sicherung nur wennmodelliert).
CONFIDENCE:    VERIFIED.

RECOMMENDED FIX: Sättigungsfall explizit markieren (fuseWarning-Logik erweitern: I > 0.7×Ampacity[cs] → warn);
               Property-Test `lookupThermalCrossSection(I) nie gesättigt ohne Warnmarke`.

REQUIRED TEST: I=121…175A über sizeDcEdges → Warnflag gesetzt; Golden-Master-Recapture.

REGRESSION RISK: Gering (additiver Warnkanal).
```

### ELE-003 — Verpolte Batterie-Parallelschaltung wird akzeptiert („Series-Exception" ohne Validierung)

```
ID:            ELE-003
SEVERITY:      CRITICAL (P0) — Safety-Validation-Gap
CATEGORY:      Electrical / Polarity / Topologie-Validierung
FILE:          store/slices/graphSlice.ts
LINE:          276–291 (isValidConnection), components/planner/hooks/useLiveValidation.ts (keine entsprechende Regel)
FUNCTION:      isValidConnection

TITLE:         battery.plus → battery.minus zwischen zwei Aufbaubatterien wird erlaubt (Serie-Exception),
               und KEINE Live-Validierung unterscheidet Serie (zulässig) von verpolter Parallelschaltung
               (Kurzschluss). Laufzeitnachweis: "ALLOWED".

OBSERVATION:   Die Exception `battery×battery || solar×solar` überspringt die Polaritätsprüfung generell.
               Eine echte Serienschaltung (12 V + 12 V = 24 V) wird nirgends von einer verpolten Parallelschaltung
               unterschieden. AutoWire legt zusätzlich beide Batterien (bei gleicher Spannung/Chemie-Klasse)
               auf dieselben Schienen — dann liegt plus→minus ZWISCHEN zwei Schienen-verbundenen Batterien.
               healUserEdges fasst battery→battery-Kanten nicht an; useLiveValidation hat keine Batteriepolaritäts-Regel.

WHY IT IS A PROBLEM:
               Optisch gültiges Kabel, elektrisch Kurzschluss/Überladung. Das ist genau die Klasse von Fehler,
               die ein Planer verhindern soll (Aufgabenstellung Abschnitt 6).

ELECTRICAL / SAFETY IMPACT:
               Im realen Aufbau: ungeschützter Ausgleichsstrom im kA-Bereich, Zerstörung, Brand.

EXPECTED BEHAVIOR:
               Serie nur als gekennzeichnetes Konstrukt (z. B. separates Node-Paar „Battery Bank") oder Warnung
               „Verpolte Parallelschaltung/unklare Serienschaltung — Batterie-Bank-Element verwenden".

CURRENT BEHAVIOR: Kante wird gesetzt; keine Warnung in WarningCenter; AutoWire ignoriert sie (bleibt liegen).

PROOF / REPRODUCTION: tsx-Probe P5 (Nachbau des exakten Gate-Codes) → "ALLOWED"; code-read useLiveValidation.

RELEVANT FORMULA: Parallelschaltung: U gleich, I addiert sich; verpolte Parallelschaltung: U_Differenz an
               R_i≈mΩ → I ≈ ΔU/R_i (kA-Bereich).

NORM / SOURCE: Fachliche Grundregel (ISO 10133, ABYC E-11 verlangen Verpolungsschutz/Verpolungs-Vermeidung);
               UNVERIFIED im Detail für DE-Fahrzeuge, aber physikalisch selbst-evident.
CONFIDENCE:    VERIFIED (Akzeptanz), UNSAFE (Konsequenz).

RECOMMENDED FIX: Neue Live-Regel „battery.plus↔battery.minus": critical, außer die Batterien sind als Serie
               deklariert (neues Datenfeld `seriesGroup`) oder eine der beiden hängt nicht an gemeinsamen Schienen.

REQUIRED TEST: Adversarial: 2 Batterien, plus→minus, gemeinsame Schienen → critical warning.

REGRESSION RISK: Gering.
```

### CRASH-001 — AutoWire wirft RangeError bei AC-Nutzerkanten mit Querschnitt > 70 mm²

```
ID:            CRASH-001
SEVERITY:      CRITICAL (P0) — Robustness/Data Integrity
CATEGORY:      Crash / AutoWire / Legacy-Import
FILE:          lib/autoWire/sizing.ts (LINE 384–396, sizeAcEdges), lib/electrical.ts (LINE 34–37, calculateMaxFuse)
FUNCTION:      sizeAcEdges → selectFuseSize → calculateMaxFuse

TITLE:         `calculateCrossSection` gibt einen Nutzer-/Import-Querschnitt 95 mm² unverändert zurück
               (dokumentiertes Verhalten), `sizeAcEdges` reicht ihn aber an `calculateMaxFuse` weiter,
               der für unbekannte Querschnitte **wirft** — der DC-Pfad (applyFuseSizes:276–283) fängt genau
               diesen Fall, der AC-Pfad nicht. AutoWire bricht komplett ab.

OBSERVATION:   Fuzz-Nachweis (400 Graphen): 5 Abstürze, u. a. Stack:
                 RangeError: Unbekannter Querschnitt: 95mm²
                   at calculateMaxFuse (lib/electrical.ts:36)
                   at selectFuseSize (lib/electrical.ts:101)
                   at sizeAcEdges (lib/autoWire/sizing.ts:394)
                   at performAutoWiring (lib/autoWire.ts:613)
               Auslöser ist eine als AC klassifizierte Kante mit data.crossSection = 95 (Altpläne/localStorage/
               Template). autoWireSystem im Store ruft performAutoWiring ungefangen → Exception im Event-Handler.

WHY IT IS A PROBLEM:
               Ein einzelnes Alt-Datenfeld bricht die zentrale Planungsfunktion; kein Error-Handling,
               kein Partiellergebnis. Verletzt die eigene Robustheits-Konvention („95 mm² darf nie crashen" —
               Kommentar in maxFuseForDisplay).

TECHNICAL IMPACT: UI-Aktion „Auto-Verdrahten" tot, bis der Datensatz manuell repariert wird.

ELECTRICAL / SAFETY IMPACT: Indirekt (keine falsche Planung, aber Verlust der automatischen Absicherung).

EXPECTED BEHAVIOR: Gleiche Behandlung wie applyFuseSizes: >70 mm² → auf 70-mm²-Normbestung absichern + Warnung.

CURRENT BEHAVIOR: RangeError, Abbruch des gesamten AutoWire-Laufs.

PROOF / REPRODUCTION: fuzz3.ts Stack-Trace (oben); deterministisch reproduzierbar mit einer
               AC-Kante + crossSection 95 + AutoWire.

RELEVANT FORMULA: —

NORM / SOURCE: —

CONFIDENCE:    VERIFIED (Laufzeit-Stack).

RECOMMENDED FIX: sizeAcEdges: Querschnitt vor selectFuseSize/calculateMaxFuse normieren (nextStandardCrossSection
               + Sättigungs-Handling analog DC) ODER calculateMaxFuse werfen lassen und am Aufrufer fangen.

REQUIRED TEST: sizeAcEdges mit cs=95/0/NaN/3 (Property: wirft nie, normiert stattdessen).

REGRESSION RISK: Gering.
```

---

## C. ELECTRICAL / VDE FINDINGS (P1)

### ELE-004 — Sicherungsposition ist nicht modelliert; „20-cm-Regel" durch „irgendeine Sicherung auf der Kante" ersetzt

```
ID: ELE-004 · SEVERITY: HIGH (P1) · CATEGORY: Fuse Position
FILE: components/edges/CableEdge.tsx (LINE 168–176, collectEdgeErrors)
OBSERVATION: `if (batteryAtEnd && length > 0.2 && !data?.fuseSize)` — hat die Kante IRGENDEINE fuseSize,
  gilt die ungeschützte Strecke als ≤ 20 cm, unabhängig von der realen Kabelänge (z. B. 5 m Batterie→Verteiler
  mit Sicherung am falschen Ende = „konform"). Ein Lageparameter (Position entlang der Kante, Distanz vom Pol)
  existiert im Datenmodell nicht.
ELECTRICAL IMPACT: Die_normativ_ geforderte Anordnung „Schutzorgan möglichst nah am Pol / am Leitungsanfang"
  (ISO 10133 / ABYC E-11: „as close as practicable", ABYC konkret ≤ 178 mm) wird strukturell nicht geprüft.
  Die „20 cm" selbst sind eine Faustregel (NICHT VDE — der Code nennt keine Quelle; der Kommentar behauptet
  nur die Regel).
STATUS: UNSAFE (Planung kann ungeschützte lange Batterieleitung als korrekt darstellen) / NORMATIVE GAP.
CONFIDENCE: VERIFIED (Code); Normwert selbst UNVERIFIED (Faustregel, vermutlich ABYC/ISO-Ursprung).
FIX: edge.data.fuseOffset (m ab Quelle) einführen; Regel: ungeschützte Länge = fuseOffset ≤ 0,2 m bei
  Batterie-Kanten; Warnung, wenn fuseSize vorhanden aber fuseOffset > 0,2 m.
TEST: Batterie→Verbraucher 5 m, fuseSize gesetzt, fuseOffset 4 m → critical.
```

### ELE-005 — Inverter-Strom: globale statt topologisch begrenzte 230-V-Last + Nenn- statt Betriebsspannung

```
ID: ELE-005 · SEVERITY: HIGH (P1) · CATEGORY: Current Calculation
FILE: lib/vde-standards.ts (LINE ~370–395, calculateEdgeCurrent Priorität 4 und Fallback)
OBSERVATION: inverterLoad = max(eigene continuousPower, SUMME ALLER consumer230v im GESAMTEN Plan) —
  unabhängig von Konnektivität. Probe P4: Inverter 500 W + unverbundener 1500-W-Verbraucher → DC-Strom
  137,9 A statt 46 A. Falsch in beide Richtungen geprägt: überschDimensioniert (hier), und bei
  Landstrom-versorgten 230-V-Verbrauchern ebenfalls falsch. Zudem wird durchgehend die NOMINALspannung
  (12,8 V) verwendet — am Entladeende/unter Last (≈11–12 V) liegt der reale DC-Strom 7–16 % höher
  (2000 W: 183,8 A @12,8 V vs. 196,1 A @12,0 V — Probe P3).
STATUS: INCORRECT (Strommodell) — Auswirkung meist konservativ, aber systematisch falsch (Sicherung/
  Spannungsfall-Grenzwerte hängen daran).
CONFIDENCE: VERIFIED.
FIX: AC-Last via BFS/Tracing je Inverter ermitteln (calculateAcEdgeCurrent existiert schon — aber nur für
  AC-Kanten; siehe ELE-006); für WR-DC-Seite Laststrom = P_AC,contin./ (U_min,discharge · η) mit U_min ≈ 11,5 V
  dokumentiert einführen.
```

### ELE-006 — Zwei AC-Stromfunktionen mit unterschiedlichen Ergebnissen („zwei Wahrheiten")

```
ID: ELE-006 · SEVERITY: HIGH (P1) · CATEGORY: Single Source of Truth / AC
FILE: lib/vde-standards.ts (calculateAcEdgeCurrent, ~LINE 434+) vs. lib/autoWire/sizing.ts (acCurrentA, LINE ~321)
OBSERVATION: Für Landstrom→AC-Ladegerät liefert die Anzeige-Funktion calculateAcEdgeCurrent 0 A (BFS findet
  keine consumer230v — Ladegerät ist keiner), während die Dimensionierungsfunktion acCurrentA korrekt
  max(Dosenrating, Ladegerät-Amps) = 50 A liefert (Probe P10). Kanten-Label zeigt also 0 A / keine Animation /
  Spannungsfall 0 % für eine real 50 A führende Leitung. Zusätzlich rechnet ExpertPanel (LINE 328) einen
  dritten Inverter-Strom (nur watts, nicht continuousPower — weicht von calculateEdgeCurrent ab).
STATUS: INCORRECT (Anzeige) / Architecture (3 parallele Strom-Implementierungen).
CONFIDENCE: VERIFIED.
FIX: acCurrentA als einzige Quelle; calculateAcEdgeCurrent für Nicht-Verbraucher-Endpunkte auf
  acCurrentA-Logik stützen (charger.amps, shore rating); ExpertPanel an calculateEdgeCurrent anschließen.
```

### ELE-007 — Solar: Imp statt Isc, keine kalte Voc, kein MPPT-Voc-Fenster, kein 1,56×Isc-Stringschutz

```
ID: ELE-007 · SEVERITY: HIGH (P1) · CATEGORY: Solar
FILE: lib/vde-standards.ts (VDE_SOLAR_VMP_VOLTAGE = 18 V; calculateEdgeCurrent Priorität 2), lib/autoWire.ts (Solar-Kanten)
OBSERVATION: Panelstrom = watts / 18 V (= Imp-Näherung). Isc (typ. +10–25 %) wird nirgends verwendet;
  Kalt-Voc (Temperaturkoeffizient) und MPPT-Eingangsspannungsfenster sind nicht modelliert — obwohl
  ExpertPanel selbst davor warnt („MPPT muss Voc verkraften"). String-/Parallelverschaltung nur als
  checkHasSeriesConnection-Hinweis (solarCalculations.ts) fürs Dashboard. PV-String-Sicherung folgt
  nicht der üblichen 1,56×Isc-Regel (UL 4703/IEC 62548-Kontext; hier UNVERIFIED anwendbar) — Solar-Kante
  erhält selectFuseSize(Imp). Probe P11/P6: 200-W-Panel → 11,1 A → Sicherung 15 A (Imp-Basis).
STATUS: NORMATIVE GAP / UNVERIFIED — als Limitierung dokumentieren, nicht als „dimensioniert" ausgeben.
CONFIDENCE: VERIFIED (dass nichts davon modelliert ist); normative Faktoren: PROBABLY CORRECT als Anforderung.
FIX: solar.data um voc/isc/tempCoefficient ergänzen; MPPT-Regel: voc_kalt ≤ Voc,max; Sicherung ≥1,56×Isc
  (Quelle benennen); Spezial-Drop-Budget für Solar (Basis Vmp/Voc, nicht 12,8-V-Systemspannung).
```

### AC-001 — Wechselrichter-230-V-Seite ohne RCD/RCBO löst keine Warnung aus

```
ID: AC-001 · SEVERITY: HIGH (P1) · CATEGORY: AC Schutzmaßnahmen
FILE: components/planner/hooks/useLiveValidation.ts (LINE 133–146, nur shorePower.hasRcd geprüft)
OBSERVATION: Regel A2 prüft ausschließlich Landstrom-Nodes. Ein Plan „Batterie → Inverter → 230-V-Steckdosen"
  ohne jedes Fehlerstrom-Schutzorgan erzeugt KEINE Warnung; die Kante zeigt lediglich informativ
  „RCBO (FI/LS) empfohlen" (CableEdge.tsx:554) — Empfehlung statt Pflicht. „FI vorhanden = sicher" wird nicht
  behauptet (gut), aber „FI fehlt am Inverter-Kreis = kritisch" fehlt.
STATUS: NORMATIVE GAP → FALSE NEGATIVE. Für Fahrzeug-230-V-Kreise ist RCD ≤ 30 mA (Typ A) ebenfalls
  einschlägig (DIN VDE 0100-721-Kontext; Detail UNVERIFIED).
CONFIDENCE: VERIFIED (Regel existiert nur für shorePower).
FIX: Inverter-Regel: existiert mindestens ein consumer230v im Inverter-Kreis → RCD-Flag am Inverter prüfen
  (neues Datenfeld hasRcd/protectedAc) sonst critical.
TEST: Plan ohne shorePower, mit Inverter + 230-V-Verbraucher → critical warning erwartet.
```

### NORM-001 — Leerrohr-Füllgrad 60 % ist mit „VDE 0100-520" nicht belegt (üblich: max 40 % / ⅓–½)

```
ID: NORM-001 · SEVERITY: HIGH (P1) · CATEGORY: Normative Attribution
FILE: lib/vde-standards.ts (LINE 95: VDE_MAX_CONDUIT_FILL_PERCENT = 60, „60% Maximum nach VDE 0100-520")
OBSERVATION: Recherche: In DE-Praxis/Normkontext gilt für Elektro-Installationsrohre max. 40 % der
  Querschnittsfläche (DIN VDE 0100-520-Kontext, diverses Fachschrifttum) bzw. nach DIN 18015-1 max. ⅓ bei
  Einzeladern und ½ bei Mantelleitungen [5](https://www.elektro.net/120698/mechanischer-schutz-fuer-leitungen-verpflichtend/),
  [1](https://bau.com/forum/installation/11219.php). Ein 60-%-Grenzwert ist in keiner gefundenen Quelle
  belegt. Die Empfehlung `recommendConduitType` kann damit ein zu kleines Rohr empfehlen (thermisch
  ungünstiger, Zugentlastung/Biegeradien real schlechter).
STATUS: UNVERIFIED → als INCORRECT-Attribution werten, bis eine Quelle 60 % belegt (Fakt 40 % besser belegt).
CONFIDENCE: Table-Werte (40 %, ⅓/½) mittlere Konfidenz (Fachpresse + Normenkontext), 60 % unbelegt.
FIX: 40 % (oder DIN-18015-1-Regeln ⅓/½ je Leitungstyp) verwenden UND Quelle + Stand im Kommentar nennen;
  oder Funktion als „Hersteller-Empfehlung" deklarieren und GUI-Kennzeichnung anpassen.
```

### NORM-002 — FUSE_MAP-Quellenzuordnung „DIN VDE 0298-4" ist falsch

```
ID: NORM-002 · SEVERITY: HIGH (P1) · CATEGORY: Normative Attribution
FILE: lib/electrical.ts (LINE 19: „DIN VDE 0298-4: max fuse ratings per conductor cross-section")
OBSERVATION: DIN VDE 0298-4 enthält Belastbarkeitstabellen + Korrekturfaktoren, keine
  „max fuse ratings per cross-section". Die Zahlen (16/20/25/32/50/63/80/…) entsprechen der verbreiteten
  Installationspraxis (B16@1.5mm², B20@2.5mm² …) [5](https://www.voltflow.net/blog/kabelquerschnitt-tabelle),
  die ihre eigentliche Begründung in der Koordination nach DIN VDE 0100-430/0100-52x hat.
STATUS: INCORRECT (Attribution). Werte als Praxiswerte PROBABLY CORRECT für feste Installation — für
  Fahrzeuginstallation (FLRY) UNVERIFIED.
CONFIDENCE: VERIFIED als Fehlzuordnung; korrekte Quelle wäre 0100-430 (+ Kontext).
FIX: Kommentar korrigieren; Grenzen aus der (einzigen!) Iz-Definition ableiten (siehe ELE-001).
```

### NORM-003 — VDE_AMPACITY: Werte ≈ 0298-4 Verlegeart B2, aber Abweichungen bei 50/70 mm² und falscher Anwendungskontext

```
ID: NORM-003 · SEVERITY: MEDIUM→HIGH (P1, wegen ELE-001-Kopplung) · CATEGORY: Normative Data
FILE: lib/electrical.ts (LINE 4–15)
OBSERVATION: Code: {16.5, 23, 30, 38, 52, 69, 90, 111, 136, 172}. veröffentlichte 0298-4-B2-Reihe
  (PVC, 30 °C, 2 belastete Adern): {16.5, 23, 30, 38, 52, 69, 90, 111, 133, 168}
  [4](https://www.elekrechner.com/tabellen/strombelastbarkeit) — Abweichung bei 50 mm² (136 vs 133)
  und 70 mm² (172 vs 168). Keine Quellen-/Editionsangabe im Code. Zudem ist B2 eine Verlegeart für
  Gebäudeinstallation; Fahrzeugleitungen (FLRY/feinstdrahtig) werden über DIN EN 1648-2 / ISO 6722
  dimensioniert — der Kontextwechsel ist nirgends begründet.
STATUS: UNVERIFIED (exakte Herkunft/Edition); Verwechslungsrisiko VDE/EN/ISO-Kontext (Aufgabenstellung §22).
CONFIDENCE: siehe Status.
FIX: Quelle+Edition dokumentieren; Werte mit der Referenz abgleichen; für Fahrzeugkontext EITHER
  EN-1648/ISO-6722-Tabelle ergänzen OR bewusste, dokumentierte konservative Annahme.
```

---

## D. DOMAIN FINDINGS

### DOM-001 — Kein Mehrleiter-/PE/N-Modell auf der 230-V-Seite (Single-Line-Approximation)

```
ID: DOM-001 · SEVERITY: HIGH (P1) · CATEGORY: Domain Model / NORMATIVE GAP
FILE: components/registry/builtinComponents.ts (shorePower/consumer230v: je EIN 'plus'-Handle), CableEdge.tsx:543
OBSERVATION: AC-Kanten sind EIN-Leiter-Abstraktionen (Handle 'plus'). L/N/PE existieren nur als Label-Text
  „3-adrig (L, N, PE)" — ein fachliches Versprechen ohne Modell. PE-Querschnittsregel (mind. S/2 bzw. nach
  ADI-Formel), Schleifenimpedanz/Abschaltbedingungen, Neutralleiterführung, Trenn-/Umschalteinrichtungen sind
  nicht darstellbar. Kein AC-Schutzorgan (MCB/RCBO) als Node; fuseSize auf AC-Kanten ist ein Zahlenfeld ohne
  Typ/Charakteristik/Breaking-Capacity.
STATUS: NORMATIVE GAP (in UI/Docs klar als Limitierung ausweisen, „3-adrig"-Chip entfernen oder als Annahme kennzeichnen).
CONFIDENCE: VERIFIED.
```

### DOM-002 — Kurzschluss, Abschaltvermögen, Batterieinnenwiderstand, C-Rate: nicht modelliert

```
ID: DOM-002 · SEVERITY: MEDIUM (P2) · CATEGORY: Domain Model / Limitierung
FILE: lib/vde-standards.ts (Batterie-Konstanten), fehlende Module
OBSERVATION: Keine Short-Circuit-Berechnung (R_i, I_k, I²t, Breaking Capacity der Sicherung), keine C-Rate/
  Dauerentladestrom-Prüfung der Batterie (capacity ≠ Strom!), kein BMS/Charge-Parameter-Modell, keine
  Peukert-/Wirkungsgradkorrektur der Kapazitätsschätzung. Ah×DoD ist die gesamte Batterielogik.
STATUS: Als fachliche Limitierung dokumentieren („keine Kurzschluss-/Abschaltvermögensprüfung") — derzeit
  verschweigt die UI das.
CONFIDENCE: VERIFIED (nicht vorhanden).
```

### DOM-003 — `unknown`-nahe Datenfelder in Node.data (Record<string, unknown>-Pattern) ohne Schema

```
ID: DOM-003 · SEVERITY: MEDIUM (P2) · CATEGORY: Domain Model / Type Safety
FILE: lib/vde-standards.ts (sData/tData as Record<string, unknown>), store/slices/persistence.ts
OBSERVATION: Elektrisch relevante Felder (watts, amps, nominalVoltage, chemistry, continuousPower, capacity,
  hours, rating, hasRcd) leben untypisiert in node.data; Lesen passiert diszipliniert über parseQuantity
  (gut!), aber es existiert kein deklaratives Schema (z. B. Zod) für Persistenz/Import — unbekannte/
  falsch getypte Felder werden still toleriert. Kein `any`/`as any` in Produktion gefunden (7 non-null
  Assertions in lib, jeweils begrüßt bewiesen) — Type-Safety insgesamt überdurchschnittlich.
STATUS: PROBABLY CORRECT (Laufzeitsicherheit über parseQuantity), aber Runtime-Schema fehlt (siehe PERSIST-001).
CONFIDENCE: VERIFIED.
```

---

## E. ROUTING FINDINGS

### ROUTE-001 — „Edge×Node = HARD" gilt nicht ausnahmslos (Fallback-Pfad & Ausnahmen)

```
ID: ROUTE-001 · SEVERITY: HIGH (P1) · CATEGORY: Routing Guarantee
FILE: components/edges/utils/pathfinding.ts (LINE 905–916 searchOnce-Fallback; 1053–1071 Stub-Toleranz;
  findCablePath Retry mit halbiertem Margin 7 px; searchObstacles „Rohbox+2px"-Stufe)
OBSERVATION: Drei dokumentierte Ausnahmen brechen die harte Kollisionsgarantie:
  (a) Fallback: wenn Katalog UND A* scheitern, wird der ungeprüfte Katalogpfad zurückgegeben
      (usedSearch='fallback', Telemetrie zählt — im 500-Knoten-Benchmark tritt er DUTZENDFACH auf);
  (b) Stub-Toleranz: Verletzungen nur in den Stub-Segmenten gegen entzerrte Boxen werden akzeptiert;
  (c) an Handles klebende Nodes: Box darf auf Rohbox+2px schrumpfen (clearance 12 px verletzt).
  Zusätzlich: Hindernisse, die Start/Ziel enthalten, werden GANZ verworfen (relevantObstacles/hananAStar
  solids-Filter) — eine überlappende fremde Node kann dann durchroutet werden.
STATUS: ADR-0009 („Overlaps verboten") im Strengsinn verletzt; Doku (ROUTING-V2 §12/R-3) nennt (a), nicht (b)/(c).
CONFIDENCE: VERIFIED (Code + Benchmark-Logs).
FIX: Fallback-Pfad mindestens gegen Rohboxen prüfen und als harte Verletzung im Invarianten-Report zählen;
  Ausnahmen (b)/(c) im Change Ledger dokumentieren; Hindernis-Verwurf nur auf die eigene Node, nicht ganz drop.
```

### ROUTE-002 — Kreuzungszählung auf Mittelpunkt-Linien statt echter Routen (zwei Kreuzungsbegriffe)

```
ID: ROUTE-002 · SEVERITY: MEDIUM (P2) · CATEGORY: Routing / Consistency
FILE: components/edges/utils/routingCache.ts (buildCrossingBase: center-to-center-Segmente), pathfinding.countCrossings,
      lib/routing/rules/hopping.ts (resolveHops auf echten Waypoints)
OBSERVATION: A*-Kosten & MAX_ACCEPTABLE_CROSSINGS zählen Kreuzungen gegen Gerade-Modell-Linien („grobe
  Strecken", kommentiert), während Hops hinterher auf den ECHTEN Polylines entschieden werden. Beide Begriffe
  können auseinanderlaufen (Kosten-Optimum ≠ Hop-Optimum). crossingSegmentsNear zusätzlich O(Kandidaten × E)
  durch inneren Identitätsscan (räumlicher Index teilweise konterkariert).
STATUS: PROBABLY CORRECT visuell, aber Invariante I10 („Crossing nur wenn unvermeidbar") nur auf Näherung geprüft.
CONFIDENCE: VERIFIED.
```

### ROUTE-003 — ELK & V2-Kollisionsmodell sind NICHT im Produktivpfad (Doku überzeichnet)

```
ID: ROUTE-003 · SEVERITY: MEDIUM (P2, Architektur) · CATEGORY: Spec vs Implementation
FILE: lib/routing/elk/* (nur scripts/regression, scripts/goldenmaster, ab-compare), lib/routing/rules/collision.ts
      (classifyCollision nur in Tests/Scripts), components/planner/utils/layout.ts (Produktionslayout =
      eigenes Spalten-Layout)
OBSERVATION: Das App-Layout nutzt das eigene 5-Rang-Spaltenlayout; Kantenrouting läuft ausschließlich über
  A*/routeAll. ROUTING-V2/ARCHITECTURE-CHANGES beschreiben „ELK Layered als globaler Layout-Pass … bestehender
  Router bleibt Fallback" (ADR-0011) — das beschreibt den Stand der Module + A/B-Gate, nicht die verdrahtete
  Anwendung. classifyCollision („EIN Modell für beide Pässe") wird vom A* nicht konsumiert (dieser nutzt
  tokens + COST_WEIGHTS + eigene segmentHitsRect-Prüfung).
STATUS: NORMATIVE GAP (Doku ≠ Implementation); „ELK/A*-Konsistenz" (§40) aktuell nur theoretisch herstellbar.
CONFIDENCE: VERIFIED (Import-Graph).
FIX: Entweder ELK-Pass in FlowCanvas/layout verdrahten (mit Session/Stale-Handling — runner.ts ist fertig)
  oder Doku auf „Vorbereitung, nicht aktiv" korrigieren; classifyCollision im A* als Freigabe-Prüfung einbinden.
```

### ROUTE-004 — Geometry: diagonal-Shortcut `segmentHitsRect → true` konservativ korrekt

```
ID: ROUTE-004 · SEVERITY: LOW (P4) · CATEGORY: Geometry
FILE: lib/routing/geometry/rects.ts (LINE 49)
OBSERVATION: Nicht-achsenparallele Segmente gelten pauschal als Treffer (konservativ, OK für orthogonales
  Routing; kann in Invarianten-Checks zu False Positives führen, wenn jemals Diagonalen geprüft werden).
  Kollinear/Touch/Zero-Length-Behandlung (segments.ts) ist mathematisch sauber (EPS-gesichert,
  Ende-an-Ende-Berührung korrekt KEIN Overlap). countBends/pathLength/simplify korrekt (Review + Tests).
STATUS: PROBABLY CORRECT; Verhalten dokumentieren.
```

---

## F. AUTOWIRE FINDINGS (jenseits ELE/CRASH)

### AUTO-001 — Länge-0-Kante lässt AutoWire crashen (Mm2-Brand-Grenzwidereinander)

```
ID: AUTO-001 (CRASH-002) · SEVERITY: HIGH (P1) · CATEGORY: Numerik / Units-Design
FILE: lib/units.ts (LINE 368 crossSectionForVoltageDrop; BOUNDS: Meters min 0 INKLUSIV, Mm2 min 0 EXKLUSIV),
      lib/autoWire/primitives.ts (LINE 71–81 crossSectionForDrop), store/slices/graphSlice.ts handleChangeLength
OBSERVATION: meters(0) ist gültig (beabsichtigt, „length: 0 nicht ersetzen"), aber crossSectionForDrop(I>0, 0m, ΔU)
  → A = 0 → mm2(0) wirft RangeError. Fuzz-Nachweis: 3 Crashes mit Stack über crossSectionForVoltageDrop.
  Realistischer Pfad: Import/Altdaten/localStorage mit length 0 + Auto-Verdrahten. (Inspector min=0.1 ist nur
  HTML-Attribut; Store validiert nicht.)
STATUS: VERIFIED (Laufzeitstack). Units-Design: zwei Marken mit inkompatiblen Null-Semantiken treffen auf dieselbe Formel.
FIX: crossSectionForVoltageDrop: Ergebnis ≤ 0 → MIN_CROSS_SECTION (symmetrisch zur 0-A-Guard) oder length ≤ 0 →
  Guard in crossSectionForDrop; außerdem handleChangeLength auf ≥ 0 clampen/validieren.
TEST: sizeDcEdges mit length 0 / negativ → kein Throw.
```

### AUTO-002 — Negative Kantenlänge: Anzeige zeigt negativen Spannungsfall (Fehlermaskierung)

```
ID: AUTO-002 · SEVERITY: MEDIUM (P2) · CATEGORY: Data Validation / Display
FILE: components/edges/CableEdge.tsx (Länge: data?.length ?? geometric — negativ wird angezeigt),
      components/edges/utils/voltageDrop.ts:92–99 (ownDrop roh berechnet, ohne Brand-Guard → negativ möglich:
      Probe P7: length −5 m → ownPct −4,49 %, Fehler Schwelle 3 % unterschritten → rote Kante wird grün)
OBSERVATION: persistiert length < 0 (Import, Altdaten) durchläuft die Anzeige-Rohmathik unvalidiert und
  REDUZIERT den angezeigten Spannungsfall — echte Über-Schwellen-Fälle können dadurch unsichtbar werden.
STATUS: UNSAFE (Anzeige) / VERIFIED.
FIX: edgeLength()/Anzeige: length < 0 → Warn-Chip „ungültige Länge" + Fallback; niemals negative Werte in
  Drop-Formeln lassen.
```

### AUTO-003 — AGM+Gel parallel erlaubt; Starter-/Mischchemie-Heuristik label-basiert

```
ID: AUTO-003 · SEVERITY: LOW (P3) · CATEGORY: Battery
FILE: lib/autoWire.ts (safeToParallel, isLeadChemistry), lib/autoWire/primitives.ts (isLeadChemistry: /agm|lead|gel|blei/i)
OBSERVATION: safeToParallel gleicht nur Spannung + „Blei vs. Li". AGM‖Gel ist laut Heuristik zulässig —
  unterschiedliche Ladeschlussspannungen (Gel ~14,1–14,4 V vs. AGM ~14,4–14,7 V) machen das fachlich
  fragwürdig (Dauerüber-/Unterladung eines Partners). Batterie-Klassifikation (Starter vs. Aufbau) solely
  über Label-Regex „start" — umbenannte Nodes wechseln die Rolle.
STATUS: PROABABLY CORRECT für Spannungstrennung; NORMATIVE GAP bei Chemieprofilen; Label-Heuristik fragil.
CONFIDENCE: VERIFIED (Code); fachliche Bewertung PROBABLY CORRECT (Herstellerpraxis).
```

### AUTO-004 — AutoWire-IDs sind pro Lauf neu (Zufall) — elektrische Ergebnisse deterministisch

```
ID: AUTO-004 · SEVERITY: LOW (P4, Dokuklarheit) · CATEGORY: Determinism
FILE: lib/autoWire/routing.ts (ensureNode → newEntityId)
OBSERVATION: Zweimaliges AutoWire auf demselben FRISCHEN Input erzeugt unterschiedliche Node-IDs
  (Probe P6: 'deterministic?: false' — nur ID-Differenzen; cs/fuse/längen identisch). Auf dem Ergebnis
  eines vorherigen Laufs ist AutoWire idempotent (Wiederverwendung über Label/Role; Golden-Master
  normalisiert IDs explizit auf auto:<i>:<slug>). ADR-0010 „same input → same output" gilt für das
  elektrische Ergebnis, nicht byte-identisch — should be documented.
STATUS: PROBABLY CORRECT (kein fachlicher Non-Determinismus), Dokumentationslücke.
```

---

## G. ARCHITECTURE FINDINGS

### ARCH-001 — Domänencode hängt an React-Flow-/Component-Typen (ADR-0008 im Wortlaut nicht erfüllt)

```
ID: ARCH-001 · SEVERITY: MEDIUM (P2) · CATEGORY: Architecture
FILE: lib/electrical.ts, lib/vde-standards.ts, lib/autoWire/* (import type {Node, Edge} from '@xyflow/react'),
      lib/autoWire/primitives.ts:2 (import type CableEdgeData from '../../components/edges/CableEdge')
OBSERVATION: Die elektrische Logik läuft OHNE React(Flow)-Runtime (probe-strapaziert — gut!), importiert aber
  Typen aus @xyflow/react und sogar aus components/ (Typ-only, zur Laufzeit entfernt). „Kann die Fachlogik ohne
  React Flow ausgeführt werden?" → JA (bewiesen). „Sind die Abhängigkeiten 0?" → NEIN (Typ-Ebene).
STATUS: PROBABLY CORRECT praktisch; ADR-0008-Konvention im Wortlaut verletzt (Domain-Types in lib/domain
  auslagern und in RF-Adapter mappen wäre sauberer).
```

### ARCH-002 — Verdrahtungs-Heuristiken im Store vs. reine Domäne

```
ID: ARCH-002 · SEVERITY: LOW (P3)
FILE: store/slices/graphSlice.ts (isValidConnection: Domain-/Polaritäts-/Serienschaltungslogik IM Store),
      store imports components/templates
OBSERVATION: Verbindungs-Regeln (fachliche Entscheidungen!) leben im State-Slice, nicht in lib — für Tests
  nur über Store erreichbar; Heilverhalten (healUserEdges) dagegen sauber in lib. Konsistenz der Polaritäts-
  regeln zwischen isValidConnection und collectEdgeErrors ist ungeschützt (replizierbar divergent).
STATUS: PROBABLY CORRECT, Wartbarkeitsrisiko (P2-Charakter bei Weiterentwicklung).
```

---

## H. PERSISTENCE / DATA INTEGRITY FINDINGS

### PERSIST-001 — Migration prüft nur Hüllen (id/position vorhanden), kein Feld-Schema

```
ID: PERSIST-001 · SEVERITY: MEDIUM (P2) · CATEGORY: Data Integrity / Runtime Validation
FILE: store/slices/persistence.ts (isNodeShape/isEdgeShape)
OBSERVATION: `position: null` oder `data: "x"` passieren die Migration; React-Flow-Rendering mit null-Position
  erzeugt NaN-Geometrie. Zahlenfelder sind downstream über parseQuantity/quantityOr geschützt (gut — NaN/negativ/
  Text → Fallback/0), aber: (a) Fallbacks ersetzen still (z. B. crossSection 0 → 2,5 mm² DEFAULT_EDGE_CROSS_
  SECTION in sizeDcEdges-Pfad, length ungültig → 1 m) — Daten und Anzeige können auseinanderlaufen;
  (b) kein Versions-Mechanismus über version 0→1 hinaus genutzt. Kein JSON-Datei-Import in der App (Angriffs-
  fläche klein); localStorage ist der einzige externe Input.
STATUS: PROBABLY CORRECT für Crash-Sicherheit („Retten statt Verwerfen" + Tests), NORMATIVE GAP für
  „Runtime-Schema-Validierung" (§44).
CONFIDENCE: VERIFIED.
FIX: Deklaratives Schema (z. B. zod) für Node/Edge-Data beim Rehydrate; ungültige elektrische Werte →
  Warnmarker statt stiller Fallbacks; position-Typ prüfen.
```

### CACHE-001 — Spannungsfall-Cache veraltet bei continuousPower/capacity/rating-Änderungen

```
ID: CACHE-001 · SEVERITY: HIGH (P1) · CATEGORY: Data Integrity / Validation Freshness
FILE: store/slices/graphInternals.ts (LINE 73–100 plannerGraphSignature; calculatePathVoltageDrop in graphSlice)
OBSERVATION: Signatur enthält nur {id,type,watts,amps,totalAmps,nominalVoltage,chemistry} bzw.
  {length,crossSection,edgeDomain} — **continuousPower** (treibt calculateEdgeCurrent Priorität 4!),
  capacity, hours, shorePower.rating, hasRcd fehlen. Probe B: sig(Inverter 1000 W) === sig(Inverter 3000 W
  continuousPower) → true; ebenso Bat 100↔400 Ah, Shore 16↔10 A. Da pathDropCache an der edges-Referenz hängt
  und die Signatur gleich bleibt, liefert calculatePathVoltageDrop ALTE Werte, bis ein anderes getracktes
  Feld sich ändert. Folge: Spannungsfall-Chips/Warn-zIndex können nach einer WR-Leistungsänderung falsch-
  grün bleiben (Stale-Validation).
STATUS: VERIFIED (Signatur-Gleichheit bewiesen; Stale-Effekt folgt unmittelbar aus Cache-Bedingung).
FIX: Signatur-Felder erweitern (continuousPower, rating, capacity, hours — am besten generisch über sortierte
  JSON-Signatur aller elektrisch relevanten Felder) oder Cache-Key über strenge Gleichheit der Nodes-Referenz.
TEST: continuousPower 1000→3000 → Drop-Wert muss sich ändern (Store-Test).
```

### PERSIST-002 — Undo/Redo: solide, mit bewusster Drag-Aggregation

```
ID: PERSIST-002 · SEVERITY: LOW (P4, Positiv+Randfälle)
FILE: store/slices/graphSlice.ts (withHistory/graphSnapshot), graphInternals (HISTORY_LIMIT 50)
OBSERVATION: Snapshots umfassen atomar alle 4 Graph-Arrays; withHistory leert historyFuture (korrekt);
  Drag-Positionen werden erst bei dragging=false checkpointed; Löschen entfernt abhängige Kanten mit in die
  History. Gefunden: focusElement/onSelectionChange ändern Selektion ohne History (gewollt). Kein Fehler
  gefunden; Undo nach applyTemplate erhält Wasser-Graph (dokumentierter Fix).
STATUS: PROBABLY CORRECT.
```

---

## I. SECURITY FINDINGS

```
ID: SEC-001 · SEVERITY: LOW (P3) · POSITIV-BEFUND MIT ANMERKUNGEN
- Keine Backend-/API-Fläche (statischer Export). Einzige externe Inputs: localStorage + PNG-Export.
- dangerouslySetInnerHTML genau 1× (app/layout.tsx:33) mit statischem, entwicklerkontrolliertem Theme-Snippet —
  keine Nutzerdaten → kein XSS-Vektor. Alle Labels/Texte laufen über React-Textrendering.
- Kein eval/new Function/innerHTML; keine URL-Verarbeitung von Nutzerdaten; prototype-pollution-Fläche
  minimal (kein deep-merge von Fremd-Objekten in den Store; migrate kopiert Felder whitelist-artig).
- PNG-Export (html-to-image) importiert keine Bilder extern (kein SSRF/CSP-Thema im statischen Setup).
- REST: „RESTMISSION-REPORT" dokumentiert Entfernung der API. VERIFIED am Import-Graphen (kein app/api).
ANMERKUNG: Wird jemals JSON-Import eingebaut, gilt PERSIST-001 als Security-Gate (Runtime-Schema zwingend).
```

---

## J. UX / WARNINGS FINDINGS

### UX-001 — Warnungen ohne Messwert/Grenzwert/Quelle-Struktur (§47/§25)

```
ID: UX-001 · SEVERITY: MEDIUM (P3) · CATEGORY: UX / Explainability
FILE: components/planner/hooks/useLiveValidation.ts (ValidationWarning: id/category/type/message/focus —
  KEINE Felder measuredValue/expectedValue/ruleId/source), CableEdge collectEdgeErrors (Strings)
OBSERVATION: „⚠️ Kritisch: Quellschutz fehlt! …" nennt weder Strom noch Leiterquerschnitt noch Grenzwert;
  Chip „Gesamt-Drop! (4.8% > 3%)" ist das beste Format (Messwert>Grenzwert), aber ohne Länge/Strom/cs/Quelle.
  Die geforderte Struktur {ruleId, severity, componentIds, connectionIds, measuredValue, expectedValue,
  source} existiert nicht. Positiv: Kategorien + Beheben-Fokus + Klartext-Folgen/Handlungsschritte
  (WarningCenter) sind da; „Springen zum Fehler" funktioniert (focusElement).
STATUS: NORMATIVE GAP gegenüber eigener Anspruchskette (ADR-0006 „Korrektheitskonventionen").
FIX: ValidationWarning um measured/expected/ruleId/source erweitern; Chips um Kontextwerte anreichern
  (I, cs, L sind an der Stelle eh vorhanden).
```

### UX-002 — Fachtexte (ExpertPanel) widersprechen den eigenen Tabellen

```
ID: UX-002 (SSOT-002) · SEVERITY: MEDIUM (P2→P3 wegen nur-Text) · CATEGORY: Single Source of Truth / UI-Wahrheit
FILE: components/planner/ExpertPanel.tsx (LINE 59–240)
OBSERVATION: „Für 1,5mm²: max. 15A" vs. FUSE_MAP 16 A; „Bei 35mm² → max. 150A" (mit Normzitat 0100-721!)
  vs. FUSE_MAP[35]=100 A; „100Ah LiFePO4 (1C) → min. 35mm²" vs. App-Sizing (lookupThermal(100A) → 70 mm²);
  „2000W → 50mm²/200A" vs. App-Sizing (→70 mm² gesättigt, s. ELE-002); „MPPT ~30 % effizienter als PWM";
  „100Ah LiFePO4 ersetzt 200Ah AGM" (bei 90 %/50 % DoD wären es ~180 Ah) — Faustregeln mit Normzitaten
  versehen, die die Werte nicht hergeben, und im Widerspruch zur Engine. „VDE-konform"-Formulierung wird
  größtenteils vermieden (gut), Normzitate an Texttips aber unbelegt.
STATUS: INCORRECT (Widerspruch Engine↔Text) — User-Verwirrung über die „richtige" Zahl ist garantiert.
FIX: Expert-Tipps aus denselben Tabellen generieren oder Werte angleichen; Normzitate nur mit Abschnitt.
```

### UX-003 — „3-adrig (L, N, PE)"-Chip & „RCBO empfohlen" ohne Modellgrundlage

```
ID: UX-003 · SEVERITY: LOW-MEDIUM · CATEGORY: UI-Wahrheit
FILE: components/edges/CableEdge.tsx (LINE 543, 554)
OBSERVATION: Die Kante suggeriert eine geprüfte 3-Leiter-Ausführung; das Modell kennt einen Leiter
  (DOM-001). „Empfohlen" statt Pflicht an einer Stelle, wo die Live-Validierung schweigt (AC-001).
STATUS: NORMATIVE GAP; Fix über DOM-001/AC-001.
```

---

## K. PERFORMANCE FINDINGS

### PERF-001 — Routing skaliert nicht: 500 Knoten ≈ 81 s (Main-Thread-Blockade)

```
ID: PERF-001 · SEVERITY: HIGH (P1) · CATEGORY: Performance
FILE: components/edges/utils/pathfinding.ts (hananAStar: Grid O(xs·ys) + Zellenprüfung gegen alle Solids),
      components/edges/utils/routingCache.ts (crossingSegmentsNear O(K×E))
OBSERVATION: Benchmark (routeAllCables, kompletter Neuaufbau; Grid-Topologie Batterie/Busbar/Consumer):
    10 Knoten/9 Kanten   ≈     2,2 ms
    50  /49              ≈    30,7 ms
    100 /99              ≈    20,9 ms   (> 16-ms-Budget, nur durch 100-ms-Throttle erträglich)
    250 /249             ≈   110,2 ms
    500 /499             ≈ 81 200 ms  (!!)  + dutzende „Fallback ohne Hindernisfreigabe"-Warnungen
  Treiber: Hanan-Grid wächst mit Hindernis-Ausdehnung (xs×ys bis 20 000 Zellen, jede gegen bis zu 500
  Solids geprüft); lange Ketten → riesige Envelope-Clips.
STATUS: VERIFIED (Messung). ADR-0012 (16 ms/Frame) wird ab ~100 Kanten plan-spezifisch und ab ~500
  Knoten katastrophal verletzt; Store-Level-Fallback (Telemetrie) bestätigt Guardrail-Überschreitung.
FIX: (a) relevantObstacles räumlich vorfiltern (BBox um Route ± Margin statt aller Nodes — Cache existiert
  bereits), (b) Zellen-Blockierung pro Obstacle in Grid-Markierung umwandeln statt segmentHitsAny je Zelle,
  (c) crossingSegmentsNear echte Index-Referenzen statt Identitätsscan, (d) Obergrenze + User-Hinweis.
```

### PERF-002 — Dashboard-Debounce & Kanten-Caches: gut (Positiv-Befund)

```
useDashboardMetrics debounced (300 ms) mit feldweisem Änderungscheck; routingCache/ObstacleMap WeakMaps;
KabelRouteSync throttled (100 ms, trailing garantiert); pathDropCache (siehe aber CACHE-001-Falle).
STATUS: PROBABLY CORRECT.
```

---

## L. DOCUMENTATION FINDINGS

```
ID: DOC-001 · SEVERITY: MEDIUM (P2)
- ROUTING-V2/ARCHITECTURE-CHANGES beschreiben ELK als „globalen Layout-Pass" (ADR-0011, A/B-Gate bestanden,
  „Router bleibt Fallback") — in der App ist ELK NICHT verdrahtet (ROUTE-003). Spec-vs-Impl-Tabelle §65 wäre
  für WP-4 „Spec ✓ / Code ✓(Modul) / Aktiv ✗".
- AUDIT.md/AUDIT-AUTOWIRE.md: vorbildlich ehrliche Vorgänger-Audits; deren „Issue-3/4/7/8/10"-Fixes wurden
  im Code nachgewiesen (Nacherschleife, Mischdomäne, Ground-Bond, Daisy-Chain, Marker-Kurzschluss).
- AUDIT-AUTOWIRE Claims, die heute (2026-09) nicht mehr/stark einschränkend gelten:
  „Idempotenz run2==run1" gilt für Ergebnisstruktur, nicht IDs (AUTO-004);
  „ΔU-Faktor-2 acceptable … overestimates conservative" — gilt weiter, aber AC/DC-Mischung in
  hasVoltageDropError (DC-Volts ÷ 230 V) ist dort nicht erfasst.
- README/ADR-Konsistenz sonst gut; ADR-0008 im Wortlaut durch Typ-Imports verletzt (ARCH-001).
```

---

## M. NORMATIVE UNCERTAINTIES (Regel-Matrix)

| Regel (Code-Behauptung)                                              | Behauptete Quelle                    | Implementiert                       | Bewertung                                                                                                                                                                             | Status                                      |
| -------------------------------------------------------------------- | ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Ampacity {16.5…172}                                                  | (implizit) DIN VDE 0298-4            | electrical.ts:4                     | Werte ≈ 0298-4 **B2** (30 °C, 2 Adern); 50/70 mm² weichen ab (136/172 vs 133/168 [4](https://www.elekrechner.com/tabellen/strombelastbarkeit)); Kontext Fahrzeug vs Gebäude ungeklärt | **UNVERIFIED**                              |
| FUSE_MAP „max fuse per cs"                                           | „DIN VDE 0298-4"                     | electrical.ts:20                    | 0298-4 enthält keine Fuse-Tabelle; Werte = Installationspraxis (0100-430-Kontext) [5](https://www.voltflow.net/blog/kabelquerschnitt-tabelle)                                         | **INCORRECT (Quelle)**                      |
| FUSE ≤ Iz-Koordination                                               | —                                    | selectFuseSize                      | im Modell gebrochen (ELE-001)                                                                                                                                                         | **INCORRECT (intern)**                      |
| Pauschal-Derate 0.7                                                  | —                                    | electrical.ts:17                    | ersetzt Temperatur+Häufung+Verlegeart; keine Quelle                                                                                                                                   | **UNVERIFIED / NORMATIVE GAP**              |
| 3 % Spannungsfall DC (0,36 V)                                        | „DIN VDE 0298-4"                     | electrical.ts:138, primitives.ts:23 | 0298-4 definiert keine 3-%-Grenze; übliche Grenzen: 0100-520-Anhang (3 % Licht/5 % übrige, Gebäude), Fahrzeugpraxis 2–5 % — Wert als Faustregel OK, Quelle falsch                     | **UNVERIFIED (Wert) / INCORRECT (Zitat)**   |
| 2 % AC (4,6 V)                                                       | Kommentar „conservative"             | electrical.ts:140                   | willkürlich-konservativ, ohne Quelle; Schwellenanzeige nutzt 3 % (6,9 V) — zwei Grenzen                                                                                               | **UNVERIFIED**                              |
| Leerrohr 60 %                                                        | „VDE 0100-520"                       | vde-standards.ts:95                 | Praxis/Normkontext: 40 % bzw. DIN 18015-1 ⅓/½ [5](https://www.elektro.net/120698/mechanischer-schutz-fuer-leitungen-verpflichtend/)                                                   | **UNVERIFIED→INCORRECT**                    |
| RCD ≤ 30 mA Landstrom                                                | DIN VDE 0100-721                     | useLiveValidation                   | für Caravan-Landstrom plausibel/einschlägig; Klausel nicht verifizierbar; Inverter-Seite fehlt                                                                                        | **PROBABLY CORRECT (Lücke AC-001)**         |
| 16 mm² Masseanbindung Karosserie                                     | — (Kommentar „VDE-Mindestanbindung") | autoWire.ts Ground-Loop             | keine Quelle auffindbar; plausible Praxis                                                                                                                                             | **UNVERIFIED**                              |
| 20 cm Hauptsicherung                                                 | Kommentar                            | CableEdge                           | ABYC ~178 mm/„as close as practicable" (ISO 10133) — nicht VDE; Position unmodelliert (ELE-004)                                                                                       | **UNVERIFIED**                              |
| Inverter-Wirkungsgrad 0.85, Vmp 18 V, Winter 0.35, DoD {0.9/0.5/0.3} | —                                    | vde-standards.ts                    | Hersteller-/Faustwerte, konservativ gewählt; als Konstanten dokumentiert                                                                                                              | **PROBABLY CORRECT (Annahmen, keine Norm)** |
| B2-Ampacity für Fahrzeug-FLRY                                        | —                                    | —                                   | FLRY → DIN EN 1648-2/ISO 6722-Kontext; Kontextwechsel nicht dokumentiert                                                                                                              | **NORMATIVE GAP**                           |

---

## TEST-COVERAGE-MATRIX (gemessener Stand; ✅=vorhanden, ⚠=teilweise, ❌=fehlt)

| Bereich                      | Happy          | Edge                             | Negative/Adversarial                                                         | Property                  | E2E                   |
| ---------------------------- | -------------- | -------------------------------- | ---------------------------------------------------------------------------- | ------------------------- | --------------------- |
| Ohm/Leistung (units)         | ✅             | ✅                               | ⚠ (0/NaN in Konstruktoren; **nicht** in calculateCrossSection-Kette)         | ✅ (units.typecheck)      | –                     |
| Strom (calculateEdgeCurrent) | ✅             | ⚠                                | ❌ (verpolte Batterie, Solar direkt→Batterie, Mischspannungsplan)            | ⚠                         | –                     |
| Cable sizing                 | ✅             | ⚠ (95 mm²-DC)                    | ❌ (>120-A-Sättigung, 24-V-Plan, Länge 0/negativ)                            | ✅ (vde-properties)       | –                     |
| Fuse sizing                  | ✅             | ✅                               | ❌ (FUSE_MAP-vs-Derate-Widerspruch wird von Test **maskiert**)               | ⚠                         | –                     |
| Voltage drop                 | ✅             | ⚠                                | ❌ (negative Länge, AC/DC-Mischung, Stale-Cache)                             | ✅ (Monotonie)            | –                     |
| AutoWire                     | ✅             | ✅ (Issues 1–11 aus Voraudit)    | ❌ (AC-95 mm²-Crash, Länge-0-Crash)                                          | ✅ (1000-Lauf-Idempotenz) | ⚠                     |
| Routing                      | ✅             | ✅                               | ⚠ (Fallback-Zähler, aber kein Test „Fallback nie Endresultat bei ≤X Knoten") | ✅ (Determinismus)        | ✅ (visual)           |
| Collision/Geometry           | ✅             | ✅ (kollinear/touch/zero-length) | ⚠                                                                            | ✅ (invariants I1–I7)     | –                     |
| ELK                          | ✅ (Modul/A-B) | ⚠                                | ❌ (kein Test „ELK aktiv in App")                                            | ✅ (cloneable/determ.)    | ❌                    |
| Persistence                  | ✅             | ✅ (teilkorrupt)                 | ⚠ (position null, Feld-Typen)                                                | ⚠                         | ✅ (persistence.spec) |
| Live-Validierung             | ✅             | ✅                               | ❌ (Inverter-RCD, verpolte Batterie, direktes Solar→Batterie)                | ❌                        | ⚠ (expert-panel.spec) |

**1751 grüne Tests stehen den P0-Befunden nicht entgegen — die Lücken liegen gezielt dort, wo grün getestet wurde, was die Implementierung absichert, nicht was die Norm verlangt.**

---

## SCORECARD (0–100; Durchschnitt versteckt nichts — P0 dominieren die Aussage)

| Kriterium                | Score  | Begründung (Kurz)                                                                                                                        |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Electrical Correctness   | **52** | Formeln (ΔU=2LI/κA, P/U) korrekt & branded; aber Strommodell-Topologieblind (ELE-005), 2×AC-Wahrheit (ELE-006), 12-V-Budget überall (P2) |
| VDE/Normative Confidence | **30** | 3 falsch/ungeklärte Quellenzuordnungen, 0 Klausel-Referenzen, Ampacity-Herkunft unklar                                                   |
| Safety (Planungsrisiko)  | **45** | RCD-Regel + Quellschutz-Regel existieren; aber ELE-001/002/003 + fuse position unmodelliert                                              |
| Cable Sizing             | **55** | saubere Zwei-Kriterien-Suche + Budget-Iterierung; Sättigung still (ELE-002), Kontexttabellen unklar                                      |
| Fuse Sizing              | **40** | _normale_ Auswahl ok; Koordination widersprüchlich (ELE-001), 20-cm-Regel Placebo (ELE-004)                                              |
| Voltage Drop             | **70** | Formel & Kumulation korrekt & getestet; Grenzwerte doppelt/doppelt begründet, Cache-Stale, Negativ-Länge                                 |
| Battery Logic            | **50** | DoD/Spannungswahl ok; keine C-Rate/Ströme/Peukert, Parallelausnahme AGM+Gel, Label-Heuristik                                             |
| Solar Logic              | **40** | Vmp-Strommodell; Isc/Voc-kalt/MPPT-Fenster fehlen                                                                                        |
| AC Logic (230 V)         | **35** | Domain-Gate stark; aber 1-Leiter-Modell, kein RCD am WR, kein PE-Modell                                                                  |
| DC Logic (12 V)          | **65** | Backbone-Topologie + Shunt-Regeln + Polaritäts-Gate; Serie-/Paradoxlücke (ELE-003)                                                       |
| AutoWire                 | **60** | herausragende Heilungs-/Idempotenzlogik; 2 Crash-Pfade, Phantomlasten                                                                    |
| Domain Model             | **55** | gute Typmärke, aber fachliche Felder untypisiert in data, PE/N fehlen                                                                    |
| Routing                  | **72** | A* + Geometrie + Lanes/Hops deterministisch & getestet; Garantielücken (ROUTE-001), Näherungs-Kreuzungen                                 |
| Collision Handling       | **75** | mathematisch sauber;zwei Wahrheiten (V2-Modul ungenutzt)                                                                                 |
| Determinism              | **80** | Routing/AutoWire-Ergebnisse deterministisch (bewiesen); IDs zufällig, Dokuklarheit fehlend                                               |
| Data Integrity           | **60** | Migration & Debounce solide; Hüllencheck only, stiller Fallback, Cache-Stale-Bug                                                         |
| Testing                  | **68** | 1751 Tests, Property-/Golden-/RegRESSION-Harness; adversariale elektrische Lücken                                                        |
| Architecture             | **70** | klare Schichtung; Typ-Abhängigkeiten lib→components, ELK unverdrahtet, Store-Regeln                                                      |
| Security                 | **85** | minimale Fläche, kein XSS, saubere Whitelist-Migration                                                                                   |
| UX                       | **70** | Warn-Zentrale mit Beheben/Fokus stark; Messwert-/Quellenstruktur fehlt, Widerspruchs-Texte                                               |
| Performance              | **50** | <100 Kanten gut (Caches, Throttle); 500 Knoten = 81 s → unbrauchbar                                                                      |
| Documentation            | **60** | außergewöhnlich ehrliche Audits/ADRs; ELK-Status & einige Behauptungen überzeichnet                                                      |

**Gesamt: NICHT production ready — 4 P0 blockieren.**

---

## N. RECOMMENDED ROADMAP

**P0 (sofort, vor jedem „produktiv"):**

1. ELE-001: Eine Iz-Wahrheit + Koordinationstest (FUSE_MAP ≤ Iz) — bewusster Golden-Master-Recapture.
2. ELE-002: thermWarning bei Sättigung + Property-Test.
3. ELE-003: Verpolungs-/Serie-Validator (critical).
4. CRASH-001 + AUTO-001: sizeAcEdges-Normierung + Länge-0-Guard + Fuzz-Regression im CI (fuzz-suite gegen performAutoWiring, 1000 Läufe, „wirft nie").

**P1 (nächster Sprint):** 5. CACHE-001 Signatur erweitern (continuousPower/rating/capacity) + Store-Test. 6. ELE-006: AC-Strom auf EINE Funktion; ExpertPanel anschließen. 7. AC-001: RCD-Regel Inverter-Kreis; DOM-001/UX-003: „3-adrig"-Chip entfernen oder als Annahme kennzeichnen. 8. PERF-001: räumliche Hindernisvorfilter + Grid-Markierung; >250-Knoten-Benchmark ins CI. 9. NORM-001/002/003: Quellen korrigieren/dokumentieren (auch ExpertPanel-Texte UX-002) — oder Abschwächung aller Normzitate zu „nach implementierten Regeln".

**P2 (Quartal):** 10. ROUTE-003: ELK verdrahten oder Doku korrigieren; classifyCollision in A* einbinden. 11. PERSIST-001: Runtime-Schema (z. B. zod) für Rehydrate + Warnmarker statt stiller Fallback. 12. ELE-004: fuseOffset-Modell + Validierung; UX-001: structured warnings (ruleId/measured/expected/source). 13. ELE-007: Solar-Datenmodell (Isc/Voc/TempKoeff) + MPPT-Fenster-Regel. 14. DOM-002: Kurzschluss-/Abschaltvermögens-Modell oder explizite Limitierungs-Erklärung in UI/Doku.

---

## ABSCHLUSSBEDELINGUNG / ERLAUBTE SCHLUSSFOLGERUNG

Für jede geprüfte Kernregel kann dieses Audit sagen: **was** die Regel ist, **wo** sie implementiert ist, **welche Tests** sie absichern — aber für die normativen Quellen (Ampacity-Tabellenausgabe, Fuse-Grenzen, 60-%-Füllgrad, 3-%-Grenze, 16-mm²-Masse, 20-cm-Regel) fehlen belastbare Klausel-Referenzen ganz oder teilweise. **Daher: „Im geprüften Umfang wurden nachweisbare Fehler gefunden (4× P0, 12× P1); die normative Konformität ist NICHT verifizierbar und wird durch falsche Quellenzuordnungen aktiv überschätzt."** Das System ist ein Planungswerkzeug mit roten Warnungen — kein Nachweis einer VDE-konformen Auslegung. Bis ELE-001/002/003 und CRASH-001 behoben sind, gilt: **BLOCKING.**
