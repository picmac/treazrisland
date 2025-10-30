import { type Config } from "tailwindcss";

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

const palette = {
  ink: "#1f2933",
  parchment: "#f4ede2",
  lagoon: "#5dbbcd",
  coral: "#ff7a6c",
  kelp: "#3c8c6c",
  night: "#12121c"
};

const config = {
  content: [
    "./app/**/*.{ts,tsx,md,mdx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./scripts/**/*.{ts,tsx}",
    "./tests/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ...palette,
        background: palette.night,
        foreground: palette.parchment
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
} satisfies Config;

export default config;
