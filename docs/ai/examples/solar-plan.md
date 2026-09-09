# Beispiel: Solar-Ladekreis (`solar`)

Referenzfall für die **Solar-Domäne**: eigene Spannungsfall-Basis, Isc-basierte Dimensionierung,
MPPT-Fensterprüfung. Zahlen aus `knownPlans/solar.json` (verifiziert 2026-09-09).

## Input

| Node          | Typ              | Daten                       |
| ------------- | ---------------- | --------------------------- |
| `solar-1`     | `solar`          | 200 W                       |
| `mppt-1`      | `mpptController` | 20 A                        |
| `battery-1`   | `battery`        | 100 Ah, LiFePO4             |
| `cons-fridge` | `consumer`       | Kompressorkühlschrank, 60 W |

Kanten: **keine**.

## Erwartete Topologie

```
solar-1 ± ──5 m (Solar)──▶ mppt-1 ±
mppt-1 ± ──2 m──▶ plus-/minus-Schiene
battery-1 + ──0,2 m──▶ plus-Schiene ──1 m──▶ Sicherungskasten ──3 m──▶ cons-fridge +
battery-1 − ──0,2 m──▶ smart-shunt ──0,5 m──▶ minus-Schiene ──3 m──▶ cons-fridge −
```

11 Kanten, 8 Knoten (Schiene, Shunt und Sicherungskasten werden ergänzt; der vorhandene MPPT
wird **wiederverwendet**).

## Erwartetes elektrisches Ergebnis

- Systemspannung **12,8 V** (LiFePO4).
- Solar-Zuleitung: `Imp = 200 W / 18 V = 11,11 A`; ohne Datenblatt `Isc ≈ 1,25 × Imp`;
  Designstrom **1,25 × Isc**; Sicherungs-Untergrenze **1,5625 × Isc**.
- Ergebnis im Fixture: Solar-Kanten `e-auto-8/9` **10 mm²**, Sicherung **25 A**,
  Domäne **`Solar`**, Länge 5 m.
- MPPT-Ausgang: **20 A** → 6 mm², Sicherung 20 A.
- Batteriezweig: **20 A** → 4 mm², Sicherung 20 A.
- Verbraucher: **5 A** → Plus 6 mm² (wegen 3 m Länge und Drop-Budget), Minus 2,5 mm², 5 A.
- Kumulierter Spannungsfall `cons-fridge` **0,379 V** (Budget 3 % von 12,8 V = 0,384 V).
- Solar-Kanten werden an der **MPP-Basis 18 V** bemessen, nicht an 12,8 V.

## Erwartetes Routing-Verhalten

- `npm run routing:audit`, Plan `solar`: **I1–I7 = 0**, Fallback 0, deterministisch,
  **2 Kreuzungen**.
- Die beiden Solar-Kanten (plus/minus) teilen denselben Port → sie laufen als **Bündel**
  (dokumentierte Port-Bündel-Ausnahme zu I2) und trennen sich am Lane-Punkt.

## Erwartete Validierung

- Keine `ELE-009-solar-direct`-Warnung (Solar → MPPT ist zulässig).
- **MPPT-Fenster (Regel A6):** Ohne `data.voc` am Panel und ohne `data.maxPvVoltage` am Regler
  wird die Prüfung **nicht** durchgeführt; stattdessen erscheint (nur wenn `maxPvVoltage > 0`
  gepflegt ist) der Hinweis `ELE-007-voc-missing-data` (`info`).
  → Für den Negativfall `voc`/`isc`/`maxPvVoltage` pflegen und `ELE-007-voc-window` erwarten.
- „Solarregler zu klein“ (Regel B) feuert hier nicht: 200 W ≤ 20 A × 12,8 V = 256 W.

## Relevante Tests

- `lib/solar.test.ts` (Isc/Vmp, Kalt-Voc, String-Erkennung, Fuse-Floor)
- `components/planner/hooks/useLiveValidation.test.ts` (Regel A6, Regel B)
- `lib/autoWire/sizing.test.ts` (Solar-Sonderfaktoren, 18-V-Basis)
- `scripts/goldenmaster/goldenMaster.test.ts` (`solar`)
- `lib/vde-properties.test.ts` (G6: Domänen-Stempel, jede Kante dimensioniert)
