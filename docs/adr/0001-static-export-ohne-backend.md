# ADR 0001 — Static Export ohne Backend

**Status:** angenommen · **Datum:** 2026-08 (nachträglich dokumentiert)

## Kontext

Der Planer verarbeitet ausschließlich Daten, die der Nutzer selbst eingibt:
Bauteile, Leitungslängen, Querschnitte. Es gibt keine Konten, keine geteilten
Pläne, keine serverseitige Berechnung. Betrieben wird die Anwendung auf
GitHub Pages.

## Entscheidung

`output: 'export'` in `next.config.ts`. Die Anwendung wird zu statischem
HTML/JS/CSS gebaut und ohne Server ausgeliefert. Der Planstand liegt im
`localStorage` (Zustand `persist`, Schlüssel `werft-planner-v1`, versioniert
mit Migrationsfunktion).

## Konsequenzen

**Gut**
- Kein Server, keine Betriebskosten, keine Angriffsfläche durch eine API.
- Keine personenbezogenen Daten verlassen das Gerät.
- Der Build ist das Artefakt: was getestet wurde, wird ausgeliefert
  (die E2E-Tests laufen genau gegen `./out`).

**Schlecht / Preis**
- Keine Server-Features: keine Route-Handler, kein `/api/*`, keine
  Bildoptimierung (`images.unoptimized: true`).
- Kein geräteübergreifender Abgleich. Ein gelöschter Browser-Speicher
  bedeutet einen verlorenen Plan.
- Schema-Änderungen am Planstand brauchen zwingend eine Migration, sonst
  brechen alte gespeicherte Stände.

## Alternativen

- **Server-Rendering mit Datenbank:** löst den Abgleich, erzeugt aber
  Betriebsaufwand und Datenschutzpflichten für einen Nutzen, den bisher
  niemand angefragt hat.
- **Export/Import als Datei:** deckt den Umzug zwischen Geräten ohne Server
  ab. Bild-Export existiert; ein Plan-Export als JSON ist die naheliegende
  Erweiterung.
