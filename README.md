# Werft — Camper-Ausbau-Werkstatt

Statische Next.js-App für 12V-Schaltpläne, Dachplanung, Heizlast und VDE-Hinweise.

## Qualitäts-Checks

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Statisches Hosting

Die Produktionskonfiguration nutzt `output: 'export'` und ist für GitHub Pages
vorbereitet (`next.config.ts`, `.github/workflows/deploy.yml`).

Die App benötigt kein Backend — alle Daten werden lokal im Browser gespeichert.

## Daten im Browser

Planstand und Einstellungen werden mit Zustand `persist` im localStorage
gespeichert. Beide Stores verwenden Versionierung und defensive Migrations-
Funktionen, damit ältere Stände nach Schema-Änderungen keine Laufzeitfehler
erzeugen.
