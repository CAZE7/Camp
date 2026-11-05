# Audit-Ergebnisse — Engineering & Quality Framework (Camp)

**Stand:** 2026-11-05  
**Branch:** `arena/949821e6-camp`  
**PR:** #604 (https://github.com/CAZE7/Camp/pull/604)  
**Basis:** Commit `90ce95a` (aufbauend auf `2b8fd91`)  
**Prüfgegenstand:** 12 Dokumente (11 Framework-Dokumente + AUDIT-ERGEBNISSE.md) + bestehende Artefakte (AGENTS.md, ADRs, package.json, GitHub Actions, Tests, neuer Konsistenzcheck)

---

## 1. Zusammenfassung

Das Audit aller 12 Dokumente ist abgeschlossen. Alle dokumentenübergreifenden Widersprüche (A–E) sind behoben. Ein automatisierter Konsistenzcheck für die Requirements Matrix wurde erstellt (`scripts/ci/verify-requirements-matrix.mjs`). Die Dokumente sind untereinander konsistent (IDs, Referenzen, Status, Nachweisketten, RPN-Werte).

Die Hauptlücken liegen zwischen dokumentierten CI-Gates und tatsächlicher Workflow-Implementierung sowie bei der nicht aktiven Branch Protection. Diese sind als offene Punkte dokumentiert, nicht als gelöst behauptet.

Keine elektrischen Formeln, Tabellen oder Grenzwerte geändert. PR #605 nicht verändert. Keine bestehenden Commits überschrieben. Keine fremden Branches übernommen. Keine Tests abgeschwächt. Keine Baselines blind aktualisiert. Keine fachlichen Freigaben erfunden.

---

## 2. Geprüfte Dokumente (12 Stück)

| #   | Dokument                                       | Status          | Prüfung                                                                                                 |
| --- | ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | `docs/architecture/SYSTEM-ARCHITECTURE.md`     | ✅ Konsistent   | 10-Layer, SSOT, Dependency Matrix, Versioning, Enforcement-Tests                                        |
| 2   | `docs/architecture/ARCHITECTURE-RULES.md`      | ✅ Konsistent   | Regeln A–N, S-1–S-10, O-1–O-5, Enforcement-Befehle                                                      |
| 3   | `docs/engineering/ENGINEERING-CONSTITUTION.md` | ✅ Konsistent   | Requirement-Klassen, Acceptance Criteria, Code Quality, Test-Matrix, Safety-Regeln, CI/Release-Gates    |
| 4   | `docs/engineering/DEFINITION-OF-DONE.md`       | ✅ Korrigiert   | PR-3: Branch Protection als "geplant, noch nicht aktiv"; PR-5 als "geplant, nicht aktiv"                |
| 5   | `docs/safety/SAFETY-PLAN.md`                   | ✅ Konsistent   | FTA/SSA, S-01–S-12, Risikoklassifizierung, Verantwortlichkeiten, §8 RPN-Werte angeglichen               |
| 6   | `docs/safety/RISK-REGISTER.md`                 | ✅ Konsistent   | 24 Einträge R-001–R-024, RPN = S×E nur für Klasse S, Nicht-S-Klassen als "—", R-004 auf "Offen"         |
| 7   | `docs/safety/SAFETY-CASE.md`                   | ✅ Konsistent   | CL-001 auf "Teilweise" (manuelle fuseSize-Eingabe nicht abgedeckt), CL-002 verweist auf R-004 als offen |
| 8   | `docs/verification/VERIFICATION-STRATEGY.md`   | ✅ Konsistent   | 16 Prüfverfahren, per-area Acceptance, Mutation Testing geplant                                         |
| 9   | `docs/verification/REQUIREMENTS-MATRIX.md`     | ✅ Konsistent   | CAMP-REQ-001 auf "Teilweise", CAMP-REQ-002 auf "Teilweise", CAMP-REQ-023 ohne Claim (offen)             |
| 10  | `docs/verification/RELEASE-GATES.md`           | ✅ Korrigiert   | R-4: Performance als "Nicht blockierend (Zielkonflikt)"                                                 |
| 11  | `docs/ENGINEERING-QUALITY-ROADMAP.md`          | ✅ Aktualisiert | Doppelte P1-12/P2-11 entfernt, P1-14-Referenzen korrigiert, P2-9 hinzugefügt, Aufwandssummen korrigiert |
| 12  | `docs/AUDIT-ERGEBNISSE.md`                     | ✅ Neu          | Dieses Dokument                                                                                         |
| 13  | `scripts/ci/verify-requirements-matrix.mjs`    | ✅ Neu          | Automatisierter Konsistenzcheck für Requirements Matrix                                                 |

