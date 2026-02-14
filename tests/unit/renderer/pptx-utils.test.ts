import { describe, expect, test } from "bun:test";
import { normalizeColor } from "../../../src/renderer/pptx/utils.ts";

describe("normalizeColor", () => {
  test("'#' 付きカラーコードから '#' を除去する", () => {
    expect(normalizeColor("#FF0000")).toBe("FF0000");
    expect(normalizeColor("#4472C4")).toBe("4472C4");
    expect(normalizeColor("#ffffff")).toBe("ffffff");
  });

  test("'#' なしカラーコードはそのまま返す", () => {
    expect(normalizeColor("FF0000")).toBe("FF0000");
    expect(normalizeColor("4472C4")).toBe("4472C4");
    expect(normalizeColor("ffffff")).toBe("ffffff");
  });

  test("空文字列はそのまま返す", () => {
    expect(normalizeColor("")).toBe("");
  });

  test("3桁のショートハンドカラーコードも対応", () => {
    expect(normalizeColor("#FFF")).toBe("FFF");
    expect(normalizeColor("FFF")).toBe("FFF");
  });

  test("'#' のみの場合は空文字列を返す", () => {
    expect(normalizeColor("#")).toBe("");
  });

  test("8桁の #RRGGBBAA 形式も '#' を除去する", () => {
    expect(normalizeColor("#FF000080")).toBe("FF000080");
  });
});
