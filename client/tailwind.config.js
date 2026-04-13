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
        // Design-system tokens (HSL triplets from src/design-system/tokens/colors.css).
        // These are the forward-looking names; prefer these in new code.
        bg: "hsl(var(--color-bg) / <alpha-value>)",
        "bg-alt": "hsl(var(--color-bg-alt) / <alpha-value>)",
        "bg-canvas": "hsl(var(--color-bg-canvas) / <alpha-value>)",
        surface: "hsl(var(--color-surface) / <alpha-value>)",
        "surface-raised": "hsl(var(--color-surface-raised) / <alpha-value>)",
        fg: "hsl(var(--color-fg) / <alpha-value>)",
        "fg-secondary": "hsl(var(--color-fg-secondary) / <alpha-value>)",
        "fg-muted": "hsl(var(--color-fg-muted) / <alpha-value>)",
        border: {
          DEFAULT: "hsl(var(--color-border))",
          hover: "hsl(var(--color-border-hover))",
          focus: "hsl(var(--color-border-focus))",
        },
        primary: {
          DEFAULT: "hsl(var(--color-primary) / <alpha-value>)",
          foreground: "hsl(var(--color-primary-fg) / <alpha-value>)",
        },
        success: "hsl(var(--color-success) / <alpha-value>)",
        warning: "hsl(var(--color-warning) / <alpha-value>)",
        danger: "hsl(var(--color-danger) / <alpha-value>)",
        info: "hsl(var(--color-info) / <alpha-value>)",
        accent: "hsl(var(--color-accent) / <alpha-value>)",
        dracula: {
          green: "hsl(var(--color-dracula-green) / <alpha-value>)",
          purple: "hsl(var(--color-dracula-purple) / <alpha-value>)",
          pink: "hsl(var(--color-dracula-pink) / <alpha-value>)",
          cyan: "hsl(var(--color-dracula-cyan) / <alpha-value>)",
          red: "hsl(var(--color-dracula-red) / <alpha-value>)",
          orange: "hsl(var(--color-dracula-orange) / <alpha-value>)",
          yellow: "hsl(var(--color-dracula-yellow) / <alpha-value>)",
        },
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