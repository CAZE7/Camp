# Camp — Product Readiness Audit & Release-Plan

**Stand:** 2026-11-05 · **Branch:** `arena/3ad41177-camp` · **Basis:** `7d8a464` (Merge PR #601, `main`)

> **Umsetzungsstand (laufend):** Die Release-Blocker sind abgearbeitet.
> Siehe **[§9 Umsetzungsstand](#9-umsetzungsstand)** für den pro Befund
> belegten Stand. Die Befundtexte in §4 beschreiben den Zustand **zum
> Audit-Zeitpunkt** und werden nicht rückwirkend umgeschrieben — sonst wäre
> nicht mehr nachvollziehbar, was der Befund war.
> **Art:** Read-only-Audit. Es wurde **nichts implementiert**, keine Fixture, kein Grenzwert, kein
> Normwert und keine Architektur geändert. PR #601 und parallele Branches wurden nicht angefasst.
> Alle Befunde sind durch Code-Lektüre, ausgeführte Tests/Gates oder reproduzierbare Sonden belegt.
> Wo etwas nicht geprüft werden konnte, steht es ausdrücklich als **ungeprüft** dabei.

---

## 1. Gesamturteil (Management-Zusammenfassung)

Camp ist **technisch deutlich reifer, als es ein typisches Hobby-Projekt ist**: Die elektrische
Rechenkette ist über weite Strecken eine einzige, getestete Wahrheit (Topologie-Strommodell,
eine I_z-Funktion, eine Koordinationsprüfung), das Routing ist auf sechs Referenzplänen
invariantenfrei und deterministisch, und die Verifikations-Engine weist ihre Modellgrenzen
selbst aus. Der geprüfte Stand:

| Gate                                                               | Ergebnis (dieses Audit, lokal ausgeführt)                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `npx vitest run` (Vollsuite)                                       | **311 Dateien / 4076 bestanden / 1 skipped**                           |
| `npm run typecheck` + `typecheck:tests` + `lint`                   | **grün**                                                               |
| `npm run routing:audit`                                            | **I1–I7 = 0** auf allen 6 Referenzplänen, `determ = true`, 0 Fallbacks |
| `npm run test:goldenmaster`                                        | **13/13 grün**, keine Neuerfassung                                     |
| `npm run test:regression`                                          | **68/68 grün**                                                         |
| `npm run build` + SEO-Exportprüfung                                | **grün**, 42 Seiten                                                    |
| `npm run ci:verify-legal-notice`                                   | **grün** (Impressum vollständig, `lib/siteLegal.ts`)                   |
| E2E funktional (`--grep-invert "hält die Baseline"`, Chromium 153) | **421 passed / 259 conditional skipped / 0 failed** (32,6 min)         |
| `npm run perf:edge-routing` (allein, ohne Konkurrenz)              | Live-Pfad **Median 237 ms / p90 261 ms ≤ 300 ms Ratchet → OK**         |

**Trotzdem ist Camp noch kein vollständig nutzerfertiges Produkt.** Der wichtigste Befund ist
kein Rechenfehler, sondern eine **Workflow-Sackgasse**: Das Batteriebank-Modell verlangt vom
Nutzer eine Deklaration (`bankId`, `bankTopology`), die es in der Oberfläche **nicht gibt**.
Ein Camper mit zwei Aufbaubatterien — ein absoluter Normalfall — kann die Anlage über die UI
nicht korrekt fertigstellen (AUD-001, P0). Dazu kommen: der PDF-Bericht enthält **keinen
Schaltplan** (AUD-004), die „gleichzeitige Geräte"-Auswahl wird vom Strommodell **ignoriert**
(AUD-005), die Fahrzeug-Kabeltabelle ist eine **Hausinstallations-Annahme** (AUD-003, fachlich
nicht freigabefähig für Fahrzeug-Aussagen), und die 230-V-Seite ist bewusst ein **Einleiter-
Modell mit ausgewiesenen Grenzen** (AUD-002) — als Planungshilfe vertretbar, als „vollständig
geprüft" nicht.

**Release-Empfehlung:** Ein Release als **12-V/24-V-Planungshilfe mit ausdrücklich begrenzter
230-V-Aussage** ist nach Abarbeitung der P0- und der kernrelevanten P1-Punkte realistisch.
Ein Release, der „vollständige, normgerechte Elektroplanung inkl. 230 V" verspricht, ist
**ohne die ausgewiesenen Fachdaten und ohne Fachprüfung nicht zulässig** und wird durch die
Engine selbst (NET-003, `ENGINE_LIMITATIONS`) auch aktiv verhindert.

---

## 2. Prüfmethodik & Evidence

### 2.1 Was gelesen wurde (vollständig)

`AGENTS.md`, `agent.md`, `docs/ai/ARCHITECTURE-RULES.md`, `CHANGE-WORKFLOW.md`, `CODE-MAP.md`,
`ELECTRICAL-CONTEXT.md`, `AUTOWIRE-CONTEXT.md`, `VALIDATION-CONTEXT.md`, `TESTING-CONTEXT.md`,
`DOMAIN-CONTEXT.md`, `KNOWN-PROBLEMS.md`, `GOLDEN-PLANS.md`, `P0-SPRINT-ABNAHME.md`,
`docs/AC-230V-MODELLGRENZEN.md`, `docs/KABEL-VERLEGEBEDINGUNGEN.md`,
`docs/PROJEKTDATEI-UND-DOKUMENTE.md`, `docs/E2E-TESTS.md`, ADR 0001/0012/0014/0021/0030/0038,
`docs/qa/NACHTEST-2026-10-16.md`. Zusätzlich der Produktivcode der auditierten Bereiche
(`lib/electrical.ts`, `lib/vde-standards.ts`, `lib/cableConditions.ts`, `lib/shortCircuit.ts`,
`lib/acProtection.ts`, `lib/solar.ts`, `lib/peukert.ts`, `lib/electricalGraph/*`,
`lib/autoWire/*`, `lib/verify/*`, `components/planner/*`, `components/inspector/*`,
`store/*`, `app/*`).

### 2.2 Was ausgeführt wurde

Alle Gates aus §1 wurden in diesem Checkout real ausgeführt. Umgebung: Node 22.22.3,
npm 10.9.8, Debian 12, Chromium 153 (aus `@sparticuz/chromium`, via
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, da `cdn.playwright.dev` in dieser Sandbox gesperrt ist).

**Zwei reproduzierbare Sonden** (temporär, nach dem Lauf entfernt, kein Repo-Artefakt):

- **Bank-Sonde:** 2× 100 Ah LiFePO4 (Rolle `house`, BMS 100 A) + 1 Verbraucher, ohne
  Bank-Deklaration → `performAutoWiring` liefert eine **unverbundene** zweite Batterie
  (`bat2 edges: []`), Banken `topology: 'unassigned'`, Konflikt `AUTO-BANK-001` mit dem
  Wortlaut „Bitte am Akku `bankId` und `bankTopology` setzen". Die Frage
  `ambiguous-topology` wird von `useLiveValidation` **nicht** angezeigt (Filter
  `useLiveValidation.ts:432–437` lässt nur `member-count-mismatch`, `declaration-mismatch`,
  `missing-counts` durch).
- **Gleichzeitigkeits-Sonde:** WR 1000 W, zwei 230-V-Lasten (1500 W + 500 W),
  `concurrentDevices: ['cooker']` (nur 500 W als gleichzeitig markiert) → das DC-Kabel
  Batterie→WR wird mit **196,08 A** (= 2000 W Insel-Summe / 12 V / 0,85) geführt, obwohl der
  Nutzer nur 500 W gleichzeitig deklariert hat. Die Auswahl wirkt **nur** auf die
  Überlast-Warnung der WR-Karte/Dashboard, **nicht** auf `getCableCurrents`.

### 2.3 Messfallen, die vermieden wurden

- **Perf unter CPU-Konkurrenz:** Ein erster `perf:edge-routing`-Lauf parallel zur E2E-Suite
  zeigte 343 ms (> 300 ms Ratchet). Das ist derselbe Artefekt, den `P0-SPRINT-ABNAHME.md` §6
  dokumentiert. Der **allein** wiederholte Lauf ergab 237 ms → OK. Beide Werte sind genannt,
  damit kein geschönter Gate-Status entsteht.
- **Veraltete Abschlussberichte:** Die im `NACHTEST-2026-10-16.md` erwähnten „9 bekannten
  Routing-Testfehler" (handleGeometry, portBundleModel, portCapacity, shiftInvariance,
  routeAll) wurden gezielt nachgemessen: **59/59 grün**. Sie sind erledigt und werden nicht
  erneut geöffnet.

### 2.4 Grenzen dieses Audits (ungeprüft)

- **Pixel-Baselines** (`visual.spec.ts`, `visual-de-pixel.spec.ts`) wurden **nicht** gefahren
  (ausgeschlossen per `--grep-invert`). Visueller Drift ist damit nicht bewertet.
- **Echte Geräte / Safari / Firefox:** E2E lief nur auf Chromium-Emulation. iOS-Safari-
  Viewport-Einheiten, echte Touch-Hardware und Low-End-Android sind **ungeprüft**
  (dokumentiert in `docs/E2E-TESTS.md` §7).
- **Lighthouse** (`perf:lighthouse`) wurde nicht gefahren (M11-5 offen).
- **Normtexte:** Es wurden keine lizenzierten Normtexte beschafft. Die Bewertung der
  Quellenlage stützt sich auf die im Code dokumentierten Transkriptionen/Annahmen.
- **230-V-Fachprüfung:** Keine normative Abnahme durchgeführt oder möglich — das ist
  ausdrücklich Sache qualifizierten Personals.

---

## 3. Bereichsstatus

Status-Legende: **F** = Fertig und nachgewiesen · **T** = Teilweise fertig · **FH** = Fehlerhaft ·
**FE** = Fehlend · **NF** = Wegen fehlender Daten/Fachprüfung nicht freigabefähig.

| #   | Bereich                                            | Status                               | Kernbeleg / Rest                                                                                                                                                                                        |
| --- | -------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Elektroplaner & React-Flow-Zeichenfläche           | **T**                                | Canvas, Routing, Undo/Redo, Touch, Tastatur vorhanden; E2E grün. Rest: ROUTE-018 (AUD-008), Perf bei großen Plänen (AUD-006).                                                                           |
| 2   | AutoWire & Routing                                 | **T**                                | Golden Master 13, Regression 68, `routing:audit` I1–I7=0. Rest: Bank-Verdrahtung ohne UI-Deklaration (AUD-001), ROUTE-003/018.                                                                          |
| 3   | Elektrische Berechnungen & Validierung             | **T/NF**                             | Eine Stromquelle (`getCableCurrents`), eine I_z-Wahrheit, G1–G7 grün. NF für Fahrzeug-Ampazität (AUD-003); Annahmen ausgewiesen (AUD-015).                                                              |
| 4   | Komponentenbibliothek & Bauteil-Inspektoren        | **T**                                | Registry konsistent, Inspektoren breit. Rest: Bank-Felder fehlen im BatteryInspector (AUD-001).                                                                                                         |
| 5   | Batterie-, Solar-, Booster-, Wechselrichtersysteme | **T**                                | Bank-Modell, BMS-Design-Constraint, Solar-String/Kalt-Voc, Booster-Pfade vorhanden. Rest: 24-V-Serie über UI unerreichbar (AUD-001), Gleichzeitigkeits-Semantik (AUD-005).                              |
| 6   | Kabeldimensionierung & Sicherungsauswahl           | **NF (Fahrzeug) / T (Modell)**       | Modell konsistent, `I_B ≤ I_n ≤ I_z` per Konstruktion, Verlegebedingungen je Leitung. NF: B2-Hausinstallationstabelle statt FLRY/ISO 6722, f₃=1,0 (AUD-003).                                            |
| 7   | Warn-Center & Prüfbericht                          | **F**                                | 30 Regeln, Severity-Projektion, NET-003-Modellgrenzen, Klartext-Vertrag; E2E grün. Kleine Semantik-Lücke AUD-005.                                                                                       |
| 8   | Stückliste & PDF-Export                            | **T**                                | BOM/CSV/Druckbericht mit Planstand-Fingerprint + Freigabe-Gate. Rest: **kein Schaltplan im PDF** (AUD-004).                                                                                             |
| 9   | Speichern, Laden, Projektverwaltung                | **T**                                | localStorage + versionierte `.json`-Projektdatei + Share-Link, Migration, Save-Failure-Anzeige. Rest: kein Multi-Projekt-Manager (AUD-012, Produktentscheidung).                                        |
| 10  | Mobile- & Tablet-UX                                | **F (Emulation) / ungeprüft (real)** | Scroll-Architektur, Touch-Ziele ≥44 px, Überlappungs- und Geometrie-Specs grün (421 E2E). Reale Geräte ungeprüft (AUD-017).                                                                             |
| 11  | Onboarding & Benutzerführung                       | **T**                                | 3-Schritt-Wizard + geführte 5-Schritt-Leiste + Geräte-Vorlagen. Rest: kein Energiebedarfs-/Fahrzeug-Wizard im Elektrikplaner (AUD-013).                                                                 |
| 12  | Website, Ratgeber, Rechner                         | **F**                                | 42 Seiten, SEO-Exportprüfung grün, 3 Rechner auf `lib/cableSizing`/`batterySizing`/`solarSizing`, Ratgeber-Inhalte.                                                                                     |
| 13  | SEO, Performance, Barrierefreiheit, Sicherheit     | **T**                                | SEO grün, axe (critical/serious) grün, CSP zweischichtig (ADR 0038). Rest: Lighthouse offen (AUD-018), interaktive Skalierung offen (AUD-006). Tastatur-Abnahme M11-3 ist belegt erledigt (siehe §9.2). |

### 3.1 Produktabnahme — die 9 Nutzerfragen

Leitfrage: Kann ein normaler Camper-Besitzer seine Elektroinstallation vollständig,
verständlich und zuverlässig planen, prüfen und dokumentieren? Bewertung je Frage:
**Ja** / **Teilweise** / **Nein**, mit Beleg und Befund-Verweis.

| #   | Nutzerfrage                             | Urteil                                  | Beleg / Einschränkung                                                                                                                                                                                                        |
| --- | --------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Projekt starten                         | **Ja**                                  | Onboarding-Wizard (3 Schritte), Vorlagen, Einstieg Share-Link > `?template` > Starter (`usePlannerEntryPlan`); eigener Plan wird nie still überschrieben. Kein Fahrzeugprofil → AUD-013.                                     |
| 2   | Fahrzeug/Energiebedarf erfassen         | **Teilweise**                           | Dashboard berechnet Autarkie/Ladezeit aus Watt×Stunden, PWR-001 warnt bei fehlendem Bedarf. Aber **kein geführter Bedarfs-Wizard** im Elektrikplaner; `vehicleTemplates` nur in `tools/dach`/`heizung` → AUD-013.            |
| 3   | Komponenten finden/konfigurieren        | **Ja**                                  | Katalog + `deviceAssistant` (Watt-Vorlagen), breite Inspektoren, konsistente Registry. Einschränkung: Bank-Felder fehlen → AUD-001.                                                                                          |
| 4   | Vollständige Verkabelung                | **Nein (Multi-Batterie) / Ja (Einzel)** | AutoWire + manuell, Routing invariantenfrei. **Aber:** 2-Batterien-Bank nicht deklarierbar → zweite Batterie bleibt unverbunden (AUD-001, P0); 24-V-Serie nicht zeichenbar. Der Normalfall „zwei Aufbaubatterien" scheitert. |
| 5   | Auto-Vorschläge verstehen/kontrollieren | **Ja**                                  | `AutoWireReviewModal` mit Vorher/Nachher je Leitung (`lib/autoWire/reviewDiff.ts`), BMS-Design-Budget-Banner, Klartext; Nutzer kann übernehmen/ablehnen.                                                                     |
| 6   | Fehler beheben                          | **Ja (mit Lücken)**                     | Warn-Center (30 Regeln), Severity, Klartext, Fokus-Navigation, `rootCauses`. Lücken: `ambiguous-topology`-Frage wird nicht angezeigt (AUD-001); Gleichzeitigkeits-Semantik verwirrend (AUD-005).                             |
| 7   | Vollständiger Schaltplan                | **Teilweise**                           | Canvas zeigt den Plan, PNG-Export separat. Aber PDF-Bericht enthält **keinen Schaltplan** (AUD-004); ROUTE-018 kann eine Leitung durchs eigene Bauteil zeigen (AUD-008).                                                     |
| 8   | Stückliste + brauchbarer PDF-Bericht    | **Teilweise**                           | BOM/CSV mit Planstand-Fingerprint + Freigabe-Gate; Druckbericht mit Status/Blockern/Prüfbericht. Aber kein Schaltplan im PDF → zwei getrennte Exporte können auseinanderlaufen (AUD-004).                                    |
| 9   | Zuverlässig speichern/fortsetzen        | **Ja (Einzelprojekt)**                  | localStorage + versionierte Projektdatei + Share-Link, Migration („Retten statt Verwerfen"), Save-Failure-Anzeige. Nur ein Slot, kein Multi-Projekt-Manager → AUD-012.                                                       |

**Mobile/Tablet** (Scrollverhalten, Touchziele, Überlagerungen, Lesbarkeit): In der
Chromium-Emulation **nachgewiesen** (421 funktionale E2E grün, Touch-Ziele ≥ 44 px,
Überlappungs-/Geometrie-/Scroll-Specs). **Reale Geräte ungeprüft** (AUD-017).

**Gesamtantwort auf die Leitfrage:** Für eine **Einzelbatterie-12-V-Anlage** ist der
Workflow heute weitgehend geschlossen. Für den **Normalfall mit zwei Aufbaubatterien**
(Frage 4) und für eine **übergabefähige Gesamtdokumentation** (Fragen 7/8) ist das Produkt
**noch nicht nutzerfertig** — das sind die Release-Blocker AUD-001 und AUD-004. Die
230-V-Seite ist bewusst begrenzt und darf nicht als „vollständig geprüft" gelten (AUD-002).

---

## 4. Befunde

Jeder Befund: ID · Priorität · Fundstelle · Ist · Soll · Nutzer-Auswirkung · Lösung ·
Abnahmekriterien · Tests · Aufwand (PT = Personentage) · Abhängigkeiten.

### P0 — Release-Blocker

---

#### AUD-001 — Batteriebank-Topologie ist über die UI nicht deklarierbar (Workflow-Sackgasse) · **P0**

- **Fundstelle:**
  - `lib/autoWire.ts:456` (Konflikt `AUTO-BANK-001`: „Bitte am Akku `bankId` und `bankTopology` setzen")
  - `lib/electricalGraph/batteryBank.ts:21–23, 276–350` (Deklarationsfelder, `unassigned`-Fallback)
  - `components/inspector/NodeInspectors.tsx:88–367` (`BatteryInspector` — **keine** Felder für `bankId`/`bankTopology`/`bankSeries`/`bankParallel`)
  - `components/planner/hooks/useLiveValidation.ts:432–437` (Filter verwirft `ambiguous-topology`-Frage)
  - `lib/connectionRules.ts:127–138` (Batterie×Batterie plus↔minus blockiert → Serie nicht zeichenbar)
  - `lib/nodeSchema.ts:94–96` (Felder existieren im Schema, sind also importierbar)
- **Ist:** Das Domänenmodell verlangt eine explizite Bank-Deklaration, sobald mehr als eine
  Aufbaubatterie im Plan ist. AutoWire verweigert dann die Verdrahtung der zweiten Batterie und
  meldet einen Konflikt, der den Nutzer auffordert, `bankId`/`bankTopology` „am Akku" zu setzen.
  Der `BatteryInspector` bietet diese Felder **nicht** an (geprüft: in `components/`, `store/`,
  `app/` existieren nur Typdefinitionen `components/nodes/types.ts:73–79` und die
  Warnungs-Konstruktion in `useLiveValidation.ts:441,459` — **kein Eingabe-Feld**). Die
  Live-Validierung zeigt die eigentliche Rückfrage (`ambiguous-topology`) nicht. Eine
  Serien-Schaltung ist zusätzlich über `connectionRules` blockiert. **Reproduziert per Sonde**
  (§2.2): 2. Batterie bleibt unverbunden.
- **Soll:** Ein Nutzer kann im Batterie-Inspektor die Verschaltung erklären (Einzel / Parallel /
  Serie / Serie-Parallel mit Reihen-/Parallelzahlen), die Warn-Zentrale führt zur fehlenden
  Angabe, und AutoWire verdrahtet eine erklärte Parallelbank bzw. behandelt eine erklärte
  Serienbank konsistent (Spannung, Kapazität, BMS-Grenzen).
- **Nutzer-Auswirkung:** Der Normalfall „zwei Aufbaubatterien" ist über die UI **nicht
  abschließbar**. Der Nutzer erhält eine Meldung, die auf ein nicht existierendes Feld
  verweist; die einzige Auflösung ist manuelles Editieren der `.json`-Projektdatei. 24-V-
  Serienbanken sind über die UI gar nicht erreichbar. Das blockiert genau die Kernzielgruppe.
- **Lösung:** (a) Bank-Sektion im `BatteryInspector` (Bank-ID, Topologie-Select, bedingte
  Reihen-/Parallelzahlen) auf Basis der vorhandenen `DECLARABLE_BANK_TOPOLOGIES`; (b) die
  `ambiguous-topology`-Frage in `useLiveValidation` surfaced (mit Fokus auf die Batterie);
  (c) Klartext-Hinweis statt Rohfeldnamen im Konflikttext; (d) decide: Serienbank entweder
  vollständig modellieren (Spannung/Kapazität/Ik über `batteryBank`) oder im UI klar als
  „nicht unterstützt" ausweisen — nicht halb. Keine Änderung an Grenzwerten.
- **Abnahmekriterien:** 2-Batterien-Plan lässt sich vollständig über die UI parallel erklären,
  AutoWire verbindet beide, Kapazität/BMS-Grenzen stimmen mit `deriveBatteryBanks` überein;
  die Warnung verschwindet nach Deklaration; ein Serien-Plan wird entweder korrekt bewertet
  oder explizit als nicht unterstützt gemeldet (kein stiller Zustand).
- **Tests:** `NodeInspectors.test.tsx` (Bank-Felder), `useLiveValidation.test.ts`
  (ambiguous-topology sichtbar + verschwindet nach Deklaration), `lib/autoWire.test.ts`
  (erklärte Parallelbank wird verdrahtet), E2E `planner-flow`/`mobile-geometry` (2-Batterien-
  Pfad), Golden Master unverändert (Referenzpläne haben keine Bank-Deklaration).
- **Aufwand:** 3–5 PT.
- **Abhängigkeiten:** AUD-011 (Bank-Konsistenz Kurzschluss/Systemspannung) sollte mitgedacht
  werden; keine Abhängigkeit zu Routing.

---

#### AUD-002 — 230-V-Seite: Einleiter-Modell, Umschaltung/Rückspeisung nicht modelliert · **P0 (Produktabgrenzung) / NF (normativ)**

- **Fundstelle:** `lib/verify/acScope.ts` (`AC_230V_SCOPE_ITEMS`, `NET-003`),
  `lib/verify/pipeline.ts:70–78` (`ENGINE_LIMITATIONS`, 7 Einträge), `docs/AC-230V-MODELLGRENZEN.md`,
  `lib/acProtection.ts:56` (`UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0.8`, UNVERIFIED).
- **Ist:** Der Graph ist einleiterig. L/N/PE als getrennte Leiter, zweipolige Trennung als
  reales Gerät, Umschaltung Landstrom↔Wechselrichter, Verriegelung gegen Rückspeisung und
  PE-zur-Karosserie sind **nicht modelliert**. Seit 2026-11-04 wird das über `NET-003` als
  drei `UNVERIFIABLE`-Befunde mit neun Einzelpunkten **prüfbar ausgewiesen**; 230-V-Pläne
  werden `INCOMPLETE`, nie `COMPLIANT`. Die Schleifenimpedanz nutzt eine UNVERIFIED-Annahme.
- **Soll:** Entweder (a) die 230-V-Seite wird als **bewusst begrenzter Planungsumfang**
  veröffentlicht ( prominente Kennzeichnung, kein „geprüft"-Anspruch), oder (b) ein echtes
  Mehrleiter-/Umschalt-/Rückspeisemodell wird gebaut und fachlich geprüft.
- **Nutzer-Auswirkung:** Ein Laie könnte einen 230-V-Plan für „fertig geprüft" halten. Die
  Engine verhindert das bereits aktiv (gut), aber die **Produktkommunikation** muss dieselbe
  Grenze ziehen. Für den Anspruch „vollständig, zuverlässig planen/prüfen/dokumentieren"
  ist 230 V ohne Fachprüfung **nicht freigabefähig**.
- **Lösung:** Produktentscheidung herbeiführen (Owner). Für Release-Variante (a): 230-V-
  Modellgrenzen in Onboarding, Stückliste und Landingpage prominent machen (teilweise schon
  über NET-003/Inspektor vorhanden); Variante (b) ist ein eigenes, großes Arbeitspaket mit
  Elektrofachkraft-Review und neuen Daten — nicht Teil eines schnellen Releases.
- **Abnahmekriterien:** (a) Kein 230-V-Plan kann ohne sichtbare Modellgrenze exportiert werden
  (bereits erfüllt, E2E-bestätigt); Landingpage/Onboarding nennen die Grenze explizit.
  (b) nur mit dokumentierter Fachprüfung.
- **Tests:** `lib/verify/acScope.test.ts` (8), `pipeline.test.ts`, `WarningCenter.test.tsx`,
  E2E `fresh-session-retest` (Klartext-Vertrag) — bereits grün; für (a) zusätzlich ein
  Landingpage-/Onboarding-Texttest.
- **Aufwand:** (a) 1–2 PT; (b) 15–30 PT + Fachprüfung (nicht schätzbar ohne Daten).
- **Abhängigkeiten:** Produktentscheidung; AUD-015 (Impedanz-Annahme).

---

### P1 — Notwendige Produktfunktionen / Kernqualität

---

#### AUD-003 — Fahrzeug-Kabeldaten: B2-Hausinstallationstabelle statt FLRY/ISO 6722, f₃ = 1,0 · **P1 / NF**

- **Fundstelle:** `lib/electrical.ts:18–29` (`VDE_AMPACITY`, Kommentar „Fahrzeugkontext … NICHT
  modelliert"), `lib/cableConditions.ts` (f₃=1,0), `docs/KABEL-VERLEGEBEDINGUNGEN.md` §2,
  `KNOWN-PROBLEMS.md` ELE-001 (Rest, P1).
- **Ist:** Die Belastbarkeitstabelle ist eine Sekundärquellen-Transkription von DIN VDE 0298-4
  Verlegeart B2 (Hausinstallation), 50/70 mm² weichen von einer Referenz ab und sind
  Golden-Master-bedingt unverändert. FLRY-B/FLR2X-B werden nur als Temperaturklasse behandelt,
  nicht als Fahrzeug-Ampazitätstabelle. f₃ (Verlegeart) = 1,0 mangels geprüfter Tabelle.
  Verlegebedingungen je Leitung (P0-3) sind vorhanden und wirken auf Sizing/Sicherung/AMP-001.
  Ein echter Datenblattwert kann die Tabellenrechnung bereits übersteuern
  (`manufacturerIzA`, `lib/cableConditions.ts:184,207`) — das ist der vorgesehene Escape-Hatch,
  ersetzt aber keine validierte Fahrzeugtabelle für den Normalfall.
- **Soll:** Eine zitiergeprüfte Fahrzeugleitungs-Ampazitätstabelle (ISO 6722 / DIN EN 1648-2 /
  FLRY) oder die jetzige, dokumentierte Annahme — aber dann darf das Produkt keine
  fahrzeugspezifische Belastbarkeits-Aussage als „geprüft" verkaufen.
- **Nutzer-Auswirkung:** Querschnitte/Sicherungen können von realen Fahrzeugtabellen abweichen.
  Die Richtung ist durch die 0,7-Pauschale konservativ, aber „konservativ" ist kein Ersatz für
  eine belegte Fahrzeugtabelle. Für den Anspruch „zuverlässig" ist das eine Datenlücke.
- **Lösung:** Datenbeschaffung + Zitatprüfung (ISO 6722, FLRY-Herstellerdaten), dann Golden-
  Master-Neuerfassung **mit Begründung** (kein stilles „Werte verbessern"). Bis dahin:
  Bewertung im Bericht/Inspektor als „Referenzmodell/Annahme" beibehalten (bereits vorhanden).
- **Abnahmekriterien:** Entweder belegte Tabelle eingeführt + Golden Master begründet neu
  erfasst + G1–G7 grün, oder die Annahme ist in allen Nutzeroberflächen konsistent als solche
  gekennzeichnet (kein „geeignet" ohne Grundlage).
- **Tests:** `lib/electrical.test.ts`, `vde-properties.test.ts` (G1), `cableConditions.test.ts`,
  `autoWire/cableConditionsIntegration.test.ts`, `verify/cableConditions.test.ts`, Golden Master.
- **Aufwand:** Datenbeschaffung/Zitatprüfung 3–8 PT (extern abhängig), Einführung 2–4 PT.
- **Abhängigkeiten:** Keine Code-Abhängigkeit; Golden-Master-Disziplin; Produktentscheidung
  über Quellenbudget.

---

#### AUD-004 — PDF-/Druckbericht enthält keinen Schaltplan · **P1**

- **Fundstelle:** `components/planner/utils/printReport.ts:170–227` (`buildPrintReportHtml`:
  nur Status, Blocker, Stückliste, Prüfbericht — **kein Bild/SVG des Plans**);
  `components/planner/utils/exportPlanImage.ts` (PNG-Export ist ein **separater** Menüpunkt).
- **Ist:** Der „Druckbericht (PDF)" ist ein druckoptimiertes HTML mit Stückliste + Prüfbericht.
  Der Schaltplan selbst ist nicht enthalten; der Nutzer muss zusätzlich „Plan als Bild
  exportieren" (PNG) nutzen. Für eine geschlossene Dokumentation („Schaltplan + Stückliste +
  Prüfbericht in einem Dokument") fehlt die Zusammenführung.
- **Soll:** Der Bericht enthält den Schaltplan (als eingebettetes Bild/SVG) zusammen mit
  Stückliste, Prüfbericht, Planstand und Modellgrenzen — ein Dokument, ein Planstand.
- **Nutzer-Auswirkung:** Der Nutzer kann keinen vollständigen, übergabefähigen Planungsordner
  aus einem Guss erzeugen; zwei getrennte Exporte können auseinanderlaufen (unterschiedliche
  Planstände). Für die Übergabe an eine Werkstatt/Elektrofachkraft ist das unpraktisch.
- **Lösung:** `exportPlanImage` (oder eine SVG-Serialisierung des Route-Cache) in den
  Print-Report einbetten; sicherstellen, dass Bild und BOM denselben Snapshot/Fingerprint
  nutzen; bei gesperrtem Plan weiterhin kein Bericht. Drucklayout für das Bild (A4, skalierbar).
- **Abnahmekriterien:** Bericht enthält Schaltplan + Stückliste + Prüfbericht mit identischem
  `planFingerprintHash`; gesperrter Plan erzeugt keinen Bericht; Bild ist auch bei großen
  Plänen lesbar (ggf. eigene Seite).
- **Tests:** `printReport.test.ts` (Bild enthalten, Fingerprint gleich), `BOMModal.test.tsx`,
  E2E `project-file`/`planner-flow` (Export-Pfad), visueller Nachweis 375/1440.
- **Aufwand:** 2–4 PT.
- **Abhängigkeiten:** `exportPlanImage`/Route-Cache; keine Electrical-Änderung.

---

#### AUD-005 — „Gleichzeitige 230-V-Geräte" wird vom Strommodell ignoriert (Semantik-Bruch) · **P1**

- **Fundstelle:** `components/nodes/InverterNode.tsx:20–36` und
  `components/planner/PlannerDashboard.tsx:193–210` (nutzen `concurrentDevices` für
  Überlast-Warnung); `lib/electricalGraph/currentFlow.ts:489–519` (`buildAcIslandWatts` summiert
  **alle** `consumer230v` der AC-Insel, ohne `concurrentDevices`);
  `components/inspector/NodeInspectors.tsx:792–810` (Auswahl-UI).
- **Ist:** Der Nutzer wählt im WR-Inspektor, welche 230-V-Geräte gleichzeitig laufen. Diese
  Auswahl steuert nur die Überlast-Anzeige der WR-Karte und die Dashboard-Warnung. Das
  Topologie-Strommodell (Kabeldimensionierung, Sicherung, BMS-Design-Budget, Verifikation)
  rechnet mit der **vollen Insel-Summe**. **Reproduziert per Sonde** (§2.2): 196 A statt der
  deklarierten 500 W.
- **Soll:** Entweder die Gleichzeitigkeits-Auswahl wirkt konsistent auf das Strommodell
  (mit klarer Kennzeichnung, dass es eine Nutzer-Annahme ist), oder die UI macht deutlich,
  dass die Kabel unabhängig davon für die volle Insel-Summe dimensioniert werden
  (konservative Auslegung) — und die Auswahl heißt entsprechend („nur Überlast-Check").
- **Nutzer-Auswirkung:** Der Nutzer deklariert „nur 500 W gleichzeitig", die Karte sagt „nicht
  überlastet", aber das Kabel wird für 196 A dimensioniert und das BMS-Budget ggf. als
  unzureichend gemeldet. Das ist in der Kabelrichtung konservativ/sicher, aber semantisch
  verwirrend und nicht dokumentiert. Er kann das Ergebnis nicht nachvollziehen.
- **Lösung:** Produktentscheidung: (a) `concurrentDevices` als deklarierte Gleichzeitigkeits-
  Annahme ins Strommodell aufnehmen (nur für die WR-Insel, mit Herkunfts-Kennzeichnung
  `assumption`), oder (b) UI umbenennen/erklären + Doku. Keine stille Änderung der
  Dimensionierung ohne Golden-Master-Prüfung.
- **Abnahmekriterien:** Karte, Warn-Zentrale, Kabeldimensionierung und Bericht erzählen
  dieselbe Geschichte; die Auswahl hat entweder dokumentierte Wirkung oder ist klar als
  reiner Überlast-Check gekennzeichnet.
- **Tests:** `currentFlow`-Test (Insel mit/ohne concurrentDevices), `InverterNode.test.tsx`,
  `PlannerDashboard.test.tsx`, `vde-consistency.test.ts`, Golden Master (bei Variante a).
- **Aufwand:** 2–3 PT (Variante b) / 4–6 PT (Variante a).
- **Abhängigkeiten:** AUD-001 nicht zwingend; Golden-Master-Disziplin bei Variante a.

---

#### AUD-006 — Interaktive Performance bei großen Plänen (V2-SCALE-001); PERF-001-Gate ist gelöst · **P1**

- **Fundstelle:** `benchmarks/edgeRoutingPerf.bench.ts`, `benchmarks/routeAllScaling.probe.ts`,
  `components/edges/utils/cableRouteStore.ts`, `tests/scale/plannerScale.test.ts`,
  `KNOWN-PROBLEMS.md` PERF-001 (Status: **GELÖST im Sinne des Gates**, 2026-10-06) und
  V2-SCALE-001 (`docs/AUDIT-CAMP-ELEKTROPLANER.md:75`, OFFEN), `agent.md` P-1/P-2/P-4/P-5/P-6,
  ADR 0012/0030/0033/0034.
- **Ist:** Zwei getrennte Aussagen, die nicht vermischt werden dürfen:
  (1) Das **16-ms-Render-Gate** (ADR 0012, Kanten-Renderpfad `CableEdge`) **besteht**
  (dokumentiert ≈ 2 ms Median). (2) Der **Live-Gesamtpass** `routeAllCables` hat seit
  ADR 0033/0034 einen **begründeten 300-ms-Ratchet** und **besteht** ihn: dieses Audit misst
  allein **Median 237 ms / p90 261 ms** (N=36/E=134). PERF-001 ist damit **kein offener
  Gate-Fehler** und wird hier nicht erneut geöffnet. Offen ist **V2-SCALE-001**: Routing
  skaliert überlinear — 250 Knoten ≈ 62 s Routing + 66 s Invariantenprüfung; Routing-only
  N=250 ≈ 2,2 s, N=500 ≈ 5,6 s. Der Routing-Worker (`routing.worker.ts`) existiert, hat aber
  keinen Produkt-Konsumenten (P-6).
- **Soll:** Interaktive Pan/Drag/Auto-Wire auch bei ~100 Bauteilen / 300 Kanten; inkrementelles
  Re-Routing (Affected-Set), Drag-Vorschau, Worker-Anbindung — ohne das bestehende Gate
  anzutasten.
- **Nutzer-Auswirkung:** Große, realistische Camper-Pläne ruckeln beim Verschieben/Auto-Verdrahten;
  das untergräbt die professionelle Anmutung und die Tablet-Tauglichkeit. Kleine/mittlere
  Pläne (der Normalfall) sind nicht betroffen.
- **Lösung:** Die bereits geplanten, aber offenen P-1/P-2/P-4/P-5/P-6 aus `agent.md` umsetzen
  (Affected-Set, zweistufiger Drag, Topologie-Signatur für Validierung, scoped Nudge, Worker).
  Jeweils mit Benchmark + ADR, kein stilles Anheben des Budgets.
- **Abnahmekriterien:** 100-Bauteile/300-Kanten-Szenario Pan/Drag ≤ 16 ms/Frame (P-6-Abnahme),
  keine veralteten Pfade, Golden Master byte-stabil, bestehende Ratchets unverändert grün.
- **Tests:** `perf:edge-routing`, `perf:route-scaling`, `SCALE_250=1 tests/scale/plannerScale.test.ts`,
  Regression/Golden Master, E2E `routing-stability`.
- **Aufwand:** 8–15 PT (inkrementell, mehrere Scheiben).
- **Abhängigkeiten:** Routing-Disziplin (I1–I7, Tokens, Golden Master); keine Electrical-Änderung.

---

#### AUD-007 — Tastatur-Vollbedienung des Canvas nicht abgenommen (M11-3) · **P1**

- **Fundstelle:** `AGENTS.md` §9 M11-3 (offen), `tests/e2e/planner-keyboard.spec.ts`
  (vorhanden, ein Mini-Plan-Pfad), `KNOWN-PROBLEMS.md` AUDIT-2026-09-25 A2/A3 (axe schließt
  Canvas aus).
- **Ist:** Tastaturkürzel, Fokus, Pfeiltasten-Verschieben, Enter-Verbinden sind vorhanden und
  teilweise E2E-getestet. Die **Abnahme** „Canvas komplett per Tastatur bedienbar (E2E baut
  Mini-Plan nur per Tastatur)" ist laut AGENTS.md offen; axe klammert den Canvas aus.
- **Soll:** Vollständiger, abgenommener Tastatur-Pfad (Bauteil hinzufügen → verbinden →
  verschieben → prüfen → exportieren) ohne Zeiger; semantisch benannte Canvas-Struktur für axe.
- **Nutzer-Auswirkung:** Nutzer mit motorischen Einschränkungen / reine Tastatur-Nutzer können
  den Planer möglicherweise nicht vollständig bedienen; Barrierefreiheits-Anspruch nicht erfüllt.
- **Lösung:** M11-3-Abnahme-E2E bauen/erweitern, Canvas-Semantik für axe prüfen, Restlücken
  schließen. Keine neuen Features, nur Abnahme + gezielte Fixes.
- **Abnahmekriterien:** E2E baut einen Mini-Plan ausschließlich per Tastatur; axe ohne
  critical/serious inkl. Canvas (oder begründete, dokumentierte Ausnahme).
- **Tests:** `planner-keyboard.spec.ts`, `planner-canvas-a11y.spec.ts`, `a11y.spec.ts`.
- **Aufwand:** 2–4 PT.
- **Abhängigkeiten:** Keine.

---

#### AUD-008 — ROUTE-018: Wiedereintritt in eigenes Gerät bei gemessener Geometrie · **P1**

- **Fundstelle:** `components/edges/utils/routeValidation.ts` (`ROUTE-OWN-NODE`),
  `routeAll.ts`, `KNOWN-PROBLEMS.md` ROUTE-018, `tests/fixtures/routing/complex-measured-geometry.json`.
- **Ist:** Mit gemessener React-Flow-Geometrie liegt der Port teils innerhalb der Kartenbox;
  eine Trasse kann das eigene Gerät verlassen und wieder durchfahren. Der strenge Validator
  meldet das als kritischen `ROUTE-OWN-NODE` (1 Befund auf `complex`, `e-batt-minus`). Auf
  ungemessenen Golden-Master-Fixtures tritt es nicht auf; als `INVALID` eingefroren.
- **Soll:** Router vermeidet den Wiedereintritt, ohne I1/I2/I3 und die Referenz-SVGs zu
  verschlechtern.
- **Nutzer-Auswirkung:** Im Live-Plan (mit echten DOM-Maßen) kann eine Leitung sichtbar durch
  das eigene Bauteil laufen und der Routing-Status wird `INVALID` — irritierend und ein
  Qualitätsmangel, auch wenn keine elektrische Fehlverdrahtung vorliegt.
- **Lösung:** Gezielte Router-Korrektur am Wiedereintritt (Port-Stub-Ausnahme präzise halten),
  mit Regressionstest auf der gemessenen Fixture; danach `VALID` erwarten.
- **Abnahmekriterien:** `complex` mit gemessener Geometrie `VALID`, Referenzpläne byte-stabil,
  I1–I7 = 0.
- **Tests:** `routeAll.test.ts`, `routeValidation`-Suite, `test:regression`, Golden Master.
- **Aufwand:** 2–4 PT.
- **Abhängigkeiten:** Routing-Workflow; AUD-006 nicht zwingend.

---

#### AUD-009 — ROUTE-003: 24-px-Domänentrennung ist kein CI-Gate, 8 Restpaare · **P1/P2**

- **Fundstelle:** `lib/routing/rules/collision.ts` (`requiredClearanceBetween`),
  `components/edges/utils/separation.ts`, `KNOWN-PROBLEMS.md` ROUTE-003,
  `npm run routing:domain-probe`.
- **Ist:** Die Paarregel (electrical↔water / ac230↔dc12 → 24 px) wirkt seit ADR 0033 im
  Trenngang; gemessen 16 → 8 parallele Mischpaare unter 24 px (alle in `complex`, Stubs/dichte
  Bündel). `checkClearance` (I3) prüft die Domänenregel **nicht**; „24 px" ist eine Messung,
  kein CI-Fail.
- **Soll:** Entweder getrennte AC/DC-Korridore an den Ports (Layout-Entscheidung) oder die
  verbleibenden 8 Paare werden bewusst als dokumentierte Grenze geführt.
- **Nutzer-Auswirkung:** 230-V- und 12-V-Leitungen können im Plan näher als die deklarierte
  Trennung laufen; für die reale Verlegung (getrennte Trassen) ist das ein Qualitätsmangel,
  kein unmittelbarer Sicherheitsverstoß im Modell.
- **Lösung:** Port-Fan-Out je Domäne (eigene Lane) prüfen; nur mit Messung über beide Pfade
  und Golden-Master-Disziplin. Alternativ Rest dokumentieren und Domain-Probe als Ratchet halten.
- **Abnahmekriterien:** Mischpaare unter 24 px = 0 oder begründete, eingefrorene Restliste;
  Referenzpläne I1–I7 = 0.
- **Tests:** `routing:domain-probe`, `collision.test.ts`, `domainProbe.test.ts`, Regression.
- **Aufwand:** 3–6 PT.
- **Abhängigkeiten:** Routing/Placement; AUD-006 (Performance) nicht blockierend.

---

### P2 — UX-, Konsistenz- und Produktentscheidungen

---

#### AUD-010 — Doku-Drift: tote Stromquelle in Agenten-Dokus + veraltete Feature-Verbotsliste · **P2**

- **Fundstelle:** `AGENTS.md:50`, `docs/ai/ELECTRICAL-CONTEXT.md:62,74,352` (nennen
  `calculateEdgeCurrent`/`acCurrentA`); Produktivpfad ist `getCableCurrents`
  (`lib/electricalGraph/currentFlow.ts:2205`), genutzt von `CableEdge.tsx:27,650`,
  `useLiveValidation.ts:23,426`, `bom.ts:15,280`, `verify/graph.ts:33,507`,
  `autoWire/sizing.ts:59`. `calculateEdgeCurrent` (`vde-standards.ts:352`) hat **keine**
  Produktiv-Aufrufer mehr (nur Tests); `acCurrentA` ist entfernt.
  `vde-consistency.test.ts:127–128` verbietet die alten Funktionen in `CableEdge` sogar.
  Zusätzlich: `AGENTS.md` §8 nennt „kein Export/Import, keine Energiebilanz" als
  Freigabe-Vorbehalt, obwohl beide bereits existieren (`store/projectFile.ts`,
  `store/sharePlan.ts`, `PWR-001-energy-balance`, Dashboard-Metriken) — die Verbotsliste
  ist teilweise veraltet (nur „kein Multi-Plan" und „kein PWA" treffen noch zu).
- **Ist:** Die verbindlichen Agenten-Dokumente verweisen auf eine veraltete Stromquelle und
  eine teilweise überholte Feature-Liste. Ein Agent, nur nach Doku arbeitend, könnte die tote
  Funktion „reaktivieren", eine zweite Stromquelle bauen oder bereits existente Features
  fälschlich für verboten halten.
- **Soll:** Doku nennt `getCableCurrents` als eine Quelle; tote Funktion entweder entfernen
  oder klar als Legacy/Test-only markieren; §8-Liste auf den tatsächlichen Stand bringen.
- **Nutzer-Auswirkung:** Indirekt (Fehlentwicklungs-Risiko), kein direkter Produktfehler.
- **Lösung:** AGENTS.md §4/§8 + ELECTRICAL-CONTEXT.md aktualisieren; `calculateEdgeCurrent`
  als deprecated markieren oder (nach Test-Umstellung) entfernen. Kein Verhaltensänderung.
- **Abnahmekriterien:** Doku und Code stimmen überein; `vde-consistency` bleibt grün.
- **Tests:** `vde-consistency.test.ts`, `vde-standards.test.ts` (bei Entfernung anpassen).
- **Aufwand:** 0,5–1 PT.
- **Abhängigkeiten:** Keine.

---

#### AUD-011 — Bank-Modell nur teilweise in der Rechenkette verdrahtet (Ik/Systemspannung) · **P2**

- **Fundstelle:** `lib/shortCircuit.ts:163–185` (`bankEquivalentRiMilliOhm` = reine
  Parallelschaltung, `bankVoltage` = erste Hausbatterie); `lib/vde-standards.ts:287–333`
  (`getSystemVoltage` = Vorrangbatterie, nicht Bank-Serien-Spannung);
  `lib/electricalGraph/batteryBank.ts:385–405` (Serie: `nominalVoltage = cellVoltage × seriesCount`).
- **Ist:** Das Bank-Modell berechnet für Serienbanken die korrekte Bank-Spannung/Kapazität,
  aber `getSystemVoltage` (Systemspannung) und `shortCircuit` (Ik, reiner Parallel-Ri) nutzen
  das nicht. Für eine deklarierte 24-V-Serie würde die Systemspannung weiter 12,8 V betragen
  (außer der Nutzer setzt `nominalVoltage` manuell) und Ik konservativ als Parallel geschätzt.
  `currentFlow` nutzt die **Verdrahtung** als Wahrheit für Strings (gut), aber die
  Systemspannung kommt aus `getSystemVoltage`.
- **Soll:** Eine deklarierte Bank steuert Systemspannung, Kapazität, BMS-Grenzen und Ik
  konsistent — oder Serienbanken werden durchgängig als „nicht unterstützt" geführt.
- **Nutzer-Auswirkung:** Folgefehler zu AUD-001: Selbst wenn ein Nutzer die Bank per JSON
  deklariert, rechnen Systemspannung/Kurzschluss nicht vollständig mit der Bank-Topologie.
  Richtung bei Ik konservativ, aber nicht konsistent.
- **Lösung:** Bank-Ableitung in `getSystemVoltage`/`shortCircuit` einspeisen (oder Serien
  explizit sperren), mit Property-Tests und Golden-Master-Prüfung. Zusammen mit AUD-001 denken.
- **Abnahmekriterien:** Deklarierte Serie → konsistente Spannung/Kapazität/Ik oder explizite
  Nicht-Unterstützung; kein stiller Widerspruch.
- **Tests:** `batteryBank.test.ts`, `shortCircuit.test.ts`, `vde-properties.test.ts`,
  `currentFlow`-Tests, Golden Master.
- **Aufwand:** 3–5 PT.
- **Abhängigkeiten:** AUD-001 (UI-Deklaration) als Auslöser; Produktentscheidung Serie ja/nein.

---

#### AUD-012 — Kein Multi-Projekt-Manager (ein localStorage-Slot + Dateien) · **P2 (Produktentscheidung)**

- **Fundstelle:** `store/slices/persistence.ts` (ein Storage-Key `elektroplaner-planner-v1`),
  `store/projectFile.ts` (Export/Import `.json`), `store/sharePlan.ts` (Share-Link);
  `AGENTS.md` §8 („kein Multi-Plan" ohne Freigabe).
- **Ist:** Es gibt genau einen aktiven Plan im Browser; Sicherung/Weitergabe über versionierte
  Projektdatei und Share-Link. Kein Projektliste/Manager, kein paralleles Arbeiten an mehreren
  Fahrzeugen.
- **Soll:** Für ein professionelles Produkt: mehrere benannte Projekte, Wechsel, evtl.
  Duplizieren. **Aber:** AGENTS.md verbietet Multi-Plan ohne Freigabe — das ist eine
  Produktentscheidung, keine eigenmächtige Implementierung.
- **Nutzer-Auswirkung:** Wer mehrere Fahrzeuge/Varianten plant, muss Dateien manuell
  verwalten; ein versehentliches Überschreiben des einen Slots ist möglich (Import fragt nach).
- **Lösung:** Produktentscheidung einholen; bei Freigabe ein Projekt-Manager (localStorage-
  Index + Projektdateien) als eigenes Arbeitspaket. Bis dahin: Datei-Workflow prominent machen.
- **Abnahmekriterien:** (bei Freigabe) mehrere Projekte verlustfrei wechselbar, Import/Export
  kompatibel; (ohne) der Ein-Plan-Workflow ist klar kommuniziert.
- **Tests:** `projectFile.test.ts`, `importProject.test.ts`, `persistence.test.ts`, E2E
  `project-file`/`persistence`.
- **Aufwand:** 5–8 PT (bei Freigabe).
- **Abhängigkeiten:** Produktfreigabe (AGENTS.md §8).

---

#### AUD-013 — Kein Energiebedarfs-/Fahrzeug-Wizard im Elektrikplaner · **P2**

- **Fundstelle:** `components/planner/OnboardingWizard.tsx` (3 Schritte: Quellen → Geräte →
  Vorlage), `components/sidebar/catalog.ts:56+` (`deviceAssistant` mit Watt-Vorlagen),
  `lib/vehicleTemplates.ts` (nur in `app/tools/dach` + `app/tools/heizung` genutzt, **nicht**
  im Elektrikplaner), `components/planner/hooks/useDashboardMetrics.ts` (Autarkie aus
  Watts×Stunden).
- **Ist:** Onboarding wählt eine Vorlage; Geräte-Wattwerte kommen aus Vorlagen/Inspektor;
  Autarkie/Ladezeit werden im Dashboard berechnet. Es gibt keinen geführten Energiebedarfs-
  Dialog (Geräteliste mit Nutzungsdauer → Tagesbedarf → Batterie-/Solar-Empfehlung) und kein
  Fahrzeugprofil im Elektrikplaner. `AGENTS.md` verbietet „Energiebilanz" als neues Feature
  ohne Freigabe — wobei Dashboard-Metriken + PWR-001 bereits existieren.
- **Soll:** Ein unerfahrener Nutzer wird von „welche Geräte, wie lange?" zu einer begründeten
  Batterie-/Solar-/WR-Auswahl geführt, statt Wattwerte selbst zusammensuchen zu müssen.
- **Nutzer-Auswirkung:** Die Kernfrage „Wie viel Batterie/Solar brauche ich?" wird nur
  indirekt beantwortet (Dashboard-Zahlen, PWR-001-Warnung). Ein Laie muss die richtige
  Konfiguration selbst finden.
- **Lösung:** Produktentscheidung; bei Freigabe ein Bedarfs-Wizard auf Basis der vorhandenen
  `deviceAssistant`-Werte + `batterySizing`/`solarSizing` (die Rechner-Libs existieren bereits).
  Keine neue Rechenlogik, nur Führung.
- **Abnahmekriterien:** Nutzer kann Bedarf eingeben und erhält eine nachvollziehbare
  Empfehlung; Empfehlungen sind als Annahmen gekennzeichnet.
- **Tests:** Wizard-Komponententests, `batterySizing`/`solarSizing`-Tests, E2E-Onboarding.
- **Aufwand:** 4–7 PT (bei Freigabe).
- **Abhängigkeiten:** Produktfreigabe; AUD-001 (Bank) für korrekte Empfehlung.

---

#### AUD-014 — KI-Assistent im Static Export: Produktentscheidung offen (ARCH-001) · **P2**

- **Fundstelle:** `app/ki-assistent/page.tsx`, `components/chat/ChatUnavailablePanel.tsx`,
  `app/api/chat/route.ts`, `lib/db.ts`, `KNOWN-PROBLEMS.md` ARCH-001, ADR 0021;
  paralleler PR #580 („KI-Assistent entfernt", nicht angefasst).
- **Ist:** Im Produktbuild (static export) zeigt `/ki-assistent` ohne konfigurierten externen
  Endpunkt einen ehrlichen „nicht verfügbar"-Hinweis (kein Leerlauf-Versand). Die Server-Route
  - `pg`-Pool liegen weiter im Baum. Ein paralleler PR (#580) entfernt den Assistenten.
- **Soll:** Klare Produktlinie: Assistent entweder als externes, konfiguriertes Feature
  dokumentieren oder ganz entfernen (Toter Code + `pg`-Abhängigkeit raus).
- **Nutzer-Auswirkung:** Ein Menüpunkt/Einstieg, der im ausgelieferten Produkt nicht
  funktioniert, wirkt unfertig; die `pg`-Abhängigkeit ist unnötige Angriffs-/Wartungsfläche.
- **Lösung:** Produktentscheidung abwarten/abstimmen (PR #580 läuft parallel — nicht
  doppelt implementieren). Bei Entfernung: Route, `lib/db.ts`, `pg`-Dependency, Seite und
  Sitemap-Eintrag konsistent entfernen.
- **Abnahmekriterien:** Kein toter Einstieg im Release; entweder dokumentiertes externes
  Feature oder vollständige Entfernung; Build/SEO-Prüfung grün.
- **Tests:** `Chat.test.tsx`, `seo`-Inventory, `workflows.test.ts`, Build.
- **Aufwand:** 1–2 PT (Entfernung) / abhängig von externem Endpunkt.
- **Abhängigkeiten:** PR #580 / Produktentscheidung — **nicht doppelt bearbeiten**.

---

#### AUD-015 — AC-Schleifenimpedanz: 0,8-Ω-Annahme (UNVERIFIED) ohne Messwert-Eingang · **P2**

- **Fundstelle:** `lib/acProtection.ts:56` (`UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0.8`),
  `KNOWN-PROBLEMS.md` ELE-002, `docs/AC-230V-MODELLGRENZEN.md` (`assumed-impedance`).
- **Ist:** Die Abschaltbedingung `Zs·Ia ≤ U0` rechnet mit einer deklarierten, als UNVERIFIED
  geführten Annahme (0,8 Ω). Ein realer Messwert kann sie schlagen, ist aber nicht als
  eigenes, prominentes Eingabefeld geführt (Datenblattfelder existieren teilweise).
- **Soll:** Die Annahme ist im Meldungstext benannt (erfüllt); ein vor-Ort-Messwert sollte
  einfach eingetragen werden können und die Annahme sichtbar ersetzen.
- **Nutzer-Auswirkung:** `fail`/`borderline`-Urteile hängen an einer Annahme; ohne Messwert
  kann der Nutzer die Abschaltbedingung nicht real bewerten. Für 230 V zusätzlich AUD-002.
- **Lösung:** Messwert-Feld (Zs bzw. upstream impedance) im AC-Inspektor + Report-Kennzeichnung
  „gemessen" vs. „angenommen". Keine Änderung des 0,8-Werts ohne Quelle.
- **Abnahmekriterien:** Messwert schlägt Annahme sichtbar; Report unterscheidet
  „mit Annahme bewertet" / „mit Messwert bewertet".
- **Tests:** `acProtection.test.ts`, `NodeInspectors.test.tsx`, `verify/protection.test.ts`.
- **Aufwand:** 1–2 PT.
- **Abhängigkeiten:** AUD-002 (230-V-Abgrenzung).

---

### P3 — Qualität, Ausbau, Verifikationslücken

---

#### AUD-016 — Pixel-Baselines in diesem Audit nicht gefahren · **P3 (Verifikationslücke)**

- **Fundstelle:** `tests/e2e/visual.spec.ts`, `visual-de-pixel.spec.ts`, `docs/UI-BASELINE.md`.
- **Ist:** Das Audit hat die funktionalen E2E gefahren (421 grün), die Pixel-Baselines aber
  ausgeschlossen. Visueller Drift ist damit **nicht bewertet**. Bekannt aus
  `NACHTEST-2026-10-16.md`: einzelne Routen-Baselines weichen in der Sandbox (Chromium 153)
  schon am Basis-Commit ab.
- **Soll:** Vor einem Release die Pixel-Baselines in einer freigegebenen Umgebung fahren und
  etwaige Abweichungen bewerten (nicht blind aktualisieren).
- **Nutzer-Auswirkung:** Unentdeckter visueller Drift möglich.
- **Lösung:** `npm run e2e -- visual` in CI/freigegebener Umgebung; Baselines nur mit
  UI-Freigabe neu aufnehmen.
- **Abnahmekriterien:** Visueller Job grün oder begründete, freigegebene Baseline-Aktualisierung.
- **Tests:** `visual.spec.ts`, `visual-de-pixel.spec.ts`.
- **Aufwand:** 0,5–1 PT (+ Umgebung).
- **Abhängigkeiten:** Browser-Umgebung; keine Code-Änderung.

---

#### AUD-017 — Nur Chromium-Emulation; reale Geräte / Safari / Firefox ungeprüft · **P3**

- **Fundstelle:** `playwright.config.ts` (nur Chromium-Projekte), `docs/E2E-TESTS.md` §7.
- **Ist:** E2E läuft auf Chromium-Emulation (desktop/tablet/mobile/touch). iOS Safari
  (eigene Engine, `dvh`/safe-area), echtes Touch-Verhalten und Low-End-Android sind ungeprüft.
- **Soll:** Mindestens ein realer iOS-Safari- und ein Android-Check der Kernpfade vor Release.
- **Nutzer-Auswirkung:** Mobile Kernzielgruppe könnte auf Realgeräten Probleme haben, die die
  Emulation nicht zeigt (Viewport, Gesten, Performance).
- **Lösung:** Manuelle Realgeräte-Checkliste (oder WebKit-Projekt ergänzen) für Onboarding,
  Zeichnen, AutoWire, Warnungen, Export, Speichern.
- **Abnahmekriterien:** Dokumentierte Realgeräte-Abnahme der Kernpfade oder begründetes
  Restrisiko.
- **Tests:** manuell / WebKit-E2E.
- **Aufwand:** 1–2 PT.
- **Abhängigkeiten:** Gerätezugang.

---

#### AUD-018 — Lighthouse-Gate nicht gefahren / nicht blockierend (M11-5) · **P3**

- **Fundstelle:** `scripts/ci/lighthouseGate.ts`, `AGENTS.md` §9 M11-5, `docs/PERFORMANCE.md`.
- **Ist:** Ein Lighthouse-Budget-Skript existiert (reine Logik getestet), wurde hier nicht
  ausgeführt; M11-5 (Performance ≥ 90 im CI + Bundle-Budget) ist offen.
- **Soll:** Lighthouse-Gate im CI blockierend oder bewusst dokumentiert nicht-blockierend.
- **Nutzer-Auswirkung:** Mögliche unentdeckte Performance-/SEO-Regressionen auf Realgeräten.
- **Lösung:** `perf:lighthouse` in CI verdrahten (Browser vorhanden), Budget kalibrieren.
- **Abnahmekriterien:** Lighthouse ≥ 90 (oder begründetes Budget) auf Kernrouten.
- **Tests:** `lighthouseGate.test.ts` + CI-Lauf.
- **Aufwand:** 1–2 PT.
- **Abhängigkeiten:** CI-Browser; AUD-006 (Routing-Perf) beeinflusst Lab-Werte.

---

#### AUD-019 — Wasser-Modus: eigene Prüfung nur Brücken-Regel, kein Vollmodell · **P3**

- **Fundstelle:** `lib/verify/topology.ts:704–722` (`TOPO-005-fluid-electrical-bridge`),
  `lib/verify/graph.ts:578,652` (Wasser wird übersprungen), `components/planner/utils/bom.ts`
  (Wasserleitungen in BOM).
- **Ist:** Der Wasser-/Dachmodus ist ein eigener Graph (`waterNodes/waterEdges`) mit BOM-
  Unterstützung; die Verifikations-Engine prüft nur die Elektrik↔Fluidik-Brücke (TOPO-005),
  kein Wasser-Druck/Durchfluss/Querschnitts-Modell.
- **Soll:** Für den Anspruch „Camper-Ausbau" entweder Wasser als einfachen Planungsmodus
  kennzeichnen (ohne Prüfanspruch) oder ein eigenes Fachmodell ergänzen.
- **Nutzer-Auswirkung:** Wasserplanung ist zeichenbar, aber nicht fachlich geprüft; darf nicht
  wie der Elektrik-Prüfumfang wirken.
- **Lösung:** UI-Kennzeichnung „Wasser: reine Planung, keine Prüfung" (gering) oder eigenes
  Arbeitspaket Wasser-Fachmodell (groß, Produktentscheidung).
- **Abnahmekriterien:** Keine falsche Prüferwartung im Wassermodus.
- **Tests:** `verify/topology.test.ts`, BOM-Tests, UI-Texttest.
- **Aufwand:** 0,5 PT (Kennzeichnung) / 10+ PT (Fachmodell).
- **Abhängigkeiten:** Produktentscheidung.

---

#### AUD-020 — Serien-Bank-Kurzschluss: Parallel-Schätzung statt Topologie (konservativ) · **P3**

- **Fundstelle:** `lib/shortCircuit.ts:163–200`, `docs/ai/ELECTRICAL-CONTEXT.md` §5.4
  („Serien-Strings nicht modelliert; Parallelschätzung ist konservativ").
- **Ist:** Ik wird aus reiner Parallelschaltung geschätzt. Für eine (künftig deklarierbare)
  Serienbank wäre das eine Überschätzung (konservativ = größere Ik → höheres Abschaltvermögen
  gefordert). Dokumentiert, aber nicht topologiekonsistent.
- **Soll:** Ik nutzt die deklarierte/verdrahtete Bank-Topologie, oder die Konservative
  Schätzung bleibt explizit gekennzeichnet.
- **Nutzer-Auswirkung:** Gering (konservative Richtung); relevant erst, wenn AUD-001/AUD-011
  Serienbanken freigeben.
- **Lösung:** Mit AUD-011 zusammenführen (eine Bank-Ableitung für Spannung, Kapazität, Ik).
- **Abnahmekriterien:** Ik konsistent zur Bank-Topologie oder dokumentiert konservativ.
- **Tests:** `shortCircuit.test.ts`, `batteryBank.test.ts`.
- **Aufwand:** in AUD-011 enthalten.
- **Abhängigkeiten:** AUD-001, AUD-011.

---

## 5. Bereits fertig & nachgewiesen (nicht erneut öffnen)

Diese Punkte wurden **verifiziert** und sind erledigt — sie werden nicht als offen geführt:

- **Routing-Invarianten:** I1–I7 = 0 auf allen 6 Referenzplänen, deterministisch, 0 Fallbacks
  (`routing:audit`); Golden Master 13/13, Regression 68/68 byte-stabil.
- **Die „9 bekannten Routing-Testfehler"** aus dem Nachtest 2026-10-16 sind behoben
  (59/59 grün nachgemessen).
- **BMS als Design-Constraint** (P0-2): `designBudget.ts`, `AUTO-BMS-000/001/002`,
  Review-Banner; Laststrom wird nicht gekappt.
- **Verlegebedingungen je Leitung** (P0-3): `cableConditions.ts`, eine I_z-Wahrheit,
  ungültige Eingaben → `UNVERIFIABLE` statt stillem Rückfall.
- **230-V-Modellgrenzen abgesichert** (NET-003): 3 UNVERIFIABLE-Befunde, 9 Einzelpunkte,
  `INCOMPLETE` für 230-V-Pläne, Klartext-Vertrag.
- **AutoWire-Review Vorher/Nachher je Leitung** (`lib/autoWire/reviewDiff.ts`, `AutoWireReviewModal`).
- **Produktive Routingvalidierung** (P0-1): gemeinsames Input-Gate, kein (0,0)-Fallback.
- **Eine Stromquelle** (`getCableCurrents`) für Anzeige, AutoWire, BOM, Verifikation;
  `vde-consistency` erzwingt die Delegation.
- **Freigabe-Gate** (`releaseStatus.ts`): gesperrt/Entwurf/softwaregeprüft, Planstand-Fingerprint.
- **Projektdatei** (Export/Import, versioniert, strikte Validierung), **Share-Link**,
  **Persistenz-Migration** (Retten statt Verwerfen, Proto-Pollution-Schutz, Messwerte raus).
- **Onboarding-Wizard** (schließbar ohne Planänderung, merkmalsbasierte Empfehlung),
  **geführte 5-Schritt-Leiste**, **Geräte-Vorlagen** mit Wattwerten.
- **Mobile Scroll-Architektur / Touch / Überlappungen:** E2E grün (421), Touch-Ziele ≥44 px.
- **Impressum vollständig** (`siteLegal.ts`, Legal-Gate grün) — der alte Placeholder-Kommentar
  in `app/impressum/page.tsx` ist veraltet, die Daten sind eingetragen.
- **SEO:** 42 Seiten, Export-Prüfung grün, Sitemap/Canonicals/strukturierte Daten.
- **Sicherheit:** zweischichtige CSP (ADR 0038), Proto-Pollution-Schutz, CSV-Formelinjektions-
  Schutz, HTML-Escaping im Druckbericht.
- **axe (critical/serious)** auf Kernseiten + Planer-Blättern grün.

---

## 6. Release-Roadmap

Reihenfolge nach Abhängigkeit und Nutzerwirkung. **Nichts davon ist in diesem Audit
implementiert.** Aufwände sind Schätzungen (PT). „Freigabe" = Produktentscheidung nach
AGENTS.md §8 (keine neuen Features ohne Freigabe).

### Phase 0 — Release-Blocker (sofort, vor jedem Release)

| Paket                                               | Befund      | Aufwand | Parallelisierbar    |
| --------------------------------------------------- | ----------- | ------- | ------------------- |
| Bank-Topologie UI + Warn-Führung                    | AUD-001     | 3–5 PT  | ja (eigener Strang) |
| 230-V-Produktabgrenzung entscheiden + kommunizieren | AUD-002 (a) | 1–2 PT  | ja                  |
| PDF-Bericht mit Schaltplan                          | AUD-004     | 2–4 PT  | ja                  |
| Gleichzeitigkeits-Semantik klären                   | AUD-005     | 2–6 PT  | ja                  |

**Gate für Phase 0:** Vollsuite + Golden Master + Regression + E2E grün; kein 230-V-Plan
ohne Modellgrenze; 2-Batterien-Plan über UI abschließbar.

### Phase 1 — Kernqualität (vor „professionell"-Anspruch)

| Paket                                                                        | Befund            | Aufwand  | Abhängigkeit                    |
| ---------------------------------------------------------------------------- | ----------------- | -------- | ------------------------------- |
| Fahrzeug-Kabeldaten beschaffen + einführen (oder Annahme final kennzeichnen) | AUD-003           | 5–12 PT  | Datenquelle extern              |
| Bank-Konsistenz (Spannung/Ik)                                                | AUD-011 + AUD-020 | 3–5 PT   | AUD-001                         |
| ROUTE-018 Wiedereintritt                                                     | AUD-008           | 2–4 PT   | Routing-Disziplin               |
| Interaktive Skalierung (P-1/P-2/P-4/P-5/P-6)                                 | AUD-006           | 8–15 PT  | Benchmark/ADR, parallelisierbar |
| Tastatur-Abnahme M11-3                                                       | AUD-007           | 2–4 PT   | —                               |
| Doku-Drift (Stromquelle + §8-Liste)                                          | AUD-010           | 0,5–1 PT | —                               |
| AC-Messwert-Eingang                                                          | AUD-015           | 1–2 PT   | AUD-002                         |

### Phase 2 — UX/Qualität (parallel, nicht release-blockierend)

| Paket                                     | Befund          | Aufwand | Abhängigkeit      |
| ----------------------------------------- | --------------- | ------- | ----------------- |
| 24-px-Domänengate / Restpaare             | AUD-009         | 3–6 PT  | Routing           |
| KI-Assistent-Produktentscheidung          | AUD-014         | 1–2 PT  | PR #580 abstimmen |
| Pixel-Baselines + Realgeräte + Lighthouse | AUD-016/017/018 | 2–5 PT  | Umgebung/Geräte   |
| Wasser-Kennzeichnung                      | AUD-019         | 0,5 PT  | —                 |

### Phase 3 — Spätere Erweiterungen (nur mit Produktfreigabe)

| Paket                            | Befund      | Aufwand                | Abhängigkeit                      |
| -------------------------------- | ----------- | ---------------------- | --------------------------------- |
| Multi-Projekt-Manager            | AUD-012     | 5–8 PT                 | Freigabe                          |
| Energiebedarfs-/Fahrzeug-Wizard  | AUD-013     | 4–7 PT                 | Freigabe, AUD-001                 |
| 230-V-Mehrleiter-/Umschaltmodell | AUD-002 (b) | 15–30 PT + Fachprüfung | Freigabe, Daten, Elektrofachkraft |
| Wasser-Fachmodell                | AUD-019 (b) | 10+ PT                 | Freigabe                          |

### Kritischer Pfad

```
AUD-001 (Bank-UI) ──> AUD-011/020 (Bank-Konsistenz) ──> AUD-013 (Bedarfs-Wizard, optional)
AUD-002 (Abgrenzung) ──> AUD-015 (Messwert) ──> [AUD-002b erst mit Fachprüfung]
AUD-003 (Fahrzeugdaten) ──> Golden-Master-Recapture (nur mit Begründung)
AUD-004 / AUD-005 / AUD-006 / AUD-007 / AUD-008 / AUD-010 ──> unabhängig, parallel
```

**Doppelarbeit vermeiden:** AUD-014 nicht parallel zu PR #580 bearbeiten. AUD-011/020 als
ein Paket. AUD-006 nicht mit Routing-Qualitätsfixes (AUD-008/009) in einem PR vermischen
(jeweils eigene Messung/ADR). Keine Golden-Master-Neuerfassung ohne dokumentierten Grund.
**PERF-001-Gate nicht erneut öffnen** — es ist gelöst (300-ms-Ratchet, ADR 0033/0034);
AUD-006 betrifft ausschließlich die offene interaktive Skalierung (V2-SCALE-001).

---

## 7. Ungeprüfte Sachverhalte (explizit)

- Pixel-Baselines / visueller Drift (AUD-016).
- Reale Mobilgeräte, iOS Safari, Firefox (AUD-017).
- Lighthouse-Lab-Werte (AUD-018).
- Normtexte im Original (nur Code-dokumentierte Transkriptionen bewertet).
- 230-V-Fachprüfung / normative Abnahme (nicht möglich, nicht behauptet).
- Verhalten unter 100+ Bauteilen auf Realgeräten (nur Synthetik-Benchmarks).
- Ob PR #580 (KI-Entfernung) merged wird — Produktentscheidung offen.

---

## 8. Einhaltung der Arbeitsregeln

- **Zuerst analysiert, nichts implementiert:** Es wurden nur Dateien gelesen, Tests/Gates
  ausgeführt und temporäre Sonden verwendet (danach entfernt). Einzige Repo-Änderung ist
  dieses Dokument.
- **Erledigtes nicht erneut geöffnet:** Die „9 bekannten Routing-Fehler" und andere
  Abschlussberichte wurden nachgemessen und als erledigt bestätigt (§5).
- **Architekturregeln/Kontext vollständig gelesen:** §2.1.
- **Keine Grenzwerte/Normregeln geändert**, **keine Golden-Master-Fixtures angefasst.**
- **PR #601 und parallele Branches unverändert** (PR #601 ist bereits gemergt; HEAD ist
  sein Merge-Commit).
- **Jeder Befund durch Code/Test/Messung belegt**; Unbekanntes als ungeprüft markiert (§7).

---

## 9. Umsetzungsstand

Stand nach der Umsetzungsrunde auf `arena/3ad41177-camp`. Die Befundtexte in §4
bleiben der Audit-Zustand.

> **Hinweis zu den Commit-Hashes in §9.1:** Die Umsetzung entstand in einer
> Sandbox-Sitzung mit einem Commit je Befund. Diese Sitzung wurde später neu
> aufgesetzt; die Dateiänderungen blieben vollständig erhalten, die damalige
> Git-Historie jedoch nicht. Die unten genannten Kurz-Hashes (`c347321`,
> `b889a20`, …) bezeichnen jene ursprünglichen Commits und sind in der Historie
> dieses Branches **nicht** auflösbar. Sie stehen als Nachweis der Reihenfolge
> und Zuordnung, nicht als auffindbare Referenz. Die gesamte Änderung liegt in
> dem Pull Request, der diesen Branch abschließt; die Gates wurden auf dem
> zusammengeführten Stand erneut gefahren (§9.6).

### 9.1 Umgesetzt und belegt

| Befund                                 | Was geändert wurde                                                                                                                                                                                                                                                                                                                                                          | Commit    | Beleg                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **AUD-001** (P0)                       | `BatteryBankSection` im Batterie-Inspektor: Verschaltung + gemeinsamer Bank-Name, Vorschlag bestehender Bänke, abgeleitete Kennwerte aus `deriveBatteryBanks`. `ambiguous-topology` wird nicht mehr herausgefiltert. `AUTO-BANK-001` nennt den UI-Weg statt Rohfelder.                                                                                                      | `c347321` | 10 neue Tests inkl. geschlossene Kette UI→Modell→AutoWire (2. Batterie vorher unverbunden, nachher verdrahtet); `useLiveValidation` +3 |
| **AUD-002 (a)**                        | `AC_230V_PRODUCT_SCOPE_NOTE` in `lib/verify/acScope.ts`; Startseite nennt die Grenze an der Leistungszusage, Onboarding kontextuell bei „Landstrom".                                                                                                                                                                                                                        | `1052b20` | 4 neue Tests (Wortlaut/Drift, erscheint/erscheint nicht)                                                                               |
| **AUD-004** (P1)                       | `capturePlanImage()` als gemeinsamer Renderer; Bericht bettet den Schaltplan auf eigener Seite ein, unbeschnitten. Fehlendes Bild wird benannt. Planstand-Wächter verhindert ein Dokument aus zwei Ständen.                                                                                                                                                                 | `6d09681` | 6 neue Tests (Einbettung, Seite, Fehlerpfad, Sperrfall, Escaping)                                                                      |
| **AUD-005** (P1)                       | Auswahl heißt „Gleichzeitige Nutzung (Überlast-Prüfung)"; Klartext, dass Kabel/Schutz für die volle Insel gelten; Badge-Text korrigiert; Dashboard-Hinweis. **Auslegung unverändert konservativ.**                                                                                                                                                                          | `b889a20` | 2 UI-Tests + `currentFlow.concurrency.test.ts` pinnt 196,08 A für alle Auswahlzustände                                                 |
| **AUD-010** (P2)                       | `AGENTS.md` §4 nennt `getCableCurrents`; §8-Verbotsliste auf den echten Stand; `ELECTRICAL-CONTEXT` Current-/AC-/Rechenkette umgestellt, alte Namen als „Veraltet".                                                                                                                                                                                                         | `38c7c90` | Neuer Wächter in `docsIntegrity.test.ts` prüft Doku **und** die fünf Produktiv-Konsumenten                                             |
| **AUD-011** (P2)                       | Erklärte Serienbank wird kritisch gemeldet (`BANK-SERIES-UNSUPPORTED`) statt still widersprüchlich gerechnet. Rechenkette nicht angefasst (DO-NOT-TOUCH + Fachprüfung).                                                                                                                                                                                                     | `5406863` | 3 neue Tests (series, series-parallel, Parallelbank bleibt still)                                                                      |
| **AUD-018** (P3)                       | Lighthouse erstmals real gefahren; Startseite-Budget von 85 auf **90** gezogen — es lag unter der eigenen M11-5-Zusage. Messung als Kommentar im Gate festgehalten.                                                                                                                                                                                                         | `2728318` | Gate grün: Perf **98/99/99**, A11y 100, SEO 100, LCP 1215/1514/1066 ms; 3 neue Tests (86 Punkte fallen durch, 98 bleiben grün)         |
| **AUD-016** (P3)                       | Pixel-Baselines erstmals gefahren; dabei einen **selbst verursachten** Startseiten-Fehler gefunden und behoben (Hinweis verdeckte den Haupt-CTA auf 375 px). Hinweis hinter die Buttons verschoben, Geometrie-Regressionstest ergänzt, 6 Startseiten-Baselines begründet aktualisiert. Siehe §9.5.                                                                          | `2728318` | **108 passed / 0 failed**; Gegenlauf am Basisstand beweist die Zuordnung; neuer CTA-Test fällt mit altem Aufbau durch                  |
| **AUD-003 (Kennzeichnungszweig)** (P1) | Die Herkunft der Belastbarkeitstabelle wird jetzt in **allen** Nutzeroberflächen benannt: Inspektor (`cable-ampacity-basis`), Prüfbericht (`ENGINE_LIMITATIONS`) und AMP-001-Regelgrenze sagen ausdrücklich „Hausinstallation DIN VDE 0298-4, **keine** geprüfte Fahrzeugleitungs-Tabelle nach ISO 6722 / FLRY" und nennen den Datenblattweg. **Kein Zahlenwert geändert.** | `f7dd352` | 3 neue Tests (Tabellenrechnung, gewählte Einbausituation, Entfallen bei Herstellerangabe); EdgeInspector 21, lib/verify 266            |
| **AUD-019** (P3)                       | Statusleiste sagte im Wassermodus „Keine Fehler" aus **Elektrik**-Warnungen. Jetzt „Wasser: keine Prüfung"; Leerzustand nennt die fehlende Fachprüfung.                                                                                                                                                                                                                     | `85dd15a` | 2 neue Tests                                                                                                                           |

### 9.2 Als Fehlbefund korrigiert (nicht erneut geöffnet)

| Befund      | Korrektur                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AUD-007** | **War bereits erledigt.** `tests/e2e/planner-keyboard.spec.ts` baut einen Mini-Plan vollständig per Tastatur: Bauteile über die Katalogsuche hinzufügen, Verbindung über Tab+Enter auf den Handles, Verschieben mit Pfeiltaste, `?`-Dialog mit Fokusfalle und Escape-Rücksprung, Löschen mit Tastatur-Bestätigung. Der `test.skip` gilt **nur** Nicht-Desktop-Projekten. Beleg: `--project=desktop-1440` → **1 passed (4.3s)**. M11-3 ist damit in `AGENTS.md` §9 abgehakt. |
| **AUD-015** | **War bereits erledigt.** Das Audit forderte einen Messwert-Eingang für die AC-Schleifenimpedanz. Tatsächlich existieren `prospectiveIkA` im `ShorePowerInspector` (mit Anleitung), `prospectiveIkSource: 'declared' \| 'assumed'` und der Klartext „Prospektiver Kurzschlussstrom … angegeben/gemessen … nicht gegen eine Netzimpedanz-Annahme" — alles getestet (`lib/acProtection.test.ts`). Keine Umsetzung nötig; der Befund wird zurückgenommen.                      |

### 9.3 Weiterhin offen — mit Grund

| Befund                                                     | Warum nicht in dieser Runde                                                                                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AUD-003** Fahrzeug-Kabeltabelle                          | Braucht eine **zitiergeprüfte externe Quelle** (ISO 6722 / FLRY-Herstellerdaten) plus begründete Golden-Master-Neuerfassung. Werte dürfen nicht erfunden werden (AGENTS.md §5). Der Escape-Hatch `manufacturerIzA` existiert bereits. |
| **AUD-002 (b)** 230-V-Mehrleitermodell                     | Erfordert neue Leiter-/Netzform-/Umschalt-/Rückspeiselogik **und eine Elektrofachkraft-Abnahme**. Variante (a) ist umgesetzt; (b) ist ein eigenes Fachprojekt.                                                                        |
| **AUD-006** Interaktive Skalierung                         | P-1/P-2/P-4/P-5/P-6 sind mehrscheibige Routing-Arbeit mit je eigener Messung + ADR. Das PERF-001-Gate ist gelöst und wurde nicht angetastet.                                                                                          |
| **AUD-008 / AUD-009** Routing (ROUTE-018, 24-px-Restpaare) | Routing-Garantien (`invariants.ts`, `collision.ts`, `tokens.ts`) sind DO-NOT-TOUCH; jede Änderung braucht Referenz-SVG-Prüfung und Begründung. Nicht nebenbei.                                                                        |
| **AUD-012 / AUD-013** Multi-Projekt, Bedarfs-Wizard        | Neue Features — nach `AGENTS.md` §8 freigabepflichtig.                                                                                                                                                                                |
| **AUD-014** KI-Assistent                                   | Produktentscheidung; PR #580 läuft parallel, keine Doppelarbeit.                                                                                                                                                                      |
| **AUD-017** Realgeräte / Safari / Firefox                  | In dieser Sandbox ist nur Chromium verfügbar (Playwright-Download gesperrt, WebKit/Firefox nicht installierbar). Weiterhin ausdrücklich ungeprüft — Emulation ist kein Realgerätetest.                                                |
| **AUD-020** Serien-Ik                                      | Durch AUD-011 entschärft: der Zustand wird jetzt kritisch gemeldet statt falsch gerechnet. Eine topologiekonsistente Ik-Rechnung bleibt Facharbeit.                                                                                   |

### 9.4 Produktabnahme nach der Umsetzung — die 9 Nutzerfragen neu bewertet

§3.1 bleibt der Audit-Stand. Hier die Neubewertung mit demselben Maßstab.

| #   | Nutzerfrage                             | Audit       | Jetzt                            | Was sich geändert hat                                                                                                                                                  |
| --- | --------------------------------------- | ----------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Projekt starten                         | Ja          | **Ja**                           | Unverändert. Zusätzlich: 230-V-Grenze wird bei gewähltem Landstrom schon im Onboarding genannt (AUD-002a).                                                             |
| 2   | Fahrzeug/Energiebedarf erfassen         | Teilweise   | **Teilweise**                    | Unverändert — geführter Bedarfs-Wizard ist ein neues Feature und freigabepflichtig (AUD-013).                                                                          |
| 3   | Komponenten finden/konfigurieren        | Ja          | **Ja**                           | Bank-Felder jetzt vorhanden (AUD-001); Belastbarkeitsherkunft wird benannt (AUD-003).                                                                                  |
| 4   | Vollständige Verkabelung                | Nein/Ja     | **Ja (parallel) / Nein (Serie)** | Zwei Aufbaubatterien sind über die UI als Bank erklärbar und werden verdrahtet (AUD-001). Serie bleibt bewusst nicht unterstützt und wird kritisch gemeldet (AUD-011). |
| 5   | Auto-Vorschläge verstehen/kontrollieren | Ja          | **Ja**                           | Unverändert; `AUTO-BANK-001` nennt jetzt den UI-Weg statt Rohfelder.                                                                                                   |
| 6   | Fehler beheben                          | Ja (Lücken) | **Ja**                           | Bank-Unklarheit wird angezeigt (AUD-001), Gleichzeitigkeits-Semantik erklärt (AUD-005), Serienbank kritisch gemeldet (AUD-011).                                        |
| 7   | Vollständiger Schaltplan                | Teilweise   | **Ja**                           | Schaltplan ist im Druckbericht auf eigener Seite (AUD-004). ROUTE-018 bleibt offen (AUD-008).                                                                          |
| 8   | Stückliste + brauchbarer PDF-Bericht    | Teilweise   | **Ja**                           | Ein Dokument mit Plan, Stückliste und Prüfbericht aus **einem** Planstand (Fingerprint-Wächter, AUD-004).                                                              |
| 9   | Zuverlässig speichern/fortsetzen        | Ja (1 Slot) | **Ja (1 Slot)**                  | Unverändert — Multi-Projekt ist ein neues Feature und freigabepflichtig (AUD-012).                                                                                     |

**Mobile/Tablet:** Zusätzlich zur funktionalen Suite ist jetzt der **visuelle
Satz vollständig grün** (108 Tests, §9.5) und ein Geometrie-Test hält den
Einstieg auf 375/768/1440 px im ersten Bildschirm. **Reale Geräte weiterhin
ungeprüft** (AUD-017) — Emulation ist kein Realgerätetest.

**Gesamtantwort auf die Leitfrage (aktualisiert):** Für eine **12-V-Anlage mit
einer oder mehreren parallel geschalteten Aufbaubatterien** ist der Workflow
jetzt geschlossen: planen → prüfen → Fehler beheben → **ein** übergabefähiges
Dokument mit Schaltplan, Stückliste und Prüfbericht. Die beiden Release-Blocker
AUD-001 und AUD-004 sind behoben.

**Was weiterhin NICHT zugesagt wird:**

- **Reihenschaltung (24 V)** wird nicht bewertet. Sie ist nicht wählbar und wird
  bei Import kritisch gemeldet — nicht still falsch gerechnet.
- **230 V** bleibt eine Planungshilfe mit benannter Modellgrenze. Keine
  normgeprüfte Auslegung, keine Abnahme. Die Grenze steht jetzt auch vor der
  Planung, nicht erst im Bericht.
- **Fahrzeug-Kabelbelastbarkeit** ist ein Referenzmodell aus der Hausinstallation,
  nicht aus ISO 6722 / FLRY. Das wird jetzt in jeder Oberfläche gesagt; eine
  belegte Auslegung führt über die Herstellerangabe I_z.
- **Sehr große Pläne** sind nicht interaktiv optimiert (AUD-006).
- **Realgeräte, Safari, Firefox** sind ungeprüft (AUD-017).

Ein Release-Versprechen „vollständige, normgerechte Elektroplanung inkl. 230 V"
ist damit weiterhin **nicht** zulässig. Zulässig ist: „12-V-Planung mit
nachvollziehbarer Prüfung und vollständiger Dokumentation; 230 V als
Planungshilfe mit ausgewiesenen Grenzen."

### 9.5 Pixel-Abgleich: ein selbst verursachter Fehler, gefunden und behoben

Der visuelle Lauf wurde erstmals in dieser Arbeit gefahren (AUD-016 war als
Verifikationslücke offen). Ergebnis zunächst: **102 grün, 6 Fehler** — alle auf
der Startseite, nur bei 375/768/touch-pixel5, nicht auf Desktop.

**Ursachenzuordnung statt Umgebungsverdacht.** Der Audit-Vermerk „Baselines
weichen in der Sandbox schon am Basis-Commit ab" hätte die Fehler bequem
erklärt. Das wurde geprüft, nicht angenommen:

- `app/page.tsx` testweise auf den Basisstand `7d8a464` zurückgesetzt, neu
  gebaut, gleiche 8 Startseiten-Tests in derselben Umgebung gefahren
  → **8 passed**. Die Baselines passen in dieser Umgebung.
- Damit waren die 6 Fehler **durch AUD-002a selbst verursacht**, nicht durch
  Chromium 153.

**Der eigentliche Befund war UX, nicht Pixel.** Der 230-V-Grenzhinweis stand
_vor_ den Handlungsbuttons und schob den Haupt-CTA „Schaltplan starten" auf
375 px aus dem ersten Bildschirm. Ein Nutzer hätte scrollen müssen, um
überhaupt zu starten — ein echter Rückschritt durch die AUD-002a-Umsetzung.

**Behoben:** Hinweis hinter die Buttons verschoben. Die Grenze bleibt vor der
Planung lesbar, verdeckt aber den Einstieg nicht.

**Als Regressionstest festgehalten** (`tests/e2e/responsive.spec.ts`): Der
Haupt-CTA muss bei 375/768/1440 px im ersten Bildschirm liegen, der Hinweis
danach stehen. Geometrie statt Screenshot, weil ein Bild nicht die Frage
„kommt der Nutzer an den Einstieg?" prüft. **Gegenprobe:** Mit der alten
Platzierung fällt der Test durch, mit der Korrektur besteht er (12 passed).

**Baseline-Aktualisierung begründet, nicht kaschiert.** Die Seite ist durch den
gewollten Hinweis höher. Der Nachweis, dass _nur_ das hinzukam:

| Größe                  | Wert                                          |
| ---------------------- | --------------------------------------------- |
| Höhe Baseline (375 px) | 5194 px                                       |
| Höhe neu (375 px)      | 5435 px                                       |
| Differenz              | **241 px**                                    |
| Hinweisblock gemessen  | 221 px Höhe + 20 px `margin-top` = **241 px** |

Die Differenz ist damit vollständig durch den beabsichtigten Block erklärt. Aktualisiert
wurden **ausschließlich die 6 Startseiten-Baselines**; die Desktop-Baselines
blieben byte-identisch, alle übrigen Routen unverändert.

**Ergebnis:** `visual.spec.ts` + `visual-de.spec.ts` + `visual-de-pixel.spec.ts`
→ **108 passed, 0 failed**. AUD-016 ist damit für diese Umgebung abgenommen;
die CI führt denselben Satz bereits (`--grep "hält die Baseline"`).

**Lehre für den weiteren Verlauf:** Ein eigener Änderungssatz kann die eigenen
Pixel-Gates verletzen. „Abweichung ist wohl die Sandbox" ist keine Zuordnung —
der Gegenlauf am Basisstand ist billig (10 s) und entscheidet.

### 9.6 Gates auf dem Endstand — real gefahren

Alle Läufe auf demselben Head, nicht aus früheren Berichten übernommen.

| Gate                                                                 | Ergebnis                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `npm run check` (Lint, Format, beide Typechecks, Coverage-Schwellen) | **exit 0** · **313 Dateien / 4117 passed / 1 skipped**          |
| Vollständige E2E-Suite (24 Specs, 5 Projekte)                        | **509 passed / 259 skipped / 0 failed** (30,8 min)              |
| Visueller Satz (`visual` + `visual-de` + `visual-de-pixel`)          | **108 passed / 0 failed**                                       |
| `rendered-contrast` + `routing-stability` isoliert nachgeprüft       | **52 passed**                                                   |
| Lighthouse-Budget (`perf:lighthouse`)                                | **Alle Budgets eingehalten** · Perf 98/99/99, A11y 100, SEO 100 |
| `routing:audit`                                                      | I1–I7 = **0** auf allen 6 Referenzplänen                        |
| Golden-Master                                                        | **13/13**                                                       |
| Routing-Regression                                                   | **68/68**                                                       |
| Build (Static Export)                                                | **47 Seiten**, kein Fehler                                      |
| Tastatur-Abnahme M11-3                                               | **1 passed** (`--project=desktop-1440`)                         |

Zum Vergleich der Ausgangsstand: 311 Dateien / 4076 passed. Es sind keine Tests
abgeschwächt, übersprungen oder gelöscht worden; der einzige geänderte
Baseline-Satz sind die 6 Startseiten-Baselines mit dem Additivitätsnachweis
aus §9.5.

**Umgebung:** Chromium 153.0.8010.0 (in der Sandbox aus `@sparticuz/chromium`
wiederhergestellt, weil der Playwright-Download gesperrt ist), Node 22.22.3.

**Weiterhin ungeprüft und nicht als grün behauptet:**

- Reale Mobilgeräte, iOS Safari, Firefox (AUD-017) — nur Chromium verfügbar.
- Der CI-Lauf auf diesem Head (GitHub Actions) — lokal gefahren, nicht im CI.
- Lighthouse unter CI-Bedingungen; die Lab-Werte hier sind reproduzierbar
  (zwei unabhängige Läufe: 98/99/99 und 98/100/99), aber nicht auf Realgeräten.

### 9.7 Nachprüfung vor dem Merge — vier weitere Befunde im Druckbericht

AUD-004 hatte den Schaltplan in den Bericht gebracht, aber die **Konsistenz
über die asynchrone Aufnahme** nicht abgesichert. Die Nachprüfung hat vier
Befunde reproduziert (Test zuerst rot, dann Fix, dann Gegenprobe):

| Befund                                               | Wirkung                                                            | Behoben                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Race zwischen Vorprüfung und Bildaufnahme            | Bild aus neuem, Stückliste/Prüfbericht aus altem Stand — unbemerkt | Nachprüfung nach der Aufnahme + Identität des Store-Lesezugriffs                       |
| `planFingerprintHash` deckt die Darstellung nicht ab | verschobenes Bauteil ändert das Bild, nicht den Hash               | eigene `planCaptureIdentity` (Lage, Maße, beide Gewerke, Modus); Prüf-Hash unverändert |
| Wassermodus mischt die Gewerke                       | Wasser-Schaltplan neben Elektrik-Prüfbericht, unbeschriftet        | Gewerk in Überschrift, Alt-Text und ausdrücklichem Hinweis                             |
| `window.open` nach den `await`s                      | Browser blockiert das Fenster bei großen Plänen kommentarlos       | Fenster öffnet synchron im Klick, wird bei Abbruch geschlossen                         |

**Nicht bestätigt:** Die Batteriebank-Kette wurde über alle sechs Bedienfälle
geprüft und ist konsistent (Oberfläche, `deriveBatteryBanks`, AutoWire). Kein
Fix nötig.

**Auswirkung auf Frage 8:** Ein Übergabedokument kann jetzt nicht mehr
unbemerkt zwei Planstände mischen. Bei Änderung während der Aufnahme entsteht
gar kein Dokument, sondern eine verständliche Meldung.

**Eigene Verstöße, die der Wächter gefangen hat:** Direktzugriff auf
`node.width/height` (Architekturregel: über `nodeGeometry` lesen) und
`waitForTimeout` im E2E. Beide wurden im **Code** behoben, nicht in der
Prüfung — ein Beispiel dafür, dass die bestehenden Wächter tragen.

### 9.8 CI-Ergebnisse — letzter geprüfter PR-CI-Lauf (historische Werte)

Die folgenden Werte stammen aus dem zuletzt geprüften PR-CI-Lauf (Merge der
PRs #604, #605, #606 in `main`, 2026-11-07). Sie werden als **historische Werte** gekennzeichnet; ein aktuellerer GitHub-Actions-Lauf mit denselben
Detail-Metriken lag zum Zeitpunkt dieses Berichts nicht vor (überprüft über
`gh api repos/CAZE7/Camp/actions/runs`; der jüngste erfolgreiche Lauf auf
`main` lief am 2026-11-07 09:35 UTC durch: Quality Gate „Typecheck, Tests &
Build“, Requirements-Matrix-Konsistenzcheck und E2E grün, visuelles Gate
nicht-blockierend fehlgeschlagen — Pixel-Drift, kein Blocker).

| Prüfung                                                                                   | Befehl / Ort                                          | Ergebnis (letzter PR-CI-Lauf)                                                                                                                                                                                                                                         | Kennzeichnung                                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest Vollsuite (Unit + Integration, inkl. `test/reference/**` und `test/invariants/**`) | `npx vitest run`                                      | **4.318 bestanden / 1 übersprungen** (letzter PR-CI-Lauf); lokal auf diesem Checkout nachgemessen: **4.321 bestanden / 1 übersprungen** — die +3 sind die neuen Tests für den Requirements-Matrix-Widerspruchscheck (`scripts/ci/verify-requirements-matrix.test.ts`) | Historisch für den Basiswert, lokal nachgemessen                                                                                                                  |
| Safety-Gate-Tests (G4 kritische Mutanten + G6 kein stilles PASS)                          | `npm run test:gates`                                  | **30 bestanden** (`test/invariants/silent-pass-gate.test.ts`: 21, `test/invariants/mutation-critical.test.ts`: 9)                                                                                                                                                     | Lokal nachgemessen, grün                                                                                                                                          |
| E2E (funktionale Specs, blockierend, gegen `./out`)                                       | `npm run e2e` (`--grep-invert "hält die Baseline"`)   | **447 bestanden / 277 übersprungen / 0 fehlgeschlagen**                                                                                                                                                                                                               | Historisch (letzter PR-CI-Lauf); CI-E2E-Job am 2026-11-07 grün                                                                                                    |
| Pixel-Visual-Tests (Baselines „hält die Baseline")                                        | `npx playwright test --grep "hält die Baseline"`      | **76 bestanden / 0 fehlgeschlagen**                                                                                                                                                                                                                                   | Historisch (letzter PR-CI-Lauf); letzter CI-Lauf: visuelles Gate mit `continue-on-error: true` fehlgeschlagen (nicht blockierend, UI-Drift-Meldung)               |
| Lighthouse                                                                                | `perf:lighthouse` auf `/camper-elektrik/ladebooster/` | **Performance 84 bei Zielwert 90** — Ziel **nicht erreicht**                                                                                                                                                                                                          | Historisch (letzter PR-CI-Lauf); kein aktuellerer Lighthouse-Wert verfügbar; Lab-Werte auf geteilten Runnern schwanken, Zielsenkung wäre keine zulässige Maßnahme |

**Was neuere Läufe zeigen:** Der CI-Lauf vom 2026-11-07 auf `main` (Merge #606)
war für Quality Gate, Requirements-Matrix-Konsistenzcheck und E2E grün. Der
visuelle Lauf schlug nicht-blockierend fehl; detaillierte Testzahlen aus diesem
Lauf liegen als CI-Artifact nicht vor, weshalb die historischen Werte oben
beibehalten werden.

**Nicht als grün behauptet (ungeprüft):** Reale Mobilgeräte, iOS Safari,
Firefox (AUD-017); Lighthouse unter CI-Bedingungen; der Ladebooster-Lighthouse-
Wert von 84 ist ein einzelner historischer Lab-Wert, keine reproduzierte
Regression (Bundle-Größen der betroffenen Routen unverändert, siehe
ELECTRICAL-VERIFICATION-STRATEGY.md §12.6/§12.9).
