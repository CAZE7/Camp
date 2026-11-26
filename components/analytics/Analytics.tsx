'use client';

import { useEffect, useState, type MouseEvent } from 'react';

import {
  clearAnalyticsConsent,
  isAnalyticsLiveHost,
  readAnalyticsConsent,
  saveAnalyticsConsent,
} from './consent';
import { isPlannerOnboardingOpen, subscribePlannerOnboarding } from './onboardingGate';

const GA_ID = 'G-Q7E3XL4T34';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isLive(): boolean {
  return typeof window !== 'undefined' && isAnalyticsLiveHost(window.location.hostname);
}

function ensureGtagQueue(): NonNullable<Window['gtag']> {
  window.dataLayer ??= [];
  if (typeof window.gtag !== 'function') {
    const dataLayer = window.dataLayer;
    window.gtag = (...args: unknown[]) => dataLayer.push(args);
  }
  return window.gtag;
}

/** Lädt das Google-Tag nur nach gespeicherter Zustimmung auf der Live-Domain. */
function loadGtag(): void {
  if (!isLive() || readAnalyticsConsent() !== 'granted') return;

  const gtag = ensureGtagQueue();
  gtag('consent', 'update', { analytics_storage: 'granted' });
  if (document.getElementById('ga4-src')) return;

  const script = document.createElement('script');
  script.id = 'ga4-src';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  gtag('js', new Date());
  // GA4 verarbeitet die IP-Adresse nicht als gespeichertes Nutzungsmerkmal;
  // `anonymize_ip` ist für GA4 wirkungslos und wird daher nicht gesetzt.
  gtag('config', GA_ID);
}

export type AnalyticsEvent = 'planner_start' | 'pdf_export' | 'calc_used';

/** Event-IDs werden pro Seitenaufruf dedupliziert; Exporte dürfen mehrfach zählen. */
const sent = new Set<string>();
export function track(event: AnalyticsEvent, params: Record<string, string> = {}): void {
  if (!isLive() || readAnalyticsConsent() !== 'granted' || typeof window.gtag !== 'function') return;

  const pagePath = params.page_path ?? window.location.pathname;
  const key =
    event === 'pdf_export'
      ? null
      : event === 'calc_used'
        ? `${event}:${params.calc_name ?? 'unknown'}:${pagePath}`
        : event;
  if (key !== null && sent.has(key)) return;
  if (key !== null) sent.add(key);
  window.gtag('event', event, params);
}

/** Rechner-Nutzung: erste Eingabe je Rechner und Seite, erkannt an den Feld-IDs. */
const CALC_BY_ID_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ['spannung-', 'spannungsabfall'],
  ['rechner-', 'kabelquerschnitt'],
  ['batterie-', 'batteriekapazitaet'],
  ['solar-', 'solaranlage'],
  ['temp-', 'heizlast'],
  ['window-area', 'heizlast'],
  ['insulation-coverage', 'heizlast'],
];

function calcNameFor(element: Element | null): string | null {
  const id = (element as HTMLElement | null)?.id ?? '';
  return CALC_BY_ID_PREFIX.find(([prefix]) => id.startsWith(prefix))?.[1] ?? null;
}

export function Analytics() {
  const [ask, setAsk] = useState(false);
  const [storageError, setStorageError] = useState(false);
  // R8-01: Solange der Erstbesuch-Assistent auf /planer/ offen ist, bleibt
  // der Banner verborgen — er verdeckte sonst dessen Fußzeile, und ein Tipp
  // auf „Weiter“ traf „Akzeptieren“ (Einwilligung per Fehltipp).
  const [onboardingOpen, setOnboardingOpen] = useState(isPlannerOnboardingOpen);

  useEffect(() => subscribePlannerOnboarding(() => setOnboardingOpen(isPlannerOnboardingOpen())), []);

  useEffect(() => {
    if (!isLive()) return;

    let active = true;
    const choice = readAnalyticsConsent();
    if (choice === 'granted') loadGtag();
    else if (choice !== 'denied') {
      // Defer the first UI state update past the effect's synchronous phase;
      // this keeps hydration deterministic and avoids a cascading render.
      window.queueMicrotask(() => {
        if (active) setAsk(true);
      });
    }

    const onInput = (event: Event) => {
      const name = calcNameFor(event.target as Element | null);
      if (name) track('calc_used', { calc_name: name, page_path: window.location.pathname });
    };
    document.addEventListener('change', onInput, true);
    document.addEventListener('input', onInput, true);
    return () => {
      active = false;
      document.removeEventListener('change', onInput, true);
      document.removeEventListener('input', onInput, true);
    };
  }, []);

  const aufPlaner = typeof window !== 'undefined' && window.location.pathname.startsWith('/planer');
  if (!ask || (aufPlaner && onboardingOpen)) return null;

  const decide = (granted: boolean) => {
    const saved = saveAnalyticsConsent(granted ? 'granted' : 'denied');
    if (granted && !saved) {
      setStorageError(true);
      return;
    }
    setAsk(false);
    setStorageError(false);
    if (granted) loadGtag();
  };

  return (
    <aside
      className="analytics-consent"
      role="dialog"
      aria-live="polite"
      aria-label="Einwilligung in die Reichweitenmessung"
      aria-describedby="analytics-consent-copy"
    >
      <p id="analytics-consent-copy">
        Darf 12V-Planer mit Google Analytics statistisch zählen, welche Seiten und Rechner genutzt werden?
        Ohne Zustimmung wird nichts an Google gesendet. Details stehen in der{' '}
        <a href="/datenschutz/">Datenschutzerklärung</a>.
      </p>
      {storageError && (
        <p className="analytics-consent-error" role="status">
          Deine Zustimmung konnte nicht gespeichert werden. Analytics bleibt deshalb ausgeschaltet.
        </p>
      )}
      <div className="analytics-consent-actions">
        <button type="button" onClick={() => decide(false)}>
          Ablehnen
        </button>
        <button type="button" onClick={() => decide(true)}>
          Akzeptieren
        </button>
      </div>
    </aside>
  );
}

/** Link im Footer: widerruft die Einwilligung und öffnet das Banner erneut. */
export function CookieSettingsLink() {
  const openSettings = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isLive()) return;
    event.preventDefault();
    // Die GA-Cookies werden nach dem Widerruf nicht mehr gelesen; beim Neuladen
    // bleibt das Google-Tag wegen fehlender Einwilligung ungeladen.
    clearAnalyticsConsent();
    window.location.reload();
  };

  return (
    <a
      href="/datenschutz/"
      onClick={openSettings}
      className="inline-flex min-h-11 items-center text-sm text-ink-soft underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
    >
      Cookie-Einstellungen
    </a>
  );
}
