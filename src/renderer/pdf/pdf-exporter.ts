import type { AspectRatio } from "../../types/master.ts";
import { getSharedBrowserPool } from "../../layout/browser-pool.ts";
import { getSlideDimensions } from "../html/slide-to-html.ts";

// HTML -> PDF 変換 (Playwright page.pdf())

/** PDF エクスポーター */
export class PdfExporter {
  private disposed = false;

  /** HTML 文字列を PDF に変換 */
  async export(html: string, aspectRatio: AspectRatio = "16:9"): Promise<Buffer> {
    if (this.disposed) throw new Error("PdfExporter: already disposed");

    const { width, height } = getSlideDimensions(aspectRatio);
    const pool = getSharedBrowserPool();
    const page = await pool.getPage();

    try {
      await page.setContent(html, { waitUntil: "networkidle" });

      // Mermaid レンダリングの完了を待機
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          const mermaidEls = document.querySelectorAll(".mermaid");
          if (mermaidEls.length === 0) {
            resolve();
            return;
          }
          // mermaid.js がレンダリングを完了するまで少し待つ
          const check = () => {
            const svgs = document.querySelectorAll(".mermaid svg");
            if (svgs.length >= mermaidEls.length) {
              resolve();
            } else {
              setTimeout(check, 100);
            }
          };
          setTimeout(check, 500);
        });
      });

      const pdf = await page.pdf({
        width: `${width}in`,
        height: `${height}in`,
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });

      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  /** リソースを解放 */
  async dispose(): Promise<void> {
    this.disposed = true;
  }
}
