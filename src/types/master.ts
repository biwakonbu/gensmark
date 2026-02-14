import type { Theme } from "./theme.ts";

// スライドマスター・レイアウト定義

/** アスペクト比 */
export type AspectRatio = "16:9" | "4:3";

/** プレースホルダーの種別 */
export type PlaceholderType = "title" | "subtitle" | "body" | "image" | "custom";

/** オーバーフロー時の動作 */
export type OverflowStrategy = "error" | "shrink" | "warn" | "truncate";

/** テキストの水平配置 */
export type TextAlign = "left" | "center" | "right";

/** テキストの垂直配置 */
export type VerticalAlign = "top" | "middle" | "bottom";

/** プレースホルダーの制約条件 */
export interface PlaceholderConstraints {
  /** 最大フォントサイズ (pt) */
  maxFontSize?: number;
  /** 最小フォントサイズ (pt) */
  minFontSize?: number;
  /** 最大行数 */
  maxLines?: number;
  /** オーバーフロー時の動作 */
  overflow?: OverflowStrategy;
}

/** プレースホルダーのスタイル */
export interface PlaceholderStyle {
  /** フォントサイズ (pt) */
  fontSize?: number;
  /** フォントファミリー */
  fontFace?: string;
  /** テキスト色 */
  color?: string;
  /** 太字 */
  bold?: boolean;
  /** イタリック */
  italic?: boolean;
  /** 水平配置 */
  align?: TextAlign;
  /** 垂直配置 */
  valign?: VerticalAlign;
  /** 行間 (倍率、例: 1.5) */
  lineSpacing?: number;
  /** 等幅フォント (コードブロック用) */
  monoFont?: string;
  /** コードブロック背景色 */
  codeBgColor?: string;
  /** パディング (インチ) */
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

/** プレースホルダー定義 */
export interface PlaceholderDef {
  /** プレースホルダー名 (データマッピングのキー) */
  name: string;
  /** 種別 */
  type: PlaceholderType;
  /** X 座標 (インチ) */
  x: number;
  /** Y 座標 (インチ) */
  y: number;
  /** 幅 (インチ) */
  width: number;
  /** 高さ (インチ) */
  height: number;
  /** スタイル */
  style?: PlaceholderStyle;
  /** 制約条件 */
  constraints?: PlaceholderConstraints;
}

/** 背景定義 */
export type BackgroundDef =
  | { type: "solid"; color: string }
  | { type: "image"; path: string }
  | {
      type: "gradient";
      colors: string[];
      direction?: "horizontal" | "vertical" | "diagonal";
    };

/** 固定要素 (ロゴ、装飾線等) */
export interface FixedElement {
  type: "image" | "line" | "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  /** 画像パス (type: 'image' の場合) */
  path?: string;
  /** 色 (type: 'line' | 'rect' の場合) */
  color?: string;
  /** 線の太さ (pt) */
  lineWidth?: number;
}

/** スライドレイアウト定義 */
export interface SlideLayout {
  /** プレースホルダー一覧 */
  placeholders: PlaceholderDef[];
  /** 背景 */
  background?: BackgroundDef;
  /** 固定要素 */
  fixedElements?: FixedElement[];
}

/** スライドマスター定義 */
export interface SlideMaster {
  /** マスター名 */
  name: string;
  /** テーマ */
  theme: Theme;
  /** レイアウト群 */
  layouts: Record<string, SlideLayout>;
  /** アスペクト比 (デフォルト: 16:9) */
  aspectRatio?: AspectRatio;
}

/** マスター定義オプション */
export interface MasterOptions {
  name: string;
  theme: Theme;
  layouts: Record<string, SlideLayout>;
  aspectRatio?: AspectRatio;
}

/** プレースホルダーヘルパーのオーバーライドオプション */
export interface PlaceholderOverrides {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  style?: PlaceholderStyle;
  constraints?: PlaceholderConstraints;
}
