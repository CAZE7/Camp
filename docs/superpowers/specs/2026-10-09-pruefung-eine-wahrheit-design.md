# Prüfung — eine Wahrheit für Befund und Berechnung

Status: freigegeben (Auftraggeber 2026-10-09: Variante A, Planerpauschale behalten, Querschnittsreihe zurück auf 70 mm²)
Branch: `fix/pruefung-eine-wahrheit` ab `6b22600`
Bearbeitet die Prioritäten 1 und 4 der Auftragsliste; 2, 3 und 5 werden in Grenzen mitgefasst (Abschnitt 9).

---

## 1. Ziel

Ein Befund der Anlagenprüfung hat genau eine Quelle, genau eine Spannungsebene, genau einen
Zustand und genau eine Abhilfe. Alle Zähler, die der Nutzer sieht, sind projectierte Felder
desselben Berichts — keine zweite Auszählung im Baum.

Messbares Endkriterium: Für jeden der sechs `knownPlans/*.json`, die drei
`lib/verify/planFixtures.ts`-Pläne und den `validation158Fixture`-Plan gilt

1. `verifyPlan` zweimal hintereinander liefert die identische Ereignisliste (bytegleich über
   `ruleId:status:entity:severity:domain`).
2. Die drei Zahlen im Panel sind gleich den drei Zahlen aus `verificationSummary(report)`.
3. Kein 12-V-Befund enthält den Vermerk „230 V“ oder „Stromschlag“.
4. Jeder Befund hat einen `remedy`-Text, der eine konkrete Handlung nennt (kein
   „Zeige die betroffene Stelle im Plan“).

## 2. Ausgangslage (gemessen, nicht gelesen)

### 2.1 Der Branch ist rot

