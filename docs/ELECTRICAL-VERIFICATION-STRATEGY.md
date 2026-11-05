# Verifikationsstrategie Elektrik — nachweisbare Zuverlässigkeit statt Testabdeckung

Stand: 2026-11-05 · Status: **Konzept mit empirischem Ist-Zustand** (keine
Formeländerung, keine Freigabe)

> **Geltungsbereich.** Dieses Dokument beschreibt, wie die elektrischen
> Berechnungen und die sicherheitsrelevanten Entscheidungslogiken von CAMP auf
> ein höheres Verifikationsniveau gehoben werden — mathematisch, fachlich und
> softwaretechnisch. Es ist **kein Normnachweis** und keine normative Abnahme.
> Die 230-V-Prüfung und jede Abnahme dürfen nur durch entsprechend
> qualifiziertes Personal erfolgen (`docs/AC-230V-MODELLGRENZEN.md`).
>
> **Nicht-Ziele.** Keine Änderung bestehender Formeln, Tabellen, Grenzwerte oder
> Regel-IDs. Keine neuen Features. Keine Abschwächung eines bestehenden Tests.
> Wo dieses Dokument einen Widerspruch belegt, wird er **als Befund geführt**
> und mit einer Forderung (Referenztest, Invariante, Gate) versehen — die
> Entscheidung über eine Formeländerung bleibt beim Code-Owner (`AGENTS.md` §6,
> `* @CAZE7` als einziger CODEOWNER).

---

## 0. Kurzfassung

**Was heute gut ist.** CAMP hat für ein Planer-Projekt eine ungewöhnlich
dichte Prüfschicht: 4.076 Tests über 311 Dateien, ein `lib/**`-Coverage-Gate
(Zeilen 90 / Branches 85 / Funktionen 90 / Statements 95 — gemessen: 93,72 %
Zeilen, 86,35 % Branches), eine Verifikations-Engine mit **30 deklarierten
Regeln** und einem dreiwertigen Urteil (`PASS` / `FAIL` / `UNPROVABLE`), sechs
eingefrorene Referenzpläne, sechs Property-Test-Suiten mit `fast-check`, ein
Zertifikat-Hash je Prüflauf und ein Determinismus, der sich **messen** lässt.

**Was heute fehlt.** Vier Dinge, alle belegt:

1. **Die Zahlen sind nicht unabhängig nachgerechnet.** Jeder Referenzwert im
   Repo stammt aus demselben Code, den er prüfen soll. Es gibt keine einzige
   zweite Implementierung, gegen die man die produktiven Funktionen
   differenzieren könnte.
2. **Coverage korreliert nicht mit Verhalten.** Mutationstests zeigen Scores
   zwischen **48,4 %** (`autoWire/designBudget.ts`) und **87,6 %**
   (`verify/physics.ts`) — bei 86–98 % Zeilen-Coverage derselben Dateien. Ein
   grünes Coverage-Gate sagt über die Sicherheit der Formeln praktisch nichts.
3. **Die Engine entscheidet heute keinen der sechs Referenzpläne als
   `COMPLIANT`.** Zwei sind `NON_COMPLIANT`, vier `INCOMPLETE`; die
   Entscheidungsquote liegt bei 0,70–0,95. Das ist kein Skandal (die Pläne sind
   Altbestand), aber es heißt: es existiert **kein einziger End-to-End-Beleg,
   dass ein Plan das volle Prüfverfahren fehlerfrei durchläuft**.
4. **Es gibt vier quantifizierte Konsistenzdefekte** zwischen Anzeige,
   AutoWire und Engine (κ/ρ-Modell, ΔU-Grenzen, Batteriebank-Reihenfolge,
   Designbudget gegen Verlegebedingungen), die je einzeln zu einem falschen
   Grün führen können.

**Was daraus folgt.** Die Strategie setzt nicht auf mehr Tests, sondern auf
fünf neue Belegebenen: **unabhängige Referenzmodelle**, **Safety Invarianten als
formale Gates**, **Calculation Trace als Datenprodukt**, **Mutation und
Metamorphik als Regressionsschutz** und **CI-Gates, die diese Belege
erzwingen**. Kapitel 4 begründet jede Ebene mit einer Messung, Kapitel 11 nennt
für jeden Punkt den Aufwand und den Status.

---

## 1. Bestandsaufnahme: alle elektrischen Berechnungen

Aufnahme über `lib/electrical.ts`, `lib/cableSizing.ts`, `lib/cableConditions.ts`,
`lib/vde-standards.ts`, `lib/solar.ts`, `lib/solarSizing.ts`,
`lib/batterySizing.ts`, `lib/peukert.ts`, `lib/shortCircuit.ts`,
`lib/acProtection.ts`, `lib/autoWire/*`, `lib/electricalGraph/*`,
`lib/verify/*` (62 Produktionsdateien, 65 Testdateien). Die Spalte **Tests**
nennt vorhandene Belege, nicht deren Qualität — die Qualitätsaussage steht in
Kapitel 3.

### 1.1 Spannungsfall

| Gegenstand                   | Formel                                                       | Eingaben                                 | Ausgaben                                             | Einheiten       | Quelle / Status                                                                                     | Grenzwerte                                                                     | Tests / Befund                                                                 |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Kantenspannungsfall          | `ΔU = I · 2L / (κ · A)`, κ = 58 S·m/mm²                      | Strom, Länge, Querschnitt                | Spannung, Prozent                                    | A, m, mm², V, % | `lib/units.ts:457` (`voltageDrop`), κ aus `lib/materials.ts:29`                                     | –                                                                              | `cableSizing.test.ts`, G3 in `vde-properties.test.ts` (Monotonie, 1.000 Läufe) |
| Kantenspannungsfall (Engine) | `ΔU = k · L · I · ρ(T) / A`, ρ₂₀ = 0,0175 Ω·mm²/m, k ∈ {1,2} | Strom, Länge, Querschnitt, T, Pfadfaktor | Spannung                                             | V               | `lib/verify/physics.ts:75/141` (`copperResistivityAt`, `voltageDropVolts`)                          | `0 < T < 200` (Guard)                                                          | `verify/physics.test.ts` — Mutationsscore **87,6 %**                           |
| Spannungsfall-Budget         | Stufen 1 % / 3 % / 4 %                                       | Lastklasse, Prozent                      | Band (`ziel`/`planungsgrenze`/`verstoss`/`kritisch`) | %               | `lib/electrical.ts:812–839`; als `MODEL_ASSUMPTION` deklariert (0298-4 enthält keine ΔU-Grenzwerte) | 1 / 3 / 4 %                                                                    | `classifyVoltageDropPercent`-Tests vorhanden                                   |
| Anzeige-Grenze               | hartcodiert `> 3 %`                                          | Prozent                                  | boolean                                              | %               | `components/edges/utils/voltageDrop.ts:177`, `components/edges/CableEdge.tsx:261`                   | 3 % für **DC und AC**                                                          | **Befund K-2** (Kapitel 4.3): ignoriert `isAC`                                 |
| Querschnitt aus ΔU           | `A = I · 2L / (κ · ΔU_zul)`                                  | Strom, Länge, zul. Abfall                | Fläche (unge­rundet)                                 | mm²             | `lib/units.ts:475`, `lib/autoWire/primitives.ts:135`                                                | DC 0,36 V (3 %) / AC 4,6 V (2 %), `lib/electrical.ts:383`                      | G3/G4; **Befund K-2** (AC rechnet 2 %, prüft 3 %)                              |
| Kumulativer Pfadabfall       | Summe über Kette                                             | Kette, je Kante ΔU                       | Pfadspannung                                         | V               | `lib/autoWire/sizing.ts` (`edgeVoltageDrop`, `relevantCumulativeDrop`)                              | `VDE_MAX_DC_DROP_FRACTION = 0.03`, `…_PER_EDGE = 0.02` (`primitives.ts:27/29`) | `autoWire.test.ts`                                                             |

### 1.2 Querschnitt, Strombelastbarkeit, Temperatur-/Bündelungsfaktoren

| Gegenstand            | Formel / Regel                                                                           | Eingaben                                            | Ausgaben                         | Quelle / Status                                                                                           | Grenzwerte                                                             | Tests                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Tabellenbelastbarkeit | `I_z,Basis` je Normquerschnitt (16,5 / 23 / 30 / 38 / 52 / 69 / 90 / 111 / 136 / 172 A)  | Querschnitt                                         | Ampere                           | `VDE_AMPACITY` (`electrical.ts:18`), DIN VDE 0298-4 Verlegeart B2, 30 °C, 2 Adern, Cu/PVC — Transkription | –                                                                      | G1-Tabellen­invariante `FUSE_MAP[A] ≤ VDE_AMPACITY[A]`                          |
| Temperaturfaktor      | `f₁ = √((T_max − ϑ_U)/(T_max − 30 °C))`                                                  | Umgebungstemperatur, Isolierstoff                   | Faktor (0…1)                     | `ambientTemperatureFactor` (`electrical.ts:541`); T_max PVC 70 °C / XLPE 90 °C                            | `ϑ_U < T_max`, sonst `RangeError`                                      | Eigentests; Kältebonus > 1 wird nie kapazitätserhöhend angesetzt (dokumentiert) |
| Bündelungsfaktor      | `f₂ = k_B(n)` für n = 1…9 (1,00 / 0,80 / 0,70 / 0,65 / 0,60 / 0,57 / 0,54 / 0,52 / 0,50) | Anzahl belasteter Stromkreise                       | Faktor                           | `groupFactor` (`electrical.ts:88`), Transkription zweier Quellen                                          | n > 9 ⇒ **Fehler**, kein Schätzwert                                    | `groupFactor(1.5)`-Test existiert (Nicht-Integer)                               |
| Verlegeartfaktor      | `f₃ = 1,0`                                                                               | –                                                   | Faktor                           | **bewusst 1,0** — keine geprüfte Tabelle im Repo                                                          | `0 < f₃ ≤ 1`, sonst `RangeError`                                       | Guard getestet                                                                  |
| Planerpauschale       | `I_z = I_z,Basis · min(0,7, f₁·f₂·f₃)`                                                   | alle oben                                           | korrigierte Iz                   | `calculateCableIz` (`electrical.ts:613`), `DERATE_FACTOR = 0.7`                                           | 0,7 ist **Untergrenze**: mildere Bedingungen erhöhen Iz nie            | `KABEL-VERLEGEBEDINGUNGEN.md`, `cableConditions*`                               |
| Querschnitt thermisch | kleinster Normquerschnitt mit `I_z ≥ I / 0,7`                                            | Strom                                               | Querschnitt oder `outside-model` | `thermalCrossSectionFor` (`electrical.ts:331`)                                                            | Modellrand **120,4 A** (= 172 × 0,7)                                   | Boundary-Tests; Mutationsscore **elektrisch 44,1 % gesamt** (s. 3.2)            |
| Querschnitt gesamt    | `max(1,5 mm², ΔU-Bedarf, Thermik, gespeichert)` → nächste Normstufe                      | Strom, Länge, gespeicherter Wert                    | **Empfehlung**                   | `calculateCrossSection` (`electrical.ts:370`) — bewusst nie kleiner als gespeichert                       | ≥ 1,5 mm², ≤ 70 mm² Modell (gespeicherte > 70 bleiben erhalten)        | G4, `safety-no-silent-fallback.test.ts`                                         |
| Querschnittsbewertung | verbaut vs. gefordert                                                                    | Strom, Länge, gespeicherter Wert                    | `CableSelection`                 | `assessCableSelection` (`electrical.ts:437`) — die **Bewertungs**-Wahrheit, nicht die Empfehlung          | `beyondModeledRange`, `requiredTableCurrentA`                          | ELE-001-Regressionstests                                                        |
| Bedingungsauflösung   | Felder → `ResolvedCableConditions`                                                       | Verlegebedingung, Isolierstoff, ϑ, n, Hersteller-Iz | Bedingungen                      | `resolveCableConditions` (`cableConditions.ts:230`)                                                       | **wirft** bei unbekannter Bedingung/Nicht-Zahl (kein stiller Rückfall) | KABEL-VERLEGEBEDINGUNGEN-Tests; `cableIzFor` (353)                              |
| Sicherungsgrenze      | größte Normsicherung ≤ `I_z,Basis · 0,7`                                                 | Querschnitt                                         | Ampere                           | `FUSE_MAP` (`electrical.ts:177`) — abgeleitet, nicht handgepflegt                                         | s. Tabelle in 1.2                                                      | G1-Sandwich                                                                     |

**Messung der Sicherungstabelle** (nachgerechnet, `FUSE_MAP` gegen `designAmpacity`):

| A (mm²)                  | 1,5   | 2,5   | 4     | 6     | 10    | 16    | 25    | 35    | 50    | 70     |
| ------------------------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ |
| I_z,Basis (A)            | 16,5  | 23    | 30    | 38    | 52    | 69    | 90    | 111   | 136   | 172    |
| I_z,design = 0,7·I_z (A) | 11,55 | 16,10 | 21,00 | 26,60 | 36,40 | 48,30 | 63,00 | 77,70 | 95,20 | 120,40 |
| FUSE_MAP (A)             | 10    | 16    | 20    | 25    | 32    | 40    | 63    | 63    | 80    | 100    |

Der Sandwich `FUSE_MAP ≤ I_z,design` ist **konstruktiv** erfüllt (absteigende
Suche mit ε = 1e-9). Das ist die stärkste heute existierende Invariante des
Moduls — und genau die, die ein unabhängiges Referenzmodell nachrechnen muss,
statt sie zu wiederholen.

### 1.3 Sicherungsauswahl und Selektivität

