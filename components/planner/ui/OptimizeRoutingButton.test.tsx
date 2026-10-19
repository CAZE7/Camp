import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { OptimizeRoutingButton } from './OptimizeRoutingButton';
import { RoutingStatusBadge } from './RoutingStatusBadge';
import { clearCableRoutes, publishCableRouteGeneration } from '../../edges/utils/cableRouteStore';
afterEach(() => {
  cleanup();
  clearCableRoutes();
});
it('disables optimization without a current plan and after exhausting the deterministic budget', () => {
  render(<OptimizeRoutingButton />);
  expect(screen.getByRole('button', { name: 'Kabel optimieren' })).toBeDisabled();
  act(() =>
    publishCableRouteGeneration({
      hash: 'h',
      generation: 1,
      revision: 1,
      allowed: true,
      converged: true,
      state: 'valid',
    })
  );
  expect(screen.getByRole('button')).toBeEnabled();
  act(() =>
    publishCableRouteGeneration({
      hash: 'h',
      generation: 1,
      revision: 2,
      allowed: true,
      converged: true,
      state: 'partial',
      optimization: { attempted: 4, accepted: 1, budgetExhausted: true },
    })
  );
  expect(screen.getByRole('button')).toBeDisabled();
});
it.each(['pending', 'routing', 'retained', 'stale', 'error', 'partial', 'optimized'] as const)(
  'labels lifecycle %s without claiming verified current routing',
  (state) => {
    act(() =>
      publishCableRouteGeneration({
        hash: 'h',
        generation: 1,
        revision: 1,
        allowed: true,
        converged: true,
        state,
      })
    );
    render(<RoutingStatusBadge />);
    expect(screen.getByTestId(`routing-status-${state}`)).toBeInTheDocument();
    expect(screen.queryByTestId('routing-status-valid')).not.toBeInTheDocument();
  }
);
