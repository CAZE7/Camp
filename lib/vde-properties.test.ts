import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Node } from 'reactflow';
import {
  VDE_SIZES,
  VDE_AMPACITY,
  FUSE_MAP,
  DERATE_FACTOR,
  calculateMaxFuse,
  calculateCrossSection,
  lookupThermalCrossSection,
  selectFuseSize,
  isFuseFeasible,
  getEdgeDomain,
  getHandleDomain,
} from './electrical';
import { calculateVoltageDrop, calculateMinCrossSection, getSystemVoltage } from './vde-standards';
import { performAutoWiring } from './autoWire';
import { amps, meters, mm2, volts } from './units';

/**
 * lib/vde-properties.test.ts — Property-Based Tests der VDE-Logik (AGENTS.md K2).
 *
 * Warum zusätzlich zu den Beispieltests?
 * ======================================
 * Die vorhandenen Tests in `electrical.test.ts`, `vde-standards.test.ts` und
 * `autoWire.test.ts` prüfen konkrete Fälle ("20 A auf 5 m ergibt 6 mm²").
 * Sie können nicht zeigen, dass eine *Regel* über den ganzen Eingaberaum gilt.
 * Genau das leisten die folgenden Gesetze — jedes mit 1.000 zufälligen Läufen
 * aus realistischen Wertebereichen und deterministischem Seed.
 *
 * Die Gesetze
 * ===========
 *  G1  Sicherungs-Sandwich: Laststrom ≤ Sicherung ≤ Kabelgrenze (FUSE_MAP).
 *  G2  Monotonie der Sicherungsauswahl: mehr Strom ⇒ nie kleinere Sicherung.
 *  G3  Monotonie des Spannungsfalls: mehr Länge ⇒ nie kleinerer Abfall.
 *  G4  Monotonie der Querschnittsauswahl: mehr Strom ⇒ nie kleinerer Querschnitt.
 *  G5  Idempotenz: performAutoWiring(performAutoWiring(x)) == performAutoWiring(x).
 *  G6  AC/DC-Trennung: keine erzeugte Verbindung mischt die Domänen.
 *
 * Reproduzierbarkeit
 * ==================
 * `fc.configureGlobal` setzt `seed`/`numRuns` fest. Ein Gegenbeispiel ist
 * damit exakt wiederholbar; gefundene Fälle wandern zusätzlich als
 * Regressionstest ans Ende dieser Datei (Abschnitt "Shrinking-Anker").
 */

const RUNS = 1_000;
const SEED = 20260821;

const propertyConfig = { numRuns: RUNS, seed: SEED, verbose: false } as const;

// ── Generatoren mit realistischen Wertebereichen ────────────────────────────

/** Strom, wie er im Camper vorkommt: 0.1 A (LED) bis 250 A (Wechselrichter). */
const currentA = fc.double({ min: 0.1, max: 250, noNaN: true, noDefaultInfinity: true });

/** Leitungslänge im Fahrzeug: 0.1 m (Batterie→Shunt) bis 15 m (Heck→Front). */
const lengthM = fc.double({ min: 0.1, max: 15, noNaN: true, noDefaultInfinity: true });

/** Normquerschnitt aus der VDE-Reihe. */
const crossSection = fc.constantFrom(...VDE_SIZES);

/** Verbraucherleistung: 5 W (USB) bis 3000 W (Induktionsfeld). */
const wattage = fc.integer({ min: 5, max: 3000 });

/** Systemspannungen, die der Planer kennt. */
const systemVoltage = fc.constantFrom(12, 12.8, 24);

