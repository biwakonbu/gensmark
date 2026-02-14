import { applyFixActions } from "../agent/fix-actions.ts";
import { type OpenAILlmOptions, suggestFixActionsOpenAI } from "../agent/openai-fix-actions.ts";
import type { MermaidContent } from "../types/content.ts";
import type { SlideMaster } from "../types/master.ts";
import type { QualityFinding, QualityProfile } from "../types/quality.ts";
import type { DeckSpec } from "../types/spec.ts";
import type { ValidationResult } from "../types/validation.ts";
import { type CompileOptions, type CompileResult, compileDeck } from "./compile.ts";
import { splitMermaidFlowchart } from "./mermaid-splitter.ts";

export interface AutofixOptions extends Omit<CompileOptions, "profile"> {
  /** 品質プロファイル (既定: "strict") */
  profile?: QualityProfile;
  /** 最大反復回数 (既定: 5) */
  maxIterations?: number;
  /** LLM を用いた FixAction 生成 (任意) */
  llm?: OpenAILlmOptions;
}

export interface AutofixAttempt {
  iteration: number;
  compile: CompileResult;
  appliedFixes: string[];
}

export interface AutofixResult {
  original: DeckSpec;
  fixed: DeckSpec;
  attempts: AutofixAttempt[];
  isPassing: boolean;
}

/** DeckSpec を自律的に修正し、strict を通すことを狙う */
export async function autofixDeck(
  spec: DeckSpec,
  options: AutofixOptions = {},
): Promise<AutofixResult> {
  const profile: QualityProfile = options.profile ?? "strict";
  const maxIterations = options.maxIterations ?? 5;
  const { llm, maxIterations: _maxIterations, profile: _profile, ...compileOptions } = options;

  const attempts: AutofixAttempt[] = [];
  const current: DeckSpec = structuredClone(spec);

  for (let i = 1; i <= maxIterations; i++) {
    const compile = await compileDeck(current, { ...compileOptions, profile });
    const appliedFixes: string[] = [];
    attempts.push({ iteration: i, compile, appliedFixes });

    if (compile.build.isValid && compile.quality.isPassing) {
      return {
        original: spec,
        fixed: current,
        attempts,
        isPassing: true,
      };
    }

    let changed = applyDeterministicFixes(current, compile, profile, appliedFixes);

    // 決定論 fix で動かなかった場合のみ、LLM を試す (ユーザー明示時のみ)
    if (!changed && llm?.provider === "openai") {
      try {
        const actions = await suggestFixActionsOpenAI(current, compile, llm);
        const result = applyFixActions(current, actions);
        appliedFixes.push(...result.applied.map((s) => `llm:${s}`));
        if (result.changed) changed = true;
      } catch (e) {
        appliedFixes.push(`llm:error:${(e as Error).message}`);
      }
    }

    if (!changed) break;
  }

  // 最終状態の評価
  const finalCompile = await compileDeck(current, { ...compileOptions, profile });
  return {
    original: spec,
    fixed: current,
    attempts,
    isPassing: finalCompile.build.isValid && finalCompile.quality.isPassing,
  };
}

function applyDeterministicFixes(
  spec: DeckSpec,
  compile: CompileResult,
  profile: QualityProfile,
  appliedFixes: string[],
): boolean {
  let changed = false;

  const ops: Array<
    | { kind: "overflow"; slideIndex: number; v: ValidationResult }
    | { kind: "quality"; slideIndex: number; f: QualityFinding }
  > = [];

  for (const v of compile.validations) {
    if (v.type !== "overflow") continue;
    if (v.severity === "error") {
      ops.push({ kind: "overflow", slideIndex: v.slideIndex, v });
      continue;
    }
    // standard/strict では overflow warning も失敗扱い
    if ((profile === "standard" || profile === "strict") && v.severity === "warning") {
      ops.push({ kind: "overflow", slideIndex: v.slideIndex, v });
    }
  }

  for (const f of compile.quality.findings) {
    if (f.slideIndex === undefined) continue;
    if (profile === "draft") continue;
    if (profile === "standard" && f.severity === "info") continue;
    if (profile === "strict" && f.severity !== "error") continue;

    // まずは決定論で直せるものだけ
    if (!["min-font-size", "mermaid-min-font", "mermaid-too-dense"].includes(f.code)) continue;

    ops.push({ kind: "quality", slideIndex: f.slideIndex, f });
  }

  // slideIndex 降順で処理 (挿入でインデックスがずれるので後ろから)
  ops.sort((a, b) => {
    if (a.slideIndex !== b.slideIndex) return b.slideIndex - a.slideIndex;
    // overflow を優先
    return a.kind === b.kind ? 0 : a.kind === "overflow" ? -1 : 1;
  });

  for (const op of ops) {
    if (op.kind === "overflow") {
      if (applyOverflowFix(spec, op.v, profile, appliedFixes)) {
        changed = true;
      }
      continue;
    }

    if (applyQualityFix(spec, compile.master, op.f, profile, appliedFixes)) {
      changed = true;
    }
  }

  return changed;
}

