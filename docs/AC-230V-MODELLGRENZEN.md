# 230-V-Modellgrenzen — explizite Absicherung (2026-11-04)

> **Geltungsbereich:** Die ursprüngliche P0-Sprint-Aufgabe bestand aus genau drei
> Punkten (Routingvalidierung, BMS-Constraint, fahrzeugspezifische
> Kabeldimensionierung). Der 230-V-Punkt der P0-Tabelle gehörte **nicht** dazu.
> Dieses Dokument beschreibt den Nachlauf: Die Modellgrenzen werden **explizit
> abgesichert**, nicht geschlossen. Es entsteht **keine** neue L/N/PE-Architektur,
> **kein** Netzform-/Umschalt-/Rückspeisemodell und **keine** normgeprüfte Abnahme.
>
> **Die 230-V-Prüfung und die Abnahme dürfen nur durch entsprechend
> qualifiziertes Personal erfolgen. Dieser Bericht ist kein Normnachweis.**

---

## 1. Ausgangslage

Vor diesem Nachlauf stand die Einleiterigkeit des Modells in Kommentaren, im
SEO-Text (`lib/seo/content/230v.ts`) und in `ENGINE_LIMITATIONS`
(`lib/verify/pipeline.ts`); außerdem prüften `NET-001`/`NET-002` deklarierte
Datenfelder und `RCD-001…006` die Schutzorganisation. Was fehlte: ein
**prüfbares Gate**, das für einen konkreten Plan mit 230-V-Kreisen einzeln
ausweist, welche Punkte das Modell _nicht_ bewertet. Ohne ein solches Gate konnte
ein `COMPLIANT`/`INCOMPLETE` im Prüfsiegel als „230 V geprüft" gelesen werden.

Es wurde bewusst die kleine Alternative gewählt: **Absichern statt
Modellieren.** Jede neue L/N/PE-Kante, jede Netzformlogik und jede
Umschaltverriegelung wäre ein neues Feature ohne Freigabe (`AGENTS.md` Zeile 95)
und würde eine normative Abnahme nur vortäuschen.

---

## 2. Die drei Bewertungsstufen

Der Prüfbericht, die Warn-Zentrale und dieses Dokument verwenden **dieselben**
Stufen (`AC_ASSESSMENT_LABEL` in `lib/verify/acScope.ts`). Sie werden nie
gleichwertig dargestellt.

| Stufe                                          | Bedeutung                                                                                                 | Belege im Modell                                                                                                                                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **rechnerisch bewertet** (`computed`)          | Aus Plandaten und der dokumentierten Tabellenbasis bestimmt; Ergebnis mit Rechenweg im Bericht/Inspektor. | `AMP-001…006` (I_b ≤ I_n ≤ I_z), `VDR-001/002` (ΔU), `RCD-005` (Abschaltbedingung als Modellrechnung), Querschnittsermittlung. Gilt für die **eine** Leitung des Single-Line-Modells.                                                        |
| **mit Annahmen bewertet** (`assumption-based`) | Ergebnis hängt an deklarierten Feldern oder einer benannten, als `UNVERIFIED` geführten Modellannahme.    | `NET-001`/`NET-002` (`systemForm`, `neutralEarthBond`), `UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0,8` (ELE-002), 2/3-Regel der Leitererwärmung, 3:1-Heuristik der RCD-Selektivität. Fehlende Felder ⇒ `UNVERIFIABLE`, **kein** stiller Fallback. |
| **nicht überprüfbar** (`unverifiable`)         | Der Gegenstand existiert im Graphen nicht; die Engine trifft **keine** Aussage.                           | L/N/PE als getrennte Leiter, zweipolige Trennung als reales Gerät, Umschaltung Landstrom ↔ Wechselrichter, Rückspeiseschutz, PE-Anschluss zur Karosserie, reale Messwerte, normative Abnahme.                                                |

**Wichtig:** `acCableComposition` (`lib/acProtection.ts`) zeigt eine aus der
einen Leitung abgeleitete L/N/PE-Querschnitts-Zusammensetzung nach IEC 60364-5-54
Tab. 54.2. Das ist eine **Anzeige**, keine getrennt geführten, einzeln
abgesicherten Leiter im Graphen. `NET-003` sagt daher „nicht als getrennte
Kanten abgebildet", nicht „nirgends erwähnt".

---

## 3. Einzelpunkte der Datengrundlage

Quelle: `AC_230V_SCOPE_ITEMS` in `lib/verify/acScope.ts` (maschinenlesbar; diese
Tabelle ist die Dokumentation dazu, nicht die Datenquelle).

