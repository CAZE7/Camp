import { describe, expect, it } from 'vitest';

import { BUILTIN_COMPONENT_SPECS } from '../../components/registry/builtinComponents';

import {
  DECLARED_HANDLES,
  behaviorOf,
  buildConductionGraph,
  carrierFor,
  componentBehavior,
  domainClassFor,
  edgeAcDevices,
  edgeOvercurrentDevice,
  isDeclaredHandle,
  isKnownNodeType,
  labelOfNode,
  loadClassOf,
  neighborsOf,
  nominalVoltageOfCable,
  polarityOfHandle,
  portKey,
  protectionsOf,
} from './graph';
import { fixtureEdge, fixtureNode, healthyDcPlan, houseBattery, plusEdge } from './planFixtures';

describe('lib/verify/graph — Vertrag mit der Bauteil-Registry (ARCH-Regel A)', () => {
  it('deklariert für jedes Registry-Bauteil dessen Handle-Menge', () => {
    const registry = new Map(BUILTIN_COMPONENT_SPECS.map((spec) => [spec.id as string, spec]));
    expect(registry.size).toBeGreaterThan(20);
    for (const [id, spec] of registry) {
      const expected = [...new Set(spec.handles.map((handle) => handle.id))].sort();
      const declared = [...(DECLARED_HANDLES[id] ?? [])].sort();
      expect(declared, `Handles von „${id}“`).toEqual(expected);
    }
  });

  it('führt keine zusätzlichen Bauteiltypen ohne Registry-Gegenstück', () => {
    const registryIds = new Set(BUILTIN_COMPONENT_SPECS.map((spec) => spec.id as string));
    const extra = Object.keys(DECLARED_HANDLES).filter((type) => !registryIds.has(type));
    // Dachplanung hat keine eigenen Registry-Specs (eigener Modus), alles
    // andere MUSS aus der Registry stammen.
    expect(extra.sort()).toEqual(['roofBackground', 'roofSolar', 'roofWindow'].sort());
  });

  it('erkennt deklarierte Handles und unbekannte Bauteiltypen', () => {
    expect(isDeclaredHandle('consumer', 'plus')).toBe(true);
    expect(isDeclaredHandle('consumer', 'banane')).toBe(false);
    expect(isDeclaredHandle('gibtsNicht', 'plus')).toBe(false);
    expect(isKnownNodeType('mpptController')).toBe(true);
    expect(isKnownNodeType('gibtsNicht')).toBe(false);
  });
});

describe('lib/verify/graph — Polarität und Domänenklasse', () => {
  it('liest die Polarität aus Handle, Rolle und Bauteilart', () => {
    expect(polarityOfHandle('battery', 'plus', 'source')).toBe('positive');
    expect(polarityOfHandle('battery', 'minus', 'target')).toBe('negative');
    expect(polarityOfHandle('shorePower', 'plus', 'source')).toBe('line');
    expect(polarityOfHandle('consumer230v', 'plus', 'target')).toBe('line');
    expect(polarityOfHandle('inverter', 'plus', 'source')).toBe('line');
    expect(polarityOfHandle('inverter', 'plus', 'target')).toBe('positive');
    expect(polarityOfHandle('inverter', 'ac_in', 'target')).toBe('line');
    expect(polarityOfHandle('ground', 'PE', 'target')).toBe('protective-earth');
    expect(polarityOfHandle('solar', 'minus', 'source')).toBe('negative');
    expect(polarityOfHandle('freshWaterTank', 'out', 'source')).toBe('none');
    expect(polarityOfHandle('battery', null, 'source')).toBe('none');
    expect(polarityOfHandle('consumer', 'signal', 'target')).toBe('signal');
  });

  it('bildet die Domänen-Autorität auf Gefährdungsklassen ab', () => {
    expect(domainClassFor('battery', 'DC_12V')).toBe('DC_ELV');
    expect(domainClassFor('solar', 'Solar')).toBe('DC_ELV');
    expect(domainClassFor('shorePower', 'AC_230V')).toBe('AC_LV');
    expect(domainClassFor('consumer230v', 'AC_230V')).toBe('AC_LV');
    expect(domainClassFor('freshWaterTank', 'DC_12V')).toBe('FLUID');
    expect(domainClassFor('roofWindow', 'DC_12V')).toBe('NON_ELECTRICAL');
  });

  it('bestimmt den Träger einer Leitung (Solar rechnet gegen MPP-Spannung)', () => {
    expect(carrierFor('DC_12V', ['battery', 'consumer'])).toBe('dc');
    expect(carrierFor('Solar', ['solar', 'mpptController'])).toBe('solar');
    expect(carrierFor('AC_230V', ['shorePower', 'consumer230v'])).toBe('ac');
    expect(carrierFor('DC_12V', ['freshWaterTank', 'pump'])).toBe('water');
  });
});

