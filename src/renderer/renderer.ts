import type { ComputedSlide } from "../types/layout.ts";
import type { SlideMaster } from "../types/master.ts";

// レンダラーインターフェース

/** レンダラーの抽象インターフェース */
export interface Renderer {
  /** スライドマスターを設定 */
  setMaster(master: SlideMaster): void;

  /** 計算済みスライドをレンダリング */
  renderSlides(slides: ComputedSlide[]): void;

  /** バイナリ出力を生成 */
  toBuffer(): Promise<ArrayBuffer>;

  /** ファイルとして保存 */
  toFile(path: string): Promise<void>;
}
