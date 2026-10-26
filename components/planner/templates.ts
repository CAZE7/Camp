import { type Node, type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../edges/CableEdge';
import { nodesWithUniqueDesignators } from '../nodes/designatorModel';

/**
 * Konventioneller Auslösestrom der in den Vorlagen verwendeten 40-A-MIDI-
 * Sicherung. Quelle: Littelfuse „MIDI ISO Series“ (ISO 20934, 70 V DC),
 * Zeit-Strom-Kennlinie 135 % → Öffnung 300–3600 s; 1,35 × 40 A = 54 A.
 * Die Bauform „midi“ allein hat keine belegte Produktnorm (MIDI/MEGA/ANL/
 * MRBF teilen sich „bolt-down“) — deshalb steht der Datenblattwert am
 * konkreten Produkt der Vorlage. Ohne ihn meldet die Engine AMP-002
 * „nicht entscheidbar“ statt einen Wert zu erfinden.
 */
const MIDI_ISO_40A_I2 = 54;

/**
 * Vorlagen-Pläne (Wizard + Vorlagen-Seiten).
 *
 * Nachtest 2026-10-16: Die Vorlagen starteten mit 0 h/Tag an allen
 * Verbrauchern und 0 V / 0 A am Solarmodul — der Plan galt damit als
 * „nicht bestanden“, die Autarkie zeigte „Unendlich“. Deshalb trägt jede
 * Komponente hier vollständige, plausible Startwerte (Nutzungsdauer,
 * Panel-Arbeitspunkt, Nennspannung, MPPT-Grenze). Es sind Annahmen für
 * einen sinnvollen Erststart, keine Produktdaten — der Nutzer passt sie
 * im Inspektor an sein Gerät an.
 */

export const TEMPLATE_MINIMALIST = {
  nodes: [
    {
      id: 'battery-1',
      type: 'battery',
      position: { x: 80, y: 160 },
      data: {
        label: '12V Batterie',
        role: 'house',
        capacity: 100,
        chemistry: 'AGM',
        nominalVoltage: 12,
        internalResistance: 15,
      },
    },
    { id: 'ground-1', type: 'ground', position: { x: 80, y: 360 }, data: { label: 'Massepunkt' } },
    {
      id: 'fusebox-1',
      type: 'fuse',
      position: { x: 380, y: 160 },
      data: { label: 'Sicherungskasten', rating: 25, fuseType: 'ato' },
    },
    {
      id: 'cons-light',
      type: 'consumer',
      position: { x: 680, y: 60 },
      data: { label: 'LED-Beleuchtung', watts: 20, hours: 4 },
    },
    {
      id: 'cons-usb',
      type: 'consumer',
      position: { x: 680, y: 220 },
      data: { label: 'USB Steckdosen', watts: 36, hours: 2 },
    },
    {
      id: 'cons-cool',
      type: 'consumer',
      position: { x: 680, y: 380 },
      data: { label: 'Kühlbox', watts: 45, hours: 8 },
    },
  ] as Node[],
  edges: [
    // Hauptsicherung sitzt direkt am Batteriepol (≤ 20 cm) als Class T (25 A)
    // und ist selektiv zu den nachgelagerten 5-/10-A-ATO-Zweigsicherungen
    // (25 : 10 = 2,5 ≥ 1,6). Masseanbindung 16 mm² erfüllt GND-001 (H6).
    {
      id: 'e-batt-fuse',
      source: 'battery-1',
      sourceHandle: 'plus',
      target: 'fusebox-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 0.2, crossSection: 16, fuseSize: 25, fuseType: 'classT' },
    },
    {
      id: 'e-batt-gnd',
      source: 'battery-1',
      sourceHandle: 'minus',
      target: 'ground-1',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 16 },
    },
    {
      id: 'e-fuse-light',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-light',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 5, crossSection: 2.5, fuseSize: 5, fuseType: 'ato' },
    },
    {
      id: 'e-fuse-usb',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-usb',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 2.5, fuseSize: 10, fuseType: 'ato' },
    },
    {
      id: 'e-fuse-cool',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-cool',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 2, crossSection: 4, fuseSize: 10, fuseType: 'ato' },
    },
  ] as Edge<CableEdgeData>[],
};

