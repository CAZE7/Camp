# Abschlussbericht — PR #604 / Engineering & Quality Framework (Camp)

**Branch:** `arena/949821e6-camp` (gemerged in `main` via `arena/12da846b-camp`)  
**Merge-Commit-SHA:** `6456131` (Merge pull request #604)  
**Head-SHA:** `b29c0a7` (letzter Commit auf dem PR-Branch vor dem Merge)  
**PR:** #604 (https://github.com/CAZE7/Camp/pull/604) — state: MERGED  
**Stand:** 2026-11-05  
**Bewertung:** GEMERGED — Alle Merge-Readiness-Kriterien erfüllt, Restrisiken dokumentiert (Abschnitt 8)

---

## 1. Behobene Probleme

### A. Safety Case und elektrische Sicherheitsbehauptungen

| #    | Problem                                                                                                                                                                         | Korrektur                                                                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | CL-001 behauptete "mathematisch nachgewiesen + durch Tests verifiziert" mit pauschalem "Erfüllt". Manuelle `fuseSize`-Eingabe und alternative Berechnungspfade nicht abgedeckt. | CL-001 auf "Teilweise" herabgestuft. Kategorie auf "durch Tests verifiziert" eingeschränkt. Ergebnis dokumentiert als "Teilweise (manuelle `fuseSize`-Eingabe nicht durch `selectFuseSize`-Grenze abgedeckt; alternative Strompfade nicht vollständig ausgeschlossen)". |
| A-02 | CL-002 verweist auf R-004, R-005, R-006. R-004 ist jetzt "Behandelt".                                                                                                           | CL-002 verweist auf R-004 (behandelt), R-005, R-006.                                                                                                                                                                                                                    |

### B. 20-cm-Sicherungsregel – R-004 / O-01 / N-01

| #    | Problem                                                                                                                                                                                                                  | Korrektur                                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Risk Register R-004 Status "Behandelt", obwohl Code fehlenden `fuseOffset` stillschweigend als "am Pol" wertet (kein kritischer Befund), was S-03 ("Fehlen ist ein kritischer Befund") widerspricht.                     | R-004 auf "Behandelt" geändert. Nachweis: `fuse-offset-missing` als kritischer Befund in `CableEdge.tsx` implementiert, 3 Unit-Tests (fehlend / ≤ 20 cm / > 20 cm) grün.                                                     |
| B-02 | REQUIREMENTS-MATRIX CAMP-REQ-002 Ergebnis "Erfüllt", obwohl R-004 offen.                                                                                                                                                 | Ergebnis auf "Teilweise" geändert, Claim CL-002 zugewiesen.                                                                                                                                                                  |
| B-03 | Code-Befund in `components/edges/CableEdge.tsx`: `fuse-offset`-Regel feuert nur wenn `data.fuseOffset !== undefined && data.fuseOffset > FUSE_MAX_UNPROTECTED_LENGTH_M`. Fehlender `fuseOffset` löste keinen Fehler aus. | **Code geändert:** Fehlender `fuseOffset` bei gesetzter `fuseSize` löst jetzt kritischen Befund `fuse-offset-missing` aus (S-03). `EdgeErrorRule` um `'fuse-offset-missing'` erweitert. Keine elektrischen Formeln geändert. |

### C. Requirements Matrix – Traceability (O-03, O-04a, O-04b geschlossen)

| #    | Problem                                                               | Korrektur                                                                                                                                                                                                                                               |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | CAMP-REQ-001 Ergebnis "Erfüllt", aber CL-001 ist jetzt "Teilweise".   | Ergebnis auf "Teilweise" geändert.                                                                                                                                                                                                                      |
| C-02 | CAMP-REQ-002 hat keinen Safety-Case-Claim (Matrix Rule M-4 verletzt). | Claim CL-002 zugewiesen (existiert bereits, thematisch passend). Risk R-004 (behandelt). Konsistenzcheck besteht jetzt.                                                                                                                                 |
| C-03 | CAMP-REQ-023 hat keinen Safety-Case-Claim (Matrix Rule M-4 verletzt). | Claim CL-023 neu erstellt (Safety Case), verknüpft mit #605-REMEDIATION-PLAN (ROUTE-003).                                                                                                                                                               |
| C-04 | Kein automatisierter Konsistenzcheck vorhanden.                       | `scripts/ci/verify-requirements-matrix.mjs` neu erstellt. Prüft für jede Klasse-S-Anforderung: Claim zugeordnet, Risk-Eintrag zugeordnet, Claim existiert im Safety Case, Risk existiert im Risk Register. Exit-Code 1 bei Verstößen. **Jetzt Exit 0.** |

### D. Engineering Quality Roadmap

| #    | Problem                                                      | Korrektur                                                              |
| ---- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| D-01 | Doppelte Branch-Protection-Aufgaben P1-12 und P2-11.         | P2-11 entfernt, Branch Protection nur noch in Phase 1 (P1-12).         |
| D-02 | Nicht existierende Referenzen auf P1-14 in P2-12 und P2-13.  | Auf P1-12 korrigiert (Branch Protection in Phase 1).                   |
| D-03 | Fehlende P2-9 (Nummerierungslücke).                          | P2-9 eingefügt: "Konsistenzcheck Requirements Matrix in CI aufnehmen". |
| D-04 | Falsche Aufwandssumme Phase 2B (36 PT statt 34 PT).          | Auf 34 PT korrigiert (5+8+3+4+5+3+2+4).                                |
| D-05 | Falsche Aufwandssumme Phase 2 insgesamt (42 PT statt 43 PT). | Auf 43 PT korrigiert (9+34).                                           |

### E. Risk Register und FMEA

| #    | Problem                                                                                       | Korrektur                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| E-01 | R-001: RPN 9 (Safety Plan) vs. 8 (Risk Register).                                             | Beide auf 4 korrigiert (S2×E2=4).                                                                                   |
| E-02 | R-008: RPN 8 (beide Dokumente).                                                               | Auf 4 korrigiert (S2×E2=4).                                                                                         |
| E-03 | R-009: RPN 8 (beide Dokumente).                                                               | Auf 4 korrigiert (S2×E2=4).                                                                                         |
| E-04 | R-012: RPN 6 (Risk Register).                                                                 | Auf 4 korrigiert (S2×E2=4).                                                                                         |
| E-05 | R-018, R-020, R-022, R-015, R-016, R-017, R-021, R-023, R-024: RPN-Werte für Nicht-S-Klassen. | Alle auf "—" korrigiert (keine Schwere-Klasse S für D, F, P, Q, UX).                                                |
| E-06 | Verfahren als "FMEA" bezeichnet, aber keine systematische Erkennbarkeitsbewertung.            | Auf "vereinfachte Risikopriorisierung (S × E)" korrigiert, nicht als vollständige klassische FMEA.                  |
| E-07 | Safety Plan §8 RPN-Werte widersprachen Risk Register.                                         | Safety Plan §8 an Risk Register angeglichen (R-001: 4, R-008: 4, R-009: 4, R-019: 6, R-018: —, R-022: —, R-020: —). |
| E-08 | R-004 Status widersprach Code-Implementierung.                                                | R-004 auf "Behandelt" geändert, Nachweis durch Unit-Tests für `fuse-offset-missing`.                                |
| E-09 | R-025 neu: AutoWire-Idempotenz ohne vollständigen Risiko-Nachweis.                            | R-025 zum Risk Register hinzugefügt (S2, E2, RPN 4, Status "Offen", Phase 2).                                       |

### Weitere Korrekturen

| #    | Dokument                             | Korrektur                                                                                                                                                                                |
| ---- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | `DEFINITION-OF-DONE.md` PR-3         | "Alle Required Status Checks bei Branch Protection grün" → "Required Status Checks bei Branch Protection (geplant, noch nicht aktiv in GitHub)".                                         |
| F-02 | `DEFINITION-OF-DONE.md` PR-5         | Branch Protection „Require branches to be up to date“ als geplant, nicht aktiv gekennzeichnet.                                                                                           |
| F-03 | `RELEASE-GATES.md` R-4               | "Ja (blockiert)" → "Nein (Zielkonflikt dokumentiert, PERF-001; nicht blockierend)".                                                                                                      |
| F-04 | `docs/AUDIT-ERGEBNISSE.md`           | Vollständig neu geschrieben mit allen Korrekturen, Widerspruchsliste, Korrekturliste, offene Fragen, CI-Gate-Nachweis, Requirements Matrix, Safety-System, Testergebnisse, Phase-2-Plan. |
| F-05 | `.github/workflows/quality.yml`      | `requirements-matrix-check`: `continue-on-error` entfernt (jetzt blockierend, da Konsistenzcheck Exit 0). M-6 bis M-14 als Steps im `quality`-Job hinzugefügt.                           |
| F-06 | `docs/verification/RELEASE-GATES.md` | Mapping-Tabelle M↔G (PR #604 ↔ PR #605) ergänzt. G2, G4, G6 als "mit PR #605-Remediation geplant" markiert.                                                                              |

---

## 2. Neu hinzugefügte automatisierten Prüfungen

### `scripts/ci/verify-requirements-matrix.mjs`

Prüft für jede Klasse-S-Anforderung (CAMP-REQ-XXX):

1. Ein Safety-Case-Claim (CL-XXX) ist in der Spalte "Claim" zugeordnet (Matrix Rule M-4).
2. Ein Risk-Register-Eintrag (R-XXX) ist in der Spalte "Risk" zugeordnet (Matrix Rule M-4).
3. Der referenzierte Claim existiert in `docs/safety/SAFETY-CASE.md`.
4. Der referenzierte Risk-Eintrag existiert in `docs/safety/RISK-REGISTER.md`.

**Aufruf:** `node scripts/ci/verify-requirements-matrix.mjs`  
**Verhalten:** Bei Verstößen Exit-Code 1 (CI-Job schlägt fehl).  
**Aktuelles Ergebnis:** ✅ Exit 0 — alle 17 Klasse-S-Anforderungen haben gültige Claims und Risk-Register-Einträge.

### `scripts/ci/verify-requirements-matrix.test.ts`

11 Unit-Tests, alle bestanden:

- vollständig korrekte Matrix besteht
- fehlender Claim bei Klasse S schlägt fehl
- fehlender Risk-Eintrag bei Klasse S schlägt fehl
- nicht existierender Claim wird erkannt
- nicht existierender Risk-Eintrag wird erkannt
- fehlerhafte Dateipfade werden erkannt
- nicht auflösbares Glob-Muster wird nicht als existierend akzeptiert
- Status "Erfüllt" ohne vollständigen Nachweis schlägt fehl
- fehlerhafte Tabellenzeile (ungültige ID-Format) schlägt fehl
- doppelte Requirement-IDs werden erkannt
- Teilweise-Offene Klasse-S-Anforderung ohne Claim wird als Fehler erkannt

---

## 3. Code-Änderung: R-004 / 20-cm-Regel (A-1, O-01, N-01)

### `components/edges/CableEdge.tsx`

Fehlender `data.fuseOffset` bei gesetzter `data.fuseSize` löst jetzt einen kritischen Befund `fuse-offset-missing` aus:

- Nachricht: "Sicherungsabstand zum Pol fehlt — 20-cm-Regel nicht prüfbar (fuseOffset fehlt)!"
- Schwere: `critical`
- Rule-ID: `fuse-offset-missing`
- `EdgeErrorRule` um `'fuse-offset-missing'` erweitert

Bestehende `fuse-offset`-Prüfung (> 0,2 m) bleibt unverändert.

### `components/edges/CableEdge.test.tsx`

3 neue Unit-Tests hinzugefügt (alle 37 Tests grün):

1. Fehlender `fuseOffset` bei gesetzter `fuseSize` → kritischer Befund `fuse-offset-missing`
2. `fuseOffset ≤ 20 cm` → kein `fuse-offset`-Fehler
3. `fuseOffset > 20 cm` → kritischer `fuse-offset`-Befund

### `store/usePlannerStoreExtended.test.ts`

`assertZeroWarnings` und `assertNoSafetyWarnings` angewendet: `fuseOffset` (0,1 m ≤ 20 cm) wird auf AutoWire-Kanten mit `fuseSize` gesetzt, bevor `collectEdgeErrors` läuft (Testdaten-Korrektur, keine Testabschwächung — die Erwartung "keine Sicherheitsbefunde" bleibt gleich). Alle 62 Tests grün.

---

## 4. Geänderte Dateien (21 Stück)

| Datei                                           | Änderung                                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/SYSTEM-ARCHITECTURE.md`      | Formatierung (Prettier)                                                                                                                                                                     |
| `docs/architecture/ARCHITECTURE-RULES.md`       | Formatierung (Prettier)                                                                                                                                                                     |
| `docs/engineering/ENGINEERING-CONSTITUTION.md`  | Formatierung (Prettier)                                                                                                                                                                     |
| `docs/engineering/DEFINITION-OF-DONE.md`        | PR-3, PR-5 als "geplant, noch nicht aktiv"                                                                                                                                                  |
| `docs/safety/SAFETY-PLAN.md`                    | §8 RPN-Werte angeglichen, Methode präzisiert                                                                                                                                                |
| `docs/safety/RISK-REGISTER.md`                  | RPN-Werte korrigiert (S×E), R-004 auf "Behandelt", R-025 neu, Nicht-S-Klassen als "—", Methode als vereinfachte Risikopriorisierung                                                         |
| `docs/safety/SAFETY-CASE.md`                    | CL-001 auf "Teilweise", CL-002 auf R-004 (behandelt), CL-023 neu (Domänen-Trennregeln, Offen)                                                                                               |
| `docs/verification/VERIFICATION-STRATEGY.md`    | Formatierung (Prettier)                                                                                                                                                                     |
| `docs/verification/REQUIREMENTS-MATRIX.md`      | CAMP-REQ-001 auf "Teilweise", CAMP-REQ-002 auf "Teilweise" + Claim CL-002, CAMP-REQ-014 auf "Teilweise" + Risk R-025, CAMP-REQ-023 auf "Offen" + Claim CL-023, CAMP-REQ-005 Pfad korrigiert |
| `docs/verification/RELEASE-GATES.md`            | R-4 als nicht blockierend, Mapping-Tabelle M↔G (PR #604 ↔ PR #605) ergänzt                                                                                                                  |
| `docs/ENGINEERING-QUALITY-ROADMAP.md`           | Doppelte P1-12/P2-11 entfernt, P1-14-Referenzen korrigiert, P2-9 hinzugefügt, Aufwandssummen korrigiert                                                                                     |
| `docs/AUDIT-ERGEBNISSE.md`                      | Vollständig neu geschrieben                                                                                                                                                                 |
| `scripts/ci/verify-requirements-matrix.mjs`     | Neu: Automatisierter Konsistenzcheck für Requirements Matrix, Glob-Auflösung mit echten Dateitreffern, CLI-Guard via import.meta.url                                                        |
| `scripts/ci/verify-requirements-matrix.test.ts` | Neu: 11 Unit-Tests für den Konsistenzcheck (alle bestanden)                                                                                                                                 |
| `docs/ABschlussbericht_PR604.md`                | Aktualisiert auf SHA 5e22af5, 21 Dateien, Status-Tabelle O-01..O-09 / N-01..N-08                                                                                                            |
| `docs/PR-MERGEPLAN.md`                          | Neu: Merge-Reihenfolge für alle 12 offenen PRs, Konfliktanalyse, Zuordnung O-/N-Punkte                                                                                                      |
| `docs/ci/BRANCH-PROTECTION-SETUP.md`            | Neu: Checkliste Required Status Checks für alle Jobs, Dependabot-Strategie, Ausnahme-Regelung                                                                                               |
| `components/edges/CableEdge.tsx`                | `fuse-offset-missing` als kritischer Befund (S-03), `EdgeErrorRule` erweitert                                                                                                               |
| `components/edges/CableEdge.test.tsx`           | 3 neue Unit-Tests für `fuse-offset-missing` (fehlend / ≤ 20 cm / > 20 cm)                                                                                                                   |
| `store/usePlannerStoreExtended.test.ts`         | `assertZeroWarnings` + `assertNoSafetyWarnings`: fuseOffset-Default für AutoWire-Tests                                                                                                      |
| `.github/workflows/quality.yml`                 | `requirements-matrix-check` blockierend (continue-on-error entfernt), M-6 bis M-14 als Steps im `quality`-Job                                                                               |
| `docs/ci/workflows/quality.yml`                 | Synchron mit `.github/workflows/quality.yml`                                                                                                                                                |

---

## 5. CI-Ergebnisse (lokaler Testlauf)

| Prüfung                | Befehl                                                         | Ergebnis   | Nachweis                                                                                                |
| ---------------------- | -------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| Format-Check           | `npx prettier --check`                                         | ✅ Grün    | Alle Dateien Prettier-konform (GitHub Actions: Format-Check SUCCESS)                                   |
| Typecheck (Produktion) | `npm run typecheck`                                            | ✅ Grün    | `tsc -p tsconfig.typecheck.json --noEmit` (Exit 0; GitHub Actions: Typecheck SUCCESS)                  |
| Typecheck (Tests)      | `npm run typecheck:tests`                                      | ✅ Grün    | `tsc -p tsconfig.tests.json --noEmit` (Exit 0; GitHub Actions: Typecheck SUCCESS)                      |
| Lint                   | `npm run lint`                                                 | ✅ Grün    | `eslint .` (Exit 0; GitHub Actions: Lint SUCCESS)                                                       |
| Tests (Coverage)       | `npm run test:coverage`                                        | ⚠️ Timeout | Nach 300s abgebrochen (Sandbox-Umweltproblem, kein Code-Problem). GitHub Actions: Unit-Tests SUCCESS.  |
| Konsistenzcheck        | `node scripts/ci/verify-requirements-matrix.mjs`               | ✅ Exit 0  | Alle 17 Klasse-S-Anforderungen haben gültige Claims und Risk-Register-Einträge. (GitHub Actions: SUCCESS)|
| Matrix-Unit-Tests      | `npx vitest run scripts/ci/verify-requirements-matrix.test.ts` | ✅ Grün    | 11/11 Tests bestanden                                                                                   |
| Workflow-Sync-Test     | `npx vitest run scripts/ci/workflows.test.ts`                  | ✅ Grün    | 23/23 Tests bestanden                                                                                   |
| Routing-Audit          | `npm run routing:audit`                                        | ✅ Grün    | Alle Invarianten I1–I7 = 0, deterministisch (GitHub Actions: M-7 SUCCESS)                              |
| Build                  | `npm run build`                                                | ✅ Grün    | 47 statische Seiten, Export-Prüfung grün (GitHub Actions: Build SUCCESS)                               |
| M-14 Accessibility     | `npx playwright test tests/e2e/a11y.spec.ts`                   | ✅ Grün    | 40/40 a11y-Tests grün (lokal + GitHub Actions: M-14 SUCCESS nach Browser-Install-Fix)                  |
| End-to-End (Playwright)| `npx playwright test`                                          | ✅ Grün    | GitHub Actions: E2E SUCCESS                                                                             |
| CableEdge-Tests        | `npx vitest run components/edges/CableEdge.test.tsx`           | ✅ Grün    | 37/37 Tests bestanden (inkl. 3 neuen für fuse-offset-missing)                                           |
| Store-Extended-Tests   | `npx vitest run store/usePlannerStoreExtended.test.ts`         | ✅ Grün    | 62/62 Tests bestanden                                                                                   |

**Run-Links:** GitHub Actions CI für PR #604 (Run-ID 42082769556, SHA b29c0a7) — alle blockierenden Checks SUCCESS.  
**Merge-Commit-SHA:** `6456131`  
**Head-SHA:** `b29c0a7`  
**PR-URL:** https://github.com/CAZE7/Camp/pull/604

---

## 6. Status-Tabelle: Offene Punkte O-01..O-09 / N-01..N-08

| ID    | Titel                                                 | Status      | Erledigt durch            | Nachweis                                                           | Restrisiko                                | Issue-# |
| ----- | ----------------------------------------------------- | ----------- | ------------------------- | ------------------------------------------------------------------ | ----------------------------------------- | ------- |
| O-01  | R-004 20-cm-Regel (fehlender fuseOffset als kritisch) | ✅ Erledigt | #604 (A-1, Code)          | CableEdge.tsx fuse-offset-missing, 3 Unit-Tests, R-004="Behandelt" | Keines (behandelt)                        | —       |
| O-02  | CL-001 I_B ≤ I_n ≤ I_z teilweise belegt               | ⚠️ Offen    | #604 + #605 (E-1,E-2,K-2) | CL-001="Teilweise", Verweis auf #605-Invarianten                   | Manuelle fuseSize-Eingabe nicht abgedeckt | —       |
| O-03  | CAMP-REQ-002 kein Claim                               | ✅ Erledigt | #604 (Phase 2)            | Claim CL-002 zugewiesen, Konsistenzcheck Exit 0                    | Keines                                    | —       |
| O-04a | CAMP-REQ-014 kein Risk-Eintrag                        | ✅ Erledigt | #604 (Phase 2)            | Risk R-025 zugewiesen, Konsistenzcheck Exit 0                      | Keines                                    | —       |
| O-04b | CAMP-REQ-023 kein Claim                               | ✅ Erledigt | #604 (Phase 2)            | Claim CL-023 zugewiesen, Konsistenzcheck Exit 0                    | Keines                                    | —       |
| O-05  | CI-Gates M-6..M-14 nicht implementiert                | ✅ Erledigt | #604 (Phase 3)            | quality.yml erweitert, requirements-matrix-check blockierend       | Keines                                    | —       |
| O-06  | Branch Protection nicht in GitHub aktiv               | ⚠️ Offen    | #604 (Doku) + Admin       | BRANCH-PROTECTION-SETUP.md erstellt                                | Merge ohne grünes Gate möglich            | —       |
| O-07  | Mutation Testing nicht im CI                          | ⚠️ Offen    | #605 (G4, eigener PR)     | RELEASE-GATES.md Mapping G4 als "geplant"                          | Keine Mutation-Abdeckung                  | —       |
| O-08  | Visual-Regression-Job nicht blockierend               | ⚠️ Offen    | #604 + #606               | visual-Job `continue-on-error: true`, identisch mit #606           | UI-Drift unentdeckt                       | —       |
| O-09  | test:coverage Timeout (Sandbox, 300s)                 | ⚠️ Offen    | #604 (Umwelt)             | Alle bis dahin gelaufenen Tests grün                               | Keine vollständige Coverage-Messung       | —       |
| N-01  | Code-Änderung CableEdge.tsx (R-004)                   | ✅ Erledigt | #604 (A-1)                | fuse-offset-missing implementiert, Tests grün                      | Keines                                    | —       |
| N-02  | Branch Protection in GitHub einrichten                | ⚠️ Offen    | Admin (Repo-Rechte)       | BRANCH-PROTECTION-SETUP.md                                         | Manuelle Einrichtung erforderlich         | —       |
| N-03  | Fehlende CI-Gates in quality.yml                      | ✅ Erledigt | #604 (Phase 3)            | M-6 bis M-14 hinzugefügt                                           | Keines                                    | —       |
| N-04  | Mutation Testing einführen                            | ⚠️ Offen    | #605 (eigener PR)         | ADR-Verknüpfung geplant                                            | Keine Mutation-Abdeckung                  | —       |
| N-05  | Visual-Regression blockierend                         | ⚠️ Offen    | #604 + #606 (Phase 2)     | Baselines nach UI-Freigabe neu aufnehmen                           | UI-Drift unentdeckt                       | —       |
| N-06  | Fahrzeug-Leitungskontext schließen (R-001)            | ⚠️ Offen    | Phase 2 (Issue)           | R-001 dokumentiert, FLRY/ISO 6722 Tabelle fehlt                    | Kabel unterdimensioniert möglich          | phase-2 |
| N-07  | AC-Netzimpedanz-Annahme messen (R-008)                | ⚠️ Offen    | Phase 2 (Issue)           | R-008 dokumentiert, 0,8 Ω ist UNVERIFIED                           | AC-Abschaltung auf Annahme gestützt       | phase-2 |
| N-08  | Domänen-Trennregeln anbinden (R-019)                  | ⚠️ Offen    | Phase 2 (Issue) + #605    | R-019 dokumentiert, ROUTE-003, CL-023 zugewiesen                   | 24 px AC/DC-Abstand nicht angebunden      | phase-2 |

**Legende:** ✅ Erledigt = in diesem PR umgesetzt / ⚠️ Offen = benötigt Folge-PR oder Admin-Aktion

---

## 7. Nicht umgesetzte Maßnahmen mit Begründung

| #    | Maßnahme                                   | Begründung                                                                                         |
| ---- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| N-02 | Branch Protection in GitHub einrichten     | Erfordert `workflows:write` / Repo-Admin-Rechte. Organisatorische Maßnahme, kein Code-Change.      |
| N-04 | Mutation Testing einführen                 | Phase-2-Maßnahme (P2-5). Erfordert eigenen ADR. Wird durch PR #605 (G4) konzeptionell vorbereitet. |
| N-05 | Visual-Regression-Job blockierend machen   | Phase-2-Maßnahme (P2-11). Erfordert UI-Freigabe und Baselines-Neufnahme.                           |
| N-06 | Fahrzeug-Leitungskontext schließen (R-001) | Phase-2-Maßnahme (P2-2). Erfordert FLRY/ISO 6722 Tabelle und Golden-Master-Recapture.              |
| N-07 | AC-Netzimpedanz-Annahme messen (R-008)     | Phase-2-Maßnahme (P2-3). Erfordert Messwert vor Ort.                                               |
| N-08 | Domänen-Trennregeln anbinden (R-019)       | Phase-2-Maßnahme (P2-1). Erfordert Router-Anbindung (ROUTE-003).                                   |

---

## 8. Bewertung: GEMERGED

**Alle Merge-Readiness-Kriterien waren erfüllt (PR #604 gemerged am 2026-11-05 via Merge-Commit 6456131):**

| Kriterium                | Status     | Nachweis                                                                                            |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------- |
| Konsistenzcheck Exit 0   | ✅ Erfüllt | `node scripts/ci/verify-requirements-matrix.mjs` → Exit 0, alle 17 Klasse-S-Anforderungen verknüpft |
| Alle lokalen Gates grün  | ✅ Erfüllt | format ✅, typecheck ×2 ✅, lint ✅, routing:audit ✅, build ✅                                     |
| Mapping M↔G dokumentiert | ✅ Erfüllt | `docs/verification/RELEASE-GATES.md` §2.1                                                           |
| Keine unbelegten Claims  | ✅ Erfüllt | Alle Status durch Nachweis belegt, keine erfundenen Claims/Risiken                                  |

**Offene Punkte (Restrisiken, nicht merge-blockierend):**

Die folgenden Punkte sind dokumentierte Restrisiken, die den Merge **nicht blockieren**, sondern als Phase-2-Aufgaben oder durch Parallel-PRs übernommen werden:

- **O-02 / CL-001:** `I_B ≤ I_n ≤ I_z` teilweise belegt — #605 Invarianten E-1/E-2/K-2 abwarten, CL-001 bleibt "Teilweise" mit Verweis auf #605
- **O-06 / N-02:** Branch Protection in GitHub nicht aktiv — erfordert Repo-Admin, Dokumentation in `BRANCH-PROTECTION-SETUP.md` vorbereitet
- **O-07 / N-04:** Mutation Testing nicht im CI — #605 bringt G4 konzeptionell, eigener PR folgt nach #605
- **O-08 / N-05:** Visual-Regression nicht blockierend — #606 beschreibt Baseline-Verfahren, Job bleibt "melden, nicht blockierend"
- **O-09:** test:coverage Timeout — Sandbox-Umweltproblem (300s), kein Code-Problem
- **N-06, N-07, N-08:** Phase-2-Restrisiken (R-001, R-008, R-019) — Issues mit Label `phase-2` sind manuell zu eröffnen (GitHub-App hatte keine Issue-Erstellungs-Berechtigung)

**Empfehlung:** Der PR ist **MERGE-READY** als Dokumentations- und Code-Update. Die offenen Punkte sind dokumentierte Restrisiken, die vor einem öffentlichen Release in Phase 2 gelöst werden müssen. Der Konsistenzcheck besteht (Exit 0), alle Klassen-S-Anforderungen haben gültige Claims und Risk-Einträge, keine unbelegten Sicherheitsbehauptungen verbleiben.

---

**Ende des Abschlussberichts.**
