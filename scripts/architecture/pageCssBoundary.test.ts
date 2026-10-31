import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * G7 der Vergleichs-Spec (`docs/superpowers/specs/2026-10-26-…-design.md`).
 *
 * Der Ladebooster-Vergleich trug eine eigene Stylesheet-Datei
 * (`app/ladebooster-vergleich.css`, 19.846 Byte) und wurde über
 * `app/layout.tsx` eingebunden — also auf JEDE Seite der Auslieferung geladen,
 * obwohl ihn genau eine brauchte. Seine Klassen (`lb-intro`, `lb-ladder`,
 * `lb-crate`, …) waren ein zweites, paralleles Stylesystem neben den Tokens.
 *
 * Drei Regeln halten den Zustand fest, statt ihn nur einmal herzustellen:
 *   1. In `app/` liegen nur die zwei erlaubten Stylesheets.
 *   2. Das Wurzel-Layout bindet nur `globals.css` und Schriften ein.
 *   3. Keine `lb-*`-Klasse überlebt irgendwo im Produktivcode.
 *
 * Die Ausnahmeliste ist bewusst klein und benannt. Eine globale Regel
 * „keine CSS-Datei" wäre falsch: `dark-engineering.css` gehört zur internen
 * Design-System-Ansicht und wird dort geladen, nicht im Wurzel-Layout.
 */

// Vorstriche auch unter Windows: `listFiles` normalisiert die gefundenen Pfade
// dorthin, und ein Vergleich gegen einen Rückstrich-Wurzelwert würde nie treffen.
const ROOT = process.cwd().replace(/\\/g, '/');

/** Stylesheets, die in `app/` liegen dürfen — mit Begründung. */
const ERLAUBTE_STYLESHEETS: Readonly<Record<string, string>> = {
  'app/globals.css': 'Tokens und Utilities der ganzen Auslieferung.',
  'app/dark-engineering.css': 'Interne Design-System-Ansicht (/design-system/, noindex).',
};

/** Seiten-CSS des Vergleichs — die Datei darf nicht zurückkommen. */
const VERBOTENE_DATEI = 'app/ladebooster-vergleich.css';

/** Klassenpräfix des alten Vergleichs. */
const ALT_KLASSE = /\blb-[a-z]/;

function listFiles(dir: string, muster: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      listFiles(full, muster, out);
    } else if (muster.test(entry) && !/\.(test|spec|stories)\.[jt]sx?$/.test(entry)) {
      out.push(full.replace(/\\/g, '/'));
    }
  }
  return out;
}

const relativ = (datei: string) => datei.slice(ROOT.length + 1);

describe('G7 — keine Seiten-CSS und kein zweites Klassensystem', () => {
  it('hält in app/ nur die benannten Stylesheets', () => {
    const gefunden = listFiles(resolve(ROOT, 'app'), /\.css$/)
      .map(relativ)
      .sort();
    const erlaubt = Object.keys(ERLAUBTE_STYLESHEETS).sort();
    expect(
      gefunden,
      `unerlaubte Stylesheets: ${gefunden.filter((f) => !erlaubt.includes(f)).join(', ')}`
    ).toEqual(erlaubt);
  });

  it('hat die Seiten-CSS des Vergleichs nicht zurückgeholt', () => {
    expect(existsSync(resolve(ROOT, VERBOTENE_DATEI)), `${VERBOTENE_DATEI} existiert wieder`).toBe(false);
  });

  it('bindet im Wurzel-Layout nur globals.css und Schriften ein', () => {
    const quelle = readFileSync(resolve(ROOT, 'app/layout.tsx'), 'utf8');
    const importe = [...quelle.matchAll(/^import\s+['"]([^'"]+\.css)['"]/gm)].map((treffer) => treffer[1]!);

    // Ohne Treffer wäre ein umbenannter Import ein grünes Gate.
    expect(importe.length).toBeGreaterThan(0);
    expect(importe).toContain('./globals.css');
    const fremde = importe.filter((ziel) => ziel !== './globals.css' && !ziel.startsWith('@fontsource'));
    expect(fremde, `Layout bindet Seiten-CSS ein: ${fremde.join(', ')}`).toEqual([]);
  });

  it('nennt keine lb-*-Klasse im Produktivcode', () => {
    const treffer: string[] = [];
    for (const wurzel of ['app', 'components', 'lib', 'store']) {
      for (const datei of listFiles(resolve(ROOT, wurzel), /\.[jt]sx?$/)) {
        const quelle = readFileSync(datei, 'utf8');
        const fund = ALT_KLASSE.exec(quelle)?.[0];
        if (fund) treffer.push(`${relativ(datei)}: ${fund}`);
      }
    }
    expect(treffer, treffer.join('\n')).toEqual([]);
  });
});