export const TEMPLATE_ALLROUNDER = {
  nodes: [
    {
      id: 'solar-1',
      type: 'solar',
      position: { x: 80, y: 60 },
      data: { label: '150W Solar', watts: 150, voltage: 18, amps: 8.3, voc: 22.5, isc: 8.8 },
    },
    {
      id: 'starter-1',
      type: 'battery',
      position: { x: 80, y: 240 },
      data: {
        label: 'Starterbatterie',
        role: 'starter',
        capacity: 90,
        chemistry: 'AGM',
        nominalVoltage: 12,
      },
    },
    {
      id: 'battery-1',
      type: 'battery',
      position: { x: 80, y: 440 },
      data: {
        label: '100Ah Lithium',
        role: 'house',
        capacity: 100,
        chemistry: 'LiFePO4',
        nominalVoltage: 12.8,
        hasInternalBms: true,
        internalResistance: 15,
      },
    },
    {
      id: 'charger-1',
      type: 'mpptController',
      position: { x: 380, y: 60 },
      data: { label: 'MPPT Solarregler', amps: 30, maxPvVoltage: 75 },
    },
    {
      id: 'charger-2',
      type: 'dcdcCharger',
      position: { x: 380, y: 240 },
      data: { label: 'DC-DC Ladebooster', amps: 30 },
    },
    { id: 'busbar-plus', type: 'busbar', position: { x: 380, y: 440 }, data: { label: 'Plus Busbar' } },
    { id: 'busbar-minus', type: 'busbar', position: { x: 380, y: 620 }, data: { label: 'Minus Busbar' } },
    {
      id: 'fusebox-1',
      type: 'fuse',
      position: { x: 680, y: 200 },
      data: { label: 'Sicherungskasten', rating: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
    },
    {
      id: 'inverter-1',
      type: 'inverter',
      position: { x: 680, y: 440 },
      data: { label: '500W Inverter', watts: 500, continuousPower: 500, idleWatts: 6, hasRcd: true },
    },
    {
      id: 'cons-fridge',
      type: 'consumer',
      position: { x: 980, y: 60 },
      data: { label: 'Kompressorkühlschrank', watts: 60, hours: 8 },
    },
    {
      id: 'cons-pump',
      type: 'consumer',
      position: { x: 980, y: 220 },
      data: { label: 'Wasserpumpe', watts: 40, hours: 0.5 },
    },
    {
      id: 'cons-light',
      type: 'consumer',
      position: { x: 980, y: 380 },
      data: { label: 'LED-Beleuchtung', watts: 20, hours: 4 },
    },
    {
      id: 'cons-230v',
      type: 'consumer230v',
      position: { x: 980, y: 540 },
      data: { label: '230V Steckdose', watts: 300, hours: 1 },
    },
  ] as Node[],
  edges: [
    {
      id: 'e-batt-plus',
      source: 'battery-1',
      sourceHandle: 'plus',
      target: 'busbar-plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 0.5, crossSection: 70, fuseSize: 100, fuseType: 'classT' },
    },
    {
      id: 'e-batt-minus',
      source: 'battery-1',
      sourceHandle: 'minus',
      target: 'busbar-minus',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: { length: 0.5, crossSection: 70 },
    },
    {
      id: 'e-solar-charger',
      source: 'solar-1',
      sourceHandle: 'plus',
      target: 'charger-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 6, fuseSize: 20, fuseType: 'ato', edgeDomain: 'Solar' },
    },
    {
      id: 'e-charger-busbar',
      source: 'charger-1',
      sourceHandle: 'plus',
      target: 'busbar-plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 10, fuseSize: 30, fuseType: 'ato' },
    },
    {
      id: 'e-starter-dcdc',
      source: 'starter-1',
      sourceHandle: 'plus',
      target: 'charger-2',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 5, crossSection: 16, fuseSize: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
    },
    {
      id: 'e-dcdc-busbar',
      source: 'charger-2',
      sourceHandle: 'plus',
      target: 'busbar-plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 16, fuseSize: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
    },
    {
      id: 'e-busbar-fuse',
      source: 'busbar-plus',
      sourceHandle: 'plus',
      target: 'fusebox-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 16, fuseSize: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
    },
    {
      id: 'e-fuse-fridge',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-fridge',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 4, fuseSize: 10, fuseType: 'ato' },
    },
    {
      id: 'e-fuse-pump',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-pump',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 4, crossSection: 2.5, fuseSize: 10, fuseType: 'ato' },
    },
    {
      id: 'e-fuse-light',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-light',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 5, crossSection: 1.5, fuseSize: 5, fuseType: 'ato' },
    },
    {
      id: 'e-busbar-inv-plus',
      source: 'busbar-plus',
      sourceHandle: 'plus',
      target: 'inverter-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 25, fuseSize: 60, fuseType: 'classT' },
    },
    {
      id: 'e-busbar-inv-minus',
      source: 'busbar-minus',
      sourceHandle: 'minus',
      target: 'inverter-1',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 25 },
    },
    {
      id: 'e-inv-230',
      source: 'inverter-1',
      sourceHandle: 'plus',
      target: 'cons-230v',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: {
        length: 2,
        crossSection: 2.5,
        fuseSize: 10,
        edgeDomain: 'AC_230V',
        acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6, residualType: 'B' },
      },
    },
  ] as Edge<CableEdgeData>[],
};

