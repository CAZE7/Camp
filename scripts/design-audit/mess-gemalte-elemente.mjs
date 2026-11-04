import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Was malt das Produkt wirklich — Leitungen, Legende, Flächen, Kontraste.
 *
 * Dieser Lauf fragt keine CSS-Datei ab. Er liest computed styles der gemalten
 * SVG-Pfade und mischt die Rückenfarbe aus der Layer-Kette, weil genau das
 * zweimal zu falschen Befunden geführt hat: ein grep auf `^\.dark` übersah den
 * Selektor-Listeneingang `.dark,` und ein Kontrast rechnete gegen die Seiten-
 * statt gegen die Zeichenfläche.
 *
 * Nutzung:  node scripts/design-audit/mess-gemalte-elemente.mjs <name>
 * Output:   scripts/design-audit/ergebnis/gemalte-elemente-<name>.json
 */

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/design-audit/mess-gemalte-elemente.mjs <name>');
  process.exit(1);
}
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3123';
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ergebnis');

const browser = await chromium.launch();
const erg = {};

for (const schema of ['light', 'dark']) {
  const ctx = await browser.newContext({ colorScheme: schema, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/planer/?template=kastenwagen`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.react-flow__edge', { timeout: 30_000 });
  await page.waitForTimeout(2500);

  erg[schema] = await page.evaluate(async () => {
    await document.fonts.ready;

    const zerlege = (wert) => {
      const m = (wert || '').match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const teil = m[1]
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number);
      return { r: teil[0] ?? 0, g: teil[1] ?? 0, b: teil[2] ?? 0, a: teil.length > 3 ? (teil[3] ?? 1) : 1 };
    };
    const hex = (wert) => {
      const p = zerlege(wert);
      if (!p || p.a < 0.02) return null;
      const zwei = (n) => Math.round(n).toString(16).padStart(2, '0');
      return `#${zwei(p.r)}${zwei(p.g)}${zwei(p.b)}`;
    };

    // Alpha aller Ebenen von der Wurzel zum Element überblenden. Wer nur die
    // nächste undurchsichtige Fläche nähme, verglich Leitungen mit der Seite
    // statt mit der Zeichenfläche.
    const rueckenseite = (el) => {
      const schichten = [];
      for (let n = el; n; n = n.parentElement) {
        const p = zerlege(getComputedStyle(n).backgroundColor);
        if (p && p.a > 0) {
          schichten.push(p);
          if (p.a >= 0.999) break;
        }
      }
      if (schichten.length === 0) return '#ffffff';
      let out = { r: 255, g: 255, b: 255, a: 0 };
      for (let i = schichten.length - 1; i >= 0; i--) {
        const l = schichten[i];
        const a = l.a + out.a * (1 - l.a);
        out = {
          r: (l.r * l.a + out.r * out.a * (1 - l.a)) / a,
          g: (l.g * l.a + out.g * out.a * (1 - l.a)) / a,
          b: (l.b * l.a + out.b * out.a * (1 - l.a)) / a,
          a,
        };
      }
      return `#${[out.r, out.g, out.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    };

    const leitungen = new Map();
    document.querySelectorAll('.react-flow__edge path').forEach((p) => {
      const s = getComputedStyle(p);
      const farbe = hex(s.stroke);
      // Trefferflächen und Glow-Halos malen mit Alpha 0 — sie sind keine
      // sichtbare Leitung und dürfen nicht als Kontrastfall zählen.
      if (!farbe) return;
      if (parseFloat(s.strokeWidth) < 0.4) return;
      const key = `${farbe}|${s.strokeWidth}|${s.strokeDasharray}`;
      leitungen.set(key, (leitungen.get(key) ?? 0) + 1);
    });

    const knoten = document.querySelector('.react-flow__node');

    return {
      leitungen: [...leitungen.entries()].map(([key, anzahl]) => {
        const [farbe, breite, strich] = key.split('|');
        return { farbe, breite, strich, anzahl };
      }),
      legende: [...document.querySelectorAll('.cad-routing-legend__row')].map((row) => {
        const pfad = row.querySelector('path');
        return {
          label: row.textContent?.trim() ?? '',
          stroke: pfad ? hex(getComputedStyle(pfad).stroke) : null,
          rueckenseite: rueckenseite(row),
        };
      }),
      zeichenflaeche: hex(getComputedStyle(document.querySelector('.react-flow')).backgroundColor),
      zeichenflaecheContainer: hex(getComputedStyle(document.querySelector('.de-canvas')).backgroundColor),
      seitenflaeche: hex(getComputedStyle(document.body).backgroundColor),
      knotenText: knoten
        ? [...knoten.querySelectorAll('*')]
            .filter((e) => e.children.length === 0 && (e.textContent ?? '').trim().length > 2)
            .slice(0, 3)
            .map((e) => {
              const s = getComputedStyle(e);
              return {
                text: (e.textContent ?? '').trim().slice(0, 24),
                farbe: hex(s.color),
                groesse: s.fontSize,
                rueckenseite: rueckenseite(e),
              };
            })
        : [],
    };
  });
  await ctx.close();
}
await browser.close();

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const luminanz = (h) =>
  rgb(h)
    .map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((acc, anteil, i) => acc + [0.2126, 0.7152, 0.0722][i] * anteil, 0);
const kontrast = (a, b) => {
  const x = luminanz(a);
  const y = luminanz(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const selbst = kontrast('#000000', '#ffffff');
console.log(`Selbsttest Kontrast #000000 auf #ffffff = ${selbst.toFixed(2)} (Soll 21.00)`);
if (Math.abs(selbst - 21) > 0.01) {
  console.error('Kontrastformel selbstgeprüft und falsch — Ausgabe verworfen.');
  process.exit(1);
}

for (const schema of ['light', 'dark']) {
  const r = erg[schema];
  console.log(`\n=== ${schema.toUpperCase()} — Planer, Autarker Kastenwagen ===`);
  console.log(
    `Zeichenfläche ${r.zeichenflaeche} | Container ${r.zeichenflaecheContainer} | Seite ${r.seitenflaeche}`
  );
  console.log('\nGemalte Leitungen:');
  for (const l of r.leitungen) {
    const verhaeltnis = kontrast(l.farbe, r.zeichenflaeche).toFixed(2);
    console.log(`  ${l.farbe}  ${l.breite}  ${l.strich}  x${l.anzahl}  → ${verhaeltnis}:1 auf Zeichenfläche`);
    l.kontrastZeichenflaeche = Number(verhaeltnis);
  }
  console.log('\nLegende gegen gemalte Kanten:');
  const kanten = new Set(r.leitungen.map((l) => l.farbe));
  for (const e of r.legende) {
    const gleich = kanten.has(e.stroke);
    console.log(
      `  ${e.label.padEnd(20)} ${e.stroke}  ${kontrast(e.stroke, e.rueckenseite).toFixed(2)}:1 auf ${e.rueckenseite}  ${
        gleich ? 'stimmt mit Kante überein' : 'ANDERS als Kante'
      }`
    );
    e.stimmtMitKante = gleich;
  }
  console.log('\nKnotentext:');
  for (const t of r.knotenText) {
    console.log(
      `  "${t.text}" ${t.farbe} ${t.groesse} → ${kontrast(t.farbe, t.rueckenseite).toFixed(2)}:1 auf ${t.rueckenseite}`
    );
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const datei = path.join(OUT_DIR, `gemalte-elemente-${name}.json`);
fs.writeFileSync(
  datei,
  JSON.stringify({ erfasst: new Date().toISOString(), base: BASE, selbstdtest: selbst, erg }, null, 1)
);
console.log(`\ngeschrieben: ${path.relative(process.cwd(), datei)}`);
