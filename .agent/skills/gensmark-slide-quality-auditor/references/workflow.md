# 監査ワークフロー (ゲート順)

目的は「原因を一次ソースで説明できる形にしてから」修正し、回帰を入口で止めること。

## 0. 前提を確認する

1. 実行基盤が Bun であることを前提にする。
2. 生成の主経路は `DeckBuilder.build()` と `gensmark.compile()` の 2 系統があることを理解する。
3. Mermaid を扱う場合は `gensmark.compile()` を使う。

一次ソース:
- `src/index.ts`（公開 API: `compile` / `autofix`）
- `src/core/slide-resolver.ts`（Mermaid が build 経由だと error になる）
- `src/compiler/compile.ts`（asset 解決を含むコンパイルパイプライン）

## 1. ベースラインゲートを通す

最初に「壊れていない」状態を作る。

1. `bun run lint`
2. `bun test`

## 2. 視覚ゲートを通す (Visual Regression)

1. `bun run test:visual`
2. 失敗したら `tests/visual/diff` を見て差分の性質を分類する。
3. 変更が意図通りなら golden を更新する。意図と違うなら修正する。

詳細は `visual-regression.md` を読む。

## 3. strict 品質ゲートを通す (QualityReport)

品質ゲートは「error が無い」だけでは足りない。`QualityReport.isPassing` を合否に使う。

1. 再現用の最小 `DeckSpec` を作る。
2. `gensmark.compile(spec, { profile: "strict" })` を実行し、`quality.findings` と `validations` を確認する。
3. `compile.build.isValid` が false の場合は構造/レイアウトを先に直す。
4. `compile.build.isValid` が true でも `quality.isPassing` が false の場合は Quality ルールの違反を潰す。

一次ソース:
- `src/compiler/compile.ts`（`build` と `quality` を同時に返す）
- `src/compiler/quality-evaluator.ts`（strict の failingReasons）
- `src/types/quality.ts`（QualityReport/QualityFinding）

## 4. 自律修正ループを確認する (Autofix)

修正は「人間の目の調整」ではなく「決定論的な変換」で閉じることを優先する。

1. `gensmark.autofix(spec, { profile: "strict", maxIterations: N })` を実行する。
2. `attempts[]` の `appliedFixes` が意味のある操作になっているか確認する。
3. 収束しない場合は、品質ルールか決定論 fix の不足として扱い、ルール/変換を増やす。

一次ソース:
- `src/compiler/autofix.ts`（決定論 fix と LLM フォールバックの境界）

## 5. Definition of Done (DoD)

最低限の完了条件を固定する。

1. `bun run lint` が通る。
2. `bun test` が通る。
3. `bun run test:visual` が通る。
4. `gensmark.compile(..., { profile: "strict" })` で `quality.isPassing === true` になる再現 spec がある。
5. 回帰を防ぐテストが追加されている（unit か visual のどちらか、必要なら両方）。

