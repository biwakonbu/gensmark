import { describe, expect, test } from "bun:test";
import { HtmlRenderer } from "../../../../src/renderer/html/html-renderer.ts";
import type { ComputedSlide } from "../../../../src/types/layout.ts";
import type { SlideMaster } from "../../../../src/types/master.ts";
import type { Theme } from "../../../../src/types/theme.ts";

const testTheme: Theme = {
  name: "test-theme",
  colors: {
    primary: "#1a73e8",
    secondary: "#ea4335",
    background: "#ffffff",
    text: "#333333",
    muted: "#F5F5F5",
  },
  fonts: { heading: "Arial", body: "Arial", mono: "Courier New" },
};

const testMaster: SlideMaster = {
  name: "test-master",
  theme: testTheme,
  layouts: {
    "title-slide": {
      placeholders: [
        { name: "title", type: "title", x: 1.5, y: 2.3, width: 10.83, height: 1.5 },
        { name: "subtitle", type: "subtitle", x: 1.5, y: 4.0, width: 10.83, height: 1 },
      ],
      background: { type: "solid", color: "#FFFFFF" },
      fixedElements: [
        { type: "rect", x: 0, y: 0, width: 0.4, height: 7.5, color: "#1a73e8" },
      ],
    },
    content: {
      placeholders: [
        { name: "title", type: "title", x: 0.75, y: 0.4, width: 11.5, height: 0.8 },
        { name: "body", type: "body", x: 0.75, y: 1.5, width: 11.5, height: 5.5 },
      ],
    },
  },
};

const sampleSlides: ComputedSlide[] = [
  {
    index: 0,
    layoutName: "title-slide",
    elements: [
      {
        placeholder: testMaster.layouts["title-slide"]!.placeholders[0]!,
        value: "Hello World",
        resolvedStyle: {
          fontSize: 44,
          fontFace: "Arial",
          color: "#1a73e8",
          bold: true,
          align: "left",
          valign: "middle",
        },
        computedFontSize: 44,
      },
      {
        placeholder: testMaster.layouts["title-slide"]!.placeholders[1]!,
        value: "Subtitle text",
        resolvedStyle: {
          fontSize: 20,
          fontFace: "Arial",
          color: "#666666",
          bold: false,
          align: "left",
          valign: "middle",
        },
        computedFontSize: 20,
      },
    ],
    background: { type: "solid", color: "#FFFFFF" },
    fixedElements: [
      { type: "rect", x: 0, y: 0, width: 0.4, height: 7.5, color: "#1a73e8" },
    ],
    notes: "Speaker notes for slide 1",
  },
  {
    index: 1,
    layoutName: "content",
    elements: [
      {
        placeholder: testMaster.layouts.content!.placeholders[0]!,
        value: "Content Title",
        resolvedStyle: {
          fontSize: 32,
          fontFace: "Arial",
          color: "#333333",
          bold: true,
          align: "left",
          valign: "middle",
        },
        computedFontSize: 32,
      },
    ],
    background: { type: "solid", color: "#FFFFFF" },
  },
];

