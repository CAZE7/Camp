# ELECTRICAL-CONTEXT

Alle elektrischen Größen, ihre Einheit, ihre Quelle im Code, ihre Berechnung und die Tests, die
sie absichern. **Autorität ist der Code** — dieses Dokument zitiert ihn nur.

Warnung vorab: CAMP ist ein **Planungswerkzeug**, kein Nachweis einer normgerechten Auslegung.
Mehrere Werte sind bewusst **Modellannahmen** und im Quellkommentar so markiert. Kein Wert
ohne Quelle „erfinden“: steht im Code `UNVERIFIED`, darf die Dokumentation ihn nicht härten.

---

## 5.1 Einheitensystem (`lib/units.ts`)

Branded Types: `Watts`, `Amps`, `Volts`, `Mm2`, `Meters`, `Millivolts`, `Ohms`, `Scalar`.

- Zur Laufzeit `number` (JSON-kompatibel, keine Allokation).
- Konstruktoren `watts()`, `amps()`, `volts()`, `mm2()`, `meters()`, `millivolts()`, `ohms()`
  prüfen und **werfen** (`RangeError` / `TypeError`) — kein stiller Fallback (Rule M).
- Grenzen: `Watts/Amps/Volts/Meters/Millivolts/Ohms ≥ 0`, `Mm2 > 0`.
- Lesen aus `node.data`/JSON: `parseQuantity(input, parser) → Q | null`,
  `quantityOr(input, parser, fallback) → Q`.
- Operationen: `power`, `currentFromPower`, `voltageFromPower`, `voltageFromResistance`,
  `conductorResistance`, `voltageDrop`, `crossSectionForVoltageDrop`, `dropFraction`,
  `dropPercent`, `add/sum/scale/divide/max/min` je Einheit.
- `PX_PER_METER = 100` — **einzige** Quelle der Umrechnung px ↔ m
  (AutoWire-Längenschätzung, Kantenlängenanzeige, Spannungsfall-Hinweis).

Tests: `lib/units.test.ts`, `lib/units.typecheck.test.ts`.

---

## 5.2 Die Größen

### Voltage

| Aspekt                      | Wert / Funktion                                          | Datei                  |
| --------------------------- | -------------------------------------------------------- | ---------------------- |
| Systemspannung              | `getSystemVoltage(nodes, preferredBatteryId?)` → `Volts` | `lib/vde-standards.ts` |
| Default (LiFePO4/unbekannt) | `DEFAULT_SYSTEM_VOLTAGE = 12.8 V`                        | `lib/vde-standards.ts` |
| Blei-Familie (AGM/Gel/Blei) | `LEAD_SYSTEM_VOLTAGE = 12.0 V`                           | `lib/vde-standards.ts` |
| 230-V-Ebene                 | `AC_SYSTEM_VOLTAGE = 230 V`                              | `lib/vde-standards.ts` |
| Solar-Bezug (Spannungsfall) | `VDE_SOLAR_VMP_VOLTAGE = 18 V`                           | `lib/vde-standards.ts` |
| Entladeschlussspannung      | `dischargeFloorVoltage(nominal) = nominal × 0.9375`      | `lib/vde-standards.ts` |

**Berechnung der Systemspannung (Reihenfolge ist Semantik):**

1. Aufbaubatterie vor Starterbatterie (`isStarterBatteryNode`: `data.role` > Label `/start/i`).
2. Explizites `data.nominalVoltage` (geprüft gelesen, > 0).
3. Chemie: AGM/Gel/Blei → 12,0 V; sonst 12,8 V.
4. Kein Akku im Plan → 12,8 V.

**Warum die Entladeschlussspannung:** alle leistungsabhängigen DC-Ströme werden mit
`dischargeFloorVoltage` gerechnet, weil der Strom bei leerem Akku am **höchsten** ist
(12,8 V → 12,0 V ≈ +6,7 %). Modellannahme 3,0 V/Zelle LiFePO4 — **keine** Normkopie.

Tests: `lib/vde-standards.test.ts`, `lib/vde-properties.test.ts` (Abschnitt „Systemspannung“),
`components/planner/utils/voltage.test.ts`.

### Current

