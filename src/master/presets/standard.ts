import type { SlideMaster } from "../../types/master.ts";
import type { Theme } from "../../types/theme.ts";
import { ph } from "../master-builder.ts";

// ビルトイン standard マスター (10 レイアウト)

const MARGIN = 0.75;
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const CONTENT_W = SLIDE_W - MARGIN * 2;
const COL_GAP = 1.0; // 2カラム間のギャップ
const HALF_W = (CONTENT_W - COL_GAP) / 2; // 2カラム時の各カラム幅

// 共通レイアウト定数
const SIDEBAR_W = 0.08; // 左サイドアクセントバー幅
const TITLE_Y = 0.6; // タイトル Y 座標
const BODY_Y = 1.7; // 本文 Y 座標
const MARGIN_BOTTOM = 0.5; // 下余白 (マスター margins.bottom と一致)
const BODY_H = SLIDE_H - BODY_Y - MARGIN_BOTTOM; // 本文高さ (下余白ベースで算出)
const SEPARATOR_H = 0.02; // セパレータライン高さ
const FOOTER_H = 0.01; // フッターライン高さ

/** 左サイドアクセントバー (primary カラー) */
function sideBar(color: string) {
  return {
    type: "rect" as const,
    x: 0,
    y: 0,
    width: SIDEBAR_W,
    height: SLIDE_H,
    color,
  };
}

/** タイトル下セパレータライン */
function separatorLine(color: string) {
  return {
    type: "rect" as const,
    x: MARGIN,
    y: 1.45,
    width: CONTENT_W,
    height: SEPARATOR_H,
    color,
  };
}

/** フッターライン */
function footerLine(color: string) {
  return {
    type: "rect" as const,
    x: 0,
    y: SLIDE_H - 0.3,
    width: SLIDE_W,
    height: FOOTER_H,
    color,
  };
}

