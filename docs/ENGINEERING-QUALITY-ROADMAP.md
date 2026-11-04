# Engineering Quality Roadmap — Camp (mit Abschlussbewertung)

**Stand:** 2026-11-04  
**Status:** Verbindlich (Erstfassung, lebendes Dokument)  
**Verantwortlich:** Product Owner (Priorisierung), Quality Engineering (Umsetzung), Safety Engineering (Sicherheit)  
**Übergeordnet:** `docs/engineering/ENGINEERING-CONSTITUTION.md`, `docs/architecture/SYSTEM-ARCHITECTURE.md`, `docs/safety/*`, `docs/verification/*`

---

## Teil A — Abschlussbewertung (Abschlussbewertung der Ist-Architektur)

Diese Bewertung ist ehrlich und basiert auf der Bestandserhebung des gesamten Repositories (Architektur, Elektrik-Engine, Graph/Routing, AutoWire, Komponentenbibliothek, Topologie, Validierung, Persistenz, PDF/Exporte, Frontend/UX, Security, Tests, CI, Dokumentation).

---

### A1. Wie professionell ist die aktuelle Architektur?

**Bewertung: hoch professionell für ein Planungswerkzeug dieser Größenordnung, mit klaren Schwächen bei der Dokumentenkohärenz und einigen offenen Sicherheitslücken.**

Positiv festzustellen:

- **Strenge Schichtentrennung** (SYSTEM-ARCHITECTURE §2): UI → Application → Domain → Electrical Engine → Graph & Routing. `lib/` importiert keine App-Schicht (Rule A, erzwungen durch `libBoundary.test.ts`). Das ist ein solides, architektonisch sauberes Fundament.
- **Single Source of Truth** für fast alle kritischen Entscheidungen: eine Stromquelle (`calculateEdgeCurrent` / `acCurrentA`), eine Kabelgeometrie-Quelle (globaler Routing-Pass, Rule G), eine Kollisionsquelle (`collision.ts`, Rule H), eine Token-Quelle (`tokens.ts`, Rule E), eine Verbindlichkeits-Regel (`intent.ts`).
- **Elektrik-Engine tief abgesichert:** `I_B ≤ I_n ≤ I_z` per Konstruktion, `selectFuseSize` nie oberhalb der Kabelgrenze (ELEC-001 geschlossen), 20-cm-Regel, Polarität, Solar-Sonderfälle, AC-Abschaltbedingung, Eigentumsgesetze G1–G7 (fast-check, ~1 000 Fälle).
- **Routing mit harten Invarianten:** I1–I3 = 0 über alle sechs Referenzpläne, Determinismus (byte-identisch), Port-Bündel-Ausnahme als eine Regel, harter Kollision (`Infinity`).
- **Reife CI-Infrastruktur:** Qualität Gate (`quality.yml`), Branch Protection (geplant), statischer Export ohne Backend, Lockfile-Härtung, E2E gegen Static Export, Accessibility (axe), Visual Regression.
- **Bestandserhebung ist ehrlich:** `KNOWN-PROBLEMS.md` listet nur nachweisbare Probleme, keine Wunschliste. Geschlossene Einträge sind datiert und belegt.

Schwachstellen:

- **Dokumentation ist verstreut:** Architekturregeln in `docs/ai/ARCHITECTURE-RULES.md`, Schichtenmodell in `docs/electrical-architecture.md`, elektrische Wahrheit in `docs/electrical-graph.md`, Kontexte in `docs/ai/*`, ADRs in `docs/adr/`. Es gibt kein zentrales, bindendes Regelwerk für neue Entwickler und KI-Agenten — diese Lücke schließt die vorliegende Dokumentation (`SYSTEM-ARCHITECTURE.md`, `ARCHITECTURE-RULES.md`, `ENGINEERING-CONSTITUTION.md`).
- **Einige Regeln sind Konvention, nicht (vollständig) erzwungen:** Regel B, D, F, M, N, S-2, S-3, S-4, S-6, S-8, S-9, S-10, O-1… O-5 leben primär im Review. Das ist akzeptabel, solange Reviewpflichten gelebt werden, aber nicht maschinell abgesichert.
- **Domänen-Trennregeln (24 px AC/DC, elektrisch/wasser) existieren, sind aber nicht vollständig ans Produktivrouter angebunden** (ROUTE-003).
- **Fahrzeug-Leitungskontext (FLRY/ISO 6722) fehlt teilweise** (ELE-001); die B2-Hausinstallationstabelle wird pauschal angewandt.