**Einzige Stromquelle für Dimensionierung, Anzeige und Validierung:**
`calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage?, edges?) → Amps`
(`lib/vde-standards.ts`). Prioritäten:

1. `data.totalAmps` (explizit gesetzt) — unparsebarer Wert zählt **nicht** als 0 A.
2. Solar-Kante: `watts / 18 V`.
3. `consumer`: `watts / Entladeschlussspannung`.
4. `inverter` (DC-Seite): `max(continuousPower ?? watts, 230-V-Last der eigenen AC-Insel) / Entladeschlussspannung / 0,85`.
   Die Insel wird per **BFS über AC-Kanten** bestimmt, wenn `edges` übergeben wird; ohne
   Kantenliste bleibt die globale Summe als konservativer Over-Schätzer (ELE-005).
5. `data.amps` (Laderegler, Booster, AC-Ladegerät).
6. Fallback: `max(Σ Verbraucherströme, Σ Ladeströme)`.

AC-Seite: `calculateAcEdgeCurrent(sourceId, nodes, edges)` und
`acCurrentA(sourceNode, targetNode, nodes, edges)` (`lib/autoWire/sizing.ts`) — BFS über die
AC-Insel ab Quelle, ungerichtet.

Tests: `lib/vde-standards.test.ts`, `lib/vde-consistency.test.ts`.

### Power

- `power(U, I) = U · I`, `currentFromPower(P, U) = P / U` (wirft bei U = 0).
- Verbraucher: `watts` + `hours` (Default 4 h/Tag) → Tages-Ah.
- Wechselrichter: `continuousPower` (Dauerleistung) hat Vorrang vor `watts`;
  Wirkungsgrad `VDE_INVERTER_EFFICIENCY = 0.85`.
- Solar: `VDE_SOLAR_WINTER_REDUCTION = 0.35` (Winterertrag), Lade-Derating `1.15`.
- Batterie: `VDE_BATTERY_DOD = { LiFePO4: 0.9, AGM: 0.5, Gel: 0.5, Blei: 0.3 }`,
  Referenz `VDE_DOD_REFERENCE = 0.9`.

### Resistance

- `conductorResistance(length, crossSection, resistivity) = ρ · L / A` (`lib/units.ts`).
- Zwei Darstellungen derselben Physik, **bewusst getrennt**:
  - Leitfähigkeit `COPPER_CONDUCTIVITY = 58 m/(Ω·mm²)` —
    `lib/autoWire/primitives.ts`, `components/edges/utils/voltageDrop.ts`, `lib/shortCircuit.ts`.
  - Resistivität `COPPER_RESISTIVITY_OHM_MM2_PER_M = 0.0175 Ω·mm²/m` — `lib/acProtection.ts`
    (230-V-Schleifenimpedanz).
    Vor einer Vereinheitlichung prüfen, ob 1/58 ≈ 0,01724 ausreicht.

### Spannungsfall (Voltage Drop)

- Formel: `ΔU = I · 2L / (κ · A)` mit κ = 58 → `voltageDrop()` in `lib/units.ts`,
  `edgeVoltageDrop()` in `lib/autoWire/primitives.ts`.
- Umkehrung: `crossSectionForVoltageDrop` / `crossSectionForDrop`.
- Budgets:
  | Ebene                        | Wert                                  | Quelle                                     |
  | ---------------------------- | ------------------------------------- | ------------------------------------------ |
  | DC gesamt                    | 3 % der Systemspannung                | `VDE_MAX_DC_DROP_FRACTION = 0.03`          |
  | DC je Kante                  | 2 % der Systemspannung                | `VDE_MAX_DC_DROP_PER_EDGE_FRACTION = 0.02` |
  | AC (Anzeige/Dimensionierung) | 4,6 V (= 2 % von 230 V)               | `calculateCrossSection(..., 'AC_230V')`    |
  | Solar-Zuleitung              | 3 % / 2 % von **18 V** (nicht 12,8 V) | `solarDropBasisVoltageOf()`                |
  | Fehlergrenze Anzeige         | > 3 % Gesamt → `critical`             | `collectEdgeErrors`, `drop-exceeded`       |
- Kumulation: `cumulativeDropAt` / `relevantCumulativeDrop` (`lib/autoWire/sizing.ts`) über den
  Versorgungspfad; Zyklen sind abgesichert.
