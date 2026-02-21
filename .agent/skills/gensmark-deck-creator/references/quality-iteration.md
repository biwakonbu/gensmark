# 品質ゲート反復手順

DeckSpec をコンパイルし、品質ゲートを通すための反復手順。

## 基本フロー

```
deck-spec.ts 実行 → エラー確認 → 修正 → 再実行 (最大 3 回)
```

### Step 1: 初回実行

```bash
bun output/{deck-name}/deck-spec.ts
```

成功すれば PPTX が生成される。エラーや警告があればコンソールに出力される。

### Step 2: エラー分類

出力を確認し、問題を以下のカテゴリに分類:

| カテゴリ | 出力例 | 深刻度 |
|---|---|---|
| 構造エラー | `[error] p3 body: unknown-layout "contnet"` | error (ビルド不可) |
| プレースホルダーエラー | `[error] p3 image: unknown-placeholder` | error (ビルド不可) |
| overflow | `[warn] p5 body: overflow detected` | warning |
| min-font-size | `[warn] p5 body: font shrunk below minimum` | warning |
| 画像パスエラー | `[error] p8 image: file not found` | error |

### Step 3: 修正アクション

#### 構造エラー (layout 名/placeholder 名の間違い)

有効な layout 名 (10 種):
```
title-slide, section-header, content, two-column,
content-image, image-full, bullets, table, code, end-slide
```

各 layout のプレースホルダー名:
- `title-slide`: `title`, `subtitle`
- `section-header`: `title`
- `content`: `title`, `body`
- `two-column`: `title`, `left`, `right`
- `content-image`: `title`, `body`, `image`
- `image-full`: `title`, `image`
- `bullets`: `title`, `body`
- `table`: `title`, `table`
- `code`: `title`, `code`
- `end-slide`: `title`

#### overflow (テキスト量過多)

対策の優先順:
1. **テキスト短縮**: 冗長な表現を削除、要点のみに絞る
2. **文字数ガイド内に収める**: `layout-guide.md` の文字量目安を参照
3. **レイアウト変更**: `content` → `bullets` (箇条書きに変換) など
4. **ページ分割**: 1 ページの内容を 2 ページに分ける

#### min-font-size (shrink で縮みすぎ)

対策の優先順:
1. **コンテンツ削減**: 項目数を減らす、子項目を削除
2. **レイアウト変更**: より広いプレースホルダーを持つレイアウトへ
3. **ページ分割**: 内容を 2 ページに分ける

#### 画像パスエラー

- パスが正しいか確認 (deck-spec.ts からの相対パス)
- 画像ファイルが実際に存在するか確認
- 絶対パスを使用する場合は `import.meta.url` ベースで解決

### Step 4: 再実行

修正後、再度実行:

```bash
bun output/{deck-name}/deck-spec.ts
```

### Step 5: 品質プロファイル確認 (オプション)

より厳密な品質チェックが必要な場合、`gensmark.compile()` を使用:

```typescript
import { gensmark } from "../../src/index.ts";

// DeckSpec を直接構築
const spec = {
  master: gensmark.presets.standardMaster(gensmark.presets.themes.default),
  slides: [/* ... */],
};

const result = await gensmark.compile(spec, { profile: "standard" });

console.log("品質ゲート:", result.quality.isPassing ? "PASS" : "FAIL");

if (!result.quality.isPassing) {
  console.log("失敗理由:");
  for (const reason of result.quality.failingReasons) {
    console.log(`  - ${reason}`);
  }
}

for (const f of result.quality.findings) {
  console.log(`  [${f.severity}] ${f.code}: ${f.message}`);
}
```

## 品質プロファイルの違い

| プロファイル | overflow | min-font-size | 用途 |
|---|---|---|---|
| `draft` | warning (許容) | warning (許容) | 開発中の確認 |
| `standard` | warning → fail | warning → fail | 通常の品質基準 |
| `strict` | error | error | 商用品質 |

デッキクリエイターでは **`standard`** を品質基準とする。

## よくある問題と対策

| 問題 | 原因 | 対策 |
|---|---|---|
| overflow | テキスト量過多 | 文字数をガイド内に収める |
| min-font-size | shrink で縮みすぎ | ページ分割 or レイアウト変更 |
| image-not-found | パスの誤り | 絶対パスで `import.meta.url` ベース |
| unknown-layout | layout 名タイポ | 上記 10 レイアウトから選択 |
| unknown-placeholder | placeholder 名タイポ | 各 layout の正しい名前を使用 |
| type-mismatch | 型の不一致 | `layout-guide.md` の型対応を確認 |

## 反復の打ち切り条件

- 3 回の反復で `standard` を通せない場合:
  1. 残っている問題をユーザーに報告
  2. 修正方針の承認を得る (テキスト削減 or ページ追加)
  3. 追加反復を行う

- どうしても通らない場合は `draft` プロファイルで出力し、品質レポートを添えて納品
