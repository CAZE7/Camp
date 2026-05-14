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

async function extractAndProcessBOM(client: PoolClient, userQuery: string): Promise<string> {
  let bomContent = null;
  const startTag = '```json\n';
  const endTag = '\n```';
  const startIndex = userQuery.indexOf(startTag);
  if (startIndex !== -1) {
    const contentStart = startIndex + startTag.length;
    const endIndex = userQuery.indexOf(endTag, contentStart);
    if (endIndex !== -1) {
      bomContent = userQuery.slice(contentStart, endIndex);
    }
  }

  if (!bomContent) {
    return '';
  }

  try {
    const bom = JSON.parse(bomContent);

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

    const recommendedProducts = [];

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
  } catch (e) {
    console.error("Failed to parse BOM JSON:", e);
  }

  return '';
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing OpenAI API Key configuration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
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

  let dbClient;

  try {
    dbClient = await pool.connect();
    contextText = await performKnowledgeRAG(dbClient, userQuery);
    productRecommendations = await extractAndProcessBOM(dbClient, userQuery);
  } catch (error) {
    console.error("Error during RAG pipeline:", error);
  } finally {
    if (dbClient) {
      dbClient.release();
    }
  }

  // 4. Construct System Prompt
  const systemPrompt = `
Du bist ein erfahrener Camper-Ausbau Assistent und Senior Elektriker.
Beantworte die Fragen des Nutzers basierend auf deinem Wissen und dem folgenden Kontext aus unserer Datenbank.

Prüfe den Schaltplan auf folgende Fehler nach VDE-Norm:
- Fehlt ein FI-Schutzschalter (RCD mit <= 30 mA) nach dem Landstrom-Eingang? Falls ja, warne den Nutzer, da dies nach DIN VDE 0100-721 illegal ist.
- Werden starre NYM-Kabel verwendet? Erinnere den Nutzer, dass nur feindrähtige Leitungen im Camper erlaubt sind.
- Prüfe, ob der Wechselrichter-Verlust von ca. 15% (Faktor 0.85) bei 230V-Geräten beachtet wurde.

Formatiere dein KI-Gutachten übersichtlich und verwende Warn-Icons () bei gefundenen Fehlern.

WICHTIGER KONTEXT AUS DER DATENBANK:
${contextText ? contextText : "Kein spezifischer Kontext gefunden."}

${productRecommendations ? `
DER NUTZER HAT EINE STÜCKLISTE (BOM) GESENDET.
HIER SIND VERIFIZIERTE PRODUKT-EMPFEHLUNGEN AUS UNSERER DATENBANK, PASSEND ZUR STÜCKLISTE:
${productRecommendations}

Bitte beziehe diese günstigen, passenden Produkte in deine Antwort ein und schlage sie dem Nutzer vor.
` : ""}

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

  return result.toUIMessageStreamResponse({
    originalMessages: messages as any,
    generateMessageId: () => `msg_${Date.now()}`
  });
}
