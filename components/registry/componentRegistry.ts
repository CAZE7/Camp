import type { LucideIcon } from 'lucide-react';
import type { NodeTypes } from 'reactflow';

/**
 * Darstellungs-Komponente eines Bauteils — exakt der Typ, den React Flow in
 * seiner `nodeTypes`-Tabelle erwartet. Kein eigener Typ, damit die Registry
 * nicht von React Flow abweichen kann.
 */
export type NodeComponent = NodeTypes[string];

/**
 * components/registry/componentRegistry.ts
 *
 * Registry für Bauteildefinitionen (AGENTS.md K4).
 *
 * Warum
 * =====
 * Vor der Registry war ein Bauteil an sechs Stellen definiert:
 *
 *   1. components/Sidebar.tsx                     Label, Kategorie, Beschreibung, Icon
 *   2. components/planner/constants.ts            Typ → React-Komponente (NODE_TYPES)
 *   3. components/planner/BOMModal.tsx            Label (nochmal!) + Zweck
 *   4. components/planner/utils/domainFilter.ts   Typ → Domänen + Minimap-Farbe
 *   5. lib/electrical.ts                          AC/DC-Zuordnung der Handles
 *   6. store/usePlannerStore.ts                   Standardwerte beim Einfügen
 *
 * Die Labels in (1) und (3) waren bereits auseinandergelaufen: die Sidebar
 * nennt „Batteriemonitor (Shunt)“, die Stückliste „Batteriemonitor mit Shunt“.
 * Genau solche Drifts verhindert eine gemeinsame Quelle.
 *
 * Was die Registry bewusst NICHT tut
 * ==================================
 * Sie ersetzt keine Fachlogik. `lib/electrical.ts` (Handle-Domänen) und
 * `lib/autoWire.ts` (Topologie) bleiben unberührt: dort steht elektrische
 * Sicherheitslogik, die nicht von einer UI-Registrierung abhängen darf.
 * Die Registry beschreibt, *was* ein Bauteil ist — nicht, wie der Planer
 * daraus einen sicheren Stromkreis baut.
 *
 * Erweiterbarkeit
 * ===============
 * `registerComponent(spec)` fügt ein Bauteil zur Laufzeit hinzu. Sidebar,
 * Stückliste, Domänen-Filter, Minimap und die Node-Typ-Tabelle lesen daraus —
 * ein neues Bauteil braucht deshalb keine Änderung an zentralem Code.
 * Beleg: `components/registry/componentRegistry.test.tsx`.
 */

/** Elektrische bzw. wassertechnische Domäne eines Bauteils. */
export type SpecDomain = 'DC_12V' | 'AC_230V' | 'Solar' | 'WATER';

/** Betriebsart des Planers, in der das Bauteil angeboten wird. */
export type PlannerMode = 'electric' | 'water';

/** Ein Anschluss des Bauteils (Spiegel der React-Flow-Handles). */
export type HandleSpec = {
  /** Handle-ID, exakt wie im Node-Markup (`data-handleid`). */
  id: string;
  /** Richtung aus Sicht von React Flow. */
  type: 'source' | 'target';
  /** Domäne des Anschlusses — Grundlage der AC/DC-Trennung in der UI. */
  domain: Exclude<SpecDomain, 'Solar'>;
};

export type ComponentSpec = {
  /** Eindeutige ID — identisch mit `node.type` im Plan. */
  id: string;
  /** Anzeigename in Sidebar, Stückliste und Inspector. */
  label: string;
  /** Gruppierung in der Sidebar. */
  category: string;
  /** Kurzbeschreibung in der Sidebar (was das Bauteil tut). */
  description: string;
  /** Zweck in der Stückliste (warum man es braucht). */
  purpose: string;
  /** In welcher Betriebsart das Bauteil angeboten wird. */
  mode: PlannerMode;
  /** Domänen für Filter und Minimap-Farbe. */
  domains: SpecDomain[];
  /** Icon in der Sidebar. */
  icon: LucideIcon;
  /** React-Komponente für die Darstellung im Canvas. */
  node: NodeComponent;
  /** Anschlüsse — für Dokumentation und Validierung. */
  handles: HandleSpec[];
  /** Startwerte für `node.data` beim Einfügen. */
  defaults?: Readonly<Record<string, unknown>>;
  /** Wird in der Sidebar angeboten? (Auto-Wire-Hilfsbauteile z. B. nicht.) */
  selectable?: boolean;
};

/** Fehler mit Bezug auf eine konkrete Spec — erleichtert die Fehlersuche. */
export class ComponentSpecError extends Error {
  constructor(specId: string, message: string) {
    super(`ComponentSpec "${specId}": ${message}`);
    this.name = 'ComponentSpecError';
  }
}

const VALID_DOMAINS: readonly SpecDomain[] = ['DC_12V', 'AC_230V', 'Solar', 'WATER'];