Fazit: Die Architektur ist auf dem Niveau eines erfahrenen Softwarearchitekten umgesetzt, aber das **Regelwerk und der Sicherheitsnachweis waren bisher nicht als einheitliches, verbindliches System dokumentiert**. Das liefert diese Roadmap nach.

---

### A2. Welche Sicherheitsmechanismen existieren bereits?

| Mechanismus | Status | Nachweis |
|-------------|--------|----------|
| `I_B ≤ I_n ≤ I_z` per Konstruktion | Implementiert, getestet | `lib/electrical.ts`, Sweep 39 990 Komb. 0 Verstöße |
| Sicherung nie über Kabelgrenze (`selectFuseSize`) | Implementiert, getestet | ELEC-001 geschlossen 2026-10-14 |
| 20-cm-Regel (Sicherung am Batteriepol) | Implementiert, getestet | `collectEdgeErrors` `main-fuse-distance` / `fuse-offset` |
| Polaritäts-Blockade (DC plus→plus, minus→minus) | Implementiert, getestet | `lib/connectionRules.ts` |
| Solar nur über Laderegler/MPPT | Implementiert, getestet | `lib/connectionRules.ts` |
| Kein stiller Fallback bei sicherheitskritischen Werten | Implementiert (Regel M) | `lib/units.ts` wirft statt 0 |
| Datenlücke nie als `critical` | Implementiert | `lib/validationSeverity.ts` |
| Fehlender FI (RCD) nie still angenommen | Implementiert (ELEC-002 gelöst) | `hasRcd` nicht mehr pauschal gesetzt; `RCD-001` |
| AC-Abschaltbedingung `Zs · Ia ≤ U0` | Implementiert (Annahme 0,8 Ω ausgewiesen) | `lib/acProtection.ts` |
| 230-V-Modellgrenze ausgewiesen (`INCOMPLETE`) | Implementiert | `lib/verify/acScope.ts` `NET-003` |
| Routing-Invariante I1 (kein Kabel durch Bauteil) | Hartes Gate = 0 | `lib/routing/invariants.ts`, `finalValidation.test.ts` |
| Routing-Invariante I2 (keine Überlappung) | Hartes Gate = 0 | Port-Bündel-Ausnahme eine Regel |
| Routing-Invariante I3 (Clearance) | Ratchet (Delta ≤ 0) | `checkClearance`, `routing:audit` |
| Determinismus (byte-identisch) | Getestet | `goldenMaster.test.ts`, `regression.test.ts` |
| AutoWire Verbindlichkeit (`locked > user > …`) | Implementiert | `lib/electricalGraph/intent.ts` |
| Persistenz RETTEN statt VERWERFEN | Implementiert | `persistence.ts`, Migrationstests |
| Keine Secrets im Repo; statischer Export ohne Backend | Implementiert (ARCH-001, ARCH-002) | `.env.example`, Build ohne `out/api` |
| Eigentumsgesetze G1–G7 (fast-check) | Implementiert | `lib/vde-properties.test.ts` |

---

### A3. Welche Fehlerklassen können aktuell unentdeckt bleiben?

