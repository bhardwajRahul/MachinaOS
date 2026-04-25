/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        dracula: {
          green: "hsl(var(--dracula-green))",
          purple: "hsl(var(--dracula-purple))",
          pink: "hsl(var(--dracula-pink))",
          cyan: "hsl(var(--dracula-cyan))",
          red: "hsl(var(--dracula-red))",
          orange: "hsl(var(--dracula-orange))",
          yellow: "hsl(var(--dracula-yellow))",
          selection: "hsl(var(--dracula-selection))",
          "current-line": "hsl(var(--dracula-current-line))",
          comment: "hsl(var(--dracula-comment))",
        },
        // Role-based node tokens — base + soft (tinted bg) + border
        // (tinted outline). Themes redefine the underlying CSS vars.
        // Call sites use bg-node-X-soft / border-node-X-border directly,
        // never with /N opacity arithmetic.
        "node-agent":           "hsl(var(--node-agent))",
        "node-agent-soft":      "hsl(var(--node-agent-soft))",
        "node-agent-border":    "hsl(var(--node-agent-border))",
        "node-model":           "hsl(var(--node-model))",
        "node-model-soft":      "hsl(var(--node-model-soft))",
        "node-model-border":    "hsl(var(--node-model-border))",
        "node-skill":           "hsl(var(--node-skill))",
        "node-skill-soft":      "hsl(var(--node-skill-soft))",
        "node-skill-border":    "hsl(var(--node-skill-border))",
        "node-tool":            "hsl(var(--node-tool))",
        "node-tool-soft":       "hsl(var(--node-tool-soft))",
        "node-tool-border":     "hsl(var(--node-tool-border))",
        "node-trigger":         "hsl(var(--node-trigger))",
        "node-trigger-soft":    "hsl(var(--node-trigger-soft))",
        "node-trigger-border":  "hsl(var(--node-trigger-border))",
        "node-workflow":        "hsl(var(--node-workflow))",
        "node-workflow-soft":   "hsl(var(--node-workflow-soft))",
        "node-workflow-border": "hsl(var(--node-workflow-border))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
