# ADR 0038: Zweischichtige Security-Headers und CSP für Static Hosting

- **Status:** Angenommen
- **Datum:** 2026-10-23
- **Bezug:** `AGENTS.md` M11-7, Audit N11, `app/layout.tsx`, `public/_headers`

## Kontext

Die Anwendung wird als statischer Export (`output: 'export'` in `next.config.mjs`, ADR 0001) ausgeliefert — primär über GitHub Pages, optional über statische Edge-Hosts (Cloudflare Pages / Netlify).

GitHub Pages unterstützt keine frei konfigurierbaren HTTP-Response-Header pro Repository. Gleichzeitig verarbeitet der Planer komplexe URL-Fragmente (`#plan=`), Projektdatei-Importe (`.json`), Web-Worker (`elkjs`), lokalen PNG-Export (`html-to-image` mit `data:`- und `blob:`-URLs) sowie Inline-Theme-Hydration ohne Flash (`app/layout.tsx`).

## Entscheidung

Wir setzen eine zweischichtige Strategie ein, die ohne Backend-Server sowohl auf GitHub Pages als auch auf Header-fähigen Static-Hosts greift:

1. **HTML-Dokumentebene (`app/layout.tsx`) — wirksam auf jedem Static-Host inkl. GitHub Pages:**
   - `<meta http-equiv="Content-Security-Policy">` beschränkt Ressourcen strikt auf `'self'` (mit `data:`/`blob:` für PNG-Export und Web-Worker, `https:` für optionale externe KI-Endpunkte nach ADR 0021 sowie `'unsafe-inline'` für Next.js-Static-Hydrationsskripte und React-Inline-Stile; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`).
   - `metadata.referrer = 'strict-origin-when-cross-origin'` erzeugt `<meta name="referrer" content="strict-origin-when-cross-origin">`.
   - `frame-ancestors` steht **bewusst nicht** im `<meta>`-Element, da die CSP-Spezifikation (W3C CSP3 §6.2.1) `frame-ancestors` in `<meta>`-Elementen ignoriert und Browser dazu eine Konsolenwarnung ausgeben.

2. **HTTP-Header-Manifest (`public/_headers`) — wirksam auf Cloudflare Pages, Netlify und kompatiblen CDNs:**
   - Setzt `Content-Security-Policy` inklusive `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` und `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

## Konsequenzen

- **Positiv:** Jede ausgelieferte HTML-Seite im statischen Export (`out/**/index.html`) bringt ihre CSP- und Referrer-Policy selbst mit; kein externer Script- oder Object-Ursprung kann nachgeladen werden.
- **Grenze auf GitHub Pages:** Reine HTTP-Header (`X-Content-Type-Options`, `X-Frame-Options`, `frame-ancestors`) können auf GitHub Pages technisch erst durch einen vorgelagerten Reverse-Proxy/CDN oder Wechsel auf `public/_headers`-fähiges Hosting erzwungen werden.
