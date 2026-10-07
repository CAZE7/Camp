# AUDIT STROMBERECHNUNG & VALIDATION — 2026-10-07

Auftrag: «Die elektrische Berechnung und Validierung muss fachlich korrekt,
topologieabhängig, deterministisch, nachvollziehbar und für den Nutzer
verständlich sein.»

## 1. Datenflussbild (IST)

```
Components (nodes/edges — zustand store, localStorage)
   ↓
Electrical Graph            lib/verify/graph.ts (buildConductionGraph)
   │   cable.currentA := calculateEdgeCurrent(source, target, nodes, U, edges)
   │                     (lib/vde-standards.ts)  ← HEURISTIK
   │   AC: acCurrentA(source, target, nodes, edges) (lib/autoWire/sizing.ts)
   │   Port-Domäne aus Knotentyp (lib/domain/handleDomains.ts)
   ↓
Power / Current Model       lib/electricalGraph (batteryBank, currentBudget,
   │                        powerSystem) — NICHT in der Stromrechnung
   ↓
Current Propagation         (existiert nicht — Kanten-Heuristik statt Graph)
   ↓
Cable Sizing                lib/electrical.ts (VDE_AMPACITY, DERATE_FACTOR 0.7,
   │                        FUSE_MAP, calculateCrossSection)
   ↓
Protection Checks           lib/verify: AMP-001…006 (ampacity.ts),
   │                        RCD-001…006 / NET / GND (protection.ts),
   │                        VDR / PWR (powerPath.ts), SYN/DOM/TOPO (topology.ts)
   ↓
Validation Rules            lib/verify/rules.ts (RULE_MATRIX, 5 Pässe)
   ↓
Severity Classification     types.ts: CRITICAL_SAFETY / CODE_VIOLATION /
   │                        EFFICIENCY_WARNING × VIOLATION / UNVERIFIABLE
   ↓
UI                          verificationWarnings → useLiveValidation →
                            WarningCenter („X von Y kritisch“),
                            CableEdge-Label (calculateEdgeCurrent direkt)
```

## 2. Beantwortung der 14 Audit-Fragen (IST)

1. **Ib-Berechnung:** `calculateEdgeCurrent` (lib/vde-standards.ts:296) —
   6 Prioritäten: totalAmps → Solar → consumer → inverter (Insel-BFS) →
   generische amps → **globaler Fallback**. AC: `acCurrentA`
   (lib/autoWire/sizing.ts:354) — nur in der verify-Engine und in
   CableEdge-Labels bei `edgeDomain === 'AC_230V'`.
2. **Iz-Berechnung:** `effectiveAmpacityA` (lib/verify/physics.ts:283):
   `Iz = Basis × min(DERATE_FACTOR 0.7, f₁(ϑ_U) · f₂(n))`.
3. **Lasten-Aggregation:** Fallback-Priorität 6 von `calculateEdgeCurrent`:
   `max(Σ consumer-Ströme, Σ Ladegeräte-Ströme)` über **ALLE** Knoten des
   Plans (keine Konnektivität!).
4. **Propagation über den Graph:** existiert nicht. Die Heuristik pro Kante
   kennt nur die beiden Endknoten (Insel-BFS nur für Wechselrichter).
5. **Abzweigungen:** nicht modelliert — jede Kante ohne Endpunkt-Regel trifft
   den globalen Fallback (gleicher Strom wie auf der Hauptleitung).
6. **Parallelpfade:** nicht modelliert — parallele Kanten erhalten jeweils
   den vollen Fallback-Strom (Doppelzählung).
7. **Lade-/Entladeströme:** `max(Last, Ladung)` global (nicht topologisch).
8. **Battery-Bank-Topologie:** `deriveBatteryBanks` (batteryBank.ts) existiert
   und wird für Fragen/Grenzen genutzt — aber **nicht** in der Stromrechnung.
9. **`0.7`:** `DERATE_FACTOR` (lib/electrical.ts:130) — einmal angewandt in
   `effectiveAmpacityA` (min mit f₁·f₂), in `lookupThermalCrossSection`, in
   `FUSE_MAP` (abgeleitet). Keine Doppelanwendung gefunden; Herkunft
   `plannerSafetyFactor` nur implizit.
10. **Umgebung/Häufung:** `ambientTemperatureFactor` (f₁) +
    `groupFactor` (f₂, lib/electrical.ts:76) — über Lauf-Optionen
    (bundledCircuits), keine pro-Kabel-Installation in der Praxis gesetzt.
11. **AC/DC-Trennung:** Engine trennt (isDcLike, AC-Rules), aber
    `calculateEdgeCurrent` mischt: AC-Kanten ohne AC-Endpunkt (z. B.
    Busbar→consumer230v) fallen in den DC-Global-Fallback; Port-Domänen
    durchqueren sich an Durchführungen (s. u.).
12. **Severity:** `ruleSpec.severity` (rules.ts) + `input.severity`-Override;
    UI-Mapping: CRITICAL_SAFETY+VIOLATION → `critical`,
    CODE_VIOLATION/EFFICIENCY+VIOLATION → `warning`, UNVERIFIABLE → `info`.
