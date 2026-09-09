# Beispiel: ungültiger Plan

Welche Fehler das System **erkennt**, wie es sie meldet, und wo es bewusst **schweigt**.
Severity/Regel-IDs nach [VALIDATION-CONTEXT.md](../VALIDATION-CONTEXT.md).

---

## 1. Wird beim **Ziehen blockiert** (`lib/connectionRules.ts`)

| Konstruktion                        | Ergebnis                                   |
| ----------------------------------- | ------------------------------------------ |
| `battery.plus → consumer.minus`     | abgelehnt (Polarität, DC)                  |
| `shorePower.plus → consumer.plus`   | abgelehnt (AC/DC-Trennung)                 |
| `solar.plus → battery.plus`         | abgelehnt (Solar nur an Solar/Laderegler)  |
| dieselbe Verbindung ein zweites Mal | abgelehnt (Duplikat)                       |
| `battery → battery`                 | abgelehnt (Selbstschleife, Guard im Store) |
| `grayWaterTank.out → sink.in`       | abgelehnt (Wasserregel)                    |

**Nicht** blockiert: ein Zyklus (Plus hin, Minus zurück ist ein legitimer Stromkreis).

---

## 2. Wird als **Fehler auf der Leitung** gemeldet (`collectEdgeErrors`)

| Konstruktion                                         | ruleId                   | severity | Meldung                                            |
| ---------------------------------------------------- | ------------------------ | -------- | -------------------------------------------------- |
| Sicherung 30 A auf 1,5 mm²                           | `fuse-too-large`         | critical | „Sicherung zu groß!“ (Grenze 10 A)                 |
| Leitung 25 A auf 1,5 mm²                             | `thermal-overload`       | critical | „Leitung thermisch überlastet (25A > 12A)!“        |
| Gesamt-Drop 4,1 %                                    | `drop-exceeded`          | critical | „Gesamt-Drop! (4.1% > 3%)“                         |
| Batterie → Verbraucher, 1,5 m, ohne Sicherung        | `main-fuse-distance`     | critical | „Hauptsicherung nach Batterie max 20cm!“           |
| `fuseOffset = 1,2 m` mit Sicherung                   | `fuse-offset`            | critical | „Sicherung sitzt 1.2m vom Batteriepol (max 0.2m)!“ |
| `data.length = −3`                                   | `negative-length`        | critical | „Ungültige (negative) Länge!“                      |
| Solar-Zuleitung, Sicherung < 1,56 × Isc              | `fuse-below-minimum`     | critical | „Sicherung zu klein (Solar: ≥ 1,56 × Isc = …A)!“   |
| Querschnitt so klein, dass keine Normsicherung passt | `fuse-no-recommendation` | warning  | „Keine Empfehlung möglich / Querschnitt prüfen“    |

---

## 3. Wird in der **Warn-Zentrale** gemeldet (`useLiveValidation`)

| Konstruktion                                 | ruleId                             | severity |
| -------------------------------------------- | ---------------------------------- | -------- |
| Landstrom ohne `hasRcd`                      | `A2-shore-rcd`                     | critical |
| WR speist 230-V-Verbraucher ohne `hasRcd`    | `AC-001-inverter-rcd`              | critical |
| Zwei Batterien plus↔minus                    | `ELE-003-reversed-polarity`        | critical |
| AGM parallel zu Gel                          | `AUTO-003-parallel-chemistry`      | critical |
| Panel-Kalt-Voc 120 V, MPPT max 100 V         | `ELE-007-voc-window`               | critical |
| Solar direkt an Verbraucher (Nutzerkante)    | `ELE-009-solar-direct`             | critical |
| Batterien mit 12 V **und** 24 V              | `ELE-008-mixed-voltage`            | critical |
| Batterie-Hauptleitung 90 A, BMS 50 A         | `ELE-005-bms-discharge`            | critical |
| Ik 6 kA, Sicherung ATO (1 kA)                | `DOM-002-breaking-capacity`        | critical |
| AC-Leitung zu lang für die Abschaltbedingung | `DOM-001-trip-condition`           | critical |
| Minus-Kante am Shunt vorbei                  | _(keine ID)_ „Shunt wird umgangen“ | critical |
| WR ohne Minus-Zuleitung                      | _(keine ID)_                       | warning  |
| Booster ohne Ein- oder Ausgang               | _(keine ID)_                       | warning  |
| `watts: 'viel'`                              | `DATA-001-invalid-load-value`      | critical |

