# VALIDATION-CONTEXT

Vier Validierungsebenen mit unterschiedlicher Wirkung:

| Ebene                 | Ort                                                                    | Wirkung                                   | Zeitpunkt                            |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| **Connection**        | `lib/connectionRules.ts`                                               | **blockiert** das Ziehen einer Verbindung | beim Connect/Reconnect               |
| **Electrical (Edge)** | `collectEdgeErrors` in `components/edges/CableEdge.tsx`                | Fehler-Chips **auf der Leitung**          | beim Rendern jeder Kante             |
| **Electrical (Plan)** | `useLiveValidation` in `components/planner/hooks/useLiveValidation.ts` | Warn-Zentrale + Dashboard                 | bei jeder Graph-Änderung (`useMemo`) |
| **Routing**           | `lib/routing/invariants.ts`, `lib/routing/finalValidation.ts`          | Status `VALID`/`INVALID` + Zähler         | nach dem Routing-Pass (und im CI)    |

Alle Meldungen sind **strukturiert**: `ruleId`, `measuredValue`, `expectedValue`, `unit`,
`source` (UX-001). Keine Meldung behauptet eine Norm, die der Code nicht nennt.

---

## 8.1 Connection Validation

`isConnectionAllowed({connection, getNode, viewMode, activeEdges}): boolean`
(`lib/connectionRules.ts`). Der Store delegiert 1:1 (`graphSlice.isValidConnection`).

| Regel            | Bedingung (blockiert, wenn …)                                          | Ergebnis                   | Severity | Test                                             |
| ---------------- | ---------------------------------------------------------------------- | -------------------------- | -------- | ------------------------------------------------ |
| `AC/DC-Trennung` | `getHandleDomain(source) !== getHandleDomain(target)` im Elektromodus  | Verbindung abgelehnt       | block    | `lib/connectionRules.test.ts`                    |
| `Polarität`      | DC-Kreis: `plus → !plus` oder `minus → !minus` (Ausnahme: Solar×Solar) | abgelehnt                  | block    | dto.                                             |
| `Solar-Direkt`   | Solar ↔ Nicht-Solar, Nicht-Laderegler (außer Solar↔Solar)              | abgelehnt                  | block    | dto.                                             |
| `Wasser`         | `grayWaterTank → sink`                                                 | abgelehnt                  | block    | dto.                                             |
| `Duplikat`       | identische `source/target/sourceHandle/targetHandle` existiert         | abgelehnt                  | block    | dto.                                             |
| `Selbstschleife` | `source === target`                                                    | abgelehnt (Guard im Store) | block    | `store/usePlannerStore*.test.ts`, Property-Tests |

Bewusst **kein** generisches Zyklus-Verbot (ADR-artige Begründung im Code): ein Stromkreis ist
topologisch immer ein Zyklus (Plus hin, Minus zurück).

---

## 8.2 Electrical Validation — Kanten-Ebene (`collectEdgeErrors`)

Ort: `components/edges/CableEdge.tsx`. Eingabe: Domäne, `data`, Strom `I`, `maxFuse`,
Querschnitt, `isPlus`, Endpunkt-Typen, Länge, Gesamt-Drop-%, optional `fuseFloor`.
Ausgabe: `EdgeError[]` mit `ruleId`, `severity`, `message`, `measuredValue`, `expectedValue`,
`unit`, `source`.

