import { createOpenAI } from '@ai-sdk/openai';
import { streamText, embed, convertToModelMessages } from 'ai';
import pool from '../../../lib/db';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const latestMessage = messages[messages.length - 1];
  const userQuery = latestMessage.parts?.find((p: any) => p.type === 'text')?.text || '';

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
      const knowledgeRes = await client.query(knowledgeQuery, [`[${embedding.join(',')}]`]);
      contextText = knowledgeRes.rows.map(row => row.content).join('\n\n');
    }

    // 3. Extract BOM from user query if present
    const bomMatch = userQuery.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
    if (bomMatch && bomMatch[1]) {
      try {
        const bom = JSON.parse(bomMatch[1]);
        const cables = bom.cables || [];

        // Find matching products for each cable in the BOM based on crossSection
        const recommendedProducts = [];

        for (const cable of cables) {
            if (cable.crossSection) {
                const productQuery = `
                    SELECT name, brand, price, cross_section
                    FROM Components
                    WHERE type = 'cable' AND cross_section = $1
                    ORDER BY price ASC
                    LIMIT 2
                `;
                const productRes = await client.query(productQuery, [cable.crossSection]);

                if (productRes.rows.length > 0) {
                    recommendedProducts.push({
                        needed_crossSection: cable.crossSection,
                        length: cable.length,
                        recommendations: productRes.rows
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
  const modelMessages = await convertToModelMessages(messages);
  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: [
        { role: 'system', content: systemPrompt },
        ...modelMessages
    ],
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: () => `msg_${Date.now()}`
  });
}
