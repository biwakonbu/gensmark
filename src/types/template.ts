import type { PlaceholderType, SlideMaster } from "./master.ts";

/** テンプレート import オプション */
export interface TemplateImportOptions {
  /** 入力 .pptx ファイルパス */
  path: string;
  /** レイアウト名の別名付与方式 */
  aliasStrategy?: "keep-original-with-alias";
}

/** テンプレート import 時の警告 */
export interface TemplateImportWarning {
  code:
    | "layout-alias-collision"
    | "layout-without-placeholder"
    | "placeholder-name-missing"
    | "unsupported-layout-feature"
    | "theme-fallback";
  message: string;
  layout?: string;
  placeholder?: string;
}

/** プレースホルダー割当ヒント */
export interface PlaceholderHint {
  name: string;
  type: PlaceholderType;
  order: number;
}

/** レイアウトマップ情報 */
export interface TemplateLayoutMapEntry {
  canonical: string;
  aliases: string[];
  layoutPart: string;
}

/** 取り込み済みテンプレート */
export interface ImportedTemplate {
  kind: "pptx-template";
  sourcePath: string;
  master: SlideMaster;
  rawBytes: Uint8Array;
  layoutMap: Record<string, TemplateLayoutMapEntry>;
  placeholderHints: Record<string, PlaceholderHint[]>;
  warnings: TemplateImportWarning[];
}
