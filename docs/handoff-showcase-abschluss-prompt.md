# Übergabe-Prompt: Abschluss der Showcase-Readiness

Dieser Prompt ist kopierfertig für einen Agenten mit **GitHub-Admin- und
`workflows:write`-Rechten**. Vor dem Abschicken müssen die Platzhalter im
Block „Betreiber-Vorgaben“ ausgefüllt werden — insbesondere die
Impressumsangaben: Diese kann kein Agent erfinden (`lib/siteLegal.ts`
begründet, warum erfundene Angaben schlimmer als der Platzhalter sind).

---

<!-- Ab hier ist es der Prompt selbst. Vor Abschicken alle „…“ ausfüllen. -->

# Auftrag: Abschluss der Showcase-Readiness im Repo CAZE7/Camp

Du arbeitest im GitHub-Repo **CAZE7/Camp** („Werft“ — statischer
Next.js-Elektroplaner für den Camper-Ausbau, Static Export auf GitHub Pages).
Dein Ziel: die offenen Punkte der Showcase-Readiness abschließen, sodass das
Repo als Bewerbungsreferenz stimmt — der Deploy läuft danach von `main`, das
Impressum ist vollständig, die README ist korrekt, die Checkliste ist
aktualisiert.

## Pflichtlektüre (in dieser Reihenfolge, vor dem ersten Befehl)

1. `AGENTS.md` — Projektregeln und Definition of Done (`docs/ai/CHANGE-WORKFLOW.md` § 24)
2. `docs/default-branch-auf-main-umstellen.md` — **das Runbook, dem du folgst**
3. `docs/showcase-readiness-checkliste.md` — deine Aufgabenliste (Abschnitte „Offen“ und „Von dir zu entscheiden“)
4. `docs/branch-inventory-2026-10-12.md` — nur falls `BRANCHES_LOSCHEN=JA`
5. `docs/CI.md` § 4 — Branch Protection

## Harte Voraussetzungen — brich sofort ab und melde es, wenn eine fehlt

- GitHub-Token mit **Admin**-Rechten am Repo und **`workflows:write`**
  (prüfen mit `gh api repos/CAZE7/Camp --jq .permissions`; `admin` muss
  `true` sein). Ohne `workflows:write` scheitert Schritt 3 mit
  `refusing to allow … without workflows permission` — dann STOPP.
- `gh` authentifiziert, Node.js ≥ 22, npm ci läuft mit dem Lockfile.
- Wichtig: Jeder `git push` löst einen Pre-Push-Hook aus, der **`npm run check`
  komplett laufen lässt** (mehrere Minuten). Das ist gewollt — **nie
  `--no-verify` benutzen**.

## Eiserne Regeln

- **Erfinde nichts.** Keine personenbezogenen Daten, keine Zahlen, URLs oder
  Screenshots, die du nicht selbst erzeugt oder aus dem Repo/der API belegt hast.
- **Kein Force-Push, kein `--no-verify`, keine Branch-Löschung** außer der in
  `BRANCHES_LOSCHEN=JA` freigegebenen.
- Jeder Schritt mit der angegebenen Verifikation. **Wird etwas unerwartet
  rot: sofort stoppen und den Befund melden** — nichts „reparieren“, keine
  Gates lockern, keine Tests überspringen.
- Keine neuen Features, keine UI-Änderungen außer den unten ausdrücklich
  vorgesehenen (Impressum-Texte).

## Betreiber-Vorgaben (vor dem Start ausfüllen)

