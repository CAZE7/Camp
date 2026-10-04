import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHAT_API_URL_ENV } from '@/components/chat/constants';
import KiAssistent from './page';

describe('KiAssistent Page', () => {
  beforeEach(() => {
    vi.stubEnv(CHAT_API_URL_ENV, '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps its heading in the document', () => {
    render(<KiAssistent />);

    expect(screen.getByRole('heading', { level: 1, name: 'Camper-Assistent' })).toBeInTheDocument();
  });

  it('renders the lightweight static-export fallback without a chat input', () => {
    render(<KiAssistent />);

    expect(screen.getByText('Kein Assistent konfiguriert')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Schreib deine Nachricht...')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Chat schließen')).toBeInTheDocument();
  });
});
