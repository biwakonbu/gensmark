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
}

const DEFAULT_INDENT = 0.25; // インチ
const DEFAULT_BULLET_WIDTH = 0.2; // インチ
const DEFAULT_ITEM_SPACING = 0; // 追加スペースなし (行間で調整)

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

      totalHeight += result.height + itemSpacing;
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
