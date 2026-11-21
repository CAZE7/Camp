/**
 * Einwilligung und Host-Schranke für GA4. Die Schranke ist absichtlich exakt:
 * Tests, Vorschauen und andere Domains dürfen keine Google-Anfrage auslösen.
 */
export const ANALYTICS_CONSENT_KEY = '12v-consent';
export const ANALYTICS_LIVE_HOST = '12v-planer.de';

export type AnalyticsConsent = 'granted' | 'denied' | null;

export function isAnalyticsLiveHost(hostname: string): boolean {
  return hostname === ANALYTICS_LIVE_HOST;
}

export function readAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
    return true;
  } catch {
    return false;
  }
}

export function clearAnalyticsConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    // Ohne zugänglichen Speicher bleibt Analytics aus; die Seite funktioniert weiter.
  }
}