```
IMPRESSUM_DATEN:
  providerName:        …            # Anbietername inkl. Rechtsformzusatz (§ 5 DDG Nr. 1)
  street:              …            # Straße und Hausnummer (ladungsfähige Anschrift)
  postalCodeAndCity:   …            # PLZ und Ort
  email:               …            # E-Mail für schnelle Kontaktaufnahme (§ 5 DDG Nr. 2)
  contentResponsible:  …            # Inhaltlich Verantwortliche:r mit Anschrift (§ 18 Abs. 2 MStV)
  # Alle fünf Zeilen leer lassen = Impressum-Schritt (Aufgabe 7) überspringen
  # und im Abschlussbericht als offen melden. NIEMALS mit Platzhalterwerten füllen.

NORMZITATE_AUF_DDG:  NEIN | JA      # Sichtbare Zitate auf /impressum/ von „§ 5 TMG /
                                    # § 55 RStV“ auf „§ 5 DDG / § 18 MStV“ umstellen
                                    # (nur zusammen mit ausgefülltem Impressum sinnvoll)

LEGAL_GATE_BLOCK:    NEIN | JA      # LEGAL_NOTICE_GATE im Deploy-Workflow auf
                                    # „block“ stellen (nur mit ausgefülltem Impressum)

BRANCHES_LOSCHEN:    NEIN | JA      # Die 315 löschbaren Remote-Branches aus
                                    # docs/branch-inventory-2026-10-12.md einzeln löschen

LIZENZ:              ISC_BLEIBT | MIT_WECHSEL   # aktuell alles konsistent ISC
```

## Aufgaben — genau diese Reihenfolge (Gründe: Runbook, Abschnitt „Hartnäckigkeiten“)

**Aufgabe 1 — Vorbereitungs-PR mergen.** `gh pr view 524` (muss OPEN und grün
sein), dann `gh pr merge 524 --merge`. Diff ist Dokumentation + Patch-Datei;
löst keinen Deploy aus. Danach `git checkout <default-branch> && git pull`.

**Aufgabe 2 — Environment-Policy erweitern.**
`gh api -X POST repos/CAZE7/Camp/environments/github-pages/deployment-branch-policies -f name=main`,
verifizieren mit `gh api repos/CAZE7/Camp/environments/github-pages/deployment-branch-policies`
(erwartet: `total_count: 2`).

**Aufgabe 3 — Patch auf dem Default-Branch anwenden und pushen** (nicht über
einen PR — der Trigger-Wächter wäre dort rot, siehe Runbook):

```bash
git apply docs/ci/patches/2026-10-12-deploy-trigger-main.patch
npx vitest run scripts/ci/workflows.test.ts    # 23 Tests müssen grün sein
npm run check                                   # muss grün sein
git add .github/workflows/deploy.yml docs/ci/workflows/deploy.yml scripts/ci/workflows.test.ts
git commit -m "chore(ci): Deploy-Trigger auf main (Patch 2026-10-12)"
git push
```

Erwartung: **kein** Workflow-Run durch diesen Push (der gepushte Trigger
reagiert nur noch auf `main`). Die Seite bleibt unverändert online.

**Aufgabe 4 — `main` auf den Produktivstand bringen** (Runbook „Schritt 3“,
Prozedur mit `--allow-unrelated-histories` + Baum-Reset; Verifikation
`git diff --exit-code main <default-branch>` **muss leer sein, sonst nicht
pushen**; dann `npm run check`, normaler Push auf `main`). Erwartung: genau
ein Deploy-Workflow-Run auf `main`, dessen drei Jobs **übersprungen** werden
(Job-`if` vergleicht noch mit dem alten Default) — das ist korrekt.

**Aufgabe 5 — Default-Branch umstellen.**
`gh api -X PATCH repos/CAZE7/Camp -f default_branch=main`, verifizieren mit
`gh api repos/CAZE7/Camp --jq .default_branch` → `main`.

**Aufgabe 6 — Deploy auf `main` belegen.** `gh workflow run deploy.yml --ref
main`, dann `gh run watch`. **Alle drei Jobs müssen grün sein** — besonders
der Smoke-Check. Danach `https://caze7.github.io/Camp/` und
`https://caze7.github.io/Camp/planer/` per HTTP prüfen (Status 200, erwarteter
Seitentitel). Ergebnis (Run-ID, Dauer, Smoke-Ausgabe) für den Bericht notieren.

