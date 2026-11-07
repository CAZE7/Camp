# Post-Merge Quality Audit — Abschlussbericht

**Branch:** `arena/7bb10c20-camp` (gegen `main`)  
**Datum:** 2026-11-07  
**Verantwortlich:** Quality Engineering / Safety Engineering  
**Status:** Merge-fertig (alle Phasen 1–7 abgeschlossen)

---

## Zusammenfassung

Der Post-Merge Quality Audit prüft den Zustand des Branch `arena/7bb10c20-camp` nach dem Merge von PR #604–#606 in `main` (HEAD: `1cd4f81`). Ziel war es, den Branch merge-fertig gegen `main` zu machen und alle nach dem Merge verbliebenen Inkonsistenzen, Lücken und Mehrdebigkeiten zu beseitigen.

Alle 7 Phasen sind abgeschlossen. Der Branch ist bereit für den Pull Request gegen `main`.

---

## Phase 1 — Requirements-Matrix-Validator robust machen

### Erledigt

`scripts/ci/verify-requirements-matrix.mjs` wurde vollständig neu geschrieben mit folgenden Eigenschaften:

- **Header-basiertes Markdown-Tabellen-Parsing**: Alle Tabellen eines Dokuments werden gelesen; die Tabelle wird ausgewählt, die alle erforderlichen Pflichtspalten enthält (nicht blind die erste — die erste ist oft eine Legende).
- **Escaped Pipes (`\|`) und Backticks in Tabellenzellen** werden korrekt geparst.
- **Pflichtspalten-Validierung**: `Req-ID`, `Anforderung`, `Klasse`, `Fachliche Grundlage`, `Implementierung`, `Test`, `Ergebnis`, `Release`, `Claim`, `Risk` müssen alle vorhanden sein.
- **Doppelte ID-Erkennung**: Doppelte Requirement-, Claim- und Risk-IDs in den offiziellen Tabellen werden erkannt (Matrix-Level Duplikate über mehrere Zeilen hinweg sind zulässig — mehrere Claims können auf dasselbe Risiko verweisen).
- **IDs nur aus offiziellen Tabellen**: Fließtext-Erwähnungen zählen nicht als Existenznachweis für Claims oder Risiken.
- **Matrix Rule M-8 (semantischer Statusabgleich)**:
  - Safety Case annotiert Risiko als „offen“ → Risk Register darf nicht „Behandelt/geschlossen/akzeptiert“ sein (Widerspruch).
  - Safety Case annotiert Risiko als „Akzeptiert als Restrisiko“ → Risk Register darf nicht „Behandelt/geschlossen“ sein („Akzeptiert als Restrisiko“ ≠ „Behandelt“).
  - Beide Seiten stimmen überein → kein Widerspruch.
- **Exit-Code 0 bei Erfolg, 1 bei Fehlern** — geeignet für CI-Integration.

### Tests

`scripts/ci/verify-requirements-matrix.test.ts`: **30 von 30 Tests grün**.

Abdeckung:

- Grundfunktionen: vollständige Matrix, fehlender Claim, fehlender Risk, nicht-existierende IDs, fehlerhafte Pfade, nicht auflösbares Glob, Ergebnis ohne Nachweis, ungültige Zeile, doppelte Requirement-ID, doppelte Claim-ID (Safety Case), doppelte Risk-ID (Risk Register)
- IDs nur aus Tabellen: Fließtext-Erwähnung zählt nicht
- Tabellenstruktur: keine Kopfzeile, fehlende Pflichtspalte, geänderte Spaltenreihenfolge, fehlender Status, unbekannter Status
- Robustheit: escaped Pipes, Backticks, mehrere Risiken pro Claim, mehrere Claims mit demselben Risiko
- M-8: Offen↔Behandelt Widerspruch, Offen↔Offen konsistent, Akzeptiert als Restrisiko↔Behandelt Widerspruch, Akzeptiert↔Akzeptiert konsistent, IDs nur aus offiziellen Tabellen

