import { createOpenAI } from '@ai-sdk/openai';
import { streamText, embed, convertToModelMessages } from 'ai';
import pool from '../../../lib/db';

import type { UIMessage } from 'ai';

interface MessagePart {
  type: string;
  text?: string;
  [key: string]: any;
}

interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  parts?: UIMessage['parts'];
}

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
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

  const latestMessage = messages[messages.length - 1];
  // Use map to avoid type inference issues with find on union types
  const textParts = latestMessage?.parts?.map((p: any) => p.type === 'text' ? p.text : null).filter(Boolean);
  const userQuery = (textParts && textParts.length > 0) ? textParts[0] : latestMessage?.content || '';

  let contextText = '';
  let productRecommendations = '';

  const client = await pool.connect();

  try {
    // 1. Generate embedding for the user's query
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy_key') {
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: userQuery,
      });

      // 2. Perform Vector Similarity Search for Knowledge RAG
      const knowledgeQuery = `
        SELECT content, metadata
        FROM Knowledge_Chunks
        ORDER BY embedding <-> $1::vector
        LIMIT 3
      `;
      const knowledgeRes = await client.query(knowledgeQuery, [JSON.stringify(embedding)]);
      contextText = knowledgeRes.rows.map(row => row.content).join('\n\n');
    }

    // 3. Extract BOM from user query if present
    const bomMatch = userQuery.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
    if (bomMatch && bomMatch[1]) {
      try {
        const bom = JSON.parse(bomMatch[1]);
        const cables = bom.cables || [];
        const uniqueCrossSections = Array.from(new Set(
          cables
            .map((c: any) => c.crossSection)
            .filter((cs: any) => cs !== null && cs !== undefined)
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
          const productsByCrossSection: Record<string, any[]> = {};
          for (const row of productRes.rows) {
            const cs = row.cross_section.toString();
            if (!productsByCrossSection[cs]) {
              productsByCrossSection[cs] = [];
            }
            productsByCrossSection[cs].push(row);
          }

          // Map back to the original cables list to preserve order and include lengths
          for (const cable of cables) {
            const csKey = cable.crossSection?.toString();
            if (csKey && productsByCrossSection[csKey]) {
              recommendedProducts.push({
                needed_crossSection: cable.crossSection,
                length: cable.length,
                recommendations: productsByCrossSection[csKey]
              });
            }
          }
        }

        if (recommendedProducts.length > 0) {
            productRecommendations = JSON.stringify(recommendedProducts, null, 2);
        }

      } catch (e) {
        console.error("Failed to parse BOM JSON:", e);
      }
    }
  } catch (error) {
    console.error("Error during RAG pipeline:", error);
  } finally {
    client.release();
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
