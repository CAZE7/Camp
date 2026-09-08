# ADR 0018 — ELK als produktiver Layout-Pass (UI-Verdrahtung)

**Status:** angenommen · **Datum:** 2026-09-08 · **Bezug:** ADR 0011, ADR 0016, AUDIT-EXTREM-2026-09 ROUTE-003

## Kontext

ADR 0011 entschied ELK Layered als globalen Layout-Pass, ADR 0016 konsolidierte
auf die eine elkjs-Anbindung in `lib/routing/elk/runner.ts` (Lazy-Singleton,
`ElkTimeoutError`, `createElkSession` mit „letzte Anfrage gewinnt"). Technisch
fertig — aber der Audit (ROUTE-003, VERIFIED per Import-Graph) stellte fest:

> ELK wird außerhalb von Tests/Scripts **nirgendwo** aufgerufen. Die Store-Action
> `onLayoutV2` existierte, war aber UI-tot; die App benutzte für „Aufräumen"
> ausschließlich das eigene 5-Rang-Spaltenlayout. Die Doku beschrieb damit einen
> Stand, den die Anwendung nicht hatte (Spec vs Implementation, SEVERITY MEDIUM).

Der Audit ließ zwei ehrliche Auswege: verdrahten **oder** Doku korrigieren. Die
A/B-Messung aus ADR 0011 (Summe −75 % Kreuzungen, −54 % Bends über die sechs
Golden-Master-Pläne) ist ein fachlicher Gewinn, den eine Doku-Korrektur verschenkt
hätte — wir verdrahten.

## Entscheidung

1. **`onLayoutV2` wird produktiv** über einen eigenen Toolbar-/Menü-Eintrag
   „Strukturieren (ELK)" in `components/planner/PlannerDashboard.tsx` — neben,
   nicht statt „Aufräumen". Das Spaltenlayout bleibt verfügbar: Es ist
   vorhersagbar, schnell und für Nutzer lesbar; ELK ist der globale
   Strukturierer für verwachsene Pläne.
2. **Umfang bleibt Knotenpositionen.** `applyAdvancedLayout` gibt weiterhin nur
   Positionen zurück (Scope-Note `routingV2Adapter.ts`): ELK-`routes`/`junctions`
   werden bewusst NICHT in `data.geometry` konsumiert — Kabelgeometrie gehört
   exklusiv dem globalen A\*-Pass (`cableRouteStore`, ADR 0014). Der ELK-Button
   legt Knoten neu; der Routing-Pass zieht anschließend alle Trassen reaktiv.
3. **Fallback-Kette ist sichtbar, nicht still.** `applyAdvancedLayout` meldet
   neu `engine: 'elk' | 'dagre'` mit (bisher wurde der Dagre-Fallback
   verschluckt). Das UI-Feedback sagt dem Nutzer, welche Engine gelaufen ist —
   Laufzeit-Realität statt Doku-Versprechen (exactly der ROUTE-003-Vorwurf).
4. **Letzte Anfrage gewinnt (P-6) auch im Store.** Eine Sequenznummer in
   `graphSlice.ts` invalidiert ältere, noch laufende Layout-Anfragen; veraltete
   Ergebnisse werden niemals in den Store geschrieben und löschen
   `isLayoutPending` nie vorzeitig — dieselbe Semantik wie `createElkSession`,
   eine Ebene höher, wo auch der Fallback-Pfad davor geschützt ist.
5. **Beide Ansichten:** Wie `onLayout` arbeitet `onLayoutV2` im Wasser-Modus auf
   `waterNodes`/`waterEdges` (der Engine-Vertrag kennt `kind: 'waterPipe'`
   bereits); im Elektro-Modus auf `nodes`/`edges`. Undo via `withHistory`,
   Fit-View-Dispatch — identisch zum klassischen Aufräumen.

## Konsequenzen

**Gut:** ROUTE-003 ist geschlossen, statt die Doku zurückzustufen; der in
ADR 0011 gemessene Qualitätsgewinn ist per Knopfdruck erreichbar; Timeout-
(3 s) und Stale-Verhalten sind für den einen Produktivpfad ebenso abgesichert
wie bisher nur für Tests.

**Pflichten:** Der ELK-Pfad ist jetzt Teil des UI-Verhaltens — Änderungen an
`LAYOUT_TOKENS`, am Runner oder an der Fallback-Kette brauchen weiterhin die
Store- und Dashboard-Tests; „ELK produktiv" darf künftig nur behauptet werden,
solange `data-testid="action-layout-v2"` existiert und grün ist.

**Bewusst offen:** Die klassische Spalten-Action bleibt Standard (kein
Zeitverhalten); ein automatischer ELK-Initial-Pass bei `autoWireSystem` ist
nicht Teil dieser Scheibe.
