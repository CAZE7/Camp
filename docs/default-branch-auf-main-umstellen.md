# Standard-Branch auf `main` umstellen (Deploy-Runbook)

Kurzanleitung für den Repo-Betreiber (GitHub-Einstellungen nötig, die ein
Agent nicht ohne Weiteres setzen darf). **Nur Vorbereitung ist im Repo
geschehen** — die Ziel-Änderung des Deploy-Triggers auf `main` liegt als
Patch bei (siehe Tabelle), umgestellt hat das Repository selbst damit
noch nichts.

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
   vergleicht die Trigger-Liste mit dem Repo-Default-Branch und meldet jede
   Abweichung als Fehler. Solange der Default noch der Feature-Branch ist,
   ist dieser Check auf dem Vorbereitungs-PR bewusst **rot** — das ist der
   beabsichtigte Alarm („Trigger würde nicht feuern“), kein Bug. Er wird
   grün, sobald Schritt 4 erledigt ist (danach „Re-run failed jobs“).
3. **Kein Fast-Forward:** `main` kann nicht per FF auf den Feature-Stand
   gebracht werden. Ohne Force-Push bleibt nur ein Merge mit
   `--allow-unrelated-histories`, dessen Ergebnisbaum exakt der
   Feature-Stand sein muss (Verifikation unten).

## Reihenfolge (alle Schritte nacheinander, idealerweise an einem Termin)

**Schritt 1 — `main` inhaltlich auf den Produktivstand bringen**
(nur nötig wegen der divergierten Historie; kein Force-Push, die 904
Commits der alten `main`-Historie bleiben erhalten):

```bash
git fetch origin
git checkout -B main origin/main
git merge --allow-unrelated-histories \
  feature/react-flow-cable-editor-7322653268250495059   # Konflikte sind erwartet …
# … sie werden nicht manuell aufgelöst, sondern der Baum wird exakt auf den
# Feature-Stand gesetzt:
git rm -rq .
git checkout feature/react-flow-cable-editor-7322653268250495059 -- .
git add -A
git commit -m "chore: main auf den Produktivstand des Feature-Branches bringen"
# Verifikation: Muss leer sein, sonst nicht pushen!
git diff --exit-code main feature/react-flow-cable-editor-7322653268250495059
npm run check
git push origin main          # normaler Push, kein Force
```

Der Push triggert **keinen** Deploy: Der auf `main` liegende Workflow-Trigger
listet zu diesem Zeitpunkt (PR noch nicht gemergt) noch den Feature-Branch.
Solange bis zum Merge-Push in Schritt 5 deployt der Feature-Branch wie
gewohnt weiter — die Seite bleibt ununterbrochen online.

**Schritt 2 — Environment-Policy erweitern:** Settings → Environments →
`github-pages` → Deployment branches → `main` ergänzen (Feature-Branch-Eintrag
erst in Schritt 6 entfernen).

**Schritt 3 — Patch anwenden, committen und Vorbereitungs-PR mergen**
(Java-Script-frei, reines Git; benötigt `workflows:write`, siehe Tabelle oben):

```bash
git apply docs/ci/patches/2026-10-12-deploy-trigger-main.patch
npx vitest run scripts/ci/workflows.test.ts   # 23 Tests müssen grün sein
git add .github/workflows/deploy.yml docs/ci/workflows/deploy.yml scripts/ci/workflows.test.ts
git commit -m "chore(ci): Deploy-Trigger auf main (Patch 2026-10-12)"
git push origin <vorbereitungs-branch>
```

Mit angewendetem Patch ist der Wächter-Check aus Hartnäckigkeit 2 grün, und
der Merge-Push deployt noch nichts (siehe Schritt 1) und berührt die Seite
nicht. Wird der Patch erst nach dem Merge angewendet, bleibt der eine Check
bis dahin rot — beabsichtigt (siehe Hartnäckigkeit 2).

**Schritt 4 — Default-Branch umstellen:** Settings → Branches → Default auf
`main`. Den Vorbereitungs-PR dabei auf `main` umzielen lassen bzw. falls
nötig im PR selbst umstellen. Ab jetzt skippen Pushes auf den Feature-Branch
ihre Deploy-Jobs (Job-`if` vergleicht mit dem neuen Default) — die Seite
bleibt auf dem letzten Deploy stehen, es fällt nichts aus, es läuft nur
nichts Neues ein.

**Schritt 5 — Deploy anstoßen und belegen:** Den gemergten PR-Push oder ein
workflow_dispatch auf `main` laufen lassen. Der Run muss komplett grün sein —
besonders der Schritt „Smoke-Check“, der selbst beweist, dass die
ausgelieferte Seite der gebaute Stand ist. Danach `https://caze7.github.io/Camp/`
im Browser prüfen.

**Schritt 6 — Aufräumen, erst nach grünem Deploy auf `main`:**
Feature-Branch aus der `github-pages`-Policy entfernen; Branch Protection auf
`main` einrichten (`docs/CI.md` §4); die alte Feature-Branch-Referenz in
`docs/CI.md` §2.1 und `agent.md` ist historisch datiert und bleibt als
Zeugnis stehen. Branch-Aufräumen danach: `docs/branch-inventory-2026-10-12.md`.

**Rollback bis Schritt 5 inklusive:** Default-Branch zurück auf den
Feature-Branch setzen — alles läuft wie vorher, nichts wurde gelöscht.

## Bewusst nicht vorgesehen

- **Force-Push auf `main`** — verboten; deshalb der Merge-Weg in Schritt 1.
- **`main` löschen und neu anlegen** — würde die 904 Commits der alten
  Historie vernichten und ist damit eine destruktive Variante desselben
  Schritts; nicht empfohlen.
- **Trigger-Liste mit zwei Branches als Übergangszustand** — der Wächter
  verlangt bewusst genau einen Eintrag; ein Übergangszustand wäre genau das
  stille Rotieren, vor dem er schützt.