function applyOverflowFix(
  spec: DeckSpec,
  v: ValidationResult,
  _profile: QualityProfile,
  appliedFixes: string[],
): boolean {
  const slide = spec.slides[v.slideIndex];
  if (!slide) return false;

  const value = slide.data[v.placeholder];
  if (!value) return false;

  // bullet: アイテム分割
  if (typeof value !== "string" && value.type === "bullet") {
    if (value.items.length <= 1) return false;
    const mid = Math.ceil(value.items.length / 2);
    const first = value.items.slice(0, mid);
    const second = value.items.slice(mid);
    slide.data[v.placeholder] = { ...value, items: first };

    const newSlide = structuredClone(slide);
    newSlide.data[v.placeholder] = { ...value, items: second };
    bumpTitleContinuation(newSlide);
    spec.slides.splice(v.slideIndex + 1, 0, newSlide);
    appliedFixes.push(`split bullet list: slide=${v.slideIndex} placeholder=${v.placeholder}`);
    return true;
  }

  // table: 行分割
  if (typeof value !== "string" && value.type === "table") {
    if (value.rows.length <= 1) return false;
    const mid = Math.ceil(value.rows.length / 2);
    const firstRows = value.rows.slice(0, mid);
    const secondRows = value.rows.slice(mid);
    slide.data[v.placeholder] = { ...value, rows: firstRows };

    const newSlide = structuredClone(slide);
    newSlide.data[v.placeholder] = { ...value, rows: secondRows };
    bumpTitleContinuation(newSlide);
    spec.slides.splice(v.slideIndex + 1, 0, newSlide);
    appliedFixes.push(`split table: slide=${v.slideIndex} placeholder=${v.placeholder}`);
    return true;
  }

  // code: 行分割
  if (typeof value !== "string" && value.type === "code") {
    const lines = value.code.split("\n");
    if (lines.length <= 1) return false;
    const mid = Math.ceil(lines.length / 2);
    slide.data[v.placeholder] = { ...value, code: lines.slice(0, mid).join("\n") };
    const newSlide = structuredClone(slide);
    newSlide.data[v.placeholder] = { ...value, code: lines.slice(mid).join("\n") };
    bumpTitleContinuation(newSlide);
    spec.slides.splice(v.slideIndex + 1, 0, newSlide);
    appliedFixes.push(`split code: slide=${v.slideIndex} placeholder=${v.placeholder}`);
    return true;
  }

  // text: 段落分割 → 長さ短縮
  const plain = extractPlainText(value);
  if (plain.length === 0) return false;

  const paragraphs = plain.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 2) {
    const mid = Math.ceil(paragraphs.length / 2);
    const first = paragraphs.slice(0, mid).join("\n\n");
    const second = paragraphs.slice(mid).join("\n\n");

    slide.data[v.placeholder] = first;
    const newSlide = structuredClone(slide);
    newSlide.data[v.placeholder] = second;
    bumpTitleContinuation(newSlide);
    spec.slides.splice(v.slideIndex + 1, 0, newSlide);
    appliedFixes.push(`split paragraphs: slide=${v.slideIndex} placeholder=${v.placeholder}`);
    return true;
  }

  // overflowDetail 比率で短縮 (verify-validation-loop の手法を内蔵)
  const ratio =
    v.overflowDetail && v.overflowDetail.contentHeight > 0
      ? v.overflowDetail.availableHeight / v.overflowDetail.contentHeight
      : null;
  if (ratio && ratio > 0 && ratio < 1) {
    const newLength = Math.max(0, Math.floor(plain.length * ratio * 0.9));
    if (newLength < plain.length) {
      slide.data[v.placeholder] = plain.slice(0, newLength);
      appliedFixes.push(`shorten text: slide=${v.slideIndex} placeholder=${v.placeholder}`);
      return true;
    }
  }

  return false;
}

