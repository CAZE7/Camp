# Verification Strategy — Camp (Elektrikplaner)

**Stand:** 2026-11-04  
**Status:** Verbindlich (Erstfassung)  
**Verantwortlich:** Quality Engineering (QE) gemeinsam mit Safety Engineering  
**Übergeordnet:** `docs/engineering/ENGINEERING-CONSTITUTION.md`, `docs/safety/SAFETY-PLAN.md`, `docs/safety/RISK-REGISTER.md`, `docs/safety/SAFETY-CASE.md`  
**Verwandt:** `docs/ai/TESTING-CONTEXT.md`, `docs/architecture/ARCHITECTURE-RULES.md`, `docs/verification/REQUIREMENTS-MATRIX.md`, `docs/verification/RELEASE-GATES.md`

---

## 1. Zweck

Diese Verifikationsstrategie definiert, wie Camp belegt, dass es tut, was es soll — und dass es nicht tut, was es nicht soll. Das Ziel ist kein möglichst großes Testsystem, sondern ein **nachweisbar zuverlässiges Produkt** und ein dauerhaft funktionierender Entwicklungsprozess.

Für jeden kritischen Bereich werden geeignete Prüfverfahren und deren Abnahmekriterien definiert. Die Strategie verbindet bestehende, bereits implementierte Verfahren mit solchen, die schrittweise hinzugefügt werden.

---

## 2. Grundsätze

| #   | Grundsatz                                                | Bedeutung für Camp                                                                                                  |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| V-1 | **Eine Regel ohne Test ist eine Konvention.**            | Architekturregeln (A–N, S-1–S-10) werden wo möglich durch ausführbare Tests erzwungen (`ARCHITECTURE-RULES.md` §E). |
| V-2 | **Jeder Bugfix braucht einen Regressionstest.**          | O-3, CONSTITUTION §4.1.                                                                                             |
| V-3 | **Keine Testabschwächung für grünes CI.**                | O-4. Baselines nur senken bei messbar besserem Plan.                                                                |
| V-4 | **Datenlücke niemals als „ok“.**                         | Fehlende Daten → `incomplete`/`UNVERIFIABLE`, nie `critical` (Regel S-3).                                           |
| V-5 | **Determinismus wird geprüft.**                          | Gleiche Eingabe ⇒ byte-identisch (Golden Master, Doppellauf, Regression p13–15).                                    |
| V-6 | **Verifikation ist unabhängig von der Implementierung.** | Wo möglich: unabhängige Referenzberechnungen, Property-Based Tests über generierte Fälle.                           |
| V-7 | **Abnahmekriterien sind messbar.**                       | Jedes Prüfverfahren hat definierte Grenzwerte (0 Verletzungen, Ratchet ≤ 0, Coverage, 16 ms etc.).                  |

---

## 3. Prüfverfahren im Überblick

