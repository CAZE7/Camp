# Master-Audit CAMP Elektroplaner

**Scope:** Elektroplaner-Modul (elektrisches Wiring, Dimensionierung, Absicherung, Validierung, Routing/Lesbarkeit). Unbeteiligte App-Bereiche wurden nur berührt, wo sie direkt relevant sind.
**Bewertungsmethode:** Nur tatsächlich implementierter Code. Quellcode gelesen; Logik mit temporären Vitest/tsx-Proben gegen echte Fixtures und Referenzpläne geprüft; temporäre Proben danach entfernt. Vorhandene Projekt-Testsuite war im Verlauf der Audit-Session vollständig grün (**136 Testdateien / 1854 Tests**; die README-Angabe 1265 ist veraltet).
**Labels:** VERIFIED / INCORRECT / SAFETY CRITICAL / UNVERIFIED. Prioritäten: P0 SAFETY CRITICAL, P1 HIGH, P2 MEDIUM, P3 LOW.

---

## 0. Umsetzung nach dem Audit (Stand dieser Session)

Die prüfbaren Findings wurden im Code umgesetzt. Die Gesamttestsuite ist nach dem Merge des Basis-Branch-Stands (#423 routing/logic) **137 Dateien / 1880 Tests grün**, `typecheck` und `typecheck:tests` ebenfalls grün. Die Golden-Master-Baseline wurde mit `npm run goldenmaster:capture` neu eingefroren (nur durch die bewusst korrigierten Template-Sicherungen verändert).

| Finding                             | Status                             | Kernänderung                                                                                                                                                                                                                                                         |
| ----------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 Serien-Kurzschluss             | ✅ behoben                         | `isConnectionAllowed` lässt Batterie×Batterie plus↔minus nicht mehr zu; `healUserEdges` verwirft solche Alt-Kanten; Regressionstests ergänzt.                                                                                                                        |
| F-02 Solar-Direktanschluss          | ✅ behoben                         | `isConnectionAllowed` blockiert Solar↔Batterie/Verbraucher; AutoWire verwirft alte Direktkanten; Live-Validierung erkennt Import-Direktverbindungen kritisch.                                                                                                        |
| F-03 Solar ohne Sicherung           | ✅ behoben                         | `solar`/`roofSolar` in `HIGH_POWER_SOURCE_TYPES`; fehlende Solar-Sicherung ⇒ `missing-fuse`/`fuse-missing`.                                                                                                                                                          |
| F-04 AC-Ströme Display vs. AutoWire | ✅ behoben                         | Display (`CableEdge`/`edgeDropInputs`) nutzt jetzt dieselbe per-Kante-Quelle `acCurrentA` wie `sizeAcEdges`.                                                                                                                                                         |
| F-05 BMS-/24-V-Modell               | ✅ teilbehoben                     | `nominalVoltage` + BMS-Grenzwerte im Battery-Inspektor; Live-Warnung bei Überschreitung der BMS-Dauerstromgrenze; Cache-Signatur erweitert.                                                                                                                          |
| F-06 Template-Sicherungen           | ✅ behoben                         | ALLROUNDER/AUTARK auf `FUSE_MAP`-konforme Werte + Solar-Fuses korrigiert; Template-Probe erzeugt keine Kantenfehler mehr.                                                                                                                                            |
| F-07 Routing-Final-Gate             | ✅ behoben (transparenter UI-Flag) | `CableRouteSync` publiziert zusätzlich den `validateFinalRouting`-Report derselben Waypoints; neues `RoutingStatusBadge` zeigt dauerhaft „Routing verifiziert“ oder „Routing: n Zwänge nicht erreicht“, inkl. I1/I2/I3-Tooltip. Kein stiller `INVALID`-Zustand mehr. |
| F-08 AC-Sicherung                   | ✅ behoben                         | AC-Kanten bekommen `maxFuseForDisplay`; vorhandene AC-Sicherung wird gegen Kabelträgheit geprüft (`fuse-too-large`).                                                                                                                                                 |
| F-09 negative/NaN-Last              | ✅ teilbehoben                     | Live-Warnung `invalid-load-*` bei negativen/nicht-endlichen `watts`/`amps`; Importwerte werden nicht mehr still vertuscht.                                                                                                                                           |
| F-10 AC-Global-Summe                | ✅ behoben                         | `acCurrentA` dimensioniert über die AC-Insel-BFS des betroffenen Inverters; `sizeAcEdges` reicht die Kantenliste durch.                                                                                                                                              |

**F-07 als „offen“ gilt nicht mehr:** Die finale Routing-Invariante wird bei den Referenzplänen weiterhin nicht auf 0 gesenkt (Router-Arbeit steht weiter auf der Roadmap). Der Audit-Find war aber zu Recht, dass `INVALID` im Renderpfad unsichtbar blieb. Genau das ist jetzt behoben: `CableRouteSync` publiziert denselben Report wie das CI-Gate, und `RoutingStatusBadge` zeigt ihn in der Planner-Kopfzeile an. Ein „Routing nicht layout-verifiziert“-Zustand ist damit für den Nutzer sichtbar, bevor er sich auf den Plan verlässt.

---

## 1. Findings

### F-01 · P0 · SAFETY CRITICAL · AutoWire erzeugt aus einer Serien-Verbindung einen Kurzschluss

- **ID:** AUDIT-ELE-001-SERIES-SHORT
- **SEVERITY:** P0 SAFETY CRITICAL
- **CATEGORY:** Auto-generierte Verdrahtung / Verhinderung falscher Verbindungen
- **FILE:** `lib/autoWire.ts` (Zeilen 289–330), `lib/connectionRules.ts` (Zeilen 58–64), `components/planner/hooks/useLiveValidation.ts` (Zeilen 130–183)
- **FUNCTION:** `performAutoWiring`, `isConnectionAllowed`, „Rule A3“ in `useLiveValidation`
- **PROBLEM:** Eine bewusst gezogene Serien-Kante zwischen zwei 12-V-Batterien (`B1.plus → B2.minus`, „24-V“) wird von `isConnectionAllowed` als zulässige Serien-Exception akzeptiert. `performAutoWiring` setzt jede weitere Aufbaubatterie unabhängig davon parallel auf **dieselben** Plus-/Minus-Schienen. Ergebnis bei einer Probe (`B1`, `B2`, Consumer, Kante `series`):
  - `B1.plus → B2.minus` (Serien-Kante)
  - `B1.minus → Shunt.minus`
  - `B2.minus → Shunt.minus`
  - `B2.plus → Plus-Schiene.plus`
  - beide Minuspole sind damit am Shunt verbunden, während `B1.plus` direkt auf `B2.minus` liegt
- **WHY IT IS WRONG:** Die Kombination „Serienkante plus gemeinsamer Minusschiene“ schließt `B1.plus` über die Serienkante und den gemeinsamen Minuspfad direkt auf `B1.minus` — ein Kurzschluss des Batteriepakets. Das Modell kann keine Serienschaltung (24 V), es behandelt sie nur als verbotenes/verpoltes Parallelbild, entfernt die Kante aber nicht.
- **REALISTIC EXAMPLE:** Nutzer will aus zwei 100 Ah LiFePO4 ein 24-V-System bauen und verbindet „Plus → Minus“. Er klickt „Automatisch verbinden“, weil er auf die Topologie vertraut. AutoWire baut zusätzlich die gemeinsame 12-V-Schiene, die Serienkante bleibt erhalten.
- **CURRENT BEHAVIOR:** AutoWire erzeugt die kurzschlussbehaftete Topologie. Es wird lediglich die Warnung `reversed-polarity-series` angezeigt. Die Kante wird nicht geheilt, der Zustand nicht blockiert.
- **EXPECTED BEHAVIOR:** Serien-Verbindungen entweder als eigenes Modell (24-V-Schiene, gesonderte Dimensionierung) unterstützen oder beim AutoWire-Setup ablehnen/entfernen. Auf keinen Fall darf eine Serienkante zusammen mit der gemeinsamen Minusschiene bestehen bleiben.
- **SAFETY IMPACT:** Direkter Batteriekurzschluss, kA-Ströme, Brand-/Explosionsgefahr.
- **UX IMPACT:** Nutzer erhält eine „korrekte“ AutoWire-Topologie mit nur einer Warnung im Hintergrund; er glaubt, ein 24-V-System zu haben.
- **RECOMMENDED FIX:** In `healUserEdges`/`performAutoWiring` Serien-Batteriekanten erkennen und entweder (a) die Serienkante droppen und eine klare Meldung „Serienschaltung nicht modelliert — Bitte parallel verdrahten oder 24-V-Gerät manuell planen“ erzeugen oder (b) eine echte 24-V-Topologie mit getrennten Schienen implementieren. Zusätzlich eine P0-Regel: AutoWire darf keine Grundschiene erzeugen, solange eine plus↔minus-Kante zwischen Batterien existiert.
- **REGRESSION TEST:** `performAutoWiring(B1, B2, seriesEdge, consumer)` darf keinen Pfad erzeugen, in dem zwei Batterien am selben Minus liegen, während zusätzlich eine `plus→minus`-Kante besteht; Warnung muss `critical` bleiben.

---

### F-02 · P1 · HIGH · Direktverbindung Solar → Batterie und Batterie → Solar wird nicht verhindert, übersteht AutoWire, keine Warnung

- **ID:** AUDIT-ELE-002-SOLAR-DIRECT
- **SEVERITY:** P1 HIGH (mit sicherheitskritischem Potenzial)
- **CATEGORY:** Korrekte Komponentenverbindungen / Verhinderung falscher Verbindungen
- **FILE:** `lib/connectionRules.ts` (Zeilen 55–64), `lib/autoWire/routing.ts` (Zeilen 238–352 `healUserEdges`), `components/planner/hooks/useLiveValidation.ts` (Zeilen 103–135), `components/edges/CableEdge.tsx` (Zeilen 87–94, 221–236)
- **FUNCTION:** `isConnectionAllowed`, `healUserEdges`, `useLiveValidation`, `collectEdgeErrors`
- **PROBLEM:** `isConnectionAllowed` erlaubt `solar.plus → battery.plus` **und** `battery.plus → solar.plus` (getestet: beide `true`). `healUserEdges` behandelt nur Batterie→Verbraucher/Inverter/Lader/Konsumenten, aber keinen Fall `solar → battery`. Das Live-Validation Hook und `collectEdgeErrors` betrachten `solar` nicht als Hochstromquelle, prüfen also keinen fehlenden Quellschutz. In einer Probe mit Solar 200 W + Batterie + vorhandenem `solar→battery`-Direktkabel erzeugt AutoWire zwar einen MPPT und zusätzliche Solar→MPPT-Kanten, lässt die ursprüngliche Direktkante aber **unverändert** bestehen; Live-Warnungen waren leer.
- **WHY IT IS WRONG:** Ein Solarmodul bei ~18 V Vmp/MPP darf nicht direkt an eine 12,8-V-Batterie ohne Laderegler angeschlossen werden. In der anderen Richtung speist die Batterie das Panel bzw. entlädt nachts über die Diodenstrecke. Das Modell unterscheidet „Solar-Zuleitung zum Regler“ und „Direktanschluss an die Batterie“ nicht.
- **REALISTIC EXAMPLE:** Nutzer zieht aus der Seitenleiste Solar + Batterie und verbindet die Pluspole. Das System zeigt „keine Hinweise“, AutoWire legt zusätzlich einen MPPT an, der Nutzer hält die Direktverbindung für harmlos.
- **CURRENT BEHAVIOR:** Verbindung erlaubt; keine Warnung; AutoWire behält die Direktkante und ergänzt parallel den korrekten MPPT-Pfad.
- **EXPECTED BEHAVIOR:** Direkt `Solar→Batterie` ohne Laderegler blockieren oder automatisch auf `Solar→MPPT→Batterie` umheilen; `Batterie→Solar` blockieren; bei bestehenden Importplänen mindestens eine kritische Warnung mit Fokus auf die Kante.
- **SAFETY IMPACT:** Überladung/thermische Schädigung der Batterie, Rückstrom, falscher PV-Betrieb.
- **UX IMPACT:** Nutzer sieht einen grünen Plan mit doppeltem Pfad und keiner Erklärung.
- **RECOMMENDED FIX:** Solar↔Batterie-Paar in `isConnectionAllowed` verbieten (außer über MPPT-Node); `healUserEdges` umleiten; in `useLiveValidation` Regel A um `solar` (nur bei direktem Batterieziel) ergänzen.
- **REGRESSION TEST:** `isConnectionAllowed({solar,battery})` → `false`; AutoWire fixt einen vorhandenen `solar→battery`-Edge durch Retarget auf MPPT oder droppt ihn; `useLiveValidation` liefert `critical` mit `focusType:'edge'`.

---

### F-03 · P1 · HIGH · Nutzergezogene unbeschaltete Solar-Zuleitung wird nicht als fehlende Sicherung gemeldet

- **ID:** AUDIT-ELE-003-SOLAR-NO-FUSE
- **SEVERITY:** P1 HIGH
- **CATEGORY:** Sicherungsauswahl / zuverlässige Verhinderung falscher Pläne
- **FILE:** `components/edges/CableEdge.tsx` (Zeilen 87–94, `HIGH_POWER_SOURCE_TYPES`; Zeile 227 `needsSourceFuse`), `components/planner/hooks/useLiveValidation.ts` (Zeilen 120–129)
- **FUNCTION:** `collectEdgeErrors`, `useLiveValidation` Rule A
- **PROBLEM:** `HIGH_POWER_SOURCE_TYPES` enthält bewusst **kein** `solar`/`roofSolar`. Ein Plus-Kabel `Solar → MPPT` ohne `fuseSize` erzeugt daher weder in `collectEdgeErrors` noch in `useLiveValidation` eine Warnung. Probe: Solar 200 W → MPPT, 3 m, keine Sicherung → **`[]`** in beiden Prüfpfaden. Der Autor selbst berechnet für die Kante einen Mindest-Sicherungsstrom (`solarEdgeFuseFloorOf` ≈ 1,56 × Isc ≈ 21,7 A), nutzt ihn aber nur, sobald eine Sicherung vorhanden ist.
- **WHY IT IS WRONG:** Eine PV-String-Zuleitung ist eine stromführende Seite mit eigener Kurzschlussgefahr. Der eigene Fuse-Floor (NEC 690.8/690.9 als dokumentierte Modellannahme) zeigt, dass die Absicherung fachlich gefordert ist. Fehlt sie, wird das nicht gemeldet.
- **REALISTIC EXAMPLE:** Nutzer zeichnet Panel→MPPT manuell, vergisst die Sicherung; direkt daneben hat er eine Batterie→Inverter-Leitung, die kritisch abgemahnt wird — die gefährlichere PV-Leitung bleibt grün.
- **CURRENT BEHAVIOR:** Keine Warnung; `collectEdgeErrors` gibt erst mit vorhandener Sicherung ein `fuse-below-minimum`; Live-Validierung ebenfalls leer.
- **EXPECTED BEHAVIOR:** `HIGH_POWER_SOURCE_TYPES` um Solartypen erweitern oder eine eigene Solar-Quellschutz-Regel ergänzen, die bei fehlender Sicherung `fuse-missing`/`missing-fuse-*` erzeugt.
- **SAFETY IMPACT:** ungeschützte PV-Leitung bei Fehler: Lichtbogen/Brand.
- **UX IMPACT:** „Keine Hinweise“-Status trotz Schutzlücke.
- **RECOMMENDED FIX:** Solar-Quellkanten in Rule A und `collectEdgeErrors` als schutzpflichtige DC-Plus-Kanten behandeln; Fuse-Floor aus `solarEdgeFuseFloorOf` verwenden.
- **REGRESSION TEST:** Solar→MPPT ohne fuse → mindestens ein `critical` Fehler `missing-fuse`; mit fuse < floor → `fuse-below-minimum`.

---

### F-04 · P1 · HIGH · AC-Ströme in Anzeige/Validierung und AutoWire-Dimensionierung divergieren

- **ID:** AUDIT-ELE-004-AC-CURRENT-PARITY
- **SEVERITY:** P1 HIGH
- **CATEGORY:** Stromberechnung / korrekte Kabeldimensionierung
- **FILE:** `lib/vde-standards.ts` (Zeilen 513–570 `calculateAcEdgeCurrent`), `lib/autoWire/sizing.ts` (Zeilen 332–397 `acCurrentA`, 338–345 `total230vLoad`), `components/edges/utils/voltageDrop.ts` (Zeilen 34–52 `edgeDropInputs`)
- **FUNCTION:** `calculateAcEdgeCurrent`, `acCurrentA`, `edgeDropInputs`, `sizeAcEdges`
- **PROBLEM:** In einer gemischten AC-Insel `Landstrom → 230-V-Verbraucher(300 W)` + `Landstrom → AC-Ladegerät(20 A)` liefert `calculateAcEdgeCurrent('sp', …, edges)` **1,30 A** (nur Verbraucher), `acCurrentA(sp, charger)` dagegen **20 A**. Ursache: `calculateAcEdgeCurrent` summiert zunächst alle erreichbaren `consumer230v` und **kehrt sofort zurück**, wenn diese Summe > 0 ist — die `acBatteryCharger`-Stromaufnahme wird in diesem Fall nie berücksichtigt. `acCurrentA` ist die Dimensionierungsquelle (AutoWire) und liefert den korrekten 20-A-Wert. Die Anzeige (`edgeDropInputs`) verwendet `calculateAcEdgeCurrent`.
- **WHY IT IS WRONG:** Die Funktion bewirbt sich selbst als „einzige Quelle“ für Anzeige/Validierung, weicht aber gerade bei der realen Mischlast ab. Wer dem Kabel-Label vertraut (bei 10 m: „1,5 mm²“ statt korrekt „4 mm²“), unterdimensioniert die Leitung. AutoWire selbst hat korrekt dimensioniert, die UI zeigt aber einen konkurrierenden, zu kleinen Wert.
- **REALISTIC EXAMPLE:** Landstromseite: 300-W-Steckdose + 20-A-Batterielader; Kante `shore→charger`, 10 m, `data.crossSection=1.5` (Import). Edge-Label zeigt `1.30 A / 1.5 mm²`; ein Nutzer, der das Label in den Shop übernimmt, nimmt ein zu dünnes Kabel.
- **CURRENT BEHAVIOR:** AutoWire `sizeAcEdges` korrekt (20 A → 4 mm² bei 10 m); Anzeige/Validation zeigt 1,30 A / 1,5 mm².
- **EXPECTED BEHAVIOR:** Eine einzige AC-Stromquelle, die je Kante die korrekte Last bestimmt (Verbraucher-Summe der Insel **plus** Ladestrom, wenn die Kante einen AC-Lader speist); `edgeDropInputs`, `CableEdge` und `sizeAcEdges` müssen übereinstimmen.
- **SAFETY IMPACT:** Unterdimensionierung, wenn der Nutzer die angezeigte Empfehlung übernimmt.
- **UX IMPACT:** Widersprüchliche Zahlen zwischen Label und Experten-Inspektor verunsichern und erzeugen unklare Pläne.
- **RECOMMENDED FIX:** `calculateAcEdgeCurrent` nach erfolgreichem Verbraucher-Scan zusätzlich die `acBatteryCharger`-/Shore-Rating-Components in der Insel einbeziehen; gemeinsame Funktion für Display+Dimensionierung; Regressionstest mit gemischter Insel.
- **REGRESSION TEST:** shore + 300 W consumer + 20 A charger: `calculateAcEdgeCurrent(sp)` und `acCurrentA(sp, charger)` müssen beide 20 A liefern; `edgeDropInputs` für die 10-m-Ladekante muss 4 mm² empfehlen.

---

### F-05 · P1 · HIGH · BMS-Grenzwerte und explizite Systemspannung sind im Datenmodell vorhanden, aber nicht im UI/der Validierung

- **ID:** AUDIT-ELE-005-BMS-VOLTAGE-MODEL
- **SEVERITY:** P1 HIGH
- **CATEGORY:** Modellierung / korrekte Dimensionierung
- **FILE:** `components/nodes/types.ts` (Zeilen 53–57), `lib/nodeSchema.ts` (Zeilen 58–62), `components/inspector/NodeInspectors.tsx` (Zeilen 77–137 `BatteryInspector`)
- **FUNCTION:** `BatteryNodeData`, `NODE_DATA_SCHEMA`, `BatteryInspector`
- **PROBLEM:** `BatteryNodeData`/`NODE_DATA_SCHEMA` deklarieren `hasInternalBms`, `hasExternalBms`, `bmsContinuousDischarge`, `bmsPeakDischarge`, `bmsContinuousCharge`. Kein einziger Produktionspfad liest diese Felder (Grep: nur Typdeklaration/Tests). Der `BatteryInspector` zeigt nur Kapazität und Chemie — weder `nominalVoltage` noch BMS-Grenzwerte sind editierbar. `getSystemVoltage` liest zwar `nominalVoltage`, aber der UI-Pfad kann ihn nicht setzen; 24-V-Systeme sind damit praktisch nicht modellierbar (Ausnahme: Import).
- **WHY IT IS WRONG:** AutoWire dimensioniert Leitung und Sicherung nach Verbraucher-/Inverterstrom, nicht nach der BMS-Dauerstromgrenze. Eine Batterie mit BMS-Limit von 50 A und einem 1500-W-Inverter (~138 A) kann automatisch über den zulässigen BMS-Strom dimensioniert werden, ohne dass es auffällt.
- **REALISTIC EXAMPLE:** Importierter Plan mit `battery.data.nominalVoltage=24` und `bmsContinuousDischarge=50`; AutoWire erzeugt einen 100-A-Hauptstrang; kein Feld ist sichtbar oder geprüft.
- **CURRENT BEHAVIOR:** 24-V-Spannung wird korrekt in Rechnungen verwendet, wenn sie im Import steht; BMS-Grenzen werden vollständig ignoriert.
- **EXPECTED BEHAVIOR:** `nominalVoltage` und BMS-Grenzen im Battery-Inspektor pflegbar; Cache-Signatur und Validierung um diese Felder ergänzt; AutoWire begrenzt `selectFuseSize`/Dimensionierung auf die BMS-Grenze oder warnt kritisch.
- **SAFETY IMPACT:** Überlastung der Batterie/BMS, Schutzauslösung, mögliche Zellschäden.
- **UX IMPACT:** Nutzer kann ein „sicheres“ 24-V-System nicht vollständig eintragen; Importpläne erscheinen validiert, obwohl Schutzgrenzen fehlen.
- **RECOMMENDED FIX:** BMS- und Spannungsfelder im Inspector ergänzen; `calculateEdgeCurrent`/`sizeDcEdges`/`applyFuseSizes` um BMS-Limit erweitern; `plannerGraphSignature` um die Felder ergänzen; Audit-/Warnregel „BMS-Limit unterschritten“ hinzufügen.
- **REGRESSION TEST:** Batterie mit `bmsContinuousDischarge=50` + Inverter 1500 W ⇒ AutoWire muss entweder Kabel/Fuse ≥ BMS-Limit ausgleichen oder kritisch warnen; `plannerGraphSignature` ändert sich bei BMS-Änderung.

---

### F-06 · P2 · MEDIUM · Ausgelieferte Referenz-Templates enthalten Sicherungen oberhalb des Kabel-Maximalwerts

- **ID:** AUDIT-ELE-006-TEMPLATE-FUSES
- **SEVERITY:** P2 MEDIUM
- **CATEGORY:** Sicherungsauswahl / Referenzplan-Korrektheit
- **FILE:** `components/planner/templates.ts` (ALLROUNDER: Zeilen 150–240; AUTARK: Zeilen 340–430)
- **FUNCTION:** `TEMPLATE_ALLROUNDER`, `TEMPLATE_AUTARK`
- **PROBLEM:** Laden eines Referenzplans erzeugt sofort `fuse-too-large`-Fehler. Gemessen mit `collectEdgeErrors`:
  - ALLROUNDER: `e-batt-plus` 35 mm²/100 A (max 63 A), `e-charger-busbar` 10 mm²/40 A (max 32 A), `e-starter-dcdc` 16 mm²/60 A (max 40 A), `e-dcdc-busbar` 16 mm²/50 A (max 40 A), `e-busbar-fuse` thermisch überlastet.
  - AUTARK: `e-batt-plus` 70 mm²/160 A (max 100 A), `e-busbar-fuse` 70 mm²/160 A, `e-busbar-inv-plus` 70 mm²/160 A, zusätzlich `e-charger-busbar`, `e-starter-dcdc`, `e-dcdc-busbar` wie oben.
- **WHY IT IS WRONG:** Referenzpläne sollten eine gültige Startbasis sein. Wenn sie selbst gegen die eigene Koordinationsregel (`I_n ≤ FUSE_MAP = 0,7 × Ampacity`) verstoßen, erzeugt das Öffnen eines 100-A-„Allrounder“-Templates ein rotes Kabel und verwirrt jede Auswertung.
- **CURRENT BEHAVIOR:** Template-Kanten zeigen kritische Edge-Fehler; erst ein erneuter AutoWire-Lauf korrigiert die Sicherungen.
- **EXPECTED BEHAVIOR:** Templates entweder mit gültigen Fuse-Werten ausliefern oder beim Laden still durch AutoWire dimensionieren; niemals einen bekannten 160-A-Wert bei 70-mm²-Kabel als Default behalten.
- **SAFETY IMPACT:** Nutzer, der den Template-Plan als fertig übernimmt, arbeitet mit ungeschützten Leitungen; der Plan zeigt es aber als Fehler.
- **UX IMPACT:** Sofortige Fehlerwarnungen beim Öffnen; fehlendes Vertrauen in die App.
- **RECOMMENDED FIX:** Template-Fuses gegen `FUSE_MAP` prüfen und korrigieren; Test, dass jedes Template via `collectEdgeErrors` keine `fuse-too-large`/`thermal-overload` erzeugt.
- **REGRESSION TEST:** Für ALLROUNDER/AUTARK: over all edges `collectEdgeErrors(...).filter(r=>['fuse-too-large','thermal-overload'].includes(r.ruleId))` === `[]`.

---

### F-07 · P2 · MEDIUM · Finale Routing-Validierung ist bei allen Referenzplänen `INVALID` und wird im Renderpfad nicht geprüft

- **ID:** AUDIT-ELE-007-FINAL-ROUTING-GATE
- **SEVERITY:** P2 MEDIUM
- **CATEGORY:** Klarheit der Schemata / Lesbarkeit bei hoher Komplexität
- **FILE:** `lib/routing/finalValidation.ts` (`validateFinalRouting`, Header-Kommentar) und `scripts/routing/finalValidation.test.ts` (Ratchet)
- **FUNCTION:** `validateFinalRouting`
- **PROBLEM:** Die binäre Final-Invariante verlangt `I1==I2==I3==0`. Alle sechs `knownPlans` (simple, solar, inverter, acdc, camper, complex) liefern nach `performAutoWiring → routeAllCables → validateFinalRouting` `status='INVALID'`: I2 = 4/2/3/5/9/11; camper außerdem I3=9, complex I3=3; I1 überall 0. `finalValidation.ts` dokumentiert selbst: „Wird bewusst NICHT im Render-Pfad aufgerufen“; `finalValidation.test.ts` erzwingt nur ein Ratchet (`≤ Baseline`) und I1=0.
- **WHY IT IS WRONG:** Die Ziel-Idee — „am Ende muss eine nicht verhandelbare Aussage stehen“ — ist technisch korrekt, aber nicht wirksam: (1) die Referenzpläne erreichen sie nicht, (2) der Nutzer sieht nie einen „Routing INVALID“-Hinweis aus dieser Quelle, (3) der Test erlaubt reale Rest-Verletzungen in allen Plänen.
- **REALISTIC EXAMPLE:** Ein 50-Kabel-Plan mit 11 kollinearen Überdeckungen und 3 zu engen Parallelläufen zeigt keine Routing-Warnung; der Nutzer sieht nur eine sauber aussehende, aber nicht final-valide Verdrahtung.
- **CURRENT BEHAVIOR:** Die Rest-Verletzungen bestehen weiterhin. Der Audit-Find-Punkt „unsichtbar“ ist aber behoben: `CableRouteSync` ruft beim selben Routinglauf (der die UI-Waypoints publiziert) `validateFinalRouting` auf und publiziert den Report; `RoutingStatusBadge` in der Planner-Kopfzeile zeigt `status='INVALID'` als oranges Badge mit I1/I2/I3-Zählung und dem Hinweis „nicht layout-verifiziert“. CI bleibt über das bestehende Ratchet abgesichert (keine Verschlechterung).
- **EXPECTED BEHAVIOR:** Der finale Gate-Zustand wird irgendwann erreicht (I1/I2/I3=0) oder die UI zeigt sichtbar: „Routing nicht kollisionsfrei (N Überdeckungen)“. Zumindest beim Öffnen eines Plans mit Rest-Verletzungen sollte ein Hinweis erscheinen. Der zweite Teil dieser Anforderung ist jetzt erfüllt.
- **SAFETY IMPACT:** gering (Topologie/Visualisierung), aber die Verwechslungsgefahr paralleler Leitungen steigt; das sichtbare Badge reduziert genau diese Gefahr, weil der Nutzer den nicht layout-verifizierten Zustand nicht übersieht.
- **UX IMPACT:** Kabel laufen weiterhin durch/auf Bauteile bzw. übereinander; 50–100 Kabel erfordern Zoom/Filter statt „auf einen Blick“. Der Status ist jedoch permanent sichtbar, inklusive Zählung.
- **RECOMMENDED FIX:** (umgesetzt, transparenter Zwischenstand) Sichtbare Routing-Status-Anzeige einbauen; als Nächstes Router-Arbeit (Port-Fan-Out/Trassen) fortsetzen und den Ratchet schrittweise auf 0 senken.
- **REGRESSION TEST:** Neu: `cableRouteStore.test.ts` prüft, dass `publishCableRouteFinalValidation`/`clearCableRoutes` den Report korrekt setzen/löschen; `RoutingStatusBadge.test.tsx` prüft die gerenderte `routing-status-invalid`-Anzeige bei einem I1-Verstoß und die grüne `routing-status-valid`-Anzeige bei einem sauberen Routing. Die bestehenden `finalValidation`-/Golden-Master-Ratchet-Tests bleiben grün.

---

### F-08 · P2 · MEDIUM · AC-Sicherungen werden gesetzt, aber nie validiert

- **ID:** AUDIT-ELE-008-AC-FUSE-VALIDATION
- **SEVERITY:** P2 MEDIUM
- **CATEGORY:** Sicherungsauswahl
- **FILE:** `components/edges/CableEdge.tsx` (Zeilen 189–193, `if (edgeDomain !== 'AC_230V' && isPlus)`; Zeilen 220–300), `components/planner/hooks/useLiveValidation.ts` (Zeile 108 Rule A skip auf AC)
- **FUNCTION:** `collectEdgeErrors`, `useLiveValidation`
- **PROBLEM:** AutoWire vergibt in `sizeAcEdges` Fuse-Werte an AC-Kanten. `collectEdgeErrors` überspringt aber jegliche Fuse-Prüfung für `AC_230V`; `useLiveValidation` Rule A schließt AC ebenfalls aus. Das Label sagt sogar: „FI/LS … wird hier nicht geprüft“. Wird z. B. die Fuse einer `shore→charger`-AC-Leitung manuell auf 40 A bei 1,5 mm² gestellt, keine Meldung.
- **WHY IT IS WRONG:** Der Nutzer verlässt sich auf das System: AutoWire setzt die Fuse, aber die UI kann sie nicht gegen die Kabelträgheit prüfen; ein versehentlich falsch gesetzter AC-Wert taucht nirgends auf.
- **REALISTIC EXAMPLE:** Nutzer ändert im Inspector nur die AC-Sicherung; danach ist die Leitung unkoordiniert, aber der Plan bleibt grün.
- **CURRENT BEHAVIOR:** Keine `fuse-too-large`/`fuse-below-minimum` Prüfung für AC; nur Hinweis „FI/LS prüfen“.
- **EXPECTED BEHAVIOR:** AC-Fuse ebenfalls gegen `maxFuseForDisplay(crossSection)` (bzw. gegen die aus `sizeAcEdges` verwendete Normtabelle) prüfen, mindestens als Warnung; oder AC-Fuse aus der UI entfernen und immer durch AutoWire setzen.
- **SAFETY IMPACT:** Ungeschützte/überdimensionierte 230-V-Leitung nicht erkannt.
- **UX IMPACT:** widersprüchliche Schutzversprechen („Fuse gesetzt“ vs. „wird nicht geprüft“).
- **RECOMMENDED FIX:** AC-Fuse-Prüfung in `collectEdgeErrors` parallel zur DC-Logik (mit angepasster Normquelle) ergänzen und die AC-Label-Botschaft in eine echte Validierung überführen.
- **REGRESSION TEST:** AC-edge mit `fuseSize > maxFuseForDisplay(crossSection)` produziert `fuse-too-large`.

---

### F-09 · P2 · MEDIUM · Negative/ungültige Watt-Werte aus Importen werden still als 0 A behandelt

- **ID:** AUDIT-ELE-009-NEGATIVE-LOAD-SILENT
- **SEVERITY:** P2 MEDIUM
- **CATEGORY:** Strom-/Spannungsberechnung / Daten-Validierung
- **FILE:** `lib/vde-standards.ts` (`calculateEdgeCurrent`, `quantityOr`, Zeilen 350–400), `lib/nodeSchema.ts` (`sanitizeNodeDataBySchema`)
- **FUNCTION:** `calculateEdgeCurrent`, `sanitizeNodeDataBySchema`
- **PROBLEM:** Probe: Consumer `watts=-60` bleibt in `sanitizeNodeDataBySchema` erhalten (`removedFields: []`), `calculateEdgeCurrent` liefert 0 A. NaN wird entfernt; der Plan zeigt dann keinen Strom, ohne dass eine Warnung „ungültige Leistung“ erscheint. `updateNodeData` merged Daten ohne Schema-Sanitizing (`store/slices/graphSlice.ts`), der UI-Inspektor blockt negative Werte mit `min=0`/`strictlyPositive` — Importe/Programmaufrufe umgehen das aber.
- **WHY IT IS WRONG:** Eine negative Last ist kein „kein Verbrauch“, sondern ein Datenfehler. Stille Behandlung als 0 A kann Kabel und Sicherung zu klein erscheinen lassen.
- **REALISTIC EXAMPLE:** Importierter Altplan hat `watts=-60`; Spannungsfall/Strom bleibt 0; Nutzer wundert sich, warum das Kabel so dünn ist, obwohl das Gerät läuft.
- **CURRENT BEHAVIOR:** Kein Fehler/keine Warnung; Berechnung mit 0.
- **EXPECTED BEHAVIOR:** `sanitizeNodeDataBySchema` ungültige Werte entweder entfernen (mit Warnung) oder beibehalten und eine explizite `invalid-negative-load`-Warnung erzeugen; Store-Update validiert.
- **SAFETY IMPACT:** Unterdimensionierung bei manuell erzeugten/importierten Plänen.
- **UX IMPACT:** unklar, warum 0 A angezeigt wird.
- **RECOMMENDED FIX:** In `useLiveValidation` eine Regel ergänzen, die negative/NaN-Werte in `watts`/`amps` als `critical` meldet; `sanitizeNodeDataBySchema`-Verhalten dokumentieren/testen.
- **REGRESSION TEST:** Consumer `watts=-60` ⇒ mindestens 1 Warnung; `calculateEdgeCurrent` nicht still 0 (oder Warnung vorhanden).

---

### F-10 · P2 · MEDIUM · `acCurrentA` summiert 230-V-Verbraucher global statt pro Insel

- **ID:** AUDIT-ELE-010-AC-GLOBAL-SUM
- **SEVERITY:** P2 MEDIUM
- **CATEGORY:** Kabeldimensionierung
- **FILE:** `lib/autoWire/sizing.ts` (Zeilen 338–345 `total230vLoad`, 350–360 Inverter-Fall)
- **FUNCTION:** `acCurrentA`
- **PROBLEM:** Im Inverter-Pfad verwendet `acCurrentA` `total230vLoad()`, das **alle** `consumer230v` im gesamten Plan summiert, nicht nur die am betroffenen Wechselrichter angeschlossenen. Bei mehreren AC-Inseln oder unverbundenen 230-V-Geräten kann eine AC-Zuleitung überdimensioniert werden. (`calculateEdgeCurrent` hat den DC-Pfad bereits per Insel-BFS gelöst — AC nicht.)
- **WHY IT IS WRONG:** Überdimensionierung ist nicht gefährlich, aber widerspricht der dokumentierten Eigenabsicht („Eine Abzweigleitung trägt nur ihre eigene Last“) und erzeugt überteuerte/unnötig dicke AC-Zuleitungen.
- **REALISTIC EXAMPLE:** Zwei getrennte Inseln mit je 300 W; die AC-Zuleitung der ersten Insel wird mit 600 W dimensioniert.
- **CURRENT BEHAVIOR:** `acCurrentA` summiert global; Display (`calculateAcEdgeCurrent`) summiert per Insel — damit erneut ein Parity-Problem.
- **EXPECTED BEHAVIOR:** AC-Dimensionierung ebenfalls per AC-Insel-BFS; eine gemeinsame `acLoadOfInverter()` Funktion für Display und AutoWire.
- **SAFETY IMPACT:** Kein direkter Sicherheitsfehler, aber Planungskosten und inkonsistente Ergebnisse.
- **UX IMPACT:** Leitung dicker als nötig; Widerspruch zu per-Kante angezeigtem Strom.
- **RECOMMENDED FIX:** `total230vLoad` auf BFS ab Quelle beschränken; gleiche Quelle wie `calculateAcEdgeCurrent`.
- **REGRESSION TEST:** Zwei AC-Inseln A(300 W), B(300 W): `acCurrentA(invA,…)` = 1,30 A, nicht 2,60 A.

---

## 2. Positiv verifizierte Punkte (keine Findings)

- **VDE-Koordination `I_B ≤ I_n ≤ I_z` ist im DC-Modell durch Konstruktion erfüllt:** `FUSE_MAP = 0,7 × Ampacity`, `lookupThermalCrossSection` und `isFuseFeasible` verwenden dieselbe 0,7-Entrate-Faktor; `calculateMaxFuse`, `selectFuseSize`, `maxFuseForDisplay` konsistent (VERIFIED, `lib/electrical.ts`).
- **DC-Stromberechnung auf Entladeschlussspannung:** `dischargeFloorVoltage = nominal × 0,9375`; Lastströme werden mit 12,0 V statt 12,8 V gerechnet (konservativ, dokumentiert), `ELE-005`. (VERIFIED)
- **AC/DC-Domänentrennung im Connection-Rule-Pfad:** `shorePower`/`consumer230v` → AC; `inverter.plus.target` → DC, `inverter.plus.source` → AC; `acBatteryCharger`-Eingang AC, Ausgang DC. Negative Fälle getestet: `shore→mppt` blockiert, `battery→consumer230v` blockiert, `sp→inv.ac_in` erlaubt, `inv.plus.source→c230.plus` erlaubt. (VERIFIED)
- **AutoWire-Grundtopologie (fachlich sinnvoll):** Batterie+ ≤ 20 cm → Plus-Busbar → Sicherungskasten → Verbraucher; Batterie− → Shunt → Minus-Busbar; Ladequellen auf Busbar; Wechselrichter eigener DC-Zweig; 16-mm²-Massepunkt erzwungen. AutoWire setzt Fuse-Sizes und Querschnitte für erzeugte DC/Solar-Kanten korrekt (Probe: `e-auto-*` haben keine `collectEdgeErrors`).
- **Edge-Case-Verhalten:** negative/0/NaN-Watts → 0 A (nicht `Infinity`); 10000 W → 833 A; `calculateCrossSection(833 A, 3 m)` → 70 mm²; `isFuseFeasible(833,70)` → false; `collectEdgeErrors` erkennt `thermal-overload` und/oder zu kleine Sicherung. (VERIFIED, mit F-09-Einschränkung)
- **Negative Längen werden gemeldet:** `negative-length`-Kantenfehler, Fallback auf geometrische Schätzung in `CableEdge`/`edgeDropInputs`. (VERIFIED)
- **MPPT-Kalt-VOC-Prüfung implementiert und UI-gepflegt:** `solar.voc`/`isc`/`tempCoefficient` sind im Inspektor und `stringColdVocOf`/`solar-voc-window`/`solar-voc-missing` aktiv. (VERIFIED)
- **RCD-/FI-Warnungen für Landstrom und Wechselrichter vorhanden:** `missing-rcd-*`, `inverter-missing-rcd-*` plus Härtung mit `hasRcd`. (VERIFIED)
- **Shunt-Bypass-Regel vorhanden** (`shunt-bypass`), DC-DC-Unvollständigkeit (`dcdc-unconnected`), Wechselrichter-Ohne-Sicherung (`inverter-unprotected`). (VERIFIED)
- **Fehleranzeige strukturiert:** `collectEdgeErrors` mit `ruleId`/`measuredValue`/`expectedValue`/`source`; WarningCenter sortiert nach Schwere; Edge-Chips + Warnzentrale konsistent mit denselben Regeln (AUSNAHMEN: F-03, F-08). (VERIFIED für DC-Plus)
- **`componentRegistry` prüft Bauteildefinitionen** (doppelte IDs, fehlende Felder, Wasser/Elektrik-Mischhandles) — reduziert Registrierungsfehler. (VERIFIED)

---

## 3. ABSCHLUSSMATRIX

| #   | Bewertungskriterium                             | Status                                              | Kernbegründung                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Korrekte elektrische Komponentenverbindungen    | 🟠 **INCORRECT / unvollständig**                    | Standard-AC/DC/Inverter-Topologie korrekt; `Solar→Batterie` und `Batterie→Solar` erlaubt; Serienkante überlebt AutoWire.                                                                                                                                  |
| 2   | Zuverlässige Verhinderung falscher Verbindungen | 🟠 **INCORRECT**                                    | AC/DC-Trennung und Polarität meist gut; aber Serien-Exception + parallele Rails (F-01), Solar-Direktverbindung (F-02), Solar ohne Fuse (F-03).                                                                                                            |
| 3   | Korrekte Kabeldimensionierung                   | 🟠 **PARTIELL / INCORRECT**                         | DC-Dimensionierung konsistent; AC-Anzeige vs. AutoWire-Parity-Bruch (F-04), BMS/24-V-Grenzen fehlen (F-05), negative Lasten still (F-09).                                                                                                                 |
| 4   | Korrekte Sicherungsauswahl                      | 🟠 **PARTIELL / INCORRECT**                         | DC/Solar AutoWire korrekt; Templates überdimensioniert (F-06), AC-Fuse unvalidiert (F-08), Solar user edge fehlende Fuse (F-03).                                                                                                                          |
| 5   | Korrekte Strom-/Spannungsberechnung             | 🟠 **PARTIELL**                                     | DC mit Entladeschlussspannung gut; AC-Parity-Bruch (F-04), AC-Global-Sum (F-10), negative/NaN still (F-09).                                                                                                                                               |
| 6   | Saubere AC/DC-Trennung                          | 🟢 **VERIFIED (mit dokumentierten Grenzen)**        | `getHandleDomain` + `isConnectionAllowed` korrekt für alle getesteten Handle-Kombinationen; Solar wird als DC_12V geführt (Domänen-Modell), was bei F-02 zu den Lücken führt.                                                                             |
| 7   | Korrekte Modellierung typischer Camper-Systeme  | 🟠 **PARTIELL**                                     | 12 V + Solar + Booster + Landstrom + Wechselrichter + Shunt gut; 24 V / Serienverschaltung nicht modelliert, BMS fehlt, Solar-Direktmodell unsicher.                                                                                                      |
| 8   | Auto-generierte Verdrahtung technisch sinnvoll  | 🟢 **VERIFIED (elektrisch) / 🟠 PARTIELL (Layout)** | Serien-Kurzschluss (F-01) und Solar-Direktkante (F-02) werden entfernt; Rails, Shunt, Sicherungen und AC-Insel-Sizing sind in den Golden-Master-Plänen geprüft. Restlich bleibt die Layout-Invariante (I2/I3, F-07) — sichtbar, nicht elektrisch killend. |
| 9   | Klare, verständliche Schemata                   | 🟠 **PARTIELL**                                     | Rollen-Strichstärke, Farbdomänen, Lane-Routing, Label-Nudging vorhanden; Final-Routing-Validierung bleibt bei Referenzplänen `INVALID`, aber jetzt sichtbarer `RoutingStatusBadge` in der Kopfzeile (F-07 transparenter UI-Flag).                         |
| 10  | Lesbarkeit bei hoher Komplexität                | 🔴 **UNVERIFIED / INCORRECT für 50–100 Kabel**      | Referenz-Camper/Complex-Plan: 11 I2-Überdeckungen + 3 I3-Verletzungen; seit F-07 sichtbar als Badge, aber die Überdeckungen selbst bleiben; Labels auf dem Desktop dauerhaft sichtbar → Clutter. Kein Beweis „auf einen Blick lesbar“.                    |
| 11  | Keine gefährlichen/irreführenden Ergebnisse     | 🟠 **PARTIELL**                                     | Die belegten P0/P1-Fehler (F-01/F-02/F-04) sind behoben und regressionsgetestet. Restlich: BMS-Grenzen (F-05) und ungültige Lastwerte (F-09) sind nur Warnungen statt harter Blocker; Routing-Restüberdeckungen (F-07) sind sichtbar, aber nicht null.    |

---

## 4. Beantwortung der beiden Abschlussfragen

### (a) Wo kann das System einen falschen/gefährlichen Plan erzeugen, wenn der Nutzer **vollständig** auf AutoWire, Kabeldimensionierung, Sicherungsauswahl und Validierung vertraut?

**Nach den Umsetzungen dieser Session sind die damals belegten P0/P1-Pfade geschlossen:** F-01 (AutoWire entfernt Batterie×Batterie plus↔minus in `healUserEdges`), F-02 (AutoWire entfernt direkte Solar→Batterie/Verbraucher), F-04 (AC-Anzeige und Dimensionierung nutzen dieselbe `acCurrentA`-Quelle), F-06/F-08/F-10 (Templates, AC-Sicherung, AC-Insel-Summe). Es bleiben aber **nicht-blockierende** Reststellen, die bei „vollem Vertrauen“ ohne sorgfältiges Lesen der Warnzentrale zu falschen Ergebnissen führen können:

1. **BMS-Grenzen bleiben Warnung, keine Auslegungsgrenze (F-05 teilbehoben):** `bmsContinuousDischarge`/`bmsPeakDischarge` werden im Inspektor gepflegt und die Live-Validierung meldet `bms-discharge-*`/`bms-charge-*` als **critical warning** (`useLiveValidation`). AutoWire und `sizeAcEdges`/die DC-Auslegung dimensionieren Kabel/Sicherung aber weiterhin aus Laststrom, nicht aus der BMS-Dauerstromgrenze. Ein Nutzer, der „das System wird schon passend dimensionieren“ annimmt und die Warnung nicht als Blocker behandelt, kann bei importierten BMS-/24-V-Plänen weiterhin eine zu hohe Dauerbelastung über den BMS-Grenzwerten erhalten.
2. **Negative/NaN-Lasten bleiben Warnung, kein Hard-Stop (F-09 teilbehoben):** Negative oder nicht-endliche `watts`/`amps` erzeugen `invalid-load-*`; die Berechnungen/Speicherung werden aber nicht abgebrochen. Bei „vollem Vertrauen auf die Validierung“ ist der Nutzer darauf angewiesen, die Warnung zu sehen und manuell zu korrigieren.
3. **Kein harter Publikations-Blocker:** `useLiveValidation` liefert Warnungen in die `WarningCenter`, blockiert aber weder Speichern/Export noch eine spätere Nutzung des Plans. „Volles Vertrauen“ funktioniert deshalb nur, wenn der Nutzer jede kritische Warnung liest und behebt — das ist Abhängigkeitsentscheidung, keine technische Garantie.
4. **Routing-Final-Gate (F-07):** Die Restüberdeckungen (I2/I3) sind nicht elektrisch gefährlich, können aber parallele Leitungen optisch zusammenfallen lassen; seit dieser Runde ist der Zustand im `RoutingStatusBadge` sichtbar. Gefahr besteht hier vor allem bei „ich verlasse mich auf das Bild, nicht auf die Statusanzeige“.

### (b) Ist ein Plan mit 50–100 Kabeln „auf einen Blick“ lesbar?

**Nein — das ist mit dem implementierten Router nicht verifiziert und nach aktuellem Stand nicht der Fall.**

- `validateFinalRouting` ergibt für die goldenen Referenzpläne weiterhin `INVALID` (camper: I2=9/I3=9; complex: I2=11/I3=3). Der Report wird seit dieser Runde aber im Renderpfad mitgeführt und im `RoutingStatusBadge` angezeigt (I1/I2/I3-Zählung + „nicht layout-verifiziert“).
- Die Überdeckungen/zu engen Parallelläufe selbst sind weiterhin da; das Badge macht sie transparent, macht sie aber nicht lesbarer.
- Die vorhandenen Mechanismen (Rollen-Strichstärke, 8-px-Halblane, Port-Fan-Out, Label-Nudge, mobile Tap-Einblendung) sind gute Grundlagen, beseitigen aber die gemessenen Überdeckungen nicht.
- Bei 50–100 Kanten mit dauerhaft sichtbaren Desktop-Labels ist „auf einen Blick“ als Wertung **nicht sichergestellt** — die Zone von ~50–100 Kabeln ist genau die, in der die verbleibenden I2/I3-Verletzungen visuell relevant werden. Der Fortschritt liegt in der zuverlässigen Statusanzeige, nicht in der visuellen Entzerrung.

---

## 5. Abschlusswertung

**🟡 GUTER PROTOTYP** (Stand nach der Umsetzung dieser Session)

Begründung: Die im Audit gefundenen P0/P1-Pfade (Serien-Batteriekurzschluss, Solar-Direktanschluss, fehlende Solar-Sicherung, AC-Strom-Divergenz) sind behoben und durch Regressionstests abgesichert. Die Referenz-Templates und die BMS-/24-V-Pflege sind korrigiert bzw. ergänzt. F-07 ist nicht mehr offen, sondern als transparenter Zwischenstand abgeschlossen: Das Routing-Final-Gate bleibt bei den Referenzplänen `INVALID`, aber die UI zeigt genau das jetzt sichtbar an („Routing: n Zwänge nicht erreicht“), sodass kein stiller nicht-valider Planzustand mehr besteht. Für „50–100 Kabel auf einen Blick“ ist weiterhin keine belastbare Zusage möglich. Deshalb keine „Produktionsreif“-Wertung und auch kein „NICHT SICHER“ — das Werkzeug ist als Planungs-/Prototyp-Werkzeug nutzbar, aber nicht als geprüfte Elektroinstallationsplanung abzunehmen.

Nächste Runde: Roadmap-Punkt „Router auf I1=I2=I3=0 bringen“ (Port-Fan-Out/Trassen), dann eine erneute Audit-Runde mit den Golden-Master-Plänen, um das Routing-Badge von „INVALID“ auf „VALID“ zu drehen und die Lesbarkeitsfrage für 50–100 Kabel erneut zu messen.
