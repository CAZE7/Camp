# Abschlussreport — Elektrische Berechnungs- und Validierungsschicht (2026-10-07)

Auftrag: «Die elektrische Berechnung und Validierung muss fachlich nachvollziehbar
und deterministisch werden» (Phasen 1–12). Branch `arena/26021eb0-camp`.
Nachweisbare Zahlen, keine Prosa-Behauptungen — jede Zahl ist mit Test oder
Sonde belegt (Aufruf am Ende dieses Dokuments).

---

## 1. Root Causes

| ID        | Ursache                                                                                                                                                     | Auflösung im Code                                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RC-1      | Globaler Last-Fallback ohne Topologie („Ib = 158,7 A“ auf jedem Kabel ohne Endpunktregel)                                                                   | Topologie-Strommodell (`lib/electricalGraph/currentFlow.ts`) — war im Basisstand bereits vorhanden; die verbleibenden Pfad- und Doppelzählungsfehler sind hier behoben (RC-2/R-1)                               |
| R-1       | **Doppelzählung am Dual-Rollen-Wandler**: die frühere Regel „voller Strom auf jedem Anschluss“ stempelte den Eingangsstrom zusätzlich auf die Ausgangsseite | `planEnds`-Seitenzuordnung + `dualRoleTopology`; keine pauschale Vollstromregel mehr (Phase 3)                                                                                                                  |
| R-2       | **Equal-Split als Physikannahme** für beliebige Parallelpfade                                                                                               | leitwertgewichtete Verteilung `G = 1/R`, `R = ρ·L/A` je pfad-eigenem Anteil; Equal-Split nur bei nachweislich gleichwertigen Pfaden (`assumed`), sonst konservativ voll je Pfad (`unknown`) + Annahme (Phase 2) |
| RC-2      | FI-Prüfung fand einen FI irgendwo im Plan, nicht auf dem Versorgungspfad des Verbrauchers                                                                   | `analyseAcProtectionChains` (Quelle → FI → LS → Verteiler → Verbraucher), inkl. `rcdsElsewhere` (Phase 8)                                                                                                       |
| RC-3      | „12 von 36 kritisch“ ohne Trennung von Verstoß/Datenlücke/Ursache                                                                                           | `severity` + `status` + `rootCauseId` je Befund, `stateCounts`, Ursachengruppen im Bericht (Phasen 9/10)                                                                                                        |
| RC-4      | Keine Explainability je Leitung                                                                                                                             | `CableCurrentExplanation` trägt `ib`, `contributingLoads`, `contributingSources`, `path`, `flowDirection`, `calculationMethod`, `assumptions`, `splitMethod`, `splitConfidence` (Phase 4)                       |
| ELE-002   | 70-mm²-Sättigung als stille Empfehlung                                                                                                                      | `thermalCrossSectionFor` → `outside-model` + UI-Satz „Für diesen Strom liegt keine hinterlegte Belastbarkeitstabelle vor“ (Phase 5)                                                                             |
| ELE-001   | I_z an mehreren Stellen (Pauschale hier, Physik dort)                                                                                                       | `calculateCableIz` als EINE Funktion; `physics.calculateCorrectedIz`, `designAmpacity`, `isThermallyOverloaded` und die Kantenanzeige lesen sie (Phase 6)                                                       |
| ELE-001/2 | Koordination `I_b ≤ I_n ≤ I_z` mehrfach implementiert                                                                                                       | `evaluateCableProtection({ib,in,iz})` — Engine (AMP-001) und UI (`collectEdgeErrors`) nutzen dasselbe Urteil (Phase 7)                                                                                          |

## 2. Geänderte Dateien

**Neu:** `lib/validationSeverity.ts`, `lib/verify/rootCauses.ts`,
`lib/verify/validation158Fixture.ts`, `scripts/verify/explainCableCurrent.ts`,
Tests `lib/electricalGraph/currentFlow.split.test.ts`,
`lib/verify/validationStates.test.ts`, `lib/verify/validation158.regression.test.ts`,
dieses Dokument + Ledger-Eintrag in `docs/ARCHITECTURE-CHANGES.md`.