| Verfahren                            | Was es prüft                                                 | Wo eingesetzt in Camp                                                                                                                                | Abnahmekriterium                                                                                |
| ------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Unit-Testing**                     | Einzelne Funktionen, Grenzfälle                              | `lib/**/*.test.ts`, `components/**/*.test.ts` (vitest, jsdom)                                                                                        | Alle grün; Coverage-Gate `lib/**`: Zeilen 90 %, Branches 85 %, Funktionen 90 %, Statements 95 % |
| **Integration-Testing**              | Zusammenspiel (Store, Hooks, Komponenten)                    | `store/*.test.ts`, `components/planner/**/*.test.tsx`                                                                                                | Alle grün                                                                                       |
| **Property-Based Testing**           | Gesetze über tausende generierte Fälle                       | `lib/vde-properties.test.ts` (G1–G7, fast-check), `hananGridMasks.test.ts`, `orthogonalRouting.invariants.test.ts`                                   | 1 000 Fälle je Gesetz, keine Verletzung                                                         |
| **Differential Testing**             | Zwei unabhängige Implementierungen liefern gleiches Ergebnis | ELK vs. Dagre Layout (`ab-compare.test.ts`); zwei Strompfade (DC vs. AC) — historisch vereinheitlicht (ELE-009)                                      | Byte-identisch bzw. konsistent                                                                  |
| **Invariant-Testing**                | Harte Garantien immer erfüllt                                | `lib/routing/invariants.ts` (I1–I10), `finalValidation.ts`                                                                                           | I1–I3 = 0 (hart); I4–I7 Metrik/Ratchet; I9 Determinismus                                        |
| **Metamorphic Testing**              | Eigenschaft bei Transformationen erhalten                    | Umgekehrte Eingabe ⇒ gleicher Graph-Hash (`tests/scale/plannerScale.test.ts`); Kanten-Permutation ⇒ gleiche AutoWire-Edge-ID-Zuordnung               | Gleiches Ergebnis                                                                               |
| **Mutation Testing**                 | Tests erkennen künstliche Fehler                             | (geplant — noch nicht im CI)                                                                                                                         | Mutation Score ≥ Schwelle (festzulegen)                                                         |
| **Fuzz Testing**                     | Robustheit gegen unerwartete Eingaben                        | fast-check generiert zufällige Eingaben für Eigenschaften (G1–G7)                                                                                    | Keine Verletzung bei 1 000 Fällen                                                               |
| **Boundary Testing**                 | Grenzwerte (Min/Max, 0, undefiniert)                         | `lib/units.ts` (wirft bei <0 / =0), `selectFuseSize` (Kabelgrenze), `crossSection` (1,5 / 70 mm²)                                                    | Jede Grenze hat Positiv- und Negativtest                                                        |
| **Dimensional Analysis**             | Einheiten konsistent                                         | Branded Types (`Watts`, `Amps`, `Volts`, `Mm2`, …) in `lib/units.ts`; `unit` Feld nur an nackte Zahlen hängen                                        | Typecheck + `units.typecheck.test.ts`; keine Einheit an Nicht-Zahlen                            |
| **Unabhängige Referenzberechnungen** | Berechnung durch zweite, einfache Methode bestätigt komplexe | Kabelquerschnitt über thermischen Bedarf vs. Spannungsfall (zwei Wege, beide Normreihe); Kurzschluss `bankShortCircuitCurrentA` vs. Einzelkomponente | Beide Wege runden auf gleiche Normreihe; Abweichungen dokumentiert                              |
| **Regression-Testing**               | Früher gefundene Fehler bleiben behoben                      | `scripts/regression/` (15 Szenarien, SVG-Byte-Vergleich), `knownPlans/` Golden Master                                                                | Byte-identisch; Änderung nur mit Begründung + Recapture                                         |
| **Integration-Testing (System)**     | Gesamtsystem im Verbund                                      | Store-Aktionen + Routing + Validierung (`usePlannerStoreExtended.test.ts` mit echtem Store, kein Mock)                                               | `assertZeroWarnings()`, `assertNoSafetyWarnings()`                                              |
| **End-to-End-Testing**               | Echte Bedienung gegen Static Export                          | `tests/e2e/*.spec.ts` (Playwright, 4 Projekte: 375/768/1440/touch)                                                                                   | Alle blockierenden Specs grün; a11y critical/serious = Fail                                     |
| **Visual Regression Testing**        | Pixel-genaue UI                                              | `tests/e2e/visual.spec.ts` (Snapshots hell/dunkel, 375/768/1440)                                                                                     | Baselines nach UI-Freigabe; maxDiffPixelRatio 0,02                                              |
| **Architektur-Testing**              | Einhaltung der Schichtenregeln                               | `scripts/architecture/libBoundary.test.ts`, `scripts/routing/architecture.test.ts`                                                                   | Alle grün; keine verbotenen Imports                                                             |
| **Gezielte Formal Verification**     | Mathematischer Nachweis kritischer Eigenschaften             | (geplant — z. B. `I_B ≤ I_n ≤ I_z` für den gesamten Zustandsraum)                                                                                    | Noch nicht im CI; Ziel: Security-critical Claims                                                |

---

## 4. Prüfverfahren pro kritischem Bereich

### 4.1 Elektrische Berechnungen (Strom, Querschnitt, Sicherung, Spannungsfall, Solar, Kurzschluss, AC)

| Verfahren              | Einsatz                                                                                                                                   | Abnahme                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Unit-Test              | Alle Funktionen `lib/electrical.ts`, `lib/vde-standards.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`, `lib/solar.ts`, `lib/units.ts` | Alle grün, Grenzfälle und Negativfälle                                                                                                   |
| Property-Based (G1–G7) | `lib/vde-properties.test.ts` (fast-check, ~1 000 Fälle je Gesetz)                                                                         | Keine Verletzung; G1 Sicherungs-Sandwich, G2 Monotonie, G3 ΔU-Monotonie, G4 Querschnitt, G5 Idempotenz, G6 AC/DC-Trennung, G7 Konvergenz |
| Boundary               | `selectFuseSize` an `FUSE_MAP`-Grenze; Querschnitt 1,5 / 70 mm²; Spannung 0 V                                                             | Jede Grenze Positiv + Negativ                                                                                                            |
| Golden Master          | `knownPlans/*.json` (6 Referenzpläne: AutoWire + Electrical + Routing eingefroren)                                                        | Byte-identisch; Recapture nur mit Begründung + Ledger                                                                                    |
| Unabhängige Referenz   | Zwei Wege zum Querschnitt (AutoWire `sizeDcEdges` vs. `calculateCrossSection`) runden auf gleiche Normreihe                               | Dokumentierte Abweichung (12,8 V vs. 12 V nominal) ist beabsichtigt                                                                      |

