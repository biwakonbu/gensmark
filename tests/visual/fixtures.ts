import { join } from "node:path";
import type { CompileOptions } from "../../src/compiler/compile.ts";
import { gensmark } from "../../src/index.ts";
import type { DeckSpec } from "../../src/types/spec.ts";

export interface VisualFixtureCase {
  spec: DeckSpec;
  options?: CompileOptions;
}

function createStandardVisualSpec(): DeckSpec {
  const theme = gensmark.defineTheme({
    name: "visual-fixture",
    colors: {
      primary: "#2B579A",
      secondary: "#405D72",
      background: "#FFFFFF",
      text: "#1A1A2E",
      accent: "#5B9BD5",
      muted: "#F4F5F7",
    },
    // CI (ubuntu-latest) で入手しやすいフォントを優先
    fonts: {
      heading: "DejaVu Sans",
      body: "DejaVu Sans",
      mono: "DejaVu Sans Mono",
    },
  });

  const master = gensmark.presets.standardMaster(theme);
  return {
    master,
    slides: [
      {
        layout: "title-slide",
        data: {
          title: "gensmark visual test",
          subtitle: "standard master",
        },
      },
      {
        layout: "content",
        data: {
          title: "Body",
          body: "This is a visual regression fixture.\nIt should render consistently.",
        },
      },
      {
        layout: "bullets",
        data: {
          title: "Bullets",
          body: {
            type: "bullet",
            items: [
              { text: "One" },
              { text: "Two" },
              { text: "Three" },
              { text: "Nested", children: [{ text: "Child A" }, { text: "Child B" }] },
            ],
          },
        },
      },
      {
        layout: "table",
        data: {
          title: "Table",
          table: {
            type: "table",
            headers: ["Col A", "Col B", "Col C"],
            rows: [
              ["A1", "B1", "C1"],
              ["A2", "B2", "C2"],
              ["A3", "B3", "C3"],
              ["A4", "B4", "C4"],
              ["A5", "B5", "C5"],
            ],
          },
        },
      },
      {
        layout: "code",
        data: {
          title: "Code",
          code: {
            type: "code",
            language: "typescript",
            code: `import { gensmark } from "gensmark";\n\nconst spec = { /* ... */ };`,
          },
        },
      },
    ],
  };
}

async function createTemplateVisualFixture(): Promise<VisualFixtureCase> {
  const templatePath = join(process.cwd(), "tests/fixtures/template/basic-template.pptx");
  const template = await gensmark.importTemplate({ path: templatePath });
  return {
    spec: {
      master: template.master,
      slides: [
        {
          layout: "title-slide",
          data: {
            title: "template visual test",
            subtitle: "imported pptx master",
          },
        },
        {
          layout: "content",
          data: {
            title: "content",
            body: {
              type: "bullet",
              items: [{ text: "alpha" }, { text: "beta" }, { text: "gamma" }],
            },
          },
        },
      ],
    },
    options: { template },
  };
}

const templateFixture = await createTemplateVisualFixture();

export const visualFixtures: Record<string, VisualFixtureCase> = {
  "standard-smoke": { spec: createStandardVisualSpec() },
  "template-smoke": templateFixture,
};
