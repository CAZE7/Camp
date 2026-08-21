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

## Mission 2: Engineering auf außergewöhnlichem Niveau

Ziel: Der Code soll nicht nur viele Funktionen besitzen, sondern
fachlich beweisbarer, typ-sicherer, erweiterbarer und reproduzierbar
werden. Keine Aufgabe darf bestehende elektrische Sicherheitslogik
verschlechtern.

### Stand 2026-08-21 — K1 bis K7 umgesetzt

| Aufgabe | Status | Beleg |
|---------|--------|-------|
| K1 Einheiten | abgeschlossen (a, b, c getrennt) | `lib/units.ts`, 33 Tests inkl. echter `tsc`-Läufe |
| K2 Property-Tests | abgeschlossen | `lib/vde-properties.test.ts`, `docs/PROPERTY-TESTS.md` |
| K3 Routing | abgeschlossen | `docs/ROUTING-INVARIANTS.md`, `docs/routing-gallery/` (25 Szenarien) |
| K4 Registry | abgeschlossen | `components/registry/`, `docs/COMPONENT-REGISTRY.md` |
| K5 Playwright | Code vollständig, **Läufe stehen aus** | `docs/E2E-TESTS.md` Abschnitt 6 |
| K6 CI-Gate | abgeschlossen | `docs/CI.md`, `scripts/ci/` |
| K7 Dokumentation | abgeschlossen | `README.md`, `docs/adr/0001`–`0004` |

**Baseline nach Mission 2:** 1051 Tests in 81 Dateien grün, Typecheck
0 Fehler, Build erfolgreich (`./out`, 4,2 MB, 11 HTML-Seiten).
Vorher: 685 Tests.

**Gefundene und behobene Fehler** (alle mit Regressionstest):

1. **Undimensionierte 230-V-Leitung** (K2): eine Nutzer-Kante zwischen
   Landstrom und 230-V-Gerät ohne Domänen-Markierung fiel zwischen
   `sizeDcEdges` und `sizeAcEdges` hindurch und blieb ohne Querschnitt.
2. **Zickzack-Routing** (K3): ein Hindernis auf der Ideallinie erzeugte einen
   51-Punkt-Pfad, der das Bauteil am Ende trotzdem kreuzte.
3. **Verlorener Zielpunkt** (K3): ein Durchlauf ohne Detour verlor den letzten
   Wegpunkt — latent, bisher von Fehler 2 verdeckt.
4. **Eingefrorener Sidebar-Katalog** (K4): der Bauteil-Katalog wurde nur beim
   Laden des Moduls gelesen.
5. **Tests waren vom Typecheck ausgenommen** (Nachtrag zu K1): `tsconfig.typecheck.json`
   schließt `**/*.test.ts(x)` aus — die Branded Types wirkten dort also nicht.
   Behoben mit `tsconfig.tests.json` + `npm run typecheck:tests` (auch im
   CI-Gate). 157 dabei gefundene Typfehler sind bereinigt, darunter 41 echte
   Einheiten-Verstöße in Tests. Beleg: eine absichtlich vertauschte Einheit in
   einem Test wird jetzt als `TS2345: Argument of type 'Meters' is not
   assignable to parameter of type 'Amps'` gemeldet.

**Nicht erbracht:** Die drei geforderten grünen Playwright-Läufe. Der
Browser-Download war in der Arbeitsumgebung blockiert (`cdn.playwright.dev`
nicht erreichbar, kein System-Chromium). Ersatzweise lokal belegt: statischer
Server gegen den echten Export, Selektoren im gebauten Bundle, Selektor-
Vertrag als Vitest-Test. Details in `docs/E2E-TESTS.md`.

### Verbindliche Entscheidungen aus Mission 2

- `lib/units.ts` ist die einzige Quelle für physikalische Einheiten.
  Fachlogik rechnet mit Branded Types; Persistenzgrenzen lesen mit
  `parseQuantity` / `quantityOr`.