---

## 3. Behobene Widersprüche (A–E)

### A. Safety Case und elektrische Sicherheitsbehauptungen

| #    | Dokument                | Problem                                                                                                                                                                 | Korrektur                                                                                                                                                                                                                                                                                                                     |
| ---- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | `SAFETY-CASE.md` CL-001 | Behauptet "mathematisch nachgewiesen + durch Tests verifiziert" mit pauschalem "Erfüllt". Manuelle `fuseSize`-Eingabe und alternative Berechnungspfade nicht abgedeckt. | Auf "Teilweise" geändert. Kategorie eingeschränkt auf "durch Tests verifiziert (Sweep 39 990 Komb., 0 Verstöße); nicht mathematisch für alle manuellen Eingaben". Ergebnis: "Teilweise (manuelle `fuseSize`-Eingabe nicht durch `selectFuseSize`-Grenze abgedeckt; alternative Strompfade nicht vollständig ausgeschlossen)". |
| A-02 | `SAFETY-CASE.md` CL-002 | Verweist auf R-004, R-005, R-006. R-004 ist jetzt "Offen".                                                                                                              | Verweis ergänzt: "R-004 (offen: 20-cm-Regel bei fehlendem fuseOffset nicht durchgesetzt), R-005, R-006".                                                                                                                                                                                                                      |

### B. 20-cm-Sicherungsregel – R-004

| #    | Dokument                                        | Problem                                                                                                                                     | Korrektur                                                                                                                                                     |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | `RISK-REGISTER.md` R-004                        | Status "Behandelt", obwohl Code fehlenden `fuseOffset` stillschweigend als "am Pol" wertet (kein kritischer Befund), was S-03 widerspricht. | Status auf "Offen" geändert. Begründung: "fehlender fuseOffset löst KEINEN Fehler aus — Widerspruch zu S-03; separater Implementierungsauftrag erforderlich". |
| B-02 | `REQUIREMENTS-MATRIX.md` CAMP-REQ-002           | Ergebnis "Erfüllt", obwohl R-004 offen.                                                                                                     | Ergebnis auf "Teilweise" geändert. Begründung: "fehlender `fuseOffset` wird nicht als kritisch behandelt, widerspricht S-03; R-004 offen".                    |
| B-03 | `SAFETY-CASE.md` CL-002 / `SAFETY-PLAN.md` S-03 | S-03 fordert "Fehlen ist kritischer Befund", Code tut das nicht.                                                                            | Nicht geändert (Produktivlogik darf nicht geändert werden). Dokumentiert als offener Widerspruch mit separatem Implementierungsauftrag.                       |

**Code-Befund (nicht geändert, nur dokumentiert):** `components/edges/CableEdge.tsx` Zeile 381-382: Die `fuse-offset`-Regel feuert nur wenn `data.fuseOffset !== undefined && data.fuseOffset > FUSE_MAX_UNPROTECTED_LENGTH_M`. Fehlt `fuseOffset`, wird kein Fehler gemeldet. Kommentar: "Fehlt fuseOffset, gilt wie bisher der alte Vertrag (Sicherung am Pol) — kein Bruch bestehender Pläne." Dies widerspricht S-03 ("Fehlen ist ein kritischer Befund").

**Separater Implementierungsauftrag erforderlich:** Code-Änderung in `CableEdge.tsx` so dass fehlender `fuseOffset` einen kritischen `main-fuse-distance`-Befund auslöst. Keine Änderung an elektrischen Formeln.

### C. Requirements Matrix – Traceability