13. **critical:** `verificationWarning` (verificationWarnings.ts:110):
    `isGap ? info : (severity === CRITICAL_SAFETY ? critical : warning)`.
14. **„12 von 36 kritisch“:** `WarningCenter` badgeLabel:
    `counts.critical` = Warnungen mit `type === 'critical'` (Engine-Violations
    CRITICAL_SAFETY + Planer-Regeln) von `warnings.length` (alle
    Engine-Befunde + Planer-Hinweise).

## 3. ROOT CAUSES (mit Reproduktion, scripts/probe/repro158.ts / repro2.ts)

### RC-1 — Globaler Last-Fallback ohne Topologie (Ib = 158.7 A)

`calculateEdgeCurrent` Priorität 6 summiert **alle** `consumer`- und
`inverter`-Lasten des Plans, unabhängig von Konnektivität. Jede Kante, deren
Endpunkte keine Endpunkt-Regel erfüllen (Batterie→Shunt, Shunt→Schiene,
Schiene→Sicherungskasten, Subpanel-Zuleitung, Minus-Rückleitung), erhält den
Gesamtstrom des Plans. Folgen:

- Nebenäste bekommen den Gesamtstrom (Test A des Auftrags verletzt).
- Lasten fremder Subsysteme (Starterseite, zweite Insel) zählen mit.
- AC-Kanten ohne AC-Endpunkt (Busbar→consumer230v) fallen in denselben
  Fallback → DC-/AC-Mischung (Repro: 229.4 A auf 230-V-Abzweig).

### RC-2 — Port-Domänen von Durchführungen sind hart auf DC gefixt

`domainClassFor` (lib/verify/graph.ts:262) leitet die Port-Domäne aus dem
KNOTENTYP. `busbar`/`fuse` sind immer DC_12V. Ein 230-V-Kreis, der über
einen Busbar-/Fusenknoten verteilt wird (der einzige verfügbare „AC-Verteiler“
im Bauteilkatalog), erzeugt:

- SYN-004 „domain crossing“ CRITICAL auf JEDEM Kabel der AC-Verteilung
  (Busbar-Port DC_ELV ↔ Inverter/Consumer AC_LV).
- Die AC-Schutzpfad-Suche (`acWalk`, protection.ts) bricht an Busbar-Ports
  ab (`target.domain !== 'AC_LV'` → stopp; `cable.domain !== 'AC_LV'` →
  Kante übersprungen) → 230-V-Verbraucher gelten als „ohne FI“ oder
  „kein Versorgungspfad“ → RCD-001 CRITICAL „Fehlerstromschutz je
  Stromkreis (≤ 30 mA)“, obwohl ein FI/LS vorgeschaltet liegt.
  Die RCD-Regel prüft also nicht die vorhandene Schutzkette, sondern die
  Erreichbarkeit über AC-typisierte Ports.

### RC-3 — Zählung/Klassifizierung ohne Gruppierung

WarningCenter zeigt `12 von 36 kritisch` ohne Trennung
Sicherheitsfehler / Planungsfehler / fehlende Angaben; 12 kritisch entstehen
überwiegend aus RC-1 (falsche Ib → AMP-001) und RC-2 (SYN-004 + RCD-001).

### RC-4 — Keine Explainability

`cable.currentA` trägt keinen contributors-/Methoden-Hinweis; die Iz-Faktoren
(0.7 als Planerpauschale vs. f₁/f₂) stehen im Text, aber kein strukturierter
`calculation`-Block je Befund.

### RC-5 — Battery-Bank nicht in der Stromrechnung

Kein bank-bewusster Parallel-Aufteil-Faktor; BMS-Prüfung (useLiveValidation)
nutzt die Kanten-Heuristik statt des Bankstroms.

## 4. KORREKTURKONZEPT

1. **Neue Domain-Schicht `lib/electricalGraph/currentFlow.ts`** —
   topologieabhängiger Stromfluss-Modell (rein, deterministisch, ohne
   React): Knotenklassifikation (flexible Quelle = Batterie/String,
   fixe Quelle = Ladegerät/Panel/WR-AC, Last, Durchführung),
   Serien-Strings kollabieren, Pfadenaufzählung je Last/Quelle mit
   definierter Aufteilungsregel (gleiche flexible Quellen: Equal-Split;
   fixe Quellen: Pro-Rata; gemischte Typen: konservativ volle Last),
   bidirektionaler Strom = max(Lastfluss, Ladefluss) — mit vollständiger
   `CableCurrentExplanation` (contributors, Richtung, Methode, Annahmen).
2. **verify-Engine** nutzt das Modell als EINZIGE Ib-Quelle
   (`buildConductionGraph`); AMP-001-Befunde tragen strukturierte
   `details` (Ib/In/Iz, contributors, Iz-Aufschlüsselung).
