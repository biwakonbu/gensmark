import { afterEach, describe, expect, test } from "bun:test";
import { importPptxTemplate } from "../../../src/import/pptx-template-importer.ts";
import { createTemplateFixture, type TemplateFixture } from "../../helpers/template-fixture.ts";

let fixture: TemplateFixture | undefined;

afterEach(async () => {
  if (fixture) {
    await fixture.cleanup();
    fixture = undefined;
  }
});

describe("pptx-template-importer", () => {
  test(".pptx から master/layout を取り込める", async () => {
    fixture = await createTemplateFixture();
    const imported = await importPptxTemplate({ path: fixture.path });

    expect(imported.kind).toBe("pptx-template");
    expect(imported.sourcePath).toBe(fixture.path);
    expect(imported.rawBytes.byteLength).toBeGreaterThan(0);

    // 元レイアウト名
    expect(imported.master.layouts.corp_title).toBeDefined();
    expect(imported.master.layouts.corp_content).toBeDefined();
    // 自動 alias
    expect(imported.master.layouts["title-slide"]).toBeDefined();
    expect(imported.master.layouts.content).toBeDefined();

    const contentHints = imported.placeholderHints.corp_content ?? [];
    expect(contentHints.some((h) => h.type === "title")).toBe(true);
    expect(contentHints.some((h) => h.type === "body")).toBe(true);

    const contentMap = imported.layoutMap.content;
    expect(contentMap).toBeDefined();
    expect(contentMap?.canonical).toBe("corp_content");
  });

  test("placeholder 名が不足する場合は warning を返す", async () => {
    fixture = await createTemplateFixture();
    const imported = await importPptxTemplate({ path: fixture.path });
    expect(imported.warnings.some((w) => w.code === "placeholder-name-missing")).toBe(true);
  });
});
