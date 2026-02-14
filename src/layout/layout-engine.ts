import type { ComputedSlide } from "../types/layout.ts";
import type { SlideMaster } from "../types/master.ts";
import type { ValidationResult } from "../types/validation.ts";
import { OverflowDetector } from "./overflow-detector.ts";
import { TextMeasurer } from "./text-measurer.ts";

// レイアウト計算の統合エンジン

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

    for (const element of slide.elements) {
      // フォントパスの解決
      const fontPath = this.resolveFontPath(
        element.resolvedStyle.fontFace,
        element.resolvedStyle.bold,
        master,
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

  /** フォントパスを解決 */
  private resolveFontPath(
    fontFace: string,
    bold: boolean,
    master: SlideMaster,
  ): string | undefined {
    const fontPaths = master.theme.fontPaths;
    if (!fontPaths) return undefined;

    // heading/body フォントの判定
    const isHeading = fontFace === master.theme.fonts.heading;
    const isMono = fontFace === master.theme.fonts.mono;

    if (isMono && fontPaths.mono) return fontPaths.mono;
    if (isHeading) {
      return bold && fontPaths.headingBold ? fontPaths.headingBold : fontPaths.heading;
    }
    return bold && fontPaths.bodyBold ? fontPaths.bodyBold : fontPaths.body;
  }

  /** キャッシュクリア */
  clearCache(): void {
    this.measurer.clearCache();
  }
}
