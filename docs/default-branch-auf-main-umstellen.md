# Standard-Branch auf `main` umstellen (Deploy-Runbook)

Anleitung für den Betreiber oder einen Agenten mit **Admin- und
`workflows:write`-Rechten** am Repo. **Nur Vorbereitung ist im Repo
geschehen** — die Ziel-Änderung des Deploy-Triggers auf `main` liegt als
Patch bei (siehe Tabelle), umgestellt hat das Repository selbst damit
noch nichts. Die Reihenfolge unten ist so gebaut, dass **kein Gate rot
liegt** und die Seite zu keinem Zeitpunkt ausfällt.

## Ausgangslage (gemessen am 2026-10-12)

| Befund                           | Wert                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default-Branch                   | `feature/react-flow-cable-editor-7322653268250495059`                                                                                                                                                                                                                                                                                                                                                                                  |
| `origin/main`                    | existiert, Stand `ac94476` (2026-09-07, 904 Commits)                                                                                                                                                                                                                                                                                                                                                                                   |
| Historie `main` ↔ Feature-Branch | **kein gemeinsamer Merge-Base** (Feature-Branch ist ein einzelner Root-Commit `3790959`) — ein Fast-Forward ist unmöglich                                                                                                                                                                                                                                                                                                              |
| GitHub Pages                     | `build_type: workflow`, URL `https://caze7.github.io/Camp/`                                                                                                                                                                                                                                                                                                                                                                            |
| Environment `github-pages`       | Deployment-Branch-Policy erlaubt **genau** den Feature-Branch (per API geprüft)                                                                                                                                                                                                                                                                                                                                                        |
| Deploy-Trigger                   | Die Ziel-Änderung auf `main` liegt als **kopierfertiger Patch** bei: `docs/ci/patches/2026-10-12-deploy-trigger-main.patch` (betrifft `.github/workflows/deploy.yml`, die 1:1-Kopie in `docs/ci/workflows/` und `scripts/ci/workflows.test.ts`). Die Sandbox-GitHub-App darf Workflow-Dateien nicht pushen (`without workflows permission`, dokumentiert in `docs/CI.md` §2.1) — anwenden darf nur ein Konto/App mit `workflows:write` |

Daraus folgen drei Hartnäckigkeiten, die die Reihenfolge bestimmen:

1. **Environment-Policy:** Ein Deploy von `main` wird abgelehnt, solange die
   Policy nur den Feature-Branch nennt. `main` muss **vor** der Umstellung in
   die Policy aufgenommen werden.
2. **Trigger-Wächter:** `npm run ci:verify-deploy-trigger` (Quality Gate)
   vergleicht die Trigger-Liste mit dem Repo-Default-Branch und macht jede
   Abweichung rot. Deshalb wird der Patch **nicht über einen PR**
   eingespielt (der wäre gegen den alten Default rot), sondern **direkt auf
   dem Default-Branch** committet. Nach der Default-Umstellung vergleicht
   der Wächter `main` mit `main` und ist dauerhaft grün.
3. **Kein Fast-Forward:** `main` kann nicht per FF auf den Feature-Stand
   gebracht werden. Ohne Force-Push bleibt nur ein Merge mit
   `--allow-unrelated-histories`, dessen Ergebnisbaum exakt der
   Feature-Stand sein muss (Verifikation unten). **Stolperstein:** Diese
   Synchronisierung muss **nach** dem Patch-Merge laufen — sonst trägt `main`
   noch den alten Trigger, und der Wächter blockiert den finalen Deploy in
   Schritt 5 zu Recht.

## Reihenfolge (genau so, keine Abkürzungen)

