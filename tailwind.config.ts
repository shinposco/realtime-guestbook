import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#242822",
        moss: "#405143",
        paper: "#faf8f1",
        line: "#e7e2d6",
      },
    },
  },
  plugins: [],
} satisfies Config;
