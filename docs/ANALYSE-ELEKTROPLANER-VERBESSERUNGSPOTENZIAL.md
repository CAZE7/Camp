# Analyse: Verbesserungspotenzial im Elektrikplaner — Schwerpunkt Routing

**Datum:** 2026-09-10 · **Branch:** `arena/01a08a86-camp` (Basis `c5c33c3`)

> **UMSETZUNGSSTAND 2026-09-10 (gleiche Session).** Bereits umgesetzt:
> **R1** (Kabellänge = PathResult.length, Label/BOM/onConnect/Inspector),
> **R8** (Einzelfall-Fallback nutzt dieselbe Port-Fan-Out-Mechanik,
> `fanOutLanesForEdge`, inkl. Wasserstrecken), **R9** (tight/fallback-Halo
> pro Leitung + Kreuzungen im Titel), **R10** (gezielte Absicherung nach dem 3. Fenster-Nachzug; Union-Fixpunkt gemessen und verworfen, siehe Kommentar
> in `routeAll.ts`), **R11-c/ROUTE-004** (`CLEARANCE_GOAL`, Kontur-Puffer,
> `obstacleRegionPad` auf Tokens + Drift-Guard), **R11-a** (tote
> Lane-Helper entfernt), **DOM-005** (`geometry`-Feld entfernt),
> **ELE-003** (Golden-Master-Capture rechnet AC-Kanten mit `acCurrentA`,
> Fixtures neu erfasst), **D1/D2** (ROUTING-V2.md-, ROUTING-INVARIANTS.md-,
> Galerie-Kopf). Bewusst NICHT angefasst (Messprotokoll/ADR nötig, siehe
> Roadmap): R2 (WP-8), R3 (Rip-up), R4 (Kostenmodell im A\*-Innerloop), R5
> (LaneRegistry), R6, R7 (Galerie-Migration), L1/L2/L3, U1/U2, A3, P2/P3,
> A1-Heilung (AutoWire-Längen bleiben Geometrie-Schätzung — sie wird durch
> R1s Routen-Anzeige im Label/BOM überholt), ARCH-001.

**Methode:** Voll-Durchsicht des Routing-Stacks (`components/edges/utils/*`,
`lib/routing/*`, `lib/autoWire/*`, `store/slices/graphSlice.ts`,
`components/edges/CableEdge.tsx`, `components/planner/FlowCanvas.tsx`), aller
Routing-Dokumente (`docs/ai/*`, `docs/adr/*`, `KNOWN-PROBLEMS.md`, `LEGACY.md`)
sowie eigener Messungen in diesem Checkout (Audit, beide Benchmarks, eine
eigens geschriebene Längen-Sonde, Testlauf der Routing-Suiten).

Alle Aussagen sind im aktuellen Code belegt; jedes Messergebnis ist mit dem
Befehl reproduzierbar, mit dem es erhoben wurde.

---

## 0. Kurzfassung

Das Routing ist in einem **außergewöhnlich gepflegten Zustand**: Auf den sechs
Referenzplänen sind alle acht harten und weichen Invarianten (I1–I7) bei 0,
die Fallback-Quote ist 0, der Router ist deterministisch, und ein Ratchet-
Gate plus Golden Master sichern den Bestand. Die verbleibenden
Verbesserungspotenziale sind daher **keine Feuerwehrfälle**, sondern drei
strukturelle Themen:

| #   | Befund (Kurz)                                                                                             | Wirkung                                                                                                                                           | Einstufung             |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | **Geroutete Leitungslänge wird berechnet, aber verworfen** (PathResult.length, R1)                        | Spannungsfall, Querschnitt und Stückliste rechnen mit der Luftlinie — **+23…+70 %** Abweichung in den Referenzplänen, Einzelkante bis **+17,3 m** | fachlich hoch          |
| 2   | **Kein inkrementelles Re-Routing** (WP-8 nie umgesetzt, R2)                                               | Voller O(E)-Pass alle 100 ms auf dem Main-Thread; Worst-Case-Plan **2,0 s Blockade**                                                              | hoch bei großen Plänen |
| 3   | **Strukturelle Kreuzungen bleiben** (48 über die Referenzpläne, R3)                                       | Gieriges Tube-Modell ohne Rip-up; Kostenmodell existiert, ist aber nicht angebunden (R4–R6)                                                       | mittel                 |
| 4   | **Ausnahmen sind im Modell, nicht im Bild** (tightMargin/fallbackHitsObstacles, R8/R9)                    | Leitungen ohne Freigabe-Garantie sehen aus wie normale Leitungen                                                                                  | mittel                 |
| 5   | **Zwei getrennte Welten ELK ↔ A\*** bleiben ungenutzt nebeneinander (L1/L2)                               | A/B-bewiesener Gewinn (−75 % Kreuzungen, −54 % Bends) wird nur per Knopfdruck geholt; Junction-Points werden weggeworfen                          | mittel                 |
| 6   | **Doku-Hygiene** (D1–D4): FROZEN-Spec zeigt auf gelöschte Verzeichnisse, Galerie zeigt die falsche Engine | Agenten-Fehlleitung, Vertrauensrisiko                                                                                                             | mittel                 |

