# `lib/` — Domäne (Electrical, Domain, Units)

## What is this?

Der fachliche Kern von CAMP: **alle** elektrischen Berechnungen, das Einheitensystem, das
Domänenmodell und die Verbindungsregeln. Diese Ebene läuft ohne React, ohne DOM und ohne
React-Flow-Runtime — sie wird von der UI, vom Store, von Skripten und vom Golden Master
benutzt.

Wichtig: dieses Verzeichnis enthält **kein** Routing (→ `lib/routing/README.md`) und **kein**
AutoWire (→ `lib/autoWire/README.md`).

```
lib/units.ts            Branded Types (Watts/Amps/Volts/Mm2/Meters/Ohms) + Physik-Operationen
lib/electrical.ts       thermische VDE-Basis: Normreihe, Ampacity, Derating, FUSE_MAP,
                        Querschnittsauswahl, Domänenzuordnung (getEdgeDomain/getHandleDomain)
lib/vde-standards.ts    zentrale VDE-API: Systemspannung, Kantenströme, Leerrohr, Solar-/WR-Werte
lib/solar.ts            Isc/Vmp, Kalt-Voc, Strings, Solar-Spannungsfallbasis (18 V)
lib/shortCircuit.ts     Batterie-Innenwiderstand, Bank-Ik, Abschaltvermögen je Bauform
lib/acProtection.ts     230-V-Mehrleitermodell, LS-Kennwerte, Abschaltbedingung
lib/peukert.ts          Peukert-Kapazitätsfaktor
lib/connectionRules.ts  „darf diese Verbindung gezogen werden?“ (pure Funktion)
lib/nodeSchema.ts       deklaratives Laufzeit-Schema für node.data
lib/domain/graph.ts     PlannerNode/PlannerEdge/PlannerConnection (ohne React-Flow)
lib/domain/cableEdgeData.ts  Datenform einer elektrischen Kante
lib/id.ts               kollisionsarme IDs ohne Secure-Context
```

## What is the public API?

| Symbol                                                                                                         | Datei                | Zweck                                   |
| -------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------- |
| `watts/amps/volts/mm2/meters/ohms/millivolts`                                                                  | `units.ts`           | geprüfte Konstruktoren (**werfen**)     |
| `parseQuantity`, `quantityOr`, `toNumber`, `toFixedNumber`                                                     | `units.ts`           | Grenze zur Außenwelt (JSON/`node.data`) |
| `power`, `currentFromPower`, `voltageDrop`, `crossSectionForVoltageDrop`, `conductorResistance`, `dropPercent` | `units.ts`           | benannte Physik                         |
| `PX_PER_METER`                                                                                                 | `units.ts`           | **einzige** px↔m-Quelle (= 100)         |
| `getSystemVoltage`, `dischargeFloorVoltage`                                                                    | `vde-standards.ts`   | Spannungsebene                          |
| `calculateEdgeCurrent`                                                                                         | `vde-standards.ts`   | **einzige** Stromquelle für DC          |
| `calculateAcEdgeCurrent`                                                                                       | `vde-standards.ts`   | AC-Strom über Insel-BFS                 |
| `VDE_SIZES`, `VDE_AMPACITY`, `DERATE_FACTOR`, `FUSE_MAP`                                                       | `electrical.ts`      | Normtabellen                            |
| `calculateCrossSection`, `lookupThermalCrossSection`                                                           | `electrical.ts`      | Querschnitt                             |
| `selectFuseSize`, `calculateMaxFuse`, `maxFuseForDisplay`, `isFuseFeasible`                                    | `electrical.ts`      | Sicherung                               |
| `getEdgeDomain`, `getHandleDomain`                                                                             | `electrical.ts`      | Domänenzuordnung (**eine** Quelle)      |
| `FUSE_MAX_UNPROTECTED_LENGTH_M`                                                                                | `electrical.ts`      | 20-cm-Regel (ISO 10133:2000 §8.1)       |
| `calculateConduitFillPercent`, `recommendConduitType`                                                          | `vde-standards.ts`   | Leerrohr (40 %)                         |
| `solarDesignCurrentOf`, `solarFuseFloorOf`, `solarColdVocOf`, `stringColdVocOf`                                | `solar.ts`           | Solar-Kennwerte                         |
| `bankShortCircuitCurrentA`, `shortCircuitAtFuseA`, `breakingCapacityAOf`                                       | `shortCircuit.ts`    | Kurzschluss/Abschaltvermögen            |
| `evaluateAcEdgeProtection`, `acCableComposition`, `protectiveEarthCrossSectionMm2`                             | `acProtection.ts`    | AC-Schutz                               |
| `isConnectionAllowed`                                                                                          | `connectionRules.ts` | Verbindungsregeln                       |
| `sanitizeNodeDataBySchema`, `NODE_DATA_SCHEMA`                                                                 | `nodeSchema.ts`      | Feld-Schema                             |

