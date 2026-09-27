# ADR 0026 — Die LaneRegistry speist das gescopede Nudging

**Status:** angenommen · **Datum:** 2026-09-27 · **Bezug:** ADR 0010
(Determinismus), ADR 0017 (Platzierung ohne Überlappung), ADR 0025
(Port-Bündel als eine Regel), ROUTE-001, ROUTE-006, WP-5/WP-8; Finding
2026-09-27 („Rest-I2 auf ELK-Geometrie, Lösungsweg LaneRegistry-Anbindung")

## Kontext

`LaneRegistry` (`lib/routing/rules/laneRegistry.ts`) vergibt seit WP-5 stabile
Lanes je Korridor (`laneIndex × laneGrid` um eine auf halbes `laneGrid`
gerastete Referenzkoordinate), hatte aber **keinen Produktiv-Konsumenten**
(ROUTE-001). Der einzige Ort, an dem im Produktivpfad tatsächlich Quer-Versätze
entstehen, ist das gescopede Nudging (`components/edges/utils/nudge.ts`,
Aufruf in `routeAllCables`) — WP-8s angekündigter Konsument.

Dort lagen zwei belegte Lücken, gemessen über den ELK-Pfad
(`performAutoWiring → applyAdvancedLayout → routeAllCables → checkInvariants`,
sechs Referenzpläne):

1. **Die Cluster-Schwelle war größer als die Invariante.** Der Nudge gruppierte
   parallele Innenstücke erst ab `NUDGE_MIN_OVERLAP` = 12 px gemeinsamer Länge.
   I2 greift aber bei JEDER kollinearen Überdeckung > 0 — ein 8-px-Stück auf
   derselben Linie blieb damit stehen (gemessen: `e-auto-4 ↔ e-auto-8`,
   V @704 [300, 308], 8 px).
2. **Ein einzelner beweglicher Teilnehmer wurde ignoriert.** Der Cluster-Pass
   verteilt nur Gruppen mit mindestens zwei beweglichen Segmenten. Gemessen
   blieben genau die Fälle übrig, in denen eine Seite nicht beweglich ist:
   ein Freiwinkel-Pfad über einem fremden **Stub** (26 px,
   `e-fuse-fan ↔ e-auto-5`) sowie die **Zuläufe zum Port** (40 px und 8 px),
   deren Ellbogen direkt neben dem Stub liegt und deshalb von
   `isFreeVertex` ausgeschlossen wurde.

Beide Lücken sind dieselbe Frage: „Wohin darf ein Lauf ausweichen?“ — und
genau dafür existiert die Registry-Leiter.

## Entscheidung

1. **Die Registry wird zur Quelle der Ausweich-Kandidaten.** Neu
   `laneCandidates(corridor, gap, { limit, accept })`: liefert die
   Korridor-Leiter `coord ± k · gap` nach Abstand geordnet, deterministisch,
   mit Filter für belegte Koordinaten. Das Nudge nutzt sie im neuen Pass
   `displaceSingleMovers` — der Zug geht auf die nächstgelegene **freie
   Registry-Lane**, nicht auf „irgendein ±gap“.
2. **Kollineare Überdeckungen zählen ab jeder Länge.** Das Gruppierungs-Gate
   des Nudge unterscheidet jetzt: kollinear (gleiche Querkoordinate) ⇒ jede
   Überdeckung > EPS (der I2-Begriff), bloß benachbart innerhalb
   `NUDGE_THRESHOLD` ⇒ weiterhin `NUDGE_MIN_OVERLAP`.
3. **Ein beweglicher Teilnehmer genügt.** Beweger sind Segmente, deren BEIDE
   Enden Innenpunkte sind — ausdrücklich auch der Ellbogen neben einem Stub
   (`i0 = 1` bzw. `i1 = n−2`). Das ist zulässig, weil ein Segment nur als
   Ganzes wandert (ROUTE-BUG-17) und quer zu seinen Nachbarn liegt: die
   Anschluss-Stubs bleiben auf ihrer Achse, nur ihre **Länge** ändert sich —
   genau die Stub-Verlängerung, die der Port-Fan-Out `lane` nennt.
   Gegenüber stehen jetzt alle Segmente fremder Pfade, Stubs eingeschlossen.
4. **Akzeptanz bleibt streng und wird härter.** Ein Zug gilt nur, wenn der
   Pfad orthogonal, hindernisfrei, im Mängelmaß nicht schlechter ist, die
   **Stubs ≥ `stubMin`** bleiben (I5 — dieser Zug verkürzt sie ja) und
   **keine neue kollineare Überdeckung** entsteht. Für das letzte Kriterium
   liest der Nudge dasselbe Modell wie die Invariante (ADR 0025), damit er
   die Port-Bündel-Ausnahme nicht wegoptimiert.

## Folgen

- **ELK-Pfad: I2 3 → 1** über die sechs Referenzpläne (I1 = 0 und I3 = 3
  unverändert). Aufgelöst sind der 26-px-Lauf über einem fremden Stub und der
  40-px-Zulauf auf denselben Ziel-Port; offen bleibt ein 8-px-Bündel in
  `camper` (`e-auto-4 ↔ e-auto-8`, V @704 [300, 308]). Isoliert greift auch
  dieser Zug (gemessen: der Lauf wandert auf die Registry-Lane 688 px); im
  echten Plan liegen die Kandidaten-Leitern (±16 px) in den aufgeblähten
  Karten-Boxen, und die Akzeptanz verwirft ihn deshalb korrekt. Der nächste
  Hebel dort ist der Stub-/Fan-Out-Pfad (ROUTE-002 Teil 2b).
- **Regression p02 wird besser und wurde deshalb bewusst neu aufgenommen.**
  Im Stress-Szenario „1 Batterie + 10 Verbraucher“ sinkt I2 von 2 auf 1, die
  Metrik-Budgets bleiben exakt gleich (Kreuzungen 5, Bends 42, Länge 7.609 px,
  Freigabe-Verstöße 0). Der Capture-Diff umfasst genau eine Trasse
  (zwei Stützpunkte, 16 px = eine Registry-Lane) plus das zugehörige SVG —
  alle anderen 14 Szenarien sind byte-identisch. Ein Refresh ist laut
  `scripts/regression/capture.ts` nur mit Begründung zulässig; sie steht hier
  und im Change Ledger.
- **Golden Master unverändert.** Die sechs Referenzpläne haben I2 = 0, es
  existiert dort also keine kollineare Überdeckung, die eines der neuen Gates
  auslösen könnte: 13/13 byte-identisch, `routing:audit` mit unveränderten
  Kreuzungen (2/5/2/2/8/29) und Kabellängen (2.697 … 10.909 px).
- **Die Regressionssuite führt I2 als Ratchet.** `ScenarioMetrics` hat jetzt
  `edgeOverlaps` (aus `checkEdgeEdgeOverlaps`), das Budget prüft „≤ Baseline“.
  Genau dieses Feld hatte gefehlt; die zwei Überdeckungen von p02 waren für die
  Suite unsichtbar, weil nur Kreuzungen, Bends, Länge und Freigaben geführt
  wurden. Baseline: p02 = 1, alle übrigen 14 Szenarien = 0 — der Stand kann
  damit nur noch besser werden.
- `preferredLaneBonus` bleibt offen: Der Bonus zieht Trassen auf die von der
  Registry _bevorzugte_ Lane — dafür muss zuerst der Stub-/Fan-Out-Pfad die
  Registry befragen (ROUTE-002 Teil 2b). Die Registry hat jetzt aber einen
  echten Konsumenten, der ihre Leiter benutzt.

## Nachweis

- `components/edges/utils/nudge.test.ts` (+4): 8-px-Überdeckung wird getrennt
  (I2-scharfe Schwelle), disjunkte Parallelen bleiben unberührt, ein
  beweglicher Lauf auf fremdem Stub wandert auf eine Leiter-Koordinate
  (`offset % laneGrid === 0`), und ein Hindernis auf allen Kandidaten-Lanes
  verwirft den Zug.
- `lib/routing/rules/laneRegistry.test.ts` (+3): Leiter-Reihenfolge,
  `accept`-Filter, Limit und Determinismus.
- Golden Master 13/13 unverändert; `npm run routing:audit` unverändert;
  `npm run test:regression` 50/50 nach dem begründeten p02-Refresh.

## Nicht in dieser Entscheidung

Der `preferredLaneBonus` und der Produktiv-Aufruf von `segmentExtraCost`
(ROUTE-002 Teil 2b) — beide brauchen die Registry auch auf der Stub-/Fan-Out-
Ebene, nicht nur im Nudge.