| #    | Dokument                                    | Problem                                                       | Korrektur                                                                                                                                                                                                         |
| ---- | ------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | `REQUIREMENTS-MATRIX.md` CAMP-REQ-001       | Ergebnis "Erfüllt", aber CL-001 ist jetzt "Teilweise".        | Ergebnis auf "Teilweise" geändert (CL-001 nur teilweise belegt).                                                                                                                                                  |
| C-02 | `REQUIREMENTS-MATRIX.md` CAMP-REQ-002       | Kein Safety-Case-Claim zugewiesen (Matrix Rule M-4 verletzt). | Kein Claim hinzugefügt (würde falsche Behauptung sein). Stattdessen: Ergebnis auf "Teilweise", Risk als "R-004 (offen)".                                                                                          |
| C-03 | `REQUIREMENTS-MATRIX.md` CAMP-REQ-023       | Kein Safety-Case-Claim zugewiesen (Matrix Rule M-4 verletzt). | Kein Claim hinzugefügt (würde falsche Behauptung sein). Stattdessen: Ergebnis "Offen", Hinweis "kein Safety-Case-Claim zugewiesen".                                                                               |
| C-04 | `scripts/ci/verify-requirements-matrix.mjs` | Nicht vorhanden.                                              | Neu erstellt: Automatisierter Konsistenzcheck, der für jede Klasse-S-Anforderung prüft, ob Claim und Risk-Register-Eintrag vorhanden und im Safety Case / Risk Register existent sind. Bei Verstößen Exit-Code 1. |

### D. Engineering Quality Roadmap

| #    | Problem                                                | Korrektur                                                                                                       |
| ---- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| D-01 | Doppelte Branch-Protection-Aufgaben P1-12 und P2-11    | P2-11 (Branch Protection) entfernt, da P1-12 bereits Branch Protection vorsieht. Keine doppelte Zuordnung mehr. |
| D-02 | Falsche Aufwandssumme Phase 1                          | Nachgerechnet: 2+2+3+2+3+3+3+3+3+3+3+1 = 28 PT (korrekt, keine Änderung nötig).                                 |
| D-03 | Nicht existierende Referenzen auf P1-14                | P2-12 und P2-13 referenzierten P1-14 (existiert nicht). Auf P1-12 geändert (Branch Protection in Phase 1).      |
| D-04 | Fehlende P2-9                                          | P2-9 eingefügt: "Automatisierten Konsistenzcheck für Requirements Matrix in CI aufnehmen".                      |
| D-05 | Falsche Aufwandssumme Phase 2B                         | 5+8+3+4+5+3+2+4 = 34 PT (nicht 36 PT). Korrigiert.                                                              |
| D-06 | Falsche Aufwandssumme Phase 2 insgesamt                | 9+34 = 43 PT (nicht 42 PT). Korrigiert.                                                                         |
| D-07 | Widersprüchliche Zuordnung Branch Protection Phase 1/2 | P2-11 entfernt, Branch Protection nur noch in Phase 1 (P1-12).                                                  |

### E. Risk Register und FMEA

| #    | Problem                                                                 | Korrektur                                                                                                                                      |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| E-01 | R-001: RPN 9 (Safety Plan) vs. 8 (Risk Register)                        | Beide auf 4 korrigiert (S2×E2=4).                                                                                                              |
| E-02 | R-008: RPN 8 (beide Dokumente)                                          | Auf 4 korrigiert (S2×E2=4).                                                                                                                    |
| E-03 | R-009: RPN 8 (beide Dokumente)                                          | Auf 4 korrigiert (S2×E2=4).                                                                                                                    |
| E-04 | R-012: RPN 6 (Risk Register)                                            | Auf 4 korrigiert (S2×E2=4).                                                                                                                    |
| E-05 | R-018: RPN 6 (keine S-Klasse Q)                                         | Auf "—" korrigiert (keine Schwere-Klasse S für Q).                                                                                             |
| E-06 | R-020: RPN 5 (Safety Plan) vs. 4 (Risk Register)                        | Beide auf "—" korrigiert (keine S-Klasse Q).                                                                                                   |
| E-07 | R-022: RPN 4 (Safety Plan) vs. 3 (Risk Register)                        | Beide auf "—" korrigiert (keine S-Klasse P).                                                                                                   |
| E-08 | R-015, R-016, R-017, R-021, R-023, R-024: RPN-Werte für Nicht-S-Klassen | Alle auf "—" korrigiert (keine Schwere-Klasse S für D, F, P, Q, UX).                                                                           |
| E-09 | Methode bezeichnet als "FMEA"                                           | Auf "vereinfachte Risikopriorisierung (S × E)" geändert, nicht als vollständige klassische FMEA (keine systematische Erkennbarkeitsbewertung). |