Positiv-Hinweis vorab: `KNOWN-PROBLEMS.md` deckt bereits sechs dieser Bereiche
ab (ROUTE-001…004, ARCH-001, DOC-001/004). **Neu** sind dagegen R1, R2
(WP-8-Rest), R8–R11, L1/L2, A1/A2 sowie U1–U5 aus dieser Analyse.

---

## 1. Gemessener Ausgangszustand (dieser Checkout, 2026-09-10)

### 1.1 Invarianten-Audit [`npm run routing:audit`]

| Plan     | Kanten |  I1 |  I2 |  I3 |  I4 |  I5 |  I6 |  I7 | hart | fallback | determ. | Kreuzungen (Segment-Paare) |
| -------- | -----: | --: | --: | --: | --: | --: | --: | --: | ---: | -------: | ------- | -------------------------: |
| simple   |      9 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |    0 |        0 | true    |                          2 |
| camper   |     12 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |    0 |        0 | true    |                          5 |
| solar    |     11 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |    0 |        0 | true    |                          2 |
| inverter |     10 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |    0 |        0 | true    |                          2 |
| acdc     |     14 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |    0 |        0 | true    |                          8 |
| complex  |     23 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |    0 |        0 | true    |                         29 |

Strikte Diagnose (strenger als I2, akzeptierte Port-Bündel-Überdeckung):
22 Überdeckungs-Paare am Port, 25 außerhalb — alle von der dokumentierten
Bündel-Ausnahme gedeckt (s. L2 für einen Lösungsweg).

### 1.2 Performance [`npm run perf:edge-routing`, `npm run perf:route-scaling`]

- **Gate** (Referenzplan N=36/E=134): Median **2,45 ms**, p90 6,27 ms — Budget 16 ms → OK.
- Groß: N=120/E=585 → **19,0 ms** pro vollem Render-Durchlauf (über 16 ms, bekannt: PERF-001).
- Skalierungs-Probe, Kette: N=500/E=499 → **242 ms** (0,48 ms/Kante).
- Worst Case planweite Spannkanten: N=500/E=250 → **2.001 ms** (8,01 ms/Kante).

### 1.3 Längen-Abweichung Routing vs. Berechnungsmodell (eigene Sonde)

Befehl: tsx-Sonde über `performAutoWiring` + `routeAllCables` der sechs
`knownPlans/`; vergleicht `PathResult.length` mit der Luftlinie Handle→Handle
(das ist exakt die Größe, die `CableEdge` anzeigt und dimensioniert):

| Plan     | Σ geroutet | Σ Luftlinie |   Umweg | schlimmste Einzelkante              |
| -------- | ---------: | ----------: | ------: | ----------------------------------- |
| simple   |   2 697 px |    1 954 px | +38,0 % | e-auto-7: +211 px (≈ +2,1 m)        |
| camper   |   3 805 px |    2 615 px | +45,5 % | e-auto-6: +225 px (≈ +2,3 m)        |
| solar    |   3 200 px |    2 598 px | +23,2 % | e-auto-11: +212 px                  |
| inverter |   3 888 px |    2 733 px | +42,2 % | e-auto-2: +340 px                   |
| acdc     |   5 770 px |    4 022 px | +43,5 % | e-auto-8: +730 px                   |
| complex  |  10 909 px |    6 425 px | +69,8 % | e-auto-5: **+1 726 px (≈ +17,3 m)** |

### 1.4 Tests

Gezielter Lauf der Routing-Suiten (`npx vitest run components/edges utils
lib/routing scripts/routing scripts/regression`): **44 Dateien / 820 Tests —
grün.**

---

## 2. Befunde im Routing

Legende: **[neu]** = nicht in `KNOWN-PROBLEMS.md` gelistet · **[bekannt]** =
dort dokumentiert (hier nur eingeordnet).

### R1 — Geroutete Leitungslänge wird berechnet, dann verworfen **[neu, höchstes fachliches Gewicht]**

**Befund.** `PathResult.length` wird in `pathfinding.ts` (`assemble`) und
`routeAll.ts` (`rebuild`) sauber aus den Wegpunkten berechnet — aber kein
Produktivkonsument liest es:

- `components/edges/CableEdge.tsx` (~Zeile 470) rechnet für Anzeige,
  Spannungsfall und Querschnitt mit
  `Math.hypot(targetX - sourceX, targetY - sourceY) / PX_PER_METER` — also der
  **Luftlinie zwischen den Handle-Punkten**, falls der Nutzer keine Länge
  eingetragen hat.
- Die Stückliste (`components/planner/BOMModal.tsx:54/59`) summiert
  `edge.data?.length || 1`.
- AutoWire befüllt `data.length` ebenfalls euklidisch (lib/autoWire.ts,
  `geometricLength`, mit 1-m-Mindestclamp).

**Wirkung.** Jede Hindernis-Umfahrung (gemessen +23…+70 % Gesamtlänge, bis
+17,3 m auf einer Kante) sorgt für einen **systematisch zu optimistischen**
Spannungsfall und damit potenziell zu knappe Querschnitte — ausgerechnet in
dichten Plänen, die der Router entschärft. Das 3-%-Budget (Anzeige) wird
gegen die falsche Länge geprüft. Für eine Software, die „nach VDE-Regeln
nachrechnet", ist das der einer der sichtbarsten fachlichen Tausendsassa-Befunde.

