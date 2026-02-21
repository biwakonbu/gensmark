import { describe, expect, test } from "bun:test";
import { elementToHtml, valueToHtml } from "../../../../src/renderer/html/element-to-html.ts";
import type { ComputedElement } from "../../../../src/types/layout.ts";
import type { PlaceholderDef } from "../../../../src/types/master.ts";

describe("valueToHtml", () => {
  test("文字列をエスケープして span に変換", () => {
    const html = valueToHtml("Hello <World> & \"Quotes\"");
    expect(html).toBe('<span>Hello &lt;World&gt; &amp; &quot;Quotes&quot;</span>');
  });

  test("TextContent (文字列) を変換", () => {
    const html = valueToHtml({ type: "text", value: "Simple text" });
    expect(html).toBe("<span>Simple text</span>");
  });

  test("TextContent (TextRun[]) を変換", () => {
    const html = valueToHtml({
      type: "text",
      value: [
        { text: "Bold ", style: { bold: true } },
        { text: "Normal" },
      ],
    });
    expect(html).toContain('style="font-weight:bold"');
    expect(html).toContain("Bold ");
    expect(html).toContain("Normal");
  });

  test("BulletList を ul に変換", () => {
    const html = valueToHtml({
      type: "bullet",
      items: [{ text: "Item 1" }, { text: "Item 2" }],
    });
    expect(html).toContain('<ul class="gm-bullets">');
    expect(html).toContain("<li>Item 1</li>");
    expect(html).toContain("<li>Item 2</li>");
  });

  test("BulletList (ordered) を ol に変換", () => {
    const html = valueToHtml({
      type: "bullet",
      items: [{ text: "First" }],
      ordered: true,
    });
    expect(html).toContain('<ol class="gm-bullets">');
  });

  test("ネストした箇条書きを変換", () => {
    const html = valueToHtml({
      type: "bullet",
      items: [
        {
          text: "Parent",
          children: [{ text: "Child" }],
        },
      ],
    });
    expect(html).toContain("Parent");
    expect(html).toContain('<ul class="gm-bullets-nested">');
    expect(html).toContain("Child");
  });

  test("TableContent を table に変換", () => {
    const html = valueToHtml({
      type: "table",
      headers: ["Name", "Age"],
      rows: [
        ["Alice", "30"],
        ["Bob", "25"],
      ],
    });
    expect(html).toContain('<table class="gm-table">');
    expect(html).toContain("<thead>");
    expect(html).toContain("<th");
    expect(html).toContain("Name");
    expect(html).toContain("Alice");
    expect(html).toContain("</tbody></table>");
  });

  test("TableContent のスタイル付きセルを変換", () => {
    const html = valueToHtml({
      type: "table",
      rows: [[{ text: "Bold", style: { bold: true }, fill: "#FF0000" }]],
    });
    expect(html).toContain("font-weight:bold");
    expect(html).toContain("background:#FF0000");
  });

  test("CodeContent を pre/code に変換", () => {
    const html = valueToHtml({
      type: "code",
      code: 'const x = "hello";',
      language: "typescript",
    });
    expect(html).toContain('<pre class="gm-code"');
    expect(html).toContain('data-language="typescript"');
    expect(html).toContain("const x = &quot;hello&quot;;");
  });

  test("ImageContent を img に変換", () => {
    const html = valueToHtml({
      type: "image",
      path: "/img/logo.png",
      alt: "Logo",
      sizing: "cover",
    });
    expect(html).toContain('<img class="gm-image"');
    expect(html).toContain('src="/img/logo.png"');
    expect(html).toContain('alt="Logo"');
    expect(html).toContain("object-fit:cover");
  });

  test("MermaidContent を pre.mermaid に変換", () => {
    const html = valueToHtml({
      type: "mermaid",
      code: "graph LR; A-->B;",
    });
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain("graph LR; A--&gt;B;");
  });
});

describe("elementToHtml", () => {
  const basePh: PlaceholderDef = {
    name: "title",
    type: "title",
    x: 1.5,
    y: 2.3,
    width: 10,
    height: 1.5,
  };

  test("ComputedElement を位置付き div に変換", () => {
    const el: ComputedElement = {
      placeholder: basePh,
      value: "Hello World",
      resolvedStyle: {
        fontSize: 32,
        fontFace: "Arial",
        color: "#2B579A",
        bold: true,
        align: "left",
        valign: "middle",
      },
      computedFontSize: 32,
    };

    const html = elementToHtml(el);
    expect(html).toContain('class="gm-ph"');
    expect(html).toContain('data-name="title"');
    expect(html).toContain("left:1.5in");
    expect(html).toContain("top:2.3in");
    expect(html).toContain("width:10in");
    expect(html).toContain("height:1.5in");
    expect(html).toContain("font-size:32pt");
    expect(html).toContain("Hello World");
  });

  test("shrink されたフォントサイズが反映される", () => {
    const el: ComputedElement = {
      placeholder: basePh,
      value: "Shrunk text",
      resolvedStyle: {
        fontSize: 32,
        fontFace: "Arial",
        color: "#333",
        bold: false,
        align: "left",
        valign: "top",
      },
      computedFontSize: 24,
    };

    const html = elementToHtml(el);
    expect(html).toContain("font-size:24pt");
    expect(html).not.toContain("font-size:32pt");
  });
});