describe('G1 — Sicherungs-Sandwich (Laststrom ≤ Sicherung ≤ Kabelgrenze)', () => {
  it('hält die Sandwich-Bedingung, solange das Kabel den Strom tragen kann', () => {
    fc.assert(
      fc.property(currentA, crossSection, (current, section) => {
        const maxFuse = calculateMaxFuse(section);
        const fuse = selectFuseSize(current, section);

        if (isFuseFeasible(current, section)) {
          // Untere Kante: die Sicherung muss den Nennstrom tragen.
          expect(fuse).toBeGreaterThanOrEqual(Math.ceil(current) === 0 ? 1 : Math.ceil(current) - 1);
          expect(fuse).toBeGreaterThanOrEqual(current - 1);
          // Obere Kante: die Sicherung darf das Kabel nie überfordern.
          expect(fuse).toBeLessThanOrEqual(maxFuse);
        } else {
          // Kein zulässiger Wert vorhanden → niemals über das Kabelmaximum
          // hinaus absichern. Der Rückgabewert signalisiert "Kabel zu dünn".
          expect(fuse).toBe(maxFuse);
          expect(fuse).toBeLessThan(Math.ceil(current));
        }
      }),
      propertyConfig
    );
  });

  it('wählt niemals eine Sicherung über der Kabelgrenze — auch nicht bei Extremströmen', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 5_000, noNaN: true, noDefaultInfinity: true }),
        crossSection,
        (current, section) => {
          expect(selectFuseSize(current, section)).toBeLessThanOrEqual(FUSE_MAP[section]);
        }
      ),
      propertyConfig
    );
  });

  it('die Kabelgrenze selbst bleibt unter der derateten Strombelastbarkeit', () => {
    for (const section of VDE_SIZES) {
      expect(FUSE_MAP[section]).toBeLessThanOrEqual(VDE_AMPACITY[section]);
    }
  });
});

describe('G2 — Monotonie der Sicherungsauswahl', () => {
  it('mehr Strom ergibt bei gleichem Querschnitt nie eine kleinere Sicherung', () => {
    fc.assert(
      fc.property(currentA, currentA, crossSection, (a, b, section) => {
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        expect(selectFuseSize(high, section)).toBeGreaterThanOrEqual(selectFuseSize(low, section));
      }),
      propertyConfig
    );
  });

  it('mehr Querschnitt erlaubt bei gleichem Strom nie eine kleinere Sicherung', () => {
    fc.assert(
      fc.property(currentA, crossSection, crossSection, (current, s1, s2) => {
        const small = Math.min(s1, s2);
        const large = Math.max(s1, s2);
        expect(selectFuseSize(current, large)).toBeGreaterThanOrEqual(
          selectFuseSize(current, small)
        );
      }),
      propertyConfig
    );
  });
});

describe('G3 — Monotonie des Spannungsfalls', () => {
  it('längere Leitung ⇒ nie kleinerer Spannungsfall', () => {
    fc.assert(
      fc.property(currentA, lengthM, lengthM, crossSection, (current, l1, l2, section) => {
        const shortDrop = calculateVoltageDrop(
          amps(current),
          meters(Math.min(l1, l2)),
          mm2(section)
        );
        const longDrop = calculateVoltageDrop(
          amps(current),
          meters(Math.max(l1, l2)),
          mm2(section)
        );
        expect(longDrop).toBeGreaterThanOrEqual(shortDrop);
      }),
      propertyConfig
    );
  });

  it('größerer Querschnitt ⇒ nie größerer Spannungsfall', () => {
    fc.assert(
      fc.property(currentA, lengthM, crossSection, crossSection, (current, length, s1, s2) => {
        const thin = calculateVoltageDrop(amps(current), meters(length), mm2(Math.min(s1, s2)));
        const thick = calculateVoltageDrop(amps(current), meters(length), mm2(Math.max(s1, s2)));
        expect(thick).toBeLessThanOrEqual(thin);
      }),
      propertyConfig
    );
  });

  it('der Spannungsfall ist proportional zum Strom (Linearität)', () => {
    fc.assert(
      fc.property(
        currentA,
        fc.double({ min: 1, max: 4, noNaN: true, noDefaultInfinity: true }),
        lengthM,
        crossSection,
        (current, factor, length, section) => {
          const single = calculateVoltageDrop(amps(current), meters(length), mm2(section));
          const scaled = calculateVoltageDrop(amps(current * factor), meters(length), mm2(section));
          expect(scaled).toBeCloseTo(single * factor, 6);
        }
      ),
      propertyConfig
    );
  });

  it('der Mindestquerschnitt wächst monoton mit Strom und Länge', () => {
    fc.assert(
      fc.property(currentA, currentA, lengthM, (a, b, length) => {
        const low = calculateMinCrossSection(amps(Math.min(a, b)), meters(length));
        const high = calculateMinCrossSection(amps(Math.max(a, b)), meters(length));
        expect(high).toBeGreaterThanOrEqual(low);
      }),
      propertyConfig
    );
  });
});

