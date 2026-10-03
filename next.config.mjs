// @ts-check
/**
 * Statischer Export für GitHub Pages (ADR 0001).
 *
 * ENDUNG NICHT AUF `.ts` ÄNDERN UND `basePath` NICHT IN KURZSCHREIBWEISE —
 * Befund vom 2026-10-03:
 *
 * Die Pipeline lässt `actions/configure-pages` (Schritt „Pages konfigurieren")
 * diese Datei patchen. Die Action kennt nur die Endungen `.js`, `.cjs` und
 * `.mjs` (SUPPORTED_FILE_EXTENSIONS). Bei einer `next.config.ts` legt sie eine
 * eigene `next.config.js` an — und Next lädt `next.config.js` VOR
 * `next.config.ts` (CONFIG_FILES in `next/dist/shared/lib/constants`). Der
 * Build lief damit ohne `trailingSlash: true`: Der Export lag flach als
 * `x.html` vor, während Sitemap, Canonicals und interne Verweise `/x/`
 * ankündigten. Auf GitHub Pages beantwortet die flache Auslieferung diese
 * Adressen mit 404 — alle 20 Unterseiten waren nicht erreichbar, alle Läufe
 * blieben grün (die Export-Prüfung akzeptierte die flache Datei auch für die
 * Adresse mit Schrägstrich und sah in dieser Form nur noch die Startseite).
 *
 * Zwei Regeln halten den Befund fern:
 *  1. Die Endung bleibt im JS-Bereich (`.js`, `.cjs`, `.mjs`), damit gar keine
 *     Schattenkopie entsteht, die diese Datei verdrängen kann.
 *  2. `basePath` steht in Paarform (`basePath: basePath`), nicht als
 *     Kurzschreibweise. Der Patch der Action ersetzt den Wertknoten; bei
 *     `basePath,` trifft er den Schlüssel selbst und erzeugte `"/Camp",` — die
 *     Datei wäre ungültig, der Build bräche ab. Dasselbe gilt für `output` und
 *     `images.unoptimized`, die die Action ebenfalls ersetzt.
 * `scripts/ci/workflows.test.ts` hält beide Regeln fest.
 *
 * Empfohlene Härtung (erfordert Workflow-Rechte): den Eingang
 * `static_site_generator: next` in `.github/workflows/deploy.yml` entfernen.
 * Die Action liefert dann nur noch Basis-Pfad und `GITHUB_PAGES`
 * (`if (staticSiteGenerator) …` in src/index.js) und patcht nichts mehr.
 * Diese Datei trägt den Basis-Pfad selbst und funktioniert in beiden Fällen.
 *
 * Der Export wird formtreu geprüft: `exportFileCandidates` in
 * `scripts/seo/checks.ts` verlangt für angekündigte Adressen mit Schrägstrich
 * die Verzeichnisform (`x/index.html`) — die Prüfung, die den Befund fängt.
 *
 * Die Typbindung steht als JSDoc am Objekt: `npm run typecheck` prüft diese
 * Datei über `tsconfig.typecheck.json` mit `// @ts-check` gegen `NextConfig`.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig = /** @type {import('next').NextConfig} */ ({
  output: 'export',
  // Paarform mit Absicht — siehe Kopfkommentar (Patch von configure-pages).
  basePath: basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  // Verzeichnisform der Adressen (`/camper-elektrik/kabelquerschnitt/`).
  // Sitemap, Canonicals und die Verweise der Inhalte nutzen diese Form;
  // ohne die Option liefert der Export `x.html` und die Adressen laufen ins
  // Leere. Der Export wird je Adresse gegen diese Form geprüft
  // (scripts/seo/auditExport.ts, „sitemap-ziel" und „verweis-ohne-ziel").
  trailingSlash: true,
  // Nur im Development relevant (für Sandbox-Previews). Im Produktions-Build
  // hat diese Option keine Wirkung und Wildcards gehören nicht committet.
  ...(process.env.NODE_ENV !== 'production' ? { allowedDevOrigins: ['*.e2b.app', 'localhost'] } : {}),
  images: {
    unoptimized: true,
  },
});

export default nextConfig;