- Anzeige: `components/edges/utils/voltageDrop.ts` (`edgeDropInputs`, `hasVoltageDropError`) —
  **delegiert nur**.

Tests: `lib/vde-properties.test.ts` (G3 Monotonie), `components/edges/utils/voltageDrop.test.ts`,
`lib/autoWire/sizing.test.ts`.

---

## 5.3 Kabel & Querschnitt

| Symbol                                    | Wert / Bedeutung                                       | Datei                        |
| ----------------------------------------- | ------------------------------------------------------ | ---------------------------- |
| `VDE_SIZES`                               | 1.5 / 2.5 / 4 / 6 / 10 / 16 / 25 / 35 / 50 / 70 mm²    | `lib/electrical.ts`          |
| `VDE_AMPACITY`                            | 16.5 / 23 / 30 / 38 / 52 / 69 / 90 / 111 / 136 / 172 A | `lib/electrical.ts`          |
| `DERATE_FACTOR`                           | 0.7                                                    | `lib/electrical.ts`          |
| `MIN_CROSS_SECTION` / `MAX_CROSS_SECTION` | 1.5 / 70 mm²                                           | `lib/autoWire/primitives.ts` |
| `VDE_CABLE_OUTER_DIAMETERS`               | Außendurchmesser je mm² (FLYY/FLRY)                    | `lib/vde-standards.ts`       |

**Herkunft der Ampacity (ehrlich):** Werte nach veröffentlichten Belastbarkeitstabellen
DIN VDE 0298-4, Verlegeart B2, 2 belastete Adern, 30 °C. 50/70 mm² weichen von einer
verbreiteten Referenz leicht ab und sind **unverändert übernommen** (Golden Master).
Der Fahrzeugkontext (FLRY, DIN EN 1648-2 / ISO 6722) ist **nicht** modelliert — dokumentierte,
konservative Annahme (AUDIT NORM-003).

**Auswahl:** `calculateCrossSection(I, length, dataCrossSection?, domain)`
`= nächstgrößere Normstufe ≥ max(1.5, Drop-Bedarf, thermischer Bedarf, Nutzerquerschnitt)`.
Ein vorhandener Nutzer-/Importquerschnitt wird **nie verkleinert** — auch nicht von 95 mm² auf 70.

**Thermisch:** `lookupThermalCrossSection(I)` → kleinste Normstufe mit
`Ampacity ≥ I / 0.7` (d. h. `Iz_design = 0.7 × Tabellenwert`). Sättigung bei 70 mm².

**Zwei Wege zum Querschnitt — bewusst, aber leicht zu verwechseln:**

| Weg                        | Funktion                                                      | Budget                                                                                                           | Benutzt von                                                             |
| -------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| AutoWire DC-Sizing         | `sizeEdge` → `crossSectionForDrop` (`lib/autoWire/sizing.ts`) | je Kante **2 % der tatsächlichen Systemspannung** (`perEdgeCap`), Solar 2 % von 18 V                             | AutoWire (`sizeDcEdges`)                                                |
| Einzelkante / AC / Anzeige | `calculateCrossSection` (`lib/electrical.ts`)                 | **hartkodiert** 0,36 V (= 3 % von 12 V nominal) bzw. 4,6 V bei `AC_230V` — **nicht** von `sysVoltage` abgeleitet | `sizeAcEdges`, `CableEdge`, `voltageDrop.ts`, `BOMModal`, `ExpertPanel` |

Folge: bei einem 12,8-V-LiFePO4-System rechnet die Anzeige konservativer (0,36 V) als der
AutoWire-Pfad (2 % von 12,8 V = 0,256 V je Kante). Das ist **kein** Fehler, sondern die
bewusste Trennung von „Planungsvorgabe je Kante“ und „einheitlicher Mindestwert für die
Einzelbetrachtung“. Beide Wege runden auf dieselbe Normreihe auf.

**Leerrohr (Conduit):** `VDE_MAX_CONDUIT_FILL_PERCENT = 40`
(früher 60 %, mit unzutreffender Quellenangabe — korrigiert, AUDIT NORM-001);
`calculateConduitFillPercent`, `recommendConduitType` in `lib/vde-standards.ts`.

