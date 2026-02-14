import { beforeAll, describe, expect, test } from "bun:test";
import type opentype from "opentype.js";
import { TextMeasurer } from "../../../src/layout/text-measurer.ts";

// テスト用フォント (macOS システムフォント)
const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const ARIAL_BOLD_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";

describe("TextMeasurer", () => {
  let measurer: TextMeasurer;
  let font: opentype.Font;

  beforeAll(async () => {
    measurer = new TextMeasurer();
    font = await measurer.loadFont(ARIAL_PATH);
  });

  describe("loadFont", () => {
    test("フォントファイルをロードできる", async () => {
      const f = await measurer.loadFont(ARIAL_PATH);
      expect(f).toBeDefined();
      expect(f.unitsPerEm).toBeGreaterThan(0);
    });

    test("キャッシュが効く (同一オブジェクトを返す)", async () => {
      const f1 = await measurer.loadFont(ARIAL_PATH);
      const f2 = await measurer.loadFont(ARIAL_PATH);
      expect(f1).toBe(f2);
    });

    test("異なるフォントは別オブジェクト", async () => {
      const f1 = await measurer.loadFont(ARIAL_PATH);
      const f2 = await measurer.loadFont(ARIAL_BOLD_PATH);
      expect(f1).not.toBe(f2);
    });
  });

  describe("measureTextWidth", () => {
    test("空文字列は幅0", () => {
      const width = measurer.measureTextWidth("", font, 12);
      expect(width).toBe(0);
    });

    test("テキスト幅が正の値を返す", () => {
      const width = measurer.measureTextWidth("Hello", font, 12);
      expect(width).toBeGreaterThan(0);
    });

    test("長いテキストほど幅が大きい", () => {
      const short = measurer.measureTextWidth("Hi", font, 12);
      const long = measurer.measureTextWidth("Hello World", font, 12);
      expect(long).toBeGreaterThan(short);
    });

    test("フォントサイズが大きいほど幅が大きい", () => {
      const small = measurer.measureTextWidth("Test", font, 10);
      const large = measurer.measureTextWidth("Test", font, 20);
      expect(large).toBeGreaterThan(small);
      // 2倍のフォントサイズでおよそ2倍の幅
      expect(large / small).toBeCloseTo(2.0, 0);
    });
  });

  describe("measure", () => {
    test("1行に収まるテキスト", () => {
      const result = measurer.measure("Hello", font, 12, 10);
      expect(result.lineCount).toBe(1);
      expect(result.lines).toEqual(["Hello"]);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    test("ワードラップが発生する", () => {
      const result = measurer.measure(
        "This is a long text that should wrap to multiple lines",
        font,
        12,
        2, // 2インチ幅
      );
      expect(result.lineCount).toBeGreaterThan(1);
      expect(result.lines.length).toBeGreaterThan(1);
    });

    test("改行文字で分割される", () => {
      const result = measurer.measure("Line 1\nLine 2\nLine 3", font, 12, 10);
      expect(result.lineCount).toBe(3);
      expect(result.lines).toEqual(["Line 1", "Line 2", "Line 3"]);
    });

    test("空行が保持される", () => {
      const result = measurer.measure("Line 1\n\nLine 3", font, 12, 10);
      expect(result.lineCount).toBe(3);
      expect(result.lines).toEqual(["Line 1", "", "Line 3"]);
    });

    test("高さが行数に比例する", () => {
      const one = measurer.measure("Hello", font, 12, 10);
      const three = measurer.measure("Line 1\nLine 2\nLine 3", font, 12, 10);
      // 3行は1行のおよそ3倍の高さ
      expect(three.height / one.height).toBeCloseTo(3.0, 0);
    });

    test("日本語テキストの計測", () => {
      const result = measurer.measure("こんにちは世界", font, 12, 10);
      expect(result.lineCount).toBe(1);
      expect(result.width).toBeGreaterThan(0);
    });

    test("日本語テキストが文字単位でラップされる", () => {
      const result = measurer.measure(
        "あいうえおかきくけこさしすせそたちつてとなにぬねの",
        font,
        12,
        1.5, // 狭い幅
      );
      expect(result.lineCount).toBeGreaterThan(1);
    });

    test("混植テキスト (日本語+英語) の計測", () => {
      const result = measurer.measure("これはTestです。Hello世界。", font, 12, 2);
      expect(result.lineCount).toBeGreaterThanOrEqual(1);
      expect(result.width).toBeGreaterThan(0);
    });
  });

  describe("findFittingFontSize", () => {
    test("十分なスペースがあれば最大サイズを返す", () => {
      const result = measurer.findFittingFontSize(
        "Hi",
        font,
        10, // 10インチ幅
        5, // 5インチ高
        8, // 最小8pt
        44, // 最大44pt
      );
      expect(result).not.toBeNull();
      // 最大サイズ付近
      expect(result?.fontSize).toBeGreaterThan(40);
    });

    test("スペースが限られていれば小さいサイズを返す", () => {
      const result = measurer.findFittingFontSize(
        "This is a longer text that needs to fit in a small area with word wrapping",
        font,
        3, // 3インチ幅
        0.5, // 0.5インチ高
        8,
        44,
      );
      expect(result).not.toBeNull();
      expect(result?.fontSize).toBeLessThan(44);
      expect(result?.fontSize).toBeGreaterThanOrEqual(8);
    });

    test("最小サイズでも収まらなければ null", () => {
      const result = measurer.findFittingFontSize(
        "This text is way too long to fit in the tiny available space even at the minimum font size. ".repeat(
          10,
        ),
        font,
        1, // 1インチ幅
        0.15, // 0.15インチ高 (とても小さい)
        8,
        44,
      );
      expect(result).toBeNull();
    });

    test("結果のフォントサイズで計測した高さが領域内に収まる", () => {
      const text = "Four score and seven years ago our fathers brought forth on this continent";
      const maxWidth = 4;
      const maxHeight = 1;
      const result = measurer.findFittingFontSize(text, font, maxWidth, maxHeight, 8, 44);
      expect(result).not.toBeNull();

      const verification = measurer.measure(text, font, result!.fontSize, maxWidth);
      expect(verification.height).toBeLessThanOrEqual(maxHeight + 0.01);
    });
  });

  describe("clearCache", () => {
    test("キャッシュクリア後は再ロードされる", async () => {
      const f1 = await measurer.loadFont(ARIAL_PATH);
      measurer.clearCache();
      const f2 = await measurer.loadFont(ARIAL_PATH);
      // 別オブジェクト (再ロードされた)
      expect(f1).not.toBe(f2);
    });
  });
});