---

## 4. Vollständiger Konsistenz-Audit (alle 12 Dokumente)

### 4.1 Sicherheitsbehauptungen vs. Code

| Behauptung                                         | Dokument    | Status im Dokument     | Tatsächlicher Code-Zustand                                                      | Konsistent?                 |
| -------------------------------------------------- | ----------- | ---------------------- | ------------------------------------------------------------------------------- | --------------------------- |
| CL-001 `I_B ≤ I_n ≤ I_z` mathematisch nachgewiesen | SAFETY-CASE | Teilweise (korrigiert) | `selectFuseSize` nie > `FUSE_MAP[cs]`, aber manuelle `fuseSize`-Eingabe möglich | ⚠️ Teilweise (dokumentiert) |
| CL-002 Keine verpolte Parallelschaltung            | SAFETY-CASE | Erfüllt                | `isConnectionAllowed` harte Blockade                                            | ✅                          |
| CL-003 Kein stiller Fallback                       | SAFETY-CASE | Erfüllt                | `units.ts` wirft statt 0                                                        | ✅                          |
| CL-004 Datenlücke nie als critical                 | SAFETY-CASE | Erfüllt                | `validationSeverity.ts` Projektion                                              | ✅                          |
| CL-005 I1 hart 0                                   | SAFETY-CASE | Erfüllt (Ratchet 0)    | `checkEdgeNodeCollisions`, `finalValidation.test.ts`                            | ✅                          |
| CL-006 I2 hart 0                                   | SAFETY-CASE | Erfüllt (Ratchet 0)    | `checkEdgeEdgeOverlaps`                                                         | ✅                          |
| CL-007 Clearance I3                                | SAFETY-CASE | Teilweise              | 8 Paare unter 24 px in `complex`-Plan                                           | ✅                          |
| CL-008 AutoWire Verbindlichkeit                    | SAFETY-CASE | Erfüllt                | `mayOverride` strikt                                                            | ✅                          |
| CL-009 AutoWire idempotent                         | SAFETY-CASE | Erfüllt                | G5 Eigenschaft                                                                  | ✅                          |
| CL-010 Routing deterministisch                     | SAFETY-CASE | Erfüllt                | Doppellauf byte-identisch                                                       | ✅                          |
| CL-011 230-V-Modellgrenze                          | SAFETY-CASE | Erfüllt                | `NET-003-ac-model-scope` `INCOMPLETE`                                           | ✅                          |
| CL-012 AC-Abschaltung 0,8 Ω Annahme                | SAFETY-CASE | Teilweise              | Annahme nicht messverifiziert                                                   | ✅                          |
| CL-013 Persistenz RETTEN statt VERWERFEN           | SAFETY-CASE | Erfüllt                | `persistence.ts`                                                                | ✅                          |
| CL-014 Fehlender FI als kritisch                   | SAFETY-CASE | Erfüllt                | `hasRcd` nicht mehr pauschal gesetzt                                            | ✅                          |
| CL-015 Keine Elektrik im UI                        | SAFETY-CASE | Erfüllt                | Rule D, `libBoundary.test.ts`                                                   | ✅                          |
| CL-016 Fahrzeug-Leitungskontext fehlt              | SAFETY-CASE | Offen                  | B2-Tabelle pauschal, f₃ = 1,0                                                   | ✅                          |
| CL-017 0,8 Ω Annahme                               | SAFETY-CASE | Offen                  | UNVERIFIED im Kommentar                                                         | ✅                          |

### 4.2 Anforderungen ohne Implementierungsnachweis

| Req-ID       | Dokument            | Status    | Anspruch                       | Tatsächlicher Nachweis                                   | Konsistent?                 |
| ------------ | ------------------- | --------- | ------------------------------ | -------------------------------------------------------- | --------------------------- |
| CAMP-REQ-001 | REQUIREMENTS-MATRIX | Teilweise | `I_B ≤ I_n ≤ I_z`              | Test Sweep 39 990, aber manuelle Eingabe nicht abgedeckt | ⚠️ Teilweise (dokumentiert) |
| CAMP-REQ-002 | REQUIREMENTS-MATRIX | Teilweise | 20-cm-Regel, Fehlen kritisch   | `fuseOffset` fehlt → kein Fehler (S-03 verletzt)         | ⚠️ Teilweise (dokumentiert) |
| CAMP-REQ-023 | REQUIREMENTS-MATRIX | Offen     | Domänen-Trennregeln angebunden | `buildDomainSeparationRules` nicht angebunden            | ✅ Offen dokumentiert       |

