import type { PlaceholderValue, SlideContent } from "../types/content.ts";
import type { ComputedElement, ComputedSlide } from "../types/layout.ts";
import type { PlaceholderDef, PlaceholderStyle, SlideMaster } from "../types/master.ts";
import type { ValidationResult } from "../types/validation.ts";

// SlideContent + Layout -> ComputedSlide への解決

/** デフォルトスタイル */
const DEFAULT_STYLE = {
  fontSize: 18,
  fontFace: "Arial",
  color: "#333333",
  bold: false,
  align: "left" as const,
  valign: "top" as const,
};

/** プレースホルダーの型ごとのデフォルトスタイル */
const TYPE_DEFAULTS: Record<string, Partial<PlaceholderStyle>> = {
  title: { fontSize: 32, bold: true, align: "left", valign: "middle" },
  subtitle: { fontSize: 20, color: "#666666", align: "left", valign: "middle" },
  body: { fontSize: 18, align: "left", valign: "top" },
  image: {},
  custom: { fontSize: 16 },
};

/** テーマとレイアウトのスタイルをマージ */
function resolveStyle(
  placeholder: PlaceholderDef,
  master: SlideMaster,
): ComputedElement["resolvedStyle"] {
  const typeDefaults = TYPE_DEFAULTS[placeholder.type] ?? {};

  return {
    ...DEFAULT_STYLE,
    fontFace: master.theme.fonts.body,
    color: master.theme.colors.text,
    ...typeDefaults,
    ...(placeholder.type === "title" ? { fontFace: master.theme.fonts.heading } : {}),
    ...placeholder.style,
  };
}

/** 文字列値を PlaceholderValue に正規化 */
function normalizeValue(value: PlaceholderValue): PlaceholderValue {
  if (typeof value === "string") return value;
  return value;
}

/** SlideContent を ComputedSlide に解決 */
export function resolveSlide(
  content: SlideContent,
  master: SlideMaster,
  slideIndex: number,
): { computed: ComputedSlide; validations: ValidationResult[] } {
  const validations: ValidationResult[] = [];

  // レイアウトの存在チェック
  const layout = master.layouts[content.layout];
  if (!layout) {
    validations.push({
      slideIndex,
      placeholder: "",
      severity: "error",
      type: "unknown-layout",
      message: `Unknown layout: "${content.layout}". Available: ${Object.keys(master.layouts).join(", ")}`,
    });
    return {
      computed: {
        index: slideIndex,
        layoutName: content.layout,
        elements: [],
        notes: content.notes,
      },
      validations,
    };
  }

  const elements: ComputedElement[] = [];

  // プレースホルダー名をインデックス化
  const placeholderMap = new Map<string, PlaceholderDef>();
  for (const ph of layout.placeholders) {
    placeholderMap.set(ph.name, ph);
  }

  // data のキーに対応するプレースホルダーを解決
  for (const [name, value] of Object.entries(content.data)) {
    const placeholder = placeholderMap.get(name);

    if (!placeholder) {
      validations.push({
        slideIndex,
        placeholder: name,
        severity: "warning",
        type: "unknown-placeholder",
        message: `Unknown placeholder "${name}" in layout "${content.layout}". Available: ${Array.from(placeholderMap.keys()).join(", ")}`,
      });
      continue;
    }

    const resolvedStyle = resolveStyle(placeholder, master);

    elements.push({
      placeholder,
      value: normalizeValue(value),
      resolvedStyle,
      computedFontSize: resolvedStyle.fontSize,
    });
  }

  // 背景の解決 (スライド固有 > レイアウト)
  const background = content.background ?? layout.background;

  return {
    computed: {
      index: slideIndex,
      layoutName: content.layout,
      elements,
      background,
      fixedElements: layout.fixedElements,
      notes: content.notes,
    },
    validations,
  };
}
