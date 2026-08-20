import { describe, it, expect, afterEach, vi } from 'vitest';
import { getChatApiUrl, hasChatBackend, isChatEnabled } from './chatConfig';

describe('chatConfig', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_CHAT_API;
    delete process.env.NEXT_PUBLIC_CHAT_ENABLED;
    vi.unstubAllGlobals();
  });

  it('nutzt eine externe API-URL, wenn NEXT_PUBLIC_CHAT_API gesetzt ist', () => {
    process.env.NEXT_PUBLIC_CHAT_API = 'https://api.example.com/chat';
    expect(getChatApiUrl()).toBe('https://api.example.com/chat');
    expect(hasChatBackend()).toBe(true);
  });

  it('gibt /api/chat aus, wenn keine externe URL konfiguriert ist', () => {
    expect(getChatApiUrl()).toBe('/api/chat');
    expect(hasChatBackend()).toBe(false);
  });

  it('berücksichtigt den Next-BasePath im relativen Pfad', () => {
    vi.stubGlobal('window', {
      __NEXT_DATA__: { basePath: '/Camp' },
    });
    expect(getChatApiUrl()).toBe('/Camp/api/chat');
  });

  it('ist deaktiviert bei NEXT_PUBLIC_CHAT_ENABLED=false', () => {
    process.env.NEXT_PUBLIC_CHAT_ENABLED = 'false';
    expect(isChatEnabled()).toBe(false);
  });

  it('ist standardmäßig aktiviert', () => {
    expect(isChatEnabled()).toBe(true);
  });
});