### 4.3 Tests, die nicht existieren

Alle referenzierten Testdateien existieren (Existenzprüfung bestanden). Ausführung im Sandbox nicht möglich (kein `node_modules` bei erster Prüfung, jetzt installiert aber Tests laufen in Timeout).

### 4.4 CI-Gates: Dokumentiert vs. Aktiv

| Gate                        | RELEASE-GATES.md | quality.yml                                              | Aktiv im CI? |
| --------------------------- | ---------------- | -------------------------------------------------------- | ------------ |
| M-1 Build                   | Ja               | ✅ Build-Schritt                                         | Ja           |
| M-2 Type Safety             | Ja               | ✅ typecheck ×2                                          | Ja           |
| M-3 Lint                    | Ja               | ✅ Lint-Schritt                                          | Ja           |
| M-4 Format                  | Ja               | ✅ Format-Check                                          | Ja           |
| M-5 Tests + Coverage        | Ja               | ✅ test:coverage                                         | Ja           |
| M-6 Architekturtests        | Ja               | ❌ Nicht implementiert                                   | Nein         |
| M-7 Routing-Invarianten     | Ja               | ⚠️ Teilweise (routing:audit ja, invariants.test.ts nein) | Teilweise    |
| M-8 Elektrik                | Ja               | ❌ Nicht implementiert                                   | Nein         |
| M-9 Routing-Regression      | Ja               | ❌ Nicht implementiert                                   | Nein         |
| M-10 Komponenten & Daten    | Ja               | ❌ Nicht implementiert                                   | Nein         |
| M-11 Warnsystem             | Ja               | ❌ Nicht implementiert                                   | Nein         |
| M-12 Persistenz & Migration | Ja               | ❌ Nicht implementiert                                   | Nein         |
| M-13 Security               | Ja               | ✅ Lockfile-Gate                                         | Ja           |
| M-14 Accessibility          | Ja               | ❌ Nicht als separer Job                                 | Nein         |
| M-15 E2E                    | Ja               | ✅ e2e Job                                               | Ja           |

### 4.5 Branch Protection

| Voraussetzung                      | Status         | Quelle                                   |
| ---------------------------------- | -------------- | ---------------------------------------- |
| Branch Protection auf Ziel-Branch  | ❌ Nicht aktiv | `CI.md` §4, `DEFINITION-OF-DONE.md` PR-3 |
| Required Status Checks eingetragen | ❌ Nicht aktiv | `CI.md` §4                               |
| Require branches up to date        | ❌ Nicht aktiv | `CI.md` §4                               |
| CODEOWNERS                         | ✅ Hinterlegt  | `.github/CODEOWNERS`                     |

**Nicht behauptet als aktiv.** PR-3 und PR-5 in DEFINITION-OF-DONE.md sind als "geplant, noch nicht aktiv" gekennzeichnet.

---

## 5. Automatisierter Konsistenzcheck

`scripts/ci/verify-requirements-matrix.mjs` prüft für jede Klasse-S-Anforderung:

1. Ein Safety-Case-Claim (CL-XXX) ist in der Spalte "Claim" zugeordnet.
2. Ein Risk-Register-Eintrag (R-XXX) ist in der Spalte "Risk" zugeordnet.
3. Der referenzierte Claim existiert in `docs/safety/SAFETY-CASE.md`.
4. Der referenzierte Risk-Eintrag existiert in `docs/safety/RISK-REGISTER.md`.

**Aktuelles Ergebnis:** 2 Fehler (erwartet, dokumentiert):

- CAMP-REQ-002 (Klasse S): kein Safety-Case-Claim zugewiesen (R-004 offen, kein Claim erfunden)
- CAMP-REQ-023 (Klasse S): kein Safety-Case-Claim zugewiesen (R-019 geplant, kein Claim erfunden)

Der Check schlägt mit Exit-Code 1 fehl, solange diese Verknüpfungen fehlen. Er darf nicht künstlich grün gemacht werden, da keine falschen Claims erfunden werden dürfen.

