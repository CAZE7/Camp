# Safety Plan — Camp (Elektrikplaner)

**Stand:** 2026-11-04  
**Status:** Verbindlich (Erstfassung)  
**Verantwortlich:** Safety Engineering gemeinsam mit Product Owner und Quality Engineering  
**Übergeordnet:** `docs/engineering/ENGINEERING-CONSTITUTION.md`  
**Verwandt:** `docs/safety/RISK-REGISTER.md`, `docs/safety/SAFETY-CASE.md`, `docs/verification/VERIFICATION-STRATEGY.md`, `docs/AC-230V-MODELLGRENZEN.md`

---

## 1. Zweck

Dieser Safety Plan legt fest, wie Camp sicherheitsrelevante elektrische Planung systematisch beherrscht. Camp ist ein **Planungswerkzeug**, kein Nachweis einer normgerechten Auslegung. Sicherheitskritische Fehlplanungen (z. B. unterdimensionierte Kabel, zu große Sicherungen, fehlender FI, verpolte Batterien) können im schlimmsten Fall zu Brand, Kurzschluss oder Stromschlag führen. Der Plan definiert deshalb:

- welche Methoden angewendet werden (FMEA, Fehlerbaumanalyse, System-Sicherheitsanalyse),
- welche Sicherheitsanforderungen gestellt werden,
- wie Risiken klassifiziert, behandelt und nachweislich abgeschlossen werden,
- wer verantwortlich ist,
- welche Restrisiken offen bleiben.

Ein grüner CI-Lauf ist kein vollständiger Sicherheitsnachweis (SAFETY-CASE §3).

---

## 2. Geltungsbereich und Abgrenzung

**Im Geltungsbereich:**

- DC-Nieder- und Mittelspannung im Camper (12 V / 24 V / 48 V), insbesondere Batterieanschlüsse, Sicherungen, Querschnitte, Spannungsfall, Kurzschluss, Masse, Shunt.
- AC-Nieder- und Mittelspannung (230 V) innerhalb des bewusst begrenzten Modells (`docs/AC-230V-MODELLGRENZEN.md`).
- AutoWire (automatische Topologie, Dimensionierung, Sicherung).
- Validierung und Warn-Zentrale (Fehlerchips, `collectEdgeErrors`, `useLiveValidation`).
- Routing-Invariante I1–I3 (Kabel darf nicht durch Bauteile laufen, keine Überlappung, Clearance).
- Persistenz und Migration (kein Datenverlust, kein stiller Default).

**Nicht im Geltungsbereich (bewusste Abgrenzung):**

- Normative 230-V-Abnahme (darf nur durch qualifiziertes Personal erfolgen).
- Echtzeit-Überwachung der installierten Anlage (Camp plant, es misst nicht laufend).
- Mechanische, thermische (Umgebung), brandschutztechnische Aspekte außerhalb der elektrischen Modellannahmen.
- Fahrzeug-Zulassung und Fahrsicherheit.

---

## 3. Sicherheitsmethode

Camp wendet eine Kombination etablierter Sicherheitsverfahren an. Jede Methode hat einen definierten Zweck und ein definiertes Ergebnis.

| Methode | Zweck im Camp | Ergebnis | Nachweis |
|---|---|---|---|
| **FMEA** (Fehlermöglichkeits- und Einflussanalyse) | Systematische Erfassung aller Fehlerarten der elektrischen Berechnung, des Routing und der Validierung mit Auswirkungen, Ursachen und Erkennbarkeit. | Risikoeinträge mit RPN (Risiko prioritätszahl) | `RISK-REGISTER.md` |
| **Fehlerbaumanalyse (FTA)** | Top-Ereignisse (z. B. „Kabel überhitzt“, „Sicherung löst nicht aus“, „Stromschlag am 230-V-Kreis“) in Ursachen aufbrechen. | Logische Verknüpfung von Basisevents, Schnittmengen | `SAFETY-CASE.md` (Argumentation) |
| **System-Sicherheitsanalyse (SSA)** | Gesamtbetrachtung des Systems (Topologie, AutoWire, Validierung, Persistenz, UI) unter dem Aspekt „was kann schiefgehen und wie wird es erkannt“. | Sicherheitsanforderungen, Architekturmaßnahmen | `SYSTEM-ARCHITECTURE.md`, `SAFETY-CASE.md` |
| **Invariantenprüfung** | Harte, automatische Prüfung von Sicherheitsgarantien (I1–I3: kein Kabel durch Bauteil, keine Überlappung, Clearance). | `INVALID` ⇒ Plan nicht gültig | `lib/routing/invariants.ts`, `finalValidation.ts` |
| **Eigentumsgesetze (G1–G7)** | Mathematische Überprüfung elektrotechnischer Gesetze (z. B. Sicherungs-Sandwich `I_B ≤ I_n ≤ I_z`, Monotonie, Idempotenz). | fast-check über tausende generierte Fälle | `lib/vde-properties.test.ts` |