export const TEMPLATE_AUTARK = {
  nodes: [
    {
      id: 'solar-1',
      type: 'solar',
      position: { x: 80, y: 60 },
      data: { label: '400W Solar', watts: 400, voltage: 31, amps: 12.9, voc: 37, isc: 13.7 },
    },
    {
      id: 'starter-1',
      type: 'battery',
      position: { x: 80, y: 240 },
      data: {
        label: 'Starterbatterie',
        role: 'starter',
        capacity: 90,
        chemistry: 'AGM',
        nominalVoltage: 12,
      },
    },
    {
      id: 'shore-1',
      type: 'shorePower',
      position: { x: 80, y: 420 },
      data: { label: 'Landstrom', hasRcd: true, rating: 16, systemForm: 'TN-S', prospectiveIkA: 1500 },
    },
    {
      id: 'battery-1',
      type: 'battery',
      position: { x: 80, y: 600 },
      data: {
        label: '200Ah Lithium',
        role: 'house',
        capacity: 200,
        chemistry: 'LiFePO4',
        nominalVoltage: 12.8,
        hasInternalBms: true,
        internalResistance: 15,
      },
    },
    {
      id: 'charger-1',
      type: 'mpptController',
      position: { x: 380, y: 60 },
      data: { label: 'MPPT Solarregler', amps: 35, maxPvVoltage: 75 },
    },
    {
      id: 'charger-2',
      type: 'dcdcCharger',
      position: { x: 380, y: 240 },
      data: { label: 'DC-DC Ladebooster', amps: 20 },
    },
    { id: 'busbar-plus', type: 'busbar', position: { x: 380, y: 496 }, data: { label: 'Plus Busbar' } },
    { id: 'busbar-minus', type: 'busbar', position: { x: 380, y: 688 }, data: { label: 'Minus Busbar' } },
    {
      id: 'fusebox-1',
      type: 'fuse',
      position: { x: 680, y: 200 },
      data: { label: 'Sicherungskasten', rating: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
    },
    // AUDIT ELE-001 (2026-10 korrigiert): Die absicherbare Grenze des
    // Modells ist 70 mm² mit max. 100 A (FUSE_MAP). Der Batterie-Hauptstrang
    // trägt im worst case EINGANGSSTROM DES WECHSELRICHTERS + DC-LASTEN +
    // BOOSTER-EINGANG (alles gleichzeitig am Bus). Damit der Template-Plan
    // ohne Sicherheitsbefund startet, muss die Summe ≤ 100 A bleiben:
    // 600 W WR ⇒ 58,8 A + DC-Lasten 11,7 A + 20-A-Booster-Eingang 22,2 A
    // = 92,7 A.
    {
      id: 'inverter-1',
      type: 'inverter',
      position: { x: 680, y: 480 },
      data: { label: '600W Inverter', watts: 600, continuousPower: 600, idleWatts: 10, hasRcd: true },
    },
    {
      id: 'cons-fridge',
      type: 'consumer',
      position: { x: 980, y: 60 },
      data: { label: 'Kompressorkühlschrank', watts: 60, hours: 8 },
    },
    {
      id: 'cons-heat',
      type: 'consumer',
      position: { x: 980, y: 220 },
      data: { label: 'Standheizung', watts: 40, hours: 3 },
    },
    {
      id: 'cons-fan',
      type: 'consumer',
      position: { x: 980, y: 380 },
      data: { label: 'MaxxFan', watts: 40, hours: 4 },
    },
    {
      id: 'cons-induct',
      type: 'consumer230v',
      position: { x: 980, y: 540 },
      data: { label: 'E-Bike-Lader / Reisekocher (230 V)', watts: 500, hours: 0.5 },
    },
  ] as Node[],
  edges: [
    {
      id: 'e-batt-plus',
      source: 'battery-1',
      sourceHandle: 'plus',
      target: 'busbar-plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 0.5, crossSection: 70, fuseSize: 100, fuseType: 'classT' },
    },
    {
      id: 'e-batt-minus',
      source: 'battery-1',
      sourceHandle: 'minus',
      target: 'busbar-minus',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: { length: 0.5, crossSection: 70 },
    },
    {
      id: 'e-solar-charger',
      source: 'solar-1',
      sourceHandle: 'plus',
      target: 'charger-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 4, crossSection: 10, fuseSize: 25, fuseType: 'ato', edgeDomain: 'Solar' },
    },
    {
      id: 'e-charger-busbar',
      source: 'charger-1',
      sourceHandle: 'plus',
      target: 'busbar-plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 16, fuseSize: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
    },
    {
      id: 'e-starter-dcdc',
      source: 'starter-1',
      sourceHandle: 'plus',
      target: 'charger-2',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 5, crossSection: 16, fuseSize: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
    },
    {
      id: 'e-dcdc-busbar',
      source: 'charger-2',
      sourceHandle: 'plus',
      target: 'busbar-plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 10, fuseSize: 25, fuseType: 'ato' },
    },
    {
      id: 'e-busbar-fuse',
      source: 'busbar-plus',
      sourceHandle: 'plus',
      target: 'fusebox-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 16, fuseSize: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
    },
    {
      id: 'e-fuse-fridge',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-fridge',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 4, fuseSize: 10, fuseType: 'ato' },
    },
    {
      id: 'e-fuse-heat',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-heat',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 4, crossSection: 4, fuseSize: 15, fuseType: 'ato' },
    },
    {
      id: 'e-fuse-fan',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-fan',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 2.5, fuseSize: 10, fuseType: 'ato' },
    },
    {
      id: 'e-busbar-inv-plus',
      source: 'busbar-plus',
      sourceHandle: 'plus',
      target: 'inverter-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 35, fuseSize: 60, fuseType: 'classT' },
    },
    {
      id: 'e-busbar-inv-minus',
      source: 'busbar-minus',
      sourceHandle: 'minus',
      target: 'inverter-1',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 35 },
    },
    {
      id: 'e-inv-induct',
      source: 'inverter-1',
      sourceHandle: 'plus',
      target: 'cons-induct',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: {
        length: 2,
        crossSection: 2.5,
        fuseSize: 10,
        edgeDomain: 'AC_230V',
        acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6, residualType: 'B' },
      },
    },
    {
      id: 'e-shore-inv',
      source: 'shore-1',
      sourceHandle: 'plus',
      target: 'inverter-1',
      targetHandle: 'ac_in',
      type: 'cableEdge',
      data: {
        length: 2,
        crossSection: 2.5,
        fuseSize: 16,
        edgeDomain: 'AC_230V',
        acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6, residualType: 'B' },
      },
    },
  ] as Edge<CableEdgeData>[],
};