/** standard マスターを作成 */
export function createStandardMaster(theme: Theme): SlideMaster {
  return {
    name: "standard",
    theme,
    aspectRatio: "16:9",
    margins: { top: 0.5, right: 0.75, bottom: MARGIN_BOTTOM, left: 0.75 },
    layouts: {
      // 1. タイトルスライド (白背景 + 装飾)
      "title-slide": {
        placeholders: [
          ph.title({
            x: 1.5,
            y: 2.3,
            width: SLIDE_W - 2.5,
            height: 1.5,
            style: { fontSize: 44, align: "left", valign: "middle", color: theme.colors.primary },
            constraints: { maxLines: 3, overflow: "shrink", minFontSize: 28 },
          }),
          ph.subtitle({
            x: 1.5,
            y: 4.2,
            width: SLIDE_W - 2.5,
            style: { fontSize: 22, align: "left", color: theme.colors.secondary },
          }),
        ],
        background: { type: "solid", color: theme.colors.background },
        fixedElements: [
          // 上部アクセントライン (全幅)
          {
            type: "rect",
            x: 0,
            y: 0,
            width: SLIDE_W,
            height: 0.04,
            color: theme.colors.accent ?? theme.colors.secondary,
          },
          // 左サイド primary バー (太め)
          {
            type: "rect",
            x: 0,
            y: 0,
            width: 0.4,
            height: SLIDE_H,
            color: theme.colors.primary,
          },
          // タイトル下アクセントアンダーライン
          {
            type: "rect",
            x: 1.5,
            y: 3.85,
            width: 3.0,
            height: 0.03,
            color: theme.colors.accent ?? theme.colors.secondary,
          },
          // 下部バー
          {
            type: "rect",
            x: 0,
            y: SLIDE_H - 0.15,
            width: SLIDE_W,
            height: 0.15,
            color: theme.colors.secondary,
          },
        ],
      },

      // 2. セクション区切り
      "section-header": {
        placeholders: [
          ph.title({
            y: 2.8,
            height: 1.2,
            style: { fontSize: 40, align: "center", color: "#ffffff" },
          }),
        ],
        background: { type: "solid", color: theme.colors.primary },
        fixedElements: [
          // 上部アクセントライン
          {
            type: "rect",
            x: 0,
            y: 0,
            width: SLIDE_W,
            height: 0.04,
            color: theme.colors.accent ?? theme.colors.secondary,
          },
          // タイトル下中央装飾ライン
          {
            type: "rect",
            x: SLIDE_W / 2 - 1.5,
            y: 4.2,
            width: 3.0,
            height: 0.03,
            color: theme.colors.accent ?? "#ffffff",
          },
        ],
      },

      // 3. コンテンツ (タイトル + 本文)
      content: {
        placeholders: [
          ph.title({ y: TITLE_Y, style: { fontSize: 28 } }),
          ph.body({
            y: BODY_Y,
            height: BODY_H,
            style: { fontSize: 16, lineSpacing: 1.5 },
          }),
        ],
        fixedElements: [
          sideBar(theme.colors.primary),
          separatorLine(theme.colors.muted ?? "#F4F5F7"),
          footerLine(theme.colors.muted ?? "#F4F5F7"),
        ],
      },

      // 4. 2カラム
      "two-column": {
        placeholders: [
          ph.title({ y: TITLE_Y, style: { fontSize: 28 } }),
          ph.body({
            name: "left",
            x: MARGIN,
            y: BODY_Y,
            width: HALF_W,
            height: BODY_H,
            style: { fontSize: 12, lineSpacing: 1.5 },
          }),
          ph.body({
            name: "right",
            x: MARGIN + HALF_W + COL_GAP,
            y: BODY_Y,
            width: HALF_W,
            height: BODY_H,
            style: { fontSize: 12, lineSpacing: 1.5 },
          }),
        ],
        fixedElements: [
          sideBar(theme.colors.primary),
          separatorLine(theme.colors.muted ?? "#F4F5F7"),
          // カラム間区切り線
          {
            type: "rect",
            x: MARGIN + HALF_W + COL_GAP / 2 - 0.005,
            y: BODY_Y + 0.2,
            width: 0.01,
            height: BODY_H - 0.4,
            color: theme.colors.muted ?? "#F4F5F7",
          },
          footerLine(theme.colors.muted ?? "#F4F5F7"),
        ],
      },

      // 5. タイトル + 画像
      "content-image": {
        placeholders: [
          ph.title({ y: TITLE_Y, style: { fontSize: 28 } }),
          ph.body({
            y: BODY_Y,
            width: HALF_W,
            height: BODY_H,
            style: { fontSize: 16, lineSpacing: 1.5 },
          }),
          ph.image({
            x: MARGIN + HALF_W + COL_GAP,
            y: BODY_Y,
            width: HALF_W,
            height: BODY_H,
          }),
        ],
        fixedElements: [
          sideBar(theme.colors.primary),
          separatorLine(theme.colors.muted ?? "#F4F5F7"),
          footerLine(theme.colors.muted ?? "#F4F5F7"),
        ],
      },

      // 6. 画像フル
      "image-full": {
        placeholders: [
          ph.title({
            y: TITLE_Y,
            style: { fontSize: 22 },
            constraints: { maxLines: 1 },
          }),
          ph.image({ y: 1.3, height: 5.7 }),
        ],
        fixedElements: [sideBar(theme.colors.primary)],
      },

      // 7. 箇条書き
      bullets: {
        placeholders: [
          ph.title({ y: TITLE_Y, style: { fontSize: 28 } }),
          ph.body({
            y: BODY_Y,
            height: BODY_H,
            style: { fontSize: 16, lineSpacing: 1.5 },
            constraints: { overflow: "shrink", minFontSize: 10 },
          }),
        ],
        fixedElements: [
          sideBar(theme.colors.primary),
          separatorLine(theme.colors.muted ?? "#F4F5F7"),
          footerLine(theme.colors.muted ?? "#F4F5F7"),
        ],
      },

      // 8. テーブル
      table: {
        placeholders: [
          ph.title({ y: TITLE_Y, style: { fontSize: 28 } }),
          ph.body({
            name: "table",
            y: BODY_Y,
            height: BODY_H,
            style: { fontSize: 16, lineSpacing: 1.5 },
          }),
        ],
        fixedElements: [
          sideBar(theme.colors.primary),
          separatorLine(theme.colors.muted ?? "#F4F5F7"),
          footerLine(theme.colors.muted ?? "#F4F5F7"),
        ],
      },

      // 9. コード
      code: {
        placeholders: [
          ph.title({
            y: TITLE_Y,
            style: { fontSize: 24 },
          }),
          ph.body({
            name: "code",
            y: BODY_Y,
            height: BODY_H,
            style: { fontSize: 14 },
          }),
        ],
        fixedElements: [
          sideBar(theme.colors.primary),
          separatorLine(theme.colors.muted ?? "#F4F5F7"),
          footerLine(theme.colors.muted ?? "#F4F5F7"),
        ],
      },

      // 10. エンドスライド
      "end-slide": {
        placeholders: [
          ph.title({
            y: 2.5,
            height: 2,
            style: { fontSize: 48, align: "center", valign: "middle", color: "#ffffff" },
            constraints: { maxLines: 2, overflow: "shrink" },
          }),
        ],
        background: { type: "solid", color: theme.colors.primary },
        fixedElements: [
          // 上部アクセントライン
          {
            type: "rect",
            x: 0,
            y: 0,
            width: SLIDE_W,
            height: 0.04,
            color: theme.colors.accent ?? theme.colors.secondary,
          },
          // 中央装飾ライン
          {
            type: "rect",
            x: SLIDE_W / 2 - 1.5,
            y: 4.8,
            width: 3.0,
            height: 0.03,
            color: theme.colors.accent ?? "#ffffff",
          },
          // 下部バー
          {
            type: "rect",
            x: 0,
            y: SLIDE_H - 0.15,
            width: SLIDE_W,
            height: 0.15,
            color: theme.colors.accent ?? theme.colors.secondary,
          },
        ],
      },
    },
  };
}
