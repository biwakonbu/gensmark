---
name: generate-slides
description: >
  gensmark API を使って HTML / PPTX / PDF 形式のスライドを生成する。
  ユーザーの要望を聞き取り、TypeScript コードを作成して bun で実行し、
  プレゼンテーションファイルを出力する。
  Use when the user says "スライドを作って", "プレゼン資料を生成して",
  "発表資料を作りたい", "slide", "presentation", "deck を作成" など
  スライド生成に関する要求をしたとき。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# スライド生成スキル

ユーザーの要望に応じて gensmark API でスライドデッキを生成する実行型スキル。

## 実行フロー

### Step 1 - 要望の分析

ユーザーの入力から以下を判断する:

- **テーマ**: 指定がなければ `default` (ライト)。ダークを希望すれば `dark`
- **スライド構成**: 内容からレイアウトとページ数を決定
- **出力形式**: デフォルトは HTML + PPTX。PDF を求められたら PDF も追加
- **出力先**: `examples/output/` ディレクトリ

情報が不足している場合はユーザーに質問して補完する。
最低限必要な情報: プレゼンの主題またはコンテンツ。

### Step 2 - TypeScript コードの作成

`examples/output/{deck-name}.ts` にスライド生成スクリプトを作成する。

テンプレート:

```typescript
import { gensmark } from "../../src/index.ts";

// テーマとマスターの設定
const theme = gensmark.presets.themes.default;
const master = gensmark.presets.standardMaster(theme);

// デッキの組み立て
const deck = gensmark
  .create({ master })
  .slide({
    layout: "title-slide",
    data: { title: "タイトル", subtitle: "サブタイトル" },
  })
  // ... スライドを追加
  .slide({
    layout: "end-slide",
    data: { title: "Thank You" },
  });

// ビルド
const result = await deck.build();

// バリデーション確認
if (!result.isValid) {
  console.error("バリデーションエラー:");
  for (const v of result.validations) {
    if (v.severity === "error") {
      console.error(`  [${v.severity}] p${v.slideIndex + 1} ${v.placeholder}: ${v.message}`);
    }
  }
  process.exit(1);
}

const warnings = result.validations.filter((v) => v.severity === "warning");
if (warnings.length > 0) {
  console.warn("警告:");
  for (const w of warnings) {
    console.warn(`  [warn] p${w.slideIndex + 1} ${w.placeholder}: ${w.message}`);
  }
}

// 出力
const basePath = new URL(".", import.meta.url).pathname;
await result.toPptxFile(`${basePath}{deck-name}.pptx`);
await result.toHtmlFile(`${basePath}{deck-name}.html`);
console.log("生成完了!");
```

### Step 3 - 実行と出力

```bash
bun examples/output/{deck-name}.ts
```

- エラーが出た場合は修正して再実行 (最大 3 回)
- 警告は内容を確認し、必要に応じて修正

### Step 4 - プレビューと報告

生成完了後、ユーザーに以下を報告する:

- 生成されたファイルのパス一覧
- 総スライド枚数とレイアウト構成
- 警告があればその内容
- HTML ファイルを `open` コマンドでブラウザプレビューする提案

## 利用可能なレイアウト (10 種)

| レイアウト | data のキー | 用途 |
|:---|:---|:---|
| `title-slide` | `title`, `subtitle` | 表紙 |
| `section-header` | `title` | セクション区切り |
| `content` | `title`, `body` | タイトル + 本文 |
| `bullets` | `title`, `body` (BulletList) | 箇条書き |
| `table` | `title`, `table` (TableContent) | テーブル |
| `code` | `title`, `code` (CodeContent) | コードブロック |
| `two-column` | `title`, `left`, `right` | 2 カラム比較 |
| `content-image` | `title`, `body`, `image` | テキスト + 画像 |
| `image-full` | `title`, `image` | フル画像 |
| `end-slide` | `title` | エンドスライド |

## コンテンツ型リファレンス

### テキスト (string または TextContent)