| Fehlerklasse | Beispiel | Warum möglicherweise unentdeckt | Gegenmaßnahme (Roadmap) |
|--------------|----------|----------------------------------|-------------------------|
| Falsche Dimensionierung wegen fehlendem Fahrzeug-Leitungskontext | 50/70 mm² weichen von FLRY/ISO 6722 ab; B2 pauschal | Keine Fahrzeugtabelle, f₃ = 1,0 nicht belegt | R-001: Fahrzeugtabelle + f₃ + Quellenangabe |
| AC-Abschaltung auf Annahme gestützt | 0,8 Ω Netzimpedanz ist UNVERIFIED | Kein Messwert vor Ort im Plan | R-008: Annahme benannt; Messwert schlägt Annahme |
| Domänen-Abstand AC/DC unterschritten | 24 px Regel nicht angebunden (ROUTE-003) | Regel existiert, Router nutzt 12 px | R-019: Anbindung über Port-Fan-Out / Korridore |
| Clearance-Verstöße in dichten Bündeln (`complex`) | 8 Paare unter 24 px in Stubs/Bündeln | I3 ist Ratchet, nicht absolut Null in allen Szenarien | R-012: getrennte Korridore, Port-Kapazität |
| UI-Drift unentdeckt | Visual-Gate nicht blockierend | `continue-on-error: true` | R-020: Baselines neu aufnehmen, Job blockierend |
| Canvas nicht vollständig per Tastatur bedienbar | M11-3 Rest | E2E-Tastatur-Test fehlt | R-023: Tastatur-E2E nachholen |
| Security-Headers / CSP Lücken | ADR 0038 noch umzusetzen | Nicht geprüft auf ausgelieferter Seite | R-024: Headers prüfen |
| Mutation Testing nicht vorhanden | Künstliche Fehler nicht geprüft | Kein Mutation-Score | Roadmap: eingeführt über ADR (geplant) |
| Formale Verifikation nicht vorhanden | `I_B ≤ I_n ≤ I_z` nicht für vollen Zustandsraum | Kein Formal-Verification-Tool im CI | Roadmap: gezielt für Sicherheitsclaims (geplant) |

---

### A4. Welche Architekturprobleme würden zukünftige Erweiterungen erschweren?

1. **Fehlendes zentrales, bindendes Regelwerk** für neue Entwickler und KI-Agenten (wird durch diese Dokumente behoben).
2. **Domänen-Trennregeln nicht angebunden** — neue Fahrzeugtypen oder Spannungsebenen (24 V / 48 V) würden die bestehende 12-V-Logik nicht sauber erweitern, ohne die Trennung zu prüfen.
3. **Fahrzeug-Leitungskontext fehlt** — neue Kabeltypen oder Verlegebedingungen können nicht einfach hinzugefügt werden, ohne die Tabelle zu „verbessern“ (Golden-Master-Recapture nötig).
4. **Verstreute Dokumentation** — doppelte Wahrheitsquellen und veraltete Dokumente (DOC-001…DOC-005 waren historische Beispiele) erschweren das Onboarding und die Konsistenz.
5. **Kein Mutation Testing und keine formale Verifikation** — komplexe elektrische Gesetze werden nur über getestete Fälle abgesichert, nicht über den gesamten Zustandsraum.
6. **E2E nur gegen Static Export** — lokale Browser-Download-Blockade in manchen Umgebungen (dokumentiert in `docs/E2E-TESTS.md`), was das lokale Testen erschwert.

Keine dieser Probleme erfordert eine Neuarchitektur; alle sind durch gezielte, schrittweise Maßnahmen lösbar.

---

### A5. Was muss vor dem nächsten größeren Entwicklungsschritt erledigt werden?

1. **Regelwerk verbindlich etablieren:** `SYSTEM-ARCHITECTURE.md`, `ARCHITECTURE-RULES.md`, `ENGINEERING-CONSTITUTION.md`, `DEFINITION-OF-DONE.md` als verbindliche Bezugsdokumente für alle Änderungen (diese Roadmap).
2. **Safety Case und Risk Register in Betrieb nehmen:** Alle Klasse-S-Anforderungen verifiziert oder als dokumentierte Restrisiken akzeptiert.
3. **Domänen-Trennregeln ans Produktivrouter anbinden** (ROUTE-003), bevor neue Spannungsebenen oder Fahrzeugtypen hinzugefügt werden.
4. **Fahrzeug-Leitungskontext schließen** (R-001) oder bewusst als Modellannahme dokumentieren, bevor neue Kabeltypen dimensioniert werden.
5. **CI-Gates als Required Status Checks in der Branch Protection eintragen** (CI.md §4), damit Merge nicht ohne grünes Gate möglich ist.

