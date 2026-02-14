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
  private userRenderer: Renderer | undefined;
  private autoRenderer: Renderer | undefined;
  readonly aspectRatio: AspectRatio;

  constructor(options: DeckBuilderOptions) {
    this.master = options.master;
    this.userRenderer = options.renderer;
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

    // エラーがある場合はレンダリングをスキップ
    if (hasErrors) {
      return {
        isValid: false,
        validations: allValidations,
        toPptxFile: async () => {
          throw new Error(
            "Cannot generate PPTX: validation errors exist. Fix all errors before calling toPptxFile().",
          );
        },
      };
    }

    // レンダラーでレンダリング
    const renderer = await this.getRenderer();
    renderer.setMaster(this.master);
    renderer.renderSlides(computedSlides);

    // バッファを生成
    const pptxBuffer = await renderer.toBuffer();

    return {
      isValid: true,
      validations: allValidations,
      pptxBuffer,
      toPptxFile: async (path: string) => {
        await renderer.toFile(path);
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
      const result = resolveSlide(content, this.master, i);
      validations.push(...result.validations);
      computed.push(result.computed);
    }

    return computed;
  }

  /** レンダラーの取得 (遅延ロード) */
  private async getRenderer(): Promise<Renderer> {
    // ユーザー提供レンダラーがあればそれを使う
    if (this.userRenderer) return this.userRenderer;

    // 自動生成レンダラーは毎回新しいインスタンスを作成 (複数回 build() で重複スライドを防止)
    const { PptxRenderer } = await import("../renderer/pptx/pptx-renderer.ts");
    this.autoRenderer = new PptxRenderer(this.aspectRatio);
    return this.autoRenderer;
  }
}