### 4.2 Graph- und Routing-Engine

| Verfahren               | Einsatz                                                                         | Abnahme                                                                              |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Invariant-Test (I1–I10) | `lib/routing/invariants.ts`, `finalValidation.ts`                               | I1–I3 = 0 (hart, Ratchet); I4–I7 Metrik; I9 Determinismus; I10 Kreuzungen Δ ≤ 0      |
| Architektur-Test        | `scripts/routing/architecture.test.ts`                                          | Keine `geometry`-Lesung; `Infinity` Kollision; Token-Einzelquelle; gebündeltes elkjs |
| Regression              | `scripts/regression/` (15 Szenarien, Wegpunkt-genau, Metrik-Budget, SVG-Visual) | Byte-identisch; I1=I2=I3=0 je Szenario (hartes Gate seit 2026-10-06)                 |
| Golden Master           | `scripts/goldenmaster/`                                                         | Doppellauf byte-identisch                                                            |
| Determinismus           | `routing:audit` (Spalte `determ`)                                               | `true` für alle Pläne                                                                |
| Property / Fuzz         | `hananGridMasks.test.ts`, `orthogonalRouting.invariants.test.ts`                | Keine Verletzung                                                                     |
| Metamorphic             | Kanten-Permutation ⇒ gleiche Edge-ID-Zuordnung (AutoWire)                       | `reviewDiff.test.ts`                                                                 |
| Domain-Probe            | `scripts/routing/domainProbe.ts` (Domänen-Trennregeln)                          | Ratchet der gemessenen Zahlen                                                        |
| Performance             | `benchmarks/edgeRoutingPerf.bench.ts`, `perf:route-scaling`                     | Render ≤ 16 ms (Legacy); Live-Routing-Ratchet 300 ms (begründet); 0 Fallbacks        |

### 4.3 Validierung und Warnsystem

| Verfahren                     | Einsatz                                                                        | Abnahme                                                         |
| ----------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Unit-Test                     | `collectEdgeErrors`, `useLiveValidation`, `connectionRules`                    | Positiv-, Negativfall; jede `critical`-Regel hat Negativtest    |
| „AutoWire-Pläne feuern nicht“ | `assertZeroWarnings()` / `assertNoSafetyWarnings()` über `TEMPLATE_MINIMALIST` | Keine Fehlalarme im sauberen Referenzplan                       |
| Anzeige-Test                  | Warn-Zentrale, Edge-Chips, ruleId/severity/unit                                | `unit` nur an nackte Zahlen; Konsequenz + Handlungsaufforderung |
| Architektur-Test              | Validierungsregeln haben benannte Quelle, ruleId                               | Review                                                          |

### 4.4 Persistenz und Migration

| Verfahren                   | Einsatz                                                                              | Abnahme                                                           |
| --------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Unit-Test                   | `persistence.test.ts`, `storage.test.ts`, `nodeSchema.test.ts`, `edgeSchema.test.ts` | Falsche Typen entfernt, unbekannte behalten; Migration Altbestand |
| Migrationstest              | Altbestand-Fixture → aktuelle Version                                                | Datenverlust = 0; RETTEN statt VERWERFEN                          |
| Messwerte nicht persistiert | `handleGeometry.test.ts`, `persistence.test.ts`                                      | `measured`/`width`/`height` nicht in `localStorage`               |

### 4.5 UI / UX / Accessibility

| Verfahren             | Einsatz                                                                    | Abnahme                                                                                  |
| --------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Komponententest (RTL) | `components/**/*.test.tsx`                                                 | Alle grün                                                                                |
| E2E (Playwright)      | `tests/e2e/*.spec.ts` gegen `./out`                                        | Blockierende Specs grün; a11y (axe) critical/serious = Fail                              |
| Visual Regression     | `visual.spec.ts`, `visual-de.spec.ts`                                      | Pixel-Drift ≤ 0,02; Baselines nach UI-Freigabe                                           |
| Accessibility         | `a11y.spec.ts`, `planner-canvas-a11y.spec.ts`, `rendered-contrast.spec.ts` | keine critical/serious Verstöße; Kontrast ≥ 4,5:1 (Text), ≥ 7:1 (Alarme), ≥ 3:1 (Grafik) |
| Tastatur              | `planner-keyboard.spec.ts` (geplant)                                       | Mini-Plan baubar per Tastatur                                                            |

### 4.6 Exporte und Reporting

