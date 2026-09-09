# Beispiel: einfacher DC-Plan (`simple`)

Referenzfall für die kleinste sinnvolleAutoWire-Verdrahtung. Alle Zahlen stammen aus
`knownPlans/simple.json` (Golden Master, verifiziert 2026-09-09).

## Input

`scripts/goldenmaster/plans.ts` → `SIMPLE`:

| Node         | Typ        | Position | Daten                         |
| ------------ | ---------- | -------- | ----------------------------- |
| `battery-1`  | `battery`  | 80/160   | 12V Batterie, 100 Ah, **AGM** |
| `fusebox-1`  | `fuse`     | 380/160  | Sicherungskasten              |
| `cons-light` | `consumer` | 680/80   | LED-Beleuchtung, 20 W         |
| `cons-pump`  | `consumer` | 680/280  | Wasserpumpe, 40 W             |

Kanten: **keine**.

## Erwartete Topologie

AutoWire ergänzt Plus-Schiene, Minus-Schiene und Smart Shunt:

```
battery-1 + ──0,2 m──▶ auto:0:plus-schiene ──1 m──▶ fusebox-1 ──3 m──▶ cons-light +
battery-1 − ──0,2 m──▶ auto:2:smart-shunt ──0,5 m─▶ auto:1:minus-schiene ──┬─1 m──▶ fusebox-1 −
                                                                            └─3 m──▶ cons-light − / cons-pump −
fusebox-1 + ──3 m──▶ cons-pump +
```

9 Kanten (`e-auto-1 … e-auto-9`), 7 Knoten.

## Erwartetes elektrisches Ergebnis

- Systemspannung **12,0 V** (AGM → `LEAD_SYSTEM_VOLTAGE`).
- Ströme: Batteriezweig **5,33 A**; LED **1,78 A**; Pumpe **3,56 A**.
  (`I = P / Entladeschlussspannung`, Entladeschlussspannung = 12,0 × 0,9375 = 11,25 V)
- Querschnitte: alle Haupt- und LED-Kanten **1,5 mm²**; Pumpe **2,5 mm²**.
- Sicherungen: `e-auto-1` und `e-auto-4` **7,5 A**; LED und Pumpe **5 A**;
  Minus-Kanten tragen **keine** Sicherung (nur Plus-Kanten werden abgesichert).
- Kumulierter Spannungsfall: `cons-light` **0,331 V**, `cons-pump` **0,356 V**
  (Budget 3 % von 12,0 V = 0,36 V → `cons-pump` liegt praktisch am Limit).
- Domäne: alle Kanten `DC_12V`.

## Erwartetes Routing-Verhalten

- `npm run routing:audit`, Plan `simple`: **I1–I7 = 0**, Fallback 0, deterministisch,
  **2 Kreuzungen** (Segment-Paare).
- Plus- und Minus-Kanten desselben Verbrauchers laufen über verschiedene Schienen und
  werden am Port über den Fan-Out getrennt (Lane ±16 px je Bündel).

## Erwartete Validierung

- **Keine** kritische Warnung (kein Landstrom → keine RCD-Regel; keine Solar-Kante;
  Sicherungen vorhanden; kein verpoltes Paar).
- `collectEdgeErrors`: leer — insbesondere kein `fuse-missing`
  (Quellkanten von `battery-1` und `fusebox-1` sind abgesichert) und kein `drop-exceeded`
  (0,356 V < 0,36 V).

## Relevante Tests

- `scripts/goldenmaster/goldenMaster.test.ts` (`simple`: Baseline + Determinismus)
- `scripts/routing/finalValidation.test.ts` (`simple`: I1 = 0 hart, I2+I3 ≤ 0)
- `lib/autoWire.test.ts` (Topologie, Shunt-Pflicht, Idempotenz)
- `lib/vde-properties.test.ts` (G1 Sandwich, G4 Normreihe, G6 Domänen-Stempel)
- `components/edges/CableEdge.test.tsx` (`collectEdgeErrors`)
