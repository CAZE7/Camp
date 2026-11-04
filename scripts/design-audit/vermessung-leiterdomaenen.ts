import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';

import { PIPE_COLORS, WIRE_COLORS, getWireColor } from '@/components/edges/utils/edgeColors';
import { TEMPLATE_AUTARK, TEMPLATE_KASTENWAGEN, TEMPLATE_MINIMALIST } from '@/components/planner/templates';

/**
 * AP-3 · Vermessung der Leiterdomänen gegen die Statusrollen (Spezifikation §3.3).
 *
 * Die Regel seit §3.3: Statusfarben nie auf der Zeichenfläche, Leiterfarben nie
 * in der Oberfläche. Geprüft wird, was das Produkt ausliefert — über alle
 * Vorlagen und knownPlans hinweg.
 *
 * Zwei Annahmen sind in diesem Lauf bereits zweimal korrigiert worden und
 * stehen deshalb hier, damit niemand sie erneut einbaut:
 *
 *   1. `isPlus` kommt NICHT aus `data.isPlus`. CableEdge.tsx:593 leitet es aus
 *      dem Source-Handle ab (`resolvedSourceHandle.includes('plus')`), und
 *      Handles heißen in den Plänen `plus`/`minus`. Wer data.isPlus liest,
 *      klassifiziert jede Kante als Minus.
 *   2. `edgeDomain` ist in den Plänen oft gar nicht gesetzt; der Default ist
 *      DC_12V.
 *
 * Farben werden über postcss gelesen, nicht per Regex auf `.dark { … }`: der
 * Block enthält verschachtelte Regeln, und `[^}]*` bricht beim ersten
 * `::selection`.
 *
 * Nutzung:  npx tsx scripts/design-audit/vermessung-leiterdomaenen.ts
 * Output:   scripts/design-audit/ergebnis/leiterdomaenen.json
 */

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ergebnis');

interface Farbtabelle {
  [token: string]: { hell: string; dunkel: string };
}

function farbenAusCss(): Farbtabelle {
  const deklariert: Record<'hell' | 'dunkel', Map<string, string>> = {
    hell: new Map(),
    dunkel: new Map(),
  };
  for (const datei of ['app/globals.css', 'app/dark-engineering.css']) {
    const ast = postcss.parse(fs.readFileSync(path.join(WURZEL, datei), 'utf8'), { from: datei });
    ast.walkRules((regel) => {
      const selektoren = regel.selector.split(',').map((s) => s.trim());
      const istHell = selektoren.some((s) => s === ':root' || s.endsWith(':root'));
      const istDunkel = selektoren.some(
        (s) => s === '.dark' || s.endsWith('.dark') || s.includes("data-theme='dark")
      );
      if (!istHell && !istDunkel) return;
      regel.walkDecls((decl) => {
        if (!decl.prop.startsWith('--')) return;
        const name = decl.prop.slice(2);
        if (istHell && !deklariert.hell.has(name)) deklariert.hell.set(name, decl.value.trim());
        if (istDunkel && !deklariert.dunkel.has(name)) deklariert.dunkel.set(name, decl.value.trim());
      });
    });
  }
  const aufloesen = (block: Map<string, string>, name: string, tiefe = 0): string => {
    const wert = block.get(name);
    if (!wert) return '—';
    const alias = wert.match(/^var\(--([\w-]+)\)$/);
    const ziel = alias?.[1];
    if (!ziel) return wert;
    return tiefe > 8 ? wert : aufloesen(block, ziel, tiefe + 1);
  };
  const out: Farbtabelle = {};
  const alle = new Set([...deklariert.hell.keys(), ...deklariert.dunkel.keys()]);
  for (const name of alle)
    out[name] = { hell: aufloesen(deklariert.hell, name), dunkel: aufloesen(deklariert.dunkel, name) };
  return out;
}

const FARBEN = farbenAusCss();
const tokenDer = (cssVar: string): string => cssVar.match(/var\(--([\w-]+)\)/)?.[1] ?? cssVar;

/** Statusrollen der Oberfläche — sie dürfen auf der Zeichenfläche nicht erscheinen. */
const STATUSROLLEN = ['ok', 'warn', 'error', 'oxide', 'destructive', 'success', 'warning'];

interface Plan {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}

const PLAENE: Array<[string, Plan]> = [
  ['vorlage minimalist', TEMPLATE_MINIMALIST as unknown as Plan],
  ['vorlage kastenwagen', TEMPLATE_KASTENWAGEN as unknown as Plan],
  ['vorlage autark', TEMPLATE_AUTARK as unknown as Plan],
];
for (const datei of fs.readdirSync(path.join(WURZEL, 'knownPlans')).filter((f) => f.endsWith('.json'))) {
  const inhalt = JSON.parse(fs.readFileSync(path.join(WURZEL, 'knownPlans', datei), 'utf8'));
  PLAENE.push([`knownPlans/${datei}`, (inhalt.input ?? inhalt) as Plan]);
}

const gezeichnet = new Map<
  string,
  { token: string; hell: string; dunkel: string; kanten: number; plaene: Set<string> }
>();
let fehlerFarbKanten = 0;

