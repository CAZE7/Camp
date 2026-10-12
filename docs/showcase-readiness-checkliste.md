# Checkliste: Showcase-Readiness (Stand 2026-10-12)

Status dieser Vorbereitung des Repos für die Bewerbungsmappe. Umgesetzt auf
Branch `arena/82265276-camp`, nachprüfbar als
[PR #524](https://github.com/CAZE7/Camp/pull/524). Alle „erledigt“-Punkte
wurden am 2026-10-12 wirklich ausgeführt — nichts ist „erwartet“, jede Zahl
ist gemessen. Umgebung: Node 22.22.3, Chromium 153.0.8010.0 (headless,
Software-Rendering in der Sandbox), gegen den gebauten Static Export.

## Erledigt

- [x] **Deploy-Trigger auf `main` vorbereitet** als kopierfertiger Patch:
      `docs/ci/patches/2026-10-12-deploy-trigger-main.patch` (betrifft
      `.github/workflows/deploy.yml`, die 1:1-Kopie in `docs/ci/workflows/`
      und `scripts/ci/workflows.test.ts`). Der direkte Push der
      Workflow-Datei wurde von GitHub abgelehnt
      (`without workflows permission` — dokumentierter Fall, `docs/CI.md`
      §2.1); der Patch-Test läuft im Branch-Stand grün (23/23).
- [x] **Runbook** `docs/default-branch-auf-main-umstellen.md` mit Reihenfolge
      und gemessener Ausgangslage: `origin/main` (`ac94476`, 2026-09-07) hat
      keine gemeinsame Historie mit dem Feature-Branch (kein Merge-Base);
      die `github-pages`-Environment-Policy erlaubt aktuell genau den
      Feature-Branch (per API geprüft).
- [x] **Branch-Inventar** `docs/branch-inventory-2026-10-12.md`: alle 412
      Remote-Branches (63 `arena/*`, 8 `dependabot/*`, 4 `add-*`, 337
      sonstige) mit letztem Commit-Datum und PR-Status. Alle 412 Zeilen
      maschinell gegen die GitHub-PR-Liste verifiziert (Datum, PR-Nummern,
      Offen-Flag). Ergebnis: **315 gefahrlos löschbar**, 18 mit offenem PR,
      78 ohne PR (manuell prüfen). Gelöscht wurde nichts.
- [x] **Impressum & Datenschutz geprüft** (`docs/impressum-datenschutz-befund.md`):
      alle fünf Pflichtfelder in `lib/siteLegal.ts` auf Platzhalter,
      Datenschutzseite mit Rechtsberatung-Vorbehalt; Optionen mit Folgen
      dokumentiert. Keine personenbezogenen Daten eingetragen;
      `LEGAL_NOTICE_GATE` bleibt auf `warn`.
- [x] **README überarbeitet.** Einstieg (Was, für wen, technischer Kern:
      Next.js 16, React 19, TypeScript strict, React Flow 12, Zustand 5,
      VDE-Domäne in `lib/`). Demo-URL belegt (Pages-API plus Live-Abruf,
      2026-10-12). Neuer Abschnitt „Zwei Agenten-Dateien“: `AGENTS.md` und
      `agent.md` haben unterschiedliche Zwecke und wurden nicht
      zusammengeführt (Begründung im README). Lizenz-Dreiklang
      README/LICENSE/`package.json` als konsistent ISC geprüft.
- [x] **Echte Screenshots** aus dem gebauten Export: `docs/screenshots/`
      (Desktop hell/dunkel 1440×900, mobil 375×812, Wissensseite,
      Startseite), Planzustand aus dem Onboarding-Flow der Anwendung
      (13 Bauteile · 13 Leitungen). Die veralteten `docs/images/*` entfernt.
- [x] **Qualitätsstand neu gemessen (2026-10-12):** `npm run check` grün
      (Lint, Format, 2× Typecheck, Coverage-Gate; Tests 3309 bestanden,
      1 bedingt übersprungen, 241 Dateien) — 3 Läufe, davon 1× als
      Pre-Push-Hook. `npm run build` grün (Export-Audit: 31 Seiten).
      E2E `npx playwright test --grep-invert "hält die Baseline"`:
      133 bestanden, 31 bedingt übersprungen, 0 Fehler (3,3 min), inkl.
      aller 36 axe-Läufe (0 kritische/schwere Verstöße). Nicht erneut
      gelaufene README-Zeilen mit `†` markiert und datiert.
- [x] **Geheimnisse:** `.env.example` sauber (nur optionaler
      Chat-Endpunkt-Platzhalter, `.env*` gitignored). gitleaks-Binary in der
      Sandbox nicht ladbar (Release-Host blockiert) — stattdessen
      Muster-Scans (`git grep -I`) über alle getrackten Dateien und die
      Referenzen `origin/main`, `origin/feature/…`, `HEAD`: 0 Treffer.
- [x] **CI auf dem PR grün:** Quality Gate (5:51 min), End-to-End
      (3:16 min), Visuelles Gate (1:56 min) — Lauf 38273878129.

## Offen (braucht Rechte oder Daten, die nur der Betreiber hat)

- [ ] Patch anwenden und pushen (benötigt `workflows:write`) — Runbook
      Schritt 3, drei Befehle.
- [ ] Default-Branch auf `main` umstellen, `github-pages`-Policy erweitern,
      Deploy auf `main` belegen — Runbook Schritte 2–6 (GitHub-Admin).
- [ ] Impressum: die fünf Felder in `lib/siteLegal.ts` füllen (nur der
      Betreiber kann echte Angaben liefern).
- [ ] Branch-Löschung ausführen (Liste und Vorschlag im Inventar).

## Von dir zu entscheiden

- [ ] Die **315 löschbaren** Remote-Branches löschen? Vorschlag: ja, einzeln
      per `git push origin --delete <name>`, nie den Default-Branch.
- [ ] Die **78 Branches ohne PR** einzeln prüfen — eher PR schließen als
      Branch löschen.
- [ ] Lizenz: bei **ISC** bleiben (alles konsistent) oder auf **MIT**
      wechseln? Beides vertretbar, aktuell nichts gemischt.
- [ ] Impressum: **Option A** (Angaben ergänzen — Empfehlung, die
      Infrastruktur steht komplett) oder **Option B** (Demo-Kennzeichnung,
      entfernt weder Warnung noch Risiko)?
- [ ] Nach dem Ausfüllen: `LEGAL_NOTICE_GATE` auf `block` stellen?

## Bekannte, bewusste Abweichungen

- Branch-Name `arena/82265276-camp` statt `chore/showcase-readiness`: die
  Arena-Session ist technisch an diesen Namen gebunden; Inhalt identisch.
- Der Trigger-Change liegt als Patch statt im Branch (Push-Rechte, s. o.).
- Die Screenshots zeigen einen Plan mit offenem Prüfbericht
  („Nicht bestanden“) — authentisch: RCD-Entscheidungen bleiben bewusst
  beim Nutzer; auch die vorherigen README-Bilder zeigten offene Hinweise.
- Die Pixel-Baseline-Vergleiche liefen bewusst nicht in der Sandbox
  (Software-Rendering wäre kein Beleg); sie laufen im CI-Job `visual` grün.
