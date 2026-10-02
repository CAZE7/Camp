/*
 * Chat-Endpunkt (Development-Server, ADR 0021): Läuft im Static Export
 * (`output: 'export'`) nicht — die App verweist ihn über
 * NEXT_PUBLIC_CHAT_API_URL auf einen externen Serverless-Endpoint.
 *
 * Typisierung (FOLLOW-UP aus dem Werft-Altbestand, 2026-10-02 erledigt):
 * Client-Nachrichten kommen als `unknown` herein und werden in
 * `validateMessages` zur Laufzeit geprüft; erst danach tragen sie den
 * `Message`-Typ. Datenbankzeilen werden an der Kante in benannte Row-Typen
 * überführt — keine `any`-Flucht mehr (AGENTS.md M6-1).
 */
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, embed, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import pool from '../../../lib/db';
import type { PoolClient } from 'pg';

interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool' | 'data';
  content: string;
  parts?: UIMessage['parts'];
}

/** Zeile der Knowledge-Chunks-Tabelle (nur die gelesenen Spalten). */
type KnowledgeRow = { content: unknown };

/** Zeile der Produktabfrage (nur die gelesenen Spalten). */
type ProductRow = {
  name: string;
  brand: string;
  price: number;
  cross_section: number;
};

/** Validiertes Kabel aus einer Nutzer-Stückliste. */
type BomCable = { crossSection: number; length?: number };

/** Empfehlung für die Antwort, gruppiert nach Querschnitt. */
type BomRecommendation = {
  needed_crossSection: number;
  length: number | undefined;
  recommendations: ProductRow[];
};

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// EINFACHE, SPEICHERLOSE RATENBEGRENZUNG (pro Prozess / Edge-Instance)
// Reicht, um einen öffentlichen Endpunkt vor Missbrauch zu schützen. Bei
// mehreren Replikas sollte der Map-State in Redis/Upstash ausgelagert werden.
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
/**
 * S3/S4 (AUDIT): Die Map hing vorher unbegrenzt am Prozess — jeder erfundene
 * `X-Forwarded-For`-Wert legte einen neuen Eintrag an (Speicher-Erschöpfung
 * ohne jede Anfrage-Grenze; die Grenze greift pro Schlüssel, nicht global).
 * Zwei Änderungen: harte Obergrenze mit Prune abgelaufener Einträge und ein
 * globales Zählerfenster, damit ein Angreifer mit rotierenden Schlüsseln die
 * Gesamtlast nicht beliebig hochtreiben kann.
 */
const RATE_LIMIT_MAX_KEYS = 2_000;
const RATE_LIMIT_GLOBAL_MAX = 120;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let globalWindow = { count: 0, resetAt: 0 };

