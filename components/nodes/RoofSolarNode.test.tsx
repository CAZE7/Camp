import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoofSolarNode from './RoofSolarNode';
import type { MockNodeResizerProps } from '../../test-helpers/reactflowMocks';

// Mock reactflow NodeResizer
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    NodeResizer: ({ isVisible, onResize }: MockNodeResizerProps) => (
      <div
        data-testid="node-resizer"
        data-isvisible={isVisible?.toString()}
        onClick={(event) => onResize?.(event, { width: 120, height: 80 })}
      />
    ),
  };
});

describe('RoofSolarNode Component', () => {
  it('renders default values when no data is provided', () => {
    render(<RoofSolarNode id="1" data={{}} selected={false} />);
    expect(screen.getByText('Solarpanel')).toBeInTheDocument();
    expect(screen.getByText('100 W')).toBeInTheDocument();
    // Neue Formatierung: "100×60 cm" (Multiplikationszeichen)
    expect(screen.getByText(/100.*60.*cm/i)).toBeInTheDocument();
  });

  it('renders custom values when provided in data prop', () => {
    render(
      <RoofSolarNode
        id="1"
        data={{ label: 'Custom Panel', watts: 250, width: 200, height: 100 }}
        selected={false}
      />
    );
    expect(screen.getByText('Custom Panel')).toBeInTheDocument();
    expect(screen.getByText('250 W')).toBeInTheDocument();
    expect(screen.getByText(/200.*100.*cm/i)).toBeInTheDocument();
  });

  it('applies selected styling and passes isVisible=true to NodeResizer when selected is true', () => {
    const { container } = render(<RoofSolarNode id="1" data={{}} selected={true} />);
    const resizer = screen.getByTestId('node-resizer');
    expect(resizer).toHaveAttribute('data-isvisible', 'true');
    // Selected-Ring nutzt jetzt Token-Farben. Selektiert wird die Karte über
    // ihr eigenes Hook, nicht über eine Rolle: §3.6 legt die Gruppe auf den
    // React-Flow-Wrapper, die Karte trägt keine eigene Rolle mehr.
    const mainDiv = container.querySelector('[data-testid="roof-solar-card"]') as HTMLElement;
    expect(mainDiv.className).toContain('ring-2');
    expect(mainDiv.className).toContain('ring-copper');
  });

  it('does not apply selected styling and passes isVisible=false to NodeResizer when selected is false', () => {
    const { container } = render(<RoofSolarNode id="1" data={{}} selected={false} />);
    const resizer = screen.getByTestId('node-resizer');
    expect(resizer).toHaveAttribute('data-isvisible', 'false');
    const mainDiv = container.querySelector('[data-testid="roof-solar-card"]') as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-2');
    expect(mainDiv.className).not.toContain('ring-copper');
  });

  it('applies invalid styling when data.isInvalid is true', () => {
    const { container } = render(<RoofSolarNode id="1" data={{ isInvalid: true }} selected={false} />);
    const mainDiv = container.querySelector('[data-testid="roof-solar-card"]') as HTMLElement;
    expect(mainDiv.className).toContain('border-warn-critical');
    // Der Fehlerzustand wird nicht mehr an der Karte benannt: §3.6 legt den
    // Accessible Name auf den React-Flow-Wrapper. Geprüft wird er dort in
    // `bauteilAria.test.ts` (Zeile mit „— ragt aus der Safe Zone") und im
    // echten DOM: `components/nodes/bauteilGruppe.dom.test.tsx`.
    // aria-invalid verbietet sich an der Rolle group (jsx-a11y-Riegel).
  });

  it('calls onNodeResize callback when NodeResizer triggers onResize', () => {
    const mockOnNodeResize = vi.fn();
    render(<RoofSolarNode id="test-id" data={{ onNodeResize: mockOnNodeResize }} selected={true} />);

    const resizer = screen.getByTestId('node-resizer');
    fireEvent.click(resizer);

    expect(mockOnNodeResize).toHaveBeenCalledTimes(1);
    expect(mockOnNodeResize).toHaveBeenCalledWith(expect.any(Object), {
      id: 'test-id',
      width: 120,
      height: 80,
    });
  });
});
