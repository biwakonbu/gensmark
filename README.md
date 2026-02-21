# gensmark

AI-first スライド生成ツール (PPTX)。

## セットアップ

```bash
bun install
```

## 開発

```bash
bun run lint
bun test
```

## 生成 (DeckSpec コンパイラ)

```ts
import { gensmark } from "./src/index.ts";

const theme = gensmark.defineTheme({
  name: "demo",
  colors: {
    primary: "#2B579A",
    secondary: "#405D72",
    background: "#FFFFFF",
    text: "#1A1A2E",
    accent: "#5B9BD5",
    muted: "#F4F5F7",
  },
  fonts: { heading: "Arial", body: "Arial", mono: "Courier New" },
});

const master = gensmark.presets.standardMaster(theme);
const spec = {
  master,
  slides: [
    { layout: "title-slide", data: { title: "Title", subtitle: "Subtitle" } },
    { layout: "content", data: { title: "Hello", body: "World" } },
  ],
};

const result = await gensmark.compile(spec, { profile: "strict" });
if (!result.build.isValid) throw new Error("compile failed (validation errors)");
await result.build.toPptxFile("out.pptx");
```

## テンプレート Import (.pptx)

ローカル `.pptx` のスライドマスター/レイアウトを取り込み、同じレイアウトを継承して出力できます。

```ts
import { gensmark } from "./src/index.ts";

const template = await gensmark.importTemplate({
  path: "/absolute/path/to/template.pptx",
});

const spec = {
  master: template.master,
  slides: [
    { layout: "title-slide", data: { title: "QBR", subtitle: "FY2026 Q1" } },
    { layout: "content", data: { title: "Summary", body: "..." } },
  ],
};

const result = await gensmark.compile(spec, {
  template,
  profile: "strict",
});

if (!result.build.isValid) throw new Error("compile failed");
await result.build.toPptxFile("out-template.pptx");

// import時/継承時の警告
console.log(result.templateWarnings);
```

`DeckBuilder` 経路でも使えます。

```ts
const template = await gensmark.importTemplate({ path: "/absolute/path/to/template.pptx" });
const deck = gensmark.create({ master: template.master, template });
deck.slide({ layout: "content", data: { title: "T", body: "B" } });
const build = await deck.build();
if (build.isValid) await build.toPptxFile("out-template-builder.pptx");
```

詳細仕様は `docs/template-import.md` を参照してください。

## 自律修正 (Autofix)

```ts
const fixed = await gensmark.autofix(spec, { profile: "strict", maxIterations: 5 });
console.log(fixed.isPassing, fixed.attempts.map((a) => a.appliedFixes));
```

## Mermaid (自動レンダリング)

`MermaidContent` はコンパイル前に画像へ解決される前提なので、`DeckBuilder.build()` ではなく `gensmark.compile()` を使う。

```ts
const spec = {
  master,
  slides: [
    {
      layout: "content",
      data: {
        title: "Diagram",
        body: {
          type: "mermaid",
          code: "flowchart TD\\n  A[Start] --> B[End]",
          format: "auto",
        },
      },
    },
  ],
};
await gensmark.compile(spec, { assets: { mermaidFormat: "png" } });
```

## Visual Regression (CI)

CI では `scripts/visual-test.ts` が `PPTX -> PDF (LibreOffice) -> PNG (pdftoppm)` でレンダリングし、
`tests/visual/golden` と pixel diff を取ります。

```bash
bun run test:visual
```

Golden 更新:

```bash
# (ローカル) 既定は platform 別ディレクトリへ出力 (例: tests/visual/golden-darwin)
bun run test:visual:update

# (CI 用 golden = linux/amd64) は Docker で更新する想定
docker run --platform linux/amd64 --rm -v "$PWD:/work" -w /work oven/bun:1.3.2 bash -lc '
  apt-get update >/dev/null &&
  apt-get install -y libreoffice-impress poppler-utils fonts-dejavu-core fonts-dejavu-extra >/dev/null &&
  bun install --frozen-lockfile >/dev/null &&
  bun run test:visual:update
'
```

## OpenAI FixAction (任意)

決定論 autofix が止まった場合に限り、`FixAction[]` を OpenAI に提案させて適用できます。

```ts
await gensmark.autofix(spec, {
  profile: "strict",
  llm: { provider: "openai", model: "gpt-4.1" },
});
```

環境変数 `OPENAI_API_KEY` または `llm.apiKey` を利用します。

This project was created using `bun init` in bun v1.3.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
