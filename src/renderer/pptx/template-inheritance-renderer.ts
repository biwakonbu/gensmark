import { writeFile } from "node:fs/promises";
import type { ComputedSlide } from "../../types/layout.ts";
import type { AspectRatio, SlideMaster } from "../../types/master.ts";
import type { ImportedTemplate, TemplateImportWarning } from "../../types/template.ts";
import type { Renderer } from "../renderer.ts";
import { composeTemplatePptx } from "./ooxml-writer.ts";
import { PptxRenderer } from "./pptx-renderer.ts";

/** テンプレート継承レンダラー */
export class TemplateInheritanceRenderer implements Renderer {
  private template: ImportedTemplate;
  private master?: SlideMaster;
  private slides: ComputedSlide[] = [];
  private aspectRatio: AspectRatio;
  private warnings: TemplateImportWarning[] = [];

  constructor(template: ImportedTemplate, aspectRatio: AspectRatio = "16:9") {
    this.template = template;
    this.aspectRatio = aspectRatio;
  }

  setMaster(master: SlideMaster): void {
    this.master = master;
  }

  renderSlides(slides: ComputedSlide[]): void {
    this.slides = slides;
  }

  async toBuffer(): Promise<ArrayBuffer> {
    if (!this.master) {
      throw new Error("TemplateInheritanceRenderer: master is not set");
    }

    const baseRenderer = new PptxRenderer(this.aspectRatio);
    baseRenderer.setMaster(this.master);
    baseRenderer.renderSlides(this.slides);
    const renderedPptx = await baseRenderer.toBuffer();

    const merged = await composeTemplatePptx({
      template: this.template,
      renderedPptx,
      computedSlides: this.slides,
      master: this.master,
    });
    this.warnings = merged.warnings;
    return merged.buffer;
  }

  async toFile(path: string): Promise<void> {
    const buffer = await this.toBuffer();
    await writeFile(path, Buffer.from(buffer));
  }

  reset(aspectRatio?: AspectRatio): void {
    if (aspectRatio) {
      this.aspectRatio = aspectRatio;
    }
    this.slides = [];
    this.warnings = [];
  }

  dispose(): void {
    this.slides = [];
    this.master = undefined;
  }

  getWarnings(): TemplateImportWarning[] {
    return [...this.warnings];
  }
}