Tests: `lib/electrical.test.ts`, `lib/vde-standards.test.ts`,
`lib/vde-properties.test.ts` (G4 Monotonie + Normreihe), `lib/vde-consistency.test.ts`.

---

## 5.4 Sicherung / Schutzorgan

| Symbol                          | Bedeutung                                                                         | Datei               |
| ------------------------------- | --------------------------------------------------------------------------------- | ------------------- |
| `STANDARD_FUSE_SIZES`           | 5 … 400 A (ATO/ATC, MIDI, ANL)                                                    | `lib/electrical.ts` |
| `FUSE_MAP`                      | **abgeleitet:** größte Normsicherung ≤ `Ampacity × 0.7`                           | `lib/electrical.ts` |
| `calculateMaxFuse(cs)`          | streng — wirft `RangeError` bei unbekanntem Querschnitt                           | `lib/electrical.ts` |
| `maxFuseForDisplay(cs)`         | anzeigesicher — klemmt auf die größte Normstufe ≤ cs                              | `lib/electrical.ts` |
| `selectFuseSize(I, cs)`         | kleinste Normsicherung ≥ `ceil(I)` **und** ≤ `FUSE_MAP[cs]`; sonst `FUSE_MAP[cs]` | `lib/electrical.ts` |
| `isFuseFeasible(I, cs)`         | `ceil(I) ≤ FUSE_MAP[cs]`                                                          | `lib/electrical.ts` |
| `FUSE_MAX_UNPROTECTED_LENGTH_M` | 0,2 m                                                                             | `lib/electrical.ts` |

**Die zentrale Koordinationsregel:** `I_B ≤ I_n ≤ I_z`. Sie ist im Modell **durch Konstruktion**
erfüllt, weil Sizing (`lookupThermalCrossSection`) und Sicherungsgrenze (`FUSE_MAP`) denselben
`DERATE_FACTOR` nutzen (AUDIT ELE-001). `selectFuseSize` gibt **nie** eine Sicherung über der
Kabelgrenze zurück; ist keine Normsicherung passend, ist der **Querschnitt zu klein**
(Rückgabe = Kabel-Höchstwert, kleiner als der Nennstrom → Signal, nicht Stille).

**20-cm-Regel:** `0,2 m` ist **keine** Faustregel ohne Quelle, sondern der wörtliche Wert aus
**ISO 10133:2000 §8.1**; ABYC E-11 §11.10.1.1.1 nennt 178 mm. DIN VDE 0100-721 nennt **keine**
Länge — die 0,2 m sind eine bewusste Planungsvorgabe. Position modelliert über
`edge.data.fuseOffset` (Meter ab Batteriepol); fehlt der Wert, gilt der alte Vertrag
„Sicherung sitzt am Pol“. Starter-/Anlasserkreise sind ein anderer Fall und **nicht** modelliert.

**Bauform & Abschaltvermögen (DC):** `lib/shortCircuit.ts`

- `FUSE_TYPES = ato | midi | mega | anl | mrbf | classT`
- `FUSE_BREAKING_CAPACITY_A`: 1 000 / 2 000 / 2 000 / 6 000 / 10 000 / 20 000 A
  (Hersteller-Datenblattanker ≤ 32 V DC; MIDI ist der konservative Minimalanker der
  Herstellerstreuung; MRBF ist **spannungsabhängig**: 10/5/2 kA bei ≤16/≤32/≤58 V).
- `edge.data.fuseBreakingCapacity` (Datenblatt) **schlägt** die Tabelle.
- `bankShortCircuitCurrentA`, `shortCircuitAtFuseA`, `breakingCapacityAOf`.
- Bank = reine Parallelschaltung; Serien-Strings nicht modelliert
  (Parallelschätzung ist konservativ = größerer Ik).

**AC-Schutzorgan (230 V):** `lib/acProtection.ts`

