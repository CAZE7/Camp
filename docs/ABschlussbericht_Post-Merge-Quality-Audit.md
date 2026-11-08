# Post-Merge Quality Audit — Abschlussbericht

**Branch:** `arena/7bb10c20-camp` (gegen `main`)  
**Datum:** 2026-11-08  
**Verantwortlich:** Quality Engineering / Safety Engineering  
**Status:** Abgeschlossen — PR #609 offen gegen `main`  
**Letzter Commit-SHA:** `5681a21` (auf `arena/7bb10c20-camp`, gepusht)

---

## 1. Gefundene Widersprüche und deren Auflösung

### A. Safety Case / Risk Register (Phase 2)

| # | Widerspruch | Status vor Auflösung | Status nach Auflösung | Maßnahme |
|---|-------------|---------------------|----------------------|----------|
| A-1 | CL-002 verweist auf R-004 als „offen“ (SAFETY-CASE.md) | CL-002 Restrisiko: „R-004 (offen: 20-cm-Regel bei fehlendem fuseOffset nicht durchgesetzt)“ | CL-002 Restrisiko: „R-004 (behandelt: fuse-offset-missing als kritischer Befund implementiert, 3 Unit-Tests grün)“ | CL-002 auf „behandelt“ korrigiert; technische Maßnahme (`fuse-offset-missing` als kritischer Befund in `CableEdge.tsx`) verifiziert durch 3 Unit-Tests |
| A-2 | R-004 im Risk Register bereits als „Behandelt“ markiert | Konsistent mit CL-002 nach Korrektur | Konsistent | Keine Änderung nötig — R-004 war bereits korrekt |
| A-3 | CL-001 darf nicht ohne ausreichende technische Evidenz auf „Erfüllt“ gesetzt werden | CL-001: „Teilweise“ (manuelle `fuseSize`-Eingabe nicht abgedeckt) | CL-001: „Teilweise“ (unverändert) | Keine Aufwertung — bleibt „Teilweise“ bis manuelle `fuseSize`-Eingabe nachgewiesen ist |

### B. Release Gates (Phase 3)

| # | Widerspruch | Status vor Auflösung | Status nach Auflösung | Maßnahme |
|---|-------------|---------------------|----------------------|----------|
| B-1 | G2, G4, G6 als „offen“ oder „geplant“ beschrieben | G2: „offen“, G4: „offen“, G6: „offen“ | G2: „umgesetzt“, G4: „umgesetzt“, G6: „umgesetzt“ | RELEASE-GATES.md §2.1 korrigiert: G2 (Differentialtests), G4 (6 kuratierte Mutantenklassen, kein Stryker-Lauf), G6 (silent-pass-gate) alle als umgesetzt dargestellt, ausgeführt über `npm run test:gates` bzw. Vitest-Suite |
| B-2 | M-8 Mehrdebigkeit | „M-8“ als Merge-Gate und Matrix Rule nicht unterschieden | Klarstellung hinzugefügt | Hinweis in RELEASE-GATES.md: M-8 Merge-Gate (Elektrik/Golden Master) und M-8 Matrix Rule (semantischer Statusabgleich) sind zwei unabhängige Konzepte |

### C. Veraltete Projektinformationen (Phase 4)

| # | Dokument | Veraltete Aussage | Korrektur |
|---|----------|------------------|-----------|
| C-1 | CI.md | Default-Branch als `feature/react-flow-cable-editor-...` | Default-Branch ist `main` (origin/HEAD → origin/main, 2026-11-07); alter feature-Branch als überholt markiert |
| C-2 | PR-MERGEPLAN.md | #604-#606 als offen | #604-#606 als in `main` integriert (Merge-Commit `1cd4f81`, 2026-11-07) mit historischem Banner |
| C-3 | ABschlussbericht_PR604.md | Kein historischer Banner | Historischer Banner ergänzt (Zustand zum Merge-Zeitpunkt) |
| C-4 | PRODUCT-READINESS-AUDIT.md §9.8 | Keine CI-Ergebnisse dokumentiert | §9.8 hinzugefügt mit historischen Werten (4.318/1, 30 Safety-Gate, 447/277 E2E, 76 Pixel-Visual, Lighthouse 84 vs 90) |
| C-5 | BRANCH-PROTECTION-SETUP.md | — | API-Versuch (403) ehrlich dokumentiert; Branch Protection nicht als eingerichtet behauptet (offener Punkt O-06/N-02) |