describe('lib/verify/graph — Bauteilverhalten', () => {
  it('liest Batterien mit derselben Rollenlogik wie die App', () => {
    expect(componentBehavior(houseBattery())).toMatchObject({
      kind: 'SOURCE',
      carrier: 'dc',
      role: 'house-battery',
      // Keine Spannung im Knoten deklariert ⇒ null (kein 12-V-Default).
      nominalVoltageV: null,
    });
    const starter = componentBehavior(fixtureNode('b2', 'battery', { role: 'starter', capacity: 80 }));
    expect(starter).toMatchObject({ kind: 'SOURCE', role: 'starter-battery' });
    const label = componentBehavior(fixtureNode('b3', 'battery', { label: 'Starterbatterie' }));
    expect(label).toMatchObject({ kind: 'SOURCE', role: 'starter-battery' });
    expect(componentBehavior(fixtureNode('s1', 'solar'))).toMatchObject({
      kind: 'SOURCE',
      carrier: 'solar',
      role: 'pv-array',
    });
    expect(componentBehavior(fixtureNode('r1', 'roofSolar'))).toMatchObject({ carrier: 'solar' });
  });

  it('liest Landstrom inklusive deklarierter Netzform — sonst null', () => {
    expect(componentBehavior(fixtureNode('s', 'shorePower', { systemForm: 'TN-C' }))).toMatchObject({
      kind: 'SOURCE',
      carrier: 'ac',
      declaredSystemForm: 'TN-C',
    });
    expect(
      (
        componentBehavior(fixtureNode('s', 'shorePower', { systemForm: 'TN-C-S' })) as {
          declaredSystemForm: unknown;
        }
      ).declaredSystemForm
    ).toBeNull();
  });

  it('liest Wandler mit Eingangs-/Ausgangsdomäne und Datenlücken als null', () => {
    const inverter = componentBehavior(
      fixtureNode('i', 'inverter', {
        continuousPower: 2000,
        efficiency: 90,
        hasRcd: true,
        neutralEarthBond: 'dynamic',
      })
    );
    expect(inverter).toMatchObject({
      kind: 'CONVERTER',
      inputDomain: 'DC_ELV',
      outputDomain: 'AC_LV',
      efficiency: 90,
      continuousPowerW: 2000,
      hasIntegratedRcd: true,
      neutralEarthBond: 'dynamic',
    });
    const bare = componentBehavior(fixtureNode('i', 'inverter'));
    expect(bare).toMatchObject({ efficiency: null, hasIntegratedRcd: null, neutralEarthBond: null });
    // Ein unbekannter N-PE-Schlüssel ist kein „never“, sondern eine Lücke.
    expect(componentBehavior(fixtureNode('i', 'inverter', { neutralEarthBond: 'vielleicht' }))).toMatchObject(
      {
        neutralEarthBond: null,
      }
    );
    expect(componentBehavior(fixtureNode('c', 'acBatteryCharger'))).toMatchObject({
      inputDomain: 'AC_LV',
      outputDomain: 'DC_ELV',
    });
    expect(componentBehavior(fixtureNode('m', 'mpptController'))).toMatchObject({
      inputDomain: 'DC_ELV',
      outputDomain: 'DC_ELV',
    });
  });

  it('liest Lasten, Schutz, Messung, Bezug und Passive', () => {
    expect(componentBehavior(fixtureNode('l', 'consumer', { watts: 120, hours: 4 }))).toMatchObject({
      kind: 'LOAD',
      ratedPowerW: 120,
      currentA: null,
      loadClass: 'standard',
    });
    expect(componentBehavior(fixtureNode('l', 'consumer', { amps: 5, loadClass: 'safety' }))).toMatchObject({
      kind: 'LOAD',
      currentA: 5,
      loadClass: 'safety',
    });
    expect(loadClassOf(fixtureNode('l', 'consumer', { loadClass: 'quatsch' }))).toBe('standard');
    expect(componentBehavior(fixtureNode('f', 'fuse', { rating: 30, fuseType: 'midi' }))).toMatchObject({
      kind: 'PROTECTION',
      device: { type: 'fuse', ratedCurrentA: 30, variant: 'midi', productClass: 'bolt-down' },
    });
    // Ohne Nennstrom bleibt In = 0 (keine erfundene Schutzwirkung).
    expect(
      (componentBehavior(fixtureNode('f', 'fuse')) as { device: { ratedCurrentA: number } }).device
        .ratedCurrentA
    ).toBe(0);
    expect(componentBehavior(fixtureNode('sh', 'shunt'))).toMatchObject({
      kind: 'MEASUREMENT',
      measurement: 'shunt',
    });
    expect(componentBehavior(fixtureNode('g', 'ground'))).toMatchObject({ kind: 'REFERENCE' });
    expect(componentBehavior(fixtureNode('b', 'busbar'))).toMatchObject({ kind: 'PASSIVE' });
    expect(componentBehavior(fixtureNode('k', 'conduit'))).toMatchObject({ kind: 'PASSIVE' });
    expect(componentBehavior(fixtureNode('w', 'pump'))).toMatchObject({ kind: 'NON_ELECTRICAL' });
    expect(componentBehavior(fixtureNode('r', 'roofWindow'))).toMatchObject({ kind: 'NON_ELECTRICAL' });
  });

  it('macht aus einem unbekannten Bauteil ein Datenloch — nie eine Last', () => {
    const unknown = componentBehavior(fixtureNode('x', 'mystery', { watts: 500 }));
    expect(unknown.kind).toBe('UNKNOWN');
    if (unknown.kind === 'UNKNOWN') expect(unknown.reason).toContain('mystery');
    expect(componentBehavior(fixtureNode('x', '')).kind).toBe('UNKNOWN');
  });
});

