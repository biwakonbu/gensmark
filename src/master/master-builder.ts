import type { PlaceholderDef, PlaceholderOverrides } from "../types/master.ts";

// プレースホルダーヘルパー
// AI がマスター定義する際のボイラープレートを削減

/** 16:9 スライドのデフォルトサイズ (インチ) */
const SLIDE_W = 13.33;
const MARGIN = 0.75;
const CONTENT_W = SLIDE_W - MARGIN * 2; // 11.83
const DEFAULT_PADDING = 0.05; // inch (OverflowDetector と揃える)

/** デフォルトのタイトルプレースホルダー */
function title(overrides?: PlaceholderOverrides): PlaceholderDef {
  return {
    name: overrides?.name ?? "title",
    type: "title",
    x: overrides?.x ?? MARGIN,
    y: overrides?.y ?? 0.4,
    width: overrides?.width ?? CONTENT_W,
    height: overrides?.height ?? 0.8,
    style: {
      fontSize: 32,
      bold: true,
      align: "left",
      valign: "middle",
      padding: {
        top: DEFAULT_PADDING,
        right: DEFAULT_PADDING,
        bottom: DEFAULT_PADDING,
        left: DEFAULT_PADDING,
      },
      ...overrides?.style,
    },
    constraints: {
      maxLines: 2,
      overflow: "shrink",
      minFontSize: 20,
      ...overrides?.constraints,
    },
  };
}

/** デフォルトのサブタイトルプレースホルダー */
function subtitle(overrides?: PlaceholderOverrides): PlaceholderDef {
  return {
    name: overrides?.name ?? "subtitle",
    type: "subtitle",
    x: overrides?.x ?? MARGIN,
    y: overrides?.y ?? 4.2,
    width: overrides?.width ?? CONTENT_W,
    height: overrides?.height ?? 1.0,
    style: {
      fontSize: 20,
      color: "#666666",
      align: "left",
      valign: "middle",
      padding: {
        top: DEFAULT_PADDING,
        right: DEFAULT_PADDING,
        bottom: DEFAULT_PADDING,
        left: DEFAULT_PADDING,
      },
      ...overrides?.style,
    },
    constraints: {
      maxLines: 2,
      overflow: "shrink",
      minFontSize: 14,
      ...overrides?.constraints,
    },
  };
}

/** デフォルトの本文プレースホルダー */
function body(overrides?: PlaceholderOverrides): PlaceholderDef {
  return {
    name: overrides?.name ?? "body",
    type: "body",
    x: overrides?.x ?? MARGIN,
    y: overrides?.y ?? 1.5,
    width: overrides?.width ?? CONTENT_W,
    height: overrides?.height ?? 5.5,
    style: {
      fontSize: 18,
      align: "left",
      valign: "top",
      lineSpacing: 1.4,
      padding: {
        top: DEFAULT_PADDING,
        right: DEFAULT_PADDING,
        bottom: DEFAULT_PADDING,
        left: DEFAULT_PADDING,
      },
      ...overrides?.style,
    },
    constraints: {
      overflow: "shrink",
      minFontSize: 10,
      ...overrides?.constraints,
    },
  };
}

/** デフォルトの画像プレースホルダー */
function image(overrides?: PlaceholderOverrides): PlaceholderDef {
  return {
    name: overrides?.name ?? "image",
    type: "image",
    x: overrides?.x ?? MARGIN,
    y: overrides?.y ?? 1.5,
    width: overrides?.width ?? CONTENT_W,
    height: overrides?.height ?? 5.5,
    style: overrides?.style,
    constraints: overrides?.constraints,
  };
}

/** カスタムプレースホルダー */
function custom(
  name: string,
  rect: { x: number; y: number; width: number; height: number },
  overrides?: Omit<PlaceholderOverrides, "name" | "x" | "y" | "width" | "height">,
): PlaceholderDef {
  return {
    name,
    type: "custom",
    ...rect,
    style: overrides?.style,
    constraints: overrides?.constraints,
  };
}

/** プレースホルダーヘルパーオブジェクト */
export const ph = {
  title,
  subtitle,
  body,
  image,
  custom,
} as const;
