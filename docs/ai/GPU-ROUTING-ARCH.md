# GPU-beschleunigte Routing-Engine — Architektur-Entwurf v3

Projekt: CAZE7/Camp (Elektroplaner) · Ergänzung zur Master-Spec (`docs/ROUTING-MULTIPHYSICS.md`)
Stand: 2026-09-28 · v3 nach zweiter Fach-Review (Anhang A enthält beide Review-Runden mit
Dispositionen, ergänzt um die Belegprüfung beim Repo-Einstand)
Geltungsbereich: `components/edges/utils/*`, `lib/routing/*`

## Vorgehen bei der Review-Verarbeitung

Jede Behauptung der Reviews wurde vor Korrektur gegen den Code geprüft. Ergebnis der
zweiten Runde: aus 11 Punkten sind 10 belegt übernommen, 1 Punkt teilweise
zurückgewiesen (Anhang A, Runde 2, Punkt 1). Beim Einstand in dieses Repo wurden die
zwei „nicht verifiziert"-Vermerke der Runde 2 nochmals geprüft und **beide widerlegt**
— sie sind in den Dispositionen korrigiert (Runde 2, Punkt 3 und der Vermerk am Ende).

Referenzdisziplin: Querverweise nennen Module und Dateien **namenslich**, keine
Abschnittsnummern anderer Dokumente — divergierende Gliederungen sind ein
Bruchsicherungs-Risiko, Namen nicht.

---

## 0 — Phase 0: Mess-Gate vor jedem Bau

