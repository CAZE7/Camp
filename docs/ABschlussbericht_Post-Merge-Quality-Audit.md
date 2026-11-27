# PR #609 — Unabhängiger Integrations- und Qualitätsaudit

**Auditdatum:** 2026-11-27 (UTC)

**Status:** Lokale Softwaregates abgeschlossen; **keine Merge- oder elektrische Fachfreigabe**

**Arbeitsbranch:** `arena/32fdc878-camp`

**Arbeitsbasis:** `43ce7dcfb44b6bb97b612652c3cbee17cd54cecc`

**Geprüfter PR-Head:** `a6cf041d4b4281817e760ceec3e0345322dde639`

**Tatsächliche Basis von PR #609:** `1cd4f81d54f15fc2cf55ad93bbe29ba81451cd34`

**Korrektur-Commit:** `05883226aa098f956fbadc11fd53903de42f3d64`

**Eigener Audit-PR:** [#618 (Draft)](https://github.com/CAZE7/Camp/pull/618)

**Tatsächlicher CI-Lauf des Korrektur-Commits:** [46055876243](https://github.com/CAZE7/Camp/actions/runs/46055876243), abgeschlossen; Quality/Matrix/E2E erfolgreich, Visual-Job rot (Details §6.2).

Der nachfolgende Berichtsnachtrag dokumentiert diesen tatsächlich abgeschlossenen
Lauf, ohne den Korrektur-Commit oder seinen Prüfstand umzubenennen.

Dieser Bericht ersetzt den veralteten Abschlussbericht aus PR #609 nicht
rückwirkend durch vermeintlich damalige Ergebnisse. Er unterscheidet den
historischen PR-Head, den neueren Arbeitsstand und die tatsächlich ausgeführten
Prüfungen. Ein Softwareaudit und unabhängige Testimplementierungen sind **kein
unabhängiger elektrotechnischer Fachnachweis**.

## 1. Ergebnis und Abgrenzung

**Empfehlung: PR #609 in der vorliegenden Fassung nicht mergen.**

- Die neue Serienbank-Rechnung hat reproduzierbare Validierungs- und
  Determinismusdefekte. Ein unabhängiger Fachnachweis für die neue Rechnung
  liegt diesem Audit nicht vor. Sie wird auf diesem Branch **nicht übernommen**.
- Die vier roten PR-Checks sind nach GitHub-Annotations ein **Startverbot
  wegen Billing/Spending-Limits**, kein nachgewiesener TypeScript-, Test-,
  Build- oder Browserfehler. Sie sind aber auch kein grüner Verifikationsbeleg.
- Nachgewiesene Eingabe-, Validator- und Exportfehler werden mit
  Regressionstests korrigiert. Bestehende Formeln, Normtabellen, Grenzwerte,
  Sicherheitschecks, Assertions und eingefrorene Baselines bleiben erhalten.
- Nicht vollständig erfüllte Sicherheitsbehauptungen bleiben offen. Der
  S-03/S-3-Konflikt wird nicht durch eine Herabstufung des Sicherungschecks
  kaschiert. Branch Protection ist mit den verfügbaren Rechten nicht lesbar.
- Browserstart ist **lokal** blockiert. Der neue GitHub-Lauf weist jetzt
  funktionales E2E, M-13 und a11y tatsächlich nach. Visual/Lighthouse sind
  dort rot; insgesamt grüner Workflow wegen `continue-on-error` ist **keine
  vollständige grüne Abnahme**. Historische Testzahlen ersetzen das nicht.

Keine Änderungen an `main`, keine fremden Branches überschrieben und kein
Merge ausgeführt. Die Workflow-Dateien und der neuere M-13-Pflichttest werden
unverändert beibehalten.

## 2. Phase 1 — Repository- und Regel-Audit

| Dokument / Regelgruppe                                                                                                  | Tatsächliche Implementierung und Durchsetzung                                                                                                                            | Bewertung                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/SYSTEM-ARCHITECTURE.md`                                                                              | `lib/domain/graph.ts`, `getCableCurrents`, elektrische Fachmodule, Store-/UI-Adapter; `scripts/architecture/libBoundary.test.ts`, `scripts/routing/architecture.test.ts` | Layer-Grenze testgestützt; die gesamte UI-/SSOT-Semantik ist nicht durch einen einzelnen Architekturtest bewiesen. Veralteter Code-Map-Link korrigiert.                                                                                                  |
| `docs/architecture/ARCHITECTURE-RULES.md` und AI-Regeln                                                                 | A/E/G/H/I/J über Architekturtests; K über Doppellauf/Golden/Regression; P/Q/R zusätzlich im AI-Dokument und den dort genannten Tests                                     | Nicht alle Regeln sind harte Gates. D, S-2, S-6, S-9, S-10 und Teile anderer Regeln bleiben Review-/Prozesspflichten. S-1 nannte entfernte Strompfade; korrigiert.                                                                                       |
| `ENGINEERING-CONSTITUTION.md`                                                                                           | Zwei Typechecks, typbewusstes ESLint, Prettier, Vitest-Coverage; Schwellen `lib/**`: Lines 90, Branches 85, Functions 90, Statements 95                                  | Schwellen stimmen mit Konfiguration überein; Ausnahmen `lib/planner/**`, GPU und Diagnostic-Code sind explizit. ESLint schließt u. a. `scripts/**` aus: kein pauschaler Lintbeweis für jedes Skript. Review/Fachfreigabe nicht durch Coverage ersetzbar. |
| `DEFINITION-OF-DONE.md`                                                                                                 | Lokale Check-Kette und CI-Gates vorhanden; Sicherheitsreviews, Branch-Aktualität, Adminschutz und Releasefreigabe externe Pflichten                                      | Kein automatisches „Done“ allein aus lokalen Tests. Zwei unabhängige Sicherheitsreviews fehlen; tatsächliche CI-Nachweise siehe §6.2, Visual/Lighthouse bleiben rot.                                                                                     |
| `docs/ELECTRICAL-VERIFICATION-STRATEGY.md`                                                                              | RM-1…RM-5, Differentialtests, elektrische Invarianten, kritische Mutanten, Silent-Pass-Gate und erreichbarer COMPLIANT-Fall vorhanden                                    | §0–§11 sind historische Aufnahme, §12 enthält die Umsetzung; Lesestand jetzt kenntlich gemacht. Referenzcode unabhängig, fachliche/empirische Datenbasis nicht dadurch unabhängig verifiziert. RM-3 ist kein Nachweis für die neue Serienrechnung.       |
| `docs/verification/VERIFICATION-STRATEGY.md`                                                                            | Differentialprüfung und neun kuratierte Mutantentests sind tatsächlich aktiv                                                                                             | Veraltete Aussagen „keine Mutation im CI“ und Verweise auf zwei vereinheitlichte Strompfade ersetzt. Kein vollständiger Stryker-Score behauptet.                                                                                                         |
| `PRODUCT-READINESS-AUDIT.md`                                                                                            | Gegen Code, Tests, historische Befunde AUD-011/020 und aktuelle CI-Metadaten abgeglichen                                                                                 | AUD-020 bleibt offen; kritische Serien-Modellgrenze bleibt. Historische PR-Testzahlen ausdrücklich keine aktuellen Messungen.                                                                                                                            |
| `REQUIREMENTS-MATRIX.md`                                                                                                | Offizielle Tabellen/IDs, Pfade, Klasse-S-Traceability und begrenzter semantischer Abgleich im wiederverwendeten PR-Validator                                             | Falsche Risikozuordnung und `F/S`-Lücke korrigiert; 29 Anforderungen / 18 mit S nach Ergänzung CAMP-REQ-029. Warnungen sind keine bestätigte Freigabe.                                                                                                   |
| Routing-Verifikation: `docs/ROUTING-INVARIANTS.md`, `docs/ai/ROUTING-CONTEXT.md`, `docs/ai/ROUTING-DIAGNOSTIC.md`, M-13 | Produktivrouter-Audit, Golden Master, SVG-Regression sowie Oracle/Properties/Fuzz/Failure-Replay/Prozessdeterminismus und Browsermessung als PR-only Suite               | Echte Routerprüfungen von den Platzhalter-Diagnostic-Skripten unterscheiden. Letztere sind kein belastbarer Produktionsnachweis (R-028). Browseranteil im eigenen CI bestanden; Visual/Lighthouse separat rot (§6.2).                                    |

**Q-7 / Testfokussierung:** Playwright setzt `forbidOnly` bei `CI`.
Vitest 4.1.12 besitzt zusätzlich den Standard `allowOnly: !isCI`; das Fehlen
eines expliziten `forbidOnly`-Felds in seiner Konfiguration ist **keine**
nachgewiesene Lücke. Es werden keine `.only` oder neuen Skip-Markierungen
hinzugefügt. Eine temporäre echte `it.only`-CLI-Probe unter `CI=1` scheiterte wie verlangt
mit „Unexpected .only modifier“ (Probe danach entfernt). Der vorhandene
opt-in 250-Knoten-Test wurde ausdrücklich mit `SCALE_250=1` ausgeführt.

## 3. Phase 2 — Tatsächliche CI-Ursache

### 3.1 PR #609, unveränderter Head

Quelle: GitHub REST, Check-Runs und deren Annotations, abgerufen am Auditdatum.

**CI-Lauf:** [42475319218](https://github.com/CAZE7/Camp/actions/runs/42475319218)

**Head:** `a6cf041d4b4281817e760ceec3e0345322dde639`

| Job                                 | Check-Run-ID   | Tatsächliches Ergebnis   |
| ----------------------------------- | -------------- | ------------------------ |
| Requirements-Matrix Konsistenzcheck | `128715226869` | failure; nicht gestartet |
| Typecheck, Tests & Build            | `128715227190` | failure; nicht gestartet |
| End-to-End (Playwright)             | `128715227277` | failure; nicht gestartet |
| Visuelles Gate (nicht blockierend)  | `128715227242` | failure; nicht gestartet |

Alle vier Failure-Annotations lauten:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased. Please check the 'Billing & plans'
> section in your settings

Die zusätzliche Ubuntu-Migrations-Notice ist kein belegter Fehlergrund.
Auch kurze Laufzeiten allein wären kein Beweis für einen Codefehler.
Workflow-Logs konnten nicht aus dem externen Blob-Speicher geladen werden;
die Startverweigerung ist jedoch unmittelbar durch die Annotations belegt.

**Konsequenz:** Keine Codekorrektur wird als „Billing-Fix“ ausgegeben. Für einen
neuen CI-Nachweis muss der Repository-Betreiber die Abrechnung/das Limit klären.
Die lokal nachgewiesenen Codefehler sind davon getrennte Auditbefunde.

### 3.2 Wichtige Korrektur der Vergleichsmethode

Ein Zwei-Punkt-Diff `43ce7dc..a6cf041d` zeigte scheinbar gelöschte M-13-Zeilen
und einen entfernten Test. Das war **kein tatsächlicher PR-Patch**:

- Die tatsächliche Basis von #609 ist `1cd4f81d` vom 7. November.
- Der aktive M-13-Schritt kam mit `c0ba909006d3b611ae153dfeda991e5f5deb4de5`
  erst am 21. November hinzu.
- Die PR-Files-API und der Vergleich `1cd4f81d..a6cf041d` enthalten **keine**
  Änderung an `.github/workflows/quality.yml` oder `workflows.test.ts`.

Der zunächst geäußerte Löschungsverdacht ist damit widerlegt und wird **nicht**
als Verstoß gegen O-4 geführt. Auf dem neueren Arbeitsstand bleiben Schritt,
PR-Bedingung und erzwingender Workflow-Test erhalten. Die Dokumentation
benennt die absichtliche Ausnahme vom Workflow-Spiegelvergleich.

## 4. Phasen 3–4 — Nachgewiesene Befunde und Korrekturen

### 4.1 Elektrisches Modell / SSOT

| ID                 | Reproduktion und Befund                                                                                                                                                      | Behandlung auf diesem Branch                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-609-1            | Zwei 100-Ah-Blöcke derselben Bank, einer `series`, einer `parallel`: PR-Head liefert je Reihenfolge 4.266,67 bzw. 8.533,33 A. Das Bank-Modell meldet `declaration-mismatch`. | Nur Modellvalidierung übernommen: widersprüchliche Deklaration → `null`, beide Reihenfolgen, sowohl am Pol als auch am Sicherungsort. Kein zweiter Topologieleser.                                        |
| F-609-2            | PR-Head akzeptiert gemischte Serienblockspannungen 12,8/12,0 V und liefert 3.100 A aus einem Mittelwert. Der neuere Basisstand lehnt sie bereits durch K-3 ab.               | K-3 bleibt unverändert; zusätzliche Regressionen für parallel, series, series-parallel und vertauschte Reihenfolge. Keine Mittelwert-/Serienformel portiert.                                              |
| F-609-3            | Vier Blöcke `series-parallel` ohne Reihen-/Parallelzahlen: PR-Head erfindet 1s1p, obwohl das Modell `missing-counts` meldet.                                                 | Modellfragen `missing-counts` und `member-count-mismatch` sperren numerische Auswertung. Vollständig erklärte Serienbanken behalten nur die dokumentierte konservative Bestandsschätzung, keine Freigabe. |
| AMP-004-Weitergabe | Ein `null` darf kein stilles PASS bewirken; die alte Meldung erklärte jeden solchen Fall fälschlich ausschließlich mit fehlendem Ri/Chemie.                                  | `UNPROVABLE` / `UNVERIFIABLE` bleibt erhalten; Meldung und Handlungsaufforderung nennen Bankdeklaration/Spannungen. Zwei Integrationstests.                                                               |

**Bestandsschutz:** Zwei undeklarierte 100-/200-Ah-Blöcke bleiben bei
1 mΩ / 12.800 A plus vorhandener `ambiguous-topology`-Rückfrage.
Starterbank-Widersprüche sperren keine unabhängige Hausbatterie. Ri-Anker,
Leitungswiderstand, Parallelrechnung, Spannungsbasis, MRBF-Korridore,
Sicherungsgrößen und alle Normgrenzen bleiben unverändert.

**Bewusst nicht übernommen:** Die neue Serien-/2s2p-Rechnung aus #609, deren
Freigabe der PR-Commit lediglich als „Constraint 4 aufgehoben“ bezeichnet.
Weder dieser Text noch ein selbst geschriebener Zahlentest ersetzt den vom
Auftrag verlangten unabhängigen Fachnachweis. AUD-011/020 und R-026 bleiben
Freigaberisiken; `BANK-SERIES-UNSUPPORTED` bleibt kritisch.

### 4.2 Requirements-Validator

Der Validator aus #609 samt seinen 30 Tests und Fixtures wird wiederverwendet,
nicht durch einen parallelen Parser ersetzt. Die ursprünglich vorhandenen
elf Basis-Assertions bleiben erhalten.

| ID      | Nachgewiesener Fehler                                                                                                                                                          | Korrektur / Regression                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| F-609-4 | `R-100, R-300 (offen: …)` wurde als **R-100 offen** gelesen. Dadurch kann ein konsistentes Register blockieren oder der falsche Widerspruch benannt werden.                    | Annotation nur direkt nach ihrer Risiko-ID; drei Tests für offenen/kollidierenden/akzeptierten späteren Eintrag. |
| F-609-5 | `F/S` ohne Claim besteht mit S-Zähler 0; nur die erste Teilklasse wurde geprüft.                                                                                               | Jede enthaltene S-Klasse erzwingt M-4; Regression mit fehlendem Claim.                                           |
| F-609-6 | `Claim`/`Claim-ID` wurden nach dem Lesen unterstützt, bei der Tabellenauswahl aber nur `ID` verlangt. Unterstützte Fixtures erzeugten dadurch unzutreffende Strukturwarnungen. | Dieselben Aliase bei der Auswahl; eigener Warnungs-Regressionsfall.                                              |

Die fünf neuen Tests scheiterten gegen den unveränderten PR-Validator und
bestehen nach der Korrektur. M-8 ist **begrenzt**: Widersprüche zwischen
expliziten Safety-Case-Risikoannotationen und Registerstatus blockieren;
„Erfüllt“ in der Matrix bei offenem Registerrisiko ist wie im PR eine Warnung.
Fachliche Wahrheit von Prosa, Vollständigkeit von Tests oder Reviewerkompetenz
werden nicht automatisch bewiesen.

### 4.3 Asynchroner Bildexport / Planstand

| ID      | Reproduktion und Befund                                                                                                                                                                                                               | Korrektur                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-609-7 | Der Basisstand restauriert alte Auswahl bedingungslos. Der PR-Fix nimmt seinen Vergleichsstand erst **nach** zwei Frames auf und übersieht dortige Änderungen. Ein Endwertvergleich übersieht außerdem ABA: auswählen, dann abwählen. | Auswahländerungen ab dem Löschen bis Renderende beobachten; bei Nutzeränderung keine Restaurierung. `finally` entfernt Beobachter auch im Fehlerfall.                               |
| F-609-8 | Gleichzeitige Aufnahmeaufträge verändern denselben DOM-Canvas und Auswahlzustand; der Test beobachtet überlappende PNG-Aufträge. Download hatte außerdem einen separaten, unvollständigen Wasser-Auswahlpfad.                         | Ein Aufnahmepfad für Download/Bericht; serielle Queue für denselben DOM-Canvas. Fehler vergiften die Queue nicht. Auswahl-Caches referenzieren die restaurierten aktuellen Objekte. |

17 neue Tests verwenden den **realen Store**, kontrollieren nur PNG-Ausgabe
und Browser-Frames und prüfen Nutzeränderung, Frame-Zeitfenster, ABA,
Fehlerpfade, leere Auswahl, Wasser/Kanten sowie Parallelität. Schon die ersten
15 Fälle zeigten 10 Fehler gegen die Basis und 5 Fehler gegen den PR-Fix.
Die bestehenden Auswahl-/Wasserzeichen- und Berichtsprüfungen bleiben erhalten.
Im ersten Gesamtcheck fehlte zusätzlich im Dashboard-Testdouble das Feld
`waterEdges` nur im direkten `getState()`, nicht im echten Store und nicht im
Selektormock. Der Mock ist vervollständigt; bestehende Download- und
Filter-Assertions bleiben unverändert (36 Dashboardtests grün).

Planstandsicherung wird nicht ersetzt: `BOMModal.tsx` prüft weiterhin den
elektrischen Fingerprint **und** `planCaptureIdentity` vor/nach der Aufnahme
und verwirft nicht passende Bild-/BOM-/Prüfstände. Reine Auswahl gehört
bewusst nicht zum Planfingerprint. Die Queue umgeht diese Prüfung nicht.

### 4.4 Dokumentation und bewusst offene Konflikte

- R-004: Safety-Case-Anmerkung „offen/nicht implementiert“ widersprach Code,
  drei bestehenden Sicherungsabstandstests und Risk Register „Behandelt“.
  Anmerkung berichtigt; kein Sicherungscheck entfernt.
- G2/G4/G6: waren trotz vorhandener Differential-/Mutanten-/Silent-Pass-Tests
  als offen dokumentiert. Status und ausführende CI-Schritte berichtigt;
  kein Stryker-Gesamtscore oder zusätzlicher CI-Job erfunden.
- Rule S-1: nennt jetzt `getCableCurrents` für DC/AC statt der ersetzten
  `calculateEdgeCurrent`/`acCurrentA`-Pfade. `docs/ai/CODE-MAP.md` korrekt
  verlinkt; Architektur-Dokumente und neuere AI-Regeln abgegrenzt.
- Historische Mergepläne, PR-604-Berichte und Default-Branch-Runbook sind als
  solche markiert. Repository-API bestätigt `main` als Default-Branch.
- **F-609-9 / R-027:** CL-004/014 behaupteten pauschal „Datenlücke nie
  critical“, während `fuse-offset-missing` genau dies implementiert und
  bestehende Tests es verlangen. Claims auf **Teilweise** eingeschränkt;
  Regelpriorität S-03/S-3 bleibt fachlich zu entscheiden. Keine Assertion
  oder bestehende Sicherheitseinstufung abgeschwächt.
- **F-609-10 / R-028:** `diagnostic:run` und
  `diagnostic:generate-golden-master` erzeugen explizite Platzhalter,
  einschließlich null/0-Metriken. Der echte CLI-Checker lieferte Exit 0 mit
  PASS, obwohl er **alle fünf Zustände** ausgelassen hatte. Ebenso ließ sich
  die Prüfung durch NaN-Schwellen/ungültige Zahlen umgehen. **Korrigiert:**
  Keine vergleichbaren Metriken, Messverlust gegenüber der Baseline oder
  ungültige Pflichtzahlen/Schwellen führen zu Exit 2, nicht zu PASS. Zehn
  neue Tests führen den tatsächlichen CI-CLI-Einstieg aus; die sechs alten
  Tests prüften nur Fixturedateien und Beispielarithmetik und bleiben
  erhalten. Die Runnerintegration bleibt offen: Die Platzhalterstrecke ist
  nach der Korrektur korrekt **nicht bestanden** statt scheinbar grün.
- **F-609-11 / R-029:** `npm audit --omit=dev` liefert Exit 1, **2 high / 0
  critical**: transitive Pakete `undici@6.28.1` und `zod@4.4.3` über
  `@ai-sdk/provider-utils`, `@ai-sdk/openai` und `ai`. Das ist ein bestätigter
  Advisory-/Versionsbefund, kein nachgewiesener Exploit der statischen App.
  Kein blindes Dependency- oder Major-Update. Gezielte Patch-Aktualisierung
  mit AI-/Build-Regressionsprüfung und Betriebsmodus-Triage bleibt offen.
  Beispiele: [Undici TLS](https://github.com/advisories/GHSA-2m5v-pch6-74hx),
  [Undici DoS](https://github.com/advisories/GHSA-xjj6-f33q-929c),
  [Zod Speicherverbrauch](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
  Quellen: npm-Advisory-Antwort und `npm ls undici zod --omit=dev`, Auditdatum.
- Die alten Berichte nennen lokale bzw. historische Tests, aber keinen
  tatsächlich grünen #609-Head. Der tatsächliche neue Nachweis gehört zu
  #618 und nicht rückwirkend zu #609. Aktueller CI-Nachweis und historische Angaben
  werden getrennt. Historische Zahlen 4.318/1, 447/277, 76 und Lighthouse
  84/90 sind **nur im damaligen PR-Bericht berichtete Werte**, nicht hier
  unabhängig nachverifizierte Ergebnisse.

Die Dokumentkorrekturen haben elf eigene Regressionstests; auch die
fälschliche Einstufung des bestehenden `perf:edge-routing`-Gates als
nicht blockierend ist berichtigt (keine Budgetänderung):
`scripts/architecture/documentationReconciliation.test.ts`.

## 5. Architektur- und Sicherheitsbewertung (zehn Prüfpunkte)

| Punkt                          | Bewertung und Grenze des Nachweises                                                                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Elektrische SSOT            | Ströme aus `getCableCurrents`; Kabelbelastbarkeit/Schutz und Grenzwerte aus Fachmodulen. PRs eigener Rohfeld-Topologieleser verletzt die Bank-SSOT; auf diesem Branch nur Modellvalidierung, keine zweite Berechnung.                                            |
| 2. Doku ↔ Code                 | Konkrete veraltete Links, Strompfade, Gates, historische Stände und unerfüllte Claims berichtigt. Normative/prozessuale Pflichten sind nicht allein durch Quelltextbezug erledigt.                                                                               |
| 3. Referenzunabhängigkeit      | RM-1…RM-5 importieren keine Produktivfunktionen oder -konstanten. Differentialprüfung ist codeunabhängig; dieselben Annahmen/Quelltabellen können trotzdem gemeinsame fachliche Fehler tragen. Golden Master ist Regressions-, kein unabhängiger Physiknachweis. |
| 4. Invarianten                 | Elektrische Invarianten, Grenzen/Negativfälle, G1–G7, sechs kuratierte kritische Mutantenklassen und Silent-Pass-Untergrenzen vorhanden. Keine vollständige formale Verifikation aller manuellen/ungültigen Pläne, realer Geräte oder Serienkombinationen.       |
| 5. Determinismus               | Golden-Doppellauf, SVG-Regression, Audit und zusätzliche Prozessdeterminismus-Suite. Widersprüchliche Bankdeklaration jetzt in beiden Reihenfolgen unbewertbar. Zeitpunkt-/Zeitstempel-Felder sind keine elektrische Identität.                                  |
| 6. Async / Race                | Auswahl-Race einschließlich Frame-/ABA-Fenster und paralleler DOM-Aufnahmen reproduziert und korrigiert. Keine Behauptung einer vollständigen Race-Freiheit aller Store-/Browserinteraktionen.                                                                   |
| 7. Ungültige / fehlende Daten  | Units werfen; Schemas bereinigen Typen; Bank-Modell stellt Fragen; neue Guards liefern null, AMP-004 bleibt offen. Bestehende explizit dokumentierte Schätzungen bleiben Schätzungen. S-03/S-3-Konflikt offen.                                                   |
| 8. Export / Planstand          | Gemeinsamer PNG-Pfad; bestehende Fingerprint-/Darstellungsidentitätsprüfung bleibt. Real-Store-Tests und BOM-Report-Konsistenztests statt eines bloßen Mock-Crash-Tests. Lokal kein Browserstart; funktionaler Browsernachweis im eigenen GitHub-Lauf (§6.2).    |
| 9. Schichtengrenzen            | libBoundary, Routing-Architektur und leere Lib-Allowlist unverändert. Neuer Guard importiert nur `lib` aus `lib`; Export bleibt in der UI-/Store-Schicht.                                                                                                        |
| 10. S-1…S-10 / Security & Data | Einzelbewertung unten. Keine Sicherheitsprüfung abgeschaltet und kein fremder Branch verändert. Kein umfassendes Penetrations- oder Zertifizierungsaudit behauptet.                                                                                              |

### S-1 bis S-10

Die S-Regeln im Architektur-Dokument sind Safety-/Daten-/Prozessregeln, nicht
allein klassische IT-Security-Regeln.

| Regel | Befund / Durchsetzung                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-1   | Strom-SSOT dokumentarisch korrigiert; bestehende Konsistenz-/Propertytests und Bank-Modell genutzt.                                                                                   |
| S-2   | Quellen-/Verifizierungsstatus ist Reviewkonvention; Produktdaten und Faustformeln werden durch dieses Audit nicht fachlich aufgewertet. Keine universelle maschinelle Quellenprüfung. |
| S-3   | UNVERIFIABLE-Projektion vorhanden; konkreter Gegenfall Sicherungsabstand bleibt als R-027 offen. Kein pauschal erfüllter Claim.                                                       |
| S-4   | Intent-Rangfolge und `mayOverride` strikt; bestehende Intent-/AutoWire-/Storetests bleiben. Kein Override-Pfad neu eingeführt.                                                        |
| S-5   | Engineereignis vs. UI-Projektion bleiben getrennt; AMP-004 null bleibt UNVERIFIABLE/UNPROVABLE, nicht PASS.                                                                           |
| S-6   | Keine elektrische UI-Formel hinzugefügt; Anzeige-/Exportkorrekturen ändern keine elektrischen Rechenschritte. Allgemeine UI-Delegation weiterhin teilweise Reviewpflicht.             |
| S-7   | Persistenzschema/Migration und Rettung einzelner Elemente unverändert; Schema-/Persistenztests im Gesamtgate.                                                                         |
| S-8   | Determinismus-/Idempotenzprüfungen und Inhalts-No-op-Regeln unverändert. Keine neue zufällige ID-Quelle.                                                                              |
| S-9   | Prozesspflicht, nicht technisch beweisbar durch einen Testlauf; Arbeitskontext/Regeln wurden für diesen Audit gelesen.                                                                |
| S-10  | Ledger-Eintrag 2026-11-27 und Regressionen vorhanden; externe Reviews bleiben offen.                                                                                                  |

Klassische Security wird ergänzend anhand Lockfile-Gate, statischem Export,
Quelltext-/Export-Escaping, CSP-/Header-Konfiguration und vorhandenen
Consent-/Analytics-Tests geprüft. `public/_headers` enthält CSP und
Sicherheitsheader, ist aber **kein Nachweis tatsächlich ausgelieferter
HTTP-Header**. Deployment-Header, Secrets-Freiheit und alle Supply-Chain-Risiken
werden nicht pauschal zertifiziert. GitHub-Protection-API: **403**; keine
Admin-Konfiguration vorgenommen und weder aktiv noch inaktiv behauptet.

## 6. Phase 5 — Verifikation

### 6.1 Lokaler korrigierter Stand

Messumgebung: Node **22.22.3**, npm **10.9.8**, Vitest **4.1.12**.
Alle unten als bestanden bezeichneten Läufe wurden auf dem korrigierten
Arbeitsbaum ausgeführt; nachfolgende SHA-/CI-Nachträge ändern keine Formeln.
Rohlogs liegen lokal unter dem ignorierten `test-results/audit609/`; große
Build-/Coverage-/Browserartefakte werden nicht eingecheckt.

<!-- AUDIT-LOCAL-RESULTS-START -->

| Prüfung                                             | Tatsächlich ausgeführtes Ergebnis                                                                                                                                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements-Matrix                                 | **Exit 0**, 29 Anforderungen / 18 mit S; Warnungen zu offenen/teilweisen Claims bleiben sichtbar.                                                                                                                                                                                                 |
| `SCALE_250=1 npm run check`                         | **Exit 0**, 18:40:33–18:57:13 UTC: ESLint, Prettier, beide Typechecks und Coverage grün. **4.412 Tests / 328 Dateien, kein Skip**. Vier M-13-only-Dateien sind wie im bestehenden Skript aus Coverage ausgenommen, aber im vollständigen Lauf unten enthalten.                                    |
| Gemessene Coverage für `lib/**`                     | 130 instrumentierte Dateien; **Lines 97,34 % / Branches 88,78 % / Functions 97,20 % / Statements 95,40 %**. Schwellen 90/85/90/95 erfüllt. Explizite Konfigurationsausschlüsse bleiben unverändert; globale UI-/Script-Coverage ist kein zusätzlich behauptetes Gate.                             |
| `SCALE_250=1 npm test` (vollständig, ohne Coverage) | **Exit 0**, 18:31:40–18:40:18 UTC, **4.478 Tests / 332 Dateien, kein Skip** (Vitest 516,96 s). Einschließlich Oracle/Properties/Fuzz/Failure-Records und aller 25 Skalierungstests. Keine Testdatei zusätzlich ausgeschlossen.                                                                    |
| Gezielte Fehlerregressionen                         | Kurzschlussmodell **30**, AMP-004/Ampacity **43**, Matrixvalidator **35**, echte Store-Race-Fälle **17**, Diagnostic-CLI **16**, Dokumentabgleich **11** grün. Bestehende Dashboard-Exportassertions unverändert, Dashboard **36** grün.                                                          |
| `npm run routing:audit`                             | **Exit 0**: sechs Referenzpläne; **I1–I7 = 0, hart/orth/overlap/fallback = 0**, identischer Doppellauf. Kein allgemeiner Nullfehlerbeweis aller möglichen Pläne.                                                                                                                                  |
| Golden Master / SVG-Regression                      | **13 / 68 Tests grün**, eingefrorene Baselines unverändert. Kein Recapture zur Anpassung der Wahrheit.                                                                                                                                                                                            |
| Elektrische Differentialprüfung / G4 + G6           | **55 / 30 Tests grün**; kuratierte Mutanten, kein vollständiger Stryker-Score.                                                                                                                                                                                                                    |
| M-13 ohne Browser                                   | Oracle **19**, Properties **10**, Fuzz **11**, Failure-Records **26** grün; Replay **5/5 Akten** erwartungsgemäß; drei Pläne in getrennten Prozessen deterministisch und reihenfolgenstabil. Akten 4/5 erwarten bewusst bekannte negative Verletzungen, kein fälschlicher globaler I2/I3=0-Claim. |
| Routing Diagnostic Regression                       | **Nach Korrektur Exit 2 / nicht bestanden:** Generator-/Runner-Platzhalter liefern keine vergleichbaren Metriken. Früher Exit 0 trotz fünf ausgelassener Zustände. Die zehn neuen echten CLI-Fälle bestehen; das ersetzt keine reale Runnerintegration.                                           |
| `npm run perf:edge-routing`                         | **Exit 0**: N=36/E=134, Render-Median **2,26 ms** ≤16; Live-Median **247,87 ms** ≤300, p90 **311,38 ms**, Streuung **1,26** ≤2. Offenes 16-ms-Live-Ziel nicht als erfüllt bezeichnet.                                                                                                             |
| Lockfile-/Deploy-Trigger-Gates                      | Beide **Exit 0**; Paket-/Lockfile und Workflows unverändert. Echte CI-.only-Probe liefert erwartetes Exit 1, danach entfernt.                                                                                                                                                                     |
| Production Build / Static Export                    | **Exit 0**, 18:29:02–18:29:57 UTC; Next-Export und SEO-Audit für **42 Seiten** grün, **44 HTML-Dateien / 17 MB** insgesamt. Kein tatsächlicher Deployment-Headernachweis.                                                                                                                         |
| Funktionales Playwright                             | Startversuch **Exit 1** vor Testausführung: `libnspr4.so` fehlt. Suite selektiert **728** Szenarien, nach erstem Startfehler abgebrochen, **727 nicht ausgeführt**. Kein Featurefehler daraus abgeleitet.                                                                                         |
| Visuelle Regression                                 | Startversuch **Exit 1** mit derselben Bibliotheksursache; **76** selektiert, **75 nicht ausgeführt**. Kein Pixelergebnis und keine Baseline neu geschrieben.                                                                                                                                      |
| M-13 Autark-Browser / a11y                          | Lokaler Autark-Startversuch **Exit 1** vor Browserstart; lokale a11y/Interaktion nicht verifiziert. Tatsächlicher GitHub-Nachweis in §6.2.                                                                                                                                                        |
| Lighthouse                                          | **Exit 1**; drei Routen erreichen keinen Chrome-Debugging-Port. Kein Score und keine gemessene Budgetüberschreitung der App behauptet. Die Browserumgebung ist nicht lauffähig.                                                                                                                   |
| `npm audit --omit=dev`                              | **Exit 1**, **2 high / 0 critical**, transitive `undici`/`zod`-Advisories. R-029 offen, kein nachgewiesener App-Exploit behauptet.                                                                                                                                                                |

**Gegenproben und Fehlertransparenz:**

| Korrektur            | Roter Nachweis vor Korrektur                                                                                               | Grüner Nachweis danach                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Bankvalidität        | Unveränderte Arbeitsbasis: **6 fehlgeschlagen / 24 bestanden** mit neuen Kurzschlusstests                                  | **30 bestanden**                                                       |
| AMP-004-Diagnose     | **2 fehlgeschlagen / 41 bestanden**; Status blieb schon offen, Meldungsursache fehlte                                      | **43 bestanden**                                                       |
| Matrixvalidator      | Originaler PR-Validator gegen zusätzliche Fälle: **5 fehlgeschlagen / 30 bestanden**                                       | **35 bestanden**                                                       |
| Auswahl-Race         | Erste 15 Fälle: Arbeitsbasis **10 fehlgeschlagen / 5 bestanden**, tatsächlicher PR-Fix **5 fehlgeschlagen / 10 bestanden** | Real-Store-Suite einschließlich Queue-/Fehlerfällen **17 bestanden**   |
| Diagnostic-CLI       | **4 fehlgeschlagen / 12 bestanden**, tatsächlich gestarteter CLI statt bloßer Fixturearithmetik                            | **16 bestanden**; Platzhalterstrecke korrekt Exit 2                    |
| Dokumentation        | Erste zehn Regressionen gegen Basisdokumente **10 fehlgeschlagen**; zusätzlicher Performance-Fall gezielt ebenfalls rot    | **11 bestanden**                                                       |
| Dashboard-Testdouble | Erster Gesamtcheck: **2 fehlgeschlagen / 4.409 bestanden**; `getState()` ohne `waterEdges`                                 | Mock vervollständigt, Assertions unverändert; finaler Gesamtcheck grün |

Logzuordnung: `check-final.log`, `full-test-final.log`, `final-gates.json`,
`lib-coverage-summary.json`, `browser-start-results.json`,
`diagnostic-{cli-red,cli-green,fail-closed}.log`,
`ampacity-{red,green}.log`, `validator-{red,green}.log`,
`documentation-base-red.log`, `documentation-perf-base-red.log` und
`documentation-final-green.log` unter `test-results/audit609/`.
Die Rohlogs sind lokal/ignoriert, keine eingecheckten Build- oder Testdaten.

<!-- AUDIT-LOCAL-RESULTS-END -->

### 6.2 Commit und tatsächlicher neuer CI-Lauf

<!-- AUDIT-CI-RESULTS-START -->

**Pull Request:** [#618](https://github.com/CAZE7/Camp/pull/618), eigener Branch,
Draft; kein Merge. **Head-SHA des gemessenen Laufs:**
`05883226aa098f956fbadc11fd53903de42f3d64`.

**Lauf:** [46055876243](https://github.com/CAZE7/Camp/actions/runs/46055876243),
Event `pull_request`, Versuch 1, **2026-11-27 19:19:28–19:35:08 UTC**.
GitHub meldet insgesamt `completed / success` — **nicht** alle Jobs grün.

| Tatsächlicher Job                   | Check-Run-ID   | Ergebnis und Beleggrenze                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements-Matrix Konsistenzcheck | `140698117106` | **success**, ausgeführt; keine historische Billing-Startverweigerung.                                                                                                                                                                                                                                                                                                |
| Typecheck, Tests & Build            | `140698117349` | **success**: Install/Lockfile, Architektur, Routing/Golden/Regression, Lint/Format, beide Typechecks, Coverage, G4/G6, Performance, Build und Static Export erfolgreich. **M-13 success**, Autark-Browserannotation **1 passed (5,3 s)**. **M-14 a11y success: 52 passed / 4 bestehende Skips**. Keine Zertifizierung von Elektrik oder vollständiger Accessibility. |
| End-to-End (Playwright)             | `140698116823` | **success**, **448 passed / 280 skipped (13,6 min)** laut GitHub-Annotation. Keine 728 bestandenen Tests behauptet. Die bedingten Viewport-/Touch-Skips stammen aus unveränderten Tests; exakt dieselben 448/280 meldet bereits der Basislauf.                                                                                                                       |
| Visuelles Gate (nicht blockierend)  | `140698117186` | **failure**: Pixelprüfung **18 failed / 58 passed (1,5 min)**. Auch Schritt **Lighthouse-Budget** ist `failure`. Sein numerischer Befund / genaue technische Ursache ist aus den verfügbaren Annotations **nicht bestimmbar**; weder Budgetüberschreitung noch Browserbibliotheksfehler unterstellt.                                                                 |

Der grüne Gesamtstatus erklärt sich aus dem **bereits bestehenden**
`continue-on-error: true` des Visual-Jobs. Diese Konfiguration wurde nicht
geändert. Insbesondere beweist ein `gh run watch --exit-status` mit Exit 0
hier **nicht**, dass Visual oder Lighthouse bestanden haben.

**Gegenprobe am tatsächlichen Basiscommit, kein Ursachenraten:**
[44922014101](https://github.com/CAZE7/Camp/actions/runs/44922014101)
(Head `43ce7dcfb44b6bb97b612652c3cbee17cd54cecc`) meldet bereits:

- E2E-Check `136899912791`: **448 bestanden / 280 skipped**;
- Visual-Check `136899912944`: **18 fehlgeschlagen / 58 bestanden**,
  dieselbe Liste von 18 Szenarien: Startseite, Heizung, Impressum ×
  light/dark × tablet-768/mobile-375/touch-pixel5;
- M-14: **52 bestanden / 4 skipped**; Lighthouse-Schritt ebenfalls rot.

Damit sind diese konkreten visuellen Fehlschläge als **bereits vor den
Korrekturen vorhanden** belegt, nicht ihre technische Ursache und nicht ihre
Akzeptanz. Beispiel im neuen Lauf: `route-heizung-light.png`, tablet-768,
**30.214 abweichende Pixel / Verhältnis 0,04**, auch nach Retry. Kein
Recapture, keine Lockerung von Assertions oder Budgets. Die Diff-Artefakte
liegen im tatsächlichen GitHub-Lauf als **`visual-diff`** (ID `15226697825`,
50.893.258 Byte). Binäre Artefakte und rohe Joblogs sind über die verfügbaren
Downloadpfade hier nicht auswertbar; die Annotations und Stepstatus wurden
vollständig per REST gelesen. Die visuellen Ursachen bleiben reviewpflichtig.

**Wichtige zeitliche Trennung:** Die Billing-Ursache in §3 betrifft den
historischen #609-Lauf. Der neue eigene Lauf wurde tatsächlich gestartet und
ist davon nicht blockiert. Er wird weder als erneuter Billing-Fehler noch als
vollständig grüne Visual-Abnahme beschrieben. Nachfolgende reine
Berichtskommit(s) ändern den hier eindeutig identifizierten Prüf-SHA nicht.

Auch der lokale Pre-Push-Hook führte gegen den bereits erstellten
Korrektur-Commit nochmals `SCALE_250=1 npm run check` erfolgreich aus
(**4.412 bestanden**, 328 Dateien, kein Skip; 19:02:50–19:19:19 UTC,
inklusive Push). Ein weiterer Production-Build nach Commit-Erstellung
(`build-0588322.log`) bestand ebenfalls. Die lokale Browserblockade ist
weiterhin wahr, wird aber nicht als fehlender GitHub-Browsernachweis ausgegeben.

<!-- AUDIT-CI-RESULTS-END -->

## 7. Phase 6 — Offene Risiken und Merge-Entscheidung

1. **R-026 / AUD-020:** kein unabhängiger Fachnachweis für die neue
   Serienbank-Rechnung. Sie bleibt aus dieser Korrektur ausgeschlossen.
   Prüfungen des Planers sind keine elektrische Abnahme.
2. **R-027:** S-03/S-3-Regelpriorität beim fehlenden Sicherungsabstand offen.
   Bestehender strenger Check unverändert, Claims ehrlich eingeschränkt.
3. **R-028:** Diagnostic-CI-Platzhalter sind kein Produktionsnachweis. Der
   Checker schlägt nun korrekt fehl; vor Freigabe echte Messung anbinden.
   **R-029:** zwei high-Dependency-Advisory-Befunde triagieren und gezielt
   patchen; keine bestätigte Exploitierbarkeit behauptet.
4. **CI/Browsers:** aktuelle Matrix-/Quality-/Funktions-E2E-Nachweise sind
   für `05883226…` vorhanden, einschließlich Autark/a11y. Visual/Lighthouse
   bleiben tatsächlich rot (auch bereits in der Basis); vor UI-/Performance-
   Freigabe Ursachen klären. Lokale Systembibliotheksgrenzen sind keine Tests.
5. **Reviews/Admin:** zwei Sicherheitsreviews, davon eines unabhängig;
   Required Checks/Branch Protection vom Repo-Admin bestätigen. Der 403-Zugriff
   belegt nur fehlende Leseberechtigung, nicht das Fehlen von Protection.
6. **Bestandsrisiken:** Fahrzeug-Kabeldaten/f₃, Annahmen zu Netzimpedanz,
   230-V-Modellgrenze, Router-Domänentrennung und weitere im Register offene
   Produkt-/Sicherheitsfragen werden nicht durch diesen Audit geschlossen.

**Merge-Empfehlung:** Kein Merge von #609 unverändert. Die begrenzten,
regressionsgesicherten Korrekturen dieses eigenen Branches getrennt reviewen.
Auch für sie wird trotz der jetzt vorhandenen tatsächlichen Kern-/E2E-
CI-Nachweise ohne Sicherheitsreviews und Klärung der offenen Freigaben keine
pauschale Mergefreigabe erteilt. Visual/Lighthouse sind nicht grün. Keine direkte Übernahme eines älteren
Dateibaums über den neueren Stand; insbesondere M-13 unverändert erhalten.

## 8. Dokumentationsänderungen

- Dieser Bericht: Phasen, Befunde, Gegenproben, tatsächliche CI-Ursachen,
  Ergebnisse und Nicht-Nachweise getrennt.
- Architekturregeln/Systemarchitektur/CI: aktuelle SSOT, Links und gezielte
  M-13-Spiegelausnahme.
- Safety Case/Risk Register/Requirements: R-004-Anmerkung, eingeschränkte
  CL-004/014, offene R-026…029, neue CL-024/CAMP-REQ-029 ohne Fachfreigabe.
- Release-/Verification-Strategie: aktive G2/G4/G6 korrekt beschrieben,
  vollständiger Mutationsscore nicht erfunden; M-8-Grenzen dokumentiert.
- Electrical-/Routing-Diagnostic-Kontext und Product Readiness: Modellgrenzen,
  historische Messungen und Diagnostic-Platzhalter kenntlich gemacht.
- Historische PR-/Default-Branch-Unterlagen: Banner statt rückwirkender
  Ergebnisänderungen.
- `ARCHITECTURE-CHANGES.md`: nachvollziehbarer Verhaltens-/Nachweisledger.
