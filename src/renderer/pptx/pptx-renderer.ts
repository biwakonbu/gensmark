import PptxGenJS from "pptxgenjs";
import type { ComputedSlide } from "../../types/layout.ts";
import type { AspectRatio, BackgroundDef, FixedElement, SlideMaster } from "../../types/master.ts";
import type { Renderer } from "../renderer.ts";
import { addTextElement } from "./pptx-element-mapper.ts";
import { normalizeColor } from "./utils.ts";

// pptxgenjs ベースの PPTX レンダラー

/** アスペクト比 → pptxgenjs レイアウト名のマッピング */
const ASPECT_RATIO_LAYOUT: Record<AspectRatio, string> = {
  "16:9": "LAYOUT_16x9",
  "4:3": "LAYOUT_4x3",
};

/** PptxRenderer: ComputedSlide[] を PPTX に変換 */
export class PptxRenderer implements Renderer {
  private pptx: PptxGenJS;

  constructor(aspectRatio: AspectRatio = "16:9") {
    this.pptx = new PptxGenJS();
    this.pptx.layout = ASPECT_RATIO_LAYOUT[aspectRatio] ?? "LAYOUT_16x9";
  }

  /** スライドマスターを設定 */
  setMaster(master: SlideMaster): void {
    // テーマフォントを設定
    this.pptx.theme = {
      headFontFace: master.theme.fonts.heading,
      bodyFontFace: master.theme.fonts.body,
    };

    // レイアウトごとにスライドマスターを定義
    for (const [layoutName, layout] of Object.entries(master.layouts)) {
      const masterName = `${master.name}_${layoutName}`;

      const objects: PptxGenJS.SlideMasterProps["objects"] = [];

      // 固定要素
      if (layout.fixedElements) {
        for (const el of layout.fixedElements) {
          this.addFixedElement(objects, el);
        }
      }

      const masterProps: PptxGenJS.SlideMasterProps = {
        title: masterName,
        background: layout.background
          ? this.convertBackground(layout.background)
          : { color: normalizeColor(master.theme.colors.background) },
        objects,
      };

      this.pptx.defineSlideMaster(masterProps);
    }
  }

  /** 計算済みスライドをレンダリング */
  renderSlides(slides: ComputedSlide[]): void {
    for (const computed of slides) {
      this.renderSlide(computed);
    }
  }

  /** 1スライドをレンダリング */
  private renderSlide(computed: ComputedSlide): void {
    const slide = this.pptx.addSlide({
      masterName: undefined, // マスター名はスライドごとに自動適用しない (背景は手動で)
    });

    // 背景設定
    if (computed.background) {
      slide.background = this.convertBackground(computed.background);
    }

    // 固定要素
    if (computed.fixedElements) {
      for (const el of computed.fixedElements) {
        this.renderFixedElement(slide, el);
      }
    }

    // 各要素をレンダリング
    for (const element of computed.elements) {
      addTextElement(slide, element);
    }

    // スライドメモ
    if (computed.notes) {
      slide.addNotes(computed.notes);
    }
  }

  /** 背景を pptxgenjs の形式に変換 */
  private convertBackground(bg: BackgroundDef): PptxGenJS.BackgroundProps {
    switch (bg.type) {
      case "solid":
        return { color: normalizeColor(bg.color) };
      case "image":
        return { path: bg.path };
      case "gradient":
        // pptxgenjs v4 はグラデーション背景の標準サポートが限定的
        // 最初の色をフォールバックとして使用し、警告を出力
        console.warn(
          `[gensmark] Gradient background is not fully supported by pptxgenjs. Falling back to solid color: ${bg.colors[0] ?? "#ffffff"}`,
        );
        return { color: normalizeColor(bg.colors[0] ?? "#ffffff") };
    }
  }

  /** 固定要素をマスターオブジェクトに追加 */
  private addFixedElement(
    objects: NonNullable<PptxGenJS.SlideMasterProps["objects"]>,
    el: FixedElement,
  ): void {
    switch (el.type) {
      case "image":
        if (el.path) {
          objects.push({
            image: { path: el.path, x: el.x, y: el.y, w: el.width, h: el.height },
          });
        }
        break;
      case "rect":
        objects.push({
          rect: {
            x: el.x,
            y: el.y,
            w: el.width,
            h: el.height,
            fill: { color: normalizeColor(el.color ?? "#000000") },
          },
        });
        break;
      case "line":
        objects.push({
          line: {
            x: el.x,
            y: el.y,
            w: el.width,
            h: el.height,
            line: {
              color: normalizeColor(el.color ?? "#000000"),
              width: el.lineWidth ?? 1,
            },
          },
        });
        break;
    }
  }

  /** 固定要素をスライドに直接追加 */
  private renderFixedElement(slide: PptxGenJS.Slide, el: FixedElement): void {
    switch (el.type) {
      case "image":
        if (el.path) {
          slide.addImage({ path: el.path, x: el.x, y: el.y, w: el.width, h: el.height });
        }
        break;
      case "rect":
        slide.addShape("rect", {
          x: el.x,
          y: el.y,
          w: el.width,
          h: el.height,
          fill: { color: normalizeColor(el.color ?? "#000000") },
        });
        break;
      case "line":
        slide.addShape("line", {
          x: el.x,
          y: el.y,
          w: el.width,
          h: el.height,
          line: {
            color: normalizeColor(el.color ?? "#000000"),
            width: el.lineWidth ?? 1,
          },
        });
        break;
    }
  }

  /** 内部状態をリセット (新しい pptxgenjs インスタンスを作成) */
  reset(aspectRatio?: AspectRatio): void {
    const layout = aspectRatio ? ASPECT_RATIO_LAYOUT[aspectRatio] : this.pptx.layout;
    this.pptx = new PptxGenJS();
    this.pptx.layout = layout ?? "LAYOUT_16x9";
  }

  /** リソースを解放 */
  dispose(): void {
    // pptxgenjs に明示的な破棄は不要だが、参照をクリア
    this.pptx = new PptxGenJS();
  }

  /** バイナリ出力を生成 */
  async toBuffer(): Promise<ArrayBuffer> {
    const result = await this.pptx.write({ outputType: "arraybuffer" });
    return result as ArrayBuffer;
  }

  /** ファイルとして保存 */
  async toFile(path: string): Promise<void> {
    await this.pptx.writeFile({ fileName: path });
  }
}
