// 全型定義の集約エクスポート

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
} from "./content.ts";
export type {
  ComputedElement,
  ComputedSlide,
} from "./layout.ts";
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
} from "./master.ts";
export type {
  QualityFinding,
  QualityProfile,
  QualityReport,
  QualitySeverity,
  ReadabilityThresholds,
} from "./quality.ts";
export type { DeckSpec } from "./spec.ts";
export type {
  ImportedTemplate,
  PlaceholderHint,
  TemplateImportOptions,
  TemplateImportWarning,
  TemplateLayoutMapEntry,
} from "./template.ts";
export type {
  ColorPalette,
  FontPaths,
  FontSet,
  Theme,
  ThemeOptions,
} from "./theme.ts";
export type {
  BuildResult,
  OverflowDetail,
  ValidationResult,
  ValidationSeverity,
  ValidationType,
} from "./validation.ts";
