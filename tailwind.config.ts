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
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: 'rgb(var(--paper-rgb) / <alpha-value>)',
        bone: 'rgb(var(--bone-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        'ink-soft': 'var(--ink-soft)',
        clay: 'var(--clay)',
        oak: 'var(--oak)',
        copper: 'rgb(var(--copper-rgb) / <alpha-value>)',
        'copper-deep': 'var(--copper-deep)',
        moss: 'rgb(var(--moss-rgb) / <alpha-value>)',
        soot: 'var(--soot)',
        signal: 'rgb(var(--signal-rgb) / <alpha-value>)',
        oxide: 'rgb(var(--oxide-rgb) / <alpha-value>)',
        rule: 'rgb(var(--rule-rgb) / <alpha-value>)',
        background: 'var(--background)',
        foreground: 'rgb(var(--foreground-rgb) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--card-rgb) / <alpha-value>)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary-rgb) / <alpha-value>)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted-rgb) / <alpha-value>)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive-rgb) / <alpha-value>)',
          foreground: 'var(--destructive-foreground)',
        },
        info: 'var(--info)',
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
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