describe('lib/verify/graph — Schutzorgane an Kanten', () => {
  it('liest DC-Sicherungen mit Position und Bauform', () => {
    expect(edgeOvercurrentDevice({ fuseSize: 20, fuseType: 'ato', fuseOffset: 0.15 })).toMatchObject({
      type: 'fuse',
      ratedCurrentA: 20,
      variant: 'ato',
      productClass: 'iso8820-blade',
    });
    expect(edgeOvercurrentDevice({})).toBeNull();
    expect(edgeOvercurrentDevice({ fuseSize: 0 })).toBeNull();
    expect(edgeOvercurrentDevice({ fuseSize: Number.NaN })).toBeNull();
  });

  it('erfindet keine Produktklasse, wenn die Bauform fehlt', () => {
    // Kante: `fuseSize` ohne `fuseType`. Vorher stand hier 'bolt-down' —
    // eine erfundene Zuordnung, die im Report als Tatsache auftauchte.
    expect(edgeOvercurrentDevice({ fuseSize: 100 })).toMatchObject({
      type: 'fuse',
      ratedCurrentA: 100,
      variant: null,
      productClass: null,
    });

    // Derselbe Fall am Sicherungskasten-KNOTEN (`rating` ohne `fuseType`).
    const behavior = componentBehavior(
      fixtureNode('fuse1', 'fuse', { label: 'Sicherungskasten', rating: 100 })
    );
    if (behavior.kind !== 'PROTECTION') throw new Error('erwartet PROTECTION');
    const device = behavior.device;
    if (device.type !== 'fuse') throw new Error('erwartet Sicherung');
    expect(device.variant).toBeNull();
    expect(device.productClass).toBeNull();
  });

  it('liest AC-Schutzbeschreibungen als MCB (+ RCD bei FI/LS)', () => {
    const devices = edgeAcDevices({
      fuseSize: 16,
      acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6 },
    });
    expect(devices).toHaveLength(2);
    expect(devices[0]).toMatchObject({ type: 'mcb', characteristic: 'B', poles: 2, breakingCapacityKA: 6 });
    expect(devices[1]).toMatchObject({
      type: 'rcd',
      ratedResidualCurrentA: 0.03,
      residualType: 'A',
      poles: 2,
    });
    // Ohne Bemessungsstrom (fuseSize) entsteht KEIN MCB mit geratenem In.
    expect(
      edgeAcDevices({ acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6 } })
    ).toEqual([expect.objectContaining({ type: 'rcd' })]);
    const mcbOnly = edgeAcDevices({
      fuseSize: 16,
      acProtection: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 10 },
    });
    expect(mcbOnly).toHaveLength(1);
    expect(mcbOnly[0]).toMatchObject({ type: 'mcb', characteristic: 'C', ratedCurrentA: 16 });
    // AC-Leitung mit Bemessungsstrom, aber OHNE Beschreibung: das Organ
    // existiert, seine Bauart/Charakteristik bleibt aber unbekannt (null) —
    // jede charakteristikabhängige Prüfung meldet dann UNPROVABLE statt zu raten.
    const undescribed = edgeAcDevices({ fuseSize: 16 });
    expect(undescribed).toHaveLength(1);
    expect(undescribed[0]).toMatchObject({
      type: 'mcb',
      ratedCurrentA: 16,
      characteristic: null,
      breakingCapacityKA: null,
      poles: null,
    });
  });

  it('markiert ein Schutzorgan ohne Positionsangabe als »am Quellenpol«', () => {
    const [assumed] = protectionsOf({ fuseSize: 30, fuseType: 'midi' }, 'e1', false);
    expect(assumed).toMatchObject({ host: 'edge-data', hostId: 'e1', assumedAtSource: true });
    expect(assumed?.positionFromSourceM).toBeNull();
    const [positioned] = protectionsOf({ fuseSize: 30, fuseOffset: 0.4 }, 'e1', false);
    expect(positioned).toMatchObject({ assumedAtSource: false, positionFromSourceM: 0.4 });
    // AC-Kanten führen nur die Beschreibung, keine DC-Sicherung.
    const ac = protectionsOf(
      { fuseSize: 16, acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6 } },
      'e2',
      true
    );
    expect(ac).toHaveLength(2);
    const [rcd] = ac.filter((placement) => placement.device.type === 'rcd');
    expect(rcd).toMatchObject({ host: 'edge-data', assumedAtSource: true });
  });
});

