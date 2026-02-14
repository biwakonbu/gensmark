import type { Theme } from "../../../types/theme.ts";

/** デフォルトテーマ (明るい) */
export const defaultTheme: Theme = {
  name: "default",
  colors: {
    primary: "#1a73e8",
    secondary: "#ea4335",
    background: "#ffffff",
    text: "#333333",
    accent: "#34a853",
    muted: "#f8f9fa",
  },
  fonts: {
    heading: "Arial",
    body: "Arial",
    mono: "Courier New",
  },
};
