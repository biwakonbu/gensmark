import type { PlaceholderValue } from "./content.ts";
import type { BackgroundDef, FixedElement, PlaceholderDef, PlaceholderStyle } from "./master.ts";

// レイアウト計算結果の型定義

/** 計算済み要素 (レイアウト解決後の要素) */
export interface ComputedElement {
  /** プレースホルダー定義 */
  placeholder: PlaceholderDef;
  /** 渡された値 */
  value: PlaceholderValue;
  /** 解決済みスタイル (テーマ + レイアウト + オーバーライドをマージ) */
  resolvedStyle: Required<
    Pick<PlaceholderStyle, "fontSize" | "fontFace" | "color" | "bold" | "align" | "valign">
  > &
    PlaceholderStyle;
  /** shrink 適用後の実際のフォントサイズ */
  computedFontSize: number;
}

/** 計算済みスライド */
export interface ComputedSlide {
  /** スライドインデックス (0-based) */
  index: number;
  /** レイアウト名 */
  layoutName: string;
  /** 計算済み要素一覧 */
  elements: ComputedElement[];
  /** 背景 */
  background?: BackgroundDef;
  /** 固定要素 */
  fixedElements?: FixedElement[];
  /** スライドメモ */
  notes?: string;
}
