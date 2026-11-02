import { describe, expect, it } from 'vitest';

import { TEMPLATE_KASTENWAGEN } from '../components/planner/templates';
import { verifyPlan } from '../lib/verify/pipeline';
import type { PlannerProjectContent } from './projectFile';
import {
  buildShareUrl,
  decodeSharePlan,
  encodeSharePlan,
  SHARE_HASH_MAX_LENGTH,
  shareValueFromHash,
} from './sharePlan';

const PLAN: PlannerProjectContent = {
  viewMode: 'electric',
  season: 'summer',
  nodes: TEMPLATE_KASTENWAGEN.nodes as PlannerProjectContent['nodes'],
  edges: TEMPLATE_KASTENWAGEN.edges as PlannerProjectContent['edges'],
  waterNodes: [],
  waterEdges: [],
};

describe('Plan-Link teilen (#plan=)', () => {
  it('überlebt die Runde Kodieren → Dekodieren ohne Server', async () => {
    const hash = `#${await encodeSharePlan(PLAN)}`;
    const result = await decodeSharePlan(hash);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.nodes.map((node) => node.id)).toEqual(PLAN.nodes.map((node) => node.id));
    expect(result.plan.edges.map((edge) => edge.id)).toEqual(PLAN.edges.map((edge) => edge.id));
    expect(result.plan.viewMode).toBe('electric');
  });

  it('baut eine vollständige Adresse und ersetzt einen alten Hash', async () => {
    const url = await buildShareUrl(PLAN, 'https://12v-planer.de/planer/#plan=alt');
    expect(url.startsWith('https://12v-planer.de/planer/#plan=')).toBe(true);
    expect(url).not.toContain('plan=alt');
    await expect(decodeSharePlan(new URL(url).hash)).resolves.toMatchObject({ ok: true });
  });

  it('komprimiert sichtbar kürzer als der reine JSON-Text', async () => {
    const value = shareValueFromHash(`#${await encodeSharePlan(PLAN)}`);
    expect(value).not.toBeNull();
    expect(value!.length).toBeLessThan(JSON.stringify(PLAN).length);
  });

  it('lehnt beschädigte und fremde Hashes mit Grund ab statt still zu scheitern', async () => {
    await expect(decodeSharePlan('#plan=z.kaputt!!!')).resolves.toMatchObject({ ok: false });
    await expect(decodeSharePlan('#plan=x.unbekannt')).resolves.toMatchObject({ ok: false });
    await expect(decodeSharePlan('#anderes=1')).resolves.toMatchObject({ ok: false });
    await expect(decodeSharePlan('')).resolves.toMatchObject({ ok: false });

    const truncated = `#${(await encodeSharePlan(PLAN)).slice(0, 40)}`;
    await expect(decodeSharePlan(truncated)).resolves.toMatchObject({ ok: false });
  });

  it('K3: ein manipulierter Link mit solar-1.data.watts = -5 crasht weder Decoder noch Prüf-Engine', async () => {
    const poisoned: PlannerProjectContent = {
      ...PLAN,
      nodes: PLAN.nodes.map((node) =>
        node.id === 'solar-1' ? { ...node, data: { ...node.data, watts: -5 } } : node
      ),
    };
    const hash = `#${await encodeSharePlan(poisoned)}`;
    const decoded = await decodeSharePlan(hash);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const solar = decoded.plan.nodes.find((n) => n.id === 'solar-1');
    expect(solar?.data).not.toHaveProperty('watts');
    expect(decoded.warnings.join(' ')).toMatch(/solar-1/);
    expect(() => verifyPlan({ nodes: decoded.plan.nodes, edges: decoded.plan.edges })).not.toThrow();
    expect(() => verifyPlan({ nodes: poisoned.nodes, edges: poisoned.edges })).not.toThrow();
  });

  it('N9: prüft SHARE_HASH_MAX_LENGTH bereits beim Erzeugen des Links', async () => {
    const oversizedLabel = Array.from({ length: SHARE_HASH_MAX_LENGTH + 5000 }, (_, i) =>
      String.fromCharCode(65 + ((i * 7 + ((i >> 3) ^ (i * 13))) % 26))
    ).join('');
    const hugePlan: PlannerProjectContent = {
      ...PLAN,
      nodes: Array.from({ length: 40 }, (_, idx) => ({
        id: `n-${idx}`,
        type: 'consumer',
        position: { x: idx * 10, y: idx * 10 },
        data: { label: `${idx}-${oversizedLabel.slice(idx * 1500, (idx + 1) * 1500)}` },
      })) as PlannerProjectContent['nodes'],
      edges: [],
    };
    // Mit unkomprimiertem Pfad garantiert über der Grenze; auch falls CompressionStream aktiv ist,
    // testen wir zusätzlich mit temporär deaktiviertem CompressionStream.
    const originalCompression = globalThis.CompressionStream;
    try {
      // @ts-expect-error Simulation einer Umgebung ohne CompressionStream bzw. nicht weiter komprimierbarer Nutzlast
      delete globalThis.CompressionStream;
      await expect(encodeSharePlan(hugePlan)).rejects.toThrow(/zu groß/);
    } finally {
      if (originalCompression) globalThis.CompressionStream = originalCompression;
    }
  });
});
