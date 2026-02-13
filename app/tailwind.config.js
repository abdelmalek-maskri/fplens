/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
          950: "rgb(var(--brand-950) / <alpha-value>)",
        },
        surface: {
          50: "rgb(var(--surface-50) / <alpha-value>)",
          100: "rgb(var(--surface-100) / <alpha-value>)",
          200: "rgb(var(--surface-200) / <alpha-value>)",
          300: "rgb(var(--surface-300) / <alpha-value>)",
          400: "rgb(var(--surface-400) / <alpha-value>)",
          500: "rgb(var(--surface-500) / <alpha-value>)",
          600: "rgb(var(--surface-600) / <alpha-value>)",
          700: "rgb(var(--surface-700) / <alpha-value>)",
          800: "rgb(var(--surface-800) / <alpha-value>)",
          900: "rgb(var(--surface-900) / <alpha-value>)",
          950: "rgb(var(--surface-950) / <alpha-value>)",
        },
        success: {
          400: "rgb(var(--success-400) / <alpha-value>)",
          500: "rgb(var(--success-500) / <alpha-value>)",
          600: "rgb(var(--success-600) / <alpha-value>)",
        },
        warning: {
          300: "rgb(var(--warning-300) / <alpha-value>)",
          400: "rgb(var(--warning-400) / <alpha-value>)",
          500: "rgb(var(--warning-500) / <alpha-value>)",
          600: "rgb(var(--warning-600) / <alpha-value>)",
        },
        danger: {
          400: "rgb(var(--danger-400) / <alpha-value>)",
          500: "rgb(var(--danger-500) / <alpha-value>)",
          600: "rgb(var(--danger-600) / <alpha-value>)",
          700: "rgb(var(--danger-700) / <alpha-value>)",
        },
        info: {
          400: "rgb(var(--info-400) / <alpha-value>)",
          500: "rgb(var(--info-500) / <alpha-value>)",
          600: "rgb(var(--info-600) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "Outfit",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        data: [
          "JetBrains Mono",
          "Menlo",
          "Monaco",
          "monospace",
        ],
        mono: ["JetBrains Mono", "Menlo", "Monaco", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        xs: ["0.6875rem", { lineHeight: "1rem" }],
        sm: ["0.75rem", { lineHeight: "1rem" }],
        base: ["0.8125rem", { lineHeight: "1.25rem" }],
        lg: ["0.9375rem", { lineHeight: "1.375rem" }],
        xl: ["1.125rem", { lineHeight: "1.5rem" }],
        "2xl": ["1.375rem", { lineHeight: "1.75rem" }],
        "3xl": ["1.625rem", { lineHeight: "2rem" }],
        "4xl": ["2rem", { lineHeight: "2.5rem" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
