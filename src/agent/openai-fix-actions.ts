import type { CompileResult } from "../compiler/compile.ts";
import type { DeckSpec } from "../types/spec.ts";
import type { FixAction } from "./fix-actions.ts";

export interface OpenAILlmOptions {
  provider: "openai";
  /** OpenAI model (例: "gpt-5", "gpt-4.1") */
  model: string;
  /** 未指定時は OPENAI_API_KEY を使用 */
  apiKey?: string;
  /** 生成する最大アクション数 (既定: 8) */
  maxActions?: number;
}

const FIX_ACTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["split_placeholder", "shorten_text", "set_text", "delete_slide"],
          },
          slideIndex: { type: "integer", minimum: 0 },
          placeholder: { type: "string" },
          ratio: { type: "number", minimum: 0, maximum: 1 },
          maxChars: { type: "integer", minimum: 0 },
          text: { type: "string" },
        },
        required: ["type", "slideIndex"],
      },
    },
  },
  required: ["actions"],
};

/**
 * OpenAI を用いて FixAction[] を提案させる。
 * - 出力は JSON のみ (text.format=json_schema)
 * - 適用は別途 applyFixActions などの決定論ロジックで行う
 */
export async function suggestFixActionsOpenAI(
  spec: DeckSpec,
  compile: CompileResult,
  options: OpenAILlmOptions,
): Promise<FixAction[]> {
  if (!options.model) throw new Error("OpenAI model is required");

  const maxActions = options.maxActions ?? 8;
  const interesting = new Set<number>();
  for (const v of compile.validations) interesting.add(v.slideIndex);
  for (const f of compile.quality.findings)
    if (f.slideIndex !== undefined) interesting.add(f.slideIndex);

  const slideSummaries = Array.from(interesting)
    .sort((a, b) => a - b)
    .slice(0, 20)
    .map((i) => ({
      slideIndex: i,
      layout: spec.slides[i]?.layout,
      keys: spec.slides[i] ? Object.keys(spec.slides[i]!.data) : [],
    }));

  const slideSpecs = Array.from(interesting)
    .sort((a, b) => a - b)
    .slice(0, 10)
    .map((i) => ({ slideIndex: i, slide: spec.slides[i] }))
    .filter((x) => x.slide !== undefined);

  const layoutIndex = Object.fromEntries(
    Object.entries(spec.master.layouts).map(([name, layout]) => [
      name,
      layout.placeholders.map((p) => ({ name: p.name, type: p.type, w: p.width, h: p.height })),
    ]),
  );

  const prompt = [
    "You are an automated slide-spec fixer.",
    "You must output JSON only.",
    "",
    "Allowed actions:",
    "- split_placeholder: split a placeholder value into two slides (bullet/table/code/text/mermaid flowchart only).",
    "- shorten_text: shorten a string placeholder.",
    "- set_text: replace placeholder with provided text.",
    "- delete_slide: delete a slide.",
    "",
    "Goal:",
    `Make the deck pass the quality gate (profile=${compile.quality.profile}).`,
    "",
    "Context (do not output this back):",
    JSON.stringify(
      {
        failingReasons: compile.quality.failingReasons,
        validations: compile.validations.filter((v) => v.severity !== "info").slice(0, 80),
        qualityFindings: compile.quality.findings.slice(0, 80),
        slideSummaries,
        layoutIndex,
        slideSpecs,
      },
      null,
      2,
    ),
  ].join("\n");

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: options.apiKey });

  const response = await client.responses.create({
    model: options.model,
    temperature: 0,
    input: [
      {
        role: "system",
        content: "Return JSON that matches the provided schema. Do not include any other text.",
      },
      { role: "user", content: prompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "FixActions",
        schema: FIX_ACTION_SCHEMA,
        strict: true,
      },
    },
  });

  const raw = response.output_text;
  const parsed = safeJsonParse(raw);
  const actionsUnknown = isRecord(parsed) ? parsed.actions : null;
  if (!Array.isArray(actionsUnknown)) return [];

  const actions: FixAction[] = [];
  for (const item of actionsUnknown) {
    const a = validateFixAction(item);
    if (a) actions.push(a);
    if (actions.length >= maxActions) break;
  }

  return actions;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateFixAction(v: unknown): FixAction | null {
  if (!isRecord(v)) return null;
  const type = v.type;
  const slideIndex = v.slideIndex;
  if (typeof type !== "string") return null;
  if (typeof slideIndex !== "number" || !Number.isInteger(slideIndex) || slideIndex < 0)
    return null;

  if (type === "delete_slide") {
    return { type, slideIndex };
  }

  const placeholder = v.placeholder;
  if (typeof placeholder !== "string" || placeholder.length === 0) return null;

  if (type === "split_placeholder") {
    return { type, slideIndex, placeholder };
  }

  if (type === "set_text") {
    const text = v.text;
    if (typeof text !== "string") return null;
    return { type, slideIndex, placeholder, text };
  }

  if (type === "shorten_text") {
    const ratio = v.ratio;
    const maxChars = v.maxChars;
    const out: FixAction = { type, slideIndex, placeholder };
    if (typeof ratio === "number") out.ratio = ratio;
    if (typeof maxChars === "number" && Number.isInteger(maxChars)) out.maxChars = maxChars;
    return out;
  }

  return null;
}