---

## 4. Sicherheitsanforderungen (Auswahl)

| ID | Anforderung | Klasse | Quelle / Begründung |
|---|-------------|--------|---------------------|
| S-01 | `I_B ≤ I_n ≤ I_z` (Laststrom ≤ Sicherung ≤ Kabelbelastbarkeit) muss per Konstruktion erfüllt sein. | S | `lib/electrical.ts` `FUSE_MAP`, `selectFuseSize`; AUDIT ELEC-001 |
| S-02 | Eine Sicherung darf niemals oberhalb der Kabelgrenze empfohlen werden. | S | `selectFuseSize` nie > `FUSE_MAP[cs]`; `isFuseFeasible` |
| S-03 | Die 20-cm-Regel (Sicherung ≤ 0,2 m vom Batteriepol) wird geprüft; Fehlen ist ein kritischer Befund. | S | `collectEdgeErrors` `main-fuse-distance`; ISO 10133:2000 §8.1 |
| S-04 | Keine verpolte Parallelschaltung von Batterien oder Solarpanels (Kurzschlussgefahr kA-Bereich). | S | `connectionRules.ts`; AUDIT ELE-002/ELE-003 |
| S-05 | Solar darf nicht direkt auf Batterie/Verbraucher, nur über Laderegler/MPPT. | S | `connectionRules.ts`; AUDIT ELE-002 |
| S-06 | Kein stiller Fallback bei sicherheitskritischen Werten (kein geschätzter Grenzwert bei fehlenden Daten). | S | Regel M; `units.ts` wirft statt 0 |
| S-07 | Datenlücke wird als `incomplete`/`UNVERIFIABLE` ausgewiesen, niemals als `critical` oder „ok“. | S | `lib/validationSeverity.ts`; Regel S-3 |
| S-08 | Fehlender FI (RCD) am 230-V-Kreis wird als kritischer Warnung angezeigt, nie still angenommen. | S | `useLiveValidation` `A2-shore-rcd`, `AC-001-inverter-rcd`; ELEC-002 gelöst |
| S-09 | AC-Abschaltbedingung `Zs · Ia ≤ U0` wird geprüft; die vorgelagerte Netzimpedanz (0,8 Ω) ist als Annahme ausgewiesen. | S | `lib/acProtection.ts`; UNVERIFIED |
| S-10 | Kabel darf nicht durch ein Bauteil laufen (I1 hart 0); keine kollineare Überlappung (I2 hart 0); Clearance eingehalten (I3 Ratchet). | S | `lib/routing/invariants.ts`, `finalValidation.ts` |
| S-11 | AutoWire darf gepinnte Verbindungen (`locked`) nicht überschreiben; Verbindlichkeit `locked > user > required > auto > suggested`. | S | `lib/electricalGraph/intent.ts` |
| S-12 | Bestehende Projekte (Persistenz v1) bleiben lesbar; Migration zerstört keine Daten (RETTEN statt VERWERFEN). | D | `persistence.ts`; Rule S-7 |

Klasse **S** = sicherheitskritisch (Merge/Release blockierend bis Verifikation vorliegt).  
Klasse **F** = funktional. Klasse **D** = Daten. Klasse **P** = Prozess.

---

## 5. Risikoklassifizierung

Risiken werden nach Schwere (S) und Eintrittswahrscheinlichkeit (E) klassifiziert. Die Risikoprioritätszahl (RPN) = S × E dient der Priorisierung, ersetzt aber nie den individuellen Verifikationsnachweis.

| Schwere (S) | Bedeutung | Beispiel Camp |
|---|-----------|---------------|
| S1 | Katastrophal: Brand, Stromschlag, erhebliche Sach- oder Personengefahr | Sicherung schützt Kabel nicht (ELEC-001), verpolte Batterien |
| S2 | Schwer: Fehlfunktion der Planung, falsche Dimensionierung | Spannungsfall über Budget, zu kleiner Querschnitt |
| S3 | Mittel: Anzeigefehler, irreführender Befund | Falsche Einheit im Warn-Befund, fehlender Hinweis |
| S4 | Niedrig: Komfort, kosmetisch | Routing-Schönheitsfehler (zwei Kabel auf Trasse) |

| Wahrscheinlichkeit (E) | Bedeutung |
|---|-----------|
| E1 | Sehr wahrscheinlich (tritt bei typischer Nutzung auf) |
| E2 | Möglich |
| E3 | Unwahrscheinlich |
| E4 | Sehr unwahrscheinlich |

| RPN | Priorität | Behandlung |
|---|-----------|------------|
| ≥ 12 | Hoch | Sofortige Maßnahme, Release blockierend bis verifiziert |
| 6–11 | Mittel | Maßnahme im nächsten Release, nachverfolgbar |
| ≤ 5 | Niedrig | Dokumentieren, überwachen |

---

## 6. Maßnahmen und Verantwortlichkeiten

