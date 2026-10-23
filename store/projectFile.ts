/**
 * Projektdatei (.json) — Export und strikter Import eines Plans.
 *
 * Zweck: Ein Plan soll außerhalb des Browser-Speichers gesichert, weitergegeben
 * und später wieder bearbeitet werden können. Die Datei ist die Wahrheit für
 * den fachlichen Planinhalt; Messwerte der Darstellung (`measured`, `width`,
 * `height`) gehören NICHT hinein (siehe `stripNodeMeasurement`).
 *
 * Vertrag (Format `camp-elektroplaner-projekt`, Version 1)
 * ---------------------------------------------------------
 *   {
 *     "format": "camp-elektroplaner-projekt",
 *     "formatVersion": 1,
 *     "savedAt": "<ISO-Zeitstempel>",
 *     "plan": {
 *       "viewMode": "electric" | "water",
 *       "season": "summer" | "winter",
 *       "nodes": [...], "edges": [...],
 *       "waterNodes": [...], "waterEdges": [...]
 *     }
 *   }
 *
 * Import-Regeln (kein stiller Fallback)
 * -------------------------------------
 *  - Ungültiges JSON, falsches `format`, fehlende/ungültige `formatVersion`,
 *    eine NEUERE `formatVersion` als diese App kennt, zu große Datei,
 *    fehlerhafte Elemente oder Verweise auf fehlende Knoten ⇒ Import wird
 *    VOLLSTÄNDIG abgelehnt (`ok: false`, mit Fehlerliste). Der Aufrufer darf
 *    dann den aktuellen Plan nicht anfassen.
 *  - Bekannte Datenfelder mit falschem Typ werden wie beim lokalen Laden
 *    entfernt, aber ausdrücklich als Warnung gemeldet (`warnings`).
 *  - Ältere Versionen laufen durch `MIGRATIONS`, bevor sie geprüft werden.
 *    Für Version 1 gibt es noch keine Vorgängerversion, daher ist die Tabelle
 *    leer. Jede künftige Schemaänderung ergänzt hier einen Schritt `n → n+1`.
 */
import type { Edge, Node } from '@xyflow/react';
import { sanitizeEdgeDataBySchema } from '../lib/edgeSchema';
import { isKnownNodeType, sanitizeNodeDataBySchema } from '../lib/nodeSchema';
import { isEdgeShape, isNodeShape, stripNodeMeasurement } from './slices/persistence';

export const PROJECT_FILE_FORMAT = 'camp-elektroplaner-projekt';
export const PROJECT_FILE_VERSION = 1;
/** Obergrenze für eine Projektdatei. Ein realer Plan liegt weit darunter. */
export const PROJECT_FILE_MAX_BYTES = 5 * 1024 * 1024;

export type PlannerViewMode = 'electric' | 'water';
export type PlannerSeason = 'summer' | 'winter';

/** Fachlicher Planinhalt, wie er in einer Datei steht. */
export interface PlannerProjectContent {
  viewMode: PlannerViewMode;
  season: PlannerSeason;
  nodes: Node[];
  edges: Edge[];
  waterNodes: Node[];
  waterEdges: Edge[];
}

export type ProjectParseResult =
  { ok: true; plan: PlannerProjectContent; warnings: string[] } | { ok: false; errors: string[] };

type Migration = (document: Record<string, unknown>) => Record<string, unknown>;

/** Schritt `n → n+1` je Schlüssel `n`. Version 1 hat keinen Vorgänger. */
const MIGRATIONS: Readonly<Record<number, Migration>> = Object.freeze({});

const VIEW_MODES: readonly string[] = ['electric', 'water'];
const SEASONS: readonly string[] = ['summer', 'winter'];

