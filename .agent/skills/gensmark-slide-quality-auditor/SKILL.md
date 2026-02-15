---
name: gensmark-slide-quality-auditor
description: gensmark のスライドコンパイラを商用品質へ近づけるための品質監査・回帰試験・自律修正ワークフロー。Overflow/可読性(min font)/Mermaid 図(レンダリング・過密/文字サイズ推定)/PPTX マスター適用/visual regression(soffice+pdftoppm+pixelmatch)/QualityReport(draft|standard|strict)/autofix を使い、原因特定→決定論修正→テスト追加→golden 更新まで進める必要があるときに使う。
---

# gensmark スライド品質監査

## 概要
gensmark を「スライドコンパイラ」として扱い、品質ゲートで合否を決める。strict を通すこと自体ではなく、strict が表現する商用品質の基準を継続的に改善することが目的。

## 最小実行（最初にやる）
1. `bun run lint`
2. `bun test`
3. `bun run test:visual`（LibreOffice と `pdftoppm` が必要。失敗時は `tests/visual/diff` と `tests/visual/output` を見る）

## ゲート順（この順で潰す）
1. 構造ゲート: `ValidationResult(severity=error)` を 0 にする。
2. レイアウトゲート: overflow を 0 にする（standard/strict では warning も失敗扱い）。
3. 品質ゲート: `QualityReport(profile)` の `isPassing` を true にする（可読性/required/Mermaid 等）。
4. 視覚ゲート: visual regression を 0 にする（pixel diff）。
5. 自律修正: `gensmark.autofix()` が `maxIterations` 内に収束することを確認する（決定論 fix を優先し、LLM は最後）。

## 主要な一次ソース（読む場所）
- `src/compiler/compile.ts`: asset 解決→resolve→layout validate→quality evaluate→render のパイプライン
- `src/compiler/quality-evaluator.ts`: QualityReport のルール（strict の合否条件）
- `src/compiler/autofix.ts`: 決定論 autofix と LLM フォールバック（ユーザー明示時のみ）
- `src/assets/asset-resolver.ts`: Mermaid のレンダリング、キャッシュ、viewBox/密度/文字サイズ推定、draw.io 風 CSS
- `scripts/visual-test.ts`: PPTX→PNG 変換と golden diff（環境変数、出力先）
- `tests/visual/fixtures.ts`: visual fixture の spec（回帰の最小集合）
- `src/core/slide-resolver.ts`: 型整合性、unknown-layout/placeholder などの構造バリデーション
- `src/layout/layout-engine.ts`: フォントパス解決と overflow 検知の統合
- `src/renderer/pptx/pptx-renderer.ts`: masterName 適用、固定要素、スライド番号配置

## 使い方（依頼を受けたら必ずやる）
1. 失敗の種類を分類する: 構造 / レイアウト / 品質 / 視覚 / Mermaid / CI のどれか。
2. 再現手段を最短化する: unit test か visual fixture か最小 spec を作る。
3. 一次ソースで原因を確定する: 関連箇所を `rg` で特定し、コードで説明できる状態にする。
4. 修正は決定論を優先する: スキーマ/ルール/ヒューリスティクスで直す。LLM は最後。
5. 回帰の入口を塞ぐ: テスト追加（unit/integration/visual）、必要なら golden 更新。
6. strict と visual の両方を通してから仕上げる。

## 参照（必要に応じて読む）
- `references/workflow.md`: 監査の手順と Definition of Done
- `references/quality.md`: QualityReport/strict の増やし方、autofix の設計規約
- `references/visual-regression.md`: visual test の前提、golden 更新手順（CI 互換）
- `references/mermaid.md`: Mermaid の美図化、過密/文字サイズゲート、分割戦略
