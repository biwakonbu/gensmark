import type { SlideLayout, AspectRatio, PlaceholderType } from "../../types/master.ts";
import {
  backgroundToCss,
  fixedElementToHtml,
  getSlideDimensions,
} from "../../renderer/html/slide-to-html.ts";

// SlideLayout をワイヤフレーム HTML として描画

/** プレースホルダータイプごとの色 */
const TYPE_COLORS: Record<PlaceholderType, string> = {
  title: "rgba(59, 130, 246, 0.25)",    // 青
  subtitle: "rgba(34, 197, 94, 0.25)",  // 緑
  body: "rgba(249, 115, 22, 0.25)",     // オレンジ
  image: "rgba(168, 85, 247, 0.25)",    // 紫
  custom: "rgba(156, 163, 175, 0.25)",  // 灰
};

const TYPE_BORDER_COLORS: Record<PlaceholderType, string> = {
  title: "rgba(59, 130, 246, 0.7)",
  subtitle: "rgba(34, 197, 94, 0.7)",
  body: "rgba(249, 115, 22, 0.7)",
  image: "rgba(168, 85, 247, 0.7)",
  custom: "rgba(156, 163, 175, 0.7)",
};

/** レイアウトをワイヤフレーム HTML に変換 */
export function renderLayoutPreview(
  layout: SlideLayout,
  layoutName: string,
  aspectRatio: AspectRatio = "16:9",
): string {
  const { width, height } = getSlideDimensions(aspectRatio);
  const bgCss = backgroundToCss(layout.background);

  let html = `<div class="wireframe-slide" style="position:relative;width:${width}in;height:${height}in;overflow:hidden;${bgCss};">`;

  // 固定要素を背景レイヤーとして描画
  if (layout.fixedElements) {
    for (const el of layout.fixedElements) {
      html += fixedElementToHtml(el);
    }
  }

  // プレースホルダーを枠線+ラベル付きで描画
  for (const ph of layout.placeholders) {
    const bgColor = TYPE_COLORS[ph.type] ?? TYPE_COLORS.custom;
    const borderColor = TYPE_BORDER_COLORS[ph.type] ?? TYPE_BORDER_COLORS.custom;

    html += `<div class="wireframe-ph" style="position:absolute;left:${ph.x}in;top:${ph.y}in;width:${ph.width}in;height:${ph.height}in;background:${bgColor};border:2px dashed ${borderColor};display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:system-ui,sans-serif;pointer-events:auto;cursor:default;" data-name="${ph.name}" data-type="${ph.type}">`;
    html += `<span style="font-size:11px;font-weight:bold;color:${borderColor};text-shadow:0 0 3px rgba(0,0,0,0.3);">${ph.name}</span>`;
    html += `<span style="font-size:9px;color:${borderColor};opacity:0.8;">${ph.type} | ${ph.width.toFixed(2)}" x ${ph.height.toFixed(2)}"</span>`;
    html += `</div>`;
  }

  // レイアウト名ラベル
  html += `<div style="position:absolute;bottom:4px;right:8px;font-size:10px;color:rgba(255,255,255,0.5);font-family:system-ui,sans-serif;">${layoutName}</div>`;

  html += `</div>`;
  return html;
}

/** プレースホルダー情報テーブル HTML を生成 */
export function renderPlaceholderTable(layout: SlideLayout): string {
  let html = `<table style="width:100%;border-collapse:collapse;font-size:13px;font-family:system-ui,sans-serif;">`;
  html += `<thead><tr style="border-bottom:1px solid #444;">`;
  html += `<th style="text-align:left;padding:6px 8px;color:#aaa;">Name</th>`;
  html += `<th style="text-align:left;padding:6px 8px;color:#aaa;">Type</th>`;
  html += `<th style="text-align:right;padding:6px 8px;color:#aaa;">X</th>`;
  html += `<th style="text-align:right;padding:6px 8px;color:#aaa;">Y</th>`;
  html += `<th style="text-align:right;padding:6px 8px;color:#aaa;">W</th>`;
  html += `<th style="text-align:right;padding:6px 8px;color:#aaa;">H</th>`;
  html += `</tr></thead><tbody>`;

  for (const ph of layout.placeholders) {
    const borderColor = TYPE_BORDER_COLORS[ph.type] ?? TYPE_BORDER_COLORS.custom;
    html += `<tr style="border-bottom:1px solid #333;">`;
    html += `<td style="padding:6px 8px;color:${borderColor};font-weight:bold;">${ph.name}</td>`;
    html += `<td style="padding:6px 8px;color:#ccc;">${ph.type}</td>`;
    html += `<td style="padding:6px 8px;color:#ccc;text-align:right;">${ph.x.toFixed(2)}</td>`;
    html += `<td style="padding:6px 8px;color:#ccc;text-align:right;">${ph.y.toFixed(2)}</td>`;
    html += `<td style="padding:6px 8px;color:#ccc;text-align:right;">${ph.width.toFixed(2)}</td>`;
    html += `<td style="padding:6px 8px;color:#ccc;text-align:right;">${ph.height.toFixed(2)}</td>`;
    html += `</tr>`;
  }

  html += `</tbody></table>`;
  return html;
}
