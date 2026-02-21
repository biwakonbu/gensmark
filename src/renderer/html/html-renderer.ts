import type { Renderer } from "../renderer.ts";
import type { ComputedSlide } from "../../types/layout.ts";
import type { AspectRatio, SlideMaster } from "../../types/master.ts";
import type { PlaceholderValue } from "../../types/content.ts";
import { slideToHtml, getSlideDimensions } from "./slide-to-html.ts";
import { themeToCss } from "./theme-to-css.ts";
import { wrapHtml } from "./html-template.ts";

// HTML レンダラー (Renderer インターフェース実装)

/** HTML レンダラー: ComputedSlide[] を self-contained HTML に変換 */
export class HtmlRenderer implements Renderer {
  private master: SlideMaster | null = null;
  private slides: ComputedSlide[] = [];
  private aspectRatio: AspectRatio;
  private htmlCache: string | null = null;

  constructor(aspectRatio: AspectRatio = "16:9") {
    this.aspectRatio = aspectRatio;
  }

  setMaster(master: SlideMaster): void {
    this.master = master;
    this.htmlCache = null;
  }

  renderSlides(slides: ComputedSlide[]): void {
    this.slides = slides;
    this.htmlCache = null;
  }

  /** HTML 文字列を生成 (内部キャッシュ付き) */
  toHtmlString(): string {
    if (this.htmlCache) return this.htmlCache;
    if (!this.master) throw new Error("HtmlRenderer: setMaster() must be called before rendering");

    const { width, height } = getSlideDimensions(this.aspectRatio);
    const themeCSS = themeToCss(this.master.theme);
    const hasMermaid = this.slides.some((s) =>
      s.elements.some((e) => {
        const v = e.value;
        return typeof v !== "string" && v.type === "mermaid";
      }),
    );

    const slidesHtml = this.slides.map((s) => slideToHtml(s, this.aspectRatio)).join("\n");

    this.htmlCache = wrapHtml({
      themeCSS,
      slidesHtml,
      slideWidth: width,
      slideHeight: height,
      title: this.master.name,
      mermaidEnabled: hasMermaid,
    });

    return this.htmlCache;
  }

  /** Renderer インターフェース: HTML を UTF-8 ArrayBuffer として返す */
  async toBuffer(): Promise<ArrayBuffer> {
    const html = this.toHtmlString();
    return new TextEncoder().encode(html).buffer as ArrayBuffer;
  }

  /** Renderer インターフェース: HTML ファイルとして保存 */
  async toFile(path: string): Promise<void> {
    const html = this.toHtmlString();
    await Bun.write(path, html);
  }

  dispose(): void {
    this.htmlCache = null;
    this.slides = [];
  }

  reset(aspectRatio?: AspectRatio): void {
    this.aspectRatio = aspectRatio ?? this.aspectRatio;
    this.slides = [];
    this.htmlCache = null;
  }
}