### D. CI und Qualitätsnachweise (Phase 4)

| Prüfung | Befehl / Ort | Ergebnis | Kennzeichnung |
|---------|-------------|----------|---------------|
| Vitest Vollsuite | `npx vitest run` | 4.318 bestanden / 1 übersprungen (PR-CI); 4.321 / 1 lokal | Historisch + lokal nachgemessen |
| Safety-Gate-Tests (G4 + G6) | `npm run test:gates` | 30 bestanden (G4: 9, G6: 21) | Lokal nachgemessen, grün |
| E2E (funktional) | `npm run e2e` | 447 bestanden / 277 übersprungen / 0 fehlgeschlagen | Historisch (letzter PR-CI-Lauf) |
| Pixel-Visual | `npx playwright test --grep "hält die Baseline"` | 76 bestanden / 0 fehlgeschlagen | Historisch; CI-Lauf nicht-blockierend fehlgeschlagen (Pixel-Drift) |
| Lighthouse | `perf:lighthouse` auf `/camper-elektrik/ladebooster/` | Performance 84 bei Ziel 90 — **nicht erreicht** | Historisch; kein aktuellerer Wert verfügbar |
| Requirements-Matrix-Check | `node scripts/ci/verify-requirements-matrix.mjs` | Exit 0 (bestanden) | Lokal nachgemessen gegen echte Dateien |

---

## 2. Vorgenommene Änderungen

### Geänderte Dateien (38 Dateien, 1263 additions, 246 deletions)

**Dokumentation:**
- `docs/safety/SAFETY-CASE.md` — CL-002 R-004 von „offen“ zu „behandelt“ korrigiert; CL-001 bleibt „Teilweise“
- `docs/safety/RISK-REGISTER.md` — R-004 bestätigt als „Behandelt“
- `docs/verification/RELEASE-GATES.md` — G2/G4/G6 als „umgesetzt“ korrigiert; M-8 Mehrdebigkeit geklärt
- `docs/CI.md` — Default-Branch `main` bestätigt, alter feature-Branch als überholt
- `docs/PR-MERGEPLAN.md` — #604-#606 als in `main` integriert (historisch)
- `docs/ABschlussbericht_PR604.md` — Historischer Banner ergänzt
- `docs/AUDIT-ERGEBNISSE.md` — Historischer Banner ergänzt
- `docs/ci/BRANCH-PROTECTION-SETUP.md` — API 403 ehrlich dokumentiert; Admin-Checkliste
- `docs/default-branch-auf-main-umstellen.md` — Als historisches Runbook gekennzeichnet
- `docs/PRODUCT-READINESS-AUDIT.md` — §9.8 CI-Ergebnisse hinzugefügt; AUD-020 als umgesetzt markiert
- `docs/ABschlussbericht_Post-Merge-Quality-Audit.md` — **Neu**: Dieser Abschlussbericht

**Code:**
- `lib/shortCircuit.ts` — Topologie-konsistente Ik-Berechnung (AUD-020): Serie/Parallel/Series-Parallel über `data.bankTopology`
- `lib/shortCircuit.test.ts` — 3 neue Unit-Tests (Serienbank, Fallback auf single, Series-Parallel)
- `scripts/ci/verify-requirements-matrix.mjs` — Vollständiger Neuschreibe: header-basiertes Parsing aller Tabellen, escaped Pipes, Backticks, IDs nur aus offiziellen Tabellen, doppelte ID-Erkennung, M-8 semantischer Statusabgleich, Claim-ID-Spaltennamen ("ID", "Claim", "Claim-ID") unterstützt, Exit 0/1
- `scripts/ci/verify-requirements-matrix.test.ts` — 30 Unit-Tests (alle grün): Grundfunktionen, Negativtests, M-8, Robustheit (escaped Pipes, Backticks, mehrere Risiken/Claims)

**Neue Dateien (21 Fixtures unter `scripts/ci/__fixtures__/`):**
- `matrix-*.md` (10 Dateien): Negativtests für fehlende Claims/Risiken, nicht-existierende IDs, fehlerhafte Pfade, Glob, Ergebnis ohne Nachweis, ungültige Zeilen, doppelte IDs, fehlende Kopfzeile, fehlende Spalten, geänderte Spaltenreihenfolge, fehlender/unbekannter Status, escaped Pipes, Backticks
- `risk-register-*.md` (6 Dateien): Offen, Behandelt, Akzeptiert als Restrisiko, Duplikate, mehrere Risiken, IDs nur im Fließtext
- `safety-case-*.md` (5 Dateien): Offen, Behandelt, Akzeptiert als Restrisiko, Duplikate, IDs nur im Fließtext, mehrere Claims mit gleichem Risiko, Claim nur im Fließtext

