import { describe, expect, test } from "bun:test";
import { DeckBuilder } from "../../../src/core/deck-builder.ts";
import type { Renderer } from "../../../src/renderer/renderer.ts";
import type { ComputedSlide } from "../../../src/types/layout.ts";
import type { SlideMaster } from "../../../src/types/master.ts";
import type { Theme } from "../../../src/types/theme.ts";

// テスト用テーマ
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

// テスト用マスター
const testMaster: SlideMaster = {
  name: "test-master",
  theme: testTheme,
  layouts: {
    "title-slide": {
      placeholders: [
        { name: "title", type: "title", x: 0.75, y: 2.5, width: 11.5, height: 1.5 },
        { name: "subtitle", type: "subtitle", x: 0.75, y: 4.2, width: 11.5, height: 1 },
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

// テスト用モックレンダラー
class MockRenderer implements Renderer {
  masterSet = false;
  renderedSlides: ComputedSlide[] = [];

  setMaster(): void {
    this.masterSet = true;
  }

  renderSlides(slides: ComputedSlide[]): void {
    this.renderedSlides = slides;
  }

  async toBuffer(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  async toFile(): Promise<void> {}
}

describe("DeckBuilder", () => {
  test("スライドを追加できる", () => {
    const deck = new DeckBuilder({ master: testMaster, renderer: new MockRenderer() });
    const result = deck.slide({
      layout: "title-slide",
      data: { title: "Test Title", subtitle: "Test Subtitle" },
    });
    // チェーン可能
    expect(result).toBe(deck);
  });

  test("build() でレンダラーが呼ばれる", async () => {
    const renderer = new MockRenderer();
    const deck = new DeckBuilder({ master: testMaster, renderer });

    deck.slide({
      layout: "title-slide",
      data: { title: "Title", subtitle: "Subtitle" },
    });

    const result = await deck.build();

    expect(renderer.masterSet).toBe(true);
    expect(renderer.renderedSlides).toHaveLength(1);
    expect(renderer.renderedSlides[0]?.layoutName).toBe("title-slide");
    expect(renderer.renderedSlides[0]?.elements).toHaveLength(2);
    expect(result.isValid).toBe(true);
    // フォントパス未設定のため font-not-found の info のみ
    expect(result.validations.every((v) => v.severity !== "error")).toBe(true);
  });

  test("複数スライドを追加できる", async () => {
    const renderer = new MockRenderer();
    const deck = new DeckBuilder({ master: testMaster, renderer });

    deck
      .slide({
        layout: "title-slide",
        data: { title: "Title" },
      })
      .slide({
        layout: "content",
        data: { title: "Content Title", body: "Body text" },
      });

    const result = await deck.build();
    expect(renderer.renderedSlides).toHaveLength(2);
    expect(result.isValid).toBe(true);
  });

  test("不明なレイアウトでバリデーションエラー", async () => {
    const renderer = new MockRenderer();
    const deck = new DeckBuilder({ master: testMaster, renderer });

    deck.slide({
      layout: "nonexistent",
      data: { title: "Title" },
    });

    const result = await deck.build();
    expect(result.isValid).toBe(false);
    expect(result.validations).toHaveLength(1);
    expect(result.validations[0]?.type).toBe("unknown-layout");
  });

  test("不明なプレースホルダーで警告", async () => {
    const renderer = new MockRenderer();
    const deck = new DeckBuilder({ master: testMaster, renderer });

    deck.slide({
      layout: "title-slide",
      data: { title: "Title", nonexistent: "Value" },
    });

    const result = await deck.build();
    // 不明プレースホルダーは warning なので isValid は true
    expect(result.isValid).toBe(true);
    expect(result.validations.some((v) => v.type === "unknown-placeholder")).toBe(true);
  });

  test("validate() でバリデーションのみ実行", async () => {
    const renderer = new MockRenderer();
    const deck = new DeckBuilder({ master: testMaster, renderer });

    deck.slide({
      layout: "nonexistent",
      data: {},
    });

    const validations = await deck.validate();
    expect(validations).toHaveLength(1);
    expect(validations[0]?.type).toBe("unknown-layout");
    // レンダラーは呼ばれていない
    expect(renderer.masterSet).toBe(false);
  });

  test("スタイルがテーマから解決される", async () => {
    const renderer = new MockRenderer();
    const deck = new DeckBuilder({ master: testMaster, renderer });

    deck.slide({
      layout: "content",
      data: { title: "Title", body: "Body" },
    });

    await deck.build();

    const titleElement = renderer.renderedSlides[0]?.elements.find(
      (e) => e.placeholder.name === "title",
    );
    expect(titleElement).toBeDefined();
    // title はテーマの heading フォント
    expect(titleElement?.resolvedStyle.fontFace).toBe("Arial");
    // title はデフォルトで bold
    expect(titleElement?.resolvedStyle.bold).toBe(true);
  });

  test("アスペクト比のデフォルトは 16:9", () => {
    const deck = new DeckBuilder({ master: testMaster, renderer: new MockRenderer() });
    expect(deck.aspectRatio).toBe("16:9");
  });

  test("アスペクト比を指定できる", () => {
    const deck = new DeckBuilder({
      master: testMaster,
      renderer: new MockRenderer(),
      aspectRatio: "4:3",
    });
    expect(deck.aspectRatio).toBe("4:3");
  });

  test("スライドメモが保持される", async () => {
    const renderer = new MockRenderer();
    const deck = new DeckBuilder({ master: testMaster, renderer });

    deck.slide({
      layout: "content",
      data: { title: "Title" },
      notes: "Speaker notes here",
    });

    await deck.build();
    expect(renderer.renderedSlides[0]?.notes).toBe("Speaker notes here");
  });
});