| ID                    | Stufe             | Gegenstand                                                         | Warum nicht modelliert / worauf die Aussage beruht                                                                      | Konkrete Prüfung                                         |
| --------------------- | ----------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `computed-core`       | rechnerisch       | Strom, Querschnitt, Schutzorgan, Spannungsfall der einen Leitung   | Konduktionsgraph + Tabellenbasis des Planers                                                                            | Bericht / Kabel-Inspektor prüfen                         |
| `assumed-network`     | mit Annahmen      | Netzform, N-PE-Bezug                                               | `NET-001/002` werten `systemForm`/`neutralEarthBond` aus; fehlendes Feld ⇒ `UNVERIFIABLE`, nie „potenzialfrei ⇒ sicher" | Datenblattangaben im Bauteil-Inspektor eintragen         |
| `assumed-impedance`   | mit Annahmen      | Schleifenimpedanz, Abschaltbedingung                               | 0,8-Ω-Annahme (UNVERIFIED), 2/3-Regel, 3:1-Heuristik; Messwerte/Herstellerkennlinien fehlen                             | Z_s, I_k, Auslösezeiten messen bzw. Datenblatt entnehmen |
| `separate-conductors` | nicht überprüfbar | L/N/PE als getrennte Leiter                                        | Einleiteriges Modell, keine getrennten Kanten                                                                           | Verdrahtung, Aderzahl, Querschnitte am Aufbau prüfen     |
| `two-pole-disconnect` | nicht überprüfbar | Zweipolige/allpolige Trennung als reales Schaltgerät               | `RCD-004` wertet nur das Datenfeld `poles` aus                                                                          | Trenneinrichtung real prüfen, Polzahl deklarieren        |
| `changeover`          | nicht überprüfbar | Umschaltung Landstrom ↔ Wechselrichter inkl. Verriegelung          | Umschalter/Verriegelung/Umschaltzeit existieren im Graphen nicht                                                        | Umschalteinrichtung abnehmen lassen                      |
| `backfeed`            | nicht überprüfbar | Verhinderung der Rückspeisung / Paralleleinspeisung                | Keine Verriegelungslogik; zwei gleichzeitige Quellen nicht als Fehlerfall abbildbar                                     | Rückspeiseschutz real nachweisen                         |
| `chassis-bond-real`   | nicht überprüfbar | PE zur Karosserie: Anschlussstelle, Übergangswiderstand, Korrosion | `GND-001` prüft nur den deklarierten Querschnitt                                                                        | Massepunkt und Übergangswiderstand messen                |
| `acceptance`          | nicht überprüfbar | Normative Abnahme der 230-V-Installation                           | Das Modell bewertet keine ausgeführte Anlage                                                                            | Abnahme durch qualifiziertes Personal                    |

---

## 4. Wo die Absicherung sichtbar und prüfbar wird