function applyQualityFix(
  spec: DeckSpec,
  master: SlideMaster,
  f: QualityFinding,
  profile: QualityProfile,
  appliedFixes: string[],
): boolean {
  if (f.slideIndex === undefined) return false;
  const slide = spec.slides[f.slideIndex];
  if (!slide) return false;

  if (f.code === "min-font-size") {
    if (!f.placeholder) return false;
    const value = slide.data[f.placeholder];
    if (!value) return false;

    // bullet/table/code は overflow と同様に分割
    if (typeof value !== "string" && value.type === "bullet") {
      if (value.items.length <= 1) return false;
      const mid = Math.ceil(value.items.length / 2);
      slide.data[f.placeholder] = { ...value, items: value.items.slice(0, mid) };
      const newSlide = structuredClone(slide);
      newSlide.data[f.placeholder] = { ...value, items: value.items.slice(mid) };
      bumpTitleContinuation(newSlide);
      spec.slides.splice(f.slideIndex + 1, 0, newSlide);
      appliedFixes.push(
        `split bullet (min-font): slide=${f.slideIndex} placeholder=${f.placeholder}`,
      );
      return true;
    }

    if (typeof value !== "string" && value.type === "table") {
      if (value.rows.length <= 1) return false;
      const mid = Math.ceil(value.rows.length / 2);
      slide.data[f.placeholder] = { ...value, rows: value.rows.slice(0, mid) };
      const newSlide = structuredClone(slide);
      newSlide.data[f.placeholder] = { ...value, rows: value.rows.slice(mid) };
      bumpTitleContinuation(newSlide);
      spec.slides.splice(f.slideIndex + 1, 0, newSlide);
      appliedFixes.push(
        `split table (min-font): slide=${f.slideIndex} placeholder=${f.placeholder}`,
      );
      return true;
    }

    if (typeof value !== "string" && value.type === "code") {
      const lines = value.code.split("\n");
      if (lines.length <= 1) return false;
      const mid = Math.ceil(lines.length / 2);
      slide.data[f.placeholder] = { ...value, code: lines.slice(0, mid).join("\n") };
      const newSlide = structuredClone(slide);
      newSlide.data[f.placeholder] = { ...value, code: lines.slice(mid).join("\n") };
      bumpTitleContinuation(newSlide);
      spec.slides.splice(f.slideIndex + 1, 0, newSlide);
      appliedFixes.push(
        `split code (min-font): slide=${f.slideIndex} placeholder=${f.placeholder}`,
      );
      return true;
    }

    // text は段落分割 or 比率短縮
    const plain = extractPlainText(value);
    if (plain.length === 0) return false;

    const paragraphs = plain.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    if (paragraphs.length >= 2) {
      const mid = Math.ceil(paragraphs.length / 2);
      slide.data[f.placeholder] = paragraphs.slice(0, mid).join("\n\n");
      const newSlide = structuredClone(slide);
      newSlide.data[f.placeholder] = paragraphs.slice(mid).join("\n\n");
      bumpTitleContinuation(newSlide);
      spec.slides.splice(f.slideIndex + 1, 0, newSlide);
      appliedFixes.push(
        `split paragraphs (min-font): slide=${f.slideIndex} placeholder=${f.placeholder}`,
      );
      return true;
    }

    // split できない場合は短縮を試みる (決定論的)
    const ratio = profile === "strict" ? 0.8 : 0.9;
    const newLength = Math.max(0, Math.floor(plain.length * ratio));
    if (newLength < plain.length) {
      slide.data[f.placeholder] = plain.slice(0, newLength);
      appliedFixes.push(
        `shorten text (min-font): slide=${f.slideIndex} placeholder=${f.placeholder}`,
      );
      return true;
    }
    return false;
  }

  if (f.code === "mermaid-min-font" || f.code === "mermaid-too-dense") {
    if (!f.placeholder) return false;
    const value = slide.data[f.placeholder];
    if (!value || typeof value === "string" || value.type !== "mermaid") return false;

    // 1) 大きい画像レイアウトがあるなら、まずそこへ移す
    const best = findBestImageLayout(master);
    if (best) {
      const onlyMermaid = Object.keys(slide.data).every(
        (k) => k === "title" || k === "subtitle" || k === f.placeholder,
      );

      if (onlyMermaid) {
        if (slide.layout !== best.layoutName || f.placeholder !== best.placeholderName) {
          // in-place にレイアウト変更 (副作用を最小化)
          slide.layout = best.layoutName;
          delete slide.data[f.placeholder];
          slide.data[best.placeholderName] = value;
          appliedFixes.push(
            `move mermaid to best image layout (in-place): slide=${f.slideIndex} layout=${best.layoutName} placeholder=${best.placeholderName}`,
          );
          return true;
        }
      } else {
        const newSlide: DeckSpec["slides"][number] = {
          layout: best.layoutName,
          data: {},
        };
        const titleVal = slide.data.title;
        if (titleVal !== undefined) newSlide.data.title = titleVal;
        newSlide.data[best.placeholderName] = value;
        bumpTitleContinuation(newSlide);
        spec.slides.splice(f.slideIndex + 1, 0, newSlide);
        delete slide.data[f.placeholder];
        appliedFixes.push(
          `move mermaid to new slide: from slide=${f.slideIndex} -> slide=${f.slideIndex + 1} layout=${best.layoutName} placeholder=${best.placeholderName}`,
        );
        return true;
      }
    }

    // 2) flowchart/graph なら、コードを 2 分割して複数枚にする
    const split = splitMermaidFlowchart((value as MermaidContent).code);
    if (!split) return false;

    const first: MermaidContent = { ...value, code: split.parts[0]! };
    const second: MermaidContent = { ...value, code: split.parts[1]! };
    slide.data[f.placeholder] = first;

    const newSlide = structuredClone(slide);
    newSlide.data[f.placeholder] = second;
    bumpTitleContinuation(newSlide);
    spec.slides.splice(f.slideIndex + 1, 0, newSlide);
    appliedFixes.push(
      `split mermaid flowchart: slide=${f.slideIndex} placeholder=${f.placeholder}`,
    );
    return true;
  }

  return false;
}

