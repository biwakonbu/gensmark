// PPTX レンダリング共通ユーティリティ

/** 色コードを正規化 (# を除去) */
export function normalizeColor(color: string): string {
  return color.startsWith("#") ? color.slice(1) : color;
}
