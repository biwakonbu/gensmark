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

const SLIDE_DIMENSIONS: Record<AspectRatio, { w: number; h: number }> = {
  "16:9": { w: 13.33, h: 7.5 },
  "4:3": { w: 10, h: 7.5 },
};

/** PptxRenderer: ComputedSlide[] を PPTX に変換 */
export class PptxRenderer implements Renderer {
  private pptx: PptxGenJS;
  private master?: SlideMaster;
  private aspectRatio: AspectRatio;

  constructor(aspectRatio: AspectRatio = "16:9") {
    this.pptx = new PptxGenJS();
    this.aspectRatio = aspectRatio;
    this.pptx.layout = ASPECT_RATIO_LAYOUT[this.aspectRatio] ?? "LAYOUT_16x9";
  }

  /** スライドマスターを設定 */
  setMaster(master: SlideMaster): void {
    this.master = master;
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
    const masterName = this.getMasterName(computed.layoutName);
    const slide = this.pptx.addSlide({
      masterName,
    });

    // 背景設定
    if (computed.background) {
      slide.background = this.convertBackground(computed.background);
    }

    // 固定要素
    if (computed.fixedElements) {
      const masterFixedKeys = new Set(
        (this.master?.layouts[computed.layoutName]?.fixedElements ?? []).map((el) =>
          this.fixedElementKey(el),
        ),
      );
      for (const el of computed.fixedElements) {
        // 既にスライドマスター側で描画される固定要素は二重描画しない
        if (!masterFixedKeys.has(this.fixedElementKey(el))) {
          this.renderFixedElement(slide, el);
        }
      }
    }

    // 各要素をレンダリング
    for (const element of computed.elements) {
      addTextElement(slide, element);
    }

    // ページ番号 (title-slide, section-header, end-slide 以外)
    if (!["title-slide", "section-header", "end-slide"].includes(computed.layoutName)) {
      const textColor = this.master?.theme.colors.text ?? "#666666";
      const dims = SLIDE_DIMENSIONS[this.aspectRatio] ?? SLIDE_DIMENSIONS["16:9"];
      slide.slideNumber = {
        // % 指定 + 右寄せで、4:3/16:9 両対応でスライド外にはみ出しにくくする
        x: "88%",
        y: "94%",
        w: "10%",
        h: Math.min(0.3, dims.h * 0.04),
        fontSize: 9,
        color: normalizeColor(textColor),
        align: "right",
      };
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

  /** レイアウト名からスライドマスター名を解決 */
  private getMasterName(layoutName: string): string | undefined {
    if (!this.master) return undefined;
    if (!this.master.layouts[layoutName]) return undefined;
    return `${this.master.name}_${layoutName}`;
  }

  private fixedElementKey(el: FixedElement): string {
    // FixedElement はプレーンオブジェクトの想定。キー順の揺れを避けて簡易正規化する。
    // 浮動小数点の精度問題を回避するため、座標値を小数第3位で丸める
    const r = (n: number) => Math.round(n * 1000) / 1000;
    const base = {
      type: el.type,
      x: r(el.x),
      y: r(el.y),
      width: r(el.width),
      height: r(el.height),
      path: el.path ?? "",
      color: el.color ?? "",
      lineWidth: el.lineWidth ?? 0,
    };
    return JSON.stringify(base);
  }

  /** 内部状態をリセット (新しい pptxgenjs インスタンスを作成) */
  reset(aspectRatio?: AspectRatio): void {
    const nextAspectRatio = aspectRatio ?? this.aspectRatio;
    this.aspectRatio = nextAspectRatio;
    const layout = ASPECT_RATIO_LAYOUT[nextAspectRatio] ?? this.pptx.layout;
    this.pptx = new PptxGenJS();
    this.pptx.layout = layout ?? "LAYOUT_16x9";
    // マスター定義を新しいインスタンスに再適用
    if (this.master) {
      this.setMaster(this.master);
    }
  }

  /** リソースを解放 */
  dispose(): void {
    // pptxgenjs に明示的な破棄は不要だが、参照をクリア
    this.pptx = new PptxGenJS();
    this.master = undefined;
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