---

## 4. Bewusst **nicht** gemeldet (kein Fehler, sondern offene Daten)

| Situation                                                 | Verhalten                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Panel ohne `voc`, Regler ohne `maxPvVoltage`              | keine Kalt-Voc-Prüfung; nur wenn `maxPvVoltage > 0` gepflegt ist → `ELE-007-voc-missing-data` (info) |
| Sicherung ohne `fuseType` und ohne `fuseBreakingCapacity` | `DOM-002-fuse-type-unknown` (**warning**, einmal pro Plan) — kein Urteil „passt“                     |
| AC-Leitung mit Sicherung als bloße Zahl                   | `DOM-001-protection-not-modeled` (info)                                                              |
| Batteriebank ohne schätzbaren Innenwiderstand             | **keine** Bauform, **keine** Warnung — „ehrlich schweigen“                                           |
| WR-Ausgang (elektronisch begrenzt)                        | `inverter-limited`, kein TN-Urteil, keine Meldung                                                    |

**Merksatz:** Fehlende Daten erzeugen **Hinweise**, keine Freigaben.

---

## 5. Verhalten korrupter/alter Plandaten

| Feldzustand                      | Ort                           | Verhalten                                                                                                                                    |
| -------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `node.position = null`           | `store/slices/persistence.ts` | Knoten wird beim Laden **verworfen** (kein NaN im Rendering)                                                                                 |
| `node.data.watts = 'viel'`       | `lib/nodeSchema.ts`           | Feld wird **entfernt** (nicht durch 0 ersetzt)                                                                                               |
| unbekanntes Feld in `node.data`  | dto.                          | **bleibt erhalten** (Forward-Kompatibilität)                                                                                                 |
| `edge.data.crossSection = '2,5'` | `sanitizeEdgeData`            | **bleibt stehen** — kein Schema für Kantendaten ([DOM-004](../KNOWN-PROBLEMS.md#dom-004--kantendaten-werden-beim-laden-nicht-schemageprüft)) |
| `edge.data.length < 0`           | `collectEdgeErrors`           | `negative-length` (critical)                                                                                                                 |
| AC-Kante mit 95 mm²              | `sizeAcEdges`                 | Querschnitt bleibt, Sicherung auf 70-mm²-Höchstwert, `fuseWarning`                                                                           |

---

## 6. Was bei AutoWire **nicht** passiert

| Erwartung                                         | Wirklichkeit                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| „AutoWire legt inkompatible Akkus parallel.“      | Nein — nur bei gleicher Spannung **und** parallelsicherer Chemie; sonst **keine** Verbindung |
| „AutoWire setzt den FI am Landstrom.“             | Nein — bewusst nicht (würde einen fehlenden FI verschleiern)                                 |
| „AutoWire verkleinert meinen 95-mm²-Querschnitt.“ | Nein — „nie verkleinern“ ist hart                                                            |
| „AutoWire crasht bei 0 m Länge.“                  | Nein — `crossSectionForDrop` liefert 1,5 mm²                                                 |
| „AutoWire verdrahtet ohne Batterie.“              | Nein — `performAutoWiring` gibt `null` zurück, der Store zeigt einen Hinweis                 |

---

## Relevante Tests

- `components/edges/CableEdge.test.tsx` — alle `collectEdgeErrors`-Regeln
- `components/planner/hooks/useLiveValidation.test.ts` (773 Zeilen) — alle Plan-Regeln
- `lib/connectionRules.test.ts` — Blockier-Fälle
- `store/slices/persistence.test.ts`, `lib/nodeSchema.test.ts` — Datenheilung
- `lib/autoWire.test.ts` — „wirft nie“-Regressionen (95/0/NaN/3 mm², Länge 0)
- `lib/vde-properties.test.ts` — G1/G6/G7 plus dokumentierte Grenzfälle