| Bereich | Verantwortliche | Aufgabe |
|---|---|---|
| Elektrische Berechnungen | Safety Engineering + QE | `I_B ≤ I_n ≤ I_z`, 20-cm-Regel, Abschaltvermögen, AC-Abschaltung |
| Routing / Geometrie | QE + Architektur | Invariante I1–I3, Determinismus, Clearance |
| Validierung / Warn-Zentrale | QE + UX | Strukturierte Befunde, keine Datenlücke als critical, Konsequenz + Handlungsaufforderung |
| Persistenz / Daten | QE | Migration, Schema, Rückwärtskompatibilität |
| CI / Release | QE + DevOps | Qualität Gates, Release-Gates, Reproduzierbarkeit |
| Dokumentation | Product Owner + QE | Safety Case, Risk Register, Requirements Matrix |
| Freigabe | Product Owner | Finale Release-Entscheidung auf Basis des Safety Case |

---

## 7. Nachweis der Risikobehandlung

Jeder Risikoeintrag im Risk Register dokumentiert:

1. Gefährdung und Top-Ereignis,
2. Ursachen und betroffene Komponenten,
3. Schwere, Wahrscheinlichkeit, RPN,
4. getroffene technische und organisatorische Maßnahme,
5. Verifikationsmethode (Test, Property, Architekturtest, Referenzberechnung, Review),
6. Ergebnis der Verifikation (erledigt / offen),
7. Restrisiko und Begründung, warum es akzeptiert wird,
8. Verantwortlicher und Datum.

Ein Risiko gilt erst als **behandelt**, wenn:
- die technische Maßnahme umgesetzt ist,
- der Verifikationsnachweis vorliegt (SAFETY-CASE §4),
- der Eintrag im Risk Register auf „behandelt“ mit Nachweis steht.

Ein grünes Test-Reichnis ersetzt diesen Nachweis nicht.

---

## 8. Offene Restrisiken (Initialbestand)

Die folgenden Restrisiken sind zum Zeitpunkt dieses Plans bekannt und bewusst offen. Die IDs und Status entsprechen dem `RISK-REGISTER.md` (Einträge R-001 … R-024):

| Risk-Register-ID | Risiko | Klasse | RPN | Status | Geplante Behandlung |
|---|--------|--------|-----|--------|---------------------|
| R-001 | Fahrzeug-Leitungskontext nur teilweise modelliert (FLRY / DIN EN 1648-2 / ISO 6722 fehlt; B2-Hausinstallationstabelle pauschal) | S2 | 9 | Akzeptiert als dokumentiertes Restrisiko | Fahrzeugtabelle + echte f₃-Werte, Golden-Master-Recapture mit Quellenangabe (Phase 2) |
| R-008 | Vorgelagerte Netzimpedanz der AC-Abschaltbedingung (0,8 Ω) ist Annahme, nicht Messwert | S2 | 8 | Akzeptiert als dokumentierte Modellannahme | Annahme im Meldungstext benannt; Messwert vor Ort schlägt Annahme |
| R-019 | Domänen-Trennregeln (24 px AC/DC, elektrisch/wasser) teils nicht ans Produktivrouter angebunden | S3 | 6 | Geplant Phase 2 | Anbindung über Port-Fan-Out / separate Korridore (ROUTE-003) |
| R-018 | Live-Routing-Performance über Ratchet (60 ms) bei großen Plänen nicht interaktiv | F2 | 6 | Akzeptiert als dokumentierter Zielkonflikt | Eigener ADR für A*-Innenloop-Optimierung; 16-ms-Render-Ziel gilt weiter |
| R-009 | 230-V-Modell ohne L/N/PE-Trennung, Umschaltung, Rückspeiselogik (abgesichert als Modellgrenze) | S2 | 8 | Akzeptiert als dokumentierte Modellgrenze | `NET-003-ac-model-scope` weist `INCOMPLETE` aus; keine normative Abnahme |
| R-022 | Chat/Endpunkt (externer Assistent) Produktentscheidung offen | P3 | 4 | Offen als Produktentscheidung | ADR 0021: externer Endpunkt oder Entfernung |
| R-020 | Visuelles Pixel-Gate nicht blockierend (Baseline-Drift möglich) | Q3 | 5 | Geplant nach UI-Freigabe | Baselines neu aufnehmen; Job kann blockierend werden |

Diese Restrisiken werden im Risk Register geführt und bei jedem Release neu bewertet.

---

## 9. Review und Aktualisierung des Safety Plan

Der Safety Plan wird bei jeder Änderung an sicherheitskritischen Dateien (SC-1, ENGINEERING-CONSTITUTION §5) und mindestens einmal pro Release überprüft. Änderungen erfordern einen Ledger-Eintrag in `ARCHITECTURE-CHANGES.md` und eine Aktualisierung von `RISK-REGISTER.md` sowie `SAFETY-CASE.md`, soweit betroffen.
