# 品質ゲート (QualityReport) と autofix 設計

## QualityReport を「合否」に使う

`ValidationResult` は「構造/レイアウト」中心で、商用品質の合否には足りない。`QualityReport` を別レイヤとして扱い、strict の合否に `quality.isPassing` を使う。

一次ソース:
- `src/types/quality.ts`
- `src/compiler/quality-evaluator.ts`

## プロファイルの役割

- `draft`: 開発者の試行錯誤を止めない。info レベル中心。
- `standard`: overflow warning 等を「品質として失敗」扱いに寄せる。
- `strict`: 商用品質の合格条件として扱う。font-not-found なども失敗理由に含める。

一次ソース:
- `src/compiler/quality-evaluator.ts`（profile ごとの severity と failingReasons）

## 既存の strict 失敗理由の読み方

`quality.failingReasons` は「要点」なので、詳細は `quality.findings[]` と `validations[]` を必ず見る。

一次ソース:
- `src/compiler/quality-evaluator.ts`

## ルールを増やすときの規約

1. ルールコードは短く、機械的に識別できる文字列にする（例: `min-font-size`）。
2. 判定の入力は「決定論的に取得できるもの」に寄せる（ComputedSlide の計算結果、SVG メタ等）。
3. strict の失敗条件は `failingReasons` で要約できるようにする。
4. 自動修正が可能なら、必ず「決定論的な Fix」を追加する。自動修正が不可能なら、失敗メッセージに具体的な改善指針を書く。
5. ルール追加と同時に unit test を追加する（回帰を入口で止める）。

実装起点:
- 判定追加: `src/compiler/quality-evaluator.ts`
- 型/出力: `src/types/quality.ts`
- 自動修正: `src/compiler/autofix.ts`

## 決定論 autofix の優先順位

autofix は「自由入力の文章生成」より「安全な変形」を優先する。

現状の基本戦略:
- overflow: bullet/table/code/段落の分割、比率短縮
- min font: 分割 → それでも無理なら短縮
- Mermaid: より大きい image placeholder へ移動 → flowchart を 2 分割

一次ソース:
- `src/compiler/autofix.ts`
- `src/compiler/mermaid-splitter.ts`

## LLM を使う境界を固定する

LLM は「決定論 fix が効かなかった場合のみ」「ユーザーが明示した場合のみ」実行する。CI では LLM を使わない前提にする（決定論テストを壊さない）。

一次ソース:
- `src/compiler/autofix.ts`（`llm?.provider === "openai"` の分岐）
- `src/agent/openai-fix-actions.ts`（OpenAI Responses API の json_schema 出力）

## 追加の商用品質ルール（導入候補）

以下は実装されていない可能性があるため、導入時は必ず一次ソースで現状を確認してから追加する。

- 文字密度（文字数/面積）による過密判定
- コントラスト比（背景色と文字色の差）
- 画像のアスペクト比崩れ検知（cover/contain の選択ミス）
- 箇条書きの階層が深すぎる（可読性低下）

実装時の注意:
- ルールの false positive が多い場合、profile ごとに severity を調整する。
- strict は「商用に出せない」状態だけを error に寄せる（warning/error の基準を明確化する）。

