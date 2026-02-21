import { existsSync } from "node:fs";
import { DEFAULT_MARGINS } from "../master/master-builder.ts";
import type { ComputedSlide } from "../types/layout.ts";
import type { PlaceholderType, SlideMaster } from "../types/master.ts";
import type { ValidationResult } from "../types/validation.ts";
import { OverflowDetector } from "./overflow-detector.ts";
import { TextMeasurer } from "./text-measurer.ts";

// レイアウト計算の統合エンジン

/** システムフォント候補 (計測用フォールバック) */
const SYSTEM_FONTS_REGULAR = [
  // macOS
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/Library/Fonts/Arial.ttf",
  // Linux
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  // Windows (WSL)
  "/mnt/c/Windows/Fonts/arial.ttf",
];

const SYSTEM_FONTS_BOLD = [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/Library/Fonts/Arial Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/mnt/c/Windows/Fonts/arialbd.ttf",
];

const SYSTEM_MONO_FONTS_REGULAR = [
  // macOS
  "/System/Library/Fonts/Supplemental/Courier New.ttf",
  "/Library/Fonts/Courier New.ttf",
  // Linux
  "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
  // Windows (WSL)
  "/mnt/c/Windows/Fonts/cour.ttf",
];

const SYSTEM_MONO_FONTS_BOLD = [
  "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
  "/Library/Fonts/Courier New Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
  "/mnt/c/Windows/Fonts/courbd.ttf",
];

/** レイアウトエンジン */
export class LayoutEngine {
  private measurer: TextMeasurer;
  private detector: OverflowDetector;

  constructor() {
    this.measurer = new TextMeasurer();
    this.detector = new OverflowDetector(this.measurer);
  }

  /** ComputedSlide のオーバーフロー検知 + フォントサイズ調整 */
  async validateSlide(slide: ComputedSlide, master: SlideMaster): Promise<ValidationResult[]> {
    const validations: ValidationResult[] = [];

    // 余白チェック
    validations.push(...this.checkMarginOverflow(slide, master));

    for (const element of slide.elements) {
      // フォントパスの解決
      const fontPath = this.resolveFontPath(
        element.resolvedStyle.fontFace,
        element.resolvedStyle.bold,
        master,
        element.placeholder.type,
      );

      if (!fontPath) {
        // フォントが見つからない場合はスキップ (テキスト計測不可)
        validations.push({
          slideIndex: slide.index,
          placeholder: element.placeholder.name,
          severity: "info",
          type: "font-not-found",
          message: `Font file not found for "${element.resolvedStyle.fontFace}". Skipping overflow detection.`,
        });
        continue;
      }

      try {
        const font = await this.measurer.loadFont(fontPath);
        const result = this.detector.detect(
          element.placeholder,
          element.value,
          font,
          slide.index,
          element.resolvedStyle.fontSize,
          element.resolvedStyle.lineSpacing ?? 1.2,
        );

        validations.push(...result.validations);
        // shrink で調整されたフォントサイズを反映
        element.computedFontSize = result.computedFontSize;
      } catch {
        validations.push({
          slideIndex: slide.index,
          placeholder: element.placeholder.name,
          severity: "warning",
          type: "font-not-found",
          message: `Failed to load font "${fontPath}". Skipping overflow detection.`,
        });
      }
    }

    return validations;
  }

  /** プレースホルダーがスライド余白を超えていないかチェック */
  private checkMarginOverflow(slide: ComputedSlide, master: SlideMaster): ValidationResult[] {
    const margins = master.margins ?? DEFAULT_MARGINS;
    const slideW = master.aspectRatio === "4:3" ? 10.0 : 13.33;
    const slideH = 7.5;
    const results: ValidationResult[] = [];

    for (const element of slide.elements) {
      const ph = element.placeholder;
      const sides: string[] = [];

      if (ph.x < margins.left) {
        sides.push(`left (${ph.x.toFixed(2)}in < ${margins.left}in)`);
      }
      if (ph.x + ph.width > slideW - margins.right) {
        sides.push(
          `right (${(ph.x + ph.width).toFixed(2)}in > ${(slideW - margins.right).toFixed(2)}in)`,
        );
      }
      if (ph.y < margins.top) {
        sides.push(`top (${ph.y.toFixed(2)}in < ${margins.top}in)`);
      }
      if (ph.y + ph.height > slideH - margins.bottom) {
        sides.push(
          `bottom (${(ph.y + ph.height).toFixed(2)}in > ${(slideH - margins.bottom).toFixed(2)}in)`,
        );
      }

      if (sides.length > 0) {
        results.push({
          slideIndex: slide.index,
          placeholder: ph.name,
          severity: "warning",
          type: "margin-overflow",
          message: `Placeholder "${ph.name}" exceeds slide margins: ${sides.join(", ")}`,
          suggestion: `Adjust placeholder position/size to fit within margins (top: ${margins.top}in, right: ${margins.right}in, bottom: ${margins.bottom}in, left: ${margins.left}in)`,
        });
      }
    }

    return results;
  }

  /** フォントパスを解決 */
  private resolveFontPath(
    fontFace: string,
    bold: boolean,
    master: SlideMaster,
    placeholderType?: PlaceholderType,
  ): string | undefined {
    const fontPaths = master.theme.fontPaths;

    // テーマに fontPaths が指定されている場合はそちらを優先
    if (fontPaths) {
      const monoFace = master.theme.fonts.mono ?? "Courier New";
      const isMono = fontFace === monoFace;
      // heading と body が同じフォント名の場合でも正しく判定するため、
      // フォント名ではなくプレースホルダーの type で判定する
      const isHeading = placeholderType === "title" || placeholderType === "subtitle";

      if (isMono && fontPaths.mono) return fontPaths.mono;
      if (isHeading) {
        const resolved = bold && fontPaths.headingBold ? fontPaths.headingBold : fontPaths.heading;
        if (resolved) return resolved;
      } else {
        const resolved = bold && fontPaths.bodyBold ? fontPaths.bodyBold : fontPaths.body;
        if (resolved) return resolved;
      }
    }

    // fontPaths 未設定時はシステムフォントにフォールバック
    const monoFace = master.theme.fonts.mono ?? "Courier New";
    const isMono = fontFace === monoFace;
    return isMono ? this.findSystemMonoFont(bold) : this.findSystemFont(bold);
  }

  /** システムフォントを検索 (計測用フォールバック) */
  private findSystemFont(bold: boolean): string | undefined {
    if (bold) {
      return SYSTEM_FONTS_BOLD.find((p) => existsSync(p));
    }
    return SYSTEM_FONTS_REGULAR.find((p) => existsSync(p));
  }

  private findSystemMonoFont(bold: boolean): string | undefined {
    if (bold) {
      return SYSTEM_MONO_FONTS_BOLD.find((p) => existsSync(p));
    }
    return SYSTEM_MONO_FONTS_REGULAR.find((p) => existsSync(p));
  }

  /** キャッシュクリア */
  clearCache(): void {
    this.measurer.clearCache();
  }
}
