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

Wichtig: Ein statischer Export kann keine Next.js-API-Routen ausliefern. Der
eingebaute Chat-Endpunkt `app/api/chat/route.ts` existiert zwar für eine
Node/Edge-Laufzeit, im `out/`-Export aber **nicht**. Deshalb ist der
Chat-Client über Umgebungsvariablen konfigurierbar:

- `NEXT_PUBLIC_CHAT_API` — absolute oder pfadbezogene URL des Chat-Backends.
  Beispiele: `https://api.example.com/chat` oder `/Camp/api/chat`.
- `NEXT_PUBLIC_CHAT_ENABLED=false` — blendet den KI-Assistenten aus, wenn
  in einer statischen Veröffentlichung kein Backend angebunden ist.

Ohne `NEXT_PUBLIC_CHAT_API` deaktiviert der Client Eingabe und Senden und zeigt
eine ehrliche Hinweiskarte statt einer kryptischen Netzwerkfehler-Meldung.

## Daten im Browser

Planstand und Einstellungen werden mit Zustand `persist` im localStorage
gespeichert. Beide Stores verwenden Versionierung und defensive Migrations-
Funktionen, damit ältere Stände nach Schema-Änderungen keine Laufzeitfehler
erzeugen.
