import { describe, expect, test } from "bun:test";
import { bindTemplateData } from "../../../src/core/template-binder.ts";
import type { PlaceholderValue } from "../../../src/types/content.ts";
import type { PlaceholderDef } from "../../../src/types/master.ts";

const placeholders: PlaceholderDef[] = [
  { name: "title", type: "title", x: 0.7, y: 0.5, width: 12, height: 0.9 },
  { name: "body", type: "body", x: 0.7, y: 1.6, width: 12, height: 5.3 },
  { name: "image", type: "image", x: 8, y: 1.6, width: 4, height: 3 },
];

describe("template-binder", () => {
  test("完全一致キーを優先する", () => {
    const data: Record<string, PlaceholderValue> = {
      title: "A",
      body: "B",
    };
    const bound = bindTemplateData(data, placeholders);
    expect(bound.title).toBe("A");
    expect(bound.body).toBe("B");
  });

  test("型一致で title/body/image へ割り当てる", () => {
    const data: Record<string, PlaceholderValue> = {
      headline: "Quarterly report",
      summary: "Body text",
      heroImage: { type: "image", path: "https://example.com/a.png" },
    };
    const bound = bindTemplateData(data, placeholders);
    expect(bound.title).toBe("Quarterly report");
    expect(bound.body).toBe("Body text");
    expect(typeof bound.image).toBe("object");
    if (typeof bound.image !== "string") {
      expect(bound.image.type).toBe("image");
    }
  });

  test("未一致キーは順序補完で割り当てる", () => {
    const data: Record<string, PlaceholderValue> = {
      foo: "X",
      bar: "Y",
    };
    const bound = bindTemplateData(data, placeholders.slice(0, 2));
    expect(bound.title).toBe("X");
    expect(bound.body).toBe("Y");
  });
});
