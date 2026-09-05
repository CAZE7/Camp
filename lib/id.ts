/**
 * lib/id.ts — kollisionsarme IDs ohne Secure-Context-Voraussetzung.
 *
 * `crypto.randomUUID()` existiert nur in sicheren Kontexten (HTTPS oder
 * localhost). Der Planer wird im Alltag oft per `http://<LAN-IP>:3000` auf dem
 * Handy getestet — dort warf jede Node-Operation einen TypeError, weil
 * `crypto.randomUUID` dort `undefined` ist. Diese Funktion ist die einzige
 * Quelle für Kanten-/Node-IDs und fällt kontrolliert zurück:
 *
 *   1. crypto.randomUUID (sicherer Kontext)
 *   2. crypto.getRandomValues (überall verfügbar, auch http)
 *   3. Math.random (letzte Rückfalllinie; IDs müssen nur innerhalb einer
 *      Sitzung eindeutig sein, der Plan lebt ohnehin im localStorage)
 */

const HEX = '0123456789abcdef';

function uuidFromRandomValues(cryptoObj: Crypto): string | null {
  if (typeof cryptoObj.getRandomValues !== 'function') return null;
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  // Version 4 und Variant-Rbits wie bei UUIDv4 setzen.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  let out = '';
  for (let i = 0; i < 16; i++) {
    const b = bytes[i]!;
    out += HEX.charAt(b >> 4) + HEX.charAt(b & 0x0f);
    if (i === 3 || i === 5 || i === 7 || i === 9) out += '-';
  }
  return out;
}

function uuidFallback(): string {
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14)
      out += '4'; // Version 4
    else if (i === 19)
      out += HEX.charAt(8 + Math.floor(Math.random() * 4)); // Variant 01xx
    else out += HEX.charAt(Math.floor(Math.random() * 16));
  }
  return out;
}

/** Erzeugt eine UUID-v4-förmige, innerhalb der Sitzung eindeutige ID. */
export function newEntityId(): string {
  const cryptoObj = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    try {
      return cryptoObj.randomUUID();
    } catch {
      // Manche Browser werfen im unsicheren Kontext statt zu fehlen — weiter.
    }
  }
  if (cryptoObj) {
    const viaRandom = uuidFromRandomValues(cryptoObj);
    if (viaRandom) return viaRandom;
  }
  return uuidFallback();
}
