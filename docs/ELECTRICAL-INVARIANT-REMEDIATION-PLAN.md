# Implementierungsaufträge: Reparatur der sieben Invariantenverletzungen

Stand: 2026-11-05 · **abgeschlossen 2026-11-06** · Erzeugt aus dem Audit von PR #605

> ## Status: alle acht Aufträge umgesetzt
>
> Am 2026-11-06 lag die ausdrückliche Freigabe vor, Produktivformeln und
> Grenzwerte zu ändern. Damit waren die Aufträge A-1 bis A-8 ausführbar und
> sind in `arena/8b44e0c9-camp` umgesetzt. **Jeder `it.fails` in
> `test/invariants/electrical-invariants.test.ts` ist ein `it`** — die Suite
> hat keinen `expected fail` mehr.
>
> | Auftrag | Befund                                          | Status                                             |
> | ------- | ----------------------------------------------- | -------------------------------------------------- |
> | A-1     | K-3 Bank-I_k reihenfolgeabhängig                | **behoben** (`bankVoltage` ⇒ `null`)               |
> | A-2     | K-4 Designbudget ignoriert Verlegebedingungen   | **behoben** (`cableSizingFor`)                     |
> | A-3     | E-2 „nicht bewertbar" passiert das Gate         | **behoben** (`assessable`)                         |
> | A-4     | K-2 / K-2b AC-Spannungsfall                     | **behoben** (eine Grenzquelle, VDR prüft AC)       |
> | A-5     | E-1 ungültige Grenzwerte verschwinden still     | **behoben** (`rejectedInputs`)                     |
> | A-6     | T-2 kein Rechenweg im ΔU-Befund                 | **behoben** (`voltageDropTrace`)                   |
> | A-7     | D-2 fehlendes ε an der Normstufenkante          | **behoben** (absolutes ε 1e-9 A)                   |
> | A-8     | G2/G4/G6 als Gates                              | **behoben** (alle drei gebaut, s. Strategie §12.8) |
> | A-9     | T-1 Hersteller-I_z über der Sicherungszuordnung | **behoben** (Klemmen auf `FUSE_MAP`, §4.9)         |
>
> Die Wirkung jeder Änderung, die dabei entstandenen und behobenen Fehler und
> die Frage, warum die Golden-Master-Pläne trotzdem kein `COMPLIANT` erreichen,
> stehen in `ELECTRICAL-VERIFICATION-STRATEGY.md` §12.10 und §12.11.
>
> Der Text unten bleibt als **Auftragsbeschreibung** stehen — er dokumentiert,
> was zu tun war und welche Abnahmebedingungen galten. Er ist ab hier
> Nachweis, keine offene Arbeit.

## Ausgangslage (2026-11-05)

PR #605 belegte sieben Verletzungen mit reproduzierbaren Eingaben und änderte
bewusst **keine** Formel, Tabelle oder Grenzwert. Damit die Befunde nicht in
der Testsuite verrotten, stand hier für jeden Befund, was genau zu ändern ist,
was danach grün sein muss und was brechen darf. Reihenfolge nach Risiko pro
Aufwand.

## Gemeinsame Abnahmebedingungen für **alle** Aufträge

1. Der zugehörige `it.fails` in `test/invariants/electrical-invariants.test.ts`
   wird zu `it` — **nicht** gelöscht, **nicht** abgeschwächt. Bleibt er
   `it.fails`, ist die Reparatur nicht abgeschlossen.
2. `npm run test:invariants` und `npm run test:differential` sind grün.
3. `npm run check` ist grün, inklusive `lib/**`-Coverage-Gate.
4. Der Verdikt-Snapshot (`test/invariants/verdict-snapshot.test.ts`) wird nur
   mit Begründung im PR-Text neu aufgenommen. Ändert er sich ohne Begründung,
   ist das ein Abbruchgrund.
