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

- [x] **A-1 Workflow-Fix anwenden:** Den Patch aus PR #377 als echte Änderung
      in `.github/workflows/deploy.yml`, `docs/ci/workflows/deploy.yml` und
      `scripts/ci/workflows.test.ts` übernommen. Dabei `branches` auf den aktuellen
      Default-Branch und `cancel-in-progress: false` beibehalten.
- [x] **A-2 GitHub-Einstellungen geprüft:** Unter _Settings → Pages_ `GitHub
Actions` und aktiver Default-Branch als Quelle bestätigt.
- [ ] **A-3 Schutzregeln prüfen:** Für den aktiven Default-Branch Pull Request,
      Review und die beiden CI-Checks verpflichtend machen. Keine Regel lockern,
      nur damit ein roter Check grün wird.
- [x] **A-4 Nachweis führen:** Deploy beobachten und Startseite sowie
      mindestens ein `/_next/static/...`-Asset mit HTTP 200 prüfen.
- [x] **A-5 Aufräumen:** Temporäre `patches/2026-09-01-pages-deploy-fix.patch`
      entfernt.