---

## 6. CI-Ergebnisse (ausgeführt)

| Prüfung                | Befehl                                           | Ergebnis    | Bemerkung                                       |
| ---------------------- | ------------------------------------------------ | ----------- | ----------------------------------------------- |
| Format-Check           | `npx prettier --check <13 Dateien>`              | ✅ Grün     | Alle Dateien Prettier-konform                   |
| Typecheck (Produktion) | `npm run typecheck`                              | ✅ Grün     | `tsc -p tsconfig.typecheck.json --noEmit`       |
| Typecheck (Tests)      | `npm run typecheck:tests`                        | ✅ Grün     | `tsc -p tsconfig.tests.json --noEmit`           |
| Lint                   | `npm run lint`                                   | ⚠️ Timeout  | Nach 60s abgebrochen, kein Ergebnis             |
| Tests (Coverage)       | `npm run test:coverage`                          | ⚠️ Timeout  | Nach 180s abgebrochen, kein Ergebnis            |
| Konsistenzcheck        | `node scripts/ci/verify-requirements-matrix.mjs` | ❌ 2 Fehler | Erwartet: CAMP-REQ-002, CAMP-REQ-023 ohne Claim |

**Einschränkung:** Lint und Tests konnten nicht vollständig ausgeführt werden (Timeout im Sandbox). Die Existenz aller Testdateien, npm-Scripts und Quelldateien wurde verifiziert (57 Testdateien, 19 npm-Scripts, 57 Quelldateien).

---

## 7. Aktualisiertes Safety-System

### 7.1 Safety Plan §8 (Restrisiken)

Konsistent mit `RISK-REGISTER.md` (7 Einträge):

| Risk-Register-ID | Risiko                               | Klasse | RPN | Status                                     |
| ---------------- | ------------------------------------ | ------ | --- | ------------------------------------------ |
| R-001            | Fahrzeug-Leitungskontext teilweise   | S2     | 4   | Akzeptiert als dokumentiertes Restrisiko   |
| R-008            | AC-Netzimpedanz 0,8 Ω Annahme        | S2     | 4   | Akzeptiert als dokumentierte Modellannahme |
| R-019            | Domänen-Trennregeln nicht angebunden | S3     | 6   | Geplant Phase 2                            |
| R-018            | Live-Routing-Performance Ratchet     | Q      | —   | Akzeptiert als dokumentierter Zielkonflikt |
| R-009            | 230-V-Modellgrenze                   | S2     | 4   | Akzeptiert als dokumentierte Modellgrenze  |
| R-022            | Chat/Endpunkt Produktentscheidung    | P      | —   | Offen als Produktentscheidung              |
| R-020            | Visual-Gate nicht blockierend        | Q      | —   | Geplant nach UI-Freigabe                   |

### 7.2 Safety Case Claims (CL-001 bis CL-017)

| Claim  | Ergebnis            | Kategorie                                    | Restrisiko                  | Konsistent |
| ------ | ------------------- | -------------------------------------------- | --------------------------- | ---------- |
| CL-001 | Teilweise           | Tests (nicht mathematisch für alle Eingaben) | R-002                       | ✅         |
| CL-002 | Erfüllt             | Tests                                        | R-004 (offen), R-005, R-006 | ✅         |
| CL-003 | Erfüllt             | Konstruktion + Tests                         | R-014                       | ✅         |
| CL-004 | Erfüllt             | Konstruktion (Projektion)                    | R-014                       | ✅         |
| CL-005 | Erfüllt (Ratchet 0) | Tests + Architekturtest                      | R-010                       | ✅         |
| CL-006 | Erfüllt (Ratchet 0) | Tests                                        | R-011                       | ✅         |
| CL-007 | Teilweise           | Tests (Metrik/Ratchet)                       | R-012                       | ✅         |
| CL-008 | Erfüllt             | Mathematisch (Rangfolge)                     | R-013                       | ✅         |
| CL-009 | Erfüllt             | Mathematisch + Tests                         | —                           | ✅         |
| CL-010 | Erfüllt             | Mathematisch + Tests                         | R-017                       | ✅         |
| CL-011 | Erfüllt             | Tests + Review                               | R-005                       | ✅         |
| CL-012 | Teilweise           | Tests (Annahme nicht messverifiziert)        | R-008                       | ✅         |
| CL-013 | Erfüllt             | Tests                                        | R-015, R-016                | ✅         |
| CL-014 | Erfüllt             | Tests                                        | R-007                       | ✅         |
| CL-015 | Erfüllt             | Review (Architektur)                         | —                           | ✅         |
| CL-016 | Offen               | Modellannahme dokumentiert                   | R-001                       | ✅         |
| CL-017 | Offen               | Externe Datenquelle (teilweise)              | R-008                       | ✅         |

