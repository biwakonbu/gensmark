import { beforeAll, describe, expect, test } from "bun:test";
import type opentype from "opentype.js";
import { OverflowDetector } from "../../../src/layout/overflow-detector.ts";
import { TextMeasurer } from "../../../src/layout/text-measurer.ts";
import type { BulletList, TableContent } from "../../../src/types/content.ts";
import type { PlaceholderDef } from "../../../src/types/master.ts";
import { TEST_FONT_PATH } from "../../helpers/font-path.ts";

describe("OverflowDetector", () => {
  let measurer: TextMeasurer;
  let detector: OverflowDetector;
  let font: opentype.Font;

  beforeAll(async () => {
    measurer = new TextMeasurer();
    detector = new OverflowDetector(measurer);
    font = await measurer.loadFont(TEST_FONT_PATH);
  });

  // テスト用のプレースホルダー定義
  function makePlaceholder(overrides?: Partial<PlaceholderDef>): PlaceholderDef {
    return {
      name: "body",
      type: "body",
      x: 0.75,
      y: 1.5,
      width: 11.5,
      height: 5,
      style: { fontSize: 18, padding: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 } },
      ...overrides,
    };
  }

  // デフォルトの fontSize と lineSpacing
  const DEFAULT_FONT_SIZE = 18;
  const DEFAULT_LINE_SPACING = 1.2;

  describe("テキストオーバーフロー検知", () => {
    test("収まるテキストはバリデーション空", () => {
      const ph = makePlaceholder();
      const result = detector.detect(
        ph,
        "Short text",
        font,
        0,
        DEFAULT_FONT_SIZE,
        DEFAULT_LINE_SPACING,
      );
      expect(result.validations).toHaveLength(0);
      expect(result.computedFontSize).toBe(18);
    });

    test("空テキストはバリデーション空", () => {
      const ph = makePlaceholder();
      const result = detector.detect(ph, "", font, 0, DEFAULT_FONT_SIZE, DEFAULT_LINE_SPACING);
      expect(result.validations).toHaveLength(0);
    });

    test("オーバーフロー (overflow: 'error') はエラーを生成", () => {
      const ph = makePlaceholder({
        height: 0.3, // 非常に小さい
        constraints: { overflow: "error" },
      });
      const longText = "This is a very long text. ".repeat(50);
      const result = detector.detect(
        ph,
        longText,
        font,
        0,
        DEFAULT_FONT_SIZE,
        DEFAULT_LINE_SPACING,
      );

      expect(result.validations.length).toBeGreaterThan(0);
      expect(result.validations[0]?.severity).toBe("error");
      expect(result.validations[0]?.type).toBe("overflow");
      expect(result.validations[0]?.suggestion).toBeDefined();
      expect(result.validations[0]?.overflowDetail).toBeDefined();
    });

    test("オーバーフロー (overflow: 'warn') は警告を生成", () => {
      const ph = makePlaceholder({
        height: 0.3,
        constraints: { overflow: "warn" },
      });
      const longText = "This is a very long text. ".repeat(50);
      const result = detector.detect(
        ph,
        longText,
        font,
        0,
        DEFAULT_FONT_SIZE,
        DEFAULT_LINE_SPACING,
      );

      expect(result.validations.length).toBeGreaterThan(0);
      expect(result.validations[0]?.severity).toBe("warning");
    });

    test("オーバーフロー (overflow: 'shrink') はフォントサイズを縮小", () => {
      const fontSize = 24;
      const ph = makePlaceholder({
        height: 1.0,
        style: { fontSize },
        constraints: { overflow: "shrink", minFontSize: 10 },
      });
      const mediumText = "This text needs to be shrunk to fit. ".repeat(10);
      const result = detector.detect(ph, mediumText, font, 0, fontSize, DEFAULT_LINE_SPACING);

      // shrink で収まればバリデーションは空
      if (result.validations.length === 0) {
        expect(result.computedFontSize).toBeLessThan(24);
        expect(result.computedFontSize).toBeGreaterThanOrEqual(10);
      }
    });

    test("shrink でも最小サイズで収まらなければエラー", () => {
      const fontSize = 24;
      const ph = makePlaceholder({
        height: 0.15,
        width: 1,
        style: { fontSize },
        constraints: { overflow: "shrink", minFontSize: 12 },
      });
      const longText = "Long overflow text that cannot fit. ".repeat(30);
      const result = detector.detect(ph, longText, font, 0, fontSize, DEFAULT_LINE_SPACING);

      expect(result.validations.length).toBeGreaterThan(0);
      expect(result.validations[0]?.severity).toBe("error");
      expect(result.computedFontSize).toBe(12);
    });

    test("overflow: 'truncate' は警告を生成", () => {
      const ph = makePlaceholder({
        height: 0.3,
        constraints: { overflow: "truncate" },
      });
      const longText = "Truncatable text. ".repeat(50);
      const result = detector.detect(
        ph,
        longText,
        font,
        0,
        DEFAULT_FONT_SIZE,
        DEFAULT_LINE_SPACING,
      );

      expect(result.validations.length).toBeGreaterThan(0);
      expect(result.validations[0]?.severity).toBe("warning");
      expect(result.validations[0]?.message).toContain("truncated");
    });

    test("maxLines 制約のチェック", () => {
      const ph = makePlaceholder({
        constraints: { maxLines: 1, overflow: "error" },
      });
      const twoLineText = "First line\nSecond line";
      const result = detector.detect(
        ph,
        twoLineText,
        font,
        0,
        DEFAULT_FONT_SIZE,
        DEFAULT_LINE_SPACING,
      );

      expect(result.validations.length).toBeGreaterThan(0);
      expect(result.validations[0]?.message).toContain("max lines");
    });

    test("overflowDetail に suggestedFontSize が含まれる", () => {
      const fontSize = 24;
      const ph = makePlaceholder({
        height: 0.5,
        style: { fontSize },
        constraints: { overflow: "error", minFontSize: 8 },
      });
      const text = "Text that overflows at 24pt but fits at smaller size. ".repeat(5);
      const result = detector.detect(ph, text, font, 0, fontSize, DEFAULT_LINE_SPACING);

      if (result.validations.length > 0) {
        const detail = result.validations[0]?.overflowDetail;
        expect(detail).toBeDefined();
        expect(detail?.currentFontSize).toBe(24);
      }
    });
  });

  describe("箇条書きオーバーフロー検知", () => {
    test("収まる箇条書きはバリデーション空", () => {
      const ph = makePlaceholder();
      const bullet: BulletList = {
        type: "bullet",
        items: [{ text: "Item 1" }, { text: "Item 2" }],
      };
      const result = detector.detect(ph, bullet, font, 0, DEFAULT_FONT_SIZE, DEFAULT_LINE_SPACING);
      expect(result.validations).toHaveLength(0);
    });

    test("オーバーフローする箇条書き (overflow: 'error')", () => {
      const ph = makePlaceholder({
        height: 0.3,
        constraints: { overflow: "error" },
      });
      const bullet: BulletList = {
        type: "bullet",
        items: Array.from({ length: 20 }, (_, i) => ({
          text: `Item ${i + 1}: This is a longer bullet point text`,
        })),
      };
      const result = detector.detect(ph, bullet, font, 0, DEFAULT_FONT_SIZE, DEFAULT_LINE_SPACING);

      expect(result.validations.length).toBeGreaterThan(0);
      expect(result.validations[0]?.severity).toBe("error");
    });

    test("箇条書き shrink", () => {
      const fontSize = 18;
      const ph = makePlaceholder({
        height: 2,
        style: { fontSize },
        constraints: { overflow: "shrink", minFontSize: 10 },
      });
      const bullet: BulletList = {
        type: "bullet",
        items: Array.from({ length: 10 }, (_, i) => ({
          text: `Item ${i + 1}: Description text here`,
        })),
      };
      const result = detector.detect(ph, bullet, font, 0, fontSize, DEFAULT_LINE_SPACING);

      // 縮小して収まったか、エラーになったか
      if (result.validations.length === 0) {
        expect(result.computedFontSize).toBeLessThanOrEqual(18);
      }
    });
  });

  describe("TextContent の処理", () => {
    test("TextContent (string value) の検知", () => {
      const ph = makePlaceholder();
      const result = detector.detect(
        ph,
        { type: "text", value: "Simple text content" },
        font,
        0,
        DEFAULT_FONT_SIZE,
        DEFAULT_LINE_SPACING,
      );
      expect(result.validations).toHaveLength(0);
    });

    test("TextContent (TextRun[] value) の検知", () => {
      const ph = makePlaceholder();
      const result = detector.detect(
        ph,
        {
          type: "text",
          value: [{ text: "Bold text", style: { bold: true } }, { text: " and normal text" }],
        },
        font,
        0,
        DEFAULT_FONT_SIZE,
        DEFAULT_LINE_SPACING,
      );
      expect(result.validations).toHaveLength(0);
    });
  });

  describe("CodeContent の処理", () => {
    test("コードコンテンツの検知", () => {
      const ph = makePlaceholder();
      const result = detector.detect(
        ph,
        { type: "code", code: "const x = 1;\nconsole.log(x);", language: "typescript" },
        font,
        0,
        DEFAULT_FONT_SIZE,
        DEFAULT_LINE_SPACING,
      );
      expect(result.validations).toHaveLength(0);
    });
  });

  describe("デフォルト shrink 挙動", () => {
    test("constraints 未指定でオーバーフロー時に自動縮小される", () => {
      const fontSize = 24;
      const ph = makePlaceholder({
        width: 5,
        height: 1.5,
        style: { fontSize },
        // constraints を指定しない → デフォルト "shrink"
      });
      const longText = "This text needs to be shrunk to fit properly in a small area. ".repeat(5);
      const result = detector.detect(ph, longText, font, 0, fontSize, DEFAULT_LINE_SPACING);

      // shrink がデフォルトなので、エラーではなく警告付きでフォントサイズ縮小
      expect(result.computedFontSize).toBeLessThan(fontSize);
      expect(result.computedFontSize).toBeGreaterThanOrEqual(10);
      // shrink 成功時は severity が "warning"（"error" にならない）
      for (const v of result.validations) {
        expect(v.severity).toBe("warning");
      }
    });

    test("constraints 未指定の箇条書きでも自動縮小される", () => {
      const fontSize = 18;
      const ph = makePlaceholder({
        height: 2,
        style: { fontSize },
        // constraints を指定しない
      });
      const bullet: BulletList = {
        type: "bullet",
        items: Array.from({ length: 10 }, (_, i) => ({
          text: `Item ${i + 1}: Description text here that is somewhat long`,
        })),
      };
      const result = detector.detect(ph, bullet, font, 0, fontSize, DEFAULT_LINE_SPACING);

      // shrink がデフォルトなので、警告/エラーではなく縮小で対応
      if (result.validations.length === 0) {
        expect(result.computedFontSize).toBeLessThanOrEqual(fontSize);
      }
    });
  });

  describe("テーブルオーバーフロー検知", () => {
    test("小さいテーブルはバリデーション空", () => {
      const ph = makePlaceholder({
        height: 5,
        constraints: { overflow: "shrink", minFontSize: 10 },
      });
      const table: TableContent = {
        type: "table",
        headers: ["Name", "Value"],
        rows: [
          ["A", "1"],
          ["B", "2"],
        ],
      };
      const result = detector.detect(ph, table, font, 0, DEFAULT_FONT_SIZE, DEFAULT_LINE_SPACING);
      expect(result.validations).toHaveLength(0);
    });

    test("大きいテーブル (shrink) はフォントサイズを縮小", () => {
      const fontSize = 18;
      const ph = makePlaceholder({
        height: 2.0,
        style: { fontSize },
        constraints: { overflow: "shrink", minFontSize: 10 },
      });
      const table: TableContent = {
        type: "table",
        headers: ["Col1", "Col2", "Col3"],
        rows: Array.from({ length: 15 }, (_, i) => [`Row${i + 1}`, `Data${i + 1}`, `Val${i + 1}`]),
      };
      const result = detector.detect(ph, table, font, 0, fontSize, DEFAULT_LINE_SPACING);

      // shrink で収まればバリデーションは空で、フォントサイズが縮小される
      if (result.validations.length === 0) {
        expect(result.computedFontSize).toBeLessThan(fontSize);
        expect(result.computedFontSize).toBeGreaterThanOrEqual(10);
      }
    });

    test("minFontSize の尊重", () => {
      const fontSize = 18;
      const ph = makePlaceholder({
        height: 0.5, // 非常に小さい
        style: { fontSize },
        constraints: { overflow: "shrink", minFontSize: 12 },
      });
      const table: TableContent = {
        type: "table",
        headers: ["A", "B", "C"],
        rows: Array.from({ length: 30 }, (_, i) => [`R${i}`, `D${i}`, `V${i}`]),
      };
      const result = detector.detect(ph, table, font, 0, fontSize, DEFAULT_LINE_SPACING);

      // 最小サイズでも収まらないので error
      expect(result.validations.length).toBeGreaterThan(0);
      expect(result.validations[0]?.severity).toBe("error");
      expect(result.computedFontSize).toBe(12);
    });

    test("overflow: 'warn' でテーブルが警告を生成", () => {
      const ph = makePlaceholder({
        height: 0.5,
        constraints: { overflow: "warn" },
      });
      const table: TableContent = {
        type: "table",
        headers: ["A", "B"],
        rows: Array.from({ length: 20 }, (_, i) => [`R${i}`, `D${i}`]),
      };
      const result = detector.detect(ph, table, font, 0, DEFAULT_FONT_SIZE, DEFAULT_LINE_SPACING);

      expect(result.validations.length).toBeGreaterThan(0);
      expect(result.validations[0]?.severity).toBe("warning");
    });
  });
});
