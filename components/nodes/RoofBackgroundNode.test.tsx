import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RoofBackgroundNode from './RoofBackgroundNode';

describe('RoofBackgroundNode Component', () => {
  it('renders default text and dimensions correctly', () => {
    const data = { width: 400, height: 200 };
    render(<RoofBackgroundNode data={data} />);

    expect(screen.getByText('Fahrtrichtung')).toBeInTheDocument();
    expect(screen.getByText('Safe Zone')).toBeInTheDocument();
    expect(screen.getByText('Nutzbare Dachfläche: 400cm x 200cm')).toBeInTheDocument();
  });

  it('applies default safeMargins styles when none are provided', () => {
    const data = { width: 400, height: 200 };
    render(<RoofBackgroundNode data={data} />);

    // Default safeMargins are front: 15, rear: 5, left: 5, right: 5
    // After multiplying by 2: top: 30, bottom: 10, left: 10, right: 10
    const safeZoneBoundary = screen.getByText('Safe Zone').parentElement;

    expect(safeZoneBoundary).toHaveStyle({
      top: '30px',
      bottom: '10px',
      left: '10px',
      right: '10px'
    });
  });

  it('applies custom safeMargins styles when provided', () => {
    const data = {
      width: 400,
      height: 200,
      safeMargins: {
        front: 20,
        rear: 10,
        left: 15,
        right: 25
      }
    };
    render(<RoofBackgroundNode data={data} />);

    // Custom margins multiplied by 2: top: 40, bottom: 20, left: 30, right: 50
    const safeZoneBoundary = screen.getByText('Safe Zone').parentElement;

    expect(safeZoneBoundary).toHaveStyle({
      top: '40px',
      bottom: '20px',
      left: '30px',
      right: '50px'
    });
  });

  it('applies partial safeMargins and uses defaults for missing ones', () => {
    const data = {
      width: 400,
      height: 200,
      safeMargins: {
        front: 25,
        // rear is missing, default is 5 -> 10px
        // left is missing, default is 5 -> 10px
        right: 12
      }
    };
    render(<RoofBackgroundNode data={data} />);

    // Expected: top: 50 (25*2), bottom: 10 (5*2), left: 10 (5*2), right: 24 (12*2)
    const safeZoneBoundary = screen.getByText('Safe Zone').parentElement;

    expect(safeZoneBoundary).toHaveStyle({
      top: '50px',
      bottom: '10px',
      left: '10px',
      right: '24px'
    });
  });
});
