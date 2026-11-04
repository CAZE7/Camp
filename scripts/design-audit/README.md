# AP-2 · Messwerkzeuge (Reproduzierbarkeit)

Diese Werkzeuge haben die Zahlen in
[`docs/AP-2-TOKEN-KONSOLIDIERUNG-2026-11-04.md`](../../docs/AP-2-TOKEN-KONSOLIDIERUNG-2026-11-04.md)
erzeugt. Sie stehen im Repo, damit jeder Befund später mit demselben Befehl
nachgeprüft werden kann — die Spezifikation verlangt in §11 und §12, dass
Design-Aussagen gemessen sind, nicht gelesen.

## Warum überhaupt Skripte und nicht nur Tests

`tests/e2e/rendered-contrast.spec.ts` ist das dauerhafte Gate. Diese Skripte
sind etwas anderes: sie **messen und schreiben Rohdaten**, ohne Schwellwert.
Nur so lässt sich ein Wertevergleich vor/nach einer Migration führen, bevor man
überhaupt weiß, welche Schwelle sinnvoll ist.

## Voraussetzung

Immer gegen den **gebauten Static Export**, nie gegen den Dev-Server — der Dev-
Server hat andere CSS-Chunks und kein `output: export`-Verhalten.

```bash
npm run build
node scripts/e2e/static-server.mjs 3123 out &
```

Node 22 ist Pflicht (`scripts/check-node-version.mjs`, `.nvmrc`); mit Node 20
brechen Vitest und tsx ab. Alle Skripte laufen aus dem Repository-Wurzel-
verzeichnis.

## Die drei Messläufe

| Skript                      | Output                                  | was es misst                                                                                                                                                                                              |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseline-verification.ts`  | `ergebnis/baseline-<name>.json`         | Engine-Ergebnisse aller Vorlagen und knownPlans: Verdikt, `coverage`, pro Durchgang die Check-Status und `evaluatedEntities`. Beweist, dass eine Token-Migration die Elektrik nicht bewegt.               |
| `mess-computed-styles.mjs`  | `ergebnis/computed-styles-<name>.json`  | Computed Styles am `html`-Element für beide Themen und beide Seiten, plus gerenderte Schriftbreiten. Das ist die Kaskaden-Wahrheit: was nach Layer-Spezifität übrig bleibt, nicht was in der Datei steht. |
| `mess-gemalte-elemente.mjs` | `ergebnis/gemalte-elemente-<name>.json` | Tatsächlich gemalte Leitungs-Strokes, Legendenproben, gemischte Rückenfarben und Kontraste. Fragt keine CSS-Datei.                                                                                        |

Ausführung (der Name ist das, was später verglichen wird):

```bash
node node_modules/tsx/dist/cli.mjs \
  scripts/design-audit/baseline-verification.ts vor
node scripts/design-audit/mess-computed-styles.mjs vor
node scripts/design-audit/mess-gemalte-elemente.mjs vor
```

`BASE_URL` optional überschreiben:

```bash
BASE_URL=http://127.0.0.1:4173 node scripts/design-audit/mess-gemalte-elemente.mjs nach
```

## Vorher/Nachher vergleichen

```bash
node scripts/design-audit/vergleichen.js \
  computed-styles-vor computed-styles-nach
node scripts/design-audit/vergleichen.js \
  baseline-vor baseline-nach --ohne-zeitstempel
```

`vergleichen.js` gibt die Felder aus, die sich unterscheiden — und meldet
explizit, wenn ein Feld fehlt, statt es als „gleich" zu zählen.

## Kontrastformel

Beide Messskripte nutzen dieselbe WCAG-relative-Luminanz wie das E2E-Gate und
führen einen Selbsttest (`#000` auf `#fff` muss 21,00 ergeben). Ein Kontrastwert
ohne diesen Nachweis ist nicht überprüfbar; in diesem Projekt war er es zweimal
nicht.

## Bekannte Grenzen

- `mess-computed-styles.mjs` liest Tokens am `html`-Element. Rollen, die nur
  innerhalb `.planner-shell` gelten, sind dort nicht sichtbar; dafür malt
  `mess-gemalte-elemente.mjs` die Elementebene.
- Die Skripte setzen einen Desktop-Viewport von 1440 px. Responsive-Aussagen
  gehören in `tests/e2e/` über die vier Playwright-Projects.
- `ergebnis/` ist ein Snapshot-Stand vom 04.11.2026 auf `main` = `e0c2cfc` und
  nach AP-2. Neuere Läufe überschreiben nur, was der Name sagt.
