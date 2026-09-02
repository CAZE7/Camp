# Übergabe: GitHub-Pages-Deploy

Dieses Dokument enthält nur Aufgaben, die mit den Rechten des aktuellen Agents
nicht abgeschlossen werden können. Verbindliche Projektregeln stehen in
`AGENTS.md`; der ausführbare Prompt liegt in
`docs/ci/pages-deploy-handoff-prompt.md`.

## Befund am 02.09.2026

- Default-Branch: `feature/react-flow-cable-editor-7322653268250495059`.
- Pages nutzt `build_type: workflow` und diesen Branch als Quelle.
- Die Umgebung `github-pages` erlaubt aktuell genau diesen Branch.
- PR [#377](https://github.com/CAZE7/Camp/pull/377) enthält den geprüften
  Patch. Der Push des echten Workflow-Fixes wurde abgelehnt:
  `refusing to allow a GitHub App to create or update workflow ... without
workflows permission`.

## Offene Aufgaben

- [ ] **A-1 Workflow-Fix anwenden:** Den Patch aus PR #377 als echte Änderung
      in `.github/workflows/deploy.yml`, `docs/ci/workflows/deploy.yml` und
      `scripts/ci/workflows.test.ts` übernehmen. Dabei `branches` auf den aktuellen
      Default-Branch und `cancel-in-progress: false` beibehalten. Nicht nur die
      Patch-Datei in den Default-Branch mergen.
- [ ] **A-2 GitHub-Einstellungen prüfen:** Unter _Settings → Pages_ `GitHub
Actions` und den aktiven Default-Branch als Quelle beibehalten. Unter
      _Settings → Environments → github-pages → Deployment branches_ muss derselbe
      Branch erlaubt sein. Nur bei einer bewusst geplanten Migration auf `main`
      alle drei Stellen gemeinsam umstellen: Default-Branch, Pages-Quelle und
      Environment-Regel; danach den Workflow-Trigger ebenfalls anpassen.
- [ ] **A-3 Schutzregeln prüfen:** Für den aktiven Default-Branch Pull Request,
      Review und die beiden CI-Checks verpflichtend machen. Keine Regel lockern,
      nur damit ein roter Check grün wird.
- [ ] **A-4 Nachweis führen:** Einen Push auf dem Default-Branch auslösen,
      `quality → build → deploy → Smoke-Check` beobachten und Startseite sowie
      mindestens ein `/_next/static/...`-Asset mit HTTP 200 prüfen.
- [ ] **A-5 Aufräumen:** Nach erfolgreicher Übernahme die temporäre
      `patches/2026-09-01-pages-deploy-fix.patch` entfernen und PR #377 schließen
      oder auf die echte Änderung umstellen.
