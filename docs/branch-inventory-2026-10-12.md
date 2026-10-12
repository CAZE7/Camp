# Remote-Branch-Inventar (Stand 2026-10-12)

Erzeugt aus `git fetch origin` + `git for-each-ref` (Datum des letzten Commits je Branch)
sowie der PR-Liste über die GitHub-API (`gh pr list --state merged|open`, abgeglichen über
den Head-Branch-Namen). „via PR gemergt“ heißt: Es existiert ein **gemergter Pull Request
mit genau diesem Head-Branch** — das Repo merged per Squash, deshalb meldet
`git branch -r --merged` fast nichts. Erhoben am **2026-10-12**; Default-Branch zum
Erhebungszeitpunkt: `feature/react-flow-cable-editor-7322653268250495059`. **Gelöscht wurde nichts.**

## Zusammenfassung

| Gruppe       | Branches | via PR gemergt | offener PR | ohne PR (Sonderfall) | gefahrlos löschbar* |
| ------------ | -------- | -------------- | ---------- | -------------------- | ------------------- |
| arena/*      | 63       | 55             | 1          | 8                    | 54                  |
| dependabot/* | 8        | 0              | 8          | 0                    | 0                   |
| add-*        | 4        | 3              | 0          | 1                    | 3                   |
| Sonstige     | 337      | 259            | 9          | 69                   | 259                 |
| **Gesamt**   | **412**  | **317**        | **18**     | **78**               | **316**             |

\* „gefahrlos löschbar“ = gemergter PR vorhanden **und** kein offener PR. Der aktuelle
Default-Branch (`feature/react-flow-cable-editor-7322653268250495059`) ist kein Löschkandidat.

## Vorschlag zum Aufräumen (nur Vorschlag — hier wurde nichts gelöscht)

1. **Gefahrlos löschbar:** die 316 Branches mit gemergtem PR und ohne offenen PR
   (in der Tabelle mit PR-Nummer). Ihr Inhalt ist per Squash-Merge im Default-Branch;
   der Remote-Branch trägt nichts Einzigartiges. Löschen nur einzeln
   (`git push origin --delete <name>`), nie mit `--force`-Wildcards.
2. **Nicht anfassen:** die 18 Branches mit offenem Pull Request (Dependabot-Updates und
   Palette-/A11y-Arbeit) — das Löschen würde die offenen PRs abschießen.
3. **Manuell prüfen:** die Branches **ohne** PR (Abschnitte „ohne gemergten PR“). Sie sind
   auch nicht per `git --merged` enthalten. Vor dem Löschen je Branch klären, ob der Inhalt
   inzwischen in anderer Form im Default-Branch liegt (Cherry-Pick, anderer Branch-Name);
   sonst lieber den zugehörigen PR schließen statt den Branch zu löschen. Vorläufer dieser
   Liste: `docs/merged-branch-candidates.txt` (Verifikation 2026-08-28, 254 Kandidaten via
   Compare-API, ahead_by == 0).

## Liste aller 412 Remote-Branches

### arena/* — 63 Branches

| Branch                | Letzter Commit | Gemergter PR                               | Offener PR |
| --------------------- | -------------- | ------------------------------------------ | ---------- |
| `arena/01a01a03-camp` | 2026-09-06     | —                                          | —          |
| `arena/01a044e5-camp` | 2026-08-27     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `arena/01a04581-camp` | 2026-08-29     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `arena/01a049df-camp` | 2026-08-28     | —                                          | —          |
| `arena/01a04eeb-camp` | 2026-08-29     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `arena/01a04f65-camp` | 2026-08-30     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `arena/01a058e7-camp` | 2026-08-31     | —                                          | —          |
| `arena/01a05d52-camp` | 2026-09-02     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `arena/01a06672-camp` | 2026-09-03     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `arena/01a0697f-camp` | 2026-09-04     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `arena/01a06c27-camp` | 2026-09-04     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `arena/01a06ca9-camp` | 2026-09-05     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `arena/01a071b9-camp` | 2026-09-06     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `arena/01a0762c-camp` | 2026-09-06     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `arena/01a07705-camp` | 2026-09-06     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `arena/01a07773-camp` | 2026-09-06     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `arena/01a0779d-camp` | 2026-09-06     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `arena/01a077a9-camp` | 2026-09-06     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `arena/01a07818-camp` | 2026-09-06     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `arena/01a07841-camp` | 2026-09-06     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `arena/01a07888-camp` | 2026-09-07     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `arena/01a078c9-camp` | 2026-09-07     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `arena/01a07b83-camp` | 2026-09-07     | —                                          | —          |
| `arena/01a07b84-camp` | 2026-09-07     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `arena/01a07de7-camp` | 2026-09-08     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `arena/01a0818b-camp` | 2026-09-08     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `arena/01a08333-camp` | 2026-09-09     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `arena/01a085b6-camp` | 2026-09-09     | —                                          | —          |
| `arena/01a08662-camp` | 2026-09-09     | —                                          | —          |
| `arena/01a08778-camp` | 2026-09-09     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `arena/01a087f9-camp` | 2026-09-10     | —                                          | —          |
| `arena/01a08a86-camp` | 2026-09-10     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `arena/01a0d4c8-camp` | 2026-09-25     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `arena/01a0d77d-camp` | 2026-09-25     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `arena/01a0d85f-camp` | 2026-09-26     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `arena/01a0de40-camp` | 2026-09-26     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `arena/01a0df46-camp` | 2026-09-27     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `arena/01a0e3f0-camp` | 2026-09-28     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `arena/01a0e719-camp` | 2026-09-28     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `arena/01a0e82d-camp` | 2026-09-28     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `arena/01a0e857-camp` | 2026-09-28     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `arena/01a0ea26-camp` | 2026-09-29     | —                                          | —          |
| `arena/01a0ebee-camp` | 2026-09-29     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `arena/01a0ed37-camp` | 2026-09-29     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `arena/01a0eee0-camp` | 2026-09-30     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `arena/01a0f6f1-camp` | 2026-10-01     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `arena/01a0fc98-camp` | 2026-10-02     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `arena/01a0fde9-camp` | 2026-10-03     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `arena/01a1025f-camp` | 2026-10-03     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `arena/01a102b5-camp` | 2026-10-03     | [#8](https://github.com/CAZE7/Camp/pull/8) | **offen**  |
| `arena/01a1033c-camp` | 2026-10-04     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `arena/01a10598-camp` | 2026-10-04     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `arena/01a10674-camp` | 2026-10-05     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `arena/01a10bb0-camp` | 2026-10-05     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `arena/1d9b021c-camp` | 2026-10-11     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `arena/21dfb9cd-camp` | 2026-10-09     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `arena/26021eb0-camp` | 2026-10-07     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `arena/49927910-camp` | 2026-10-06     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `arena/7e4b0610-camp` | 2026-10-06     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `arena/89784919-camp` | 2026-10-12     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `arena/96ad98ec-camp` | 2026-10-08     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `arena/e4324340-camp` | 2026-10-07     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `arena/faa08f58-camp` | 2026-10-06     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |

### dependabot/* — 8 Branches

| Branch                                                        | Letzter Commit | Gemergter PR | Offener PR |
| ------------------------------------------------------------- | -------------- | ------------ | ---------- |
| `dependabot/npm_and_yarn/ai-7.0.127`                          | 2026-10-07     | —            | **offen**  |
| `dependabot/npm_and_yarn/ai-sdk/openai-4.0.83`                | 2026-10-05     | —            | **offen**  |
| `dependabot/npm_and_yarn/ai-sdk/react-4.0.130`                | 2026-10-05     | —            | **offen**  |
| `dependabot/npm_and_yarn/development-dependencies-60df673eae` | 2026-10-12     | —            | **offen**  |
| `dependabot/npm_and_yarn/dotenv-18.0.5`                       | 2026-10-05     | —            | **offen**  |
| `dependabot/npm_and_yarn/production-dependencies-34c1c9500f`  | 2026-10-12     | —            | **offen**  |
| `dependabot/npm_and_yarn/vitest-5.0.3`                        | 2026-10-07     | —            | **offen**  |
| `dependabot/npm_and_yarn/vitest/coverage-v8-5.0.3`            | 2026-10-05     | —            | **offen**  |

### add-* — 4 Branches

| Branch                                               | Letzter Commit | Gemergter PR                               | Offener PR |
| ---------------------------------------------------- | -------------- | ------------------------------------------ | ---------- |
| `add-planner-store-tests-9271494435179363526`        | 2026-05-05     | —                                          | —          |
| `add-root-layout-test-13143927043010963080`          | 2026-05-09     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `add-testing-missing-error-path-6533080287972750148` | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `add-tests-for-ui-constants-898144031750518832`      | 2026-05-14     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |

### Sonstige — 337 Branches

| Branch                                                               | Letzter Commit | Gemergter PR                               | Offener PR |
| -------------------------------------------------------------------- | -------------- | ------------------------------------------ | ---------- |
| `base/m11-1-pr343`                                                   | 2026-08-30     | —                                          | —          |
| `bolt-optimize-circuit-trace-3786242756744292988`                    | 2026-08-22     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `bolt-optimize-live-validation-2403136657534300761`                  | 2026-08-21     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `bolt/fix-o-n-m-bottlenecks-14815972458545232200`                    | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `chore/cleanup-bom-modal-5978049542799590954`                        | 2026-05-07     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `chore/refactor-validation-test-17900660213249803488`                | 2026-05-09     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `code-health-refactor-dachplanerflow-9771572561401333869`            | 2026-05-11     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `code-health/refactor-cable-edge-4203980580621615753`                | 2026-05-10     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `code-health/refactor-inspector-component-2819736826372923086`       | 2026-05-08     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `code-health/refactor-use-dashboard-metrics-16407987369841155702`    | 2026-05-09     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `code-health/useDashboardMetrics-test-5971854987023340467`           | 2026-05-10     | —                                          | —          |
| `electrical-safety-checks-1871921166021384345`                       | 2026-05-14     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `feat/advanced-planner-features-3745289302193991283`                 | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feat/aria-controls-sidebar-toggles-12782379175076462791`            | 2026-08-27     | —                                          | —          |
| `feat/auto-wire-magic-connect-1983451331740652957`                   | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feat/camp-seo-metadata-layer`                                       | 2026-10-02     | —                                          | —          |
| `feat/electrical-planner-self-sufficient-17912821893252002416`       | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feat/github-pages-deployment-15653285233353589965`                  | 2026-04-30     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feat/inverter-charger-conduit-logic-1891093435804003472`            | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feat/mobile-responsive-ui-18056052926881991591`                     | 2026-05-11     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `feat/planner-ui-upgrade-16016682632129073870`                       | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feat/realism-heizung-4142168372161178199`                           | 2026-05-07     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `feat/roof-planner-14943909581533653714`                             | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feat/test-inspector-15759865663145543614`                           | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/ai-schematic-check-1325437947922309587`                     | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/ausbau-fahrplan-11902082463994613043`                       | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/conduit-node-5947764985447418227`                           | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/elektro-ui-master-finish-7533227628471864588`               | 2026-05-18     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `feature/heating-calculator-templates-5137397589019634786`           | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/intelligent-cable-length-calculation-12593299404374827917`  | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/micro-frontends-11204503189146612826`                       | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/react-flow-cable-editor-7322653268250495059`                | 2026-10-12     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/react-flow-pro-features-14970947741442128992`               | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/reactflow-2d-planner-expansion-5677199859271367228`         | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/regenerate-lock`                                            | 2026-06-12     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `feature/ui-cleanup-and-optimizations-1211331261733285296`           | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `feature/water-and-heating-planner-11949882799861686694`             | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-ac-230v-cross-section-comment-15749551935971647503`             | 2026-05-26     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `fix-ac230v-cross-section-calculation-14037493313497265255`          | 2026-05-19     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `fix-bom-extraction-redos-11923512674901288438`                      | 2026-05-06     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `fix-bug-10-15-seasonal-yield-11133148220740047443`                  | 2026-05-19     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `fix-cable-calculation-and-labels-1026346213093057128`               | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-cable-edge-voltage-drop-reactivity-6776150784782665006`         | 2026-05-19     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `fix-calculate-max-fuse-fallback-16008532753759722924`               | 2026-05-21     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `fix-canvas-export-error-handling-15590256466609190490`              | 2026-05-28     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `fix-chat-function-length-1770374416629270027`                       | 2026-05-10     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `fix-chat-message-any-type-3690819110752257828`                      | 2026-04-30     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-dach-tool-types-6336160824289960183`                            | 2026-05-06     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `fix-db-fallback-url-1859505750177858470`                            | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-floating-metrics-card-interpolation-8981600271476835542`        | 2026-05-21     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `fix-fuse-map-vde-limits-14918403341888368567`                       | 2026-05-21     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `fix-github-pages-404-6053850129604598318`                           | 2026-05-01     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-github-pages-deployment-11600335591256260962`                   | 2026-04-30     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-hacky-test-data-11407669600129927518`                           | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-hardcoded-db-credentials-10187407617908474963`                  | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-hardcoded-dummy-key-6094236676030829565`                        | 2026-05-21     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `fix-heizlast-rechner-slider-und-logik-1933192459102010360`          | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-heizlast-thermodynamics-4094949329037513890`                    | 2026-05-07     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `fix-inspector-any-type-9695465752160752197`                         | 2026-05-06     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `fix-light-theme-18444508165480038033`                               | 2026-05-18     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `fix-lookup-thermal-cross-section-7179605456685000254`               | 2026-05-19     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `fix-mobile-planner-layout-2481050795858743266`                      | 2026-05-21     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `fix-numeric-inputs-inspector-3828031785854697300`                   | 2026-05-21     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `fix-openai-dummy-key-10974923872047799563`                          | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-planner-imports-5654274314752991420`                            | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-planner-ui-and-cad-mode-2370828335325282342`                    | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-rag-pipeline-fallback-5024228450781136814`                      | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-reactive-voltage-drop-calculation-2919255294881777334`          | 2026-05-28     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `fix-remove-seed-console-log-9533666145848486823`                    | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-resolve-rails-shared-busbar-13666008048879019351`               | 2026-08-22     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `fix-roof-solar-winter-factor-14893446481779618480`                  | 2026-05-19     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `fix-sidebar-collapse-12731647180197496435`                          | 2026-05-21     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `fix-sql-injection-chat-route-8602626428453562903`                   | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-ui-bugs-heating-roof-sidebar-cursor-16722239996050517219`       | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix-zustand-store-tests-14287692824343898148`                       | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix/api-chat-route-crash-vulnerability-1674118409854541937`         | 2026-05-26     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `fix/aria-expanded-navigation-sidebar-11208632647502708880`          | 2026-05-28     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `fix/busbar-node-tests-9528772418406689908`                          | 2026-05-26     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `fix/cable-edge-voltage-drop-reactivity-9427315494944321450`         | 2026-05-29     | —                                          | —          |
| `fix/calculate-max-fuse-range-error-816280756518337351`              | 2026-08-20     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `fix/code-health-logger-12836607214577880533`                        | 2026-05-06     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `fix/code-health-seed-logger-9774618459694155308`                    | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix/deploy-concurrency-default-branch`                              | 2026-08-31     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `fix/e2e-gate-deploy-gruen`                                          | 2026-10-02     | —                                          | —          |
| `fix/e2e-tests-speed-and-stability-14861311247674322983`             | 2026-08-22     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `fix/eslint-exhaustive-deps-usedashboardmetrics-8030815382019487718` | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix/floating-metrics-card-ux-15066758396729011094`                  | 2026-05-21     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `fix/flowcanvas-connection-typing-12920175086439040671`              | 2026-05-07     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `fix/inverter-handle-detection-13054885718043350499`                 | 2026-05-28     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `fix/inverter-node-any-type-3482496990309530538`                     | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix/inverter-target-handle-detection-5183084886259280166`           | 2026-05-19     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `fix/layout-breakpoint-issues-14174362853973145160`                  | 2026-06-11     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `fix/light-theme-enforcement-8819899040291836172`                    | 2026-06-11     | —                                          | —          |
| `fix/palette-ai-chat-loading-spinner-5889797138852401032`            | 2026-09-29     | —                                          | —          |
| `fix/planner-dashboard-tests-12043023518116414853`                   | 2026-05-07     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `fix/planner-dashboard-tests-code-health-7165388582539356659`        | 2026-05-10     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `fix/planner-inspector-collapse-16455687640196828054`                | 2026-05-21     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `fix/planner-jsx-syntax-error-8611497363654267615`                   | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix/pruefung-eine-wahrheit`                                         | 2026-10-09     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `fix/reactflow-resize-event-type-16323369921237714225`               | 2026-05-06     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `fix/refactor-sidebar-handlepointerdown-14612984059722908602`        | 2026-05-08     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `fix/refactor-sidebar-test-7727465482882239102`                      | 2026-05-10     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `fix/roof-planner-solar-winter-factor-5590806452044889525`           | 2026-05-28     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `fix/solar-priority-logic-16153154935077519308`                      | 2026-05-28     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `fix/solar-vmp-calculation-885364319124383189`                       | 2026-05-28     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `fix/solar-winter-reduction-factor-2135208535395732173`              | 2026-05-28     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `fix/sync-lock-file-17129107131646388249`                            | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `fix/syntax-error-planner-inner-16914047038154101523`                | 2026-05-16     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `fix/tailwind-css-vars-replacements-8057260475389072827`             | 2026-05-28     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `fix/use-dashboard-metrics-typing-14416488543508757319`              | 2026-05-07     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `fix/warning-center-aria-225887625469943154`                         | 2026-10-07     | —                                          | **offen**  |
| `improve-dach-validation-testing-5056158199365733438`                | 2026-05-07     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `jules-10726680106108628699-fa66b3d0`                                | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `jules-11806736503224994438-83cf1a91`                                | 2026-08-26     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `jules-14333197853378768567-c2083535`                                | 2026-05-15     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `jules-15699920531772980726-b0f351d0`                                | 2026-05-16     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `jules-16341829738616324980-13b7f75f`                                | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `jules-16507772005097733612-b76d4ecb`                                | 2026-05-19     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `jules-18146917280870371388-3d793c58`                                | 2026-05-21     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `jules-3532168245949762995-7d23ce23`                                 | 2026-06-21     | —                                          | —          |
| `jules-3742849019247676350-819476e6`                                 | 2026-05-28     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `jules-3988044561602030982-62402047`                                 | 2026-08-22     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `jules-6806843878559781693-53053472`                                 | 2026-05-09     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `jules-6871193450283700004-0924f64b`                                 | 2026-09-19     | —                                          | —          |
| `jules-8261101268068589691-7277f29b`                                 | 2026-05-07     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `jules-cable-edge-tests-9104967472426545228`                         | 2026-05-08     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `jules-code-health-node-props-7186312938005821003`                   | 2026-05-19     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `jules-code-health-refactor-dach-planer-746171897999489430`          | 2026-05-10     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `jules-code-health-refactor-heating-calculator-9144727583301167067`  | 2026-05-08     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `jules-fix-planner-store-filter-16940101664669656861`                | 2026-05-28     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `jules-fix-planner-toolbar-height-5436125022781538434`               | 2026-05-21     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `jules-onboarding-wizard-7833132867667849899`                        | 2026-05-15     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `jules-palette-a11y-expert-panel-7971738731954066508`                | 2026-05-16     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `jules-palette-chat-ux-5398200196764842426`                          | 2026-07-05     | —                                          | —          |
| `jules-palette-ux-fix-2390077671675269942`                           | 2026-08-24     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `jules-reactflow-ui-ux-refactor-12372619608061394649`                | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `jules-refactor-seed-script-14040651746998924890`                    | 2026-05-09     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `jules-remove-use-autowire-duplication-5470188506989745377`          | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `jules-ux-accessibility-id-htmlfor-15364196181111935922`             | 2026-05-10     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `main`                                                               | 2026-09-07     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `optimize-bom-queries-n1-1670750434056710117`                        | 2026-04-30     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `optimize-cable-edge-memo-482946947503572074`                        | 2026-05-06     | —                                          | —          |
| `optimize-ensurenode-lookup-7183276083095704825`                     | 2026-05-09     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `optimize-node-lookup-1780516625856843692`                           | 2026-05-28     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `optimize-onconnect-lookup-10973465982628465665`                     | 2026-05-06     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `optimize-set-creation-usePlannerStore-1716433143425270806`          | 2026-05-06     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `palette-a11y-validating-input-1515603610893364594`                  | 2026-05-31     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `palette-a11y-validatinginput-2812115711063439564`                   | 2026-06-08     | —                                          | —          |
| `palette-a11y-viewmode-toggles-10137686957930609554`                 | 2026-09-04     | —                                          | —          |
| `palette-aria-controls-5088413470254127083`                          | 2026-09-06     | —                                          | —          |
| `palette-aria-controls-9177856537280420258`                          | 2026-09-05     | —                                          | —          |
| `palette-aria-label-range-slider-6119829513949009349`                | 2026-05-28     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `palette-aria-labels-12284805342085436471`                           | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `palette-aria-pressed-14604095232027228629`                          | 2026-06-28     | —                                          | —          |
| `palette-aria-pressed-planner-13250246953764769491`                  | 2026-07-04     | —                                          | —          |
| `palette-aria-pressed-toggles-17887321770278014698`                  | 2026-08-22     | —                                          | —          |
| `palette-aria-pressed-toggles-3678840271267475699`                   | 2026-08-25     | —                                          | —          |
| `palette-chat-aria-expanded-11099137848239574534`                    | 2026-06-13     | —                                          | —          |
| `palette-chat-focus-styles-7116283704456546428`                      | 2026-05-20     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `palette-chat-loading-a11y-13051919599542561484`                     | 2026-06-20     | —                                          | —          |
| `palette-chat-loading-spinner-11106448832741345614`                  | 2026-10-11     | —                                          | **offen**  |
| `palette-chat-loading-spinner-1481898471813199208`                   | 2026-06-23     | —                                          | —          |
| `palette-chat-loading-spinner-15082369083251850267`                  | 2026-10-01     | —                                          | —          |
| `palette-chat-loading-spinner-17939319754475599781`                  | 2026-09-26     | —                                          | —          |
| `palette-chat-loading-spinner-4176762358026385700`                   | 2026-09-14     | —                                          | —          |
| `palette-chat-loading-spinner-541649450011588274`                    | 2026-09-15     | —                                          | —          |
| `palette-chat-loading-state-9184619503260441209`                     | 2026-09-17     | —                                          | —          |
| `palette-chat-spinner-10389112890774017`                             | 2026-07-07     | —                                          | —          |
| `palette-chat-spinner-13675358650284051794`                          | 2026-07-02     | —                                          | —          |
| `palette-chat-spinner-17357162995801993312`                          | 2026-09-18     | —                                          | —          |
| `palette-chat-spinner-a11y-7221263988973313390`                      | 2026-09-20     | —                                          | —          |
| `palette-chat-ux-18214857373242314609`                               | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `palette-chat-ux-a11y-8060554463656736772`                           | 2026-06-26     | —                                          | —          |
| `palette-chat-ux-fix-6002762339375983358`                            | 2026-10-06     | —                                          | **offen**  |
| `palette-dashboard-a11y-11274109084641374325`                        | 2026-10-08     | —                                          | **offen**  |
| `palette-dashboard-aria-pressed-4835876491731024797`                 | 2026-06-24     | —                                          | —          |
| `palette-fix-mismatched-ids-labels-9485635984513493594`              | 2026-05-14     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `palette-inspector-checkbox-a11y-116386881341363834`                 | 2026-06-11     | —                                          | —          |
| `palette-inspector-empty-state-15842899170178576959`                 | 2026-05-09     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `palette-loading-spinner-chat-12582727875630286004`                  | 2026-06-27     | —                                          | —          |
| `palette-loading-state-15219732485749484636`                         | 2026-09-07     | —                                          | —          |
| `palette-planner-dashboard-aria-group-12392191865205118097`          | 2026-08-28     | —                                          | —          |
| `palette-sidebar-aria-expanded-13154437066430153605`                 | 2026-05-28     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `palette-sidebar-search-ux-10137134082432095944`                     | 2026-05-06     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `palette-ux-chat-loading-icon-12810863496656239303`                  | 2026-09-24     | —                                          | —          |
| `palette-ux-chat-loading-spinner-16763748091899505670`               | 2026-07-08     | —                                          | —          |
| `palette-ux-chat-loading-state-4994074821385236077`                  | 2026-09-23     | —                                          | —          |
| `palette-ux-escape-key-894959987549185632`                           | 2026-05-12     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `palette-ux-sidebar-aria-4247100058155233274`                        | 2026-05-20     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `palette-validating-input-a11y-10141375764347924581`                 | 2026-06-03     | —                                          | —          |
| `palette-validating-input-a11y-7112790297984186173`                  | 2026-06-09     | —                                          | —          |
| `palette/a11y-validating-input-4428662090292315207`                  | 2026-05-30     | —                                          | —          |
| `palette/accessibility-category-section-17693214414336543155`        | 2026-10-05     | —                                          | **offen**  |
| `palette/add-aria-controls-sidebar-inspector-15283046730131570233`   | 2026-08-21     | —                                          | —          |
| `palette/aria-label-system-message-14264665702594812569`             | 2026-05-24     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `palette/aria-pressed-segmented-controls-13687068231524986228`       | 2026-06-12     | —                                          | —          |
| `palette/aria-pressed-toggles-11931820065207404942`                  | 2026-07-03     | —                                          | —          |
| `palette/aria-pressed-toggles-12328640777369617288`                  | 2026-06-15     | —                                          | —          |
| `palette/aria-pressed-toggles-15717977774402421188`                  | 2026-06-07     | —                                          | —          |
| `palette/aria-pressed-toggles-17546577704327541136`                  | 2026-07-01     | —                                          | —          |
| `palette/category-section-a11y-2741002856933318489`                  | 2026-10-09     | —                                          | **offen**  |
| `palette/category-section-aria-controls-8833320253578498862`         | 2026-10-10     | —                                          | **offen**  |
| `palette/chat-loading-spinner-12063468392216319546`                  | 2026-06-19     | —                                          | —          |
| `palette/chat-loading-spinner-7248518348936352450`                   | 2026-09-11     | —                                          | —          |
| `palette/chat-loading-spinner-9268479636285905862`                   | 2026-09-25     | —                                          | —          |
| `palette/chat-loading-ux-7949598687428236161`                        | 2026-10-04     | —                                          | **offen**  |
| `palette/chat-spinner-5288605442643827500`                           | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `palette/chat-spinner-ux-12253780136996947478`                       | 2026-06-30     | —                                          | —          |
| `palette/chat-submit-spinner-9327319820878013340`                    | 2026-09-13     | —                                          | —          |
| `palette/chat-ux-improvements-16896205144690193382`                  | 2026-09-27     | —                                          | —          |
| `palette/form-error-linking-12682454339990868298`                    | 2026-06-06     | —                                          | —          |
| `palette/inspector-a11y-11718187476941495615`                        | 2026-06-29     | —                                          | —          |
| `palette/metrics-card-a11y-1628177522448491735`                      | 2026-06-05     | —                                          | —          |
| `palette/segmented-controls-aria-pressed-14794707105436697226`       | 2026-06-22     | —                                          | —          |
| `palette/stepper-aria-labels-11238762301308986307`                   | 2026-10-03     | —                                          | **offen**  |
| `perf-async-file-io-11748692804391587266`                            | 2026-05-08     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `perf-conduit-node-optimization-15320253695210053810`                | 2026-05-06     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `perf-inverter-inspector-usememo-884244490880777565`                 | 2026-05-14     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `perf-optimize-bom-calculation-1040562548541081639`                  | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf-optimize-cable-edge-find-15143471102710988533`                 | 2026-05-29     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `perf-optimize-cables-lookup-15124293440184320017`                   | 2026-05-11     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `perf-optimize-dashboard-metrics-17974252647771383183`               | 2026-05-11     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `perf-optimize-dashboard-metrics-3195753248733846602`                | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf-optimize-node-lookup-9999040785826256728`                      | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf-optimize-roof-solar-watts-1505054691366617317`                 | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf-optimize-series-connection-5180738674211705051`                | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf-reactflow-edges-7380192489459251763`                           | 2026-05-07     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `perf-solar-calculations-map-optimization-10693043414149346667`      | 2026-05-08     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `perf-use-dashboard-metrics-7641206698455669813`                     | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf/adjacency-list-optimization-5142405558502986541`               | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf/autowire-layout-optimization-14981049130336224705`             | 2026-05-07     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `perf/bom-render-optimization-1999148292892403442`                   | 2026-05-06     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `perf/calculate-path-voltage-drop-2428928274817438797`               | 2026-05-29     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `perf/conduit-node-iteration-17847798192252282160`                   | 2026-05-09     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `perf/fix-cycle-detection-lookup-11013974926920884603`               | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf/inverter-node-set-lookup-14412837578917250501`                 | 2026-05-08     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `perf/layout-autowiring-dictionary-17716656983847240157`             | 2026-05-08     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `perf/optimize-cable-edge-selector-5631461478533860714`              | 2026-05-28     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `perf/optimize-conduit-node-filter-7034212756647838449`              | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf/optimize-exportbom-iteration-11349913425491116010`             | 2026-05-21     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `perf/optimize-node-edge-deletion-12439866353706370737`              | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf/optimize-set-creation-usePlannerStore-10168571240619673226`    | 2026-05-06     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `perf/optimize-solar-series-calculations-17887546496017391706`       | 2026-05-06     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `perf/optimize-solar-series-connection-4833328512052446591`          | 2026-05-06     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `perf/seed-bulk-insert-6869698131478428350`                          | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `perf/use-live-validation-10950749573913340694`                      | 2026-05-29     | —                                          | —          |
| `performance-bulk-insert-seed-7781720141920099640`                   | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `performance-optimizations-864573655324867341`                       | 2026-05-15     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `performance/bom-calculation-3959610370925719437`                    | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `qoder-deploy-hardening`                                             | 2026-09-26     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `refactor-autowiresystem-useplannerstore-7779861118764546930`        | 2026-05-11     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `refactor-dach-planner-12173603144345289332`                         | 2026-05-11     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `refactor-expert-panel-complexity-16833348902651996856`              | 2026-05-28     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `refactor-inspector-component-4409381623448194548`                   | 2026-05-10     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `refactor-logger-error-type-16213337767932234437`                    | 2026-05-07     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `refactor-planner-dashboard-5726055465229746517`                     | 2026-05-09     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `refactor-planner-store-2345011395412590546`                         | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `refactor-react-flow-state-and-qa-12775766450100100242`              | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `refactor/app-page-overly-long-function-9693409003268132506`         | 2026-05-09     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `refactor/cableedge-path-calculation-4349184135371068786`            | 2026-05-11     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `refactor/chat-api-route-2661386027952592284`                        | 2026-05-10     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `refactor/flowcanvas-overly-long-function-15566093579842863618`      | 2026-05-10     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `refactor/navigation-sidebar-link-17029882361740013377`              | 2026-05-28     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `refactor/planner-cleanup-14539523642382938203`                      | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `refactor/planner-node-data-type-safety-4792408062534349661`         | 2026-05-07     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `refactor/solar-series-calculation-3393351260092016332`              | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `refactor/test-describe-blocks-9370823680891638807`                  | 2026-05-09     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `refactor/useplannerstore-ensurenode-type-4527963479846554873`       | 2026-05-07     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `repair/main-pr388-stomp`                                            | 2026-09-07     | —                                          | —          |
| `security-fix-bom-validation-14758129978460894807`                   | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `security-fix-chat-validation-15355633296384567972`                  | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `security-fix-insecure-randomness-1333528527283348585`               | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `security-fix-messages-validation-11740450184407199735`              | 2026-04-30     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `security/fix-rag-pipeline-error-handling-1698523104815807157`       | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test-ausbau-fahrplan-11959938129838916271`                          | 2026-05-09     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `test-calculate-edge-path-15247101782647551565`                      | 2026-05-19     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `test-chargernode-5669404357412905718`                               | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test-conduit-node-7517979587092190878`                              | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test-dachplaner-page-8944185190488141739`                           | 2026-05-09     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `test-dashboard-panel-1293757823152557391`                           | 2026-05-08     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `test-edge-inspector-6123828155140969037`                            | 2026-05-19     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `test-expertpanel-coverage-13245138320331748424`                     | 2026-05-19     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `test-flow-canvas-coverage-14163346036414899278`                     | 2026-05-09     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `test-getlayoutedelements-13804370894776210087`                      | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test-ki-assistent-page-5533981645934463432`                         | 2026-05-09     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `test-planner-dashboard-7148974930382165016`                         | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test-planner-store-coverage-13464057476873058355`                   | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test-rag-pipeline-error-handling-4406325175893004063`               | 2026-05-14     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `test-shore-power-node-1376881048907202681`                          | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test-sidebar-component-15113355326721502985`                        | 2026-05-06     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `test-use-auto-wire-3608323180992812597`                             | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test-use-live-validation-12700513347960885231`                      | 2026-05-19     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `test/add-consumer-node-tests-7848558575243698747`                   | 2026-05-06     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `test/add-ground-node-tests-12861206422524424884`                    | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test/app-page-2590137333539648946`                                  | 2026-05-12     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `test/basenode-component-tests-12934424880582590528`                 | 2026-08-26     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `test/button-variants-coverage-18079807296915420067`                 | 2026-08-26     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `test/card-component-suite-16407486296237384064`                     | 2026-08-26     | [#5](https://github.com/CAZE7/Camp/pull/5) | —          |
| `test/card-component-suite-6669068987491076524`                      | 2026-08-26     | —                                          | —          |
| `test/consumer-230v-node-17422569214575188728`                       | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test/empty-state-component-tests-11012510175398408421`              | 2026-08-26     | —                                          | —          |
| `test/fix-chat-route-json-body-test-2392829174782363948`             | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `test/fuse-node-3306948054720449158`                                 | 2026-05-06     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `test/get-system-voltage-4796353536701740122`                        | 2026-05-26     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `test/holzausbau-guide-12443628172894085715`                         | 2026-05-09     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `test/improve-cn-utility-coverage-16801256337136629071`              | 2026-05-06     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `test/node-types-13032055602219782325`                               | 2026-05-09     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `test/roof-background-node-660895419099834655`                       | 2026-05-06     | [#3](https://github.com/CAZE7/Camp/pull/3) | —          |
| `test/roof-solar-node-7341382547026353140`                           | 2026-05-06     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `test/use-planner-drag-drop-2344462443533895381`                     | 2026-05-11     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `test/validating-number-input-14221347800921259217`                  | 2026-08-26     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `test/water-pipe-edge-11848482365995156105`                          | 2026-05-09     | [#2](https://github.com/CAZE7/Camp/pull/2) | —          |
| `test/waternode-coverage-8770783310326613430`                        | 2026-05-08     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `testing-db-utility-6447710695225144628`                             | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `testing-elektrik-planung-page-14111818847115163160`                 | 2026-05-09     | [#6](https://github.com/CAZE7/Camp/pull/6) | —          |
| `testing-improvement-11126344462842246917`                           | 2026-05-07     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `testing-improvement-chat-route-12862470155926490133`                | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `testing-improvement-dashboard-metrics-4636318993751170628`          | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `testing-improvement-planner-16334672159877553854`                   | 2026-05-09     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `testing-inverter-node-1871781682551002794`                          | 2026-05-06     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `testing-planner-inspector-14306257144319150754`                     | 2026-05-09     | [#0](https://github.com/CAZE7/Camp/pull/0) | —          |
| `testing-solar-calculations-8624787943100108143`                     | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `testing-use-dashboard-metrics-1589954207074974274`                  | 2026-05-05     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `testing-vehicle-templates-5105297291660379685`                      | 2026-05-04     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `testing/cn-utility-coverage-18414946706982595828`                   | 2026-05-06     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `tests-useSequentialTapConnect-16334302249923617387`                 | 2026-05-28     | [#8](https://github.com/CAZE7/Camp/pull/8) | —          |
| `ui-ux-refactoring-dropdown-sidebar-fix-9570709150639429339`         | 2026-05-03     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `ux-aria-pressed-planner-dashboard-7858244800231889307`              | 2026-06-18     | —                                          | —          |
| `ux-expert-panel-a11y-6733655112247876044`                           | 2026-05-14     | —                                          | —          |
| `ux-improvements-planner-layout-14049950530630152504`                | 2026-06-11     | [#9](https://github.com/CAZE7/Camp/pull/9) | —          |
| `ux-palette-validating-input-a11y-12031209362548156875`              | 2026-06-01     | —                                          | —          |
| `ux-planner-improvements-14621496172654305289`                       | 2026-05-02     | [#](https://github.com/CAZE7/Camp/pull/)   | —          |
| `ux/accessibility-focus-improvements-12194626890429477744`           | 2026-05-15     | [#7](https://github.com/CAZE7/Camp/pull/7) | —          |
| `ux/add-missing-id-sidebar-search-1203220026917179855`               | 2026-05-18     | [#4](https://github.com/CAZE7/Camp/pull/4) | —          |
| `ux/search-clear-aria-label-10309125487705969647`                    | 2026-05-17     | [#1](https://github.com/CAZE7/Camp/pull/1) | —          |
| `v0/caze7-0e39c710`                                                  | 2026-05-14     | —                                          | —          |
| `v0/caze7-e803222e`                                                  | 2026-05-14     | —                                          | —          |

## Branches ohne gemergten PR (Sonderfälle für die manuelle Prüfung)

| Branch                                                             | Letzter Commit | Gruppe   |
| ------------------------------------------------------------------ | -------------- | -------- |
| `arena/01a01a03-camp`                                              | 2026-09-06     | arena/*  |
| `arena/01a049df-camp`                                              | 2026-08-28     | arena/*  |
| `arena/01a058e7-camp`                                              | 2026-08-31     | arena/*  |
| `arena/01a07b83-camp`                                              | 2026-09-07     | arena/*  |
| `arena/01a085b6-camp`                                              | 2026-09-09     | arena/*  |
| `arena/01a08662-camp`                                              | 2026-09-09     | arena/*  |
| `arena/01a087f9-camp`                                              | 2026-09-10     | arena/*  |
| `arena/01a0ea26-camp`                                              | 2026-09-29     | arena/*  |
| `add-planner-store-tests-9271494435179363526`                      | 2026-05-05     | add-*    |
| `base/m11-1-pr343`                                                 | 2026-08-30     | Sonstige |
| `code-health/useDashboardMetrics-test-5971854987023340467`         | 2026-05-10     | Sonstige |
| `feat/aria-controls-sidebar-toggles-12782379175076462791`          | 2026-08-27     | Sonstige |
| `feat/camp-seo-metadata-layer`                                     | 2026-10-02     | Sonstige |
| `fix/cable-edge-voltage-drop-reactivity-9427315494944321450`       | 2026-05-29     | Sonstige |
| `fix/e2e-gate-deploy-gruen`                                        | 2026-10-02     | Sonstige |
| `fix/light-theme-enforcement-8819899040291836172`                  | 2026-06-11     | Sonstige |
| `fix/palette-ai-chat-loading-spinner-5889797138852401032`          | 2026-09-29     | Sonstige |
| `jules-3532168245949762995-7d23ce23`                               | 2026-06-21     | Sonstige |
| `jules-6871193450283700004-0924f64b`                               | 2026-09-19     | Sonstige |
| `jules-palette-chat-ux-5398200196764842426`                        | 2026-07-05     | Sonstige |
| `optimize-cable-edge-memo-482946947503572074`                      | 2026-05-06     | Sonstige |
| `palette-a11y-validatinginput-2812115711063439564`                 | 2026-06-08     | Sonstige |
| `palette-a11y-viewmode-toggles-10137686957930609554`               | 2026-09-04     | Sonstige |
| `palette-aria-controls-5088413470254127083`                        | 2026-09-06     | Sonstige |
| `palette-aria-controls-9177856537280420258`                        | 2026-09-05     | Sonstige |
| `palette-aria-pressed-14604095232027228629`                        | 2026-06-28     | Sonstige |
| `palette-aria-pressed-planner-13250246953764769491`                | 2026-07-04     | Sonstige |
| `palette-aria-pressed-toggles-17887321770278014698`                | 2026-08-22     | Sonstige |
| `palette-aria-pressed-toggles-3678840271267475699`                 | 2026-08-25     | Sonstige |
| `palette-chat-aria-expanded-11099137848239574534`                  | 2026-06-13     | Sonstige |
| `palette-chat-loading-a11y-13051919599542561484`                   | 2026-06-20     | Sonstige |
| `palette-chat-loading-spinner-1481898471813199208`                 | 2026-06-23     | Sonstige |
| `palette-chat-loading-spinner-15082369083251850267`                | 2026-10-01     | Sonstige |
| `palette-chat-loading-spinner-17939319754475599781`                | 2026-09-26     | Sonstige |
| `palette-chat-loading-spinner-4176762358026385700`                 | 2026-09-14     | Sonstige |
| `palette-chat-loading-spinner-541649450011588274`                  | 2026-09-15     | Sonstige |
| `palette-chat-loading-state-9184619503260441209`                   | 2026-09-17     | Sonstige |
| `palette-chat-spinner-10389112890774017`                           | 2026-07-07     | Sonstige |
| `palette-chat-spinner-13675358650284051794`                        | 2026-07-02     | Sonstige |
| `palette-chat-spinner-17357162995801993312`                        | 2026-09-18     | Sonstige |
| `palette-chat-spinner-a11y-7221263988973313390`                    | 2026-09-20     | Sonstige |
| `palette-chat-ux-a11y-8060554463656736772`                         | 2026-06-26     | Sonstige |
| `palette-dashboard-aria-pressed-4835876491731024797`               | 2026-06-24     | Sonstige |
| `palette-inspector-checkbox-a11y-116386881341363834`               | 2026-06-11     | Sonstige |
| `palette-loading-spinner-chat-12582727875630286004`                | 2026-06-27     | Sonstige |
| `palette-loading-state-15219732485749484636`                       | 2026-09-07     | Sonstige |
| `palette-planner-dashboard-aria-group-12392191865205118097`        | 2026-08-28     | Sonstige |
| `palette-ux-chat-loading-icon-12810863496656239303`                | 2026-09-24     | Sonstige |
| `palette-ux-chat-loading-spinner-16763748091899505670`             | 2026-07-08     | Sonstige |
| `palette-ux-chat-loading-state-4994074821385236077`                | 2026-09-23     | Sonstige |
| `palette-validating-input-a11y-10141375764347924581`               | 2026-06-03     | Sonstige |
| `palette-validating-input-a11y-7112790297984186173`                | 2026-06-09     | Sonstige |
| `palette/a11y-validating-input-4428662090292315207`                | 2026-05-30     | Sonstige |
| `palette/add-aria-controls-sidebar-inspector-15283046730131570233` | 2026-08-21     | Sonstige |
| `palette/aria-pressed-segmented-controls-13687068231524986228`     | 2026-06-12     | Sonstige |
| `palette/aria-pressed-toggles-11931820065207404942`                | 2026-07-03     | Sonstige |
| `palette/aria-pressed-toggles-12328640777369617288`                | 2026-06-15     | Sonstige |
| `palette/aria-pressed-toggles-15717977774402421188`                | 2026-06-07     | Sonstige |
| `palette/aria-pressed-toggles-17546577704327541136`                | 2026-07-01     | Sonstige |
| `palette/chat-loading-spinner-12063468392216319546`                | 2026-06-19     | Sonstige |
| `palette/chat-loading-spinner-7248518348936352450`                 | 2026-09-11     | Sonstige |
| `palette/chat-loading-spinner-9268479636285905862`                 | 2026-09-25     | Sonstige |
| `palette/chat-spinner-ux-12253780136996947478`                     | 2026-06-30     | Sonstige |
| `palette/chat-submit-spinner-9327319820878013340`                  | 2026-09-13     | Sonstige |
| `palette/chat-ux-improvements-16896205144690193382`                | 2026-09-27     | Sonstige |
| `palette/form-error-linking-12682454339990868298`                  | 2026-06-06     | Sonstige |
| `palette/inspector-a11y-11718187476941495615`                      | 2026-06-29     | Sonstige |
| `palette/metrics-card-a11y-1628177522448491735`                    | 2026-06-05     | Sonstige |
| `palette/segmented-controls-aria-pressed-14794707105436697226`     | 2026-06-22     | Sonstige |
| `perf/use-live-validation-10950749573913340694`                    | 2026-05-29     | Sonstige |
| `repair/main-pr388-stomp`                                          | 2026-09-07     | Sonstige |
| `test/card-component-suite-6669068987491076524`                    | 2026-08-26     | Sonstige |
| `test/empty-state-component-tests-11012510175398408421`            | 2026-08-26     | Sonstige |
| `ux-aria-pressed-planner-dashboard-7858244800231889307`            | 2026-06-18     | Sonstige |
| `ux-expert-panel-a11y-6733655112247876044`                         | 2026-05-14     | Sonstige |
| `ux-palette-validating-input-a11y-12031209362548156875`            | 2026-06-01     | Sonstige |
| `v0/caze7-0e39c710`                                                | 2026-05-14     | Sonstige |
| `v0/caze7-e803222e`                                                | 2026-05-14     | Sonstige |
