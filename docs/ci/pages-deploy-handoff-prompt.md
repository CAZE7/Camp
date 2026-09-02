# Übergabe-Prompt: GitHub-Pages-Deploy reparieren

> Diesen Text an einen GitHub-Repo-Admin oder einen Agent mit
> `workflows:write`- und den nötigen Settings-Rechten übergeben.

## Prompt

Du bist Senior-DevOps-/CI-Engineer für GitHub Actions, GitHub Pages und Next.js
Static Export. Arbeite im öffentlichen Repository `CAZE7/Camp` evidenzbasiert
und ändere keinen Anwendungscode.

### Ausgangslage

- Der Default-Branch ist **nicht** `main`, sondern
  `feature/react-flow-cable-editor-7322653268250495059`.
- Pages ist auf `build_type: workflow` gestellt und verwendet diesen Branch.
- Die Umgebung `github-pages` erlaubt derzeit nur diesen Branch.
- Echte Runs belegten zwei Ursachen: `branches-ignore: [gh-pages]` erzeugte
  Skipped-Runs auf Agent-/Dependabot-Branches; außerdem beendete
  `cancel-in-progress: true` zwei Produktiv-Runs (`33373496497` und
  `33373509862`) mit „Canceling since a higher priority waiting request for
  pages exists“.
- Der geprüfte Fix liegt in PR [#377](https://github.com/CAZE7/Camp/pull/377)
  als `patches/2026-09-01-pages-deploy-fix.patch`. Der bisherige Agent konnte die
  Workflow-Datei wegen fehlender `workflows`-Berechtigung nicht pushen.

### Auftrag

1. Prüfe zuerst Default-Branch, Pages-Konfiguration und Environment-Regel mit
   `gh api`; ändere nichts, wenn der Befund vom oben genannten Stand abweicht,
   sondern dokumentiere die Abweichung.
2. Übernimm aus dem Patch ausschließlich die echte Änderung in:
   - `.github/workflows/deploy.yml`
   - `docs/ci/workflows/deploy.yml`
   - `scripts/ci/workflows.test.ts`
3. Prüfe im Workflow insbesondere:
   - `on.push.branches` enthält nur den aktuellen Default-Branch;
   - kein `branches-ignore`-Skipped-Rauschen;
   - `concurrency.group` ist `pages`;
   - `cancel-in-progress: false` schützt einen laufenden Produktiv-Deploy;
   - Quality-Gate, Least-Privilege-Rechte, SHA-Pins und Smoke-Check bleiben
     unverändert erhalten.
4. Führe lokal `npm ci`,
   `npx vitest run scripts/ci/workflows.test.ts`,
   `npx tsc -p tsconfig.tests.json --noEmit` und `npm run check` aus. Bei einem
   Fehler zuerst die Ursache beheben oder klar dokumentieren; keine Tests
   überspringen und keine `quality.yml`-Logik abschwächen.
5. Committe und pushe die drei echten Dateien auf einem PR. Die temporäre
   Patch-Datei darf nicht als dauerhafte Workflow-Lösung im Default-Branch
   verbleiben.
6. Löse danach einen Deploy auf dem Default-Branch aus und beobachte die
   Reihenfolge `quality → build → deploy → Smoke-Check`. Prüfe die veröffentlichte
   Startseite und mindestens eine URL unter `/_next/static/` auf HTTP 200.

### Einstellungen nur bei Bedarf

Der aktuelle Environment-Zweig ist bereits korrekt. Wenn stattdessen bewusst
auf `main` migriert werden soll, nicht teilweise umstellen. In dieser Reihenfolge
arbeiten:

1. GitHub → **Settings → General → Default branch** → `main` auswählen →
   **Update**.
2. GitHub → **Settings → Pages** → **Build and deployment: GitHub Actions**
   beibehalten; falls eine Branch-Quelle angezeigt wird, auf `main` setzen.
3. GitHub → **Settings → Environments → github-pages** → unter
   **Deployment branches** `main` zulassen und den alten Branch erst entfernen,
   wenn der erste Deploy erfolgreich war.
4. Den `on.push.branches`-Eintrag im Workflow auf `main` ändern und erneut
   testen.
5. Branch-Schutzregeln und erforderliche CI-Checks auf `main` übertragen.

### Sicherheits- und Scope-Regeln

- Keine Secrets anfordern oder speichern.
- Keine Actions-Versionen downgraden.
- Keine Force-Pushes oder Branch-Löschungen ohne explizite Freigabe.
- `id-token: write` bleibt ausschließlich im `deploy`-Job.
- Keine Änderungen an App-Code oder am Quality Gate, nur um den Lauf grün zu
  bekommen.

Liefere zum Abschluss die geänderten Dateien, die Testergebnisse, die
Run-ID des neuen Deploys sowie den HTTP-Nachweis für Startseite und Asset.