---

### A6. Was muss zwingend vor einem öffentlichen Release erledigt werden?

1. Alle Merge-Gates (M-1 bis M-15) grün.
2. Alle Release-Gates (R-1 bis R-12) grün, insbesondere:
   - Safety-Case: alle Klasse-S-Claims erfüllt oder dokumentierte Restrisiken mit Product-Owner-Akzeptanz.
   - Risk Register: keine unbehandelten RPN ≥ 12.
   - Requirements Matrix: alle Klasse-S-Anforderungen verifiziert.
   - Dokumentation auf aktuellem Stand.
   - Reproduzierbarer Build, Post-Deploy Smoke-Check.
3. Ein grüner CI-Lauf allein reicht nicht (SAFETY-CASE §3).
4. Visuelle Baselines nach UI-Freigabe neu aufnehmen, damit das Visual-Regression-Gate sinnvoll blockiert (R-020).

---

### A7. Welche Maßnahmen können später folgen?

- **Mutation Testing** für sicherheitskritische Module (`lib/electrical.ts`, `lib/vde-standards.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`, `lib/connectionRules.ts`) mit festgelegtem Mutation-Score (eigener ADR).
- **Gezielte Formal Verification** für `I_B ≤ I_n ≤ I_z` über den relevanten Zustandsraum.
- **Mutation der Architekturregeln:** weitere Regeln aus Konvention in erzwungene Tests überführen (z. B. Regel D, B, M).
- **Datenqualitätsdokument** für Komponenten (Hersteller, Modell, Datenblatt, Datenversion, Verifizierungsstatus — Aufgabe 8).
- **ELK als vollständiger Layout-Pass** mit voller Token-Konfiguration (ARCHITECTURE-V2, noch FROZEN-Spec).
- **Formale Migrationspfade** für zukünftige Speicherversionen (ab v2).
- **Export/PDF** als bindende Anforderung (sofern gewünscht).

---

## Teil B — Priorisierte Roadmap

Die Roadmap ist in Phasen unterteilt. Jede Phase hat Abhängigkeiten, geschätzten Aufwand und messbare Abnahmekriterien. Aufwandsschätzungen sind in Personen-Tagen (PT) und beziehen sich auf Dokumentation, Tests und ggf. gezielte Implementierungshilfen (keine Änderung an elektrischen Formeln oder Berechnungsdaten in Phase 1).

### Legende

| Spalte | Bedeutung |
|--------|-----------|
| **Phase** | Roadmap-Phase (P1 … P4) |
| **ID** | Roadmap-ID |
| **Maßnahme** | Was getan wird |
| **Abhängigkeiten** | Was vorher erledigt sein muss |
| **Aufwand** | Geschätzter Aufwand (PT) |
| **Verantwortlich** | Rolle |
| **Abnahmekriterien (messbar)** | Wann die Maßnahme als erledigt gilt |

---

### Phase 1 — Architektur, Regeln, Sicherheit (sofort, keine Implementierung an Formeln/Daten)

