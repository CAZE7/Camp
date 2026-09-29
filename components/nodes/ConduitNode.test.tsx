import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConduitNode from './ConduitNode';
import type { MockHandleProps } from '../../test-helpers/reactflowMocks';

const mockUseEdges = vi.fn((): unknown[] => []); // AUDIT T1: Rückgabe war `any`

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    Handle: ({ 'data-testid': testId, isConnectable, ...props }: MockHandleProps) => {
      const { type, position, id, style } = props;
      return (
        <div
          data-testid={testId || 'react-flow-handle'}
          data-type={type}
          data-position={position}
          data-id={id}
          style={style}
        />
      );
    },
    Position: {
      Left: 'left',
      Right: 'right',
      Top: 'top',
      Bottom: 'bottom',
    },
    useEdges: () => mockUseEdges(),
  };
});

/**
 * Der Füllgrad ist eine AUSSAGE ÜBER DIE VERLEGUNG — er darf nur erscheinen,
 * wenn Rohrtyp und alle Querschnitte bekannt sind. Diese Datei prüft beides:
 * die Zahl im Normalfall und das „nicht bewertet“ in den beiden Fällen, in
 * denen die Karte früher mit einem unterstellten 2,5-mm²-Kabel gerechnet hat
 * (Regel M — keine stille Annahme).
 */
describe('ConduitNode Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEdges.mockReturnValue([]);
  });

  it('renders Leerrohr without declared type as not evaluated', () => {
    render(<ConduitNode id="1" data={{}} />);
    expect(screen.getByText(/^Leerrohr \(Typ nicht angegeben\)$/)).toBeInTheDocument();
    expect(screen.getByText(/Füllgrad: nicht bewertet/i)).toBeInTheDocument();
    expect(screen.getByText(/kein Typ hinterlegt/i)).toBeInTheDocument();
  });

  it('renders custom label and conduitType when provided in data', () => {
    render(<ConduitNode id="1" data={{ label: 'Main Conduit', conduitType: 'EN 32' }} />);
    expect(screen.getByText(/Main Conduit/i)).toBeInTheDocument();
    expect(screen.getByText(/\(EN 32\)/i)).toBeInTheDocument();
  });

  it('calculates 0% fill correctly with no assigned cables', () => {
    render(<ConduitNode id="1" data={{ conduitType: 'EN 20' }} />);
    expect(screen.getByText('Zugewiesene Kabel: 0')).toBeInTheDocument();
    expect(screen.getByText(/Füllgrad: 0.0%/i)).toBeInTheDocument();
  });

  it('calculates fill correctly with assigned cables', () => {
    mockUseEdges.mockReturnValue([{ id: 'edge-1', data: { crossSection: 1.5 } }]);

    render(<ConduitNode id="1" data={{ conduitType: 'EN 20', assignedEdges: ['edge-1'] }} />);
    expect(screen.getByText('Zugewiesene Kabel: 1')).toBeInTheDocument();
    // EN 20 inner diam = 16.9 (area = 224.3). 1.5mm2 outer = 2.4 (area = 4.52). 4.52 / 224.3 * 100 = ~2%
    expect(screen.getByText(/Füllgrad: 2.0%/i)).toBeInTheDocument();
  });

  it('shows overfill warning when capacity exceeds 60%', () => {
    // EN 20 area ~224.3, 60% = ~134.5
    // 50mm2 cable outer diam = 13.5 (area ~143.1). 143.1 / 224.3 = 63.8%
    mockUseEdges.mockReturnValue([{ id: 'edge-1', data: { crossSection: 50.0 } }]);

    const { container } = render(
      <ConduitNode id="1" data={{ conduitType: 'EN 20', assignedEdges: ['edge-1'] }} />
    );

    // Check main warning text
    expect(
      screen.getByText('Kanal überfüllt! Gefahr durch Hitzestau in der Kabelbündelung.')
    ).toBeInTheDocument();
    // Check recommendation text
    expect(screen.getByText(/Bitte mindestens EN 25 Rohr verwenden./i)).toBeInTheDocument();

    // Check if the overfill token classes are present
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('bg-warn-critical-bg');
    expect(mainDiv.className).toContain('node-card--error');
  });

  it('does not invent a percentage for an unknown conduit type', () => {
    mockUseEdges.mockReturnValue([{ id: 'edge-1', data: { crossSection: 1.5 } }]);

    render(<ConduitNode id="1" data={{ conduitType: 'M20', assignedEdges: ['edge-1'] }} />);

    expect(screen.getByText(/Füllgrad: nicht bewertet/i)).toBeInTheDocument();
    expect(screen.getByText(/Innendurchmesser in der Tabelle/i)).toBeInTheDocument();
    expect(screen.queryByText(/Füllgrad: 2.0%/i)).not.toBeInTheDocument();
  });

  it('does not fall back to 2,5 mm² when a cable has no cross-section', () => {
    // 2,5 mm² in EN 20 ergäbe ~3,1 % — genau diese (erfundene) Zahl darf nicht erscheinen.
    mockUseEdges.mockReturnValue([{ id: 'edge-1', data: {} }]);

    render(<ConduitNode id="1" data={{ conduitType: 'EN 20', assignedEdges: ['edge-1'] }} />);

    expect(screen.getByText(/Füllgrad: nicht bewertet/i)).toBeInTheDocument();
    expect(screen.getByText(/fehlt der Querschnitt/i)).toBeInTheDocument();
    expect(screen.queryByText(/Füllgrad: 3.1%/i)).not.toBeInTheDocument();
  });

  it('applies selected styling when selected is true and not overfilled', () => {
    const { container } = render(<ConduitNode id="1" data={{ conduitType: 'EN 20' }} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.getAttribute('data-selected')).toBe('true');
    expect(mainDiv.className).toContain('node-card--selected');
  });

  it('renders Handle components properly', () => {
    render(<ConduitNode id="1" data={{ conduitType: 'EN 20' }} />);
    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles.length).toBe(2);
    expect(handles[0]).toHaveAttribute('data-type', 'source');
    expect(handles[1]).toHaveAttribute('data-type', 'target');
  });
});