- `AcProtectionDescriptor = { kind: 'mcb' | 'rcbo', characteristic: 'B' | 'C', breakingCapacityKA }`.
- PE-Querschnitt nach IEC 60364-5-54 Tab. 54.2; magnetische Bereiche B = 3–5×In, C = 5–10×In.
- Abschaltbedingung IEC 60364-4-41: `Zs · Ia ≤ U0`, Ia = obere Magnetgrenze (B: 5×In, C: 10×In),
  2/3-Regel (DIN VDE 0100-600), vorgelagerte Netzimpedanz als **deklarierte Annahme**
  `UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0,8 Ω` (**UNVERIFIED** — Messwert vor Ort schlägt sie).
- Verdicts: `ok-with-assumption` · `fail` · `borderline` · `rcd-covered` · `not-modeled` ·
  `inverter-limited`.

Tests: `lib/electrical.test.ts`, `lib/vde-properties.test.ts` (G1 Sandwich, G2 Monotonie,
Shrinking-Anker), `lib/shortCircuit.test.ts`, `lib/acProtection.test.ts`.

---

## 5.5 Bauteile

### Battery (`battery`)

Felder: `capacity` (Ah), `chemistry` (freier String; **bekannte** Schlüssel
`lifepo4 | liion | agm | gel | lead` bzw. `Blei`), `role` (`starter|house`),
`nominalVoltage`, `internalResistance` (mΩ), `peukertExponent`, `hasInternalBms`,
`hasExternalBms`, `bmsContinuousDischarge`, `bmsPeakDischarge`, `bmsContinuousCharge`.

- Parallelschaltbarkeit: `chemistriesParallelSafe(a, b)` (`lib/autoWire/primitives.ts`) —
  sind **beide** Chemien aus der bekannten Menge `{lifepo4, liion, agm, gel, lead}`, gilt
  **`ka === kb`** (AGM ‖ Gel ist **unzulässig**); sonst Rückfall auf
  „Blei-Familie vs. Nicht-Blei“ (`isLeadChemistry`, Regex `agm|lead|gel|blei`) —
  dokumentierte Unsicherheit.
- Starter-Klassifikation: `data.role` > Label `/start/i` (`isStarterBatteryNode`).
- Peukert: `lib/peukert.ts` (`PEUKERT_EXPONENT` je Chemie, `usableCapacityWithPeukertAh`).
- Schema: `lib/nodeSchema.ts`.

### Busbar (`busbar`)

`role: 'positive' | 'negative'`, `rating` (A). Wiederverwendet von AutoWire (`resolveRails`).

### Solar (`solar`, `roofSolar`)

Felder: `watts`, `voc` (STC), `isc`, `tempCoefficient` (%/K, Default −0,35), `voltage`, `amps`.
Abgeleitet (`lib/solar.ts`):

- `solarImpOf` = `watts / 18 V`
- `solarIscOf` = `isc` oder `1,25 × Imp` (`SOLAR_ISC_IMPFALLBACK_FACTOR`)
- `solarDesignCurrentOf` = `1,25 × Isc` (`SOLAR_CABLE_ISC_FACTOR`)
- `solarFuseFloorOf` = `1,5625 × Isc` (`SOLAR_FUSE_ISC_FACTOR`, NEC 690.8 × 690.9 als Modellannahme)
- `solarColdVocOf`: `Voc(Tmin) = Voc_STC · (1 + |TK| · (25 − Tmin))`, `Tmin = −20 °C`
- `solarStringsOf`, `stringColdVocOf` — String-Erkennung für die MPPT-Fensterprüfung.

### MPPT / Laderegler (`mpptController`, `charger`)

`amps` (Nennstrom), `efficiency`, `maxPvVoltage` (nur `MpptControllerNodeData`).
AutoWire hebt `amps` auf `ceil(Σ Solar-W / U_sys)` an, wenn zu klein.

### Inverter (`inverter`)

`continuousPower` (W, maßgeblich), `watts` (Legacy-Fallback), `hasRcd` (FI am AC-Ausgang).
DC-Eingangsstrom: `max(Eigenleistung, AC-Insel-Last) / Entladeschlussspannung / 0.85`.
230-V-Verbraucher hängen am **ersten** Wechselrichter (kein Parallelbetrieb zweier WR).

### Charger / DC-DC / AC-Ladegerät

`charger`, `mpptController`, `dcdcCharger`, `acBatteryCharger` — `amps`, `efficiency`.