| Rule ID                  | Zweck                                         | Bedingung                                                                                                  | Severity | Test                                         |
| ------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------- |
| `negative-length`        | unplausible Import-/Altdaten                  | `data.length < 0`                                                                                          | critical | `components/edges/CableEdge.test.tsx`        |
| `thermal-overload`       | Leitung über der eigenen Modell-Belastbarkeit | nicht AC und `I > Ampacity[cs] × 0.7`                                                                      | critical | dto.                                         |
| `drop-exceeded`          | Spannungsfall-Budget                          | Gesamt-Drop > 3 %                                                                                          | critical | `components/edges/utils/voltageDrop.test.ts` |
| `fuse-no-recommendation` | kein Normquerschnitt absicherbar              | `maxFuse === 0`                                                                                            | warning  | `CableEdge.test.tsx`                         |
| `fuse-missing`           | Quellschutz fehlt                             | Plus-Kante von Hochleistungsquelle (Batterie/WR/Solar/Lader) auf Nicht-Sicherung ohne `fuseSize`; nicht AC | critical | dto.                                         |
| `fuse-too-large`         | Sicherung schützt das Kabel nicht             | `fuseSize > maxFuse`                                                                                       | critical | dto.                                         |
| `fuse-below-minimum`     | Sicherung löst im Normalbetrieb aus           | `fuseSize < min(I, fuseFloor)`; Solar: `≥ 1,56 × Isc`                                                      | critical | dto.                                         |
| `main-fuse-distance`     | 20-cm-Regel am Batteriepol                    | DC, Batterie an einem Ende, `length > 0,2 m`, **keine** `fuseSize`                                         | critical | dto.                                         |
| `fuse-offset`            | Sicherung sitzt zu weit vom Pol               | DC, Batterie an einem Ende, `fuseSize` vorhanden, `fuseOffset > 0,2 m`                                     | critical | dto.                                         |

Quellenzeile der 20-cm-Regel: `FUSE_MAX_UNPROTECTED_SOURCE`
(`ISO 10133:2000 §8.1 (200 mm); ABYC E-11 §11.10.1.1.1 (7 in = 178 mm)`).

---

## 8.3 Electrical Validation — Plan-Ebene (`useLiveValidation`)

Ort: `components/planner/hooks/useLiveValidation.ts`. Ausgabe: `ValidationWarning[]` mit
`id`, `category` (`safety|topology|monitoring|estimation`), `type` (`critical|warning|info`),
`title`, `message`, `focusId`, `focusType`, `ruleId`, `measuredValue`, `expectedValue`,
`unit`, `source`. Sortierung über `SEVERITY_ORDER`.