/**
 * Laufzeit-Validierung. Ein unvollständiges Bauteil soll beim Registrieren
 * scheitern und nicht erst als leere Kachel oder als „undefined“ in der
 * Stückliste auffallen.
 */
export function assertValidSpec(spec: ComponentSpec): void {
  const fail = (message: string): never => {
    throw new ComponentSpecError(spec?.id ?? '(ohne id)', message);
  };

  if (!spec || typeof spec !== 'object') fail('ist kein Objekt');
  if (!spec.id || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(spec.id)) {
    fail('id fehlt oder ist kein einfacher Bezeichner');
  }
  for (const field of ['label', 'category', 'description', 'purpose'] as const) {
    if (typeof spec[field] !== 'string' || spec[field].trim() === '') {
      fail(`${field} fehlt`);
    }
  }
  if (spec.mode !== 'electric' && spec.mode !== 'water') fail('mode muss electric oder water sein');
  if (!Array.isArray(spec.domains) || spec.domains.length === 0) fail('domains fehlt');
  for (const domain of spec.domains) {
    if (!VALID_DOMAINS.includes(domain)) fail(`unbekannte Domäne "${domain}"`);
  }
  if (typeof spec.icon !== 'function' && typeof spec.icon !== 'object') fail('icon fehlt');
  if (typeof spec.node !== 'function' && typeof spec.node !== 'object') fail('node fehlt');
  if (!Array.isArray(spec.handles)) fail('handles fehlt');

  const seen = new Set<string>();
  for (const handle of spec.handles) {
    if (!handle.id) fail('Handle ohne id');
    const key = `${handle.type}:${handle.id}`;
    if (seen.has(key)) fail(`doppelter Anschluss "${key}"`);
    seen.add(key);
    if (handle.type !== 'source' && handle.type !== 'target') {
      fail(`Anschluss "${handle.id}" hat unbekannten type`);
    }
    if (handle.domain !== 'DC_12V' && handle.domain !== 'AC_230V' && handle.domain !== 'WATER') {
      fail(`Anschluss "${handle.id}" hat unbekannte Domäne`);
    }
  }
  // Ein Bauteil im Wassermodus mit elektrischen Anschlüssen (oder umgekehrt)
  // ist fast immer ein Copy-Paste-Fehler.
  if (spec.mode === 'water' && spec.handles.some((handle) => handle.domain !== 'WATER')) {
    fail('Wasser-Bauteil mit elektrischem Anschluss');
  }
  if (spec.mode === 'electric' && spec.handles.some((handle) => handle.domain === 'WATER')) {
    fail('Elektrik-Bauteil mit Wasseranschluss');
  }
}

const registry = new Map<string, ComponentSpec>();

/**
 * Registriert ein Bauteil. Wirft bei doppelter ID oder ungültiger Spec —
 * eine stillschweigend überschriebene Definition wäre schlimmer als ein
 * lauter Fehler beim Start.
 */
export function registerComponent(spec: ComponentSpec): ComponentSpec {
  assertValidSpec(spec);
  if (registry.has(spec.id)) {
    throw new ComponentSpecError(spec.id, 'ist bereits registriert');
  }
  registry.set(spec.id, spec);
  return spec;
}

/** Mehrere Bauteile registrieren (Reihenfolge bleibt erhalten). */
export function registerComponents(specs: readonly ComponentSpec[]): void {
  for (const spec of specs) registerComponent(spec);
}

/** Entfernt eine Registrierung — ausschließlich für Tests gedacht. */
export function unregisterComponent(id: string): boolean {
  return registry.delete(id);
}

export function getComponentSpec(id: string | undefined): ComponentSpec | undefined {
  return id ? registry.get(id) : undefined;
}

export function hasComponentSpec(id: string | undefined): boolean {
  return id !== undefined && registry.has(id);
}

/** Alle Bauteile, optional auf eine Betriebsart gefiltert. */
export function listComponentSpecs(mode?: PlannerMode): ComponentSpec[] {
  const all = Array.from(registry.values());
  return mode ? all.filter((spec) => spec.mode === mode) : all;
}

/** Bauteile, die in der Sidebar angeboten werden. */
export function listSelectableSpecs(mode: PlannerMode): ComponentSpec[] {
  return listComponentSpecs(mode).filter((spec) => spec.selectable !== false);
}

/** Typ → React-Komponente, wie React Flow es erwartet. */
export function buildNodeTypes(): NodeTypes {
  const types: NodeTypes = {};
  for (const spec of Array.from(registry.values())) types[spec.id] = spec.node;
  return types;
}

/** Label eines Bauteiltyps mit Rückfallwert für unbekannte Typen. */
export function labelOfType(id: string | undefined, fallback = 'Unbekanntes Bauteil'): string {
  return getComponentSpec(id)?.label ?? fallback;
}

/** Anzahl registrierter Bauteile — für Tests und Diagnose. */
export function componentCount(): number {
  return registry.size;
}
