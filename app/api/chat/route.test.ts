import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';
import pool from '../../../lib/db';

vi.mock('ai', () => ({
  streamText: vi.fn().mockReturnValue({
    toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response('stream'))
  }),
  embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2] }),
  convertToModelMessages: vi.fn().mockResolvedValue([]),
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
