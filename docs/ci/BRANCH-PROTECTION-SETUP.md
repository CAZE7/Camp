# Branch Protection Setup — Camp (Required Status Checks)

**Stand:** 2026-11-05  
**Verantwortlich:** Repo-Admin (GitHub `workflows:write` / Admin-Rechte erforderlich)  
**Übergeordnet:** `docs/engineering/DEFINITION-OF-DONE.md` (PR-3, PR-5), `docs/CI.md` (§4), `docs/verification/RELEASE-GATES.md` (M-1 bis M-15)

---

## 1. Zweck

Branch Protection mit Required Status Checks verhindert, dass ein PR ohne grünen CI-Lauf gemergt werden kann. Dies ist die technische Durchsetzung der Merge-Gates M-1 bis M-15 aus `RELEASE-GATES.md`.

**Ohne aktive Branch Protection ist ein grüner CI-Lauf nur eine Empfehlung, keine Durchsetzung.**

> **Status (2026-11-07):** Die Branch Protection ist in GitHub **noch nicht aktiv** (erfordert Repo-Admin / `workflows:write`; GitHub-App der Sandbox durfte Workflow-Dateien nicht pushen, siehe `docs/CI.md` §2.1). Der Merge von PR #604–#606 ist deshalb auf diesem Repo noch ohne erforderliche Required Status Checks erfolgt. Diese Datei bleibt die Vorbereitung für die Admin-Einrichtung (offener Punkt O-06 / N-02).

---

## 2. Erforderliche Status Checks (alle Jobs aus `.github/workflows/quality.yml`)

Die folgenden Jobs müssen als Required Status Checks in der Branch Protection für den Default-Branch (`main`) eingetragen werden:

| Job                         | Gate                                      | Blockiert Merge    | Befehl                                                |
| --------------------------- | ----------------------------------------- | ------------------ | ----------------------------------------------------- |
| `quality`                   | M-1 Build                                 | Ja                 | `npm run build`                                       |
| `quality`                   | M-2 Type Safety                           | Ja                 | `npm run typecheck` + `typecheck:tests`               |
| `quality`                   | M-3 Lint                                  | Ja                 | `npm run lint`                                        |
| `quality`                   | M-4 Format                                | Ja                 | `npm run format:check`                                |
| `quality`                   | M-5 Unit + Integration Tests mit Coverage | Ja                 | `npm run test:coverage`                               |
| `quality`                   | M-6 Architekturtests                      | Ja                 | `libBoundary.test.ts`, `routing/architecture.test.ts` |
| `quality`                   | M-7 Routing-Invarianten & Audit           | Ja                 | `routing:audit`, `invariants.test.ts`                 |
| `quality`                   | M-8 Elektrik (Golden Master, Property)    | Ja                 | `test:goldenmaster`, `vde-properties.test.ts`         |
| `quality`                   | M-9 Routing-Regression                    | Ja                 | `test:regression`                                     |
| `quality`                   | M-10 Komponenten & Datenvalidierung       | Ja                 | Schema/Registry/Nodes vitest                          |
| `quality`                   | M-11 Warnsystem                           | Ja                 | `CableEdge.test.tsx`, `useLiveValidation.test.ts`     |
| `quality`                   | M-12 Persistenz & Migration               | Ja                 | `persistence.test.ts`, `storage.test.ts`              |
| `quality`                   | M-13 Security                             | Ja                 | `ci:verify-lockfile-gate`                             |
| `quality`                   | M-14 Accessibility                        | Ja                 | `a11y.spec.ts`                                        |
| `quality`                   | M-15 E2E (blockierende Specs)             | Ja                 | `e2e` Job                                             |
| `requirements-matrix-check` | M-4 (Traceability)                        | Ja                 | `verify-requirements-matrix.mjs`                      |
| `e2e`                       | M-15 E2E                                  | Ja                 | Playwright gegen `./out`                              |
| `visual`                    | R-3 (bei UI-Freigabe)                     | Bei UI-Freigabe Ja | `visual.spec.ts` (Pixel-Baselines)                    |

