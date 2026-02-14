// バリデーション結果の型定義

/** バリデーション重大度 */
export type ValidationSeverity = "error" | "warning" | "info";

/** バリデーション種別 */
export type ValidationType =
  | "overflow"
  | "missing-placeholder"
  | "unknown-layout"
  | "unknown-placeholder"
  | "font-not-found"
  | "image-not-found";

/** オーバーフロー詳細 */
export interface OverflowDetail {
  /** コンテンツの高さ (インチ) */
  contentHeight: number;
  /** 利用可能な高さ (インチ) */
  availableHeight: number;
  /** コンテンツの幅 (インチ) */
  contentWidth?: number;
  /** 利用可能な幅 (インチ) */
  availableWidth?: number;
  /** 提案されるフォントサイズ (pt) */
  suggestedFontSize?: number;
  /** 現在のフォントサイズ (pt) */
  currentFontSize?: number;
}

/** バリデーション結果 */
export interface ValidationResult {
  /** スライドインデックス (0-based) */
  slideIndex: number;
  /** プレースホルダー名 */
  placeholder: string;
  /** 重大度 */
  severity: ValidationSeverity;
  /** 種別 */
  type: ValidationType;
  /** メッセージ */
  message: string;
  /** AI 向け修正提案 */
  suggestion?: string;
  /** オーバーフロー詳細 */
  overflowDetail?: OverflowDetail;
}

/** ビルド結果 */
export interface BuildResult {
  /** バリデーションが全て通過したか */
  isValid: boolean;
  /** バリデーション結果一覧 */
  validations: ValidationResult[];
  /** PPTX バイナリ (バリデーション通過時) */
  pptxBuffer?: ArrayBuffer;
  /** PPTX ファイルとして保存 */
  toPptxFile: (path: string) => Promise<void>;
}
