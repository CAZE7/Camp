# Beispiel: Wechselrichter / DC-AC-Grenze (`inverter`)

Referenzfall für die **Insel-BFS** des Wechselrichters und die Trennung von DC- und AC-Seite.
Zahlen aus `knownPlans/inverter.json` (verifiziert 2026-09-09).

## Input

| Node         | Typ            | Daten                      |
| ------------ | -------------- | -------------------------- |
| `battery-1`  | `battery`      | 200 Ah, LiFePO4            |
| `inverter-1` | `inverter`     | 1000 W (`continuousPower`) |
| `cons-230v`  | `consumer230v` | 600 W                      |
| `cons-light` | `consumer`     | 20 W                       |

Kanten: **keine**.

## Erwartete Topologie

```
battery-1 + ──0,2 m──▶ plus-Schiene ──┬──1 m──▶ inverter-1 +
                                      └──1 m──▶ Sicherungskasten ──3 m──▶ cons-light +
battery-1 − ──0,2 m──▶ smart-shunt ──0,5 m──▶ minus-Schiene ──┬──1 m──▶ inverter-1 −
                                                               └──3 m──▶ cons-light −
inverter-1 + ──2 m (AC_230V)──▶ cons-230v +
```

10 Kanten (`e-auto-1 … e-auto-9`, `e-auto-ac-10`), 8 Knoten.
Der erste Wechselrichter speist **alle** 230-V-Verbraucher; ein zweiter WR würde nicht parallel
auf denselben Kreis gelegt.

## Erwartetes elektrisches Ergebnis

- Systemspannung **12,8 V**.
- DC-Eingangsstrom des WR: `max(1000 W, 600 W) / 11,25 V / 0,85 ≈ 98,04 A`.
- Batteriezweig: **99,71 A** (98,04 A WR + 1,67 A LED) → **70 mm²**, Sicherung **100 A**,
  Bauform **`mrbf`** (Abschaltvermögen für den Bank-Ik ausreichend, ANL wäre die nächstkleinere
  tragende Bauform — die Politik wählt das kleinste _tragende_, bei DC-Spitzenbänken MRBF/Class T).
- LED-Zweig: **1,67 A** → 1,5 mm², 5 A.
- AC-Kante `e-auto-ac-10`: **1,5 mm²**, Sicherung **5 A**, Domäne `AC_230V`,
  Schutzorgan-Default `{kind:'mcb', characteristic:'B', breakingCapacityKA:6}`.
- Kumulierter Spannungsfall: `cons-light` 0,198 V, `inverter-1` 0,083 V (Budget 0,384 V).

> **Bekannte Abweichung:** der Golden Master weist der AC-Kante den **DC-Strom** des WR zu
> (98,04 A), weil er `calculateEdgeCurrent` für alle Kanten nutzt. Siehe
> [KNOWN-PROBLEMS ELE-003](../KNOWN-PROBLEMS.md#ele-003--golden-master-nutzt-für-ac-kanten-die-dc-stromfunktion).
> Anzeige und `sizeAcEdges` benutzen für AC-Kanten `acCurrentA`.

## Erwartetes Routing-Verhalten

- `npm run routing:audit`, Plan `inverter`: **I1–I7 = 0**, Fallback 0, deterministisch,
  **2 Kreuzungen**.
- Die 70-mm²-Backbone-Kanten sind (über `crossSection`) **höherrangig** beim Hopping: ein
  1,5-mm²-Abzweig hüpft, der Trunk bleibt gerade (`HOP_PRIORITY_WEIGHTS.backbone = 1000`).

## Erwartete Validierung

- **Regel `AC-001-inverter-rcd` (critical):** `inverter-1` hat kein `hasRcd`, speist aber einen
  230-V-Verbraucher → eine kritische Warnung ist **erwartet**, bis `hasRcd` gesetzt wird.
  Genau das ist der gewollte Negativfall dieses Beispiels.
- Kein `drop-exceeded`, kein `thermal-overload`, kein `fuse-missing`.
- Wird `hasRcd = true` gesetzt, ist der Plan meldungsfrei.

## Relevante Tests

- `lib/vde-standards.test.ts` (ELE-005: Insel-BFS, Entladeschlussspannung)
- `lib/autoWire/sizing.test.ts` (`sizeAcEdges`, AC-Schutzorgan-Default)
- `components/planner/hooks/useLiveValidation.test.ts` (Regel `AC-001-inverter-rcd`)
- `lib/shortCircuit.test.ts` (Bank-Ik, Bauformwahl)
- `scripts/goldenmaster/goldenMaster.test.ts` (`inverter`)
- `components/planner/ExpertPanel.test.tsx` (Anzeige der WR-Kennzahlen)
