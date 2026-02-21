# 画像生成戦略

gensmark デッキにおける画像生成の判断基準、プロンプト構築、配置ガイド。

## 画像が必要なレイアウト

| レイアウト | 画像必要度 | 理由 |
|---|---|---|
| `content-image` | **必須** | `image` プレースホルダーが存在 |
| `image-full` | **必須** | `image` プレースホルダーがメインコンテンツ |
| `title-slide` | 推奨 | ヒーロービジュアルがあると印象的 (背景画像として) |
| `content` | 不要 | テキストのみ |
| `two-column` | 不要 | テキスト比較用 |
| `bullets` | 不要 | 箇条書き用 |
| `table` | 不要 | データ表用 |
| `code` | 不要 | コード表示用 |
| `section-header` | 不要 | テキストのみ |
| `end-slide` | 不要 | テキストのみ |

## Nano Banana Pro 呼び出し

画像生成には `/nano-banana-image:generate` スキルを使用する。

```
/nano-banana-image:generate "[プロンプト]" --aspect [比率] --resolution 2K
```

## プロンプト構築テンプレート

```
[スタイル], [主題], [コンテキスト/雰囲気], [品質指定]
```

### スタイルの選択肢

| 視覚的トーン | 推奨スタイル指定 |
|---|---|
| フォーマル | `professional corporate photography`, `clean minimalist` |
| カジュアル | `friendly illustration`, `colorful flat design` |
| テック | `futuristic tech visualization`, `digital abstract`, `circuit board aesthetic` |
| ミニマル | `minimal flat illustration`, `simple geometric shapes`, `whitespace-focused` |

### プロンプト例

**営業資料の表紙ヒーロー画像**:
```
professional corporate photography, modern office building with glass facade,
blue sky and clouds, warm sunlight, high quality, 4K resolution
```

**テクノロジー概念図**:
```
futuristic tech visualization, interconnected nodes and data streams,
blue and white color scheme, clean digital aesthetic, high quality
```

**チームコラボレーション**:
```
friendly illustration, diverse team collaborating around a digital dashboard,
bright colors, flat design style, professional atmosphere
```

## アスペクト比の選択

| レイアウト | 推奨アスペクト比 | 理由 |
|---|---|---|
| `image-full` | **16:9** | image プレースホルダー: y=1.3, h=5.7 → ほぼ全画面 |
| `content-image` | **4:3** or **1:1** | image プレースホルダー: 半幅 (約 5.42in) x 全高 (5.3in) |
| `title-slide` (背景) | **16:9** | スライド全体 (13.33 x 7.5) |

## ImageContent の sizing 設定

| レイアウト | 推奨 sizing | 効果 |
|---|---|---|
| `content-image` | `"contain"` | プレースホルダー内に余白ありで全体表示 |
| `image-full` | `"cover"` | プレースホルダーを埋めるようにクロップ |

## 画像ファイルの管理

- 保存先: `output/{deck-name}/images/`
- ファイル名規則: `p{ページ番号}-{用途}.png` (例: `p5-hero.png`, `p8-architecture.png`)
- 形式: PNG (Nano Banana Pro のデフォルト出力)

## 画像生成リストのフォーマット

Phase 4 でユーザーに提示するリスト:

```markdown
| # | ページ | 配置先 | 目的 | プロンプト案 | アスペクト比 |
|---|---|---|---|---|---|
| 1 | p1 | 背景 | ヒーロービジュアル | professional corporate... | 16:9 |
| 2 | p5 | image | アーキテクチャ図 | tech visualization... | 4:3 |
```

## テーマカラーとの整合

画像がテーマカラーと調和するよう、プロンプトにカラー指示を含める:

- **default テーマ**: `blue and white color scheme` (primary: #2B579A)
- **dark テーマ**: `dark background with accent lighting` (暗色ベース)

ただし、コンテンツの伝達力が最優先。テーマカラーとの統一は二次的な考慮事項。
