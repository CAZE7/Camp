# Elektroplaner — Architektur (V2)

> Stand: 2026-10-04 · Gültig für `lib/electricalGraph/`, `lib/autoWire/`, `lib/verify/`,
> `lib/routing/`, `components/edges/utils/`, `store/slices/`.
> Vertiefung je Schicht: [`docs/electrical-graph.md`](./electrical-graph.md),
> [`docs/auto-wire.md`](./auto-wire.md), [`docs/routing.md`](./routing.md).

## Warum es diese Schichten gibt

Der Planer beantwortet drei verschiedene Fragen, und fast jeder Fehler der Vergangenheit
entstand dort, wo eine Antwort in die Zuständigkeit einer anderen hineingriff:

| Frage                | Antwortet                           | Darf NICHT             |
| -------------------- | ----------------------------------- | ---------------------- |
| Was gehört zusammen? | elektrische Topologie               | Positionen kennen      |
| Wo liegt es?         | Layout (Positionen)                 | Topologie ändern       |
| Wie läuft das Kabel? | Routing (Wegpunkte)                 | Topologie/Daten ändern |
| Stimmt es?           | Verifikation + Abschlussvalidierung | etwas „reparieren"     |

Die klassische Fehlerform: Das Routing merkt, dass ein Kabel nicht passt, und ändert die
Verbindung. Danach stimmt der Plan mit dem überein, was gezeichnet werden konnte — nicht
mit dem, was der Nutzer wollte. Deshalb ist die Richtung der Abhängigkeit **einseitig**:

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1  ELECTRICAL GRAPH      lib/electricalGraph/                       │
│    Was gilt elektrisch?  Absicht, Spannungsebene, Bänke, Grenzen,   │
│    Stromkreise, AC-System, Inhalts-Hash. GEOMETRIEFREI.             │
└───────────────┬─────────────────────────────────────────────────────┘
                │ liest
┌───────────────▼─────────────────────────────────────────────────────┐
│ 2  TOPOLOGIE / VERIFIKATION   lib/verify/ (5 Pässe), lib/domain/    │
│    Physik, Strombelastbarkeit, Topologie, Schutz, Regeln.           │
│    Ergebnis: Befunde — niemals Änderungen am Plan.                  │
└───────────────┬─────────────────────────────────────────────────────┘
                │ liest
┌───────────────▼─────────────────────────────────────────────────────┐
│ 3  AUTO-WIRE-VORSCHLAG    lib/autoWire/                             │
│    VERVOLLSTÄNDIGT einen Plan, erfindet keinen. Gepinnte Kanten     │
│    bleiben; Konflikte werden GEMELDET (conflicts.ts), nicht gelöst. │
└───────────────┬─────────────────────────────────────────────────────┘
                │ erzeugt Knoten/Kanten
┌───────────────▼─────────────────────────────────────────────────────┐
│ 4  PHYSISCHES LAYOUT      lib/autoWire/placement.ts, ELK/dagre      │
│    Nur Positionen. Keine neue Kante, keine geänderte Kante.         │
└───────────────┬─────────────────────────────────────────────────────┘
                │ Positionen + Boxmaße
┌───────────────▼─────────────────────────────────────────────────────┐
│ 5  ROUTING                components/edges/utils/, lib/routing/     │
│    Wegpunkte. Deterministisch, ohne Zufall, mit Generationszähler.  │
└───────────────┬─────────────────────────────────────────────────────┘
                │ Routen