**Geändert:** `lib/electrical.ts`, `lib/electricalGraph/currentFlow.ts`,
`lib/verify/{physics,ampacity,protection,events,types,pipeline,index}.ts`,
`components/edges/CableEdge.tsx`,
`components/planner/{hooks/useLiveValidation.ts,utils/verificationWarnings.ts,ui/WarningCenter.tsx}`,
`store/usePlannerStoreExtended.test.ts` (Szenario „Volle Hütte“),
`knownPlans/complex.json` (Recapture), `package.json` (`npm run verify:explain`),
`docs/ai/ELECTRICAL-CONTEXT.md`, `docs/ai/VALIDATION-CONTEXT.md`, `lib/README.md`,
`docs/AUDIT-STROMBERECHNUNG-2026-10.md`.

## 3. Alter Stromwert → neuer Stromwert

| Fall                                                            | alt      | neu                        | warum                                                                                                                                                                                   |
| --------------------------------------------------------------- | -------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase-1-Fixture, Hauptstrang Batterie → Plus-Busbar             | 158,73 A | **158,73 A** (unverändert) | Die Summe WR 147,06 A + Kühlbox 5,00 A + Pumpe 6,67 A ist korrekt; sie wird jetzt BEWIESEN (contributors + Pfad), nicht behauptet                                                       |
| Phase-1-Fixture, Zweig hinter der Fuse Box                      | 11,67 A  | 11,67 A                    | Abzweig trägt nur seine eigene Last (Test 2)                                                                                                                                            |
| Phase-1-Fixture, WR-Zuleitung                                   | 147,06 A | 147,06 A                   | eigener Zweigstrom                                                                                                                                                                      |
| Golden `complex`, Hausstrang (`e-auto-1`, `e-batt-plus/minus`)  | 92,71 A  | **70,49 A**                | Der Booster-Eingang (22,22 A) wird nicht mehr zusätzlich auf die Hausseite gestempelt (er kommt von der Starterseite). 92,71 − 22,22 = 70,49 = WR 58,82 + DC-Lasten 11,67 — Summe exakt |
| Golden `complex`, Booster-Ausgang (`e-dcdc-busbar`, `e-auto-8`) | 22,22 A  | **20,00 A**                | Ausgangszug trägt den Ausgangsstrom, nicht den Eingangsstrom (20/0,9)                                                                                                                   |
| Golden `complex`, Booster-Eingang (`e-auto-9`)                  | 22,22 A  | 22,22 A                    | Eingangsseite unverändert (Reihenglied)                                                                                                                                                 |

**Keine künstliche Reduktion:** Der 158,7-A-Fall bleibt 158,7 A. Reduziert wurde
nur, was nachweislich doppelt gezählt war (Booster-Eingang auf der Hausseite).

## 4. Alte I_z-Berechnung → neue I_z-Berechnung

- **alt:** zwei Orte — Planerpauschale `DERATE_FACTOR = 0,7` in `lib/electrical.ts`,
  physikalische Faktoren f₁/f₂ in `lib/verify/physics.ts`
  (`min(0,7, f₁·f₂)`), plus eine dritte Kurzrechnung
  `VDE_AMPACITY[cs] × DERATE_FACTOR` in `components/edges/CableEdge.tsx`.
- **neu:** EINE Funktion `calculateCableIz({crossSectionMm2, ambientC?, insulation?,
bundledCircuits?})` →
  `{baseIz, ambientFactor, groupingFactor, installationFactor, plannerFactor,
correctedIz, source, confidence, explanation}`.
  `I_z = baseIz × min(plannerFactor, f₁·f₂·f₃)`; der strengere Weg gewinnt, ein
  Kältebonus wird nie kapazitätserhöhend angesetzt.
  Für den 70-mm²-Fall: `I_z = 172,00 A × min(0,70; 1,00·1,00·1,00) = 120,40 A`
  (Quelle `planner-derate`, Vertrauen `computed`).
- **Modellgrenze:** `thermalCrossSectionFor(174,6 A)` → `outside-model`
  (`maximumModeledCurrentA = 120,4 A`); `assessCableSelection` setzt
  `beyondModeledRange`, die Kantenanzeige meldet
  „Für diesen Strom liegt keine hinterlegte Belastbarkeitstabelle vor (…)“.
  Ein stiller Rückfall auf 70 mm² existiert nicht mehr.

## 5. Alte → neue Meldungszahlen

Gemessen jeweils mit `verifyPlan(..., { profile: 'CAMP_MODEL' })`.

**Phase-1-Fixture (158,7-A-Plan, 15 Knoten / 17 Kanten):**