5. **Keine** Änderung an Regel-IDs. Eine Regel, deren Aussage sich ändert,
   behält ihre ID und bekommt einen neuen Erklärungstext.

---

## A-1 (Priorität HOCH): K-3 — Bank-Kurzschlussstrom ist reihenfolgeabhängig

**Betroffen:** `lib/shortCircuit.ts`, Funktion `bankVoltage` (intern),
verwendet von `bankShortCircuitCurrentA` und `shortCircuitAtFuseA`.

**Eingabefall (reproduzierbar):**

```ts
bankShortCircuitCurrentA([{ data: { capacity: 100, chemistry: 'LiFePO4', nominalVoltage: 12.8 } }]);
bankShortCircuitCurrentA([{ data: { capacity: 100, chemistry: 'AGM', nominalVoltage: 12.0 } }]);
// beide Knoten in einer Bank, einmal in jeder Reihenfolge
```

**Ist:** 6.826,67 A bzw. 6.400,00 A — je nachdem, welcher Block zuerst steht.
**Soll:** Ein Verdikt, das nicht von der Array-Reihenfolge abhängt.
**Ursache:** `bankVoltage` nimmt `house[0]`; `nominalVoltageOf` fällt bei
fehlendem Feld still auf `DEFAULT_SYSTEM_VOLTAGE` (12,8) zurück.

**Risiko einer falschen Bewertung:** `AMP-004` (Abschaltvermögen) ist
`CRITICAL_SAFETY`. Eine Bank mit gemischter Nennspannung bekommt je nach
Sortierung ein anderes I_k und damit ein anderes Abschaltvermögens-Urteil —
in beide Richtungen (falsches Grün **und** falsches Rot) möglich.

**Reparaturvorschlag:** `bankVoltage` liefert `null` (bzw. einen eigenen
`'undeclared'`-Status), wenn die Haus-Blöcke keine einheitliche Nennspannung
haben. Aufrufer melden `not-modeled`/`UNPROVABLE` statt einer Zahl. Für den
Normalfall (gleichspannige Bank) bleibt das Verhalten identisch — der
Golden-Master ist dann neutral (alle sechs Pläne sind uniform-spannig, belegt).

**Regressionstests:**

- `bankShortCircuitCurrentA` über alle Permutationen einer gemischtspannigen
  Bank ⇒ identisches Ergebnis (`null`) — der bestehende `it.fails` K-3.
- Gleichspannige Bank bleibt reihenfolgeunabhängig und zahlenmäßig unverändert
  (Golden-Master-Gegenprobe).

---

## A-2 (Priorität HOCH): K-4 — Designbudget ignoriert die Verlegebedingungen

**Betroffen:** `lib/autoWire/designBudget.ts`, `evaluateDesignBudget`.

**Eingabefall:** 560 W auf 12,8 V (43,75 A), Kante 16 mm², 2 m, `ambientC: 60`.
**Ist:** `cableCanCarry: true` bei `cableLimit = 48,3 A` (0,7 · 69 A).
Die Engine rechnet mit `cableIzFor` ⇒ 34,5 A ⇒ `AMP-001` VIOLATION.
**Soll:** Beide Schichten verwenden dieselbe I_z.

**Risiko:** Die UI kann „Kabel trägt" anzeigen, während der Prüfbericht
dieselbe Leitung als Verletzung führt. Bei 60 °C ist die Abweichung 40 %.

**Reparaturvorschlag:** `designAmpacity` durch `cableIzFor(crossSection,
conditions)` der Kante ersetzen; wo keine Bedingungen vorliegen, die
Tabellenpauschale **als benannte Annahme** verwenden (nicht stillschweigend).

**Regressionstests:** bestehender `it.fails` K-4; zusätzlich ein Fall bei 30 °C,
der nachweist, dass sich für Referenzbedingungen **nichts** ändert.

---

## A-3 (Priorität HOCH): E-2 — „nicht bewertbar" passiert das Feasibility-Gate

