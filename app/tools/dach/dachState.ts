/**
 * app/tools/dach/dachState.ts — Dach-Anordnung speichern und als Link teilen.
 *
 * Bislang lebte die Dach-Anordnung nur im Speicher der Seite: Wer in den
 * Schaltplan wechselte und zurückkam, fand ein leeres Dach vor (nur die
 * Gesamt-Wattzahl überlebte im globalen Store). Dieses Modul ist der
 * eine Vertrag für beides:
 *
 *  1. Persistenz im Browser (`localStorage`, Schlüssel `12v-planer.dach.v1`)
 *     — derselbe Grundsatz wie beim Plan: kein Server, kein Konto.
 *  2. Teilen-Link `#dach=z.<base64url>` (deflate, wenn `CompressionStream`
 *     existiert) oder `#dach=r.<base64url>` (unkomprimiert; das Präfix sagt
 *     ausdrücklich, welche Form vorliegt — wie in `store/sharePlan.ts`).
 *
 * Gespeichert werden nur platzierte Elemente (Solar/Dachfenster) mit
 * Position, Pixelgröße und den Fachdaten (Watt, cm-Maße). Callbacks
 * (`onNodeResize`) und abgeleitete Prüfvermerke (`isInvalid`,
 * `isOverlapping`) gehören nicht in den Stand — sie entstehen beim Laden
 * neu (Callback wird wieder angehängt, Validierung läuft erneut).
 *
 * Das Parsen ist streng (Whitelist der Typen, endliche Zahlen, Obergrenzen):
 * Ein manipulierter oder abgeschnittener Link ersetzt die aktuelle
 * Anordnung nie still, sondern wird abgelehnt.
 */

import type { Node } from '@xyflow/react';

import { nodeHeight, nodeWidth } from '@/components/edges/utils/nodeGeometry';
import type { RoofNodeData } from '@/components/nodes/types';

export const DACH_STORAGE_KEY = '12v-planer.dach.v1';

/** Maximale Länge des Hash-Werts — ein Forum-Link, kein Dateiarchiv. */
export const DACH_SHARE_HASH_MAX_LENGTH = 60_000;

const MAX_NODES = 64;
const COMPRESSED_PREFIX = 'z.';
const RAW_PREFIX = 'r.';

export type DachSavedNode = {
  id: string;
  type: 'roofSolar' | 'roofWindow';
  position: { x: number; y: number };
  width: number;
  height: number;
  data: {
    label?: string;
    watts?: number;
    width?: number;
    height?: number;
  };
};

