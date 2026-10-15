import { describe, expect, it } from 'vitest';

import { TEMPLATE_KASTENWAGEN } from '../components/planner/templates';
import type { PlannerProjectContent } from './projectFile';
import { buildShareUrl, decodeSharePlan, encodeSharePlan, shareValueFromHash } from './sharePlan';

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
    const url = await buildShareUrl(PLAN, 'https://elektroplaner-camper.de/planer/#plan=alt');
    expect(url.startsWith('https://elektroplaner-camper.de/planer/#plan=')).toBe(true);
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
});
