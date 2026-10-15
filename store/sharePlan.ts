/**
 * store/sharePlan.ts — „Link zum Plan teilen“ ohne Server und ohne Konto.
 *
 * Der ganze Plan steckt komprimiert im URL-Hash (`/planer/#plan=…`). Der Hash
 * verlässt den Browser nie Richtung Server; wer den Link in einem Forum oder
 * einer Gruppe postet, gibt Helfern denselben Plan im selben Werkzeug — sie
 * korrigieren einen Querschnitt und schicken den neuen Link zurück.
 *
 * Format: `#plan=z.<base64url>` (deflate-komprimiert, wenn der Browser
 * `CompressionStream` kennt) oder `#plan=r.<base64url>` (unkomprimiert als
 * ausdrücklich gekennzeichnete Alternative, kein stiller Fallback: Das
 * Präfix sagt, welche Form vorliegt, und der Decoder lehnt alles andere ab).
 *
 * Geprüft wird mit demselben Vertrag wie die Projektdatei
 * (`parsePlannerProject`): Ein manipulierter oder abgeschnittener Link
 * ersetzt den aktuellen Plan nie still, sondern liefert eine Fehlerliste.
 */
import {
  parsePlannerProject,
  serializePlannerProject,
  type PlannerProjectContent,
  type ProjectParseResult,
} from './projectFile';

/** Maximale Länge des Hash-Werts — ein Forum-Link, kein Dateiarchiv. */
export const SHARE_HASH_MAX_LENGTH = 60_000;

const COMPRESSED_PREFIX = 'z.';
const RAW_PREFIX = 'r.';

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
  // Von Hand pumpen statt `Blob.stream()`/`Response(stream)`: Beides gibt es
  // in Browsern, aber nicht in jeder Test- und Laufzeitumgebung (jsdom) —
  // Writer/Reader des TransformStream gibt es überall, wo es den Stream gibt.
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const writing = (async () => {
    await writer.write(bytes as Uint8Array<ArrayBuffer>);
    await writer.close();
  })();
  // Ein Lesefehler (beschädigte Daten) darf den Schreib-Zweig nicht als
  // unbeobachtete Ablehnung zurücklassen — er wird unten mitgelesen.
  const writingObserved = writing.catch((error: unknown) => error);
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } catch (error) {
    await writingObserved;
    throw error;
  }
  const writeError = await writingObserved;
  if (writeError !== undefined) {
    throw writeError instanceof Error
      ? writeError
      : new Error('Der Plan-Link konnte nicht verarbeitet werden.');
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

async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  return pipeThrough(new CompressionStream('deflate-raw'), bytes);
}

async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  return pipeThrough(new DecompressionStream('deflate-raw'), bytes);
}

/** Erzeugt den Hash-Wert (`plan=…`) für einen Plan. */
export async function encodeSharePlan(content: PlannerProjectContent): Promise<string> {
  // Kompakt statt hübsch: Im Link zählt jedes Zeichen, die Projektdatei im
  // Download darf weiter lesbar formatiert bleiben.
  const text = JSON.stringify(JSON.parse(serializePlannerProject(content)) as unknown);
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'undefined') {
    return `plan=${COMPRESSED_PREFIX}${bytesToBase64Url(await compress(bytes))}`;
  }
  return `plan=${RAW_PREFIX}${bytesToBase64Url(bytes)}`;
}

/** Baut die vollständige teilbare Adresse aus Basis-Adresse und Plan. */
export async function buildShareUrl(content: PlannerProjectContent, baseUrl: string): Promise<string> {
  const withoutHash = baseUrl.split('#')[0]!;
  return `${withoutHash}#${await encodeSharePlan(content)}`;
}

/** Zieht den `plan=`-Wert aus einem Hash (`#plan=…`, auch neben anderen Werten). */
export function shareValueFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === '') return null;
  return new URLSearchParams(raw).get('plan');
}

/**
 * Liest einen geteilten Plan aus dem Hash. Jeder Fehler (fremder Hash,
 * abgeschnittener Link, ungültiger Plan) ist ein `ok: false` mit Grund —
 * der Aufrufer lässt den aktuellen Plan dann unangetastet.
 */
export async function decodeSharePlan(hash: string): Promise<ProjectParseResult> {
  const value = shareValueFromHash(hash);
  if (value === null) return { ok: false, errors: ['Der Link enthält keinen Plan („plan=“ fehlt).'] };
  if (value.length > SHARE_HASH_MAX_LENGTH) {
    return { ok: false, errors: ['Der geteilte Plan ist zu groß für einen Link.'] };
  }

  let text: string;
  try {
    if (value.startsWith(COMPRESSED_PREFIX)) {
      if (typeof DecompressionStream === 'undefined') {
        return {
          ok: false,
          errors: [
            'Dieser Browser kann komprimierte Plan-Links nicht lesen. Bitte einen aktuellen Browser verwenden.',
          ],
        };
      }
      text = new TextDecoder().decode(
        await decompress(base64UrlToBytes(value.slice(COMPRESSED_PREFIX.length)))
      );
    } else if (value.startsWith(RAW_PREFIX)) {
      text = new TextDecoder().decode(base64UrlToBytes(value.slice(RAW_PREFIX.length)));
    } else {
      return { ok: false, errors: ['Der Plan-Link hat ein unbekanntes Format.'] };
    }
  } catch {
    return {
      ok: false,
      errors: ['Der Plan-Link ist beschädigt oder abgeschnitten und kann nicht gelesen werden.'],
    };
  }

  return parsePlannerProject(text);
}
