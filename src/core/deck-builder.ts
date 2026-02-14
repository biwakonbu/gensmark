import { LayoutEngine } from "../layout/layout-engine.ts";
import type { Renderer } from "../renderer/renderer.ts";
import type { SlideContent } from "../types/content.ts";
import type { ComputedSlide } from "../types/layout.ts";
import type { AspectRatio, SlideMaster } from "../types/master.ts";
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
}

/** DeckBuilder: スライドを蓄積し、ビルド時にバリデーション + レンダリングを実行 */
export class DeckBuilder {
  private master: SlideMaster;
  private slides: SlideContent[] = [];
  private layoutEngine: LayoutEngine;
  private rendererInstance: Renderer | undefined;
  readonly aspectRatio: AspectRatio;

  constructor(options: DeckBuilderOptions) {
    this.master = options.master;
    this.rendererInstance = options.renderer;
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
    const allValidations: ValidationResult[] = [];
    const computedSlides = this.resolveSlides(allValidations);

    // レイアウトエンジンでオーバーフロー検知
    for (const computed of computedSlides) {
      const layoutValidations = await this.layoutEngine.validateSlide(computed, this.master);
      allValidations.push(...layoutValidations);
    }

    return allValidations;
  }

  /** ビルド (バリデーション + レンダリング) */
  async build(): Promise<BuildResult> {
    const allValidations: ValidationResult[] = [];
    const computedSlides = this.resolveSlides(allValidations);

    // レイアウトエンジンでオーバーフロー検知
    for (const computed of computedSlides) {
      const layoutValidations = await this.layoutEngine.validateSlide(computed, this.master);
      allValidations.push(...layoutValidations);
    }

    const hasErrors = allValidations.some((v) => v.severity === "error");

    // レンダラーでレンダリング
    const renderer = await this.getRenderer();
    renderer.setMaster(this.master);
    renderer.renderSlides(computedSlides);

    return {
      isValid: !hasErrors,
      validations: allValidations,
      pptxBuffer: undefined, // toPptxFile 呼び出し時に生成
      toPptxFile: async (path: string) => {
        await renderer.toFile(path);
      },
    };
  }

  /** スライドの解決 */
  private resolveSlides(validations: ValidationResult[]): ComputedSlide[] {
    const computed: ComputedSlide[] = [];

    for (let i = 0; i < this.slides.length; i++) {
      const content = this.slides[i]!;
      const result = resolveSlide(content, this.master, i);
      validations.push(...result.validations);
      computed.push(result.computed);
    }

    return computed;
  }

  /** レンダラーの取得 (遅延ロード) */
  private async getRenderer(): Promise<Renderer> {
    if (this.rendererInstance) return this.rendererInstance;

    // PptxRenderer を遅延ロード
    const { PptxRenderer } = await import("../renderer/pptx/pptx-renderer.ts");
    this.rendererInstance = new PptxRenderer(this.aspectRatio);
    return this.rendererInstance;
  }
}
