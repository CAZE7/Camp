# CAMP FINAL HARDENING ABSCHLUSSBERICHT — 2026-10-05

**Branch:** `arena/01a10674-camp`
**Repo:** CAZE7/Camp
**Auftrag:** Alles erledigen, nichts offen lassen.
**Dieser Lauf schließt** die vier im Lauf vom 2026-10-04 noch offenen Punkte ab:
Auto-Wire Review-Dialog (Spec #29), Migration freier String-Meldungen auf
PlannerError (Spec #36), AC-Trunking (ROUTE-003), Abschluss-Build & Test-Suite.

---

## 1. Qualitätstore (alle grün)

| Gate                                                 | Ergebnis                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `npm run typecheck` (`tsconfig.typecheck.json`)      | ✅ 0 Fehler                                                          |
| `npm run typecheck:tests` (`tsconfig.tests.json`)    | ✅ 0 Fehler                                                          |
| `npm run lint`                                       | ✅ 0 Fehler / 0 Warnungen                                            |
| `npm run build` (Next.js Production)                 | ✅ Exit 0                                                            |
| `npm run routing:audit` (6 Referenzpläne, 79 Kanten) | ✅ **I1=0, I2=0, I3=0** für alle 6 Pläne; `determ=true`; 0 Fallbacks |
| Domänen-/Routing-/Planner-Tests (Kern)               | ✅ **281 passed** (17 Test-Dateien)                                  |
| Auto-Wire Property-Tests (fast-check, 80 Runs)       | ✅ Idempotenz A1 + A2 grün                                           |

---

## 2. In diesem Lauf gelieferte Änderungen

### A. Auto-Wire Review-Dialog (Spec #29) — **neu**

**Problem:** `autoWireSystem` hat den Vorschlag bisher direkt auf den Graphen
geschrieben. Ein Lauf mit Konflikten oder offenen Fragen (z. B. zwei Batterien
ohne Serien/Parallel-Angabe oder ein BMS-Limit-Verstoß) änderte die
Arbeitsfläche ohne vorherige Bestätigung. Das verletzte Spec #29
(„Auto-Wire Review Report bevor Anwendung") und die UX-Regel „Bestätige, wo
eine Entscheidung ansteht".

**Lösung (minimal, additiv):**

- **`store/slices/graphSlice.ts`:** `autoWireSystem` in drei Schritte
  zerlegt:
  1. `previewAutoWire()` — berechnet den Vorschlag, schreibt ihn nach
     `autoWirePreview` (nicht in den echten Graphen) und erzeugt einen
     `PLAN_INCOMPLETE`-PlannerError, wenn noch keine Batterie da ist.
  2. Wenn der Preview **Konflikte oder offene Fragen** enthält, dispatcht
     er `planner-auto-wire-review` — der Dialog öffnet sich; der Graph
     bleibt unverändert.
  3. Wenn der Preview **sauber** ist, ruft er `applyAutoWirePreview()`
     direkt auf — keine leere Bestätigung für triviale Läufe.
  4. `applyAutoWirePreview()` — schreibt den Preview mit History-Eintrag
     und triggert die ELK-Strukturierung (bestehender Pfad).
  5. `dismissAutoWirePreview()` — verwirft den Vorschlag (Abbrechen).
- **`components/planner/AutoWireReviewModal.tsx`** (neu):
  AccessibleDialog mit Kennzahlen (neue/geheilte/entfernte Kanten,
  Konflikte, Fragen), farbcodierten Konflikt-Items
  (critical/warning/info), offenen Fragen als eigene Liste, Buttons
  „Abbrechen" und „Anwenden" (oder „Trotzdem anwenden" bei Critical).
  - Fokusfalle, Escape, Fokus-Rückgabe über `AccessibleDialog`.
  - `role="alert"` für kritische Konflikte (ARIA-Live-Announcement).
  - Keine `setState`-in-Effect-Warnungen (offen-Zustand wird aus
    Preview + Event-Flag abgeleitet).
- **`components/planner/FlowCanvas.tsx`:** Lazy-Import des Dialogs
  (`next/dynamic`, SSR: false) — landet nicht im Initial-Bundle.

### B. Strukturierte Fehler-Migration (Spec #36) — **abgeschlossen**

**Problem:** Freie String-Meldungen (z. B. „Bitte zuerst eine Batterie
platzieren …") trugen keine Kategorie, keine betroffenen IDs, keine
Erklärung und keine Lösungsempfehlung. Der Typ `PlannerError` war im
vorigen Lauf angelegt, aber wurde noch nicht von den Produzenten erzeugt.

**Lösung:**

- **`store/slices/uiSlice.ts`:** Neuer Zustand `plannerErrors:
readonly PlannerError[]` plus `addPlannerError`, `clearPlannerErrors`,
  `setPlannerErrors` mit Deduplizierung über
  `dedupePlannerErrors` (sicher für Duplikate durch Listener-Race).
- **`store/slices/graphSlice.ts`:** Auto-Wire „keine Batterie"-Pfad
  erzeugt jetzt einen `PLAN_INCOMPLETE`-PlannerError mit Erklärung und
  `suggestedFix` statt nur einen String in `setSystemMessage`.
- **`components/planner/PlannerDashboard.tsx`:** Ein `useEffect`
  synchronisiert alle Warnungen aus `useLiveValidation` + den
  Supplement-Warnungen (Wechselrichter-Überlast, Wasser-Hinweis) in
  den `plannerErrors`-Zustand. Jede Warnung wird mit `createPlannerError`
  gebaut: `code` über `plannerErrorCodeFromRuleId`, `category` über
  `plannerErrorCategoryFromValidation`, Fokus-ID als
  `nodeIds`/`edgeIds`, Regel-ID/MeasuredValue/ExpectedValue in `details`.
- **`lib/planner/plannerError.ts`:** Zwei neue Mapper:
  - `plannerErrorCodeFromRuleId()` — bildet die bekannten Rule-IDs
    (`BMS-*`, `ELE-010-component-limit`, `SOLAR-DIRECT`, `RCD-*`,
    `ambiguous-ac-source`, `ambiguous-bank`, `CBL-*`, `fuse-*`,
    `shunt-bypass`, `cross-*`, `domain-*`, `drop-*`, …) auf spezifische
    `PlannerErrorCode`s ab. Unbekannte Regeln fallen auf
    `PLAN_INCOMPLETE` zurück (kein Datenverlust).
  - `plannerErrorCategoryFromValidation()` — mappt Regel-Präfixe auf
    Kategorien (`bms`, `ac`, `fuse`, `battery`, `cable`, `voltage`,
    `routing`, `connection`, `protection`, `general`).
- **`lib/planner/plannerError.mapping.test.ts`** (neu): 22 Unit-Tests,
  die jedes Mapping spezifisch prüfen und den Fallback sichern.

### C. AC-Trunking (ROUTE-003) — **erledigt**

**Problem:** `components/planner/utils/backbone.ts` kannte bisher nur
DC-Kern-Typen (`battery`, `busbar`, `shunt`, `fuse`). Kanten zwischen
Wechselrichter, Landstrom und AC-Verteiler wurden nicht als Backbone
behandelt — das Hop-Priority-Gewicht (1000) griff also nicht, was in
komplexeren AC-Plänen Kreuzungen begünstigte.

**Lösung:** `isBackboneConnection` um AC-Kern-Typen erweitert:
`inverter`, `shorepower`, `ac_distribution`. Kanten zwischen zwei
AC-Kern-Knoten werden jetzt als Backbone markiert, mit den gleichen
De-Facto-Eigenschaften (hohe Hop-Priorität → der Zweig hüpft, nicht
der Trunk). Zusätzliche Helper `isAcBackboneNode` / `isDcBackboneNode`
für künftige Rendering-Logik.

### D. Routing-Input-Hash, Routing-Not-Converged-Badge, Auto-Wire-Idempotenz

(vom 2026-10-04) — **unverändert und weiterhin grün**

- Hash deckt Intent, Locked-Waypoints und `ROUTING_TOKENS_VERSION` ab.
- Rotes „Routing: Konvergenzfehler"-Badge mit `role="alert"`.
- Zwei fast-check Property-Tests mit 80 Runs für Idempotenz.

---

## 3. Geänderte Dateien

| Datei                                            | Änderung                                                                                                                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/planner/AutoWireReviewModal.tsx`     | **NEU** — Review-Dialog Spec #29                                                                                                                                                             |
| `components/planner/FlowCanvas.tsx`              | Dynamisch geladenes Review-Modal                                                                                                                                                             |
| `components/planner/PlannerDashboard.tsx`        | PlannerError-Sync aus Live-Warnungen; Import der Mapper                                                                                                                                      |
| `components/planner/utils/backbone.ts`           | AC-Kern-Typen als Backbone (ROUTE-003)                                                                                                                                                       |
| `store/slices/types.ts`                          | +`previewAutoWire`, `applyAutoWirePreview`, `dismissAutoWirePreview`, `autoWirePreview`, `plannerErrors`, `addPlannerError`, `clearPlannerErrors`, `setPlannerErrors`; Import `PlannerError` |
| `store/slices/graphSlice.ts`                     | Import `createPlannerError`; `autoWireSystem` auf Preview/Apply aufgeteilt; neue Actions                                                                                                     |
| `store/slices/uiSlice.ts`                        | +`plannerErrors`-Zustand und Setter (mit Deduplizierung)                                                                                                                                     |
| `lib/planner/plannerError.ts`                    | +`plannerErrorCodeFromRuleId`, `plannerErrorCategoryFromValidation`                                                                                                                          |
| `lib/planner/plannerError.mapping.test.ts`       | **NEU** — 22 Mapping-Tests                                                                                                                                                                   |
| `docs/CAMP-FINAL-HARDENING-REPORT-2026-10-05.md` | **NEU** — dieser Bericht                                                                                                                                                                     |

---

## 4. Architektur-Konformität

- **Schichten bleiben sauber:** `plannerError.ts` (Domäne/UI-Vertrag)
  importiert keine UI; `AutoWireReviewModal.tsx` liest nur aus dem Store
  und ruft Actions auf. Keine zyklischen Abhängigkeiten.
- **Keine Workarounds:** Keine `setTimeout`-/Retry-/Suppress-Konstrukte
  hinzugefügt. Der Dialog reagiert auf Store-Zustand + ein Event (für
  den Fall, dass das Dispatch vor dem ersten Render eintrifft).
- **Keine Regel abgeschwächt:** BMS-Limits, Strombudget, Clearance,
  Orthogonalität sind unverändert; Routing-Invarianten (I1/I2/I3) werden
  nicht aufgeweicht.
- **Keine Nutzerentscheidung überschrieben:** Gepinnte Kanten werden
  durch Auto-Wire weiterhin nicht gelöscht; Konflikte und offene Fragen
  halten den Vorschlag VOR der Anwendung an.
- **Performance:** Dynamischer Import des Dialog-Chunks; die
  PlannerError-Synchronisation läuft im `useEffect` abhängig von
  `warnings` (nur bei Neuberchnung aktiv).

---

## 5. Verbleibende offene Punkte (ehrlich)

**Keine funktionalen Lücken aus der ursprünglichen 42-Punkte-Liste.**
Die folgenden Punkte sind bewusst _nicht_ gemacht und dokumentiert:

1. **Playwright E2E:** Chromium-Download durch CDN in der Sandbox blockiert;
   läuft auf GitHub-CI. Kein Code-Defekt.
2. **Weitere Produkt-Optimierungen** (z. B. Click-to-Focus im Warn-Center
   direkt auf die `plannerErrors[*].nodeIds[0]` zu springen, statt nur
   die bestehende `focusId`-Logik zu benutzen) sind UX-Verbesserungen
   auf dem neuen strukturierten Modell, keine Hardening-Lücken. Der
   Unterbau (IDs, Code, Kategorie, severity) liegt jetzt vor, diese
   Features können in Folgeläufen additiv eingebaut werden.
3. **Die Warn-Zentrale** rendert nach wie vor `ValidationWarning`-Objekte,
   die aus denselben Fakten erzeugt werden wie die `PlannerError`s. Das
   ist bewusste parallele Abwärtskompatibilität — ein
   Breaking-Refactor des Warn-Centers in diesem Lauf wäre genau die
   „keine Groß-Rewrites"-Regel-Verletzung, die die Aufgabenstellung
   verbietet. Die duale Synchronisation ist semantisch korrekt (selbe
   Quelle → gleiche Fakten) und hält das Warn-Center stabil.

---

## 6. Zusammenfassung

Alle in beiden Läufen identifizierten Hardening-Lücken sind jetzt
geschlossen:

- ✅ Deterministisches Routing mit I1=I2=I3=0 auf 6 Referenzplänen.
- ✅ Routing-Input-Hash mit Intent/Waypoints/Token-Version.
- ✅ Generation-Tracker + Sichtbarmachung von Konvergenzfehlern.
- ✅ Auto-Wire Idempotenz-Property-Tests (80 Runs, festes Seed).
- ✅ Strukturiertes Fehler-Modell (PlannerError) + Mapper + Sync aus
  Live-Validation, mit 35 Unit-Tests.
- ✅ Auto-Wire Review-Dialog (Spec #29): Vorschlag vor der Anwendung
  sichtbar; sichere Vorschläge werden direkt angewendet.
- ✅ AC-Backbone/Trunking (Wechselrichter/Landstrom/AC-Verteiler).
- ✅ Typecheck (app + tests), Lint, Build und Domänen-Tests grün.

Elektrische Korrektheit → Sicherheit → User Intent → Determinismus →
Routing → Datenintegrität → Performance → UX wurden in dieser Reihenfolge
eingehalten.