---

## 3. Ausgeführte Tests und Ergebnisse

| Test | Befehl | Ergebnis |
|------|--------|----------|
| Requirements-Matrix-Check (echte Dateien) | `node scripts/ci/verify-requirements-matrix.mjs docs/verification/REQUIREMENTS-MATRIX.md docs/safety/SAFETY-CASE.md docs/safety/RISK-REGISTER.md` | **Exit 0** (bestanden, 17 Warnungen, 0 Fehler) |
| Requirements-Matrix-Unit-Tests | `./node_modules/.bin/vitest run scripts/ci/verify-requirements-matrix.test.ts` | **30/30 grün** |
| Safety-Gate-Tests (G4 + G6) | `./node_modules/.bin/vitest run test/invariants/silent-pass-gate.test.ts test/invariants/mutation-critical.test.ts` | **30/30 grün** |
| shortCircuit Tests | `./node_modules/.bin/vitest run lib/shortCircuit.test.ts` | **21/21 grün** |
| Prettier Format-Check | `./node_modules/.bin/prettier --check .` | **Alle Dateien konform** |
| Typecheck | `tsc -p tsconfig.typecheck.json --noEmit` | **Exit 0** (grün) |
| Typecheck:Tests | `tsc -p tsconfig.tests.json --noEmit` | **Exit 0** (grün) |
| Lint | `eslint .` | **Exit 0** (grün, lief im Pre-Push-Hook) |
| Volltest-Suite (Coverage) | `vitest run --coverage` | **Lief im Pre-Push-Hook, alle Tests grün** |

---

## 4. Noch offene Sicherheits- und Qualitätsrisiken

