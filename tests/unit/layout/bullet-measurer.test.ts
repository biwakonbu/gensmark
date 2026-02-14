import { beforeAll, describe, expect, test } from "bun:test";
import type opentype from "opentype.js";
import { measureBulletList } from "../../../src/layout/bullet-measurer.ts";
import { TextMeasurer } from "../../../src/layout/text-measurer.ts";
import type { BulletList } from "../../../src/types/content.ts";
import { TEST_FONT_PATH } from "../../helpers/font-path.ts";

describe("measureBulletList", () => {
  let measurer: TextMeasurer;
  let font: opentype.Font;

  beforeAll(async () => {
    measurer = new TextMeasurer();
    font = await measurer.loadFont(TEST_FONT_PATH);
  });

  const DEFAULT_FONT_SIZE = 18;
  const DEFAULT_LINE_SPACING = 1.2;
  const DEFAULT_MAX_WIDTH = 10; // インチ

  /** ヘルパー: BulletList を作成 */
  function makeBullet(items: BulletList["items"]): BulletList {
    return { type: "bullet", items };
  }

  test("空リストの計測は高さ 0", () => {
    const bullet = makeBullet([]);
    const result = measureBulletList(
      bullet,
      measurer,
      font,
      DEFAULT_FONT_SIZE,
      DEFAULT_MAX_WIDTH,
      DEFAULT_LINE_SPACING,
    );
    expect(result.height).toBe(0);
    expect(result.width).toBe(0);
    expect(result.totalItems).toBe(0);
  });

  test("単一アイテムの計測", () => {
    const bullet = makeBullet([{ text: "Hello World" }]);
    const result = measureBulletList(
      bullet,
      measurer,
      font,
      DEFAULT_FONT_SIZE,
      DEFAULT_MAX_WIDTH,
      DEFAULT_LINE_SPACING,
    );
    expect(result.height).toBeGreaterThan(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.totalItems).toBe(1);
  });

  test("複数アイテムの計測で高さが累積する", () => {
    const single = makeBullet([{ text: "Item" }]);
    const double = makeBullet([{ text: "Item" }, { text: "Item" }]);
    const singleResult = measureBulletList(
      single,
      measurer,
      font,
      DEFAULT_FONT_SIZE,
      DEFAULT_MAX_WIDTH,
      DEFAULT_LINE_SPACING,
    );
    const doubleResult = measureBulletList(
      double,
      measurer,
      font,
      DEFAULT_FONT_SIZE,
      DEFAULT_MAX_WIDTH,
      DEFAULT_LINE_SPACING,
    );
    expect(doubleResult.height).toBeGreaterThan(singleResult.height);
    expect(doubleResult.totalItems).toBe(2);
  });

  test("ネストされたアイテムの計測", () => {
    const bullet = makeBullet([
      {
        text: "Parent",
        children: [{ text: "Child 1" }, { text: "Child 2" }],
      },
    ]);
    const result = measureBulletList(
      bullet,
      measurer,
      font,
      DEFAULT_FONT_SIZE,
      DEFAULT_MAX_WIDTH,
      DEFAULT_LINE_SPACING,
    );
    // 親 1 + 子 2 = 合計 3 アイテム
    expect(result.totalItems).toBe(3);
    expect(result.height).toBeGreaterThan(0);
  });

  test("深いインデントで availableWidth <= 0 のケース", () => {
    // インデント幅を明示的に大きくして、確実に availableWidth <= 0 にする
    // indent=0.5, bullet=0.2 -> Level 1: 0.5 + 0.2 = 0.7 > maxWidth(0.6) -> continue
    const bullet = makeBullet([
      {
        text: "A",
        children: [
          {
            text: "B",
            children: [{ text: "C" }],
          },
        ],
      },
    ]);
    const result = measureBulletList(
      bullet,
      measurer,
      font,
      DEFAULT_FONT_SIZE,
      0.6, // indent(0.5) + bullet(0.2) = 0.7 で Level 1 がはみ出す幅
      DEFAULT_LINE_SPACING,
      { indentWidth: 0.5, bulletWidth: 0.2 },
    );
    // Level 0: indent=0*0.5+0.2=0.2, avail=0.4 > 0 -> 正常計測、children 処理へ
    // Level 1: indent=1*0.5+0.2=0.7, avail=-0.1 <= 0 -> continue (children スキップ)
    // Level 2: Level 1 の children がスキップされたため未到達
    expect(result.totalItems).toBe(2);
    expect(result.height).toBeGreaterThan(0);
  });

  test("カスタム options が反映される", () => {
    const bullet = makeBullet([
      {
        text: "Parent",
        children: [{ text: "Child" }],
      },
    ]);

    const defaultResult = measureBulletList(
      bullet,
      measurer,
      font,
      DEFAULT_FONT_SIZE,
      DEFAULT_MAX_WIDTH,
      DEFAULT_LINE_SPACING,
    );

    const customResult = measureBulletList(
      bullet,
      measurer,
      font,
      DEFAULT_FONT_SIZE,
      DEFAULT_MAX_WIDTH,
      DEFAULT_LINE_SPACING,
      { indentWidth: 0.5, bulletWidth: 0.4, itemSpacing: 0.1 },
    );

    // カスタムの itemSpacing で高さが増加
    expect(customResult.height).toBeGreaterThan(defaultResult.height);
    expect(customResult.totalItems).toBe(defaultResult.totalItems);
  });

  test("アイテム固有の fontSize が反映される", () => {
    const smallFont = makeBullet([{ text: "Small text", style: { fontSize: 10 } }]);
    const largeFont = makeBullet([{ text: "Small text", style: { fontSize: 36 } }]);

    const smallResult = measureBulletList(
      smallFont,
      measurer,
      font,
      DEFAULT_FONT_SIZE,
      DEFAULT_MAX_WIDTH,
      DEFAULT_LINE_SPACING,
    );
    const largeResult = measureBulletList(
      largeFont,
      measurer,
      font,
      DEFAULT_FONT_SIZE,
      DEFAULT_MAX_WIDTH,
      DEFAULT_LINE_SPACING,
    );

    expect(largeResult.height).toBeGreaterThan(smallResult.height);
  });
});