**Schritt 0 — Vorbereitungs-PR mergen** ([PR #524](https://github.com/CAZE7/Camp/pull/524)
oder Nachfolger; Diff = Dokumentation + die Patch-Datei). Erst danach liegt
die Patch-Datei im Default-Branch. Der PR ist vor Merge grün; der Merge
löst keinen Deploy aus (Diff berührt weder App noch Workflow).

**Schritt 1 — Environment-Policy erweitern:** Settings → Environments →
`github-pages` → Deployment branches → `main` ergänzen (Feature-Branch-Eintrag
erst in Schritt 6 entfernen). Verifikation: zwei Einträge, z. B.
`gh api repos/CAZE7/Camp/environments/github-pages/deployment-branch-policies`.

**Schritt 2 — Patch direkt auf dem Default-Branch anwenden**
(benötigt `workflows:write`, siehe Tabelle oben; bewusst **nicht** über
einen PR — siehe Hartnäckigkeit 2):

```bash
git checkout <default-branch> && git pull
git apply docs/ci/patches/2026-10-12-deploy-trigger-main.patch
npx vitest run scripts/ci/workflows.test.ts   # 23 Tests müssen grün sein
npm run check                                  # vollständiges Gate …
git add .github/workflows/deploy.yml docs/ci/workflows/deploy.yml scripts/ci/workflows.test.ts
git commit -m "chore(ci): Deploy-Trigger auf main (Patch 2026-10-12)"
git push                                       # … und nochmal als Pre-Push-Hook
```

Erwartung: **kein** Workflow-Run durch diesen Push — GitHub wertet den
Trigger aus dem **gepushten** Stand aus, und der reagiert nur noch auf
`main`. Ab jetzt deployen Pushes auf den Feature-Branch nichts mehr; die
Seite bleibt auf dem letzten Deploy stehen, es fällt nichts aus.

**Schritt 3 — `main` auf den Produktivstand bringen** (jetzt! Erst nach
Schritt 2 — siehe Stolperstein in Hartnäckigkeit 3. Kein Force-Push; die
904 Commits der alten `main`-Historie bleiben erhalten):

```bash
git fetch origin
git checkout -B main origin/main
git merge --allow-unrelated-histories <default-branch>   # Konflikte sind erwartet …
# … sie werden nicht manuell aufgelöst, sondern der Baum wird exakt auf den
# Default-Stand gesetzt:
git rm -rq .
git checkout <default-branch> -- .
git add -A
git commit -m "chore: main auf den Produktivstand des Default-Branches bringen"
# Verifikation: Muss leer sein, sonst nicht pushen!
git diff --exit-code main <default-branch>
npm run check
git push origin main          # normaler Push, kein Force
```

Erwartung: genau **ein** Run des Deploy-Workflows auf `main`, dessen drei
Jobs **übersprungen** werden (Job-`if` vergleicht mit dem noch alten
Default) — das ist korrekt und harmlos.

**Schritt 4 — Default-Branch umstellen:** Settings → Branches → Default =
`main` (oder `gh api -X PATCH repos/CAZE7/Camp -f default_branch=main`).
Verifikation: `gh api repos/CAZE7/Camp --jq .default_branch`.

**Schritt 5 — Deploy auf `main` belegen:**

```bash
gh workflow run deploy.yml --ref main
gh run watch
```

Alle drei Jobs müssen grün sein — insbesondere der **Smoke-Check**, der
selbst belegt, dass die ausgelieferte Seite der gebaute Stand ist. Danach
`https://caze7.github.io/Camp/` und `/planer/` im Browser prüfen. Ab jetzt
ist auch der Trigger-Wächter dauerhaft grün: Trigger-Liste (`main`) ==
Default (`main`).

**Schritt 6 — Aufräumen, erst nach grünem Deploy auf `main`:**
Feature-Branch aus der `github-pages`-Policy entfernen; Branch Protection
auf `main` einrichten (`docs/CI.md` §4); die alte Feature-Branch-Referenz in
`docs/CI.md` §2.1 und `agent.md` ist historisch datiert und bleibt als
Zeugnis stehen. Branch-Aufräumen danach: `docs/branch-inventory-2026-10-12.md`.

**Rollback bis Schritt 5 inklusive:** Default-Branch zurück auf den
Feature-Branch setzen — alles läuft wie vorher, nichts wurde gelöscht.

## Bewusst nicht vorgesehen

- **Force-Push auf `main`** — verboten; deshalb der Merge-Weg in Schritt 3.
- **`main` löschen und neu anlegen** — würde die 904 Commits der alten
  Historie vernichten und ist damit eine destruktive Variante desselben
  Schritts; nicht empfohlen.
- **Trigger-Liste mit zwei Branches als Übergangszustand** — der Wächter
  verlangt bewusst genau einen Eintrag; ein Übergangszustand wäre genau das
  stille Rotieren, vor dem er schützt.
- **Patch über einen Pull Request einspielen** — der Trigger-Wächter wäre
  auf diesem PR gegen den alten Default rot (Hartnäckigkeit 2); deshalb der
  direkte Commit in Schritt 2.
