# Requirements and Verification Matrix — Camp (Elektrikplaner)

**Stand:** 2026-11-04  
**Status:** Verbindlich (Erstfassung, lebendes Dokument)  
**Verantwortlich:** Product Owner (Anforderungen), QE (Verifikation), Safety Engineering (Sicherheitsanforderungen)  
**Übergeordnet:** `docs/engineering/ENGINEERING-CONSTITUTION.md` (§2 Anforderungen und Abnahmekriterien), `docs/safety/SAFETY-CASE.md`, `docs/verification/VERIFICATION-STRATEGY.md`  
**Zweck:** Nachvollziehbare Verbindung Anforderung → fachliche Grundlage → Implementierung → Test → Ergebnis → Releasefreigabe. Jede sicherheitsrelevante Anforderung muss einen nachvollziehbaren Verifikationsnachweis besitzen.

---

## 1. Matrix-Legende

| Spalte | Bedeutung |
|---|---|
| **Req-ID** | Eindeutige Requirement-ID (CAMP-REQ-XXX) |
| **Anforderung** | Was gefordert ist |
| **Klasse** | S = sicherheitskritisch, F = funktional, D = Daten, P = Prozess, Q = Qualität |
| **Fachliche Grundlage** | Norm, Datenblatt, Modellannahme, Architekturentscheidung (mit Quelle) |
| **Implementierung** | Datei / Funktion / Modul (SSOT) |
| **Test** | Testdatei / Prüfverfahren, die die Anforderung belegt |
| **Ergebnis** | Erfüllt / Teilweise / Offen / Nicht zutreffend |
| **Release-Freigabe** | Verweis auf Release / Gate, in dem die Anforderung freigegeben wurde |
| **Safety-Case-Claim** | Verweis auf `docs/safety/SAFETY-CASE.md` (CL-XXX) |
| **Risk-Register** | Verweis auf `docs/safety/RISK-REGISTER.md` (R-XXX) |

**Anforderungsklassen:**
- **S (sicherheitskritisch):** Merge und Release blockierend bis Verifikation vorliegt. Nicht durch niedrige Priorisierung oder grünen Testlauf als erledigt.
- **F (funktional):** Fachlich geforderte Funktion.
- **D (Daten):** Datenherkunft, Versionierung, Verifizierungsstatus.
- **P (Prozess):** CI, Release, Review, Dokumentation.
- **Q (Qualität):** Code- und Testqualität, Determinismus, Performance.

---

## 2. Requirements and Verification Matrix (Initialbestand)

Die Matrix erfasst die sicherheits- und qualitätskritischen Anforderungen aus der Bestandserhebung. Weitere Anforderungen (Features, UX, Export, Accessibility) werden bei jeder neuen Anforderung ergänzt.

