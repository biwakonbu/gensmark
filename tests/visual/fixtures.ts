import { gensmark } from "../../src/index.ts";
import type { DeckSpec } from "../../src/types/spec.ts";

function createVisualSpec(): DeckSpec {
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

export const visualFixtures: Record<string, DeckSpec> = {
  "standard-smoke": createVisualSpec(),
};