**Hinweis:** Das `visual`-Job läuft mit `continue-on-error: true` (melden, nicht blockierend). Es wird erst blockierend, nachdem die Visual-Regression-Baselines nach UI-Freigabe neu aufgenommen wurden (siehe `RELEASE-GATES.md` R-3, R-020).

---

## 3. Einstellung in GitHub (über UI oder API)

### Über die GitHub-UI:

1. Repository → Settings → Branches → Branch protection rules
2. "Add branch protection rule" für Branch `main`
3. Folgendes aktivieren:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Require conversation resolution before merging
   - ✅ Require signed commits (optional, empfohlen)
4. Unter "Status checks that are required" alle oben aufgelisteten Jobs hinzufügen
5. "Save changes"

### Über die GitHub CLI (`gh`):

```bash
# Branch Protection Rule erstellen
gh api repos/CAZE7/Camp/branches/main/protection \
  -X PUT \
  -f required_status_checks.strict=true \
  -f required_status_checks.contexts[]="quality" \
  -f required_status_checks.contexts[]="requirements-matrix-check" \
  -f required_status_checks.contexts[]="e2e" \
  -f required_status_checks.contexts[]="visual" \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f required_pull_request_reviews.require_code_owner_reviews=false \
  -f required_pull_request_reviews.bypass_pull_request_allowances[]= \
  -f enforce_admins=false \
  -f required_linear_history=false \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f block_creations=false \
  -f required_conversation_resolution=true
```

**Erfordert:** `workflows:write` oder Repo-Admin-Berechtigung. Kann nicht durch einen gewöhnlichen Contributor gesetzt werden.

---

## 4. Wichtig: "Require branches to be up to date"

Diese Option stellt sicher, dass ein PR nur gemergt werden kann, wenn der Ziel-Branch (`main`) nicht vorangeschritten ist seit dem letzten CI-Lauf. Das verhindert "Merge-Rot", bei dem ein PR grün war, aber der Base-Branch inzwischen geändert hat.

**Empfohlen:** Aktiviert halten. Deaktiviert nur bei sehr hoher Commit-Frequenz und kurzen CI-Laufzeiten.

---

## 5. Dependabot-Strategie

| Aspekt                                            | Richtlinie                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Wann mergen                                       | Erst NACH allen Feature-PRs (#604, #605, #606, #598, #580), um Lockfile-Churn zu vermeiden |
| Major-Bumps (z. B. ai-SDK 7.x, @ai-sdk/react 4.x) | Separat reviewen, Breaking Changes prüfen, R-022 (Chat/Endpunkt, ADR 0021) berücksichtigen |
| CI muss grün sein                                 | Dependabot-PRs müssen alle Required Status Checks bestehen, bevor sie gemergt werden       |
| Nach Merge                                        | `npm ci` muss package-lock.json unverändert lassen (Lockfile-Gate)                         |

---

## 6. Ausnahme von Gates

Ausnahmen von Merge- oder Release-Gates benötigen (gemäß `RELEASE-GATES.md` §8):

1. Eine schriftliche Begründung im `ARCHITECTURE-CHANGES.md`-Ledger,
2. Bei sicherheitskritischen Gates: Product-Owner- und Safety-Verantwortlicher-Freigabe,
3. Einen Eintrag im Risk Register als offenes Restrisiko mit Zieltermin,
4. Die Ausnahme ist zeitlich begrenzt und wird beim nächsten Release neu bewertet.

**Stillschweigende Gate-Ausnahmen sind nicht zulässig.**

---

## 7. Checkliste für Repo-Admin

- [ ] Branch Protection Rule für `main` erstellt
- [ ] Alle Required Status Checks aus Abschnitt 2 eingetragen
- [ ] "Require branches to be up to date" aktiviert
- [ ] Required Pull Request Reviews konfiguriert (mindestens 1)
- [ ] Dependabot-Strategie mit Team abgestimmt
- [ ] Ausnahme-Regelung in `ARCHITECTURE-CHANGES.md` dokumentiert (falls zutreffend)

---

**Ende der Dokumentation.** Dieser Beschreibungsleitfaden ist eine organisatorische Maßnahme und erfordert keine Code-Änderung. Die technische Umsetzung obliegt dem Repo-Admin.