| ID | Maßnahme | Abhängigkeiten | Aufwand | Verantwortlich | Abnahmekriterien |
|----|----------|----------------|---------|----------------|------------------|
| P1-1 | `docs/architecture/SYSTEM-ARCHITECTURE.md` erstellen (Schichten, SSOT, Abhängigkeiten, Verträge, Determinismus, Versionierung) | Bestandserhebung abgeschlossen | 2 PT | Architektur | Dokument existiert, ist konsistent mit `docs/ai/ARCHITECTURE-RULES.md`, `docs/electrical-architecture.md` |
| P1-2 | `docs/architecture/ARCHITECTURE-RULES.md` erstellen (Regeln A–N + S-1…S-10, Konventionen, Prüfbefehle) | P1-1 | 2 PT | Architektur | Jede Regel hat Durchsetzungsmittel (Test/Review/CI) benannt |
| P1-3 | `docs/engineering/ENGINEERING-CONSTITUTION.md` erstellen (Architektur, Anforderungen, Codequalität, Testpflichten, Sicherheit, Daten, Review, Dokumentation, Migration, CI, Schulden) | P1-2 | 3 PT | QE / Safety | Constitution deckt alle 11 geforderten Bereiche ab |
| P1-4 | `docs/engineering/DEFINITION-OF-DONE.md` erstellen (Commit, PR, Sicherheitskritisch, Release, Dokumentation, Eskalation) | P1-3 | 2 PT | QE | DoD für Commit/PR/Release definiert und verweisbar |
| P1-5 | `docs/safety/SAFETY-PLAN.md` erstellen (FMEA, FTA, SSA, Sicherheitsanforderungen, Klassifizierung, Maßnahmen, Verantwortlichkeiten, Restrisiken) | P1-3 | 3 PT | Safety Engineering | Alle geforderten Safety-Plan-Bereiche abgedeckt |
| P1-6 | `docs/safety/RISK-REGISTER.md` erstellen (Initialbestand aus KNOWN-PROBLEMS, Audits, Architekturanalyse) | P1-5 | 3 PT | Safety Engineering | Alle identifizierten Risiken mit ID, S, E, RPN, Maßnahme, Verifikation, Status |
| P1-7 | `docs/safety/SAFETY-CASE.md` erstellen (Claims, Nachweiskategorien, „grüner CI ist kein Nachweis“, Bewertungsregeln, Freigabeentscheidung) | P1-6 | 3 PT | Safety Engineering | Jede zentrale Sicherheitsbehauptung hat Kategorie + Referenz + Ergebnis |
| P1-8 | `docs/verification/VERIFICATION-STRATEGY.md` erstellen (alle Prüfverfahren, pro Bereich, Abnahmekriterien, Mutation Testing geplant) | P1-3 | 3 PT | QE | Strategie deckt alle geforderten Prüfverfahren ab |
| P1-9 | `docs/verification/REQUIREMENTS-MATRIX.md` erstellen (Anforderung → Grundlage → Implementierung → Test → Ergebnis → Release) | P1-5, P1-8 | 3 PT | Product Owner / QE | Alle Klasse-S-Anforderungen erfasst und verknüpft |
| P1-10 | `docs/verification/RELEASE-GATES.md` erstellen (Merge-Gates, Release-Gates, blockierende Fehler, reproduzierbare Builds, Prüfberichte, Rollback) | P1-4, P1-8 | 3 PT | QE / DevOps | Gates mit Befehl und Blockierwirkung definiert |
| P1-11 | `docs/ENGINEERING-QUALITY-ROADMAP.md` erstellen (Abschlussbewertung + Roadmap) | P1-1…P1-10 | 3 PT | Product Owner | Roadmap mit Phasen, Abhängigkeiten, Aufwand, Abnahmekriterien |
| P1-12 | Architekturtests als Required Status Checks in Branch Protection eintragen (CI.md §4) | Repo-Admin (`workflows:write`) | 1 PT | DevOps | `gh api` Protection gesetzt; Merge ohne grünes Gate nicht möglich |

**Gesamtaufwand Phase 1:** ca. 28 PT + Repo-Admin.  
**Abnahme Phase 1:** Alle 11 geforderten Dokumente existieren und sind konsistent; Branch Protection aktiv; alle Merge-Gates grün.

---

### Phase 2 — Sicherheitslücken schließen und Verifikation vertiefen (vor nächstem größeren Entwicklungsschritt)

