import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Chat from './Chat';
import { useChat } from '@ai-sdk/react';

// Mock useChat hook from @ai-sdk/react
vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(),
}));

describe('Chat Component', () => {
  const mockSendMessage = vi.fn();
  const mockSetMessages = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    (useChat as any).mockReturnValue({
      messages: [],
      setMessages: mockSetMessages,
      sendMessage: mockSendMessage,
      status: 'idle',
    });
  });

  describe('Initial State', () => {
    it('renders the closed chat button initially', () => {
      render(<Chat />);

      const openButton = screen.getByLabelText('Chat öffnen');
      expect(openButton).toBeInTheDocument();

      // The chat window itself should not be rendered
      expect(screen.queryByText('Camper AI Assistent')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('opens the chat window when the button is clicked', () => {
      render(<Chat />);

      const openButton = screen.getByLabelText('Chat öffnen');
      fireEvent.click(openButton);

      expect(screen.getByText('Camper AI Assistent')).toBeInTheDocument();
      expect(screen.getByLabelText('Chat Nachricht')).toBeInTheDocument();
    });

    it('closes the chat window when the close button is clicked', () => {
      render(<Chat />);

      // Open
      fireEvent.click(screen.getByLabelText('Chat öffnen'));
      expect(screen.getByText('Camper AI Assistent')).toBeInTheDocument();

      // Close
      const closeButton = screen.getByLabelText('Chat schließen');
      fireEvent.click(closeButton);

      expect(screen.queryByText('Camper AI Assistent')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Chat öffnen')).toBeInTheDocument();
    });

    it('sends a message when the form is submitted', () => {
      render(<Chat />);

      // Open
      fireEvent.click(screen.getByLabelText('Chat öffnen'));

      // Type message
      const input = screen.getByLabelText('Chat Nachricht');
      fireEvent.change(input, { target: { value: 'Hallo Welt' } });

      // Submit form
      const sendButton = screen.getByLabelText('Nachricht senden');
      fireEvent.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith({ text: 'Hallo Welt' });
      // Input should be cleared after sending
      expect(input).toHaveValue('');
    });

    it('does not send a message if input is empty', () => {
      render(<Chat />);

      // Open
      fireEvent.click(screen.getByLabelText('Chat öffnen'));

      // Submit form without typing
      const sendButton = screen.getByLabelText('Nachricht senden');
      // The button should be disabled, so clicking it shouldn't trigger form submit
      // Testing disabled property directly is more robust for UI test
      expect(sendButton).toBeDisabled();

      fireEvent.click(sendButton);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Global Events', () => {
    it('handles export-bom event, opens chat, and sends a specific message', () => {
      render(<Chat />);

      // Create mock detail data
      const mockBom = {
        items: [{ id: 1, name: 'Test Item' }],
        cables: [],
      };

      // Dispatch event
      const event = new CustomEvent('export-bom', { detail: mockBom });
      act(() => {
        window.dispatchEvent(event);
      });

      // Verify chat opened
      expect(screen.getByText('Camper AI Assistent')).toBeInTheDocument();

      // Verify message was sent with correct format
      const expectedPrompt = `Bitte überprüfe meine Stückliste und schlage mir passende, günstige Produkte vor.\n\nStückliste:\n\`\`\`json\n${JSON.stringify(mockBom, null, 2)}\n\`\`\``;

      expect(mockSendMessage).toHaveBeenCalledWith({ text: expectedPrompt });
    });

    it('handles check-schematic event, opens chat, and sends a specific message', () => {
      render(<Chat />);

      // Create mock detail data
      const mockSchematic = {
        nodes: [{ id: '1', type: 'Battery' }],
        edges: [],
      };

      // Dispatch event
      const event = new CustomEvent('check-schematic', { detail: mockSchematic });
      act(() => {
        window.dispatchEvent(event);
      });

      // Verify chat opened
      expect(screen.getByText('Camper AI Assistent')).toBeInTheDocument();

      // Verify message was sent with correct format
      const expectedPrompt = `Bitte überprüfe diesen Schaltplan auf Fehler. Hier ist die Topologie:\n\`\`\`json\n${JSON.stringify(mockSchematic, null, 2)}\n\`\`\``;

      expect(mockSendMessage).toHaveBeenCalledWith({ text: expectedPrompt });
    });
  });

  describe('Message Rendering', () => {
    it('renders normal user and AI messages', () => {
      const mockMessages = [
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'Wie baue ich einen Camper?' }],
        },
        {
          id: '2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hier ist eine Anleitung...' }],
        },
      ];

      (useChat as any).mockReturnValue({
        messages: mockMessages,
        setMessages: mockSetMessages,
        sendMessage: mockSendMessage,
        status: 'idle',
      });

      render(<Chat />);
      fireEvent.click(screen.getByLabelText('Chat öffnen'));

      expect(screen.getByText('Wie baue ich einen Camper?')).toBeInTheDocument();
      expect(screen.getByText('Hier ist eine Anleitung...')).toBeInTheDocument();
    });

    it('hides user messages containing JSON payloads', () => {
      const mockMessages = [
        {
          id: '1',
          role: 'user',
          parts: [{ type: 'text', text: 'Wie baue ich einen Camper?' }],
        },
        {
          id: '2',
          role: 'user',
          parts: [{ type: 'text', text: 'Bitte überprüfe meine Stückliste...\n```json\n{\n  "items": []\n}\n```' }],
        },
        {
          id: '3',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Die Stückliste sieht gut aus!' }],
        },
      ];

      (useChat as any).mockReturnValue({
        messages: mockMessages,
        setMessages: mockSetMessages,
        sendMessage: mockSendMessage,
        status: 'idle',
      });

      render(<Chat />);
      fireEvent.click(screen.getByLabelText('Chat öffnen'));

      // Normal message should be visible
      expect(screen.getByText('Wie baue ich einen Camper?')).toBeInTheDocument();

      // JSON message should NOT be visible
      expect(screen.queryByText(/Bitte überprüfe meine Stückliste/)).not.toBeInTheDocument();

      // AI response should be visible
      expect(screen.getByText('Die Stückliste sieht gut aus!')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('displays loading indicator when status is submitted', () => {
      (useChat as any).mockReturnValue({
        messages: [],
        setMessages: mockSetMessages,
        sendMessage: mockSendMessage,
        status: 'submitted',
      });

      render(<Chat />);
      fireEvent.click(screen.getByLabelText('Chat öffnen'));

      // Check if send button is disabled
      const sendButton = screen.getByLabelText('Nachricht senden');
      expect(sendButton).toBeDisabled();

      // Try typing something, button should still be disabled
      const input = screen.getByLabelText('Chat Nachricht');
      fireEvent.change(input, { target: { value: 'Hallo' } });
      expect(sendButton).toBeDisabled();

      // The loading dots container (with KI Assistent title before it) should be present
      // Since it doesn't have an explicit role/label, we search by its classes or text context
      // Note: testing specific Tailwind classes is generally brittle, but we can verify
      // that the AI name is repeated (one for the loading bubble)
      const aiTitles = screen.getAllByText('KI Assistent');
      // Should be 1 (there are no messages, but the loading indicator has a title)
      expect(aiTitles.length).toBeGreaterThan(0);
    });

    it('displays loading indicator when status is streaming', () => {
      (useChat as any).mockReturnValue({
        messages: [],
        setMessages: mockSetMessages,
        sendMessage: mockSendMessage,
        status: 'streaming',
      });

      render(<Chat />);
      fireEvent.click(screen.getByLabelText('Chat öffnen'));

      const sendButton = screen.getByLabelText('Nachricht senden');
      expect(sendButton).toBeDisabled();
    });
  });
});
