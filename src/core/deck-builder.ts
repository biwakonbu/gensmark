import { LayoutEngine } from "../layout/layout-engine.ts";
import { TemplateInheritanceRenderer } from "../renderer/pptx/template-inheritance-renderer.ts";
import type { Renderer } from "../renderer/renderer.ts";
import type { SlideContent } from "../types/content.ts";
import type { ComputedSlide } from "../types/layout.ts";
import type { AspectRatio, SlideMaster } from "../types/master.ts";
import type { ImportedTemplate } from "../types/template.ts";
import type { BuildResult, ValidationResult } from "../types/validation.ts";
import { resolveSlide } from "./slide-resolver.ts";

// デッキビルダー

/** DeckBuilder オプション */
export interface DeckBuilderOptions {
  /** スライドマスター */
  master: SlideMaster;
  /** レンダラー (未指定時は PptxRenderer を使用) */
  renderer?: Renderer;
  /** アスペクト比 (デフォルト: マスターの設定 or '16:9') */
  aspectRatio?: AspectRatio;
  /** 取り込み済みテンプレート */
  template?: ImportedTemplate;
}

/** DeckBuilder: スライドを蓄積し、ビルド時にバリデーション + レンダリングを実行 */
export class DeckBuilder {
  private master: SlideMaster;
  private slides: SlideContent[] = [];
  private layoutEngine: LayoutEngine;
  private userRenderer: Renderer | undefined;
  private template: ImportedTemplate | undefined;
  readonly aspectRatio: AspectRatio;

  constructor(options: DeckBuilderOptions) {
    this.master = options.master;
    this.userRenderer = options.renderer;
    this.template = options.template;
    this.aspectRatio = options.aspectRatio ?? options.master.aspectRatio ?? "16:9";
    this.layoutEngine = new LayoutEngine();
  }

  /** スライドを追加 */
  slide(content: SlideContent): this {
    this.slides.push(content);
    return this;
  }

  /** バリデーションのみ実行 */
  async validate(): Promise<ValidationResult[]> {
    const { validations } = await this.resolveAndValidate();
    return validations;
  }

  /** ビルド (バリデーション + レンダリング) */
  async build(): Promise<BuildResult> {
    const { validations: allValidations, computedSlides } = await this.resolveAndValidate();

    const hasErrors = allValidations.some((v) => v.severity === "error");

    const errorResult: BuildResult = {
      isValid: false,
      validations: allValidations,
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

    // エラーがある場合はレンダリングをスキップ
    if (hasErrors) {
      return errorResult;
    }

    // レンダラーでレンダリング
    const renderer = await this.getRenderer();
    renderer.setMaster(this.master);
    renderer.renderSlides(computedSlides);

    // バッファを生成
    const pptxBuffer = await renderer.toBuffer();

    // HTML レンダリング用のデータを保持
    const master = this.master;
    const aspectRatio = this.aspectRatio;

    return {
      isValid: true,
      validations: allValidations,
      pptxBuffer,
      toPptxFile: async (path: string) => {
        await renderer.toFile(path);
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
    };
  }

  /** スライドの解決 + バリデーション (共通処理) */
  private async resolveAndValidate(): Promise<{
    validations: ValidationResult[];
    computedSlides: ComputedSlide[];
  }> {
    const validations: ValidationResult[] = [];
    const computedSlides = this.resolveSlides(validations);

    // レイアウトエンジンでオーバーフロー検知
    for (const computed of computedSlides) {
      const layoutValidations = await this.layoutEngine.validateSlide(computed, this.master);
      validations.push(...layoutValidations);
    }

    return { validations, computedSlides };
  }

  /** スライドの解決 */
  private resolveSlides(validations: ValidationResult[]): ComputedSlide[] {
    const computed: ComputedSlide[] = [];

    for (let i = 0; i < this.slides.length; i++) {
      const content = this.slides[i]!;
      const result = resolveSlide(content, this.master, i, { template: this.template });
      validations.push(...result.validations);
      computed.push(result.computed);
    }

    return computed;
  }

  /** レンダラーの取得 (遅延ロード)
   *  返却後に setMaster() -> renderSlides() の順で呼ばれることを前提とする。
   *  reset() は setMaster() の前に呼ばれ、内部状態をクリアする。 */
  private async getRenderer(): Promise<Renderer> {
    // ユーザー提供レンダラーがあればそれを使う (複数回 build() 対応)
    if (this.userRenderer) {
      this.userRenderer.reset?.(this.aspectRatio);
      return this.userRenderer;
    }

    if (this.template) {
      return new TemplateInheritanceRenderer(this.template, this.aspectRatio);
    }

    // 自動生成レンダラーは毎回新しいインスタンスを作成 (複数回 build() で重複スライドを防止)
    const { PptxRenderer } = await import("../renderer/pptx/pptx-renderer.ts");
    return new PptxRenderer(this.aspectRatio);
  }
}
