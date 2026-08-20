import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Chat from './Chat';
import { useChat } from '@ai-sdk/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(),
}));

const mockSendMessage = vi.fn();
const mockUseChat = vi.mocked(useChat);

describe('Chat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      status: 'idle',
    } as any);
  });

  describe('Rendering', () => {
    it('renders chat button when closed', () => {
      render(<Chat />);
      const button = screen.getByLabelText('KI-Hilfe öffnen');
      expect(button).toBeInTheDocument();
    });

    it('opens chat when button is clicked', () => {
      render(<Chat />);
      const button = screen.getByLabelText('KI-Hilfe öffnen');
      fireEvent.click(button);
      expect(screen.getByText('Camper-KI-Hilfe')).toBeInTheDocument();
    });

    it('renders closed by default', () => {
      render(<Chat />);
      expect(screen.queryByText('Camper-KI-Hilfe')).not.toBeInTheDocument();
    });

    it('renders open when defaultOpen is provided', () => {
      render(<Chat defaultOpen />);

      expect(screen.getByText('Camper-KI-Hilfe')).toBeInTheDocument();
      expect(screen.queryByLabelText('KI-Hilfe öffnen')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('closes chat when close button is clicked', () => {
      render(<Chat defaultOpen />);
      const closeButton = screen.getByLabelText('KI-Hilfe schließen');
      fireEvent.click(closeButton);
      expect(screen.queryByText('Camper-KI-Hilfe')).not.toBeInTheDocument();
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
  });
});