`npx vitest run` über die neun von der Querschnittserweiterung betroffenen Dateien auf `6b22600`:
**5 von 9 Testdateien fehlen, 8 Tests, Exit 1.** Commit `137858f` (PR #515) sagt „Build passes;
8/8 pass“. Die Fehlschläge:

| Test                                               | Assertion                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `lib/verify/validationStates.test.ts:108`          | `expected 169.39999999999998 to be close to 120.4` (Differenz 49 A) |
| `lib/electrical.test.ts:175`                       | `expected 125 to be 100`                                            |
| `lib/vde-properties.test.ts` G4                    | `expected 70 to be greater than or equal to 95`                     |
| `lib/vde-properties.test.ts` G7                    | erwartet `…:70:W…`, erhalten `…:70:-…` (Warnmarke verschwunden)     |
| `lib/vde-standards.test.ts:30`                     | Normreihen-Assertion                                                |
| `validationStates.test.ts` Fälle 11 und 12         | `expected 120 to be 70`, `expected true to be false`                |
| `components/planner/ui/WarningCenter.test.tsx:250` | erwartet `Stromschlaggefahr`, erhält neuen Folge-Text               |

Ursache ist eine gemeinsame Konstante: `lib/electrical.ts:4` erhielt `95.0, 120.0` in
`VDE_SIZES`, `:27`/`:33` zwei `VDE_AMPACITY`-Einträge. Davon abgeleitet, ohne weitere
Änderung: `MAX_MODELED_CROSS_SECTION_MM2` (`:282`), `MAX_MODELED_AMPACITY_A` (`:289`,
172 → 242), `FUSE_MAP` (`:183`, Schleife über `VDE_SIZES`), `designAmpacity` (`:471`),
`calculateCrossSection` (`:360`), `assessCableSelection` (`:433`).

Widerspruch dazu: `lib/autoWire/sizing.ts:176,319–339,403–409` deckelt weiterhin bei 70 mm²,
`lib/autoWire/primitives.ts:148–153` rundet auf 70 ab. Der G4-/G7-Fehlschlag ist genau dieser
Zustand: eine Leitung, die 95 mm² verlangt, bleibt bei 70 stehen und verliert ihre Warnmarke.

Fachlicher Grund der Rücknahme: der Inline-Kommentar `lib/electrical.ts:31` beschreibt 95/120
als „konservativ an bestehende Modellreihe angepasst (Verhältnis ≈ 0,88)“, also zurückgerechnet
aus dem Verhältnis vorhandener Stufen, nicht abgelesen. `AGENTS.md` und
`docs/ai/ARCHITECTURE-RULES.md` verbieten erfundene Normbehauptungen; eine Belastbarkeit ist
eine Sicherheitszahl.

### 2.2 Es gibt acht Zählstellen, drei Datenquellen

| Stelle                                          | zählt                                           | Quelle                     |
| ----------------------------------------------- | ----------------------------------------------- | -------------------------- |
| `lib/verify/pipeline.ts:298`                    | Schwere (4) + Zustand (4) + `rootCauses.length` | Engine                     |
| `WarningCenter.tsx:425`                         | `type` (3)                                      | eigene Schleife            |
| `WarningCenter.tsx:448`                         | `status` (4)                                    | eigene Schleife            |
| `WarningCenter.tsx:405` `groupCounts`           | safety/planning/gaps (3)                        | eigene Schleife            |
| `WarningCenter.tsx:436`                         | `rootCauses.size`                               | eigene Map                 |
| `components/planner/utils/guidedSteps.ts:131`   | critical / nicht-critical                       | Befundliste                |
| `components/planner/AutoWireReviewModal.tsx:58` | critical / other                                | `AutoWireReport.conflicts` |
| `components/planner/ui/PlannerStatusBar.tsx:36` | kritisch / Warnungen                            | `store.plannerErrors`      |

In der Panel-Kopfzeile stehen zwei Zeilen untereinander (`WarningCenter.tsx:605–610`): die eine
partitioniert alle Befunde, die andere nur solche mit gesetztem `status`. `status` ist optional
(`useLiveValidation.ts:43`) und wird von **keinem** der 21 handschriftlichen Melder gesetzt
(`grep -c "status:" components/planner/hooks/useLiveValidation.ts` → 0; die Engine-Projektion
setzt sie an drei Stellen in `verificationWarnings.ts`). Die Zeilen können bei demselben Plan
nie dieselbe Gesamtzahl ergeben.

Am 158,7-A-Plan (`npx tsx scripts/verify/explainCableCurrent.ts`, Profil `CAMP_MODEL`):
25 Datenlücken, 14 kritische Verletzungen, 16 Ursachengruppen — davon **5 mit leerer
Betroffenen-Liste** (`DATA-MISSING-004/005/006`, `RCD-MISSING-001`, `RCD-POSITION-001`), die
trotzdem in „Z Ursachen“ zählen.

### 2.3 Dieselbe Anlage, unterschiedliche Regelmenge

Die App prüft mit `{ profile: 'PRACTICE', context: 'VEHICLE' }`
(`components/planner/utils/verificationWarnings.ts:47`, 29 Regeln),
`lib/verify/validation158.regression.test.ts:86` und `scripts/verify/explainCableCurrent.ts`
mit `CAMP_MODEL`, `lib/verify/context.ts:70` defaultet `NORM_CORE`. `RCD-001…004` laufen nur in
`VEHICLE`/`MARINE`. Ein Zählerstand ist ohne Profil und Kontext keine Aussage.

### 2.4 Spannungsebene fehlt im Befund, die Modell-Domäne existiert

`PortRef.domain` und `CableModel.domain` (Typ `DomainClass`, `lib/verify/types.ts:273`, `:443`)
tragen die abgeleitete Gefährdungsklasse; `types.ts:259–263` begründet die doppelte Speicherung
wörtlich „damit die Ableitung nicht an zwei Stellen unterschiedlich ausfallen kann“.
`AuditEvent` (`:586–620`) projiziert sie nicht. `ValidationWarning`
(`useLiveValidation.ts:32–86`) hat kein Domänen-Feld.

Folge: die Folge-Zeile wurde (bis `137858f`) aus `category` gedichtet
(`WarningCenter.tsx:97` — jeder Safety-Befund bekam „bei 230 V besteht zusätzlich
Stromschlaggefahr“), und `137858f` ersetzte das durch eine Text-Heuristik über den Message-String
(`WarningCenter.tsx:98`). Beides ist raten. Der Repo-Kommentar `WarningCenter.tsx:67–70` verwirft
Muster-Heuristiken ausdrücklich zugunsten einer benannten Liste.

Zusätzlich: `verificationWarning()` setzt `category` aus `isGap || EFFICIENCY_WARNING ?
'estimation' : 'safety'` (`verificationWarnings.ts:98–99`). Jeder nicht-Lücken-Befund der Engine
— auch ein 12-V-AMP-001 — landet in `safety` und damit in der 230-V-Aussage.

### 2.5 Zwei Textquellen für dieselbe Abhilfe, eineketteweise veraltet

`WarningCenter.tsx:332` `nextStep()` ist eine if-Kette über 22 ID-Präfixe parallel zu
`warning.remedy` aus der Engine (`AuditEvent.autoFixRemedy`, erzwungen nicht leer durch
`lib/verify/events.ts:77–79`). Abgleich der 22 Zweige mit den Meldern:

- 9 Zweige haben einen lebenden Melder (`mixed-voltage-*`, `solar-voc-*` vier Varianten,
  `battery-parallel-chemistry`, `solar-overload`, `dcdc-unconnected`)
- 12 Zweige verweisen auf IDs ohne Produzenten — belegt durch
  `useLiveValidation.test.ts:238` („Die Planer-Regel `missing-fuse-*` ist entfernt“) und
  `:360–362` (`battery-capacity` ersetzt durch PWR-001); ebenso `reversed-polarity`,
  `inverter-missing-rcd`, `thermal-overload`, `fuse-not-possible`,
  `cross-section-undersized`, `drop-not-solvable`, `ac-descriptor-assumed`,
  `ac-protection-not-modeled`, `inverter-no-minus`, `inverter-unprotected`, `shunt-bypass`, `rcd-`
- 1 Zweig unklar: `thermal-overload` wird in `components/edges/CableEdge.tsx:209` als `ruleId`
  gesetzt, nicht als `id`

Von den 21 handschriftlichen Literalen tragen nur 2 ein `remedy` (`useLiveValidation.ts:882`,
`:908`). 10 von 21 fallen deshalb in den Auffangtext „Zeige die betroffene Stelle im Plan und
ergänze die dort beschriebene Komponente.“ — darunter beide BMS-Befunde und
`component-limit` (`ELE-010`), drei als `critical`/`safety` gemeldete Electrical-Befunde ohne
Handlungsanweisung.

### 2.6 `I_b ≤ I_n ≤ I_z` wird als erfüllte Kette gedruckt

`lib/electrical.ts` `evaluateCableProtection` (`:677`) baut in der Explanation eine Kette mit
`≤`-Glyphen und eingesetzten Ist-Werten. Der Klartext-Vertrag zwei Zeilen darüber verspricht ein
Verdict je Relation. Ausgabe am 158,7-A-Plan:

```
I_b = 158.7 A ≤ I_n = 100.0 A ≤ I_z = 120.4 A
Zustand: violated · Schwere: critical · Verletzungen: ib-over-iz, ib-over-in
```

Die Kette ist falsch (158,7 ≤ 100), die Verletzungen sind richtig. Eine Funktion, alle Flächen
(Panel, Sonde, ggf. Export).

### 2.7 Achte Querschnittsimplementierung ohne Konsumenten

`lib/cableSizing.ts:267` `findMinimumValidCable` (81 Zeilen neu, 0 entfernt, aus `137858f`) hat keinen
Produktions-Konsumenten; imports sind ausschließlich `lib/verify/validation158.regression.test.ts`
(`:17`, `:152`, `:173`, `:179`). Es dupliziert `calculateCrossSection` (`lib/electrical.ts:360`),
`designAmpacity` (`:471`), `selectFuseSize` (`:256`) und `calculateCableIz` (`:593`) in eigener
Reihenfolge mit eigener Toleranz (`+ 1e-9`) und eigenem Modellbegriff („Sicherungskoordination
… (vereinfacht)“). Ein Plan kann damit je nach Aufrufpfad zwei Empfehlungen erhalten.

### 2.8 Der 158,7-A-Fall selbst ist bereits fachlich richtig

Das Fixture summt 147,06 A (WR) + 5,00 A + 6,67 A = 158,73 A auf dem Hauptstrang
(`validation158Fixture.ts:13–25`) und die Engine meldet zwei getrennte Verstöße: `ib-over-iz`
(158,7 > 120,4) und `ib-over-in` (158,7 > 100). Die Physik ist erledigt; die Anzeige war es nicht.

## 3. Entscheidungen

| #   | Entscheidung                                                       | Begründung                                                                                                         |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| E1  | Querschnittsreihe zurück auf 1,5…70 mm²                            | Modellgrenze wieder belegbar; 8 Tests wieder grün; Ausdehnung nur mit belastbarer Normquelle, und dann vollständig |
| E2  | Variante A: alle elektrischen Altbefunde werden Engine-Regeln      | sonst bleibt die zweite Quelle stehen und der Zähler driftet beim nächsten Melder erneut                           |
| E3  | Planerpauschale 0,7 bleibt rechnerisch, wird aber Klartext-Annahme | keine Zahl ändert sich, keine Referenz muss recaptured werden                                                      |
| E4  | Domäne, Zustand und Abhilfe werden Pflichtfelder des Befunds       | Typ erzwingt, was Konvention nicht gehalten hat                                                                    |
| E5  | `consequence()` und `nextStep()` verlassen die UI                  | Regel D verbietet der Anzeige, elektrische Aussagen zu dichten                                                     |

Abweichung von reinem A, ausdrücklich genannt: **vier** der 21 Literale sind nicht elektrisch —
`route-lock-*` (`:862`), `ROUTE-LOCK-{MISSING,GEOMETRY,ENDPOINT,INVALID}` (`:898`),
AutoWire-Konflikte (`:941`), AutoWire-Fragen (`:961`). Diese werden nicht in `lib/verify`
als „Regeln“ mit Normherkunft registriert, denn die Matrix verlangt `standard`/`provenance`
(`lib/verify/rules.ts:42–67`) und `clause !== null` nur bei `VERIFIED_NORM`
(`rules.test.ts:78–82`). Eine Normbehauptung über Wegpunkt-Geometrie wäre ein erfundener Beleg.
Sie erhalten denselben Befund-Typ (domäne, zustand, abhilfe, ein zaehler) ueber eine deklarierte
Projektion in ihrem eigenen Modul und dieselbe ID-Registry, aber nicht die Matrix.

## 4. Architektur und Datenfluss

```
Store (nodes, edges, routingReport, autoWireReport)
  └─ useLiveValidation.ts            [nur noch: Eingabe bauen, Fokus, Sortierung]
       ├─ lib/verify/pipeline.verifyPlan(...)     -> VerificationReport (29 + n Regeln)
       ├─ lib/routing/invariants (finalValidation) -> RoutingFinding[]   [neu: deklarierte Projektion]
       └─ lib/autoWire/conflicts                   -> AutoWireFinding[]  [neu: deklarierte Projektion]
                alle drei -> lib/validationSeverity.ts::summarizeFindings(report)
                                        |
                            VerificationSummary (verdikt, kritisch, ohneAngaben, profil, kontext)
                                        |
       WarningCenter / PlannerStatusBar / GuidedPlanRail / AutoWireReviewModal / VerificationSeal
                            [alle lesen dieselben vier Felder, keiner zaehelt selbst]
```

### 4.1 Befund-Typ

`lib/validationSeverity.ts` besitzt bereits „EIN VOKABULAR für Meldungsgard und Meldungszustand"
und mit `countValidationStates` (`:79–97`) schon das eine Zählwerk über Schwere und Zustand.
Domäne, Folge-Text und die sichtbare Zusammenfassung kommen in **dasselbe Modul** — nicht in ein
nebenliegendes `findings.ts`, das eine zweite Heimat wäre:

```ts
export type FindingDomain = DomainClass | 'MIXED' | 'UNKNOWN'; // siehe 4.3
export function consequenceFor(domain: FindingDomain, status: ValidationStatus): string;
export interface FindingSummary {
  verdict: VerificationVerdict;
  criticalCount: number; // severity critical + error
  incompleteCount: number; // status violated/incomplete Trennung bleibt sichtbar
  affectedEntities: number;
  profile: string;
  context: string;
}
export function summarizeFindings(report: VerificationReport): FindingSummary;
```

Die Befundform selbst bleibt die vorhandene `ValidationWarning`
(`components/planner/hooks/useLiveValidation.ts:32–86`) — sie wird um `domain`, `consequence` und
ein Pflicht-`status` ergänzt und bleibt damit abwärtskompatibel zu Prüfsiegel, Guided Steps und
Stückliste, die die Felder schon heute lesen:

```ts
export interface Finding {
  id: string; // stabil: ruleId:entityKind:entityId
  ruleId: string; // eine Registry, kein freies Textfeld
  domain: FindingDomain; // DC_ELV | AC_LV | SENSOR_DATA | FLUID | NON_ELECTRICAL | MIXED | UNKNOWN
  status: 'violated' | 'incomplete' | 'satisfied' | 'not_applicable'; // Pflicht
  severity: 'critical' | 'error' | 'warning' | 'info';
  title: string; // kurz, laienverständlich
  remedy: string; // konkrete Handlung, nie leer
  consequence: string; // domain- und statusabhängig, aus der Engine-Projektion
  message: string; // Begründung (lang) — nur im „Warum?“ sichtbar
  details?: AuditEventDetails;
  rootCauseId?: string; // nur gesetzt, wenn ≥ 1 betroffene Entität existiert
  focus?: { kind: 'node' | 'edge'; id: string };
  source: 'verify' | 'routing' | 'autowire';
}
```

`summarizeFindings(findings, report)` liefert exakt die vier Felder, die irgendwo im Baum als
Zahl sichtbar sind: `verdict`, `criticalCount`, `incompleteCount`, `profileLabel`. Keine Flaäche
darf eine eigene Zahl aus der Liste bilden. Ein Architekturtest verbietet das (Abschnitt 7).

### 4.2 Domäne

Quelle ist das vorhandene Modell, **abgeleitet an einer Stelle, nicht von 68 Aufrufen behauptet.**
Gemessen: `auditEvent(` hat 71 Vorkommen, davon 68 in Produktionsmodulen
(`ampacity.ts` 27, `protection.ts` 21, `topology.ts` 11, `powerPath.ts` 8, `events.ts` 5).
`domain` als Pflichtargument von `auditEvent()` zu verlangen würde diese 68 Stellen anfassen und
jedem Regelimplementierer erlauben, eine Gefährdungsklasse zu nennen, die das Modell widerlegt —
genau die Doppelwahrheit, die `types.ts:259–263` mit der getrennten Speicherung von
`sourceDomain`/`domain` verhindern will.

Stattdessen: `pipeline.ts` besitzt den Leitungsgraphen (`buildConductionGraph`, `:196`) und
projiziert die Domäne **nach** der Sortierung auf jeden Befund, durch eine einzige Funktion

```ts
/** lib/verify/graph.ts — die einzige Ableitung Befund → Gefährdungsklasse. */
export function findingDomainOf(graph: ConductionGraph, entity: EntityRef): FindingDomain;
```

| entity.kind | Ableitung                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------- |
| `edge`      | `CableModel.domain` der Kante (`types.ts:443`)                                              |
| `node`      | Menge der Port-Domänen des Knotens: eine ⇒ die Klasse, mehrere ⇒ `MIXED`, keine ⇒ `UNKNOWN` |
| `path`      | `MIXED`, wenn die Kanten des Pfads verschiedene Klassen tragen, sonst die gemeinsame        |
| `net`       | Klasse des Netzes aus dem Graphen                                                           |
| `system`    | `MIXED` bei Plan-Ebene (z. B. Mischspannung zweier Bänke), sonst `UNKNOWN`                  |

`getEdgeDomain` / `getHandleDomain` (`lib/electrical.ts:796`, `:813`) bleiben die einzigen
Ableitungsstellen für die Basisklassen (`AGENTS.md` §4.5); die Klasse eines Ports berechnet
`domainClassFor` (`lib/verify/graph.ts:344`). Kein Regelmodul nennt eine Domäne.
Nebenbei zu berichtigen: `lib/verify/types.ts:262` bezeichnet `domainClassOf` in `graph.ts` als
die Autorität — diesen Namen gibt es im Repo nicht (einzige Fundstelle ist dieser Kommentar; real
heißt die Funktion `domainClassFor`). Ein Kommentar, der ein Symbol erfindet, ist dieselbe
Klasse Fehler wie eine Zahl, die das eigene Gate nicht beschreibt (`KNOWN-PROBLEMS` AUDIT N3).
`sortEvents`/`attachRootCauses`/`validationStateCountsOf` (`pipeline.ts:225–235`) bleiben
unberührt; der Zertifikat-Hash deckt nur Verdikt, Statusmatrix und Abdeckung ab
(`:249–257`) und ändert sich daher nicht.

### 4.3 Folge-Text

`domain` + `status` entscheiden, nicht `category`. Das Vokabular ist das vorhandene
(`DomainClass`, `lib/verify/types.ts:44–54`: `DC_ELV`, `AC_LV`, `SENSOR_DATA`, `FLUID`,
`NON_ELECTRICAL`), erweitert um zwei Zustände, die kein Leiter haben kann:

```ts
/** Gefährdungsklasse eines BEFUNDS — verbreitert DomainClass um die nicht-leiter-Fälle. */
export type FindingDomain = DomainClass | 'MIXED' | 'UNKNOWN';
```

`MIXED` ist nötig, weil Befunde über Plan-Ebene (Mischspannung zweier Bänke, `entity.kind:
'system'`) genau eine Klasse nicht kennen; `UNKNOWN` für Datenlücken und System-Ereignisse ohne
ableitbaren Leiter. Bestehende `switch`e über `DomainClass` (`graph.ts::domainClassOf`) bleiben
unberührt — die Verbreiterung gilt nur für die Anzeige-Projektion, nicht für das Modell.

| domain           | violated                                                                                                                   | incomplete                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `DC_ELV`         | „Die Leitung kann sich unzulässig erwärmen; ein Fehlerstrom kann ohne Abschaltung bleiben."                                | Zeile „ungeprüft" (wie heute) |
| `AC_LV`          | „Überhitzung und — je nach Schutzorgan — Stromschlaggefahr."                                                               | Zeile „ungeprüft"             |
| `SENSOR_DATA`    | „Dieser Kreis führt Laststrom, obwohl er nur misst; die Messung und die Abschaltung werden unzuverlässig."                 | Zeile „ungeprüft"             |
| `FLUID`          | „Wasser-/Gasführung betroffen — Leckage oder ungewollte Brücke, keine elektrische Gefährdung."                             | Zeile „ungeprüft"             |
| `NON_ELECTRICAL` | „Kein Leiter betroffen; die Aussage betrifft Fläche bzw. Hülle."                                                           | Zeile „ungeprüft"             |
| `MIXED`          | „Mindestens eine Leitung liegt auf der anderen Spannungsebene; Überhitzung und — auf der 230-V-Seite — Stromschlaggefahr." | Zeile „ungeprüft"             |
| `UNKNOWN`        | „Die Spannungsebene dieses Punkts ist nicht bestimmt; eine Gefährdungsangabe wäre eine Annahme."                           | Zeile „ungeprüft"             |

Der Vermerk „230 V", „Netzspannung" oder „Stromschlag" erscheint ausschließlich bei `AC_LV` und
`MIXED`. Die Zeile „ungeprüft" bleibt wortgleich, wie Gate 2 in `WarningCenter.test.tsx:239–245`
sie heute schon hält.

Kein Emoji im Nutzertext: `verificationWarnings.ts:103` setzt `⚠️ Kritisch: ` / `ℹ️ Hinweis: `
vor die Message, und `WarningCenter.tsx:48–54` (`toPlainExplanation`) nimmt sie mit einem
`\p{Extended_Pictographic}`-Regex wieder ab — ein Erzeugen-und-Entfernen-Rundlauf, bei dem die
Schwere bereits als Feld (`severity`, `type`) existiert. Phase 1 entfernt die Präfixe bei den
Produzenten; die Verdiktszeile selbst hat PR #513 schon emoji-frei gemacht (`:601`).

### 4.4 Koordinationskette

`evaluateCableProtection` (`lib/electrical.ts:677`) setzt die Explanation aus den tatsächlich
geprüften Relationen zusammen, je Relation mit Verdict, wie es die Vertragszeile direkt darüber
beschreibt: `I_b = 158,7 A > I_n = 100 A ✗ · I_n = 100 A ≤ I_z = 120,4 A ✓`. Keine flache
`≤`-Kette mehr. Konsumenten: Panel, `scripts/verify/explainCableCurrent.ts`, Export.

### 4.5 Planerpauschale

Rechnerisch unverändert (`DERATE_FACTOR = 0.7`, `lib/electrical.ts:125`; eine Quelle in
`calculateCableIz`). Anzeige:

- Die maßgebliche Größe erscheint **sichtbar** in der Wertzeile, nicht erst im „Warum?“:
  „Zulässig 120,4 A = 172 A × 0,70 Planer-Abminderung (Umgebung 30 °C, single, Verlegeart
  Tabellenreferenz)“
- `details.assumptions` erhält denselben Satz in Klartext.
- `DERATE_FACTOR`, `AUDIT ELE-001`, `f₁/f₂/f₃` verschwinden aus `AuditEvent.message`. Begründung:
  `lib/verify/types.ts:608` verspricht für `message` „Klartext für den Nutzer (deutsch, ohne
  Engineering-Jargon)“ — der heutige AMP-001-Text enthält beides. Interne Bezeichner bleiben in
  `ruleId`, `standard`, `provenance` und im „Warum?“.

### 4.6 Ein Profil

`PLANNER_VERIFICATION_OPTIONS` (PRACTICE/VEHICLE) wird die einzige Profilangabe der Anwendung und
wird von Panel, `validation158.regression.test.ts`, `explainCableCurrent.ts`, Golden-Master- und
Regresionstests gelesen. Die Engine darf weiterhin mit anderen Profilen gefahren werden (Normkern-
Tests), aber jede Zahl, die ein Mensch sieht, nennt Profil und Kontext daneben.

## 5. Komponenten und Dateien

| Datei                                                          | Änderung                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/electrical.ts`                                            | `VDE_SIZES`/`VDE_AMPACITY` zurück auf 70; `evaluateCableProtection`-Explanation je Relation mit Verdict                                                                                                                                                                                                                                                   |
| `lib/vde-standards.ts`                                         | Re-Export unverändert (Konsistenztest `vde-consistency.test.ts:201` verlangt Referenzgleichheit)                                                                                                                                                                                                                                                          |
| `lib/cableSizing.ts`                                           | `findMinimumValidCable`, `CableSizingStatus`, `FindMinimumValidCableResult` entfernen (keine Konsumenten)                                                                                                                                                                                                                                                 |
| `lib/verify/validation158.regression.test.ts`                  | Phase-2-Block aus `137858f` entfernt: drei Dupletten von Phase 1, drei 120-mm²-Fälle, ein Fall ohne Prüfung im Namen                                                                                                                                                                                                                                      |
| `lib/verify/types.ts`                                          | `FindingDomain` (Verbreiterung von `DomainClass`, `:44–54`), `AuditEvent.domain: FindingDomain`                                                                                                                                                                                                                                                           |
| `lib/verify/graph.ts`                                          | `findingDomainOf(graph, entity)` — die einzige Befund→Klasse-Ableitung (Abschnitt 4.2)                                                                                                                                                                                                                                                                    |
| `lib/verify/pipeline.ts`                                       | projiziert `domain` auf jeden sortierten Befund (`:225–235`); Regelmodule nennen keine Domäne                                                                                                                                                                                                                                                             |
| `lib/validationSeverity.ts`                                    | `consequenceFor`, `FindingSummary`, `summarizeFindings` (bestehendes Vokabular-Modul, keine zweite Heimat)                                                                                                                                                                                                                                                |
| `lib/verify/rules.ts`                                          | neue Regel-Einträge für die 17 elektrischen Altbefunde (`RULE_MATRIX`, `:76`)                                                                                                                                                                                                                                                                             |
| `lib/verify/{topology,ampacity,protection,powerPath,rules}.ts` | Literal je neuer Regel (Bijektion `rules.test.ts:86–93`)                                                                                                                                                                                                                                                                                                  |
| `lib/routing/invariants.ts` o. `finalValidation.ts`            | deklarierte Projektion der Lock-Befunde auf `Finding`                                                                                                                                                                                                                                                                                                     |
| `lib/autoWire/conflicts.ts`                                    | deklarierte Projektion der Konflikte/Fragen auf `Finding`                                                                                                                                                                                                                                                                                                 |
| `components/planner/hooks/useLiveValidation.ts`                | 21 Literale entfernen; nur noch Eingabe, Fokus, Sortierung                                                                                                                                                                                                                                                                                                |
| `components/planner/utils/verificationWarnings.ts`             | Projektion auf `Finding` (Domäne, Status, Folge, Abhilfe)                                                                                                                                                                                                                                                                                                 |
| `components/planner/ui/WarningCenter.tsx`                      | `consequence()` (94), `nextStep()` (332), `isUnverifiedFinding()` (85), `UNVERIFIED_WARNING_PREFIXES` (71), `counts` (425), `stateCounts` (448), `groupCounts` (405), `rootCauses` (436) entfernen; `summarizeFindings` lesen; `message` ins „Warum?“; Emoji bei den Produzenten weg (`verificationWarnings.ts:103`), nicht erst beim Anzeigen abgegrenzt |
| `components/planner/ui/PlannerStatusBar.tsx:36`                | nicht mehr `store.plannerErrors`, sondern dieselbe Summary                                                                                                                                                                                                                                                                                                |
| `components/planner/utils/guidedSteps.ts:131`                  | dieselbe Summary                                                                                                                                                                                                                                                                                                                                          |
| `components/planner/AutoWireReviewModal.tsx:58`                | dieselbe Summary                                                                                                                                                                                                                                                                                                                                          |

Reihenfolge ist erzwungen: Matrix + Pass-Impl **vor** UI, sonst sind
`verificationWarnings.test.ts:166` (`rulesApplied === 29`) und `rules.test.ts:86–93` rot.

## 6. Fehlerbehandlung und eingebaute Verbote

- Fehlende Eingabe ⇒ `incomplete`, nie `satisfied`, nie `PASS` (Regel M,
  `docs/ai/ARCHITECTURE-RULES.md:149–156`; erzwungen durch `events.ts:131–149`,
  `safety-no-silent-fallback.test.ts:31–33`).
- Keine stillen Fallback-Werte. `length === null` bleibt null
  (`verificationWarnings.ts:31–37`).
- UI darf keine Schwere umwerten (`validationSeverity.ts:19–22`). Die Neuregelung geht weiter:
  die UI bildet auch keine Folge mehr und zählt nicht.
- `rootCauseId` wird nur gesetzt, wenn die betroffenen Entitäten nicht leer sind; eine leere
  Gruppe ist eine Deckungsaussage (`coverage`), kein Befund und zählt nicht in „Ursachen“.
- Determinismus: keine `Math.random`, keine ungeordnete Iteration; `Finding.id` ist
  `ruleId:entityKind:entityId` und die Sortierung ist `severityRank` dann `id`
  (`verificationWarnings.ts:211–213` bleibt Muster).

## 7. Testing

Neue oder geänderte Gates, jeweils mit dem Befehl, der sie prüft:

1. **Grundlinie.** `npx vitest run` vollständig, allein, un-gepipelt. Exit 0.
2. **Kein Domänen-Leak.** `WarningCenter.test.tsx`: für jeden Befund mit `domain: 'DC'` gilt
   `not.toContain('230')` und `not.toContain('Stromschlag')`; für `AC` gilt das Gegenteil. Der
   heutige Block `:247–255` („echte Defekte behalten die Kategorie-Folge“) wird durch diese
   Matrix ersetzt — er hat bis `6b22600` eine domänenblinde Aussage erzwungen.
3. **Ein Zähler.** Für alle 10 Referenzpläne und alle drei Profile: Panelzahlen ==
   `summarizeFindings`-Felder == `report.stateCounts`. Parameterisierter Test über den Plan-Bestand.
4. **Reproduzierbarkeit.** `verifyPlan(plan)` zweimal, Ergebnisliste bytegleich; Gleiches für
   AutoWire + Prüfung in Folge (Punkt 2 des Auftrags, in diesem Paket als Gate, nicht als Feature).
5. **Keine zweite Auszählung.** Architekturtest: in `components/**` darf weder
   `.filter((w) => w.type === 'critical').length` noch `id.startsWith(` für Befundtexte stehen,
   und kein `ValidationWarning`-Literal wird außerhalb der Projektion erzeugt.
6. **Ein Profil.** Test, dass jede sichtbare Zahl aus
   `PLANNER_VERIFICATION_OPTIONS` kommt; `verify:explain` und die 158,7-A-Regression nutzen
   denselben Export.
7. **Koordinationstext.** Unit-Test auf `evaluateCableProtection`: bei `ib > in` muss die
   Explanation `>` und das Zeichen für „nicht erfüllt“ enthalten; die Form `… ≤ …` mit
   `ib > in` ist verboten.
8. **Eigenes Timeout.** `lib/routing/rules/intCosts.test.ts:101` (250 000 Iterationen) erhält ein
   eigenes Timeout, wie es der Branch `feat/camp-seo-metadata-layer` für einen anderen
   Property-Test bereits tut. Messung: allein 7,27 s gegen 15 s Standard ⇒ ~2x Marge; im
   Gesamtlauf wurde 18,5 s gemessen und der Test fiel mit `Test timed out in 15000ms`.
9. **Bestehende Gates unverändert grün:** `npm run routing:audit` (I1–I7 = 0, Fallback 0),
   `npm run perf:edge-routing` (beide Gates), `npm run test:regression` (byte-exakte SVGs),
   `npm run test:goldenmaster`, `npm run check` (lint, format, typecheck, typecheck:tests,
   coverage).

## 8. Phasen und Exit-Kriterien

| Phase | Inhalt                                                                                                                                 | Exit                                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 0     | E1 rückgängig: Tabelle auf 70, `findMinimumValidCable` weg, `≤`-Kette mit Verdict, `isAc`-Heuristik raus                               | die 8 Fehlschläge von 2.1 sind grün; 81 Zeilen `cableSizing.ts` weniger; `npm run build` ok                   |
| 1     | `domain`/`status` Pflicht, `Finding` + `summarizeFindings`, `consequence`/`nextStep` aus der UI                                        | Gates 2, 3, 5, 7 grün                                                                                         |
| 2     | 17 elektrische Altbefunde in Matrix + Pass-Impl (19 neue IDs, Anhang A); 4 nicht-elektrische über deklarierte Projektion               | `rulesApplied` 29 → 48 bei PRACTICE/VEHICLE; jedes Literal hat `remedy`; kein Befund fällt in den Auffangtext |
| 3     | Flächen lesen nur noch die Summary (Panel, Statuszeile, GuidedPlanRail, ReviewModal, Seal)                                             | Gate 3 über alle Referenzpläne; Gate 5                                                                        |
| 4     | Profil-Konsolidierung, Planerpauschale-Klartext, Jargon aus `message`                                                                  | Gates 6, 1; `explainCableCurrent` nennt Profil und zeigt die 0,7 sichtbar                                     |
| 5     | Panel-Dichte: `message` ins „Warum?“, Wertzeile + Abhilfe sichtbar, Emoji raus, Mobil-Kante gegen `tests/e2e/controls-overlap.spec.ts` | Playwright `controls-overlap`, `responsive`, `touch`, `expert-panel` grün                                     |
| 6     | Determinismus- und Wiederhol-Gate über den Plan-Bestand                                                                                | Gates 4, 8, 9                                                                                                 |

## 9. Ausdrücklich nicht in diesem Paket

- **Punkt 5 vollständig.** Der Bestand ist zweigeteilt: `knownPlans/*.json` (6) und
  `lib/verify/planFixtures.ts` (3) plus `validation158Fixture` sind verschiedene Welten ohne
  gemeinsamen Lader. Die Vereinigung und die Referenz-Auszahlung über Export und SVG ist ein
  eigenes Paket; hieraus werden nur die Gates 3 und 4 über den Bestand gezogen, die ohne
  Vereinigung möglich sind.
- **Punkt 2 als Feature.** Kein neues Routing. Die Stabilität wird über Gate 4 gemessen; die
  offenen ROUTE-001/002/003/006/009 und PERF-001 bleiben, wie in `docs/ai/KNOWN-PROBLEMS.md`
  geführt.
- **Punkt 3 als neues UI-System.** PR #513 (`75ad621`) hat Shell, Palette, Inspector-Sektionen und
  die „Planungsprüfung“ als Blatt am Fenster bereits gebaut; dieser Plan ändert diese Flächen nur
  in Inhalt und Dichte, nicht in ihrer Existenz oder Position.
- **Stücklisten-Reihenfolge.** `BOMModal.tsx` wird erst nach Phase 2 geprüft, weil die Empfehlungen
  sich durch die neuen Regeln ändern können.

## 10. Risiken

1. **Gleichzeitige Änderung am selben Code.** `137858f` und `75ad621` kamen beide am 08./09.10. von
   `arena/*`-Branchen und haben sich nicht abgestimmt (PR #515 hat eine UI-Heuristik auf eine
   Fläche gesetzt, die PR #513 umgebaut hatte). Dieser Branch muss vor jedem Push gegen `origin`
   geprüft werden.
2. **Die 95/120-Rücknahme nimmt eine Fähigkeit.** Oberhalb 120,4 A bleibt der Plan
   „außerhalb des Modells“. Das ist gewollt (E1) und muss als Befund lesbar bleiben, nicht als
   Schweigen — deshalb Gate 7 und Phase 0.
3. **17 neue Regeln bewegen `rulesApplied` und damit Siegel, Abdeckung und Guided Steps.** Jeder
   dieser Werte ist sichtbar; Phase 2 endet erst, wenn die Referenzpläne durchgerechnet sind.
4. **Der 250k-Property-Test bleibt maschinenempfindlich.** Das eigene Timeout macht ihn nicht
   schnell; es macht ihn nur vorhersagbar. Die eigentliche Ursache (Erwartung an
   Standard-Timeouts in einem parallelen Runner) bleibt als bekannte Grenze stehen.
5. **Kein CI-Lauf von hier belegbar.** `gh` ist nicht installiert; die Gates werden lokal
   ausgeführt. Ein Blick auf `api.github.com` für die Actions bleibt nötig (Punkt 5).

## 11. Bindende Konventionen aus `AGENTS.md`, die diesen Plan berührt

| Stelle          | Regel                                                                                                                                                                    | Auswirkung                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4.2            | „Eine Stromquelle verwenden … nie einen zweiten Strompfad bauen. (Die frühere `calculateAcEdgeCurrent` hatte null Produkt-Consumenten und ist entfernt, AUDIT ELE-009.)" | Phase 0Löscht `findMinimumValidCable` aus demselben Grund wie damals ELE-009: null Produktions-Consumenten, zweite Implementierung                                         |
| §4.5            | „Domänen nur über `getEdgeDomain`/`getHandleDomain` bestimmen"                                                                                                           | Phase 1 nutzt genau diese beiden, keine dritte Ableitung                                                                                                                   |
| §4.10 / §5      | „Nie eine VDE-/Normaussage erfinden"; „Unbekannte elektrische Daten als gültig behandeln oder Sicherheitsurteile raten" verboten                                         | Begründet E1 (Rücknahme 95/120) und E5 (die UI dichtet keine Folge mehr)                                                                                                   |
| §6 DO NOT TOUCH | `lib/electrical.ts` Sicherungsgrenzen, `lib/vde-standards.ts` — „nur mit Tests + expliziter Review"                                                                      | Phase 0 fasst `VDE_SIZES`/`VDE_AMPACITY` und `evaluateCableProtection` an. Explizit freigegeben am 2026-10-09 (Entscheidung E1); die Tests in §7 sind die Review-Grundlage |
| §6              | `knownPlans/*`, `scripts/goldenmaster/snapshots/*`, `scripts/regression/__snapshots__/*` sind eingefrorene Wahrheit                                                      | Phase 2 darf sie nur mit begründetem Recapture bewegen                                                                                                                     |
| §7              | „Gate vor jedem Commit: `npm run check`"                                                                                                                                 | Jeder Phase endet mit `npm run check` allein, un-gepipelt, Exit abgefragt                                                                                                  |
| §8              | „Ein PR pro Aufgabe"; „Neue Erkenntnisse als neue IDs unten anhängen, bestehende Texte nicht umschreiben"                                                                | Phase-Ergebnisse bleiben getrennt; die Befunde aus 2.1–2.7 werden am Ende als neue IDs in `docs/ai/KNOWN-PROBLEMS.md` angehängt                                            |
| §9              | „Responsive: 375 / 768 / 1440"; „Ein Commit pro Aufgabe; jeder Bugfix mit Regressionstest"                                                                               | Phase 5 misst an `tests/e2e/controls-overlap.spec.ts` und `responsive.spec.ts`                                                                                             |

## Anhang A — die 19 neuen Regel-IDs

Quelle ist das Literal im Hook; `pass` folgt der Zuordnung in `PASS_DEFINITIONS`
(`lib/verify/pipeline.ts:138–152`). `ELE-*`-, `BANK-*`-, `DATA-*`- und `AUTO-*`-IDs sind heute
freie Strings in `ValidationWarning.ruleId` und werden durch IDs aus der geschlossenen `RuleId`-
Union ersetzt. Die Kollision `TOPO-002-dcdc-house-path` (Hook `:776`, `:795`) gegen die Engine-
`TOPO-002-shunt-direct-bypass`/`-003` wird durch Umbenennung aufgelöst, nicht durch Überladen.

| neue ID                           | Pass | bisheriges Literal                      | domain  | status bei fehlender Eingabe |
| --------------------------------- | ---- | --------------------------------------- | ------- | ---------------------------- |
| `SYN-005-voltage-undeclared`      | SYN  | `:294` `mixed-voltage-unknown`          | MIXED   | incomplete                   |
| `SYN-006-voltage-mixed-banks`     | SYN  | `:312` `mixed-voltage-batteries`        | MIXED   | violated                     |
| `DOM-003-bank-member-count`       | DOM  | `:367` Variante `member-count-mismatch` | DC_ELV  | violated                     |
| `DOM-004-bank-declaration`        | DOM  | `:367` Variante `declaration-mismatch`  | DC_ELV  | violated                     |
| `DOM-005-bank-counts-missing`     | DOM  | `:367` Variante `missing-counts`        | DC_ELV  | incomplete                   |
| `DOM-006-invalid-load-value`      | DOM  | `:818` `invalid-load`                   | UNKNOWN | violated                     |
| `TOPO-006-parallel-chemistry`     | TOPO | `:409` `battery-parallel-chemistry`     | DC_ELV  | violated                     |
| `TOPO-007-solar-direct`           | TOPO | `:543` `solar-direct`                   | DC_ELV  | violated                     |
| `TOPO-008-dcdc-partial`           | TOPO | `:730` `dcdc-unconnected`               | DC_ELV  | violated                     |
| `TOPO-009-dcdc-no-house-battery`  | TOPO | `:769` `dcdc-no-house-battery`          | DC_ELV  | violated                     |
| `TOPO-010-dcdc-house-path`        | TOPO | `:788` `dcdc-house-path`                | DC_ELV  | violated                     |
| `PWR-002-mppt-load-rating`        | PWR  | `:567` `solar-overload`                 | DC_ELV  | violated                     |
| `AMP-007-cold-voc-window`         | AMP  | `:465` `solar-voc-window`               | DC_ELV  | violated                     |
| `AMP-008-cold-voc-undeclared`     | AMP  | `:439` `solar-voc-window-unknown`       | DC_ELV  | incomplete                   |
| `AMP-009-cold-voc-missing-data`   | AMP  | `:485` `solar-voc-missing`              | DC_ELV  | incomplete                   |
| `AMP-010-cold-voc-uncomputable`   | AMP  | `:507` `solar-voc-uncomputable`         | DC_ELV  | incomplete                   |
| `AMP-011-bms-discharge-limit`     | AMP  | `:596` `bms-discharge`                  | DC_ELV  | violated                     |
| `AMP-012-bms-charge-limit`        | AMP  | `:615` `bms-charge`                     | DC_ELV  | violated                     |
| `AMP-013-component-current-limit` | AMP  | `:708` `component-limit`                | DC_ELV  | violated                     |

17 Literale, 19 IDs (das Bank-Literal trägt drei Varianten). Die Nummern sind gegen die bestehende
Union `RuleId` (`lib/verify/types.ts:206–240`) geprüft: belegt sind dort SYN-001…004, DOM-001…002,
TOPO-001…005, AMP-001…006, VDR-001…002, PWR-001, GND-001, RCD-001…006, NET-001…002 — die
Vorschläge setzen hinter dem jeweils höchsten Belegten an. Die Kollision
`TOPO-002-dcdc-house-path` (Hook `:776`, `:795`) gegen die Engine-`TOPO-002-shunt-direct-bypass`
löst sich durch die neue Nummer `TOPO-010`, nicht durch Überladen von `TOPO-002`. Für jede ID gilt: `standard`/`provenance` aus der Matrix, `clause` nur bei
`VERIFIED_NORM`, `limitation` bei `MODEL_ASSUMPTION`/`UNVERIFIED`
(`rules.test.ts:70–82`), `autoFixRemedy` nie leer (`events.ts:77–79`).

Die vier nicht-elektrischen Literale (`:862`, `:898`, `:941`, `:961`) erscheinen hier nicht — sie
bekommen denselben `Finding`-Typ über eine Projektion in ihrem eigenen Modul (Abschnitt 3,
Begründung bei E2).