describe('lib/verify/graph — Konduktionsgraph', () => {
  it('übersetzt den gesunden Plan vollständig und lässt nichts fallen', () => {
    const plan = healthyDcPlan();
    const graph = buildConductionGraph(plan.nodes, plan.edges);
    expect(graph.cables).toHaveLength(5);
    expect(graph.danglingEdges).toEqual([]);
    expect(graph.unmodeledComponents).toEqual([]);
    expect(graph.unknownPorts).toEqual([]);
    expect(graph.fluidBridges).toEqual([]);
    // Auslegungsspannung ist die Entladeschlussspannung (12,8 V), nicht 12 V.
    expect(graph.systemVoltageV).toBe(12.8);
    expect([...graph.cableById.keys()].sort()).toEqual([
      'e-bat-fuse',
      'e-bat-shunt',
      'e-bond',
      'e-fuse-load',
      'e-shunt-load',
    ]);
    expect(graph.cablesByNode.get('bat1')).toHaveLength(3);
    const branch = graph.cableById.get('e-fuse-load');
    expect(branch).toMatchObject({ domain: 'DC_ELV', carrier: 'dc', lengthM: 2, crossSectionMm2: 4 });
    expect(branch?.currentA).toBeGreaterThan(0);
    expect(branch?.lengthIsAssumption).toBe(false);
    expect(nominalVoltageOfCable(branch!, graph.systemVoltageV)).toBeCloseTo(12.8, 6);
    expect(graph.cables.every((cable) => cable.protections.length >= 0)).toBe(true);
  });

  it('modelliert die Shunt-Messseiten aus den Handle-Rollen', () => {
    const plan = healthyDcPlan();
    const graph = buildConductionGraph(plan.nodes, plan.edges);
    const shunt = graph.shunts[0];
    expect(shunt?.nodeId).toBe('shunt1');
    expect(shunt?.batterySide?.role).toBe('target'); // BAT−: die Batterie speist ein
    expect(shunt?.loadSide?.role).toBe('source'); // LOAD−: die Lasten gehen ab
    expect(portKey('shunt1', 'minus', 'target')).toBe(shunt?.batterySide?.key);
  });

  it('führt Wasser- und Dachknoten NICHT als elektrische Leitungen', () => {
    const plan = healthyDcPlan();
    plan.nodes.push(fixtureNode('tank1', 'freshWaterTank', { label: 'Tank' }));
    plan.edges.push(fixtureEdge('e-tank', 'tank1', 'out', 'load1', 'plus'));
    const graph = buildConductionGraph(plan.nodes, plan.edges);
    expect(graph.cableById.has('e-tank')).toBe(false);
    expect(graph.fluidBridges).toHaveLength(1);
    expect(graph.fluidBridges[0]).toMatchObject({
      edgeId: 'e-tank',
      fluidNodeId: 'tank1',
      otherNodeId: 'load1',
    });
  });

  it('hält Datenlücken als null fest (keine 0 m, keine 2,5 mm²)', () => {
    const plan = healthyDcPlan();
    plan.nodes.push(fixtureNode('load2', 'consumer', { label: 'Zweite Last' }));
    const edge = fixtureEdge('e-fuse-load2', 'fuse1', 'plus', 'load2', 'plus');
    const graph = buildConductionGraph(plan.nodes, plusEdge(plan, edge).edges);
    const cable = graph.cableById.get('e-fuse-load2');
    expect(cable?.lengthM).toBeNull();
    expect(cable?.crossSectionMm2).toBeNull();
    // Auch der Strom: ein Verbraucher ohne Leistungsangabe liefert 0 A, und
    // diese Null ist eine Datenlücke — nicht „0 A, also gesund“.
    expect(cable?.currentA).toBeNull();
    expect(cable?.currentSource).toContain('nicht bestimmbar');
    expect(cable?.lengthIsAssumption).toBe(false);
  });

  it('meldet verwaiste Kanten, unbekannte Bauteile und unbekannte Handles', () => {
    const nodes = [
      houseBattery('bat1'),
      fixtureNode('mystery1', 'mystery'),
      fixtureNode('load1', 'consumer', { watts: 100 }),
    ];
    const edges = [
      fixtureEdge('e-dangling', 'bat1', 'plus', 'gibtsNicht', 'plus'),
      fixtureEdge('e-mystery', 'bat1', 'plus', 'mystery1', 'plus'),
      fixtureEdge('e-handle', 'bat1', 'plus', 'load1', 'querschnitt'),
    ];
    const graph = buildConductionGraph(nodes, edges);
    expect(graph.danglingEdges).toEqual([{ edgeId: 'e-dangling', missingNodeId: 'gibtsNicht' }]);
    expect(graph.unmodeledComponents.map((entry) => entry.nodeId)).toContain('mystery1');
    expect(graph.unknownPorts.map((entry) => entry.edgeId)).toContain('e-handle');
  });

  it('behält Kanten mit unbekanntem Querschnitt im Graphen (nicht gelöscht, nicht geraten)', () => {
    const plan = healthyDcPlan();
    const graph = buildConductionGraph(
      plan.nodes,
      plan.edges.map((edge) =>
        edge.id === 'e-fuse-load' ? { ...edge, data: { ...edge.data, crossSection: undefined } } : edge
      )
    );
    expect(graph.cableById.get('e-fuse-load')?.crossSectionMm2).toBeNull();
  });
});

