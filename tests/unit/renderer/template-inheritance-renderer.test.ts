import { afterEach, describe, expect, test } from "bun:test";
import { resolveSlide } from "../../../src/core/slide-resolver.ts";
import {
  loadZipFromBytes,
  readRelationships,
  readXmlRequired,
  resolveRelationshipTarget,
  toRelsPath,
} from "../../../src/import/ooxml-reader.ts";
import { importPptxTemplate } from "../../../src/import/pptx-template-importer.ts";
import { collectSlideTargetsForTest } from "../../../src/renderer/pptx/ooxml-writer.ts";
import { TemplateInheritanceRenderer } from "../../../src/renderer/pptx/template-inheritance-renderer.ts";
import { createTemplateFixture, type TemplateFixture } from "../../helpers/template-fixture.ts";

let fixture: TemplateFixture | undefined;

afterEach(async () => {
  if (fixture) {
    await fixture.cleanup();
    fixture = undefined;
  }
});

describe("TemplateInheritanceRenderer", () => {
  test("テンプレート既存スライドを除外し、新規スライドのみ出力する", async () => {
    fixture = await createTemplateFixture();
    const imported = await importPptxTemplate({ path: fixture.path });

    const r = new TemplateInheritanceRenderer(imported, "16:9");
    r.setMaster(imported.master);

    const s1 = resolveSlide(
      { layout: "title-slide", data: { title: "Hello", subtitle: "World" } },
      imported.master,
      0,
      { template: imported },
    );
    const s2 = resolveSlide(
      { layout: "content", data: { title: "Body", body: "text" } },
      imported.master,
      1,
      { template: imported },
    );
    r.renderSlides([s1.computed, s2.computed]);
    const out = await r.toBuffer();

    const { zip } = await loadZipFromBytes(out);
    const presentationXml = await readXmlRequired(zip, "ppt/presentation.xml");
    const presentationRels = await readRelationships(zip, "ppt/_rels/presentation.xml.rels");

    const slideTargets = collectSlideTargetsForTest(presentationXml, presentationRels);
    expect(slideTargets).toHaveLength(2);
    expect(slideTargets[0]).toBe("/ppt/slides/slide1.xml");
    expect(slideTargets[1]).toBe("/ppt/slides/slide2.xml");
  });

  test("layout リレーションが import した layout part を指す", async () => {
    fixture = await createTemplateFixture();
    const imported = await importPptxTemplate({ path: fixture.path });

    const r = new TemplateInheritanceRenderer(imported, "16:9");
    r.setMaster(imported.master);
    const resolved = resolveSlide(
      { layout: "content", data: { title: "X", body: "Y" } },
      imported.master,
      0,
      { template: imported },
    );
    r.renderSlides([resolved.computed]);
    const out = await r.toBuffer();

    const { zip } = await loadZipFromBytes(out);
    const rels = await readRelationships(zip, toRelsPath("ppt/slides/slide1.xml"));
    const layoutRel = rels.find(
      (x) =>
        x.Type ===
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
    );
    expect(layoutRel).toBeDefined();
    const layoutPart = resolveRelationshipTarget("ppt/slides/slide1.xml", layoutRel!.Target);
    expect(layoutPart).toBe(imported.layoutMap.content?.layoutPart);
  });
});