/**
 * Klassisches Kastenwagen-Setup — der Plan, den ein Erstbesucher statt einer
 * leeren Zeichenfläche sieht (siehe `STARTER_TEMPLATE_ID` unten).
 *
 * Topologie wie der Allrounder, aber eigene Knoten- und Kantenkopie: Der
 * Erstplan muss seinen eigenen Prüfbericht bestehen. Dafür reichen die
 * 35-mm²-/63-A-Werte des Allrounders nicht — die Selektivität (Verhältnis
 * mindestens 1,6:1) und das Abschaltvermögen gegen den geschätzten
 * Kurzschlussstrom beider Batterien scheitern daran. Die Stufen hier sind
 * die Tabellenwerte des Modells (50 mm² trägt 80 A, Class T schaltet 20 kA
 * ab), keine erfundenen Datenblattzahlen. Ein I₂ für Class T ist nicht
 * belegt und wird nicht erfunden.
 *
 * Das 200-W-Modul übernimmt den Arbeitspunkt des 150-W-Moduls (18 V) und
 * skaliert Strom und Kurzschlussstrom mit 200/150, damit Leistung und Strom
 * zusammenpassen.
 */
function cloneTemplateNodes(nodes: readonly Node[]): Node[] {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...(node.data as Record<string, unknown>) },
  }));
}