| Gegenstand         | Regel                                                                                       | Ausgabe            | Quelle                                                                            | Grenzen / Befund                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Sicherungswahl     | kleinste Normsicherung ≥ I_b und ≤ `FUSE_MAP[A]`; sonst `maxFuse`                           | Ampere             | `selectFuseSize` (`electrical.ts:250`)                                            | 22 Stufen (`STANDARD_FUSE_SIZES` 5 … 400 A); bei I_b > maxFuse wird **nie** hochgerundet      |
| Maximalsicherung   | `calculateMaxFuse` (strikt, wirft bei Nicht-Normquerschnitt) / `maxFuseForDisplay` (klemmt) | Ampere             | `electrical.ts:188/205`                                                           | Trennung ist richtig; jeder neue Aufrufer muss die richtige Variante wählen                   |
| Durchlassbedingung | `I_n ≤ I_z` **und** `I_b ≤ I_n`; I₂ ≤ 1,45·I_z                                              | Befund             | `evaluateCableProtection` (702), `verify/ampacity.ts:110` (`I2_IZ_FACTOR = 1.45`) | Sonderfall leerer Plan: `{0,0,0}` ⇒ `not_applicable` statt „bestanden"                        |
| Selektivität       | Verhältnis-Heuristik ≥ 1,6:1 für Sicherungen ab 16 A                                        | Befund             | `autoWire/sizing.ts:291–410` (`applyFuseSizes`)                                   | **Modellannahme**, in `ENGINE_LIMITATIONS` ausgewiesen; Mutationsscore `sizing.ts` **56,5 %** |
| Abschaltvermögen   | `I_k,Bank ≥ I_cn` des Schutzorgans                                                          | Befund (`AMP-004`) | `verify/ampacity.ts:~885`, `shortCircuit.ts`                                      | **Befund K-3**: Bank-I_k ist reihenfolgeabhängig                                              |
| Kurzschlussstrom   | `I_k = U / (R_i,Bank + R_Leitung)`, `R_i` aus Chemie-Tabelle oder Datenblatt                | Ampere             | `shortCircuit.ts:156–226`                                                         | 20 °C, reine Parallelschaltung; `shortCircuit.ts` Mutationsscore **61,8 %**                   |
| Ungeschützte Länge | ≤ 0,2 m ab Quelle                                                                           | Befund (`AMP-003`) | `FUSE_MAX_UNPROTECTED_LENGTH_M` (ISO 13297 §8.1 — Normzitat korrekt zugeordnet)   | Planungsvorgabe, in der Matrix als `VERIFIED_NORM` geführt                                    |

### 1.4 Batterie, BMS, Peukert

| Gegenstand           | Formel / Regel                                                           | Eingaben                                  | Ausgabe           | Quelle                             | Grenzen / Befund                                                                         |
| -------------------- | ------------------------------------------------------------------------ | ----------------------------------------- | ----------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Kapazitätsbedarf     | `Ah = Wh·Tage / (U · DoD) · (1 + Reserve)`; Aufrundung auf 5-Ah-Stufen   | Tagesbedarf, Autarkie, U, Chemie          | Ah, Ladestrom     | `batterySizing.ts:100`             | DoD je Chemie aus `VDE_BATTERY_DOD`; Reserve 0…50 % sonst `RangeError`; Score **74,6 %** |
| Peukert              | `k_Faktor = (I_20/I)^(k−1)`, geklemmt auf ≤ 1; `k = 1,05 / 1,12 / 1,15`  | Kapazität, Strom, k                       | Faktor            | `peukert.ts:79`                    | k ist **Chemie-Faustwert (UNVERIFIED)**, Datenblatt schlägt; Score **73,8 %**            |
| Bankersatzwiderstand | `1/R_i = Σ 1/R_i,Block` (Starter ausgeschlossen)                         | Blöcke                                    | mΩ                | `shortCircuit.ts:167`              | **Befund K-3** (Reihenfolge), s. 4.4                                                     |
| BMS-Grenze           | `allowedCurrent = min(BMS, Bauteil, Sicherung, Kabel, System)`           | Grenzwerte                                | A + `limitedBy`   | `electricalGraph/currentBudget.ts` | **Befund E-2**: Grenze fehlt ⇒ `feasible: true` (s. 4.7)                                 |
| Lastbewertung        | Reserve 10 % (`LOAD_HEADROOM_FRACTION = 0.9`); Überschreitung = kritisch | Bedarf, Budget                            | `LoadFeasibility` | `currentBudget.ts:122`             | Zwei Consumer prüfen nur `feasible` (`designBudget.ts:302`, `useLiveValidation.ts:796`)  |
| Constraint-Auflösung | Felder → Zahlen                                                          | `bmsContinuousDischarge`, `rating`, u. a. | Grenzwerte        | `electricalGraph/constraints.ts`   | **Befund E-1**: String `"50 A"` und `0`/`-10` werden **still verworfen**                 |

### 1.5 Solar / MPPT

| Gegenstand             | Formel / Regel                                    | Quelle                    | Grenzen / Befund                                                                                                       |
| ---------------------- | ------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Modulstrom             | `I_mp = P / 18 V` (MPP-Basisspannung 12-V-System) | `solar.ts` (`solarImpOf`) | Vmp 18 V ist Modellannahme (`VDE_SOLAR_VMP_VOLTAGE`)                                                                   |
| Kurzschlussstrom       | Datenblatt `isc`, sonst `1,25 · I_mp`             | `solar.ts` (`solarIscOf`) | Fallback ist **deklariert** (`SOLAR_ISC_IMPFALLBACK_FACTOR`)                                                           |
| Leitungsstrom          | `max(I_mp, 1,25 · I_sc)`                          | `solarDesignCurrentOf`    | 1,25-Faktor = Modellannahme                                                                                            |
| Sicherungsboden        | `1,5625 · I_sc`                                   | `solarFuseFloorOf`        | NEC-Regel als Zahlenverhältnis, **kein** IEC-Beleg im Repo → in Doku als Modellwert zu führen                          |
| Kalte Leerlaufspannung | `U_oc(−20 °C) = U_oc,STC · (1 + TK · ΔT)`         | `solarColdVocOf`          | TK-Normalisierung an der Lesegrenze (%/K vs. 1/K) — historischer Faktor-14,5-Fehler behoben, Regressionstest vorhanden |
| Ertragsrechnung        | `kWh/kWp/Tag`-Referenz × kWp × Winterreduktion    | `solarSizing.ts`          | Faustwert (`DEFAULT_YIELD_KWH_PER_KWP_DAY`), als Annahme zu kennzeichnen                                               |

### 1.6 Ladebooster, Wechselrichter, Leistungs-/Energiebedarf

| Gegenstand            | Regel                                                                | Quelle                                      | Grenzen                                                                                                      |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Wechselrichter        | Ausgangsstrom aus Wirkungsgrad (`VDE_INVERTER_EFFICIENCY`)           | `vde-standards.ts`, `currentFlow.ts`        | AC-Ausgang ist für die Engine eine **Modellgrenze** (`RCD-005 … inverter-limited`)                           |
| Ladebooster / Charger | Typen `charger`, `mpptController`, `dcdcCharger`, `acBatteryCharger` | `autoWire/primitives.ts` (`CHARGER_TYPES`)  | Kein eigenes Wirkungsgradmodell — Eingangsstrom aus Leistungsbilanz                                          |
| Energiebilanz         | Peukert-korrigierte Nutzkapazität gegen Tagesbedarf                  | `verify/rules.ts` (`PWR-001`), `peukert.ts` | `MODEL_ASSUMPTION`, Severity `EFFICIENCY_WARNING`                                                            |
| Designbudget          | `requiredCurrent` gegen min(BMS, Kabel, Sicherung, Bauteil, System)  | `autoWire/designBudget.ts:113`              | **Befund K-4**: rechnet mit `designAmpacity` (0,7 · Tabelle), **ignoriert** die Verlegebedingungen der Kante |

### 1.7 Leitungs- und Schutzkonzepte, AutoWire, 230-V-Logik

| Gegenstand          | Regel                                                                             | Quelle                                             | Grenzen / Befund                                                                                      |
| ------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Strommodell         | EINE Quelle: `computeCableCurrents` / `getCableCurrents`                          | `electricalGraph/currentFlow.ts`                   | `null` statt 0 A bei Unbestimmbarkeit; 87,5 % Zeilen-Coverage, **78,2 % Branches**                    |
| AutoWire-Sizing     | `sizeDcEdges` → `sizeAcEdges` → `applyFuseSizes`                                  | `autoWire/sizing.ts`                               | Score **56,5 %**; Heilung/Selektivitätspässe sind der schwächste Punkt                                |
| Designbudget        | `evaluateDesignBudget` + `addDesignBudgetConflicts`                               | `autoWire/designBudget.ts`                         | Score **48,4 %** — der schwächste Score im Repo                                                       |
| Leitungsrohrfüllung | `Σ Außendurchmesser / Innenfläche ≤ 40 %`                                         | `vde-standards.ts` (`calculateConduitFillPercent`) | 40 % aus DIN VDE 0100-520; Füllgrad als `MODEL_ASSUMPTION` in `AMP-006`                               |
| Schutz-Erdung AC    | Tabelle 54.2: `S ≤ 16 → S`, `16 < S ≤ 35 → 16`, `> 35 → S/2`                      | `acProtection.ts:120`                              | IEC 60364-5-54, korrekt zitiert                                                                       |
| AC-Abschaltung      | `I_a = k · I_n` (B = 5×, C = 10×); `Z_s,max = (2/3) · U₀/I_a`                     | `acProtection.ts:162/171`                          | 2/3-Regel aus 0100-600; `U_0` fest 230 V (`AC_MODEL_VOLTAGE_V`)                                       |
| AC-Modellgrenzen    | 9 Scope-Items in 3 Stufen (gerechnet / Annahme / nicht prüfbar)                   | `verify/acScope.ts`, `NET-003`                     | `UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0,8` (UNVERIFIED)                                                |
| Gesamtverdikt       | 5 Pässe, 30 Regeln, `PASS/FAIL/UNPROVABLE` → `COMPLIANT/INCOMPLETE/NON_COMPLIANT` | `verify/pipeline.ts`                               | Regeln: 9 `VERIFIED_NORM`, 1 `VERIFIED_DATASHEET`, 10 `DERIVED`, 8 `MODEL_ASSUMPTION`, 2 `UNVERIFIED` |

---

## 2. Ist-Zustand der Verifikation (Baseline der Belege)

### 2.1 Testbestand

| Ebene                        | Umfang                                                           | Beleg                                                                   |
| ---------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Gesamtsuite                  | 311 Dateien / **4.076 Tests** grün, 1 skipped (~321 s)           | `npx vitest run`                                                        |
| Engine-Kern `lib/`           | 108 Dateien / 1.767 Tests grün (~101 s)                          | `npx vitest run lib/`                                                   |
| Coverage-Gate `lib/**`       | Zeilen 90 / Branches 85 / Funktionen 90 / Statements 95          | `vitest.config.ts`; gemessen: 93,72 / 86,35 / 94,43 / 95,82 (All files) |
| Property-Tests               | 6 Dateien, `fast-check` 4.9.0, 36 `numRuns`-Stellen, feste Seeds | G1–G9 (VDE), E1–E10 (Graph), `safety-no-silent-fallback`, Routing       |
| Golden Master                | 6 Pläne, eingefroren in `knownPlans/*.json`                      | `npm run test:goldenmaster`                                             |
| Regression (SVG, byte-exakt) | 15 Szenarien                                                     | `npm run test:regression`                                               |
| E2E                          | Playwright, Visual-Baselines 375/768/1440                        | `npm run e2e`                                                           |

Einzelne Module (v8-Coverage, `lib/`-Lauf):

| Datei              | Zeilen | Branches | Funktionen | Statements |
| ------------------ | ------ | -------- | ---------- | ---------- |
| `acProtection.ts`  | 100    | 97,54    | 100        | 100        |
| `batterySizing.ts` | 100    | 100      | 100        | 100        |
| `constraints.ts`   | 100    | 97,67    | 100        | 100        |
| `currentBudget.ts` | 100    | 95,45    | 100        | 100        |
| `peukert.ts`       | 97,14  | 93,75    | 100        | 100        |
| `shortCircuit.ts`  | 96,87  | 93,22    | 100        | 100        |
| `cableSizing.ts`   | 96     | 93,75    | 100        | 100        |
| `designBudget.ts`  | 98,01  | 86,02    | 100        | 100        |
| `sizing.ts`        | 94,80  | 86,04    | 86,36      | 99,15      |
| `electrical.ts`    | 92,39  | 87,42    | 96,77      | 94,54      |
| `ampacity.ts`      | 92,83  | 82,25    | 97,82      | 95,32      |
| `protection.ts`    | 92,35  | 83,86    | 91,76      | 97,18      |
| `currentFlow.ts`   | 87,52  | 78,17    | 90,26      | 91,06      |

### 2.2 Was die Engine heute tatsächlich entscheidet

Gemessen an den sechs eingefrorenen Referenzplänen (`verifyPlan` auf
`captureGoldenMaster`, Kontext `VEHICLE`):

| Plan     | NORM_CORE                              | CAMP_MODEL                              | PRACTICE                                |
| -------- | -------------------------------------- | --------------------------------------- | --------------------------------------- |
| simple   | INCOMPLETE (0,80; P12/F0/U3/N6)        | INCOMPLETE (0,78; P14/F0/U4/N11)        | INCOMPLETE (0,78; P14/F0/U4/N12)        |
| camper   | INCOMPLETE (0,93; P14/F0/U1/N6)        | INCOMPLETE (0,95; P19/F0/U1/N9)         | INCOMPLETE (0,95; P19/F0/U1/N10)        |
| solar    | INCOMPLETE (0,80; P12/F0/U3/N6)        | **NON_COMPLIANT** (0,78; P13/F1/U4/N11) | **NON_COMPLIANT** (0,78; P13/F1/U4/N11) |
| inverter | **NON_COMPLIANT** (0,78; P12/F2/U4/N3) | **NON_COMPLIANT** (0,76; P14/F2/U5/N8)  | **NON_COMPLIANT** (0,76; P14/F2/U5/N9)  |
| acdc     | **NON_COMPLIANT** (0,74; P11/F3/U5/N2) | **NON_COMPLIANT** (0,70; P12/F4/U7/N6)  | **NON_COMPLIANT** (0,67; P12/F4/U8/N6)  |
| complex  | INCOMPLETE (0,90; P19/F0/U2/N0)        | INCOMPLETE (0,92; P22/F0/U2/N5)         | INCOMPLETE (0,92; P23/F0/U2/N5)         |

