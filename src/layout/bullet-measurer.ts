import type opentype from "opentype.js";
import type { BulletItem, BulletList } from "../types/content.ts";
import type { MeasureResult, TextMeasurer } from "./text-measurer.ts";

// 箇条書きの計測

/** 箇条書きの計測結果 */
export interface BulletMeasureResult {
  /** 全体の高さ (インチ) */
  height: number;
  /** 全体の幅 (インチ) */
  width: number;
  /** アイテム数 (ネスト展開後) */
  totalItems: number;
}

/** 箇条書きの計測設定 */
export interface BulletMeasureOptions {
  /** インデント幅 (インチ、レベルごと) */
  indentWidth?: number;
  /** バレット文字分の幅 (インチ) */
  bulletWidth?: number;
  /** アイテム間のスペース (行間倍率に含まれる) */
  itemSpacing?: number;
  /** 段落間スペース係数 (行高に対する倍率) */
  paragraphSpacingRatio?: number;
}

// pptxgenjs のデフォルト BULLET_MARGIN は 27pt。
// OOXML 上は marL=27pt, indent=-27pt となり、テキスト開始位置は「(level+1)*27pt」相当になる。
const DEF_BULLET_MARGIN_PT = 27;
const DEF_BULLET_MARGIN_IN = DEF_BULLET_MARGIN_PT / 72;
const DEFAULT_INDENT = DEF_BULLET_MARGIN_IN; // インチ
const DEFAULT_BULLET_WIDTH = DEF_BULLET_MARGIN_IN; // インチ (bullet + gap をまとめて扱う)
const DEFAULT_ITEM_SPACING = 0; // 追加スペースなし (行間で調整)
// 実レンダラ依存の段落間余白を安全側に見積もるための係数。
// pptxgenjs のデフォルトは追加しない (0) が、Keynote 等で余白が増える場合に備えて拡張可能にする。
const DEFAULT_PARAGRAPH_SPACING_RATIO = 0;

/** 箇条書きコンテンツを計測する */
export function measureBulletList(
  bullet: BulletList,
  measurer: TextMeasurer,
  font: opentype.Font,
  fontSize: number,
  maxWidth: number,
  lineSpacing: number,
  options?: BulletMeasureOptions,
): BulletMeasureResult {
  const indent = options?.indentWidth ?? DEFAULT_INDENT;
  const bulletW = options?.bulletWidth ?? DEFAULT_BULLET_WIDTH;
  const itemSpacing = options?.itemSpacing ?? DEFAULT_ITEM_SPACING;
  const paragraphSpacingRatio = options?.paragraphSpacingRatio ?? DEFAULT_PARAGRAPH_SPACING_RATIO;

  let totalHeight = 0;
  let maxItemWidth = 0;
  let totalItems = 0;

  function processItems(items: BulletItem[], level: number): void {
    for (const item of items) {
      totalItems++;
      const itemIndent = level * indent + bulletW;
      const availableWidth = maxWidth - itemIndent;

      if (availableWidth <= 0) {
        // インデントが幅を超える場合は最小幅で計測
        totalHeight += fontSize * lineSpacing * (1 / 72);
        continue;
      }

      const result: MeasureResult = measurer.measure(
        item.text,
        font,
        item.style?.fontSize ?? fontSize,
        availableWidth,
        lineSpacing,
      );

      // 段落間スペース (レンダラ差分の吸収用、既定は 0)
      const effectiveFontSize = item.style?.fontSize ?? fontSize;
      const paragraphSpacing = ((effectiveFontSize * lineSpacing) / 72) * paragraphSpacingRatio;
      totalHeight += result.height + itemSpacing + paragraphSpacing;
      const itemWidth = result.width + itemIndent;
      if (itemWidth > maxItemWidth) maxItemWidth = itemWidth;

      // ネストされたアイテム
      if (item.children && item.children.length > 0) {
        processItems(item.children, level + 1);
      }
    }
  }

  processItems(bullet.items, 0);

  return {
    height: totalHeight,
    width: maxItemWidth,
    totalItems,
  };
}
