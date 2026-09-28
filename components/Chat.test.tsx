/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument --
 * Werft-Altbestand (übernommen 2026-09): nutzt noch `any` für AI-SDK-
 * Mocks/Datenstrukturen. FOLLOW-UP: typisieren, dann Disable entfernen.
 *
 * AUDIT T1 ergänzt `no-unsafe-argument`: Der Mock-Rückgabewert wird mit
 * `as any` an `mockReturnValue` übergeben — derselbe Aufschub wie oben,
 * nur eine Ebene tiefer. Mit den echten Typen verschwindet beides zusammen.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Chat, { CHAT_API_URL_ENV, resolveChatEndpoint } from './Chat';
import { useChat } from '@ai-sdk/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(),
}));

const mockSendMessage = vi.fn();
const mockUseChat = vi.mocked(useChat);

/** Konfigurierter Fall: nur mit gesetztem Endpunkt gibt es ein Eingabefeld. */
const CONFIGURED_ENDPOINT = 'https://chat.example.test/api';

describe('resolveChatEndpoint — ADR 0021 / ARCH-001', () => {
  it('nimmt einen konfigurierten Endpunkt (getrimmt)', () => {
    expect(resolveChatEndpoint('  https://assistent.example.test/api  ', 'production')).toBe(
      'https://assistent.example.test/api'
    );
  });

  it('nutzt den lokalen Route-Pfad nur im Development-Server', () => {
    expect(resolveChatEndpoint(undefined, 'development')).toBe('/api/chat');
  });

  it('liefert im statischen Export ohne Variable keinen Endpunkt', () => {
    expect(resolveChatEndpoint(undefined, 'production')).toBeNull();
  });

  it('behandelt Leerraum wie „nicht gesetzt“', () => {
    expect(resolveChatEndpoint('   ', 'production')).toBeNull();
  });
});

describe('Chat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(CHAT_API_URL_ENV, CONFIGURED_ENDPOINT);
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      status: 'idle',
    } as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Rendering', () => {
    it('renders chat button when closed', () => {
      render(<Chat />);
      const button = screen.getByLabelText('Chat öffnen');
      expect(button).toBeInTheDocument();
    });

    it('opens chat when button is clicked', () => {
      render(<Chat />);
      const button = screen.getByLabelText('Chat öffnen');
      fireEvent.click(button);
      expect(screen.getByText('Camper AI Assistent')).toBeInTheDocument();
    });

    it('renders closed by default', () => {
      render(<Chat />);
      expect(screen.queryByText('Camper AI Assistent')).not.toBeInTheDocument();
    });

    it('renders open when defaultOpen is provided', () => {
      render(<Chat defaultOpen />);

      expect(screen.getByText('Camper AI Assistent')).toBeInTheDocument();
      expect(screen.queryByLabelText('Chat öffnen')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('closes chat when close button is clicked', () => {
      render(<Chat defaultOpen />);
      const closeButton = screen.getByLabelText('Chat schließen');
      fireEvent.click(closeButton);
      expect(screen.queryByText('Camper AI Assistent')).not.toBeInTheDocument();
    });

    it('sends message when form is submitted', async () => {
      render(<Chat defaultOpen />);
      const input = screen.getByPlaceholderText('Schreib deine Nachricht...');
      const sendButton = screen.getByText('Senden');

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({ text: 'Test message' });
      });
    });
  });
});

/**
 * Der ausgelieferte Zustand: statischer Export, kein `out/api`, keine
 * `NEXT_PUBLIC_CHAT_API_URL`. Vorher zeigte die Seite hier ein Eingabefeld,
 * das bei jeder Nachricht ins Leere sendete (404) — siehe KNOWN-PROBLEMS
 * ARCH-001 und ADR 0021 Punkt 2.
 */
describe('Chat ohne konfigurierten Endpunkt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(CHAT_API_URL_ENV, '');
    vi.stubEnv('NODE_ENV', 'production');
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      status: 'idle',
    } as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('zeigt den Hinweis statt eines Eingabefelds', () => {
    render(<Chat defaultOpen />);

    expect(screen.getByText('Kein Assistent konfiguriert')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Schreib deine Nachricht...')).not.toBeInTheDocument();
    expect(screen.queryByText('Senden')).not.toBeInTheDocument();
  });

  it('nennt den Weg über die Env-Variable', () => {
    render(<Chat defaultOpen />);

    expect(screen.getByText(/NEXT_PUBLIC_CHAT_API_URL/)).toBeInTheDocument();
    expect(screen.getByText(/\.env\.example/)).toBeInTheDocument();
  });

  it('sendet nichts und ruft den Chat-Hook nicht auf', () => {
    render(<Chat defaultOpen />);

    expect(mockUseChat).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
