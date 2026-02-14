// gensmark パブリック API

import type { DeckBuilderOptions } from "./core/deck-builder.ts";
import { DeckBuilder } from "./core/deck-builder.ts";
import { createStandardMaster } from "./master/presets/standard.ts";
import { darkTheme } from "./master/presets/themes/dark.ts";
import { defaultTheme } from "./master/presets/themes/default.ts";
import type { MasterOptions, SlideMaster } from "./types/master.ts";
import type { Theme, ThemeOptions } from "./types/theme.ts";

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

// 内部クラスの直接エクスポート (高度な使用向け)
export { DeckBuilder } from "./core/deck-builder.ts";
export { OverflowDetector } from "./layout/overflow-detector.ts";
export { TextMeasurer } from "./layout/text-measurer.ts";
// プレースホルダーヘルパーのエクスポート
export { ph } from "./master/master-builder.ts";
export { PptxRenderer } from "./renderer/pptx/pptx-renderer.ts";
export type {
  BulletItem,
  BulletList,
  CodeContent,
  ImageContent,
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
