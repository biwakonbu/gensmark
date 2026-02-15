import type { MermaidAssetInfo } from "../assets/asset-resolver.ts";
import type { ComputedSlide } from "../types/layout.ts";
import type {
  QualityFinding,
  QualityProfile,
  QualityReport,
  ReadabilityThresholds,
} from "../types/quality.ts";
import type { DeckSpec } from "../types/spec.ts";
import type { ValidationResult } from "../types/validation.ts";

export interface EvaluateQualityOptions {
  profile: QualityProfile;
  thresholds?: Partial<ReadabilityThresholds>;
  mermaidAssets?: MermaidAssetInfo[];
}

const DEFAULT_THRESHOLDS: ReadabilityThresholds = {
  titleMinPt: 24,
  bodyMinPt: 14,
  codeMinPt: 12,
  tableMinPt: 12,
};

export function evaluateQuality(
  spec: DeckSpec,
  computedSlides: ComputedSlide[],
  validations: ValidationResult[],
  options: EvaluateQualityOptions,
): QualityReport {
  const thresholds: ReadabilityThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(options.thresholds ?? {}),
  };
  const findings: QualityFinding[] = [];
  const failingReasons: string[] = [];

  // 1) readability: min font size
  for (const slide of computedSlides) {
    for (const el of slide.elements) {
      const value = el.value;
      const isTable = typeof value !== "string" && value.type === "table";
      const isCode = typeof value !== "string" && value.type === "code";

      const effectiveFontSize = isTable ? el.computedFontSize - 2 : el.computedFontSize;
      const min =
        el.placeholder.type === "title"
          ? thresholds.titleMinPt
          : isCode
            ? thresholds.codeMinPt
            : isTable
              ? thresholds.tableMinPt
              : thresholds.bodyMinPt;

      if (effectiveFontSize < min) {
        findings.push({
          severity:
            options.profile === "strict"
              ? "error"
              : options.profile === "standard"
                ? "warning"
                : "info",
          code: "min-font-size",
          message: `Font size too small: ${effectiveFontSize.toFixed(1)}pt < ${min}pt`,
          slideIndex: slide.index,
          placeholder: el.placeholder.name,
          details: {
            placeholderType: el.placeholder.type,
            computedFontSize: el.computedFontSize,
            effectiveFontSize,
            min,
          },
        });
      }
    }
  }

  // 2) required placeholders: escalate missing-placeholder
  for (const v of validations) {
    if (v.type !== "missing-placeholder") continue;
    const slide = spec.slides[v.slideIndex];
    if (!slide) continue;
    const layout = spec.master.layouts[slide.layout];
    const phDef = layout?.placeholders?.find((p) => p.name === v.placeholder);
    if (!phDef?.constraints?.required) continue;

    findings.push({
      severity: options.profile === "strict" ? "error" : "warning",
      code: "missing-required-placeholder",
      message: `Required placeholder "${v.placeholder}" is missing`,
      slideIndex: v.slideIndex,
      placeholder: v.placeholder,
    });
  }

  // 2.5) Mermaid の可読性 (推定)
  for (const m of options.mermaidAssets ?? []) {
    if (m.estimatedMinFontPt !== undefined) {
      const min = thresholds.bodyMinPt;
      if (m.estimatedMinFontPt < min) {
        findings.push({
          severity:
            options.profile === "strict"
              ? "error"
              : options.profile === "standard"
                ? "warning"
                : "info",
          code: "mermaid-min-font",
          message: `Mermaid diagram text too small (estimated): ${m.estimatedMinFontPt.toFixed(1)}pt < ${min}pt`,
          slideIndex: m.slideIndex,
          placeholder: m.placeholder,
          details: {
            estimatedMinFontPt: m.estimatedMinFontPt,
            min,
            nodeCount: m.nodeCount,
            edgeCount: m.edgeCount,
          },
        });
      }
    }

    // 過密図の簡易ヒューリスティクス
    const nodeMax = 25;
    const edgeMax = 40;
    if ((m.nodeCount ?? 0) > nodeMax || (m.edgeCount ?? 0) > edgeMax) {
      findings.push({
        severity:
          options.profile === "strict"
            ? "error"
            : options.profile === "standard"
              ? "warning"
              : "info",
        code: "mermaid-too-dense",
        message: `Mermaid diagram may be too dense (nodes=${m.nodeCount ?? 0}, edges=${m.edgeCount ?? 0})`,
        slideIndex: m.slideIndex,
        placeholder: m.placeholder,
        details: { nodeMax, edgeMax, nodeCount: m.nodeCount, edgeCount: m.edgeCount },
      });
    }
  }

  // 3) strict gate rules
  const hasValidationErrors = validations.some((v) => v.severity === "error");
  if (hasValidationErrors) failingReasons.push("validation errors exist");

  if (options.profile === "standard" || options.profile === "strict") {
    const overflowWarnings = validations.filter(
      (v) => v.type === "overflow" && v.severity === "warning",
    );
    if (overflowWarnings.length > 0) {
      failingReasons.push(`overflow warnings: ${overflowWarnings.length}`);
    }
  }

  if (options.profile === "strict") {
    const fontIssues = validations.filter((v) => v.type === "font-not-found");
    if (fontIssues.length > 0) {
      failingReasons.push(`font-not-found: ${fontIssues.length}`);
    }

    const minFontErrors = findings.filter(
      (f) => f.code === "min-font-size" && f.severity === "error",
    );
    if (minFontErrors.length > 0) {
      failingReasons.push(`min-font-size: ${minFontErrors.length}`);
    }

    const missingReq = findings.filter(
      (f) => f.code === "missing-required-placeholder" && f.severity === "error",
    );
    if (missingReq.length > 0) {
      failingReasons.push(`missing-required-placeholder: ${missingReq.length}`);
    }

    const mermaidMin = findings.filter(
      (f) => f.code === "mermaid-min-font" && f.severity === "error",
    );
    if (mermaidMin.length > 0) {
      failingReasons.push(`mermaid-min-font: ${mermaidMin.length}`);
    }

    const mermaidDense = findings.filter(
      (f) => f.code === "mermaid-too-dense" && f.severity === "error",
    );
    if (mermaidDense.length > 0) {
      failingReasons.push(`mermaid-too-dense: ${mermaidDense.length}`);
    }
  }

  const isPassing = failingReasons.length === 0;

  return {
    profile: options.profile,
    isPassing,
    findings,
    validations,
    failingReasons,
  };
}
