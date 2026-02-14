import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gensmark, ph } from "../../src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

// 出力ディレクトリを準備
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

describe("統合テスト: フルパイプライン", () => {
  test("テーマ → マスター → デッキ → ビルド → PPTX 出力", async () => {
    // 1. テーマ定義
    const theme = gensmark.defineTheme({
      name: "integration-theme",
      colors: {
        primary: "#1a73e8",
        secondary: "#ea4335",
        background: "#ffffff",
        text: "#333333",
        accent: "#34a853",
      },
      fonts: { heading: "Arial", body: "Arial", mono: "Courier New" },
    });

    expect(theme.name).toBe("integration-theme");

    // 2. マスター定義
    const master = gensmark.defineMaster({
      name: "integration-master",
      theme,
      layouts: {
        "title-slide": {
          placeholders: [
            ph.title({
              y: 2.5,
              height: 1.5,
              style: { fontSize: 44, align: "center" },
            }),
            ph.subtitle({
              y: 4.2,
              style: { align: "center" },
            }),
          ],
          background: { type: "solid", color: "#1a73e8" },
        },
        content: {
          placeholders: [
            ph.title({ constraints: { maxLines: 1 } }),
            ph.body({ constraints: { overflow: "warn" } }),
          ],
        },
        "two-column": {
          placeholders: [
            ph.title(),
            ph.body({ name: "left", x: 0.75, width: 5.667 }),
            ph.body({ name: "right", x: 6.917, width: 5.667 }),
          ],
        },
      },
    });

    expect(master.name).toBe("integration-master");
    expect(Object.keys(master.layouts)).toHaveLength(3);

    // 3. デッキ作成
    const deck = gensmark.create({ master });

    deck.slide({
      layout: "title-slide",
      data: {
        title: "Q4 Quarterly Review",
        subtitle: "Engineering Department",
      },
    });

    deck.slide({
      layout: "content",
      data: {
        title: "Highlights",
        body: {
          type: "bullet",
          items: [
            { text: "Microservices migration completed" },
            { text: "Response time improved by 40%" },
            { text: "New CI/CD pipeline deployed" },
          ],
        },
      },
    });

    deck.slide({
      layout: "two-column",
      data: {
        title: "Comparison",
        left: {
          type: "bullet",
          items: [{ text: "Before: 200ms avg" }, { text: "Manual deployments" }],
        },
        right: {
          type: "bullet",
          items: [{ text: "After: 120ms avg" }, { text: "Automated CI/CD" }],
        },
      },
    });

    deck.slide({
      layout: "content",
      data: {
        title: "Code Sample",
        body: {
          type: "code",
          code: 'import { gensmark } from "gensmark";\n\nconst deck = gensmark.create({ master });',
          language: "typescript",
        },
      },
    });

    deck.slide({
      layout: "content",
      data: {
        title: "Performance Metrics",
        body: {
          type: "table",
          headers: ["Metric", "Q3", "Q4", "Change"],
          rows: [
            ["Response Time", "200ms", "120ms", "-40%"],
            ["Uptime", "99.9%", "99.99%", "+0.09%"],
            ["Deployments/week", "2", "14", "+600%"],
          ],
        },
      },
    });

    // 4. ビルド
    const result = await deck.build();

    // バリデーション結果の確認
    expect(result.isValid).toBe(true);

    // エラーがないことを確認
    const errors = result.validations.filter((v) => v.severity === "error");
    expect(errors).toHaveLength(0);

    // 5. PPTX 出力
    const outputPath = `${OUTPUT_DIR}/integration-test.pptx`;
    await result.toPptxFile(outputPath);

    expect(existsSync(outputPath)).toBe(true);

    // ファイルサイズの確認
    const file = Bun.file(outputPath);
    const size = file.size;
    expect(size).toBeGreaterThan(0);

    // クリーンアップ
    unlinkSync(outputPath);
  });

  test("ビルトインプリセットで PPTX を生成", async () => {
    const theme = gensmark.presets.themes.default;
    const master = gensmark.presets.standardMaster(theme);

    const deck = gensmark.create({ master });

    deck.slide({
      layout: "title-slide",
      data: {
        title: "Preset Test",
        subtitle: "Using built-in presets",
      },
    });

    deck.slide({
      layout: "content",
      data: {
        title: "Content Slide",
        body: "This is body text using the standard preset.",
      },
    });

    deck.slide({
      layout: "bullets",
      data: {
        title: "Bullet Points",
        body: {
          type: "bullet",
          items: [
            { text: "First point" },
            { text: "Second point", children: [{ text: "Sub-point A" }] },
            { text: "Third point" },
          ],
        },
      },
    });

    deck.slide({
      layout: "section-header",
      data: {
        title: "Next Section",
      },
    });

    deck.slide({
      layout: "end-slide",
      data: {
        title: "Thank You!",
      },
    });

    const result = await deck.build();
    expect(result.isValid).toBe(true);

    const outputPath = `${OUTPUT_DIR}/preset-test.pptx`;
    await result.toPptxFile(outputPath);
    expect(existsSync(outputPath)).toBe(true);

    const size = Bun.file(outputPath).size;
    expect(size).toBeGreaterThan(1000);

    unlinkSync(outputPath);
  });

  test("バリデーションのみ実行 (validate)", async () => {
    const theme = gensmark.presets.themes.default;
    const master = gensmark.presets.standardMaster(theme);

    const deck = gensmark.create({ master });

    deck.slide({
      layout: "content",
      data: {
        title: "Valid content",
        body: "Short text",
      },
    });

    const validations = await deck.validate();

    // エラーがないことを確認
    const errors = validations.filter((v) => v.severity === "error");
    expect(errors).toHaveLength(0);
  });

  test("不明なレイアウト使用時にエラー", async () => {
    const theme = gensmark.presets.themes.default;
    const master = gensmark.presets.standardMaster(theme);

    const deck = gensmark.create({ master });

    deck.slide({
      layout: "nonexistent-layout",
      data: { title: "Test" },
    });

    const result = await deck.build();
    expect(result.isValid).toBe(false);
    expect(result.validations.some((v) => v.type === "unknown-layout")).toBe(true);
  });

  test("ダークテーマでの生成", async () => {
    const theme = gensmark.presets.themes.dark;
    const master = gensmark.presets.standardMaster(theme);

    const deck = gensmark.create({ master });

    deck.slide({
      layout: "title-slide",
      data: {
        title: "Dark Theme Presentation",
        subtitle: "Testing dark mode",
      },
    });

    const result = await deck.build();
    expect(result.isValid).toBe(true);

    const outputPath = `${OUTPUT_DIR}/dark-theme-test.pptx`;
    await result.toPptxFile(outputPath);
    expect(existsSync(outputPath)).toBe(true);

    unlinkSync(outputPath);
  });

  test("API 設計例 (README 相当) の動作確認", async () => {
    // README の使用例と同等のコード
    const theme = gensmark.defineTheme({
      name: "my-theme",
      colors: {
        primary: "#1a73e8",
        secondary: "#ea4335",
        background: "#ffffff",
        text: "#202124",
      },
      fonts: { heading: "Arial", body: "Arial" },
    });

    const master = gensmark.defineMaster({
      name: "my-master",
      theme,
      layouts: {
        "title-slide": {
          placeholders: [
            ph.title({ constraints: { maxLines: 3, overflow: "shrink" } }),
            ph.subtitle(),
          ],
        },
        content: {
          placeholders: [
            ph.title({ constraints: { maxLines: 1 } }),
            ph.body({ constraints: { overflow: "error" } }),
          ],
        },
        "two-column": {
          placeholders: [
            ph.title(),
            ph.body({ name: "left", x: 0.75, width: 5.667 }),
            ph.body({ name: "right", x: 6.917, width: 5.667 }),
          ],
        },
      },
    });

    const deck = gensmark.create({ master });

    deck.slide({
      layout: "title-slide",
      data: {
        title: "Q4 Quarterly Review",
        subtitle: "Engineering Department",
      },
    });

    deck.slide({
      layout: "content",
      data: {
        title: "Today's Highlights",
        body: {
          type: "bullet",
          items: [
            { text: "Microservices migration completed" },
            { text: "Response time improved by 40%" },
          ],
        },
      },
    });

    const result = await deck.build();

    if (!result.isValid) {
      for (const v of result.validations) {
        // AI がバリデーション結果を見て修正可能
        expect(v.message).toBeDefined();
      }
    }

    // PPTX 出力できることを確認
    const outputPath = `${OUTPUT_DIR}/api-example.pptx`;
    await result.toPptxFile(outputPath);
    expect(existsSync(outputPath)).toBe(true);

    unlinkSync(outputPath);
  });
});
