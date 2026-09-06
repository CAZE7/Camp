import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState Component', () => {
  it('renders title and description properly', () => {
    render(
      <EmptyState
        title="Keine Daten vorhanden"
        description="Bitte fügen Sie ein Element hinzu, um fortzufahren."
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Keine Daten vorhanden' })).toBeInTheDocument();
    expect(screen.getByText('Bitte fügen Sie ein Element hinzu, um fortzufahren.')).toBeInTheDocument();
  });

  it('renders custom icon when provided', () => {
    render(
      <EmptyState
        title="Keine Daten"
        description="Beschreibung"
        icon={<span data-testid="custom-icon">Icon</span>}
      />
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders action button and triggers onAction callback when clicked', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="Keine Daten"
        description="Beschreibung"
        actionLabel="Neu erstellen"
        onAction={handleAction}
      />
    );

    const button = screen.getByRole('button', { name: 'Neu erstellen' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button if actionLabel or onAction is missing', () => {
    const { rerender } = render(
      <EmptyState title="Keine Daten" description="Beschreibung" actionLabel="Neu erstellen" />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<EmptyState title="Keine Daten" description="Beschreibung" onAction={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders hint text when hint prop is provided', () => {
    render(
      <EmptyState title="Keine Daten" description="Beschreibung" hint="Tipp: Nutzen Sie die Vorlagen" />
    );

    expect(screen.getByText('Tipp: Nutzen Sie die Vorlagen')).toBeInTheDocument();
  });
});