```typescript
// シンプルなテキスト
"プレーンテキスト"

// リッチテキスト
{ type: "text", value: [
  { text: "太字部分", style: { bold: true } },
  { text: " と通常テキスト" }
]}
```

### 箇条書き (BulletList)

```typescript
{
  type: "bullet",
  items: [
    { text: "項目 1" },
    { text: "項目 2", children: [{ text: "子項目" }] },
    { text: "項目 3" },
  ],
  ordered: false, // true で番号付きリスト
}
```

### テーブル (TableContent)

```typescript
{
  type: "table",
  headers: ["列 1", "列 2", "列 3"],
  rows: [
    ["データ A", "データ B", "データ C"],
    ["データ D", "データ E", "データ F"],
  ],
  style: { headerFill: "#2B579A", headerColor: "#fff" },
}
```

### コード (CodeContent)

```typescript
{
  type: "code",
  code: "const greeting = 'Hello, World!';",
  language: "typescript",
}
```

### 画像 (ImageContent)

```typescript
{
  type: "image",
  path: "/path/to/image.png",
  alt: "画像の説明",
  sizing: "contain", // "contain" | "cover"
}
```

## オプション機能

### グラデーション背景

```typescript
deck.slide({
  layout: "content",
  data: { title: "タイトル", body: "本文" },
  background: {
    type: "gradient",
    colors: ["#FF6B6B", "#4ECDC4"],
    direction: "horizontal",
  },
});
```

### スピーカーノート

```typescript
deck.slide({
  layout: "content",
  data: { title: "タイトル", body: "本文" },
  notes: "ここで重要なポイントを強調する",
});
```

## カスタムマスターの利用

既存の PPTX テンプレートを使いたい場合:

1. **Master Editor** (`bun run src/tools/master-editor/master-editor.ts`) で PPTX をインポート
2. 「Export Code」で TypeScript マスター定義コードを取得
3. 生成コードを DeckSpec に組み込んで使用

```typescript
// Master Editor で生成したカスタムマスターを使う場合
const theme = gensmark.defineTheme({ name: "custom", colors: { /* ... */ }, fonts: { /* ... */ } });
const master = gensmark.defineMaster({ name: "custom", theme, layouts: { /* ... */ } });

const deck = gensmark.create({ master }).slide({ /* ... */ });
```

## ルール

- ランタイムは必ず `bun` を使用する (`bun <file>` で実行)
- 出力先は `examples/output/` ディレクトリ
- import パスは `../../src/index.ts` (examples/output/ からの相対パス)
- CJK テキストは英語の半分程度の文字数を目安にする (Keynote 互換)
- `two-column` レイアウトのフォントは 12pt 相当のため文字量を控えめに
- テーマ指定がない場合は `default` (ライト) を使用
- 出力形式の指定がない場合は HTML + PPTX の両方を生成
- ファイル名はユーザーの要望から適切な kebab-case 名を付ける
- バリデーションエラーは必ず修正してから最終出力する

## Examples

### 基本的なプレゼン生成

ユーザー: 「AI スタートアップの投資家向けピッチデッキを作って」

1. テーマ: default、構成: 表紙 + 課題 + ソリューション + 市場 + ビジネスモデル + チーム + 締め
2. `examples/output/ai-startup-pitch.ts` を作成
3. `bun examples/output/ai-startup-pitch.ts` で実行
4. `examples/output/ai-startup-pitch.pptx` と `.html` を生成

### ダークテーマ + PDF 出力

ユーザー: 「技術勉強会の発表スライドをダークテーマで PDF で出して」

1. テーマ: dark、出力: HTML + PPTX + PDF
2. `gensmark.presets.themes.dark` を使用
3. `result.toPdfFile()` も追加して 3 形式出力

### テーブルやコードを含むスライド

ユーザー: 「API 比較表とサンプルコードを含んだ技術資料を作りたい」

1. `table` レイアウトで比較表、`code` レイアウトでサンプルコード
2. `bullets` で要点整理、`two-column` で Pros/Cons 比較
