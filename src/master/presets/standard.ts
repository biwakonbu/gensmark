import type { SlideMaster } from "../../types/master.ts";
import type { Theme } from "../../types/theme.ts";
import { ph } from "../master-builder.ts";

// ビルトイン standard マスター (10 レイアウト)

const MARGIN = 0.75;
const SLIDE_W = 13.33;
const CONTENT_W = SLIDE_W - MARGIN * 2;
const HALF_W = (CONTENT_W - 0.5) / 2; // 2カラム時の各カラム幅

/** standard マスターを作成 */
export function createStandardMaster(theme: Theme): SlideMaster {
  return {
    name: "standard",
    theme,
    aspectRatio: "16:9",
    layouts: {
      // 1. タイトルスライド (中央配置)
      "title-slide": {
        placeholders: [
          ph.title({
            y: 2.5,
            height: 1.5,
            style: { fontSize: 44, align: "center", valign: "middle" },
            constraints: { maxLines: 3, overflow: "shrink", minFontSize: 28 },
          }),
          ph.subtitle({
            y: 4.2,
            style: { fontSize: 24, align: "center", color: theme.colors.secondary },
          }),
        ],
        background: { type: "solid", color: theme.colors.background },
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
      },

      // 3. コンテンツ (タイトル + 本文)
      content: {
        placeholders: [ph.title(), ph.body()],
      },

      // 4. 2カラム
      "two-column": {
        placeholders: [
          ph.title(),
          ph.body({ name: "left", x: MARGIN, width: HALF_W }),
          ph.body({ name: "right", x: MARGIN + HALF_W + 0.5, width: HALF_W }),
        ],
      },

      // 5. タイトル + 画像
      "content-image": {
        placeholders: [
          ph.title(),
          ph.body({ width: HALF_W }),
          ph.image({
            x: MARGIN + HALF_W + 0.5,
            width: HALF_W,
          }),
        ],
      },

      // 6. 画像フル
      "image-full": {
        placeholders: [
          ph.title({
            style: { fontSize: 24 },
            constraints: { maxLines: 1 },
          }),
          ph.image({ y: 1.3, height: 5.7 }),
        ],
      },

      // 7. 箇条書き
      bullets: {
        placeholders: [
          ph.title(),
          ph.body({
            constraints: { overflow: "shrink", minFontSize: 14 },
          }),
        ],
      },

      // 8. テーブル
      table: {
        placeholders: [
          ph.title(),
          ph.body({
            name: "table",
            constraints: { overflow: "warn" },
          }),
        ],
      },

      // 9. コード
      code: {
        placeholders: [
          ph.title({
            style: { fontSize: 24 },
          }),
          ph.body({
            name: "code",
            style: { fontSize: 14 },
            constraints: { overflow: "warn" },
          }),
        ],
      },

      // 10. エンドスライド (Thank you)
      "end-slide": {
        placeholders: [
          ph.title({
            y: 2.5,
            height: 2,
            style: { fontSize: 48, align: "center", valign: "middle" },
            constraints: { maxLines: 2, overflow: "shrink" },
          }),
        ],
        background: { type: "solid", color: theme.colors.primary },
        fixedElements: [
          {
            type: "rect",
            x: 0,
            y: 0,
            width: SLIDE_W,
            height: 0.03,
            color: theme.colors.accent ?? theme.colors.secondary,
          },
        ],
      },
    },
  };
}