/** Serialisiert den Planinhalt in das Dateiformat (stabil, lesbar formatiert). */
export function serializePlannerProject(
  content: PlannerProjectContent,
  savedAt: string = new Date().toISOString()
): string {
  const document = {
    format: PROJECT_FILE_FORMAT,
    formatVersion: PROJECT_FILE_VERSION,
    savedAt,
    plan: {
      viewMode: content.viewMode,
      season: content.season,
      nodes: content.nodes.map(stripNodeMeasurement),
      edges: content.edges,
      waterNodes: content.waterNodes.map(stripNodeMeasurement),
      waterEdges: content.waterEdges,
    },
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** Dateiname für den Export, z. B. `camp-plan-2026-10-12.json`. */
export function projectFileName(now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  return `camp-plan-${iso}.json`;
}

/**
 * Prüft die Elemente einer Knoten-/Kantenliste und sammelt Fehler in `errors`.
 * Duplikate der ID
 * innerhalb derselben Liste sind ein Fehler: Der Store adressiert Elemente
 * über die ID, zwei gleiche IDs würden sich gegenseitig überschreiben.
 */
function checkElements(
  label: 'Knoten' | 'Leitung' | 'Wasser-Knoten' | 'Wasserleitung',
  items: unknown[],
  isValid: (value: unknown) => boolean,
  errors: string[]
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (!isValid(item)) {
      const id =
        item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'
          ? (item as { id: string }).id
          : undefined;
      errors.push(
        `${label} an Position ${index + 1}${id ? ` (ID „${id}“)` : ''} ist unvollständig oder hat ungültige Werte (z. B. Position oder Verbindungsenden).`
      );
      return;
    }
    const id = (item as { id: string }).id;
    if (seen.has(id)) errors.push(`${label}-ID „${id}“ kommt mehrfach vor.`);
    seen.add(id);
  });
}

function checkEdgeReferences(
  edges: unknown[],
  nodeIds: ReadonlySet<string>,
  label: string,
  errors: string[]
): void {
  for (const edge of edges) {
    if (!isEdgeShape(edge)) continue; // bereits als Formfehler gemeldet
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push(
        `${label} „${edge.id}“ verweist auf einen fehlenden Knoten (${edge.source} → ${edge.target}).`
      );
    }
  }
}

/**
 * Liest und prüft eine Projektdatei. Gibt NUR bei vollständig gültiger Datei
 * einen Plan zurück; sonst eine Fehlerliste, die der Oberfläche genügt, um dem
 * Nutzer zu sagen, was zu korrigieren ist.
 */