const KASTENWAGEN_EDGE_DATA: Record<string, CableEdgeData> = {
  'e-batt-plus': { crossSection: 70, fuseSize: 100, fuseType: 'classT' },
  'e-batt-minus': { crossSection: 70 },
  'e-solar-charger': { fuseSize: 20, fuseType: 'ato' },
  'e-charger-busbar': { fuseSize: 30, fuseType: 'ato' },
  'e-starter-dcdc': { fuseSize: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
  'e-dcdc-busbar': { fuseSize: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
  'e-busbar-fuse': { fuseSize: 40, fuseType: 'midi', i2A: MIDI_ISO_40A_I2 },
  'e-fuse-fridge': { fuseSize: 10, fuseType: 'ato' },
  'e-fuse-pump': { fuseSize: 10, fuseType: 'ato' },
  'e-fuse-light': { fuseSize: 5, fuseType: 'ato' },
  'e-busbar-inv-plus': { fuseSize: 60, fuseType: 'classT' },
  'e-inv-230': {
    fuseSize: 10,
    acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6, residualType: 'B' },
  },
};

export const TEMPLATE_KASTENWAGEN = {
  nodes: cloneTemplateNodes(TEMPLATE_ALLROUNDER.nodes).map((node) => {
    if (node.id === 'solar-1') {
      return {
        ...node,
        data: { ...node.data, label: '200W Solar', watts: 200, amps: 11.1, isc: 11.7 },
      };
    }
    if (node.id === 'fusebox-1') {
      return { ...node, data: { ...node.data, rating: 40, fuseType: 'classT' } };
    }
    return node;
  }) as Node[],
  edges: TEMPLATE_ALLROUNDER.edges.map((edge) => {
    const extra = KASTENWAGEN_EDGE_DATA[edge.id];
    return extra ? { ...edge, data: { ...edge.data, ...extra } } : { ...edge, data: { ...edge.data } };
  }) as Edge<CableEdgeData>[],
};

for (const template of [TEMPLATE_MINIMALIST, TEMPLATE_ALLROUNDER, TEMPLATE_AUTARK, TEMPLATE_KASTENWAGEN]) {
  template.nodes = nodesWithUniqueDesignators(template.nodes);
}

export const TEMPLATES_DICT: Record<string, { nodes: Node[]; edges: Edge<CableEdgeData>[] }> = {
  minimalist: TEMPLATE_MINIMALIST,
  allrounder: TEMPLATE_ALLROUNDER,
  autark: TEMPLATE_AUTARK,
  kastenwagen: TEMPLATE_KASTENWAGEN,
  // Deep-Link-Aliasse (Ratgeber, SEO-Text unter dem Planer, Foren-Links):
  // Dieselben Pläne unter den Namen, unter denen sie verlinkt werden.
  wochenende: TEMPLATE_MINIMALIST,
  'wochenend-camper': TEMPLATE_MINIMALIST,
  'ladebooster-solar': TEMPLATE_KASTENWAGEN,
  'autarker-kastenwagen': TEMPLATE_KASTENWAGEN,
  'winter-autark': TEMPLATE_AUTARK,
  'grosses-autark-setup': TEMPLATE_AUTARK,
};

/** Eine anwählbare Vorlage: kanonische Kennung plus alle Deep-Link-Namen. */
export type PlannerTemplate = {
  /** Kanonische Kennung in `TEMPLATES_DICT` (wird auch persistiert/verlinkt). */
  id: string;
  /** Sichtbarer Name, z. B. in der Toolbar-Auswahl „Vorlage laden“. */
  label: string;
  /** Ein Satz, was die Vorlage enthält — ehrlich zu den Werten im Graphen. */
  description: string;
  /** Alle Namen, die `?template=` zusätzlich zur Kennung akzeptiert. */
  aliases: readonly string[];
  /** Fertiger Deep-Link auf den Planer mit genau dieser Vorlage. */
  href: string;
};

/**
 * Die drei Ausbaustufen der Vorlagen-Auswahl — EINE Liste für Toolbar,
 * Onboarding, Deep-Links aus dem Ratgeber und den SEO-Text unter dem Planer.
 * Zwei Listen wären zwei Gelegenheiten, einen Namen zu verlinken, den der
 * Planer nicht kennt.
 */
export const PLANNER_TEMPLATES: readonly PlannerTemplate[] = [
  {
    id: 'minimalist',
    label: 'Wochenend-Camper',
    description:
      'Minicamper und Bulli ohne 230 V: Batterie, Sicherungskasten, LED-Licht, USB-Anschlüsse und Kühlbox.',
    aliases: ['wochenende', 'wochenend-camper', 'minimal'],
    href: '/planer/?template=wochenende',
  },
  {
    id: 'kastenwagen',
    label: 'Autarker Kastenwagen',
    description:
      'Sprinter und Ducato: 100 Ah LiFePO4, 200 W Solar mit MPPT, 30 A Ladebooster, Sicherungskasten und 500 W Wechselrichter.',
    aliases: ['ladebooster-solar', 'autarker-kastenwagen', 'allrounder'],
    href: '/planer/?template=kastenwagen',
  },
  {
    id: 'autark',
    label: 'Großes Autark-Setup',
    description:
      'Für lange Standzeiten und Winter: 200 Ah LiFePO4, 400 W Solar, Ladebooster, Landstrom, Standheizung und 600 W Wechselrichter für 230-V-Verbraucher.',
    aliases: ['winter-autark', 'grosses-autark-setup'],
    href: '/planer/?template=autark',
  },
];

/**
 * Vorlage des ersten Starts. Wer noch keinen eigenen Plan gespeichert hat,
 * sieht dieses komplett verkabelte Setup statt einer leeren Fläche — Kabel,
 * Querschnitte und Bauteile sind sofort anklick- und änderbar.
 */
export const STARTER_TEMPLATE_ID = 'kastenwagen';

/** Löst einen `?template=`-Wert (Kennung oder Alias, beliebige Schreibung) auf. */
export function resolvePlannerTemplateId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === '') return null;
  for (const template of PLANNER_TEMPLATES) {
    if (template.id === normalized || template.aliases.includes(normalized)) return template.id;
  }
  // Kanonische Kennungen der älteren Vorlagen bleiben gültig (Bestandslinks).
  return normalized in TEMPLATES_DICT ? normalized : null;
}

