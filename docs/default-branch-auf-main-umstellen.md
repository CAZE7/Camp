# Standard-Branch auf `main` umstellen (Deploy-Runbook)

Kurzanleitung für den Repo-Betreiber (GitHub-Einstellungen nötig, die ein
Agent nicht ohne Weiteres setzen darf). **Nur Vorbereitung ist im Repo
geschehen** — der Deploy-Workflow triggert seit dem PR „Showcase-Readiness“
auf `main`, umgestellt hat das Repository selbst damit noch nichts.

## Ausgangslage (gemessen am 2026-10-12)

| Befund                           | Wert                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Default-Branch                   | `feature/react-flow-cable-editor-7322653268250495059`                                                                     |
| `origin/main`                    | existiert, Stand `ac94476` (2026-09-07, 904 Commits)                                                                      |
| Historie `main` ↔ Feature-Branch | **kein gemeinsamer Merge-Base** (Feature-Branch ist ein einzelner Root-Commit `3790959`) — ein Fast-Forward ist unmöglich |
| GitHub Pages                     | `build_type: workflow`, URL `https://caze7.github.io/Camp/`                                                               |
| Environment `github-pages`       | Deployment-Branch-Policy erlaubt **genau** den Feature-Branch (per API geprüft)                                           |
| Deploy-Trigger (nach diesem PR)  | `on.push.branches: ["main"]`; die Job-`if`-Bedingungen vergleichen dynamisch mit dem tatsächlichen Default-Branch         |

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

**Schritt 3 — Vorbereitungs-PR mergen.** Der Wächter-Check aus Hartnäckigkeit 2
ist dabei rot; entweder die fehlgeschlagenen Jobs nach Schritt 4 neu laufen
lassen oder den einen bewusst verstandenen Check admin-seitig übergehen. Der
Merge-Push selbst deployt noch nichts (siehe Schritt 1) und berührt die
Seite nicht.

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
