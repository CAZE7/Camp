# PR-Mergeplan — Camp (Engineering & Quality Framework)

**Stand:** 2026-11-05  
**Autor:** Agent-Modus (PR #604)  
**Zweck:** Empfohlene Merge-Reihenfolge für alle offenen PRs im Repo, damit keine Doppelarbeit entsteht und keine Konflikte zwischen Parallel-PRs auftreten.

---

## 1. Offene PRs im Repo

| PR | Branch | Inhalt | Relevanz für #604 |
|----|--------|--------|-------------------|
| #604 | `arena/949821e6-camp` | Engineering & Quality Framework (docs-only, CI, Konsistenzcheck) | **Dieser PR** — Basis für alle anderen |
| #605 | `arena/8b44e0c9-camp` | Verifikation + Tests: ELECTRICAL-VERIFICATION-STRATEGY.md (§12, §12.7 Abstimmung mit #604), ELECTRICAL-INVARIANT-REMEDIATION-PLAN.md, test/reference/*, test/invariants/* | Deckt O-07/N-04 (Mutation Testing G4), CL-001/O-02 (E-1, E-2, K-2), CI-Gates G1, G3, G5, G7 ab |
| #606 | `arena/3ad41177-camp` | Produktreife: PRODUCT-READINESS-AUDIT.md, PR-Body (Aud-Status) | Deckt O-08 (Visual-Gate Trennung), AUD-003 (R-001 Verweis) ab |
| #598 | `cursor/obfuscate-client-chunks-60ec` | Build: javascript-obfuscator | Muss nach quality.yml-Änderungen rebasen; Perf-Gates neu prüfen |
| #580 | `arena/79491226-camp` | Seitenaufbau/Inhalte | Keine direkte Überschneidung mit #604 |
| #585–#591 | Abhängig | Dependabot-Updates | Erst NACH Feature-PRs mergen (Lockfile-Churn) |

---

## 2. Empfohlene Merge-Reihenfolge

| Reihenfolge | PR | Begründung |
|-------------|-----|------------|
| 1 | **#604** (dieser PR) | Basis: Dokumentation, CI, Konsistenzcheck, Safety Case, Risk Register, Requirements Matrix. Alle anderen PRs bauen darauf auf. |
| 2 | **#605** | Verifikation + Tests. Baut auf #604 auf (Safety Case, Risk Register). G4 (Mutation Testing) folgt nach #605 als eigener PR. |
| 3 | **#606** | Produktreife-Audit. Baut auf #604 + #605 auf (Visual-Gate, Baseline-Verfahren). |
| 4 | **#598** | Build-Obfuskation. Muss nach #604 (quality.yml-Änderungen) rebasen und Perf-Gates neu prüfen. |
| 5 | **#580** | Seitenaufbau. Keine direkte Überschneidung, kann parallel oder nach #604. |
| 6 | **#585–#591** | Dependabot. Erst nach allen Feature-PRs, um Lockfile-Churn zu vermeiden. ai-SDK 7.x / @ai-sdk/react 4.x Major-Upgrades auf Breaking Changes prüfen (R-022, ADR 0021). |

**Wichtigste Regel:** #604 zuerst, dann #605, dann #606. #598 braucht Rebase nach #604.

---

## 3. Konfliktanalyse — bekannte Reibungspunkte

### 3.1 R-004-Fix (#604) ↔ verdict-snapshot (#605)

- **R-004-Fix:** In `CableEdge.tsx` wird fehlender `data.fuseOffset` künftig als kritischer Befund gemäß S-03 ausgegeben ("Sicherungsabstand zum Pol fehlt — 20-cm-Regel nicht prüfbar"). Das ändert Plan-Verdikte (mehr `critical`-Befunde bei Kanten ohne fuseOffset).
- **#605:** `test/invariants/verdict-snapshot.test.ts` enthält einen Verdikt-Snapshot, der nach dem R-004-Fix bricht.
- **Reihenfolge:** Snapshot **nur nach** dem R-004-Fix aktualisieren. Jede Verdikt-Änderung einzeln begründet (Befundnachweis), keine blinde `-u`-Aktualisierung.
- **Verantwortlich:** #604 führt den Fix durch; #605 aktualisiert den Snapshot danach mit Einzelbegründung.

### 3.2 CL-001 / I_B ≤ I_n ≤ I_z (#604) ↔ Invarianten E-1, E-2, K-2 (#605)

- **#604 O-02:** CL-001 ist "Teilweise" (manuelle fuseSize-Eingabe nicht durch selectFuseSize-Grenze abgedeckt).
- **#605:** Invarianten E-1, E-2 (AC-ΔU-Grenze, feasible dreiwertig) und K-2 berühren denselben Schutzkonzept-Bereich.
- **Regel:** Nicht parallel ändern. #604 ergänzt nur Dokumentation/Verifikation für CL-001. Wenn E-1/E-2/K-2 in #605 noch als `it.fails` stehen, bleibt CL-001 bei "Teilweise" mit Verweis auf die Reparatur-PRs.

### 3.3 quality.yml (#604) ↔ Obfuskation (#598)

- **#604:** quality.yml wird geändert (CI-Gates M-6..M-14, requirements-matrix-check ohne continue-on-error, visual-Gate-Entscheidung).
- **#598:** Fügt javascript-obfuscator zum Build hinzu. Muss nach quality.yml-Änderungen rebasen.
- **Perf-Gate:** +16 % Median routeAllCables gegen Zend 20 % Budget dokumentieren. Nach Obfuskation neu messen (59,3 → 68,6 ms war ohne neue Gates — Budget-Headroom prüfen).

### 3.4 Dependabot (#585–#591) ↔ Feature-PRs

- **Regel:** Dependabot-PRs erst NACH den Feature-PRs mergen.
- **ai-SDK 7.x / @ai-sdk/react 4.x:** Major-Upgrades — Breaking Changes prüfen. R-022 (Chat/Endpunkt, ADR 0021) könnte betroffen sein. Einschätzung vor dem Merge.

### 3.5 visual-Gate (#604) ↔ #606

- **#604 O-08:** Visual-Regression-Job aktuell `continue-on-error: true` (nicht blockierend).
- **#606:** Beschreibt Trennung funktional/visuell und Baseline-Verfahren mit Nachweis.
- **Entscheidung:** visual-Job bleibt "melden, nicht blockierend" (mit #606 identisch formuliert), Baselines nach UI-Freigabe neu aufnehmen.

---

## 4. Zuordnung offener Punkte (O-01..O-09 / N-01..N-08)

| ID | Titel | Erledigt durch | Nachweis |
|----|-------|----------------|----------|
| O-01 | R-004 20-cm-Regel (fehlender fuseOffset) | #604 (A-1, Code CableEdge.tsx) | Unit-Tests + Claim CAMP-REQ-002 |
| O-02 | CL-001 I_B ≤ I_n ≤ I_z teilweise | #604 (A-2, Verifikation) + #605 (E-1, E-2, K-2) | Verweis auf #605-Invarianten |
| O-03 | CAMP-REQ-002 kein Claim | #604 (Phase 2, nach A-1) | Claim CL-004 im Safety Case |
| O-04a | CAMP-REQ-014 kein Risk-Eintrag | #604 (Phase 2) | Risk-Eintrag R-025 oder Status herabstufen |
| O-04b | CAMP-REQ-023 kein Claim | #604 (Phase 2) + #605 (ROUTE-003) | Verweis auf REMEDIATION-PLAN |
| O-05 | CI-Gates M-6..M-14 nicht implementiert | #604 (Phase 3) | quality.yml erweitert, Mapping M↔G in RELEASE-GATES.md |
| O-06 | Branch Protection nicht aktiv | #604 (Phase 5, Dokumentation) | BRANCH-PROTECTION-SETUP.md (Admin-Setup in Phase 2) |
| O-07 | Mutation Testing nicht im CI | #605 (G4, nach #605 als eigener PR) | ADR-Verknüpfung in RELEASE-GATES.md |
| O-08 | Visual-Gate nicht blockierend | #604 (Phase 3) + #606 (Baseline-Verfahren) | Entscheidung: melden, nicht blockierend |
| O-09 | test:coverage Timeout (Sandbox) | #604 (Phase 4, lokaler Lauf) | Lokale Ergebnisse im Abschlussbericht |

| ID | Titel | Erledigt durch | Nachweis |
|----|-------|----------------|----------|
| N-01 | Code-Änderung CableEdge.tsx (R-004) | #604 (A-1) | siehe O-01 |
| N-02 | Branch Protection in GitHub | #604 (Phase 5, Admin-Rechte nötig) | BRANCH-PROTECTION-SETUP.md |
| N-03 | Fehlende CI-Gates in quality.yml | #604 (Phase 3) | siehe O-05 |
| N-04 | Mutation Testing einführen | #605 (G4, eigener PR nach #605) | siehe O-07 |
| N-05 | Visual-Regression blockierend | #604 + #606 (Phase 2 nach UI-Freigabe) | siehe O-08 |
| N-06 | Fahrzeug-Leitungskontext (R-001) | Phase 2 (Issue geöffnet) | Issue mit Label phase-2 |
| N-07 | AC-Netzimpedanz messen (R-008) | Phase 2 (Issue geöffnet) | Issue mit Label phase-2 |
| N-08 | Domänen-Trennregeln anbinden (R-019) | Phase 2 (Issue geöffnet) | Issue mit Label phase-2 |

---

## 5. Dateien, die von Parallel-PRs großflächig umgebaut werden (nicht anfassen)

Aus den Aufgabenbeschreibungen der Parallel-PRs:

| Datei | PR | Hinweis |
|-------|-----|---------|
| `docs/ELECTRICAL-VERIFICATION-STRATEGY.md` | #605 | Nur lesen, keine Änderungen |
| `docs/ELECTRICAL-INVARIANT-REMEDIATION-PLAN.md` | #605 | Nur lesen, keine Änderungen |
| `test/reference/*` | #605 | Nur lesen |
| `test/invariants/*` | #605 | Nur lesen (Snapshot-Aktualisierung erst nach R-004-Fix) |
| `docs/PRODUCT-READINESS-AUDIT.md` | #606 | Nur lesen |
| `BatteryBankSection` | #606 | Nicht anfassen |
| `capturePlanImage` | #606 | Nicht anfassen |

**Konflikt-Regel:** Bei Konflikt mit bestehender Parallel-Arbeit → STOP und im Bericht als offene Frage ausweisen, statt eine Seite zu überschreiben.

---

## 6. Merge-Readiness-Kriterien (für #604)

Vor dem Merge von #604 muss gelten:

1. ✅ `scripts/ci/verify-requirements-matrix.mjs` → Exit 0 (alle Klasse-S-Anforderungen haben Claim + Risk)
2. ✅ Alle lokalen Checks grün: format, lint, typecheck ×2, routing:audit, build
3. ✅ Mapping M↔G (Merge-Gates #604 ↔ Gates #605) in RELEASE-GATES.md dokumentiert
4. ✅ Keine unbelegten Claims (alle Status durch Nachweis belegt)
5. ✅ PR-MERGEPLAN.md existiert und ist konsistent
6. ✅ Abschlussbericht neu geschrieben mit Status-Tabelle O-01..O-09 / N-01..N-08

---

**Ende des PR-Mergeplans.**