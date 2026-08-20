import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Chat from './Chat';
import { useChat } from '@ai-sdk/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(),
}));

const mockSendMessage = vi.fn();
const mockStop = vi.fn();
const mockUseChat = vi.mocked(useChat);

describe('Chat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      status: 'idle',
      stop: mockStop,
    } as any);
  });

  describe('Rendering', () => {
    it('renders chat button when closed', () => {
      render(<Chat />);
      const button = screen.getByLabelText('KI-Assistent öffnen');
      expect(button).toBeInTheDocument();
    });

    it('opens chat when button is clicked', () => {
      render(<Chat />);
      const button = screen.getByLabelText('KI-Assistent öffnen');
      fireEvent.click(button);
      expect(screen.getByRole('heading', { level: 2, name: /KI-Assistent/ })).toBeInTheDocument();
    });

    it('renders closed by default', () => {
      render(<Chat />);
      expect(screen.queryByRole('heading', { level: 2, name: /KI-Assistent/ })).not.toBeInTheDocument();
    });

    it('renders open when defaultOpen is provided', () => {
      render(<Chat defaultOpen />);

      expect(screen.getByRole('heading', { level: 2, name: /KI-Assistent/ })).toBeInTheDocument();
      expect(screen.queryByLabelText('KI-Assistent öffnen')).not.toBeInTheDocument();
    });

    it('shows example prompts in empty state', () => {
      render(<Chat defaultOpen />);
      expect(screen.getByText(/Beispielfragen/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Kabelquerschnitt/).length).toBeGreaterThan(0);
    });

    it('shows a character counter', () => {
      render(<Chat defaultOpen />);
      expect(screen.getByText(/10\.000 Zeichen/)).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('closes chat when close button is clicked', () => {
      render(<Chat defaultOpen />);
      const closeButton = screen.getByLabelText('KI-Assistent schließen');
      fireEvent.click(closeButton);
      expect(screen.queryByRole('heading', { level: 2, name: /KI-Assistent/ })).not.toBeInTheDocument();
    });

    it('sends message when form is submitted', async () => {
      render(<Chat defaultOpen />);
      const input = screen.getByPlaceholderText('Deine Frage …');
      const sendButton = screen.getByText('Senden');

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({ text: 'Test message' });
      });
    });

    it('fills input when example prompt is clicked', () => {
      render(<Chat defaultOpen />);
      const example = screen.getByText(/FI-Schutzschalter/);
      fireEvent.click(example);
      const input = screen.getByPlaceholderText('Deine Frage …') as HTMLInputElement;
      expect(input.value).toContain('FI-Schutzschalter');
    });

    it('shows an Abort button while streaming', () => {
      mockUseChat.mockReturnValue({
        messages: [],
        sendMessage: mockSendMessage,
        status: 'streaming',
        stop: mockStop,
      } as any);
      render(<Chat defaultOpen />);
      const abortBtn = screen.getByLabelText('Antwort abbrechen');
      expect(abortBtn).toBeInTheDocument();
      fireEvent.click(abortBtn);
      expect(mockStop).toHaveBeenCalled();
    });
  });
});
