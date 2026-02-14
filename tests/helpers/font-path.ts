import { existsSync } from "node:fs";

// テスト用フォントパスのクロスプラットフォーム解決

/** フォントパス候補 (プラットフォームごと) */
const FONT_CANDIDATES: Record<string, string[]> = {
  regular: [
    // macOS
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    // Linux
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    // Windows (WSL)
    "/mnt/c/Windows/Fonts/arial.ttf",
  ],
  bold: [
    // macOS
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    // Linux
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    // Windows (WSL)
    "/mnt/c/Windows/Fonts/arialbd.ttf",
  ],
};

/** 利用可能なフォントパスを検索して返す */
function findFont(type: "regular" | "bold"): string {
  const candidates = FONT_CANDIDATES[type]!;
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error(
    `No ${type} font found. Searched: ${candidates.join(", ")}. ` +
      "Install a TrueType font or set TEST_FONT_PATH environment variable.",
  );
}

/** テスト用のレギュラーフォントパス */
export const TEST_FONT_PATH = process.env.TEST_FONT_PATH ?? findFont("regular");

/** テスト用のボールドフォントパス */
export const TEST_FONT_BOLD_PATH = process.env.TEST_FONT_BOLD_PATH ?? findFont("bold");
