import type { AssetResolveOptions, MermaidAssetInfo } from "../assets/asset-resolver.ts";
import { resolveAssets } from "../assets/asset-resolver.ts";
import { resolveSlide } from "../core/slide-resolver.ts";
import { LayoutEngine } from "../layout/layout-engine.ts";
import { PptxRenderer } from "../renderer/pptx/pptx-renderer.ts";
import type { Renderer } from "../renderer/renderer.ts";
import type { ComputedSlide } from "../types/layout.ts";
import type { AspectRatio, SlideMaster } from "../types/master.ts";
import type { QualityProfile, QualityReport, ReadabilityThresholds } from "../types/quality.ts";
import type { DeckSpec } from "../types/spec.ts";
import type { BuildResult, ValidationResult } from "../types/validation.ts";
import { evaluateQuality } from "./quality-evaluator.ts";

export interface CompileOptions {
  /** 品質プロファイル (既定: "draft") */
  profile?: QualityProfile;
  /** 可読性閾値の上書き */
  thresholds?: Partial<ReadabilityThresholds>;
  /** レンダラー (未指定時は PptxRenderer) */
  renderer?: Renderer;
  /** アスペクト比 (未指定時は spec/master から解決) */
  aspectRatio?: AspectRatio;
  /** アセット解決 (Mermaid 等) */
  assets?: AssetResolveOptions;
}

export interface CompileResult {
  spec: DeckSpec;
  master: SlideMaster;
  computedSlides: ComputedSlide[];
  validations: ValidationResult[];
  quality: QualityReport;
  build: BuildResult;
  mermaidAssets: MermaidAssetInfo[];
}

function resolveAspectRatio(spec: DeckSpec, options: CompileOptions): AspectRatio {
  return options.aspectRatio ?? spec.aspectRatio ?? spec.master.aspectRatio ?? "16:9";
}

/** DeckSpec をコンパイルし、品質レポートと PPTX 出力を得る */
export async function compileDeck(
  spec: DeckSpec,
  options: CompileOptions = {},
): Promise<CompileResult> {
  const assetResolved = await resolveAssets(spec, options.assets);
  const resolvedSpec = assetResolved.spec;
  const master = resolvedSpec.master;
  const layoutEngine = new LayoutEngine();

  const validations: ValidationResult[] = [];
  const computedSlides: ComputedSlide[] = [];
  validations.push(...assetResolved.validations);

  // 1) SlideContent → ComputedSlide 解決
  for (let i = 0; i < resolvedSpec.slides.length; i++) {
    const slide = resolvedSpec.slides[i]!;
    const resolved = resolveSlide(slide, master, i);
    validations.push(...resolved.validations);
    computedSlides.push(resolved.computed);
  }

  // 2) レイアウト検証 (オーバーフロー検知 + shrink 適用)
  for (const computed of computedSlides) {
    const layoutValidations = await layoutEngine.validateSlide(computed, master);
    validations.push(...layoutValidations);
  }

  const hasErrors = validations.some((v) => v.severity === "error");

  // 3) 品質評価
  const profile: QualityProfile = options.profile ?? "draft";
  const quality = evaluateQuality(resolvedSpec, computedSlides, validations, {
    profile,
    thresholds: options.thresholds,
    mermaidAssets: assetResolved.mermaidAssets,
  });

  // 4) レンダリング (errors がある場合はスキップ)
  const aspectRatio = resolveAspectRatio(resolvedSpec, options);
  const build: BuildResult = hasErrors
    ? {
        isValid: false,
        validations,
        toPptxFile: async () => {
          throw new Error(
            "Cannot generate PPTX: validation errors exist. Fix all errors before calling toPptxFile().",
          );
        },
      }
    : await renderToPptx(master, computedSlides, validations, aspectRatio, options.renderer);

  return {
    spec: resolvedSpec,
    master,
    computedSlides,
    validations,
    quality,
    build,
    mermaidAssets: assetResolved.mermaidAssets,
  };
}

async function renderToPptx(
  master: SlideMaster,
  computedSlides: ComputedSlide[],
  validations: ValidationResult[],
  aspectRatio: AspectRatio,
  renderer?: Renderer,
): Promise<BuildResult> {
  const r = renderer ?? new PptxRenderer(aspectRatio);
  r.reset?.(aspectRatio);
  r.setMaster(master);
  r.renderSlides(computedSlides);
  const pptxBuffer = await r.toBuffer();

  return {
    isValid: true,
    validations,
    pptxBuffer,
    toPptxFile: async (path: string) => {
      await r.toFile(path);
    },
  };
}