| Req-ID | Anforderung | Klasse | Fachliche Grundlage | Implementierung | Test | Ergebnis | Release | Claim | Risk |
|---|---|---|---|---|---|---|---|---|---|
| CAMP-REQ-001 | `I_B ≤ I_n ≤ I_z` per Konstruktion; Sicherung niemals oberhalb der Kabelgrenze | S | `lib/electrical.ts` `FUSE_MAP`, DERATE_FACTOR; VDE-Koordinationsregel | `lib/electrical.ts` `selectFuseSize`, `isFuseFeasible`, `applyFuseSizes` | `lib/electrical.test.ts` (Sweep 39 990 Komb., 0 Verstöße), `lib/vde-properties.test.ts` G1/G2 | Erfüllt | — | CL-001 | R-002 |
| CAMP-REQ-002 | 20-cm-Regel: Sicherung ≤ 0,2 m vom Batteriepol; Fehlen ist kritischer Befund | S | ISO 10133:2000 §8.1; ABYC E-11 §11.10.1.1.1 | `components/edges/CableEdge.tsx` `collectEdgeErrors` (`main-fuse-distance`, `fuse-offset`) | `CableEdge.test.tsx` | Erfüllt | — | — | R-004 |
| CAMP-REQ-003 | Keine verpolte Parallelschaltung von Batterien / Solarpanels | S | Kurzschlussgefahr kA-Bereich; AUDIT ELE-002/ELE-003 | `lib/connectionRules.ts` `isConnectionAllowed` | `lib/connectionRules.test.ts`; `useLiveValidation.test.ts` (`ELE-003-reversed-polarity`) | Erfüllt | — | CL-002 | R-004, R-005, R-006 |
| CAMP-REQ-004 | Solar nicht direkt auf Batterie/Verbraucher (nur über Laderegler/MPPT) | S | AUDIT ELE-002 | `lib/connectionRules.ts` Solar-Sonderfälle | `lib/connectionRules.test.ts`; `useLiveValidation.test.ts` (`ELE-009-solar-direct`) | Erfüllt | — | CL-002 | R-006 |
| CAMP-REQ-005 | Kein stiller Fallback bei sicherheitskritischen Werten (kein geschätzter Grenzwert) | S | Regel M (CONSTITUTION §5) | `lib/units.ts` (wirft statt 0); `lib/currentBudget.ts` (`undefined` + Warnung) | `lib/units.test.ts`; `currentBudget.test.ts` | Erfüllt | — | CL-003 | R-014 |
| CAMP-REQ-006 | Datenlücke niemals als `critical` dargestellt („nicht bewertbar“ statt „ok“) | S | Regel S-3; VALIDATION-CONTEXT §8.6 | `lib/validationSeverity.ts` Projektion | `lib/validationSeverity` implizit über WarningCenter-Tests | Erfüllt | — | CL-004 | R-014 |
| CAMP-REQ-007 | Fehlender FI (RCD) am 230-V-Kreis wird als kritisch angezeigt, nie still angenommen | S | DIN VDE 0100-721; ELEC-002 (geschlossen) | `lib/autoWire.ts` (Stempel entfernt); `useLiveValidation.ts` (`A2-shore-rcd`, `AC-001-inverter-rcd`) | `lib/verify/protection.test.ts` (RCD-001); `useLiveValidation.test.ts` | Erfüllt | — | CL-014 | R-007 |
| CAMP-REQ-008 | AC-Abschaltbedingung `Zs · Ia ≤ U0` mit 2/3-Regel geprüft; 0,8 Ω Netzimpedanz als Annahme ausgewiesen | S | IEC 60364-4-41; DIN VDE 0100-600; UNVERIFIED | `lib/acProtection.ts` | `lib/acProtection.test.ts` | Teilweise (Annahme nicht messverifiziert) | — | CL-012 | R-008 |
| CAMP-REQ-009 | 230-V-Modellgrenze ausgewiesen; kein 230-V-Plan als „geprüft“ dargestellt | S | `docs/AC-230V-MODELLGRENZEN.md` | `lib/verify/acScope.ts` (`NET-003-ac-model-scope`, `INCOMPLETE`) | `lib/verify/acScope.test.ts` | Erfüllt (Modellgrenze bleibt) | — | CL-011 | R-005 |
| CAMP-REQ-010 | Kabel läuft nicht durch Bauteil (I1 hart = 0) | S | ADR 0015/0019; ROUTING-CONTEXT §4.5 | `lib/routing/invariants.ts` `checkEdgeNodeCollisions`; `lib/routing/finalValidation.ts` | `lib/routing/invariants.test.ts`; `scripts/routing/finalValidation.test.ts`; `routing:audit` | Erfüllt (Ratchet 0) | — | CL-005 | R-010 |
| CAMP-REQ-011 | Keine kollineare Überlappung zweier Kabel (I2 hart = 0, außerhalb Port-Bündel-Ausnahme) | S | ADR 0009/0025; Port-Bündel-Ausnahme eine Regel | `lib/routing/invariants.ts` `checkEdgeEdgeOverlaps`; `lib/routing/rules/portBundle.ts` | `lib/routing/invariants.test.ts`; `routing:audit`; `scripts/routing/portBundleModel.test.ts` | Erfüllt (Ratchet 0) | — | CL-006 | R-011 |
| CAMP-REQ-012 | Clearance eingehalten (I3; Ratchet, Deltas dürfen nicht steigen) | S | ADR 0031/0033; `cableClearance = 12 px` | `lib/routing/invariants.ts` `checkClearance`; `components/edges/utils/separation.ts` | `scripts/routing/audit.ts`; `scripts/routing/domainProbe.ts` | Teilweise (8 Rest-Paare im `complex`-Plan) | — | CL-007 | R-012 |
| CAMP-REQ-013 | AutoWire überschreibt keine gepinnte Verbindung (`locked > user > required > auto > suggested`) | S | `lib/electricalGraph/intent.ts`; `mayOverride` strikt | `lib/electricalGraph/intent.ts` | `lib/electricalGraph/intent.test.ts` (E1/E2); `goldenMaster.test.ts` | Erfüllt | — | CL-008 | R-013 |
| CAMP-REQ-014 | AutoWire idempotent (2. und 3. Lauf identisch) | S/F | G5 Eigenschaft | `lib/autoWire.ts` `performAutoWiring` | `lib/vde-properties.test.ts` G5; `goldenMaster.test.ts` | Erfüllt | — | CL-009 | — |
| CAMP-REQ-015 | Routing deterministisch (byte-identisch bei gleicher Eingabe) | Q | ADR 0010; Rule K | `components/edges/utils/routeAll.ts`; `pathfinding.ts` (Edge-ID Tie-Breaker) | `goldenMaster.test.ts` (Doppellauf); `regression.test.ts` (p13–p15); `routing:audit` Spalte `determ` | Erfüllt | — | CL-010 | R-017 |
| CAMP-REQ-016 | Bestehende Projekte (Persistenz v1) bleiben lesbar; Migration zerstört keine Daten | D | Rule S-7; RETTEN statt VERWERFEN | `store/slices/persistence.ts`; `lib/nodeSchema.ts`; `lib/edgeSchema.ts` | `persistence.test.ts`; `storage.test.ts`; `lib/nodeSchema.test.ts`; `lib/edgeSchema.test.ts` | Erfüllt | — | CL-013 | R-015, R-016 |
| CAMP-REQ-017 | `lib/` importiert keine App-Schicht (Rule A) | Q | ADR 0008; SYSTEM-ARCHITECTURE §5 | `lib/` (keine Importe aus `components/`, `store/`, `app/`, `benchmarks/`) | `scripts/architecture/libBoundary.test.ts` | Erfüllt | — | CL-015 | — |
| CAMP-REQ-018 | Eine Quelle für Kabelgeometrie; `edge.data.geometry` nicht gelesen (Rule G) | Q | ADR 0014 | `components/edges/utils/routeAll.ts`; `cableRouteStore.ts` | `scripts/routing/architecture.test.ts` | Erfüllt | — | CL-015 | — |
| CAMP-REQ-019 | Keine elektrische Berechnung im UI (Rule D) | Q | SYSTEM-ARCHITECTURE §3 | UI-Komponenten delegieren an `lib/` | Architektur-Review; `libBoundary.test.ts` | Erfüllt | — | CL-015 | — |
| CAMP-REQ-020 | Bauteildaten tragen Quellenangabe (Hersteller, Modell, Datenblatt, Verifizierungsstatus) | D | Aufgabe 8 (Datenqualität); Regel S-2 | `components/registry/`; `lib/nodeSchema.ts` (geplant: Datenversion pro Bauteil) | `componentRegistry.test.tsx` | Teilweise (Datenqualitätsdokument noch zu erstellen) | — | — | — |
| CAMP-REQ-021 | Fahrzeug-Leitungskontext (FLRY/ISO 6722) nicht vollständig modelliert (bekannte Lücke) | S | ELE-001 (teilbehoben P0-3) | `lib/electrical.ts` `VDE_AMPACITY`; `lib/cableConditions.ts` (f₁/f₂, f₃ = 1,0) | `lib/electrical.test.ts`; `lib/cableConditions.test.ts` | Offen (Modellannahme dokumentiert) | — | CL-016 | R-001 |
| CAMP-REQ-022 | Vorgelagerte Netzimpedanz 0,8 Ω ist Annahme, nicht Messwert | S | `lib/acProtection.ts` UNVERIFIED | `lib/acProtection.ts` | `lib/acProtection.test.ts` | Offen (Annahme) | — | CL-012 | R-008 |
| CAMP-REQ-023 | Domänen-Trennregeln (24 px AC/DC, elektrisch/wasser) teilweise nicht ans Produktivrouter angebunden | S | ROUTE-003 | `lib/routing/rules/collision.ts` `buildDomainSeparationRules` (nicht angebunden) | `scripts/routing/domainProbe.ts` (Ratchet) | Offen | — | — | R-019 |
| CAMP-REQ-024 | Live-Routing-Performance: Render ≤ 16 ms; Live-Routing-Ratchet 300 ms (begründet) | Q | ADR 0012; PERF-001 | `components/edges/utils/cableRouteStore.ts` (`ROUTE_THROTTLE_MS = 100 ms`); `separation.ts` optimiert | `benchmarks/edgeRoutingPerf.bench.ts`; `perf:route-scaling` | Teilweise (Zielkonflikt dokumentiert) | — | — | R-018 |
| CAMP-REQ-025 | Keine Secrets im Repo; statischer Export ohne Backend | P | ADR 0001; ARCH-001 (geschlossen) | `.env.example`; `app/api/chat/route.ts` Endpoint nur bei Env-Variable; Build ohne `out/api` | `components/Chat.test.tsx`; CI Build | Erfüllt | — | — | R-022 |
| CAMP-REQ-026 | Lockfile-Integrität: Abweichung `package.json` ↔ `package-lock.json` scheitert reproduzierbar | P | CI-Härtung (CI.md) | `scripts/ci/verify-lockfile-gate.mjs` | `npm run ci:verify-lockfile-gate` | Erfüllt | — | — | R-021 |
| CAMP-REQ-027 | E2E-Gate blockierend gegen Static Export; a11y critical/serious = Fail | Q | CI.md; TESTING-CONTEXT §9.6 | `tests/e2e/*.spec.ts` (Playwright) | `npm run e2e` | Grün (blockierende Specs) | — | — | — |
| CAMP-REQ-028 | Visual Regression Pixel-Drift ≤ 0,02 (baselines eingefroren; Job melden, nicht blockierend) | Q | GOVERNANCE §3; TEST-002 | `tests/e2e/visual.spec.ts` Snapshots | `npm run e2e -- visual` | Teilweise (baselines nach UI-Freigabe neu aufnehmen) | — | — | R-020 |

