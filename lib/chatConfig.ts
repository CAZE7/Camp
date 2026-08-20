/**
 * Zentrale Konfiguration für den KI-Assistenten.
 *
 * Hintergrund: Die App wird per `output: 'export'` als statische Seite
 * gebaut (GitHub Pages). Next.js erzeugt dann KEINE Server-Routen, d. h.
 * eine eingebaute Route `app/api/chat/route.ts` ist im Static-Export nicht
 * erreichbar. Der Chat-Client muss deshalb:
 *
 *   1. eine optionale externe Backend-URL (`NEXT_PUBLIC_CHAT_API`) nutzen
 *      können,
 *   2. andernfalls die eingebaute Route inkl. BasePath ansprechen (für
 *      Node-/Edge-Deployments) und
 *   3. erkennen, wenn gar kein Backend verfügbar ist, damit der Nutzer
 *      statt einer kryptischen „Netzwerkfehler"-Meldung eine ehrliche
 *      Meldung bekommt.
 */

function getBasePath(): string {
  if (typeof window === 'undefined') return '';
  // Next.js hinterlegt den konfigurierten basePath zur Laufzeit.
  const maybeBase = (
    window as unknown as { __NEXT_DATA__?: { basePath?: string } }
  ).__NEXT_DATA__?.basePath;
  return maybeBase ?? '';
}

/**
 * Liefert die absolute oder pfadbezogene URL des Chat-Endpunkts.
 *
 * Priorität:
 *   1. `NEXT_PUBLIC_CHAT_API` (z. B. eigene Edge/Node-Funktion)
 *   2. `{basePath}/api/chat` (eingebaute Next-Route, nur bei Server-Hosting)
 */
export function getChatApiUrl(): string {
  const external = process.env.NEXT_PUBLIC_CHAT_API;
  if (external && external.trim().length > 0) {
    return external.trim();
  }
  return `${getBasePath()}/api/chat`;
}

/**
 * Ist der Chat in diesem Build aktiv?
 *
 * Auf statischem Hosting ohne konfiguriertes Backend kann der Assistent
 * nicht funktionieren. Betreiber setzen entweder `NEXT_PUBLIC_CHAT_API`
 * oder sie setzen `NEXT_PUBLIC_CHAT_ENABLED=false`, um den Trigger
 * auszublenden.
 */
export function isChatEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_CHAT_ENABLED;
  if (flag === 'false' || flag === '0') return false;
  return true;
}

/**
 * Beim Static-Export ist die eingebaute `/api/chat`-Route nicht erreichbar,
 * sofern kein externes Backend konfiguriert wurde.
 */
export function hasChatBackend(): boolean {
  const external = process.env.NEXT_PUBLIC_CHAT_API;
  return Boolean(external && external.trim().length > 0);
}
