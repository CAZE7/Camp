# ADR 0023 — ELK bekommt die Port-Freigabe als Kartenabstand

**Status:** angenommen · **Datum:** 2026-09-27 · **Bezug:** ADR 0016, ADR 0017,
ADR 0020, ROUTE-BUG-32, Finding 2026-09-27 („Plan ordnen produziert Pläne, die
der Router nicht verlegen kann")

## Kontext

`applyFlowLayout` hielt den Mindestabstand zweier Karten ein, deren Anschlüsse
einander zugewandt sind: `PORT_FACING_CLEARANCE` = `stubMin` (24) + `laneGrid`
(16) + `cableClearance` (12) = **52 px** (ROUTE-BUG-32). Der Router braucht
diese Fläche wirklich: Stub, ein Lane-Schritt für den Fan-Out an der Klemme,
plus Freigabe zur Nachbarkarte.

Der **zweite** Platzierungspfad — „Plan ordnen“ über ELK (ADR 0018) — kannte
die Zahl nicht. `generateElkLayoutOptions` setzte `spacing.edgeEdge`,
`spacing.edgeNode` und die Between-Layers-Varianten, aber **nicht**
`spacing.nodeNode`. ELK nahm damit seinen Default (~10 px). Folge: Nach „Plan
ordnen“ lagen Karten 20 px auseinander, wo 52 px nötig sind.

Gemessen über die sechs Referenzpläne (`captureGoldenMaster` → `Input →
AutoWire → ELK-Layout` → Router → `validateFinalRouting`):

| ELK-Abstand    | I1  | I2  | I3  | Σ      | Kabellänge |
| -------------- | --- | --- | --- | ------ | ---------- |
| ELK-Default    | 3   | 21  | 17  | **41** | 18 431 px  |
| Token + Option | 0   | 9   | 1   | **10** | 22 965 px  |

I1 (Kabel durch Karte) fällt auf 0, I3 von 17 auf 1. Die Kabellänge wächst um
rund 25 % — das ist der Preis dafür, dass zwischen den Karten überhaupt
verlegt werden kann; die vorher kürzeren Wege waren kürzer, weil sie durch
Bauteile liefen.

## Entscheidung

1. **Die Port-Freigabe ist ein Token**, keine zweite Zahl in der Platzierung:
   `ROUTING_TOKENS.portFacingClearance = 52`. `PORT_FACING_CLEARANCE` in
   `lib/autoWire/placement.ts` liest sie nur noch; ein Invariantentest in
   `lib/routing/tokens.test.ts` pinnt `portFacingClearance === stubMin +
laneGrid + cableClearance` — die Summe bleibt die Begründung, die Zahl die
   Quelle.
2. **ELK bekommt sie als Kartenabstand:** `elk.spacing.nodeNode` und
   `elk.layered.spacing.nodeNodeBetweenLayers = String(tokens.portFacingClearance)`.
   Beides gehört in den Generator, damit kein Aufrufer die Option vergessen
   kann (ADR 0016: genau eine Eingabestelle für die Anbindung).
3. **Test an der Geometrie, nicht an der Option:**
   `lib/planner/layout-engine/elkSpacing.test.ts` legt zwei Verbraucher an
   eine Schiene, lässt echtes ELK rechnen und misst den Kartenabstand. Ohne
   die Option fällt er auf 20 px und der Test schlägt fehl (Gegenprobe
   gemessen: `Kartenabstand 20 px < Port-Freigabe 52 px`).
4. **Der Token-Wert bleibt im Vergleich zu `stubMin`/`laneGrid`/`cableClearance`
   unverändert** — es entsteht keine neue Geometrie-Schwelle, sondern die
   vorhandene wird an der zweiten Stelle wirksam. Deshalb sind die
   Referenzplan-Fixtures nicht betroffen (die Fixed-Raster-Platzierung liefert
   unverändert 52 px; die Golden-Master- und Regression-Läufe bleiben grün).

## Konsequenzen

**Gut:** Beide Platzierungspfade halten dieselbe Freigabe ein. „Plan ordnen“
ist zum ersten Mal ein Layout, auf dem der Router ohne Ausnahme auskommt
(I1 = 0 statt 3). Die Option ist differenziert testbar: Der Geometrie-Test
misst den Abstand, ein Mutationstest (Option entfernen) beweist, dass der
Token die Wirkung trägt.

**Preis:** Pläne werden nach „Plan ordnen“ vertikal luftiger; die Kabellänge
steigt auf den Referenzplänen auf 22 965 px. Der Zugewinn an Verlegbarkeit
wiegt das auf — ein kürzerer Weg durch eine Karte ist kein gültiger Weg.

**Nicht Teil dieser Entscheidung:** die verbleibenden 9 I2 und 1 I3. Sie sind
Trassenüberdeckungen bzw. eine geometrisch nicht einhaltbare Freigabe
(ROUTE-BUG-23) und bleiben als ROUTE-006 dokumentiert.
