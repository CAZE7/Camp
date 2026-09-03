import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // 4-px-Abstandsraster (D-2): Tailwind-Skala ist per Definition 4-px-basiert
    // (1 Einheit = 0.25rem). Erwartung: padding/margin/gap nur in ganzzahligen
    // Einheiten (Vielfache von 4 px); arbitrary off-grid-Werte sind verboten
    // und werden im Review abgelehnt.
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        /* Werft-Type-Scale (D-2): 12 / 13 / 14 / 16 / 20 / 24 / 32 px.
         Einzige erlaubte Schriftgrößen — neue Stufen gehören nicht in die
         Skala, Größen unter 12 px sind für Lesbarkeit tabu. Die Zeilenhöhen
         folgen dem 4-px-Raster (×1.3–1.5 je Stufe, auf 4 px gerundet). */
        xs: ['0.75rem', { lineHeight: '1rem' }], // 12
        sm: ['0.8125rem', { lineHeight: '1.25rem' }], // 13 — Labels, Meta
        base: ['0.875rem', { lineHeight: '1.25rem' }], // 14 — UI-Grundtext
        md: ['1rem', { lineHeight: '1.5rem' }], // 16 — Fließtext
        lg: ['1.25rem', { lineHeight: '1.75rem' }], // 20
        xl: ['1.5rem', { lineHeight: '2rem' }], // 24
        '2xl': ['2rem', { lineHeight: '2.5rem' }], // 32 — größte Stufe (Hero)
      },
      colors: {
        // Werft-Surface-Skala (D-1): Werte liegen in app/globals.css —
        // einziger Ort mit Hex-/rgb-Angaben im Projekt.
        surface: {
          canvas: 'var(--surface-canvas)',
          panel: 'var(--surface-panel)',
          raised: 'var(--surface-raised)',
          hover: 'var(--surface-hover)',
        },
        'rule-strong': 'var(--rule-strong)',
        'on-signal': 'var(--on-signal)',
        scrim: 'var(--scrim)',
        paper: 'var(--surface-canvas)',
        bone: 'var(--surface-panel)',
        ink: 'var(--text-high)',
        'ink-soft': 'var(--text-med)',
        clay: 'var(--text-low)',
        oak: 'var(--oxide)',
        copper: 'var(--oxide)',
        'copper-deep': 'var(--oxide)',
        moss: 'var(--ok)',
        soot: 'var(--soot)',
        signal: 'var(--error)',
        oxide: 'var(--oxide)',
        rule: 'var(--rule)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        info: 'var(--info)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        wire: {
          dc: 'var(--wire-dc)',
          'dc-minus': 'var(--wire-dc-minus)',
          ac: 'var(--wire-ac)',
          solar: 'var(--wire-solar)',
          selected: 'var(--wire-selected)',
          error: 'var(--wire-error)',
        },
        pipe: {
          fresh: 'var(--pipe-fresh)',
          gray: 'var(--pipe-gray)',
          selected: 'var(--pipe-selected)',
        },
        warn: {
          critical: 'var(--warn-critical)',
          'critical-bg': 'var(--warn-critical-bg)',
          'critical-border': 'var(--warn-critical-border)',
          warning: 'var(--warn-warning)',
          'warning-bg': 'var(--warn-warning-bg)',
          'warning-border': 'var(--warn-warning-border)',
          info: 'var(--warn-info)',
          'info-bg': 'var(--warn-info-bg)',
          'info-border': 'var(--warn-info-border)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 1px)',
        sm: '0',
      },
    },
  },
  plugins: [animate],
};
export default config;
