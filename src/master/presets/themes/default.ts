import type { Theme } from "../../../types/theme.ts";

/** デフォルトテーマ (明るい) */
export const defaultTheme: Theme = {
  name: "default",
  colors: {
    primary: "#2B579A",
    secondary: "#405D72",
    background: "#FFFFFF",
    text: "#1A1A2E",
    accent: "#5B9BD5",
    muted: "#F4F5F7",
  },
  fonts: {
    heading: "Calibri",
    body: "Calibri",
    mono: "Consolas",
  },
};