for (const [planName, plan] of PLAENE) {
  for (const kante of plan.edges) {
    const daten = (kante.data ?? {}) as Record<string, unknown>;
    const handle = String(kante.sourceHandle ?? kante.targetHandle ?? '');
    const domäne = String(daten.edgeDomain ?? 'DC_12V');
    const isPlus = handle.includes('plus');
    const farbe = getWireColor({ edgeDomain: domäne as never, isPlus });
    const name = tokenDer(farbe);
    const schluessel = `${domäne}/${isPlus ? '+' : '−'}${daten.polarity ? `/${daten.polarity}` : ''}`;
    const eintrag = gezeichnet.get(schluessel) ?? {
      token: `--${name}`,
      hell: FARBEN[name]?.hell ?? '—',
      dunkel: FARBEN[name]?.dunkel ?? '—',
      kanten: 0,
      plaene: new Set<string>(),
    };
    eintrag.kanten += 1;
    eintrag.plaene.add(planName);
    gezeichnet.set(schluessel, eintrag);
  }
}

// Kollision: eine gezeichnete Leiterfarbe == eine Statusrolle der Oberfläche.
const kollisionen: Array<{
  domäne: string;
  token: string;
  rolle: string;
  thema: string;
  hex: string;
  plaene: number;
}> = [];
for (const [domäne, info] of gezeichnet) {
  for (const rolle of STATUSROLLEN) {
    for (const thema of ['hell', 'dunkel'] as const) {
      const status = FARBEN[rolle]?.[thema];
      if (!status || status === '—') continue;
      if (info[thema] === status) {
        kollisionen.push({
          domäne,
          token: info.token,
          rolle: `--${rolle}`,
          thema,
          hex: status,
          plaene: info.plaene.size,
        });
      }
    }
  }
}

// Quelle der Zeichenfläche: Status-Token, die in Edge- oder Node-Quellen als
// Gemälde auftauchen (code-basiert, nicht daten-basiert). Seit §3.4 (Freigabe
// 2026-11-04) ist nicht jede Statusfarbe ein Verstoß, sondern nur die, die eine
// Leitung umfärbt — Halos UNTER der Leitung sind erlaubt. Beides wird getrennt
// gemeldet, sonst liest sich die Ausgabe als offener Befund, der keiner ist.
const quellbefund: Array<{ datei: string; zeile: number; text: string; typ: 'Overlay' | 'Leiterebene' }> = [];
for (const datei of [
  'components/edges/CableEdge.tsx',
  'components/edges/WaterPipeEdge.tsx',
  'components/edges/utils/edgeColors.ts',
]) {
  const text = fs.readFileSync(path.join(WURZEL, datei), 'utf8');
  text.split('\n').forEach((zeile, i) => {
    if (
      /stroke[^;\n]*(var\(--(error|ok|warn|oxide|wire-error|destructive)\)|WIRE_COLORS\.error)/.test(zeile)
    ) {
      const malt = zeile.trim();
      quellbefund.push({
        datei,
        zeile: i + 1,
        text: malt.slice(0, 110),
        // Der Halo sitzt in einem eigenen `<path>` mit `aria-hidden`,
        // `pointerEvents: none` und breiterem Strich unter der Leitung.
        typ: /stroke=\{routeInvalid/.test(malt) ? 'Overlay' : 'Leiterebene',
      });
    }
  });
}

const ergebnis = {
  erfasst: new Date().toISOString(),
  plaene: PLAENE.map(([name, p]) => ({ name, knoten: p.nodes.length, kanten: p.edges.length })),
  gezeichnet: [...gezeichnet.entries()]
    .map(([domäne, info]) => ({
      domäne,
      token: info.token,
      hell: info.hell,
      dunkel: info.dunkel,
      kanten: info.kanten,
      plaene: [...info.plaene],
    }))
    .sort((a, b) => b.kanten - a.kanten),
  kollisionen,
  statusAufZeichenflaeche: quellbefund,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'leiterdomaenen.json'), JSON.stringify(ergebnis, null, 1));

console.log('Gezeichnete Leiterdomänen:');
for (const d of ergebnis.gezeichnet) {
  console.log(
    `  ${d.domäne.padEnd(18)} ${d.token.padEnd(24)} hell ${d.hell.padEnd(9)} dunkel ${d.dunkel.padEnd(9)} ${String(d.kanten).padStart(4)} Kanten in ${d.plaene.length} Plänen`
  );
}
console.log('\nKollisionen mit Statusrollen:');
for (const k of ergebnis.kollisionen) {
  console.log(
    `  ${k.domäne.padEnd(18)} ${k.token.padEnd(24)} == ${k.rolle.padEnd(12)} ${k.thema.padEnd(7)} ${k.hex}  (${k.plaene} Pläne)`
  );
}
console.log('\nStatus-Token, die in Leitungsquellen als Gemälde stehen:');
for (const q of ergebnis.statusAufZeichenflaeche)
  console.log(`  ${q.typ.padEnd(11)} ${q.datei}:${q.zeile}  ${q.text}`);
console.log(`\ngeschrieben: ${path.relative(process.cwd(), path.join(OUT_DIR, 'leiterdomaenen.json'))}`);