**Betroffen:** `lib/electricalGraph/currentBudget.ts` (`evaluateLoadFeasibility`),
Consumer `lib/autoWire/designBudget.ts:302` und
`components/planner/hooks/useLiveValidation.ts:796`.

**Eingabefall:** `evaluateLoadFeasibility(amps(140), computeCurrentBudget({}), 'Wechselrichter')`.
**Ist:** `feasible: true`, `severity: 'warning'`, `limitedBy: 'unknown'`.
**Soll:** Nicht bewertbar ist ein **dritter** Zustand, der vom Gate nicht als
„in Ordnung" durchgelassen wird.

**Risiko:** Ein Plan ohne jede hinterlegte Grenze (kein BMS, keine
Sicherung, kein Kabel-Limit) gilt als versorgbar. Das ist die stärkste Form
eines falschen Grüns.

**Reparaturvorschlag:** Ergebnis dreiwertig machen
(`feasible: boolean | 'unknown'` oder eigenes Feld `assessable: boolean`);
**beide** Consumer prüfen künftig `assessable` mit. Übergangsweise darf
`feasible` für `unknown` auf `false` gehen — die UI unterscheidet dann über
`severity`.

**Regressionstests:** `it.fails` E-2 wird `it`; zusätzlich ein Test, der für
beide Consumer nachweist, dass `limitedBy: 'unknown'` nicht als Freigabe
durchgeht.

---

## A-4 (Priorität MITTEL): K-2 / K-2b — AC-Spannungsfall

**Betroffen:** `components/edges/utils/voltageDrop.ts` (`hasVoltageDropError`),
`components/planner/utils/errorEdges.ts` (dieselbe 3-%-Grenze),
`lib/electrical.ts:383` (AC 2 %), `lib/verify/{rules,powerPath}.ts`
(`VDR-001`/`VDR-002` filtern auf `dc`/`solar`).

**Eingabefall K-2:** AC-Kante, 20 A, 20 m, 2,5 mm², 230 V ⇒ 2,5 % Fall.
**Ist:** `hasDropError: false` (Grenze hart 3 %).
**Soll:** 2 % für AC — dieselbe Grenze, mit der dimensioniert wird.

**Eingabefall K-2b:** Inverter → `consumer230v`, 60 m / 1,5 mm², 230 V.
**Ist:** **kein** VDR-Ereignis (Engine prüft AC gar nicht).
**Soll:** Ein ΔU-Befund wie für DC.

**Risiko:** Eine AC-Leitung, die nach Dimensionierung zu dünn ist, wird grün
angezeigt; die Engine meldet dazu gar nichts. Doppelte Blindstelle.

**Reparaturvorschlag:** Grenzwert als Funktion der Domäne (DC 3 %, AC 2 %) an
**einer** Stelle definieren und von Anzeige **und** Engine importieren;
`VDR-001/002` um den AC-Träger erweitern. Die 2-%-Entscheidung selbst ist eine
fachliche Freigabe (Modellannahme, keine Normklausel).

**Regressionstests:** beide `it.fails` werden `it`; zusätzlich ein Test, der
für **dieselbe** Kante Anzeige- und Engine-Urteil vergleicht (I-E-09).

---

## A-5 (Priorität MITTEL): E-1 — ungültige Grenzwerte verschwinden still

**Betroffen:** `lib/electricalGraph/constraints.ts` (`resolveComponentConstraints`,
`componentCurrentLimit`).

**Eingabefall:** `bmsContinuousDischarge: '50 A'` bzw. `0` bzw. `-10`.
**Ist:** Feld fehlt im Ergebnis; keine Meldung. `componentCurrentLimit` ⇒ `undefined`.
**Soll:** Der verworfene Wert wird gemeldet (Feld `rejectedInputs` oder
vergleichbar), damit die UI „Wert unbrauchbar" statt „keine Grenze" sagen kann.