Legende: `P` bestanden, `F` fehlgeschlagen, `U` unbeweisbar, `N` nicht
anwendbar; Zahl in Klammern = `coverage.decisionRatio`.

**Lesart.** Kein Plan erreicht `COMPLIANT`. Der Unterschied zwischen den
Profilen ist inhaltlich bedeutsam: `solar` ist im `NORM_CORE`-Profil
`INCOMPLETE`, im `CAMP_MODEL`-Profil `NON_COMPLIANT` — das ΔU-Budget ist eine
Modellvorgabe (`VDR-001/002`), kein Normsatz, und wird erst mit `CAMP_MODEL`
geprüft. **Das ist korrekt und muss so bleiben** — es zeigt aber, dass ein
Verdikt ohne Profilangabe nicht interpretierbar ist (`API-Befund A-1`).

Zwei Nebenbefunde aus derselben Messung:

- **`solar` kippt** zwischen Profilen von `INCOMPLETE` auf `NON_COMPLIANT`
  (F0 → F1). Die zusätzliche Regel ist `VDR-001/002`.
- **`acdc` verschlechtert sich** mit strengerem Profil von 0,74 auf 0,67 —
  mehr Regeln, mehr unbeweisbare Punkte. Eine strengere Prüfung erzeugt hier
  **weniger** Entscheidungen. Das ist ein Argument dafür, `decisionRatio` als
  eigene Kennzahl zu führen und nicht nur das Verdikt.

### 2.3 Determinismus und Reproduzierbarkeit (belegt)

| Prüfung                                                 | Ergebnis                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Zweimal derselbe Plan (`acdc`)                          | identischer `certificateHash` `8b265f245f1e6ceb`                                               |
| Umgekehrte Knoten-/Kantenreihenfolge                    | gleicher Certificate- und Plan-Hash, identische Eventliste                                     |
| Leerer Plan                                             | `INCOMPLETE`, `rulesApplied 21`, `decisionRatio 0`, 7 unprovable — **kein stilles PASS**       |
| Minimialplan Batterie → Verbraucher (2 Kanten, 2,5 mm²) | `AMP-001` ×2 `UNVERIFIABLE` (`operatingCurrent = null`), `AMP-003` VIOLATION ⇒ `NON_COMPLIANT` |

Der Determinismus ist damit **messbar** und nicht nur behauptet. Er ist die
Voraussetzung für Golden-Master-Gates (Kapitel 9) und für jede
Differentialprüfung.

### 2.4 Grenzen dieser Baseline

- Das Coverage-Gate misst Zeilen, nicht Entscheidungen (Kapitel 3.2 zeigt den
  Abstand).
- Kein Referenzwert im Repo ist unabhängig hergeleitet (Kapitel 5).
- Kein Gate prüft, ob ein Sicherheitsbefund durch eine Änderung
  **verschwindet** (Kapitel 9).
- `ENGINE_LIMITATIONS` beschreibt Modellgrenzen in Prosa; es gibt keinen Test,
  der ihre Vollständigkeit erzwingt.

---

## 3. Advanced Testing: Prüfung der Methoden und Werkzeuge

### 3.1 Methodenbewertung für CAMP

| Methode                  | Was sie in CAMP liefern kann                                                      | Vorhanden?                                    | Bewertung                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Property-Based**       | Gesetze über ganze Wertebereiche (Monotonie, Sandwich, Totalität)                 | **ja**, G1–G9 + E1–E10                        | Behalten und auf die **Engine** ausdehnen (bisher überwiegend Tabellen/AutoWire)                                                           |
| **Invarianten**          | „Nie ein Grün ohne Beweis“ — als ausführbarer Satz                                | teilweise (`safety-no-silent-fallback`, G1)   | **Ausbauen** zum Kern der Strategie (Kapitel 6)                                                                                            |
| **Mutation**             | Messen, ob Tests Verhalten oder nur Zeilen abdecken                               | Probe gemessen (Kapitel 3.2), **nicht im CI** | **Einführen als Gate** mit kleinem, kuratiertem Mutations-Set                                                                              |
| **Metamorphic**          | Beziehungen zwischen Läufen, ohne Orakel (z. B. „länger ⇒ nie besser“)            | implizit in G3/G5                             | **Ausbauen**: Permutation, Skalierung, Monotonie über die **Engine**                                                                       |
| **Differential**         | Produktivfunktion gegen unabhängiges Referenzmodell                               | **nein**                                      | **Kerninvestition** (Kapitel 5) — ohne sie bleibt jede Zahl selbstreferenziell                                                             |
| **Boundary**             | Randwerte (Modellrand 120,4 A, n = 9, f₃-Grenzen, `Z_s,max`)                      | teilweise                                     | Systematisieren: jeder `RangeError`-Guard und jede Modellgrenze bekommt einen Randtest                                                     |
| **Dimensional Analysis** | Branded Types (`Volts`, `Amps`, `Mm2`, `Scalar`) verhindern Einheitenverwechslung | **ja** (`lib/units.ts`)                       | Ausbauen: Dimension als Test über die Engine-Grenzen (Events tragen `unit`)                                                                |
| **Fuzz**                 | Robustheit gegen kaputte Importe/Pläne (NaN, Strings, negative Werte)             | punktuell                                     | Gezielt auf `resolveCableConditions`, `constraints.ts`, Plan-Import — hier sitzen die Befunde E-1/E-2                                      |
| **Regression**           | Byte-exakte SVGs, Golden Master                                                   | **ja**                                        | Behalten; um elektrische Golden Master (Verdikt + Events) erweitern                                                                        |
| **Formal Verification**  | Beweis einzelner Kerninvarianten                                                  | nein                                          | **Nicht jetzt.** Der Aufwand steht in keinem Verhältnis zum Nutzen; Invarianten als laufende Tests liefern 90 % des Schutzes (Kapitel 3.3) |

### 3.2 Messung: Mutation statt Coverage (empirisch, 6 Läufe)

Stryker 10.1.1, `perTest`, node-Environment, kleine kuratierte Testauswahl:

| Modul                              | Mutanten | getötet | überlebt | ohne Coverage | Score (nur abgedeckte)           |
| ---------------------------------- | -------- | ------- | -------- | ------------- | -------------------------------- |
| `verify/physics.ts`                | 195      | 169     | 24       | 2             | **87,6 %**                       |
| `solar.ts`                         | 135      | 107     | 12       | 12            | 89,9 %                           |
| `acProtection.ts`                  | 333      | 259     | 74       | 0             | 77,8 %                           |
| `batterySizing.ts`                 | 71       | 53      | 18       | 0             | 74,6 %                           |
| `peukert.ts`                       | 143      | 104     | 37       | 2             | 73,8 %                           |
| `shortCircuit.ts`                  | 179      | 110     | 68       | 1             | **61,8 %**                       |
| `electricalGraph/currentBudget.ts` | 81       | 71      | 9        | 1             | 88,8 %                           |
| `electricalGraph/constraints.ts`   | 214      | 142     | 72       | 0             | 66,4 %                           |
| `autoWire/sizing.ts`               | 569      | 300     | 231      | 38            | **56,5 %**                       |
| `autoWire/designBudget.ts`         | 347      | 162     | 173      | 12            | **48,4 %**                       |
| `electrical.ts` (gesamt)           | 476      | 210     | 67       | 188           | 44,1 % gesamt / 75,8 % abgedeckt |

**Der Befund ist eindeutig.** `designBudget.ts` hat 98,01 % Zeilen-Coverage und
**48,4 %** Mutationsscore. `constraints.ts` hat 100 % Zeilen-Coverage und
**66,4 %**. Das heißt: die Tests führen die Zeilen aus, prüfen aber die
Entscheidung nicht. Die schwächsten Cluster sind durchweg **Grenzwerte,
Rundungen und Sortierungen** — genau die Stellen, an denen eine
Sicherheitsentscheidung kippt:

- `batterySizing.ts:111–136` (DoD-/Reserve-/Peukert-Kombination),
- `peukert.ts:46–50` (Klemmung des Faktors),
- `shortCircuit.ts:108–158` (R_i-Auswahl, Chemie-Zuordnung),
- `acProtection.ts:121–122/192/320–337` (PE-Querschnitt, Selektivität, Scope),
- `solar.ts:132–136/163/182/192` (TK-Normalisierung, Isc-Fallback),
- `designBudget`/`sizing` (Budgetgrenzen, Rundungen, Sortierungen).

**Einschränkung, die im Dokument bleiben muss:** Die 11 `RuntimeError`-Mutanten
in `electrical.ts` sind Modul-Ladezeit-Fehler (Syntax-/Importpfad), **keine**
Testlücken und dürfen nicht als „survived“ gezählt werden. Läufe über `lib/**`
mit jsdom liefen > 1.500 s ohne Report; `sizing`/`designBudget` brauchen ~790 s
für 781 Mutanten. Ein flächiger Mutation-Lauf ist in CI **nicht** vertretbar
(2 Kerne, 3,9 GB RAM im Messsystem; zwei parallele Stryker-Prozesse wurden vom
Kernel per `SIGKILL` beendet).

### 3.3 Werkzeugwahl (geprüft, nicht eingeführt)