/** Liest die gewünschte Vorlage aus einem Query-String (`?template=…`). */
export function templateIdFromSearch(search: string): string | null {
  return resolvePlannerTemplateId(new URLSearchParams(search).get('template'));
}

/**
 * Darf die leere Fläche durch das Beispiel-Setup ersetzt werden? Nur, wenn
 * weder ein persistierter Plan existiert noch ein Deep-Link einen anderen
 * Plan bringt — ein gespeicherter (auch bewusst geleerter) Plan ist eine
 * Nutzerentscheidung und wird nie überschrieben.
 */
export function shouldLoadStarterPlan(input: {
  hasPersistedPlan: boolean;
  nodeCount: number;
  waterNodeCount: number;
  hasEntryPlan: boolean;
}): boolean {
  return (
    !input.hasPersistedPlan && !input.hasEntryPlan && input.nodeCount === 0 && input.waterNodeCount === 0
  );
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) continue;
      out[key] = canonicalizeValue(entry);
    }
    return out;
  }
  return value;
}

/**
 * Inhalts-Fingerprint eines Plans (H5): vergleicht nicht nur IDs, sondern
 * Bauteil-Typen, Positionen und fachliche Datenwerte — ignoriert aber reine
 * Laufzeit-/Messfelder von React Flow (`measured`, `selected`, `internals`, …).
 */
