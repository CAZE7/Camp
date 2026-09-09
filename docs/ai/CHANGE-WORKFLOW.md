# CHANGE-WORKFLOW

Der verbindliche Ablauf für jede Verhaltensänderung — mit zwei Spezialfällen
(Routing, Electrical) und einer Review-Checkliste.

---

## 20. Allgemeiner Ablauf

```
1. UNDERSTAND       Aufgabe in einen Satz fassen. Welche Regel/Invariante ist berührt?
2. PLAN             docs/ai/* lesen (Task-Routing in README.md). Kleinste Lösung wählen.
3. IDENTIFY FILES   CODE-MAP.md: Modul, Input/Output, Depends On, Called By.
4. IDENTIFY INVARIANTS
                    Routing → I1–I10   Electrical → G1–G7   Architektur → ARCHITECTURE-RULES
5. IMPLEMENT        Kleinste Änderung. Keine Magic Numbers. Keine Semantik-Drift.
6. TEST             Pflichtmatrix aus TESTING-CONTEXT.md §9.3.
7. DIFF             git diff lesen. Unbeabsichtigte Nebenwirkungen? Geometrie geändert?
8. REGRESSION       Golden Master, Regression, Invarianten, Perf, E2E (je nach Bereich).
9. DOCUMENT         docs/ai/* aktualisieren; bei Verhalten: Ledger docs/ARCHITECTURE-CHANGES.md.
```

**Stop-Regel:** Wenn Schritt 4 keine benennbare Invariante liefert, ist die Änderung nicht
verstanden. Zurück zu Schritt 1.

---

## 21. Routing-Change-Workflow

1. **Geometrische Invariante identifizieren** — welche von I1–I10 ist betroffen?
2. **Betroffenes Routing-Modul identifizieren** —
   Token / Geometry / Rules / Engine (`pathfinding.ts`) / Globaler Pass (`routeAll.ts`) /
   Post-Process (`nudge.ts`) / Hopping / Invarianten / Layout.
3. **Routing-Tests lesen, bevor Code geändert wird** —
   `pathfinding.test.ts`, `routeAll.test.ts`, `routeAllCollisionGuarantee.test.ts`,
   `nudge.test.ts`, `hopping.test.ts`, `portFanOut.test.ts`, `collision.test.ts`,
   `invariants.test.ts`, `orthogonalRouting*.test.ts` (Legacy).
4. **Kleinste Änderung implementieren** — kein Refactor „bei Gelegenheit“.
5. **Routing-Tests laufen lassen**
   ```bash
   npx vitest run components/edges/utils lib/routing
   ```
6. **Invarianten-Suite**
   ```bash
   npm run routing:audit          # I1–I7 je Referenzplan, Fallback, Determinismus
   npx vitest run scripts/routing/finalValidation.test.ts
   ```
7. **Golden Master**
   ```bash
   npm run test:goldenmaster
   # bei beabsichtigter Änderung: npm run goldenmaster:capture + PR-Begründung
   ```
8. **Regression + visuell**
   ```bash
   npm run test:regression        # 15 Szenarien inkl. SVG-Byte-Vergleich
   npm run e2e -- visual          # Pixel-Baselines 375/768/1440
   ```
9. **Diff prüfen** — insbesondere: neue Konstante? versteckte Reihenfolge-Abhängigkeit?
   Nichtdeterminismus (`Math.random`, Object-Identität, Set/Map-Iteration ohne Sortierung)?
10. **Verhaltensänderung dokumentieren** —
    `docs/ai/ROUTING-CONTEXT.md` (Pipeline/Regeln/Token) und Ledger-Eintrag in
    `docs/ARCHITECTURE-CHANGES.md`. Galerie/Golden-Layouts nur mit Recapture + Begründung.

### Zusätzlich bei Token-/Konstantenänderungen

