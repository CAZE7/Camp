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

**Umsetzung GPU-Kern (Mission Stufe 4, 2026-09-28):** `lib/routing/gpu/edt.wgsl`
(echte WGSL-Datei, zwei Entrypoints `edtRowPass`/`edtColPass` = die zwei Dispatches
von §2.2″) + `lib/routing/gpu/gpuEdt.ts` (`gpuSquaredEdt2D` hinter Flag
`ROUTING_GPU`, default off; Init/INF-Clamp/`EDT_MAX_DIM`-Assertions identisch zu
`squaredEdt2D`; Token-Slot `EDT_MAX_D2` mit Drift-Guard `gpuEdt.test.ts`). Der
Kern rechnet pro Zielzelle den direkten Min über die Quellenlinie
(definitionsgleich zum FH-Unteren-Envelope in `transform1D`, d. h. **exakt dieselbe
Ausgabe**) — Arbeit O(W²·H + H²·W) statt des FH-O(W·H)-Sweeps; Optimierung auf
echter GPU erst nach Messung (§5′-4 Durchsatz: SwiftShader-Emulation ~109 ms/Call
256×128 vs. CPU 1,69 ms). Parität CPU ≡ GPU ≡ Orakel: `npm run test:gpu`
(`scripts/routing/gpuEdtParity.ts`); Stabilitätsblockade des automatisierten Laufs
sowie Flags/ICD-Messwerte: §5′-4.

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

**Umsetzung (Mission Stufe 3, 2026-09-28):** implementiert als
`lib/routing/rules/intCosts.ts` (`costToMilliPx`, `heuristicToMilliPx` — floor bleibt
zulässig, `intCostBudget` mit `g_max + s_max = INF` exakt, `saturatingAddMilli` mit
`onSaturate`-Gegenmaßnahmen-Pfad, `maxStepPxOfGrid` als Per-Zellen-Budget aus dem
konkreten Suchgrid), Property-Tests `intCosts.test.ts` (Seed 20260928: zufällige
Update-Ketten erreichen nie `INF`). Integration in `hananAStar`
(`components/edges/utils/pathfinding.ts`) token-gated über
`ROUTING_GATES.integerMilliPxCosts` in `lib/routing/rules/costModel.ts` —
**eingefroren auf 0**: Der kalte Golden Master mit 1 brach `acdc` (Waypoint
669 → 698,4 px), den Längen-Ratchet (≤ 5710 px) und `domainProbe.test`, obwohl
`test:regression` 50/50 hielt (`npm run routing:conflict-probe`, Cache-frei
gemessen: 20/21 Pläne byte-gleich, acdc 5710 → 5742 px). Der Modus steht seit
Stufe 3 im `requestKey` des Routen-Caches — die erste A/B-Runde hatte die
Byte-Gleichheit nur durch Cache-Treffer der Float-Variante „bewiesen“. Aktivierung
gehört zu einer Recapture-Stage mit Ledger.

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
4. **WebGPU-Smoke — GEMESSEN (Spike-Messlauf 2026-09-28, Mission Stufe 4):**
   - **Browser-Pfad negativ:** sparticuz-Chromium 153.0.8010.0 (einziger
     verfügbarer Browser; Playwright-CDN, apt, googleapis, launchpad,
     objects.githubusercontent in dieser Sandbox gesperrt) liefert bei **sieben
     Flag-Sätzen** (`--enable-unsafe-webgpu`; +Vulkan-Features;
     `--use-webgpu-adapter=swiftshader --enable-unsafe-swiftshader`;
     Kombiset; `--enable-blink-features=WebGPU`; `--enable-features=WebGPU,WebGPUService`;
     Trial-Kombi) konstant `navigator.gpu === undefined` — WebGPU ist im Build
     nicht enthalten. Browser-Smoke in dieser Umgebung nicht messbar.
   - **Node/Dawn-Pfad positiv:** npm-Paket `webgpu` (Dawn-Bindings).
     Version **0.4.0 ist die neueste ohne `GLIBCXX_3.4.31+`-Bedarf** (0.5.0
     verlangt 3.4.31/32, der Host-Debian-12-libstdc++ endet bei 3.4.30; beide
     Installationen md5-identisch `49e035eb…`). ICD: SwiftShader aus
     `@sparticuz/chromium` (`vk_swiftshader_icd.json` + `libvulkan.so.1` +
     `libvk_swiftshader.so`), gesetzt über `VK_ICD_FILENAMES` und
     `LD_LIBRARY_PATH`. Gemessen: Adapter `google / SwiftShader driver 5.0.0`,
     Device ok, trivialer Compute-Dispatch `2,4,6,8` korrekt; `device.limits.
maxStorageBufferBindingSize = 134217728`.
   - **Parität:** `npm run test:gpu` (`scripts/routing/gpuEdtParity.ts`)
     vergleicht GPU ≡ CPU ≡ Brute-Force-Orakel. In vollendeten Läufen waren die
     Ergebnisse korrekt (Degenerierte bis 65×33, Zufallsfeld 64×64, iso 256×128
     byte-gleich gegen `squaredEdt2D`).
   - **Stabilitätsbefund (ehrlich, Stopp-Regel nach erfolgloser Isolation):**
     dawn 0.4.0 + SwiftShader crasht in der Treiber-Kombination **`gpuEdt.ts`-
     Pfad** deterministisch (10/10 SIGSEGV/Abort beim `mapAsync` nach Submit),
     während identische GPU-Operationen über reine Referenz-Treiber stabil
     laufen (3×100 Läufe `create`/`dispatch`/`mapAsync` sauber). Geprüft und
     verworfen als Alleinursache: Vite-Dynamic-Import (Fix auf `createRequire`
     senkte die Vitest-Rate, eliminierte sie nicht), `device.limits`-Getter,
     Layout-Caching, Await-Position, `destroy()`, erzwungener GC,
     SwiftShader-Thread-Env-Vars. Root Cause in dawn/SwiftShader nicht isoliert
     → automatisierter Paritäts-Gate-Lauf vorerst blockiert; Flag-Policy unberührt
     (`ROUTING_GPU` default off, nie in CI/E2E/Coverage — Ausschluss in
     `vitest.config.ts`).
   - **Durchsatz (Emulation, ehrlich):** SwiftShader ≈ **109 ms/Call** für
     256×128 (100 Calls/10 914 ms, Referenz-Treiber, Pipelines gecacht, inkl.
     Buffervorbereitung + 2 Dispatches + Readback) gegen CPU-Referenz
     `squaredEdt2D` **1,69 ms** (256×128, 10-Lauf-Mittel) bzw. **8,70 ms**
     (512×256) — Software-Emulation, kein Geschwindigkeitsnachweis; ein
     T1-Zugewinn setzt echte GPU-Hardware voraus und ist erneut zu messen.
   - **Invocation:** `VK_ICD_FILENAMES=…/vk_swiftshader_icd.json
LD_LIBRARY_PATH=… npm run test:gpu` (ICD-Pfad je Umgebung, Aufbau s.
     Anhang B der MULTIPHYSICS).
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

