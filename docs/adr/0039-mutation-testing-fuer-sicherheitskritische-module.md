# ADR 0039 — Mutation Testing für sicherheitskritische Module

**Status:** Akzeptiert (geplant)  
**Datum:** 2026-11-05  
**Verantwortlich:** Quality Engineering  
**Verknüpft:** PR #604 (N-04, O-07), PR #605 (G4)

---

## 1. Kontext

Die Verifikationsstrategie (`docs/verification/VERIFICATION-STRATEGY.md` §5) sieht Mutation Testing für sicherheitskritische Module (`lib/electrical.ts`, `lib/vde-standards.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`, `lib/connectionRules.ts`) vor. Bisher ist Mutation Testing nicht im CI und nicht als Gate in `RELEASE-GATES.md` implementiert.

PR #605 bringt konzeptionell G4 (kuratierter Stryker-Satz) mit. G4 ist explizit als "nach PR #605 als eigener PR folgt" markiert.

## 2. Entscheidung

Mutation Testing wird **nicht** als Teil von PR #604 implementiert. Stattdessen:

1. Ein eigener ADR (dieser) legt Ziel, Module und Schwelle fest.
2. Die Einführung erfolgt über einen separaten PR nach Merge von PR #605.
3. Bis dahin bleibt G4 in `RELEASE-GATES.md` als "mit PR #605-Remediation geplant" markiert.

## 3. Zielmodule

| Modul                    | Begründung                                                                |
| ------------------------ | ------------------------------------------------------------------------- |
| `lib/electrical.ts`      | `I_B ≤ I_n ≤ I_z`, `selectFuseSize` — sicherheitskritisch (CL-001, R-002) |
| `lib/vde-standards.ts`   | Normwerte, Eigentumsgesetze G1–G7                                         |
| `lib/shortCircuit.ts`    | Kurzschlussberechnung                                                     |
| `lib/acProtection.ts`    | AC-Abschaltbedingung `Zs · Ia ≤ U0` (CL-012, R-008)                       |
| `lib/connectionRules.ts` | Polarität, Solar-Sonderfälle (CL-002, R-005, R-006)                       |

## 4. Mutation-Score-Schwelle

**Vorschlag:** ≥ 80 % killed mutants auf sicherheitsrelevante Linien. Die endgültige Schwelle wird vor der Implementierung in einem Review abgestimmt.

## 5. Abnahmekriterien

- Mutation-Score ≥ 80 % für sicherheitsrelevante Linien der Zielmodule
- Mutation Testing läuft im CI (eigener Job in `quality.yml`)
- G4 (PR #605) ist als Gate verknüpft

## 6. Alternativen

Keine. Mutation Testing ist die einzige Methode, die die Erkennbarkeit von Tests für künstliche Fehler in sicherheitskritischem Code bewertet.

---

**Ende des ADR.**
