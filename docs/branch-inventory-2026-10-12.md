# Remote-Branch-Inventar (Stand 2026-10-12)

Erzeugt aus `git fetch origin` + `git for-each-ref` (Datum des letzten Commits je Branch)
sowie der PR-Liste über die GitHub-API (`gh pr list --state merged|open`, abgeglichen über
den Head-Branch-Namen; **alle** gemergten PRs je Head-Branch werden gelistet, ein Branch
kann mehrere haben). „via PR gemergt“ heißt: Es existiert mindestens ein **gemergter Pull
Request mit genau diesem Head-Branch** — das Repo merged per Squash, deshalb meldet
`git branch -r --merged` fast nichts. Erhoben am **2026-10-12**; Default-Branch zum
Erhebungszeitpunkt: `feature/react-flow-cable-editor-7322653268250495059` (am 2026-10-12 erfolgreich
auf `main` umgestellt). **Gemäß Betreiber-Vorgabe (BRANCHES_LOSCHEN=NEIN) wurde kein Remote-Branch gelöscht.**

## Zusammenfassung

| Gruppe       | Branches | via PR gemergt | offener PR | ohne PR (Sonderfall) | gefahrlos löschbar* |
| ------------ | -------- | -------------- | ---------- | -------------------- | ------------------- |
| arena/*      | 63       | 55             | 1          | 8                    | 54                  |
| dependabot/* | 8        | 0              | 8          | 0                    | 0                   |
| add-*        | 4        | 3              | 0          | 1                    | 3                   |
| Sonstige     | 337      | 259            | 9          | 69                   | 258                 |
| **Gesamt**   | **412**  | **317**        | **18**     | **78**               | **315**             |

\* „gefahrlos löschbar“ = gemergter PR vorhanden **und** kein offener PR **und nicht der
aktive Default-Branch** (`feature/react-flow-cable-editor-7322653268250495059` hat historische gemergte PRs mit diesem
Head-Namen, ist als aktiver Branch aber selbstverständlich kein Löschkandidat — deshalb
weicht diese Spalte von „via PR gemergt“ um genau diesen einen Branch ab).

## Vorschlag zum Aufräumen (nur Vorschlag — hier wurde nichts gelöscht)

1. **Gefahrlos löschbar:** die 315 Branches mit gemergtem PR und ohne offenen PR
   (in der Tabelle mit PR-Nummer). Ihr Inhalt ist per Squash-Merge im Default-Branch;
   der Remote-Branch trägt nichts Einzigartiges. Löschen nur einzeln
   (`git push origin --delete <name>`), nie mit `--force`-Wildcards.
2. **Nicht anfassen:** die 18 Branches mit offenem Pull Request (Dependabot-Updates und
   Palette-/A11y-Arbeit) — das Löschen würde die offenen PRs abschießen. Auch der
   aktive Default-Branch bleibt.
3. **Manuell prüfen:** die Branches **ohne** PR (Abschnitt „ohne gemergten PR“). Sie sind
   auch nicht per `git --merged` enthalten. Vor dem Löschen je Branch klären, ob der Inhalt
   inzwischen in anderer Form im Default-Branch liegt (Cherry-Pick, anderer Branch-Name);
   sonst lieber den zugehörigen PR schließen statt den Branch zu löschen. Vorläufer dieser
   Liste: `docs/merged-branch-candidates.txt` (Verifikation 2026-08-28, 254 Kandidaten via
   Compare-API, ahead_by == 0).

## Liste aller 412 Remote-Branches

### arena/* — 63 Branches

| Branch                | Letzter Commit | Gemergte PRs                                                                                                                                                                                                                                       | Offener PR |
| --------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `arena/01a01a03-camp` | 2026-09-06     | —                                                                                                                                                                                                                                                  | —          |
| `arena/01a044e5-camp` | 2026-08-27     | [#346](https://github.com/CAZE7/Camp/pull/346) · [#347](https://github.com/CAZE7/Camp/pull/347)                                                                                                                                                    | —          |
| `arena/01a04581-camp` | 2026-08-29     | [#348](https://github.com/CAZE7/Camp/pull/348) · [#364](https://github.com/CAZE7/Camp/pull/364)                                                                                                                                                    | —          |
| `arena/01a049df-camp` | 2026-08-28     | —                                                                                                                                                                                                                                                  | —          |
| `arena/01a04eeb-camp` | 2026-08-29     | [#365](https://github.com/CAZE7/Camp/pull/365)                                                                                                                                                                                                     | —          |
| `arena/01a04f65-camp` | 2026-08-30     | [#366](https://github.com/CAZE7/Camp/pull/366)                                                                                                                                                                                                     | —          |
| `arena/01a058e7-camp` | 2026-08-31     | —                                                                                                                                                                                                                                                  | —          |
| `arena/01a05d52-camp` | 2026-09-02     | [#377](https://github.com/CAZE7/Camp/pull/377)                                                                                                                                                                                                     | —          |
| `arena/01a06672-camp` | 2026-09-03     | [#379](https://github.com/CAZE7/Camp/pull/379)                                                                                                                                                                                                     | —          |
| `arena/01a0697f-camp` | 2026-09-04     | [#382](https://github.com/CAZE7/Camp/pull/382)                                                                                                                                                                                                     | —          |
| `arena/01a06c27-camp` | 2026-09-04     | [#383](https://github.com/CAZE7/Camp/pull/383)                                                                                                                                                                                                     | —          |
| `arena/01a06ca9-camp` | 2026-09-05     | [#385](https://github.com/CAZE7/Camp/pull/385) · [#386](https://github.com/CAZE7/Camp/pull/386)                                                                                                                                                    | —          |
| `arena/01a071b9-camp` | 2026-09-06     | [#388](https://github.com/CAZE7/Camp/pull/388)                                                                                                                                                                                                     | —          |
| `arena/01a0762c-camp` | 2026-09-06     | [#404](https://github.com/CAZE7/Camp/pull/404)                                                                                                                                                                                                     | —          |
| `arena/01a07705-camp` | 2026-09-06     | [#406](https://github.com/CAZE7/Camp/pull/406)                                                                                                                                                                                                     | —          |
| `arena/01a07773-camp` | 2026-09-06     | [#407](https://github.com/CAZE7/Camp/pull/407)                                                                                                                                                                                                     | —          |
| `arena/01a0779d-camp` | 2026-09-06     | [#408](https://github.com/CAZE7/Camp/pull/408)                                                                                                                                                                                                     | —          |
| `arena/01a077a9-camp` | 2026-09-06     | [#409](https://github.com/CAZE7/Camp/pull/409)                                                                                                                                                                                                     | —          |
| `arena/01a07818-camp` | 2026-09-06     | [#411](https://github.com/CAZE7/Camp/pull/411)                                                                                                                                                                                                     | —          |
| `arena/01a07841-camp` | 2026-09-06     | [#416](https://github.com/CAZE7/Camp/pull/416)                                                                                                                                                                                                     | —          |
| `arena/01a07888-camp` | 2026-09-07     | [#417](https://github.com/CAZE7/Camp/pull/417)                                                                                                                                                                                                     | —          |
| `arena/01a078c9-camp` | 2026-09-07     | [#418](https://github.com/CAZE7/Camp/pull/418)                                                                                                                                                                                                     | —          |
| `arena/01a07b83-camp` | 2026-09-07     | —                                                                                                                                                                                                                                                  | —          |
| `arena/01a07b84-camp` | 2026-09-07     | [#421](https://github.com/CAZE7/Camp/pull/421)                                                                                                                                                                                                     | —          |
| `arena/01a07de7-camp` | 2026-09-08     | [#424](https://github.com/CAZE7/Camp/pull/424)                                                                                                                                                                                                     | —          |
| `arena/01a0818b-camp` | 2026-09-08     | [#425](https://github.com/CAZE7/Camp/pull/425)                                                                                                                                                                                                     | —          |
| `arena/01a08333-camp` | 2026-09-09     | [#426](https://github.com/CAZE7/Camp/pull/426)                                                                                                                                                                                                     | —          |
| `arena/01a085b6-camp` | 2026-09-09     | —                                                                                                                                                                                                                                                  | —          |
| `arena/01a08662-camp` | 2026-09-09     | —                                                                                                                                                                                                                                                  | —          |
| `arena/01a08778-camp` | 2026-09-09     | [#428](https://github.com/CAZE7/Camp/pull/428)                                                                                                                                                                                                     | —          |
| `arena/01a087f9-camp` | 2026-09-10     | —                                                                                                                                                                                                                                                  | —          |
| `arena/01a08a86-camp` | 2026-09-10     | [#429](https://github.com/CAZE7/Camp/pull/429)                                                                                                                                                                                                     | —          |
| `arena/01a0d4c8-camp` | 2026-09-25     | [#449](https://github.com/CAZE7/Camp/pull/449)                                                                                                                                                                                                     | —          |
| `arena/01a0d77d-camp` | 2026-09-25     | [#451](https://github.com/CAZE7/Camp/pull/451)                                                                                                                                                                                                     | —          |
| `arena/01a0d85f-camp` | 2026-09-26     | [#453](https://github.com/CAZE7/Camp/pull/453)                                                                                                                                                                                                     | —          |
| `arena/01a0de40-camp` | 2026-09-26     | [#455](https://github.com/CAZE7/Camp/pull/455)                                                                                                                                                                                                     | —          |
| `arena/01a0df46-camp` | 2026-09-27     | [#457](https://github.com/CAZE7/Camp/pull/457)                                                                                                                                                                                                     | —          |
| `arena/01a0e3f0-camp` | 2026-09-28     | [#459](https://github.com/CAZE7/Camp/pull/459)                                                                                                                                                                                                     | —          |
| `arena/01a0e719-camp` | 2026-09-28     | [#468](https://github.com/CAZE7/Camp/pull/468)                                                                                                                                                                                                     | —          |
| `arena/01a0e82d-camp` | 2026-09-28     | [#469](https://github.com/CAZE7/Camp/pull/469)                                                                                                                                                                                                     | —          |
| `arena/01a0e857-camp` | 2026-09-28     | [#470](https://github.com/CAZE7/Camp/pull/470)                                                                                                                                                                                                     | —          |
| `arena/01a0ea26-camp` | 2026-09-29     | —                                                                                                                                                                                                                                                  | —          |
| `arena/01a0ebee-camp` | 2026-09-29     | [#472](https://github.com/CAZE7/Camp/pull/472)                                                                                                                                                                                                     | —          |
| `arena/01a0ed37-camp` | 2026-09-29     | [#473](https://github.com/CAZE7/Camp/pull/473)                                                                                                                                                                                                     | —          |
| `arena/01a0eee0-camp` | 2026-09-30     | [#478](https://github.com/CAZE7/Camp/pull/478)                                                                                                                                                                                                     | —          |
| `arena/01a0f6f1-camp` | 2026-10-01     | [#479](https://github.com/CAZE7/Camp/pull/479)                                                                                                                                                                                                     | —          |
| `arena/01a0fc98-camp` | 2026-10-02     | [#481](https://github.com/CAZE7/Camp/pull/481)                                                                                                                                                                                                     | —          |
| `arena/01a0fde9-camp` | 2026-10-03     | [#482](https://github.com/CAZE7/Camp/pull/482)                                                                                                                                                                                                     | —          |
| `arena/01a1025f-camp` | 2026-10-03     | [#483](https://github.com/CAZE7/Camp/pull/483) · [#484](https://github.com/CAZE7/Camp/pull/484) · [#485](https://github.com/CAZE7/Camp/pull/485) · [#486](https://github.com/CAZE7/Camp/pull/486) · [#487](https://github.com/CAZE7/Camp/pull/487) | —          |
| `arena/01a102b5-camp` | 2026-10-03     | [#488](https://github.com/CAZE7/Camp/pull/488)                                                                                                                                                                                                     | **offen**  |
| `arena/01a1033c-camp` | 2026-10-04     | [#491](https://github.com/CAZE7/Camp/pull/491)                                                                                                                                                                                                     | —          |
| `arena/01a10598-camp` | 2026-10-04     | [#492](https://github.com/CAZE7/Camp/pull/492)                                                                                                                                                                                                     | —          |
| `arena/01a10674-camp` | 2026-10-05     | [#502](https://github.com/CAZE7/Camp/pull/502)                                                                                                                                                                                                     | —          |
| `arena/01a10bb0-camp` | 2026-10-05     | [#503](https://github.com/CAZE7/Camp/pull/503)                                                                                                                                                                                                     | —          |
| `arena/1d9b021c-camp` | 2026-10-11     | [#519](https://github.com/CAZE7/Camp/pull/519)                                                                                                                                                                                                     | —          |
| `arena/21dfb9cd-camp` | 2026-10-09     | [#515](https://github.com/CAZE7/Camp/pull/515)                                                                                                                                                                                                     | —          |
| `arena/26021eb0-camp` | 2026-10-07     | [#510](https://github.com/CAZE7/Camp/pull/510)                                                                                                                                                                                                     | —          |
| `arena/49927910-camp` | 2026-10-06     | [#505](https://github.com/CAZE7/Camp/pull/505)                                                                                                                                                                                                     | —          |
| `arena/7e4b0610-camp` | 2026-10-06     | [#507](https://github.com/CAZE7/Camp/pull/507)                                                                                                                                                                                                     | —          |
| `arena/89784919-camp` | 2026-10-12     | [#521](https://github.com/CAZE7/Camp/pull/521)                                                                                                                                                                                                     | —          |
| `arena/96ad98ec-camp` | 2026-10-08     | [#513](https://github.com/CAZE7/Camp/pull/513)                                                                                                                                                                                                     | —          |
| `arena/e4324340-camp` | 2026-10-07     | [#509](https://github.com/CAZE7/Camp/pull/509)                                                                                                                                                                                                     | —          |
| `arena/faa08f58-camp` | 2026-10-06     | [#506](https://github.com/CAZE7/Camp/pull/506)                                                                                                                                                                                                     | —          |

### dependabot/* — 8 Branches

| Branch                                                        | Letzter Commit | Gemergte PRs | Offener PR |
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

| Branch                                               | Letzter Commit | Gemergte PRs                                   | Offener PR |
| ---------------------------------------------------- | -------------- | ---------------------------------------------- | ---------- |
| `add-planner-store-tests-9271494435179363526`        | 2026-05-05     | —                                              | —          |
| `add-root-layout-test-13143927043010963080`          | 2026-05-09     | [#159](https://github.com/CAZE7/Camp/pull/159) | —          |
| `add-testing-missing-error-path-6533080287972750148` | 2026-05-02     | [#10](https://github.com/CAZE7/Camp/pull/10)   | —          |
| `add-tests-for-ui-constants-898144031750518832`      | 2026-05-14     | [#191](https://github.com/CAZE7/Camp/pull/191) | —          |

### Sonstige — 337 Branches

| Branch                                                               | Letzter Commit | Gemergte PRs                                                                                    | Offener PR |
| -------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| `base/m11-1-pr343`                                                   | 2026-08-30     | —                                                                                               | —          |
| `bolt-optimize-circuit-trace-3786242756744292988`                    | 2026-08-22     | [#321](https://github.com/CAZE7/Camp/pull/321)                                                  | —          |
| `bolt-optimize-live-validation-2403136657534300761`                  | 2026-08-21     | [#318](https://github.com/CAZE7/Camp/pull/318)                                                  | —          |
| `bolt/fix-o-n-m-bottlenecks-14815972458545232200`                    | 2026-05-04     | [#48](https://github.com/CAZE7/Camp/pull/48)                                                    | —          |
| `chore/cleanup-bom-modal-5978049542799590954`                        | 2026-05-07     | [#123](https://github.com/CAZE7/Camp/pull/123)                                                  | —          |
| `chore/refactor-validation-test-17900660213249803488`                | 2026-05-09     | [#147](https://github.com/CAZE7/Camp/pull/147)                                                  | —          |
| `code-health-refactor-dachplanerflow-9771572561401333869`            | 2026-05-11     | [#183](https://github.com/CAZE7/Camp/pull/183)                                                  | —          |
| `code-health/refactor-cable-edge-4203980580621615753`                | 2026-05-10     | [#176](https://github.com/CAZE7/Camp/pull/176)                                                  | —          |
| `code-health/refactor-inspector-component-2819736826372923086`       | 2026-05-08     | [#142](https://github.com/CAZE7/Camp/pull/142)                                                  | —          |
| `code-health/refactor-use-dashboard-metrics-16407987369841155702`    | 2026-05-09     | [#154](https://github.com/CAZE7/Camp/pull/154)                                                  | —          |
| `code-health/useDashboardMetrics-test-5971854987023340467`           | 2026-05-10     | —                                                                                               | —          |
| `electrical-safety-checks-1871921166021384345`                       | 2026-05-14     | [#193](https://github.com/CAZE7/Camp/pull/193)                                                  | —          |
| `feat/advanced-planner-features-3745289302193991283`                 | 2026-05-02     | [#14](https://github.com/CAZE7/Camp/pull/14)                                                    | —          |
| `feat/aria-controls-sidebar-toggles-12782379175076462791`            | 2026-08-27     | —                                                                                               | —          |
| `feat/auto-wire-magic-connect-1983451331740652957`                   | 2026-05-02     | [#23](https://github.com/CAZE7/Camp/pull/23)                                                    | —          |
| `feat/camp-seo-metadata-layer`                                       | 2026-10-02     | —                                                                                               | —          |
| `feat/electrical-planner-self-sufficient-17912821893252002416`       | 2026-05-02     | [#12](https://github.com/CAZE7/Camp/pull/12)                                                    | —          |
| `feat/github-pages-deployment-15653285233353589965`                  | 2026-04-30     | [#1](https://github.com/CAZE7/Camp/pull/1)                                                      | —          |
| `feat/inverter-charger-conduit-logic-1891093435804003472`            | 2026-05-04     | [#56](https://github.com/CAZE7/Camp/pull/56)                                                    | —          |
| `feat/mobile-responsive-ui-18056052926881991591`                     | 2026-05-11     | [#185](https://github.com/CAZE7/Camp/pull/185)                                                  | —          |
| `feat/planner-ui-upgrade-16016682632129073870`                       | 2026-05-02     | [#19](https://github.com/CAZE7/Camp/pull/19)                                                    | —          |
| `feat/realism-heizung-4142168372161178199`                           | 2026-05-07     | [#133](https://github.com/CAZE7/Camp/pull/133)                                                  | —          |
| `feat/roof-planner-14943909581533653714`                             | 2026-05-02     | [#20](https://github.com/CAZE7/Camp/pull/20)                                                    | —          |
| `feat/test-inspector-15759865663145543614`                           | 2026-05-02     | [#11](https://github.com/CAZE7/Camp/pull/11)                                                    | —          |
| `feature/ai-schematic-check-1325437947922309587`                     | 2026-05-02     | [#22](https://github.com/CAZE7/Camp/pull/22)                                                    | —          |
| `feature/ausbau-fahrplan-11902082463994613043`                       | 2026-05-02     | [#16](https://github.com/CAZE7/Camp/pull/16)                                                    | —          |
| `feature/conduit-node-5947764985447418227`                           | 2026-05-03     | [#30](https://github.com/CAZE7/Camp/pull/30)                                                    | —          |
| `feature/elektro-ui-master-finish-7533227628471864588`               | 2026-05-18     | [#202](https://github.com/CAZE7/Camp/pull/202)                                                  | —          |
| `feature/heating-calculator-templates-5137397589019634786`           | 2026-05-03     | [#29](https://github.com/CAZE7/Camp/pull/29)                                                    | —          |
| `feature/intelligent-cable-length-calculation-12593299404374827917`  | 2026-05-02     | [#21](https://github.com/CAZE7/Camp/pull/21)                                                    | —          |
| `feature/micro-frontends-11204503189146612826`                       | 2026-05-03     | [#34](https://github.com/CAZE7/Camp/pull/34)                                                    | —          |
| `feature/react-flow-cable-editor-7322653268250495059`                | 2026-10-12     | [#7](https://github.com/CAZE7/Camp/pull/7) · [#297](https://github.com/CAZE7/Camp/pull/297)     | —          |
| `feature/react-flow-pro-features-14970947741442128992`               | 2026-05-02     | [#15](https://github.com/CAZE7/Camp/pull/15)                                                    | —          |
| `feature/reactflow-2d-planner-expansion-5677199859271367228`         | 2026-05-02     | [#13](https://github.com/CAZE7/Camp/pull/13)                                                    | —          |
| `feature/regenerate-lock`                                            | 2026-06-12     | [#273](https://github.com/CAZE7/Camp/pull/273)                                                  | —          |
| `feature/ui-cleanup-and-optimizations-1211331261733285296`           | 2026-05-04     | [#49](https://github.com/CAZE7/Camp/pull/49)                                                    | —          |
| `feature/water-and-heating-planner-11949882799861686694`             | 2026-05-02     | [#25](https://github.com/CAZE7/Camp/pull/25)                                                    | —          |
| `fix-ac-230v-cross-section-comment-15749551935971647503`             | 2026-05-26     | [#235](https://github.com/CAZE7/Camp/pull/235)                                                  | —          |
| `fix-ac230v-cross-section-calculation-14037493313497265255`          | 2026-05-19     | [#205](https://github.com/CAZE7/Camp/pull/205)                                                  | —          |
| `fix-bom-extraction-redos-11923512674901288438`                      | 2026-05-06     | [#110](https://github.com/CAZE7/Camp/pull/110)                                                  | —          |
| `fix-bug-10-15-seasonal-yield-11133148220740047443`                  | 2026-05-19     | [#212](https://github.com/CAZE7/Camp/pull/212)                                                  | —          |
| `fix-cable-calculation-and-labels-1026346213093057128`               | 2026-05-04     | [#61](https://github.com/CAZE7/Camp/pull/61)                                                    | —          |
| `fix-cable-edge-voltage-drop-reactivity-6776150784782665006`         | 2026-05-19     | [#217](https://github.com/CAZE7/Camp/pull/217)                                                  | —          |
| `fix-calculate-max-fuse-fallback-16008532753759722924`               | 2026-05-21     | [#220](https://github.com/CAZE7/Camp/pull/220)                                                  | —          |
| `fix-canvas-export-error-handling-15590256466609190490`              | 2026-05-28     | [#250](https://github.com/CAZE7/Camp/pull/250)                                                  | —          |
| `fix-chat-function-length-1770374416629270027`                       | 2026-05-10     | [#177](https://github.com/CAZE7/Camp/pull/177)                                                  | —          |
| `fix-chat-message-any-type-3690819110752257828`                      | 2026-04-30     | [#2](https://github.com/CAZE7/Camp/pull/2)                                                      | —          |
| `fix-dach-tool-types-6336160824289960183`                            | 2026-05-06     | [#109](https://github.com/CAZE7/Camp/pull/109)                                                  | —          |
| `fix-db-fallback-url-1859505750177858470`                            | 2026-05-04     | [#45](https://github.com/CAZE7/Camp/pull/45)                                                    | —          |
| `fix-floating-metrics-card-interpolation-8981600271476835542`        | 2026-05-21     | [#228](https://github.com/CAZE7/Camp/pull/228)                                                  | —          |
| `fix-fuse-map-vde-limits-14918403341888368567`                       | 2026-05-21     | [#221](https://github.com/CAZE7/Camp/pull/221)                                                  | —          |
| `fix-github-pages-404-6053850129604598318`                           | 2026-05-01     | [#6](https://github.com/CAZE7/Camp/pull/6) · [#8](https://github.com/CAZE7/Camp/pull/8)         | —          |
| `fix-github-pages-deployment-11600335591256260962`                   | 2026-04-30     | [#5](https://github.com/CAZE7/Camp/pull/5)                                                      | —          |
| `fix-hacky-test-data-11407669600129927518`                           | 2026-05-05     | [#73](https://github.com/CAZE7/Camp/pull/73)                                                    | —          |
| `fix-hardcoded-db-credentials-10187407617908474963`                  | 2026-05-02     | [#9](https://github.com/CAZE7/Camp/pull/9)                                                      | —          |
| `fix-hardcoded-dummy-key-6094236676030829565`                        | 2026-05-21     | [#223](https://github.com/CAZE7/Camp/pull/223)                                                  | —          |
| `fix-heizlast-rechner-slider-und-logik-1933192459102010360`          | 2026-05-04     | [#60](https://github.com/CAZE7/Camp/pull/60)                                                    | —          |
| `fix-heizlast-thermodynamics-4094949329037513890`                    | 2026-05-07     | [#129](https://github.com/CAZE7/Camp/pull/129)                                                  | —          |
| `fix-inspector-any-type-9695465752160752197`                         | 2026-05-06     | [#114](https://github.com/CAZE7/Camp/pull/114)                                                  | —          |
| `fix-light-theme-18444508165480038033`                               | 2026-05-18     | [#203](https://github.com/CAZE7/Camp/pull/203)                                                  | —          |
| `fix-lookup-thermal-cross-section-7179605456685000254`               | 2026-05-19     | [#213](https://github.com/CAZE7/Camp/pull/213)                                                  | —          |
| `fix-mobile-planner-layout-2481050795858743266`                      | 2026-05-21     | [#231](https://github.com/CAZE7/Camp/pull/231)                                                  | —          |
| `fix-numeric-inputs-inspector-3828031785854697300`                   | 2026-05-21     | [#229](https://github.com/CAZE7/Camp/pull/229)                                                  | —          |
| `fix-openai-dummy-key-10974923872047799563`                          | 2026-05-04     | [#50](https://github.com/CAZE7/Camp/pull/50)                                                    | —          |
| `fix-planner-imports-5654274314752991420`                            | 2026-05-02     | [#26](https://github.com/CAZE7/Camp/pull/26)                                                    | —          |
| `fix-planner-ui-and-cad-mode-2370828335325282342`                    | 2026-05-03     | [#32](https://github.com/CAZE7/Camp/pull/32)                                                    | —          |
| `fix-rag-pipeline-fallback-5024228450781136814`                      | 2026-05-05     | [#80](https://github.com/CAZE7/Camp/pull/80)                                                    | —          |
| `fix-reactive-voltage-drop-calculation-2919255294881777334`          | 2026-05-28     | [#252](https://github.com/CAZE7/Camp/pull/252)                                                  | —          |
| `fix-remove-seed-console-log-9533666145848486823`                    | 2026-05-05     | [#66](https://github.com/CAZE7/Camp/pull/66)                                                    | —          |
| `fix-resolve-rails-shared-busbar-13666008048879019351`               | 2026-08-22     | [#326](https://github.com/CAZE7/Camp/pull/326)                                                  | —          |
| `fix-roof-solar-winter-factor-14893446481779618480`                  | 2026-05-19     | [#207](https://github.com/CAZE7/Camp/pull/207)                                                  | —          |
| `fix-sidebar-collapse-12731647180197496435`                          | 2026-05-21     | [#225](https://github.com/CAZE7/Camp/pull/225)                                                  | —          |
| `fix-sql-injection-chat-route-8602626428453562903`                   | 2026-05-03     | [#40](https://github.com/CAZE7/Camp/pull/40)                                                    | —          |
| `fix-ui-bugs-heating-roof-sidebar-cursor-16722239996050517219`       | 2026-05-03     | [#35](https://github.com/CAZE7/Camp/pull/35)                                                    | —          |
| `fix-zustand-store-tests-14287692824343898148`                       | 2026-05-04     | [#43](https://github.com/CAZE7/Camp/pull/43)                                                    | —          |
| `fix/api-chat-route-crash-vulnerability-1674118409854541937`         | 2026-05-26     | [#234](https://github.com/CAZE7/Camp/pull/234)                                                  | —          |
| `fix/aria-expanded-navigation-sidebar-11208632647502708880`          | 2026-05-28     | [#254](https://github.com/CAZE7/Camp/pull/254)                                                  | —          |
| `fix/busbar-node-tests-9528772418406689908`                          | 2026-05-26     | [#236](https://github.com/CAZE7/Camp/pull/236)                                                  | —          |
| `fix/cable-edge-voltage-drop-reactivity-9427315494944321450`         | 2026-05-29     | —                                                                                               | —          |
| `fix/calculate-max-fuse-range-error-816280756518337351`              | 2026-08-20     | [#313](https://github.com/CAZE7/Camp/pull/313)                                                  | —          |
| `fix/code-health-logger-12836607214577880533`                        | 2026-05-06     | [#106](https://github.com/CAZE7/Camp/pull/106)                                                  | —          |
| `fix/code-health-seed-logger-9774618459694155308`                    | 2026-05-05     | [#71](https://github.com/CAZE7/Camp/pull/71)                                                    | —          |
| `fix/deploy-concurrency-default-branch`                              | 2026-08-31     | [#371](https://github.com/CAZE7/Camp/pull/371)                                                  | —          |
| `fix/e2e-gate-deploy-gruen`                                          | 2026-10-02     | —                                                                                               | —          |
| `fix/e2e-tests-speed-and-stability-14861311247674322983`             | 2026-08-22     | [#329](https://github.com/CAZE7/Camp/pull/329)                                                  | —          |
| `fix/eslint-exhaustive-deps-usedashboardmetrics-8030815382019487718` | 2026-05-05     | [#83](https://github.com/CAZE7/Camp/pull/83)                                                    | —          |
| `fix/floating-metrics-card-ux-15066758396729011094`                  | 2026-05-21     | [#227](https://github.com/CAZE7/Camp/pull/227)                                                  | —          |
| `fix/flowcanvas-connection-typing-12920175086439040671`              | 2026-05-07     | [#121](https://github.com/CAZE7/Camp/pull/121)                                                  | —          |
| `fix/inverter-handle-detection-13054885718043350499`                 | 2026-05-28     | [#242](https://github.com/CAZE7/Camp/pull/242)                                                  | —          |
| `fix/inverter-node-any-type-3482496990309530538`                     | 2026-05-05     | [#69](https://github.com/CAZE7/Camp/pull/69)                                                    | —          |
| `fix/inverter-target-handle-detection-5183084886259280166`           | 2026-05-19     | [#206](https://github.com/CAZE7/Camp/pull/206)                                                  | —          |
| `fix/layout-breakpoint-issues-14174362853973145160`                  | 2026-06-11     | [#268](https://github.com/CAZE7/Camp/pull/268)                                                  | —          |
| `fix/light-theme-enforcement-8819899040291836172`                    | 2026-06-11     | —                                                                                               | —          |
| `fix/palette-ai-chat-loading-spinner-5889797138852401032`            | 2026-09-29     | —                                                                                               | —          |
| `fix/planner-dashboard-tests-12043023518116414853`                   | 2026-05-07     | [#126](https://github.com/CAZE7/Camp/pull/126)                                                  | —          |
| `fix/planner-dashboard-tests-code-health-7165388582539356659`        | 2026-05-10     | [#175](https://github.com/CAZE7/Camp/pull/175)                                                  | —          |
| `fix/planner-inspector-collapse-16455687640196828054`                | 2026-05-21     | [#224](https://github.com/CAZE7/Camp/pull/224)                                                  | —          |
| `fix/planner-jsx-syntax-error-8611497363654267615`                   | 2026-05-04     | [#58](https://github.com/CAZE7/Camp/pull/58)                                                    | —          |
| `fix/pruefung-eine-wahrheit`                                         | 2026-10-09     | [#516](https://github.com/CAZE7/Camp/pull/516)                                                  | —          |
| `fix/reactflow-resize-event-type-16323369921237714225`               | 2026-05-06     | [#118](https://github.com/CAZE7/Camp/pull/118)                                                  | —          |
| `fix/refactor-sidebar-handlepointerdown-14612984059722908602`        | 2026-05-08     | [#143](https://github.com/CAZE7/Camp/pull/143)                                                  | —          |
| `fix/refactor-sidebar-test-7727465482882239102`                      | 2026-05-10     | [#169](https://github.com/CAZE7/Camp/pull/169)                                                  | —          |
| `fix/roof-planner-solar-winter-factor-5590806452044889525`           | 2026-05-28     | [#243](https://github.com/CAZE7/Camp/pull/243)                                                  | —          |
| `fix/solar-priority-logic-16153154935077519308`                      | 2026-05-28     | [#239](https://github.com/CAZE7/Camp/pull/239)                                                  | —          |
| `fix/solar-vmp-calculation-885364319124383189`                       | 2026-05-28     | [#241](https://github.com/CAZE7/Camp/pull/241)                                                  | —          |
| `fix/solar-winter-reduction-factor-2135208535395732173`              | 2026-05-28     | [#240](https://github.com/CAZE7/Camp/pull/240)                                                  | —          |
| `fix/sync-lock-file-17129107131646388249`                            | 2026-05-03     | [#31](https://github.com/CAZE7/Camp/pull/31)                                                    | —          |
| `fix/syntax-error-planner-inner-16914047038154101523`                | 2026-05-16     | [#199](https://github.com/CAZE7/Camp/pull/199)                                                  | —          |
| `fix/tailwind-css-vars-replacements-8057260475389072827`             | 2026-05-28     | [#251](https://github.com/CAZE7/Camp/pull/251)                                                  | —          |
| `fix/use-dashboard-metrics-typing-14416488543508757319`              | 2026-05-07     | [#128](https://github.com/CAZE7/Camp/pull/128)                                                  | —          |
| `fix/warning-center-aria-225887625469943154`                         | 2026-10-07     | —                                                                                               | **offen**  |
| `improve-dach-validation-testing-5056158199365733438`                | 2026-05-07     | [#122](https://github.com/CAZE7/Camp/pull/122)                                                  | —          |
| `jules-10726680106108628699-fa66b3d0`                                | 2026-05-03     | [#36](https://github.com/CAZE7/Camp/pull/36)                                                    | —          |
| `jules-11806736503224994438-83cf1a91`                                | 2026-08-26     | [#336](https://github.com/CAZE7/Camp/pull/336)                                                  | —          |
| `jules-14333197853378768567-c2083535`                                | 2026-05-15     | [#195](https://github.com/CAZE7/Camp/pull/195)                                                  | —          |
| `jules-15699920531772980726-b0f351d0`                                | 2026-05-16     | [#198](https://github.com/CAZE7/Camp/pull/198)                                                  | —          |
| `jules-16341829738616324980-13b7f75f`                                | 2026-05-04     | [#55](https://github.com/CAZE7/Camp/pull/55)                                                    | —          |
| `jules-16507772005097733612-b76d4ecb`                                | 2026-05-19     | [#215](https://github.com/CAZE7/Camp/pull/215)                                                  | —          |
| `jules-18146917280870371388-3d793c58`                                | 2026-05-21     | [#230](https://github.com/CAZE7/Camp/pull/230)                                                  | —          |
| `jules-3532168245949762995-7d23ce23`                                 | 2026-06-21     | —                                                                                               | —          |
| `jules-3742849019247676350-819476e6`                                 | 2026-05-28     | [#253](https://github.com/CAZE7/Camp/pull/253)                                                  | —          |
| `jules-3988044561602030982-62402047`                                 | 2026-08-22     | [#322](https://github.com/CAZE7/Camp/pull/322)                                                  | —          |
| `jules-6806843878559781693-53053472`                                 | 2026-05-09     | [#149](https://github.com/CAZE7/Camp/pull/149)                                                  | —          |
| `jules-6871193450283700004-0924f64b`                                 | 2026-09-19     | —                                                                                               | —          |
| `jules-8261101268068589691-7277f29b`                                 | 2026-05-07     | [#134](https://github.com/CAZE7/Camp/pull/134)                                                  | —          |
| `jules-cable-edge-tests-9104967472426545228`                         | 2026-05-08     | [#144](https://github.com/CAZE7/Camp/pull/144)                                                  | —          |
| `jules-code-health-node-props-7186312938005821003`                   | 2026-05-19     | [#216](https://github.com/CAZE7/Camp/pull/216)                                                  | —          |
| `jules-code-health-refactor-dach-planer-746171897999489430`          | 2026-05-10     | [#173](https://github.com/CAZE7/Camp/pull/173)                                                  | —          |
| `jules-code-health-refactor-heating-calculator-9144727583301167067`  | 2026-05-08     | [#145](https://github.com/CAZE7/Camp/pull/145)                                                  | —          |
| `jules-fix-planner-store-filter-16940101664669656861`                | 2026-05-28     | [#246](https://github.com/CAZE7/Camp/pull/246)                                                  | —          |
| `jules-fix-planner-toolbar-height-5436125022781538434`               | 2026-05-21     | [#226](https://github.com/CAZE7/Camp/pull/226)                                                  | —          |
| `jules-onboarding-wizard-7833132867667849899`                        | 2026-05-15     | [#196](https://github.com/CAZE7/Camp/pull/196)                                                  | —          |
| `jules-palette-a11y-expert-panel-7971738731954066508`                | 2026-05-16     | [#200](https://github.com/CAZE7/Camp/pull/200)                                                  | —          |
| `jules-palette-chat-ux-5398200196764842426`                          | 2026-07-05     | —                                                                                               | —          |
| `jules-palette-ux-fix-2390077671675269942`                           | 2026-08-24     | [#331](https://github.com/CAZE7/Camp/pull/331)                                                  | —          |
| `jules-reactflow-ui-ux-refactor-12372619608061394649`                | 2026-05-03     | [#27](https://github.com/CAZE7/Camp/pull/27)                                                    | —          |
| `jules-refactor-seed-script-14040651746998924890`                    | 2026-05-09     | [#166](https://github.com/CAZE7/Camp/pull/166)                                                  | —          |
| `jules-remove-use-autowire-duplication-5470188506989745377`          | 2026-05-06     | [#88](https://github.com/CAZE7/Camp/pull/88)                                                    | —          |
| `jules-ux-accessibility-id-htmlfor-15364196181111935922`             | 2026-05-10     | [#174](https://github.com/CAZE7/Camp/pull/174)                                                  | —          |
| `main`                                                               | 2026-09-07     | [#272](https://github.com/CAZE7/Camp/pull/272) · [#420](https://github.com/CAZE7/Camp/pull/420) | —          |
| `optimize-bom-queries-n1-1670750434056710117`                        | 2026-04-30     | [#3](https://github.com/CAZE7/Camp/pull/3)                                                      | —          |
| `optimize-cable-edge-memo-482946947503572074`                        | 2026-05-06     | —                                                                                               | —          |
| `optimize-ensurenode-lookup-7183276083095704825`                     | 2026-05-09     | [#155](https://github.com/CAZE7/Camp/pull/155)                                                  | —          |
| `optimize-node-lookup-1780516625856843692`                           | 2026-05-28     | [#247](https://github.com/CAZE7/Camp/pull/247)                                                  | —          |
| `optimize-onconnect-lookup-10973465982628465665`                     | 2026-05-06     | [#107](https://github.com/CAZE7/Camp/pull/107)                                                  | —          |
| `optimize-set-creation-usePlannerStore-1716433143425270806`          | 2026-05-06     | [#115](https://github.com/CAZE7/Camp/pull/115)                                                  | —          |
| `palette-a11y-validating-input-1515603610893364594`                  | 2026-05-31     | [#260](https://github.com/CAZE7/Camp/pull/260)                                                  | —          |
| `palette-a11y-validatinginput-2812115711063439564`                   | 2026-06-08     | —                                                                                               | —          |
| `palette-a11y-viewmode-toggles-10137686957930609554`                 | 2026-09-04     | —                                                                                               | —          |
| `palette-aria-controls-5088413470254127083`                          | 2026-09-06     | —                                                                                               | —          |
| `palette-aria-controls-9177856537280420258`                          | 2026-09-05     | —                                                                                               | —          |
| `palette-aria-label-range-slider-6119829513949009349`                | 2026-05-28     | [#237](https://github.com/CAZE7/Camp/pull/237)                                                  | —          |
| `palette-aria-labels-12284805342085436471`                           | 2026-05-04     | [#41](https://github.com/CAZE7/Camp/pull/41)                                                    | —          |
| `palette-aria-pressed-14604095232027228629`                          | 2026-06-28     | —                                                                                               | —          |
| `palette-aria-pressed-planner-13250246953764769491`                  | 2026-07-04     | —                                                                                               | —          |
| `palette-aria-pressed-toggles-17887321770278014698`                  | 2026-08-22     | —                                                                                               | —          |
| `palette-aria-pressed-toggles-3678840271267475699`                   | 2026-08-25     | —                                                                                               | —          |
| `palette-chat-aria-expanded-11099137848239574534`                    | 2026-06-13     | —                                                                                               | —          |
| `palette-chat-focus-styles-7116283704456546428`                      | 2026-05-20     | [#219](https://github.com/CAZE7/Camp/pull/219)                                                  | —          |
| `palette-chat-loading-a11y-13051919599542561484`                     | 2026-06-20     | —                                                                                               | —          |
| `palette-chat-loading-spinner-11106448832741345614`                  | 2026-10-11     | —                                                                                               | **offen**  |
| `palette-chat-loading-spinner-1481898471813199208`                   | 2026-06-23     | —                                                                                               | —          |
| `palette-chat-loading-spinner-15082369083251850267`                  | 2026-10-01     | —                                                                                               | —          |
| `palette-chat-loading-spinner-17939319754475599781`                  | 2026-09-26     | —                                                                                               | —          |
| `palette-chat-loading-spinner-4176762358026385700`                   | 2026-09-14     | —                                                                                               | —          |
| `palette-chat-loading-spinner-541649450011588274`                    | 2026-09-15     | —                                                                                               | —          |
| `palette-chat-loading-state-9184619503260441209`                     | 2026-09-17     | —                                                                                               | —          |
| `palette-chat-spinner-10389112890774017`                             | 2026-07-07     | —                                                                                               | —          |
| `palette-chat-spinner-13675358650284051794`                          | 2026-07-02     | —                                                                                               | —          |
| `palette-chat-spinner-17357162995801993312`                          | 2026-09-18     | —                                                                                               | —          |
| `palette-chat-spinner-a11y-7221263988973313390`                      | 2026-09-20     | —                                                                                               | —          |
| `palette-chat-ux-18214857373242314609`                               | 2026-05-03     | [#28](https://github.com/CAZE7/Camp/pull/28)                                                    | —          |
| `palette-chat-ux-a11y-8060554463656736772`                           | 2026-06-26     | —                                                                                               | —          |
| `palette-chat-ux-fix-6002762339375983358`                            | 2026-10-06     | —                                                                                               | **offen**  |
| `palette-dashboard-a11y-11274109084641374325`                        | 2026-10-08     | —                                                                                               | **offen**  |
| `palette-dashboard-aria-pressed-4835876491731024797`                 | 2026-06-24     | —                                                                                               | —          |
| `palette-fix-mismatched-ids-labels-9485635984513493594`              | 2026-05-14     | [#189](https://github.com/CAZE7/Camp/pull/189)                                                  | —          |
| `palette-inspector-checkbox-a11y-116386881341363834`                 | 2026-06-11     | —                                                                                               | —          |
| `palette-inspector-empty-state-15842899170178576959`                 | 2026-05-09     | [#167](https://github.com/CAZE7/Camp/pull/167)                                                  | —          |
| `palette-loading-spinner-chat-12582727875630286004`                  | 2026-06-27     | —                                                                                               | —          |
| `palette-loading-state-15219732485749484636`                         | 2026-09-07     | —                                                                                               | —          |
| `palette-planner-dashboard-aria-group-12392191865205118097`          | 2026-08-28     | —                                                                                               | —          |
| `palette-sidebar-aria-expanded-13154437066430153605`                 | 2026-05-28     | [#238](https://github.com/CAZE7/Camp/pull/238)                                                  | —          |
| `palette-sidebar-search-ux-10137134082432095944`                     | 2026-05-06     | [#112](https://github.com/CAZE7/Camp/pull/112)                                                  | —          |
| `palette-ux-chat-loading-icon-12810863496656239303`                  | 2026-09-24     | —                                                                                               | —          |
| `palette-ux-chat-loading-spinner-16763748091899505670`               | 2026-07-08     | —                                                                                               | —          |
| `palette-ux-chat-loading-state-4994074821385236077`                  | 2026-09-23     | —                                                                                               | —          |
| `palette-ux-escape-key-894959987549185632`                           | 2026-05-12     | [#186](https://github.com/CAZE7/Camp/pull/186)                                                  | —          |
| `palette-ux-sidebar-aria-4247100058155233274`                        | 2026-05-20     | [#218](https://github.com/CAZE7/Camp/pull/218)                                                  | —          |
| `palette-validating-input-a11y-10141375764347924581`                 | 2026-06-03     | —                                                                                               | —          |
| `palette-validating-input-a11y-7112790297984186173`                  | 2026-06-09     | —                                                                                               | —          |
| `palette/a11y-validating-input-4428662090292315207`                  | 2026-05-30     | —                                                                                               | —          |
| `palette/accessibility-category-section-17693214414336543155`        | 2026-10-05     | —                                                                                               | **offen**  |
| `palette/add-aria-controls-sidebar-inspector-15283046730131570233`   | 2026-08-21     | —                                                                                               | —          |
| `palette/aria-label-system-message-14264665702594812569`             | 2026-05-24     | [#232](https://github.com/CAZE7/Camp/pull/232)                                                  | —          |
| `palette/aria-pressed-segmented-controls-13687068231524986228`       | 2026-06-12     | —                                                                                               | —          |
| `palette/aria-pressed-toggles-11931820065207404942`                  | 2026-07-03     | —                                                                                               | —          |
| `palette/aria-pressed-toggles-12328640777369617288`                  | 2026-06-15     | —                                                                                               | —          |
| `palette/aria-pressed-toggles-15717977774402421188`                  | 2026-06-07     | —                                                                                               | —          |
| `palette/aria-pressed-toggles-17546577704327541136`                  | 2026-07-01     | —                                                                                               | —          |
| `palette/category-section-a11y-2741002856933318489`                  | 2026-10-09     | —                                                                                               | **offen**  |
| `palette/category-section-aria-controls-8833320253578498862`         | 2026-10-10     | —                                                                                               | **offen**  |
| `palette/chat-loading-spinner-12063468392216319546`                  | 2026-06-19     | —                                                                                               | —          |
| `palette/chat-loading-spinner-7248518348936352450`                   | 2026-09-11     | —                                                                                               | —          |
| `palette/chat-loading-spinner-9268479636285905862`                   | 2026-09-25     | —                                                                                               | —          |
| `palette/chat-loading-ux-7949598687428236161`                        | 2026-10-04     | —                                                                                               | **offen**  |
| `palette/chat-spinner-5288605442643827500`                           | 2026-05-04     | [#62](https://github.com/CAZE7/Camp/pull/62)                                                    | —          |
| `palette/chat-spinner-ux-12253780136996947478`                       | 2026-06-30     | —                                                                                               | —          |
| `palette/chat-submit-spinner-9327319820878013340`                    | 2026-09-13     | —                                                                                               | —          |
| `palette/chat-ux-improvements-16896205144690193382`                  | 2026-09-27     | —                                                                                               | —          |
| `palette/form-error-linking-12682454339990868298`                    | 2026-06-06     | —                                                                                               | —          |
| `palette/inspector-a11y-11718187476941495615`                        | 2026-06-29     | —                                                                                               | —          |
| `palette/metrics-card-a11y-1628177522448491735`                      | 2026-06-05     | —                                                                                               | —          |
| `palette/segmented-controls-aria-pressed-14794707105436697226`       | 2026-06-22     | —                                                                                               | —          |
| `palette/stepper-aria-labels-11238762301308986307`                   | 2026-10-03     | —                                                                                               | **offen**  |
| `perf-async-file-io-11748692804391587266`                            | 2026-05-08     | [#137](https://github.com/CAZE7/Camp/pull/137)                                                  | —          |
| `perf-conduit-node-optimization-15320253695210053810`                | 2026-05-06     | [#111](https://github.com/CAZE7/Camp/pull/111)                                                  | —          |
| `perf-inverter-inspector-usememo-884244490880777565`                 | 2026-05-14     | [#192](https://github.com/CAZE7/Camp/pull/192)                                                  | —          |
| `perf-optimize-bom-calculation-1040562548541081639`                  | 2026-05-05     | [#67](https://github.com/CAZE7/Camp/pull/67)                                                    | —          |
| `perf-optimize-cable-edge-find-15143471102710988533`                 | 2026-05-29     | [#257](https://github.com/CAZE7/Camp/pull/257)                                                  | —          |
| `perf-optimize-cables-lookup-15124293440184320017`                   | 2026-05-11     | [#179](https://github.com/CAZE7/Camp/pull/179)                                                  | —          |
| `perf-optimize-dashboard-metrics-17974252647771383183`               | 2026-05-11     | [#180](https://github.com/CAZE7/Camp/pull/180)                                                  | —          |
| `perf-optimize-dashboard-metrics-3195753248733846602`                | 2026-05-04     | [#51](https://github.com/CAZE7/Camp/pull/51)                                                    | —          |
| `perf-optimize-node-lookup-9999040785826256728`                      | 2026-05-06     | [#87](https://github.com/CAZE7/Camp/pull/87)                                                    | —          |
| `perf-optimize-roof-solar-watts-1505054691366617317`                 | 2026-05-05     | [#72](https://github.com/CAZE7/Camp/pull/72)                                                    | —          |
| `perf-optimize-series-connection-5180738674211705051`                | 2026-05-05     | [#68](https://github.com/CAZE7/Camp/pull/68)                                                    | —          |
| `perf-reactflow-edges-7380192489459251763`                           | 2026-05-07     | [#124](https://github.com/CAZE7/Camp/pull/124)                                                  | —          |
| `perf-solar-calculations-map-optimization-10693043414149346667`      | 2026-05-08     | [#138](https://github.com/CAZE7/Camp/pull/138)                                                  | —          |
| `perf-use-dashboard-metrics-7641206698455669813`                     | 2026-05-05     | [#63](https://github.com/CAZE7/Camp/pull/63)                                                    | —          |
| `perf/adjacency-list-optimization-5142405558502986541`               | 2026-05-05     | [#75](https://github.com/CAZE7/Camp/pull/75)                                                    | —          |
| `perf/autowire-layout-optimization-14981049130336224705`             | 2026-05-07     | [#125](https://github.com/CAZE7/Camp/pull/125)                                                  | —          |
| `perf/bom-render-optimization-1999148292892403442`                   | 2026-05-06     | [#116](https://github.com/CAZE7/Camp/pull/116)                                                  | —          |
| `perf/calculate-path-voltage-drop-2428928274817438797`               | 2026-05-29     | [#256](https://github.com/CAZE7/Camp/pull/256)                                                  | —          |
| `perf/conduit-node-iteration-17847798192252282160`                   | 2026-05-09     | [#152](https://github.com/CAZE7/Camp/pull/152)                                                  | —          |
| `perf/fix-cycle-detection-lookup-11013974926920884603`               | 2026-05-06     | [#89](https://github.com/CAZE7/Camp/pull/89)                                                    | —          |
| `perf/inverter-node-set-lookup-14412837578917250501`                 | 2026-05-08     | [#135](https://github.com/CAZE7/Camp/pull/135)                                                  | —          |
| `perf/layout-autowiring-dictionary-17716656983847240157`             | 2026-05-08     | [#139](https://github.com/CAZE7/Camp/pull/139)                                                  | —          |
| `perf/optimize-cable-edge-selector-5631461478533860714`              | 2026-05-28     | [#244](https://github.com/CAZE7/Camp/pull/244)                                                  | —          |
| `perf/optimize-conduit-node-filter-7034212756647838449`              | 2026-05-03     | [#37](https://github.com/CAZE7/Camp/pull/37)                                                    | —          |
| `perf/optimize-exportbom-iteration-11349913425491116010`             | 2026-05-21     | [#222](https://github.com/CAZE7/Camp/pull/222)                                                  | —          |
| `perf/optimize-node-edge-deletion-12439866353706370737`              | 2026-05-04     | [#42](https://github.com/CAZE7/Camp/pull/42)                                                    | —          |
| `perf/optimize-set-creation-usePlannerStore-10168571240619673226`    | 2026-05-06     | [#117](https://github.com/CAZE7/Camp/pull/117)                                                  | —          |
| `perf/optimize-solar-series-calculations-17887546496017391706`       | 2026-05-06     | [#120](https://github.com/CAZE7/Camp/pull/120)                                                  | —          |
| `perf/optimize-solar-series-connection-4833328512052446591`          | 2026-05-06     | [#113](https://github.com/CAZE7/Camp/pull/113)                                                  | —          |
| `perf/seed-bulk-insert-6869698131478428350`                          | 2026-05-04     | [#46](https://github.com/CAZE7/Camp/pull/46)                                                    | —          |
| `perf/use-live-validation-10950749573913340694`                      | 2026-05-29     | —                                                                                               | —          |
| `performance-bulk-insert-seed-7781720141920099640`                   | 2026-05-03     | [#39](https://github.com/CAZE7/Camp/pull/39)                                                    | —          |
| `performance-optimizations-864573655324867341`                       | 2026-05-15     | [#194](https://github.com/CAZE7/Camp/pull/194)                                                  | —          |
| `performance/bom-calculation-3959610370925719437`                    | 2026-05-04     | [#53](https://github.com/CAZE7/Camp/pull/53)                                                    | —          |
| `qoder-deploy-hardening`                                             | 2026-09-26     | [#454](https://github.com/CAZE7/Camp/pull/454)                                                  | —          |
| `refactor-autowiresystem-useplannerstore-7779861118764546930`        | 2026-05-11     | [#178](https://github.com/CAZE7/Camp/pull/178)                                                  | —          |
| `refactor-dach-planner-12173603144345289332`                         | 2026-05-11     | [#181](https://github.com/CAZE7/Camp/pull/181)                                                  | —          |
| `refactor-expert-panel-complexity-16833348902651996856`              | 2026-05-28     | [#249](https://github.com/CAZE7/Camp/pull/249)                                                  | —          |
| `refactor-inspector-component-4409381623448194548`                   | 2026-05-10     | [#168](https://github.com/CAZE7/Camp/pull/168)                                                  | —          |
| `refactor-logger-error-type-16213337767932234437`                    | 2026-05-07     | [#131](https://github.com/CAZE7/Camp/pull/131)                                                  | —          |
| `refactor-planner-dashboard-5726055465229746517`                     | 2026-05-09     | [#165](https://github.com/CAZE7/Camp/pull/165)                                                  | —          |
| `refactor-planner-store-2345011395412590546`                         | 2026-05-04     | [#59](https://github.com/CAZE7/Camp/pull/59)                                                    | —          |
| `refactor-react-flow-state-and-qa-12775766450100100242`              | 2026-05-02     | [#24](https://github.com/CAZE7/Camp/pull/24)                                                    | —          |
| `refactor/app-page-overly-long-function-9693409003268132506`         | 2026-05-09     | [#153](https://github.com/CAZE7/Camp/pull/153)                                                  | —          |
| `refactor/cableedge-path-calculation-4349184135371068786`            | 2026-05-11     | [#182](https://github.com/CAZE7/Camp/pull/182)                                                  | —          |
| `refactor/chat-api-route-2661386027952592284`                        | 2026-05-10     | [#171](https://github.com/CAZE7/Camp/pull/171)                                                  | —          |
| `refactor/flowcanvas-overly-long-function-15566093579842863618`      | 2026-05-10     | [#170](https://github.com/CAZE7/Camp/pull/170)                                                  | —          |
| `refactor/navigation-sidebar-link-17029882361740013377`              | 2026-05-28     | [#245](https://github.com/CAZE7/Camp/pull/245)                                                  | —          |
| `refactor/planner-cleanup-14539523642382938203`                      | 2026-05-04     | [#44](https://github.com/CAZE7/Camp/pull/44)                                                    | —          |
| `refactor/planner-node-data-type-safety-4792408062534349661`         | 2026-05-07     | [#132](https://github.com/CAZE7/Camp/pull/132)                                                  | —          |
| `refactor/solar-series-calculation-3393351260092016332`              | 2026-05-04     | [#47](https://github.com/CAZE7/Camp/pull/47)                                                    | —          |
| `refactor/test-describe-blocks-9370823680891638807`                  | 2026-05-09     | [#151](https://github.com/CAZE7/Camp/pull/151)                                                  | —          |
| `refactor/useplannerstore-ensurenode-type-4527963479846554873`       | 2026-05-07     | [#130](https://github.com/CAZE7/Camp/pull/130)                                                  | —          |
| `repair/main-pr388-stomp`                                            | 2026-09-07     | —                                                                                               | —          |
| `security-fix-bom-validation-14758129978460894807`                   | 2026-05-06     | [#84](https://github.com/CAZE7/Camp/pull/84)                                                    | —          |
| `security-fix-chat-validation-15355633296384567972`                  | 2026-05-04     | [#54](https://github.com/CAZE7/Camp/pull/54)                                                    | —          |
| `security-fix-insecure-randomness-1333528527283348585`               | 2026-05-05     | [#64](https://github.com/CAZE7/Camp/pull/64)                                                    | —          |
| `security-fix-messages-validation-11740450184407199735`              | 2026-04-30     | [#4](https://github.com/CAZE7/Camp/pull/4)                                                      | —          |
| `security/fix-rag-pipeline-error-handling-1698523104815807157`       | 2026-05-05     | [#77](https://github.com/CAZE7/Camp/pull/77)                                                    | —          |
| `test-ausbau-fahrplan-11959938129838916271`                          | 2026-05-09     | [#160](https://github.com/CAZE7/Camp/pull/160)                                                  | —          |
| `test-calculate-edge-path-15247101782647551565`                      | 2026-05-19     | [#208](https://github.com/CAZE7/Camp/pull/208)                                                  | —          |
| `test-chargernode-5669404357412905718`                               | 2026-05-06     | [#99](https://github.com/CAZE7/Camp/pull/99)                                                    | —          |
| `test-conduit-node-7517979587092190878`                              | 2026-05-06     | [#96](https://github.com/CAZE7/Camp/pull/96)                                                    | —          |
| `test-dachplaner-page-8944185190488141739`                           | 2026-05-09     | [#156](https://github.com/CAZE7/Camp/pull/156)                                                  | —          |
| `test-dashboard-panel-1293757823152557391`                           | 2026-05-08     | [#140](https://github.com/CAZE7/Camp/pull/140)                                                  | —          |
| `test-edge-inspector-6123828155140969037`                            | 2026-05-19     | [#209](https://github.com/CAZE7/Camp/pull/209)                                                  | —          |
| `test-expertpanel-coverage-13245138320331748424`                     | 2026-05-19     | [#214](https://github.com/CAZE7/Camp/pull/214)                                                  | —          |
| `test-flow-canvas-coverage-14163346036414899278`                     | 2026-05-09     | [#163](https://github.com/CAZE7/Camp/pull/163)                                                  | —          |
| `test-getlayoutedelements-13804370894776210087`                      | 2026-05-04     | [#52](https://github.com/CAZE7/Camp/pull/52)                                                    | —          |
| `test-ki-assistent-page-5533981645934463432`                         | 2026-05-09     | [#158](https://github.com/CAZE7/Camp/pull/158)                                                  | —          |
| `test-planner-dashboard-7148974930382165016`                         | 2026-05-06     | [#78](https://github.com/CAZE7/Camp/pull/78)                                                    | —          |
| `test-planner-store-coverage-13464057476873058355`                   | 2026-05-06     | [#94](https://github.com/CAZE7/Camp/pull/94)                                                    | —          |
| `test-rag-pipeline-error-handling-4406325175893004063`               | 2026-05-14     | [#190](https://github.com/CAZE7/Camp/pull/190)                                                  | —          |
| `test-shore-power-node-1376881048907202681`                          | 2026-05-06     | [#86](https://github.com/CAZE7/Camp/pull/86)                                                    | —          |
| `test-sidebar-component-15113355326721502985`                        | 2026-05-06     | [#108](https://github.com/CAZE7/Camp/pull/108)                                                  | —          |
| `test-use-auto-wire-3608323180992812597`                             | 2026-05-05     | [#76](https://github.com/CAZE7/Camp/pull/76)                                                    | —          |
| `test-use-live-validation-12700513347960885231`                      | 2026-05-19     | [#211](https://github.com/CAZE7/Camp/pull/211)                                                  | —          |
| `test/add-consumer-node-tests-7848558575243698747`                   | 2026-05-06     | [#104](https://github.com/CAZE7/Camp/pull/104)                                                  | —          |
| `test/add-ground-node-tests-12861206422524424884`                    | 2026-05-06     | [#92](https://github.com/CAZE7/Camp/pull/92)                                                    | —          |
| `test/app-page-2590137333539648946`                                  | 2026-05-12     | [#187](https://github.com/CAZE7/Camp/pull/187)                                                  | —          |
| `test/basenode-component-tests-12934424880582590528`                 | 2026-08-26     | [#340](https://github.com/CAZE7/Camp/pull/340)                                                  | —          |
| `test/button-variants-coverage-18079807296915420067`                 | 2026-08-26     | [#334](https://github.com/CAZE7/Camp/pull/334)                                                  | —          |
| `test/card-component-suite-16407486296237384064`                     | 2026-08-26     | [#335](https://github.com/CAZE7/Camp/pull/335)                                                  | —          |
| `test/card-component-suite-6669068987491076524`                      | 2026-08-26     | —                                                                                               | —          |
| `test/consumer-230v-node-17422569214575188728`                       | 2026-05-06     | [#90](https://github.com/CAZE7/Camp/pull/90)                                                    | —          |
| `test/empty-state-component-tests-11012510175398408421`              | 2026-08-26     | —                                                                                               | —          |
| `test/fix-chat-route-json-body-test-2392829174782363948`             | 2026-05-05     | [#79](https://github.com/CAZE7/Camp/pull/79)                                                    | —          |
| `test/fuse-node-3306948054720449158`                                 | 2026-05-06     | [#102](https://github.com/CAZE7/Camp/pull/102)                                                  | —          |
| `test/get-system-voltage-4796353536701740122`                        | 2026-05-26     | [#233](https://github.com/CAZE7/Camp/pull/233)                                                  | —          |
| `test/holzausbau-guide-12443628172894085715`                         | 2026-05-09     | [#164](https://github.com/CAZE7/Camp/pull/164)                                                  | —          |
| `test/improve-cn-utility-coverage-16801256337136629071`              | 2026-05-06     | [#101](https://github.com/CAZE7/Camp/pull/101)                                                  | —          |
| `test/node-types-13032055602219782325`                               | 2026-05-09     | [#161](https://github.com/CAZE7/Camp/pull/161)                                                  | —          |
| `test/roof-background-node-660895419099834655`                       | 2026-05-06     | [#103](https://github.com/CAZE7/Camp/pull/103)                                                  | —          |
| `test/roof-solar-node-7341382547026353140`                           | 2026-05-06     | [#100](https://github.com/CAZE7/Camp/pull/100)                                                  | —          |
| `test/use-planner-drag-drop-2344462443533895381`                     | 2026-05-11     | [#184](https://github.com/CAZE7/Camp/pull/184)                                                  | —          |
| `test/validating-number-input-14221347800921259217`                  | 2026-08-26     | [#338](https://github.com/CAZE7/Camp/pull/338)                                                  | —          |
| `test/water-pipe-edge-11848482365995156105`                          | 2026-05-09     | [#162](https://github.com/CAZE7/Camp/pull/162)                                                  | —          |
| `test/waternode-coverage-8770783310326613430`                        | 2026-05-08     | [#136](https://github.com/CAZE7/Camp/pull/136)                                                  | —          |
| `testing-db-utility-6447710695225144628`                             | 2026-05-06     | [#85](https://github.com/CAZE7/Camp/pull/85)                                                    | —          |
| `testing-elektrik-planung-page-14111818847115163160`                 | 2026-05-09     | [#146](https://github.com/CAZE7/Camp/pull/146)                                                  | —          |
| `testing-improvement-11126344462842246917`                           | 2026-05-07     | [#127](https://github.com/CAZE7/Camp/pull/127)                                                  | —          |
| `testing-improvement-chat-route-12862470155926490133`                | 2026-05-02     | [#17](https://github.com/CAZE7/Camp/pull/17)                                                    | —          |
| `testing-improvement-dashboard-metrics-4636318993751170628`          | 2026-05-05     | [#70](https://github.com/CAZE7/Camp/pull/70)                                                    | —          |
| `testing-improvement-planner-16334672159877553854`                   | 2026-05-09     | [#157](https://github.com/CAZE7/Camp/pull/157)                                                  | —          |
| `testing-inverter-node-1871781682551002794`                          | 2026-05-06     | [#95](https://github.com/CAZE7/Camp/pull/95)                                                    | —          |
| `testing-planner-inspector-14306257144319150754`                     | 2026-05-09     | [#150](https://github.com/CAZE7/Camp/pull/150)                                                  | —          |
| `testing-solar-calculations-8624787943100108143`                     | 2026-05-05     | [#65](https://github.com/CAZE7/Camp/pull/65)                                                    | —          |
| `testing-use-dashboard-metrics-1589954207074974274`                  | 2026-05-05     | [#74](https://github.com/CAZE7/Camp/pull/74)                                                    | —          |
| `testing-vehicle-templates-5105297291660379685`                      | 2026-05-04     | [#57](https://github.com/CAZE7/Camp/pull/57)                                                    | —          |
| `testing/cn-utility-coverage-18414946706982595828`                   | 2026-05-06     | [#119](https://github.com/CAZE7/Camp/pull/119)                                                  | —          |
| `tests-useSequentialTapConnect-16334302249923617387`                 | 2026-05-28     | [#248](https://github.com/CAZE7/Camp/pull/248)                                                  | —          |
| `ui-ux-refactoring-dropdown-sidebar-fix-9570709150639429339`         | 2026-05-03     | [#33](https://github.com/CAZE7/Camp/pull/33)                                                    | —          |
| `ux-aria-pressed-planner-dashboard-7858244800231889307`              | 2026-06-18     | —                                                                                               | —          |
| `ux-expert-panel-a11y-6733655112247876044`                           | 2026-05-14     | —                                                                                               | —          |
| `ux-improvements-planner-layout-14049950530630152504`                | 2026-06-11     | [#269](https://github.com/CAZE7/Camp/pull/269)                                                  | —          |
| `ux-palette-validating-input-a11y-12031209362548156875`              | 2026-06-01     | —                                                                                               | —          |
| `ux-planner-improvements-14621496172654305289`                       | 2026-05-02     | [#18](https://github.com/CAZE7/Camp/pull/18)                                                    | —          |
| `ux/accessibility-focus-improvements-12194626890429477744`           | 2026-05-15     | [#197](https://github.com/CAZE7/Camp/pull/197)                                                  | —          |
| `ux/add-missing-id-sidebar-search-1203220026917179855`               | 2026-05-18     | [#204](https://github.com/CAZE7/Camp/pull/204)                                                  | —          |
| `ux/search-clear-aria-label-10309125487705969647`                    | 2026-05-17     | [#201](https://github.com/CAZE7/Camp/pull/201)                                                  | —          |
| `v0/caze7-0e39c710`                                                  | 2026-05-14     | —                                                                                               | —          |
| `v0/caze7-e803222e`                                                  | 2026-05-14     | —                                                                                               | —          |

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
