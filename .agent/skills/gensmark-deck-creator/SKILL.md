---
name: gensmark-deck-creator
description: >
  クライアントの意図をヒアリングし、ページ単位の Markdown Spec を作成、
  必要な画像を Nano Banana Pro で生成し、gensmark API で編集可能な
  PPTX スライドデッキを出力する。「スライドを作りたい」「プレゼン資料を作って」
  「デッキを生成して」といった要求で発動する。
---

# gensmark デッキクリエイター

クライアントの意図とコンテンツから、商用品質の PPTX スライドデッキを生成するワークフロー。

## ワークフロー (7 フェーズ)

### Phase 1 - ヒアリング

ユーザーから以下を収集する。不足があれば質問して補完する。

- **目的・対象者**: 誰に何を伝えるプレゼンか
- **キーメッセージ**: 聴衆に持ち帰ってほしいポイント (3 点以内)
- **素材**: テキスト / データ / 既存ドキュメント (あれば貼ってもらう)
- **視覚的トーン**: フォーマル / カジュアル / テック / ミニマル
- **テーマ**: `default` (ライト) / `dark` / カスタム
- **画像の方向性**: 写真風 / イラスト / アイコン / 不要
- **ページ数の目安**: 省略時はコンテンツ量から自動判断

構成パターンの参考:
| パターン | 典型的な流れ |
|---|---|
| 営業提案 | 表紙 → 会社概要 → 課題 → ソリューション → 実績 → 料金 → 次のステップ → 締め |
| 技術発表 | 表紙 → 背景 → アーキテクチャ → デモ → ベンチマーク → まとめ |
| 社内報告 | 表紙 → サマリ → 進捗 → 課題/リスク → 次のアクション → 締め |
| 教育/研修 | 表紙 → 目次 → トピック x N → まとめ → Q&A |
| 自由形式 | 表紙 → コンテンツ x N → 締め |

### Phase 2 - ストーリーライン設計 (承認ゲート 1)

全体構成のアウトラインを Markdown テーブルで提示する。

```markdown
| # | レイアウト | 役割 | 概要 |
|---|---|---|---|
| 1 | title-slide | 表紙 | タイトルとサブタイトル |
| 2 | section-header | セクション | 第1章の区切り |
| ... | ... | ... | ... |
```

ユーザー承認を得てから次へ進む。修正があればここで反映する。

### Phase 3 - ページ Spec 作成 (承認ゲート 2)

`references/page-spec-format.md` に従い、各ページの詳細 Spec を作成する。

- レイアウト選択は `references/layout-guide.md` を参照
- 各プレースホルダーの文字量ガイドを守る
- CJK テキストは幅が広いため、英語の半分程度の文字数を目安にする
- 全ページ分を `output/{deck-name}/page-specs.md` に保存

ユーザーに全ページ Spec を提示し、承認を得てから次へ進む。

### Phase 4 - 画像生成 (承認ゲート 3)

`references/image-strategy.md` に従い、画像生成を行う。

1. 全ページの Spec を横断分析し、画像が必要なページをリストアップ
2. 画像生成リストを提示 (ページ番号、目的、プロンプト案、アスペクト比)
3. ユーザー承認後、Nano Banana Pro (`/nano-banana-image:generate`) で生成
4. `output/{deck-name}/images/` に保存

画像が不要なデッキ (箇条書き・テーブル中心) の場合はこのフェーズをスキップする。

### Phase 5 - DeckSpec 組み立て

ページ Spec + 生成画像を統合して TypeScript の DeckSpec を生成する。

出力先: `output/{deck-name}/deck-spec.ts`

DeckSpec は以下の構造に正確に準拠すること:

```typescript
import { gensmark } from "../../src/index.ts";

// テーマとマスターの設定
const theme = gensmark.presets.themes.default; // or .dark
const master = gensmark.presets.standardMaster(theme);

// デッキの組み立て
const deck = gensmark
  .create({ master })
  .slide({
    layout: "title-slide",
    data: {
      title: "タイトル",
      subtitle: "サブタイトル",
    },
    notes: "発表者ノート",
  })
  // ... 残りのスライド
  ;

// ビルド & 出力
const result = await deck.build();

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

const outputPath = new URL("./output/{deck-name}.pptx", import.meta.url).pathname;
await result.toPptxFile(outputPath);
console.log(`生成完了: ${outputPath}`);
```

重要な型の対応:
- `string` → そのまま文字列
- `TextContent` → `{ type: "text", value: "テキスト\n改行あり" }`
- `BulletList` → `{ type: "bullet", items: [{ text: "項目", children: [...] }] }`
- `BulletList (ordered)` → `{ type: "bullet", ordered: true, items: [...] }`
- `TableContent` → `{ type: "table", headers: [...], rows: [[...], ...], style: {...} }`
- `CodeContent` → `{ type: "code", code: "...", language: "typescript" }`
- `ImageContent` → `{ type: "image", path: "./images/xxx.png", sizing: "contain" }`
- `MermaidContent` → `{ type: "mermaid", code: "graph TD; ..." }`

