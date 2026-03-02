import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}", "./shared/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        page: "#FAEBD7",
        "page-dark": "#0D0D0D",
        primary: "#1A1A1A",
        "primary-dark": "#F0F0F0",
        secondary: "#6D6D6D",
        "secondary-dark": "#9A9A9A",
        tertiary: "#929292",
        "tertiary-dark": "#5E5E5E",
        "accent-green": "#7CB243",
        "accent-green-dark": "#8BC34A",
        "accent-green-light": "#D4EDBA",
        "accent-green-light-dark": "#1A2E12",
        "accent-red": "#D45B5B",
        "accent-red-dark": "#E06060",
        card: "#FFFFFF",
        "card-dark": "#1C1C1E",
        "peach-light": "#F5E1C8",
        "peach-light-dark": "#2A1F1A",
        "chart-bg": "#F5E1C8",
        "chart-bg-dark": "#2A1F1A",
        nav: "#1A1A1A",
        "nav-dark": "#1C1C1E",
        "chart-food": "#7CB243",
        "chart-transport": "#E8A090",
        "chart-shopping": "#1A1A1A",
        "chart-bills": "#8BBAE8",
        "chart-other": "#B8A9D4",
      },
      fontFamily: {
        "poppins-medium": ["Poppins_500Medium"],
        "poppins-semibold": ["Poppins_600SemiBold"],
        "poppins-bold": ["Poppins_700Bold"],
        "poppins-extrabold": ["Poppins_800ExtraBold"],
      },
      fontSize: {
        nav: ["10px", { lineHeight: "14px" }],
        caption: ["12px", { lineHeight: "16px" }],
        label: ["13px", { lineHeight: "18px" }],
        body: ["14px", { lineHeight: "20px" }],
        section: ["16px", { lineHeight: "22px" }],
        logo: ["22px", { lineHeight: "28px" }],
        balance: ["32px", { lineHeight: "40px" }],
      },
      borderRadius: {
        icon: "12px",
        chart: "16px",
        "nav-pill": "36px",
      },
    },
  },
  plugins: [],
};

export default config;
