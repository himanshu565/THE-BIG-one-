import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101315",
        panel: "#171b1c",
        muted: "#858c8c",
        line: "#2a3030",
        lime: "#d4f86a",
        cyan: "#8bd9d2"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Arial", "sans-serif"],
        display: ["var(--font-space-grotesk)", "Arial", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(212, 248, 106, .08), 0 12px 40px rgba(0, 0, 0, .2)"
      }
    }
  },
  plugins: []
};

export default config;