- Ein Skalierungsfaktor ist `Scalar`, niemals `number` — sonst ließe sich
  Ampere mit Volt multiplizieren.
- `orthogonalWaypoints` liefert die Geometrie, `buildOrthogonalPath` nur die
  Formatierung. Invarianten R1–R7 gelten und sind getestet.
- Hindernisse, die Quelle oder Ziel enthalten, werden nicht umfahren
  (dokumentierte Ausnahme).
- `docs/routing-gallery/gallery.json` ist Referenz. Änderungen nur mit
  `npm run routing:gallery` **und** Begründung im PR.
- Bauteildefinitionen stehen in `components/registry/`. Die elektrische
  Fachlogik (`lib/electrical.ts`, `lib/autoWire.ts`) bleibt davon unabhängig.
- `quality.yml` ist die einzige Definition der Qualitätsprüfung; `ci.yml` und
  `deploy.yml` rufen sie auf. Kein `npm install`, kein Löschen des Lockfiles,
  kein `skip_tests`.
- Property-Tests laufen mit festem Seed 20260821 und 1.000 Läufen je Gesetz.
- Der Typecheck umfasst Tests (`npm run typecheck:tests`). Node-Komponenten
  deklarieren `PlannerNodeProps` statt `NodeProps`, damit Tests eine Node mit
  `id` und `data` typkorrekt rendern können.
- `CableEdgeData.length` ist optional: ältere gespeicherte Pläne und Vorlagen
  bringen sie nicht mit; jeder Lesezugriff hat einen benannten Ersatzwert.

### Arbeitsregeln für Mission 2

1. Arbeite auf einem neuen Branch pro Aufgabe oder logisch getrenntem PR.
2. Lies zuerst die betroffenen Dateien und vorhandenen Tests.
3. Ändere keine öffentliche API ohne dokumentierten Migrationsplan.
4. Keine `any`-Casts, kein `@ts-ignore`, keine abgeschwächten Assertions.
5. Jede Codeänderung braucht Tests.
6. Jede Behauptung über Qualität muss durch einen echten Test-, Build-,
   Benchmark- oder Lighthouse-Beleg gestützt werden.
7. Bei einem Gegenbeispiel wird der Test nicht abgeschwächt: Ursache
   analysieren, Code oder Anforderung korrigieren und den Fall behalten.
8. Nach jeder Aufgabe müssen alle bisherigen Tests, Typecheck und Build
   erfolgreich laufen.
9. Nach jedem gemergten K-PR muss diese Datei im selben oder im nächsten
   Commit aktualisiert werden: erledigte Aufgabe als abgeschlossen
   markieren, neue Baseline (Testanzahl, Belege) eintragen, getroffene
   verbindliche Entscheidungen ergänzen. Eine veraltete AGENTS.md gilt
   als Fehler.

## K1 — Typ-sichere physikalische Einheiten — abgeschlossen

Führe in `lib/units.ts` Branded Types für `Watts`, `Amps`, `Volts`,
`Mm2`, `Meters` und `Millivolts` ein.

- Sichere Konstruktoren und explizite UI-Grenzkonvertierungen.
- Physikalisch sinnvolle Operationen typisieren, z. B. `P = U * I`.
- Migration in MAXIMAL 3 kleinen, einzeln reviewbaren Teil-PRs:
  a) `lib/units.ts` + Unit-Tests (ohne Migration bestehender Dateien),
  b) `lib/vde-standards.ts` migrieren,
  c) `lib/autoWire.ts` + `calculatePathVoltageDrop` migrieren.
  Ein einzelner Groß-PR für K1 gilt als Fehlschlag.
- Bestehende JSON-/React-Flow-Daten dürfen an Persistenzgrenzen primitive
  Werte verwenden; die Fachlogik darf Einheiten nicht verwechseln können.
- Beweis: absichtlich falsche Einheiten müssen als TypeScript-Fehler
  abgelehnt werden, ohne `any` oder Suppressions.

