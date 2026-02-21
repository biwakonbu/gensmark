# ページ Spec フォーマット定義

各ページの Markdown Spec は以下のフォーマットで記述する。

## テンプレート

```markdown
## Page [N]: [ページタイトル]

### Intent
- 目的: [このページで何を伝えるか]
- インサイト: [聴衆が得るべき理解]

### Layout
- 選択: [layout 名]
- 理由: [なぜこのレイアウトか]

### Content
#### [placeholder 名]
[コンテンツ。PlaceholderValue の型に対応する記法で記述]

### Image
- 必要: [yes/no]
- 配置先: [placeholder 名]
- 目的: [情報補強/概念図解/雰囲気演出]
- プロンプト案: [Nano Banana Pro 向けプロンプト]
- アスペクト比: [16:9/1:1/4:3]

### Notes
[発表者ノート]
```

## Content セクションの記法ルール

Markdown 記法から `PlaceholderValue` 型への変換ルールを以下に定める。

### プレーンテキスト → `string`

```markdown
#### title
CloudFlow プラットフォーム
```

変換結果:
```typescript
title: "CloudFlow プラットフォーム"
```

### 改行付きテキスト → `TextContent`

```markdown
#### body
CloudFlow Inc. は 2019 年に設立されたクラウド SaaS 企業です。
「すべての業務をシンプルに」をミッションに掲げています。

本社: 東京都港区  |  従業員数: 320名
```

変換結果:
```typescript
body: {
  type: "text",
  value: "CloudFlow Inc. は 2019 年に設立されたクラウド SaaS 企業です。\n" +
         "「すべての業務をシンプルに」をミッションに掲げています。\n\n" +
         "本社: 東京都港区  |  従業員数: 320名"
}
```

### 箇条書き → `BulletList`

```markdown
#### body
- CloudFlow Automate - ワークフロー自動化エンジン
  - ノーコードで業務フローを設計・実行
  - 200以上の外部サービスと連携
- CloudFlow Analytics - リアルタイム分析
  - KPI の自動追跡と異常検知
```

変換結果:
```typescript
body: {
  type: "bullet",
  items: [
    {
      text: "CloudFlow Automate - ワークフロー自動化エンジン",
      children: [
        { text: "ノーコードで業務フローを設計・実行" },
        { text: "200以上の外部サービスと連携" },
      ],
    },
    {
      text: "CloudFlow Analytics - リアルタイム分析",
      children: [
        { text: "KPI の自動追跡と異常検知" },
      ],
    },
  ],
}
```

### 番号リスト → `BulletList (ordered)`

```markdown
#### body
1. ヒアリング (1週間)
   - 現状の業務フローと課題をヒアリング
2. PoC 実施 (2週間)
   - 実データで効果を検証
```

変換結果:
```typescript
body: {
  type: "bullet",
  ordered: true,
  items: [
    {
      text: "ヒアリング (1週間)",
      children: [{ text: "現状の業務フローと課題をヒアリング" }],
    },
    {
      text: "PoC 実施 (2週間)",
      children: [{ text: "実データで効果を検証" }],
    },
  ],
}
```

### テーブル → `TableContent`

```markdown
#### table
| 年度 | 市場規模 (億円) | 前年比 |
|---|---|---|
| 2023 | 5,900 | +22.9% |
| 2024 | 7,400 | +25.4% |
```

変換結果:
```typescript
table: {
  type: "table",
  headers: ["年度", "市場規模 (億円)", "前年比"],
  rows: [
    ["2023", "5,900", "+22.9%"],
    ["2024", "7,400", "+25.4%"],
  ],
  style: {
    headerFill: "#2B579A",
    headerColor: "#ffffff",
    altRowFill: "#f0f6ff",
  },
}
```

### コードブロック → `CodeContent`

````markdown
#### code
```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```
````

変換結果:
```typescript
code: {
  type: "code",
  code: 'function greet(name: string): string {\n  return `Hello, ${name}!`;\n}',
  language: "typescript",
}
```

### 画像参照 → `ImageContent`

```markdown
#### image
![プラットフォーム概要図](./images/platform-overview.png)
sizing: contain
```

変換結果:
```typescript
image: {
  type: "image",
  path: "./images/platform-overview.png",
  alt: "プラットフォーム概要図",
  sizing: "contain",
}
```

## 変換ルール早見表

| Markdown 記法 | PlaceholderValue 型 | 判定条件 |
|---|---|---|
| プレーンテキスト (1 行) | `string` | 改行なし |
| 改行付きテキスト | `TextContent` (`type: "text"`) | `\n` を含む |
| `- item` の箇条書き | `BulletList` (`type: "bullet"`) | `-` で始まる行 |
| `1. item` の番号リスト | `BulletList` (`ordered: true`) | `1.` で始まる行 |
| `\| h1 \| h2 \|` の表 | `TableContent` (`type: "table"`) | `\|` 区切り |
| ` ```lang ` コードブロック | `CodeContent` (`type: "code"`) | フェンスドコード |
| `![alt](path)` 画像参照 | `ImageContent` (`type: "image"`) | 画像記法 |

## 完成例

```markdown
## Page 1: 表紙

### Intent
- 目的: プレゼンテーションの導入。企業名とサービスを印象付ける
- インサイト: 「CloudFlow は業務効率化プラットフォームである」

### Layout
- 選択: title-slide
- 理由: デッキの最初のページ

### Content
#### title
CloudFlow

#### subtitle
クラウド業務効率化プラットフォーム

### Image
- 必要: no

### Notes
営業資料 表紙。CloudFlow のブランド名とキャッチコピーを提示。
```

```markdown
## Page 4: 主要サービス

### Intent
- 目的: CloudFlow の 4 つの主要サービスを概観する
- インサイト: 自動化・分析・コラボ・セキュリティの 4 本柱

### Layout
- 選択: bullets
- 理由: 箇条書きで複数サービスを列挙

### Content
#### title
主要サービス

#### body
- CloudFlow Automate - ワークフロー自動化エンジン
  - ノーコードで業務フローを設計・実行
  - 200以上の外部サービスと連携
- CloudFlow Analytics - リアルタイム分析
  - KPI の自動追跡と異常検知
- CloudFlow Connect - チーム間コラボ基盤
  - プロジェクト横断のタスク管理
- CloudFlow Security - エンタープライズセキュリティ
  - SOC 2 Type II / ISO 27001 準拠

### Image
- 必要: no

### Notes
4 つのサービスラインの概要を説明。各サービスの詳細は後続ページで。
```