┌───────────────▼─────────────────────────────────────────────────────┐
│ 6  ABSCHLUSSVALIDIERUNG   lib/routing/finalValidation.ts (I1…I7)    │
│    Harte Invarianten. Verletzung = Befund, keine stille Korrektur.  │
└───────────────┬─────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────────┐
│ 7  RENDERING / UX         components/planner/, components/edges/    │
│    Drei Arbeitsmodi: PLANUNG · PHYSISCH · PRÜFUNG (reine Anzeige).  │
└─────────────────────────────────────────────────────────────────────┘
```

**Keine Rückwärtskante.** `lib/` importiert nichts aus `components|store|app` (ESLint
ARCH-001). Was eine untere Schicht erkennt, meldet sie nach oben — sie greift nicht hoch.

## Die fünf Zusagen des Systems

1. **Determinismus.** Gleiche Eingabe ⇒ gleiche Ausgabe. Kein `Math.random()` im Routing
   (ESLint-Verbot), keine Iteration über unsortierte Mengen, Sortierung immer über stabile
   IDs. Geprüft u. a. durch `tests/scale/plannerScale.test.ts` (umgedrehte Eingabe ⇒
   gleicher Graph-Hash) und `scripts/goldenmaster/`.
2. **Nutzerabsicht gewinnt.** Eine Verbindung trägt eine Verbindlichkeit
   (`locked > user > required > auto > suggested`). Auto-Wire darf nur Schwächeres
   ersetzen. Widerspricht eine gepinnte Kante einer Regel, erscheint eine Warnung —
   korrigiert wird nichts.
3. **Topologie ≠ Geometrie** (ADR 0008). Routing schreibt niemals `crossSection`,
   `fuseSize`, `edgeDomain` oder `length`.
4. **Keine stillen Annahmen** (Regel M). Unbekannt ist ein eigener Zustand: Der
   Strombudget-Rechner liefert `undefined` plus Warnung statt eines erfundenen Grenzwerts;
   eine Spannung außerhalb 10–72 V ist `'unknown'` und nicht „halt 12 V".
5. **Konvergenz.** Wiederholte Läufe ändern nichts mehr (Idempotenz), und die
   Routing-Generation bricht nach `MAX_ROUTE_REVISIONS_PER_GRAPH = 4` Revisionen
   derselben Eingabe ab — ein Zähler, kein Timer.

## Wo welche Entscheidung lebt

| Entscheidung                             | Ort                                               |
| ---------------------------------------- | ------------------------------------------------- |
| Darf AutoWire diese Kante anfassen?      | `lib/electricalGraph/intent.ts`                   |
| Welche Spannungsebene hat die Anlage?    | `lib/electricalGraph/powerSystem.ts` + `graph.ts` |
| Was hält ein Bauteil aus?                | `lib/electricalGraph/constraints.ts`              |
| Wie hängen Batterien zusammen?           | `lib/electricalGraph/batteryBank.ts`              |
| Welcher Grenzwert gilt zuerst?           | `lib/electricalGraph/currentBudget.ts`            |
| Welche 230-V-Quelle speist diesen Kreis? | `lib/electricalGraph/acSystem.ts`                 |
| Welche Sicherung, welcher Querschnitt?   | `lib/electrical.ts`, `lib/vde-standards.ts`       |
| Wo liegt ein Bauteil?                    | `lib/autoWire/placement.ts`, ELK/dagre            |
| Wie läuft das Kabel?                     | `components/edges/utils/pathfinding.ts`           |
| Ist das Ergebnis gültig?                 | `lib/verify/`, `lib/routing/finalValidation.ts`   |

## Drei Arbeitsmodi (UX)

`store/slices/types.ts → PlannerMode`: `planung | physisch | pruefung`.
Der Modus ändert **ausschließlich die Anzeige** — er ist kein Bearbeitungsmodus. Ein
Moduswechsel fasst weder Knoten noch Kanten an (Test:
`components/planner/ui/PlannerModeSwitch.test.tsx`).

## Verwandte Dokumente

- [`docs/ARCHITECTURE-V2.md`](./ARCHITECTURE-V2.md) — Vorgängerfassung, Schichten der Routing-Pipeline
- [`docs/adr/0008-domain-model-unabhaengig-von-react-flow.md`](./adr/0008-domain-model-unabhaengig-von-react-flow.md)
  · [`0010-routing-ist-deterministisch.md`](./adr/0010-routing-ist-deterministisch.md)
  · [`0015-harte-final-invariante.md`](./adr/0015-harte-final-invariante.md)
- [`docs/ai/ARCHITECTURE-RULES.md`](./ai/ARCHITECTURE-RULES.md) — Regeln A–N, bindend
- [`AUDIT-CAMP-ELEKTROPLANER.md`](../AUDIT-CAMP-ELEKTROPLANER.md) — Befundlage mit Status
