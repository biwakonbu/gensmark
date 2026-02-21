import type { SlideMaster } from "../../types/master.ts";
import { createStandardMaster } from "../../master/presets/standard.ts";
import { defaultTheme } from "../../master/presets/themes/default.ts";
import { darkTheme } from "../../master/presets/themes/dark.ts";

// SlideMaster のインメモリ管理ストア

/** マスターエントリ */
export interface MasterEntry {
  id: string;
  master: SlideMaster;
  source: "builtin" | "imported";
}

/** マスターストア */
export class MasterStore {
  private entries = new Map<string, MasterEntry>();
  private nextId = 1;

  constructor() {
    // ビルトインマスターをプリロード
    this.add(createStandardMaster(defaultTheme), "builtin");
    this.add(createStandardMaster(darkTheme), "builtin");
  }

  /** 全マスター一覧を取得 */
  list(): MasterEntry[] {
    return Array.from(this.entries.values());
  }

  /** ID でマスターを取得 */
  get(id: string): MasterEntry | undefined {
    return this.entries.get(id);
  }

  /** マスターを追加し、生成された ID を返す */
  add(master: SlideMaster, source: "builtin" | "imported"): string {
    const id = String(this.nextId++);
    this.entries.set(id, { id, master, source });
    return id;
  }

  /** マスターを削除 */
  delete(id: string): boolean {
    return this.entries.delete(id);
  }
}
