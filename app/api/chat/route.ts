import { createOpenAI } from '@ai-sdk/openai';
import { streamText, embed, convertToModelMessages } from 'ai';
import pool from '../../../lib/db';
import type { PoolClient } from 'pg';
import type { UIMessage } from 'ai';

interface MessagePart {
  type: string;
  text?: string;
  [key: string]: any;
}

interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool' | 'data';
  content: string;
  parts?: UIMessage['parts'];
}

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
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
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
 * Optionale Authentifizierung über einen Shared-Secret-Header. Der Schlüssel
 * wird in der Client-Umgebung als NEXT_PUBLIC_CHAT_TOKEN gesetzt, wenn der
 * Chat öffentlich erreichbar sein soll. Ohne gesetzten Server-Secret ist die
 * Route weiterhin offen (für lokale Entwicklung), in der Produktion sollte
 * CHAT_SHARED_SECRET gesetzt sein.
 */
function assertAuthorized(req: Request): Response | null {
  const expected = process.env.CHAT_SHARED_SECRET;
  if (!expected || expected.length === 0) return null; // no auth configured
  const provided = req.headers.get('x-chat-token');
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

function applySecurityHeaders(headers: Headers): Headers {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  return headers;
}

function validateMessages(messages: any[]): Response | null {
  const MAX_MESSAGES = 100;
  const MAX_CONTENT_LENGTH = 10000;
  const MAX_PARTS = 10;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages must be a non-empty array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (messages.length > MAX_MESSAGES) {
    return new Response(JSON.stringify({ error: `Too many messages. Maximum is ${MAX_MESSAGES}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid message format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!msg.id || typeof msg.id !== 'string') {
      return new Response(JSON.stringify({ error: 'Message id is required and must be a string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!['system', 'user', 'assistant', 'tool', 'data'].includes(msg.role)) {
      return new Response(JSON.stringify({ error: 'Invalid message role' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (msg.content !== undefined && typeof msg.content !== 'string') {
      return new Response(JSON.stringify({ error: 'Message content must be a string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (msg.content && msg.content.length > MAX_CONTENT_LENGTH) {
      return new Response(JSON.stringify({ error: `Message content too long. Maximum is ${MAX_CONTENT_LENGTH} characters` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (msg.parts) {
      if (!Array.isArray(msg.parts)) {
        return new Response(JSON.stringify({ error: 'Message parts must be an array' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (msg.parts.length > MAX_PARTS) {
        return new Response(JSON.stringify({ error: `Too many message parts. Maximum is ${MAX_PARTS}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      for (const part of msg.parts) {
        if (!part || typeof part !== 'object' || !part.type) {
          return new Response(JSON.stringify({ error: 'Invalid message part format' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (part.type === 'text' && part.text && part.text.length > MAX_CONTENT_LENGTH) {
          return new Response(JSON.stringify({ error: `Message part text too long. Maximum is ${MAX_CONTENT_LENGTH} characters` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
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
  return knowledgeRes.rows.map((row: any) => row.content).join('\n\n');
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

async function extractAndProcessBOM(client: PoolClient, userQuery: string): Promise<string> {
  const bomContent = extractBomJson(userQuery);
  if (!bomContent) {
    return '';
  }

  let bom: any;
  try {
    bom = JSON.parse(bomContent);
  } catch (e) {
    console.error('Failed to parse BOM JSON:', e);
    return '';
  }

  // Security: Validate parsed JSON structure and types
  if (!bom || typeof bom !== 'object' || !Array.isArray(bom.cables)) {
    return '';
  }

  // DoS Protection: Limit the number of items processed
  const MAX_BOM_CABLES = 50;
  const rawCables = bom.cables.slice(0, MAX_BOM_CABLES);

  // Input Validation: Filter for valid cable objects with numeric cross-sections
  const validCables = rawCables.filter((c: any) =>
    c && typeof c === 'object' &&
    typeof c.crossSection === 'number' &&
    !isNaN(c.crossSection) &&
    c.crossSection > 0 &&
    c.crossSection < 1000 && // Reasonable upper limit for cross-section (mm²)
    (c.length === undefined || (typeof c.length === 'number' && !isNaN(c.length) && c.length >= 0))
  );

  const uniqueCrossSections = Array.from(new Set(
    validCables.map((c: any) => c.crossSection)
  ));

  const recommendedProducts: any[] = [];

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

    // Group the database results by cross_section for efficient lookup
    const productsByCrossSection = new Map<number, any[]>();
    for (const row of productRes.rows) {
      const cs = row.cross_section;
      let arr = productsByCrossSection.get(cs);
      if (!arr) {
        arr = [];
        productsByCrossSection.set(cs, arr);
      }
      arr.push(row);
    }

    // Map back to the validated cables list to preserve order and include lengths
    for (let i = 0; i < validCables.length; i++) {
      const cable = validCables[i];
      const recommendations = productsByCrossSection.get(cable.crossSection);
      if (recommendations) {
        recommendedProducts.push({
          needed_crossSection: cable.crossSection,
          length: cable.length,
          recommendations
        });
      }
    }
  }

  if (recommendedProducts.length > 0) {
      return JSON.stringify(recommendedProducts, null, 2);
  }

  return '';
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
    const headers = applySecurityHeaders(
      new Headers({ 'Retry-After': String(rate.retryAfter) })
    );
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers,
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    const headers = applySecurityHeaders(new Headers());
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers,
    });
  }

  if (!body || typeof body !== 'object' || !Array.isArray(body.messages) || body.messages.length === 0) {
    const headers = applySecurityHeaders(new Headers());
    return new Response(JSON.stringify({ error: 'messages must be a non-empty array' }), {
      status: 400,
      headers,
    });
  }

  const { messages }: { messages: Message[] } = body;

  const validationError = validateMessages(messages);
  if (validationError) {
    return validationError;
  }

  const latestMessage = messages[messages.length - 1];
  // Use map to avoid type inference issues with find on union types
  const textParts = latestMessage?.parts?.map((p: any) => p.type === 'text' ? p.text : null).filter(Boolean);
  const userQuery = (textParts && textParts.length > 0) ? textParts[0] : latestMessage?.content || '';

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

${productRecommendations ? `
DER NUTZER HAT EINE STÜCKLISTE (BOM) GESENDET.
HIER SIND VERIFIZIERTE PRODUKT-EMPFEHLUNGEN AUS UNSERER DATENBANK, PASSEND ZUR STÜCKLISTE:
${productRecommendations}

Bitte beziehe diese günstigen, passenden Produkte in deine Antwort ein und schlage sie dem Nutzer vor.
` : ''}

Antworte auf Deutsch, sei hilfreich und verständlich.
  `;

  // 5. Call LLM with the injected system prompt
  const modelMessages = await convertToModelMessages(messages as any);
  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: [
        { role: 'system', content: systemPrompt },
        ...modelMessages
    ],
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages as any,
    generateMessageId: () => `msg_${Date.now()}`
  });

  applySecurityHeaders(response.headers);
  return response;
}
