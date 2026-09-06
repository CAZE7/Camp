# ADR 0008 — Domain Model wird unabhängig von React Flow

**Status:** angenommen · **Datum:** 2026-09-06 · **Bezug:** WP-0c (#403), CAMP V2

## Kontext

Die Planner Domain (`lib/autoWire*`, `lib/electrical.ts`, `lib/vde-standards.ts`)
und der Store (`store/slices/*`) verwenden heute die React-Flow-Typen `Node` und
`Edge` als Datenmodell. Zur Laufzeit ist die Domain bereits React-frei
(nur `import type`), aber das **Typmodell** gehört einer UI-Bibliothek: RF-Felder
wie `positionAbsolute`, `handleBounds`, `selected` mischen sich mit Fachdaten in
`data`. Ein RF-Major-Update (S-1: `@xyflow/react` benennt u. a.
`positionAbsolute` um) erzwingt dann Änderungen in Fachcode, der mit der UI
nichts zu tun hat. Auch Persistenz und Golden Master (`knownPlans/`) frieren
derzeit RF-förmige Objekte ein.

## Entscheidung

Das Domänenmodell wird schrittweise von React Flow entkoppelt:

1. **Sofort gültig (Regel):** Kein Domain-/Engine-Code importiert
   RF-**Laufzeitwerte**. RF-Typ-Importe (`import type`) sind Übergangsbestand
   und werden nicht ausgebaut, sondern abgebaut.
2. **Zielbild:** Die Planner Domain definiert eigene Typen (Plan, Komponente,
   Verbindung, Anschluss) in `lib/`. Der React Flow Adapter mappt in beide
   Richtungen (Domain ⇄ RF-Nodes/Edges). Die Routing Engine erhält reine
   Geometrie (Rects, Punkte, Handle-Anker) — begonnen mit WP-2
   (`lib/routing/geometry/`).
3. **Fixtures/Persistenz:** Golden-Master- und Persistenz-Formate werden als
   Daten verstanden, nicht als RF-Objekte — neue Felder der RF-API dürfen
   Fixtures nicht verändern.

Die Umsetzung erfolgt bottom-up und pro PR eine Verantwortung — **kein**
Big-Bang-Umbau; dieses ADR legt die Richtung fest, nicht einen Termin.

## Konsequenzen

**Gut:** RF-Migrationen berühren nur den Adapter; Domain-Tests ohne jsdom/RF;
Worker-Übergabe (P-6) wird trivial (strukturiert klonbare Plain Data).

**Preis:** Mapping-Schicht im Adapter (Boilerplate); Übergangszeit mit zwei
Typwelten — mit `import type`-Regel und Review-Checkliste kontrolliert.

## Alternativen

- _RF-Typen dauerhaft als Domänenmodell:_ verworfen — UI-Bibliothek diktiert
  Fachdatenstruktur, Fixtures und Worker-Verträge.
- _Sofortige Voll-Entkopplung vor Routing V2:_ verworfen — verletzt
  „ein PR = eine Verantwortung“ und verzögert das Freeze-Gate.
