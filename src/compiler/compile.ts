import type { AssetResolveOptions, MermaidAssetInfo } from "../assets/asset-resolver.ts";
import { resolveAssets } from "../assets/asset-resolver.ts";
import { resolveSlide } from "../core/slide-resolver.ts";
import { LayoutEngine } from "../layout/layout-engine.ts";
import { PptxRenderer } from "../renderer/pptx/pptx-renderer.ts";
import { TemplateInheritanceRenderer } from "../renderer/pptx/template-inheritance-renderer.ts";
import type { Renderer } from "../renderer/renderer.ts";
import type { ComputedSlide } from "../types/layout.ts";
import type { AspectRatio, SlideMaster } from "../types/master.ts";
import type { QualityProfile, QualityReport, ReadabilityThresholds } from "../types/quality.ts";
import type { DeckSpec } from "../types/spec.ts";
import type { ImportedTemplate, TemplateImportWarning } from "../types/template.ts";
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
  /** 取り込み済みテンプレート */
  template?: ImportedTemplate;
}

export interface CompileResult {
  spec: DeckSpec;
  master: SlideMaster;
  computedSlides: ComputedSlide[];
  validations: ValidationResult[];
  quality: QualityReport;
  build: BuildResult;
  mermaidAssets: MermaidAssetInfo[];
  templateWarnings: TemplateImportWarning[];
}

function resolveAspectRatio(spec: DeckSpec, options: CompileOptions): AspectRatio {
  return options.aspectRatio ?? spec.aspectRatio ?? spec.master.aspectRatio ?? "16:9";
}

/** DeckSpec をコンパイルし、品質レポートと PPTX 出力を得る */
export async function compileDeck(
  spec: DeckSpec,
  options: CompileOptions = {},
): Promise<CompileResult> {
  const templateWarnings: TemplateImportWarning[] = [...(options.template?.warnings ?? [])];
  const assetResolved = await resolveAssets(spec, options.assets);
  const resolvedSpec = assetResolved.spec;
  const master = resolvedSpec.master;
  const layoutEngine = new LayoutEngine();

  const validations: ValidationResult[] = [];
  const computedSlides: ComputedSlide[] = [];
  validations.push(...assetResolved.validations);
  for (const warning of templateWarnings) {
    validations.push({
      slideIndex: 0,
      placeholder: warning.placeholder ?? "",
      severity: "info",
      type: "unsupported-feature",
      message: `[template-import:${warning.code}] ${warning.message}`,
    });
  }

  // 1) SlideContent → ComputedSlide 解決
  for (let i = 0; i < resolvedSpec.slides.length; i++) {
    const slide = resolvedSpec.slides[i]!;
    const resolved = resolveSlide(slide, master, i, { template: options.template });
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
  let build: BuildResult;
  if (hasErrors) {
    build = {
      isValid: false,
      validations,
      toPptxFile: async () => {
        throw new Error(
          "Cannot generate PPTX: validation errors exist. Fix all errors before calling toPptxFile().",
        );
      },
      toPdfFile: async () => {
        throw new Error(
          "Cannot generate PDF: validation errors exist. Fix all errors before calling toPdfFile().",
        );
      },
      toHtmlFile: async () => {
        throw new Error(
          "Cannot generate HTML: validation errors exist. Fix all errors before calling toHtmlFile().",
        );
      },
    };
  } else {
    const rendered = await renderToPptx(
      master,
      computedSlides,
      validations,
      aspectRatio,
      options.renderer,
      options.template,
    );
    build = rendered.build;
    templateWarnings.push(...rendered.templateWarnings);
  }

  return {
    spec: resolvedSpec,
    master,
    computedSlides,
    validations,
    quality,
    build,
    mermaidAssets: assetResolved.mermaidAssets,
    templateWarnings,
  };
}

async function renderToPptx(
  master: SlideMaster,
  computedSlides: ComputedSlide[],
  validations: ValidationResult[],
  aspectRatio: AspectRatio,
  renderer?: Renderer,
  template?: ImportedTemplate,
): Promise<{ build: BuildResult; templateWarnings: TemplateImportWarning[] }> {
  const r =
    renderer ??
    (template
      ? new TemplateInheritanceRenderer(template, aspectRatio)
      : new PptxRenderer(aspectRatio));
  r.reset?.(aspectRatio);
  r.setMaster(master);
  r.renderSlides(computedSlides);
  const pptxBuffer = await r.toBuffer();
  const templateWarnings = r instanceof TemplateInheritanceRenderer ? r.getWarnings() : [];

  return {
    build: {
      isValid: true,
      validations,
      pptxBuffer,
      toPptxFile: async (path: string) => {
        await r.toFile(path);
      },
      toPdfFile: async (path: string) => {
        const { HtmlRenderer } = await import("../renderer/html/html-renderer.ts");
        const { PdfExporter } = await import("../renderer/pdf/pdf-exporter.ts");
        const htmlRenderer = new HtmlRenderer(aspectRatio);
        htmlRenderer.setMaster(master);
        htmlRenderer.renderSlides(computedSlides);
        const html = htmlRenderer.toHtmlString();
        const pdfExporter = new PdfExporter();
        try {
          const pdfBuffer = await pdfExporter.export(html, aspectRatio);
          await Bun.write(path, pdfBuffer);
        } finally {
          await pdfExporter.dispose();
        }
      },
      toHtmlFile: async (path: string) => {
        const { HtmlRenderer } = await import("../renderer/html/html-renderer.ts");
        const htmlRenderer = new HtmlRenderer(aspectRatio);
        htmlRenderer.setMaster(master);
        htmlRenderer.renderSlides(computedSlides);
        const html = htmlRenderer.toHtmlString();
        await Bun.write(path, html);
      },
    },
    templateWarnings,
  };
}