### 7.3 Risk Register (R-001 bis R-024)

Alle 24 Einträge dispositioniert:

- 4 akzeptiert als dokumentiertes Restrisiko/Modellannahme/Zielkonflikt (R-001, R-008, R-009, R-018)
- 14 behandelt
- 5 geplant Phase 2 (R-012, R-019, R-020, R-023, R-024)
- 1 Produktentscheidung R-022 (Product Owner)
- 1 offen (R-004: 20-cm-Regel bei fehlendem fuseOffset)

Keine reinen "Offen"-Status mehr (außer R-004 als dokumentierter offener Widerspruch zu S-03).

---

## 8. Phase-2-Implementierungsplan

Siehe `docs/ENGINEERING-QUALITY-ROADMAP.md` Abschnitt "Teil B — Priorisierte Roadmap".

**Phase 2A — CI-Gates vervollständigen und Branch Protection aktivieren (ca. 9 PT):**

- P2-9: Konsistenzcheck Requirements Matrix in CI aufnehmen
- P2-10: Fehlende Merge-Gates in `quality.yml` aufnehmen (M-6 bis M-12, M-14)
- P2-11: Visual-Regression-Baselines neu aufnehmen, Job blockierend
- P2-12: Accessibility-Gate als eigenen CI-Job

**Phase 2B — Sicherheitslücken schließen und Verifikation vertiefen (ca. 34 PT):**

- P2-1: Domänen-Trennregeln ans Produktivrouter anbinden (ROUTE-003)
- P2-2: Fahrzeug-Leitungskontext schließen (R-001)
- P2-3: AC-Netzimpedanz-Annahme messen oder als UNVERIFIABLE kennzeichnen (R-008)
- P2-4: Clearance-Rest im `complex`-Plan reduzieren (R-012)
- P2-5: Mutation Testing einführen (eigener ADR)
- P2-6: Tastatur-E2E nachholen (R-023)
- P2-7: Security-Headers / CSP prüfen (R-024)
- P2-8: Datenqualitätsdokument für Komponenten (Aufgabe 8)

**Gesamtaufwand Phase 2:** ca. 43 PT.

**Separater Implementierungsauftrag (nicht in Phase 2 enthalten, da Produktivlogik-Änderung):**

- Code-Änderung in `CableEdge.tsx`: fehlender `fuseOffset` muss kritischen `main-fuse-distance`-Befund auslösen (S-03, R-004)

---

## 9. Grenzen eingehalten

- ✅ Keine elektrischen Formeln/Tabellen/Grenzwerte verändert
- ✅ Keine Änderungen an PR #605
- ✅ Keine bestehenden Commits überschrieben
- ✅ Keine fremden Branches übernommen
- ✅ Keine Tests abgeschwächt oder übersprungen
- ✅ Keine Baselines blind aktualisiert
- ✅ Keine fachlichen Freigaben erfunden
- ✅ Keine falschen Claims erfunden (CAMP-REQ-002 und CAMP-REQ-023 haben bewusst keinen Claim)
- ✅ Dokumentation behauptet keine höhere technische Reife als nachgewiesen

---

## 10. Nächste Schritte

1. **Commit** aller Korrekturen auf `arena/949821e6-camp`
2. **Push** des Branches (aktualisiert PR #604)
3. **Phase 2** kann nach Merge der Dokumentation beginnen (erfordert Repo-Admin für Branch Protection, QE für CI-Gate-Erweiterungen)
4. **Separater Implementierungsauftrag** für R-004 (20-cm-Regel bei fehlendem fuseOffset) erstellen

---

## 11. Aktueller Commit-SHA

Nach dem finalen Commit wird der SHA hier eingetragen.

---

**Dokument endet.**
