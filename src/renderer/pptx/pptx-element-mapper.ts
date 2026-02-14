import type PptxGenJS from "pptxgenjs";
import type {
  BulletItem,
  BulletList,
  CodeContent,
  ImageContent,
  TableContent,
  TextContent,
} from "../../types/content.ts";
import type { ComputedElement } from "../../types/layout.ts";

// ComputedElement を pptxgenjs の API 呼び出しに変換

/** テキスト要素をスライドに追加 */
export function addTextElement(slide: PptxGenJS.Slide, element: ComputedElement): void {
  const value = element.value;
  const style = element.resolvedStyle;
  const ph = element.placeholder;

  const baseOpts: PptxGenJS.TextPropsOptions = {
    x: ph.x,
    y: ph.y,
    w: ph.width,
    h: ph.height,
    fontSize: element.computedFontSize,
    fontFace: style.fontFace,
    color: normalizeColor(style.color),
    bold: style.bold,
    italic: style.italic,
    align: style.align as PptxGenJS.HAlign,
    valign: style.valign as PptxGenJS.VAlign,
    margin: paddingToMargin(style.padding) as PptxGenJS.Margin | undefined,
    lineSpacingMultiple: style.lineSpacing,
    autoFit: false,
  };

  if (typeof value === "string") {
    slide.addText(value, baseOpts);
    return;
  }

  switch (value.type) {
    case "text":
      addRichText(slide, value, baseOpts);
      break;
    case "bullet":
      addBulletList(slide, value, baseOpts);
      break;
    case "image":
      addImage(slide, value, ph);
      break;
    case "table":
      addTable(slide, value, ph, style);
      break;
    case "code":
      addCode(slide, value, baseOpts);
      break;
  }
}

/** リッチテキスト (TextContent) を追加 */
function addRichText(
  slide: PptxGenJS.Slide,
  content: TextContent,
  baseOpts: PptxGenJS.TextPropsOptions,
): void {
  if (typeof content.value === "string") {
    slide.addText(content.value, baseOpts);
    return;
  }

  const textProps: PptxGenJS.TextProps[] = content.value.map((run) => ({
    text: run.text,
    options: {
      bold: run.style?.bold ?? baseOpts.bold,
      italic: run.style?.italic ?? baseOpts.italic,
      color: run.style?.color ? normalizeColor(run.style.color) : baseOpts.color,
      fontSize: run.style?.fontSize ?? baseOpts.fontSize,
    },
  }));

  slide.addText(textProps, baseOpts);
}

/** 箇条書きを追加 */
function addBulletList(
  slide: PptxGenJS.Slide,
  content: BulletList,
  baseOpts: PptxGenJS.TextPropsOptions,
): void {
  const textProps: PptxGenJS.TextProps[] = [];

  function flattenItems(items: BulletItem[], level: number): void {
    for (const item of items) {
      textProps.push({
        text: item.text,
        options: {
          bullet: content.ordered ? { type: "number", indent: level * 18 } : { indent: level * 18 },
          indentLevel: level,
          bold: item.style?.bold,
          italic: item.style?.italic,
          color: item.style?.color ? normalizeColor(item.style.color) : undefined,
          fontSize: item.style?.fontSize ?? baseOpts.fontSize,
        },
      });

      if (item.children && item.children.length > 0) {
        flattenItems(item.children, level + 1);
      }
    }
  }

  flattenItems(content.items, 0);
  slide.addText(textProps, baseOpts);
}

/** 画像を追加 */
function addImage(
  slide: PptxGenJS.Slide,
  content: ImageContent,
  ph: ComputedElement["placeholder"],
): void {
  const imageOpts: PptxGenJS.ImageProps = {
    path: content.path,
    x: ph.x,
    y: ph.y,
    w: ph.width,
    h: ph.height,
  };

  if (content.sizing && content.sizing !== "fill") {
    imageOpts.sizing = {
      type: content.sizing === "contain" ? "contain" : "cover",
      w: ph.width,
      h: ph.height,
    };
  }

  slide.addImage(imageOpts);
}

/** テーブルを追加 */
function addTable(
  slide: PptxGenJS.Slide,
  content: TableContent,
  ph: ComputedElement["placeholder"],
  style: ComputedElement["resolvedStyle"],
): void {
  const rows: PptxGenJS.TableRow[] = [];

  // ヘッダー行
  if (content.headers) {
    const headerRow: PptxGenJS.TableCell[] = content.headers.map((h) => ({
      text: h,
      options: {
        bold: true,
        fill: { color: normalizeColor(content.style?.headerFill ?? style.color) },
        color: normalizeColor(content.style?.headerColor ?? "#ffffff"),
        fontSize: style.fontSize - 2,
        align: "center" as PptxGenJS.HAlign,
      },
    }));
    rows.push(headerRow);
  }

  // データ行
  for (let rowIdx = 0; rowIdx < content.rows.length; rowIdx++) {
    const row = content.rows[rowIdx]!;
    const tableRow: PptxGenJS.TableCell[] = row.map((cell) => {
      if (typeof cell === "string") {
        return {
          text: cell,
          options: {
            fontSize: style.fontSize - 2,
            fill:
              content.style?.altRowFill && rowIdx % 2 === 1
                ? { color: normalizeColor(content.style.altRowFill) }
                : undefined,
          },
        } as PptxGenJS.TableCell;
      }

      return {
        text: cell.text,
        options: {
          bold: cell.style?.bold,
          italic: cell.style?.italic,
          color: cell.style?.color ? normalizeColor(cell.style.color) : undefined,
          fontSize: cell.style?.fontSize ?? style.fontSize - 2,
          fill: cell.fill ? { color: normalizeColor(cell.fill) } : undefined,
          colspan: cell.colSpan,
          rowspan: cell.rowSpan,
        },
      } as PptxGenJS.TableCell;
    });
    rows.push(tableRow);
  }

  const tableOpts: PptxGenJS.TableProps = {
    x: ph.x,
    y: ph.y,
    w: ph.width,
    border: content.style?.borderColor
      ? { color: normalizeColor(content.style.borderColor), pt: 0.5 }
      : { color: "CCCCCC", pt: 0.5 },
  };

  slide.addTable(rows, tableOpts);
}

/** コードブロックを追加 */
function addCode(
  slide: PptxGenJS.Slide,
  content: CodeContent,
  baseOpts: PptxGenJS.TextPropsOptions,
): void {
  slide.addText(content.code, {
    ...baseOpts,
    fontFace: "Courier New",
    fontSize: (baseOpts.fontSize ?? 14) - 4,
    fill: { color: "F5F5F5" },
  });
}

/** 色コードを正規化 (# を除去) */
function normalizeColor(color: string): string {
  return color.startsWith("#") ? color.slice(1) : color;
}

/** padding オブジェクトを pptxgenjs の margin に変換 (インチ) */
function paddingToMargin(padding?: {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}): number[] | undefined {
  if (!padding) return undefined;
  // pptxgenjs の margin は [top, right, bottom, left] をポイントで指定
  return [
    (padding.top ?? 0) * 72,
    (padding.right ?? 0) * 72,
    (padding.bottom ?? 0) * 72,
    (padding.left ?? 0) * 72,
  ];
}
