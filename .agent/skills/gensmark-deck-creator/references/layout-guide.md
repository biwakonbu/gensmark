# レイアウト選択ガイド

gensmark standard マスターが提供する全 10 レイアウトの詳細。

## プレースホルダー対応表

| Layout | Placeholders | 用途 | 文字量目安 |
|---|---|---|---|
| `title-slide` | `title`, `subtitle` | 表紙 | title: CJK 20 字 / EN 40 字, subtitle: 1 行 |
| `section-header` | `title` | セクション区切り | title: CJK 30 字 / EN 60 字 |
| `content` | `title`, `body` | テキスト説明 | body: CJK 150 字 / EN 300 字 |
| `two-column` | `title`, `left`, `right` | 比較・対照 | 各カラム: 5 項目 x CJK 20 字 (12pt) |
| `content-image` | `title`, `body`, `image` | テキスト + 画像 | body: 半幅、CJK 80 字 / EN 150 字 |
| `image-full` | `title`, `image` | 画像メイン | title: 1 行のみ |
| `bullets` | `title`, `body` | 箇条書き | 6 項目 (子含め各 CJK 30 字 / EN 50 字) |
| `table` | `title`, `table` | データ表 | 7 行 x 4 列以下推奨 |
| `code` | `title`, `code` | コード表示 | 20 行以下 |
| `end-slide` | `title` | 締め・感謝 | title: 2 行以内 |

## 各レイアウトの詳細

### 1. `title-slide`

デッキの表紙。プライマリカラーの太い左バーとアクセントラインが特徴。

- **title**: fontSize 44pt, align left, primary カラー, maxLines 3, shrink (min 28pt)
- **subtitle**: fontSize 22pt, align left, secondary カラー
- **背景**: ソリッド (background カラー)
- **PlaceholderValue の型**: `title` → `string`, `subtitle` → `string`

### 2. `section-header`

セクション区切り。プライマリカラー背景に白テキスト。

- **title**: fontSize 40pt, align center, 白テキスト
- **背景**: ソリッド (primary カラー)
- **PlaceholderValue の型**: `title` → `string`

### 3. `content`

汎用テキストレイアウト。タイトル + 本文。

- **title**: fontSize 28pt
- **body**: fontSize 16pt, lineSpacing 1.5
- **PlaceholderValue の型**: `title` → `string`, `body` → `string | TextContent | BulletList`

### 4. `two-column`

2 カラム比較レイアウト。カラム間に区切り線あり。

- **title**: fontSize 28pt
- **left**: fontSize 12pt, lineSpacing 1.5, 半幅 (約 5.42in)
- **right**: fontSize 12pt, lineSpacing 1.5, 半幅 (約 5.42in)
- **PlaceholderValue の型**: `title` → `string`, `left` → `string | TextContent | BulletList`, `right` → `string | TextContent | BulletList`
- **注意**: CJK テキストは 12pt で幅が広くなるため、各項目 20 字以内を推奨

### 5. `content-image`

テキストと画像の並列レイアウト。左にテキスト、右に画像。

- **title**: fontSize 28pt
- **body**: fontSize 16pt, lineSpacing 1.5, 半幅
- **image**: 半幅 x 全高
- **PlaceholderValue の型**: `title` → `string`, `body` → `string | TextContent | BulletList`, `image` → `ImageContent`
- **画像推奨**: sizing `"contain"`, アスペクト比 4:3 or 1:1

### 6. `image-full`

画像をメインにしたレイアウト。タイトルは 1 行のみ。

- **title**: fontSize 22pt, maxLines 1
- **image**: y 1.3, height 5.7 (ほぼ全画面)
- **PlaceholderValue の型**: `title` → `string`, `image` → `ImageContent`
- **画像推奨**: sizing `"cover"`, アスペクト比 16:9

### 7. `bullets`

箇条書き専用レイアウト。shrink あり。

- **title**: fontSize 28pt
- **body**: fontSize 16pt, lineSpacing 1.5, overflow shrink (min 10pt)
- **PlaceholderValue の型**: `title` → `string`, `body` → `BulletList`
- **推奨**: 親項目 6 つ以内、子項目は 2-3 個まで

### 8. `table`

テーブルレイアウト。プレースホルダー名は `table`。

- **title**: fontSize 28pt
- **table**: fontSize 16pt, lineSpacing 1.5
- **PlaceholderValue の型**: `title` → `string`, `table` → `TableContent`
- **推奨**: 7 行 x 4 列以下、ヘッダー付き、style でカラーリング

### 9. `code`

コード表示レイアウト。プレースホルダー名は `code`。

- **title**: fontSize 24pt
- **code**: fontSize 14pt
- **PlaceholderValue の型**: `title` → `string`, `code` → `CodeContent`
- **推奨**: 20 行以下、language を明示

### 10. `end-slide`

締めスライド。プライマリカラー背景に白テキスト。

- **title**: fontSize 48pt, align center, valign middle, 白テキスト, maxLines 2, shrink
- **背景**: ソリッド (primary カラー)
- **PlaceholderValue の型**: `title` → `string`

## 意図 → レイアウト デシジョンツリー

ページの意図に応じて以下の順で判定する:

1. デッキの最初のページ → **`title-slide`**
2. セクションの区切り → **`section-header`**
3. 画像がメインコンテンツ → **`image-full`**
4. テキストと画像を並べたい → **`content-image`**
5. 2 つの概念を比較・対照 → **`two-column`**
6. 箇条書きが最適 → **`bullets`**
7. 数値データや比較表 → **`table`**
8. ソースコードを表示 → **`code`**
9. 上記いずれでもないテキスト → **`content`**
10. デッキの最後 → **`end-slide`**

## テーマカラー参照

### default テーマ
- primary: `#2B579A` (濃紺)
- secondary: `#5B9BD5` (青)
- background: `#FFFFFF` (白)

### dark テーマ
- primary: カスタム暗色
- secondary: カスタム
- background: 暗色

テーブルのスタイル例:
```typescript
style: {
  headerFill: "#2B579A",   // ヘッダー背景
  headerColor: "#ffffff",  // ヘッダー文字色
  altRowFill: "#f0f6ff",   // 交互行背景
}
```