| Werkzeug                         | Version geprüft                                   | Status im Repo                       | Urteil                                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fast-check`                     | Registry latest **4.10.2**; im Manifest **4.9.0** | devDependency, 6 Suiten, feste Seeds | **Behalten.** Kein Handlungsbedarf; Upgrade auf 4.10.x ist ein Minor-Bump (Dependabot, gebündelt) und braucht keinen ADR                                                                        |
| `@stryker-mutator/core`          | **10.1.1**                                        | **nicht** im Manifest                | **Einführen, aber begrenzt**: nur kuratiertes Mutations-Set (Kapitel 9.3), `concurrency: 1`, `perTest`, node-Environment. Ergebnis der Messung: technisch tragfähig, aber langsam (Kapitel 3.2) |
| `@stryker-mutator/vitest-runner` | **10.1.1**                                        | **nicht** im Manifest                | Kompatibel zum Vitest-4-Stack (in der Messung produktiv genutzt); Eignung für CI bleibt zu verifizieren (`UNVERIFIED` bis zum ersten grünen CI-Lauf)                                            |
| `tsx`                            | vorhanden                                         | devDependency                        | Für Probe-/Referenz-Skripte ausreichend; keine neue Abhängigkeit nötig                                                                                                                          |

**Regel für neue Abhängigkeiten** (`AGENTS.md` §5, `CHANGE-WORKFLOW` Schritt 4):
Jede neue Dev-Abhängigkeit braucht (a) Zweck, (b) gemessenen Nutzen, (c)
Rückbaubarkeit. Für Stryker gilt: Nutzen **gemessen** (Kapitel 3.2), Rückbau =
Entfernen von Konfiguration + Paket, keine Produktionsabhängigkeit. Deshalb
**kein ADR nötig**, aber ein Ledger-Eintrag in `docs/ARCHITECTURE-CHANGES.md`
bei Einführung.

**Formale Verifikation / SMT:** Für ganzzahlige Tabellen-Invarianten
(`FUSE_MAP ≤ I_z,design`) wäre ein SMT-Beweis (Z3) möglich. Aufwand: neues
Tool, neue Notation, Pflege bei jeder Tabellenänderung. Nutzen gegenüber einem
1000-Läufe-Property-Test über die **endliche** Normreihe: gering. **Abgelehnt**,
mit Begründung — nachvollziehbar dokumentiert statt stillschweigend verworfen.

---

## 4. Empirische Befunde (die Belegbasis dieses Konzepts)

### 4.1 Befund A-1: Das Standardprofil prüft den Spannungsfall nicht

`verificationOptions()` defaultet auf `profile: 'NORM_CORE'` (`lib/verify/context.ts:75`).
`VDR-001/002` sind `CAMP_MODEL`. Ein Aufruf `verifyPlan({ nodes, edges })`
prüft damit **21 statt 30 Regeln** und **nie** das ΔU-Budget. Nachgemessen:

| Aufruf                          | Regeln | VDR enthalten? |
| ------------------------------- | ------ | -------------- |
| `verifyPlan(input)` (Default)   | 21     | **nein**       |
| `options.profile: 'CAMP_MODEL'` | 29     | ja             |
| `options.profile: 'PRACTICE'`   | 30     | ja             |

Der Planer selbst nutzt `PRACTICE` (`components/planner/utils/verificationWarnings.ts:48`)
— die Lücke betrifft also nur externe Aufrufer (Skripte, Tests, künftige
Exporte). Sie ist trotzdem ein Invarianten-Kandidat: **ein Verdikt ohne
genanntes Profil darf nicht als „geprüft“ gelten**. Der Bericht nennt das
Profil im Zertifikat — das ist die halbe Lösung; die andere Hälfte ist ein
Gate (Kapitel 8.2, I-E-10).

### 4.2 Befund K-1: Zwei Kupfer-Modelle (κ = 58 vs. ρ(T))

| Rechnung                                     | Formel                          | Ergebnis (I = 10 A, 5 m, 1,5 mm²) |
| -------------------------------------------- | ------------------------------- | --------------------------------- |
| Design / Anzeige / AutoWire                  | `ΔU = I·2L/(κ·A)`, κ = 58       | 1,1494 V                          |
| Engine (`verify/physics.ts`) bei 20 °C       | `ΔU = I·2L·ρ₂₀/A`, ρ₂₀ = 0,0175 | 1,1667 V (**+1,5 %**)             |
| Engine bei 70 °C (PVC-Grenzleitertemperatur) | ρ₇₀ = 0,02094                   | 1,3959 V (**+21,4 %**)            |

Der Unterschied ist bei 20 °C unkritisch, bei Betriebstemperatur groß. Der
**kritische Fall** ist gemessen: I = 5,22 A, 5 m, 2,5 mm², 12 V ⇒ Design
**exakt 3,000 % ⇒ Anzeige grün**, Engine **3,643 % ⇒ FAIL/rot**. Zwei
Wahrheiten, ein Plan, entgegengesetztes Urteil.

**Fachlich ist κ = 58 kein Fehler** — es ist der Leitwert bei 20 °C
(58 S·m/mm² entspricht ρ = 0,01724). Der Fehler ist, dass **die Anzeige die
Temperatur nicht mitführt**, während die Engine sie mitführt. Also: keine
Formeländerung, sondern eine **Konsistenzforderung** (Kapitel 6, I-E-04) und
ein Referenztest, der beide Wege über denselben physikalischen Parameter
verbindet.

### 4.3 Befund K-2: Drei ΔU-Grenzen in drei Schichten

| Ort                                                | Grenze                               | Domäne         |
| -------------------------------------------------- | ------------------------------------ | -------------- |
| `components/edges/utils/voltageDrop.ts:177`        | `> 3 %`                              | DC **und** AC  |
| `components/edges/CableEdge.tsx:261`               | `> 3 %`                              | DC **und** AC  |
| `lib/electrical.ts:383` (Querschnittsempfehlung)   | DC 0,36 V (3 %) / AC 4,6 V (**2 %**) | getrennt       |
| `lib/electrical.ts:812–816` (`VOLTAGE_DROP_PCT_*`) | Bänder 1 % / 3 % / 4 %               | Anzeige-Bänder |
| `lib/autoWire/primitives.ts:27/29`                 | 3 % gesamt / 2 % je Kante            | AutoWire       |

Die **Empfehlung** dimensioniert AC auf 2 %, die **Anzeige** prüft AC auf 3 %.
Ein Plan, dessen AC-Leitung nach 2 %-Kriterium dimensioniert wurde, ist damit
immer grün — und eine Leitung, die 2,5 % hat, ist grün, obwohl die Empfehlung
sie als zu dünn ansehen würde. Die Testdatei
`components/edges/utils/voltageDrop.test.ts` enthält **vier Assertions ohne
jede AC/DC-Unterscheidung** — der Defekt ist dort nicht sichtbar.

### 4.4 Befund K-3: Batteriebank-Kurzschlussstrom ist reihenfolgeabhängig

Gemessen mit `bankShortCircuitCurrentA([LiFePO4 12,8 V, AGM 12,0 V])`:

| Reihenfolge    | R_i,Ersatz | I_k,Bank      | I_k an der Sicherung |
| -------------- | ---------- | ------------- | -------------------- |
| LiFePO4 zuerst | 1,875 mΩ   | **6.826,7 A** | 6.485,9 A            |
| AGM zuerst     | 1,875 mΩ   | **6.400,0 A** | 6.080,5 A            |

Der Ersatzwiderstand ist korrekt symmetrisch (1,875 mΩ in beiden Fällen); die
**Bezugsspannung** nicht: `bankVoltage()` nimmt den **ersten** Block
(`shortCircuit.ts:181`). Aufrufer `lib/verify/ampacity.ts:893` sortiert nicht ⇒
die **Plan-Reihenfolge** beeinflusst das geprüfte Abschaltvermögen (`AMP-004`,
`CRITICAL_SAFETY`). Differenz: 6,7 %. Das verletzt die Determinismus-Zusage
nicht (gleiche Eingabe ⇒ gleiches Ergebnis), aber die **Repräsentations­invarianz**
(gleicher Plan, andere Knotenreihenfolge ⇒ anderes Sicherheitsurteil).

### 4.5 Befund K-4: Designbudget und Engine bewerten dasselbe Kabel verschieden

Messung: Batterie (LiFePO4, BMS 200 A) → Verbraucher 560 W, eine Kante 2 m,
16 mm², Sicherung 40 A, **Umgebung 60 °C**:

| Schicht                          | Ergebnis                                                                   |
| -------------------------------- | -------------------------------------------------------------------------- |
| `evaluateDesignBudget`           | `requiredCurrent 46,67 A`, `cableLimit 48,3 A` ⇒ **`cableCanCarry: true`** |
| `cableIzFor(16, {ambientC: 60})` | **34,5 A**                                                                 |
| `verifyPlan` (PRACTICE)          | `AMP-001` **VIOLATION** 46,67 A > 34,5 A ⇒ **`NON_COMPLIANT`**             |

Ursache: `designBudget.ts:164` rechnet `designAmpacity(cs) = 0,7 · Tabelle` und
ignoriert `ambientC`/Bündelung der Kante vollständig. Das Designbudget sagt
„Kabel trägt“, die Engine sagt „Kabel trägt nicht“. Beide Aussagen erscheinen
in derselben Oberfläche (Warnzentrale und Prüfsiegel). **Das ist der schwerste
Konsistenzbefund**: eine grüne Aussage in einem Bereich, der ausdrücklich
Sicherheitsgrenzen prüft.

### 4.6 Befund E-1: `constraints.ts` verwirft ungültige Grenzwerte still

`{ bmsContinuousDischarge: '50 A' }` (String) sowie `0` und `-10` führen dazu,
dass das Feld **danach fehlt** — ohne Fehlermeldung, ohne `notAssessable`-Grund
außer einem Sammeltext. Das ist ein Verstoß gegen **Regel M** (kein stiller
Fallback) an der Eingabegrenze. Die Folge ist nicht zwingend falsch (fehlende
Grenze ⇒ „nicht bewertbar“), aber der Nutzer erfährt nicht, **dass seine
Eingabe verworfen wurde**.

### 4.7 Befund E-2: „Nicht bewertbar“ passiert das Feasibility-Gate

`evaluateLoadFeasibility` ohne hinterlegte Grenze liefert
`feasible: true`, `severity: 'warning'`, `limitedBy: 'unknown'`
(`currentBudget.ts:130–138`). Die Consumer prüfen **nur `feasible`**
(`designBudget.ts:302`, `useLiveValidation.ts:796`) ⇒ „nicht bewertbar“ wird
wie „in Ordnung“ behandelt. Ein Verbraucher ohne jede hinterlegte Grenze ist
damit freigabefähig.

### 4.8 Befund A-2: `acCurrentA` überstimmt `rating`

`{ rating: 10, acCurrentA: 16 }` ⇒ `continuousCurrent 16`. Der Verbrauchswert
wird zur Grenze; es gewinnt schlicht der größere Wert. Für ein **Limit** ist
das die falsche Richtung: eine Grenze darf nicht durch einen Mess-/Nennwert
ersetzt werden.

### 4.9 Befund T-1: `maxFuseForConditions` liefert inkonsistente Trace-Daten

`70 mm² / 172 A` Hersteller-I_z ⇒ `maxFuseForConditions` 160 A,
`selectFuseForConditions(150, 70)` = 160 A, während der Referenzpfad 100 A
liefert. Das zurückgegebene Objekt behält außerdem `plannerFactor: 0.7`,
obwohl `correctedIz` die **unveränderte Herstellerangabe** ist. Die Erklärung
im Trace ist damit falsch, obwohl der Wert stimmt.

### 4.10 Befund M-1: Modellrand ist scharf, aber nur als Flag

`120,4 A` (bzw. `120,39999999999999`) ⇒ `within-model`; `120,400000001 A` ⇒
`outside-model`. Das ist korrekt und testgedeckt. `assessCableSelection` setzt
dann `beyondModeledRange: true` und akzeptiert **gespeicherte** Querschnitte
über 70 mm² unverändert. Beides ist gewollt (Nutzerquerschnitt nicht
verkleinern) — aber es heißt: ein Plan kann einen Querschnitt führen, für den
es **keine Tabellenstufe** gibt, und das Verdikt bleibt `INCOMPLETE` statt
`NON_COMPLIANT`. Ob das richtig ist, ist eine **fachliche Freigabefrage**, keine
Testfrage.

### 4.11 Befund D-1: Altpläne liegen jenseits des Modellrands

`knownPlans/acdc.json` fährt **152,06 A auf 70 mm²** mit 100-A-Sicherung
(`fuseWarning: true`); `complex.json` **70,49 A auf 35 mm²** (I_z = 77,7 A).
Beide Pläne sind als Referenz eingefroren. Sie sind damit **keine** Beispiele
für normgerechte Auslegung, sondern für „Bestand, der Befunde erzeugt“ — das
muss in `docs/ai/GOLDEN-PLANS.md` stehen, sonst liest ein neuer Leser sie als
Soll-Zustand.

---

### 4.12 Zusammenfassung der Befunde

| ID  | Kern in einem Satz                                                                         | Betroffene Invariante | Schwere (fachlich)                                 |
| --- | ------------------------------------------------------------------------------------------ | --------------------- | -------------------------------------------------- |
| A-1 | Standardprofil prüft 21 statt 30 Regeln und **nie** das ΔU-Budget                          | I-E-10                | mittel — betrifft externe Aufrufer                 |
| A-2 | `acCurrentA` (Verbrauch) überstimmt `rating` (Grenze)                                      | I-E-05 (verwandt)     | mittel                                             |
| K-1 | Zwei Kupfer-Modelle: κ = 58 (Design) vs. ρ(T) (Engine) — im Grenzfall gegenteiliges Urteil | I-E-09                | **hoch**                                           |
| K-2 | Drei ΔU-Grenzen; AC wird auf 2 % dimensioniert, aber auf 3 % geprüft                       | I-E-04                | **hoch**                                           |
| K-3 | Bank-Kurzschlussstrom hängt von der Knotenreihenfolge ab (6.826,7 vs. 6.400,0 A)           | I-E-11                | **hoch** (berührt `AMP-004`, `CRITICAL_SAFETY`)    |
| K-4 | Designbudget sagt „Kabel trägt“, die Engine sagt `AMP-001` VIOLATION — für dasselbe Kabel  | I-E-09                | **hoch**                                           |
| E-1 | `constraints.ts` verwirft ungültige Grenzwerte still                                       | Regel M               | mittel                                             |
| E-2 | „Nicht bewertbar“ liefert `feasible: true` und passiert das Gate                           | I-E-02, I-E-05        | **hoch**                                           |
| T-1 | `maxFuseForConditions` mit Hersteller-I_z liefert 160 A und einen falschen `plannerFactor` | I-E-03 (Rand)         | mittel                                             |
| M-1 | Modellrand ist scharf, aber nur als Flag — Querschnitte > 70 mm² bleiben zulässig          | –                     | offene Freigabefrage                               |
| D-1 | Zwei der sechs Referenzpläne liegen jenseits des Modellrands und sind trotzdem Referenz    | –                     | Dokumentationsfehler                               |
| D-2 | `16,1 A` und `0,7 · 23 A` sind dieselbe Zahl, ergeben aber 4,0 vs. 2,5 mm²                 | I-E-11                | mittel (konservativ, aber repräsentationsabhängig) |
| D-3 | Der Bank-I_k weicht zwischen Modelldefinition und Produktivfunktion um 0,33 % ab (κ vs. ρ) | –                     | kein Fehler — Toleranz belegt                      |

**Wichtig für die Lesart:** Keiner dieser Befunde ist ein Rechenfehler im Sinne
von „falsche Formel“. Es sind **Verknüpfungsfehler** zwischen vorhandenen,
jeweils für sich verteidigten Wahrheiten. Genau deshalb ist die Antwort nicht
„mehr Tests“, sondern ein Differentialmodell (Kapitel 5) und Invarianten, die
die Verknüpfung erzwingen (Kapitel 6).

### 4.13 Befund D-2: eine Normstufe hängt an der Divisionsreihenfolge

`thermalCrossSectionFor` prüft `I · (1/0,7) ≥ Tabellenwert`. Für das Literal
`16,1` ergibt das `23,000000000000004 > 23` ⇒ **4,0 mm²**. Für den rechnerisch
identischen Wert `0,7 · 23 = 16,099999999999998` ergibt es
`22,999999999999996 ≤ 23` ⇒ **2,5 mm²**.

```js
23 * 0.7; // 16.099999999999998  ≠ 16.1
16.1 *
  (
    1 / 0.7
  ) // 23.000000000000004  > 23   ⇒ 4,0 mm²
  (0.7 * 23) *
  (1 / 0.7); // 22.999999999999996  ≤ 23   ⇒ 2,5 mm²