describe('G4 — Monotonie der Querschnittsauswahl', () => {
  it('mehr Strom ⇒ nie kleinerer thermischer Querschnitt', () => {
    fc.assert(
      fc.property(currentA, currentA, (a, b) => {
        const low = lookupThermalCrossSection(Math.min(a, b));
        const high = lookupThermalCrossSection(Math.max(a, b));
        expect(high).toBeGreaterThanOrEqual(low);
      }),
      propertyConfig
    );
  });

  it('mehr Strom ⇒ nie kleinerer Gesamtquerschnitt (thermisch + Spannungsfall)', () => {
    fc.assert(
      fc.property(currentA, currentA, lengthM, (a, b, length) => {
        const low = calculateCrossSection(Math.min(a, b), length);
        const high = calculateCrossSection(Math.max(a, b), length);
        expect(high).toBeGreaterThanOrEqual(low);
      }),
      propertyConfig
    );
  });

  it('das Ergebnis ist immer ein Wert der VDE-Normreihe', () => {
    fc.assert(
      fc.property(currentA, lengthM, (current, length) => {
        expect(VDE_SIZES).toContain(calculateCrossSection(current, length));
      }),
      propertyConfig
    );
  });

  it('der thermische Querschnitt trägt den Strom inklusive Derating', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 120, noNaN: true, noDefaultInfinity: true }),
        (current) => {
          const section = lookupThermalCrossSection(current);
          // Größter Querschnitt ist die Obergrenze: darüber kann die Reihe
          // den Strom nicht mehr abdecken, das meldet die Validierung separat.
          if (section < VDE_SIZES[VDE_SIZES.length - 1]) {
            expect(VDE_AMPACITY[section] * DERATE_FACTOR).toBeGreaterThanOrEqual(current - 1e-9);
          }
        }
      ),
      propertyConfig
    );
  });
});

// ── Generator für kleine, aber realistische Pläne ───────────────────────────

type NodeSpec = { type: string; data: Record<string, unknown> };

const nodeSpec: fc.Arbitrary<NodeSpec> = fc.oneof(
  fc.record({ type: fc.constant('consumer'), data: fc.record({ watts: wattage }) }),
  fc.record({ type: fc.constant('consumer230v'), data: fc.record({ watts: wattage }) }),
  fc.record({
    type: fc.constant('inverter'),
    data: fc.record({ watts: fc.integer({ min: 300, max: 3000 }) }),
  }),
  fc.record({
    type: fc.constant('solar'),
    data: fc.record({ watts: fc.integer({ min: 50, max: 600 }) }),
  }),
  fc.record({
    type: fc.constant('mpptController'),
    data: fc.record({ amps: fc.integer({ min: 10, max: 60 }) }),
  }),
  fc.record({
    type: fc.constant('dcdcCharger'),
    data: fc.record({ amps: fc.integer({ min: 10, max: 60 }) }),
  }),
  fc.record({ type: fc.constant('shorePower'), data: fc.record({ hasRcd: fc.boolean() }) }),
  fc.record({ type: fc.constant('ground'), data: fc.constant({}) })
);

/**
 * Plan MIT vorhandenen Nutzer-Kanten.
 *
 * Ohne diesen Generator blieb ein ganzer Zweig von `performAutoWiring`
 * ungetestet (`isAcEdge`, `healUserEdges`, Dimensionierung fremder Kanten).
 * Ein absichtlich eingebauter Fehler in `isAcEdge` wurde von der ersten
 * Fassung der Gesetze NICHT gefunden — deshalb gibt es ihn.
 */
