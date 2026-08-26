import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title and description correctly', () => {
    render(
      <EmptyState
        title="Test Titel"
        description="Test Beschreibung"
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Test Titel' })).toBeInTheDocument();
    expect(screen.getByText('Test Beschreibung')).toBeInTheDocument();
  });

  it('renders default icon when no custom icon is provided', () => {
    const { container } = render(
      <EmptyState
        title="Test Titel"
        description="Test Beschreibung"
      />
    );

    // Compass icon SVG from lucide-react has lucide-compass class
    const iconSvg = container.querySelector('.lucide-compass');
    expect(iconSvg).toBeInTheDocument();
  });

  it('renders custom icon when provided', () => {
    render(
      <EmptyState
        title="Test Titel"
        description="Test Beschreibung"
        icon={<span data-testid="custom-icon">Custom Icon</span>}
      />
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.getByText('Custom Icon')).toBeInTheDocument();
  });

  it('renders action button and triggers onAction callback when clicked', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="Test Titel"
        description="Test Beschreibung"
        actionLabel="Komponente hinzufügen"
        onAction={handleAction}
      />
    );

    const button = screen.getByRole('button', { name: 'Komponente hinzufügen' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button if actionLabel is provided without onAction', () => {
    render(
      <EmptyState
        title="Test Titel"
        description="Test Beschreibung"
        actionLabel="Komponente hinzufügen"
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render action button if onAction is provided without actionLabel', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="Test Titel"
        description="Test Beschreibung"
        onAction={handleAction}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders hint text when hint prop is provided', () => {
    render(
      <EmptyState
        title="Test Titel"
        description="Test Beschreibung"
        hint="Dies ist ein Hinweis"
      />
    );

    expect(screen.getByText('Dies ist ein Hinweis')).toBeInTheDocument();
  });

  it('does not render hint text when hint prop is not provided', () => {
    render(
      <EmptyState
        title="Test Titel"
        description="Test Beschreibung"
      />
    );

    expect(screen.queryByText('Dies ist ein Hinweis')).not.toBeInTheDocument();
  });
});