export type DachPlanState = {
  version: 1;
  vehicleId: string;
  nodes: DachSavedNode[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** React-Flow-Knoten → gespeicherte Form (ohne Callbacks und Prüfvermerke). */
export function serializeDachState(vehicleId: string, nodes: readonly Node<RoofNodeData>[]): DachPlanState {
  return {
    version: 1,
    vehicleId,
    nodes: nodes
      .filter((node) => node.type === 'roofSolar' || node.type === 'roofWindow')
      .map((node) => ({
        id: node.id,
        type: node.type as 'roofSolar' | 'roofWindow',
        position: { x: node.position.x, y: node.position.y },
        width: nodeWidth(node, 0),
        height: nodeHeight(node, 0),
        data: {
          label: node.data?.label,
          watts: node.data?.watts,
          width: node.data?.width,
          height: node.data?.height,
        },
      })),
  };
}

/** Rohe (geparste) Daten → geprüfter Dach-Stand oder `null`. */
export function parseDachState(value: unknown): DachPlanState | null {
  if (typeof value !== 'object' || value === null) return null;
  const state = value as Record<string, unknown>;
  if (state.version !== 1) return null;
  if (typeof state.vehicleId !== 'string' || state.vehicleId.length === 0 || state.vehicleId.length > 80) {
    return null;
  }
  if (!Array.isArray(state.nodes) || state.nodes.length > MAX_NODES) return null;

  const nodes: DachSavedNode[] = [];
  for (const raw of state.nodes) {
    if (typeof raw !== 'object' || raw === null) return null;
    const eintrag = raw as Record<string, unknown>;
    if (typeof eintrag.id !== 'string' || eintrag.id.length === 0 || eintrag.id.length > 80) return null;
    if (eintrag.type !== 'roofSolar' && eintrag.type !== 'roofWindow') return null;
    const position = eintrag.position as Record<string, unknown> | null;
    if (!position || !isFiniteNumber(position.x) || !isFiniteNumber(position.y)) return null;
    if (!isFiniteNumber(eintrag.width) || !isFiniteNumber(eintrag.height)) return null;
    if (eintrag.width <= 0 || eintrag.width > 4000 || eintrag.height <= 0 || eintrag.height > 4000)
      return null;
    const data = (typeof eintrag.data === 'object' && eintrag.data !== null ? eintrag.data : {}) as Record<
      string,
      unknown
    >;
    const saved: DachSavedNode = {
      id: eintrag.id,
      type: eintrag.type,
      position: { x: position.x, y: position.y },
      width: eintrag.width,
      height: eintrag.height,
      data: {},
    };
    if (typeof data.label === 'string' && data.label.length <= 80) saved.data.label = data.label;
    if (isFiniteNumber(data.watts) && data.watts >= 0 && data.watts <= 10_000) saved.data.watts = data.watts;
    if (isFiniteNumber(data.width) && data.width > 0 && data.width <= 2000) saved.data.width = data.width;
    if (isFiniteNumber(data.height) && data.height > 0 && data.height <= 2000)
      saved.data.height = data.height;
    nodes.push(saved);
  }
  return { version: 1, vehicleId: state.vehicleId, nodes };
}

/* ---- Persistenz -------------------------------------------------------- */

export function loadDachState(): DachPlanState | null {
  try {
    const raw = window.localStorage.getItem(DACH_STORAGE_KEY);
    if (!raw) return null;
    return parseDachState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDachState(state: DachPlanState): void {
  try {
    window.localStorage.setItem(DACH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Privater Modus / volles Kontingent: Die Anordnung bleibt für diese
    // Sitzung nutzbar, wird nur nicht über das Schließen hinaus gerettet.
  }
}

/* ---- Teilen-Link ------------------------------------------------------- */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Der Link enthält ungültige Zeichen.');
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function pipeThrough(
  stream: { writable: WritableStream<BufferSource>; readable: ReadableStream<Uint8Array> },
  bytes: Uint8Array
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const writing = (async () => {
    await writer.write(bytes as Uint8Array<ArrayBuffer>);
    await writer.close();
  })();
  const writingObserved = writing.catch((error: unknown) => error);
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const writeError = await writingObserved;
    if (writeError instanceof Error) throw writeError;
  } finally {
    reader.releaseLock();
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Dach-Stand → Hash-Wert (`z.…` komprimiert, sonst ausdrücklich `r.…`). */
export async function encodeDachShare(state: DachPlanState): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  if (typeof CompressionStream !== 'undefined') {
    const compressed = await pipeThrough(new CompressionStream('deflate'), bytes);
    return COMPRESSED_PREFIX + bytesToBase64Url(compressed);
  }
  return RAW_PREFIX + bytesToBase64Url(bytes);
}

/** Fertige Teilen-URL auf den Dach-Planer. */
export async function buildDachShareUrl(state: DachPlanState, baseUrl: string): Promise<string> {
  const encoded = await encodeDachShare(state);
  if (encoded.length > DACH_SHARE_HASH_MAX_LENGTH) {
    throw new Error('Die Dach-Anordnung ist zu umfangreich für einen Link.');
  }
  return `${baseUrl}#dach=${encoded}`;
}

/**
 * Hash (`#dach=…`) → Dach-Stand. `null`, wenn kein Dach-Parameter vorliegt;
 * eine `Error`, wenn einer vorliegt, aber nicht lesbar ist — der Aufrufer
 * zeigt das als Rückmeldung statt still den gespeicherten Stand zu nehmen.
 */
export async function parseDachShareHash(hash: string): Promise<DachPlanState | null> {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const value = params.get('dach');
  if (!value) return null;
  if (value.length > DACH_SHARE_HASH_MAX_LENGTH) throw new Error('Der Dach-Link ist zu lang.');

  let bytes: Uint8Array;
  if (value.startsWith(COMPRESSED_PREFIX)) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Dieser Browser kann den komprimierten Dach-Link nicht lesen.');
    }
    bytes = await pipeThrough(
      new DecompressionStream('deflate'),
      base64UrlToBytes(value.slice(COMPRESSED_PREFIX.length))
    );
  } else if (value.startsWith(RAW_PREFIX)) {
    bytes = base64UrlToBytes(value.slice(RAW_PREFIX.length));
  } else {
    throw new Error('Der Dach-Link hat ein unbekanntes Format.');
  }
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  const state = parseDachState(parsed);
  if (!state) throw new Error('Der Dach-Link enthält keine gültige Anordnung.');
  return state;
}