| Rule ID                                          | Zweck                                  | Bedingung                                                                         | Severity | Test                              |
| ------------------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------- | -------- | --------------------------------- |
| `ELE-008-mixed-voltage`                          | Mischspannungsplan                     | > 1 Batterie mit unterschiedlicher Nennspannung                                   | critical | `useLiveValidation.test.ts`       |
| _(keine ID)_ „Sicherung fehlt“ (Regel A)         | Quellschutz                            | Plus-Kante von Batterie/WR/Solar/Lader auf Nicht-Sicherung ohne `fuseSize` (DC)   | critical | dto.                              |
| `ELE-003-reversed-polarity` (A3)                 | verpolte Parallelschaltung             | Batterie×Batterie oder Solar×Solar mit plus↔minus                                 | critical | dto.                              |
| `AUTO-003-parallel-chemistry` (A5)               | parallelschalten inkompatibler Chemien | Batterie×Batterie gleichnamige Pole, `!chemistriesParallelSafe`                   | critical | dto.                              |
| `ELE-007-voc-window` (A6)                        | MPPT-Kalt-Voc-Fenster                  | `Voc(−20 °C)` des Strings > `maxPvVoltage`                                        | critical | dto.                              |
| `ELE-007-voc-missing-data` (A6)                  | Datenlücke                             | Panel-Voc fehlt → Prüfung nicht möglich                                           | info     | dto.                              |
| `AC-001-inverter-rcd`                            | FI am Wechselrichter-Kreis             | WR ohne `hasRcd`, aber ≥ 1 `consumer230v` in seiner AC-Insel                      | critical | dto.                              |
| `A2-shore-rcd`                                   | FI am Landstrom (DIN VDE 0100-721)     | `shorePower` ohne `hasRcd`                                                        | critical | dto.                              |
| `ELE-009-solar-direct` (A4)                      | Solar ohne Laderegler                  | Solar ↔ Nicht-Solar/-Laderegler/-Sicherung/-Leerrohr/-Masse                       | critical | dto.                              |
| _(keine ID)_ „Solarregler zu klein“ (B)          | Auslegung                              | `Σ Solar-W > Σ Laderegler-A × U_sys`                                              | warning  | dto.                              |
| `ELE-005-bms-discharge`                          | BMS-Dauerstrom Entladung               | Batterie-Plus-Ausgang: `I > bmsContinuousDischarge` (> 0)                         | critical | dto.                              |
| `ELE-005-bms-charge`                             | BMS-Dauerstrom Ladung                  | Batterie-Plus-Eingang: `I > bmsContinuousCharge` (> 0)                            | critical | dto.                              |
| `DOM-002-breaking-capacity` (A7)                 | Abschaltvermögen                       | `shortCircuitAtFuseA(...) > breakingCapacityAOf(...)`                             | critical | dto. + `lib/shortCircuit.test.ts` |
| `DOM-002-fuse-type-unknown` (A7)                 | Bewertung unmöglich                    | kein `fuseType`/`fuseBreakingCapacity` und Bank-Ik > ATO-Deckel (einmal pro Plan) | warning  | dto.                              |
| `DOM-001-trip-condition` (A8)                    | AC-Abschaltbedingung                   | `evaluateAcEdgeProtection` → `fail`                                               | critical | dto. + `lib/acProtection.test.ts` |
| `DOM-001-trip-borderline` (A8)                   | Grenzfall Schleifenimpedanz            | `borderline`                                                                      | warning  | dto.                              |
| `DOM-001-trip-rcd-covered` (A8)                  | Fehlerschutz über FI                   | `rcd-covered`                                                                     | info     | dto.                              |
| `DOM-001-protection-not-modeled` (A8)            | Datenlücke AC-Schutzorgan              | Sicherung nur als Zahl (einmal pro Plan)                                          | info     | dto.                              |
| _(keine ID)_ „Batterie könnte knapp werden“ (C)  | Auslegung                              | Σ Tages-Ah > Σ Kapazität                                                          | info     | dto.                              |
| _(keine ID)_ „Wechselrichter: Minus fehlt“ (G)   | Topologie                              | WR ohne Minus-Zuleitung                                                           | warning  | dto.                              |
| _(keine ID)_ „Wechselrichter ohne Sicherung“ (G) | Schutz                                 | WR-Plus-Zuleitung ohne `fuseSize` und Quelle ≠ `fuse`                             | critical | dto.                              |
| _(keine ID)_ „Ladebooster nicht komplett“ (E)    | Topologie                              | DC-DC ohne Ein- oder Ausgang                                                      | warning  | dto.                              |
| _(keine ID)_ „Shunt wird umgangen“ (F)           | Monitoring                             | Minus-Kante einer überwachten Aufbaubatterie auf etwas anderes als Shunt/Batterie | critical | dto.                              |
| `DATA-001-invalid-load-value`                    | Datenintegrität                        | `watts`/`amps` nicht endlich oder < 0                                             | critical | dto.                              |

**Wichtig:** Die Regeln ohne `ruleId` sind historisch gewachsen und tragen nur eine `id`
(z. B. `missing-fuse-<edgeId>`). Bei Neu- oder Umbauten **immer** `ruleId` setzen.

**Bewusste Lücke:** Landstrom-Knoten werden **nie** automatisch als RCD-geschützt markiert —
ein gesetzter FI würde einen fehlenden FI verschleiern.

---

## 8.4 Routing Validation

