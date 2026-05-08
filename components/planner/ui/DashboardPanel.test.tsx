import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPanel } from './DashboardPanel';
import React from 'react';

vi.mock('reactflow', () => ({
  Panel: ({ children, position, className }: any) => (
    <div data-testid={`panel-${position}`} className={className}>
      {children}
    </div>
  ),
}));

describe('DashboardPanel', () => {
  const defaultMetrics = {
    dailyConsumptionAh: 50.5,
    autarkyStr: '2 days',
    chargingTimeStr: '4 hours',
    totalSolarVoltage: 0,
    totalSolarAmps: 0,
    hasDirectBatteryToConsumer: false,
    solarNodesCount: 0,
  };

  it('renders default metrics correctly without optional sections', () => {
    render(<DashboardPanel metrics={defaultMetrics} calculatedSolarWatts={0} />);

    expect(screen.getByText('System Berechnungen')).toBeInTheDocument();
    expect(screen.getByText('50.5 Ah')).toBeInTheDocument();
    expect(screen.getByText('2 days')).toBeInTheDocument();
    expect(screen.getByText('4 hours')).toBeInTheDocument();
    expect(screen.getByText('0 W')).toBeInTheDocument();

    // Ensure optional sections are not rendered
    expect(screen.queryByText('Solar-Array Output:')).not.toBeInTheDocument();
    expect(screen.queryByText(/Warnung: Verbraucher ist direkt mit der Batterie verbunden/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dachplaner-Daten erkannt:/)).not.toBeInTheDocument();
  });

  it('renders Solar-Array Output when solarNodesCount > 0', () => {
    const metrics = {
      ...defaultMetrics,
      solarNodesCount: 2,
      totalSolarVoltage: 24,
      totalSolarAmps: 15.5,
    };
    render(<DashboardPanel metrics={metrics} calculatedSolarWatts={0} />);

    expect(screen.getByText('Solar-Array Output:')).toBeInTheDocument();
    expect(screen.getByText('24V / 15.5A')).toBeInTheDocument();
  });

  it('renders missing fuse warning when hasDirectBatteryToConsumer is true', () => {
    const metrics = {
      ...defaultMetrics,
      hasDirectBatteryToConsumer: true,
    };
    render(<DashboardPanel metrics={metrics} calculatedSolarWatts={0} />);

    expect(screen.getByText(/Warnung: Verbraucher ist direkt mit der Batterie verbunden/)).toBeInTheDocument();
  });

  it('renders Dachplaner-Daten panel when calculatedSolarWatts > 0', () => {
    render(<DashboardPanel metrics={defaultMetrics} calculatedSolarWatts={400} />);

    expect(screen.getByText(/Dachplaner-Daten erkannt:/)).toBeInTheDocument();
    expect(screen.getAllByText(/400 W/).length).toBeGreaterThan(0);
  });

  it('renders all sections when all conditions are met', () => {
    const metrics = {
      ...defaultMetrics,
      solarNodesCount: 1,
      totalSolarVoltage: 12,
      totalSolarAmps: 10,
      hasDirectBatteryToConsumer: true,
    };
    render(<DashboardPanel metrics={metrics} calculatedSolarWatts={200} />);

    expect(screen.getByText('Solar-Array Output:')).toBeInTheDocument();
    expect(screen.getByText('12V / 10.0A')).toBeInTheDocument();
    expect(screen.getByText(/Warnung: Verbraucher ist direkt mit der Batterie verbunden/)).toBeInTheDocument();
    expect(screen.getByText(/Dachplaner-Daten erkannt:/)).toBeInTheDocument();
  });
});