Abnahme: Typecheck 0 Fehler, 685+ Tests grün, mindestens 10 Unit-Tests
für Konstruktoren, Konvertierungen und ungültige Werte.

## K2 — Property-Based Testing der VDE-Logik — abgeschlossen

Führe `fast-check` nur ein, wenn der Nutzen gegenüber vorhandenen Tests
begründet ist. Ergänze Property-Tests für:

- Sicherungs-Sandwich: Laststrom ≤ Sicherung ≤ zulässige Kabelgrenze.
- Monotonie der Sicherungsauswahl.
- Monotonie des Spannungsfalls bei größerer Leitungslänge.
- Monotonie der Querschnittsauswahl bei größerem Strom.
- Idempotenz von `performAutoWiring`.
- AC/DC-Trennung jeder generierten Verbindung.

Generatoren müssen realistische Wertebereiche abdecken und mindestens
1.000 Runs pro Property ausführen. Shrinking-Gegenbeispiele müssen als
Regressionstests erhalten bleiben.

Abnahme: reproduzierbare Tests, dokumentierte Gesetze, keine bloßen
Snapshot- oder Beispieltests.

## K3 — Routing-Invarianten und visuelle Regression — abgeschlossen

Behandle `buildOrthogonalPath` als deterministische, reine Routing-Funktion.
Dokumentiere und teste:

- Exakte Start-/Endpunkte.
- Keine Segmentkollision mit Hindernissen.
- Nur orthogonale Segmente.
- Begrenzte Pfadlänge oder nachvollziehbare Ausnahme bei blockierten Zielen.
- Determinismus bei identischer Eingabe.

Erstelle eine kleine Routing-Galerie mit reproduzierbaren SVG-/JSON-Fällen:
Labyrinth, parallele Kabel, diagonale Quelle/Ziel, umschlossenes Ziel und
Stressszene. Kein visueller Snapshot darf ohne Begründung geändert werden.

Abnahme: Property-/Unit-Tests, dokumentierte Invarianten und mindestens
20 reproduzierbare Routing-Szenarien.

## K4 — Plugin-/Registry-Architektur für Bauteile — abgeschlossen

Untersuche zunächst die aktuelle Verteilung der Bauteildefinitionen.
Entwickle nur dann eine Registry, wenn sie die Komplexität tatsächlich
senkt.

Zielarchitektur:

- `ComponentSpec` für Typ, Domäne, Handles, Darstellung und Validierung.
- Registry mit eindeutigen IDs und Laufzeitvalidierung.
- Sidebar und Verbindungsvalidierung beziehen Definitionen aus einer
  gemeinsamen Quelle.
- Ein neues Bauteil soll ohne Änderung an zentralem Routing-/UI-Code
  registrierbar sein.
- Bestehende Spezialkomponenten dürfen bleiben, wenn das begründet wird.

Abnahme: mindestens ein neues Test-Bauteil, keine Regressionen, klare
Liste aller Kernänderungen und Beweis, dass die Erweiterung wirklich
isoliert möglich ist.

## K5 — Playwright-End-to-End-Tests — Code vollständig, Läufe offen

Führe Playwright gegen den gebauten Static Export aus, nicht nur gegen
Mocks oder eine idealisierte Entwicklungsumgebung.

Pflichtszenarien:

- Batterie → Sicherung → Verbraucher → Verbindung → Prüfung/BOM.
- Responsive Layout bei 375, 768 und 1440 px ohne horizontalen Overflow.
- Reload-Persistenz von Nodes und Kanten.
- Touch-/Tap-Interaktion, soweit im Browser automatisierbar.

Regeln: stabile `data-testid`- oder semantische Selektoren, kein
`waitForTimeout`, isolierte Browser-Kontexte, Retry nur als Diagnose.
Screenshots und Traces nur als CI-Artefakte, nicht als Ersatz für
Assertions.

