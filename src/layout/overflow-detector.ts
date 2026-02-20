import type opentype from "opentype.js";
import type { BulletList, PlaceholderValue, TableContent } from "../types/content.ts";
import type { PlaceholderDef } from "../types/master.ts";
import type { OverflowDetail, ValidationResult } from "../types/validation.ts";
import { measureBulletList } from "./bullet-measurer.ts";
import type { TextMeasurer } from "./text-measurer.ts";

// オーバーフロー検知

/** パディング未指定時のデフォルト値 (インチ) */
const DEFAULT_PADDING = 0.05;

/** テーブルセル内のフォントサイズオフセット (pptx-element-mapper.ts と同期) */
const TABLE_FONT_SIZE_OFFSET = 2;

/** オーバーフロー検知結果 */
export interface DetectionResult {
  /** バリデーション結果 (問題がない場合は空) */
  validations: ValidationResult[];
  /** shrink 適用後のフォントサイズ */
  computedFontSize: number;
}

/** プレースホルダーの実効サイズを計算 (padding を考慮) */
function getEffectiveSize(placeholder: PlaceholderDef): {
  width: number;
  height: number;
} {
  const padding = placeholder.style?.padding;
  const padLeft = padding?.left ?? DEFAULT_PADDING;
  const padRight = padding?.right ?? DEFAULT_PADDING;
  const padTop = padding?.top ?? DEFAULT_PADDING;
  const padBottom = padding?.bottom ?? DEFAULT_PADDING;

  return {
    width: placeholder.width - padLeft - padRight,
    height: placeholder.height - padTop - padBottom,
  };
}

/** プレースホルダーの値からプレーンテキストを抽出 */
function extractPlainText(value: PlaceholderValue): string {
  if (typeof value === "string") return value;

  switch (value.type) {
    case "text":
      if (typeof value.value === "string") return value.value;
      return value.value.map((r) => r.text).join("");
    case "code":
      return value.code;
    default:
      return "";
  }
}

/** オーバーフロー検知器 */
export class OverflowDetector {
  constructor(private measurer: TextMeasurer) {}

  /** プレースホルダーのオーバーフローを検知 */
  detect(
    placeholder: PlaceholderDef,
    value: PlaceholderValue,
    font: opentype.Font,
    slideIndex: number,
    fontSize: number,
    lineSpacing: number,
  ): DetectionResult {
    // image はテキスト計測不要 (存在チェックは slide-resolver で実施)
    if (typeof value !== "string" && value.type === "image") {
      return { validations: [], computedFontSize: fontSize };
    }

    const constraints = placeholder.constraints;

    // テーブルは専用の検知ロジック
    if (typeof value !== "string" && value.type === "table") {
      return this.detectTableOverflow(
        placeholder,
        value,
        fontSize,
        lineSpacing,
        getEffectiveSize(placeholder),
        constraints?.overflow ?? "shrink",
        constraints?.minFontSize ?? 10,
        slideIndex,
      );
    }
    const overflow = constraints?.overflow ?? "shrink";
    const maxFontSize = constraints?.maxFontSize ?? fontSize;
    const minFontSize = constraints?.minFontSize ?? 10;
    const effectiveSize = getEffectiveSize(placeholder);

    // 箇条書きの場合
    if (typeof value !== "string" && value.type === "bullet") {
      return this.detectBulletOverflow(
        placeholder,
        value,
        font,
        fontSize,
        lineSpacing,
        effectiveSize,
        overflow,
        minFontSize,
        maxFontSize,
        slideIndex,
      );
    }

    // テキスト系 (string, TextContent, CodeContent)
    const text = extractPlainText(value);
    if (text.length === 0) {
      return { validations: [], computedFontSize: fontSize };
    }

    return this.detectTextOverflow(
      placeholder,
      text,
      font,
      fontSize,
      lineSpacing,
      effectiveSize,
      overflow,
      minFontSize,
      maxFontSize,
      slideIndex,
      constraints?.maxLines,
    );
  }

