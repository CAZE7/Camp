# Audit + Umsetzung: Routing ↔ UI-Synchronisation (2026-10-13)

**Branch:** `arena/d323b21e-camp` · **Basis:** `498c57b` (Merge PR #526)
**Auftrag:** vollständiges UI/UX-Audit des Elektroplaners, ursächliche Fehlerbehebung,
routingintegrierte Neugestaltung — Priorität: Korrektheit, Datenkonsistenz, Stabilität.

Legende für jede Aussage in diesem Bericht:

| Kennzeichnung                          | Bedeutung                                                          |
| -------------------------------------- | ------------------------------------------------------------------ |
| **nachgewiesen**                       | mit Messung oder Gegenprobe im Code belegt                         |
| **implementiert und getestet**         | Änderung ist drin und hat einen laufenden Test                     |
| **implementiert, nicht voll getestet** | Änderung ist drin, aber ein Prüfverfahren war hier nicht verfügbar |
| **offen**                              | nicht bearbeitet                                                   |

---

## 1. Ist-Zustand und Architektur (Phase 1)

Der Datenfluss ist im aktuellen Branch **eine** Kette, nicht zwei:

```
elektrisches Modell (store/slices/graphSlice.ts, lib/electricalGraph/*)
  → Auto-Wire-Vorschlag (lib/autoWire.ts, lib/autoWire/*, AutoWireReviewModal)
  → physisches Layout (ELK, lib/routing/elk/*)
  → Routing (components/edges/utils/routeAll.ts → pathfinding.ts)
  → geometrische Validierung (lib/routing/finalValidation.ts, lib/routing/invariants.ts)
  → elektrische Validierung (lib/verify/*, components/planner/hooks/useLiveValidation.ts)
  → UI (CableEdge, RoutingStatusBadge, WarningCenter, GuidedPlanRail)
```

Die für diesen Auftrag entscheidende Beobachtung: **ADR 0014 („eine Quelle für
Kabelgeometrie") wird auf dem Weg in die Geometrie eingehalten, aber nicht auf dem
Weg in den Status.** `CableEdge` liest ausschließlich `useCableRoute(id)`. Die
Status-Anzeigen lasen dagegen drei getrennte Modul-Zustände, die nacheinander
publiziert wurden. Genau dort saßen die drei nachgewiesenen Befunde RS-001/002/003.

Was der Audit **nicht** gefunden hat (und was deshalb nicht „mitrepariert" wurde):

- keine doppelte Routing-Wahrheit in der UI — `CableEdge` rechnet keine eigene Trasse;
- keine zweite Regel-Engine — `useLiveValidation` konsumiert `verificationWarnings`
  und den publizierten Final-Report, statt Normregeln nachzubauen;
- keine instabile Sortierung in den Signaturen — `nodeLayoutSignature` und
  `edgeTopologySignature` sind inhaltsbasiert und sortiert;
- kein Timer als Konvergenzschutz — `MAX_ROUTE_REVISIONS_PER_GRAPH` ist ein Zähler.

---

## 2. Gefundene Ursachen (nachgewiesen)

### RS-001 — zerrissene Veröffentlichung

`cableRouteStore.ts` hielt drei Modul-Variablen (`current`, `currentValidation`,
`currentGeneration`) mit je eigener Hörer-Menge. `CableRouteSync` publizierte
nacheinander:

```ts
publishCableRoutes(routes); // Benachrichtigung 1
publishCableRouteFinalValidation(report); // Benachrichtigung 2
```

**Nachgewiesen** mit einem Beobachter, der nach jeder Benachrichtigung Route und
Report liest. Beobachtete Zustandsfolge: `1|VALID` → **`2|VALID`** → `2|INVALID`.
Der mittlere Wert ist der Defekt: Weglänge der Generation 2 mit dem Urteil der
Generation 1. `RoutingStatusBadge` las genau diese beiden Werte.

### RS-002 — veralteter Report galt als aktueller Stand

`tracker.begin()` publizierte die neue Generation **vor** dem Lauf; der Report trug
keine Eingabe-Zuordnung (`'generation' in report === false`, gemessen). Der Live-Pfad
braucht messbar lange: `npm run perf:edge-routing` meldet Median **240,38 ms**
(erster Lauf) bzw. **290,66 ms** (zweiter Lauf, selbe Maschine, selbe Revision) bei
N=36/E=134. In diesem Fenster zeigte `RoutingStatusBadge` „Routing verifiziert" für
einen Plan, der noch nicht geroutet war; `GuidedPlanRail` hakte Schritt 5 ab.

### RS-003 — fehlgeschlagener Lauf ohne Fehlerzustand

`routeAllCables` lief ohne `try/catch` im gedrosselten Timer-Rückruf.
**Nachgewiesen** durch Gegenprobe: mit entferntem `try/catch` schlagen die drei
Fehlerpfad-Tests fehl **und** Vitest meldet `Unhandled Errors` — die Ausnahme entkam
dem `setTimeout`. Die Oberfläche zeigte anschließend kommentlos die alte Geometrie.

### UX-FOCUS-001 — Warnungs-Fokus verfehlt die Trasse

`FlowCanvas.handleFocusElement` zentrierte für Leitungen auf
`(sourceX + targetX)/2 + 100`, `(sourceY + targetY)/2 + 60` bei `zoom: 1.05` —
feste Offsets, ohne die veröffentlichte Trasse zu lesen. Bei einer U-Trasse
(Bauteile auf `y = 0`, Trasse bis `y = 900`) ist der alte Zielpunkt `(496, 120)`,
der korrekte `(396, 480)`. **Nachgewiesen** durch Gegenprobe: mit der alten Logik
werden 2 der 3 neuen Tests rot. Zusätzlich galten für Bauteile `zoom: 1.15` mit den
Fallback-Maßen `200/120`, für Leitungen `zoom: 1.05` — derselbe Vorgang, zwei
Magic Numbers.

---

## 3. Tatsächlich geänderte Dateien

| Datei                                           | Änderung                                                                                                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/edges/utils/cableRouteStore.ts`     | Drei Modul-Zustände → ein `CableRouteSnapshot` mit einer Hörer-Menge; `publishCableRouteResult`, `beginCableRouteRun`, `failCableRouteRun`, `describeRoutingError`, `derivePhase`; `try/catch` um den Lauf |
| `components/planner/ui/RoutingStatusBadge.tsx`  | Liest das Snapshot statt zwei Zustände; neue Phasen `routing-status-stale` und `routing-status-error`                                                                                                      |
| `components/planner/ui/GuidedPlanRail.tsx`      | Routing-Gate über `phase === 'valid'` statt `report?.status === 'VALID'`                                                                                                                                   |
| `components/planner/utils/focusHighlight.ts`    | Neue reine Funktion `edgeFocusTarget` (Hüllbox der veröffentlichten Trasse, Zoom, benannter Fallback)                                                                                                      |
| `components/planner/FlowCanvas.tsx`             | `handleFocusElement` nutzt `edgeFocusTarget` + `getCableRoute(id)` + `PLANNER_FOCUS_MAX_ZOOM`                                                                                                              |
| `components/planner/constants.ts`               | `PLANNER_FOCUS_MAX_ZOOM = 1.15` (ersetzt die inline-Werte 1.05/1.15)                                                                                                                                       |
| `components/planner/hooks/useLiveValidation.ts` | Routing-Befunde lesen das Snapshot; `provisional`, solange der Report zu einer älteren Eingabe gehört                                                                                                      |
| `components/planner/ui/WarningCenter.tsx`       | Zeile „Vorläufig“ für `provisional`-Befunde (`data-testid="warning-provisional"`)                                                                                                                          |
| `tests/e2e/routing-stability.spec.ts`           | Wait auf einen abgeschlossenen Lauf deckt alle vier Terminal-Phasen ab                                                                                                                                     |
| `docs/ai/KNOWN-PROBLEMS.md`                     | Vier Einträge RS-001, RS-002, RS-003, UX-FOCUS-001 mit Beleg und Gegenprobe                                                                                                                                |
| **Tests** `cableRouteStore.test.ts`             | +10 Tests (Atomarität, Veraltung, Fehlerpfad)                                                                                                                                                              |
| **Tests** `cableRouteSync.test.tsx` _(neu)_     | +4 Integrationstests über echten `ReactFlowProvider`-Pfad                                                                                                                                                  |
| **Tests** `RoutingStatusBadge.test.tsx`         | +3 Tests (veraltet, Fehler, erster Lauf)                                                                                                                                                                   |
| **Tests** `focusHighlight.test.ts`              | +5 Tests (`edgeFocusTarget`, reine Funktion)                                                                                                                                                               |
| **Tests** `FlowCanvas.test.tsx`                 | +3 Tests (`planner-focus-element`), Mocks für `setCenter`/`getNode`/`getCableRoute` testbar gemacht                                                                                                        |
| **Tests** `constants.test.ts`                   | +1 Assertion (Fokus-Zoom innerhalb des Zoom-Bereichs)                                                                                                                                                      |
| **Tests** `useLiveValidation.test.ts`           | +4 Tests (Zuordnung der Routing-Befunde zur Eingabe)                                                                                                                                                       |
| **Tests** `WarningCenter.test.tsx`              | +3 Tests (Vorläufigkeits-Zeile, Abgrenzung zu `unverified`)                                                                                                                                                |
| **Tests** `e2eSelectors.test.tsx`               | +3 Tests (Routing-Phasen ↔ E2E-Selektoren, ohne Browser)                                                                                                                                                   |

**Nicht geändert:** `routeAll.ts`, `pathfinding.ts`, `lib/routing/*`, `lib/electrical.ts`,
`store/slices/*`, alle Snapshots/Goldens. Die Geometrie ist bewusst unberührt —
belegt durch byte-identische Regression (68 Tests) und Golden Master (13 Tests).

---

## 4. Behobene Fehler

| Befund       | Zustand                        | Beleg                                                                                                                               |
| ------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| RS-001       | **implementiert und getestet** | `cableRouteStore.test.ts`: genau eine Benachrichtigung; beobachtete Folge `['2                                                      | INVALID']`, kein `2 | VALID` |
| RS-002       | **implementiert und getestet** | `derivePhase` → `routing` solange `publishedHash !== generation.hash`; Badge- und Store-Tests                                       |
| RS-003       | **implementiert und getestet** | `cableRouteSync.test.tsx`: Wege und Report bleiben objekttgleich, `phase === 'error'`; Gegenprobe zeigt `Unhandled Errors` ohne Fix |
| UX-FOCUS-001 | **implementiert und getestet** | `edgeFocusTarget` (5 Tests) + `FlowCanvas` (3 Tests); Gegenprobe: 2 davon mit alter Logik rot                                       |

| RS-002 (Nachzug Warn-Zentrale) | **implementiert und getestet** | `useLiveValidation` markiert Routing-Befunde aus einer älteren Berechnung als `provisional`; Gegenprobe: mit `routingReportCurrent = true` werden 3 der 4 Tests rot |
| E2E-Vertrag der Routing-Phasen | **implementiert und getestet** | `ROUTING_STATUS_TESTID` / `ROUTING_TERMINAL_PHASES`; `e2eSelectors.test.tsx` prüft Selektoren und Spec ohne Browser. Gegenprobe: ein entfernter Terminal-Selektor macht das Gate rot |

Zusatznutzen, der mit RS-002 mitfällt: Der geführte Modus hakt Schritt 5 nicht mehr
an einem Report der Vorgänger-Eingabe ab (`GuidedPlanRail`, **implementiert und
getestet** — `GuidedPlanRail.test.tsx` 8 Tests, `GuidedMode.integration.test.tsx` 4 Tests grün).

---

## 5. Testergebnisse vorher / nachher

| Gate                                | vorher                                              | nachher                                             |
| ----------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `vitest run` (Vollsuite)            | 246 Dateien · **3365** Tests · 1 skipped · 322,44 s | 247 Dateien · **3400** Tests · 1 skipped · 295,50 s |
| `npm run typecheck`                 | grün                                                | grün                                                |
| `npm run typecheck:tests`           | grün                                                | grün                                                |
| `npm run lint` (typbewusst)         | grün                                                | grün                                                |
| `npm run format:check`              | grün                                                | grün                                                |
| `npm run routing:audit`             | I1–I7 = 0, fallback 0, determ true                  | **identisch**                                       |
| `npm run routing:audit -- --shifts` | Exit 0 (unter `SHIFT_RATCHET`)                      | **identisch**                                       |
| `npm run test:regression`           | 68 Tests grün                                       | **68 Tests grün, byte-identisch**                   |
| `npm run test:goldenmaster`         | 13 Tests grün                                       | **13 Tests grün**                                   |
| `npm run build` (Static Export)     | grün, 31 Seiten geprüft                             | **grün, 31 Seiten geprüft**                         |
| `npm run e2e` (Playwright)          | **nicht ausführbar**                                | **nicht ausführbar** (s. §8)                        |

Es wurde **kein** bestehender Test entfernt, abgeschwächt oder übersprungen.
Die 35 zusätzlichen Tests sind neu.

---

## 6. Performance

| Messung                               | Wert                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Render-Pfad (Einzelkante, ADR 0012)   | Median **2,33 ms**, p90 3,22 ms — Budget 16 ms → **OK**                                                     |
| Live-Pfad (`routeAllCables`, Ratchet) | Median **240,38 ms** (Lauf 1) bzw. **290,66 ms** (Lauf 2), p90 277,62 / 395,28 ms — Ratchet 300 ms → **OK** |

Die Live-Pfad-Streuung von ≈21 % zwischen zwei Läufen **derselben Revision auf
derselben Maschine** ist Messrauschen, nicht Wirkung dieser Änderung: Der
Routing-Code ist unverändert, und Regression sowie Golden Master sind
byte-identisch. Der Render-Pfad liegt unverändert im dokumentierten Bereich
(2,3–3,1 ms). **nachgewiesen.**

Eine Neuberechnung des Budgets war nicht nötig und wurde nicht vorgenommen:
Es wurde keine neue Größe eingeführt, also gehört nichts in `lib/routing/tokens.ts`.

---

## 7. Bewusst nicht umgesetzt (mit Grund)

| Thema (Phase im Auftrag)                              | Status    | Grund                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aufteilung von `CableEdge.tsx` (976 Zeilen)           | **offen** | Reine Strukturmaßnahme ohne nachgewiesenen Defekt. Der Auftrag verlangt, nur bei klarer fachlicher Grenze zu trennen; eine Aufteilung ohne Reproduktion ändert Verhalten nicht, erhöht aber das Regressionsrisiko im einzigen Geometrie-Konsumenten. |
| Planungsmodi (Planung / Layout / Prüfung)             | **offen** | `plannerMode` existiert bereits (`PlannerModeSwitch`, `GuidedPlanRail`). Ein Umbau der Modi ist ein Produktentscheid, keine Fehlerbehebung — und der Auftrag verbietet neue Features ohne Freigabe.                                                  |
| Responsive/Überlappungs-Audit mit Bounding-Boxen      | **offen** | Erfordert Playwright. Browser-Download schlägt in dieser Umgebung fehl (s. §8). `tests/e2e/controls-overlap.spec.ts` und `responsive.spec.ts` existieren und wurden **nicht** ersetzt oder geschwächt.                                               |
| Auto-Wire-Vorschlagsfluss mit Undo/Redo               | **offen** | `AutoWireReviewModal` (Vorschlag prüfen/übernehmen) und `store/lockedRouting.test.ts` existieren bereits. Ein Eingriff in die Auto-Wire-Semantik ohne nachgewiesenen Defekt wäre ein Sicherheitsrisiko, kein Gewinn.                                 |
| Kabel-Kennzeichnungssprache (Symbole statt nur Farbe) | **offen** | Rein visuelle Verfeinerung; der Auftrag setzt sie ausdrücklich hinter Korrektheit und Stabilität.                                                                                                                                                    |
| Geometrische Playwright-Prüfungen für Routen          | **offen** | Derselbe Blocker. Die äquivalente Prüfung läuft hier stattdessen auf Unit-Ebene: `lib/routing/invariants.ts` (I1–I10) über `routing:audit` und `test:regression`.                                                                                    |

---

## 8. Bekannte verbleibende Probleme

1. **Playwright-E2E ist in dieser Umgebung nicht ausführbar.**
   `npx playwright install chromium` bricht ab:
   `Failed to download Chrome for Testing 151.0.7922.34 … Download failure, code=1`.
   Der Download-Host ist in dieser Sandbox nicht erreichbar. Damit sind
   Viewport-Prüfungen (320/375/768/1024/1366/1920), Bounding-Box-Überlappungen
   und die Pixel-Baselines **nicht verifiziert**. **offen.**
2. **`routing-status-stale` ist im Browser nicht gesehen worden.** Der Zustand ist
   auf Unit-Ebene geprüft (`RoutingStatusBadge.test.tsx`), aber ohne Browser konnte
   weder das Spinning-Icon noch der Tooltip im Layout verifiziert werden.
   **implementiert, nicht voll getestet.** Der Selektor selbst und seine Kopplung
   an die E2E-Suite sind dagegen seit dem zweiten Durchgang ohne Browser
   abgesichert (`e2eSelectors.test.tsx`).
3. **PERF-001 bleibt offen** (Live-Pfad ≫ 16-ms-Ziel, als Ratchet festgehalten).
   Unverändert übernommen, nicht verschlechtert. **offen.**
4. **ROUTE-009 bleibt offen** (gewichtete Clearance im Kreuzungs-Ausweichlauf).
   Unverändert übernommen. **offen.**
5. **`publishCableRoutes` / `publishCableRouteFinalValidation` bleiben als
   Kompatibilitäts-Zugänge erhalten.** Sie schreiben ins selbe Snapshot und sind
   für sich konsistent, aber zwei aufeinanderfolgende Aufrufe können weiterhin
   einen Zwischenzustand zeigen. Der produktive Pfad nutzt ausschließlich
   `publishCableRouteResult`. Eine Entfernung hätte 4 bestehende Testdateien
   umgeschrieben, ohne einen Defekt zu beheben. **nachgewiesen, bewusst belassen.**

---

## 9. Nächste Schritte (konkret, priorisiert)

1. **E2E auf einer Maschine mit Browser wiederholen.** Mindestens
   `npm run e2e` vollständig; dabei gezielt prüfen, dass `routing-status-stale`
   beim Verschieben eines Bauteils erscheint und nach dem Lauf verschwindet.
   Der Selektor-Vertrag und die Terminal-Phasen im Wait sind seit dem zweiten
   Durchgang ohne Browser geprüft — offen bleibt ausschließlich die Prüfung im
   echten Browser.
2. **Kompatibilitäts-Publisher entfernen**, sobald ihre Konsumenten umgezogen
   sind (`CableEdge.test.tsx`, `cableRouteStore.test.ts`,
   `useLiveValidation.test.ts`, `RoutingStatusBadge.test.tsx`). Danach ist die
   atomare Veröffentlichung erzwungen statt konventionell.
3. **`CableEdge.tsx` teilen** — aber erst mit einem Reproduktionsfall. Sinnvolle
   Grenze aus dem Audit: Geometrie-Adapter (`useCableRoute` + Pfadaufbau) gegen
   elektrische Kennzeichnung (`collectEdgeErrors`, Chips, Tooltip).
4. **Überlappungs-Gate um Kabelgeometrie ergänzen.** `controls-overlap.spec.ts`
   prüft nur DOM-Boxen. Die I1–I3-Prüfung existiert, aber nur offline; ein
   Browser-Test, der die gerenderten `d`-Attribute gegen `validateFinalRouting`
   prüft, würde Anzeige und Geometrie auch im ausgelieferten Build koppeln.

---

## 10. Was dieser Bericht **nicht** behauptet

Die UI ist damit nicht fehlerfrei, und das Routing ist nicht perfekt. Behoben und
belegt sind vier spezifische Defekte an der Schnittstelle Routing → Anzeige.
Alle übrigen Themen des Auftrags sind in §7 als offen ausgewiesen, nicht still
ausgelassen. Die Routing-Qualität selbst (I1–I3, Kreuzungen, Kabellängen) ist
unverändert — sie war vor diesem Auftrag auf allen sechs Referenzplänen bei null
und ist es danach ebenfalls.

---

## 11. Nachtrag — zweiter Durchgang (2026-10-13)

Die erste Fassung dieses Berichts nannte zwei Lücken, die dieselbe Ursache hatten
wie RS-002, aber nicht mitbehoben waren. Beide sind jetzt geschlossen; die
Tabellen in §3–§5 sind nachgezogen.

### 11.1 Die Warn-Zentrale las den Report ohne Eingabe-Zuordnung

`components/planner/hooks/useLiveValidation.ts` bezog den Final-Report über
`useCableRouteFinalValidation()`. Damit flossen Routing-Befunde der
VORGÄNGER-Eingabe unverändert in die Warn-Zentrale — derselbe Mechanismus wie
RS-002, nur an einem dritten Konsumenten. Behoben durch `useCableRouteSnapshot()`
und ein neues Feld `ValidationWarning.provisional`.

**Warum die Befunde bleiben und nicht verworfen werden:** Verwerfen hätte zwei
schlechtere Folgen gehabt. Erstens sprängen die Zähler bei jedem Drag für die
Dauer des Laufs — genau das Symptom, das der Auftrag ausdrücklich verbietet.
Zweitens wäre bei einem dauerhaft fehlgeschlagenen oder nicht konvergierten Lauf
ein echter Befund still verschwunden. `provisional` ist deshalb bewusst **nicht**
`unverified`: Das kennzeichnet eine Datenlücke („nicht entscheidbar“); hier wurde
entschieden — nur über einen älteren Stand. Die Folge-Zeile der Warn-Zentrale
bleibt die Routing-Folge, ergänzt um eine benannte Vorläufigkeit.

**Gegenprobe:** mit `routingReportCurrent = true` (dem Verhalten vor dem Fix)
werden 3 der 4 neuen Tests rot. **nachgewiesen.**

### 11.2 Der E2E-Wait kannte die neuen Phasen nicht

`tests/e2e/routing-stability.spec.ts` wartete auf
`[routing-status-valid], [routing-status-invalid]`. Seit der Phasentrennung kann
ein Lauf aber auch an der Konvergenzschranke enden oder fehlschlagen — beides
Endzustände. Der Wait wäre ins Zeitlimit gelaufen, obwohl die App einen korrekten
(roten) Zustand zeigt.

Behoben in zwei Schritten:

1. Der Wait deckt alle vier Terminal-Phasen ab (`ROUTING_TERMINAL_PHASES`).
2. Die Kopplung ist **ohne Browser** geprüft: `ROUTING_STATUS_TESTID` ist als
   `Readonly<Record<CableRoutePhase, string>>` typisiert — eine neue Phase
   bricht damit `npm run typecheck`, bis sie einen Selektor hat.
   `e2eSelectors.test.tsx` prüft zusätzlich, dass jeder Selektor im
   Badge-Quelltext gerendert wird, dass der Wait jede Terminal-Phase nennt und
   dass er **nicht** auf `idle`/`routing` wartet (beide bedeuten „noch nicht
   fertig“).

**Gegenprobe:** ein aus der Spec entfernter Terminal-Selektor
(`routing-status-error`) macht das Gate rot mit der Meldung
„routing-stability.spec.ts wartet nicht auf: error“. **nachgewiesen.**

### 11.3 Messwerte des zweiten Durchgangs

| Gate                           | Wert                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| `vitest run`                   | 247 Dateien · **3400** Tests · 1 skipped (vorher 3390)     |
| `lint`, `format:check`         | grün                                                       |
| `typecheck`, `typecheck:tests` | grün                                                       |
| `routing:audit`                | I1–I7 = 0, fallback 0, deterministisch — unverändert       |
| `test:regression`              | 68 Tests, byte-identisch                                   |
| `test:goldenmaster`            | 13 Tests                                                   |
| `npm run build`                | grün, 31 Seiten                                            |
| `npm run e2e`                  | weiterhin **nicht ausführbar** (Browser-Download gesperrt) |

### 11.4 Umgebungshinweis (Reproduzierbarkeit)

Zwischen zwei Zügen dieser Sitzung wurden `node_modules`, `out/` und der
Git-Index der Sandbox zurückgesetzt; der Commit `19f4722` war danach nicht mehr
vorhanden (`git reflog` zeigte nur `clone` und `checkout`). Die Code-Änderungen
lagen unverändert im Arbeitsverzeichnis. Alle Messungen dieses Nachtrags sind
nach einer erneuten `npm ci` entstanden. Wer den Bericht nachprüft, muss
`npm ci` zuerst ausführen.

## 12. Nachtrag — Vereinigung mit PR #529 (2026-10-16)

Der Zweig dieses Audits stand auf `498c57b`. Während der Arbeit zog die
Feature-Basis auf `1cbc6e24` weiter (6 Commits, 78 Dateien), darunter PR #529
`feat(routing): add validated global optimization and worker publication`.
PR #529 baute **denselben Store parallel um** — 280 Zeilen in
`components/edges/utils/cableRouteStore.ts`. `git merge-tree` wies genau
**eine** echte Inhaltskollision nach (die übrigen vier überlappenden Dateien
mergten automatisch).

### 12.1 Was PR #529 brachte

|                                    | PR #529                                                                                                                                        | dieser Audit                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Zustand                            | weiterhin **drei** getrennte Modul-Variablen mit je eigener Hörer-Menge                                                                        | **ein** unveränderliches Snapshot, eine Hörer-Menge                                                    |
| neu                                | `publishCableRouteSnapshot`, `completeCableRouteGeneration`, `requestCableRouteOptimization`, Worker-Transport, `ROUTING_TOKENS_VERSION` 3 → 4 | `CableRoutePhase`, `useCableRouteSnapshot`, `publishedHash`, `beginCableRouteRun`, `failCableRouteRun` |
| Phasen-Modell                      | keines                                                                                                                                         | Kern von RS-001/002/003                                                                                |
| `computeCableRouteFinalValidation` | nach `routeValidation.ts` ausgelagert und re-exportiert                                                                                        | lag inline im Store                                                                                    |

Beide Seiten waren unübernehmbar: PR #529s `OptimizeRoutingButton.tsx` und
`routingPublication.test.ts` rufen die neuen APIs auf, und umgekehrt fehlte
PR #529 das Phasen-Modell.

### 12.2 Auflösung

1. **Ein Zustand bleibt die einzige Quelle.** `publishCableRouteSnapshot` und
   `completeCableRouteGeneration` schreiben jetzt über denselben `commit` in
   dasselbe Snapshot — die drei Modul-Variablen und die drei Hörer-Mengen sind
   weg. `publishedHash` wird nur gesetzt, wenn ein Urteil vorliegt; ohne Report
   ist die Geometrie ausdrücklich nicht als geprüft ausgezeichnet.
2. **Worker und Optimierung bleiben unverändert erhalten.** Der Lauf bleibt
   asynchron über `createRoutingWorkerClient`, die Validated-Global-Optimization
   über `selectRoutingPublication` entscheidet weiter, ob Kandidat oder
   vorheriger Stand veröffentlicht wird.
3. **Der Fehlerpfad veröffentlicht kein Ergebnis.** PR #529 reichte den Fehler
   als `error`-Parameter an `completeCableRouteGeneration` und publizierte dann
   den vorherigen Stand **als Ergebnis der neuen Eingabe** — das ist RS-002 in
   neuem Gewand. Jetzt läuft der Fehler über `failCableRouteRun`: Geometrie
   bleibt stehen, Phase wird `error`, `publishedHash` zeigt weiterhin auf die
   alte Eingabe.
4. **`computeCableRouteFinalValidation`** kommt aus `routeValidation.ts`. Die
   dortige Fassung ist eine **Obermenge** der inline-Fassung dieses Audits
   (zusätzlich `validateRouteContract`, Handle-Existenz `ROUTE-INPUT`,
   `ROUTE-OWN-NODE`); die Inline-Kopie wurde entfernt, nichts ging verloren.

### 12.3 Folgen für die Tests

`cableRouteSync.test.tsx` braucht ein Worker-Double: jsdom stellt keinen
`Worker` bereit, ohne Double endet jeder Lauf sofort im Fehlerpfad. Das Double
ersetzt ausschließlich den **Transport** — es führt `runRoutingJob` in-Thread
aus, das genau das gemockte `routeAllCables` aufruft. Der Transport selbst ist
durch `routingWorkerClient.test.ts` abgedeckt.

Zwei Zusicherungen wurden an die vereinigte Semantik angepasst, keine
abgeschwächt:

- _Geometrie überlebt einen Fehler:_ vorher Objekt-Identität (`toBe`), jetzt
  Inhalt (`waypoints` per `toEqual`). PR #529 friert Wege beim Veröffentlichen
  bewusst unveränderlich ein — Identität kann dort nie gelten. Neu hinzu kam
  die stärkere Aussage, dass das Ergebnis ausdrücklich **nicht** zur neuen
  Eingabe gehört (`publishedHash !== generation.hash`).
- _Ein späterer Lauf beendet den Fehlerzustand:_ gewartet wird jetzt auf die
  **terminale** Phase. `beginCableRouteRun` löscht die Fehlermeldung bereits
  bei der Anmeldung — die alte Wartevorschrift hätte zu früh gegriffen.

### 12.4 Gates nach der Vereinigung

| Gate                                                   | Wert                                                 |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `vitest run`                                           | 254 Dateien / 3440 Tests, **9 fehlgeschlagen**       |
| `lint`, `format:check`, `typecheck`, `typecheck:tests` | grün                                                 |
| `routing:audit`                                        | I1–I7 = 0 in allen 6 Plänen, fallback 0, determ true |
| `test:regression`                                      | 68 grün                                              |
| `test:goldenmaster`                                    | 13 grün                                              |
| `npm run build`                                        | grün, 31 Seiten, Export-Prüfung grün                 |

**Die 9 Fehler sind nicht von diesem Merge verursacht.** Nachweis: dieselben
neun Tests in denselben fünf Dateien scheitern auf der reinen Basis `1cbc6e24`
in einem separaten Worktree, ohne jede Änderung von hier — die Liste der
fehlgeschlagenen Testnamen ist byte-identisch (`diff` leer). Betroffen:
`app/handleGeometry.test.ts`, `components/edges/utils/routeAll.test.ts`,
`scripts/routing/portBundleModel.test.ts`, `scripts/routing/portCapacity.test.ts`,
`scripts/routing/shiftInvariance.test.ts`. Keine dieser Dateien wurde von
diesem Zweig angefasst. Die Basis ist damit **vor** diesem Merge rot.

Weiterhin offen und unverändert: Playwright-E2E ist in der
Entwicklungsumgebung nicht ausführbar (Browser-Download gesperrt).
