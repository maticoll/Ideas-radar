import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f1a",
        panel: "#121826",
        panel2: "#1a2234",
        border: "#26304a",
        muted: "#8b97b3",
        text: "#e7ecf7",
        brand: "#6366f1",
        brand2: "#22d3ee",
        good: "#34d399",
        warn: "#fbbf24",
        bad: "#f87171",
      },
      borderRadius: {
        xl2: "1.1rem",
      },
    },
  },
  plugins: [],
};

export default config;
