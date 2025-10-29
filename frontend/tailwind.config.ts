import type { Config } from "tailwindcss";

const pixelSpacing = {
  px: "1px",
  0: "0",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px"
};

const colors = {
  ink: "#1f2933",
  parchment: "#f4ede2",
  lagoon: "#5dbbcd",
  coral: "#ff7a6c",
  kelp: "#3c8c6c",
  night: "#12121c"
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./pages/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "./app/**/*.{md,mdx}", "./scripts/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ...colors,
        background: colors.night,
        foreground: colors.parchment
      },
      spacing: {
        ...pixelSpacing,
        "control-gap": "48px"
      },
      borderRadius: {
        pixel: "4px"
      },
      boxShadow: {
        pixel: "0 4px 0 0 rgba(18, 18, 28, 0.7)"
      },
      screens: {
        xs: "375px"
      }
    }
  },
  plugins: []
};

export default config;