**Risiko:** Ein Tippfehler in einem Zahlenfeld sieht aus wie „keine Grenze
hinterlegt" — und landet damit in Befund E-2 (falsches Grün).

**Reparaturvorschlag:** Beim Verwerfen den Grund mitschreiben
(`'non-numeric' | 'non-positive' | 'non-finite'`); `resolveComponentConstraints`
gibt ihn zurück. **Kein** Werteparsen von `'50 A'` — das wäre geraten.

**Regressionstests:** `it.fails` E-1 wird `it`; der grüne Begleittest bleibt
und dokumentiert, dass die Werte weiterhin **nicht** übernommen werden.

---

## A-6 (Priorität NIEDRIG): T-2 — Calculation Trace für den Spannungsfall

**Betroffen:** `lib/verify/rules.ts` / `lib/verify/powerPath.ts` (Bildung von
`VDR-001`/`VDR-002`), Typprägung in `lib/verify/types.ts`.

**Eingabefall:** 600 W, 20 m, 1,5 mm², 12,8 V.
**Ist:** `details = { rootCauseId: 'OTHER-001' }` — kein Rechenweg.
**Soll:** I_b, L, A, angesetztes ρ (bzw. κ) und Leitetemperatur, jeweils mit
Herkunft, nach dem `CalculationTrace`-Schema aus §7.2.

**Risiko:** Kein Sicherheitsfehler, aber der ΔU-Befund ist für Dritte nicht
nachprüfbar — und die κ/ρ-Diskrepanz (K-1) bleibt unerklärbar.

**Reparaturvorschlag:** `details` um die genannten Größen erweitern. Der Trace
ist hash-neutral (das Zertifikat hasht Events **nicht**), löst also keine
Golden-Master-Welle aus.

**Regressionstests:** `it.fails` T-2 wird `it`; der grüne Begleittest (der den
heutigen Minimal-Details-Zustand festhält) wird dabei **entfernt**, weil sein
Gegenstand dann nicht mehr existiert.

---

## A-7 (Priorität NIEDRIG): D-2 — fehlendes ε an der Normstufenkante

**Betroffen:** `lib/electrical.ts`, `thermalCrossSectionFor`.

**Eingabefall:** `16.1` gegen `0.7 * 23` (mathematisch identisch).
**Ist:** 4,0 mm² bzw. 2,5 mm².
**Soll:** Beide 2,5 mm² (23 A trägt 16,1/0,7 = 23).

**Risiko:** Nur in die **konservative** Richtung (eine Stufe mehr Kupfer) —
deshalb die niedrige Priorität. Aber: das Ergebnis hängt davon ab, wie die Zahl
entstanden ist, nicht was sie ist.

**Reparaturvorschlag:** Vergleich mit relativer Toleranz
(`>= required − 1e-12 · max(1, required)`), wie RM-2 es bereits tut.

**Regressionstests:** der bestehende D-2-Test wird auf Gleichheit beider
Aufrufe umgestellt; `11,55 A ⇒ 1,5 mm²` und `11,56 A ⇒ 2,5 mm²` bleiben als
Kantenprobe.

---

## Reihenfolge und Abhängigkeiten

```
A-1 (K-3, CRITICAL_SAFETY berührt)  ──┐
A-2 (K-4)                            ├── unabhängig, je eigener PR
A-3 (E-2) ── braucht A-5 (E-1) für eine gute Meldung
A-4 (K-2/K-2b) ── Anzeige- und Engine-Seite zusammen, sonst entsteht eine neue Divergenz
A-6 (T-2) ── unabhängig, niedrig
A-7 (D-2) ── unabhängig, niedrig
```

**Nicht Teil dieser Aufträge:** die Allowlist-Verdrahtung (G2) und das
Importfreiheits-Gate (G0). Beides sind Änderungen an der **Testarchitektur**,
nicht am Produktivcode, und stehen in `ELECTRICAL-VERIFICATION-STRATEGY.md`
§12.5.3.
