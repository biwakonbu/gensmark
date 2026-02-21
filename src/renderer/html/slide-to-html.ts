import type { ComputedSlide } from "../../types/layout.ts";
import type { BackgroundDef, FixedElement } from "../../types/master.ts";
import { elementToHtml } from "./element-to-html.ts";

// ComputedSlide -> HTML 変換

/** 背景定義を CSS に変換 */
function backgroundToCss(bg?: BackgroundDef): string {
  if (!bg) return "background:#FFFFFF";
  switch (bg.type) {
    case "solid":
      return `background:${bg.color}`;
    case "image":
      return `background:url('${bg.path}') center/cover no-repeat`;
    case "gradient": {
      const dir =
        bg.direction === "horizontal"
          ? "to right"
          : bg.direction === "diagonal"
            ? "135deg"
            : "to bottom";
      return `background:linear-gradient(${dir},${bg.colors.join(",")})`;
    }
  }
}

/** 固定要素を HTML に変換 */
function fixedElementToHtml(el: FixedElement): string {
  const baseStyle = `position:absolute;left:${el.x}in;top:${el.y}in;width:${el.width}in;height:${el.height}in`;

  switch (el.type) {
    case "rect":
      return `<div class="gm-fixed gm-rect" style="${baseStyle};background:${el.color ?? "#000000"}"></div>`;
    case "line": {
      const lineW = el.lineWidth ?? 1;
      // 幅が大きければ水平線、高さが大きければ垂直線と判定
      if (el.width > el.height) {
        return `<div class="gm-fixed gm-line" style="${baseStyle};border-top:${lineW}pt solid ${el.color ?? "#000000"}"></div>`;
      }
      return `<div class="gm-fixed gm-line" style="${baseStyle};border-left:${lineW}pt solid ${el.color ?? "#000000"}"></div>`;
    }
    case "image":
      return `<div class="gm-fixed gm-image" style="${baseStyle}"><img src="${el.path ?? ""}" style="width:100%;height:100%;object-fit:contain"></div>`;
  }
}

/** スライド寸法を取得 (インチ) */
export function getSlideDimensions(aspectRatio: "16:9" | "4:3"): {
  width: number;
  height: number;
} {
  return aspectRatio === "16:9"
    ? { width: 13.33, height: 7.5 }
    : { width: 10, height: 7.5 };
}

/** ComputedSlide を HTML div に変換 */
export function slideToHtml(
  slide: ComputedSlide,
  aspectRatio: "16:9" | "4:3",
): string {
  const { width, height } = getSlideDimensions(aspectRatio);
  const bgCss = backgroundToCss(slide.background);

  let html = `<div class="gm-slide" data-layout="${slide.layoutName}" data-index="${slide.index}" style="position:relative;width:${width}in;height:${height}in;overflow:hidden;${bgCss};page-break-after:always;">`;

  // 固定要素 (装飾線、矩形、ロゴ等)
  if (slide.fixedElements) {
    for (const fixed of slide.fixedElements) {
      html += fixedElementToHtml(fixed);
    }
  }

  // プレースホルダー要素
  for (const element of slide.elements) {
    html += elementToHtml(element);
  }

  html += "</div>";
  return html;
}
