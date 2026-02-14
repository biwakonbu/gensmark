# Mermaid 美図 (asset 解決 + 品質ゲート + 分割)

Mermaid は「スライドのテイストに同調」「はみ出しゼロ」「可読性」を満たす必要がある。gensmark は Mermaid をコンパイル前に画像へ解決し、既存の image 経路でレイアウトさせる。

一次ソース:
- `src/types/content.ts`（`MermaidContent`）
- `src/assets/asset-resolver.ts`（レンダリングとメタ推定）
- `src/compiler/compile.ts`（`resolveAssets` の組み込み）
- `src/compiler/quality-evaluator.ts`（mermaid-min-font / mermaid-too-dense）
- `src/compiler/autofix.ts`（Mermaid の決定論 fix）
- `src/compiler/mermaid-splitter.ts`（flowchart 分割）

## 重要: Mermaid は `gensmark.compile()` で処理する

`DeckBuilder.build()` 経由だと Mermaid は未解決のままなので error になる。

一次ソース:
- `src/core/slide-resolver.ts`（MermaidContent の error）

## レンダリング戦略 (SVG/PNG)

`AssetResolveOptions.mermaidFormat`:
- `auto`: SVG 優先、失敗時 PNG
- `svg`: SVG のみ
- `png`: PNG のみ

一次ソース:
- `src/assets/asset-resolver.ts`（`mermaidFormat` と `selectEmbedPath`）

## テーマ同調 (draw.io 風)

Mermaid のテーマは以下で決める。

1. `themeVariables` にフォント/色を注入する。
2. CSS で node/edge の stroke/fill を上書きし、角丸・線幅を安定させる。
3. 背景は透明で出力する（スライド背景に同調させる）。

一次ソース:
- `src/assets/asset-resolver.ts`（`buildMermaidTheme` と `runMmdc`）

## はみ出しゼロと可読性 (推定)

SVG から `viewBox` を読み、placeholder の幅/高さに `contain` した場合のスケールを推定し、最小文字サイズ(推定 pt)を算出する。

注意:
- これはヒューリスティクスであり、PowerPoint のレンダリングと完全一致はしない。
- strict ゲートでは「小さすぎ/過密」を失敗扱いに寄せる。

一次ソース:
- `src/assets/asset-resolver.ts`（`parseViewBox` / `estimatedMinFontPt` 推定）
- `src/compiler/quality-evaluator.ts`（mermaid の strict 判定）

## 過密/小文字の自動対処 (決定論)

autofix は以下の順で対処する。

1. master の中で「最も面積が大きい image placeholder」を探し、そこへ Mermaid を移す。
2. flowchart/graph の場合は Mermaid コードを 2 分割し、スライドを 2 枚にする。

一次ソース:
- `src/compiler/autofix.ts`（`findBestImageLayout` と `splitMermaidFlowchart`）
- `src/compiler/mermaid-splitter.ts`

## Mermaid が落ちるときの典型原因

1. `mmdc` の依存（Chromium / puppeteer）が無い。
2. CI/実行環境でフォントが無い（見た目が崩れる）。
3. SVG 出力は PowerPoint の互換性で問題が出る可能性がある（必要なら PNG を既定にする）。

一次ソース:
- `src/assets/asset-resolver.ts`（エラーメッセージに `PUPPETEER_EXECUTABLE_PATH` の示唆）