3. **AC-Domänen-Fix:** Port-Domäne von PASSIVE/PROTECTION/MEASUREMENT-Knoten
   wird aus den angeschlossenen Kabeln abgeleitet (einheitlich AC → AC-Port);
   Kabel-Domäne kommt aus der Edge-Domänen-Autorität (getEdgeDomain),
   nicht aus dem From-Port. SYN-004 bleibt für echte Kreuzungen
   (Nicht-Durchführung).
4. **Zentrale `calculateCorrectedIz`** (lib/electrical.ts) mit expliziter
   Aufschlüsselung (baseIz, ambientFactor, groupingFactor,
   installationFactor, plannerSafetyFactor, correctedIz, explanation) —
   Derating bleibt exakt EINE Anwendung (min(0.7, f₁·f₂)).
5. **UI:** CableEdge-Label + useLiveValidation (BMS/Bauteilgrenzen) lesen
   aus dem Modell (gemeinsamer Cache pro Render); WarningCenter zeigt
   Urteilszeile + Gruppierung (Sicherheitsfehler/Planungsfehler/Angaben
   fehlen); Befundkarten mit kompakten Werten + aufklappbarem „Warum?“.
6. **Determinismus-Tests** (×100), Regressionstests A–I, Debug-CLI
   (scripts/verify/debugValidation.ts).

## 5. Was NICHT geändert wird

- AutoWire-Sizing bleibt bei `calculateEdgeCurrent`/`acCurrentA`
  (Vorschlagsphase, nicht die Validierungs-Ursache); das Modell ist für die
  dort dimensionierten Endpunkt-Kanten wertegleich (Endpunkt-Regel =
  Spezialfall des Fluss-Modells) und liefert auf Hauptleitungen ≤
  Vorschlagsstrom → keine neuen Fehlalarme.
- Normwerte, Regelmatrix-Inhalte, Schwellenwerte, Routing, UI-Layout
  (außer den genannten Anzeigepunkten).

---

## 6. AUFLÖSUNG (2026-10-07) — Phasen 1–12 abgearbeitet

| Audit-Befund                               | Auflösung                                                                                                                                     | Beweis                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| RC-1 Globaler Fallback (Ib = 158,7 A)      | Topologie-Strommodell + leitwertgewichtete Parallelpfade; jede Kante trägt ihren eigenen Fluss                                                | `lib/electricalGraph/currentFlow.split.test.ts` (1/2/3/4/5), `validation158.regression.test.ts` |
| 158,7-A-Fall                               | als Reproduktions-Fixture eingefroren: 1500-W-WR (147,06 A) + Kühlbox (5 A) + Pumpe (6,67 A) = 158,73 A auf dem Hauptstrang, 11,67 A im Zweig | `lib/verify/validation158.regression.test.ts`                                                   |
| RC-2/RC-4 FI-Prüfung am falschen Ort       | `analyseAcProtectionChains`: Schutzpfad je Verbraucher (Quelle → FI → LS → Verteiler → Verbraucher), inkl. „FI existiert woanders“            | `lib/verify/validationStates.test.ts` (13/14/15)                                                |
| RC-5 Doppelzählung beim Reihenwandler      | `dualRoleTopology` + Seitenzuordnung (Eingang = Zielkante, Ausgang = Quellkante)                                                              | `currentFlow.split.test.ts` (6/6b), Golden-Master-Delta `complex.json`                          |
| RC-3 „12 von 36 kritisch“ ohne Gruppierung | `severity`/`status`/`rootCauseId` je Befund + Zählwerk `stateCounts` + Ursachengruppen                                                        | `validationStates.test.ts`, `WarningCenter`                                                     |
| ELE-002 70-mm²-Sättigung                   | `thermalCrossSectionFor` ⇒ `outside-model` + UI-Satz „Für diesen Strom liegt keine hinterlegte Belastbarkeitstabelle vor“                     | `validationStates.test.ts` (11/12)                                                              |
| Iz-Pfade an mehreren Stellen               | `calculateCableIz` + `evaluateCableProtection`; `collectEdgeErrors` rechnet kein zweites `VDE_AMPACITY × 0,7` mehr                            | `lib/electrical.test.ts`, `lib/verify/physics.test.ts` (unverändert grün)                       |

**Nicht geändert (bewusst):** `DERATE_FACTOR = 0,7` bleibt als dokumentierte
Planerpauschale in Kraft (kein Entfernen, kein Abschwächen); Critical-Meldungen
bleiben critical, wo eine Verletzung widerlegt ist; Fehler wurden nicht
abgeschaltet, Tests nicht geskippt.

**Verbleibende Modellgrenzen:** Tabelle endet bei 70 mm² (Aussage wird
ausgewiesen, nicht geraten); Verlegeart/Isolierstoff nur über f₁/f₂ abgebildet;
Schutzkette ist ein EINLEITER-Modell (L/N/PE nicht einzeln); Wechselrichter-Insel
bleibt elektronisch begrenzt (`inverter-limited`); vorgelagerte Netzimpedanz
bleibt die dokumentierte Annahme 0,8 Ω.