Das Repo kodifiziert den Grundsatz bereits: `agent.md` Erlass **R-1** („Routing-Messung
zuerst", Ziel Gesamtkabellänge ≤ 1,3× Manhattan-Optimum; Konvention „keine Aufgabe gilt
ohne Bench-Nachweis als fertig"). Für eine Device-Erweiterung gilt das erst recht.

**Phase 0 (Pflicht):**

**CPU-Baseline messen** auf dem 120-Knoten-/240-Kanten-Referenzszenario, den
**15 Regressionsplänen** (`scripts/regression/scenarios.ts`, verifizert:
`expect(REGRESSION_SCENARIOS).toHaveLength(15)`) und den **25 Galerie-Szenarien**
(`components/edges/utils/routingScenarios.ts`, verifizert:
`expect(gallery).toHaveLength(25)`). Instrumente sind verifiziert vorhanden:

- `npm run perf:route-scaling` → `benchmarks/routeAllScaling.probe.ts` (in
  `package.json` bestätigt)
- `npm run perf:edge-routing` → `benchmarks/edgeRoutingPerf.bench.ts` (bestätigt)
- `scripts/maintenance/profile-callers.mjs` instrumentiert `routeAllCables`,
  `findCablePath`, `searchOnce`, `hananAStar`, `nudgeOrthogonalPaths` (belegt).
  Kein npm-Wrapper vorhanden — die Invokation ist bei Adoption zu dokumentieren
  bzw. als `profile:`-Script zu ergänzen, sonst ist das Gate nicht ausführbar.

**Kill-Kriterium (hart, gemessen):** CPU-Full-Route ≤ 50 ms **und** inkrementelle
Edits ≤ 4 ms Median auf Referenzhardware ⇒ GPU-Track (Kapitel 1–4) nicht bauen
(YAGNI). Kapitel-7-Bausteine werden unabhängig geliefert (§8, Entscheidungsmatrix).

**Präzisierung (Review-2, Punkt 6):** „≤ 4 ms Median" ist das **Gate** auf der
gemessenen Baseline; „≤ 2,5 ms je Routing-Task mit max. 4 Tasks/Frame" ist das
**Zielbudget** des laufenden Systems (T0-Buchhaltung im 16-ms-Frame,
ADR-0012-Domäne). Beides verneint sich nicht: Das Gate entscheidet über den Fork des
Projekts, das Budget regelt die Frame-Abrechnung.

**Strukturprinzip „Algorithmen zuerst, Device danach":** EDT-Kostenfelder,
px-Ganzzahlskala, Konfliktgraph-Batching und der Physik-Feedback-Loop werden zuerst als
reine CPU-Artefakte gebaut; sie beschleunigen bereits `hananAStar`. Die GPU ist lediglich
eine alternative Ausführungsschicht bewiesener Datenstrukturen.

---

## 1 — Drei-Ebenen-Modell

| Tier | Plattform                 | Aufgabe                                                                | Budget                                     |
| ---- | ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| T0   | CPU (`hananAStar`-Pfad)   | Kanonisches inkrementelles + Detail-Routing; alleinige Geometriequelle | Zielbudget: ≤ 2,5 ms/Task, ≤ 4 Tasks/Frame |
| T1   | WebGPU Compute (optional) | Grob-Pass (Kapazität/Korridor), exakte EDT, Physik-Maps                | ≤ 12 ms, async, Gates per Phase 0          |
| T2   | Offscreen/CI              | Voll-Diagnose, Rip-Up-Kaskaden                                         | unbounded                                  |

**Koppelung T1→T0:** T1 liefert keine Geometrie, nur Constraints: (a) Clearance-/
Proximity-Distanzfeld, (b) Physik-Violation-Masken, (c) Korridor-Kapazitätsbudgets je
Blade. Persistierte Geometrie hat damit per Konstruktion immer CPU-Ursprung
(Golden-Master-Verträglichkeit, §5′).

---

## 2.1′ — Sweep-Routing als Grob-Pass, Hanan-A\* als Detail-Pass

Das Hanan-Grid in `components/edges/utils/pathfinding.ts` ist Union aus
Hindernis-Kanten, Port-Koordinaten und Stub-Linien — willkürlich ungleichmäßig;
`GRID_MIN_GAP = ROUTING_TOKENS.segmentMin` (16 px) prägt nur Mini-Zellen
(ROUTE-BUG-1/14). Es muss ungleichmäßig bleiben, sonst lägen Ports per Snapping nicht
mehr exakt auf Gitterlinien → Verletzung von **R1** (Endpunkte exakt,
`docs/ROUTING-INVARIANTS.md`) und der Stub-Regeln **I5/I6**
(`requiredStubLength`/`checkSegmentLengths` in `lib/routing/invariants.ts`; Belege:
`stubMin = 24` für I5, `segmentMin = 16` für I6, dokumentiert in
`docs/ai/ROUTING-CONTEXT.md`).

**Modell:**

- **Grob-Pass (GPU, optional):** GAMER-artige alternierende H/V-Sweeps mit
  Präfix-Scanbeschleunigung auf einem separaten, äquidistanten Lattice (Zellweite
  `laneGrid = 16 px`). Ergebnis: Korridorzuteilung + Kapazitätsbudget pro Netz und
  Blade, **keine Wegpunkte**.
- **Detail-Pass (CPU, kanonisch):** `hananAStar` auf dem unregelmäßigen
  Hanan-Grid; konsumiert Korridor-Präferenzen (weicher Kostenabschlag) und harte
  Physik-Masken. Qualitätsmaßstab bleiben R1–R7 (`docs/ROUTING-INVARIANTS.md`).

**Korrektes Einsperren der Heuristik (Review-2, Punkt 4 — übernommen und belegt):**
Label-Correcting erlaubt kein Vorbelegen von Labels mit $h$. Zulässig ist ausschließlich
Branch-and-Bound-Pruning ab Inkumbent-Vorliegen. `bestFreeCatalog` gibt
`Point[] | null` zurück und liefert bei voller Blockade keinen Pfad — genau deshalb
existiert der A\*-Pfad. Korrekte Semantik: **Inkumbent = Katalogpfad, falls einer
gefunden wird; sonst das erste Ziel-Resultat des laufenden A\* (initial `Infinity`).**
Dieser Mechanismus existiert bereits im Ist-Code: `hananAStar` führt
`let bestGoalG = Infinity`, aktualisiert bei Zieltreffern, und genau die Zeile
`if (cur.g + cur.h >= bestGoalG) continue;` ist die zitierfähige Ist-Umsetzung
desselben Prunings. Die Grob-Pass-Umsetzung darf nichts anderes behaupten.

---

## 2.2″ — Exakte separierbare EDT, pixelexaktes Orakel

**Korrektur zu v2 (Review-2, Punkt 2):** Felzenszwalb–Huttenlocher kostet
$O(W \cdot H)$ Gesamtarbeit: 1D-Sweep je Zeile $O(W)$ über $H$ Zeilen, danach analog
je Spalte $O(H)$ über $W$ Spalten. (v2 sagte $O(W+H)$ — verwechselte Sweep-pro-
Arbeitsmenge mit Gesamtkosten; korrigiert.) Parallelisierung: Zeilen-Pass verteilt
Zeilen über Workgroups, Spalten-Pass analog; zwei Dispatches, Work-in-Shared-Memory-
fähig.

**Orakel-Definition (essenziell):** Der Property-Test vergleicht die EDT nicht gegen
die kontinuierliche Geometrie (`distanceSegmentToRect` & Co.). Er vergleicht gegen
Brute-Force-Distanzen über **dieselbe rasterisierte Modellwelt**: Hindernisse werden
zuerst in das Zellraster rasterisiert (konservativ, s. u.), die Test-Orakeldistanz ist
dann die exakte minimale Zell-zu-Zellen-Distanz zu einer als belegt markierten Zelle —
berechnet per CPU-Brute-Force $O(N \cdot B)$ ($B$ = belegte Zellen; bei Referenzgröße
vertretbar im Test). Nur so ist „EDT ≟ Orakel" entscheidbar statt konstruktiv zum
Scheitern verurteilt. Die kontinuierliche Exaktheit bleibt Aufgabe des CPU-Final-Gates
(`classifySegmentAgainstNode`/I3).

**Underestimate-Garantie:** Rasterisierung bläht Hindernisse um die halbe
Zelldiagonale auf; jede Zelle mit beliebigem Hindernis-Overlap ist „belegt". Damit
unterschätzt die gerasterte Distanz die kontinuierliche niemals im schädlichen Sinn
(nur konservativ). Gespeichert wird $d^2 \in \mathbb{Z}_{\ge 0}$; Vergleiche als
$d^2 < c^2$, wurzelfrei. Hart-Assertion: $d^2 < 2^{31}$ (entspricht $d < 46{,}341$ px)
— Fehler statt Wraparound.

**Umsetzung (Mission Stufe 1, 2026-09-28):** implementiert als
`lib/routing/geometry/edt.ts` (`squaredEdt2D`, `rasterizeObstaclesConservative`,
`buildObstacleEdt`, `edtSquaredAt`), Property-Test `lib/routing/geometry/edt.test.ts`
≡ Brute-Force-Orakel über derselben Rasterisierung (450 zufällige Felder + Degenerierte,
exakte Kreuzvergleiche in der Enveloppe). Die Integration in `hananAStar`
(`components/edges/utils/pathfinding.ts`) läuft token-gated über
`COST_FACTORS.edtNearObstaclePerLaneGrid` in `lib/routing/rules/costModel.ts` —
**eingefroren auf 0** (Drift-Guard `costModel.test.ts`): bei 0 wird kein Feld gebaut
und jeder Schritt ergibt +0, der Suchlauf ist bitweise unverändert (Golden Master
byte-stabil, nachgewiesen über `test:regression` + `test:goldenmaster`). Die Anhebung
gehört zu Stufe 2 und erfordert einen begründeten Recapture mit Ledger.

---

## 2.3′ — Physik-Feedback-Loop (CPU-first)

Unverändert aus v2: Der Wert ist die **Kopplung** (Violations → Bitmask →
Zellkosten), nicht das Device. Physik-Maps werden CPU-seitig in die T0-Kosten
integriert (Master-Spec, „Modul 3 — Multi-Physics"). GPU-Ausführung derselben Maps ist
optionaler T1-Bonus, aktiviert nur, wenn Phase 0 eine CPU-Budgetverletzung > 1 ms für
die Physik-Bewertung misst.

---

## 3″ — Speicherlayout & Budget (beweisfest, sättigend)

**Einheit (Review-2, Punkt 3 — übernommen):** Die etablierte Kostenwährung des Repos
ist px-äquivalent — wörtlich belegt in `lib/routing/rules/costModel.ts`
(„Alle Werte sind px-äquivalent (1 Kosteneinheit = 1 px Leitungslänge …)") und
parallel im R-2-Kommentar von `components/edges/utils/pathfinding.ts`. ROUTING_TOKENS
sind px-basiert (`laneGrid` 16 px, `cableClearance` 12 px, `segmentMin` 16 px). Der
GPU-Kern rechnet daher in **Ganzzahl-Milli-px** (1 Kosten-einheit = 0,001 px); jegliche
mm-Mapping-Diskussion (v1/v2-Fehler „g = 16 mm") entfällt. (`PX_PER_METER` in
`lib/units.ts` bleibt die px↔m-Brücke der Physik-Schicht, für den GPU-Kern
irrelevant.)

**Sättigende Arithmetik statt Realismus-Annahme (Review-2, Punkt 3 — übernommen):**
Der v1-Argumentationsfehler war, den Pfadbound „realistisch ≤ 2000 Zellen" als Stütze
zu verwenden — kein Invariantenbeweis, Marge gegen `0x7FFF0000` war ~2 %. V3-Regel:

$$
g' = \min(g_{\text{alt}} + c,\; G_{\max}), \qquad G_{\max} = \texttt{0x7FFF0000} - S_{\max}
$$

wobei $S_{\max}$ die maximal je einem Label addierbare Kostenmenge ist (Per-Zelle-
Maximum + Sicherheitsband). Sättigung erfolgt bei jedem Label-Update ($O(1)$,
deterministisch). Konstruktionseigenschaft: Der Sentinel
`INF = 0x7FFF0000` ist damit per Konstruktion strikt größer als jeder erreichbare
legitime Wert — kein Overflow-Szenario existiert mehr, unabhängig von Pfadlängen. Die
i64/High-Low-Option ist entfallen.

**Konsequenz für R5 (Determinismus):** Sättigung ist ein Punkt auf dem Weg zum
späteren Differential-Test, nicht ein „selten auftretender Hack": Bei Erreichen von
$G_{\max}$ muss der Router einen geloggten Gegenmaßnahmen-Pfad einschlagen
(„Kapazität erschöpft — CPU-Reroute"), analog dem Repo-Verbot stiller Fallbacks
(`safety-no-silent-fallback.test.ts`-Disziplin).

---

## 5′ — Verifikations-Pyramide & CI-Policy

1. **EDT-Parität:** GPU-/CPU-EDT ≡ Brute-Force-Orakel über derselben Rasterisierung
   (§2.2″), auf allen Galerie-Szenarien + Zufallsfällen.
2. **Router-Parität vor jeder Adaption:** per-Net-Qualitätsbänder (Wirelength-Ratio,
   Bends, Crossings — Bänder kalibriert am Corpus, nicht am Whiteboard) +
   byte-exakte Regressions-SVGs bestanden **vor** Merge.
3. **Golden-Master-Policy (hart):** GPU-Modus in CI/E2E per Feature-Flag immer aus;
   persistierte Geometrie ausschließlich CPU-Ursprungs. Recapture von Goldens nur mit
   Begründung, nie wegen Device-Wechsel.
4. **WebGPU-Smoke:** Playwright ist CI-fähig vorhanden (`"e2e": "playwright test"`
   bestätigt). Das Flag-Set wird im Spike **gemessen** und dann hier dokumentiert —
   v1/v2 nannten konkrete Flags unbelegt; bekanntes Ist: Headless-Chromium-WebGPU
   benötigt typischerweise `--enable-unsafe-webgpu` plus Backend-Auswahl
   (Dawn/Vulkan/SwiftShader, plattformabhängig), SwiftShader-Smoke im Runner explizit
   als Emulation gekennzeichnet. Vorgehen: Spike-Messlauf → messbare Ergebnisse →
   Ersetzung dieses Absatzes durch die gemessenen Werte. Kein unbelegter Gate-Name im
   Dokument.
5. **WGSL-Tooling:** echte `.wgsl`-Dateien + Codegen mit Token-Slot; jede Token-Drift
   löst den Differential-Lauf aus (Drift-Guard-Disziplin existiert:
   `lib/routing/tokens.test.ts`, WP-1).

---

## 7′ — Nudge-Kopplung (Konstantenlage korrigiert, Gegenbefund dokumentiert)

**Ist-Belegung (alle verifiziert):**

| Beleg                                                                                                                                                            | Stelle                                | Verifikation                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| `NUDGE_GAP = ROUTING_TOKENS.laneGrid` (16 px), `NUDGE_THRESHOLD = 10`, `NUDGE_MIN_OVERLAP = ROUTING_TOKENS.cableClearance` (12 px), `MAX_NUDGE_REFLOW_STEPS = 3` | `components/edges/utils/nudge.ts`     | ✅ im Code bestätigt                                                                    |
| Mechanismus: Cluster-Sortierung + äquidistante Lane-Verteilung (Kommentar „Lane-Registry-Leiter"), kein Hungarian                                                | `nudge.ts` / `nudge.test.ts`          | ✅                                                                                      |
| `laneOffset(laneIndex, laneGrid)`                                                                                                                                | `lib/routing/geometry/polyline.ts`    | ✅ („einzige Quelle für Quer-Offsets der V2-Schicht", LaneRegistry vergibt die Indizes) |
| `PARALLEL_LANE_SPREAD = ROUTING_TOKENS.laneGrid`                                                                                                                 | `components/edges/utils/pathUtils.ts` | ✅ existiert (Fan-Out/Polaritäts-Lanes `laneOffset(lanes)`)                             |

**Gegenbefund zu Review-2, Punkt 1 (ehrlich):** Die Behauptung „`PARALLEL_LANE_SPREAD`
existiert nicht" traf nicht zu — die Konstante existiert in `pathUtils.ts` und ist in
`docs/ai/ROUTING-CONTEXT.md` unter den `laneGrid`-Verwendern gelistet; `agent.md` R-5
verlangt die Konsolidierung des Lane-Systems um sie herum. Der Originalfehler von
v1/v2 war die **falsche Zuordnung des Namens zum Nudge-Mechanismus**, nicht die
Erfindung des Namens. Konsequenz: v3 nennt ausschließlich die oben verifizierten
Belegstellen; `PARALLEL_LANE_SPREAD`, `U_TURN_LANE_SPREAD` (`pathfinding.ts`, anderer
Mechanismus) und Verwandte werden nicht dem Nudge-Pfad zugeschrieben.

**Kopplung:** Blade-Zuordnungen akzeptieren optional die T1-Kapazitätsbudgets als
Vorzugs-Lanes (weiche Vorbelegung, bestehende Festlegung unverletzt).

---

## 8 — Entscheidungsmatrix „auch ohne GPU wertvoll"

| Baustein                                | Ohne GPU wertvoll?                                                                 | Phase         |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ------------- |
| Exakte separierbare EDT (px-int²)       | Ja — ermöglicht $O(1)$-Proximity-Lookups im CPU-A\*                                | 0/1 mandatory |
| Physik-Feedback-Loop                    | Ja — Kern-Neuheit (Master-Spec „Modul 3 — Physik")                                 | 0/1 mandatory |
| Konfliktgraph-Batching                  | Ja — Ordnungsdisziplin in `routeAllCables`, weniger Nudge-Reflow                   | 1 mandatory   |
| px-Ganzzahlskala + Sättigung            | Ja — Determinismus-Vertiefung, Vorbereitung paralleler Varianten                   | 0 mandatory   |
| Uniform-Lattice-Grob-Pass (GAMER-artig) | Bedingt — nur bei gemessenem Korridor-Orchestrierungs-Anteil > 20 % der Route-Zeit | 1+ optional   |
| WebGPU-Ausführungsschicht               | Nein (reine Beschleunigung) — Kill-Kandidat per Phase-0-Gate                       | optional      |

---

## 9 — Akzeptanzkriterien (baseline-relativ)

- **Baseline-Artefakt** `benchmarks/baseline.json` aus Phase 0 (Datum +
  Maschinenkennung), Gate-Werte §0.
- **Qualitätsband:** GPU-/Grob-geführte Pfade ≤ Baseline × 1,005 Wirelength;
  Untergrenze entfallen — stattdessen Ratchet: anders-bessere Ergebnisse fließen in
  `improvement-candidates.json` und öffnen einen begründungspflichtigen
  Golden-Recapture-Vorgang. Übergeordnetes Niveau: ≤ 1,3× Manhattan (R-1).
- **Interaktion:** P99 Frame ≤ 16 ms (ADR-0012), gemessen, nicht angenommen.
- **Physik-Batch CPU:** ≤ 1 ms je 200 Blades; nur bei Überschreitung wird
  T1-Physik in Betracht gezogen.

---

## Anhang A — Review-Protokoll & Dispositionen

### Runde 1 (v1 → v2)

| #   | Punkt                                                                                                                                                        | Disposition                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1   | Hanan ungleichmäßig, GAMER-Prämisse falsch, §2.1/§8-Widerspruch                                                                                              | Angenommen → §2.1′ (Grob GPU / Detail CPU)                             |
| 2   | Golden-Master-/Regressionskonflikt                                                                                                                           | Angenommen → Golden-Policy §5′                                         |
| 3   | JFA approximativ vs. exakte I3                                                                                                                               | Angenommen → exakte separierbare EDT (§2.2, in v3 nochmals präzisiert) |
| 4   | Heuristik-Init ohne Korrektheitsbeweis                                                                                                                       | Angenommen → Branch-and-Bound-Pruning (§2.1′)                          |
| 5   | int32-Overflow/`atomicMin`-Packing undurchdacht                                                                                                              | Angenommen (v2), von Runde 2 verschärft und final gelöst (§3″)         |
| 6   | Nudge ≠ Hungarian                                                                                                                                            | Angenommen → §7′                                                       |
| 7   | §-Referenzen inkonsistent                                                                                                                                    | Angenommen → benannte Referenzen                                       |
| 8   | Wirelength-Untergrenze [0,995] unbegründet                                                                                                                   | Modifiziert angenommen → Ratchet statt Untergrenze (§9)                |
| 9   | Physik-Fixpoint CPU-billig                                                                                                                                   | Angenommen → CPU-first §2.3′                                           |
| 10  | VS1 Phase-0-Kill-Gate; VS2 „Algorithmen zuerst"; VS3 §2.1 trennen; VS4 Verifikationspyramide; VS5 CI via Playwright statt Emulation; VS6 Entscheidungsmatrix | Angenommen → §0, §5′, §8                                               |

### Runde 2 (v2 → v3)

| #   | Punkt                                                                    | Verifikation (Repo)                                                                                                                                                                                                                                                                              | Disposition                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Konstantenlage Nudge                                                     | Teils Gegenbefund: `NUDGE_GAP`/`NUDGE_THRESHOLD`/`NUDGE_MIN_OVERLAP` in `nudge.ts` bestätigt; `laneOffset` in `lib/routing/geometry/polyline.ts` bestätigt; **aber `PARALLEL_LANE_SPREAD` existiert** (in `pathUtils.ts`) — der Originalfehler war falsche Zuordnung, nicht Erfindung des Namens | Modifiziert angenommen → §7′ mit Belegtabelle, Namenslage ehrlich dokumentiert                                                                                                                                                                                                                                                                                                         |
| 2   | F-H-Kosten $O(W+H)$ falsch; Orakel-Definition ungenau                    | Bestätigt                                                                                                                                                                                                                                                                                        | Angenommen → §2.2″ ($O(W \cdot H)$, Raster-Orakel, kontinuierliche Exaktheit = CPU-Final-Gate)                                                                                                                                                                                                                                                                                         |
| 3   | Bit-Budget kein Beweis; Einheit mm widersprüchlich                       | Bestätigt; Skalenidee $S=1000$ gegen `0x7FFF0000` marginal                                                                                                                                                                                                                                       | Angenommen → §3″ (Sättigung, px-nativ in Milli-px, mm-Diskussion entfernt). **Korrektur nach Repo-Einstand:** Der Wortlaut „1 Kosteneinheit = 1 px Leitungslänge" steht **wörtlich** in `lib/routing/rules/costModel.ts` (Z. 11) und „1 Kosteneinheit entspricht 1 px Leitungslänge" in `components/edges/utils/pathfinding.ts` (R-2-Kommentar) — der Unverifiziert-Vermerk war falsch |
| 4   | `bestFreeCatalog` kann `null` liefern; Inkumbent-Semantik falsch         | Bestätigt: `bestGoalG`-Pruning in `pathfinding.ts` vorhanden (`if (cur.g + cur.h >= bestGoalG) continue;`)                                                                                                                                                                                       | Angenommen → §2.1′ mit Ist-Beleg                                                                                                                                                                                                                                                                                                                                                       |
| 5   | WebGPU-Flag unbelegt                                                     | Bestätigt (kein Flag im Repo belegt, herstellerseitig plattformabhängig)                                                                                                                                                                                                                         | Angenommen → §5′ „im Spike messen, dann dokumentieren"                                                                                                                                                                                                                                                                                                                                 |
| 6   | Kleinigkeiten (T0-Ziel vs. Gate; Tabellenkopf; R1 statt I5/I6 für Stubs) | Stub-Regeln I5/I6 in `lib/routing/invariants.ts` / `ROUTING-CONTEXT` belegt                                                                                                                                                                                                                      | Angenommen → §0 (Gate/Ziel-Trennung), §2.1′ (I5/I6), Tabellen bereinigt                                                                                                                                                                                                                                                                                                                |

**Vermerk zu „Unverifiziert"-Disziplin aus v2 (korrigiert beim Repo-Einstand):**

- Die Perf-Skriptnamen sind in `package.json` belegt (`perf:route-scaling` →
  `benchmarks/routeAllScaling.probe.ts`; `perf:edge-routing` →
  `benchmarks/edgeRoutingPerf.bench.ts`) — der Unverifiziert-Vermerk ist gestrichen.
- **`PX_PER_METER` wurde bei der Code-Verifikation nicht gefunden" — widerlegt:**
  `lib/units.ts` Z. 171: `export const PX_PER_METER = 100;` (= 100 px/m →
  1 px = 10 mm), konsumiert in `components/edges/utils/voltageDrop.ts`
  (`routeLengthPx / PX_PER_METER`). Durch den Wechsel auf px-native Einheiten ist die
  Konstante für den GPU-Kern **irrelevant**, aber sie existiert und bleibt die
  px↔m-Brücke der Physik-Schicht.

### Runde 3 (Belegprüfung beim Repo-Einstand, kurz)

| #   | Punkt                                                            | Ergebnis                                                                                                  |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | „`PARALLEL_LANE_SPREAD` existiert nicht" (Review 2)              | Widelegt — Gegenbefund aus Runde 2 bestätigt (`pathUtils.ts` Z. 18, `ROUTING-CONTEXT.md`, `agent.md` R-5) |
| 2   | „1 Kosteneinheit = 1 px wörtlich nicht verifizierbar" (Review 2) | Widelegt — wörtlich in `costModel.ts` Z. 11 und `pathfinding.ts` R-2-Kommentar                            |
| 3   | „`PX_PER_METER` nicht gefunden" (Vermerk)                        | Widelegt — `lib/units.ts` Z. 171, genutzt in `voltageDrop.ts`                                             |
| 4   | Anhang-Tabellen doppelte Kopfzeile                               | Behoben (Formatierung)                                                                                    |
