# Elektrikplaner — Agentenleitfaden

## Mission 1: Produktionsqualität — abgeschlossen

Mission 1 wurde durch die gemergten PRs **#314** und **#315** abgeschlossen.

### Erledigt

- Responsives Layout für Handy, Tablet und Desktop.
- Explizite Touch-/Maus-Konfiguration für React Flow.
- Touch-Drag-Handle, Long-Press, Tap-to-Connect und responsive Inspector-Logik.
- Übersichtlichere orthogonale Kabelführung mit 16-px-Lanes,
  Kabeltyp-Gruppierung, Backbone-Hierarchie und Ausweichrouten.
- Chat-/API-Reste entfernt; der Static Export enthält keine `/api/chat`-Route.
- Vollständige interaktive Inventur in `docs/INVENTORY.md`.
- REST-Missionsbericht in `docs/RESTMISSION-REPORT.md`.
- AutoWire-Testabdeckung erweitert.
- Leere Zustände für Plan, BOM, Suche und Inspector.
- Lighthouse Accessibility 100/100 laut `lighthouse-report/`.
- Baseline nach Mission 1: 685 Tests grün, Typecheck und Build erfolgreich.

### Verbindliche Entscheidungen aus Mission 1

- Inspector: Slide-over bis 1279 px; Docking ab 1280 px.
- Inspector-Breite: 288 px zwischen 1280–1535 px, 320 px ab 1536 px.
- `components/planner/utils/flowInteraction.ts` ist die zentrale Quelle
  für React-Flow-Interaktions-Props.
- Touch-Connection-Radius: 40 px; Maus: 20 px.
- Node-Drag auf Touch primär über `.node-drag-handle`.
- Lane-Offset: 16 px; Backbone 3 px; normale Kabel 2 px.
- MiniMap unter 640 px ausgeblendet.
- Bestehende Trade-offs aus PR #314 bleiben erhalten, sofern kein
  reproduzierbarer Fehler sie widerlegt.

## Mission 2: Engineering-Niveau — in Review (PR #316)

**Status: PR #316 ist offen und wartet auf Merge.** Alle Aufgaben K1–K7 sind
im Branch `arena/01a02388-camp` implementiert (ein Commit je Aufgabe).

### Inhalt von PR #316 (vor dem Merge prüfen)

- **K1** Branded Types (`lib/units.ts`) + Migration von vde-standards/autoWire.
- **K2** Property-Tests mit fast-check (6 Gesetze, 1.000 Läufe, Seed 20260821).
- **K3** Routing-Invarianten R1–R7 + 25-Szenarien-Galerie mit Regressionsschutz.
- **K4** Bauteil-Registry (`components/registry/`) statt 4 doppelter Tabellen.
- **K5** Playwright-Suite geschrieben — **Läufe stehen aus** (Browser-Download
  war blockiert). Muss nach Merge lokal/CI verifiziert werden.
- **K6** CI-Gate gehärtet — **Workflows liegen unter `docs/ci/workflows/`
  und müssen manuell nach `.github/workflows/` kopiert werden** (siehe
  `docs/CI.md`, Abschnitt 0). Erst dann ist das Gate aktiv.
- **K7** README + 4 ADRs.
- 5 echte Bugs gefunden und mit Regressionstests behoben.
- Neue Baseline: 1051 Tests, Typecheck 0 Fehler (inkl. Tests), Build sauber.

### Nach dem Merge von PR #316

1. CI-Workflows aktivieren: `cp docs/ci/workflows/*.yml .github/workflows/`
   + `WORKFLOW_DIR` in `scripts/ci/workflows.test.ts` umstellen.
2. Playwright lokal laufen lassen: `npx playwright install chromium`,
   `npm run build`, `npm run e2e` — drei grüne Läufe erbringen.
3. Branch Protection einrichten (`docs/CI.md`, Abschnitt 4).
4. Diesen Abschnitt auf "abgeschlossen" setzen.

