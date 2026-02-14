# Visual Regression (PPTX → PNG → pixel diff)

visual regression は「見た目の破綻」を入口で止めるための最優先ゲート。

一次ソース:
- `scripts/visual-test.ts`
- `tests/visual/fixtures.ts`
- `.github/workflows/ci.yml`

## 仕組み (何が起きているか)

1. `tests/visual/fixtures.ts` の `DeckSpec` を `gensmark.compile(..., { profile: "draft" })` で PPTX 化する。
2. LibreOffice (`soffice`) で PPTX → PDF に変換する。
3. `pdftoppm` で PDF → PNG に変換する。
4. golden と `pixelmatch` で 1px でも差分があれば失敗にする。

一次ソース:
- `scripts/visual-test.ts`

## 前提 (依存)

必要バイナリ:
- `soffice`（LibreOffice）
- `pdftoppm`（poppler）

環境変数（必要なら上書き）:
- `LIBREOFFICE_BIN`
- `VISUAL_OUT_DIR`
- `VISUAL_GOLDEN_DIR`
- `VISUAL_DIFF_DIR`

一次ソース:
- `scripts/visual-test.ts`

## Golden の所在 (OS 差分)

既定の golden root は OS で分岐する。

- Linux: `tests/visual/golden`
- それ以外: `tests/visual/golden-${process.platform}`

CI は Linux を前提に `tests/visual/golden` を参照する。

一次ソース:
- `scripts/visual-test.ts`（`DEFAULT_GOLDEN_ROOT`）
- `.github/workflows/ci.yml`（ubuntu-latest + Docker）

## Golden 更新の原則

golden 更新は「差分の正当性が説明できる場合のみ」行う。バグの隠蔽として更新しない。

更新コマンド:
- ローカル: `bun run test:visual:update`

CI 互換 (Linux golden) を更新したい場合の例:

```bash
docker run --rm -v "$PWD:/work" -w /work oven/bun:1.3.2 bash -lc '
  apt-get update >/dev/null &&
  apt-get install -y libreoffice-impress poppler-utils fonts-dejavu-core fonts-dejavu-extra >/dev/null &&
  bun install --frozen-lockfile &&
  bun run test:visual:update
'
```

注意:
- 実行前に作業ツリーが clean であることを確認する（golden の差分が大量に出るため）。
- 差分が出たページを `tests/visual/diff/<fixture>/diff-<n>.png` で必ず目視確認する。

## fixture を増やすとき

1. `tests/visual/fixtures.ts` に fixture を追加する。
2. golden を更新する（CI 互換を重視するなら Linux 環境で更新する）。
3. 追加 fixture が「何の回帰を止めるためか」を説明できる状態にする（目的が不明な fixture は増やさない）。

