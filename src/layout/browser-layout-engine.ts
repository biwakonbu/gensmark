import type { Page } from "playwright";
import type { ComputedSlide } from "../types/layout.ts";
import type { AspectRatio, SlideMaster } from "../types/master.ts";
import type { ValidationResult } from "../types/validation.ts";
import { HtmlRenderer } from "../renderer/html/html-renderer.ts";
import { getSlideDimensions } from "../renderer/html/slide-to-html.ts";
import { getSharedBrowserPool } from "./browser-pool.ts";

// Playwright ベースのレイアウトエンジン
// ブラウザの正確なレイアウトエンジンでオーバーフロー検知 + 自動 shrink を実行

/** ブラウザベース Layout Engine のオプション */
export interface BrowserLayoutOptions {
  /** 最小フォントサイズ (pt) */
  minFontSize?: number;
  /** 二分探索の精度 (pt) */
  precision?: number;
}

const DEFAULT_MIN_FONT_SIZE = 8;
const DEFAULT_PRECISION = 0.5;

/** ブラウザベースのオーバーフロー検知・shrink エンジン */
export class BrowserLayoutEngine {
  private options: Required<BrowserLayoutOptions>;

  constructor(options: BrowserLayoutOptions = {}) {
    this.options = {
      minFontSize: options.minFontSize ?? DEFAULT_MIN_FONT_SIZE,
      precision: options.precision ?? DEFAULT_PRECISION,
    };
  }

  /** スライド群のオーバーフローを検知し、必要に応じて fontSize を shrink */
  async validateAndShrink(
    slides: ComputedSlide[],
    master: SlideMaster,
  ): Promise<ValidationResult[]> {
    const aspectRatio: AspectRatio = master.aspectRatio ?? "16:9";
    const pool = getSharedBrowserPool();
    const page = await pool.getPage();

    try {
      return await this.processSlides(page, slides, master, aspectRatio);
    } finally {
      await page.close();
    }
  }

  private async processSlides(
    page: Page,
    slides: ComputedSlide[],
    master: SlideMaster,
    aspectRatio: AspectRatio,
  ): Promise<ValidationResult[]> {
    const validations: ValidationResult[] = [];
    const { width, height } = getSlideDimensions(aspectRatio);

    // DPI 96 でインチ -> ピクセル変換
    const viewportWidth = Math.ceil(width * 96);
    const viewportHeight = Math.ceil(height * 96);
    await page.setViewportSize({ width: viewportWidth, height: viewportHeight });

    // 初回 HTML を生成してロード
    const htmlRenderer = new HtmlRenderer(aspectRatio);
    htmlRenderer.setMaster(master);
    htmlRenderer.renderSlides(slides);
    const html = htmlRenderer.toHtmlString();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    // 各スライドの各プレースホルダーでオーバーフローを検査
    for (const slide of slides) {
      for (const element of slide.elements) {
        // 画像はオーバーフロー検知不要
        if (typeof element.value !== "string" && element.value.type === "image") continue;

        const selector = `.gm-slide[data-index="${slide.index}"] .gm-ph[data-name="${element.placeholder.name}"]`;

        const overflow = await page.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) return null;
          return {
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        }, selector);

        if (!overflow) continue;

        const isOverflowing = overflow.scrollHeight > overflow.clientHeight + 1;

        if (isOverflowing) {
          const overflowStrategy =
            element.placeholder.constraints?.overflow ?? "shrink";

          if (overflowStrategy === "shrink") {
            // 二分探索で最適なフォントサイズを見つける
            const minFs =
              element.placeholder.constraints?.minFontSize ?? this.options.minFontSize;
            const maxFs = element.computedFontSize;
            const optimalSize = await this.binarySearchFontSize(
              page,
              selector,
              minFs,
              maxFs,
            );

            if (optimalSize < maxFs) {
              element.computedFontSize = optimalSize;
              validations.push({
                slideIndex: slide.index,
                placeholder: element.placeholder.name,
                severity: "info",
                type: "overflow",
                message: `Font size shrunk from ${maxFs}pt to ${optimalSize}pt to fit content (browser layout)`,
                overflowDetail: {
                  contentHeight: overflow.scrollHeight / 96,
                  availableHeight: overflow.clientHeight / 96,
                  currentFontSize: maxFs,
                  suggestedFontSize: optimalSize,
                },
              });
            }

            if (optimalSize <= minFs) {
              validations.push({
                slideIndex: slide.index,
                placeholder: element.placeholder.name,
                severity: "warning",
                type: "overflow",
                message: `Content overflows even at minimum font size (${minFs}pt). Consider reducing text.`,
                overflowDetail: {
                  contentHeight: overflow.scrollHeight / 96,
                  availableHeight: overflow.clientHeight / 96,
                  currentFontSize: optimalSize,
                },
              });
            }
          } else if (overflowStrategy === "error") {
            validations.push({
              slideIndex: slide.index,
              placeholder: element.placeholder.name,
              severity: "error",
              type: "overflow",
              message: `Content overflows placeholder "${element.placeholder.name}" (${overflow.scrollHeight}px > ${overflow.clientHeight}px)`,
              overflowDetail: {
                contentHeight: overflow.scrollHeight / 96,
                availableHeight: overflow.clientHeight / 96,
                currentFontSize: element.computedFontSize,
              },
            });
          } else if (overflowStrategy === "warn") {
            validations.push({
              slideIndex: slide.index,
              placeholder: element.placeholder.name,
              severity: "warning",
              type: "overflow",
              message: `Content overflows placeholder "${element.placeholder.name}"`,
              overflowDetail: {
                contentHeight: overflow.scrollHeight / 96,
                availableHeight: overflow.clientHeight / 96,
                currentFontSize: element.computedFontSize,
              },
            });
          }
          // truncate はブラウザ側で CSS overflow:hidden が処理
        }
      }
    }

    return validations;
  }

  /** 二分探索で overflow しない最大フォントサイズを見つける */
  private async binarySearchFontSize(
    page: Page,
    selector: string,
    minFs: number,
    maxFs: number,
  ): Promise<number> {
    let lo = minFs;
    let hi = maxFs;

    while (hi - lo > this.options.precision) {
      const mid = (lo + hi) / 2;
      const overflows = await page.evaluate(
        ({ sel, fontSize }) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) return false;
          el.style.fontSize = `${fontSize}pt`;
          return el.scrollHeight > el.clientHeight + 1;
        },
        { sel: selector, fontSize: mid },
      );

      if (overflows) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    // 最終的にフィットする方のサイズを返す (安全側)
    const result = Math.floor(lo * 2) / 2; // 0.5pt 刻みに丸め
    return Math.max(result, minFs);
  }
}
