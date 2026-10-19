import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfirmDialogHost, requestConfirm } from './ConfirmDialog';

/**
 * Nachtest 2026-10-16 / PR #536 B-23: Rückfragen laufen als In-App-Dialog
 * (`AccessibleDialog`), nicht als natives `window.confirm` — sonst
 * blockiert die Browser-Rückfrage u. a. das Schließen des Assistenten.
 */
describe('ConfirmDialog (keine nativen Browser-Dialoge)', () => {
  it('resolves true on „Fortfahren“ and renders in-app', async () => {
    render(<ConfirmDialogHost />);
    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = requestConfirm('Plan ersetzen?');
    });

    expect(screen.getByRole('dialog', { name: 'Bitte bestätigen' })).toBeInTheDocument();
    expect(screen.getByText('Plan ersetzen?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fortfahren' }));

    await expect(answer).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('resolves false on „Abbrechen“ and on Escape', async () => {
    render(<ConfirmDialogHost />);
    let first: Promise<boolean> | undefined;
    act(() => {
      first = requestConfirm('Erste Frage');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await expect(first).resolves.toBe(false);

    let second: Promise<boolean> | undefined;
    act(() => {
      second = requestConfirm('Zweite Frage');
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    await expect(second).resolves.toBe(false);
  });

  it('a newer request declines the one still open', async () => {
    render(<ConfirmDialogHost />);
    let older: Promise<boolean> | undefined;
    let newer: Promise<boolean> | undefined;
    act(() => {
      older = requestConfirm('Alt');
      newer = requestConfirm('Neu');
    });
    await expect(older).resolves.toBe(false);
    expect(screen.getByText('Neu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fortfahren' }));
    await expect(newer).resolves.toBe(true);
  });
});