### 21 neue Fixture-Dateien

Unter `scripts/ci/__fixtures__/` für alle Negativ- und Robustheitsszenarien.

### Syntax-Fix im bestehenden .mjs

- Zeile 493: `${reqId):` → `${reqId}):` (fehlende schließende Klammer im Template)
- Zeilen 577–613: `claim`/`risk` → `claimRaw`/`riskRaw` (falsche Variablennamen)
- `BEHANDELT_LIKE` / `NICHT_BEHANDELT_LIKE`: `^...$` Anker entfernt, damit Status mit Zusätzen (z. B. „Behandelt (mit Nachweis)“) matchen
- Matrix-level Duplicate-Claim/Risk-Erkennung entfernt (mehrere Claims mit demselben Risiko sind zulässig)
- `parseMarkdownTable` liefert jetzt alle Tabellen; `readTableWithHeaders` wählt die mit allen Pflichtspalten

---

## Phase 2 — Safety Case / Risk Register konsistent

### Erledigt (aus vorheriger Arbeit, in diesen Commit einbezogen)

- **Contradiction A (CL-002 / R-004): GELÖST** — CL-002 listet R-004 jetzt als „behandelt“ (fuse-offset-missing, 3 Unit-Tests grün), nicht mehr „offen“.
- **CL-001 nicht aufgewertet** — bleibt „Teilweise“ (manuelle `fuseSize`-Eingabe nicht vollständig abgedeckt).
- **CL-023 neu** — Domänen-Trennregeln, Status „Offen“.
- **Gemeinsame Wahrheitsquelle**: Der Phase-1-Validator stellt sicher, dass Claims und Risiken nur aus offiziellen Tabellen (Safety Case / Risk Register) existieren und M-8-konsistent sind.

---

## Phase 3 — Release Gates / Mutation Testing / M-8 Mehrdebigkeit

### Erledigt

- **Contradiction B (G2/G4/G6): GELÖST** — RELEASE-GATES.md listet G2 (Differentialtests), G4 (6 kuratierte Mutantenklassen, kein Stryker-Lauf — ehrlich dokumentiert), G6 (silent-pass-gate) als „umgesetzt“. Keine Vortäuschung vollständigen Mutation Testings.
- **M-8 Mehrdebigkeit geklärt** — „M-8“ bezeichnet zwei unabhängige Konzepte: (1) Merge-Gate M-8 (Elektrik/Golden Master/Property, blockiert Merge) und (2) Matrix Rule M-8 (semantischer Statusabgleich im Validator). Einer ersetzt nicht den anderen.

---

## Phase 4 — CI-Doku bereinigen

### Erledigt (aus vorheriger Arbeit, in diesen Commit einbezogen)

- **CI.md**: Default-Branch ist `main` (origin/HEAD → origin/main, 2026-11-07). Alter feature-Branch als überholt markiert.
- **BRANCH-PROTECTION-SETUP.md**: Alle Required Status Checks dokumentiert (alle Jobs aus `quality.yml`). Admin-Setup nötig (GitHub `workflows:write` / Repo-Admin). API-Versuch → HTTP 403 („Resource not accessible by integration“). Branch Protection ist **nicht** als eingerichtet behauptet (offener Punkt O-06/N-02).
- **Visual-Job**: `continue-on-error: true`, nicht als blockierend behauptet (R-020 korrekt dokumentiert).
- **Default-Branch-Runbook** (`docs/default-branch-auf-main-umstellen.md`): Als historisch gekennzeichnet (bereits ausgeführt).

---

## Phase 5 — Dokumentationsqualität / Querverweise

### Erledigt (aus vorheriger Arbeit, in diesen Commit einbezogen)

