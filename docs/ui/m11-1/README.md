# M11-1 — Oberflächenbelege (vorher / nachher)

Pflicht aus `AGENTS.md`, Auftragsbuch M11-1: „Vorher/Nachher-Screenshots
(375/768/1440 px) im PR — Merge erst nach optischer Freigabe durch den Nutzer."

Jedes Bild zeigt **links den Stand vor der Aufgabe** (`c6c11f7`) und **rechts den
Stand danach**. Aufgenommen wird der Planer-Shell, nicht die ganze Seite — der
Planer ist eine eingebettete Anwendung (`#planer`).

| Bild                                    | Ansicht                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `compare-plan-{375,768,1440}.png`       | Referenzplan (`knownPlans/complex.json`), erstes Bauteil ausgewählt → Inspector |
| `compare-validation-{375,768,1440}.png` | Planungsprüfung geöffnet (Überlaufmenü ⋯ → Prüfen)                              |

Weitere Zustände (leerer Plan mit geführtem Einstieg) erzeugt dasselbe Skript.

## Reproduzieren

```bash
npm ci && npx next build
node scripts/e2e/static-server.mjs 4173 out            # „nachher"

# „vorher" aus dem Basis-Commit:
git worktree add --detach /tmp/camp-before c6c11f7
cp -al "$PWD/node_modules" /tmp/camp-before/node_modules
(cd /tmp/camp-before && npx next build)
node scripts/e2e/static-server.mjs 4174 /tmp/camp-before/out

PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<chromium> \
  node scripts/dev/capturePlannerShots.mjs --out=/tmp/shots/after
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<chromium> \
  node scripts/dev/capturePlannerShots.mjs --out=/tmp/shots/before --base=http://127.0.0.1:4174

for v in 1440 768 375; do
  montage /tmp/shots/before/plan-$v.png /tmp/shots/after/plan-$v.png \
    -tile 2x1 -geometry +4+0 -background '#888' /tmp/shots/compare-plan-$v.png
  montage /tmp/shots/before/validation-$v.png /tmp/shots/after/validation-$v.png \
    -tile 2x1 -geometry +4+0 -background '#888' /tmp/shots/compare-validation-$v.png
done
```

Die Bilder hier sind auf die Kanäle für den PR-Vergleich verkleinert
(`convert -strip`); die vollauflösenden Läufe stehen unter `test-results/shots/`
und sind wie `test-results/` selbst nicht versioniert.
