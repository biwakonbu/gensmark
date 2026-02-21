import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PptxGenJS from "pptxgenjs";

export interface TemplateFixture {
  dir: string;
  path: string;
  cleanup: () => Promise<void>;
}

/** テスト用のテンプレート .pptx を生成 */
export async function createTemplateFixture(): Promise<TemplateFixture> {
  const dir = await mkdtemp(join(tmpdir(), "gensmark-template-"));
  const path = join(dir, "template.pptx");

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.theme = {
    headFontFace: "Arial",
    bodyFontFace: "Arial",
  };

  pptx.defineSlideMaster({
    title: "corp_title",
    background: { color: "0B2F59" },
    objects: [
      {
        placeholder: {
          options: { name: "title", type: "title", x: 0.7, y: 1.8, w: 12, h: 1.1 },
        },
      },
      {
        placeholder: {
          options: { name: "subtitle", type: "subTitle", x: 0.7, y: 3.1, w: 12, h: 0.8 },
        },
      },
    ],
  });

  pptx.defineSlideMaster({
    title: "corp_content",
    objects: [
      {
        rect: { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: "0B2F59" } },
      },
      {
        placeholder: {
          options: { name: "title", type: "title", x: 0.7, y: 0.5, w: 12, h: 0.9 },
        },
      },
      {
        placeholder: {
          options: { name: "body", type: "body", x: 0.7, y: 1.6, w: 12, h: 5.3 },
        },
      },
    ],
  });

  // 既存テンプレスライド (出力時は除外対象)
  const s1 = pptx.addSlide({ masterName: "corp_title" });
  s1.addText("Template Title", { placeholder: "title" });
  s1.addText("Template Subtitle", { placeholder: "subtitle" });
  const s2 = pptx.addSlide({ masterName: "corp_content" });
  s2.addText("Template Content", { placeholder: "title" });
  s2.addText("Do not keep this slide", { placeholder: "body" });

  await pptx.writeFile({ fileName: path });

  return {
    dir,
    path,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}
