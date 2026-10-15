# Routing-Architektur dieser Änderung

## Verantwortung und Ablauf

`routingSnapshot.ts` normalisiert absolute Geometrie und Handles in
`lib/routing/model.ts`. Nur routingrelevante Verbindungseigenschaften und
Lock-Wegpunkte passieren diese Grenze. React-Internals werden nicht übertragen.

`CableRouteSync` → ein wiederverwendbarer Worker → `routingJob.ts` → Initialrouting
oder explizite Optimierung → Final-Validation → atomarer Snapshot → Renderer.
Veraltete Jobs werden abgebrochen; Hash, Generation und Revision schützen zusätzlich
vor späten Antworten. Ein 10-s-Watchdog terminiert den Worker wirklich. Es gibt keinen
versteckten Main-Thread-Fallback nach einem Workerfehler.

Initialrouting behält Katalog/Hanan-A*, Fan-out, Hindernisfenster und bewährte
Geometrieschritte. Nudge, Bend-Merge und Separation dürfen die orientierten ersten
und letzten Segmente nicht entfernen/umdrehen. `globalLaneRepair.ts` erzeugt bei
verbleibenden Clearance-Konflikten **gemeinsame** Kandidaten: Verschiebung einer Lane
propagiert auf ihre parallelen Nachbarn. Anschließend werden begrenzte gemeinsame
Port-Lane-Tauschversuche global geprüft. Zwischenstände werden nie veröffentlicht.
Budgets: 16 Seeds, 32 Propagationszüge, 8 Routen je Cluster, 32 Tauschkandidaten.

`optimizeCableRoutes.ts` ist eine separate Benutzeraktion ohne Geräteverschiebung.
Bis zu vier Versuche legen ausgewählte Kabel unter Beachtung festgehaltener anderer
Routen neu. Physische Locks und temporäre Belegung sind unterschiedliche Zustände.
Hops, Labels und Metriken werden aus der endgültigen gemeinsamen Geometrie aufgebaut.

## Qualitätshierarchie

1. Vollständigkeit, eindeutige IDs, endliche orthogonale Nichtnullsegmente, exakte
   Endpunkte, Außenrichtung, gültige gemessene Handle-IDs, keine unerlaubte Rückkehr
   durch Anschlussgeräte, I1/I2/I3 sowie unveränderte Locks sind harte Bedingungen.
2. `lib/routing/quality.ts`: globaler Vektor aus Kreuzungen, I4–I7-Defekten,
   Biegungen und Manhattan-Länge in px. Keine beliebigen neuen Strafgewichte:
   gültige Kandidaten müssen Pareto-besser sein; Gleichstand behält den Bestand.
   Ein gültiger Kandidat schlägt einen ungültigen, nicht umgekehrt.
3. Elektrische Verifikation bleibt unabhängig. Geometrie schreibt weder Querschnitt,
   Sicherung, Domäne noch fachliche Leitungslänge. Fehlende elektrische Eingaben
   werden nicht durch geometrische Scores ersetzt.

X-Kreuzungen bleiben erlaubt; kollineare Überdeckung ist I2, Berührung ohne echte
Kreuzung fällt in die Clearance-Prüfung. Die gemeinsame Port-Bündelausnahme stammt
unverändert aus `portBundle.ts`. Ein Hop kaschiert keinen realen Konflikt.

## Veröffentlichung und Stabilität

Geometrie, ihr aktueller Bericht und Generation werden vor der ersten Benachrichtigung
zusammen installiert. Veröffentlichte Wegpunkte/Hops sind eigene eingefrorene Kopien.
Fehlerhafte Kandidaten ersetzen vorhandene Geometrie nicht; der vorherige Stand wird
**gegen die neue Eingabe** geprüft und als `retained` oder `stale` markiert. Ohne
Vorgänger darf ein ungültiger Kandidat nur als sichtbare Diagnose erscheinen.
Fehlende Wege einer verwalteten Generation werden nicht durch Einzelrouten ergänzt.

Zustände: pending, routing, valid, optimized, partial, retained, invalid, stale, error.
`partial` bedeutet Arbeitsbudget erreicht, nicht „teilweise gültig“: ein erfolgreicher
Teiloptimierungsstand muss vollständig validiert sein. Identische Eingaben werden
nicht erneut optimiert; die reine Optimierungsfunktion startet immer vom kanonischen
Initialpass, sodass wiederholte Klicks kein schrittweises Qualitätsratchet erzeugen.

## Grenzen

Kein Optimalitätsbeweis, kein vollständiger Korridorplaner, kein allgemeiner
Wegpunkteditor. Locks werden unterstützt; zusätzliche freie manuelle Wegpunkt-Constraints
wurden nicht eingeführt. Basis- und Domänenabstandsprüfung, Labels und tatsächliche
SVG-Rundungs-/Hop-Flächen benötigen weitere Vereinheitlichung. Der Worker entkoppelt
Berechnung; er macht schwierige Pläne nicht automatisch lösbar oder schneller.
