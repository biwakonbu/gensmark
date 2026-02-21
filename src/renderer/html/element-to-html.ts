import type {
  BulletItem,
  BulletList,
  CodeContent,
  ImageContent,
  PlaceholderValue,
  TableContent,
  TextContent,
  TextRun,
  TextStyle,
} from "../../types/content.ts";
import type { ComputedElement } from "../../types/layout.ts";

// ComputedElement -> HTML 変換

/** テキストスタイルをインライン CSS に変換 */
function textStyleToCss(style?: TextStyle): string {
  if (!style) return "";
  const parts: string[] = [];
  if (style.bold) parts.push("font-weight:bold");
  if (style.italic) parts.push("font-style:italic");
  if (style.color) parts.push(`color:${style.color}`);
  if (style.fontSize) parts.push(`font-size:${style.fontSize}pt`);
  return parts.length > 0 ? ` style="${parts.join(";")}"` : "";
}

/** HTML 特殊文字をエスケープ */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** TextRun 配列を HTML span 群に変換 */
function renderTextRuns(runs: TextRun[]): string {
  return runs
    .map((run) => {
      const escaped = escapeHtml(run.text);
      const style = textStyleToCss(run.style);
      return `<span${style}>${escaped}</span>`;
    })
    .join("");
}

/** TextContent を HTML に変換 */
function renderTextContent(content: TextContent): string {
  if (typeof content.value === "string") {
    return `<span>${escapeHtml(content.value)}</span>`;
  }
  return renderTextRuns(content.value);
}

/** BulletItem を <li> に変換 (再帰対応) */
function renderBulletItem(item: BulletItem, ordered: boolean): string {
  const style = textStyleToCss(item.style);
  let html = `<li${style}>${escapeHtml(item.text)}`;
  if (item.children && item.children.length > 0) {
    const tag = ordered ? "ol" : "ul";
    html += `<${tag} class="gm-bullets-nested">`;
    for (const child of item.children) {
      html += renderBulletItem(child, ordered);
    }
    html += `</${tag}>`;
  }
  html += "</li>";
  return html;
}

/** BulletList を HTML に変換 */
function renderBulletList(content: BulletList): string {
  const tag = content.ordered ? "ol" : "ul";
  const items = content.items.map((item) => renderBulletItem(item, !!content.ordered)).join("");
  return `<${tag} class="gm-bullets">${items}</${tag}>`;
}

/** TableContent を HTML に変換 */
function renderTable(content: TableContent): string {
  const style = content.style;
  let html = '<table class="gm-table">';

  // ヘッダー
  if (content.headers && content.headers.length > 0) {
    const headerFill = style?.headerFill ? ` background:${style.headerFill};` : "";
    const headerColor = style?.headerColor ? ` color:${style.headerColor};` : "";
    html += "<thead><tr>";
    for (const header of content.headers) {
      html += `<th style="${headerFill}${headerColor}">${escapeHtml(header)}</th>`;
    }
    html += "</tr></thead>";
  }

  // データ行
  html += "<tbody>";
  for (let i = 0; i < content.rows.length; i++) {
    const row = content.rows[i]!;
    const altFill =
      style?.altRowFill && i % 2 === 1 ? ` style="background:${style.altRowFill}"` : "";
    html += `<tr${altFill}>`;
    for (const cell of row) {
      if (typeof cell === "string") {
        html += `<td>${escapeHtml(cell)}</td>`;
      } else {
        const cellStyle: string[] = [];
        if (cell.fill) cellStyle.push(`background:${cell.fill}`);
        if (cell.style?.bold) cellStyle.push("font-weight:bold");
        if (cell.style?.italic) cellStyle.push("font-style:italic");
        if (cell.style?.color) cellStyle.push(`color:${cell.style.color}`);
        const attrs: string[] = [];
        if (cellStyle.length > 0) attrs.push(`style="${cellStyle.join(";")}"`);
        if (cell.colSpan && cell.colSpan > 1) attrs.push(`colspan="${cell.colSpan}"`);
        if (cell.rowSpan && cell.rowSpan > 1) attrs.push(`rowspan="${cell.rowSpan}"`);
        html += `<td${attrs.length > 0 ? ` ${attrs.join(" ")}` : ""}>${escapeHtml(cell.text)}</td>`;
      }
    }
    html += "</tr>";
  }
  html += "</tbody></table>";

  return html;
}

/** CodeContent を HTML に変換 */
function renderCode(content: CodeContent): string {
  const lang = content.language ? ` data-language="${escapeHtml(content.language)}"` : "";
  return `<pre class="gm-code"${lang}><code>${escapeHtml(content.code)}</code></pre>`;
}

/** ImageContent を HTML に変換 */
function renderImage(content: ImageContent): string {
  const sizing = content.sizing ?? "contain";
  const alt = content.alt ? escapeHtml(content.alt) : "";
  return `<img class="gm-image" src="${escapeHtml(content.path)}" alt="${alt}" style="width:100%;height:100%;object-fit:${sizing};">`;
}

/** MermaidContent を HTML に変換 */
function renderMermaid(code: string): string {
  return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
}

/** PlaceholderValue を HTML に変換 */
export function valueToHtml(value: PlaceholderValue): string {
  if (typeof value === "string") {
    return `<span>${escapeHtml(value)}</span>`;
  }
  switch (value.type) {
    case "text":
      return renderTextContent(value);
    case "bullet":
      return renderBulletList(value);
    case "table":
      return renderTable(value);
    case "code":
      return renderCode(value);
    case "image":
      return renderImage(value);
    case "mermaid":
      return renderMermaid(value.code);
  }
}

/** ComputedElement のプレースホルダーの CSS スタイルを生成 */
export function elementPositionCss(el: ComputedElement): string {
  const { placeholder: ph, resolvedStyle: style, computedFontSize } = el;
  const parts = [
    "position:absolute",
    `left:${ph.x}in`,
    `top:${ph.y}in`,
    `width:${ph.width}in`,
    `height:${ph.height}in`,
    `font-size:${computedFontSize}pt`,
    `font-family:${style.fontFace},sans-serif`,
    `color:${style.color}`,
    `text-align:${style.align}`,
  ];

  if (style.bold) parts.push("font-weight:bold");
  if (style.italic) parts.push("font-style:italic");

  // 垂直配置
  if (style.valign === "middle") {
    parts.push("display:flex", "align-items:center");
  } else if (style.valign === "bottom") {
    parts.push("display:flex", "align-items:flex-end");
  }

  // 行間
  if (style.lineSpacing) {
    parts.push(`line-height:${style.lineSpacing}`);
  }

  // パディング
  const pad = style.padding;
  if (pad) {
    parts.push(
      `padding:${pad.top ?? 0}in ${pad.right ?? 0}in ${pad.bottom ?? 0}in ${pad.left ?? 0}in`,
    );
  }

  // コンテンツがコードの場合はモノスペースフォント
  const val = el.value;
  if (typeof val !== "string" && val.type === "code") {
    parts.push(`font-family:${style.monoFont ?? "Courier New"},monospace`);
    if (style.codeBgColor) {
      parts.push(`background:${style.codeBgColor}`);
    }
  }

  return parts.join(";");
}

/** ComputedElement を HTML div に変換 */
export function elementToHtml(el: ComputedElement): string {
  const posStyle = elementPositionCss(el);
  const inner = valueToHtml(el.value);
  const name = escapeHtml(el.placeholder.name);
  return `<div class="gm-ph" data-name="${name}" style="${posStyle}">${inner}</div>`;
}
