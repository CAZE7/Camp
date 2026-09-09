# Beispiel: dichter Gesamtplan (`complex`)

Last- und Dichte-Fall. `complex` ist die Vorlage `TEMPLATE_AUTARK`
(`components/planner/templates.ts`). Zahlen aus `knownPlans/complex.json`
bzw. `npm run routing:audit` (verifiziert 2026-09-09).

## Input

`TEMPLATE_AUTARK` — 15 Knoten nach dem AutoWire-Lauf, darunter Batteriebank, Solar, MPPT,
Ladebooster, Landstrom, AC-Ladegerät, Wechselrichter, mehrere 12-V- und 230-V-Verbraucher.

## Erwartete Topologie

- Vollständiges Backbone: `Batterie+ → Plus-Schiene → Sicherungskasten`,
  `Batterie− → Shunt → Minus-Schiene`.
- Solar → MPPT → Schienen (Domäne `Solar`).
- Booster: **Starterbatterie → Booster → Schienen** (getrennte Starterseite).
- Landstrom → AC-Ladegerät (Domäne `AC_230V`), Landstrom → WR `ac_in`.
- 230-V-Verbraucher am **ersten** Wechselrichter.
- Massepunkt(e) mit **≥ 16 mm²** an Minus-Schiene/Shunt.

**23 Kanten** nach dem Lauf.

## Erwartetes elektrisches Ergebnis (`knownPlans/complex.json`)

- Systemspannung **12,8 V**.
- Ströme und Querschnitte je Kante eingefroren; der Batteriezweig ist der größte
  (Summe aller Verbraucher inkl. WR-Insel).
- Jede Kante trägt eine Domänen-Markierung (Property G6).

## Erwartetes Routing-Verhalten (`npm run routing:audit`)

| Kennzahl                                | Wert                                        |
| --------------------------------------- | ------------------------------------------- |
| Kanten                                  | 23                                          |
| I1 / I2 / I3                            | **0 / 0 / 0**                               |
| I4 / I5 / I6 / I7                       | **0 / 0 / 0**                               |
| Fallback                                | **0**                                       |
| Deterministisch                         | **true**                                    |
| Kreuzungen (Segment-Paare)              | **29**                                      |
| `PathResult.crossings` Summe (je Kante) | 54                                          |
| `usedSearch`                            | 5 × `catalog`, 18 × `astar`, 0 × `fallback` |
| Gesamtlänge / Bends                     | 10 908,8 px / 60                            |

**Was das bedeutet:** Kreuzungen sind hier **strukturell** (vier Bauteil-Spalten, neun
Querleger dazwischen), nicht gierig verursacht. Ein zweiter Routing-Gang über die
kreuzungsreichsten Kanten brachte in Messungen **keine** einzige Kreuzung weniger
(dokumentiert in `components/edges/utils/routeAll.ts`).

## Erwartete Validierung

- AutoWire-Pläne sollen meldungsfrei sein. Bei Landstrom ohne `hasRcd` feuert
  `A2-shore-rcd` (critical) — Vorlagen setzen den FI bewusst nicht automatisch.
- Bei fehlendem `hasRcd` am Wechselrichter: `AC-001-inverter-rcd` (critical).
- `DOM-001-protection-not-modeled` (info) erscheint, wenn eine AC-Leitung nur eine Zahl als
  Sicherung trägt — nach AutoWire ist jedoch ein Default-Schutzorgan gestempelt.

## Performance

- `npm run perf:edge-routing` — Referenzplan N=36/E=134: Median **2,35 ms**, p90 2,43 ms,
  Budget 16 ms/Frame (ADR 0012) → OK.
- `npm run perf:route-scaling` — Probe für große Pläne; „sehr groß“ (N=120/E=585) liegt über
  dem Frame-Budget ([KNOWN-PROBLEMS PERF-001](../KNOWN-PROBLEMS.md#perf-001--große-pläne-überschreiten-das-frame-budget)).

## Relevante Tests

- `scripts/goldenmaster/goldenMaster.test.ts` (`complex`)
- `scripts/routing/finalValidation.test.ts` (`complex`: I1 = 0 hart, I2+I3 ≤ 0)
- `scripts/regression/regression.test.ts` (15 Szenarien inkl. `p02` 10 Verbraucher,
  `p07` AC/DC-Mischung, `p12` Backbone-Kreuzung)
- `benchmarks/routeAllScaling.probe.ts`, `benchmarks/edgeRoutingPerf.bench.ts`