function bumpTitleContinuation(slide: DeckSpec["slides"][number]): void {
  const title = slide.data.title;
  if (typeof title === "string") {
    // 自動生成は言語非依存に寄せる (日本語固定を避ける)
    if (!/\((continued|cont\.)\)|続き/.test(title)) {
      slide.data.title = `${title} (continued)`;
    }
  }
}

function extractPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  // PlaceholderValue のうち、text/code のみ対応 (スタイルは落とす)
  const v = value as { type?: string; value?: unknown; code?: string };
  if (v.type === "text") {
    if (typeof v.value === "string") return v.value;
    if (Array.isArray(v.value)) {
      return v.value
        .map((r) => {
          if (!r || typeof r !== "object") return "";
          const maybe = r as { text?: unknown };
          return typeof maybe.text === "string" ? maybe.text : "";
        })
        .join("");
    }
  }
  if (v.type === "code" && typeof v.code === "string") return v.code;
  return "";
}

function findBestImageLayout(
  master: SlideMaster,
): { layoutName: string; placeholderName: string } | null {
  let best: { layoutName: string; placeholderName: string; area: number } | null = null;
  for (const [layoutName, layout] of Object.entries(master.layouts)) {
    for (const ph of layout.placeholders) {
      if (ph.type !== "image") continue;
      const area = ph.width * ph.height;
      if (!best || area > best.area) {
        best = { layoutName, placeholderName: ph.name, area };
      }
    }
  }
  return best ? { layoutName: best.layoutName, placeholderName: best.placeholderName } : null;
}
