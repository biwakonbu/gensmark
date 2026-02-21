import { test, expect, describe } from "bun:test";
import { renderLayoutPreview, renderPlaceholderTable } from "../../../../src/tools/master-editor/layout-preview-renderer.ts";
import { createStandardMaster } from "../../../../src/master/presets/standard.ts";
import { defaultTheme } from "../../../../src/master/presets/themes/default.ts";

describe("renderLayoutPreview", () => {
  const master = createStandardMaster(defaultTheme);

  test("content レイアウトのワイヤフレームにプレースホルダーが2つ含まれる", () => {
    const layout = master.layouts["content"]!;
    const html = renderLayoutPreview(layout, "content");

    // wireframe-ph クラスの数を数える
    const phCount = (html.match(/wireframe-ph/g) || []).length;
    expect(phCount).toBe(layout.placeholders.length);
  });

  test("title-slide レイアウトにプレースホルダー名が表示される", () => {
    const layout = master.layouts["title-slide"]!;
    const html = renderLayoutPreview(layout, "title-slide");

    expect(html).toContain("title");
    expect(html).toContain("subtitle");
  });

  test("two-column レイアウトに3つのプレースホルダーが含まれる", () => {
    const layout = master.layouts["two-column"]!;
    const html = renderLayoutPreview(layout, "two-column");

    const phCount = (html.match(/wireframe-ph/g) || []).length;
    expect(phCount).toBe(3); // title, left, right
  });

  test("固定要素が描画される", () => {
    const layout = master.layouts["content"]!;
    const html = renderLayoutPreview(layout, "content");

    // fixedElements がある場合、gm-fixed クラスの要素が含まれる
    expect(html).toContain("gm-fixed");
  });

  test("レイアウト名ラベルが含まれる", () => {
    const layout = master.layouts["bullets"]!;
    const html = renderLayoutPreview(layout, "bullets");
    expect(html).toContain("bullets");
  });

  test("4:3 アスペクト比でも描画できる", () => {
    const layout = master.layouts["content"]!;
    const html = renderLayoutPreview(layout, "content", "4:3");
    expect(html).toContain("10in");
    expect(html).toContain("7.5in");
  });
});

describe("renderPlaceholderTable", () => {
  const master = createStandardMaster(defaultTheme);

  test("テーブルにプレースホルダー情報が含まれる", () => {
    const layout = master.layouts["two-column"]!;
    const html = renderPlaceholderTable(layout);

    expect(html).toContain("<table");
    expect(html).toContain("title");
    expect(html).toContain("left");
    expect(html).toContain("right");
  });

  test("位置・サイズの数値が含まれる", () => {
    const layout = master.layouts["content"]!;
    const html = renderPlaceholderTable(layout);

    // body プレースホルダーの x=0.75 が表示される
    expect(html).toContain("0.75");
  });
});
