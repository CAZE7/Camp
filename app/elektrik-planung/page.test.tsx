import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ElektrikPlanung from './page';

// Mock the Planner component
vi.mock('../../components/Planner', () => ({
  default: () => <div data-testid="mock-planner">Mocked Planner</div>,
}));

describe('ElektrikPlanung Page', () => {
  it('renders the main container with correct classes', () => {
    const { container } = render(<ElektrikPlanung />);

    // Check if main element exists
    const mainElement = container.querySelector('main');
    expect(mainElement).not.toBeNull();

    // Check for the specific CSS classes
    expect(mainElement?.className).toContain('w-full');
    expect(mainElement?.className).toContain('h-screen');
    expect(mainElement?.className).toContain('relative');
  });

  it('renders the Planner component', () => {
    render(<ElektrikPlanung />);

    // Check if the mocked Planner is rendered
    const plannerElement = screen.getByTestId('mock-planner');
    expect(plannerElement).toBeInTheDocument();
    expect(plannerElement).toHaveTextContent('Mocked Planner');
  });
});