| Ort                                             | Verhalten                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/verify/acScope.ts` → `checkAcModelScope`   | Für jeden Plan mit ≥ 1 `AC_LV`-Kante drei `UNVERIFIABLE`-Befunde (Leiter/Netzform, Schaltgeräte, Messwerte/Abnahme). Ohne 230-V-Kante `PASS` mit 0 Entitäten — reine 12-V-Pläne bekommen keine künstlichen Warnungen.                                                                          |
| `lib/verify/protection.ts` → `runPass5`         | Zehn Checks statt neun; `NET-003` ist Teil der Pass-5-Regelliste.                                                                                                                                                                                                                              |
| `lib/verify/rules.ts` → `RULE_MATRIX`           | `NET-003-ac-model-scope`, `provenance: 'UNVERIFIED'`, `clause: null`, `defaultKind: 'UNVERIFIABLE'`, `profile: 'NORM_CORE'`, `contexts: ALL_CONTEXTS`. Bewusst auch im strengsten Profil aktiv: Gerade ein NORM_CORE-Lauf darf nicht wie eine Abnahme aussehen. **Kein erfundenes Normzitat.** |
| `lib/verify/pipeline.ts` → `ENGINE_LIMITATIONS` | Siebter Eintrag nennt alle drei Stufen, die sechs nicht modellierten Punkte, die Pflicht zur Fachprüfung und dieses Dokument. Steht in **jedem** `report.limitations`.                                                                                                                         |
| `VerificationReport` / Prüfsiegel               | 230-V-Pläne werden `INCOMPLETE` (UNPROVABLE ⇒ UNPROVABLE ⇒ INCOMPLETE); 12-V-Pläne bleiben `COMPLIANT`. `skippedRules` führt `NET-003` bei 12-V-Plänen namentlich.                                                                                                                             |
| Warn-Zentrale (`WarningCenter.tsx`)             | `data-testid="ac-scope-items"`: jeder Punkt offen im Befund mit Stufe, Grund und konkreter Prüfung. Alle drei Befunde sind `info`/`unverified` — eine Datenlücke wird nie als Verletzung gezeigt.                                                                                              |
| Bauteil-Inspektor (`NodeInspectors.tsx`)        | `data-testid="inspector-230v-scope-note"` am 230-V-Verbraucher.                                                                                                                                                                                                                                |
| Kabel-Inspektor (`EdgeInspector.tsx`)           | `data-testid="edge-230v-scope-note"` im 230-V-Schutzorgan-Block.                                                                                                                                                                                                                               |

**Keine elektrische Rechnung in der UI** (ARCH-Regel D): Die drei Ansichten zeigen
nur die von `lib/verify` gelieferten Texte, Stufen und Details.

---

## 5. Tests

| Datei                                                                                         | Inhalt                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/verify/acScope.test.ts` (8 Tests)                                                        | Drei Stufen, alle genannten Punkte namentlich, `UNVERIFIED`/`clause: null`, 12-V-Plan → `PASS`/0 Ereignisse, 230-V-Plan → drei `UNVERIFIABLE` mit allen neun Einzelpunkten, Determinismus, Gesamtbericht `INCOMPLETE` + drei Stufen in `limitations`, 12-V-Plan `COMPLIANT` mit `NET-003` in `skippedRules`. |
| `lib/verify/protection.test.ts`                                                               | Pass-5-Regelliste auf zehn IDs erweitert.                                                                                                                                                                                                                                                                    |
| `lib/verify/pipeline.test.ts`                                                                 | `shorePlan()` darf nicht mehr nur `PWR-001`-Ereignisse haben: drei `NET-003`-Befunde mit Fachpersonal-Hinweis werden mitgeprüft.                                                                                                                                                                             |
| `lib/verify/rules.test.ts`                                                                    | Bijektion `RuleId` ↔ `RULE_MATRIX` ↔ Implementierungsliterale bleibt gültig (30 Regeln).                                                                                                                                                                                                                     |
| `components/planner/utils/verificationWarnings.test.ts`                                       | `rulesApplied` 30; vier Hinweise im Landstrom-Plan (1× PWR-001 + 3× NET-003), alle `info`/ohne Fokus, strukturierte `acScopeItems` mit drei Stufen.                                                                                                                                                          |
| `components/planner/ui/WarningCenter.test.tsx`                                                | Sichtbare Einzelliste mit Stufen, Grund und Prüfung.                                                                                                                                                                                                                                                         |
| `components/inspector/NodeInspectors.test.tsx`, `components/inspector/EdgeInspector.test.tsx` | Notiz in beiden Inspektoren.                                                                                                                                                                                                                                                                                 |
| `components/planner/ui/VerificationSeal.test.tsx`                                             | Pass 5 zeigt zehn Regeln.                                                                                                                                                                                                                                                                                    |

---

## 6. Bewusst weiterhin offen

- L/N/PE als getrennte, einzeln abgesicherte Leiter im Graphen.
- Netzformmodell (TN-S/TT/IT) über deklarierte Felder hinaus; Trenn- und
  Umschalteinrichtungen als Bauteile; Verriegelung gegen Rückspeisung.
- Reale Messwerte (Z_s, I_k, Auslösezeiten, Übergangswiderstände),
  Herstellerkennlinien und Prüfprotokolle.
- Normative Abnahme. **Nicht Gegenstand dieses Planers.**
- `ELE-002` (0,8-Ω-Annahme, `UNVERIFIED`), `ELE-001` (B2- statt ISO-6722-Tabelle,
  f₃ = 1,0), `ROUTE-018`, E2E/Pixel-Baselines/Build/PR bleiben unverändert offen.

---

## 7. Quellenlage

Es werden **keine neuen normativen Aussagen** eingeführt. `NET-003` hat
`clause: null`, `provenance: 'UNVERIFIED'` und `standard: 'CAMP-Modellgrenze
(ausdrücklich KEINE Normaussage)'`. Bestehende Klauselzitate in
`NET-001/002`, `RCD-001…006` und `GND-001` bleiben unangetastet; die
Datengrundlage der Fahrzeugtabellen ist in `lib/electrical.ts` und
`docs/KABEL-VERLEGEBEDINGUNGEN.md` dokumentiert. Weitere Kontexte:
`docs/ai/ELECTRICAL-CONTEXT.md`, `docs/ai/VALIDATION-CONTEXT.md`,
`docs/ai/KNOWN-PROBLEMS.md`, `lib/seo/content/230v.ts`.
