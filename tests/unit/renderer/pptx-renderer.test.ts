import { describe, expect, test } from "bun:test";
import { PptxRenderer } from "../../../src/renderer/pptx/pptx-renderer.ts";
import type { ComputedElement, ComputedSlide } from "../../../src/types/layout.ts";
import type { SlideMaster } from "../../../src/types/master.ts";
import type { Theme } from "../../../src/types/theme.ts";

const testTheme: Theme = {
  name: "test-theme",
  colors: {
    primary: "#1a73e8",
    secondary: "#ea4335",
    background: "#ffffff",
    text: "#333333",
  },
  fonts: { heading: "Arial", body: "Arial" },
};

const testMaster: SlideMaster = {
  name: "test-master",
  theme: testTheme,
  layouts: {
    "title-slide": {
      placeholders: [
        { name: "title", type: "title", x: 0.75, y: 2.5, width: 11.5, height: 1.5 },
        { name: "subtitle", type: "subtitle", x: 0.75, y: 4.2, width: 11.5, height: 1 },
      ],
      background: { type: "solid", color: "#1a73e8" },
    },
    content: {
      placeholders: [
        { name: "title", type: "title", x: 0.75, y: 0.4, width: 11.5, height: 0.8 },
        { name: "body", type: "body", x: 0.75, y: 1.5, width: 11.5, height: 5.5 },
      ],
    },
  },
};

function makeElement(overrides?: Partial<ComputedElement>): ComputedElement {
  return {
    placeholder: {
      name: "title",
      type: "title",
      x: 0.75,
      y: 0.4,
      width: 11.5,
      height: 0.8,
    },
    value: "Test Title",
    resolvedStyle: {
      fontSize: 32,
      fontFace: "Arial",
      color: "#333333",
      bold: true,
      align: "left",
      valign: "middle",
    },
    computedFontSize: 32,
    ...overrides,
  };
}

describe("PptxRenderer", () => {
  test("レンダラーを作成できる", () => {
    const renderer = new PptxRenderer("16:9");
    expect(renderer).toBeDefined();
  });

  test("マスターを設定できる", () => {
    const renderer = new PptxRenderer();
    // 例外が起きないことを確認
    renderer.setMaster(testMaster);
  });

  test("テキスト要素を含むスライドをレンダリングできる", () => {
    const renderer = new PptxRenderer();
    renderer.setMaster(testMaster);

    const slides: ComputedSlide[] = [
      {
        index: 0,
        layoutName: "title-slide",
        elements: [
          makeElement({ value: "Hello World" }),
          makeElement({
            placeholder: {
              name: "subtitle",
              type: "subtitle",
              x: 0.75,
              y: 4.2,
              width: 11.5,
              height: 1,
            },
            value: "Subtitle here",
            computedFontSize: 20,
          }),
        ],
        background: { type: "solid", color: "#1a73e8" },
      },
    ];

    // 例外が起きないことを確認
    renderer.renderSlides(slides);
  });

  test("箇条書きスライドをレンダリングできる", () => {
    const renderer = new PptxRenderer();
    renderer.setMaster(testMaster);

    const slides: ComputedSlide[] = [
      {
        index: 0,
        layoutName: "content",
        elements: [
          makeElement({ value: "Bullet Slide" }),
          makeElement({
            placeholder: {
              name: "body",
              type: "body",
              x: 0.75,
              y: 1.5,
              width: 11.5,
              height: 5.5,
            },
            value: {
              type: "bullet",
              items: [{ text: "Item 1" }, { text: "Item 2", children: [{ text: "Sub item" }] }],
            },
            computedFontSize: 18,
          }),
        ],
      },
    ];

    renderer.renderSlides(slides);
  });

  test("テーブルスライドをレンダリングできる", () => {
    const renderer = new PptxRenderer();
    renderer.setMaster(testMaster);

    const slides: ComputedSlide[] = [
      {
        index: 0,
        layoutName: "content",
        elements: [
          makeElement({
            placeholder: {
              name: "body",
              type: "body",
              x: 0.75,
              y: 1.5,
              width: 11.5,
              height: 5.5,
            },
            value: {
              type: "table",
              headers: ["Name", "Value"],
              rows: [
                ["Row 1", "100"],
                ["Row 2", "200"],
              ],
            },
            computedFontSize: 16,
          }),
        ],
      },
    ];

    renderer.renderSlides(slides);
  });

  test("コードスライドをレンダリングできる", () => {
    const renderer = new PptxRenderer();
    renderer.setMaster(testMaster);

    const slides: ComputedSlide[] = [
      {
        index: 0,
        layoutName: "content",
        elements: [
          makeElement({
            placeholder: {
              name: "body",
              type: "body",
              x: 0.75,
              y: 1.5,
              width: 11.5,
              height: 5.5,
            },
            value: {
              type: "code",
              code: "const x = 1;\nconsole.log(x);",
              language: "typescript",
            },
            computedFontSize: 14,
          }),
        ],
      },
    ];

    renderer.renderSlides(slides);
  });

  test("PPTX バッファを生成できる", async () => {
    const renderer = new PptxRenderer();
    renderer.setMaster(testMaster);
    renderer.renderSlides([
      {
        index: 0,
        layoutName: "title-slide",
        elements: [makeElement({ value: "Buffer Test" })],
      },
    ]);

    const buffer = await renderer.toBuffer();
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  test("スライドメモをレンダリングできる", () => {
    const renderer = new PptxRenderer();
    renderer.setMaster(testMaster);

    const slides: ComputedSlide[] = [
      {
        index: 0,
        layoutName: "title-slide",
        elements: [makeElement()],
        notes: "These are speaker notes",
      },
    ];

    renderer.renderSlides(slides);
  });

  test("固定要素 (rect) をレンダリングできる", () => {
    const renderer = new PptxRenderer();
    renderer.setMaster(testMaster);

    const slides: ComputedSlide[] = [
      {
        index: 0,
        layoutName: "content",
        elements: [makeElement()],
        fixedElements: [{ type: "rect", x: 0, y: 7, width: 13.33, height: 0.05, color: "#1a73e8" }],
      },
    ];

    renderer.renderSlides(slides);
  });

  test("4:3 アスペクト比で作成できる", () => {
    const renderer = new PptxRenderer("4:3");
    renderer.setMaster(testMaster);
    renderer.renderSlides([
      {
        index: 0,
        layoutName: "title-slide",
        elements: [makeElement()],
      },
    ]);
  });
});