Ort: `lib/routing/invariants.ts` (Checker I1–I7) und `lib/routing/finalValidation.ts`
(binäres Gate). Siehe [ROUTING-CONTEXT.md §4.5](./ROUTING-CONTEXT.md#45-routing-invarianten).

| Rule      | Bedingung                                                 | Ergebnis  | Severity             | Test                                                      |
| --------- | --------------------------------------------------------- | --------- | -------------------- | --------------------------------------------------------- |
| `I1`      | Segment schneidet fremde Bauteil-Box                      | `INVALID` | blockierend (hart 0) | `scripts/routing/finalValidation.test.ts`                 |
| `I2`      | kollineare Überdeckung außerhalb der Port-Bündel-Ausnahme | `INVALID` | Ratchet              | dto.                                                      |
| `I3`      | Abstand < `cableClearance`                                | `INVALID` | Ratchet              | dto.                                                      |
| `I4`–`I7` | Kehre am Handle, Stub, Segmentlänge, Treppen              | Zähler    | Metrik               | `npm run routing:audit`, `lib/routing/invariants.test.ts` |
| `I9`      | Doppellauf nicht byte-identisch                           | —         | blockierend          | `goldenMaster.test.ts`, `regression.test.ts`              |
| `I10`     | Kreuzungen zunehmend                                      | —         | blockierend (Δ ≤ 0)  | `regression.test.ts`                                      |

**Ratchet-Regel:** `finalValidation.test.ts` hält Obergrenzen je Plan (derzeit **0** für
I2+I3; I1 immer hart 0). Zahlen dürfen **sinkem**, nie steigen. Eine Anhebung ist nur mit
messbar besserem Gesamtplan und Begründung zulässig — niemals, um CI grün zu bekommen.

**Live-Sicht:** `routePlan()` (`components/edges/utils/routeAll.ts`) validiert die tatsächlich
zurückgegebenen Waypoints und liefert den Report gemeinsam mit den Routen. Der Store
veröffentlicht genau diesen Report an `components/planner/ui/RoutingStatusBadge.tsx`.
`computeCableRouteFinalValidation` bleibt als reine Test-/Kompatibilitätshilfe vorhanden;
der Report läuft **nicht** im Render-Pfad pro Frame, sondern gedrosselt (100 ms) — die Prüfung
ist O(E²).

---

## 8.5 Protection Validation (Kurzschluss / AC)

| Regel                     | Ort                                 | Bedingung                                                                                      | Severity              | Test                                                    |
| ------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------- |
| Abschaltvermögen (DC)     | `lib/shortCircuit.ts` + Regel A7    | `Ik(Fuse) > Abschaltvermögen`                                                                  | critical              | `lib/shortCircuit.test.ts`, `useLiveValidation.test.ts` |
| Bank-Ik-Schätzung         | `bankShortCircuitCurrentA`          | Bank modelliert als reine Parallelschaltung; **Serien-Strings nicht modelliert** (konservativ) | —                     | dto.                                                    |
| MRBF-Spannungsband        | `MRBF_BREAKING_CAPACITY_BY_VOLTAGE` | 10/5/2 kA bei ≤16/≤32/≤58 V; > 58 V → `null` (ehrlich unbewertbar)                             | —                     | dto.                                                    |
| AC-Schleifenimpedanz      | `lib/acProtection.ts` + Regel A8    | `Zs · Ia ≤ U0` mit 2/3-Regel; `UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0,8 Ω` (**UNVERIFIED**)     | critical/warning/info | `lib/acProtection.test.ts`                              |
| AC-Inverter-Ausgang       | `acSourceKindOf` → `inverter`       | elektronisch begrenzt → `inverter-limited`, **kein** TN-Modell                                 | —                     | dto.                                                    |
| AC ohne Schutzorgan-Daten | `not-modeled`                       | Sicherung nur als Zahl                                                                         | info                  | dto.                                                    |

**Grundsatz:** Wo Daten fehlen, meldet die Validierung „nicht bewertbar“ — sie **rät nicht**.
Beispiele: ohne `fuseType` kein Abschaltvermögens-Urteil; ohne Panel-Voc keine
Kalt-Voc-Prüfung; ohne `acProtection` keine Abschaltbedingung.

---

## 8.6 Reihenfolge der Severities

`SEVERITY_ORDER`: `critical (0) < warning (1) < info (2)`.
`category` ist orthogonal: `safety | topology | monitoring | estimation`.

**Eskalationsregel für Entwickler:** Eine neue `critical`-Regel ist ein Versprechen. Sie muss
(1) eine benannte Quelle im `source`-Feld tragen, (2) einen Test mit Negativfall haben und
(3) im auto-verdrahteten Referenzplan **nicht** aus Versehen feuern.
Gegenprobe: `npm run goldenmaster:capture` → `npm run test:goldenmaster`.
Für den „meldungsfreien AutoWire-Plan“ gibt es zwei echte Helfer in
`store/usePlannerStoreExtended.test.ts`:
`assertZeroWarnings()` (Live-Validierung **und** `collectEdgeErrors` müssen `[]` sein) und
`assertNoSafetyWarnings()` (nur Meldungen der Kategorie `estimation` sind erlaubt).
Sie laufen dort über Handpläne und über `TEMPLATE_MINIMALIST`, **nicht** über alle sechs
`knownPlans`. `scripts/routing/audit.ts` misst nur Routing (I1–I7), keine
Validierungsregeln.
