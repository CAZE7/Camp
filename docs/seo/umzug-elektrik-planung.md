# Umzug: `/elektrik-planung/` → `/camper-elektrik/`

**Stand: 2026-10-16 · Bezug: `elektroplaner-camper.de`**

## Was passiert ist

Die Seite `/elektrik-planung/` war zwei Dinge an einer Adresse: eine Wissensseite
mit Rechner, Normgrundlagen und Absicherung — und der Einstieg in den
Elektroplaner. Der Planer ist seit dem Umzug auf `/planer/` (eigene
Anwendungsroute, volles Browserfenster). Übrig geblieben war die Wissensseite,
und die trug eine Adresse, die nach einer Werkstatt klang statt nach dem
Thema.

Der Inhalt ist deshalb nach `/camper-elektrik/` gewandert — der Pillar-Seite
des Themas. Dort steht jetzt alles an einem Ort:

| vorher `/elektrik-planung/`        | jetzt `/camper-elektrik/`                                                |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Kabelquerschnitt-Rechner           | Abschnitt „Kabelquerschnitt und Absicherung berechnen“                   |
| Formel + Variablen A/L/I/κ/ΔU      | Abschnitt „Leitungen: der Spannungsfall entscheidet …“                   |
| Tabelle Belastbarkeit (1,5–70 mm²) | dieselbe Tabelle, vollständige Normreihe                                 |
| Batteriekapazität (DoD, Peukert)   | Abschnitt „Batterie: nutzbar ist nicht gleich nominell“                  |
| „Absicherung und Normen“           | Abschnitte „Absicherung …“ und „Normen, auf die sich das Modell bezieht“ |
| Fragen und Antworten (4)           | im Fragenblock der Pillar-Seite (7)                                      |

Die alte Adresse bleibt als kurzer Übergang stehen: `noindex, follow`,
Canonical auf `/camper-elektrik/`, Meta-Refresh dorthin, ein sichtbarer
Verweis. Damit fällt keine alte Verlinkung ins Leere, und Suchmaschinen
führen die alte Adresse nicht weiter als eigene Seite.

## Was der Export nicht leisten kann

GitHub Pages liefert statische Dateien aus. Eine echte **301-Weiterleitung**
(dauerhaft, statuskodierend) ist dort nicht möglich:

- `next.config.mjs` nutzt `output: 'export'`. Next.js-Weiterleitungen
  (`redirects()`) benötigen einen Server und sind im statischen Export
  deshalb nicht verfügbar.
- Der Meta-Refresh im Stub ist eine **Browser**-Weiterleitung: Sie hält die
  Adresse in der Adresszeile, zählt nicht als Weiterleitung und wird von
  Suchmaschinen uneinheitlich behandelt.
- `noindex` auf der alten Adresse verhindert, dass sie im Index bleibt — sie
  ersetzt aber keine Umleitung. Verlinkungen, die nicht umgeleitet werden,
  verlieren ihren Übergabewert.

**Die dauerhafte Umleitung muss deshalb in der Auslieferung eingerichtet
werden** — je nach Hosting eine 301-Regel, eine Cloudflare-Redirect-Regel
oder ein `CNAME`-Setup mit Weiterleitung. Zwei Wege sind üblich:

### Weg A: Cloudflare (empfohlen, wenn Cloudflare vor dem Pages-Deployment steht)

1. Cloudflare → **Rules** → **Redirect Rules** → **Create rule**.
2. Bedingung: _Incoming requests_ → _Custom filter_ →
   `http.request.uri.path eq "/elektrik-planung/"`.
3. Ziel: **Single redirect**, Typ **301 (Permanent)**, URL
   `https://elektroplaner-camper.de/camper-elektrik/`.
4. Für den Pfad ohne Schrägstrich dieselbe Regel mit
   `http.request.uri.path eq "/elektrik-planung"` anlegen (GitHub Pages
   liefert beide Formen aus).

### Weg B: Eigener Host / Reverse Proxy

In der Serverkonfiguration eine 301-Regel für beide Pfadformen hinterlegen:

```nginx
location = /elektrik-planung  { return 301 https://elektroplaner-camper.de/camper-elektrik/; }
location = /elektrik-planung/ { return 301 https://elektroplaner-camper.de/camper-elektrik/; }
```

## Prüfen

Nach dem Einrichten:

```bash
curl -I https://elektroplaner-camper.de/elektrik-planung/     # 301 + Location
curl -I https://elektroplaner-camper.de/elektrik-planung      # 301 + Location
curl -I https://elektroplaner-camper.de/camper-elektrik/      # 200
```

In den Suchmaschinen-Konsolen (Google Search Console, Bing Webmaster) die
Adresse als „Umleitung“ einreichen bzw. „Beziehung verschieben“ melden. Der
Inhalt selbst ist bereits auf der neuen Adresse; nach dem 301 genügt die
Meldung, damit die Umstellung schneller verarbeitet wird.

## Stand im Repository

- Inventar: `/elektrik-planung/` steht als `noindex`-Ansicht mit
  `canonicalPath: '/camper-elektrik/'` (`lib/seo/inventory.ts`).
- Kopfdaten: Canonical und `og:url` zeigen auf das Ziel
  (`app/siteMetadata.ts`, `app/seoMetadata.ts`).
- Stub: `app/elektrik-planung/page.tsx`.
- Linkgraph: `PLANNER_PATH` zeigt auf `/camper-elektrik/`
  (`scripts/seo/linkGraph.ts`).
- Sitemap: Die alte Adresse steht nicht mehr darin (nur indexierbare Seiten
  werden geführt).