| ID | Maßnahme | Abhängigkeiten | Aufwand | Verantwortlich | Abnahmekriterien |
|----|----------|----------------|---------|----------------|------------------|
| P2-1 | Domänen-Trennregeln (24 px AC/DC, elektrisch/wasser) ans Produktivrouter anbinden (ROUTE-003) | P1-1, P1-7 | 5 PT | QE | `scripts/routing/domain-probe` zeigt 0 Paare unter 24 px außerhalb Stubs; Referenzpläne byte-identisch oder begründet |
| P2-2 | Fahrzeug-Leitungskontext schließen (R-001): FLRY/ISO 6722 Tabelle, echte f₃-Werte, Golden-Master-Recapture mit Quellenangabe | P1-7, P1-9 | 8 PT | Safety Engineering / QE | `lib/electrical.test.ts` mit Fahrzeugtabelle; Quellenangabe im Test; Golden Master neu erfasst und begründet |
| P2-3 | AC-Netzimpedanz-Annahme (0,8 Ω) messen oder als „nicht bewertbar“ kennzeichnen (R-008) | P1-7 | 3 PT | Safety Engineering | Messwert vor Ort oder explizit `UNVERIFIABLE` im Meldungstext; `lib/acProtection.test.ts` ergänzt |
| P2-4 | Clearance-Rest im `complex`-Plan (8 Paare unter 24 px) reduzieren oder als dokumentiert akzeptieren (R-012) | P2-1 | 4 PT | QE | `routing:audit` zeigt keine Zunahme; Restrisiko im Risk Register dokumentiert |
| P2-5 | Mutation Testing für sicherheitskritische Module einführen (geplant) | P1-8 | 5 PT | QE | Mutation-Score ≥ 80 % für sicherheitsrelevante Linien; im CI |
| P2-6 | Tastatur-E2E für Canvas nachholen (M11-3 Rest, R-023) | P1-14 | 3 PT | QE / UX | `tests/e2e/planner-keyboard.spec.ts`: Mini-Plan baubar per Tastatur, alle grün |
| P2-7 | Visual-Regression-Baselines nach UI-Freigabe neu aufnehmen; Job blockierend machen (R-020) | P1-14 | 2 PT | QE / UX | `visual.spec.ts` grün; Job ohne `continue-on-error` |
| P2-8 | Security-Headers / CSP auf ausgelieferter Seite prüfen (R-024, ADR 0038) | P1-14 | 2 PT | DevOps | Headers vorhanden; Prüfung dokumentiert |
| P2-9 | Datenqualitätsdokument für Komponenten (Hersteller, Modell, Datenblatt, Datenversion, Verifizierungsstatus) erstellen (Aufgabe 8) | P1-9 | 4 PT | QE / Product Owner | Dokument existiert; jedes Bauteil in der Registry hat Verifizierungsstatus |

**Gesamtaufwand Phase 2:** ca. 36 PT.  
**Abnahme Phase 2:** Alle offenen Klasse-S-Risiken (R-001, R-008, R-019) sind behandelt oder als akzeptierte Restrisiken dokumentiert; Mutation Testing läuft; Tastatur-E2E grün.

---

### Phase 3 — Release-Reife und öffentliche Veröffentlichung

| ID | Maßnahme | Abhängigkeiten | Aufwand | Verantwortlich | Abnahmekriterien |
|----|----------|----------------|---------|----------------|------------------|
| P3-1 | Alle Release-Gates (R-1 bis R-12) grün für einen Release-Candidate | P1-10, P2-1…P2-9 | 3 PT | QE / DevOps | Release-Candidate besteht alle Gates |
| P3-2 | Safety-Case-Freigabe durch Product Owner (alle Klasse-S-Claims erfüllt oder dokumentierte Restrisiken akzeptiert) | P1-7, P2-1…P2-9 | 2 PT | Product Owner | Freigabeprotokoll unterzeichnet |
| P3-3 | Release-Report erstellen (Version, Änderungen, Verifikationsergebnisse, offene Risiken) | P3-1, P3-2 | 1 PT | Product Owner | Release-Report archiviert |
| P3-4 | Post-Deploy Smoke-Check erfolgreich | P3-1 | 1 PT | DevOps | HTTP 200, Bundle-Dateien präsent |
| P3-5 | Öffentlicher Release auf Default-Branch | P3-1…P3-4 | — | Product Owner | Release live |