## Mission 3: UI/UX-Perfektion — UI-Aufgaben abgeschlossen auf diesem Branch

**Status (21.08.2026): M3.1–M3.12 umgesetzt, M3.13 lokal verifiziert.** Die vier
Playwright-Specs liefen in allen vier Projekten dreimal hintereinander ohne
Fehler (44 bestanden, 28 erwartete geräteabhängige Skips je Lauf). Typecheck,
Test-Typecheck, Static Build und 1069 Unit-/Property-Tests sind grün.
Die Workflow-Aktivierung bleibt bewusst außerhalb dieses PRs; die vorbereiteten
Dateien liegen weiterhin unter `docs/ci/workflows/`.

### Umsetzungsübersicht

- Touch-Undo/Redo, bestätigtes Löschen und 500-ms-Kontextmenü sind auf 375 px erreichbar.
- Speicherstatus, Tablet-Toolbar und Undo-Toast geben sichtbares Feedback.
- Drei-Spalten-Aufräumen, Kollisionsauflösung und drei Zoomstufen halten große Pläne lesbar.
- Circuit-Tracing, Handy-Übersicht und konfigurierbarer Hauptstromkreis-Rahmen sind aktiv.
- Die M2-Playwright-Suite wurde lokal vollständig verifiziert.

### Ursprünglicher Scope — KEIN neuer Scope

Ziel: Die BESTEHENDEN Funktionen werden auf Handy, Tablet und Desktop
gleichermaßen perfekt bedienbar, und der Plan bleibt bei jeder Größe
übersichtlich. **Keine neuen Features** (kein PWA, kein Export/Import,
keine Energiebilanz, keine Multi-Plan-Verwaltung).

### Regeln für Mission 3

- Jede Änderung muss auf 375 px, 768 px und 1440 px funktionieren.
- Touch ist First-Class: Was per Maus geht, geht auch per Finger.
- Kein Feature ohne sichtbares visuelles Feedback.
- Bestehende Entscheidungen aus Mission 1/2 bleiben erhalten.
- Pro Aufgabe ein eigener Branch + PR.

### Aufgaben (aus Code-Analyse belegt, nicht erfunden)

#### M3.1 — Touch-Undo/Redo
Problem: Undo/Redo existiert im Store (`undo()`, `canUndo`) und per
Tastatur (Strg+Z in PlannerInner.tsx), aber auf Touch-Geräten gibt es
keinen erreichbaren Weg. Desktop-Toolbar-Buttons sind bei 375 px nicht
sichtbar.
Aufgabe: Undo/Redo-Buttons auf Handy zugänglich machen — entweder in der
Bottom-Navigation oder als Floating-Action-Buttons im Canvas. Disabled-State
muss sichtbar sein (`canUndo`/`canRedo` aus dem Store).
Abnahme: Auf 375 px kann ein Nutzer eine Aktion rückgängig machen und
wiederholen, ohne Tastatur. E2E-Test im Touch-Projekt.

#### M3.2 — Touch-Löschen
Problem: `deleteKeyCode: null` auf Touch (flowInteraction.ts) — die
Entf-Taste existiert auf Handys nicht. Das Kontextmenü hat eine
Lösch-Funktion, ist aber per Rechtsklick ausgelöst und damit auf Touch
unerreichbar.
Aufgabe: Löschen auf Touch ermöglichen — z. B. über den Inspector
(Button "Löschen" mit Bestätigungsdialog) oder Long-Press-Kontextmenü
(siehe M3.4). Bestätigungsdialog mit Undo-Hinweis.
Abnahme: Auf 375 px kann ein Node und eine Kante gelöscht werden,
mit Bestätigung und Undo-Möglichkeit.

