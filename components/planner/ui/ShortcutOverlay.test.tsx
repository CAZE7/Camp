import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ShortcutOverlay } from './ShortcutOverlay';

describe('ShortcutOverlay', () => {
  // B-19 (QA-Bericht): „Hilfe → Tastaturkürzel“ öffnete nichts.
  it('opens when the menu dispatches open-shortcut-overlay (B-19)', () => {
    render(<ShortcutOverlay />);
    expect(screen.queryByRole('dialog', { name: 'Tastaturkürzel' })).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('open-shortcut-overlay'));
    });

    expect(screen.getByRole('dialog', { name: 'Tastaturkürzel' })).toBeInTheDocument();
  });

  it('opens with ? and closes with Escape', () => {
    render(<ShortcutOverlay />);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Tastaturkürzel' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Tastaturkürzel' })).not.toBeInTheDocument();
  });
});
