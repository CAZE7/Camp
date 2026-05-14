import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import pool from '../../../lib/db';
import { streamText, embed } from 'ai';

vi.mock('ai', () => ({
  streamText: vi.fn().mockReturnValue({
    toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response('stream'))
  }),
  embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2] }),
  convertToModelMessages: vi.fn().mockResolvedValue([{ role: 'user', content: 'What is a battery?' }]),
}));

// Mock createOpenAI correctly to return a callable function with an embedding method
vi.mock('@ai-sdk/openai', () => {
  const mockOpenAI = vi.fn().mockReturnValue({});
  (mockOpenAI as any).embedding = vi.fn().mockReturnValue({});
  return {
    createOpenAI: vi.fn().mockReturnValue(mockOpenAI),
  };
});

vi.mock('../../../lib/db', () => ({
  default: {
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    }),
  },
}));

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test_key';
  });

  it('performs a successful RAG query and calls streamText', async () => {
    // Mock the database query specifically for this test
    const mockQuery = vi.fn().mockResolvedValue({
      rows: [
        { content: 'Context chunk 1' },
        { content: 'Context chunk 2' }
      ]
    });

    (pool.connect as any).mockResolvedValueOnce({
      query: mockQuery,
      release: vi.fn(),
    });

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: '3',
            role: 'user',
            content: 'What is a battery?',
          }
        ]
      })
    });

    const response = await POST(req);

    expect(response).toBeInstanceOf(Response);

    // Verify embedding was called with the user query
    expect(embed).toHaveBeenCalledWith(expect.objectContaining({
      value: 'What is a battery?'
    }));

    // Verify the DB was queried for vector similarity
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT content, metadata'),
      expect.any(Array)
    );

    // Verify streamText was called and system prompt includes the retrieved context
    expect(streamText).toHaveBeenCalled();
    const streamTextArgs = vi.mocked(streamText).mock.calls[0][0];
    const systemMessage = streamTextArgs.messages?.find((m: any) => m.role === 'system');

    expect(systemMessage).toBeDefined();
    expect((systemMessage as any)?.content).toContain('Context chunk 1');
    expect((systemMessage as any)?.content).toContain('Context chunk 2');
  });

  it('handles database connection errors gracefully without crashing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Force pool.connect to throw an error
    (pool.connect as any).mockRejectedValueOnce(new Error('Database Connection Failed'));

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: 'db-error',
            role: 'user',
            content: 'What is a battery?',
          }
        ]
      })
    });

    const response = await POST(req);

    // It should NOT return a 500 status response, it should continue to streamText
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    // Ensure the error was caught and logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error during RAG pipeline:',
      expect.any(Error)
    );

    // Verify streamText WAS called, ensuring graceful fallback
    expect(streamText).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('handles embed (RAG embedding pipeline) errors gracefully without crashing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Force the embed function to throw an error
    vi.mocked(embed).mockRejectedValueOnce(new Error('Embedding Service Failed'));

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: 'embed-error',
            role: 'user',
            content: 'What is a battery?',
          }
        ]
      })
    });

    const response = await POST(req);

    // It should NOT return a 500 status response, it should continue to streamText
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    // Ensure the error was caught and logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error during RAG pipeline:',
      expect.any(Error)
    );

    // Verify streamText WAS called, ensuring graceful fallback
    expect(streamText).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('robustly handles missing closing BOM tags', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: 'missing-end-tag',
            role: 'user',
            content: 'Here is my request \n```json\n{ "cables": [] }',
          }
        ]
      })
    });

    const response = await POST(req);

    expect(response).toBeInstanceOf(Response);
    // Should NOT log failure because it shouldn't even try to parse if end tag is missing
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('handles large input without ReDoS', async () => {
    const largeContent = '```json\n' + '{"cables": []}' + 'A'.repeat(5000) + '\n```';

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: 'large-input',
            role: 'user',
            content: largeContent,
          }
        ]
      })
    });

    const start = Date.now();
    const response = await POST(req);
    const end = Date.now();

    expect(response).toBeInstanceOf(Response);
    expect(end - start).toBeLessThan(1000); // Should be very fast
  });

  it('handles DB connection or query errors gracefully without crashing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Force the DB query to throw an error
    (pool.connect as any).mockResolvedValueOnce({
      query: vi.fn().mockRejectedValue(new Error('DB Connection Failed')),
      release: vi.fn(),
    });

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: '4',
            role: 'user',
            content: 'What is a battery?',
          }
        ]
      })
    });

    const response = await POST(req);

    // It should NOT return a 500 status response, it should continue to streamText
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    // Ensure the error was caught and logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error during RAG pipeline:',
      expect.any(Error)
    );

    // Verify streamText WAS called, ensuring graceful fallback
    expect(streamText).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('parses valid BOM JSON with cables and provides product recommendations', async () => {
    // Mock the DB query to return components for the BOM
    const mockQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] }) // 1st query: Knowledge RAG (mock empty)
      .mockResolvedValueOnce({ // 2nd query: Products for the cables
        rows: [
          { name: 'Cable A', brand: 'BrandX', price: 10.5, cross_section: 4 },
          { name: 'Cable B', brand: 'BrandY', price: 12.0, cross_section: 4 },
        ]
      });

    (pool.connect as any).mockResolvedValueOnce({
      query: mockQuery,
      release: vi.fn(),
    });

    const bomJson = JSON.stringify({
      cables: [
        { crossSection: 4, length: 2 },
        { crossSection: null, length: 5 } // to ensure null crossSections are handled
      ]
    });

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: '5',
            role: 'user',
            content: `Here is my setup\n\`\`\`json\n${bomJson}\n\`\`\``,
          }
        ]
      })
    });

    const response = await POST(req);

    expect(response).toBeInstanceOf(Response);

    // Verify DB was queried for the products using the unique cross section (4)
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SELECT name, brand, price, cross_section'),
      [[4]]
    );

    // Verify streamText was called and system prompt includes product recommendations
    expect(streamText).toHaveBeenCalled();
    const streamTextArgs = vi.mocked(streamText).mock.calls[0][0];
    const systemMessage = streamTextArgs.messages?.find((m: any) => m.role === 'system');

    expect(systemMessage).toBeDefined();
    expect((systemMessage as any)?.content).toContain('DER NUTZER HAT EINE STÜCKLISTE (BOM) GESENDET.');
    expect(systemMessage?.content).toContain('Cable A');
    expect(systemMessage?.content).toContain('BrandX');
  });

  it('returns 400 Bad Request if the JSON body is invalid', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json'
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe('Invalid JSON body');
  });

  it('returns 400 Bad Request if messages array is missing', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        otherData: 'no messages here'
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe('messages must be a non-empty array');
  });

  it('returns 400 Bad Request if messages array is empty', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: []
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe('messages must be a non-empty array');
  });

  it('returns 400 Bad Request if messages array exceeds maximum length', async () => {
    const manyMessages = Array.from({ length: 101 }, (_, i) => ({
      id: i.toString(),
      role: 'user',
      content: 'test content'
    }));

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: manyMessages
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toContain('Too many messages');
  });

  it('returns 400 Bad Request if a message has an invalid role', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: '1',
            role: 'invalid_role',
            content: 'test content'
          }
        ]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe('Invalid message role');
  });

  it('returns 400 Bad Request if a message content exceeds maximum length', async () => {
    const longContent = 'a'.repeat(10001);
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: '1',
            role: 'user',
            content: longContent
          }
        ]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toContain('Message content too long');
  });

  it('returns 400 Bad Request if a message has too many parts', async () => {
    const tooManyParts = Array.from({ length: 11 }, () => ({
      type: 'text',
      text: 'test'
    }));

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'test',
            parts: tooManyParts
          }
        ]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toContain('Too many message parts');
  });

  it('returns 400 Bad Request if a message part text exceeds maximum length', async () => {
    const longPartText = 'a'.repeat(10001);
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'test',
            parts: [{ type: 'text', text: longPartText }]
          }
        ]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toContain('Message part text too long');
  });

  it('allows tool and data roles', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: '1',
            role: 'tool',
            content: 'tool output'
          },
          {
            id: '2',
            role: 'data',
            content: 'additional data'
          },
          {
            id: '3',
            role: 'user',
            content: 'what now?'
          }
        ]
      })
    });

    const response = await POST(req);
    // Should proceed to RAG pipeline/LLM call (returning 200/stream in this mock setup)
    expect(response.status).not.toBe(400);
  });

  it('returns 400 Bad Request if a message format is invalid', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: ["not an object"]
      })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe('Invalid message format');
  });

  it('handles invalid JSON in BOM extraction gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Here is my request \n```json\n{ bad json \n```',
          }
        ]
      })
    });

    const response = await POST(req);

    expect(response).toBeInstanceOf(Response);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to parse BOM JSON:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('handles valid JSON but missing cables array gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: '2',
            role: 'user',
            content: 'Here is my request \n```json\n{ "other": "data" }\n```',
          }
        ]
      })
    });

    const response = await POST(req);

    expect(response).toBeInstanceOf(Response);
    expect(consoleSpy).not.toHaveBeenCalledWith(
      'Failed to parse BOM JSON:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