|                        | alt (Basis 04b5a48)                 | neu                                                                                                                                         |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Befunde gesamt         | 40                                  | 40                                                                                                                                          |
| Engine-Schwere         | CRITICAL 35 / CODE 1 / EFFICIENCY 4 | identisch                                                                                                                                   |
| Nutzer-Schwere         | (nicht vorhanden)                   | **critical 14 / error 1 / warning 0 / info 25**                                                                                             |
| Nutzer-Zustand         | (nicht vorhanden)                   | **violated 15 / incomplete 25 / satisfied 0 / not_applicable 0**                                                                            |
| kritische Verletzungen | 14                                  | 14                                                                                                                                          |
| Ursachengruppen        | (nicht vorhanden)                   | **16** (`INVERTER-LOAD-001`, `PROTECTION-COORDINATION-001…005`, `DATA-MISSING-001…007`, `RCD-MISSING-001`, `RCD-POSITION-001`, `OTHER-001`) |

Die Zahl der kritischen Meldungen ist **unverändert** — sie ist fachlich richtig:
158,7 A über 70 mm² (I_z = 120,4 A) und über einer 100-A-Sicherung ist ein echter
Sicherheitsverstoß, keine Datenlücke. Neu ist die Beweisbarkeit (jede Kante nennt
ihre Beiträge, ihren Pfad, ihre I_z-Faktoren) und die Zuordnung zu 16 Ursachen.

**Golden-Plan `complex` (identische Eingabe, AutoWire + Engine):**

|                       | alt            | neu                                                                                                                                                                                                                                                                   |
| --------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Befunde               | 20 (alle info) | 21 (20 info + **1 error**)                                                                                                                                                                                                                                            |
| Der eine neue `error` | —              | `AMP-005-selectivity` auf `e-busbar-inv-plus`: Sicherung 80 A vorgelagert / 60 A nachgelagert = 1,33:1 < 1,6:1 — ein echter Selektivitätsbefund, der durch die korrigierte (kleinere) Hauptsicherung neu sichtbar wird. Er bleibt sichtbar; nichts wird beschwichtigt |

## 6. Bestandene Regressionstests (Auftrag Phase 12)

| Nr. | Test                                                                               | Datei                                           |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Hauptstrang trägt die Summe der nachgelagerten Lasten                              | `lib/electricalGraph/currentFlow.split.test.ts` |
| 2   | Abzweig trägt nur seine eigene Last                                                | dto.                                            |
| 3   | Gleiche parallele Kabel teilen gleichmäßig                                         | dto.                                            |
| 4   | Ungleiche parallele Kabel teilen nach Leitwert (28,24 A / 11,76 A)                 | dto.                                            |
| 5   | Fehlende Pfaddaten erfinden keine Präzision (`full-per-path-unknown` + Annahme)    | dto.                                            |
| 6   | Dual-Rolle ohne Doppelzählung (Eingang 33,33 A / Ausgang 30 A; 2 Ausgänge je 15 A) | dto.                                            |
| 7   | Batterie-Reihe (voller Stringstrom auf jedem Reihenkabel)                          | dto.                                            |
| 8   | Batterie-Parallel (je 10 A, Last genau einmal)                                     | dto.                                            |
| 9   | Batterie-Reihe-Parallel (2s2p: je 10 A, Summe 20 A)                                | dto.                                            |
| 10  | Ib/In/Iz-Koordination einzeln je Teilstück                                         | `lib/verify/validationStates.test.ts`           |
| 11  | 70-mm²-Modellgrenze (`outside-model`, kein stiller Rückfall)                       | dto.                                            |
| 12  | Größerer externer/importierter Querschnitt (95 mm² bleibt)                         | dto.                                            |
| 13  | AC-FI auf dem Pfad ⇒ geschützt                                                     | dto.                                            |
| 14  | AC-FI fehlt auf dem Pfad ⇒ Befund mit Quelle/Pfad                                  | dto.                                            |
| 15  | FI existiert woanders, schützt aber nicht (`rcdsElsewhere`, RCD-003)               | dto.                                            |
| 16  | Wiederholte Prüfung bit-identisch (50× Modell, 2× Bericht inkl. Hash)              | dto. + `currentFlow.split.test.ts`              |
| 17  | 158,7-A-Regressionsfixture (Ursachen, Pfade, Querschnitte, Längen, I_z, Critical)  | `lib/verify/validation158.regression.test.ts`   |

## 7. Gates

