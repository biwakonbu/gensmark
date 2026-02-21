// gensmark パブリック API

import { type AutofixOptions, type AutofixResult, autofixDeck } from "./compiler/autofix.ts";
import { type CompileOptions, type CompileResult, compileDeck } from "./compiler/compile.ts";
import type { DeckBuilderOptions } from "./core/deck-builder.ts";
import { DeckBuilder } from "./core/deck-builder.ts";
import { importPptxTemplate } from "./import/pptx-template-importer.ts";
import { createStandardMaster } from "./master/presets/standard.ts";
import { darkTheme } from "./master/presets/themes/dark.ts";
import { defaultTheme } from "./master/presets/themes/default.ts";
import type { MasterOptions, SlideMaster } from "./types/master.ts";
import type { DeckSpec } from "./types/spec.ts";
import type { ImportedTemplate, TemplateImportOptions } from "./types/template.ts";
import type { Theme, ThemeOptions } from "./types/theme.ts";
import type { PreviewOptions } from "./preview/preview-server.ts";

// トップレベル API
export const gensmark = {
  /** テーマを定義 */
  defineTheme(options: ThemeOptions): Theme {
    return { ...options };
  },

  /** スライドマスターを定義 */
  defineMaster(options: MasterOptions): SlideMaster {
    return {
      name: options.name,
      theme: options.theme,
      layouts: options.layouts,
      aspectRatio: options.aspectRatio ?? "16:9",
    };
  },

  /** デッキ (プレゼンテーション) を作成 */
  create(options: DeckBuilderOptions): DeckBuilder {
    return new DeckBuilder(options);
  },

  /** DeckSpec をコンパイル (品質評価 + PPTX 出力) */
  compile(spec: DeckSpec, options?: CompileOptions): Promise<CompileResult> {
    return compileDeck(spec, options);
  },

  /** DeckSpec を自律的に修正して strict を通すことを狙う */
  autofix(spec: DeckSpec, options?: AutofixOptions): Promise<AutofixResult> {
    return autofixDeck(spec, options);
  },

  /** テンプレート .pptx を取り込む */
  importTemplate(options: TemplateImportOptions): Promise<ImportedTemplate> {
    return importPptxTemplate(options);
  },

  /** ライブプレビューサーバーを起動 */
  async preview(spec: DeckSpec, options?: PreviewOptions): Promise<void> {
    const { startPreview } = await import("./preview/preview-server.ts");
    return startPreview(spec, options);
  },

  /** ビルトインプリセット */
  presets: {
    /** standard マスターを作成 */
    standardMaster: createStandardMaster,
    /** テーマ */
    themes: {
      default: defaultTheme,
      dark: darkTheme,
    },
  },
} as const;

export type { ApplyFixActionsResult, FixAction } from "./agent/fix-actions.ts";
export { applyFixActions } from "./agent/fix-actions.ts";
export type { OpenAILlmOptions } from "./agent/openai-fix-actions.ts";
export { suggestFixActionsOpenAI } from "./agent/openai-fix-actions.ts";
export type { AutofixAttempt, AutofixOptions, AutofixResult } from "./compiler/autofix.ts";
export { autofixDeck } from "./compiler/autofix.ts";
export type { CompileOptions, CompileResult } from "./compiler/compile.ts";
export { compileDeck } from "./compiler/compile.ts";
// 内部クラスの直接エクスポート (高度な使用向け)
export { DeckBuilder } from "./core/deck-builder.ts";
export { OverflowDetector } from "./layout/overflow-detector.ts";
export { TextMeasurer } from "./layout/text-measurer.ts";
// プレースホルダーヘルパーのエクスポート
export { ph } from "./master/master-builder.ts";
export { PptxRenderer } from "./renderer/pptx/pptx-renderer.ts";
// v2: HTML レンダラー、PDF エクスポーター、ブラウザ Layout Engine
export { HtmlRenderer } from "./renderer/html/html-renderer.ts";
export { PdfExporter } from "./renderer/pdf/pdf-exporter.ts";
export { BrowserLayoutEngine } from "./layout/browser-layout-engine.ts";
export { BrowserPool, getSharedBrowserPool, disposeSharedBrowserPool } from "./layout/browser-pool.ts";
export type {
  BulletItem,
  BulletList,
  CodeContent,
  ImageContent,
  MermaidContent,
  PlaceholderValue,
  SlideContent,
  TableCell,
  TableContent,
  TextContent,
  TextRun,
  TextStyle,
} from "./types/content.ts";
export type {
  ComputedElement,
  ComputedSlide,
} from "./types/layout.ts";
export type {
  AspectRatio,
  BackgroundDef,
  FixedElement,
  MasterOptions,
  OverflowStrategy,
  PlaceholderConstraints,
  PlaceholderDef,
  PlaceholderOverrides,
  PlaceholderStyle,
  PlaceholderType,
  SlideLayout,
  SlideMaster,
  TextAlign,
  VerticalAlign,
} from "./types/master.ts";
export type {
  QualityFinding,
  QualityProfile,
  QualityReport,
  QualitySeverity,
  ReadabilityThresholds,
} from "./types/quality.ts";
export type { DeckSpec } from "./types/spec.ts";
export type {
  ImportedTemplate,
  PlaceholderHint,
  TemplateImportOptions,
  TemplateImportWarning,
  TemplateLayoutMapEntry,
} from "./types/template.ts";
// 型のエクスポート
export type {
  ColorPalette,
  FontPaths,
  FontSet,
  Theme,
  ThemeOptions,
} from "./types/theme.ts";
export type {
  BuildResult,
  OverflowDetail,
  ValidationResult,
  ValidationSeverity,
  ValidationType,
} from "./types/validation.ts";
