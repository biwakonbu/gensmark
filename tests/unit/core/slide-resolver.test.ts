import { describe, expect, test } from "bun:test";
import { resolveSlide } from "../../../src/core/slide-resolver.ts";
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
    muted: "#EEEEEE",
  },
  fonts: { heading: "Helvetica", body: "Georgia", mono: "Menlo" },
};

// テスト用マスター
const testMaster: SlideMaster = {
  name: "test-master",
  theme: testTheme,
  layouts: {
    content: {
      placeholders: [
        { name: "title", type: "title", x: 0.75, y: 0.4, width: 11.5, height: 0.8 },
        {
          name: "body",
          type: "body",
          x: 0.75,
          y: 1.5,
          width: 11.5,
          height: 5.5,
          style: { fontSize: 20 },
        },
      ],
    },
    "with-image": {
      placeholders: [
        { name: "title", type: "title", x: 0.75, y: 0.4, width: 11.5, height: 0.8 },
        { name: "photo", type: "image", x: 1, y: 1.5, width: 5, height: 4 },
      ],
    },
  },
};

describe("resolveSlide", () => {
  test("テーマのフォントがスタイルに反映される", () => {
    const { computed } = resolveSlide(
      { layout: "content", data: { title: "Test", body: "Body text" } },
      testMaster,
      0,
    );

    const titleEl = computed.elements.find((e) => e.placeholder.name === "title");
    const bodyEl = computed.elements.find((e) => e.placeholder.name === "body");

    // title は heading フォント
    expect(titleEl?.resolvedStyle.fontFace).toBe("Helvetica");
    // body は body フォント
    expect(bodyEl?.resolvedStyle.fontFace).toBe("Georgia");
  });

  test("テーマの text カラーがスタイルに反映される", () => {
    const { computed } = resolveSlide(
      { layout: "content", data: { title: "Test", body: "Body" } },
      testMaster,
      0,
    );

    const bodyEl = computed.elements.find((e) => e.placeholder.name === "body");
    expect(bodyEl?.resolvedStyle.color).toBe("#333333");
  });

  test("プレースホルダー固有スタイルがテーマデフォルトをオーバーライドする", () => {
    const { computed } = resolveSlide(
      { layout: "content", data: { title: "Test", body: "Body" } },
      testMaster,
      0,
    );

    const bodyEl = computed.elements.find((e) => e.placeholder.name === "body");
    // body プレースホルダーの style.fontSize: 20 がデフォルト 18 をオーバーライド
    expect(bodyEl?.resolvedStyle.fontSize).toBe(20);
  });

  test("title はデフォルトで bold + fontSize 32", () => {
    const { computed } = resolveSlide(
      { layout: "content", data: { title: "Test" } },
      testMaster,
      0,
    );

    const titleEl = computed.elements.find((e) => e.placeholder.name === "title");
    expect(titleEl?.resolvedStyle.bold).toBe(true);
    expect(titleEl?.resolvedStyle.fontSize).toBe(32);
  });

  test("monoFont と codeBgColor がテーマから解決される", () => {
    const { computed } = resolveSlide(
      { layout: "content", data: { title: "Test", body: { type: "code", code: "x = 1" } } },
      testMaster,
      0,
    );

    const bodyEl = computed.elements.find((e) => e.placeholder.name === "body");
    expect(bodyEl?.resolvedStyle.monoFont).toBe("Menlo");
    expect(bodyEl?.resolvedStyle.codeBgColor).toBe("#EEEEEE");
  });

  test("不明なレイアウトでエラーが返る", () => {
    const { computed, validations } = resolveSlide(
      { layout: "nonexistent", data: {} },
      testMaster,
      0,
    );

    expect(validations).toHaveLength(1);
    expect(validations[0]?.type).toBe("unknown-layout");
    expect(validations[0]?.severity).toBe("error");
    expect(computed.elements).toHaveLength(0);
  });

  test("不明なプレースホルダーで警告が返る", () => {
    const { validations } = resolveSlide(
      { layout: "content", data: { title: "T", unknown_ph: "value" } },
      testMaster,
      0,
    );

    const unknownWarning = validations.find((v) => v.type === "unknown-placeholder");
    expect(unknownWarning).toBeDefined();
    expect(unknownWarning?.severity).toBe("warning");
    expect(unknownWarning?.placeholder).toBe("unknown_ph");
  });

  test("title プレースホルダーに非テキストを入れると type-mismatch error", () => {
    const { validations } = resolveSlide(
      {
        layout: "content",
        data: {
          title: { type: "bullet", items: [{ text: "x" }] },
        },
      },
      testMaster,
      0,
    );

    const err = validations.find((v) => v.type === "type-mismatch");
    expect(err).toBeDefined();
    expect(err?.severity).toBe("error");
    expect(err?.placeholder).toBe("title");
  });

  test("image プレースホルダーに string を入れると type-mismatch error", () => {
    const { validations } = resolveSlide(
      {
        layout: "with-image",
        data: {
          title: "T",
          photo: "/path/to/image.png",
        },
      },
      testMaster,
      0,
    );

    const err = validations.find((v) => v.type === "type-mismatch");
    expect(err).toBeDefined();
    expect(err?.severity).toBe("error");
    expect(err?.placeholder).toBe("photo");
  });

  test("データが渡されなかったプレースホルダーで info が返る", () => {
    const { validations } = resolveSlide(
      { layout: "content", data: { title: "T" } },
      testMaster,
      0,
    );

    const missingInfo = validations.find((v) => v.type === "missing-placeholder");
    expect(missingInfo).toBeDefined();
    expect(missingInfo?.severity).toBe("info");
    expect(missingInfo?.placeholder).toBe("body");
  });

  test("image プレースホルダーは missing-placeholder を生成しない", () => {
    const { validations } = resolveSlide(
      { layout: "with-image", data: { title: "T" } },
      testMaster,
      0,
    );

    const missingInfo = validations.filter((v) => v.type === "missing-placeholder");
    // photo (image 型) は missing-placeholder にならない
    expect(missingInfo.every((v) => v.placeholder !== "photo")).toBe(true);
  });

  test("存在しない画像パスで image-not-found エラーが返る", () => {
    const { validations } = resolveSlide(
      {
        layout: "with-image",
        data: {
          title: "T",
          photo: { type: "image", path: "/nonexistent/image.png" },
        },
      },
      testMaster,
      0,
    );

    const imgError = validations.find((v) => v.type === "image-not-found");
    expect(imgError).toBeDefined();
    expect(imgError?.severity).toBe("error");
  });

  test("URL 画像パスは存在チェックをスキップする", () => {
    const { validations } = resolveSlide(
      {
        layout: "with-image",
        data: {
          title: "T",
          photo: { type: "image", path: "https://example.com/img.png" },
        },
      },
      testMaster,
      0,
    );

    const imgError = validations.find((v) => v.type === "image-not-found");
    expect(imgError).toBeUndefined();
  });

  test("背景はスライド固有が優先される", () => {
    const masterWithBg: SlideMaster = {
      ...testMaster,
      layouts: {
        content: {
          ...testMaster.layouts.content!,
          background: { type: "solid", color: "#000000" },
        },
      },
    };

    const { computed } = resolveSlide(
      {
        layout: "content",
        data: { title: "T" },
        background: { type: "solid", color: "#FF0000" },
      },
      masterWithBg,
      0,
    );

    expect(computed.background).toEqual({ type: "solid", color: "#FF0000" });
  });

  test("スライドメモが保持される", () => {
    const { computed } = resolveSlide(
      { layout: "content", data: { title: "T" }, notes: "My notes" },
      testMaster,
      0,
    );

    expect(computed.notes).toBe("My notes");
  });

  test("gradient 背景で unsupported-feature バリデーションが返る", () => {
    const { validations } = resolveSlide(
      {
        layout: "content",
        data: { title: "T" },
        background: { type: "gradient", colors: ["#FF0000", "#0000FF"], direction: "horizontal" },
      },
      testMaster,
      0,
    );

    const gradientInfo = validations.find((v) => v.type === "unsupported-feature");
    expect(gradientInfo).toBeDefined();
    expect(gradientInfo?.severity).toBe("info");
    expect(gradientInfo?.message).toContain("Gradient background");
    expect(gradientInfo?.message).toContain("#FF0000");
    expect(gradientInfo?.suggestion).toContain("solid or image");
  });

  test("solid 背景では unsupported-feature バリデーションが返らない", () => {
    const { validations } = resolveSlide(
      {
        layout: "content",
        data: { title: "T" },
        background: { type: "solid", color: "#FF0000" },
      },
      testMaster,
      0,
    );

    const gradientInfo = validations.find((v) => v.type === "unsupported-feature");
    expect(gradientInfo).toBeUndefined();
  });

  test("computedFontSize は resolvedStyle.fontSize と同値", () => {
    const { computed } = resolveSlide(
      { layout: "content", data: { title: "T", body: "B" } },
      testMaster,
      0,
    );

    for (const el of computed.elements) {
      expect(el.computedFontSize).toBe(el.resolvedStyle.fontSize);
    }
  });
});