**Umsetzungsstatus (Mission Stufe 3, 2026-09-28 — beide CPU-Bausteine gebaut;
A/B gemessen mit `npm run routing:conflict-probe`, 21 Pläne, Cache-frei):**

- **Konfliktgraph-Batching** (`lib/routing/rules/conflictGraph.ts` →
  `routeAllCables`): gebaut, Gate `ROUTING_GATES.conflictGraphBatching` = **0**.
  Gemessen verliert die Spec-Regel (Längenrang absteigend, Master-Spec §5.2
  Stufe 3) netto: Kreuzungen 52 → 63, Länge 57 996 → 59 653 px — identisch mit
  der globalen Variante, weil Knoten-Chaining die Komponenten auf ganze Pläne
  kollabieren lässt (größte Komponente = 23 Kanten; Pad-Empfindlichkeit
  23/23/23 Komponenten bei pad 0/16/48 px). Die Spiegel-Variante (aufsteigend)
  holt Länge −154 px, Bends −14 und die Verstöß-Fixes (Σ I1–I7: 6 → 2), geht
  aber bei Kreuzungen 52 → 58 verloren. Reproduziert den verworfenen Versuch
  vom 2026-09-09 — Gate bleibt 0, bis eine Variante Längen- UND Kreuzungs-
  Ratchet gleichzeitig hält. Pläne, die allein die Reihenfolge heilt:
  `reg:p13` (I3 → 0, Bends 16 → 10) und `reg:p04` (I2 → 0).
- **px-Ganzzahlskala + Sättigung** (`lib/routing/rules/intCosts.ts` →
  `hananAStar`): gebaut, Gate `ROUTING_GATES.integerMilliPxCosts` = **0** —
  Messdetails und Recapture-Bedingung in §3″ (Umsetzung).

**Umsetzungsstatus (Mission Stufe 4, 2026-09-28 — WebGPU-Spike & EDT-Kern):**

- **WebGPU-Ausführungsschicht:** Spike geliefert (§5′-4: Browser negativ, Node/Dawn
  positiv inkl. ICD-Setup; Zugewinn weiterhin „reine Beschleunigung“ —
  Kill-Gate-Entscheidung aus Stufe 0 bleibt damit unberührt, Sperrung bleibt
  Scope-Entscheid der nächsten Stufen). Erster Kern gebaut: `edt.wgsl` +
  `gpuSquaredEdt2D` hinter `ROUTING_GPU` (default off, nie in CI/E2E/Coverage);
  WGSL-Token-Drift-Guard und Flag-Disziplin laufen grün in `npm run check`.
  Automatisierter Paritäts-Lauf (`npm run test:gpu`) durch dawn-0.4.0-Restinstabilität
  blockiert (Diagnose §5′-4, Stopp-Regel). Uniform-Lattice-Grob-Pass und
  Physik-Feedback-GPU: weiterhin optional und ungebaut.

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