#### M3.3 — Speicher-Indikator
Problem: Der Plan wird automatisch gespeichert (Zustand persist), aber
der Nutzer sieht nicht, ob/ wann gespeichert wurde. Kein `beforeunload`,
kein Indikator.
Aufgabe: Diskreter Speicher-Indikator in der Toolbar: Punkt (unbe saved
Changes) / Häkchen (gespeichert) + Tooltip "Zuletzt gespeichert: vor X
Minuten". Optional: `beforeunload`-Warnung bei unbe saved Changes.
Abnahme: Indikator ändert sich sichtbar bei Änderungen und nach dem
Speichern. Funktioniert auf allen Viewports.

#### M3.4 — Kontextmenü auf Touch
Problem: `CanvasContextMenu.tsx` reagiert nur auf Rechtsklick.
Auf Touch existiert kein Äquivalent.
Aufgabe: Long-Press (500 ms) auf Node/Kante öffnet dasselbe Kontextmenü
auf Touch-Geräten. Haptisches Feedback (Vibration) wo verfügbar.
Abnahme: Long-Press auf Touch öffnet das Menü, Rechtsklick auf Desktop
bleibt unverändert. Test im Touch-Projekt.

#### M3.5 — Tablet-Toolbar-Optimierung
Problem: Die Toolbar (PlannerDashboard) ist für Desktop und Handy
optimiert, aber bei 768 px werden wichtige Buttons (Undo/Redo)
ausgeblendet.
Aufgabe: Bei 768–1023 px Undo/Redo sichtbar machen (Toolbar-Overflow
oder zweite Zeile).
Abnahme: Auf 768 px sind Undo/Redo, Auto-Wire und Mehr-Menü erreichbar.

#### M3.6 — Plan leeren mit Undo-Schutz
Problem: "Plan leeren" ist eine destruktive Aktion. Es gibt einen
Bestätigungsdialog, aber keinen Hinweis, dass Undo möglich ist.
Aufgabe: Bestätigungsdialog ergänzt Hinweis "Du kannst die Aktion mit
Strg+Z rückgängig machen". Nach dem Leeren erscheint ein Toast mit
"Rückgängig"-Button (5 Sekunden).
Abnahme: Dialog + Toast vorhanden, Undo funktioniert nach dem Leeren.

#### M3.7 — Auto-Layout "Aufräumen"
Problem: Nodes werden manuell platziert. Es gibt kein automatisches
Layout. Bei 10+ Bauteilen wird der Plan unübersichtlich.
Aufgabe: "Aufräumen"-Button in der Toolbar. Ordnet Nodes in 3 Spalten:
Quellen (Solar, Batterie, Landstrom) | Verteiler (Shunt, Busbar,
Sicherung, MPPT) | Verbraucher (Consumer, Inverter). Vertikale Sortierung
nach Typ-Hierarchie. Abstand: 180 px horizontal, 120 px vertikal.
Animation über 300 ms. Undo-bar.
Abnahme: Nach "Aufräumen" sind alle Nodes in Spalten geordnet, keine
Überlappung, Kabel werden neu geroutet. Unit-Test für die Layout-Logik.

#### M3.8 — Kollisionserkennung beim Dragging
Problem: Nodes können sich überlappen. Keine visuelle Warnung.
Aufgabe: Beim Dragging: Node-Border wird rot, wenn Bounding Box mit
anderem Node überlappt. Beim Loslassen: Node springt zur nächsten freien
Position (Grid-Snap).
Abnahme: Überlappung ist visuell erkennbar und wird beim Loslassen
automatisch aufgelöst.

#### M3.9 — Zoom-abhängige Detailstufen
Problem: Bei Zoom-out bleiben alle Labels gleich groß → unlesbar bei
vielen Nodes. Bei Zoom-in fehlen Details.
Aufgabe: Drei Zoom-Stufen: < 0.5 = nur Node-Farbe + Icon (keine Labels),
0.5–1.5 = Labels + Typ, > 1.5 = volle Details (Watt, Sicherung,
Querschnitt). Übergänge mit CSS transition.
Abnahme: Bei Zoom 0.3 ist der Plan als Farb-Übersicht lesbar, bei Zoom
2.0 sind alle Details sichtbar.