export function planFingerprint(
  nodes: readonly {
    id: string;
    type?: string;
    position?: { x: number; y: number };
    data?: unknown;
  }[],
  edges: readonly {
    id: string;
    source?: string;
    target?: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    data?: unknown;
  }[]
): string {
  const normNodes = [...nodes]
    .map((node) => {
      const rawData =
        node.data && typeof node.data === 'object' ? { ...(node.data as Record<string, unknown>) } : {};
      delete rawData.designator;
      return {
        id: node.id,
        type: node.type ?? null,
        x: Math.round((node.position?.x ?? 0) * 100) / 100,
        y: Math.round((node.position?.y ?? 0) * 100) / 100,
        data: canonicalizeValue(rawData),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const normEdges = [...edges]
    .map((edge) => ({
      id: edge.id,
      source: edge.source ?? '',
      target: edge.target ?? '',
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      data: canonicalizeValue(
        edge.data && typeof edge.data === 'object' ? (edge.data as Record<string, unknown>) : {}
      ),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify({ nodes: normNodes, edges: normEdges });
}

let cachedStarterFingerprint: string | null = null;
function starterPlanFingerprint(): string {
  if (cachedStarterFingerprint === null) {
    cachedStarterFingerprint = planFingerprint(TEMPLATE_KASTENWAGEN.nodes, TEMPLATE_KASTENWAGEN.edges);
  }
  return cachedStarterFingerprint;
}

/**
 * Ist der aktuelle Plan noch das unveränderte Beispiel-Setup? Dann ist er
 * kein eigener Plan: Ersetzen oder Leeren braucht keine Rückfrage. Sobald ein
 * Wert, eine Position oder eine Leitung geändert wurde (z. B. Batterie auf
 * 300 Ah, H5), gilt er als eigener Plan und wird geschützt.
 */
export function isStarterPlan(
  nodes: readonly {
    id: string;
    type?: string;
    position?: { x: number; y: number };
    data?: unknown;
  }[],
  edges: readonly {
    id: string;
    source?: string;
    target?: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    data?: unknown;
  }[]
): boolean {
  const starter = TEMPLATE_KASTENWAGEN;
  if (nodes.length !== starter.nodes.length || edges.length !== starter.edges.length) return false;
  return planFingerprint(nodes, edges) === starterPlanFingerprint();
}
