# KNOWN-PROBLEMS

Nur **echte, im Code nachweisbare** Probleme. Keine Wunschliste, keine allgemeinen TODOs.
Jeder Eintrag ist am 2026-09-09 gegen den Code geprüft.

Legende Severity: **hoch** = Agent kann falschen Code ändern / falsche Sicherheit annehmen ·
**mittel** = Qualitäts- oder Konsistenzrisiko · **niedrig** = Komfort/Doku.

---

## DOC-001 — `docs/ROUTING-V2.md` beschreibt gelöschte Verzeichnisse — **behoben 2026-09-28**

- **STATUS:** behoben über den **LESER-HINWEIS** am Dokumentkopf (2026-09-10): Er nennt die
  gelöschten Verzeichnisse, verweist auf den realen Pfad (`lib/routing/*` +
  `components/edges/utils/*`) und korrigiert den ELK-Status (produktiv seit ADR 0018).
  Der eingefrorene Spec-Text bleibt bewusst historisch (FROZEN, Zielbild) — die verbindliche
  Beschreibung des Ist-Zustands liegt in `docs/ai/ROUTING-CONTEXT.md`.
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

- **STATUS:** behoben. `README.md` nennt jetzt die jeweils aktuelle Zahl (2026-09-28: 2454 Tests / 179 Dateien), React Flow
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

## DOC-004 — `docs/ROUTING-INVARIANTS.md` beschreibt die falsche Engine — **behoben 2026-09-28**

- **STATUS:** behoben über den **LESER-HINWEIS** am Dokumentkopf (2026-09-10): R1–R7 sind
  dort ausdrücklich als Invarianten des LEGACY-Einzelrouten-Routers markiert, die produktiven
  Invarianten I1–I10 (`lib/routing/invariants.ts`, `npm run routing:audit`, Report je Kante
  unter `useCableRouteFinalValidation`) sind benannt; ebenso, dass die Galerie die
  Legacy-Geometrie zeigt. Die R1–R7-Kapitel bleiben als Referenz des Legacy-Vertrags stehen.
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
  über `portFanOut.assignFanOut` (Port-Ebene) und den Nudge-Reflow (Ausweich-Lanes).
- **CURRENT BEHAVIOR:** Korridor-Lanes sind nicht stabil registriert; die Ausweich-Trassen
  stammen aus einer Heuristik, nicht aus der Registry.
- **EXPECTED BEHAVIOR:** Registry-Lanes steuern Ausweich- und Bündel-Trassen (Zielbild WP-5/WP-8).
- **SEVERITY:** mittel
- **WORKAROUND:** Lanes nur über `lib/routing/rules/portFanOut.ts` ändern — dort liegt die
  wirksame Mechanik.