function pruneRateLimitMap(now: number): void {
  if (rateLimitMap.size < RATE_LIMIT_MAX_KEYS) return;
  for (const [key, value] of rateLimitMap) {
    if (value.resetAt < now) rateLimitMap.delete(key);
  }
  // Immer noch zu groß (alle Einträge frisch): die ältesten zuerst räumen.
  while (rateLimitMap.size >= RATE_LIMIT_MAX_KEYS) {
    const oldest = rateLimitMap.keys().next();
    if (oldest.done) break;
    rateLimitMap.delete(oldest.value);
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'anonymous';
  return req.headers.get('x-real-ip') || 'anonymous';
}

function checkRateLimit(req: Request): { allowed: boolean; retryAfter: number } {
  // Rate-Limiting wird in der Test-Umgebung deaktiviert, damit deterministische
  // Integrationstests nicht durch den gemeinsamen In-Memory-Zähler blockieren.
  if (process.env.NODE_ENV === 'test') {
    return { allowed: true, retryAfter: 0 };
  }
  const ip = getClientIp(req);
  const now = Date.now();
  if (globalWindow.resetAt < now) globalWindow = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  globalWindow.count += 1;
  if (globalWindow.count > RATE_LIMIT_GLOBAL_MAX) {
    return { allowed: false, retryAfter: Math.ceil((globalWindow.resetAt - now) / 1000) };
  }
  pruneRateLimitMap(now);
  const existing = rateLimitMap.get(ip);
  if (!existing || existing.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}

/**
 * S1 (AUDIT): Die Route war **fail-open** — ohne gesetztes `CHAT_SHARED_SECRET`
 * durfte jeder, der den Endpunkt erreicht, auf Kosten des Betreibers Tokens
 * verbrauchen. Schlimmer: Der Schlüssel wurde als `NEXT_PUBLIC_CHAT_TOKEN`
 * ausgeliefert und landete damit im Client-Bundle — ein „Secret“, das jeder
 * Besucher im Quelltext lesen kann (und das in einer statisch gehosteten
 * Variante zwangsläufig öffentlich ist).
 *
 * Jetzt gilt: Entweder ist ein serverseitiges `CHAT_SHARED_SECRET` gesetzt und
 * muss als `x-chat-token` mitkommen — oder die Anfrage kommt nachweislich von
 * der eigenen Seite (produktionsseitig same-origin). Ist beides nicht erfüllt,
 * wird abgelehnt; es gibt keinen offenen Zweig mehr.
 */
function unauthorized(reason: string): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized', reason }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Vergleich ohne frühen Abbruch (Timing-Seite bei Shared Secrets). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function assertAuthorized(req: Request): Response | null {
  const expected = process.env.CHAT_SHARED_SECRET;
  if (expected && expected.length > 0) {
    const provided = req.headers.get('x-chat-token') ?? '';
    return timingSafeEqual(provided, expected) ? null : unauthorized('invalid-token');
  }
  // Kein Secret konfiguriert: nur eigene Seiten dürfen den Chat nutzen.
  // In Entwicklung und Test bleibt der direkte Aufruf möglich (dort gibt es
  // keine fremden Webseiten, die den Endpunkt missbrauchen könnten).
  if (process.env.NODE_ENV !== 'production') return null;
  const site = req.headers.get('sec-fetch-site');
  if (site === 'cross-site') return unauthorized('cross-site');
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!origin || !host) return unauthorized('missing-origin');
  try {
    if (new URL(origin).host !== host) return unauthorized('origin-mismatch');
  } catch {
    return unauthorized('invalid-origin');
  }
  return null;
}

function applySecurityHeaders(headers: Headers): Headers {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  return headers;
}

const badRequest = (error: string): Response =>
  new Response(JSON.stringify({ error }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function validateMessages(messages: unknown[]): Response | null {
  const MAX_MESSAGES = 100;
  const MAX_CONTENT_LENGTH = 10000;
  const MAX_PARTS = 10;

  if (!Array.isArray(messages) || messages.length === 0) {
    return badRequest('messages must be a non-empty array');
  }

  if (messages.length > MAX_MESSAGES) {
    return badRequest(`Too many messages. Maximum is ${MAX_MESSAGES}`);
  }

  for (const msg of messages) {
    if (!isRecord(msg)) {
      return badRequest('Invalid message format');
    }

    if (typeof msg.id !== 'string' || msg.id.length === 0) {
      return badRequest('Message id is required and must be a string');
    }

    // S2 (AUDIT): Der Client konnte `role: 'system'` mitschicken und damit
    // eigene Anweisungen auf Systemebene in den Prompt legen. Die Rolle des
    // Systemprompts vergibt ausschließlich der Server (siehe unten).
    if (msg.role === 'system') {
      return badRequest('Message role not allowed');
    }

    if (msg.role !== 'user' && msg.role !== 'assistant' && msg.role !== 'tool' && msg.role !== 'data') {
      return badRequest('Invalid message role');
    }

    if (msg.content !== undefined && typeof msg.content !== 'string') {
      return badRequest('Message content must be a string');
    }

    if (typeof msg.content === 'string' && msg.content.length > MAX_CONTENT_LENGTH) {
      return badRequest(`Message content too long. Maximum is ${MAX_CONTENT_LENGTH} characters`);
    }

    if (msg.parts !== undefined) {
      if (!Array.isArray(msg.parts)) {
        return badRequest('Message parts must be an array');
      }

      if (msg.parts.length > MAX_PARTS) {
        return badRequest(`Too many message parts. Maximum is ${MAX_PARTS}`);
      }

      for (const part of msg.parts) {
        if (!isRecord(part) || typeof part.type !== 'string' || part.type.length === 0) {
          return badRequest('Invalid message part format');
        }
        if (part.type === 'text' && typeof part.text === 'string' && part.text.length > MAX_CONTENT_LENGTH) {
          return badRequest(`Message part text too long. Maximum is ${MAX_CONTENT_LENGTH} characters`);
        }
      }
    }
  }

  return null;
}

async function performKnowledgeRAG(client: PoolClient, userQuery: string): Promise<string> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: userQuery,
  });

  const knowledgeQuery = `
    SELECT content, metadata
    FROM Knowledge_Chunks
    ORDER BY embedding <-> $1::vector
    LIMIT 3
  `;
  const knowledgeRes = await client.query(knowledgeQuery, [JSON.stringify(embedding)]);
  const rows = knowledgeRes.rows as KnowledgeRow[];
  return rows.map((row) => String(row.content)).join('\n\n');
}

