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
        paper: 'var(--paper)',
        bone: 'var(--bone)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        clay: 'var(--clay)',
        oak: 'var(--oak)',
        copper: 'var(--copper)',
        'copper-deep': 'var(--copper-deep)',
        moss: 'var(--moss)',
        soot: 'var(--soot)',
        signal: 'var(--signal)',
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