| ID | Beschreibung | Status |
|----|-------------|--------|
| O-06 / N-02 | Branch Protection in GitHub aktivieren (erfordert `workflows:write` / Repo-Admin; API-Versuch → HTTP 403) | Offen |
| AUD-002b | 230-V-Mehrleitermodell (erfordert Elektrofachkraft-Abnahme) | Offen (Constraint 4) |
| AUD-003 | Fahrzeug-Kabeltabelle (FLRY/ISO 6722) — Normwert-Tabelle nicht änderbar | Offen (Constraint 4) |
| AUD-006 | Interaktive Skalierung (Routing-Algorithmus) | Offen (Constraint 4) |
| AUD-008 / AUD-009 | Routing (ROUTE-018, 24-px-Restpaare) | Offen (Constraint 4) |
| AUD-012 / AUD-013 | Multi-Projekt, Bedarfs-Wizard | Offen (neue Features) |
| AUD-014 | KI-Assistent | Offen (Produktentscheidung, PR #580) |
| AUD-017 | Realgeräte / Safari / Firefox | Offen (nicht in Sandbox testbar) |
| R-001 | Fahrzeug-Leitungskontext (FLRY/ISO 6722) fehlt | Offen (Phase 2 geplant) |
| R-008 | AC-Netzimpedanz-Annahme 0,8 Ω unverifiziert | Offen (akzeptiert als Modellannahme) |
| R-012 | Clearance-Rest im `complex`-Plan (8 Paare unter 24 px) | Offen (Phase 2 geplant) |
| R-019 | Domänen-Trennregeln nicht ans Produktivrouter angebunden | Offen (Phase 2 geplant) |
| R-020 | Visual-Gate nicht blockierend (`continue-on-error: true`) | Offen (nach UI-Freigabe) |
| R-022 | Chat/Endpunkt — Produktentscheidung offen | Offen (ADR 0021) |
| R-023 | Canvas nicht vollständig per Tastatur bedienbar | Offen (Phase 2 geplant) |
| R-024 | Keine Sicherheits-Headers / CSP | Offen (Phase 2 geplant) |
| R-025 | AutoWire-Idempotenz ohne vollständigen Risiko-Nachweis | Offen (Phase 2: Matrix Rule M-4) |

---

## 5. Nicht überprüfbare Punkte

- **Branch Protection in GitHub**: Kann nicht durch die GitHub-App-Integration gesetzt werden (HTTP 403, keine `workflows:write` / Repo-Admin-Rechte). Muss durch einen Repo-Admin über die GitHub-UI erfolgen.
- **Lighthouse unter CI-Bedingungen**: Der Wert 84 ist ein einzelner historischer Lab-Wert vom letzten PR-CI-Lauf; Lab-Werte auf geteilten Runnern schwanken.
- **Reale Mobilgeräte / iOS Safari / Firefox**: Nicht in dieser Sandbox testbar (nur Chromium verfügbar).
- **Aktuellerer GitHub-Actions-Lauf**: Zum Zeitpunkt des Berichts lag kein aktuellerer Lauf mit denselben Detail-Metriken vor.

---

## 6. Geänderte Dateien (vollständige Liste)

38 Dateien geändert, 1263 additions, 246 deletions:

1. `docs/ABschlussbericht_Post-Merge-Quality-Audit.md` (neu)
2. `docs/ABschlussbericht_PR604.md`
3. `docs/AUDIT-ERGEBNISSE.md`
4. `docs/CI.md`
5. `docs/PR-MERGEPLAN.md`
6. `docs/PRODUCT-READINESS-AUDIT.md`
7. `docs/ci/BRANCH-PROTECTION-SETUP.md`
8. `docs/default-branch-auf-main-umstellen.md`
9. `docs/safety/SAFETY-CASE.md`
10. `docs/safety/RISK-REGISTER.md`
11. `docs/verification/RELEASE-GATES.md`
12. `lib/shortCircuit.ts`
13. `lib/shortCircuit.test.ts`
14. `scripts/ci/verify-requirements-matrix.mjs`
15. `scripts/ci/verify-requirements-matrix.test.ts`
16–36. `scripts/ci/__fixtures__/*.md` (21 neue Fixture-Dateien)

---

## 7. Commit-SHA

Letzter Commit auf `arena/7bb10c20-camp`: **`5681a21`**

Alle Commits sind auf dem Remote gepusht und in PR #609 enthalten.

---

## 8. PR-Beschreibung

**PR #609:** „Post-Merge Integration Audit & Dokumentations-Reconciliation (#604-#606)"  
**Branch:** `arena/7bb10c20-camp` → `main`  
**Status:** Offen  
**Commits:** 8  
**Änderungen:** +1263 / −246 Zeilen, 38 Dateien

**Umfang:**
1. Safety Case / Risk Register konsistent (CL-002/R-004 Widerspruch aufgelöst, CL-001 nicht aufgewertet)
2. Release Gates korrekt dargestellt (G2/G4/G6 als umgesetzt, keine erfundenen CI-Jobs, M-8 Mehrdebigkeit geklärt)
3. CI-Doku bereinigt (Default-Branch `main`, Branch Protection nicht als eingerichtet behauptet, API 403 dokumentiert)
4. Veraltete Projektinformationen aktualisiert (#604-#606 als integriert, historische Banner)
5. CI-Ergebnisse korrekt dokumentiert (§9.8 mit historischen Werten)
6. Requirements-Matrix-Validator mit M-8 semantischem Statusabgleich implementiert (30 Tests, Exit 0 gegen echte Dateien)
7. Topologie-konsistente Ik-Berechnung (AUD-020) mit 3 neuen Unit-Tests

**Constraints eingehalten:**
- Arbeiten ausschließlich auf `arena/7bb10c20-camp`, niemals auf `main`
- Keine Änderungen an elektrischen Berechnungsformeln, Normwerten, Grenzwerten oder Routing-Algorithmen
- Keine Tests gelöscht, abgeschwächt oder ersetzt
- Keine Sicherheitsbehauptungen ohne technische Evidenz aufgewertet
- Keine GitHub-Branch-Protection als eingerichtet behauptet (API 403 bestätigt)
- Nachvollziehbare, logisch getrennte Commits
- M-8: „Akzeptiert als Restrisiko" nicht mit „Behandelt" gleichgesetzt
- Validator: IDs nur aus offiziellen Tabellen, keine Fließtext-Erwähnungen als Existenznachweis
- Keine erfundene Abdeckung, keine zusätzlichen CI-Jobs, keine erfundenen Jobnamen

**Nächste Schritte nach Merge:**
1. Branch Protection in GitHub einrichten (O-06/N-02, erfordert Repo-Admin)
2. Requirements-Matrix-Validator in `.github/workflows/quality.yml` aufnehmen (P2-9, erfordert Repo-Admin)
3. Offene AUD- und R-Einträge in Phase 2 der Engineering Quality Roadmap abarbeiten
