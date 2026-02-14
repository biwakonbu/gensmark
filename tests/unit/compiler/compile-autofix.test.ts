import { describe, expect, test } from "bun:test";
import { autofixDeck } from "../../../src/compiler/autofix.ts";
import { compileDeck } from "../../../src/compiler/compile.ts";
import { ph } from "../../../src/master/master-builder.ts";
import type { DeckSpec } from "../../../src/types/spec.ts";
import { TEST_FONT_BOLD_PATH, TEST_FONT_PATH } from "../../helpers/font-path.ts";

describe("compiler: compileDeck/autofixDeck", () => {
  test("strict では overflow warning を品質ゲートで失敗扱いにする (PPTX は生成できる)", async () => {
    const spec: DeckSpec = {
      master: {
        name: "m",
        aspectRatio: "16:9",
        theme: {
          name: "t",
          colors: {
            primary: "#000000",
            secondary: "#666666",
            background: "#ffffff",
            text: "#111111",
            muted: "#f0f0f0",
          },
          fonts: {
            heading: "TestHeading",
            body: "TestBody",
            mono: "TestMono",
          },
          fontPaths: {
            heading: TEST_FONT_PATH,
            headingBold: TEST_FONT_BOLD_PATH,
            body: TEST_FONT_PATH,
            bodyBold: TEST_FONT_BOLD_PATH,
            mono: TEST_FONT_PATH,
          },
        },
        layouts: {
          content: {
            placeholders: [
              ph.body({
                height: 1.2,
                constraints: { overflow: "shrink", minFontSize: 10 },
                style: { fontSize: 18, lineSpacing: 1.2 },
              }),
            ],
          },
        },
      },
      slides: [
        {
          layout: "content",
          data: {
            // 5行で高さオーバーフロー → shrink で収まる想定
            body: ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"].join("\n"),
          },
        },
      ],
    };

    const result = await compileDeck(spec, {
      profile: "strict",
      // このテストでは overflow warning のゲートのみ検証したいので、最小フォントは緩める
      thresholds: { bodyMinPt: 8 },
    });

    expect(result.build.isValid).toBe(true);
    expect(result.build.pptxBuffer).toBeInstanceOf(ArrayBuffer);

    const overflowWarnings = result.validations.filter(
      (v) => v.type === "overflow" && v.severity === "warning",
    );
    expect(overflowWarnings.length).toBeGreaterThan(0);
    expect(result.quality.isPassing).toBe(false);
    expect(result.quality.failingReasons.some((r) => r.startsWith("overflow warnings"))).toBe(true);
  });

  test("autofix は overflow(error) の箇条書きを分割して strict を通す", async () => {
    const spec: DeckSpec = {
      master: {
        name: "m",
        aspectRatio: "16:9",
        theme: {
          name: "t",
          colors: {
            primary: "#000000",
            secondary: "#666666",
            background: "#ffffff",
            text: "#111111",
            muted: "#f0f0f0",
          },
          fonts: {
            heading: "TestHeading",
            body: "TestBody",
            mono: "TestMono",
          },
          fontPaths: {
            heading: TEST_FONT_PATH,
            headingBold: TEST_FONT_BOLD_PATH,
            body: TEST_FONT_PATH,
            bodyBold: TEST_FONT_BOLD_PATH,
            mono: TEST_FONT_PATH,
          },
        },
        layouts: {
          bullets: {
            placeholders: [
              ph.title({ constraints: { overflow: "shrink", minFontSize: 18 } }),
              ph.body({
                height: 1.0,
                constraints: { overflow: "error" },
                style: { fontSize: 16, lineSpacing: 1.2 },
              }),
            ],
          },
        },
      },
      slides: [
        {
          layout: "bullets",
          data: {
            title: "Bullet Test",
            body: {
              type: "bullet",
              items: Array.from({ length: 12 }, (_, i) => ({ text: `Item ${i + 1}` })),
            },
          },
        },
      ],
    };

    const fixed = await autofixDeck(spec, {
      profile: "strict",
      maxIterations: 5,
      thresholds: { bodyMinPt: 8 },
    });
    expect(fixed.isPassing).toBe(true);
    expect(fixed.fixed.slides.length).toBeGreaterThan(1);
  });
});