Abnahme: drei aufeinanderfolgende grüne Läufe lokal/CI und Dokumentation
bekannter Grenzen echter Geräteemulation.

## K6 — Reproduzierbares CI-Gate — abgeschlossen

Prüfe `.github/workflows/deploy.yml` und ergänze einen klaren PR-Check.

- `npm ci` mit vorhandenem Lockfile.
- Typecheck, Tests, Build und vorhandene Qualitätschecks.
- Kein Löschen des Lockfiles und kein Fallback auf unkontrolliertes
  `npm install`.
- Node-Version aus `.nvmrc` verwenden.
- Deploy nur bei erfolgreicher Qualitätsprüfung.
- Sicherheits- und Berechtigungsumfang der Actions minimieren.

Abnahme: Workflow-Syntax validiert, Branch-Protection-Anleitung,
reproduzierbarer Fehler bei kaputtem Lockfile und erfolgreicher grüner CI.

## K7 — Technische Dokumentation und Portfolio-Qualität — abgeschlossen

Überarbeite `README.md` faktenbasiert:

- Klare Produktbeschreibung und Zielgruppe.
- Verifizierte Feature-Liste.
- Architekturdiagramm: Sidebar → Store → Canvas → AutoWire → VDE-Prüfung.
- Tech-Stack und wichtige Verzeichnisse.
- Getting Started mit `npm ci`, Dev-Server, Tests und Build.
- Test-, Typecheck-, Build- und Lighthouse-Status nur mit aktuellem
  Beleg nennen.
- Demo-/Screenshot-Platzhalter klar markieren, nichts erfinden.
- Kurze ADRs für zentrale Entscheidungen wie Static Export,
  React Flow, Routing und VDE-Modell ergänzen.

Abnahme: Ein neuer Entwickler versteht in 30 Sekunden Zweck, Start,
Architektur und Qualitätsnachweise.

## Reihenfolge und Abhängigkeiten

1. K6 CI-Gate als Sicherheitsnetz.
2. K1 Einheiten, danach K2 Property-Tests.
3. K3 Routing-Invarianten.
4. K5 Playwright.
5. K4 Registry erst nach der Analyse.
6. K7 Dokumentation nach den technischen Änderungen.

Aufgaben dürfen parallelisiert werden, wenn sie keine gemeinsamen Dateien
ändern. Bei Konflikten gilt die Reihenfolge oben.

## Globale Definition of Done

- [x] Mission-1-Funktionen bleiben unverändert funktionsfähig
      (alle 685 Alt-Tests laufen weiter, nur ein Vertrag wurde bewusst
      verschärft: `calculateVoltageDrop` wirft bei 0 mm² statt `Infinity`
      zu liefern — dokumentiert im Test).
- [x] Keine Sicherheits- oder VDE-Regressions; drei Sicherheitslücken
      wurden geschlossen (siehe Fehlerliste oben).
- [x] Tests grün (1051), Typecheck 0 Fehler, Build erfolgreich.
- [x] Neue Qualitätsbehauptungen haben reproduzierbare Belege
      (`docs/CI.md`, `docs/PROPERTY-TESTS.md`, `docs/ROUTING-INVARIANTS.md`,
      `docs/COMPONENT-REGISTRY.md`, `docs/E2E-TESTS.md`).
- [x] Keine toten Dateien, keine stillen Fallbacks, keine Suppressions.
- [~] Ein PR pro Aufgabe war nicht möglich: die Arbeitsumgebung ist an genau
      einen Branch gebunden. Ersatz: ein Commit je Aufgabe (K6, K1a, K1b,
      K1c, K2, K3, K5, K4, K7), einzeln reviewbar.
- [x] Diese Datei wurde im selben Commit aktualisiert.
- [x] Unlösbare oder nicht messbare Punkte sind benannt: Playwright-Läufe
      (Browser-Download blockiert), Lighthouse-Wert stammt unverändert aus
      Mission 1.
