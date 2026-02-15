import { describe, expect, test } from "bun:test";
import { LayoutEngine } from "../../../src/layout/layout-engine.ts";
import type { ComputedSlide } from "../../../src/types/layout.ts";
import type { SlideMaster } from "../../../src/types/master.ts";
import { TEST_FONT_BOLD_PATH, TEST_FONT_PATH } from "../../helpers/font-path.ts";

describe("LayoutEngine", () => {
  /** テスト用のマスター (fontPaths 設定あり) */
  function makeMasterWithFonts(): SlideMaster {
    return {
      name: "test",
      theme: {
        name: "test-theme",
        colors: {
          primary: "#000000",
          secondary: "#666666",
          background: "#ffffff",
          text: "#333333",
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
      layouts: {},
    };
  }

  /** テスト用のマスター (fontPaths 未設定) */
  function makeMasterWithoutFonts(): SlideMaster {
    return {
      name: "test",
      theme: {
        name: "test-theme",
        colors: {
          primary: "#000000",
          secondary: "#666666",
          background: "#ffffff",
          text: "#333333",
        },
        fonts: {
          heading: "Arial",
          body: "Arial",
        },
      },
      layouts: {},
    };
  }

  /** テスト用の ComputedSlide を作成 */
  function makeComputedSlide(overrides?: Partial<ComputedSlide>): ComputedSlide {
    return {
      index: 0,
      layoutName: "content",
      elements: [
        {
          placeholder: {
            name: "body",
            type: "body",
            x: 0.75,
            y: 1.5,
            width: 11.5,
            height: 5,
            style: { fontSize: 18, padding: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 } },
          },
          value: "Short text",
          resolvedStyle: {
            fontSize: 18,
            fontFace: "TestBody",
            color: "#333333",
            bold: false,
            align: "left",
            valign: "top",
            lineSpacing: 1.2,
          },
          computedFontSize: 18,
        },
      ],
      ...overrides,
    };
  }

  test("fontPaths 未設定時はシステムフォントにフォールバックしてバリデーション実行", async () => {
    const engine = new LayoutEngine();
    const master = makeMasterWithoutFonts();
    const slide = makeComputedSlide();

    const validations = await engine.validateSlide(slide, master);

    // システムフォントが見つかればバリデーション実行 (font-not-found にならない)
    // 見つからなければ info を返す
    const fontNotFound = validations.filter((v) => v.type === "font-not-found");
    if (fontNotFound.length === 0) {
      // システムフォントが見つかった → 正常にバリデーション実行された
      expect(true).toBe(true);
    } else {
      expect(fontNotFound[0]!.severity).toBe("info");
    }
  });

  test("fontPaths 設定時は正常にバリデーション実行", async () => {
    const engine = new LayoutEngine();
    const master = makeMasterWithFonts();
    const slide = makeComputedSlide();

    const validations = await engine.validateSlide(slide, master);

    // 短いテキストなのでオーバーフローなし
    const errors = validations.filter((v) => v.severity === "error");
    expect(errors).toHaveLength(0);
  });

  test("heading フォントパスの正しい解決", async () => {
    const engine = new LayoutEngine();
    const master = makeMasterWithFonts();
    const slide = makeComputedSlide({
      elements: [
        {
          placeholder: {
            name: "title",
            type: "title",
            x: 0.75,
            y: 0.5,
            width: 11.5,
            height: 1,
            style: { fontSize: 36 },
          },
          value: "Title",
          resolvedStyle: {
            fontSize: 36,
            fontFace: "TestHeading",
            color: "#000000",
            bold: true,
            align: "left",
            valign: "top",
            lineSpacing: 1.2,
          },
          computedFontSize: 36,
        },
      ],
    });

    const validations = await engine.validateSlide(slide, master);

    // heading フォントが正しく解決され、font-not-found が出ないこと
    const fontNotFound = validations.filter((v) => v.type === "font-not-found");
    expect(fontNotFound).toHaveLength(0);
  });

  test("mono フォントパスの正しい解決", async () => {
    const engine = new LayoutEngine();
    const master = makeMasterWithFonts();
    const slide = makeComputedSlide({
      elements: [
        {
          placeholder: {
            name: "code",
            type: "body",
            x: 0.75,
            y: 1.5,
            width: 11.5,
            height: 5,
            style: { fontSize: 14 },
          },
          value: "console.log('hello')",
          resolvedStyle: {
            fontSize: 14,
            fontFace: "TestMono",
            color: "#333333",
            bold: false,
            align: "left",
            valign: "top",
            lineSpacing: 1.2,
          },
          computedFontSize: 14,
        },
      ],
    });

    const validations = await engine.validateSlide(slide, master);

    // mono フォントが正しく解決され、font-not-found が出ないこと
    const fontNotFound = validations.filter((v) => v.type === "font-not-found");
    expect(fontNotFound).toHaveLength(0);
  });

  test("フォントロード失敗時は warning を返す", async () => {
    const engine = new LayoutEngine();
    const master = makeMasterWithFonts();
    // resolveFontPath() は fontFace が heading/mono 以外のとき body パスを返す。
    // element の fontFace は "TestBody" (heading でも mono でもない) なので body パスが解決される。
    master.theme.fontPaths = {
      body: "/nonexistent/path/font.ttf",
    };
    const slide = makeComputedSlide();

    const validations = await engine.validateSlide(slide, master);

    expect(validations.length).toBeGreaterThanOrEqual(1);
    expect(validations[0]!.severity).toBe("warning");
    expect(validations[0]!.type).toBe("font-not-found");
  });

  test("オーバーフローするテキストで error が検出される", async () => {
    const engine = new LayoutEngine();
    const master = makeMasterWithFonts();
    const longText = "This is a very long text that overflows. ".repeat(30);
    const slide = makeComputedSlide({
      elements: [
        {
          placeholder: {
            name: "body",
            type: "body",
            x: 0.75,
            y: 1.5,
            width: 11.5,
            height: 0.3, // 非常に小さい高さでオーバーフローを誘発
            style: { fontSize: 18, padding: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 } },
            constraints: { overflow: "error" },
          },
          value: longText,
          resolvedStyle: {
            fontSize: 18,
            fontFace: "TestBody",
            color: "#333333",
            bold: false,
            align: "left",
            valign: "top",
            lineSpacing: 1.2,
          },
          computedFontSize: 18,
        },
      ],
    });

    const validations = await engine.validateSlide(slide, master);

    const errors = validations.filter((v) => v.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.type).toBe("overflow");
  });

  test("clearCache が正常に動作する", () => {
    const engine = new LayoutEngine();
    // エラーなく呼べること
    expect(() => engine.clearCache()).not.toThrow();
  });

  // --- margin-overflow テスト ---

  describe("margin-overflow チェック", () => {
    test("プレースホルダーが余白内に収まる場合は警告なし", async () => {
      const engine = new LayoutEngine();
      const master = makeMasterWithFonts();
      master.margins = { top: 0.5, right: 0.75, bottom: 0.5, left: 0.75 };
      const slide = makeComputedSlide({
        elements: [
          {
            placeholder: {
              name: "body",
              type: "body",
              x: 0.75,
              y: 1.5,
              width: 11.5,
              height: 5,
              style: { fontSize: 18 },
            },
            value: "Short text",
            resolvedStyle: {
              fontSize: 18,
              fontFace: "TestBody",
              color: "#333333",
              bold: false,
              align: "left",
              valign: "top",
              lineSpacing: 1.2,
            },
            computedFontSize: 18,
          },
        ],
      });

      const validations = await engine.validateSlide(slide, master);
      const marginWarnings = validations.filter((v) => v.type === "margin-overflow");
      expect(marginWarnings).toHaveLength(0);
    });

    test("プレースホルダーが左余白を超える場合は margin-overflow 警告", async () => {
      const engine = new LayoutEngine();
      const master = makeMasterWithFonts();
      master.margins = { top: 0.5, right: 0.75, bottom: 0.5, left: 0.75 };
      const slide = makeComputedSlide({
        elements: [
          {
            placeholder: {
              name: "body",
              type: "body",
              x: 0.3, // 左余白 0.75 を超えている
              y: 1.5,
              width: 5,
              height: 3,
              style: { fontSize: 18 },
            },
            value: "Text",
            resolvedStyle: {
              fontSize: 18,
              fontFace: "TestBody",
              color: "#333333",
              bold: false,
              align: "left",
              valign: "top",
              lineSpacing: 1.2,
            },
            computedFontSize: 18,
          },
        ],
      });

      const validations = await engine.validateSlide(slide, master);
      const marginWarnings = validations.filter((v) => v.type === "margin-overflow");
      expect(marginWarnings.length).toBeGreaterThan(0);
      expect(marginWarnings[0]!.severity).toBe("warning");
      expect(marginWarnings[0]!.message).toContain("left");
    });

    test("プレースホルダーが右余白を超える場合は margin-overflow 警告", async () => {
      const engine = new LayoutEngine();
      const master = makeMasterWithFonts();
      master.margins = { top: 0.5, right: 0.75, bottom: 0.5, left: 0.75 };
      const slide = makeComputedSlide({
        elements: [
          {
            placeholder: {
              name: "body",
              type: "body",
              x: 0.75,
              y: 1.5,
              width: 12.0, // x + width = 12.75 > 13.33 - 0.75 = 12.58
              height: 3,
              style: { fontSize: 18 },
            },
            value: "Text",
            resolvedStyle: {
              fontSize: 18,
              fontFace: "TestBody",
              color: "#333333",
              bold: false,
              align: "left",
              valign: "top",
              lineSpacing: 1.2,
            },
            computedFontSize: 18,
          },
        ],
      });

      const validations = await engine.validateSlide(slide, master);
      const marginWarnings = validations.filter((v) => v.type === "margin-overflow");
      expect(marginWarnings.length).toBeGreaterThan(0);
      expect(marginWarnings[0]!.message).toContain("right");
    });

    test("プレースホルダーが上余白を超える場合は margin-overflow 警告", async () => {
      const engine = new LayoutEngine();
      const master = makeMasterWithFonts();
      master.margins = { top: 0.5, right: 0.75, bottom: 0.5, left: 0.75 };
      const slide = makeComputedSlide({
        elements: [
          {
            placeholder: {
              name: "title",
              type: "title",
              x: 0.75,
              y: 0.2, // 上余白 0.5 を超えている
              width: 5,
              height: 1,
              style: { fontSize: 28 },
            },
            value: "Title",
            resolvedStyle: {
              fontSize: 28,
              fontFace: "TestBody",
              color: "#333333",
              bold: true,
              align: "left",
              valign: "top",
              lineSpacing: 1.2,
            },
            computedFontSize: 28,
          },
        ],
      });

      const validations = await engine.validateSlide(slide, master);
      const marginWarnings = validations.filter((v) => v.type === "margin-overflow");
      expect(marginWarnings.length).toBeGreaterThan(0);
      expect(marginWarnings[0]!.message).toContain("top");
    });

    test("プレースホルダーが下余白を超える場合は margin-overflow 警告", async () => {
      const engine = new LayoutEngine();
      const master = makeMasterWithFonts();
      master.margins = { top: 0.5, right: 0.75, bottom: 0.5, left: 0.75 };
      const slide = makeComputedSlide({
        elements: [
          {
            placeholder: {
              name: "body",
              type: "body",
              x: 0.75,
              y: 1.5,
              width: 5,
              height: 6.0, // y + height = 7.5 > 7.5 - 0.5 = 7.0
              style: { fontSize: 18 },
            },
            value: "Text",
            resolvedStyle: {
              fontSize: 18,
              fontFace: "TestBody",
              color: "#333333",
              bold: false,
              align: "left",
              valign: "top",
              lineSpacing: 1.2,
            },
            computedFontSize: 18,
          },
        ],
      });

      const validations = await engine.validateSlide(slide, master);
      const marginWarnings = validations.filter((v) => v.type === "margin-overflow");
      expect(marginWarnings.length).toBeGreaterThan(0);
      expect(marginWarnings[0]!.message).toContain("bottom");
    });

    test("margins 未設定時はデフォルトマージンで検査", async () => {
      const engine = new LayoutEngine();
      const master = makeMasterWithFonts();
      // margins は undefined のまま (デフォルト: top:0.5, right:0.75, bottom:0.5, left:0.75)
      const slide = makeComputedSlide({
        elements: [
          {
            placeholder: {
              name: "body",
              type: "body",
              x: 0.3, // デフォルト左余白 0.75 を超えている
              y: 1.5,
              width: 5,
              height: 3,
              style: { fontSize: 18 },
            },
            value: "Text",
            resolvedStyle: {
              fontSize: 18,
              fontFace: "TestBody",
              color: "#333333",
              bold: false,
              align: "left",
              valign: "top",
              lineSpacing: 1.2,
            },
            computedFontSize: 18,
          },
        ],
      });

      const validations = await engine.validateSlide(slide, master);
      const marginWarnings = validations.filter((v) => v.type === "margin-overflow");
      expect(marginWarnings.length).toBeGreaterThan(0);
      expect(marginWarnings[0]!.message).toContain("left");
    });
  });
});
