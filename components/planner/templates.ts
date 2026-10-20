import { type Node, type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../edges/CableEdge';
import { nodesWithUniqueDesignators } from '../nodes/designatorModel';

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
      data: { label: '12V Batterie', capacity: 100, chemistry: 'AGM' },
    },
    { id: 'ground-1', type: 'ground', position: { x: 80, y: 360 }, data: { label: 'Massepunkt' } },
    { id: 'fusebox-1', type: 'fuse', position: { x: 380, y: 160 }, data: { label: 'Sicherungskasten' } },
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
    // Hauptsicherung sitzt direkt am Batteriepol (≤ 20 cm) und trägt den
    // Gesamtstrom der drei Verbraucher (~8,4 A bei 12 V) → 10 A ATO.
    // Die Minus-Rückleitungen ergänzt „Automatisch verbinden“ fachgerecht
    // (Batterie → Shunt → Minusschiene → Verbraucher); doppelte Rückleiter
    // im Template würden parallele Minuspfade erzeugen.
    {
      id: 'e-batt-fuse',
      source: 'battery-1',
      sourceHandle: 'plus',
      target: 'fusebox-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 0.2, crossSection: 10, fuseSize: 10 },
    },
    {
      id: 'e-batt-gnd',
      source: 'battery-1',
      sourceHandle: 'minus',
      target: 'ground-1',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 10 },
    },
    {
      id: 'e-fuse-light',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-light',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 5, crossSection: 2.5 },
    },
    {
      id: 'e-fuse-usb',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-usb',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 2.5 },
    },
    {
      id: 'e-fuse-cool',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-cool',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 2, crossSection: 4 },
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
      data: { label: 'Starterbatterie', capacity: 90, chemistry: 'AGM' },
    },
    {
      id: 'battery-1',
      type: 'battery',
      position: { x: 80, y: 440 },
      data: { label: '100Ah Lithium', capacity: 100, chemistry: 'LiFePO4' },
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
    { id: 'fusebox-1', type: 'fuse', position: { x: 680, y: 200 }, data: { label: 'Sicherungskasten' } },
    {
      id: 'inverter-1',
      type: 'inverter',
      position: { x: 680, y: 440 },
      data: { label: '500W Inverter', watts: 500, continuousPower: 500, hasRcd: true },
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
      data: { length: 0.5, crossSection: 35, fuseSize: 63 },
    },
    {
      id: 'e-batt-minus',
      source: 'battery-1',
      sourceHandle: 'minus',
      target: 'busbar-minus',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: { length: 0.5, crossSection: 35 },
    },
    {
      id: 'e-solar-charger',
      source: 'solar-1',
      sourceHandle: 'plus',
      target: 'charger-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 6, fuseSize: 20, edgeDomain: 'Solar' },
    },
    {
      id: 'e-charger-busbar',
      source: 'charger-1',
      sourceHandle: 'plus',
      target: 'busbar-plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 10, fuseSize: 32 },
    },
    {
      id: 'e-starter-dcdc',
      source: 'starter-1',
      sourceHandle: 'plus',
      target: 'charger-2',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 5, crossSection: 16, fuseSize: 40 },
    },
    {
      id: 'e-dcdc-busbar',
      source: 'charger-2',
      sourceHandle: 'plus',
      target: 'busbar-plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 16, fuseSize: 40 },
    },
    {
      id: 'e-busbar-fuse',
      source: 'busbar-plus',
      sourceHandle: 'plus',
      target: 'fusebox-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 25, fuseSize: 63 },
    },
    {
      id: 'e-fuse-fridge',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-fridge',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 4 },
    },
    {
      id: 'e-fuse-pump',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-pump',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 4, crossSection: 2.5 },
    },
    {
      id: 'e-fuse-light',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-light',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 5, crossSection: 1.5 },
    },
    {
      id: 'e-busbar-inv-plus',
      source: 'busbar-plus',
      sourceHandle: 'plus',
      target: 'inverter-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 25, fuseSize: 60 },
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
      data: { length: 2, crossSection: 2.5, edgeDomain: 'AC_230V' },
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
      data: { label: 'Starterbatterie', capacity: 90, chemistry: 'AGM' },
    },
    {
      id: 'shore-1',
      type: 'shorePower',
      position: { x: 80, y: 420 },
      data: { label: 'Landstrom', hasRcd: true },
    },
    {
      id: 'battery-1',
      type: 'battery',
      position: { x: 80, y: 600 },
      data: { label: '200Ah Lithium', capacity: 200, chemistry: 'LiFePO4' },
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
      data: { label: 'DC-DC Ladebooster', amps: 20 },
    },
    { id: 'busbar-plus', type: 'busbar', position: { x: 380, y: 496 }, data: { label: 'Plus Busbar' } },
    { id: 'busbar-minus', type: 'busbar', position: { x: 380, y: 688 }, data: { label: 'Minus Busbar' } },
    { id: 'fusebox-1', type: 'fuse', position: { x: 680, y: 200 }, data: { label: 'Sicherungskasten' } },
    // AUDIT ELE-001 (2026-10 korrigiert): Die absicherbare Grenze des
    // Modells ist 70 mm² mit max. 100 A (FUSE_MAP). Der Batterie-Hauptstrang
    // trägt im worst case EINGANGSSTROM DES WECHSELRICHTERS + DC-LASTEN +
    // BOOSTER-EINGANG (alles gleichzeitig am Bus). Damit der Template-Plan
    // ohne Sicherheitsbefund startet, muss die Summe ≤ 100 A bleiben:
    // 600 W WR ⇒ 58,8 A + DC-Lasten 11,7 A + 20-A-Booster-Eingang 22,2 A
    // = 92,7 A. (Die frühere 900-W-Auslegung hatte den Booster-Eingang nicht
    // gezählt und lag mit 133 A über der Grenze — zu Recht gemeldet.)
    {
      id: 'inverter-1',
      type: 'inverter',
      position: { x: 680, y: 480 },
      data: { label: '600W Inverter', watts: 600, continuousPower: 600, hasRcd: true },
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
      data: { label: 'Induktionskochfeld (1 Platte)', watts: 500, hours: 0.5 },
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
      data: { length: 0.5, crossSection: 70, fuseSize: 100 },
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
      data: { length: 4, crossSection: 25, fuseSize: 50, edgeDomain: 'Solar' },
    },
    {
      id: 'e-charger-busbar',
      source: 'charger-1',
      sourceHandle: 'plus',
      target: 'busbar-plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 10, fuseSize: 32 },
    },
    {
      id: 'e-starter-dcdc',
      source: 'starter-1',
      sourceHandle: 'plus',
      target: 'charger-2',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 5, crossSection: 16, fuseSize: 40 },
    },
    {
      id: 'e-dcdc-busbar',
      source: 'charger-2',
      sourceHandle: 'plus',
      target: 'busbar-plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 16, fuseSize: 40 },
    },
    {
      id: 'e-busbar-fuse',
      source: 'busbar-plus',
      sourceHandle: 'plus',
      target: 'fusebox-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 70, fuseSize: 100 },
    },
    {
      id: 'e-fuse-fridge',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-fridge',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 4 },
    },
    {
      id: 'e-fuse-heat',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-heat',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 4, crossSection: 4 },
    },
    {
      id: 'e-fuse-fan',
      source: 'fusebox-1',
      sourceHandle: 'plus',
      target: 'cons-fan',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 2.5 },
    },
    {
      id: 'e-busbar-inv-plus',
      source: 'busbar-plus',
      sourceHandle: 'plus',
      target: 'inverter-1',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 70, fuseSize: 100 },
    },
    {
      id: 'e-busbar-inv-minus',
      source: 'busbar-minus',
      sourceHandle: 'minus',
      target: 'inverter-1',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: { length: 1, crossSection: 70 },
    },
    {
      id: 'e-inv-induct',
      source: 'inverter-1',
      sourceHandle: 'plus',
      target: 'cons-induct',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 2, crossSection: 2.5, edgeDomain: 'AC_230V' },
    },
    {
      id: 'e-shore-inv',
      source: 'shore-1',
      sourceHandle: 'plus',
      target: 'inverter-1',
      targetHandle: 'ac_in',
      type: 'cableEdge',
      data: { length: 2, crossSection: 2.5, fuseSize: 16, edgeDomain: 'AC_230V' },
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
  'e-batt-plus': { crossSection: 50, fuseSize: 80, fuseType: 'classT' },
  'e-batt-minus': { crossSection: 50 },
  'e-solar-charger': { fuseType: 'classT' },
  'e-charger-busbar': { fuseType: 'classT' },
  'e-starter-dcdc': { fuseType: 'classT' },
  'e-dcdc-busbar': { fuseType: 'classT' },
  'e-busbar-fuse': { fuseSize: 40, fuseType: 'classT' },
  'e-fuse-fridge': { fuseSize: 10, fuseType: 'classT' },
  'e-fuse-pump': { fuseSize: 10, fuseType: 'classT' },
  'e-fuse-light': { fuseSize: 5, fuseType: 'classT' },
  'e-busbar-inv-plus': { fuseSize: 50, fuseType: 'classT' },
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
      'Für lange Standzeiten und Winter: 200 Ah LiFePO4, 400 W Solar, Ladebooster, Landstrom, Standheizung und Wechselrichter mit Induktionskochfeld.',
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

/**
 * Ist der aktuelle Plan noch das unveränderte Beispiel-Setup? Dann ist er
 * kein eigener Plan: Ersetzen oder Leeren braucht keine Rückfrage, die sonst
 * jeden Erstbesucher im Onboarding mit einem Bestätigungsdialog begrüßt.
 */
export function isStarterPlan(nodes: readonly { id: string }[], edges: readonly { id: string }[]): boolean {
  const starter = TEMPLATE_KASTENWAGEN;
  if (nodes.length !== starter.nodes.length || edges.length !== starter.edges.length) return false;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  return (
    starter.nodes.every((node) => nodeIds.has(node.id)) && starter.edges.every((edge) => edgeIds.has(edge.id))
  );
}