**Vorschlag.**

1. `PathResult.length` als `estimatedLength` (`rounded 0,1 m`) in den
   `PathResult`-Publish-Pfad aufnehmen und in `CableEdge` als Default
   verwenden: `data.length ?? routedLength ?? euklid`. Manuelle Nutzer-Länge
   bleibt immer Vorrang (Vertrag heute).
2. BOMModal auf dieselbe Quelle umstellen.
3. `label`-Anzeige um die Herkunft ergänzen („geschätzt aus Verlegeweg" vs.
   „manuell"), sonst entsteht ein neuer Unterschied zwischen Editierfeld und
   Grafik (EdgeInspector liest `edge.data?.length ?? 3`).
4. Golden-Master-Recapture + Ratchet-Prüfung nach CHANGE-WORKFLOW.md, weil
   `knownPlans/*.json → electrical.lengths` sich ändern.

**Aufwand:** 1–2 Tage + Recapture + Tests. **Risiko:** mittel (Golden Master,
Erwartungswandel der Anzeige — deutlich dokumentieren).

### R2 — Kein inkrementelles Re-Routing; WP-8 wurde nie umgesetzt **[neu im Detail]**

**Befund.** `CableRouteSync` (`cableRouteStore.ts`) läuft bei **jeder**
Signatur-Änderung gedrosselt (100 ms Tail) den **kompletten Plan** durch
`routeAllCables`. Der für WP-8 vorgesehene Umfang (Affected-Set per
Bounding-Box, Zwei-Qualitäts-Stufen „L-Stub-Vorschau im Drag, voller Pass am
Drag-Ende", gescopedes Nudging — `docs/AGENT-PLAN-ROUTING-V2.md`, Issue #397)
existiert nirgendwo: es gibt keine betroffene Teilmenge, keinen
Vorschau-Modus, und das Nudging läuft global.

**Wirkung.** Siehe §1.2: Kette N=500/E=499 ≙ 242 ms pro Pass; Worst Case
planweite Spannkanten ≙ **2,0 s** — auf dem **Main-Thread** (der A\*-Pass hat
keine elkj-ähnliche Worker-Option). Ab ~250–500 Knoten mit Querlegern friert
die UI während Drags regelmäßig ein; die 100-ms-Drossel macht es nur
seltener, nicht kürzer.

**Vorschlag (WP-8 nachholen, inwerten Teilschritten).**

1. **Affected-Set zuerst:** Kanten, deren Route-BBox (alt + neu) die
   Bounding-Box der geänderten Knoten schneidet, plus Kanten an deren Ports.
   Rest bleibt eingefroren. Messbares Ziel: <16 ms bis N=250.
2. **Zwei-Stufen-Qualität:** im Drag nur Katalog-Trasse (kein A\*) für die
   betroffenen Kanten, am Drop-Ende voller Pass. Determinismus bleibt
   gegeben (voller Pass zuletzt gewinnt).
3. **Worker:** den Pure-Router (Eingabe: plain data, Ausgabe: Waypoints) in
   einen Web Worker verlagern — der Worker-Vertrag P-6 ist mit dem ELK-Graph
   bereits bewiesen und `routeAllCables` ist seitenfrei (bis auf den
   internen LRU-Cache, der pro Worker-Instanz lokal bleibt).

**Aufwand:** Affected-Set 2–3 Tage; Zwei-Stufen 2 Tage; Worker 3–5 Tage. Jeder
Schritt einzeln messen (beide Benchmarks) und einzeln per ADR dokumentieren.

### R3 — Strukturelle Kreuzungen: gierige Nachbehandlung ohne Rip-up **[neu in dieser Form]**

**Befund.** Aktuell 48 Kreuzungen über den Referenzplänen (complex allein
29). Der Mechanismus hat drei Ebenen, alle **lokal/gierig**:

1. pro Kante: Ausweich-Trassen `lane ±48/±96 px` (`findCablePath`), sobald
   > 2 Kreuzungen gegen eine **Mittelpunkt-Näherung** (dynamicRoutedSegments)
   > der bereits gerouteten Kanten gezählt werden;
2. danach: `nudgeOrthogonalPaths` (parallele Innenstücke separieren);
3. danach: `resolveHops` — die übrigen Kreuzungen werden optisch entschärft.

In `routeAll.ts` ist dokumentiert, dass ein zweiter Routing-Gang über die
kreuzungsreichsten Kanten mit vollem Wissen **gemessen und verworfen wurde**
(keine ´Verbesserung auf den Referenzplänen). Das ist der entscheidende
Punkt: Das verbleibende Kreuzungsniveau (complex 29) wird im Code als
**„strukturell"** eingeordnet — vier Bauteil-Spalten mit neun Querlegern.

**Wirkung.** 29 Kreuzungen auf 23 Kanten ist viel — aber der wichtige
Fairness-Hinweis: Der Vergleich mit ELK (complex: 6 Kreuzungen) ist **nicht**
gleichwertig, weil ELK dafür Knoten umlegt (ADR 0011). Auf **fixierten
Positionen** ist ein Teil der complex-Kreuzungen vermutlich wirklich
unvermeidbar. Wie groß dieser Teil ist, weiß keine Stelle im Repo — dafür
fehlt die Messmethode.

**Vorschlag (messbar, konventionskonform).**

1. **Bodenprobe zuerst:** Lower-Bound-Schätzung der unvermeidbaren
   Kreuzungen je Referenzplan (z. B. kreuzungsminimales Layout per
   ILP-Approximation oder ELK mit `interactive: true`, knots fixiert) — sonst
   optimiert man blind gegen ein unbekanntes Optimum.
2. **Rip-up & Reroute als Experiment:** Kanten mit >0 echten Kreuzungen
   lösen, als weiche Hindernisse gegen den `SegmentSpatialIndex` bepreisen
   (das vorbereitete `segmentExtraCost`, R4) und neu routen — 1–3 Iterationen,
   deterministisch, Abbruch bei Verschlechterung. Erfolgskriterium strikt:
   weniger Kreuzungen bei I1–I7 = 0 und Determinismus, sonst verwerfen.
3. **Erst danach** über erwünschtes Tunen der ±48/96-Trassen reden (mehr
   Kandidaten kosten Multiplikative A\*-Zeit, R2 wird dadurch wichtiger).

**Aufwand:** Bodenprobe 1–2 Tage; Rip-up 3–5 Tage inkl. Messprotokoll.

### R4 — Kostenmodell ist vollständig gebaut, aber ungenutzt im Suchloop **[bekannt: ROUTE-002]**

**Befund.** `lib/routing/rules/costModel.ts` hat `segmentExtraCost`
(Crossing 120, Clearance-Verstoß 400, Nearby-Lane 16, Bonus −8) fertig und
getestet. Produktiv wirkt davon exakt **ein** Wert: `COST_WEIGHTS.crossing =
120` in `scorePath`. Der A\*-Innenloop (`hananAStar`) bepreist **nur Länge +
Knicke + Kehren** — weder Kreuzungen noch Clearance. Kreuzungen werden
ausschließlich _hinterher_ über Alternativ-Lanes ausprobiert.

**Vorschlag.** A\*-Schrittkosten um `segmentExtraCost` gegen die bereits
gerouteten Segmente erweitern (der Spatial Index existiert bereits;
`dynamicRoutedSegments` -> Index statt Segment-Array). Zusatznutzen: Damit
übernimmt die Suche selbst, was die Alternativ-Trassen raten dürfen.
Voraussetzung: Heuristik muss zulässig bleiben (Zusatzkosten nur addieren,
nie subtrahieren — sonst Optimalität verloren; `preferredLaneBonus` ist
**negativ** und gehört deshalb **nicht** in die Heuristik).

**Aufwand:** 2–4 Tage inkl. Golden-Master-Recapture. **Risiko:** hoch für den
Golden Master (alle Pläne ändern sich) — strikt via CHANGE-WORKFLOW.

### R5 — LaneRegistry ohne Produktionskonsument **[bekannt: ROUTE-001]**

Korridor-Lanes (`lib/routing/rules/laneRegistry.ts`, 174 Zeilen +
Testdisziplin) sind fertig, deterministisch, ungenutzt. Heutige Mechanik:
Port-Fan-Out + ±48/96-Heuristik. Folge: Ausweich-Trassen sind instabil,
kein Gedächtnis über Routing-Passes hinweg. **Vorschlag:** Registry als
Lane-Quelle in `routeAllCables` verdrahten (ersetzt `ALTERNATIVE_ROUTE_GAP`-
Kandidaten), aber nur zusammen mit R4/R3 messen — einzeln sieht man kaum
Wirkung (die Repo-eigene `domainProbe`-Lektion aus ROUTE-003).

### R6 — Domänen-Trennregeln sind wirkungslos **[bekannt: ROUTE-003]**

`electrical ↔ water` und `ac230 ↔ dc12` → 24 px existieren
(`buildDomainSeparationRules`), werden aber nicht ausgewertet. Probe sagt:
12 kreuzende gemischte Paare, 0 in zu enger Parallellage — eine 24-px-
Clearance würde heute **nichts** ändern. **Vorschlag:** Anbindung wahlweise
(a) als Clearance (I3-artig, domänenpaar-abhängige Tube-Breite in `addTubes`)
oder (b) ehrlich in der Doku abschließen. Wichtige Klarstellung, die im Repo
fehlt: Zwischen den Ebenen Elektro/Wasser sind solche Regeln **per
Konstruktion gar nicht nötig** — beide liegen in getrennten Plan-Layouts, die
sich den Canvas zwar teilen, aber nie gemeinsam geroutet werden. Der
konkrete Nutzen wäre allein `ac230 ↔ dc12` im selben Elektroplan.

### R7 — Legacy-Router (628 Zeilen) trägt weiterhin Galerie + Qualitätsmetriken **[bekannt: ARCH-002/DOC-004, hier ergänzt]**

`orthogonalRouting.ts` rendert nicht, aber `docs/routing-gallery/*.svg` wird
von ihm generiert Genauigkeit: Die **Galerie zeigt sichtbar Geometrie, die
der Nutzer nie sieht**, und `routingQuality.ts` misst Metriken an ihm statt
am Produktiv-Router (R-1-Metrikenwunsch: „Ratio ≤ 1,3, uTurns = 0" — gültig
für die falsche Engine). **Vorschlag:** Galerie-Generator + Qualitätsmetriken
auf `findCablePath`/`routeAllCables` umstellen (oder Galerie klar als
„Legacy-Engine-Referenz" umbenennen). Kleine Investition, große Verwechslungs-
Vermeidung.

### R8 — Einzelrouten-Fallback in `CableEdge` ohne Fan-Out/Tube-Wissen **[neu]**

Wenn `globalRoute` fehlt (neue Kante bis zum ersten `CableRouteSync`-Publish,
Offscreen-Randfälle), routet `CableEdge` selbst per `findCablePath`
— **mit `lane: 0`, ohne cableTubes und ohne Port-Fan-Out** (Kommentar ist
ehrlich: „Notnagel"). Zwei an einem Port angelegte Kanten können in diesem
Fenster lokal identische Trassen zeichnen; neu verbundene Leitungen blitzen
kurz als überlagerte Pfade.

**Vorschlag.** (a) Den Fallback-Pfad schlanker machen: Lanes der eigenen
Port-Gruppe lassen sich ohne globale Maps approximierbar ableiten (Geschwister
sind im Store: `siblingEdges`). (b) Oder den Publish-Zyklus so umbauen, dass
neue Kanten erst nach dem ersten Pass in den Canvas gelangen — sauberer, aber
UX-Bremse. (a) ist der kleine, risikoarme Weg.

### R9 — Ausnahmen (`tightMarginUsed`, `fallbackHitsObstacles`) sind pro Leitung unsichtbar **[neu]**

`PathResult` trägt beide Flags korrekt bis in den Store (`rebuild` erhält
sie sogar explizit), das `RoutingStatusBadge` aggregiert
`tightMarginRoutes` — aber `CableEdge` liest **keines** der Flags. Eine
Leitung ohne Freigabe-Garantie ist visuell von einer verlässlichen nicht zu
unterscheiden; ein Nutzer, der das Badge orange sieht, weiß nicht, **wo** er
abtrennen muss.

**Vorschlag.** (1) Styling: bernsteinfarbener Dash oder Halo am Pfad
(`tightMarginUsed`), roten Dash bei `fallbackHitsObstacles`. (2) Listenform:
als Einträge im Warn-Center (Muster wie `useLiveValidation`) mit
`focusElement(edgeId)` — die Fokus-Mechanik existiert bereits. Aufwand: < 1
Tag, nur Tests im `CableEdge.test.tsx` ergänzen.

### R10 — Fenster-Nachzug ist auf 3 Runden gedeckelt **[neu]**

Bei ROUTE-BUG-24 wurde der Fenster-Nachzug eingeführt (Route verlässt das
Hindernis-Fenster → erweitern, max. drei Durchgänge, sonst stabil). Bleibt die
Route nach drei Erweiterungen außerhalb, werden Hindernisse jenseits der
Fenstergrenze nie gesehen — der Kommentar selbst beschreibt die
Konsequenz (2,4 px an einem unentdeckten Bauteil).

**Vorschlag.** Nicht mehr „max. 3 Runden", sondern **Fixpunkt suchen**: Die
Fenster-BBox wächst monoton über eine endliche Bauteilmenge — die Schleife
terminiert sicher; die Abbruch-Kosten des Dauerlaufs liegen bei einem
einmaligen Umfang pro Plan extrem klein (betroffene Routen sind per Messung
selten). Alternativ: Sofort-Expansion auf die Route-Envelope + alle im Plan
geschnittenen Bauteile. Aufwand: < 1 Tag + Messung an den beiden Benchmarks.

### R11 — Kleinteilige Routing-Befunde **[neu]**

- **TO-DEAD-Code:** `parallelLaneOffset` und `polarityLabelNudge` aus
  `pathUtils.ts` haben in Produktion keinen Konsumenten mehr (nur Kommentare
  in `routeAll.ts` belegen die entfernte Polaritäts-Lane; Tests schützen
  Tote). Zhodnotit: löschen oder begründen.
- **`PathResult.crossings`** wird nach `routeAllCables` korrekt aus echter
  Geometrie bestimmt — hat in der UI dann aber **keinen Konsumenten**
  (nur Golden-Master-Fixtures + Audit + Capture nutzen es). Auch das ist
  Information, die gebaut und weggeworfen wird (R9 würde hier andocken:
  „diese Leitung kreuzt n andere").
- **Label-Kollision:** `labelBoundingBox`/`boxesOverlap` schützen nur im
  Test; in Produktion läuft allein `edgeLabelNudge` für Same-Handle-Gruppen.
  Labels kollidieren in dichten Plänen mit Bauteilen und untereinander,
  kompakt Displays blenden sie komplett aus. Vorschlag: Label gegen Hindernis-
  Boxen nudgen (Hindernisse sind der Pipeline ohnehin bekannt) — kleiner
  Schritt, sichtbarer Gewinn.
- **Geometrie-Konstanten außerhalb der Tokens** (bekannt: ROUTE-004):
  `CLEARANCE_GOAL = 12` (dupliziert `cableClearance`), `extraXs ±16` (= laneGrid),
  `OBSTACLE_REGION_PAD = 240`, `BEND_COST/U_TURN_COST/MAX_EXPANSIONS/MAX_
ACCEPTABLE_CROSSINGS` sind nicht drift-gesichert. Direkte Folge: Token-Edit
  bricht still Invarianten, die laut Spec aus denselben Quellen leben sollen.
- **Telemetrie-Cache-Hygiene:** der LRU-Cache (256) von `findCablePath` wird
  in Produktion nie geleert (`clearPathfindingCache` nur aus Tests);
  `pathfindingFallbackCount` ist tote Telemetrie. Richtig ist der Cache
  (Schlüssel enthält alle Eingänge), aber die Halbwertszeit fehlt als
  bewusste Entscheidung — one-liner im Kommentar + optional Cache-Vögel in
  `clearCableRoutes` hooken.

---

## 3. Layout & Platzierung

### L1 — ELK ist nur Knopfdruck-Aufräumer, nicht Initial-Layout **[neu als Befund]**

ADR 0018 lässt ausdrücklich offen: „ein automatischer ELK-Initial-Pass bei
`autoWireSystem` ist nicht Teil dieser Scheibe". Folge: AutoWire läuft mit
dem eigenen `applyFlowLayout` (längster-Pfad-Spalten, 16-px-Raster, nur
auto-erzeugte Knoten), das zwar gemessen Manhattan-ratio ≤ 1,3 hält, aber
die A/B-bewiesene Engine (−75 % Kreuzungen, −54 % Bends) liegt einen
Knopfdruck entfernt brach — **nur wer den ELK-Knopf kennt, profitiert
davon**. Vorschlag: optionaler ELK-Initial-Pass nach `performAutoWiring`
(mit Seq-Schutz & fitView wie `onLayoutV2`), Standard an/aus im Expert-Panel
diskutierbar; Ergebnis mit `routing:audit` + Regression prüfen (andere
Platzierungen = andere Routen!).

### L2 — ELK-Junction-Points werden verworfen **[neu]**

`parseElkResult` liefert `junctions` (Busbar-Abzweig-Punkte) — sie werden in
`routingV2Adapter.ts`/`applyAdvancedLayout` nicht konsumiert (Scope: nur
Positionen). Das wäre die eleganteste Lösung für die 47 akzeptierten
Bündel-Überdeckungspaare (§1.1): J-böcke sichtbar rendern (Junction-Dot am
Abzweig) oder als gemeinsame Wegpunkt-Anker in den A\*-Pass reichen.
Aktuell liegen bis zu 9 Paare pro Plan exakt übereinander und sind per
Definition „kein Verstoß" — der Nutzer sieht aber Doppel-Lines. Aufwand
Render-Dots: 1 Tag; Anker-Integration: 3–5 Tage.

### L3 — Dagre-Fallback-Mini-Engine **[klein]**

`lib/planner/layout-engine/dagre.ts` (87 Zeilen) layoutet `kind`-los —
`waterPipe`-Kanten verhalten sich dort wie Kabel. Funktional irrelevant
(ELK läuft fast immer), aber der Fallback produziert im Wasser-Modus
Layout-Entscheidungen ohne Wasserwissen. Vorschlag: kind-an Hierarchie-Rank
koppeln (Source-Flow der Wasserlinie) oder Fallback verständlich einschränken.

---

## 4. Auto-Wire & Längenmodell

### A1 — AutoWire-Längen sind Luftlinie + 1-m-Clamp **[neu, mit R1 verheiraten]**

`geometricLength` (lib/autoWire.ts) wird nur beim Anlegen gesetzt — nie
aktualisiert. Ein Nutzer, der nach dem Auto-Wiring die Bauteile auseinander-
zieht, hat unverändert kurze Längen; das 3-%-Budget bricht nicht an — es
**warned einfach nicht**. Mit R1 gemeinsam auf geroutete Länge umstellen
(genau ein Objektmodell, honeste Defaults).

### A2 — `onConnect` schreibt feste `length: 3`, `crossSection: 2.5` **[neu]**

Jede manuell gezogene Kante zeigt **3,0 m**, egal ob die Enden 0,5 m oder
8 m auseinanderliegen (graphSlice.ts). Der Plan sieht „eingetragen" aus, ist
aber fiktiv. Vorschlag: geometrische Start-Schätzung inkl. Kennzeichnung
(Schätzwert ≠ Nutzerwert), bis AutoWire/R1-Mechanik übernimmt.

### A3 — Datenmodell-Restrisiken **[bekannt: DOM-004/DOM-005]**

`edge.data` wird beim Laden nicht schemageprüft (falsche Eingaben überleben
den Rehydrate); `CableEdgeData.geometry` ist ein gesperrtes, aber noch
deklariertes Todesfeld. Beide klein, aber gerade in einer App ohne
Nutzer-Accounts ist der Persistenz-Import der einzige
„Sicherheits-Härtungs-Punkt".

---

## 5. Performance

- **P1 — Worst-Case-Szenario 2 s (R2) ist akzeptiert statt adressiert**
  (PERF-001: „kein Gate-Bruch"). R2 macht das Gate-Anliegen überflüssig:
  ein zweiter, nicht-blockierender Messpunkt (N=250) + Affected-Set.
- **P2 — Store-Subscription-Granularität.** Jede `CableEdge` abonniert
  **das gesamte `state.edges`- und `state.nodes`-Array** (useShallow-
  Selektoren) — jede Knoten-Bewegung re-rendert **alle** Kanten. Der
  Render selbst ist billig (Memo), aber `crossingSegmentsNear` läuft pro
  Kante pro Frame neu (nur im Fallback ... nein: immer — das useMemo hängt
  an sourceX/targetY-Props, die sich beim Drag auch ändern). Vorschlag:
  `usedSearch: 'catalog'`-Erstpfad nur bei fehlender globalRoute rechnen
  lassen (heute ja) und crossingSegments an Signatur-Bedingungen koppeln
  (Geometry-only-Sha1), nicht an Node-Arrays.
- **P3 — `useAccessibleHandles`-MutationObserver** läuft rAF-gebündelt je
  Frame (kommentiert OK), aber bei 100+ Knoten sind das pro Frame
  `querySelectorAll('.react-flow__handle')` über den gesamten Canvas —
  Kandidat für Eager-Hard-Mount durch die Node-Komponenten selbst
  (Registry-Konzept liegt vor: jede Node-Karte kennt ihre Handles).
  Messung: Profiler-Trace im Browser nötig (Sandbox kann es nicht).

---

## 6. UX am Routing

- **U1 — Leitungen fixieren (Lock) ist im Modell gebaut, ohne UI.**
  `RouteEdgeRef.data.locked`/Hop-Priorität 10 000 existiert; es gibt „in der
  UI noch nicht" (Kommentar in `routeAll.ts`). Vorschlag: Toggle im
  EdgeInspector/Context-Menü („Leitung fixiert: hoppt nie, wird beim
  strukturellen ELK-Pass respektiert"). **Design-Frage vorher klären:** Lock
  allein ohne persistierte Waypoints ändert nur Hop-Verhalten; echtes
  Fixieren eines Verlaufs kollidiert mit ADR 0014 (kein Geometry-Feld).
  Minimalvariante: Lock nur als Prioritäts-Flag dokumentieren und
  verkaufen.
- **U2 — Kein manuelles Einsetzen einer Trasse (Via-Griff).** Wer eine
  Leitung bewusst um einen Block legen will, kann nur Bauteile verschieben.
  Das ist ein echtes Feature-Gap gegen E-CAD-Bedienung (und ein verbreiteter
  Selbstausbau-Workflow: „durch Leitungs-Schächte"). Vorschlag (größere
  Scheibe): Drag-Punkte als `via: Point[]` in `edge.data` — verzüglich mit
  Schemaprüfung (A3), und der Router respektiert sie als angereicherte
  Hanan-Knoten/Linien.
- **U3 — Rerouting großer Pläne fühlt sich träge** (100 ms Drossel +
  Zweitpass beim Drop). L-Stub-Vorschau während des Drags (R2, Schritt 2)
  würde das Interaktionsgefühl deutlich verbessern.
- **U4 — Kabellänge bearbeitbar ohne Herkunftshinweis.** EdgeInspector liest
  `edge.data?.length ?? 3`: Der Tooltip-Hinweis, dass eine Länge „geschätzt"
  ist, stünde fachlich gut bei der Länge-Eingabe (s. R1/A2).
- **U5 — Wasser-Leitungen profitieren nicht vom gesamten Stack.** Pipes
  laufen im selben Router an, aber jenseits der globalen Fan-Out-Gruppen in
  `routeAll` gehen Hop-Prioritäten als `unknown: 0` ein. Das ist korrekt,
  aber die Hop-Initiative wird fürs Wasser nie erreicht (alle gleiche
  Prio; lexikografisch entschieden). Bewusst dokumentieren oder Wasser in
  einem künftigen Domänen-Layer modellieren (R6).

---

## 7. Dokumentation & Hygiene (Schwere hoch bei Agenten-Nutzung)

| ID  | Befund                                                                                                                                               | Quelle/Wirkung                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `docs/ROUTING-V2.md` (FROZEN) verweist auf **gelöschte** Verzeichnisse und behauptet, ELK sei „nicht im Produktivpfad" — ADR 0018 hat das verdrahtet | DOC-001 (hoch): Agent liest Spec, sucht Code, der nicht existiert. **Empfehlung:** Spec als „Zielbild-Referenz einer Architektur-Iteration" kennzeichnen + Verweis auf `docs/ai/ROUTING-CONTEXT.md`.                                                                                                       |
| D2  | `docs/ROUTING-INVARIANTS.md` dokumentiert R1–R7 am Legacy-Router                                                                                     | DOC-004 (hoch): legen die falsche Engine nahe. **Empfehlung:** Kopfzeile + Link zu I1–I10; oder um Migrierung aus R7 ergänzen.                                                                                                                                                                             |
| D3  | `/api/chat` + `lib/db.ts` + `/ki-assistent`: Server-Reste im Static Export                                                                           | ARCH-001 (hoch/bekannt): Seite wirkt funktionsfähig, sendet in 404. ADR 0021 ist offen; etwas davon deaktivieren oder Backend-URL dokumentieren.                                                                                                                                                           |
| D4  | Rest-Hygiene                                                                                                                                         | E2E lokal nicht läufig (TEST-001, CI grün); sechs von acht Benchmarks nicht verdrahtet (LEGACY L-8); ELE-001/002 (konservative Normannahmen — ehrlich kommentiert, akzeptiert); ELE-003 (Golden-Master nutzt für AC-Kanten die DC-Stromfunktion — Fixture-Anzeige lügt leise, siehe bekannte issue-Cards). |

---

## 8. Priorisierte Roadmap

Konventionen des Repos respektieren: ein WP = ein PR; Golden-Master-Recapture
nur mit Change-Ledger; jede Routing-Änderung zuerst am Messstand belegen.

### P0 — klein, sicher, sofortiger Nutzen (jeweils ≤ 1 Tag)

1. **R9 — Ausnahmen pro Leitung sichtbar** (tight/fallback-Halo + Warn-Center-
   Einträge). Reinen Add-on-Charakter, kein Golden-Master-Eingriff.
2. **R11-c — `CLEARANCE_GOAL`/±16/`OBSTACLE_REGION_PAD` auf Tokens ziehen** +
   Drift-Guards in `tokens.test.ts` erweitern. (ROUTE-004, Teil 1.)
3. **D1/D2 — Spec-Kopfzeilen korrigieren** (ROUTING-V2.md, ROUTING-INVARIANTS.md).
4. **R10 — Fenster-Fixpunkt statt 3-Runden-Cap** (Messung an beiden Benchmarks).

### P1 — fachlich wichtig (Tage → eine Woche)

5. **R1 — Geroutete Länge verbrauchen** (CableEdge → BOM → AutoWire, mit
   Herkunft-Markierung + Recapture + A2/A1 gleich mitziehen). **Der**
   fachliche Hauptgewinn der Analyse: Der Sizing-Trichter wird realistisch.
6. **R8 — Einzelfallback-Lanes der Port-Gruppe approximieren** (Flash-Fix).
7. **A2 — onConnect-Standardlänge dynamisch ableiten** (mit „geschätzt"-Mark).
8. **R7 — Galerie + Qualitätsmetriken auf den Produktiv-Router umstellen.**
9. **R11-a/b — tote Lane-Helper entfernen, `crossings`-/Label-Nutzen klären.**

### P2 — strukturell (mit Messprotokoll + ADR)

10. **R3 — Kreuzungs-Bodenprobe** (Lower Bound) → **Rip-up & Reroute-Experiment**
    (Erfolgskriterien strikt messen; sonst verwerfen — Konvention).
11. **R4 — `segmentExtraCost` in den A\*-Innenloop** (Heuristik zulässig
    halten; `preferredLaneBonus` nie dort), Golden Master erwarten.
12. **R5 — LaneRegistry anbinden** (nur mit R4 zusammen messen).
13. **R2 — WP-8 nachholen:** Affected-Set → Zwei-Stufen-Vorschau → Worker.
14. **L1 — Optionaler ELK-Initial-Pass nach AutoWire** (Seq/Fit wie onLayoutV2).

### P3 — Feature-Grade (Design vor Code)

15. **U1 — Lock-Flag anbinden** (Doc/only-hop vs. persistierte Trasse klären —
    ADR 0014-Grenze beachten).
16. **U2 — Via-Griffe** (`edge.data.via`, Schema, Router-Integration).
17. **L2 — Junction-Points konsumieren** (Render-Dots; dann evtl. Anker).
18. **D3 — Server-Reste entscheiden** (ADR 0021 abschließen).
19. **P2/P3-Perf — Store-Selektoren verfeinern, Handle-A11y-Eager-Mount.**

---

## 9. Anhang: Reproduktion aller Messwerte

```bash
npm ci
npm run routing:audit            # Tabelle §1.1 (I1..I7, Fallback, Determinismus, Kreuzungen)
npm run routing:domain-probe     # R6: gemischte Paare / 24-px-Clearance-Probe
npm run perf:edge-routing        # §1.2 Gateway + grobe Pläne
npm run perf:route-scaling       # §1.2 Skalierung + Worst Case
npm run test:goldenmaster        # Byte-Determinismus der Referenzpläne
npm run test:regression          # 15 Szenarien (Layout/Metrik/SVG)
npx vitest run components/edges utils lib/routing scripts/routing scripts/regression
```

Längen-Sonde (Ad hoc gelaufen, nicht im Repo): vergleicht
`PathResult.length` mit der Handle-Luftlinie über `performAutoWiring` +
`routeAllCables` der sechs `knownPlans/`; Ergebnisse in §1.3.

---

## 10. Fazit

Das Routing ist der am stärksten gehärtete Teil des Planers — Invarianten
bei 0, deterministisch, ratchet-gesichert, und der Code kommentiert ehrlich,
was verworfen wurde. Das verbleibende Potenzial sitzt **zwischen** den
Schichten:

- Der Router **kennt** die echte Leitungslänge — die Elektrik benutzt sie
  nicht (R1).
- Der Router **kennt** seine Ausnahmen — die UI zeigt sie nicht pro Leitung (R9).
- Das Kostenmodell **existiert** — die Suche konsumiert es nicht (R4).
- ELK **beweist** bessere Ergebnisse — es wartet auf einen Knopfdruck (L1).
- Inkrementelles Routing **war geplant** (WP-8) — und wurde nie gebaut (R2).

Diese fünf Punkte sind die Roadmap; sie ist klein genug, um auf bestehenden
Tests, Ratchets und Messverfahren aufzubauen, und groß genug, um die sichtbare
Qualität (Elektrik-Genauigkeit, Kreuzungen, Bedienung) spürbar zu heben.
