import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neo-brutalist comic palette
        cream: "#f5f1e8",
        mint: "#7fdfc4",
        sunny: "#ffd93d",
        bubble: "#ff6ec7",
        flame: "#ff7a1a",
        ink: "#0a0a0a",
        // Semantic
        profit: "#1fbf6b",
        loss: "#ff4d4d",
      },
      fontFamily: {
        display: ['"Archivo Black"', "Impact", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        brutal: "6px 6px 0 0 #0a0a0a",
        "brutal-sm": "4px 4px 0 0 #0a0a0a",
        "brutal-lg": "10px 10px 0 0 #0a0a0a",
      },
      borderWidth: {
        3: "3px",
        5: "5px",
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        flash: {
          "0%, 100%": { backgroundColor: "transparent" },
          "50%": { backgroundColor: "rgba(255, 217, 61, 0.4)" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.2s ease-out",
        flash: "flash 0.6s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