export function parsePlannerProject(text: string): ProjectParseResult {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > PROJECT_FILE_MAX_BYTES) {
    return {
      ok: false,
      errors: [
        `Die Datei ist ${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB groß; erlaubt sind höchstens ${PROJECT_FILE_MAX_BYTES / (1024 * 1024)} MB.`,
      ],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Die Datei ist kein gültiges JSON.'] };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: ['Die Datei enthält kein Projektobjekt.'] };
  }

  let document = parsed as Record<string, unknown>;
  if (document.format !== PROJECT_FILE_FORMAT) {
    return {
      ok: false,
      errors: [
        'Die Datei ist keine Projektdatei des Camp-Elektroplaners (Feld „format“ fehlt oder ist falsch).',
      ],
    };
  }

  const version = document.formatVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, errors: ['Die Dateiversion („formatVersion“) fehlt oder ist ungültig.'] };
  }
  if (version > PROJECT_FILE_VERSION) {
    return {
      ok: false,
      errors: [
        `Die Datei stammt aus einer neueren Version des Planers (Format ${version}); diese Version kennt nur Format ${PROJECT_FILE_VERSION}. Der aktuelle Plan bleibt unverändert.`,
      ],
    };
  }
  for (let v = version; v < PROJECT_FILE_VERSION; v += 1) {
    const migrate = MIGRATIONS[v];
    if (!migrate) {
      return { ok: false, errors: [`Für Format ${v} gibt es keinen Migrationspfad.`] };
    }
    document = migrate(document);
  }

  const plan = document.plan;
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return { ok: false, errors: ['Der Abschnitt „plan“ fehlt.'] };
  }
  const p = plan as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof p.viewMode !== 'string' || !VIEW_MODES.includes(p.viewMode)) {
    errors.push('„viewMode“ fehlt oder ist weder „electric“ noch „water“.');
  }
  if (typeof p.season !== 'string' || !SEASONS.includes(p.season)) {
    errors.push('„season“ fehlt oder ist weder „summer“ noch „winter“.');
  }
  if (!Array.isArray(p.nodes)) errors.push('„nodes“ fehlt oder ist keine Liste.');
  if (!Array.isArray(p.edges)) errors.push('„edges“ fehlt oder ist keine Liste.');
  // Wasserangaben dürfen fehlen (ältere Pläne ohne Wasserbereich).
  const waterNodes = p.waterNodes === undefined ? [] : p.waterNodes;
  const waterEdges = p.waterEdges === undefined ? [] : p.waterEdges;
  if (!Array.isArray(waterNodes)) errors.push('„waterNodes“ ist keine Liste.');
  if (!Array.isArray(waterEdges)) errors.push('„waterEdges“ ist keine Liste.');

  if (errors.length > 0) return { ok: false, errors };

  const nodes = p.nodes as unknown[];
  const edges = p.edges as unknown[];
  const wNodes = waterNodes as unknown[];
  const wEdges = waterEdges as unknown[];

  checkElements('Knoten', nodes, isNodeShape, errors);
  checkElements('Leitung', edges, isEdgeShape, errors);
  checkElements('Wasser-Knoten', wNodes, isNodeShape, errors);
  checkElements('Wasserleitung', wEdges, isEdgeShape, errors);
  if (errors.length > 0) return { ok: false, errors };

  checkEdgeReferences(edges, new Set(nodes.map((n) => (n as Node).id)), 'Leitung', errors);
  checkEdgeReferences(wEdges, new Set(wNodes.map((n) => (n as Node).id)), 'Wasserleitung', errors);
  if (errors.length > 0) return { ok: false, errors };

  // Sanitisierung wie beim lokalen Laden: bekannte Felder mit falschem Typ oder
  // außerhalb des Wertebereichs werden entfernt und gemeldet, unbekannte
  // Bauteiltypen (N9) gefiltert, Messwerte der Darstellung verworfen.
  const warnings: string[] = [];
  const filterKnownNodes = (rawNodes: Node[], rawEdges: Edge[], domainLabel: string) => {
    const keptIds = new Set<string>();
    const keptNodes: Node[] = [];
    for (const node of rawNodes) {
      if (!isKnownNodeType(node.type)) {
        warnings.push(
          `${domainLabel} „${node.id}“: unbekannter Bauteiltyp „${String(node.type ?? '(fehlt)')}“ wurde ignoriert.`
        );
        continue;
      }
      keptIds.add(node.id);
      keptNodes.push(node);
    }
    const keptEdges = rawEdges.filter((edge) => {
      if (keptIds.has(edge.source) && keptIds.has(edge.target)) return true;
      warnings.push(
        `Leitung „${edge.id}“ zu ignoriertem Bauteil (${edge.source} → ${edge.target}) wurde entfernt.`
      );
      return false;
    });
    return { keptNodes, keptEdges };
  };

  const sanitizeNode = (node: Node): Node => {
    const raw = (node.data ?? {}) as Record<string, unknown>;
    const { data, removedFields } = sanitizeNodeDataBySchema(node.type, raw);
    if (removedFields.length > 0) {
      warnings.push(`Knoten „${node.id}“: ungültige Werte in ${removedFields.join(', ')} wurden verworfen.`);
    }
    return stripNodeMeasurement({ ...node, data } as Node);
  };
  const sanitizeEdge = (edge: Edge): Edge => {
    const raw = (edge.data ?? {}) as Record<string, unknown>;
    const { data, removedFields } = sanitizeEdgeDataBySchema(raw);
    if (removedFields.length > 0) {
      warnings.push(`Leitung „${edge.id}“: ungültige Werte in ${removedFields.join(', ')} wurden verworfen.`);
    }
    return { ...edge, data } as Edge;
  };

  const electricFiltered = filterKnownNodes(nodes as Node[], edges as Edge[], 'Knoten');
  const waterFiltered = filterKnownNodes(wNodes as Node[], wEdges as Edge[], 'Wasser-Knoten');

  return {
    ok: true,
    warnings,
    plan: {
      viewMode: p.viewMode as PlannerViewMode,
      season: p.season as PlannerSeason,
      nodes: electricFiltered.keptNodes.map(sanitizeNode),
      edges: electricFiltered.keptEdges.map(sanitizeEdge),
      waterNodes: waterFiltered.keptNodes.map(sanitizeNode),
      waterEdges: waterFiltered.keptEdges.map(sanitizeEdge),
    },
  };
}