---

## 3. Rückverfolgbarkeit (Traceability) — Beispiel

**CAMP-REQ-001** (`I_B ≤ I_n ≤ I_z`):

- **Anforderung:** Sicherung darf niemals oberhalb der Kabelgrenze empfohlen werden.
- **Fachliche Grundlage:** VDE-Koordinationsregel `I_B ≤ I_n ≤ I_z`; `lib/electrical.ts` `FUSE_MAP` (abgeleitet: größte Normsicherung ≤ Ampacity × 0,7); DERATE_FACTOR = 0,7 für Sizing + Sicherung.
- **Implementierung:** `lib/electrical.ts` `selectFuseSize` (gibt niemals mehr als `FUSE_MAP[crossSection]` zurück), `isFuseFeasible`, `applyFuseSizes` (hebt Querschnitt auf nächste tragende Normstufe).
- **Test:** `lib/electrical.test.ts` (Sweep über alle 17 Normquerschnitte × 0,5-A-Schritte = 39 990 Kombinationen: 0 Ausgaben über `FUSE_MAP`), `lib/vde-properties.test.ts` G1/G2 (Property, ~1 000 Fälle).
- **Ergebnis:** Erfüllt (ELEC-001 geschlossen 2026-10-14).
- **Release-Freigabe:** seit Release mit Fix (Commit auf `arena/f27aa996-camp`, PR #532).
- **Safety-Case-Claim:** CL-001.
- **Risk-Register:** R-002.

---

## 4. Regeln für die Matrix

| # | Regel |
|---|-------|
| M-1 | Jede neue Anforderung (insbesondere Klasse S) wird vor der Implementierung in die Matrix eingetragen. |
| M-2 | Jede Anforderung hat genau eine Implementierungsstelle (SSOT). |
| M-3 | Jede Anforderung hat mindestens einen Test mit Positiv- und (wo anwendbar) Negativfall. |
| M-4 | Klasse-S-Anforderungen benötigen einen Safety-Case-Claim und einen Risk-Register-Eintrag. |
| M-5 | Eine Anforderung gilt erst als „Erfüllt“, wenn Implementierung, Test und Review abgeschlossen sind. |
| M-6 | „Offen“ oder „Teilweise“ ist ein zulässiger Zustand, muss aber im Release-Report und (bei Klasse S) im Safety Case dokumentiert sein. |
| M-7 | Die Matrix wird bei jedem Release aktualisiert; Einträge werden nie still gelöscht. |
| M-8 | Widerspruch zwischen Matrix und Code/Tests: Merge blockiert bis zur Auflösung. |

---

## 5. Anhang: Noch nicht erfasste Anforderungen (Plan)

Die folgenden Anforderungen sind bekannt, aber noch nicht in der Matrix erfasst (Nacharbeit):

- Zugangsschutz / Authentifizierung (Camp ist lokaler Static Export, kein Backend — derzeit nicht relevant, bei Einführung nacherfassen)
- Datenschutz / DSGVO für Nutzerdaten (Daten verbleiben im Browser localStorage; `docs/impressum-datenschutz-befund.md`)
- Export / PDF-Erstellung (BOM existiert; PDF-Export geplant, derzeit keine bindende Anforderung)
- Mehrere Parallelpläne / Multi-Plan (bewusst nicht im Scope, vgl. AGENTS.md §8 „Keine neuen Features ohne Freigabe“)
