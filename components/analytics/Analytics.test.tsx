import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Analytics, track } from './Analytics';
import {
  ANALYTICS_CONSENT_KEY,
  clearAnalyticsConsent,
  isAnalyticsLiveHost,
  readAnalyticsConsent,
  saveAnalyticsConsent,
} from './consent';

describe('GA4 consent boundary', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.querySelector('#ga4-src')?.remove();
    delete window.gtag;
    delete window.dataLayer;
  });

  it('allows only the exact production hostname', () => {
    expect(isAnalyticsLiveHost('12v-planer.de')).toBe(true);
    expect(isAnalyticsLiveHost('localhost')).toBe(false);
    expect(isAnalyticsLiveHost('127.0.0.1')).toBe(false);
    expect(isAnalyticsLiveHost('www.12v-planer.de')).toBe(false);
    expect(isAnalyticsLiveHost('preview.12v-planer.de')).toBe(false);
  });

  it('does not show a consent banner or load Google Analytics on local/test hosts', () => {
    render(<Analytics />);

    expect(screen.queryByRole('dialog', { name: /reichweitenmessung/i })).not.toBeInTheDocument();
    expect(document.head.querySelector('#ga4-src')).toBeNull();
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBeNull();
  });

  it('never sends events on a local/test host, even with a stored grant', () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
    window.gtag = vi.fn();

    track('pdf_export', { report: 'druckbericht' });

    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('reads, saves and clears only the documented consent choices', () => {
    expect(readAnalyticsConsent()).toBeNull();
    expect(saveAnalyticsConsent('granted')).toBe(true);
    expect(readAnalyticsConsent()).toBe('granted');
    expect(saveAnalyticsConsent('denied')).toBe(true);
    expect(readAnalyticsConsent()).toBe('denied');

    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, 'unexpected');
    expect(readAnalyticsConsent()).toBeNull();
    saveAnalyticsConsent('granted');
    clearAnalyticsConsent();
    expect(readAnalyticsConsent()).toBeNull();
  });
});