- **RELATED TEST:** `lib/routing/rules/laneRegistry.test.ts` (grün, aber ohne Produktionswirkung)
- **RELATED ISSUE:** WP-5 (#394) / WP-8, dokumentiert im Modulkommentar.
- **STATUS (2026-09-27):** **teilweise erledigt, Konsument noch offen.** `laneCandidates`
  liefert die Korridor-Leiter (`coord ± k · laneGrid`) als Auswahl-Kandidaten und ist getestet;
  ein zusätzlicher Nudge-Pass, der sie produktiv nutzte, wurde nach Messung **nicht
  ausgeliefert** — der Nudge-Reflow des Trunk-Zweigs („stabilize planning and safe route
  reflow", 2026-09-26/27) löst dieselbe Frage bereits selbst (Kandidaten `ideale Lane ± k ·
Raster`, Lane-Reservierung, zweite begrenzte Runde, Stub-Achsen-Sicherheit). Gemessen:
  mit dem Leiter-Pass unverändert I2 = 5 im ELK-Pfad, in den Regressions-Szenarien gleiche
  Metriken bei anderer Geometrie — also kein Nutzen, nur Risiko.
- **KONSUMENT GEPRÜFT (ROUTE-002 Teil 2b/3, 2026-09-28):** Beide in Frage kommenden Konsumenten
  sind untersucht — **beide ohne Auslieferung**. Teil 2b (Port-Bündel-/Fan-Out-Ebene,
  `components/edges/utils/routeAll.ts::portFanOutLanes`): vier Varianten einer Lane-Vergabe
  gebaut und über beide Pfade gemessen, jede kostet im dichtesten Referenzplan `complex` mehr,
  als sie im ELK-Pfad bringt — die betroffenen Stubs lagen im Kappungs-Regime (ROUTE-BUG-34);
  gelöst wurde die Ursache stattdessen über die Platzierungs-Freigabe (ADR 0027). Teil 3
  (`preferredLaneBonus`): die Potenzialanalyse `npm run routing:lane-probe` findet über 428
  Ideal-Segmente **50** freie, ungenutzte Registry-Linien im ELK-Pfad und **22** im Fest-Raster
  — das Potenzial ist also real. Vier Verdrahtungs-Varianten wurden gebaut und gemessen; die
  beste senkt die Kreuzungen im ELK-Pfad 107 → 104 und kürzt `acdc` um 483 px, verlängert aber
  `complex` um 44 px und scheitert damit an der Kabellängen-Ratchet. Die Registry bleibt damit
  ein **getesteter Baustein ohne Produktiv-Konsumenten** — mit reproduzierbarem Nachweis statt
  Vermutung, inklusive der Bedingung für einen zweiten Versuch (globale statt gierige Vergabe
  bzw. Entkopplung des A*-Gitters von der Tube-Envelope).

## ROUTE-002 — Kostenmodell nur teilweise angebunden

- **AREA:** Routing
- **FILE:** `lib/routing/rules/costModel.ts`
- **DESCRIPTION:** `segmentExtraCost` und `preferredLaneBonus` werden **nur von Tests**
  aufgerufen. Im Produktivpfad nutzt `pathfinding.ts` ausschließlich
  `COST_WEIGHTS.crossing` (120) in `scorePath`.
- **CURRENT BEHAVIOR:** Clearance-Verletzungen, Nachbar-Lanes und Registry-Bonus sind im
  A*-Lauf **nicht** bepreist. Biegung, Kehre und Kreuzung sind es — aber erst seit dem
  2026-09-27 aus dem Modell statt aus lokalen Konstanten (siehe STATUS).
- **EXPECTED BEHAVIOR:** vollständige Kostenfunktion im inkrementellen Pass (Zielbild WP-6/WP-8).
- **SEVERITY:** mittel
- **WORKAROUND:** Kostenänderungen nur an `scorePath`/`routeDefectScore` vornehmen — nur dort
  wirken sie heute.
- **RELATED TEST:** `lib/routing/rules/costModel.test.ts`
- **RELATED ISSUE:** WP-6 (#396).
- **STATUS (2026-09-27, Teil 1 erledigt):** Die drei Kanten-Kosten, die der Bestandsrouter
  tatsächlich optimiert, kommen jetzt **aus dem Modell**: `crossing` (7,5 × `laneGrid`) wie
  bisher, zusätzlich `bend` (5 × = 80) und `uTurn` (25 × = 400) als `COST_WEIGHTS.bend` /
  `.uTurn` (`pathfinding.ts` liest sie, keine eigenen Konstanten mehr; Sync-Test in
  `costModel.test.ts` **und** `pathfinding.test.ts`). Wertgleich zum bisherigen Hardcode ⇒
  Golden Master unverändert. Damit ist der frühere ROUTE-004-Rest „`BEND_COST`,
  `U_TURN_COST` außerhalb der Tokens" geschlossen.
- **STATUS (2026-09-27, Teil 2a erledigt):** `segmentExtraCost` kann die Port-Bündel-Ausnahme
  jetzt anwenden. Messung über die sechs Referenzpläne (Produktivpfad, geroutete Trassen,
  **ungeordnete** Kantenpaare wie I2): 47 kollinear überdeckte Kantenpaare · 82 `weighted` ·
  121 `nearby` · 48 Kreuzungen (die Audit-Werte 2/5/2/2/8/29). Von den 47 kollinearen Paaren
  sind **alle 47 die Port-Bündel-Ausnahme**, echte I2-Verstöße 0. Ohne Stub-Kenntnis liefert
  `segmentExtraCost` für jedes dieser Paare `Infinity` (fail-safe) — mit
  `options.portBundle` (`own` + `otherOf`) lässt es genau sie durch und zählt sie als
  `portBundleShared`. Die Ausnahme ist dabei **eine** Regel: sie lebt in
  `lib/routing/rules/portBundle.ts` und wird von I2 (`invariants.ts`), vom Modell und vom
  Audit benutzt (ADR 0025). Test: `scripts/routing/portBundleModel.test.ts`,
  `lib/routing/rules/portBundle.test.ts`, `costModel.test.ts`.
- **STATUS (2026-09-28, Teil 2b abgeschlossen — ADR 0027):** Die Anbindung von
  `segmentExtraCost`/`preferredLaneBonus` an den Produktivpfad wurde in vier Varianten gebaut
  und auf **beiden** Pfaden gemessen (ELK-Pfad: `routeAllCables` über `applyAdvancedLayout` der
  sechs Referenzpläne; Produktivpfad: `npm run routing:audit` auf den eingefrorenen Goldens).
  Keine Variante verbessert den ELK-Pfad ohne Schaden im Produktivpfad — alle vier verworfen,
  mit ihren Zahlen:

  1. **`stubLength`-Gate** (`stubsShareAxis`: die `gap/2`-Kappung nur noch bei gleicher
     Stub-Achse): ELK **I2 5 → 2** (camper 0, complex 0), aber der Produktivpfad bekommt in
     `simple` und `camper` je **I6 + I7** (8-px-Segment, Treppenmuster), und der Kabelweg wächst
     um +80/+80/+7/+34 px.
  2. **`segmentExtraCost`-Schiedsrichter im Suchloop** (verlegte Kanten mit Identität im
     `PathRequest`, Bewertung der fertigen Kandidaten inklusive Port-Bündel-Ausnahme): greift
     im ELK-Pfad 8 ×, findet aber in 7 Fällen **keinen** überdeckungsfreien Kandidaten — alle
     Ausweich-Lanes bleiben hart, weil der Korridor belegt ist. Im Produktivpfad ändert er
     Geometrie, die der Nudge ohnehin bereinigt hätte: `acdc` und `complex` **+2 Kreuzungen**.
  3. **Enden-Staffelung je Anschluss-Spalte** (pauschal, höchstens ein Rasterschritt): ELK I2
     5 (Verteilung inverter −1, complex +1); Produktivpfad `simple` **−2**, `camper` −1,
     `inverter` −1, `acdc` −1 Kreuzung und **−483 px** — aber `complex` **+6 Kreuzungen**
     (27 → 33, über der Ratchet).
  4. **Enden-Staffelung präzise** (gleiche Stub-End-Achse _und_ überlappende Quer-Spanne der
     Zuführung): ELK **I2 5 → 4** (nur das inverter-Paar ist überhaupt lösbar); Produktivpfad
     `complex` bekommt **I2 = 1 (vorher 0)** und **+5 Kreuzungen**.

  **Ursache (gemessen):** Vier der fünf ELK-Paare sind an **beiden Enden gekappt**
  (`actual < stubMin + |lane|`; gemessene Stubs 24–28 px gegen gewünschte 40–56 px), in diesem
  Regime hat keine Lane-Treppe Platz — die Vergabe kann sie nicht trennen. Die Kappung ist die
  dokumentierte Rangfolge (ROUTE-BUG-31/34/35: „lieber I2 als erfundene Geometrie“), und die
  Platzierungs-Freigabe war `stubMin + 1·laneGrid + cableClearance` = 52 px — laut ADR 0023
  bewusst **ein** Lane-Schritt.

  **Entschieden (ADR 0027):** `portFacingClearance = 68` = `stubMin + 2·laneGrid +
cableClearance` — an einer Klemme hängen im Referenzbestand regelmäßig zwei Leitungen, und erst
  mit zwei Lane-Schritten ist jede der beiden Lanes ohne Stub-Kappung ausdrückbar. Gemessen im
  ELK-Pfad: **I2 5 → 0**, I6/I7 (complex) 2/1 → **0/0**, Kreuzungs-Paare 122 → **107**; Preis:
  Kabelweg 25 129 → 27 967 px (**+11,3 %**). Der Fest-Raster-Pfad bleibt **unverändert**
  (Korridore 96/72 px, absolute Fixture-Koordinaten) — Goldens, Regression, Ratchets und
  Sampling identisch, **kein Recapture**. `preferredLaneBonus` bleibt weiterhin ohne
  Produktiv-Konsumenten: mit 68 px ist der Boden dafür erstmals frei (die Bündel-Lanes sind
  ausdrückbar), die Anbindung ist eine eigene Scheibe.

- **STATUS (2026-09-28, Teil 3 gemessen — vier Varianten gebaut, keine ausgeliefert):** Mit
  ADR 0027 war der Boden frei (die Bündel-Lanes sind ausdrückbar), also wurde
  `preferredLaneBonus` geprüft — erst mit einer **Potenzialanalyse**, dann mit echter
  Verdrahtung.

  **1. Es gibt Potenzial.** `npm run routing:lane-probe` (`scripts/routing/laneProbe.ts`)
  füllt die `LaneRegistry` mit den **Ideal-Routen** (Katalog, port-treu — so würde ein
  Produktiv-Anschluss sie füttern) und fragt je Ideal-Segment: Ist die bevorzugte Linie
  (`corridor.coord + offset`) über die Spanne **frei** (keine Hindernis-Box, keine fremde
  Trasse innerhalb der Clearance) und **fährt die geroutete Trasse sie**? „frei ∧ nicht
  gefahren" ist das Potenzial:

  | Datenbasis                             | Ideal-Segmente | gefahren | **frei ∧ unbenutzt** | belegt |
  | -------------------------------------- | -------------- | -------- | -------------------- | ------ |
  | ELK-Pfad (6 Referenzpläne)             | 289            | 46       | **50**               | 193    |
  | Fest-Raster (15 Regressions-Szenarien) | 139            | 17       | **22**               | 100    |

  **2. Die Realisierung ist trotzdem kein Nettogewinn.** Vier Varianten wurden verdrahtet und
  über **beide** Pfade gemessen (ELK-Pfad: Invarianten + Kreuzungspaare + Kabelweg über die
  sechs Referenzpläne; Fest-Raster: `npm run routing:audit` auf den eingefrorenen Goldens):

  | Variante                                                        | ELK-Pfad                                                        | Fest-Raster                                                                                |
  | --------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
  | A gewichtet (Bonus in der Bewertung **und** als A*-Gitterlinie) | Kreuzungen 107 → 109, **I3 3 → 4**, Kabel +144 px               | camper Kreuzungen 5 → **1**, acdc Kreuzungen 6 → **7** (Ratchet!), acdc −364 px            |
  | B zusätzlich Kreuzungs-Tie-Break in der Katalogwahl             | —                                                               | allein **inert** (identisch zu Baseline)                                                   |
  | C wie B mit Bonus                                               | Kreuzungen 107 → 106, **I3 3 → 4**, Kabel +144 px               | camper Kreuzungen **1**, acdc Kreuzungen 6 (Ratchet hält), acdc −483 px, camper +9 px      |
  | **D Bonus nur in der Bewertung** (keine A*-Gitterlinie)         | Kreuzungen 107 → **104**, Überdeckung −10 px, Kabel **+144 px** | acdc −483 px (längste Kante 1303 → **835**), inverter −27 px, **complex +44 px** (Ratchet) |

  Nur Variante D kommt ohne Regelverstoß aus (I3 unverändert, Kreuzungen sinken), scheitert
  aber an der **Kabellängen-Ratchet**: `complex` 8602 → 8646 px. Deren Test sagt ausdrücklich
  „Kabellänge gestiegen: Ursache suchen (Platzierung/Router) — **nicht die Baseline
  anheben**" (`scripts/routing/cableLength.test.ts`). Die Ursache ist gemessen und liegt
  **nicht** im Bonus-Entscheid selbst: `e-batt-plus` wählt bei Gleichstand eine andere
  Mittellinie (296 → 356, eigene Länge unverändert), deren Tube die Envelope des A*-Gitters
  verschiebt; `e-charger-busbar` läuft danach auf der Gitterlinie 344 statt 366 und zahlt
  +44 px. Also ein **Kaskadeneffekt des gierigen, sequenziellen Routings** über eine
  Gitterlinien-Envelope — kein Fehler des Bonus, aber auch kein Gewinn, den man dafür
  eintauschen möchte.

  **3. Entscheidung: nicht ausliefern.** `preferredLaneBonus` bleibt ohne
  Produktiv-Konsumenten; ausgeliefert wird nur die **Probe** samt npm-Skript und Test
  (`scripts/routing/laneProbe.test.ts` — prüft die Struktur der Messung, nicht die
  Layout-Zahlen). Eine spätere Scheibe müsste entweder die Vergabe **global** statt gierig
  entscheiden (Tube-Kaskade) oder das A*-Gitter von der Tube-Envelope entkoppeln; beides ist
  eine eigene, größere Aufgabe. Kein Recapture, keine Router-Änderung.

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
- **GEMESSENE WIRKUNG (2026-09-28, korrigiert — vorher falsch berichtet):** Der frühere
  Eintrag „0 in zu enger Parallellage" (2026-09-09) war ein **Blindfleck der Sonde**, kein
  Messergebnis: Sie las die Domäne nur aus `edge.data.edgeDomain` und fiel sonst auf `dc12`
  zurück — AutoWire-Kanten tragen das Feld nicht, also galt jede 230-V-Leitung ohne Feld als
  Gleichstrom. Die Sonde leitet die Domäne jetzt mit derselben Autorität ab wie Anzeige und
  Sizing (`edgeDomainOf` aus Knotentyp + Handle) und zählt die Abstände je **Segmentpaar** über
  das Kollisionsmodell (`classifySegmentAgainstSegment`; Kreuzungen `soft` und Überdeckungen
  `hard` zählen nicht mit, ADR 0009/0019).
  Ergebnis über die sechs Referenzpläne (`npm run routing:domain-probe`):
  **80 gemischte Paare**, davon **12 kreuzend**, darunter **23 zu nahe Segmentpaare**
  (inverter 0, acdc 5, complex 18; übrige Pläne 0), engstes Paar
  `e-busbar-fuse × e-shore-inv` = **0,8 px**. Betroffen sind 7 Kantenpaare (acdc 1,
  complex 6) — überwiegend die 230-V-Zuleitungen am Wechselrichter (`e-shore-inv`,
  `e-inv-induct`) entlang der 12-V-Sammelschienen.
  → Die Regel ist also **nicht** wirkungslos-neutral: Eine Anbindung würde die eingefrorenen
  Referenzpläne verschieben (Kabellängen, Kreuzungen, Golden Master, Ratchets) — sie ist
  eine Layout-/Port-Entscheidung, keine reine Kostenmodell-Änderung.
  → Zweiter Versuch erst mit **getrennten AC-/DC-Korridoren an den Ports** (eigene Lane je
  Domäne im Port-Fan-Out, `lib/routing/rules/portFanOut.ts`) oder mit Wasser-Routing, wo der
  Nutzen fachlich sichtbar wird (`electrical ↔ water`). Reine Tuben-Aufblähung im
  A*-Lauf wurde am 2026-09-28 gebaut und gemessen: sie ändert die eingefrorenen Pläne
  nicht (Audit unverändert), lässt aber die nahen Paare stehen — die Stubs der Bündel sind
  von der Trassensperre ausgenommen, und genau dort laufen die gemischten Leitungen
  zusammen. Der Versuch ist deshalb **nicht** ausgeliefert.
- **RELATED TEST:** `lib/routing/rules/collision.test.ts`, `scripts/routing/domainProbe.test.ts`
  (Ratchet der gemessenen Zahlen), `npm run routing:domain-probe` (`scripts/routing/domainProbe.ts`)
- **RELATED ISSUE:** ROUTING-V2 §4.2.

---

## ROUTE-004 — Geometrie-Zahlen außerhalb der Tokens — **behoben 2026-09-28**

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
  Test in `tokens.test.ts` erweitert. Verbleibt: `MAX_EXPANSIONS`,
  `MAX_ACCEPTABLE_CROSSINGS` (Budget bzw. Abbruchschwelle — keine Preise, eigene
  Kosten-Tokens sind separat zu entscheiden).
- **STATUS (2026-09-27):** `BEND_COST` und `U_TURN_COST` sind **erledigt**: sie sind keine
  lokalen Konstanten mehr, sondern `COST_WEIGHTS.bend` / `.uTurn` aus dem generierten
  Kostenmodell (5 bzw. 25 × `laneGrid`; siehe ROUTE-002 Teil 1). Der Drift-Guard steht in
  `costModel.test.ts` und `pathfinding.test.ts`.
- **STATUS (2026-09-28): erledigt.** `MAX_EXPANSIONS` (48 000) und
  `MAX_ACCEPTABLE_CROSSINGS` (2) bleiben bewusst lokale **Budget-/Abbruchschwellen** —
  keine geometrischen Preise, also keine Tokens (die Entscheidung dazu steht im Modul).
  Sie sind jetzt per Drift-Guard in `pathfinding.test.ts` gepinnt, inklusive Gleichlauf
  mit der Legacy-Engine (`orthogonalRouting.ts`): eine einseitige Änderung fällt auf.

---

## ROUTE-006 — Platzierung außerhalb der Referenzkoordinaten: Restfehler, Rasterlage, Kabellänge

- **AREA:** Platzierung / Routing
- **FILE:** `lib/autoWire/placement.ts` (`flowAnchor`, `NODE_MIN_GAP`),
  `components/edges/utils/routeAll.ts` (`labelAnchorClearOfNodes`), `scripts/routing/audit.ts`
  (`--shifts`), `scripts/routing/shiftInvariance.test.ts`, `scripts/routing/cableLength.test.ts`
- **DESCRIPTION:** Vier Messungen vom 2026-09-27 zeigen dieselbe Grenze — die geprüfte
  Konfiguration ist die eingefrorene; jede Änderung der Anordnung von Auto-Raster und
  Karten zueinander ist eine neue Konfiguration:
  1. **Der relative Versatz ist tragend, nicht die Phase.** Eine reine Übersetzung des
     fertigen Layouts (Nutzer- und Auto-Knoten gemeinsam) um (8, 8), (13, 0) und (1200, 800)
     lässt I1–I7 auf allen sechs Referenzplänen bei **0** (gemessen). Verschiebt sich dagegen
     nur einer der beiden Teile, entstehen kurze Segmente: `acdc` bei Δ(8, 8) → **12-px-Segment**
     (I6 + I7) — genau die Beobachtung des Nutzers („schon eine reine X-Verschiebung des
     Rasters erzeugt 12-px-Segmente“). Fünf translationsinvariante Platzierungsvarianten
     (Raster folgt dem Plan, Batterie-Anker, Nachbar-Schwerpunkt, Plan-Schwerpunkt) wurden
     gemessen und verworfen; das absolute Raster bleibt (ADR 0017).
  2. **Der Flow-Anker entfernt die harten Überdeckungen verschobener Pläne.** Sechs
     Referenzpläne, volle Pipeline, Planposition Δ — Σ(I1..I3) und Kabelweg:

     | Δ          | vorher: Σ hart / px | mit Flow-Anker: Σ hart / px |
     | ---------- | ------------------- | --------------------------- |
     | (0, 0)     | 0 / 30.269          | 0 / 30.269                  |
     | (8, 8)     | 0 / 30.728          | 0 / 30.728                  |
     | (296,196)  | 5 / 38.910          | **0** / 30.909              |
     | (600,400)  | 3 / 54.949          | **0** / 30.373              |
     | (1200,800) | 4 / 88.693          | **0** / 29.789              |
     | (2400, 0)  | 2 / 102.837         | **0** / 32.610              |

     Die Zahl der Qualitätsmeldungen (I4–I7, keine Überdeckungen) schwankt mit dem relativen
     Versatz in beide Richtungen (Σ 25 vorher, Σ 24 nachher) — sie ist die Grenze, die
     Punkt 1 beschreibt, und wird hier dokumentiert statt versteckt.

  3. **„Plan ordnen“ (ELK) hat Rest-Überdeckungen an Ports.** Stand nach dem Merge des
     Arena-Zweigs (2026-09-27, ELK-Pfad `performAutoWiring → applyAdvancedLayout →
routeAllCables → checkInvariants`, sechs Referenzpläne, Kartenmaß 192 × 120):
     **I1 = 0, I2 = 5, I3 = 3**. Die fünf Überdeckungen sind vollständig port-nah:

     | Plan     | Paar                        | Überdeckung              | geteilter Port |
     | -------- | --------------------------- | ------------------------ | -------------- |
     | camper   | `e-fuse-light ↔ e-fuse-usb` | V @964 [220, 260], 40 px | ja             |
     | inverter | `e-auto-4 ↔ e-auto-8`       | V @704 [300, 308], 8 px  | ja             |
     | inverter | `e-auto-5 ↔ e-auto-9`       | V @720 [136, 176], 40 px | ja             |
     | complex  | `e-batt-minus ↔ e-auto-8`   | V @964 [537, 577], 40 px | ja             |
     | complex  | `e-fuse-heat ↔ e-auto-3`    | V @1452 [569, 577], 8 px | nein           |

     Vier davon sind **Fan-Out/Fan-In an einem geteilten Port**: zwei Kanten laufen nach
     dem Port-Stub auf DERSELBEN Quer-Lane weiter. Der Nudge kann das nicht lösen — die
     Läufe sitzen an den Stubs, und ein seitlicher Zug verletzt `stubMin` (alle vier
     gemessen: beide Anschluss-Stubs liegen bei 24–28 px, `stubMin` = 24). Das ist die
     **Port-Bündel-/Fan-Out-Ebene** (`portFanOutLanes`, ROUTE-002 Teil 2b) — dort ist die
     Lane eine Vergabe-, keine Ausweichfrage. **Nachgemessen und geschlossen 2026-09-28**
     (ROUTE-002 Teil 2b, ADR 0027): vier der fünf Paare waren an **beiden** Enden gekappt
     (`actual < stubMin + |lane|`; Stubs 24–28 px gegen gewünschte 40–56 px), dort hat keine
     Lane-Treppe Platz — die Vergabe kann sie nicht trennen. Deshalb wurde die
     Platzierungs-Freigabe auf **zwei** Lane-Schritte gehoben
     (`portFacingClearance = 68`): der ELK-Pfad ist damit bei **I2 = 0**, die Tabelle oben
     beschreibt den Stand davor.
     Der fünfte Fall (`e-fuse-heat ↔ e-auto-3`, 8 px, kein geteilter Port) wäre über die
     Lane-Leiter lösbar, kostet aber **zwei zusätzliche Kreuzungen** (gemessen: 9 statt 8
     Kreuzungs-/Überdeckungskontakte) — die Akzeptanz verwirft ihn deshalb, denn die
     Kreuzungs-Ratchet ist ein hartes Gate. Dokumentiert, nicht versteckt.
     Zur Historie: derselbe ELK-Pfad hatte vor den Korrekturen **I2 = 21, I3 = 17, I1 = 3**
     (ADR 0023 mit dem damaligen Optionssatz: I2 = 9, I3 = 1; ADR 0024: I2 = 3, I3 = 3).
     Die verbleibenden **I3 = 3** sind Freigabe-Unterschreitungen ohne Berührung
     (kein Bauteil-Durchlauf, I1 = 0).
     Nebenbei: die **Regressionssuite führt I2 jetzt selbst** (`ScenarioMetrics.edgeOverlaps`,
     Ratchet ≤ Baseline) — vorher waren Trassenüberdeckungen in den 15 Stress-Szenarien
     unsichtbar. Sie hat sofort einen Bestandsfall gefunden: `p11-zwangskreuzung` hat EINE
     Überdeckung über 440 px (`e-down ↔ e-up`, H @536 [256, 696]) — beide überdeckten Läufe
     sind **Handle-Stubs**, die der Nudge bauartbedingt nicht anfassen darf; festgehalten
     als Ratchet ≤ 1.

  4. **Die Kabellänge stand in keinem Gate.** `routingQuality.ts` misst den Legacy-Router,
     der Umweg-Faktor ist gegen die Platzierung blind (das Optimum wandert mit). Jetzt
     steht `Kabelweg`/`laengste` in `npm run routing:audit`, und
     `scripts/routing/cableLength.test.ts` hält die absolute Länge je Referenzplan als
     Ratchet (mit Gegenprobe: ohne den Flow-Anker fällt der Positionstest).
  5. **Der Nutzer-Versatz ist ein eigener Fehlerfall (2026-09-28).** Punkt 2 maß nur die
     eingefrorenen Δ-Werte; die 7×7-Matrix (Δ ∈ ±400, ±96, ±16, 0 px, 294 Läufe,
     `npm run routing:audit -- --shifts`) zeigt: Verschiebt der Nutzer **nur seine
     Bauteile**, rastet die AutoWire-Platzierung (`flowAnchor`, globale Rasterlinien) auf
     eine andere Zeile — und ein Teil der so entstehenden Konfigurationen war für den
     Router nicht lösbar. **51 von 294 Läufen hart verletzt** (I1 30, I2 53, I3 44),
     darunter **20 Notfallpfade**: die Leitung lief quer durch ein fremdes Bauteil.
     Ursache war die Mindestluft der Platzierung — `NODE_MIN_GAP` verlangte
     2 × `cableClearance` (24 px), während ein Kabel an einem gegenüberliegenden Port
     `stubMin` (24) + `laneGrid` (16) braucht, bevor es abbiegen kann. Mit
     `NODE_MIN_GAP = stubMin + laneGrid` (40 px): **10 Läufe, 12 × I2, sonst 0** — kein
     Notfallpfad, kein I1, und die eingefrorene Referenzkonfiguration bleibt unverändert
     (gleiche Kabellängen, gleiche Kreuzungen, gleiche Port-Bündel). Das Gate steht in
     `routing:audit -- --shifts` (hart: kein Notfallpfad, kein I1; Ratchet: I2/I3 je Plan —
     Rest camper 2, acdc 10) und in `scripts/routing/shiftInvariance.test.ts`. Der Rest-I2
     sind Trassenkollisionen verschobener Bündel (Port-Fan-Out-Ebene), kein Durchlauf.
- **CURRENT BEHAVIOR:** Ein verschobener Plan kann kurze Segmente melden (I4–I7) und — je
  nach Rasterphase — Trassenüberdeckungen (I2); **kein** Bauteil-Durchlauf (I1) und
  **kein** Notfallpfad mehr (Versatz-Gate, 2026-09-28). Absolutwerte und Reste stehen in
  Audit (Tabelle + `--shifts`), Ratchet und Invarianten-Test.
- **EXPECTED BEHAVIOR:** An jeder Planposition kein Kabel durch ein Bauteil und keine
  Trassenüberdeckung (I1–I3); kurze Segmente bleiben eine dokumentierte Qualitätsgrenze.
- **SEVERITY:** niedrig (kein I1/kein Notfallpfad an jeder Planposition; Rest-I2 über
  Ratchet sichtbar)
- **WORKAROUND:** Für kompakte Layouts „Plan ordnen“ (ELK) verwenden — 2–44 % kürzer,
  I1 = 0. Der Ursprung ist als Standort nicht mehr nötig (Versatz-Gate).
- **RELATED TEST:** `scripts/routing/shiftInvariance.test.ts` (Versatz-Gate),
  `scripts/routing/cableLength.test.ts`, `lib/planner/layout-engine/elkSpacing.test.ts`,
  `components/edges/utils/routeAll.test.ts` (Beschriftung verdeckt keine Karte),
  `lib/routing/invariants.test.ts`, `scripts/routing/finalValidation.test.ts`
- **RELATED ISSUE:** ADR 0023, ADR 0017, ROUTE-BUG-32; Finding 2026-09-27 (§ Reihenfolge).

---

## ROUTE-007 — Überdeckungen ohne gemeinsame Anschlussstelle fehlten in der Diagnose — **behoben 2026-09-28**

- **STATUS:** behoben — der Vorfilter `if (!sharesPort(a, b)) continue;` in `analyzeOverlaps`
  ist entfernt; `isPortBundleOverlap` prüft die gemeinsame Anschlussstelle selbst und liefert
  sonst `false`. Die Port-Bündel-Ausnahme ist unverändert, die Zahl vollständig. Zwei Fälle in
  `scripts/routing/portBundleModel.test.ts` halten das fest (Überdeckung ohne gemeinsamen Port →
  `elsewhere = 1` und I2 = 1; Bündel am gemeinsamen Port bleibt `atPort`). Die Referenzpläne
  sind unverändert (I2 = 0, `atPort`-Zahlen identisch).
- **AREA:** Diagnose / Routing
- **FILE:** `scripts/routing/audit.ts` (`analyzeOverlaps`), `scripts/routing/portBundleModel.test.ts`
- **DESCRIPTION:** Der Vorfilter war als Abkürzung für die Port-Bündel-Ausnahme gedacht, wirkte
  aber als Lücke: Kollineare Überdeckungen zwischen Kanten **ohne** gemeinsame Anschlussstelle
  wurden weder als `atPort` noch als `elsewhere` gezählt — sie tauchten in der Diagnose gar nicht
  auf. Gemessen in der Versatz-Matrix: `acdc Δ(-96,-96)` hat I2 = 1, die Diagnose meldete
  `elsewhere = 0`.
- **CURRENT BEHAVIOR (behoben):** `elsewhere` zählt jede harte Überdeckung, die kein Port-Bündel
  ist — unabhängig davon, ob die Kanten eine Anschlussstelle teilen.
- **EXPECTED BEHAVIOR:** Diagnose und Invariante (`checkEdgeEdgeOverlaps`) zählen dieselbe
  Grundmenge; die Kopplungsprüfung des Gates (`elsewhere > 0 ⇔ I2 > 0`) gilt an jeder Stelle.
- **SEVERITY:** niedrig (Diagnose — die Invariante I2 selbst zählte korrekt, und das Gate prüft
  die Kopplung auf den eingefrorenen Positionen; in den verschobenen Läufen war die Zahl nur
  Diagnose)
- **WORKAROUND:** entfällt.
- **RELATED TEST:** `scripts/routing/portBundleModel.test.ts`,
  `scripts/routing/shiftInvariance.test.ts` (Rest-I2 der Versätze)
- **RELATED ISSUE:** ROUTE-002 Teil 2a (ADR 0025), ROUTE-006 Punkt 5.

---

## ARCH-001 — Server-Route und Postgres-Pool im statischen Export — **teilweise behoben 2026-09-28**

(Schein-Feature weg, Produktentscheidung offen)

- **AREA:** Architektur
- **FILE:** `app/api/chat/route.ts`, `lib/db.ts`, `components/Chat.tsx`, `app/ki-assistent/page.tsx`
- **DESCRIPTION:** `next.config.ts` setzt `output: 'export'` (ADR 0001: kein Backend).
  Trotzdem existieren eine API-Route mit `pg`-Pool (`lib/db.ts`, `OPENAI_API_KEY`) und die
  Seite `/ki-assistent`, die `<Chat>` gegen `NEXT_PUBLIC_CHAT_API_URL || '/api/chat'` rendert.
- **CURRENT BEHAVIOR (gemessen 2026-09-09):**
  - `npm run build` weist `/api/chat` als **`ƒ` (Dynamic, server-rendered on demand)** aus —
    der Export enthält **kein** `out/api` (geprüft).
  - Ohne gesetzte `NEXT_PUBLIC_CHAT_API_URL` sendet die Seite ins Leere (404) und wirkt dabei
    funktionsfähig. — **behoben 2026-09-28, s. STATUS.**
  - `.env.example` behauptete „No environment variables are required“ — die Variable war dort
    nicht dokumentiert (mit ADR 0021 ergänzt).
  - Abgesichert ist die Route nur durch Unit-Tests mit gemocktem `pg` (578 Zeilen):
    grün, aber ohne Bezug zum ausgelieferten Artefakt.
- **STATUS (2026-09-28): das Schein-Feature ist weg (ADR 0021 Punkt 2 umgesetzt).**
  `components/Chat.tsx` leitet den Endpunkt jetzt über `resolveChatEndpoint` ab: gesetzte
  `NEXT_PUBLIC_CHAT_API_URL` gewinnt (getrimmt), sonst gibt es **nur** im Development-Server
  den lokalen Pfad `/api/chat` — der Produktbuild ist `output: 'export'` (kein `out/api`,
  `next start` gar nicht möglich), dort ist der Endpunkt `null`. In diesem Fall rendert
  `/ki-assistent` einen klaren Hinweis („Kein Assistent konfiguriert“, mit Grund und Weg über
  die Env-Variable) statt eines Eingabefelds; der `useChat`-Hook wird gar nicht erst
  aufgerufen, es kann also nichts ins Leere senden. `.env.example` beschreibt das Verhalten
  und der tote `NEXT_PUBLIC_CHAT_TOKEN`-Eintrag ist entfernt (S1: kein clientseitiges
  „Secret“). Tests: `components/Chat.test.tsx` (13, u. a. Export-Fall ohne Endpunkt).
  **Offen bleibt die Produktentscheidung (ADR 0021 Punkt 1):** ob `app/api/chat/route.ts`,
  `lib/db.ts` (`pg`-Pool) und `app/api/chat/route.test.ts` (578 gemockte Zeilen) im Baum
  bleiben oder mit einem externen Endpunkt in ein eigenes Deployment wandern.
- **EXPECTED BEHAVIOR:** Entweder externer Endpunkt + dokumentierte Konfiguration, oder
  Route/Seite entfernen. (Der Konfigurationsweg ist umgesetzt; das Entfernen der Route ist
  die offene Produktentscheidung.)
- **SEVERITY:** war hoch (funktional) — **behoben 2026-09-28**, kein Leerlauf-Versand mehr;
  niedrig (Sicherheit: kein Secret im Repo). Verbleibend ist eine Produktentscheidung
  (Punkt 1), kein Fehler.
- **WORKAROUND:** Nicht als lauffähiges Feature behandeln. Vor Änderungen prüfen, ob der
  KI-Assistent Teil des Produkts sein soll.
- **RELATED TEST:** `app/api/chat/route.test.ts` (578 Zeilen, komplett gemockt),
  `components/Chat.test.tsx`
- **RELATED ISSUE:** ADR 0001, **ADR 0021** (Entscheidungsvorlage, offen).

---

## ARCH-002 — Legacy-Router lebt weiter (649 Zeilen + zwei Testdateien) — **behoben 2026-09-28**

- **STATUS (2026-09-28): behoben (Kennzeichnung).** Der Dateikopf von
  `components/edges/utils/orthogonalRouting.ts` markiert die Router-Kernfunktionen jetzt
  ausdrücklich als **Legacy-/Galerie-Werkzeug** (R1–R7 sind nicht der Produktivpfad; dieser
  ist I1–I10 über `routeAllCables` → `findCablePath`) und benennt zugleich die geteilten
  Bausteine, die der Produktivpfad weiterhin importiert (`readHandleBounds` in
  `pathfinding.ts`; `NODE_FALLBACK_*` und die Typen in `routingCache.ts`).
  `orthogonalRouting.invariants.test.ts` trägt denselben Hinweis. Der Code bleibt, weil die
  Routing-Galerie auf ihm aufbaut (Entfernen wäre eine eigene Entscheidung über die Galerie,
  LEGACY.md L-1).
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

  | Messung                             | Plan        | Wert                                  | Budget     |
  | ----------------------------------- | ----------- | ------------------------------------- | ---------- |
  | `npm run perf:edge-routing` (Gate)  | N=36 E=134  | Median **2,3–3,1 ms**, p90 3,3–4,4 ms | 16 ms → OK |
  | dto., Durchlauf „Sehr groß“         | N=120 E=585 | **21,3 ms**                           | über 16 ms |
  | `npm run perf:route-scaling`, Kette | N=100 E=99  | 13,8 ms (0,14 ms/Kante)               | —          |
  | dto.                                | N=500 E=499 | 215 ms (0,43 ms/Kante)                | —          |
  | dto., Worst Case Spannkanten        | N=250 E=125 | 121 ms (0,97 ms/Kante)                | —          |
  | dto.                                | N=500 E=250 | 2 125 ms (8,50 ms/Kante)              | —          |

  (Render-Zahlen aus drei Läufen, 2026-09-28; die Scaling-Probe meldet min/max mit.)

- **CURRENT BEHAVIOR:** Große Pläne werden im Live-Betrieb durch die 100-ms-Drossel
  (`ROUTE_THROTTLE_MS`) erträglich, nicht durch Laufzeit. Ab N≈500 mit planweiten Kanten
  übersteigt ein einzelner vollständiger Durchlauf die Drossel deutlich (≈2 s).
- **ZWEITER MESSPUNKT (2026-09-28, ADR 0030):** Der Live-Pfad-Ratchet wertet jetzt zusätzlich
  die **Streuung aus denselben Messproben** aus: `p90 ≤ 2 × Median`, blockierend
  (Exit-Code 1). Gemessen über zehn Läufe lag das Verhältnis bei 1,11–1,56; die erste
  Fassung mit 1,5 scheiterte sofort an einem 1,56-Lauf (der Median schwankt stärker als der
  Schwanz) — deshalb 2. Ein absolutes p90-Budget bleibt verworfen: 292 ms bei unverändertem
  Code unter Nebenlast. Median-Ratchet (60 ms) und 16-ms-Ziel bleiben unangetastet.
- **EXPECTED BEHAVIOR:** Der zweite, dokumentierte Messpunkt ist umgesetzt (ADR 0030).
  Offen bleibt die **absolute** Seite: große Pläne über dem 16-ms-Ziel brauchen eine
  Optimierung mit eigenem ADR. **Kein** stilles Anheben des Budgets und kein Entfernen des
  Gates.
- **TEILWEISE UMGESETZT (2026-09-25, AUDIT P1):** Vorher maß das CI-Gate ausschließlich
  `buildOrthogonalPath` — den **Legacy-Router**, den die Fläche seit ADR 0014 nicht mehr
  zeichnet. `npm run perf:edge-routing` misst jetzt zusätzlich die **Live-Pipeline**
  (`routeAllCables` auf demselben Referenzplan N=36/E=134): Median **≈ 29 ms**, p90 ≈ 40 ms
  auf der Entwicklungsmaschine — also rund doppelt über dem 16-ms-Frame-Budget. Das Gate
  läuft deshalb als **Ratchet** (60 ms, Exit-Code bei Überschreitung), nicht als Behauptung:
  der Ist-Zustand ist festgehalten und Rückfall verboten; das Ziel bleibt 16 ms und wird
  durch echte Optimierung (nicht durch Anheben) erreicht. Offen bleibt die
  Skalierungsspitze N≈500 (≈2 s, s. Tabelle).
- **STATUS (2026-09-28):** Das Gate vergleicht **nur den Median**. Drei isolierte Läufe:
  Live-Median 48,7–51,4 ms, **p90 59,0–65,4 ms** — der p90 liegt damit an bzw. über der
  60-ms-Ratchet, während das Gate grün meldet. Unter Nebenlast (parallele Builds) gemessen:
  Median 124 ms, p90 292 ms bei **unverändertem** Code → der Ratchet ist keine
  lastnormalisierte Aussage. Ein p90-Budget braucht eine Kalibrierung im selben Prozess
  (eigener ADR-0012-Nachtrag), kein stilles Anheben.
- **SEVERITY:** mittel
- **WORKAROUND:** Drossel nutzen; Änderungen am A\*-Innenloop immer mit beiden Benchmarks
  gegenmessen. Einzelmessungen großer Pläne streuen um Faktor >2 — immer den Median nehmen.
- **RELATED TEST:** `npm run perf:edge-routing` (CI-Gate), `npm run perf:route-scaling` (Probe)
- **RELATED ISSUE:** ADR 0012, **ADR 0030** (Streuungs-Ratchet), historisch AUDIT PERF-001
  (Region-Filter; sechsstellig → ms).

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

## TEST-002 — Das visuelle Gate meldet Pixel-Drift (nicht blockierend, Baseline-Stand offen)

- **AREA:** UI / CI
- **FILE:** `tests/e2e/visual.spec.ts` (+ Baselines in `tests/e2e/visual.spec.ts-snapshots/`),
  Job „Visuelles Gate (nicht blockierend)" in `.github/workflows/quality.yml`
- **DESCRIPTION:** Der Pixel-Vergleich der Kernrouten (Homepage, Dach, Heizung,
  Elektrik-Planung, Impressum; hell/dunkel; 375/768/1440) liegt über der Schwelle von
  `maxDiffPixelRatio = 0.02`. Der Job ist bewusst `continue-on-error: true` — er blockiert
  weder Workflow noch Deploy, sondern meldet UI-Drift zur Bewertung.
- **EVIDENCE (2026-09-28):** Der Job scheitert **auch auf dem Default-Branch** — Runs
  `36396267377` und `36395471654` (`feature/react-flow-cable-editor-7322653268250495059`)
  melden für den visuellen Job `failure`, während Workflow, Pages-Build und Deploy
  `success` sind. Der Arena-Branch (`36413722168`, PR #468) zeigt dasselbe Bild. Die Drift
  ist damit **kein** Regress dieses Branchs, sondern ein offener Baseline-Stand.
- **CURRENT BEHAVIOR:** Der visuelle Job ist rot, der Rest der Suite grün; die Abweichung
  ist im CI-Log/Artefakt (`visual-diff`) sichtbar.
- **EXPECTED BEHAVIOR:** Baselines nach **UI-Freigabe** neu aufnehmen, dann ist der Job
  wieder grün und schützt weiter gegen unbeabsichtigte Layout-/Farb-Brüche.
- **SEVERITY:** niedrig (nicht blockierend), aber es kostet jedem PR eine rote Zeile.
- **WORKAROUND:** `npx playwright test tests/e2e/visual.spec.ts --update-snapshots` **in
  einer Umgebung mit Browser** (im Sandkasten dieser Session nicht möglich: der
  Chromium-Download ist gesperrt, `npx playwright install chromium` scheitert mit
  `Download failure`). Die Baseline-Prüfung selbst ist dokumentiert in `docs/UI-BASELINE.md`
  (Freeze-Punkt, Refresh-Regel).
- **RELATED TEST:** `tests/e2e/visual.spec.ts` (`--grep "hält die Baseline"`), Artefakt
  `visual-diff`
- **RELATED ISSUE:** `docs/UI-BASELINE.md`, TEST-001 (E2E-Gate blockierte 16 Tage lang
  jeden Deploy)

## DOM-004 — Kantendaten werden beim Laden nicht schemageprüft — **behoben 2026-09-28**

- **STATUS:** behoben. `lib/edgeSchema.ts` deklariert die bekannten Felder aus
  `lib/domain/cableEdgeData.ts` (Zahl/String/Boolean/Enum `edgeDomain`, Objekt
  `acProtection`); `store/slices/persistence.ts` wendet es in `sanitizeEdgeData` an —
  dieselbe Semantik wie `lib/nodeSchema.ts` für `node.data`: falsch getippte BEKANNTE
  Felder werden entfernt (kein stilles „Heilen“, die Leseschicht fällt auf ihren
  dokumentierten Default), unbekannte Felder bleiben erhalten.
- **AREA:** Domäne / Persistenz
- **FILE:** `store/slices/persistence.ts` (`sanitizeEdgeData`), `lib/edgeSchema.ts`
- **DESCRIPTION:** Die Migration wendet `lib/nodeSchema` nur auf `node.data` an.
  `sanitizeEdgeData` prüft lediglich, dass `data` ein Objekt ist. Falsch getippte Felder in
  `edge.data` (z. B. `crossSection: '2,5'`, `fuseSize: 'ja'`) überleben den Rehydrate.
- **CURRENT BEHAVIOR:** Die Leseseite fängt vieles ab (`quantityOr`, `Number(...)`, Marker-Kurzschluss),
  aber nicht alles, und nicht an einer benannten Stelle.
- **EXPECTED BEHAVIOR:** deklaratives Feld-Schema für `edge.data`, symmetrisch zu `node.data`.
- **SEVERITY:** mittel
- **WORKAROUND:** Beim Lesen von `edge.data` immer `parseQuantity`/`quantityOr` bzw. die
  Marker-Kurzschlüsse aus `lib/autoWire/validation.ts` nutzen.
- **RELATED TEST:** `lib/edgeSchema.test.ts`, `store/slices/persistence.test.ts`
  (DOM-004-Fall: falsch getippte bekannte Felder fliegen, unbekannte bleiben)

---

## DOM-005 — `CableEdgeData.geometry` ist ein totes Feld — **behoben 2026-09-28**

- **AREA:** Domäne / Routing
- **FILE:** `lib/domain/cableEdgeData.ts`
- **DESCRIPTION:** `geometry?: {points}` ist deklariert, wird aber von **keinem** Produktivcode
  gelesen — `scripts/routing/architecture.test.ts` verbietet das Lesen ausdrücklich (ADR 0014).
  Es ist das Einfallstor der entfernten zweiten Routing-Engine.
- **STATUS:** behoben. Das Feld ist aus `CableEdgeData` entfernt; der Dateikopf
  benennt an seiner Stelle ausdrücklich das Verbot („Kabelgeometrie lebt
  ausschließlich im Route-Publish des globalen Passes“, ADR 0014). Der Wächter
  `scripts/routing/architecture.test.ts` verbietet Produktivcode-Zugriffe auf
  `edge.data.geometry` (inkl. Destrukturierung) weiterhin.
- **CURRENT BEHAVIOR:** (historisch) Das Feld war Teil des persistierten Schemas, ohne Wirkung.
- **EXPECTED BEHAVIOR:** Entfernen oder als ausdrücklich verboten markieren — erledigt.
- **SEVERITY:** niedrig
- **WORKAROUND:** (historisch) Nicht lesen, nicht schreiben (es gibt kein `Polyline` mehr,
  das es füllt).
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
  **Erledigt (2026-09-28):** `.github/workflows/quality.yml` enthält den Schritt
  `run: npm run routing:audit` (vor dem Perf-Gate) — die damalige
  Berechtigungs-Blockade der Session ist damit gegenstandslos.
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
