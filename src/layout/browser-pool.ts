import { chromium, type Browser, type Page } from "playwright";

// Playwright ブラウザインスタンス管理

/** ブラウザプール: Playwright のブラウザインスタンスを再利用 */
export class BrowserPool {
  private browser: Browser | null = null;

  /** ブラウザインスタンスを起動または再利用して新しいページを取得 */
  async getPage(): Promise<Page> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser.newPage();
  }

  /** 全リソースを解放 */
  async dispose(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/** モジュールレベルの共有プール (アプリケーション全体で再利用) */
let sharedPool: BrowserPool | null = null;

/** 共有ブラウザプールを取得 */
export function getSharedBrowserPool(): BrowserPool {
  if (!sharedPool) {
    sharedPool = new BrowserPool();
  }
  return sharedPool;
}

/** 共有ブラウザプールを破棄 */
export async function disposeSharedBrowserPool(): Promise<void> {
  if (sharedPool) {
    await sharedPool.dispose();
    sharedPool = null;
  }
}
