import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { VerificationSeal } from './VerificationSeal';
import { verificationSummary } from '../utils/verificationWarnings';
import { verifyPlan } from '@/lib/verify';
import { healthyDcPlan, islandPlan, type FixturePlan } from '@/lib/verify/planFixtures';

/**
 * PRÜFSIEGEL — was der Nutzer über den Prüfstand erfährt.
 *
 * Die Warn-Zentrale kann nur zeigen, was sie GEFUNDEN hat. Sie kann nicht
 * zeigen, was sie NICHT geprüft hat: »keine Hinweise« sah aus wie »alles in
 * Ordnung«. Das Siegel macht die Lücke sichtbar — Verdikt, Abdeckung,
 * Modellgrenzen, Zertifikat — und benennt die Zahlen der Engine, ohne sie
 * umzudeuten (»ohne Gegenstand« ist NICHT »bestanden«).
 */
const summaryFor = (fixture: FixturePlan) =>
  verificationSummary(
    verifyPlan({
      nodes: fixture.nodes as never,
      edges: fixture.edges as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    })
  );

const open = (fixture: FixturePlan) => {
  render(<VerificationSeal summary={summaryFor(fixture)} />);
  fireEvent.click(screen.getByTestId('verification-seal-toggle'));
};

describe('VerificationSeal', () => {
  it('zeigt das Verdikt und die Zahl der angewandten Regeln', () => {
    render(<VerificationSeal summary={summaryFor(healthyDcPlan())} />);
    const button = screen.getByTestId('verification-seal-toggle');
    expect(button).toHaveTextContent('Prüfbericht:');
    expect(button).toHaveTextContent('Bestanden');
    expect(button.textContent).toMatch(
      new RegExp(`${summaryFor(healthyDcPlan()).exercised} Regeln angewandt`)
    );
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('klappt den Bericht auf und wieder zu', () => {
    render(<VerificationSeal summary={summaryFor(healthyDcPlan())} />);
    const button = screen.getByTestId('verification-seal-toggle');
    expect(screen.queryByTestId('verification-seal-panel')).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByTestId('verification-seal-panel')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(button);
    expect(screen.queryByTestId('verification-seal-panel')).not.toBeInTheDocument();
  });

  it('weist »ohne Gegenstand« getrennt von »bestanden« aus', () => {
    open(healthyDcPlan());
    const panel = screen.getByTestId('verification-seal-panel');
    expect(panel).toHaveTextContent('ohne Gegenstand');
    // Die Kennzahl sagt im Klartext, dass »nicht angewandt« kein »bestanden«
    // ist — sonst läse sich ein Plan mit neun ungeprüften Regeln als grün.
    expect(screen.getByTitle(/Sie sind NICHT bestanden/)).toBeInTheDocument();
  });

  it('nennt die fünf Durchgänge mit ihrem Zustand', () => {
    open(islandPlan());
    const panel = screen.getByTestId('verification-seal-panel');
    expect(panel).toHaveTextContent('1. Syntax & Konnektivität');
    expect(panel).toHaveTextContent('5. Erdung & Personenschutz');
    expect(panel).toHaveTextContent('verletzt');
    expect(panel).toHaveTextContent(/9 Regeln/);
  });

  it('zeigt die Modellgrenzen und das Zertifikat', () => {
    const summary = summaryFor(healthyDcPlan());
    render(<VerificationSeal summary={summary} />);
    fireEvent.click(screen.getByTestId('verification-seal-toggle'));
    const panel = screen.getByTestId('verification-seal-panel');
    expect(panel).toHaveTextContent('Modellgrenzen');
    expect(panel).toHaveTextContent('EINLEITERIG');
    expect(panel).toHaveTextContent(summary.certificateHash);
    expect(panel).toHaveTextContent(summary.planFingerprintHash);
    expect(panel).toHaveTextContent('PRACTICE');
    expect(panel).toHaveTextContent('VEHICLE');
  });

  it('meldet ein negatives Verdikt farblich und im Klartext', () => {
    render(<VerificationSeal summary={summaryFor(islandPlan())} />);
    const button = screen.getByTestId('verification-seal-toggle');
    expect(button).toHaveTextContent('Nicht bestanden');
    expect(button.className).toContain('border-warn-critical');
  });

  it('zeigt das Verdikt genau so, wie der Adapter es ausgibt (keine Zweitdeutung)', () => {
    // Die Bewertung eines unbekannten Verdikts prüft der Adapter
    // (`verificationWarnings.test.ts`); hier gilt nur: Das Siegel zeigt die
    // übergebene Beschriftung und Färbung unverändert an.
    const healthy = summaryFor(healthyDcPlan());
    render(
      <VerificationSeal
        summary={{ ...healthy, verdict: 'UNKNOWN_VERDICT' as never, label: 'Nicht bestanden', tone: 'bad' }}
      />
    );
    const button = screen.getByTestId('verification-seal-toggle');
    expect(button).toHaveTextContent('Nicht bestanden');
    expect(button.className).toContain('border-warn-critical');
  });
});