/**
 * Robustes BOM-Parsing: Akzeptiert ```json ... ``` sowohl mit LF als auch
 * CRLF, mit oder ohne Sprache, mit beliebiger Einrückung und erlaubt
 * vor-/nachgestellten Text im selben User-Part.
 */
function extractBomJson(userQuery: string): string | null {
  if (!userQuery) return null;
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const match = userQuery.match(fenceRegex);
  if (!match || !match[1]) return null;
  return match[1].trim();
}

/** Querschnitt ist eine endliche, positive Zahl in einem plausiblen Bereich (mm²). */
const isValidCrossSection = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1000;

/** Länge ist optional; wenn vorhanden, eine endliche, nicht-negative Zahl (m). */
const isValidLength = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);

/** Type-Guard für ein Kabelobjekt aus der Nutzer-Stückliste. */
function isBomCable(value: unknown): value is BomCable {
  return isRecord(value) && isValidCrossSection(value.crossSection) && isValidLength(value.length);
}

async function extractAndProcessBOM(client: PoolClient, userQuery: string): Promise<string> {
  const bomContent = extractBomJson(userQuery);
  if (!bomContent) {
    return '';
  }

  let bom: unknown;
  try {
    bom = JSON.parse(bomContent);
  } catch (e) {
    console.error('Failed to parse BOM JSON:', e);
    return '';
  }
  // Security: Validate parsed JSON structure and types
  if (!isRecord(bom) || !Array.isArray(bom.cables)) {
    return '';
  }

  // DoS Protection: Limit the number of items processed
  const MAX_BOM_CABLES = 50;
  const rawCables: unknown[] = bom.cables.slice(0, MAX_BOM_CABLES);

  // Input Validation: Filter for valid cable objects with numeric cross-sections
  const validCables = rawCables.filter(isBomCable);

  const uniqueCrossSections = Array.from(new Set(validCables.map((cable) => cable.crossSection)));

  const recommendedProducts: BomRecommendation[] = [];

  if (uniqueCrossSections.length > 0) {
    // Optimized: Fetch all matching products for all unique crossSections in a single query
    // Using a Window Function (ROW_NUMBER) to get the top 2 cheapest products per cross_section
    const productQuery = `
      WITH RankedProducts AS (
        SELECT name, brand, price, cross_section,
               ROW_NUMBER() OVER(PARTITION BY cross_section ORDER BY price ASC) as rank
        FROM Components
        WHERE type = 'cable' AND cross_section = ANY($1)
      )
      SELECT name, brand, price, cross_section
      FROM RankedProducts
      WHERE rank <= 2
      ORDER BY cross_section, price ASC
    `;
    const productRes = await client.query(productQuery, [uniqueCrossSections]);
    const productRows = productRes.rows as ProductRow[];

    // Group the database results by cross_section for efficient lookup
    const productsByCrossSection = new Map<number, ProductRow[]>();
    for (const row of productRows) {
      const cs = row.cross_section;
      const arr = productsByCrossSection.get(cs) ?? [];
      arr.push(row);
      productsByCrossSection.set(cs, arr);
    }

    // Map back to the validated cables list to preserve order and include lengths
    for (const cable of validCables) {
      const recommendations = productsByCrossSection.get(cable.crossSection);
      if (recommendations) {
        recommendedProducts.push({
          needed_crossSection: cable.crossSection,
          length: cable.length,
          recommendations,
        });
      }
    }
  }

  if (recommendedProducts.length > 0) {
    return JSON.stringify(recommendedProducts, null, 2);
  }

  return '';
}

