import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import KiAssistent from './page';

// Mock the Chat component
vi.mock('../../components/Chat', () => ({
  default: () => <div data-testid="mock-chat">Mocked Chat</div>,
}));

describe('KiAssistent Page', () => {
  it('renders the main container with correct classes', () => {
    const { container } = render(<KiAssistent />);

    // Check if main element exists
    const mainElement = container.querySelector('main');
    expect(mainElement).not.toBeNull();

    // Check for the specific CSS classes
    expect(mainElement?.className).toContain('w-full');
    expect(mainElement?.className).toContain('h-screen');
    expect(mainElement?.className).toContain('relative');
  });

  it('renders the Chat component', () => {
    render(<KiAssistent />);

    // Check if the mocked Chat is rendered
    const chatElement = screen.getByTestId('mock-chat');
    expect(chatElement).toBeInTheDocument();
    expect(chatElement).toHaveTextContent('Mocked Chat');
  });
});
