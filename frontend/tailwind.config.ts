import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08090d",
        cyanpulse: "#55f5ff",
        violetpulse: "#9b7bff",
      },
      boxShadow: {
        neon: "0 0 32px rgba(85, 245, 255, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