## What does it own?

- **Die eine Stromquelle** (`calculateEdgeCurrent`) — AutoWire, Anzeige und Validierung müssen
  denselben Wert sehen; `lib/vde-consistency.test.ts` sichert das ab.
- **Die eine Domänenzuordnung** (`getEdgeDomain`/`getHandleDomain`).
- **Die eine Iz-Wahrheit**: Sizing und Sicherungsgrenze nutzen denselben `DERATE_FACTOR`,
  damit `I_B ≤ I_n ≤ I_z` durch Konstruktion gilt.
- **Die eine px↔m-Umrechnung** (`PX_PER_METER`).

## What must not happen here?

1. **Kein Import aus `components/`, `store/`, `app/`, `benchmarks/`** (Rule A;
   Test: `scripts/architecture/libBoundary.test.ts`).
2. **Keine React-Flow-Typen** — strukturell kompatible Ersatztypen in `lib/domain/graph.ts`.
3. **Kein stiller Fallback.** Konstruktoren werfen; fehlende Daten führen zu „nicht bewertbar“,
   nicht zu 0 oder „passt schon“ (Rule M).
4. **Keine erfundene Norm.** Steht im Code `UNVERIFIED` oder „Modellannahme“, bleibt das so.
   Keine VDE-Klausel behaupten, die nicht im Kommentar steht.
5. **Keine UI-Formatierung** — Texte, Farben und Chips gehören in `components/`.
6. **Kein Routing/keine Geometrie** in diesen Modulen (außer `PX_PER_METER` als Maßstab).

## Which tests protect it?

| Datei                                                  | Schutz                                           |
| ------------------------------------------------------ | ------------------------------------------------ |
| `lib/units.test.ts`, `lib/units.typecheck.test.ts`     | Konstruktor-Grenzen, Operationen, Typ-Ebene      |
| `lib/electrical.test.ts`                               | Normreihe, Ampacity, FUSE_MAP, Sicherungsauswahl |
| `lib/vde-standards.test.ts`                            | Systemspannung, Kantenströme, Leerrohr, AC       |
| `lib/vde-properties.test.ts`                           | Property-Gesetze **G1–G7** (fast-check)          |
| `lib/vde-consistency.test.ts`                          | AutoWire/Anzeige/Validierung rechnen gleich      |
| `lib/solar.test.ts`, `lib/peukert.test.ts`             | Solar- und Batteriemodell                        |
| `lib/shortCircuit.test.ts`, `lib/acProtection.test.ts` | Schutzmodelle                                    |
| `lib/connectionRules.test.ts`                          | Blockier-Fälle                                   |
| `lib/nodeSchema.test.ts`, `lib/id.test.ts`             | Schema, IDs                                      |
| `scripts/architecture/libBoundary.test.ts`             | Schichtengrenze                                  |

**Coverage-Gate:** `lib/**` muss ≥ 90 % Zeilen / 85 % Branches / 90 % Funktionen / 95 %
Statements erreichen (`vitest.config.ts`). `lib/planner/**` ist bewusst ausgenommen.

Weitere Details: [`docs/ai/ELECTRICAL-CONTEXT.md`](../docs/ai/ELECTRICAL-CONTEXT.md).