| Verfahren        | Einsatz                  | Abnahme                                                                      |
| ---------------- | ------------------------ | ---------------------------------------------------------------------------- |
| BOM / Stückliste | Manuell + BOM-Modal-Test | Korrekte Mengen, Querschnitte, Längen; `assumed` vs. `stored` gekennzeichnet |
| PDF / Export     | (sofern vorhanden)       | Export startet, Datei nicht leer; leerer Plan ehrliche Meldung               |

### 4.7 Security

| Verfahren                      | Einsatz                                  | Abnahme                                                                  |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------ |
| Keine Secrets im Repo          | `.env.example`, Review                   | Keine `OPENAI_API_KEY`, `DATABASE_URL` im Code                           |
| Statischer Export ohne Backend | ADR 0001; `build` erzeugt kein `out/api` | Keine dynamische API-Route im ausgelieferten Artefakt                    |
| Security-Headers / CSP         | ADR 0038                                 | Prüfung der ausgelieferten Seite                                         |
| Lockfile-Integrität            | `ci:verify-lockfile-gate`                | Abweichung `package.json` ↔ `package-lock.json` scheitert reproduzierbar |

### 4.8 Architektur

| Verfahren           | Einsatz                        | Abnahme                                       |
| ------------------- | ------------------------------ | --------------------------------------------- |
| Layer-Boundary      | `libBoundary.test.ts`          | `lib/` importiert keine App-Schicht           |
| Routing-Architektur | `routing/architecture.test.ts` | Regeln E, G, H, I, J                          |
| Token-Drift         | `tokens.test.ts`               | Keine Abstandskonstante außerhalb `tokens.ts` |

---

## 5. Mutation Testing (geplant)

Mutation Testing ist noch nicht im CI. Ziel: Für die sicherheitskritischen Module (`lib/electrical.ts`, `lib/vde-standards.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`, `lib/connectionRules.ts`) einen Mutation-Score festzulegen (Vorschlag: ≥ 80 % für killed mutants auf sicherheitsrelevante Linien). Einführung über eigenen ADR mit Messung vor/nachher.

---

## 6. Abnahmekriterien pro Verifikationsstufe

| Stufe              | Kriterium                                         | Blockiert Merge                    | Blockiert Release                |
| ------------------ | ------------------------------------------------- | ---------------------------------- | -------------------------------- |
| Unit + Integration | Alle grün, Coverage-Gate `lib/**`                 | Ja                                 | Ja                               |
| Property (G1–G7)   | Keine Verletzung bei 1 000 Fällen                 | Ja                                 | Ja                               |
| Invariante (I1–I3) | = 0 hart                                          | Ja                                 | Ja                               |
| Architekturtests   | Alle grün                                         | Ja                                 | Ja                               |
| Golden Master      | Byte-identisch (oder begründeter Recapture)       | Ja                                 | Ja                               |
| Regression         | Byte-identisch, I1=I2=I3=0 je Szenario            | Ja                                 | Ja                               |
| E2E (blockierend)  | Alle grün, a11y critical/serious = Fail           | Ja                                 | Ja                               |
| Visual Regression  | ≤ 0,02 Drift (baselines eingefroren)              | Melden (nicht blockierend)         | Bei UI-Freigabe Ja               |
| Performance        | Render ≤ 16 ms; Live-Routing ≤ 300 ms (begründet) | Nein (Gate existiert, s. PERF-001) | Nein (Zielkonflikt dokumentiert) |
| Security           | Keine Secrets, Lockfile-OK, statischer Export     | Ja                                 | Ja                               |

---

## 7. Umgang mit verifizierten und unverifizierten Behauptungen

Jede technische Behauptung im Safety Case (siehe `SAFETY-CASE.md` §4) trägt eine der Kategorien:

- mathematisch nachgewiesen
- durch Tests verifiziert
- anhand externer Datenquellen belegt
- fachlich unabhängig geprüft
- noch ungeklärt

Eine Behauptung ohne Kategorie gilt als „noch ungeklärt“. Sicherheitskritische Behauptungen („noch ungeklärt“) blockieren den Release, bis sie behandelt oder als akzeptiertes Restrisiko im Risk Register dokumentiert sind.

---

## 8. Kontinuierliche Verbesserung

Die Verifikationsstrategie wird bei jedem Release überprüft:

1. Neue Verfahren werden über ADR eingeführt (nicht still).
2. Schwellen und Budgets werden nur bei messbarer Verbesserung angepasst (mit Begründung).
3. Geschlossene Risiken bleiben im Register dokumentiert (nicht gelöscht).
4. Verfahren, die keinen Mehrwert liefern (Scheinsicherheit), werden entfernt (z. B. Gerüsttests ohne Coverage-Gate für `lib/planner/**`).
