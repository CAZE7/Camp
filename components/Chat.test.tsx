import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Chat from './Chat';
import * as chatHook from '@/hooks/useChat';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendMessage = vi.fn();
const mockUseChat = vi.spyOn(chatHook, 'useChat');

describe('Chat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      status: 'idle',
    });
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
      // The chat window itself should not be rendered
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
        expect(mockSendMessage).toHaveBeenCalledWith('Test message');
      });
    });
  });
});
