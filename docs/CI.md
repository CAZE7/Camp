# CI-Gate — Aufbau, Belege, Branch Protection & Governance

Stand: 2026-08-29 · Betrifft AGENTS.md **K6**

## 0. Aktivierung — aktiv

Die aktiven Workflow-Dateien liegen unter `.github/workflows/`. Die Kopien
unter `docs/ci/workflows/` bleiben als reviewbare Referenz synchron. Der
Workflow-Test (`scripts/ci/workflows.test.ts`) prüft die 1:1-Übereinstimmung beider Verzeichnisse.

## 1. Aufbau

Drei Workflows, eine einzige Quelle für die Qualitätsprüfung:

| Datei                           | Auslöser                                          | Zweck                                                                  |
| ------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| `.github/workflows/quality.yml` | `workflow_call`                                   | **Einzige** Definition von Install, Lint, Tests, Typecheck, Build, E2E |
| `.github/workflows/ci.yml`      | Pull Request (alle Branches), `workflow_dispatch` | Pflicht-Check für PRs (ohne redundante Doppelläufe bei Pushes)         |
| `.github/workflows/deploy.yml`  | Push auf den GitHub-Default-Branch, manuell       | Pages-Build + Deploy + Smoke-Check, **nach** dem Quality Gate          |

```
pull_request ─► ci.yml ─────► quality.yml (npm ci → lint → format → typecheck → test:coverage → build → e2e)

push (default) ─► deploy.yml ─► quality.yml
                               └─► build (Pages, basePath) ─► deploy ─► smoke-check (HTTP 200)
```

Weil `deploy.yml` denselben wiederverwendbaren Workflow aufruft wie `ci.yml`,
kann ein Deploy nicht mit einer schwächeren Prüfung laufen als ein PR.

## 2. Härtungen gegenüber dem Vorgängerstand

| Vorher (`deploy.yml` / `ci.yml` alt)                                                  | Jetzt                                                             | Warum                                                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm ci` mit 3 Retries, danach `rm -f package-lock.json && npm install`               | Nur `npm ci`                                                      | Der Fallback baute im Fehlerfall ein **anderes** Abhängigkeits-Set — der Build war nicht mehr reproduzierbar |
| `NODE_VERSION: "20"` hartkodiert, `.nvmrc` sagte `22`                                 | `node-version-file: .nvmrc`                                       | CI und lokale Entwicklung liefen auf verschiedenen Major-Versionen                                           |
| `workflow_dispatch` mit `skip_tests`                                                  | Kein Notausgang                                                   | „Deploy nur bei erfolgreicher Qualitätsprüfung“                                                              |
| `if: always() && needs.test.result == 'skipped'` erlaubt                              | Kein `always()`                                                   | Übersprungene Tests galten als bestanden                                                                     |
| Fehlender Lint/Format/Coverage im CI-Gate                                             | Vollständiges Gate (`npm run check`)                              | Lücken führten zu stillen Regressionen und Drift zwischen lokal und CI                                       |
| Doppelläufe durch parallele `push` + `pull_request`-Trigger                           | `ci.yml` nur auf `pull_request`                                   | Halbiert CI-Laufzeit und Runner-Kosten                                                                       |
| Kein Smoke-Check nach Veröffentlichung                                                | Post-Deploy HTTP 200 Smoke-Check                                  | Sofortige Erkennung von Deployment- oder BasePath-Problemen                                                  |
| Top-Level `pages: write`, `id-token: write`, `pull-requests: write` für **alle** Jobs | Top-Level `contents: read`, Schreibrechte nur in `build`/`deploy` | Minimaler Berechtigungsumfang (Least Privilege)                                                              |
| `actions/checkout` mit Standard-Credentials                                           | `persist-credentials: false`                                      | Kein GITHUB_TOKEN im Runner-Git-Config                                                                       |
| Actions per Tag gepinnt (`@v4`, `@v5`)                                                | Strikt per 40-Zeichen Commit-SHA gepinnt                          | Schutz vor Supply-Chain-Manipulationen                                                                       |
| Kein Zeitlimit                                                                        | `timeout-minutes: 30`                                             | Hängende Läufe blockieren das Gate nicht dauerhaft                                                           |

## 3. Belege

### 3.1 Workflow-Invarianten sind getestet

`scripts/ci/workflows.test.ts` parst die YAML-Dateien und prüft:

- Gültiges YAML und Jobs vorhanden
- 1:1-Synchronität zwischen `.github/workflows/` und `docs/ci/workflows/`
- Keine verbotenen Lockfile-Manipulationen
- `npm ci` ohne Fallback
- `node-version-file: .nvmrc`
- Quality Gate führt Lint, Format, Typechecks, Coverage-Tests und Build aus
- Trigger-Entkoppelung (kein redundanter Push-Trigger in `ci.yml`)
- Smoke-Check im Deploy-Job vorhanden
- Minimale Berechtigungen und SHA-Pins auf allen Actions

### 3.2 Kaputtes Lockfile scheitert reproduzierbar

`npm run ci:verify-lockfile-gate` prüft, dass Abweichungen zwischen `package.json` und `package-lock.json` reproduzierbar scheitern.

## 4. Branch Protection & Governance

Der Workflow allein blockiert noch nichts — er muss als Pflicht-Check eingetragen werden. Einmalig auf GitHub (Repo-Admin nötig):

### 4.1 Branch Ruleset / Branch Protection einrichten

**Ziel-Branch:** `main` (nach Umstellung des Repositories) bzw. der aktive Default-Branch.

Aktivieren:

1. **Require a pull request before merging**: Mindestens 1 genehmigtes Review erforderlich.
2. **Require status checks to pass before merging**:
   - Status Check: **`CI / Quality Gate / Typecheck, Tests & Build`**
   - Status Check: **`CI / Quality Gate / End-to-End (Playwright)`**
3. **Require branches to be up to date before merging**: Aktiviert.
4. **Block force pushes** und **Restrict deletions**: Aktiviert.
5. **CODEOWNERS**: `.github/CODEOWNERS` ist hinterlegt (`* @CAZE7`).

### 4.2 GitHub CLI Befehl für Branch Protection

```bash
gh api -X PUT repos/:owner/:repo/branches/feature%2Freact-flow-cable-editor-7322653268250495059/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=Quality Gate / Typecheck, Tests & Build' \
  -f 'required_status_checks[contexts][]=Quality Gate / End-to-End (Playwright)' \
  -F 'enforce_admins=true' \
  -F 'required_pull_request_reviews[required_approving_review_count]=1' \
  -F 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```

