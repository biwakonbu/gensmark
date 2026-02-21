import type { Theme } from "../../types/theme.ts";

// テーマ -> CSS カスタムプロパティ変換

/** テーマを CSS カスタムプロパティ文字列に変換 */
export function themeToCss(theme: Theme): string {
  const { colors, fonts } = theme;
  return `:root {
  --gm-color-primary: ${colors.primary};
  --gm-color-secondary: ${colors.secondary};
  --gm-color-background: ${colors.background};
  --gm-color-text: ${colors.text};
  --gm-color-accent: ${colors.accent ?? colors.primary};
  --gm-color-muted: ${colors.muted ?? "#F5F5F5"};
  --gm-font-heading: ${fonts.heading}, sans-serif;
  --gm-font-body: ${fonts.body}, sans-serif;
  --gm-font-mono: ${fonts.mono ?? "Courier New"}, monospace;
}`;
}
