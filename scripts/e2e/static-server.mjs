#!/usr/bin/env node
/**
 * scripts/e2e/static-server.mjs
 *
 * Minimaler statischer Server für den Next.js Static Export (`./out`).
 *
 * Warum kein `serve`/`http-server`? Weil die E2E-Tests genau das ausliefern
 * sollen, was auf GitHub Pages landet — ohne zusätzliche Abhängigkeit und
 * ohne Rewrite-Magie, die es dort nicht gibt. Dieser Server kann bewusst nur:
 *
 *   - Datei ausliefern, wenn sie existiert
 *   - `/pfad/` → `/pfad/index.html` (trailingSlash: true in next.config.ts)
 *   - `/pfad`  → 308 auf `/pfad/` (wie GitHub Pages)
 *   - sonst 404 mit `out/404.html`
 *
 * Aufruf: node scripts/e2e/static-server.mjs [port] [verzeichnis]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const root = resolve(process.argv[3] ?? 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** Verhindert Pfad-Ausbruch (`../../etc/passwd`). */
function safeJoin(base, target) {
  const candidate = normalize(join(base, target));
  if (candidate !== base && !candidate.startsWith(base + sep)) return null;
  return candidate;
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'cache-control': 'no-store', ...headers });
  response.end(body);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);

  const target = safeJoin(root, pathname);
  if (!target) {
    send(response, 403, 'Forbidden', { 'content-type': 'text/plain' });
    return;
  }

  let file = target;
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) {
      send(response, 308, '', { location: `${pathname}/${url.search}` });
      return;
    }
    file = join(file, 'index.html');
  } else if (!existsSync(file) && existsSync(`${file}.html`)) {
    file = `${file}.html`;
  }

  // Fallback für GitHub Actions / GitHub Pages `basePath` (z. B. `/Camp/_next/...` -> `/_next/...`):
  // Wenn die Datei mit Prefix nicht existiert, den ersten Pfad-Segment streichen.
  // Nur bei >= 2 Segmenten: Ein einzelnes Segment (z. B. `/gibt-es-nicht/`) ist
  // eine unbekannte Route und muss den 404-Pfad nehmen, nicht die Wurzel treffen.
  const segments = pathname.slice(1).split('/').filter(Boolean);
  if (!existsSync(file) && segments.length >= 2) {
    const strippedPathname = '/' + pathname.slice(1).split('/').slice(1).join('/');
    const strippedTarget = safeJoin(root, strippedPathname);
    if (strippedTarget) {
      let candidate = strippedTarget;
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        if (strippedPathname.endsWith('/')) {
          candidate = join(candidate, 'index.html');
        }
      } else if (!existsSync(candidate) && existsSync(`${candidate}.html`)) {
        candidate = `${candidate}.html`;
      }
      if (existsSync(candidate) && !statSync(candidate).isDirectory()) {
        file = candidate;
      }
    }
  }

  if (!existsSync(file) || statSync(file).isDirectory()) {
    const notFound = join(root, '404.html');
    if (existsSync(notFound)) {
      response.writeHead(404, { 'content-type': MIME['.html'] });
      createReadStream(notFound).pipe(response);
      return;
    }
    send(response, 404, 'Not Found', { 'content-type': 'text/plain' });
    return;
  }

  response.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Static export served from ${root} on http://0.0.0.0:${port}`);
});