**Aufgabe 7 — Impressum füllen** (nur wenn `IMPRESSUM_DATEN` vollständig;
sonst überspringen und als offen melden): die fünf Felder in
`lib/siteLegal.ts` setzen. Wenn `NORMZITATE_AUF_DDG=JA`: die sichtbaren
Normzitate in `app/impressum/page.tsx` („§ 5 TMG“, „§ 55 Abs. 2 RStV“) auf
„§ 5 DDG“ und „§ 18 Abs. 2 MStV“ umstellen — der Kommentar in
`lib/siteLegal.ts` beschreibt genau diesen Schritt. Dann:
`npm run check` und `npm run build` grün; die Impressum-Baselines
(`tests/e2e/visual.spec.ts-snapshots/route-impressum-*.png`) **bewusst und
begründet** neu aufnehmen (`npx playwright test tests/e2e/visual.spec.ts
--update-snapshots`; benötigt `./out` und Chromium — falls nötig
`npx playwright install --with-deps chromium`), Begründung in die
Commit-Nachricht. Lokal `npm run ci:verify-legal-notice` muss
„Impressum vollständig“ melden. Commit + Push auf `main` → Deploy läuft jetzt
normal und muss inkl. Smoke-Check grün sein; danach die Live-Seite
`https://caze7.github.io/Camp/impressum/` prüfen (keine Platzhalter, kein
„BITTE-EINTRAGEN“ im HTML).

**Aufgabe 8 — Warn-Stufe schärfen** (nur wenn Aufgabe 7 erledigt **und**
`LEGAL_GATE_BLOCK=JA`): in `.github/workflows/deploy.yml` die Zeile
`LEGAL_NOTICE_GATE: warn` auf `block` setzen; `npx vitest run
scripts/ci/workflows.test.ts` und `npm run check` müssen grün bleiben (falls
ein Workflow-Test den Wert pins, nicht blind ändern — stattdessen stoppen und
berichten). Commit + Push; der ausgelöste Deploy muss grün durchlaufen.

**Aufgabe 9 — Lizenz** (falls `LIZENZ=MIT_WECHSEL`; sonst nichts tun):
`LICENSE` auf MIT-Volltext (Copyright © 2026 CAZE7), `"license": "MIT"` in
`package.json`, Lizenz-Abschnitt im README. `npm run check` grün, Commit +
Push, Deploy grün.

**Aufgabe 10 — Branch-Löschung** (nur wenn `BRANCHES_LOSCHEN=JA`): die
**315** Kandidaten aus `docs/branch-inventory-2026-10-12.md` (gemergter PR,
kein offener PR, nicht der Default-Branch) **einzeln** löschen:
`git push origin --delete <branch-name-ohne-origin-Prefix>`. Nie `--force`,
nie mehrere in einem Befehl mit Wildcards, nie den Default-Branch. Danach die
Zahlen in der Inventar-Datei um eine Zeile „gelöscht am <Datum>“ ergänzen.

**Aufgabe 11 — Aufräumen & Doku:** Feature-Branch aus der
`github-pages`-Policy entfernen (Policy-ID aus Aufgabe 2:
`gh api -X DELETE repos/CAZE7/Camp/environments/github-pages/deployment-branch-policies/<id>`);
Branch Protection auf `main` laut `docs/CI.md` § 4 einrichten; den
Default-Branch aus der Sonderfall-Tabelle des Inventars und die Checkliste
`docs/showcase-readiness-checkliste.md` aktualisieren (erledigte Punkte
abhaken, neues Datum, gemessene Ergebnisse — nichts Unbelegtes).

**Aufgabe 12 — Abschlussbericht** (als Kommentar auf dem gemergten PR #524
oder als neue Datei `docs/abschlussbericht-showcase.md`): nur **gelaufene**
Ergebnisse mit Befehl → Ergebnis, die Notfälle/Abweichungen, und welche
Punkte weiterhin offen sind. Nichts behaupten, was du nicht selbst ausgeführt hast.

## Stop-Bedingungen (sofort stoppen, Befund melden)

- Ein Check ist rot, den die Anleitung nicht ausdrücklich als erwartet
  beschreibt (z. B. die Skip-Runs in Aufgabe 4).
- `git diff --exit-code main <default-branch>` nach Aufgabe 4 ist nicht leer.
- Der Deploy in Aufgabe 6 oder 7 scheitert (auch der Smoke-Check).
- Ein Schritt verlangt ein Recht, das der Token nicht hat.