#### M3.10 — Circuit-Tracing
Problem: Klick auf ein Kabel zeigt nur das Kabel, nicht den
vollständigen Strompfad.
Aufgabe: Klick auf Kabel oder Node: Der vollständige Pfad (Quelle →
Verteiler → Verbraucher) wird hervorgehoben (opacity 1), alle anderen
Elemente ausgeblendet (opacity 0.2). Klick ins Leere beendet den Modus.
Pfad-Info als Overlay: "Batterie → Shunt → Busbar → Sicherung → Kühlbox
(12V, 5A, 2.5 mm²)".
Abnahme: Tracing funktioniert für DC- und AC-Pfade, visuell deutlich,
auf allen Viewports.

#### M3.11 — Handy-Überblick bei vielen Nodes
Problem: MiniMap ist unter 640 px ausgeblendet. Bei >10 Nodes auf Handy
verliert man den Überblick.
Aufgabe: Floating-Button "Übersicht" (Karten-Icon) erscheint bei >8
Nodes auf Handy. Tap = fitView mit Animation. Alternativ: Zoom-out-Geste.
Abnahme: Button erscheint nur bei >8 Nodes und < 768 px. Tap führt
fitView aus.

#### M3.12 — Backbone-Gruppierung
Problem: Batterie, Shunt, Busbars und Sicherungskasten sind einzelne
Nodes — der "Hauptstromkreis" ist nicht als Einheit erkennbar.
Aufgabe: Optionale visuelle Gruppierung: Backbone-Nodes bekommen einen
gemeinsamen dezenten Rahmen + Label "Hauptstromkreis". Keine funktionale
Änderung, nur visuell. Ein-/ausschaltbar in den Einstellungen.
Abnahme: Gruppierung ist sichtbar, behindert keine Interaktion,
konfigurierbar.

#### M3.13 — K5 abschließen: Playwright verifizieren
Problem: PR #316 enthält die Playwright-Suite, aber die Tests wurden
nie ausgeführt (Browser-Download blockiert).
Aufgabe: Lokal `npx playwright install chromium`, `npm run build`,
`npm run e2e` — drei aufeinanderfolgende grüne Läufe erbringen.
Dann CI-Workflows aktivieren (docs/ci/workflows → .github/workflows).
Abnahme: Playwright-Report zeigt 4 Specs × 4 Projekte grün, CI-Gate
aktiv.

### Definition of Done — Mission 3

- [x] M3.1–M3.6: Touch-Bedienbarkeit auf 375 px vollständig
- [x] M3.7–M3.9: Plan bleibt bei 20+ Nodes übersichtlich
- [x] M3.10–M3.12: Strompfade und Struktur visuell erkennbar
- [ ] M3.13: E2E dreimal lokal grün; CI-Aktivierung bewusst aus diesem PR ausgenommen
- [x] Alle Änderungen auf 375/768/1440 px getestet
- [x] Bestehende 1051+ Tests bleiben grün (aktuell 1069)
- [x] Keine neuen Features außerhalb der M3-Liste

## Mission 4: Audit-Befunde behoben — abgeschlossen auf diesem Branch

**Status (21.08.2026):** Alle in der Audit-Runde gemeldeten Fehler aus den
Bereichen Logik, UI/UX und Code Health sind behoben. Gate grün: Typecheck,
Test-Typecheck, 1023 Unit-/Property-Tests, Static Build (Next 16.3.2),
`npm audit` 0 Schwachstellen, Lockfile-Gate grün.

### Logik

- **LOG-01** `getEdgeDomain` verwechselt den 12-V-DC-Eingang des
  Wechselrichters nicht mehr mit 230 V: `plus` als Ziel-Handle ist DC,
  nur `ac_in` ist AC. Der falsche Testfall in `electrical.test.ts` wurde
  korrigiert.