  /** テキストのオーバーフロー検知 */
  private detectTextOverflow(
    placeholder: PlaceholderDef,
    text: string,
    font: opentype.Font,
    fontSize: number,
    lineSpacing: number,
    effectiveSize: { width: number; height: number },
    overflow: string,
    minFontSize: number,
    maxFontSize: number,
    slideIndex: number,
    maxLines?: number,
  ): DetectionResult {
    const validations: ValidationResult[] = [];

    // 現在のフォントサイズで計測
    const result = this.measurer.measure(text, font, fontSize, effectiveSize.width, lineSpacing);

    // 行数制約チェック
    if (maxLines && result.lineCount > maxLines) {
      const detail: OverflowDetail = {
        contentHeight: result.height,
        availableHeight: effectiveSize.height,
      };

      if (overflow === "error") {
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "error",
          type: "overflow",
          message: `Text exceeds max lines: ${result.lineCount} > ${maxLines}`,
          suggestion: `Reduce text length to fit within ${maxLines} lines`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: fontSize };
      }

      if (overflow === "warn") {
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "warning",
          type: "overflow",
          message: `Text exceeds max lines: ${result.lineCount} > ${maxLines}`,
          suggestion: `Reduce text length to fit within ${maxLines} lines`,
          overflowDetail: detail,
        });
      }
    }

    // 高さオーバーフローチェック
    if (result.height <= effectiveSize.height) {
      return { validations, computedFontSize: fontSize };
    }

    // オーバーフロー発生
    const detail: OverflowDetail = {
      contentHeight: result.height,
      availableHeight: effectiveSize.height,
      currentFontSize: fontSize,
    };

    switch (overflow) {
      case "shrink": {
        // フォントサイズを縮小して収める
        const fitting = this.measurer.findFittingFontSize(
          text,
          font,
          effectiveSize.width,
          effectiveSize.height,
          minFontSize,
          maxFontSize,
          lineSpacing,
        );

        if (fitting) {
          // 縮小して収まった (警告を追加)
          validations.push({
            slideIndex,
            placeholder: placeholder.name,
            severity: "warning",
            type: "overflow",
            message: `Text shrunk from ${fontSize}pt to ${fitting.fontSize.toFixed(1)}pt to fit`,
            overflowDetail: detail,
          });
          return { validations, computedFontSize: fitting.fontSize };
        }

        // 最小サイズでも収まらない
        const minResult = this.measurer.measure(
          text,
          font,
          minFontSize,
          effectiveSize.width,
          lineSpacing,
        );
        detail.suggestedFontSize = minFontSize;
        detail.contentHeight = minResult.height;
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "error",
          type: "overflow",
          message: `Text overflows even at minimum font size ${minFontSize}pt`,
          suggestion: `Reduce text length. Content height: ${minResult.height.toFixed(2)}in, available: ${effectiveSize.height.toFixed(2)}in`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: minFontSize };
      }

      case "error": {
        // 収まるフォントサイズを提案
        const fitting = this.measurer.findFittingFontSize(
          text,
          font,
          effectiveSize.width,
          effectiveSize.height,
          minFontSize,
          maxFontSize,
          lineSpacing,
        );
        detail.suggestedFontSize = fitting?.fontSize;
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "error",
          type: "overflow",
          message: `Text overflows placeholder area`,
          suggestion: fitting
            ? `Reduce font size from ${fontSize}pt to ${fitting.fontSize.toFixed(1)}pt`
            : `Reduce text length. Content does not fit even at ${minFontSize}pt`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: fontSize };
      }

      case "truncate": {
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "warning",
          type: "overflow",
          message: `Text will be truncated to fit`,
          suggestion: `Reduce text length for complete display`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: fontSize };
      }
      default: {
        const fitting = this.measurer.findFittingFontSize(
          text,
          font,
          effectiveSize.width,
          effectiveSize.height,
          minFontSize,
          maxFontSize,
          lineSpacing,
        );
        detail.suggestedFontSize = fitting?.fontSize;
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "warning",
          type: "overflow",
          message: `Text overflows placeholder area`,
          suggestion: fitting
            ? `Consider reducing font size from ${fontSize}pt to ${fitting.fontSize.toFixed(1)}pt`
            : `Consider reducing text length`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: fontSize };
      }
    }
  }

  /** 箇条書きのオーバーフロー検知 */
  private detectBulletOverflow(
    placeholder: PlaceholderDef,
    bullet: BulletList,
    font: opentype.Font,
    fontSize: number,
    lineSpacing: number,
    effectiveSize: { width: number; height: number },
    overflow: string,
    minFontSize: number,
    _maxFontSize: number,
    slideIndex: number,
  ): DetectionResult {
    const validations: ValidationResult[] = [];
    // Keynote 等でのレンダリング余白を考慮した段落間スペース係数
    const bulletOpts = { paragraphSpacingRatio: 1.0 };

    const result = measureBulletList(
      bullet,
      this.measurer,
      font,
      fontSize,
      effectiveSize.width,
      lineSpacing,
      bulletOpts,
    );

    if (result.height <= effectiveSize.height) {
      return { validations, computedFontSize: fontSize };
    }

    const detail: OverflowDetail = {
      contentHeight: result.height,
      availableHeight: effectiveSize.height,
      currentFontSize: fontSize,
    };

    switch (overflow) {
      case "shrink": {
        // 箇条書きの場合、二分探索で収まるフォントサイズを見つける
        const minResult = measureBulletList(
          bullet,
          this.measurer,
          font,
          minFontSize,
          effectiveSize.width,
          lineSpacing,
          bulletOpts,
        );
        if (minResult.height <= effectiveSize.height) {
          // 最小サイズで収まる → 二分探索で最大サイズを見つける
          let low = minFontSize;
          let high = fontSize;
          let bestSize = minFontSize;
          while (high - low > 0.5) {
            const mid = (low + high) / 2;
            const midResult = measureBulletList(
              bullet,
              this.measurer,
              font,
              mid,
              effectiveSize.width,
              lineSpacing,
              bulletOpts,
            );
            if (midResult.height <= effectiveSize.height) {
              bestSize = mid;
              low = mid;
            } else {
              high = mid;
            }
          }
          // 縮小して収まった (警告を追加)
          if (bestSize < fontSize) {
            validations.push({
              slideIndex,
              placeholder: placeholder.name,
              severity: "warning",
              type: "overflow",
              message: `Bullet list shrunk from ${fontSize}pt to ${bestSize.toFixed(1)}pt to fit`,
              overflowDetail: detail,
            });
          }
          return { validations, computedFontSize: bestSize };
        }
        // 最小でも収まらない
        detail.suggestedFontSize = minFontSize;
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "error",
          type: "overflow",
          message: `Bullet list overflows even at minimum font size ${minFontSize}pt`,
          suggestion: `Reduce number of bullet items (currently ${result.totalItems})`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: minFontSize };
      }

      case "error": {
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "error",
          type: "overflow",
          message: `Bullet list overflows placeholder area`,
          suggestion: `Reduce number of items or text length (${result.totalItems} items)`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: fontSize };
      }

      case "truncate": {
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "warning",
          type: "overflow",
          message: `Bullet list will be truncated to fit`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: fontSize };
      }
      default: {
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "warning",
          type: "overflow",
          message: `Bullet list overflows placeholder area`,
          suggestion: `Reduce number of items or text length (${result.totalItems} items)`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: fontSize };
      }
    }
  }

  /** テーブルのオーバーフロー検知 */
  private detectTableOverflow(
    placeholder: PlaceholderDef,
    table: TableContent,
    fontSize: number,
    lineSpacing: number,
    effectiveSize: { width: number; height: number },
    overflow: string,
    minFontSize: number,
    slideIndex: number,
  ): DetectionResult {
    const validations: ValidationResult[] = [];

    // テーブルレンダリング時のフォントサイズは元サイズからオフセット分を引く
    const tableFontSize = fontSize - TABLE_FONT_SIZE_OFFSET;
    const rowCount = (table.headers ? 1 : 0) + table.rows.length;

    /** 指定フォントサイズでのテーブル推定高さを計算 */
    const estimateHeight = (fs: number): number => {
      // pt → インチ変換 (1pt = 1/72 in)
      const PT_TO_INCH = 1 / 72;
      const rowPadding = 0.15; // 上下パディング
      const rowHeight = fs * lineSpacing * PT_TO_INCH + rowPadding;
      return rowCount * rowHeight;
    };

    const contentHeight = estimateHeight(tableFontSize);

    if (contentHeight <= effectiveSize.height) {
      return { validations, computedFontSize: fontSize };
    }

    // オーバーフロー発生
    const detail: OverflowDetail = {
      contentHeight,
      availableHeight: effectiveSize.height,
      currentFontSize: fontSize,
    };

    switch (overflow) {
      case "shrink": {
        // 二分探索で収まる最大フォントサイズを見つける
        // 探索対象は元のフォントサイズ (テーブル用は -2 される)
        let low = minFontSize;
        let high = fontSize;
        let bestSize = minFontSize;

        // 最小でも収まるか確認 (フォントサイズが 1pt 未満にならないようガード)
        if (
          estimateHeight(Math.max(minFontSize - TABLE_FONT_SIZE_OFFSET, 1)) > effectiveSize.height
        ) {
          detail.suggestedFontSize = minFontSize;
          validations.push({
            slideIndex,
            placeholder: placeholder.name,
            severity: "error",
            type: "overflow",
            message: `Table overflows even at minimum font size ${minFontSize}pt`,
            suggestion: `Reduce number of rows (currently ${rowCount})`,
            overflowDetail: detail,
          });
          return { validations, computedFontSize: minFontSize };
        }

        while (high - low > 0.5) {
          const mid = (low + high) / 2;
          if (estimateHeight(Math.max(mid - TABLE_FONT_SIZE_OFFSET, 1)) <= effectiveSize.height) {
            bestSize = mid;
            low = mid;
          } else {
            high = mid;
          }
        }
        // 縮小して収まった (警告を追加)
        if (bestSize < fontSize) {
          validations.push({
            slideIndex,
            placeholder: placeholder.name,
            severity: "warning",
            type: "overflow",
            message: `Table shrunk from ${fontSize}pt to ${bestSize.toFixed(1)}pt to fit`,
            overflowDetail: detail,
          });
        }
        return { validations, computedFontSize: bestSize };
      }

      case "error": {
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "error",
          type: "overflow",
          message: `Table overflows placeholder area`,
          suggestion: `Reduce number of rows (currently ${rowCount})`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: fontSize };
      }

      case "truncate": {
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "warning",
          type: "overflow",
          message: `Table will be truncated to fit`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: fontSize };
      }

      default: {
        validations.push({
          slideIndex,
          placeholder: placeholder.name,
          severity: "warning",
          type: "overflow",
          message: `Table overflows placeholder area`,
          suggestion: `Reduce number of rows (currently ${rowCount})`,
          overflowDetail: detail,
        });
        return { validations, computedFontSize: fontSize };
      }
    }
  }
}