```

Die **fachlich richtige** Antwort für 16,1 A ist 2,5 mm² (23 A ≥ 16,1/0,7). Die
Abweichung ist die **konservative** Richtung (mehr Kupfer), also kein
Sicherheitsfehler — aber das Ergebnis hängt davon ab, _wie_ die Zahl entstanden
ist, nicht nur davon, _was_ sie ist. Das ist derselbe Verstoß gegen die
Repräsentationsinvarianz wie Befund K-3, nur eine Ebene tiefer: nicht die
Reihenfolge der Objekte, sondern die der Gleitkommaoperationen entscheidet.

Konsequenz für die Strategie: der Vergleich muss an der Kante **inklusiv mit
Toleranz** erfolgen (`≥ value − ε·max(1,value)`), nicht mit `≥`. Das
Referenzmodell RM-2 macht das seit dem zweiten Lauf (ε = 1e-12 relativ); die
Produktivfunktion **nicht**. Ein Fix dort ist ein Einzeiler, ändert aber
Ausgaben für Bestandspläne — deshalb als Befund geführt, nicht umgesetzt.

Der Test `BEFUND D-2 — dieselbe mathematische Grenze liefert je nach Herkunft
zwei Stufen` hält beide Ergebnisse fest. Er repariert nichts; er macht eine
spätere Reparatur als bewusste Änderung sichtbar.

### 4.14 Befund D-3: die κ-Rundung ist quantifiziert, nicht behauptet

Befund K-1 (Kapitel 4.2) sagt „zwei Kupfer-Modelle“. Die Referenzsuite macht
daraus eine Zahl mit Toleranz:

| Größe                                         | Produktiv (κ = 58) | Referenz (ρ₂₀ = 0,0175) | Abweichung  |
| --------------------------------------------- | ------------------ | ----------------------- | ----------- |
| Spezifischer Widerstand                       | 0,017241 Ω·mm²/m   | 0,0175 Ω·mm²/m          | **1,478 %** |
| I_k an der Sicherung (0,2 m / 16 mm², 12,8 V) | 6.628,57 A         | 6.606,45 A              | **0,33 %**  |
| I_k an den Polklemmen (R_Leitung = 0)         | exakt gleich       | exakt gleich            | 0 %         |

Die Zusage im Differentialtest lautet 1 % für `R_fuse` und **exakt** für die
Polklemmen. Das ist wichtig für die Lesart von K-1: die Abweichung ist eine
**Konstantenrundung**, kein Rechenfehler. Sie wird an der Stelle sichtbar, an
der der Leitungswiderstand neben dem Innenwiderstand nicht mehr verschwindet —
und dort beträgt sie ein Drittel Prozent. Der Befund bleibt trotzdem „hoch“,
weil κ an der **ΔU-Grenze** (Befund K-2) das Urteil kippt, nicht weil der
Kurzschlussstrom falsch wäre.

Der Allowlist-Eintrag für K-1 (Ablauf 2027-06-30) ist mit genau diesen Zahlen
begründet und nicht mit „Rundung, unkritisch“.

## 5. Unabhängige Referenzmodelle und fachlich geprüfte Referenzfälle

### 5.1 Grundsatz

> **Kein Referenzwert darf aus dem Code stammen, den er prüft.**

Heute gilt das Gegenteil: `knownPlans/*.json` sind Ausgaben von
`performAutoWiring`, die Tests vergleichen gegen sich selbst. Ein solcher
Golden Master fängt **Regressionen** (das ist wertvoll und bleibt), er belegt
aber **keine fachliche Richtigkeit**.

Daraus folgen drei Regeln:

1. **R1 — Referenzmodelle sind neu geschrieben**, in einem eigenen Verzeichnis
   (`test/reference/`), ohne Import aus `lib/electrical*`, `lib/verify/*`,
   `lib/autoWire/*`. Erlaubt sind nur `lib/units.ts`-Typen als **Typen**
   (keine Funktionen), damit die Einheitenprüfung mitläuft.
2. **R2 — Referenzfälle sind fachlich belegt**, nicht erzeugt. Jeder Fall trägt
   eine Quelle (Normklausel, Datenblatt, Herstellerangabe) **oder** das
   ausdrückliche Label `MODELL_ANNAHME`. Ein selbst gerechneter Wert ist
   `UNVERIFIED` und darf nicht als „fachliche Wahrheit“ im Test stehen.
3. **R3 — Referenzmodelle dürfen produktive Funktionen nicht wiederverwenden**,
   auch nicht indirekt über gemeinsam genutzte Konstanten. Die Tabellenwerte
   werden im Referenzmodell **erneut** deklariert (Duplikat ist hier Absicht:
   eine Änderung an `VDE_AMPACITY` soll den Differentialtest rot machen, nicht
   beide Seiten gleichzeitig verschieben).

### 5.2 Die fünf Referenzmodelle

| ID   | Modell                             | Umfang                                                                                          | Orakel                                                                                                  |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| RM-1 | **Spannungsfall & Querschnitt**    | `ΔU(I, L, A, T)` mit ρ(T) als eigenständiger Funktion; Umkehrung `A(ΔU_zul)`                    | Geschlossene Form, unabhängig implementiert; Differenz ≤ 1e-9 relativ                                   |
| RM-2 | **Belastbarkeit & Koordination**   | Tabellen-I_z, f₁ (Wurzelformel), f₂ (Stützstellen), Sandwich `I_b ≤ I_n ≤ I_z`, `I₂ ≤ 1,45·I_z` | Tabellenwerte **neu deklariert**; Property: für alle A und alle I gilt `FUSE_MAP[A] ≤ 0,7·I_z,Basis[A]` |
| RM-3 | **Kurzschluss & Abschaltvermögen** | `I_k = U_bank/(R_i,Bank + R_Leitung)`; R_i,Ersatz aus Parallelschaltung                         | **Reihenfolge-Invarianz** als explizite Eigenschaft: `I_k(perm(B)) = I_k(B)` für alle Permutationen     |
| RM-4 | **AC-Schutzkette**                 | `I_a = k·I_n`, `Z_s,max = (2/3)·U₀/I_a`, PE nach Tabelle 54.2                                   | Tabellenstützstellen (S ≤ 16 → S, 16 < S ≤ 35 → 16, S > 35 → S/2) und Fallunterscheidung B/C            |
| RM-5 | **Energie & Kapazität**            | `Ah = Wh·d/(U·DoD)`, Peukert-Faktor, Ladestrom                                                  | Geschlossene Form; Peukert-Grenzfälle (`I ≤ I_20 ⇒ Faktor 1`, Monotonie fallend in I)                   |

### 5.3 Referenzfälle (fachlich belegt vs. Modellannahme)

| Fall                                      | Werte                                 | Belegstatus                                                                  |
| ----------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| Sandwich-Grenze 2,5 mm²                   | `I_n ≤ 16 A`, `I_z,design = 16,10 A`  | **Modellwert** (abgeleitet aus 0298-4-Transkription × 0,7) — kein Normzitat  |
| Koordination `I_n ≤ I_z`                  | IEC 60364-4-43 §433.1 (Bedingung 1)   | **Normbeleg** (Klausel vorhanden)                                            |
| `I₂ ≤ 1,45 · I_z`                         | IEC 60364-4-43 §433.1 (Bedingung 2)   | **Normbeleg**                                                                |
| Ungeschützte Länge 200 mm                 | ISO 13297:2020 §8.1; ABYC E-11 178 mm | **Normbeleg**, im Repo korrekt zitiert                                       |
| AC-Abschaltung B/C                        | IEC 60898-1 (B: 3–5×, C: 5–10×)       | **Normbeleg**; CAMP rechnet mit 5×/10× (obere Kante) — Annahme dokumentieren |
| 2/3-Regel                                 | DIN VDE 0100-600                      | **Normbeleg**                                                                |
| PE-Querschnitt                            | IEC 60364-5-54 Tab. 54.2              | **Normbeleg**                                                                |
| Leerrohrfüllung 40 %                      | DIN VDE 0100-520                      | **Normbeleg**                                                                |
| ΔU-Budget 1/3/4 % und 0,36 V / 4,6 V      | Keine Normstelle                      | **MODELL_ANNAHME** — muss so heißen, überall                                 |
| Solar 1,25 / 1,5625                       | NEC-Näherung, kein IEC-Beleg im Repo  | **MODELL_ANNAHME** (`UNVERIFIED` als Normzitat)                              |
| Peukert-Exponenten                        | Chemie-Faustwerte                     | **UNVERIFIED** (Datenblatt schlägt)                                          |
| `UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0,8` | Keine Quelle                          | **UNVERIFIED**, in `ENGINE_LIMITATIONS` benannt                              |
| Selektivität 1,6:1                        | Verhältnis-Heuristik                  | **MODELL_ANNAHME**                                                           |

**Konsequenz für die Testarbeit:** Ein Referenztest darf nur dort „grün als
Beweis“ heißen, wo ein **Normbeleg** existiert. Für Modellannahmen lautet die
Assertion nicht „der Wert ist richtig“, sondern **„der Wert ist der vereinbarte
Modellwert und ändert sich nicht unbeabsichtigt“** — mit Verweis auf dieses
Kapitel. Das ist ein Unterschied in der Aussagekraft, der heute nirgends
dokumentiert ist.

---

## 6. Safety Invariants

Die folgenden Invarianten sind als **ausführbare Sätze** formuliert, nicht als
Prosa. Jede hat: ID, Aussage, Geltungsbereich, Prüfmethode, heutigen Status
(`HOLDS` belegt / `HOLDS` ungetestet / `VIOLATED` belegt).

### 6.1 Kerninvarianten (Freigabe)

| ID     | Invariante                                                                                                                                                                                            | Prüfmethode                                                                                                       | Status heute                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| I-E-01 | **Keine Freigabe bei unzulässigen Eingaben.** Jede Funktion, die einen Sicherheitsbefund liefert, wirft bei unzulässiger Eingabe `RangeError` — sie liefert nie einen Default.                        | Property-Test über ungültige Wertebereiche (NaN, ±∞, negativ, String) je Sicherheitsfunktion                      | `HOLDS` ungetestet (punktuell belegt: `resolveCableConditions`, `ambientTemperatureFactor`, `conductorResistanceOhm`)   |
| I-E-02 | **Fehlende Eingabe ⇒ nie PASS.** Fehlt ein für die Entscheidung nötiger Wert, lautet das Ergebnis `UNPROVABLE`/`incomplete`, nie `PASS`/`satisfied`.                                                  | Metamorphik + direkte Fälle; Gate über alle Regeln (`UNVERIFIABLE`-Zählung)                                       | `HOLDS` belegt für `AMP-001` (Minimalplan), **`VIOLATED`** in `evaluateLoadFeasibility` (Befund E-2)                    |
| I-E-03 | **Sicherung nie über Leitungsschutz.** `I_n ≤ I_z` für jede ausgegebene Sicherung, in **jeder** Schicht (AutoWire, Engine, Anzeige).                                                                  | Property über alle Normquerschnitte + Differential gegen RM-2                                                     | `HOLDS` belegt (G1, `FUSE_MAP ≤ 0,7·I_z,Basis`) — aber **nicht** in `maxFuseForConditions` (Befund T-1, Hersteller-I_z) |
| I-E-04 | **Ein ΔU-Grenzwert je Domäne.** DC und AC dürfen nicht in derselben Konstante geprüft werden, wenn sie verschieden dimensioniert werden.                                                              | Unit-Test auf `hasVoltageDropError(isAC)` + Referenztest RM-1                                                     | **`VIOLATED`** (Befund K-2)                                                                                             |
| I-E-05 | **BMS-Grenze nie ignorieren.** Ist eine BMS-Grenze bekannt, ist sie Teil des Minimums; ist sie unbekannt, ist das Ergebnis „nicht bewertbar“ und darf nicht als „in Ordnung“ erscheinen.              | Property über Budget-Kombinationen; Consumer-Audit (jeder `feasible`-Leser)                                       | **`VIOLATED`** (Befund E-2)                                                                                             |
| I-E-06 | **Korrekturfaktoren in zulässigen Grenzen.** `0 < f₁ ≤ 1` (kein Kältebonus), `f₂ ∈ Tabelle`, `0 < f₃ ≤ 1`, `min(0,7, f₁·f₂·f₃)` — keine Kombination darf I_z erhöhen.                                 | Property über (ϑ, n, f₃)-Raster gegen `I_z,Basis`                                                                 | `HOLDS` belegt (Guards + `min`)                                                                                         |
| I-E-07 | **Fehlende Daten nie durch günstige Defaults ersetzen.** Kein `?? 0`, `?? {…}`, `                                                                                                                     |                                                                                                                   | ` auf sicherheitskritischen Feldern.                                                                                    | Statischer Test (AST-Grep über `lib/electrical*.ts`, `lib/verify/*`, `lib/autoWire/*`) + Property-Tests | `HOLDS` teilweise (`safety-no-silent-fallback.test.ts` deckt die historischen fünf Fälle; **kein** statischer Test) |
| I-E-08 | **UNVERIFIABLE nie als COMPLIANT.** Verdikt-Reihenfolge: `FAIL` > `UNPROVABLE` > `PASS`; ein leeres Regel-Set ergibt nie `COMPLIANT`.                                                                 | Unit-Test `verdictOf` + leerer Plan                                                                               | `HOLDS` belegt (leerer Plan ⇒ `INCOMPLETE`, `decisionRatio 0`)                                                          |
| I-E-09 | **Konsistenz Engine / AutoWire / Warnsystem / Bericht.** Für jede Kante gilt: `I_b`, `I_z`, `ΔU` und das Urteil sind in allen vier Schichten gleich oder die Abweichung ist als Modellgrenze benannt. | Differential-Test über die sechs Referenzpläne: Engine-Events vs. AutoWire-Verdikt vs. `verificationWarning`-Text | **`VIOLATED`** (Befund K-4: `cableCanCarry: true` vs. `AMP-001` FAIL)                                                   |
| I-E-10 | **Ein Verdikt ist nur mit Profil gültig.** Bericht und Anzeige nennen Profil und Kontext; ein Verdikt ohne Profil darf nicht als Prüfaussage exportiert werden.                                       | Schema-Test auf `VerificationReport.certificate` + Export-Audit                                                   | `HOLDS` strukturell (Zertifikat trägt Profil) — **nicht erzwungen** (Befund A-1)                                        |
| I-E-11 | **Repräsentationsinvarianz.** Knoten-/Kantenreihenfolge und Objektidentität dürfen kein Urteil ändern.                                                                                                | Property: Permutation der Eingabe ⇒ gleicher `certificateHash` und gleiche Eventliste (Menge)                     | `HOLDS` für die Engine insgesamt (belegt: acdc), **`VIOLATED`** für Bank-I_k (Befund K-3)                               |
| I-E-12 | **Kein Verdikt ohne Trace.** Jedes `FAIL`/`UNPROVABLE` trägt Eingaben, Formel, Quelle, Einheit und Rechenweg.                                                                                         | Schema-Test über alle Events aller Referenzpläne                                                                  | `HOLDS` teilweise (`details.izBreakdown`, `contributors` vorhanden; **Lücken** bei VDR/PWR)                             |

### 6.2 Was eine Invariante hier leisten muss

Eine Invariante ist nur brauchbar, wenn sie **fehlschlagen kann**. Formulierungen
wie „die Berechnung ist korrekt“ sind wertlos. Jede Invariante in 6.1 ist
deshalb an eine **konkrete, ausführbare Prüfung** gebunden, und fünf von ihnen
(`I-E-02`, `I-E-04`, `I-E-05`, `I-E-09`, `I-E-11`) sind heute **rot**. Das ist
das Ergebnis dieser Bestandsaufnahme: nicht „alles gut“, sondern „fünf Stellen,
an denen das Modell seine eigene Zusage bricht, jede mit einer Zahl“.

---

## 7. Calculation Trace

### 7.1 Warum ein Trace ein Sicherheitsmerkmal ist

Ein Wert ohne Herkunft ist nicht prüfbar. Heute existiert ein **halber** Trace:
`AuditEvent.details` trägt `ibA`, `inA`, `izA`, `contributors`, `assumptions`,
`izBreakdown` und `calculationMethod` (`lib/verify/types.ts`, `AuditEventDetails`).
Das ist mehr als in den meisten Planern — aber es ist **nicht vollständig** und
**nicht erzwungen**:

- `VDR-001/002` (Spannungsfall) tragen keinen Rechenweg (κ, ρ, Länge, A fehlen).
- `PWR-001` (Energiebilanz) trägt keinen Peukert-Zwischenschritt.
- Rundungen sind nirgends ausgewiesen.
- Die Datenquellen-Version (`VDE_AMPACITY`-Transkription, Stand) steht in Prosa,
  nicht im Befund.
- Für den Nutzer sichtbar ist der Trace nur über die UI-Karte „Warum?“, nicht
  als exportierbares Artefakt.

### 7.2 Sollstruktur eines Traces

```ts
interface CalculationTrace {
  /** Was wurde gerechnet (stabile ID, z. B. 'voltage-drop-edge'). */
  calculationId: string;
  /** Ergebnis mit Einheit. */
  result: { value: number; unit: Unit };
  /** Eingaben mit Einheit und Herkunft (Plan, Datenblatt, Annahme). */
  inputs: ReadonlyArray<{
    name: string;
    value: number | null;
    unit: Unit;
    source: 'plan' | 'datasheet' | 'model-default' | 'missing';
  }>;
  /** Formel als Symbol (nicht als Fließtext): 'dU = I * 2L / (kappa * A)'. */
  formula: string;
  /** Konkrete Zwischenschritte in Reihenfolge (jeder mit Einheit). */
  steps: ReadonlyArray<{ label: string; value: number; unit: Unit }>;
  /** Korrektur-/Sicherheitsfaktoren, die tatsächlich angewandt wurden. */
  factors: ReadonlyArray<{ name: string; value: number; applied: boolean; basis: string }>;
  /** Rundung: Rohwert, gerundeter Wert, Regel. */
  rounding?: { raw: number; rounded: number; rule: 'none' | 'floor-step' | '2dp' | 'ceil-step' };
  /** Datenquelle mit Version/Stand. */
  provenance: { kind: Provenance; reference: string; version: string | null };
  /** Annahmen, die das Ergebnis tragen (leer = keine). */
  assumptions: readonly string[];
  /** Verifikationsstatus dieses Traces. */
  status: 'verified-norm' | 'verified-datasheet' | 'model-assumption' | 'unverified';
}
```

### 7.3 Regeln für den Trace

1. **Jede Zahl, die ein Verdikt trägt, hat einen Trace.** Kein `FAIL` und kein
   `UNPROVABLE` ohne vollständigen Trace (Invariante I-E-12).
2. **Der Trace ist Datenprodukt, nicht Text.** Er entsteht aus denselben Werten,
   die gerechnet wurden — nicht aus einer zweiten, „lesbaren“ Rechnung. Das
   Muster steht bereits im Repo: `evaluateCableProtection` setzt seine
   Erklärung aus den **tatsächlich geprüften Teilstücken** zusammen („I_b = 24,0
   A ≤ I_n = 25,0 A ✓ · I_n = 25,0 A > I_z = 25,0 A ✗“) statt eine Soll-Form mit
   Ist-Werten zu drucken. Dieses Muster ist auf alle Regeln zu übertragen.
3. **Trace ist hash-neutral.** Das Zertifikat hasht Verdikt + Regelstatus +
   Abdeckung, **nicht** die Events (so bereits dokumentiert in
   `lib/verify/types.ts`). Der Trace darf also wachsen, ohne Zertifikate zu
   brechen — Voraussetzung dafür, dass Nachrüsten keine Golden-Master-Welle
   auslöst.
4. **Fehlende Eingabe ist ein Trace-Schritt**, kein Schweigen: `source: 'missing'`
   mit `value: null` und dem daraus folgenden `UNPROVABLE`.
5. **Der Trace ist exportierbar** (JSON) und im Bericht als Anhang enthalten —
   sonst ist er für eine fachliche Prüfung durch Dritte unbrauchbar.

### 7.4 Trace-Lücken, die zu schließen sind (Reihenfolge)

| Priorität | Lücke                                                                              | Aufwand | Warum zuerst                                                                                     |
| --------- | ---------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| 1         | `VDR-001/002` vollständiger Trace (I, L, A, κ/ρ, T)                                | klein   | ΔU ist der häufigste Befund; ohne Trace ist die Display-Diskrepanz (K-1) nicht erklärbar         |
| 2         | `AMP-001/002` mit `izBreakdown` auch bei **Verstoß**                               | klein   | heute nur im Gutfall vollständig                                                                 |
| 3         | `PWR-001` mit Peukert-Zwischenschritten                                            | mittel  | Energiebilanz ist die einzige Regel mit `EFFICIENCY_WARNING` — sie wird deshalb leicht ignoriert |
| 4         | `shortCircuit`-Kette (R_i, U_bank, R_Leitung → I_k)                                | mittel  | trägt `AMP-004` (`CRITICAL_SAFETY`) und ist heute der reihenfolgeabhängige Punkt (K-3)           |
| 5         | Rundungsregeln explizit (`Math.round`, `ceil` auf 5-Ah-Stufen, 2 Nachkommastellen) | klein   | drei Stellen runden heute unsichtbar                                                             |

---

## 8. CI-Sicherheitsgates

### 8.1 Ist-Zustand

`quality.yml` prüft heute: Lockfile-Gate, Deploy-Trigger, Lint, Format,
Typecheck (2×), `test:coverage` (Gate `lib/**`), `perf:edge-routing`,
`routing:audit`, Build, Static-Export-Prüfung, E2E, Lighthouse.
`scripts/ci/workflows.test.ts` erzwingt SHA-Pinning, `npm ci`, `.nvmrc`-Herkunft
und das Fehlen von Skip-Ausgängen.

**Nicht vorhanden:** Mutation-Gate, Invarianten-Gate, Differential-Gate,
Golden-Master-Verdikt-Gate, Trace-Vollständigkeits-Gate, Formel-Änderungs-Gate.
Das ist die Lücke, die dieses Kapitel schließt.

### 8.2 Die sieben Gates

| Gate                                               | Inhalt                                                                                                                                                                                                                    | Bricht ab, wenn …                                                                                                      | Aufwand            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **G1 Kritische Referenztests**                     | Kuratierte Suite (`test:safety`) über alle Sicherheitsfunktionen gegen RM-1…RM-5                                                                                                                                          | ein Referenzfall abweicht                                                                                              | klein              |
| **G2 Keine unerklärten Differential-Abweichungen** | Jede Abweichung Produktivfunktion ↔ Referenzmodell muss in einer **Allowlist mit Begründung** stehen (Datei `test/reference/allowlist.ts`, je Eintrag: Pfad, Toleranz, Begründung, Ablaufdatum)                           | eine neue Abweichung ohne Eintrag auftritt **oder** ein Eintrag abgelaufen ist                                         | mittel             |
| **G3 Keine Invariantenverletzung**                 | I-E-01…I-E-12 als Testsuite (`test:invariants`), inkl. Permutations-/Missing-Input-Properties                                                                                                                             | eine Invariante rot ist (heute: I-E-02, I-E-04, I-E-05, I-E-09, I-E-11 → **Gate startet rot**, deshalb Stufenplan 8.3) | mittel             |
| **G4 Keine unentdeckten kritischen Mutationen**    | Stryker über **kuratiertes Set** (die 5 schwächsten Module, `concurrency: 1`, `perTest`, node-env), Schwelle: **kein** `Survived` in als kritisch markierten Zeilen                                                       | ein kritischer Mutant überlebt                                                                                         | mittel (Laufzeit!) |
| **G5 Keine Golden-Master-Regression**              | `test:goldenmaster` **plus** neuer Verdikt-Snapshot: `{plan → verdict, certificateHash, Event-Multiset}`                                                                                                                  | sich ein Verdikt oder der Certificate-Hash ohne Recapture-Begründung ändert                                            | klein              |
| **G6 Kein stilles UNVERIFIABLE → PASS**            | Zähl-Gate: Summe `FAIL + UNPROVABLE` je Plan darf nicht sinken, ohne dass die Änderung das begründet; `decisionRatio` wird mitgeschrieben                                                                                 | eine `UNPROVABLE`-Regel in `PASS` übergeht oder `decisionRatio` ohne Begründung steigt                                 | klein              |
| **G7 Formel-/Tabellen-Änderung nur mit Freigabe**  | Pfad-basierter Check: Änderung an `lib/electrical.ts`, `lib/vde-standards.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`, `lib/routing/invariants.ts` ⇒ PR braucht Label `safety-review` **und** Approval von `@CAZE7` | eine dieser Dateien ohne Label/Approval geändert wird                                                                  | klein              |

**G7 ist umsetzbar, weil** `* @CAZE7` der einzige CODEOWNER ist
(`.github/CODEOWNERS`) und `AGENTS.md` §6 diese Dateien bereits als
DO-NOT-TOUCH führt. Es fehlt nur die **Durchsetzung**. Technisch: GitHub
Ruleset „Require review from Code Owners“ + Workflow-Job, der das Label prüft.

### 8.3 Stufenplan (weil G3 heute rot startet)

Ein Gate, das sofort rot ist, wird abgeschaltet. Deshalb drei Stufen:

| Stufe  | Zeitraum        | Inhalt                                                                                                                                                                           |
| ------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** | sofort          | G1, G5, G6, G7 aktiv. Alle zwölf Invarianten existieren als Tests; die fünf heute roten (`I-E-02/04/05/09/11`) laufen als `it.fails` — sichtbar, dokumentiert, nicht blockierend |
| **S2** | nach Befund-Fix | I-E-04, I-E-05, I-E-11 reparieren (kleine, klar begrenzte Änderungen — **nicht** in diesem Dokument umgesetzt), dann G3 vollständig scharf                                       |
| **S3** | danach          | G2 mit Allowlist, G4 mit kuratiertem Mutations-Set; `decisionRatio`-Budgets je Plan                                                                                              |

**Wichtig:** G4 läuft **nicht** über `lib/**`. Gemessen: 790 s für 781 Mutanten
in zwei Dateien, zwei parallele Worker ⇒ `SIGKILL` (Speicher). Das Gate läuft
deshalb über ein **zeilenweise kuratiertes Set** aus den fünf schwächsten
Modulen — `designBudget.ts` (48,4 %), `sizing.ts` (56,5 %), `shortCircuit.ts`
(61,8 %), `constraints.ts` (66,4 %), `peukert.ts` (73,8 %) — begrenzt auf
**≤ 400 Mutanten**, `concurrency: 1`, als **nächtlicher** Job, nicht als
PR-Gate. Das kuratierte Set ist die Liste der Stellen aus Kapitel 3.2
(`batterySizing.ts:111–136`, `peukert.ts:46–50`, `shortCircuit.ts:108–158`, …),
nicht die ganze Datei.

### 8.4 Neue Skripte (Namen, noch nicht angelegt)

```
npm run test:safety       # test/reference/** + test/invariants/**; G1 + G3   ✅ vorhanden
npm run test:invariants   # test/invariants/**; G3                           ✅ vorhanden
npm run test:differential # Produktiv vs. RM-1…RM-5; nur G0                   ⚠️ G2 NICHT scharf
npm run test:trace        # Trace-Vollständigkeit (I-E-12) — heute Teil von test:invariants
npm run mut:critical      # Stryker, kuratiertes Set; G4                       ⬜ offen
npm run verify:snapshot   # Verdikt-/Hash-Snapshot; G5 — heute Test, kein Skript ⬜ offen
```

`test:safety`, `test:invariants` und `test:differential` sind seit diesem PR
gesetzt (`package.json`). G5 läuft als Test (`test/invariants/verdict-snapshot.test.ts`)
und braucht kein eigenes Skript: der Snapshot steht im Testfile, die Diff-Ausgabe
von Vitest ist aussagekräftiger als die eines eigenen Vergleichswerkzeugs.
`test:trace` und `mut:critical` bleiben offen; ihre Inhalte sind in Kapitel 7.4
bzw. 8.3 spezifiziert.

**Wichtige Einschränkung zu G2 (Audit 2026-11-05).** Die `ALLOWLIST` in
`differential.test.ts` ist heute **nicht verdrahtet**. Sie wird ausschließlich
von `G0` gelesen, und `G0` prüft nur ihre Form (Grund, Ablaufdatum, Befund-ID)
sowie das Ablaufdatum — **keine** der drei Produktivfunktionen aus dem
Differentialvergleich konsultiert sie. Die Toleranzen stehen stattdessen als
Literale im jeweiligen Test (`0.015` für K-1, `0.01` für R_fuse) bzw. sind für
K-3 gar nicht als Toleranz formuliert.
Damit ist G2 **nicht** implementiert: ein Abweichungswert lässt sich ändern,
ohne dass ein Allowlist-Eintrag entsteht oder abläuft. Die Allowlist ist heute
eine **Dokumentation mit Ablaufdatum**, kein Gate. Das ist in Kapitel 8.2 als
„mittel" Aufwand geführt und bleibt offen (Kapitel 12.5, Folge-PR).

---

## 9. Umsetzungsplan mit Prioritäten

Sortiert nach **Risikoreduktion pro Aufwand**, nicht nach Vollständigkeit.

| #   | Maßnahme                                                                             | Behebt / belegt                         | Aufwand | Abhängigkeit |
| --- | ------------------------------------------------------------------------------------ | --------------------------------------- | ------- | ------------ |
| 1   | Verdikt-Snapshot der sechs Pläne (G5) + Doku „kein Plan ist COMPLIANT“               | macht Ist-Zustand regressionsfest       | klein   | keine        |
| 2   | `test:safety` mit RM-2 (Koordination) und RM-4 (AC-Kette)                            | erste unabhängige Orakel                | klein   | keine        |
| 3   | I-E-12-Test: jedes `FAIL`/`UNPROVABLE` hat `details` mit Werten                      | Trace-Vollständigkeit messbar           | klein   | keine        |
| 4   | Befund K-4 fix (Designbudget nutzt Kanten-Bedingungen) + Differentialtest            | I-E-09                                  | klein   | 2            |
| 5   | Befund K-2 fix (ΔU AC = 2 % in der Anzeige) + Test `hasVoltageDropError(isAC)`       | I-E-04                                  | klein   | keine        |
| 6   | Befund K-3 fix (`bankVoltage` = Median/Majorität, nicht „erster“) + Permutationstest | I-E-11                                  | klein   | keine        |
| 7   | Befund E-2 fix (`feasible` dreiwertig machen; Consumer anpassen)                     | I-E-02, I-E-05                          | mittel  | 4            |
| 8   | Befund E-1 fix (`constraints.ts` meldet verworfene Werte)                            | Regel M an der Eingabegrenze            | klein   | keine        |
| 9   | RM-1 (ΔU) + RM-3 (Kurzschluss) + Differential-Gate G2                                | K-1 wird messbar statt behauptet        | mittel  | 2            |
| 10  | Calc-Trace-Struktur (7.2) + Befüllung für VDR/AMP (7.4 Prio 1–2)                     | I-E-12 vollständig                      | mittel  | 3            |
| 11  | G4 Mutation (kuratiertes Set, nächtlich)                                             | schließt die 48–67 %-Lücken strukturell | mittel  | 1            |
| 12  | G7 Ruleset + `safety-review`-Labels                                                  | Formeländerung nur mit Freigabe         | klein   | Repo-Admin   |
| 13  | Golden Pläne: Doku ergänzen, dass `acdc`/`complex` **Befund**-Pläne sind             | Lesbarkeit der Referenzen               | klein   | keine        |
| 14  | RM-5 (Energie/Kapazität) + Fuzz auf Plan-Import                                      | letzte Orakel-Lücke                     | mittel  | 2            |

**Reihenfolge-Logik:** Punkte 1–3 erzeugen sofort Regressionsschutz ohne
Verhaltensänderung. Punkte 4–8 reparieren die fünf roten Invarianten — jede
Änderung ist klein und lokal, keine Formel wird neu erfunden, nur die
**Verknüpfung** zwischen vorhandenen Wahrheiten korrigiert. Ab Punkt 9 entsteht
die eigentliche Differentialprüfung. Punkt 11 schließt die Coverage-Lücke
strukturell.

---

## 10. Was dieses Konzept ausdrücklich NICHT tut

- Es ändert **keine** Formel, **keine** Tabelle, **keinen** Grenzwert. Alle
  Befunde sind beschrieben, keiner ist behoben — das ist eine bewusste
  Entscheidung, weil (a) diese Datei die einzige Lieferung dieses Auftrags ist
  und (b) eine Änderung an `lib/electrical.ts` eine gesonderte Freigabe
  braucht (`AGENTS.md` §6).
- Es schwächt **keinen** bestehenden Test ab. Die fünf roten Invarianten werden
  als `it.fails` **sichtbar** markiert, nicht gelöscht (Stufe S1).
- Es erfindet **keine** Normwerte. Wo eine Normstelle fehlt, steht
  `MODELL_ANNAHME` oder `UNVERIFIED` (Kapitel 5.3).
- Es führt **keine** Abhängigkeit ohne Prüfung ein. `fast-check` bleibt wie es
  ist; Stryker ist geprüft (10.1.1, gemessen) und wird nur kuratiert eingesetzt;
  Z3 ist begründet abgelehnt (Kapitel 3.3).
- Es verspricht **keine** vollständige formale Verifikation. Die Invarianten
  sind laufende Tests über endliche, sicherheitsrelevante Domänen — das ist
  mehr als heute und weniger als ein Beweis, und es wird auch so genannt.

---

## 11. Offene Punkte, Modellgrenzen und Abnahme

### 11.1 UNVERIFIED (bewusst offen, nicht geraten)

| Punkt                                                     | Warum offen                                                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Zulässigkeit, dass ein Plan Querschnitte > 70 mm² führt   | fachliche Freigabefrage (Befund M-1), nicht durch Tests entscheidbar                               |
| Normbeleg für Solar 1,25 / 1,5625                         | im Repo nur als NEC-Näherung dokumentiert; IEC 60364-7-712 wäre zu prüfen, ohne Zitat zu behaupten |
| `UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0,8`                 | keine Quelle; als Annahme geführt, nicht als Wert                                                  |
| Peukert-Exponenten je Chemie                              | Faustwerte; Datenblatt schlägt, Modell kann es nicht besser                                        |
| Selektivität 1,6:1                                        | Verhältnis-Heuristik ohne Durchlassenergiedaten                                                    |
| Eignung von `@stryker-mutator/vitest-runner` 10.1.1 im CI | lokal tragfähig, in CI nicht verifiziert                                                           |
| Ob `decisionRatio` ein sinnvolles Budget je Plan ist      | Messung fehlt (Kapitel 2.2 zeigt nur Momentaufnahmen)                                              |

### 11.2 Modellgrenzen (bleiben, sind aber zu benennen)

Die 230-V-Logik ist einleiterig; L/N/PE, Netzform, Umschaltung
Landstrom/Wechselrichter, Rückspeiseschutz und die normative Abnahme sind
**nicht** modelliert (`ENGINE_LIMITATIONS`, `docs/AC-230V-MODELLGRENZEN.md`,
`NET-003` in drei Bewertungsstufen). Diese Grenzen sind heute gut dokumentiert —
was fehlt, ist ein **Test, der ihre Vollständigkeit erzwingt**: jede neue
Berechnung, die eine Modellgrenze berührt, muss sie im Bericht nennen.

### 11.3 Abnahmekriterien für dieses Dokument

1. Alle zehn Berechnungsfamilien aus dem Auftrag sind mit Formel, Eingaben,
   Ausgaben, Einheiten, Quelle, Annahmen, Grenzwerten und Tests erfasst
   (Kapitel 1).
2. Jede Aussage über den Ist-Zustand ist **gemessen** und mit Zahl belegt
   (Kapitel 2, 3.2, 4).
3. Jede Methode aus dem Auftrag ist bewertet — eingeführt, abgelehnt oder
   zurückgestellt, jeweils mit Begründung (Kapitel 3).
4. Unabhängige Referenzmodelle sind spezifiziert, ohne produktive Funktionen
   wiederzuverwenden (Kapitel 5).
5. Safety Invariants sind ausführbar formuliert, mit heutigem Status (Kapitel 6).
6. Calculation Trace ist als Struktur definiert und in Lücken priorisiert
   (Kapitel 7).
7. CI-Gates sind benannt, mit Abbruchbedingung und Stufenplan (Kapitel 8).
8. ~~Keine Datei außer dieser wurde angelegt oder geändert; keine Formel wurde
   verändert.~~ **Überholt durch den Umsetzungs-PR:** angelegt wurden
   `test/reference/*` (5 Modelle + Differentialtest), `test/invariants/*`
   (3 Suiten) und drei `package.json`-Skripte. Weiterhin gilt: **keine Formel,
   keine Tabelle, kein Grenzwert wurde verändert** (Kapitel 12).

### 11.4 Nächster Schritt nach Freigabe

Ein PR mit **Punkt 1–3** aus Kapitel 9 (Verdikt-Snapshot, `test:safety` mit
RM-2/RM-4, Trace-Vollständigkeitstest). Diese drei Maßnahmen ändern **kein**
Produktionsverhalten, erzeugen aber die erste unabhängige Belegschicht und
machen jede spätere Formeländerung sofort sichtbar. Danach die Befunde K-2 bis
K-4 und E-1/E-2 als eigene, einzeln prüfbare PRs mit `safety-review`-Label.

---

## 12. Umsetzungsstand (Stand: 2026-11-05)

Dieses Kapitel ist der **Nachweisteil**: es sagt, was von Kapitel 8 und 9
tatsächlich existiert, was gemessen wurde und was rot ist. Alles darunter ist
reproduzierbar durch `npm run test:safety`.

### 12.1 Was jetzt existiert

| Datei                                             | Inhalt                                                                                             | Tests  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------ |
| `test/reference/rm1-voltage-drop.ts`              | ΔU nach IEC 60364-5-52, ρ(T) statt κ, eigene Konstanten                                            | –      |
| `test/reference/rm2-ampacity.ts`                  | Belastbarkeit + Sicherungskoordination, inklusive inklusiver Stufenkante                           | –      |
| `test/reference/rm3-shortcircuit.ts`              | Kurzschlusskette R_i → U_bank → R_Leitung → I_k                                                    | –      |
| `test/reference/rm4-ac-protection.ts`             | AC-Schutzkette (RCD, MCB, Auslösecharakteristik)                                                   | –      |
| `test/reference/rm5-energy.ts`                    | Kapazität/Energie mit Peukert, DoD, Ladefenster                                                    | –      |
| `test/reference/differential.test.ts`             | G0 (Importfreiheit + Allowlist-Form) + Vergleich Produktiv ↔ RM-1…RM-5 (fast-check, Seed 20261105) | **48** |
| `test/invariants/electrical-invariants.test.ts`   | I-E-01 … I-E-12 als ausführbare Sätze                                                              | **51** |
| `test/invariants/verdict-snapshot.test.ts`        | G5: Verdikt + Zertifikat-Hash + Ereignis-Multimenge der sechs Referenzpläne                        | **10** |
| `test/invariants/determinism-metamorphic.test.ts` | M-1…M-6: Determinismus, Permutationsinvarianz, Monotonie, Skalierung                               | **18** |

Zusammen **128 Tests** in vier Dateien, Laufzeit unter 10 s (davon 7 `it.fails`).

**Kein Produktivimport in den Referenzmodellen** — das ist jetzt **erzwungen**,
nicht nur gemessen: G0 liest die fünf Dateien und verbietet jeden `import`,
`require()` und dynamischen `import()`. Der Nachweis, dass das Gate greift,
wurde beim Audit geführt (ein testweise eingefügter Import in
`rm4-ac-protection.ts` macht die Suite rot).

### 12.2 Rot und trotzdem sichtbar: die sieben `it.fails`

Sieben Invariantenprüfungen sind heute **bekannt verletzt** und laufen als
`it.fails` (Stufe S1 aus Kapitel 8.3). Kein Test wird abgeschwächt, keiner
gelöscht — die Verletzung bleibt als Befund mit ID im Repo:

| Test                                                  | Befund | Reparatur                    |
| ----------------------------------------------------- | ------ | ---------------------------- |
| E-2: ohne Grenze darf `feasible` nicht true sein      | E-2    | Kapitel 9, Punkt 7           |
| E-1: nicht-numerischer Grenzwert muss gemeldet werden | E-1    | Punkt 8                      |
| K-2: AC muss mit 2 % geprüft werden                   | K-2    | Punkt 5                      |
| K-2b: die Engine muss AC-Leitungen auf ΔU prüfen      | K-2    | Punkt 5 (größer als gedacht) |
| K-4: Designbudget muss die Kantenbedingungen achten   | K-4    | Punkt 4                      |
| K-3: Bank-I_k muss reihenfolgeunabhängig sein         | K-3    | Punkt 6                      |
| I-E-12: ΔU-Befund ohne Rechenweg (jetzt **T-2**)      | T-2    | Punkt 10                     |

**`it.fails` ist hier kein Freibrief.** Sobald eine Reparatur landet, meldet
Vitest „Test passed unexpectedly“ — die Umstellung auf `it` ist dann Pflicht.
Damit kann eine Verbesserung nicht stillschweigend passieren und ein Rückfall
nicht unbemerkt bleiben.

### 12.3 Was der erste Differentiallauf gefunden hat

Der Lauf über die fünf Referenzmodelle förderte vier echte Befunde und zwei
Fehler in **meinen** Referenzmodellen zutage (Befund D-2, Kapitel 4.13, ist der
interessanteste, weil er zuerst wie ein Produktivfehler aussah und sich als
Gleitkomma-Frage auf beiden Seiten entpuppte):

| Beobachtung                                           | Einordnung                                            |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `κ = 58` ist nicht `1/0,0175`                         | Konstantenrundung, kein Fehler → Befund K-1, mit Zahl |
| `f₁ > 1` bei Kälte                                    | eigene Fehlannahme, Invariante ist `I_z ≤ I_z,Basis`  |
| `evaluateAcEdgeProtection` kennt `ok-with-assumption` | Produktiv **genauer** als RM-4 — kein Befund          |
| `R_fuse` weicht 0,33 % ab                             | Toleranz 1 %, begründet (Kapitel 4.14)                |
| 16,1 A ⇒ 4,0 vs. 2,5 mm²                              | Befund D-2 (Kapitel 4.13)                             |

Das ist der eigentliche Ertrag: nicht „die Produktion ist falsch“, sondern
„drei Stellen, an denen zwei unabhängige Rechnungen **auseinanderlaufen**, jede
mit Betrag, Domäne und Richtung“.

### 12.4 Was dieser PR ausdrücklich nicht getan hat

- **Keine Formel, keine Tabelle, kein Grenzwert geändert.** Alle Befunde sind
  beschrieben, keiner ist behoben. Änderungen an `lib/electrical.ts` u. a.
  brauchen Freigabe (`AGENTS.md` §6, Gate G7).
- **Keine CI-Verdrahtung.** Die Skripte existieren und laufen lokal; ein
  Workflow-Job, der sie blockierend ausführt, braucht `safety-review` und ist
  ein eigener PR.
- **Kein Mutation-Gate (G4).** Das kuratierte Set ist spezifiziert, nicht
  gebaut.
- **Keine Aussage über Normkonformität der Anlage.** Die Referenzmodelle sind
  Modelle, keine Zertifizierung; jeder `UNVERIFIED`-Punkt aus Kapitel 11.1 gilt
  unverändert.

---

## 12.5 Unabhängiges Qualitätsaudit (2026-11-05)

Dieses Kapitel ist das Ergebnis einer **fremden** Durchsicht der
Referenzmodelle, Invarianten und Gates — nicht der Selbstauskunft des PRs.
Es trennt ausdrücklich, was geprüft wurde, was dabei gefunden wurde und was
weiterhin offen ist.

### 12.5.1 Was das Audit bestätigt hat

| Prüfung                                                      | Ergebnis                                                                                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `it.fails` schlägt an, sobald die Verletzung behoben wird    | **belegt** (Kontrolltest: `expect(true).toBe(true)` unter `it.fails` ⇒ Suite rot)                                                                                             |
| Die sieben `it.fails` scheitern aus dem dokumentierten Grund | **belegt für 6 von 7** (Assertion-Meldungen einzeln nachgelesen); der siebte war falsch formuliert, s. A-4                                                                    |
| Tests laufen im regulären CI-Lauf mit                        | **belegt** — `vitest.config.ts` excludiert nur `tests/e2e/**`; `test/reference` und `test/invariants` sind Teil von `npm run test:coverage` im Job „Typecheck, Tests & Build" |
| Kein Produktivimport in `rm1`…`rm5`                          | **belegt** (0 `import`-Zeilen)                                                                                                                                                |
| Permutationsinvarianz der Engine                             | **belegt** über alle sechs Referenzpläne (M-2)                                                                                                                                |
| Verdikt-Snapshot verdeckt keine Verschlechterung             | **belegt** — Hash + Ereignis-Multimenge, keine Textmeldungen                                                                                                                  |
| Lighthouse-Befund ist nicht durch diesen PR verursacht       | **belegt** — der PR ändert ausschließlich `docs/` und `test/`; derselbe Job ist auf dem reinen Doku-PR #604 rot                                                               |

### 12.5.2 Was das Audit korrigiert hat (in diesem PR behoben)

| Befund          | Was falsch war                                                                                                                                                                                                                                                           | Korrektur                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A-1** (Audit) | Kapitel 8.4 behauptete, G2 sei mit `test:differential` vorhanden. Die `ALLOWLIST` wird aber von keiner Differential-Assertion gelesen — nur von G0, und G0 prüft ihre Form.                                                                                              | Kapitel 8.4 sagt jetzt: nur G0 ist scharf, **G2 ist nicht implementiert**.                                                                                                               |
| **A-2** (Audit) | RM-1 dokumentierte „exakt bei κ = 58". Die Abweichung ist bis 1,48 % gegenüber dem Designpfad — und das ist genau Befund K-1.                                                                                                                                            | Kopfkommentar trennt „exakt" (Engine/ρ(T)) von „bis 1,48 %" (Design/κ).                                                                                                                  |
| **A-3** (Audit) | RM-3 behauptete, das Modell „prüfe" die Repräsentationsinvarianz. Ein Modul kann seine eigene Unabhängigkeit nicht belegen.                                                                                                                                              | Kommentar stellt klar: RM-3 **erzeugt** die Eigenschaft, geprüft wird sie in der Testhülle.                                                                                              |
| **A-4** (Audit) | Der `it.fails` zu I-E-12 verlangte `details.izBreakdown` auf einem **Spannungsfall**-Ereignis. Das ist das falsche Feld: `izBreakdown` gehört zu AMP-001. Der Test wäre auch nach vollständiger Reparatur rot geblieben — er hätte eine Reparatur nie bestätigen können. | Test umformuliert auf die tatsächlich fehlenden Größen; als eigener Befund **T-2** geführt. Ein grüner Begleittest hält den Ist-Zustand fest (`details = { rootCauseId: 'OTHER-001' }`). |
| **A-6** (Audit) | RM-1 behauptete, das Produktivmodell werfe oberhalb 200 °C „ebenfalls". Gemessen wirft `copperResistivityAt` erst unterhalb des absoluten Nullpunkts; RM-1 ist an der oberen Grenze **strenger**.                                                                        | Kopfkommentar korrigiert und die Konsequenz benannt (der Differentialtest deckt 0…69 °C ab, nicht mehr).                                                                                 |
| **A-5** (Audit) | Kapitel 12.1 nannte für `verdict-snapshot` 10 und `determinism-metamorphic` 18 Tests. Tatsächlich sind es 5 bzw. 8 `it`-Blöcke, die über Schleifen zu 10 bzw. 18 **Ausführungen** werden.                                                                                | Zahl als „Tests je Datei" gekennzeichnet, Schleifenlogik benannt.                                                                                                                        |

### 12.5.3 Was das Audit offen lässt (Folgearbeit, nicht dieser PR)

| Lücke                                                               | Warum sie nicht hier behoben wird                                                                                                                             | Priorität |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **Allowlist ist nicht verdrahtet (G2)**                             | Erfordert Umbau der Differential-Assertions auf einen gemeinsamen Vergleichskern                                                                              | hoch      |
| **RM-2-Toleranz 1e-12 relativ ist schärfer als die Produktivseite** | Die Produktivseite hat an der Stufenkante **kein** ε, RM-2 hat eines. Die Differenz ist Befund D-2 und darf nicht durch eine größere Toleranz „gelöst" werden | mittel    |
| **`refColdVoc` wird von keinem Differentialtest aufgerufen**        | RM-5 deckt die Solar-Spannungskette nicht gegen Produktiv ab                                                                                                  | mittel    |
| **Kein Differentialtest für `sourceKind: 'inverter'`**              | Der Pfad `inverter-limited` bleibt ungeprüft                                                                                                                  | mittel    |
| **Ungenutztes `fc.property`-Argument in I-E-03**                    | Die Property prüft nichts Zufälliges (Argument `current` wird nur auf `> 0` geprüft); kosmetisch, aber irreführend                                            | niedrig   |

### 12.5.4 Gesamturteil des Audits

Die Suite misst, was sie zu messen behauptet — **mit den in 12.5.2 korrigierten
Ausnahmen**. Sie ist **kein** Nachweis der Normkonformität, und ein grüner
CI-Lauf belegt ausdrücklich **nicht** die Erfüllung der zwölf Invarianten:
sieben davon sind heute verletzt und als `it.fails` sichtbar.

Von den sieben Gates laufen **vier** (G0 als Formprüfung, G1, G3 als
`it.fails`-Suite, G5). **G2, G4 und G6 sind nicht implementiert.**

---

## 12.6 Befund L-1: Lighthouse-Performance „/camper-elektrik/ladebooster/"

**Symptom.** Der Job „Visuelles Gate (nicht blockierend)" ist rot:

| Route                           | gemessen | Budget | Delta |
| ------------------------------- | -------- | ------ | ----- |
| `/camper-elektrik/ladebooster/` | 88       | 90     | −2    |
| `/`                             | 99       | 85     | +14   |
| `/impressum/`                   | 100      | 90     | +10   |

**Einordnung: keine Regression aus diesem PR.**

1. Der PR ändert ausschließlich `docs/ELECTRICAL-VERIFICATION-STRATEGY.md`,
   `package.json` (drei Skripte) und `test/**`. Kein Byte unter `app/`,
   `components/` oder `lib/` ist berührt (`git diff --name-only main...HEAD`).
   Eine gemessene Performance kann sich dadurch nicht ändern.
2. Derselbe Job ist auf dem reinen Doku-PR **#604** rot
   (`job/127268592222`) — dort ohne jeden Test- oder Build-Anteil.
3. Der Job ist per `continue-on-error: true` **nicht blockierend**; er war es
   vor diesem PR genauso.

**Damit ist es ein bestehendes Problem des Basis-Branches** (bzw. der
Messumgebung), kein Befund dieses PRs.

**Grenze der eigenen Prüfung (ehrlich benannt).** Eine eigene Lighthouse-
Gegenmessung war in der Audit-Umgebung **nicht möglich**: Chromium ließ sich
dort nicht installieren (`npx playwright install --with-deps chromium` bricht an
fehlenden Systempaketen ab, `fonts-freefont-ttf` hat keinen
Installationskandidaten). Der Befund stützt sich deshalb auf drei Indizien —
Dateiliste, Vergleichsjobb auf #604 und `continue-on-error` — und **nicht** auf
eine eigene Messung. Wer 88 gegen 90 belastbar einordnen will, braucht die
Messung auf einem Runner mit Browser.

**Was hier ausdrücklich NICHT getan wird:** das Budget von 90 auf 85 senken.
Das wäre das Verhalten, das diese ganze Strategie verhindern soll — eine
Schwelle so lange verschieben, bis der Messwert darunterpasst. Ein
Lab-Performance-Wert von 88 gegenüber 90 ist ohne Laufzeitvarianz-Analyse keine
belastbare Regressionsaussage; die Streuung von Lighthouse-Läufen in
GitHub-Actions-Runnern liegt typischerweise in derselben Größenordnung.

**Folgeauftrag (Priorität mittel, nicht Teil dieses PRs):** den Job auf einem
ruhigen Runner oder mit mehreren Messungen (Median aus 3 Läufen) betreiben und
erst dann entscheiden, ob 88 einen echten Rückgang darstellt. Zuständig ist der
Verantwortliche der Seite `/camper-elektrik/ladebooster/`, nicht die
Elektrik-Verifikation.

---

## 12.7 Abstimmung mit PR #604 (Engineering- und Safety-Framework)

PR #604 beschreibt das übergeordnete Rahmenwerk. Damit dessen Aussagen und die
Befunde aus #605 nicht auseinanderlaufen, hier die Liste der Punkte, die #604
**übernehmen** muss — jeweils mit dem Hinweis, dass der Punkt in #605
**nicht gelöst**, sondern nur **quantifiziert und als Test festgehalten** ist:

| Thema aus #604                                | Stand in #605                                                                                                                                                                                           | Was #604 sagen muss                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Sicherungskoordination über alle Produktpfade | `FUSE_MAP ≤ 0,7 · I_z,Basis` ist belegt (I-E-03 grün). **Nicht** belegt: `maxFuseForConditions` mit Hersteller-I_z (Befund T-1) und die Koordination über alle vier Schichten (I-E-09 rot, Befund K-4). | „Koordination ist für die Tabellenreihe belegt, **nicht** für herstellerbezogene Pfade."        |
| Unbekannte Grenzwerte / fehlende Eingaben     | Befund E-2 (`feasible: true` ohne Grenze) und E-1 (stilles Verwerfen in `constraints.ts`) sind **offen**, beide als `it.fails`.                                                                         | „Nicht bewertbar" ist im Feasibility-Gate heute **nicht** von „in Ordnung" unterscheidbar.      |
| AC-Spannungsfall                              | Befund K-2 (Anzeige prüft 3 %, Dimensionierung rechnet AC 2 %) und K-2b (Engine prüft AC-**gar nicht**) sind **offen**.                                                                                 | AC-ΔU ist weder geprüft noch konsistent. Nicht als „abgedeckt" führen.                          |
| Batteriebank-Kurzschlussstrom                 | Befund K-3 ist **offen**: 6.826,7 A vs. 6.400,0 A je nach Knotenreihenfolge, berührt `AMP-004` (`CRITICAL_SAFETY`).                                                                                     | Reihenfolgeabhängigkeit nennen; `AMP-004` ist bis zur Reparatur nicht belastbar.                |
| Designbudget vs. elektrische Prüfung          | Befund K-4 ist **offen**: `cableCanCarry: true` bei 48,3 A, während die Engine mit 34,5 A rechnet und `VIOLATION` meldet.                                                                               | Zwei Aussagen zur selben Leitung; die UI zeigt beide.                                           |
| Calculation Trace                             | Befund T-2 ist **offen**: `VDR-001` trägt `details: { rootCauseId }` und sonst nichts. Vollständigkeit ist **nicht** erreicht.                                                                          | Trace ist ein **Ziel**, kein Ist-Zustand.                                                       |
| Offene Modellgrenzen der 230-V-Prüfung        | Einleiterig, keine Netzform, kein Rückspeiseschutz (`NET-003`, `docs/AC-230V-MODELLGRENZEN.md`). Unverändert.                                                                                           | Grenzen bleiben; #605 belegt nur, dass sie **benannt** sind, nicht dass sie geschlossen wurden. |

**Nicht zu übernehmen aus #605:** die Aussage, es gäbe „sieben CI-Gates". Es
sind vier implementiert, drei spezifiziert (Kapitel 12.5.4).