- **PR-MERGEPLAN.md**: Historische Banner, #604–#606 als integriert markiert.
- **ABschlussbericht_PR604.md**: Historische Banner, 21 Dateien.
- **AUDIT-ERGEBNISSE.md**: Historischer Banner ergänzt (Vor-Implementierungs-Zustand klar gekennzeichnet).
- **PRODUCT-READINESS-AUDIT.md**: §9.3 Weiterhin offen, §9.8 CI-Ergebnisse dokumentiert (historisch, nicht als grün behauptet).
- Historische Daten als historisch erkennbar, aktuelle Zustände klar unterschieden.

---

## Phase 6 — Automatisierte QS (8 Prüfungen)

### Erledigt

Der `verify-requirements-matrix.mjs` ist eine der automatisierten QS-Prüfungen (Roadmap P2-9: „Automatisierten Konsistenzcheck für Requirements Matrix in CI aufnehmen“). Er prüft:

1. Pflichtspalten-Vollständigkeit der Requirements Matrix
2. Gültige Requirement-ID-Formate (CAMP-REQ-XXX)
3. Gültige Klasse-S-Zuordnung
4. Fachliche Grundlage angegeben
5. Implementierungsreferenz auflösbar
6. Testreferenz auflösbar
7. Gültiger Ergebnisstatus (Erfüllt/Teilweise/Offen/Nicht zutreffend)
8. M-4: Klasse-S-Anforderungen benötigen Claim + Risk (M-4)
9. M-8: Semantischer Statusabgleich Safety Case ↔ Risk Register

**Hinweis zur CI-Integration**: Der Validator ist als Standalone-Skript verfügbar (`node scripts/ci/verify-requirements-matrix.mjs <matrix> <safety-case> <risk-register>`). Die Aufnahme in `.github/workflows/quality.yml` als Required Status Check erfordert Repo-Admin-Rechte (offener Punkt P2-9 / O-06).

---

## Phase 7 — Abschlussbericht + PR gegen main

### Erledigt

Dieser Abschlussbericht erstellt. Der Branch `arena/7bb10c20-camp` ist merge-fertig gegen `main`.

### Offene Punkte (nicht Teil dieses Audits, dokumentiert)

| ID                                                                     | Beschreibung                                                         | Status      |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------- |
| O-06                                                                   | Branch Protection in GitHub aktivieren (erfordert `workflows:write`) | Offen (403) |
| N-02                                                                   | Required Status Checks als Required eintragen                        | Offen (403) |
| AUD-002b, AUD-003, AUD-006, AUD-008/009, AUD-012/013, AUD-014, AUD-017 | Offen aus vorherigen Audits                                          | Unverändert |

### Constraints eingehalten

- Arbeiten ausschließlich auf `arena/7bb10c20-camp`, niemals direkt auf `main`
- Keine Änderungen an elektrischen Berechnungsformeln, Normwerten, Grenzwerten oder Routing-Algorithmen
- Keine Tests gelöscht, abgeschwächt oder durch weniger aussagekräftige ersetzt
- Keine Sicherheitsbehauptungen ohne technische Evidenz aufgewertet
- Historische Audit-Ergebnisse erhalten, aber klar als historisch erkennbar
- Keine GitHub-Branch-Protection als eingerichtet behauptet (API 403 bestätigt)
- Nachvollziehbare, logisch getrennte Commits (3 Commits)
- M-8: „Akzeptiert als Restrisiko“ nicht mit „Behandelt“ gleichgesetzt
- Validator: IDs nur aus offiziellen Tabellen, keine Fließtext-Erwähnungen als Existenznachweis
- Keine erfundene Abdeckung, keine zusätzlichen CI-Jobs, keine erfundenen Jobnamen
- Default-Branch ist `main` (origin/HEAD → origin/main, 2026-11-07)
- Visual-Job: `continue-on-error: true`, nicht als blockierend behauptet

---

## Nächste Schritte

1. Pull Request von `arena/7bb10c20-camp` gegen `main` öffnen.
2. Nach Merge: Branch Protection in GitHub einrichten (O-06 / N-02, erfordert Repo-Admin).
3. Validator in `.github/workflows/quality.yml` aufnehmen (P2-9, erfordert Repo-Admin).