/** Erster nicht-leerer Text-Part der Nachricht, sonst der Inhalt (Legacy-Format). */
function userQueryOf(message: Message | undefined): string {
  if (!message) return '';
  const textParts = message.parts
    ?.map((part) => (part.type === 'text' ? part.text : null))
    .filter((text): text is string => Boolean(text));
  return (textParts && textParts.length > 0 ? textParts[0] : message.content) || '';
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    const headers = applySecurityHeaders(new Headers());
    return new Response(JSON.stringify({ error: 'Missing OpenAI API Key configuration' }), {
      status: 500,
      headers,
    });
  }

  // Auth + Rate-Limit
  const authError = assertAuthorized(req);
  if (authError) return authError;

  const rate = checkRateLimit(req);
  if (!rate.allowed) {
    const headers = applySecurityHeaders(new Headers({ 'Retry-After': String(rate.retryAfter) }));
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const headers = applySecurityHeaders(new Headers());
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers,
    });
  }

  if (!isRecord(body) || !Array.isArray(body.messages) || body.messages.length === 0) {
    const headers = applySecurityHeaders(new Headers());
    return new Response(JSON.stringify({ error: 'messages must be a non-empty array' }), {
      status: 400,
      headers,
    });
  }

  // Die Laufzeitprüfung in validateMessages ist die Quelle dieses Typs: Sie
  // prüft id (nicht-leerer String), Rolle (user/assistant/tool/data — system
  // wird zurückgewiesen), content (String, Länge) und parts (Array, Text-Länge).
  const messages = body.messages as Message[];

  const validationError = validateMessages(messages);
  if (validationError) {
    return validationError;
  }

  const latestMessage = messages[messages.length - 1];
  const userQuery = userQueryOf(latestMessage);

  let contextText = '';
  let productRecommendations = '';

  // Datenbank nur anfassen, wenn eine DATABASE_URL konfiguriert ist. Im
  // Static-Export ohne Backend schlägt die RAG-Pipeline sonst stillschweigend
  // pro Request fehl.
  if (process.env.DATABASE_URL) {
    let dbClient;
    try {
      dbClient = await pool.connect();
      contextText = await performKnowledgeRAG(dbClient, userQuery);
      productRecommendations = await extractAndProcessBOM(dbClient, userQuery);
    } catch (error) {
      console.error('Error during RAG pipeline:', error);
    } finally {
      if (dbClient) {
        dbClient.release();
      }
    }
  }

  // 4. Construct System Prompt
  const systemPrompt = `
Du bist ein erfahrener Camper-Ausbau Assistent und Senior Elektriker.
Beantworte die Fragen des Nutzers basierend auf deinem Wissen und dem folgenden Kontext aus unserer Datenbank.

Prüfe den Schaltplan auf folgende Fehler nach VDE-Norm:
- Fehlt ein FI-Schutzschalter (RCD mit ≤ 30 mA) nach dem Landstrom-Eingang? Falls ja, warne den Nutzer, da dies nach DIN VDE 0100-721 illegal ist.
- Werden starre NYM-Kabel verwendet? Erinnere den Nutzer, dass nur feindrähtige Leitungen im Camper erlaubt sind.
- Prüfe, ob der Wechselrichter-Verlust von ca. 15% (Faktor 0.85) bei 230V-Geräten beachtet wurde.

Formatiere dein KI-Gutachten übersichtlich und verwende Warn-Icons bei gefundenen Fehlern.

WICHTIGER KONTEXT AUS DER DATENBANK:
${contextText ? contextText : 'Kein spezifischer Kontext gefunden.'}

${
  productRecommendations
    ? `
DER NUTZER HAT EINE STÜCKLISTE (BOM) GESENDET.
HIER SIND VERIFIZIERTE PRODUKT-EMPFEHLUNGEN AUS UNSERER DATENBANK, PASSEND ZUR STÜCKLISTE:
${productRecommendations}

Bitte beziehe diese günstigen, passenden Produkte in deine Antwort ein und schlage sie dem Nutzer vor.
`
    : ''
}

Antworte auf Deutsch, sei hilfreich und verständlich.
  `;

  // 5. Call LLM with the injected system prompt
  // Die Nachrichten sind laufzeitgeprüft (validateMessages); die SDK-Typen
  // verlangen die vollständige UIMessage-Struktur, die der Client zusätzlich
  // mitschickt — der Cast über unknown macht die geprüfte Annahme sichtbar,
  // statt `any` durchzureichen.
  const modelMessages = await convertToModelMessages(messages as unknown as UIMessage[]);
  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: [{ role: 'system', content: systemPrompt }, ...modelMessages],
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages as unknown as UIMessage[],
    generateMessageId: () => `msg_${Date.now()}`,
  });

  applySecurityHeaders(response.headers);
  return response;
}
