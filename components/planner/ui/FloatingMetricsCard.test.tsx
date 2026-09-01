import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingMetricsCard } from './FloatingMetricsCard';
import React from 'react';

// Mock the stores and hooks
const mockPlannerStore = vi.fn();
vi.mock('../../../store/usePlannerStore', () => ({
  usePlannerStore: (selector: (state: ReturnType<typeof mockPlannerStore>) => unknown) =>
    selector(mockPlannerStore()),
}));

const mockAppStore = vi.fn();
vi.mock('../../../lib/store', () => ({
  useAppStore: (selector: (state: ReturnType<typeof mockAppStore>) => unknown) => selector(mockAppStore()),
}));

const mockDashboardMetrics = vi.fn();
vi.mock('../hooks/useDashboardMetrics', () => ({
  useDashboardMetrics: () => mockDashboardMetrics(),
}));

describe('FloatingMetricsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default planner store state
    mockPlannerStore.mockReturnValue({
      nodes: [{ id: 'battery', type: 'battery', data: {} }],
      edges: [],
      season: 'summer',
      viewMode: 'electric',
    });

    // Default app store state
    mockAppStore.mockReturnValue({
      calculatedSolarWatts: 0,
    });

    // Default dashboard metrics
    mockDashboardMetrics.mockReturnValue({
      autarkyStr: '1 Tag',
      dailyConsumptionAh: 10,
      chargingTimeStr: '2h',
      solarNodesCount: 0,
      totalSolarVoltage: 0,
      totalSolarAmps: 0,
      hasDirectBatteryToConsumer: false,
    });
  });

  it('renders correct solar output when canvas solar nodes exist', () => {
    mockDashboardMetrics.mockReturnValue({
      autarkyStr: '1 Tag',
      dailyConsumptionAh: 10,
      chargingTimeStr: '2h',
      solarNodesCount: 2, // Solar nodes exist
      totalSolarVoltage: 24,
      totalSolarAmps: 15.5,
      hasDirectBatteryToConsumer: false,
    });

    render(<FloatingMetricsCard />);

    // Expand the card
    fireEvent.click(screen.getByRole('button', { name: /Aktueller Status/ }));

    expect(screen.getByText('Solarleistung')).toBeInTheDocument();
    // It should render "24V / 15.5A" and NOT literal "${metrics.totalSolarVoltage}V..."
    expect(screen.getByText('24 V / 15.5 A')).toBeInTheDocument();
  });

  it('renders correct solar output when only roof planner solar wattage exists', () => {
    mockAppStore.mockReturnValue({
      calculatedSolarWatts: 450, // Roof planner wattage exists
    });

    mockDashboardMetrics.mockReturnValue({
      autarkyStr: '1 Tag',
      dailyConsumptionAh: 10,
      chargingTimeStr: '2h',
      solarNodesCount: 0, // No solar nodes
      totalSolarVoltage: 0,
      totalSolarAmps: 0,
      hasDirectBatteryToConsumer: false,
    });

    render(<FloatingMetricsCard />);

    // Expand the card
    fireEvent.click(screen.getByRole('button', { name: /Aktueller Status/ }));

    expect(screen.getByText('Solarleistung')).toBeInTheDocument();
    // It should render "450W" and NOT literal "${calculatedSolarWatts}W"
    expect(screen.getByText('450 W')).toBeInTheDocument();
  });
});