### Phase 6 - コンパイル & 品質反復

`references/quality-iteration.md` に従い、品質ゲートを通す。

1. `bun output/{deck-name}/deck-spec.ts` を実行
2. エラー/警告を分析し修正
3. 最大 3 回の反復で `standard` プロファイルを通す

品質確認を行う場合は `gensmark.compile()` を使用:

```typescript
import { gensmark } from "../../src/index.ts";

const result = await gensmark.compile(spec, { profile: "standard" });
console.log("品質ゲート:", result.quality.isPassing ? "PASS" : "FAIL");
for (const f of result.quality.findings) {
  console.log(`  [${f.severity}] ${f.code}: ${f.message}`);
}
```

### Phase 7 - 出力 & 報告

完成した成果物をユーザーに報告する。

出力ファイル一覧:
- `output/{deck-name}/{deck-name}.pptx` - 完成 PPTX
- `output/{deck-name}/deck-spec.ts` - DeckSpec ソース
- `output/{deck-name}/page-specs.md` - ページ Spec
- `output/{deck-name}/images/` - 生成画像 (あれば)

報告内容:
- 総ページ数とレイアウト構成
- 品質ゲート結果 (pass/fail、警告があれば内容)
- 画像の枚数と配置先
- PPTX ファイルパス

## 一次ソース参照リスト

スキル実行時に参照すべき gensmark の主要ファイル:

| ファイル | 内容 |
|---|---|
| `src/index.ts` | パブリック API (`gensmark.compile`, `gensmark.create`, `gensmark.presets`) |
| `src/types/content.ts` | `SlideContent`, `PlaceholderValue` の型定義 |
| `src/types/spec.ts` | `DeckSpec` 型 (`{ master, slides, aspectRatio? }`) |
| `src/types/quality.ts` | `QualityProfile` (`"draft" \| "standard" \| "strict"`), `QualityReport` |
| `src/master/presets/standard.ts` | 全 10 レイアウトのプレースホルダー定義 |
| `src/compiler/compile.ts` | コンパイルパイプライン (`compileDeck`) |
| `src/import/pptx-template-importer.ts` | PPTX テンプレートインポート (`importPptxTemplate`) |
| `src/tools/master-editor/master-editor.ts` | Master Editor GUI (マスター確認 + コード生成) |
| `examples/sales-deck.ts` | 20 ページの DeckSpec 実例 (全レイアウト使用) |

## 参照ドキュメント

必要に応じて以下を読み込む:

- `references/page-spec-format.md` - ページ Spec の Markdown フォーマット定義
- `references/layout-guide.md` - 10 レイアウトの選択ガイドとプレースホルダー対応表
- `references/image-strategy.md` - 画像生成の判断基準とプロンプト戦略
- `references/quality-iteration.md` - 品質ゲート反復の手順

## カスタムマスター (PPTX インポート)

既存の PPTX テンプレートをベースにしたデッキを作成する場合:

1. **Master Editor GUI で確認**: `bun run src/tools/master-editor/master-editor.ts` を起動し、PPTX をインポートしてレイアウト配置を視覚確認する
2. **TypeScript コード生成**: Master Editor の「Export Code」でマスター定義コードを取得する
3. **DeckSpec に組み込み**: 生成されたマスター定義を使って DeckSpec を構築する

```typescript
// Master Editor で生成したコードをそのまま使用
import { gensmark, ph } from "gensmark";

const theme = gensmark.defineTheme({ /* ... */ });
const master = gensmark.defineMaster({ /* ... */ });

const deck = gensmark.create({ master }).slide({ /* ... */ });
```

PPTX インポートは `importPptxTemplate()` API でもプログラム的に実行可能:

```typescript
import { importPptxTemplate } from "../../src/import/pptx-template-importer.ts";
const result = await importPptxTemplate({ path: "template.pptx" });
// result.master に SlideMaster が入る
```

## 注意事項

- DeckBuilder API は `.slide()` をチェーンする形式。`DeckSpec` を直接構築する場合は `gensmark.compile()` を使う
- テーマは `gensmark.presets.themes.default` (ライト) と `gensmark.presets.themes.dark` の 2 種類がビルトイン
- カスタムテーマは `gensmark.defineTheme()` で定義可能。Master Editor でインポートしたテーマも利用できる
- CJK テキストは Keynote で幅が広くなるため、文字量ガイドを厳守する
- 画像パスは DeckSpec からの相対パスまたは絶対パスで指定
- `two-column` レイアウトのフォントサイズは 12pt (CJK 対応で縮小済み)
