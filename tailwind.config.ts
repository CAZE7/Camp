import type { Config } from "tailwindcss"
import animate from "tailwindcss-animate"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        accentp: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          soft: "var(--accent-soft)",
        },
        canvas: {
          DEFAULT: "var(--canvas)",
          grid: "var(--canvas-grid)",
          "grid-strong": "var(--canvas-grid-strong)",
        },
        panel: "var(--panel)",
        toolbar: "var(--toolbar)",
        node: {
          surface: "var(--node-surface)",
          border: "var(--node-border)",
          borderStrong: "var(--node-border-strong)",
          muted: "var(--node-muted)",
        },
        pol: {
          plus: "var(--pol-plus)",
          minus: "var(--pol-minus)",
          ground: "var(--pol-ground)",
          neutral: "var(--pol-neutral)",
        },
        cable: {
          positive: "var(--cable-positive)",
          negative: "var(--cable-negative)",
          ground: "var(--cable-ground)",
          solar: "var(--cable-solar)",
          shore: "var(--cable-shore)",
          inverter: "var(--cable-inverter)",
          charging: "var(--cable-charging)",
          main: "var(--cable-main)",
          secondary: "var(--cable-secondary)",
        },
        acc: {
          battery: "var(--acc-battery)",
          consumer: "var(--acc-consumer)",
          charger: "var(--acc-charger)",
          fuse: "var(--acc-fuse)",
          shore: "var(--acc-shore)",
          consumer230v: "var(--acc-consumer230v)",
          inverter: "var(--acc-inverter)",
          solar: "var(--acc-solar)",
          ground: "var(--acc-ground)",
          conduit: "var(--acc-conduit)",
          busbar: "var(--acc-busbar)",
          shunt: "var(--acc-shunt)",
          water: "var(--acc-water)",
          "water-fresh": "var(--acc-water-fresh)",
          "water-gray": "var(--acc-water-gray)",
          pump: "var(--acc-pump)",
          accumulator: "var(--acc-accumulator)",
          prefilter: "var(--acc-prefilter)",
          sink: "var(--acc-sink)",
          shower: "var(--acc-shower)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
}
export default config
