// Zeigt die häufigsten Kontexte DIREKT über classifyCollision.
import { readFileSync, readdirSync } from 'node:fs';

const dir = '/tmp/prof';
const ctx = new Map();
const interval = 1000;

for (const f of readdirSync(dir).filter((x) => x.endsWith('.cpuprofile'))) {
  const prof = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const byId = new Map(prof.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);

  for (const id of prof.samples) {
    const chain = [];
    let cur = id;
    while (cur !== undefined) {
      const n = byId.get(cur);
      if (!n) break;
      const fn = n.callFrame;
      const file = fn.url.replace(/^.*\/Camp\//, '');
      chain.push(`${fn.functionName || '(anon)'}@${file}:${fn.lineNumber}`);
      cur = parent.get(cur);
    }
    const i = chain.findIndex(
      (c) => c.startsWith('classifyCollision@') || c.startsWith('classifySegmentAgainst')
    );
    if (i < 0) continue;
    // 4 Frames oberhalb der Klassifizierung als Kontext
    const key = chain.slice(i, i + 6).join('  ←  ');
    ctx.set(key, (ctx.get(key) ?? 0) + interval);
  }
}

const sorted = [...ctx.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
for (const [k, us] of sorted) console.log(`${(us / 1e6).toFixed(1).padStart(8)} s  ${k}\n`);
