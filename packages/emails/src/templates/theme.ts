import type { TailwindConfig } from "react-email";

export const nameraTheme: NonNullable<TailwindConfig["theme"]> = {
  extend: {
    colors: {
      "email-light-background": "#f5f5f6",
      "email-light-surface": "#ffffff",
      "email-light-foreground": "#18191a",
      "email-light-muted": "#68696b",
      "email-light-border": "#e4e4e7",
      "email-light-field": "#f1f1f3",
      "email-dark-background": "#121213",
      "email-dark-surface": "#1a1a1b",
      "email-dark-foreground": "#f7f8f8",
      "email-dark-muted": "#939496",
      "email-dark-border": "#2e2c2e",
      "email-dark-field": "#252628",
      "email-accent": "#5e6ad2",
      "email-accent-foreground": "#f7f8f8",
    },
    fontFamily: {
      sans: ["Inter", "system-ui", "Arial", "sans-serif"],
    },
  },
};
