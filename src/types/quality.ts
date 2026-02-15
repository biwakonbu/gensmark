import type { ValidationResult } from "./validation.ts";

/** 品質プロファイル */
export type QualityProfile = "draft" | "standard" | "strict";

export type QualitySeverity = "error" | "warning" | "info";

export interface QualityFinding {
  severity: QualitySeverity;
  code: string;
  message: string;
  slideIndex?: number;
  placeholder?: string;
  details?: Record<string, unknown>;
}

export interface ReadabilityThresholds {
  /** タイトル最小フォントサイズ (pt) */
  titleMinPt: number;
  /** 本文最小フォントサイズ (pt) */
  bodyMinPt: number;
  /** コード最小フォントサイズ (pt) */
  codeMinPt: number;
  /** テーブル最小フォントサイズ (pt) */
  tableMinPt: number;
}

export interface QualityReport {
  profile: QualityProfile;
  /** 品質ゲートを通過したか (strict を通す前提の自律ループ用) */
  isPassing: boolean;
  /** 収集した追加所見 (ValidationResult とは別レイヤ) */
  findings: QualityFinding[];
  /** 参照用: build で得られた validations */
  validations: ValidationResult[];
  /** 失敗理由 (要点) */
  failingReasons: string[];
}
