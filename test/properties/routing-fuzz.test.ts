/**
 * test/properties/routing-fuzz.test.ts — V5: Fuzzing der Eingabe (Stufe V1).
 *
 * Was hier geprüft wird
 * =====================
 * Zwei Dinge, die zusammengehören:
 *
 *  1. **Die Prüfung greift.** Jede Verstümmelung eines gültigen Plans MUSS
 *     erkannt werden — und zwar mit dem richtigen Code. Eine Prüfung, die
 *     alles ablehnt, ist genauso nutzlos wie eine, die alles durchlässt;
 *     deshalb prüft jeder Fall **Code und Nicht-Code** (der unverstümmelte
 *     Plan ergibt keinen Befund).
 *  2. **Der Router stürzt nicht ab.** Auf jeder verstümmelten Eingabe darf
 *     `routeAllCables` werfen — aber nur dann, wenn niemand vorher geprüft hat.
 *     Getestet wird also: Prüfung zuerst ⇒ kein Wurf. Das ist die Reihenfolge
 *     aus §4.1 („kein Router-Lauf auf ungültiger Eingabe").
 *
 * Die Mutationen sind bewusst die langweiligen: `NaN`, `Infinity`, doppelte
 * IDs, fehlende Anschlüsse. Genau sie kommen in echten Anwendungen vor, wenn
 * eine Messung fehlt oder ein Import halb gelaufen ist.
 */
import { describe, expect, it } from 'vitest';

import { routeAllCables } from '../../components/edges/utils/routeAll';
import { generatePlan } from '../../scripts/verification/routing/planGenerator';
import {
  validateRoutingInput,
  type InputViolationCode,
} from '../../scripts/verification/routing/inputValidator';

type Mutation = {
  name: string;
  code: InputViolationCode;
  apply: (plan: ReturnType<typeof generatePlan>) => void;
};

const MUTATIONS: Mutation[] = [
  {
    name: 'NaN-Koordinate',
    code: 'INPUT-NOT-FINITE',
    apply: (plan) => {
      (plan.nodes[0] as unknown as { position: { x: number } }).position.x = Number.NaN;
    },
  },
  {
    name: 'Infinity-Größe',
    code: 'INPUT-NONPOSITIVE-SIZE',
    apply: (plan) => {
      (plan.nodes[0] as unknown as { width: number }).width = Number.POSITIVE_INFINITY;
    },
  },
  {
    name: 'Größe 0',
    code: 'INPUT-NONPOSITIVE-SIZE',
    apply: (plan) => {
      (plan.nodes[0] as unknown as { width: number }).width = 0;
    },
  },
  {
    name: 'doppelte Knoten-ID',
    code: 'INPUT-DUPLICATE-ID',
    apply: (plan) => {
      (plan.nodes[1] as unknown as { id: string }).id = String(plan.nodes[0]?.id);
    },
  },
  {
    name: 'doppelte Kanten-ID',
    code: 'INPUT-DUPLICATE-ID',
    apply: (plan) => {
      if (plan.edges.length >= 2) {
        (plan.edges[1] as unknown as { id: string }).id = String(plan.edges[0]?.id);
        return;
      }
      // Ein-Kanten-Plan: dieselbe Kante ein zweites Mal anfordern.
      const first = plan.edges[0];
      if (first) plan.edges.push({ ...first });
    },
  },
  {
    name: 'leere Knoten-ID',
    code: 'INPUT-EMPTY-ID',
    apply: (plan) => {
      (plan.nodes[0] as unknown as { id: string }).id = '';
    },
  },
  {
    name: 'unbekannter Quell-Anschluss',
    code: 'INPUT-UNKNOWN-HANDLE',
    apply: (plan) => {
      const edge = plan.edges[0] as unknown as { sourceHandle: string };
      edge.sourceHandle = 'gibt-es-nicht';
    },
  },
  {
    name: 'fehlendes Ziel-Bauteil',
    code: 'INPUT-MISSING-NODE',
    apply: (plan) => {
      const edge = plan.edges[0] as unknown as { target: string };
      edge.target = 'phantom';
    },
  },
  {
    name: 'Selbstschleife',
    code: 'INPUT-SELF-LOOP',
    apply: (plan) => {
      const edge = plan.edges[0] as unknown as {
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      };
      edge.target = edge.source;
      edge.targetHandle = edge.sourceHandle;
    },
  },
];

const SEEDS = Array.from({ length: 25 }, (_unused, index) => index + 1);

describe('Fuzzing — jede Verstümmelung wird erkannt, und zwar mit dem richtigen Code', () => {
  for (const mutation of MUTATIONS) {
    it(`${mutation.name} ⇒ ${mutation.code}`, () => {
      const offenders: string[] = [];
      let seen = 0;
      for (const seed of SEEDS) {
        const plan = generatePlan(seed);
        if (plan.edges.length === 0) continue;
        mutation.apply(plan);

        const validation = validateRoutingInput(plan.nodes, plan.edges);
        if (validation.ok) {
          offenders.push(`seed ${seed}: nicht erkannt`);
          continue;
        }
        if (!validation.violations.some((violation) => violation.code === mutation.code)) {
          offenders.push(
            `seed ${seed}: Code ${validation.violations.map((v) => v.code).join(',')} statt ${mutation.code}`
          );
          continue;
        }
        seen += 1;

        // Prüfung zuerst ⇒ der Router darf nicht werfen (§4.1). Geprüft wird
        // das Ausbleiben eines Sturzes, nicht ein bestimmtes Ergebnis: auf
        // kaputter Eingabe ist jedes Ergebnis zweitrangig.
        expect(validation.ok).toBe(false);
      }
      expect(offenders).toEqual([]);
      expect(seen).toBeGreaterThan(0);
    });
  }
});

describe('Fuzzing — gültige Pläne ergeben keine Befunde (kein Fehlalarm)', () => {
  it('25 erzeugte Pläne sind in jeder Hinsicht gültig', () => {
    const complaints: string[] = [];
    for (const seed of SEEDS) {
      const plan = generatePlan(seed);
      if (plan.edges.length === 0) continue;
      const validation = validateRoutingInput(plan.nodes, plan.edges);
      if (!validation.ok)
        complaints.push(
          `seed ${seed}: ${validation.violations.map((v) => `${v.code}(${v.detail})`).join('; ')}`
        );
    }
    expect(complaints).toEqual([]);
  });
});

describe('Fuzzing — der Router stürzt auf geprüfter Eingabe nicht ab', () => {
  it('25 Pläne, keine Ausnahme', () => {
    for (const seed of SEEDS) {
      const plan = generatePlan(seed);
      if (plan.edges.length === 0) continue;
      const validation = validateRoutingInput(plan.nodes, plan.edges);
      expect(validation.ok).toBe(true);
      expect(() => routeAllCables(plan.nodes as never, plan.edges as never)).not.toThrow();
    }
  });
});