describe("HtmlRenderer", () => {
  test("toHtmlString() で self-contained HTML を生成", () => {
    const renderer = new HtmlRenderer("16:9");
    renderer.setMaster(testMaster);
    renderer.renderSlides(sampleSlides);

    const html = renderer.toHtmlString();

    // 基本構造
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");

    // テーマ CSS カスタムプロパティ
    expect(html).toContain("--gm-color-primary: #1a73e8");
    expect(html).toContain("--gm-font-heading: Arial");

    // スライド要素
    expect(html).toContain('class="gm-slide"');
    expect(html).toContain('data-layout="title-slide"');
    expect(html).toContain("Hello World");
    expect(html).toContain("Content Title");

    // 固定要素
    expect(html).toContain('class="gm-fixed gm-rect"');
    expect(html).toContain("background:#1a73e8");

    // スライドサイズ
    expect(html).toContain("13.33in");
    expect(html).toContain("7.5in");
  });

  test("4:3 アスペクト比のスライドサイズ", () => {
    const renderer = new HtmlRenderer("4:3");
    renderer.setMaster(testMaster);
    renderer.renderSlides([sampleSlides[0]!]);

    const html = renderer.toHtmlString();
    expect(html).toContain("10in");
    expect(html).toContain("7.5in");
  });

  test("toBuffer() で ArrayBuffer を返す", async () => {
    const renderer = new HtmlRenderer("16:9");
    renderer.setMaster(testMaster);
    renderer.renderSlides(sampleSlides);

    const buffer = await renderer.toBuffer();
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);

    // UTF-8 でデコードして HTML と一致確認
    const decoded = new TextDecoder().decode(buffer);
    expect(decoded).toBe(renderer.toHtmlString());
  });

  test("toFile() で HTML ファイルを保存", async () => {
    const renderer = new HtmlRenderer("16:9");
    renderer.setMaster(testMaster);
    renderer.renderSlides(sampleSlides);

    const tmpPath = "/tmp/gensmark-test-output.html";
    await renderer.toFile(tmpPath);

    const content = await Bun.file(tmpPath).text();
    expect(content).toContain("<!DOCTYPE html>");
    expect(content).toContain("Hello World");
  });

  test("setMaster() 前に toHtmlString() を呼ぶとエラー", () => {
    const renderer = new HtmlRenderer("16:9");
    expect(() => renderer.toHtmlString()).toThrow("setMaster()");
  });

  test("HTML キャッシュが有効 (2回目の呼び出しは同じ参照)", () => {
    const renderer = new HtmlRenderer("16:9");
    renderer.setMaster(testMaster);
    renderer.renderSlides(sampleSlides);

    const html1 = renderer.toHtmlString();
    const html2 = renderer.toHtmlString();
    // 同一オブジェクト参照
    expect(html1).toBe(html2);
  });

  test("reset() でキャッシュがクリアされる", () => {
    const renderer = new HtmlRenderer("16:9");
    renderer.setMaster(testMaster);
    renderer.renderSlides(sampleSlides);

    renderer.toHtmlString(); // キャッシュ生成
    renderer.reset("4:3");
    renderer.setMaster(testMaster);
    renderer.renderSlides([sampleSlides[0]!]);

    const html = renderer.toHtmlString();
    expect(html).toContain("10in"); // 4:3
    expect(html).not.toContain("13.33in"); // 16:9 ではない
  });

  test("Mermaid コンテンツがある場合 mermaid.js が読み込まれる", () => {
    const slideWithMermaid: ComputedSlide = {
      index: 0,
      layoutName: "content",
      elements: [
        {
          placeholder: testMaster.layouts.content!.placeholders[1]!,
          value: { type: "mermaid", code: "graph LR; A-->B;" },
          resolvedStyle: {
            fontSize: 18,
            fontFace: "Arial",
            color: "#333",
            bold: false,
            align: "left",
            valign: "top",
          },
          computedFontSize: 18,
        },
      ],
    };

    const renderer = new HtmlRenderer("16:9");
    renderer.setMaster(testMaster);
    renderer.renderSlides([slideWithMermaid]);

    const html = renderer.toHtmlString();
    expect(html).toContain("mermaid.min.js");
    expect(html).toContain('class="mermaid"');
  });

  test("Mermaid コンテンツがなければ mermaid.js は読み込まれない", () => {
    const renderer = new HtmlRenderer("16:9");
    renderer.setMaster(testMaster);
    renderer.renderSlides(sampleSlides);

    const html = renderer.toHtmlString();
    expect(html).not.toContain("mermaid.min.js");
  });

  test("グラデーション背景が CSS linear-gradient に変換される", () => {
    const slideWithGradient: ComputedSlide = {
      index: 0,
      layoutName: "title-slide",
      elements: [],
      background: {
        type: "gradient",
        colors: ["#FF0000", "#0000FF"],
        direction: "horizontal",
      },
    };

    const renderer = new HtmlRenderer("16:9");
    renderer.setMaster(testMaster);
    renderer.renderSlides([slideWithGradient]);

    const html = renderer.toHtmlString();
    expect(html).toContain("linear-gradient(to right,#FF0000,#0000FF)");
  });

  test("印刷用 CSS が含まれる", () => {
    const renderer = new HtmlRenderer("16:9");
    renderer.setMaster(testMaster);
    renderer.renderSlides(sampleSlides);

    const html = renderer.toHtmlString();
    expect(html).toContain("@media print");
    expect(html).toContain("page-break-after: always");
  });
});
