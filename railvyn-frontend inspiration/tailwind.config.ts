import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#090d0b",
        panel: "#0e1411",
        line: "#1d2823",
        brand: "#3fd58a",
        muted: "#8b9791",
        warn: "#e5b93c",
        danger: "#ef4444",
      },
    },
  },
  plugins: [],
};
export default config;
