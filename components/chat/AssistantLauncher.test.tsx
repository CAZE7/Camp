import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AssistantLauncher from './AssistantLauncher';

vi.mock('@/components/Chat', () => ({
  default: () => <div data-testid="loaded-chat">Loaded chat</div>,
}));

describe('AssistantLauncher', () => {
  it('loads the chat module only after an explicit open action', async () => {
    render(<AssistantLauncher />);

    expect(screen.queryByTestId('loaded-chat')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chat öffnen' }));

    await waitFor(() => {
      expect(screen.getByTestId('loaded-chat')).toBeInTheDocument();
    });
  });
});
