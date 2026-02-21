import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadZipFromBytes,
  readRelationships,
  readXmlRequired,
} from "../../src/import/ooxml-reader.ts";
import { gensmark } from "../../src/index.ts";
import { collectSlideTargetsForTest } from "../../src/renderer/pptx/ooxml-writer.ts";
import { createTemplateFixture, type TemplateFixture } from "../helpers/template-fixture.ts";

let fixture: TemplateFixture | undefined;

afterEach(async () => {
  if (fixture) {
    await fixture.cleanup();
    fixture = undefined;
  }
});

describe("integration: template import pipeline", () => {
  test("importTemplate -> create/build でテンプレートレイアウトを使って出力できる", async () => {
    fixture = await createTemplateFixture();
    const template = await gensmark.importTemplate({ path: fixture.path });

    const deck = gensmark.create({
      master: template.master,
      template,
    });
    deck.slide({
      layout: "title-slide",
      data: {
        title: "Imported Template",
        subtitle: "Works",
      },
    });
    deck.slide({
      layout: "content",
      data: {
        title: "Body",
        body: "Hello",
      },
    });

    const result = await deck.build();
    expect(result.isValid).toBe(true);

    const outPath = join(fixture.dir, "out.pptx");
    await result.toPptxFile(outPath);
    expect(existsSync(outPath)).toBe(true);

    const buffer = await Bun.file(outPath).arrayBuffer();
    const { zip } = await loadZipFromBytes(buffer);
    const presentationXml = await readXmlRequired(zip, "ppt/presentation.xml");
    const presentationRels = await readRelationships(zip, "ppt/_rels/presentation.xml.rels");
    const slides = collectSlideTargetsForTest(presentationXml, presentationRels);
    expect(slides).toHaveLength(2);
  });

  test("unknown-layout / unknown-placeholder の既存挙動を維持する", async () => {
    fixture = await createTemplateFixture();
    const template = await gensmark.importTemplate({ path: fixture.path });

    const spec = {
      master: template.master,
      slides: [
        {
          layout: "nonexistent-layout",
          data: { title: "x" },
        },
      ],
    };
    const compiled = await gensmark.compile(spec, { template });

    expect(compiled.build.isValid).toBe(false);
    expect(compiled.validations.some((v) => v.type === "unknown-layout")).toBe(true);
  });

  test("compile 結果に templateWarnings が含まれる", async () => {
    fixture = await createTemplateFixture();
    const template = await gensmark.importTemplate({ path: fixture.path });

    const compiled = await gensmark.compile(
      {
        master: template.master,
        slides: [{ layout: "content", data: { title: "T", body: "B" } }],
      },
      { template, profile: "draft" },
    );
    expect(Array.isArray(compiled.templateWarnings)).toBe(true);
    expect(compiled.build.isValid).toBe(true);
  });
});