| Gate                                                      | Ergebnis                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` (Vitest)                                       | **3287 bestanden / 1 skipped** (239 Dateien)                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm run check` (lint + format + 2× typecheck + Coverage) | **grün**                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run build` (Next Export + SEO-Prüfung)               | **grün** (30 Seiten)                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run test:goldenmaster`                               | **grün** (Recapture begründet: Ledger-Eintrag)                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run test:regression`, `npm run routing:audit`        | unverändert grün (Routing nicht angefasst)                                                                                                                                                                                                                                                                                                                                                                                   |
| `npx playwright test`                                     | **in dieser Umgebung nicht ausführbar** — der Browser-Download ist gesperrt (`Failed to download Chrome for Testing 151.0.7922.34`), kein System-Chromium vorhanden; dieselbe Einschränkung ist in `docs/E2E-TESTS.md` §6 dokumentiert. Ersatzweise geprüft: Static Export über `scripts/e2e/static-server.mjs` liefert `/` und `/elektrik-planung/` mit 200, Selektoren-Vertrag via `components/e2eSelectors.test.tsx` grün |

## 8. Verbleibende Modellgrenzen

1. Belastbarkeitstabelle endet bei 70 mm² — Aussagen darüber werden ausgewiesen
   (`outside-model`), nicht geraten.
2. Verlegeart/Isolierstoff bleiben über f₁/f₂ abgebildet (`installationFactor`
   explizit 1,0); der Fahrzeugkontext (FLRY) ist nicht modelliert.
3. Schutzkette ist ein EINLEITER-Modell (L/N/PE nicht einzeln als Kanten).
4. Wechselrichter-Insel bleibt elektronisch begrenzt (`inverter-limited`), keine
   TN-Nachbildung.
5. Vorgelagerte Netzimpedanz bleibt die dokumentierte Annahme 0,8 Ω.
6. Leitwertgewichtung nutzt ρ(20 °C) — warme Leiter haben höheren R; die
   Verteilung ist damit eine Planungsannahme (im Erklärungstext ausgewiesen).

## 9. Antworten auf die Abnahmefragen (aus `npm run verify:explain`)

```
=== 1. Warum hat dieses Kabel 158,7 A? ===
Cable: 200 Ah LiFePO4 → Plus-Busbar (e-battery-plus-busbar)
  Ib = 158.7 A   [flow-model] @ 12.8 V
  Contributors:
    fridge     (Kompressorkühlbox)  5.0 A gesamt, 5.0 A hier  [load]
    inverter   (1500-W-Inverter)  147.1 A gesamt, 147.1 A hier [load]
    pump       (Wasserpumpe)        6.7 A gesamt, 6.7 A hier  [load]
  Direction: forward · Pfad: string:battery → busbar-plus
=== 4. Wie wird I_z berechnet? ===
  I_z = 172.00 A × min(0.70 [Planerpauschale], 1.00 [f₁ 1.00 × f₂ 1.00 × f₃ 1.00]) = 120.40 A
=== 5. Warum ist das Kabel zu klein? ===
  I_b = 158.7 A ≤ I_n = 100.0 A ≤ I_z = 120.4 A
  Zustand: violated · Schwere: critical · Verletzungen: ib-over-iz, ib-over-in
=== 6. Echter Sicherheitsfehler oder fehlen Daten? ===
  [CRITICAL_SAFETY/VIOLATION] e-battery-plus-busbar: I_b übersteigt I_z (120,4 A)
  [CRITICAL_SAFETY/VIOLATION] e-battery-plus-busbar: I_b übersteigt I_n (100 A)
  Datenlücken im Bericht: 25 · kritische Verletzungen: 14
  Ursachen: … INVERTER-LOAD-001 (e-battery-plus-busbar, e-battery-shunt, …) …
```

Fazit: Der 158,7-A-Befund ist ein **echter Sicherheitsfehler** (147,06 A
Wechselrichterlast über eine 70-mm²-Leitung mit I_z = 120,4 A und 100-A-Sicherung),
keine Datenlücke. Die 25 `incomplete`-Meldungen sind Datenlücken und erscheinen in
der Anzeige ausschließlich als `info`, nie als `critical`.

**Reproduktion:** `npm run verify:explain` ·
`npx vitest run lib/electricalGraph/currentFlow.split.test.ts lib/verify/validationStates.test.ts lib/verify/validation158.regression.test.ts`
