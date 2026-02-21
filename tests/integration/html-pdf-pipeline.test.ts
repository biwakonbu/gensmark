import { afterAll, describe, expect, test } from "bun:test";
import { gensmark } from "../../src/index.ts";
import { HtmlRenderer } from "../../src/renderer/html/html-renderer.ts";
import { disposeSharedBrowserPool } from "../../src/layout/browser-pool.ts";

const theme = gensmark.presets.themes.default;
const master = gensmark.presets.standardMaster(theme);

afterAll(async () => {
  await disposeSharedBrowserPool();
});

describe("HTML/PDF パイプライン統合テスト", () => {
  test("DeckBuilder -> HTML 出力", async () => {
    const deck = gensmark.create({ master });
    deck
      .slide({
        layout: "title-slide",
        data: { title: "NeuralVerse", subtitle: "AI Solutions" },
      })
      .slide({
        layout: "content",
        data: { title: "Overview", body: "This is the body text." },
      })
      .slide({
        layout: "bullets",
        data: {
          title: "Key Points",
          body: {
            type: "bullet",
            items: [
              { text: "Point 1" },
              { text: "Point 2", children: [{ text: "Sub-point" }] },
            ],
          },
        },
      });

    const result = await deck.build();
    expect(result.isValid).toBe(true);

    // HTML 出力テスト
    const tmpHtml = "/tmp/gensmark-pipeline-test.html";
    await result.toHtmlFile(tmpHtml);
    const htmlContent = await Bun.file(tmpHtml).text();

    expect(htmlContent).toContain("<!DOCTYPE html>");
    expect(htmlContent).toContain("NeuralVerse");
    expect(htmlContent).toContain("AI Solutions");
    expect(htmlContent).toContain("Overview");
    expect(htmlContent).toContain("Key Points");
    expect(htmlContent).toContain("Point 1");
    expect(htmlContent).toContain("Sub-point");
  });

  test("HtmlRenderer で直接 HTML を生成", async () => {
    const renderer = new HtmlRenderer("16:9");
    renderer.setMaster(master);

    // resolveSlide を経由して ComputedSlide を取得
    const { resolveSlide } = await import("../../src/core/slide-resolver.ts");
    const { computed } = resolveSlide(
      { layout: "title-slide", data: { title: "Direct Test" } },
      master,
      0,
    );

    renderer.renderSlides([computed]);
    const html = renderer.toHtmlString();

    expect(html).toContain("Direct Test");
    expect(html).toContain('data-layout="title-slide"');
  });

  test("テーブルコンテンツが HTML に正しく変換される", async () => {
    const deck = gensmark.create({ master });
    deck.slide({
      layout: "table",
      data: {
        title: "Sales Data",
        table: {
          type: "table",
          headers: ["Product", "Revenue", "Growth"],
          rows: [
            ["Widget A", "$1.2M", "+15%"],
            ["Widget B", "$800K", "+8%"],
          ],
          style: {
            headerFill: "#1a73e8",
            headerColor: "#ffffff",
            altRowFill: "#f5f5f5",
          },
        },
      },
    });

    const result = await deck.build();
    expect(result.isValid).toBe(true);

    const tmpHtml = "/tmp/gensmark-table-test.html";
    await result.toHtmlFile(tmpHtml);
    const html = await Bun.file(tmpHtml).text();

    expect(html).toContain("Sales Data");
    expect(html).toContain('<table class="gm-table">');
    expect(html).toContain("Product");
    expect(html).toContain("Widget A");
    expect(html).toContain("$1.2M");
  });

  test("コードコンテンツが HTML に正しく変換される", async () => {
    const deck = gensmark.create({ master });
    deck.slide({
      layout: "code",
      data: {
        title: "Code Example",
        code: {
          type: "code",
          code: 'const greeting = "Hello, World!";',
          language: "typescript",
        },
      },
    });

    const result = await deck.build();
    expect(result.isValid).toBe(true);

    const tmpHtml = "/tmp/gensmark-code-test.html";
    await result.toHtmlFile(tmpHtml);
    const html = await Bun.file(tmpHtml).text();

    expect(html).toContain("Code Example");
    expect(html).toContain('<pre class="gm-code"');
    expect(html).toContain("const greeting");
  });

  test("グラデーション背景が HTML で正しくレンダリングされる", async () => {
    const deck = gensmark.create({ master });
    deck.slide({
      layout: "title-slide",
      data: { title: "Gradient Test" },
      background: {
        type: "gradient",
        colors: ["#FF6B6B", "#4ECDC4"],
        direction: "horizontal",
      },
    });

    const result = await deck.build();
    expect(result.isValid).toBe(true);

    const tmpHtml = "/tmp/gensmark-gradient-test.html";
    await result.toHtmlFile(tmpHtml);
    const html = await Bun.file(tmpHtml).text();

    expect(html).toContain("linear-gradient(to right,#FF6B6B,#4ECDC4)");
  });

  test("PDF 出力 (Playwright 利用)", async () => {
    const deck = gensmark.create({ master });
    deck
      .slide({
        layout: "title-slide",
        data: { title: "PDF Test", subtitle: "Playwright Export" },
      })
      .slide({
        layout: "content",
        data: { title: "Page 2", body: "Content for page 2" },
      });

    const result = await deck.build();
    expect(result.isValid).toBe(true);

    const tmpPdf = "/tmp/gensmark-pipeline-test.pdf";
    await result.toPdfFile(tmpPdf);

    const pdfFile = Bun.file(tmpPdf);
    expect(await pdfFile.exists()).toBe(true);
    const pdfSize = pdfFile.size;
    expect(pdfSize).toBeGreaterThan(1000); // PDF は少なくとも 1KB 以上

    // PDF ヘッダーを確認
    const header = await pdfFile.slice(0, 5).text();
    expect(header).toBe("%PDF-");
  }, 30000); // Playwright 起動に時間がかかるため長めのタイムアウト

  test("compile() から HTML/PDF を出力", async () => {
    const spec = {
      master,
      slides: [
        { layout: "title-slide", data: { title: "Compile Test", subtitle: "via compile()" } },
        {
          layout: "content",
          data: { title: "Content", body: "Body text here" },
        },
      ],
    };

    const result = await gensmark.compile(spec, { profile: "draft" });
    expect(result.build.isValid).toBe(true);

    // HTML 出力
    const tmpHtml = "/tmp/gensmark-compile-html.html";
    await result.build.toHtmlFile(tmpHtml);
    const html = await Bun.file(tmpHtml).text();
    expect(html).toContain("Compile Test");

    // PDF 出力
    const tmpPdf = "/tmp/gensmark-compile-pdf.pdf";
    await result.build.toPdfFile(tmpPdf);
    const header = await Bun.file(tmpPdf).slice(0, 5).text();
    expect(header).toBe("%PDF-");
  }, 30000);

  test("CJK テキストの HTML 出力", async () => {
    const deck = gensmark.create({ master });
    deck.slide({
      layout: "content",
      data: {
        title: "日本語テスト",
        body: "これは日本語のテストです。漢字、ひらがな、カタカナを含みます。",
      },
    });

    const result = await deck.build();
    expect(result.isValid).toBe(true);

    const tmpHtml = "/tmp/gensmark-cjk-test.html";
    await result.toHtmlFile(tmpHtml);
    const html = await Bun.file(tmpHtml).text();

    expect(html).toContain("日本語テスト");
    expect(html).toContain("漢字、ひらがな、カタカナ");
  });
});