**Gesamtaufwand Phase 3:** ca. 7 PT.  
**Abnahme Phase 3:** Öffentlicher Release ist erfolgt; alle Gates grün; Restrisiken dokumentiert und akzeptiert.

---

### Phase 4 — Langfristige Wartbarkeit und Weiterentwicklung (nach Release)

| ID | Maßnahme | Abhängigkeiten | Aufwand | Verantwortlich | Abnahmekriterien |
|----|----------|----------------|---------|----------------|------------------|
| P4-1 | Weitere Regeln aus Konvention in erzwungene Tests überführen (Regel D, B, M) | P1-2 | 4 PT | QE | Regel hat durchsetzbaren Test |
| P4-2 | Gezielte Formal Verification für `I_B ≤ I_n ≤ I_z` (Zustandsraum) | P2-5 | 8 PT | Safety Engineering | Formaler Nachweis vorliegt oder begründet ausgeschlossen |
| P4-3 | ELK vollständiger Layout-Pass mit voller Token-Konfiguration (ARCHITECTURE-V2 Spec) | P1-1 | 8 PT | QE | ELK-Pass erzeugt Positionen; keine Kabelgeometrie (Rule G) |
| P4-4 | Migrationspfad für Speicherversion v2 (falls benötigt) | P1-4 | 3 PT | QE | Migrationstest Altbestand v1 → v2 grün |
| P4-5 | Export/PDF als bindende Anforderung (falls gewünscht) | Product-Owner-Entscheidung | 5 PT | QE | Export startet, Datei nicht leer, leerer Plan ehrliche Meldung |
| P4-6 | Jährlicher Review aller Dokumente und des Safety Case | P1-1…P1-11 | 2 PT p.a. | Safety Engineering | Review-Protokoll; Dokumente aktuell |

---

## Teil C — Zusammenfassung der Abnahmekriterien (messbar)

| Bereich | Messbares Kriterium |
|---------|---------------------|
| Architektur | `libBoundary.test.ts`, `routing/architecture.test.ts`, `tokens.test.ts` grün; keine verbotenen Importe |
| Elektrik | Sweep 39 990 Komb. `selectFuseSize` 0 Verstöße über `FUSE_MAP`; G1–G7 keine Verletzung; Golden Master byte-identisch |
| Routing | I1 = I2 = I3 = 0 (hart) über alle Referenzpläne und Regression-Szenarien; Determinismus `true`; Fallback = 0 |
| Validierung | Jede `critical`-Regel hat Positiv- + Negativfall; AutoWire-Pläne feuern nicht (`assertZeroWarnings`) |
| Persistenz | Migrationstest Altbestand grün; Messwerte nicht persistiert; falsche Typen entfernt |
| CI / Release | `npm run check` grün; alle Merge-Gates grün; alle Release-Gates grün; Reproduzierbarer Build (`npm ci`) |
| Safety | Alle Klasse-S-Claims haben Kategorie + Referenz + Ergebnis; keine unbehandelten RPN ≥ 12 ohne akzeptiertes Restrisiko |
| E2E | Alle blockierende Specs grün; a11y critical/serious = Fail |
| Visual | Pixel-Drift ≤ 0,02 (baselines eingefroren) |

---

## Hinweis zur Ausführung

Diese Roadmap ist ein **dauerhaftes Engineering-System**, kein einmaliger Auditbericht. Sie wird bei jedem Release überprüft und fortgeschrieben. Änderungen an der Roadmap selbst erfordern einen Ledger-Eintrag in `docs/ARCHITECTURE-CHANGES.md`. Keine der Maßnahmen ändert elektrische Formeln oder bestehende Berechnungsdaten (Aufgabe 13, Phase 1).