- `lib/routing/tokens.test.ts` erweitern (Drift-Guard).
- `CLEARANCE_GOAL` in `searchFrame` und die `±16`-Rastererweiterung mitziehen
  ([KNOWN-PROBLEMS ROUTE-004](./KNOWN-PROBLEMS.md#route-004--geometrie-zahlen-außerhalb-der-tokens)).
- `ROUTE_BORDER_RADIUS` / `SMOOTH_STEP_BORDER_RADIUS` betreffen das **Rendering** —
  Galerie- und Pixel-Baselines ändern sich.

### Zusätzlich bei ELK-/Layout-Änderungen

- `lib/routing/elk/elk.test.ts`, `lib/planner/routingV2Adapter.test.ts`.
- Kein zweiter elkjs-Import (Rule J). Optionen kommen aus `generateElkLayoutOptions()`.

---

## 22. Electrical-Change-Workflow

1. **Physikalische Regel identifizieren** — welche Größe, welche Formel?
2. **Quelle/Annahme identifizieren** — Normkontext oder deklarierte Modellannahme?
   Steht im Code `UNVERIFIED`, bleibt es `UNVERIFIED`. **Keine VDE-Anforderung erfinden.**
3. **Domänenmodell identifizieren** — Feld, Typ, Einheit, Schema (`lib/nodeSchema.ts`),
   Persistenz (`store/slices/persistence.ts`).
4. **Berechnung implementieren** — über `lib/units.ts` (Branded Types), keine rohe Arithmetik.
5. **Normalfall-Test** — ein plausibler Plan, Erwartungswert benennen.
6. **Grenzwert-Test** — 0, negatives Minimum, Obergrenze der Normreihe, leerer Plan.
7. **Negativtest** — unplausible/fehlende Daten: wird gemeldet statt geschätzt?
8. **Einheiten prüfen** — `npm run typecheck:tests` (die Marken gelten auch in Tests).
9. **Sicherheitsverhalten prüfen** — wird eine Verschlechterung sichtbar (Fehler/Warnung),
   nicht still getragen? Gilt `I_B ≤ I_n ≤ I_z` weiter?
10. **Electrical-Kontext aktualisieren** — [ELECTRICAL-CONTEXT.md](./ELECTRICAL-CONTEXT.md),
    ggf. [VALIDATION-CONTEXT.md](./VALIDATION-CONTEXT.md), plus Ledger-Eintrag.

### Zusatzpflichten

- Property-Gesetz prüfen (G1–G7): greift eines, muss es weiter gelten.
- Golden Master: Sizing-Änderungen ändern `electrical` **und** `routing` (Querschnitt →
  Hop-Priorität). Beide Stufen im PR zeigen.
- Konsistenz: AutoWire dimensioniert, Anzeige und Validierung lesen. Abweichungen brechen
  `lib/vde-consistency.test.ts`.

---

## 23. AI-spezifische Review-Checkliste

Vor dem Commit, in dieser Reihenfolge:

- [ ] Habe ich den relevanten AI-Kontext gelesen (`docs/ai/*`)?
- [ ] Habe ich die Invariante identifiziert (Routing I*, Electrical G*, Architektur-Regel)?
- [ ] Habe ich den Datenfluss verstanden (Input → … → Output, wer konsumiert das Ergebnis)?
- [ ] Habe ich **alle** betroffenen Module identifiziert (`Called By` in CODE-MAP.md)?
- [ ] Habe ich die Tests **vor** der Verhaltensänderung gelesen?
- [ ] Bleibt das Verhalten deterministisch (kein `Math.random`, kein ungeordnetes Iterieren)?
- [ ] Habe ich eine versteckte Konstante eingeführt?
- [ ] Habe ich unabsichtlich Domänen-Semantik geändert (z. B. Routing-Fix mit Nebenwirkung auf
      Querschnitt oder Sicherung)?
- [ ] Habe ich einen Regressionstest ergänzt, der den konkreten Fall festnagelt?
- [ ] Habe ich die Dokumentation aktualisiert (`docs/ai/*`, ggf. Ledger)?

---

## 24. Definition of Done je Bereich

| Bereich           | Done heißt                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing           | Invarianten unverändert oder besser · Golden Master + Regression grün · `routing:audit` dokumentiert · Perf-Gate grün · Verhalten dokumentiert |
| Electrical        | Normal-/Grenz-/Negativtest · passendes Property-Gesetz grün · Einheiten geprüft · Quelle benannt · Golden Master grün                          |
| AutoWire          | Idempotenz-Test · Nutzerkanten-Heilung geprüft · Golden Master grün · Routing-Invarianten auf dem Ergebnis grün                                |
| Domäne/Persistenz | Schema-Test · Migrationstest mit Altstand · keine Datenverluste beim Rehydrate                                                                 |
| UI                | Komponententest · E2E für den Bedienpfad · bei Optik Vorher/Nachher 375/768/1440 hell+dunkel                                                   |
| Architektur       | betroffene Architektur-Gates grün · kein neuer Verstoß in `libBoundary` / `architecture.test.ts`                                               |
