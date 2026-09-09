import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      colors: {
        bg: "#0a0a0f",
        surface: "#111118",
        "surface-hi": "#16161f",
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          hi: "rgba(255,255,255,0.14)",
        },
        ink: {
          DEFAULT: "#ffffff",
          secondary: "#94a3b8",
          faint: "#64748b",
        },
        house: {
          bhagiratha: "#3b82f6",
          karna: "#ef4444",
          arjuna: "#22c55e",
          ekalavya: "#f59e0b",
        },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.45)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-468px 0" },
          "100%": { backgroundPosition: "468px 0" },
        },
        "fade-slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(2%, -3%) scale(1.05)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "count-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
        "fade-slide-up": "fade-slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "float-slow": "float-slow 12s ease-in-out infinite",
        ticker: "ticker 40s linear infinite",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
