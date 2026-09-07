# Übergabe an die nächste KI / den nächsten Agenten

**Datum:** 2026-09-07 · **Autor:** Arena-Agent, Session `arena/01a078c9-camp` · **Stand:** PR #418 (Audit P0–P4) ist in `feature/react-flow-cable-editor-7322653268250495059` gemergt.

Dieses Dokument erklärt, **was fertig ist, was offen ist, und in welcher Reihenfolge die offene Arbeit erledigt werden sollte.** Es ist für eine KI geschrieben, die mit Git/Shell/CI umgehen kann. Sprache des Projekts: **Deutsch** (auch Code-Kommentare, Commits, Reports).

---

## 0. Landkarte: Es gibt ZWEI auseinandergelaufene Linien

| Linie                                                 | Paket-Lage              | Inhalt                                                                  | Zustand                                                                                      |
| ----------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `feature/react-flow-cable-editor-7322653268250495059` | `@xyflow/react` **v12** | Planer-Migration v12 + kompletter Audit EXTREM 2026-09 (P0–P4, PR #418) | **grün** (1789/1789 Tests, Gate + Build + Playwright)                                        |
| `main`                                                | `reactflow` **v11**     | Werft-Features (KI-Assistent/Chat, MainLayout), Routing V2 (PR #417)    | **ROT seit 06.09.** — „Unit- und Komponententests" (PlannerInner/e2eSelectors) schlagen fehl |

**Root Cause main:** Commit `d776963` (PR #388, „Commit all changes including main updates for merge readiness") hat 192 Dateien mit einem veralteten Workspace-Stand überschrieben („Stomp"). Details, Beweise und Reparatur: `docs/handover/MAIN-REPAIR.md`.

**Wichtig:** PR #418 (Feature-Linie) hat main NICHT repariert — die Linien sind zu weit auseinander. Die main-Reparatur ist Aufgabe 1.

---

## 1. Aufgabe 1 (P0, zuerst): main reparieren

**Artefakte:** `docs/handover/main-repair.patch` (213 Dateien, gegen `origin/main` = `108de56` validiert per `git apply --check`) und `docs/handover/MAIN-REPAIR.md` (Analyse + Beweistabelle).

Der Patch wurde vollständig verifiziert: ESLint 0 · Format ok · tsc ×2 = 0 Fehler · **1538/1538 Tests grün** (inkl. der rot gemeldeten PlannerInner-/e2eSelectors-Tests) · Coverage-Gate erfüllt · `next build` ok. Er tut:

1. 154 Dateien zurück auf den letzten grünen main-Stand `67bd357`
2. Routing V2 **erhalten** und in die gute Slice-Store-Architektur portiert (`routeEdgesV2` in jeden Mutationspfad, `onLayoutV2`/`rerouteV2`, CableEdge-`geometry`-Polyline)
3. Werft-Features **erhalten** (KI-Assistent/Chat, Dach, Deps) — der Nutzer will ausdrücklich alle aktuellen Funktionen behalten
4. 77 Strict-Mode-Verletzungen (Routing-V2-Code unter `noUncheckedIndexedAccess`) behoben; Stomp-Müll gelöscht

**So wird er eingespielt** (Branch mit Push-Recht auf main; in dieser Reihenfolge):

```bash
git clone git@github.com:CAZE7/Camp.git && cd Camp   # oder bestehender Klon
git checkout main && git pull
git apply --check docs/handover/main-repair.patch     # muss OK melden
git apply docs/handover/main-repair.patch
npm ci
npm run check          # lint + format + 2× typecheck + coverage-Suite — muss grün sein
npm run build          # Static Export — muss grün sein
git checkout -b repair/main-pr388-stomp
git add -A
git commit -m "repair(main): PR-#388-Stomp rückgängig; Routing V2 in Slice-Architektur portiert; Werft-Features erhalten (Patch aus Arena-Session, verifiziert: 1538/1538 Tests)"
git push -u origin repair/main-pr388-stomp
# Dann PR → main öffnen, CI grün abwarten, mergen.
```

Falls `git apply --check` fehlschlägt (main hat sich seit `108de56` bewegt): `git apply --3way docs/handover/main-repair.patch` und Konflikte manuell lösen; Grundlage des Patches ist `108de56`, Soll-Zustand ist in `MAIN-REPAIR.md` beschrieben.

**Nach dem Merge:** `main-repair.patch` und die beiden Handover-Dateien aus dem Repo löschen (sie sind Einmal-Artefakte), CI auf main beobachten.

## 2. Aufgabe 2 (P1): Linien konsolidieren — „verschiedene Stände" endgültig beenden

Der Nutzer will: _„endlich nicht immer Probleme durch verschiedene Stände"_. Nach Aufgabe 1 existieren weiterhin zwei funktionierende, aber getrennte Linien. Es braucht eine bewusste Entscheidung (mit dem Nutzer abstimmen!):

- **Empfehlung:** Die **Feature-Linie (v12) als führend** erklären — sie trägt den kompletten Audit-Durchgang (Safety/Correctness), die v12-Migration und die Golden-Master-Infrastruktur — und die Features, die nur auf main leben, **dorthin portieren**: Routing V2 (ELK + routing-v2-Modulbaum) und die Werft-Features (KI-Assistent/Chat, MainLayout, Dach). Das Portieren der Store-Integration wurde im main-repair.patch für v11 bereits einmal demonstriert (gleiche Idee, gleiche Einfügepunkte: `store/slices/graphSlice.ts`).
- Danach: `main` auf die konsolidierte Linie fast-forwarden/resetten und die andere Linie schließen; branch protection / Required-Checks prüfen, damit niemand mehr trotz roter CI mergen kann.
- Alternative (nicht empfohlen): main (v11) führend — bedeutet, die v12-Migration + Audit-Arbeit rückwärts zu portieren.

## 3. Aufgabe 3 (P2/P3): bewusst offene Audit-Punkte

Alles mit Status-Label — kein Punkt davon ist „fertig behauptet", alle sind im Report dokumentiert:

| Punkt                                                                                           | Datei/Ort                                                                                                                            | Status                     | Nächster Schritt                                                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| IEC-62548-Klauselwortlaut (1,25–2,4 × Isc, String-OCPD ab 3 Strings)                            | `lib/solar.ts` Dateikopf                                                                                                             | **UNVERIFIED**             | Normen-Text (IEC 62548:2016) beschaffen und Klauseln exakt zitieren oder Angabe auf NEC-only zurückziehen |
| ELE-004: 20-cm-Faustregel Hauptsicherungsnähe                                                   | `useLiveValidation.ts` / Audit                                                                                                       | **UNVERIFIED**             | Quelle (z. B. DIN VDE 0100-560 / TAB) recherchieren oder Faustregel als MODELANNAHME deklarieren          |
| Negativ-Tests Wasser-Modus × connectionRules                                                    | `lib/connectionRules.test.ts`                                                                                                        | offen                      | Wasser-Kanten (grayWaterTank→sink) als Charakter-Tests ergänzen                                           |
| ARCH-Rest: Runtime-Imports `lib/routing/elk/ab-compare.ts`, `rules/costModel.ts` aus components | `lib/routing/`                                                                                                                       | OUT OF SCOPE (bewusst)     | Nur angehen, wenn ELK in den Produktionspfad wandert                                                      |
| Werft-Design-Token-Verschuldung                                                                 | `lib/designTokens.test.ts` → `WERFT_LEGACY_TOKEN_DEBT`                                                                               | FOLLOW-UP (nach Aufgabe 1) | 6 Dateien tokenisieren, Allowlist-Eintrag entfernen                                                       |
| `any`-Typen in Werft-Dateien                                                                    | `app/api/chat/route.ts`, `components/Chat*.tsx`, `lib/db.test.ts`, `DachPlanerFlow.tsx` (file-weise `eslint-disable` mit Begründung) | FOLLOW-UP                  | Typisieren, Disable-Köpfe entfernen                                                                       |
| Routing-V2-Coverage außerhalb des Gesamttors                                                    | `vitest.config.ts` → `exclude: lib/planner/**`                                                                                       | FOLLOW-UP                  | Tests auf Altkern-Niveau (95 % statements / 85 % branches), dann Ausnahme streichen                       |

## 4. Verbindliche Arbeitsregeln des Auftraggebers (unangetastet lassen!)

- **Status-Labels** für jede fachliche Aussage: VERIFIED / PROBABLY CORRECT / UNVERIFIED / INCORRECT / UNSAFE / NORMATIVE GAP / OUT OF SCOPE. Niemals „100 % korrekt" ohne Beweis.
- **Nichts erfinden:** Unverifizierbare Normen/Klauseln als UNVERIFIED kennzeichnen mit Begründung, welche Quelle fehlt.
- **Safety > Correctness > Data Integrity > UX/Performance/Eleganz.**
- **Beweisende Tests** für jeden Fix; keine Aussage ohne Reproduktion/Zahlen.
- **Golden-Master/Capture-Änderungen** nur mit Ledger-Eintrag in `docs/ARCHITECTURE-CHANGES.md`; Fix-Status in der Matrix von `AUDIT-EXTREM-2026-09.md` aktualisieren.
- **Sprache Deutsch** (Reports, Kommentare, Commits).
- **Qualitäts-Gate:** `npm run check` (lint + format:check + 2× typecheck + coverage-Suite) und `npm run build`; ein Pre-Push-Hook erzwingt das Gate — niemals mit `--no-verify` umgehen.
- **Vollständige Testbasis vor Merge:** Feature-Linie 1789 Tests, main nach Repair 1538 — jede Änderung muss beide jeweils betreffenden Suiten grün halten.

## 5. Was PR #418 geliefert hat (Kontext, nicht nochmal machen)

- **P0/P1 (Commit `c8aebea`):** ELE-001..007, AC-001, CRASH-001, PERF-, ROUTE-, PERSIST-, UX-Fixes
- **P2–P4 (Commit `5392498`):**
  - `lib/solar.ts` (NEU): Isc/Voc/TK-Modell, Designstrom 1,25×Isc, Sicherungsfloor 1,5625×Isc (NEC 690.8/690.9, MODELLANNAHME), Kalt-Voc(−20 °C)-Regel A6, Fuse-Floor in EdgeErrors
  - AUTO-003: `chemistriesParallelSafe` (AGM‖Gel, LiFePO4‖Li-Ion blockiert), Live-Regel A5, `role`-Feld schlägt Label-Heuristik
  - `lib/nodeSchema.ts` (NEU): deklaratives Runtime-Schema, Persistenz-Migration entfernt falsch getippte bekannte Felder
  - `lib/connectionRules.ts` (NEU): isValidConnection als reine Funktion, Store delegiert
  - `lib/domain/graph.ts`, `lib/domain/cableEdgeData.ts` (NEU): lib/ ohne @xyflow/components-Typ-Imports
  - UX-001 vollständig: `collectEdgeErrors` → `EdgeError[]`
  - Golden Master neu eingefroren (solar/complex: z. B. 15 A/10 mm² → 25 A/16 mm²)

## 6. Datei-Landkarte

| Pfad                                                                          | Inhalt                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `AUDIT-EXTREM-2026-09.md`                                                     | Alle Findings (Format: ID/SEVERITY/CATEGORY/…/REGRESSION RISK) + FIX-STATUS-Matrix |
| `docs/ARCHITECTURE-CHANGES.md`                                                | Architektur-Ledler (jede bewusste Änderung hat einen Eintrag)                      |
| `docs/handover/MAIN-REPAIR.md`                                                | main-Root-Cause-Analyse + Reparatur-Beweis                                         |
| `docs/handover/main-repair.patch`                                             | Validierter Reparatur-Patch für main (Einmal-Artefakt, nach Anwendung löschen)     |
| `docs/handover/HANDOVER-NEXT-AI.md`                                           | Dieses Dokument                                                                    |
| `lib/solar.ts`, `lib/nodeSchema.ts`, `lib/connectionRules.ts`, `lib/domain/*` | Neue Audit-Module + Tests jeweils daneben                                          |
| `scripts/goldenmaster/`, `knownPlans/*.json`                                  | Golden-Master-Infrastruktur (`npm run goldenmaster:capture`)                       |

## 7. Reihenfolge-Zusammenfassung

1. **main reparieren** (Aufgabe 1) — Patch einspielen, PR, mergen, CI grün.
2. **Mit dem Nutzer abstimmen:** Linien-Konsolidierung (Aufgabe 2, Empfehlung v12 führend).
3. Konsolidierung durchführen, danach Handover-Artefakte aus dem Repo löschen.
4. Offene Audit-Punkte nach Priorität (Aufgabe 3), jeweils mit Beweis-Tests + Status-Labels + Ledger.
5. Ganz am Ende: erneute formale Freigabeprüfung (der historische „NOT SAFE"-Block in `AUDIT-EXTREM-2026-09.md` bezieht sich auf die auditierte Baseline und wartet auf eine neue Gesamtbewertung).
