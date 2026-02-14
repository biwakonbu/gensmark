import { splitMermaidFlowchart } from "../compiler/mermaid-splitter.ts";
import type { MermaidContent, PlaceholderValue } from "../types/content.ts";
import type { DeckSpec } from "../types/spec.ts";

export type FixAction =
  | {
      type: "split_placeholder";
      slideIndex: number;
      placeholder: string;
    }
  | {
      type: "shorten_text";
      slideIndex: number;
      placeholder: string;
      /** 0 < ratio < 1 */
      ratio?: number;
      /** maxChars >= 0 */
      maxChars?: number;
    }
  | {
      type: "set_text";
      slideIndex: number;
      placeholder: string;
      text: string;
    }
  | {
      type: "delete_slide";
      slideIndex: number;
    };

export interface ApplyFixActionsResult {
  changed: boolean;
  applied: string[];
  skipped: Array<{ action: FixAction; reason: string }>;
}

/**
 * FixAction[] を決定論的に適用する。副作用は DeckSpec のみ。
 * - slideIndex を含む操作があるため、降順で処理してインデックスずれを最小化する。
 */
export function applyFixActions(spec: DeckSpec, actions: FixAction[]): ApplyFixActionsResult {
  const applied: string[] = [];
  const skipped: Array<{ action: FixAction; reason: string }> = [];
  let changed = false;

  const sorted = [...actions].sort((a, b) => b.slideIndex - a.slideIndex);

  for (const action of sorted) {
    const slide = spec.slides[action.slideIndex];
    if (!slide) {
      skipped.push({ action, reason: "slide not found" });
      continue;
    }

    if (action.type === "delete_slide") {
      spec.slides.splice(action.slideIndex, 1);
      applied.push(`delete_slide: slide=${action.slideIndex}`);
      changed = true;
      continue;
    }

    if (action.type === "set_text") {
      slide.data[action.placeholder] = action.text;
      applied.push(`set_text: slide=${action.slideIndex} placeholder=${action.placeholder}`);
      changed = true;
      continue;
    }

    if (action.type === "shorten_text") {
      const value = slide.data[action.placeholder];
      if (typeof value !== "string") {
        skipped.push({ action, reason: "placeholder is not a string" });
        continue;
      }

      const ratio = action.ratio;
      const maxChars = action.maxChars;
      let next = value;
      if (typeof maxChars === "number") next = next.slice(0, Math.max(0, maxChars));
      if (typeof ratio === "number" && ratio > 0 && ratio < 1)
        next = next.slice(0, Math.floor(next.length * ratio));

      if (next.length >= value.length) {
        skipped.push({ action, reason: "no shortening applied" });
        continue;
      }

      slide.data[action.placeholder] = next;
      applied.push(`shorten_text: slide=${action.slideIndex} placeholder=${action.placeholder}`);
      changed = true;
      continue;
    }

    if (action.type === "split_placeholder") {
      const ok = splitPlaceholder(spec, action.slideIndex, action.placeholder);
      if (!ok) {
        skipped.push({ action, reason: "cannot split placeholder value" });
        continue;
      }
      applied.push(
        `split_placeholder: slide=${action.slideIndex} placeholder=${action.placeholder}`,
      );
      changed = true;
      continue;
    }

    skipped.push({ action, reason: "unknown action type" });
  }

  return { changed, applied, skipped };
}

function splitPlaceholder(spec: DeckSpec, slideIndex: number, placeholder: string): boolean {
  const slide = spec.slides[slideIndex];
  if (!slide) return false;
  const value = slide.data[placeholder];
  if (!value) return false;

  // bullet
  if (typeof value !== "string" && value.type === "bullet") {
    if (value.items.length <= 1) return false;
    const mid = Math.ceil(value.items.length / 2);
    slide.data[placeholder] = { ...value, items: value.items.slice(0, mid) };
    const newSlide = structuredClone(slide);
    newSlide.data[placeholder] = { ...value, items: value.items.slice(mid) };
    bumpTitle(newSlide);
    spec.slides.splice(slideIndex + 1, 0, newSlide);
    return true;
  }

  // table
  if (typeof value !== "string" && value.type === "table") {
    if (value.rows.length <= 1) return false;
    const mid = Math.ceil(value.rows.length / 2);
    slide.data[placeholder] = { ...value, rows: value.rows.slice(0, mid) };
    const newSlide = structuredClone(slide);
    newSlide.data[placeholder] = { ...value, rows: value.rows.slice(mid) };
    bumpTitle(newSlide);
    spec.slides.splice(slideIndex + 1, 0, newSlide);
    return true;
  }

  // code
  if (typeof value !== "string" && value.type === "code") {
    const lines = value.code.split("\n");
    if (lines.length <= 1) return false;
    const mid = Math.ceil(lines.length / 2);
    slide.data[placeholder] = { ...value, code: lines.slice(0, mid).join("\n") };
    const newSlide = structuredClone(slide);
    newSlide.data[placeholder] = { ...value, code: lines.slice(mid).join("\n") };
    bumpTitle(newSlide);
    spec.slides.splice(slideIndex + 1, 0, newSlide);
    return true;
  }

  // mermaid
  if (typeof value !== "string" && value.type === "mermaid") {
    const split = splitMermaidFlowchart(value.code);
    if (!split) return false;
    const first: MermaidContent = { ...value, code: split.parts[0]! };
    const second: MermaidContent = { ...value, code: split.parts[1]! };
    slide.data[placeholder] = first;
    const newSlide = structuredClone(slide);
    newSlide.data[placeholder] = second;
    bumpTitle(newSlide);
    spec.slides.splice(slideIndex + 1, 0, newSlide);
    return true;
  }

  // text (string or TextContent)
  const plain = extractPlainText(value);
  if (plain.length === 0) return false;

  const paragraphs = plain.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 2) {
    const mid = Math.ceil(paragraphs.length / 2);
    slide.data[placeholder] = paragraphs.slice(0, mid).join("\n\n");
    const newSlide = structuredClone(slide);
    newSlide.data[placeholder] = paragraphs.slice(mid).join("\n\n");
    bumpTitle(newSlide);
    spec.slides.splice(slideIndex + 1, 0, newSlide);
    return true;
  }

  // 最後の手段: 文字列を半分に割る (意味は落ちるが収束性を優先)
  const half = Math.ceil(plain.length / 2);
  if (half <= 0 || half >= plain.length) return false;
  slide.data[placeholder] = plain.slice(0, half);
  const newSlide = structuredClone(slide);
  newSlide.data[placeholder] = plain.slice(half);
  bumpTitle(newSlide);
  spec.slides.splice(slideIndex + 1, 0, newSlide);
  return true;
}

function bumpTitle(slide: DeckSpec["slides"][number]): void {
  const title = slide.data.title;
  if (typeof title === "string") {
    if (!/\((continued|cont\.)\)|続き/.test(title)) {
      slide.data.title = `${title} (continued)`;
    }
  }
}

function extractPlainText(value: PlaceholderValue): string {
  if (typeof value === "string") return value;
  if (value.type === "text") {
    if (typeof value.value === "string") return value.value;
    return value.value.map((r) => r.text).join("");
  }
  if (value.type === "code") return value.code;
  return "";
}
