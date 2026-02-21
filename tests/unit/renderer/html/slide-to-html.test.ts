import { describe, expect, test } from "bun:test";
import { getSlideDimensions, slideToHtml } from "../../../../src/renderer/html/slide-to-html.ts";
import type { ComputedSlide } from "../../../../src/types/layout.ts";

describe("getSlideDimensions", () => {
  test("16:9 の寸法", () => {
    const dim = getSlideDimensions("16:9");
    expect(dim.width).toBe(13.33);
    expect(dim.height).toBe(7.5);
  });

  test("4:3 の寸法", () => {
    const dim = getSlideDimensions("4:3");
    expect(dim.width).toBe(10);
    expect(dim.height).toBe(7.5);
  });
});

describe("slideToHtml", () => {
  test("基本的なスライドを HTML に変換", () => {
    const slide: ComputedSlide = {
      index: 0,
      layoutName: "title-slide",
      elements: [
        {
          placeholder: { name: "title", type: "title", x: 1, y: 2, width: 10, height: 1.5 },
          value: "Test Title",
          resolvedStyle: {
            fontSize: 44,
            fontFace: "Arial",
            color: "#333",
            bold: true,
            align: "center",
            valign: "middle",
          },
          computedFontSize: 44,
        },
      ],
      background: { type: "solid", color: "#FFFFFF" },
    };

    const html = slideToHtml(slide, "16:9");

    expect(html).toContain('class="gm-slide"');
    expect(html).toContain('data-layout="title-slide"');
    expect(html).toContain('data-index="0"');
    expect(html).toContain("width:13.33in");
    expect(html).toContain("height:7.5in");
    expect(html).toContain("background:#FFFFFF");
    expect(html).toContain("Test Title");
    expect(html).toContain("page-break-after:always");
  });

  test("固定要素 (rect) を含むスライド", () => {
    const slide: ComputedSlide = {
      index: 0,
      layoutName: "test",
      elements: [],
      fixedElements: [
        { type: "rect", x: 0, y: 0, width: 0.4, height: 7.5, color: "#1a73e8" },
      ],
    };

    const html = slideToHtml(slide, "16:9");
    expect(html).toContain('class="gm-fixed gm-rect"');
    expect(html).toContain("background:#1a73e8");
    expect(html).toContain("left:0in");
    expect(html).toContain("width:0.4in");
  });

  test("固定要素 (水平線) を含むスライド", () => {
    const slide: ComputedSlide = {
      index: 0,
      layoutName: "test",
      elements: [],
      fixedElements: [
        { type: "line", x: 0.75, y: 1.3, width: 11.83, height: 0, color: "#CCCCCC", lineWidth: 1 },
      ],
    };

    const html = slideToHtml(slide, "16:9");
    expect(html).toContain('class="gm-fixed gm-line"');
    expect(html).toContain("border-top:1pt solid #CCCCCC");
  });

  test("画像背景のスライド", () => {
    const slide: ComputedSlide = {
      index: 0,
      layoutName: "test",
      elements: [],
      background: { type: "image", path: "/img/bg.jpg" },
    };

    const html = slideToHtml(slide, "16:9");
    expect(html).toContain("url('/img/bg.jpg')");
    expect(html).toContain("center/cover");
  });

  test("グラデーション背景のスライド", () => {
    const slide: ComputedSlide = {
      index: 0,
      layoutName: "test",
      elements: [],
      background: {
        type: "gradient",
        colors: ["#000", "#fff"],
        direction: "diagonal",
      },
    };

    const html = slideToHtml(slide, "16:9");
    expect(html).toContain("linear-gradient(135deg,#000,#fff)");
  });

  test("背景未指定時はデフォルト白", () => {
    const slide: ComputedSlide = {
      index: 0,
      layoutName: "test",
      elements: [],
    };

    const html = slideToHtml(slide, "16:9");
    expect(html).toContain("background:#FFFFFF");
  });
});
