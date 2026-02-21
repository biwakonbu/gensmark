# PPTXテンプレートImportガイド

## 概要

`gensmark.importTemplate()` を使うと、ローカル `.pptx` から slide master/layout 情報を取り込み、`compile` または `DeckBuilder` でテンプレート継承レンダリングできます。

## 対象と非対象

- 対象:
  - ローカル `.pptx` ファイル
- 非対象:
  - Google Slides 取込
  - `.potx` / `.pptm` の固有機能
  - アニメーション・遷移・SmartArt・高度エフェクトの完全再現

## クイックスタート

```ts
import { gensmark } from "./src/index.ts";

const template = await gensmark.importTemplate({
  path: "/absolute/path/to/template.pptx",
});

const spec = {
  master: template.master,
  slides: [
    { layout: "title-slide", data: { title: "Title", subtitle: "Subtitle" } },
    { layout: "content", data: { title: "Hello", body: "World" } },
  ],
};

const compiled = await gensmark.compile(spec, { template, profile: "strict" });
if (!compiled.build.isValid) throw new Error("compile failed");
await compiled.build.toPptxFile("out.pptx");
```

## API

### `importTemplate`

```ts
const template = await gensmark.importTemplate({
  path: "/absolute/path/to/template.pptx",
  aliasStrategy: "keep-original-with-alias",
});
```

- `path`: 入力 `.pptx` のファイルパス（必須）
- `aliasStrategy`: 現在は `"keep-original-with-alias"` のみ

戻り値 `ImportedTemplate` には次が含まれます。

- `master`: 取り込まれた `SlideMaster`
- `layoutMap`: レイアウト名（canonical/alias）とOOXML layout part の対応
- `placeholderHints`: placeholder 名・型・順序のヒント
- `warnings`: 取込時警告

## レイアウト名の扱い

- 元の layout 名を canonical 名として保持
- alias を追加して `layout` 指定しやすくする

代表的な alias 推定:

- `title + subtitle` -> `title-slide`
- `title + body` -> `content`
- `title + 2body` -> `two-column`
- `title + image` -> `content-image`

alias 衝突時は canonical 優先で alias を破棄し、警告を返します。

## Placeholder 割当ルール（テンプレート利用時）

テンプレート利用時は `slide.data` のキーを以下優先順位で placeholder に割り当てます。

1. 完全一致名
2. 正規化名一致（記号・大文字小文字差を吸収）
3. 型一致（`title/subtitle/body/image`）
4. 順序補完（`y,x` 順）

一度割り当てた placeholder は再利用しません。

## 警告と失敗条件

### 警告コード

- `layout-alias-collision`
- `layout-without-placeholder`
- `placeholder-name-missing`
- `unsupported-layout-feature`
- `theme-fallback`

### 例外（import失敗）

次は継続せず例外になります。

- ファイル未読込
- zip破損
- 必須part欠落（例: `ppt/presentation.xml`, slide master rel）
- layout が1件も抽出できない

それ以外は warning を返し、処理を継続します。

## compile/build の使い分け

- `compile(spec, { template })`
  - Mermaid を画像化してからレンダリング
  - `templateWarnings` が結果に含まれる
- `DeckBuilder({ master: template.master, template })`
  - 直接スライドを追加してビルド

## 出力時のテンプレート継承挙動

- テンプレート内の既存スライドは出力から除外
- 生成スライドのみを `ppt/slides/slideN.xml` として再構成
- 各スライドは import した layout part への rel を再接続
- 背景/固定要素は layout 側を優先し、スライド側背景指定がある場合のみ override

## Mermaid 併用

`MermaidContent` を含む場合は `DeckBuilder.build()` ではなく `gensmark.compile()` を使ってください。

```ts
const compiled = await gensmark.compile(spec, {
  template,
  assets: { mermaidFormat: "png" },
});
```
