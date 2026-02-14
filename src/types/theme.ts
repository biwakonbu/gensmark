// テーマ定義

/** カラーパレット */
export interface ColorPalette {
  /** メインカラー */
  primary: string;
  /** セカンダリカラー */
  secondary: string;
  /** 背景色 */
  background: string;
  /** テキスト色 */
  text: string;
  /** アクセントカラー */
  accent?: string;
  /** ミュートカラー (薄い背景等) */
  muted?: string;
}

/** フォント設定 */
export interface FontSet {
  /** 見出し用フォント */
  heading: string;
  /** 本文用フォント */
  body: string;
  /** 等幅フォント */
  mono?: string;
}

/** フォントファイルパスのマッピング (opentype.js 用) */
export interface FontPaths {
  heading?: string;
  headingBold?: string;
  body?: string;
  bodyBold?: string;
  mono?: string;
  [key: string]: string | undefined;
}

/** テーマ定義 */
export interface Theme {
  /** テーマ名 */
  name: string;
  /** カラーパレット */
  colors: ColorPalette;
  /** フォント設定 */
  fonts: FontSet;
  /** フォントファイルパス (テキスト計測用) */
  fontPaths?: FontPaths;
}

/** テーマ定義オプション */
export interface ThemeOptions {
  name: string;
  colors: ColorPalette;
  fonts: FontSet;
  fontPaths?: FontPaths;
}
