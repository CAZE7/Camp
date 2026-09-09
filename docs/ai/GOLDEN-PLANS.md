# GOLDEN-PLANS

Die sechs Referenzpläne sind die **verbindlichen Testfälle** jeder Änderung an AutoWire,
Sizing, Electrical und Routing.

- Eingaben: `scripts/goldenmaster/plans.ts` (`GOLDEN_PLANS`)
- Eingefrorene Ergebnisse: `knownPlans/<plan>.json`
- Pipeline: `scripts/goldenmaster/pipeline.ts`
- Harness: `scripts/goldenmaster/goldenMaster.test.ts`
- Invarianten-Gate: `scripts/routing/finalValidation.test.ts`
- Tabelle: `npm run routing:audit`

**Regel:** Fixtures nie „reparieren“, wenn ein Test rot ist. Nur zwei legitime Ausgänge:
Regression fixen **oder** bewusste Verbesserung mit Recapture, PR-Begründung und Ledger-Eintrag
(`docs/ARCHITECTURE-CHANGES.md`).

---

## Fixture-Format

```ts
GoldenMaster = {
  fixtureVersion: 1,
  input: { nodes, edges }, // Eingabeplan
  autoWire: { nodes, edges }, // nach performAutoWiring
  electrical: { systemVoltage, edgeCurrents: Record<edgeId, A>, cumulativeDrops: Record<nodeId, V> },
  routing: Record<edgeId, { waypoints; length; bends; crossings; usedSearch }>,
};
```

Auto-erzeugte Knoten-IDs werden auf `auto:<index>:<label-slug>` normalisiert, damit zufällige
UUIDs den Diff nicht verfälschen. Auto-Kanten-IDs (`e-auto-<n>`) sind ohnehin deterministisch.

---

## Die Pläne

| Plan       | Herkunft              | Bausteine                                                                                        | Zweck                        |
| ---------- | --------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------- |
| `simple`   | `plans.ts` SIMPLE     | Batterie AGM 100 Ah, Sicherungskasten, LED 20 W, Pumpe 40 W                                      | kleinster sinnvoller DC-Plan |
| `camper`   | `TEMPLATE_MINIMALIST` | Vorlage „Minimalist“                                                                             | Template-Pfad                |
| `solar`    | `plans.ts` SOLAR      | Solar 200 W, MPPT 20 A, LiFePO4 100 Ah, Kompressorkühlschrank 60 W                               | Solar-Domäne, MPPT-Fenster   |
| `inverter` | `plans.ts` INVERTER   | LiFePO4 200 Ah, WR 1000 W, 230-V-Steckdose 600 W, LED 20 W                                       | DC/AC-Grenze, Insel-BFS      |
| `acdc`     | `plans.ts` ACDC       | Landstrom, AC-Ladegerät 25 A, LiFePO4 150 Ah, WR 1500 W, 230-V-Kochfeld 1200 W, Kühlschrank 60 W | Landstrompfad, AC-Schutz     |
| `complex`  | `TEMPLATE_AUTARK`     | Vorlage „Autark“ (größter Plan)                                                                  | Last- und Dichte-Fall        |

---

## Erwartete Ergebnisse (gemessen 2026-09-09)

`npm run routing:audit` — Routing nach dem AutoWire-Lauf:

(Kreuzungen = `realCrossingPairs`, siehe
[ROUTING-CONTEXT §4.5](./ROUTING-CONTEXT.md#45-routing-invarianten).)

| Plan     | Kanten |  I1 |  I2 |  I3 |  I4 |  I5 |  I6 |  I7 | Fallback | determ. | Kreuzungen |
| -------- | -----: | --: | --: | --: | --: | --: | --: | --: | -------: | ------- | ---------: |
| simple   |      9 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |          2 |
| camper   |     12 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |          5 |
| solar    |     11 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |          2 |
| inverter |     10 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |          2 |
| acdc     |     14 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |          8 |
| complex  |     23 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |         29 |

Summe: **79 Kanten, 48 Kreuzungen, 0 Invarianten-Verletzungen, 0 Fallbacks.**

`knownPlans/<plan>.json` → Stufe `routing` (gemessen 2026-09-09):

| Plan     | Kanten | Gesamtlänge (px) | Bends | `crossings` (per Kante) | `usedSearch`         |
| -------- | -----: | ---------------: | ----: | ----------------------: | -------------------- |
| simple   |      9 |          2 696,8 |    28 |                       4 | 6 catalog / 3 astar  |
| camper   |     12 |          3 804,8 |    32 |                      10 | 7 catalog / 5 astar  |
| solar    |     11 |          3 200,0 |    18 |                       4 | 7 catalog / 4 astar  |
| inverter |     10 |          3 888,0 |    22 |                       4 | 7 catalog / 3 astar  |
| acdc     |     14 |          5 770,4 |    30 |                      14 | 6 catalog / 8 astar  |
| complex  |     23 |         10 908,8 |    60 |                      54 | 5 catalog / 18 astar |

**Ratchet:** `scripts/routing/finalValidation.test.ts` hält pro Plan `I2 + I3 ≤ 0` und prüft
`I1 = 0` **hart** (keine Baseline, keine Toleranz).

**Perf-Gate:** `npm run perf:edge-routing` — Referenzplan N=36, E=134,
Median **2,35 ms**, p90 2,43 ms, Budget 16 ms/Frame (ADR 0012).

**Warn-Zentrale:** AutoWire-Ergebnisse sollen meldungsfrei sein. Geprüft wird das **nicht**
über alle sechs `knownPlans`, sondern durch die Helfer `assertZeroWarnings()` /
`assertNoSafetyWarnings()` in `store/usePlannerStoreExtended.test.ts` (Handpläne +
`TEMPLATE_MINIMALIST`; `LiveValidation` **und** `collectEdgeErrors` müssen `[]` liefern).
`hasRcd`-Hinweise entstehen nur bei fehlenden Nutzerangaben.

---

## Golden-Master-Workflow bei Änderungen

```
golden input            scripts/goldenmaster/plans.ts (unverändert)
      ↓
current implementation  performAutoWiring → sizing → routeAllCables
      ↓
expected result         knownPlans/<plan>.json (byte-genau)
```

Bei einer Änderung:

1. `npm run test:goldenmaster` zeigt die **Stufe**, die abweicht
   (Knotenliste · Kanten-IDs · `electrical` · `routing` · Vollvergleich).
2. Diff `alt vs neu` im PR zeigen.
3. Ist die Abweichung **beabsichtigt**: `npm run goldenmaster:capture`, danach
   `git diff knownPlans/` im PR und „bewusst besser, weil …“ begründen.
4. Ist sie **nicht** beabsichtigt: Code fixieren, Fixtures unangetastet lassen.

Zusätzlich prüft der Harness: Fixture-Satz und Planliste decken sich
(kein vergessener Plan, keine verwaiste Datei) und Doppelläufe sind byte-identisch (ADR 0010).

---

## 15 Routing-Regressionsszenarien (`scripts/regression/`)

Ergänzend zum Golden Master, rein routing-fokussiert:
`p01` 1 Verbraucher · `p02` 10 Verbraucher · `p03` Busbar-Fan-Out · `p04` parallele Verbraucher ·
`p05` Solar/MPPT · `p06` Wechselrichter · `p07` AC/DC-Mischung · `p08` enger Raum ·
`p09` Node im Weg · `p10` parallele Trassen · `p11` Zwangskreuzung · `p12` Backbone-Kreuzung ·
`p13` Drag zentraler Node · `p14` Undo/Redo · `p15` Pass-Wechsel ELK → A* → ELK.

Vier Gates: **Golden Layout** (Trassenstruktur Wegpunkt-genau), **Metrik-Budget**
(Kreuzungen/Bends/Länge ≤ Baseline, Clearance = 0), **Visuell** (SVGs byte-genau),
**Verhalten** (p13–p15 identisch).
Recapture: `npm run regression:capture`.

---

## 25 Geometrie-Szenarien (`docs/routing-gallery/`)

Konstruierte Einzelgeometrien (Gerade, L, Z, U, Labyrinth, Lanes, Kreuzungen, Ausnahmen, Last)
plus `nutzerplan-autowire.svg` (realer AutoWire-Plan: 13 Kabel, 5782 px, 0 Clearance-Verstöße).
Referenzdatei `gallery.json`, Recapture `npm run routing:gallery`.

> **Achtung:** die Galerie rechnet mit dem **Legacy-Router** `orthogonalRouting.ts`
> ([LEGACY.md](./LEGACY.md) L-1). Sie ist kein Nachweis für das Rendern im Canvas.
