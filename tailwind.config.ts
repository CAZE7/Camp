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
        // einziger Ort mit Hex-/rgb-Angaben im Projekt. Die *-rgb-Zwillinge
        // dort geben Tailwind die Alpha-Komponente (bg-x/10, hover:
        // bg-primary/90, Ring-Tints …); Tokens ohne Zwilling (vordefiniert
        // transparentes rgba wie scrim/warn-*-bg) bleiben nacktes var(),
        // weil sie ausschließlich volltonig verwendet werden.
        surface: {
          canvas: 'rgb(var(--surface-canvas-rgb) / <alpha-value>)',
          panel: 'rgb(var(--surface-panel-rgb) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
          hover: 'rgb(var(--surface-hover-rgb) / <alpha-value>)',
        },
        'rule-strong': 'rgb(var(--rule-strong-rgb) / <alpha-value>)',
        'on-signal': 'rgb(var(--on-signal-rgb) / <alpha-value>)',
        scrim: 'var(--scrim)',
        paper: 'rgb(var(--surface-canvas-rgb) / <alpha-value>)',
        bone: 'rgb(var(--surface-panel-rgb) / <alpha-value>)',
        ink: 'rgb(var(--text-high-rgb) / <alpha-value>)',
        'ink-soft': 'rgb(var(--text-med-rgb) / <alpha-value>)',
        clay: 'rgb(var(--text-low-rgb) / <alpha-value>)',
        oak: 'rgb(var(--oxide-rgb) / <alpha-value>)',
        copper: 'rgb(var(--oxide-rgb) / <alpha-value>)',
        'copper-deep': 'rgb(var(--oxide-rgb) / <alpha-value>)',
        moss: 'rgb(var(--ok-rgb) / <alpha-value>)',
        soot: 'rgb(var(--soot-rgb) / <alpha-value>)',
        signal: 'rgb(var(--error-rgb) / <alpha-value>)',
        oxide: 'rgb(var(--oxide-rgb) / <alpha-value>)',
        rule: 'rgb(var(--rule-rgb) / <alpha-value>)',
        background: 'rgb(var(--background-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--foreground-rgb) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--card-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground-rgb) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--popover-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--popover-foreground-rgb) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground-rgb) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground-rgb) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground-rgb) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground-rgb) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground-rgb) / <alpha-value>)',
        },
        info: 'rgb(var(--info-rgb) / <alpha-value>)',
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        wire: {
          dc: 'rgb(var(--wire-dc-rgb) / <alpha-value>)',
          'dc-minus': 'rgb(var(--wire-dc-minus-rgb) / <alpha-value>)',
          ac: 'rgb(var(--wire-ac-rgb) / <alpha-value>)',
          solar: 'rgb(var(--wire-solar-rgb) / <alpha-value>)',
          selected: 'rgb(var(--wire-selected-rgb) / <alpha-value>)',
          error: 'rgb(var(--wire-error-rgb) / <alpha-value>)',
        },
        pipe: {
          fresh: 'rgb(var(--pipe-fresh-rgb) / <alpha-value>)',
          gray: 'rgb(var(--pipe-gray-rgb) / <alpha-value>)',
          selected: 'rgb(var(--pipe-selected-rgb) / <alpha-value>)',
        },
        warn: {
          critical: 'rgb(var(--warn-critical-rgb) / <alpha-value>)',
          'critical-bg': 'var(--warn-critical-bg)',
          'critical-border': 'var(--warn-critical-border)',
          warning: 'rgb(var(--warn-warning-rgb) / <alpha-value>)',
          'warning-bg': 'var(--warn-warning-bg)',
          'warning-border': 'var(--warn-warning-border)',
          info: 'rgb(var(--warn-info-rgb) / <alpha-value>)',
          'info-bg': 'var(--warn-info-bg)',
          'info-border': 'var(--warn-info-border)',
        },
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        input: 'rgb(var(--input-rgb) / <alpha-value>)',
        ring: 'rgb(var(--ring-rgb) / <alpha-value>)',
        chart: {
          '1': 'rgb(var(--chart-1-rgb) / <alpha-value>)',
          '2': 'rgb(var(--chart-2-rgb) / <alpha-value>)',
          '3': 'rgb(var(--chart-3-rgb) / <alpha-value>)',
          '4': 'rgb(var(--chart-4-rgb) / <alpha-value>)',
          '5': 'rgb(var(--chart-5-rgb) / <alpha-value>)',
        },
      },
      opacity: {
        // 15/45 fehlen in Tailwinds Standardskala, sind aber im Planer im
        // Einsatz (border-copper/45, Tint-Flächen/15) — ohne Eintrag would
        // der Modifier stillschweigend verworfen.
        15: '0.15',
        45: '0.45',
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