### 4.3 Runbook für Default-Branch Migration auf `main` (D03)

Da `main` und der Feature-Branch divergiert sind (2 Unique Commits auf `main`: `4c21f06`, `927b4e7`), darf kein unbedachter `--ff-only` oder Force-Push auf divergiertem Stand ausgeführt werden:

1. **Unique-Commits prüfen**: Die Änderungen aus `4c21f06` (VDE-Konstanten/Spannungsabfall aus PR #304) sind im aktuellen Feature-Branch bereits modularisiert in den Zustand-Slices und `lib/vdeStandards.ts` enthalten.
2. **`main` synchronisieren**:
   ```bash
   git checkout main
   git merge feature/react-flow-cable-editor-7322653268250495059 -m "Merge branch 'feature/react-flow-cable-editor-7322653268250495059' into main"
   git push origin main
   ```
3. **GitHub Settings**: Default-Branch von `feature/react-flow-cable-editor-7322653268250495059` auf `main` umstellen.
4. **UNBEDINGT gleichzeitig anpassen**:
   - **GitHub Pages Source**: Branch auf `main` umstellen.
   - **Environment `github-pages` Deployment Protection Rule**: Von Feature-Branch auf `main` umstellen (sonst blockiert der Deploy!).
5. **Branch Protection (D02)**: Regeln auf `main` übertragen.

## 5. Berechtigungen & Agenten-Integration (D12)

GitHub Apps / Agenten-Bots benötigen zur Bearbeitung von Workflows unter `.github/workflows/` die explizite Berechtigung:

- **Workflows**: `Read and write`

Ohne diese Berechtigung schlägt das Erstellen oder Bearbeiten von Workflow-Dateien mit einem HTTP 403-Fehler (`refusing to allow a GitHub App to create or update workflow`) fehl.

## 6. Rollback bei fehlerhaftem Deploy (D08)

Ein fehlgeschlagener Deploy (`actions/deploy-pages@v4` oder der nachgelagerte Smoke-Check) lässt die zuletzt erfolgreich deployete Version live — es gibt keinen unvollständigen Zustand.

Bei einem **erfolgreich** deployten Build mit inhaltlichem Fehler:

**Option A — Rerun des letzten guten Runs** (schnellste Sofortmaßnahme):

1. GitHub → Actions → `Deploy to GitHub Pages`
2. Letzten grünen Run öffnen → _Re-run all jobs_

**Option B — Revert + Push**:

```bash
git revert <sha-des-fehlerhaften-commits>
git push origin main
```

**Option C — Hotfix-Branch**:
Hotfix-Branch erstellen, PR öffnen, Quality Gate durchlaufen lassen, mergen.

## 7. Repository-Hygiene & Branch-Bereinigung (D11)

1. **Automatische Branch-Löschung aktivieren**:
   _Settings → General → Pull Requests → Automatically delete head branches_ aktivieren.
2. **Stapellöschung verifiziert gemergter Branches**:
   Bereinigungsskript für die in `docs/merged-branch-candidates.txt` erfassten Branches ausführen:
   ```bash
   ./scripts/maintenance/cleanup-merged-branches.sh --dry-run
   ./scripts/maintenance/cleanup-merged-branches.sh --execute
   ```