- `dcdcCharger` (Booster) erzwingt getrennte Starter- **und** Aufbaubatterie.
- `acBatteryCharger` ist **Mischdomäne**: `plus` als **Target** = AC-Eingang,
  alle **Source**-Handles = DC-Ladeausgang (`getHandleDomain`).

### AC (`shorePower`, `consumer230v`)

`shorePower`: `hasRcd` (30 mA, DIN VDE 0100-721), `rating` (A), `acCurrentA`.
Leitungen sind im Modell **ein** Außenleiter plus abgeleitete Zusammensetzung
(`acCableComposition`: L / N / PE nach IEC 60364-5-54 Tab. 54.2, z. B. „3G2,5“).

### Ground / Shunt / Fuse / Conduit

`ground` (Massepunkt, **16 mm²** Mindestanbindung an die Karosserie),
`shunt` (nur in der Minus-Leitung), `fuse` (`rating` A), `conduit` (`conduitType`, `assignedEdges`).

---

## 5.6 Polarität und elektrische Domäne

### Polarität

- Handles heißen `plus` / `minus` (DC) bzw. `L`/`N`/`ac_in`/`ac_out`/`plus` (AC).
- `lib/connectionRules.ts` blockiert im DC-Kreis `plus → nicht-plus` und
  `minus → nicht-minus`. Serien-Ausnahme **nur** für `solar × solar`.
- Batterie × Batterie plus↔minus ist **verboten** (kein 24-V-Serienmodell → wäre ein
  Kurzschluss im kA-Bereich, AUDIT ELE-001/ELE-003).
- Solar direkt auf Batterie/Verbraucher ist verboten — nur Solar↔Solar und
  Solar↔`mpptController`/`charger` sind zulässig (AUDIT ELE-002).
- Live-Prüfung: Regel **A3** „Polarität vertauscht“ (`critical`).

### Domäne

- Edge-Domäne: `'DC_12V' | 'AC_230V' | 'Solar'` (`lib/domain/cableEdgeData.ts`).
- Bestimmung: `getEdgeDomain(sourceType, targetType, sourceHandle, targetHandle)`
  und `getHandleDomain(nodeType, handleId, handleType)` — beide in `lib/electrical.ts`,
  **eine** Quelle (früher drei hand-synchronisierte Handle-Listen).
- Solar hat **Vorrang** (Panel-Zuleitungen sind keine 12-V- und keine 230-V-Kreise).
- `acBatteryCharger` ist bewusst Mischdomäne.
- UI-Farben/Filter: `components/planner/utils/domainFilter.ts` (`DOMAINS`, `DOMAIN_COLORS`).
- Gespeicherte Domäne (`edge.data.edgeDomain`) **gewinnt** vor Rekonstruktion
  (`isAcEdge` in `lib/autoWire/validation.ts`).

Tests: `lib/connectionRules.test.ts`, `lib/electrical.test.ts`,
`lib/vde-properties.test.ts` (G6), `components/planner/utils/domainFilter.test.ts`.

---

## 5.7 Rechenkette einer Leitung (Kurzfassung)

```
node.data.watts / amps
   → calculateEdgeCurrent()                 [lib/vde-standards.ts]   → I [A]
   → calculateCrossSection(I, L, cs, dom)   [lib/electrical.ts]      → A [mm²]
   → selectFuseSize(I, A)                   [lib/electrical.ts]      → In [A]
   → edgeVoltageDrop(I, L, A)               [lib/autoWire/primitives.ts] → ΔU [V]
   → cumulativeDropAt(...)                  [lib/autoWire/sizing.ts] → ΔU_Pfad [V]
   → collectEdgeErrors(...)                 [components/edges/CableEdge.tsx] → EdgeError[]
   → useLiveValidation(...)                 [components/planner/hooks/] → ValidationWarning[]
```

Wer eine Stufe ändert, muss **alle** downstream-Stufen mitprüfen — AutoWire dimensioniert
exakt die Ströme, die Anzeige und Validierung später verwenden. Genau diese Gleichheit sichert
`lib/vde-consistency.test.ts` ab.

Details der AutoWire-Nutzung: [AUTOWIRE-CONTEXT.md](./AUTOWIRE-CONTEXT.md).
Regeln und Severities: [VALIDATION-CONTEXT.md](./VALIDATION-CONTEXT.md).
