# CI-Gate — Aufbau, Belege und Branch Protection

Stand: 2026-08-21 · Betrifft AGENTS.md **K6**

## 0. Aktivierung — aktiv

Die aktiven Workflow-Dateien liegen unter `.github/workflows/`. Die Kopien
unter `docs/ci/workflows/` bleiben als reviewbare Referenz synchron. Der
Workflow-Test prüft den aktiven Zielort.

## 1. Aufbau

Drei Workflows, eine einzige Quelle für die Qualitätsprüfung
(Pfade nach der Aktivierung):

| Datei | Auslöser | Zweck |
|-------|----------|-------|
| `.github/workflows/quality.yml` | `workflow_call` | **Einzige** Definition von Install, Typecheck, Tests, Build |
| `.github/workflows/ci.yml` | Pull Request, Push (außer `gh-pages`), manuell | Pflicht-Check |
| `.github/workflows/deploy.yml` | Push auf den GitHub-Default-Branch, manuell | Pages-Build + Deploy, **nach** dem Quality Gate |

```
pull_request ─► ci.yml ─────► quality.yml (npm ci → typecheck → test → build)

push ─────────► deploy.yml ─► quality.yml
                 (nur Default-Branch)
                              └─► build (Pages, basePath) ─► deploy
```

Weil `deploy.yml` denselben wiederverwendbaren Workflow aufruft wie `ci.yml`,
kann ein Deploy nicht mit einer schwächeren Prüfung laufen als ein PR.

## 2. Härtungen gegenüber dem Vorgängerstand

| Vorher (`deploy.yml` alt) | Jetzt | Warum |
|---------------------------|-------|-------|
| `npm ci` mit 3 Retries, danach `rm -f package-lock.json && npm install` | Nur `npm ci` | Der Fallback baute im Fehlerfall ein **anderes** Abhängigkeits-Set — der Build war nicht mehr reproduzierbar |
| `NODE_VERSION: "20"` hartkodiert, `.nvmrc` sagte `22` | `node-version-file: .nvmrc` | CI und lokale Entwicklung liefen auf verschiedenen Major-Versionen |
| `workflow_dispatch` mit `skip_tests` | Kein Notausgang | „Deploy nur bei erfolgreicher Qualitätsprüfung“ |
| `if: always() && needs.test.result == 'skipped'` erlaubt | Kein `always()` | Übersprungene Tests galten als bestanden |
| Kein Build-Schritt im PR | Build im Quality Gate | Build-Fehler fielen erst beim Deploy auf |
| Top-Level `pages: write`, `id-token: write`, `pull-requests: write` für **alle** Jobs | Top-Level `contents: read`, Schreibrechte nur in `build`/`deploy` | Minimaler Berechtigungsumfang |
| `actions/checkout` mit Standard-Credentials | `persist-credentials: false` | Kein GITHUB_TOKEN im Runner-Git-Config |
| Kein Zeitlimit | `timeout-minutes: 30` | Hängende Läufe blockieren das Gate nicht dauerhaft |

Zusätzliche Schritte im Quality Gate:

- **Lockfile vorhanden?** — bricht ab, wenn `package-lock.json` fehlt.
- **Lockfile unverändert?** — `git diff --exit-code` nach `npm ci`.
- **Static Export vorhanden?** — `./out/index.html` muss existieren.

## 3. Belege

### 3.1 Workflow-Invarianten sind getestet

`scripts/ci/workflows.test.ts` parst die drei YAML-Dateien und prüft 14
Eigenschaften (u. a. gültiges YAML, kein `npm install`, kein Löschen des
Lockfiles, `node-version-file: .nvmrc`, Deploy hängt transitiv am Quality
Gate, minimale Permissions). Die Tests laufen in `npm test` mit.

```
$ npx vitest run scripts/ci/workflows.test.ts
 ✓ scripts/ci/workflows.test.ts (14 tests)
 Test Files  1 passed (1)
      Tests  14 passed (14)
```

### 3.2 Kaputtes Lockfile scheitert reproduzierbar

`npm run ci:verify-lockfile-gate` kopiert `package.json` und
`package-lock.json` in ein Temp-Verzeichnis, verfälscht dort die im Lockfile
festgeschriebene Version der ersten Dependency und prüft, dass `npm ci`
scheitert. Gegenprobe mit unverändertem Paar inklusive.

```
$ npm run ci:verify-lockfile-gate
OK    Unverändertes package.json/package-lock.json ist synchron — npm ci --dry-run: exit 0
OK    Desynchronisiertes Lockfile (@base-ui/react) lässt npm ci scheitern — exit 1
OK    Fehlermeldung nennt die fehlende Synchronität — npm error code EUSAGE

Lockfile-Gate greift: npm ci scheitert bei desynchronisiertem Lockfile.
```

Die npm-Originalmeldung im Fehlerfall:

```
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json or npm-shrinkwrap.json are in sync.
npm error Invalid: lock file's @base-ui/react@0.0.0-desynchronisiert does not satisfy @base-ui/react@1.4.1
```

Das Skript verändert **niemals** die Dateien im Repository — es arbeitet
ausschließlich auf einer Kopie in `os.tmpdir()`.

### 3.3 Lokaler Nachweis der Gate-Schritte

```
$ npm run typecheck   # tsc -p tsconfig.typecheck.json --noEmit → 0 Fehler
$ npm test            # vitest run → siehe README für aktuelle Zahl
$ npm run build       # next build → ./out mit Static Export
```

## 4. Branch Protection einrichten

Der Workflow allein blockiert noch nichts — er muss als Pflicht-Check
eingetragen werden. Einmalig auf GitHub (Repo-Admin nötig):

**Weg A — Web-UI**

1. *Settings → Branches → Add branch ruleset* (oder *Add rule* bei
   klassischer Branch Protection).
2. Target: `main` (und `master`, falls genutzt).
3. Aktivieren:
   - *Require a pull request before merging* (mindestens 1 Approval)
   - *Require status checks to pass before merging*
     → Check auswählen: **`CI / Quality Gate / Typecheck, Tests & Build`**
   - *Require branches to be up to date before merging*
   - *Block force pushes* und *Restrict deletions*
4. Optional: *Require conversation resolution before merging*.

Der Check-Name entsteht aus `ci.yml` (Workflow `CI`) → Job `quality`
(Anzeigename `Quality Gate`) → Job in `quality.yml`
(`Typecheck, Tests & Build`). Er erscheint in der Auswahlliste erst, nachdem
der Workflow einmal gelaufen ist.

**Weg B — GitHub CLI**

```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=CI / Quality Gate / Typecheck, Tests & Build' \
  -F 'enforce_admins=true' \
  -F 'required_pull_request_reviews[required_approving_review_count]=1' \
  -F 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```

## 5. Bekannte Grenzen

- Die Workflow-Tests prüfen **Struktur**, nicht das Laufzeitverhalten von
  GitHub Actions. Ein grüner Test ersetzt keinen echten CI-Lauf.
- `actionlint` ist nicht eingebunden (keine zusätzliche Binär-Abhängigkeit im
  Repo). Die YAML-Gültigkeit wird über `js-yaml` geprüft, Ausdrücke in
  `${{ … }}` werden nicht semantisch validiert.
- Branch Protection lässt sich nicht aus dem Repository heraus erzwingen; sie
  ist eine Server-Einstellung und muss wie in Abschnitt 4 gesetzt werden.
- `npm run ci:verify-lockfile-gate` benötigt Registry-Zugriff für die
  Gegenprobe (`npm ci --dry-run` des unveränderten Paars).
