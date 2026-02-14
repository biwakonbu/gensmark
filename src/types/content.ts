// スライドコンテンツ定義

/** テキストスタイル (インライン装飾) */
export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fontSize?: number;
}

/** テキストラン (装飾付きテキストの断片) */
export interface TextRun {
  text: string;
  style?: TextStyle;
}

/** テキストコンテンツ */
export interface TextContent {
  type: "text";
  /** プレーンテキストまたは TextRun 配列 */
  value: string | TextRun[];
}

/** 箇条書きのアイテム */
export interface BulletItem {
  text: string;
  style?: TextStyle;
  /** ネストレベル (0 = トップレベル) */
  level?: number;
  /** サブアイテム */
  children?: BulletItem[];
}

/** 箇条書きリスト */
export interface BulletList {
  type: "bullet";
  items: BulletItem[];
  /** 番号付きリストにする */
  ordered?: boolean;
}

/** 画像コンテンツ */
export interface ImageContent {
  type: "image";
  /** ファイルパスまたは URL */
  path: string;
  /** 代替テキスト */
  alt?: string;
  /** オブジェクトフィット */
  sizing?: "contain" | "cover" | "fill";
}

/** テーブルのセル */
export interface TableCell {
  text: string;
  style?: TextStyle;
  /** セルの背景色 */
  fill?: string;
  /** コルスパン */
  colSpan?: number;
  /** ロウスパン */
  rowSpan?: number;
}

/** テーブルコンテンツ */
export interface TableContent {
  type: "table";
  /** ヘッダー行 */
  headers?: string[];
  /** データ行 */
  rows: (string | TableCell)[][];
  /** テーブルスタイル */
  style?: {
    headerFill?: string;
    headerColor?: string;
    borderColor?: string;
    altRowFill?: string;
  };
}

/** コードコンテンツ */
export interface CodeContent {
  type: "code";
  /** ソースコード */
  code: string;
  /** 言語 (表示用) */
  language?: string;
}

/** プレースホルダーに渡す値の型 */
export type PlaceholderValue =
  | string
  | TextContent
  | BulletList
  | ImageContent
  | TableContent
  | CodeContent;

/** スライドコンテンツ定義 */
export interface SlideContent {
  /** 使用するレイアウト名 */
  layout: string;
  /** プレースホルダー名 → 値のマッピング */
  data: Record<string, PlaceholderValue>;
  /** スライド固有の背景 (レイアウトの背景を上書き) */
  background?: import("./master.ts").BackgroundDef;
  /** スライドメモ */
  notes?: string;
}
