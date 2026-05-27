import type { TailwindConfig } from "react-email";

import { Font } from "react-email";
import plugin from "tailwindcss/plugin";

const colors2 = {
  background: "#0f0f10",
  "background-2": "#212121",
  foreground: "#FFFFFF",
  primary: "#6a75e2",
  "primary-foreground": "#fefeff",
  muted: "#171718",
  "muted-foreground": "#97989a",
  accent: "#262627",
  "accent-foreground": "#ffffff",
  destructive: "#f34e52",
  "destructive-foreground": "#ffffff",
  border: "#1d1e1f",
} as const;

export const NameraFonts = () => {
  return (
    <>
      <Font
        fontFamily="Inter"
        fallbackFontFamily={["Arial", "sans-serif"]}
        webFont={{
          url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuOKfMZg.ttf",
          format: "truetype",
        }}
        fontWeight={300}
        fontStyle="normal"
      />
      <Font
        fontFamily="Inter"
        fallbackFontFamily={["Arial", "sans-serif"]}
        webFont={{
          url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2",
          format: "woff2",
        }}
        fontWeight={400}
        fontStyle="normal"
      />
      <Font
        fontFamily="Inter"
        fallbackFontFamily={["Arial", "sans-serif"]}
        webFont={{
          url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf",
          format: "truetype",
        }}
        fontWeight={500}
        fontStyle="normal"
      />
    </>
  );
};

const fontScale = {
  11: {
    fontSize: "11px",
    lineHeight: "1.5",
    letterSpacing: "0.3px",
    fontWeight: "300",
  },
  13: {
    fontSize: "13px",
    lineHeight: "1.5",
    letterSpacing: "0.2px",
    fontWeight: "300",
  },
  14: {
    fontSize: "14px",
    lineHeight: "1.5",
    letterSpacing: "0.3px",
    fontWeight: "350",
  },
  15: {
    fontSize: "15px",
    lineHeight: "1.5",
    letterSpacing: "-0.075px",
    fontWeight: "450",
  },
  20: { fontSize: "20px", lineHeight: "1.1", fontWeight: "500" },
  24: {
    fontSize: "24px",
    lineHeight: "1.5",
    letterSpacing: "-0.072px",
    fontWeight: "500",
  },
  32: {
    fontSize: "32px",
    lineHeight: "0.9",
    letterSpacing: "0.4px",
    fontWeight: "500",
  },
  40: {
    fontSize: "40px",
    lineHeight: "1",
    letterSpacing: "-1.2px",
    fontWeight: "500",
  },
  56: {
    fontSize: "56px",
    lineHeight: "1",
    letterSpacing: "-1.68px",
    fontWeight: "500",
  },
} as const;

export const nameraTwConfig: TailwindConfig = {
  plugins: [
    plugin(({ addUtilities, addVariant }) => {
      addVariant("mobile", "@media (max-width: 600px)");
      const utilities: Record<string, Record<string, string>> = {};
      for (const [step, token] of Object.entries(fontScale)) {
        utilities[`.font-${step}`] = token;
      }
      addUtilities(utilities);
    }),
  ],
  theme: {
    extend: {
      colors: colors2,
      fontFamily: {
        sans: ["Inter", "Arial", "sans-serif"],
      },
    },
  },
};