describe('lib/verify/graph — Randfälle der Modellbildung', () => {
  it('wählt die Spannungsbasis nach Träger: 12 V, 230 V, Solar-Basis', () => {
    const plan = healthyDcPlan();
    const dc = buildConductionGraph(plan.nodes, plan.edges);
    const cable = dc.cableById.get('e-fuse-load');
    expect(cable).toBeDefined();
    expect(nominalVoltageOfCable(cable!, dc.systemVoltageV)).toBe(dc.systemVoltageV);

    const acCable = { ...cable!, carrier: 'ac' as const };
    expect(nominalVoltageOfCable(acCable, dc.systemVoltageV)).toBe(230);

    const solarCable = { ...cable!, carrier: 'solar' as const };
    expect(nominalVoltageOfCable(solarCable, dc.systemVoltageV)).toBeGreaterThan(0);
  });

  it('meldet unbekannte Knoten und Leitungen als solche (kein Absturz, keine Erfindung)', () => {
    const plan = healthyDcPlan();
    const graph = buildConductionGraph(plan.nodes, plan.edges);
    expect(behaviorOf(graph, 'gibt-es-nicht')).toEqual({
      kind: 'UNKNOWN',
      reason: 'Knoten „gibt-es-nicht“ ist nicht im Modell',
    });
    expect(labelOfNode(graph, 'gibt-es-nicht')).toBe('gibt-es-nicht');
    expect(labelOfNode(graph, 'bat1')).toBe('Aufbaubatterie');
    expect(labelOfNode(graph, 'shunt1')).toBe('Shunt');
  });

  it('führt die Nachbarn eines Knotens über seine Leitungen', () => {
    const plan = healthyDcPlan();
    const graph = buildConductionGraph(plan.nodes, plan.edges);
    expect(neighborsOf(graph, 'bat1').sort()).toEqual(['fuse1', 'gnd1', 'shunt1']);
    expect(neighborsOf(graph, 'gibt-es-nicht')).toEqual([]);
  });

  it('erkennt Handles ohne Polarität (in/out, N) korrekt', () => {
    expect(polarityOfHandle('conduit', 'in', 'source')).toBe('none');
    expect(polarityOfHandle('conduit', 'out', 'target')).toBe('none');
    expect(polarityOfHandle('shorePower', 'N', 'target')).toBe('neutral');
    expect(polarityOfHandle('shorePower', 'PE', 'target')).toBe('protective-earth');
    expect(polarityOfHandle('shorePower', 'plus', 'source')).toBe('line');
    expect(polarityOfHandle('battery', 'plus', 'source')).toBe('positive');
    expect(polarityOfHandle('inverter', 'minus', 'source')).toBe('negative');
    expect(polarityOfHandle('battery', 'signal', 'source')).toBe('signal');
  });

  it('führt Fluidik NICHT als Leitung, sondern als Brücke', () => {
    const plan = healthyDcPlan();
    const graph = buildConductionGraph(
      [...plan.nodes, fixtureNode('tank1', 'freshWaterTank', { label: 'Frischwassertank' })],
      [...plan.edges, fixtureEdge('e-tank', 'bat1', 'plus', 'tank1', 'plus')]
    );
    expect(graph.fluidBridges.map((entry) => entry.edgeId)).toContain('e-tank');
    expect(graph.cableById.has('e-tank')).toBe(false);
  });

  it('hält einen elektrisch verdrahteten Dachknoten als Brücke fest UND als Kabel', () => {
    // Dach-/Hintergrundbauteile sind Fluidik-artige Modellbrüche: Sie werden
    // als Brücke gemeldet (TOPO-005) — die Kante bleibt aber im Modell, damit
    // der Befund an einer Kante hängt und nicht verschwindet.
    const plan = healthyDcPlan();
    const graph = buildConductionGraph(
      [...plan.nodes, fixtureNode('dach1', 'roofWindow', { label: 'Dachfenster' })],
      [...plan.edges, fixtureEdge('e-dach', 'bat1', 'plus', 'dach1', 'plus')]
    );
    const bridge = graph.fluidBridges.find((entry) => entry.edgeId === 'e-dach');
    expect(bridge?.fluidNodeId).toBe('dach1');
    expect(bridge?.otherNodeId).toBe('bat1');
    expect(graph.cableById.has('e-dach')).toBe(true);
    expect(graph.cableById.get('e-dach')?.crossSectionMm2).toBeNull();
  });

  it('hält eine Leitung ohne Deklaration ihres Verbrauchers bei 0 A — aber ohne Aussage', () => {
    const plan = healthyDcPlan();
    const graph = buildConductionGraph(
      plan.nodes.map((node) => (node.id === 'load1' ? fixtureNode('load1', 'consumer') : node)),
      plan.edges
    );
    expect(graph.cableById.get('e-fuse-load')?.currentA).toBeNull();
    // Die Zuleitung Batterie → Sicherung endet an keinem Verbraucher: dort
    // bleibt der berechnete 0-A-Wert stehen (die Last ist auf diesem Abschnitt
    // nicht deklariert und wird nicht geraten).
    expect(graph.cableById.get('e-bat-fuse')?.currentA).toBe(0);
  });
});
