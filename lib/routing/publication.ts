import type { FinalValidationReport } from './finalValidation';

export type RoutingPublicationState =
  'pending' | 'routing' | 'valid' | 'optimized' | 'partial' | 'retained' | 'invalid' | 'stale' | 'error';

/** Pure transaction decision. Reports must be for the CURRENT input, not cached verdicts. */
export function selectRoutingPublication<T>(input: {
  candidate?: T;
  candidateReport?: FinalValidationReport;
  previous: T;
  previousReport: FinalValidationReport;
  hasPrevious: boolean;
  error?: string;
}): { routes: T; report: FinalValidationReport; state: RoutingPublicationState; reason?: string } {
  if (input.candidate !== undefined && input.candidateReport?.status === 'VALID') {
    return { routes: input.candidate, report: input.candidateReport, state: 'valid' };
  }
  if (input.hasPrevious) {
    return {
      routes: input.previous,
      report: input.previousReport,
      state: input.previousReport.status === 'VALID' ? 'retained' : 'stale',
      reason:
        input.error ?? 'Der neue Routing-Kandidat wurde verworfen; der vorherige Stand bleibt erhalten.',
    };
  }
  return {
    routes: input.candidate ?? input.previous,
    report: input.candidateReport ?? input.previousReport,
    state: input.error ? 'error' : 'invalid',
    reason: input.error ?? 'Keine gültige Route verfügbar; die Geometrie ist nur eine Konfliktdiagnose.',
  };
}