const planWithUserEdgesArbitrary = fc
  .tuple(
    fc.record({
      capacity: fc.integer({ min: 50, max: 400 }),
      chemistry: fc.constantFrom('LiFePO4', 'AGM', 'GEL'),
    }),
    fc.array(nodeSpec, { minLength: 1, maxLength: 5 }),
    fc.array(
      fc.record({
        from: fc.nat({ max: 5 }),
        to: fc.nat({ max: 5 }),
        handle: fc.constantFrom('plus', 'minus'),
        length: fc.double({ min: 0.2, max: 10, noNaN: true, noDefaultInfinity: true }),
        // Bewusst auch `false`: alte gespeicherte Pläne und Vorlagen
        // enthalten Kanten ohne Domänen-Markierung. Ist sie gesetzt, dann
        // mit dem Wert, den der Store beim Verbinden schreiben würde —
        // eine widersprüchliche Markierung kann im Produkt nicht entstehen
        // (siehe Regressionstest "widersprüchliche Markierung").
        marked: fc.boolean(),
      }),
      { minLength: 0, maxLength: 4 }
    )
  )
  .map(([batteryData, specs, edgeSpecs]) => {
    const nodes: Node[] = [
      {
        id: 'battery-1',
        type: 'battery',
        position: { x: 0, y: 0 },
        data: { label: 'Aufbaubatterie', ...batteryData },
      } as Node,
    ];
    specs.forEach((spec, index) => {
      nodes.push({
        id: `${spec.type}-${index}`,
        type: spec.type,
        position: { x: 200 * (index + 1), y: 120 * (index % 3) },
        data: { label: `${spec.type} ${index}`, ...spec.data },
      } as Node);
    });

    const edges = edgeSpecs
      .map((spec, index) => {
        const source = nodes[spec.from % nodes.length];
        const target = nodes[spec.to % nodes.length];
        if (source.id === target.id) return null;
        // Die UI lässt nur domänenreine Verbindungen zu
        // (usePlannerStore.isValidConnection). Der Generator bildet exakt
        // das ab — sonst würden Pläne erzeugt, die im Produkt gar nicht
        // entstehen können, und das Gesetz träfe eine falsche Annahme.
        if (
          getHandleDomain(source.type, spec.handle, 'source') !==
          getHandleDomain(target.type, spec.handle, 'target')
        ) {
          return null;
        }
        return {
          id: `user-${index}`,
          source: source.id,
          target: target.id,
          sourceHandle: spec.handle,
          targetHandle: spec.handle,
          type: 'cableEdge',
          data: {
            length: spec.length,
            edgeDomain: spec.marked
              ? getEdgeDomain(source.type, target.type, spec.handle, spec.handle)
              : undefined,
          },
        };
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

    return { nodes, edges };
  });

const planArbitrary = fc
  .tuple(
    fc.record({
      capacity: fc.integer({ min: 50, max: 400 }),
      chemistry: fc.constantFrom('LiFePO4', 'AGM', 'GEL'),
      nominalVoltage: fc.constantFrom(12, 12.8, undefined),
    }),
    fc.array(nodeSpec, { minLength: 0, maxLength: 6 })
  )
  .map(([batteryData, specs]) => {
    const nodes: Node[] = [
      {
        id: 'battery-1',
        type: 'battery',
        position: { x: 0, y: 0 },
        data: { label: 'Aufbaubatterie', ...batteryData },
      } as Node,
    ];
    specs.forEach((spec, index) => {
      nodes.push({
        id: `${spec.type}-${index}`,
        type: spec.type,
        position: { x: 200 * (index + 1), y: 120 * (index % 3) },
        data: { label: `${spec.type} ${index}`, ...spec.data },
      } as Node);
    });
    return nodes;
  });

/** Vergleichbare Signatur eines Verdrahtungsergebnisses. */
function signature(result: { nodes: Node[]; edges: ReturnType<typeof performAutoWiring> extends null ? never : { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null; data?: { crossSection?: number; fuseSize?: number; length?: number; edgeDomain?: string } }[] }) {
  return {
    nodeTypes: result.nodes
      .map((node) => `${node.type}`)
      .sort()
      .join('|'),
    edges: result.edges
      .map(
        (edge) =>
          `${edge.source}>${edge.target}#${edge.sourceHandle ?? ''}/${edge.targetHandle ?? ''}` +
          `@${edge.data?.crossSection ?? '-'}:${edge.data?.fuseSize ?? '-'}:${edge.data?.edgeDomain ?? '-'}`
      )
      .sort()
      .join('|'),
  };
}

describe('G5 — Idempotenz von performAutoWiring', () => {
  it('ein zweiter Lauf ändert weder Knoten noch Kanten', () => {
    fc.assert(
      fc.property(planArbitrary, (nodes) => {
        const first = performAutoWiring(nodes);
        expect(first).not.toBeNull();
        const second = performAutoWiring(first!.nodes, first!.edges);
        expect(second).not.toBeNull();

        expect(second!.nodes.length).toBe(first!.nodes.length);
        expect(second!.edges.length).toBe(first!.edges.length);
        expect(signature(second!)).toEqual(signature(first!));
      }),
      { ...propertyConfig, numRuns: RUNS }
    );
  });

  it('ein dritter Lauf ist ebenfalls stabil (kein langsames Driften)', () => {
    fc.assert(
      fc.property(planArbitrary, (nodes) => {
        const first = performAutoWiring(nodes)!;
        const second = performAutoWiring(first.nodes, first.edges)!;
        const third = performAutoWiring(second.nodes, second.edges)!;
        expect(signature(third)).toEqual(signature(second));
      }),
      { ...propertyConfig, numRuns: 200 }
    );
  });
});

describe('G6 — AC/DC-Trennung jeder erzeugten Verbindung', () => {
  const AC_ONLY_TYPES = new Set(['shorePower', 'consumer230v', 'acBatteryCharger']);
  const DC_ONLY_TYPES = new Set([
    'battery',
    'busbar',
    'shunt',
    'fuse',
    'consumer',
    'solar',
    'roofSolar',
    'mpptController',
    'dcdcCharger',
    'ground',
  ]);

  it('keine Kante verbindet einen reinen AC-Knoten mit einem reinen DC-Knoten', () => {
    fc.assert(
      fc.property(planArbitrary, (nodes) => {
        const result = performAutoWiring(nodes);
        if (result === null) return;
        const byId = new Map(result.nodes.map((node) => [node.id, node]));

        for (const edge of result.edges) {
          const source = byId.get(edge.source);
          const target = byId.get(edge.target);
          expect(source, `Quelle ${edge.source} fehlt`).toBeDefined();
          expect(target, `Ziel ${edge.target} fehlt`).toBeDefined();

          const sourceIsAc = AC_ONLY_TYPES.has(source!.type as string);
          const targetIsAc = AC_ONLY_TYPES.has(target!.type as string);
          const sourceIsDc = DC_ONLY_TYPES.has(source!.type as string);
          const targetIsDc = DC_ONLY_TYPES.has(target!.type as string);

          expect(
            (sourceIsAc && targetIsDc) || (targetIsAc && sourceIsDc),
            `Domänenmischung: ${source!.type} → ${target!.type}`
          ).toBe(false);
        }
      }),
      propertyConfig
    );
  });

  it('die Domänenmarkierung passt zur Domäne der Endpunkte', () => {
    fc.assert(
      fc.property(planArbitrary, (nodes) => {
        const result = performAutoWiring(nodes);
        if (result === null) return;
        const byId = new Map(result.nodes.map((node) => [node.id, node]));

        for (const edge of result.edges) {
          const source = byId.get(edge.source);
          const target = byId.get(edge.target);
          const domain =
            edge.data?.edgeDomain ??
            getEdgeDomain(source?.type, target?.type, edge.sourceHandle, edge.targetHandle);

          if (domain === 'DC_12V') {
            expect(AC_ONLY_TYPES.has(source!.type as string)).toBe(false);
            expect(AC_ONLY_TYPES.has(target!.type as string)).toBe(false);
          } else {
            // Eine AC-Kante muss mindestens einen AC-fähigen Endpunkt haben.
            const acCapable = (type: string | undefined): boolean =>
              AC_ONLY_TYPES.has(type as string) || type === 'inverter';
            expect(acCapable(source?.type) || acCapable(target?.type)).toBe(true);
          }
        }
      }),
      propertyConfig
    );
  });

  it('auch mit vorhandenen Nutzer-Kanten mischt keine erzeugte Kante die Domänen', () => {
    fc.assert(
      fc.property(planWithUserEdgesArbitrary, ({ nodes, edges }) => {
        const result = performAutoWiring(nodes, edges as never);
        if (result === null) return;
        const byId = new Map(result.nodes.map((node) => [node.id, node]));

        for (const edge of result.edges) {
          // Nur selbst erzeugte Kanten: was der Nutzer gezeichnet hat, darf
          // Auto-Wire nicht stillschweigend umdeuten oder löschen.
          if (!edge.id.startsWith('e-auto-')) continue;
          const source = byId.get(edge.source)!;
          const target = byId.get(edge.target)!;
          const sourceIsAc = AC_ONLY_TYPES.has(source.type as string);
          const targetIsAc = AC_ONLY_TYPES.has(target.type as string);
          const sourceIsDc = DC_ONLY_TYPES.has(source.type as string);
          const targetIsDc = DC_ONLY_TYPES.has(target.type as string);
          expect(
            (sourceIsAc && targetIsDc) || (targetIsAc && sourceIsDc),
            `Domänenmischung: ${source.type} → ${target.type}`
          ).toBe(false);
        }
      }),
      propertyConfig
    );
  });

  it('jede Kante ist nach der Verdrahtung dimensioniert (kein Kabel ohne Querschnitt)', () => {
    fc.assert(
      fc.property(planWithUserEdgesArbitrary, ({ nodes, edges }) => {
        const result = performAutoWiring(nodes, edges as never);
        if (result === null) return;
        for (const edge of result.edges) {
          const section = edge.data?.crossSection;
          expect(
            section,
            `Kante ${edge.id} (${edge.source}→${edge.target}) ohne Querschnitt`
          ).toBeDefined();
          expect(section).toBeGreaterThanOrEqual(1.5);
          expect(VDE_SIZES).toContain(section);
        }
      }),
      propertyConfig
    );
  });

  it('jede Kante trägt nach der Verdrahtung eine Domänen-Markierung', () => {
    fc.assert(
      fc.property(planWithUserEdgesArbitrary, ({ nodes, edges }) => {
        const result = performAutoWiring(nodes, edges as never);
        if (result === null) return;
        for (const edge of result.edges) {
          const byId = new Map(result.nodes.map((node) => [node.id, node]));
          const source = byId.get(edge.source);
          const target = byId.get(edge.target);
          const touchesAc =
            AC_ONLY_TYPES.has(source?.type as string) || AC_ONLY_TYPES.has(target?.type as string);
          if (touchesAc) {
            expect(edge.data?.edgeDomain, `Kante ${edge.id} ohne AC-Markierung`).toBe('AC_230V');
          }
        }
      }),
      propertyConfig
    );
  });

  it('DC-Kanten verbinden gleichnamige Pole (plus↔plus, minus↔minus)', () => {
    fc.assert(
      fc.property(planArbitrary, (nodes) => {
        const result = performAutoWiring(nodes);
        if (result === null) return;
        for (const edge of result.edges) {
          if (edge.data?.edgeDomain !== 'DC_12V') continue;
          if (!edge.id.startsWith('e-auto-')) continue;
          const source = edge.sourceHandle ?? '';
          const target = edge.targetHandle ?? '';
          expect(source.includes('plus')).toBe(target.includes('plus'));
          expect(source.includes('minus')).toBe(target.includes('minus'));
        }
      }),
      propertyConfig
    );
  });
});

describe('Systemspannung — Eigenschaften statt Einzelfälle', () => {
  it('liefert für jeden Plan eine positive, endliche Spannung', () => {
    fc.assert(
      fc.property(planArbitrary, (nodes) => {
        const voltage = getSystemVoltage(nodes);
        expect(Number.isFinite(voltage)).toBe(true);
        expect(voltage).toBeGreaterThan(0);
        expect(voltage).toBeLessThanOrEqual(60);
      }),
      propertyConfig
    );
  });

  it('ist unabhängig von der Reihenfolge der Knoten', () => {
    fc.assert(
      fc.property(planArbitrary, (nodes) => {
        const reversed = [...nodes].reverse();
        expect(getSystemVoltage(reversed)).toBe(getSystemVoltage(nodes));
      }),
      propertyConfig
    );
  });

  it('akzeptiert nur Spannungen, die auch als Volts konstruierbar sind', () => {
    fc.assert(
      fc.property(systemVoltage, (value) => {
        expect(volts(value)).toBe(value);
      }),
      propertyConfig
    );
  });
});

/**
 * Shrinking-Anker — konkrete Gegenbeispiele
 * =========================================
 * Jeder Fall hier wurde von fast-check als *geshrinkter* Gegenbeispiel-Input
 * gemeldet. Zwei Quellen:
 *
 *   (a) Mutationsproben: um zu belegen, dass die Gesetze überhaupt Zähne
 *       haben, wurde die Produktionslogik testweise verfälscht. Die dabei
 *       gemeldeten Gegenbeispiele bleiben als klassische Beispieltests
 *       erhalten (Dokumentation in docs/PROPERTY-TESTS.md).
 *   (b) Ein echter Fund: eine 230-V-Nutzer-Kante ohne Domänen-Markierung
 *       blieb ohne Querschnitt. Der Fehler wurde in lib/autoWire.ts behoben,
 *       der Fall bleibt als Regressionstest.
 */
describe('Shrinking-Anker (gemeldete Gegenbeispiele)', () => {
  it('(a) 16.000000000000004 A auf 1.5 mm²: Sicherung bleibt bei 16 A', () => {
    // fast-check, Seed 20260821 → Counterexample: [16.000000000000004, 1.5]
    // Gemeldet, als selectFuseSize testweise ohne Obergrenze suchte.
    // Der Gleitkommawert liegt minimal über FUSE_MAP[1.5] = 16 A; die
    // Auswahl darf trotzdem nicht auf 20 A springen — das Kabel wäre
    // ungeschützt.
    const current = 16.000000000000004;
    expect(selectFuseSize(current, 1.5)).toBe(16);
    expect(selectFuseSize(current, 1.5)).toBeLessThanOrEqual(FUSE_MAP[1.5]);
    expect(isFuseFeasible(current, 1.5)).toBe(false);
  });

  it('(a) 1.044 A vs. 48.72 A auf 15 m: mehr Strom ergibt nie weniger Querschnitt', () => {
    // fast-check → Counterexample: [1.044000000000002, 48.72000000000009, 15]
    // Gemeldet, als der Fallback von calculateCrossSection testweise auf den
    // kleinsten statt den größten Querschnitt zeigte.
    const small = calculateCrossSection(1.044000000000002, 15);
    const large = calculateCrossSection(48.72000000000009, 15);
    expect(large).toBeGreaterThanOrEqual(small);
    expect(VDE_SIZES).toContain(large);
  });

  it('(a) Landstrom + 230-V-Gerät ohne Wechselrichter: AC-Kante bleibt AC', () => {
    // fast-check → Counterexample: shorePower-0 → consumer230v-1, edgeDomain
    // undefined. Gemeldet, als isAcEdge testweise immer false lieferte:
    // die 230-V-Leitung wäre als 12-V-Leitung dimensioniert worden.
    const nodes: Node[] = [
      { id: 'battery-1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Aufbau', capacity: 50 } } as Node,
      { id: 'shore-0', type: 'shorePower', position: { x: 200, y: 0 }, data: { label: 'Landstrom', hasRcd: false } } as Node,
      { id: 'c230-1', type: 'consumer230v', position: { x: 400, y: 120 }, data: { label: 'Gerät', watts: 5 } } as Node,
    ];
    const userEdge = {
      id: 'user-0',
      source: 'shore-0',
      target: 'c230-1',
      sourceHandle: 'plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 0.2 },
    };
    const result = performAutoWiring(nodes, [userEdge] as never)!;
    const edge = result.edges.find((candidate) => candidate.id === 'user-0')!;
    expect(edge.data?.edgeDomain).toBe('AC_230V');
  });

  it('(b) echter Fund: 230-V-Nutzer-Kante wird dimensioniert statt übersprungen', () => {
    // Vor dem Fix: { length: 3 } — kein Querschnitt, keine Domäne. Die Kante
    // fiel zwischen DC-Dimensionierung (isAcEdge = true) und AC-Dimensionierung
    // (kein edgeDomain-Marker) hindurch.
    const nodes: Node[] = [
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Aufbau', capacity: 100 } } as Node,
      { id: 'sp1', type: 'shorePower', position: { x: 300, y: 0 }, data: { label: 'Landstrom' } } as Node,
      { id: 'c230', type: 'consumer230v', position: { x: 600, y: 0 }, data: { label: 'Kochfeld', watts: 2000 } } as Node,
    ];
    const userEdge = {
      id: 'user-1',
      source: 'sp1',
      target: 'c230',
      sourceHandle: 'plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3 },
    };
    const result = performAutoWiring(nodes, [userEdge] as never)!;
    const edge = result.edges.find((candidate) => candidate.id === 'user-1')!;
    expect(edge.data?.edgeDomain).toBe('AC_230V');
    expect(edge.data?.crossSection).toBeGreaterThanOrEqual(1.5);
    expect(VDE_SIZES).toContain(edge.data?.crossSection);
    // Länge des Nutzers bleibt erhalten — Auto-Wire überschreibt sie nicht.
    expect(edge.data?.length).toBe(3);
  });

  it('bekannte Grenze: eine widersprüchliche Markierung gewinnt gegen die Topologie', () => {
    // Dokumentierter Ist-Zustand, KEIN gewünschtes Verhalten: eine Kante
    // zwischen zwei 230-V-Geräten mit gespeichertem edgeDomain 'DC_12V' wird
    // als DC dimensioniert. Über die UI ist dieser Zustand nicht erreichbar
    // (usePlannerStore.isValidConnection + getEdgeDomain), er kann nur aus
    // beschädigten oder manuell importierten Daten stammen.
    const nodes: Node[] = [
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Aufbau', capacity: 100 } } as Node,
      { id: 'x1', type: 'consumer230v', position: { x: 200, y: 0 }, data: { label: 'A', watts: 5 } } as Node,
      { id: 'x2', type: 'consumer230v', position: { x: 400, y: 0 }, data: { label: 'B', watts: 5 } } as Node,
    ];
    const corrupted = {
      id: 'user-0',
      source: 'x1',
      target: 'x2',
      sourceHandle: 'plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 0.2, edgeDomain: 'DC_12V' },
    };
    const result = performAutoWiring(nodes, [corrupted] as never)!;
    const edge = result.edges.find((candidate) => candidate.id === 'user-0')!;
    expect(edge.data?.edgeDomain).toBe('DC_12V');
    // Wichtig: die Kante bleibt trotzdem dimensioniert — kein Kabel ohne
    // Querschnitt, egal wie kaputt die Eingabe ist.
    expect(edge.data?.crossSection).toBeGreaterThanOrEqual(1.5);
  });

  it('Grenzfälle der Normreihe bleiben stabil', () => {
    expect(isFuseFeasible(200, 70)).toBe(false);
    expect(selectFuseSize(200, 70)).toBe(FUSE_MAP[70]);
    expect(selectFuseSize(0.1, 1.5)).toBe(5);
    expect(selectFuseSize(16, 1.5)).toBe(16);
    expect(calculateCrossSection(0, 5)).toBe(1.5);
    expect(lookupThermalCrossSection(0)).toBe(1.5);
  });
});