- **LOG-02** Alle drei Templates laden ohne Fehlkanten (verifiziert per
  Skript gegen `collectEdgeErrors`, 0 Fehler): Minimalist-Hauptsicherung
  (0,2 m, 10 A), Autark auf 1500-W-Wechselrichter umgestellt, damit der
  Strom (138 A) mit der Normreihe absicherbar bleibt; Onboarding-Text
  angepasst.
- **LOG-03** Tote zweite Validierungs-API entfernt (`validateSchematic`,
  `validateCableEdge`, `calculateWire`, …) samt der drei parallelen
  Sicherungstabellen (`VDE_CURRENT_CAPACITY`, `VDE_STANDARD_FUSES`,
  `VDE_CONSERVATIVE_FUSES`). Einzige Quellen: `selectFuseSize` + `FUSE_MAP`.
- **LOG-04** `collectEdgeErrors` deckt sich mit Rule A der
  Live-Validierung: „Sicherung fehlt!“ nur noch bei Hochstromquellen
  (Batterie/Wechselrichter/Ladequellen), nicht auf Sicherungskasten-
  Abgängen oder Solarzuleitungen.
- **LOG-05** Generische Zyklusprüfung in `isValidConnection` entfernt —
  sie blockierte den Minus-Rückleiter (richtung-/reihenfolgeabhängig).
  Regressionstests für beide Zeichenreihenfolgen vorhanden.
- **LOG-06** `EdgeInspector` crasht nicht mehr bei Nicht-Normquerschnitten
  aus alten Plänen (sicherer `FUSE_MAP`-Lookup statt werfendem
  `calculateMaxFuse`).
- **LOG-07** Tote Store-Aktionen/Events entfernt: `checkSchematic`
  (`check-schematic`-Dispatch ohne Listener), `exportBOM`
  (`export-bom`-Dispatch ohne Listener), ungenutzte
  `waterNodes`/`waterEdges`-Parameter in `useLiveValidation`,
  `initialNodes`/`initialEdges`-Fixtures, tote `handleChangeCrossSection`-
  Prop-Kette.
- **LOG-08** `ExpertPanel` rechnet mit der Systemspannung (nicht hart /12),
  typisierte Kantendaten ohne `as any`, RCBO-Label statt DC-Tabelle für
  230 V.

### UI/UX

- **UX-01** Toter Long-Press-Drag-Pfad entfernt (das 500-ms-Kontextmenü
  brach den 750-ms-Timer immer ab). Halten = Kontextmenü, „Verschieben
  aktivieren“ aus dem Menü schaltet frei.
- **UX-02** `translateExtent` wächst mit dem Planinhalt (Bounds + 2 000 px
  Rand) statt fester Grenze — große Pläne bleiben erreichbar.
- **UX-03** Signatur-basierter Cache für den kumulierten Spannungsfall
  (`plannerGraphSignature`): Positionen zählen nicht zur Signatur, daher
  bleiben Knoten-Drags flüssig.
- **UX-04** Sichtbare `'…'`-Anführungszeichen im ExpertPanel entfernt;
  Escape hebt jetzt die Auswahl auf (Inspector schließt über den
  Auswahl-Effekt), statt am Desktop die Spalte einzuklappen.

### Code Health

- **CH-01** `ConduitNode` rechnet über `calculateConduitFillPercent`/
  `recommendConduitType` (dritte lokale Tabellen-Kopie entfernt) und nutzt
  Warn-/UI-Tokens statt roher Tailwind-Farben.
- **CH-02** `WaterNode` typisiert statt `any`.
- **CH-03** `npm audit fix`: 0 Schwachstellen (next 16.3.2, postcss 8.5.23,
  nanoid 3.3.18, sharp 0.35.3, undici 7.29.0); Lockfile-Gate grün.
