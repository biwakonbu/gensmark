import type { ComputedSlide } from "../types/layout.ts";
import type { AspectRatio, SlideMaster } from "../types/master.ts";

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

  /** リソースを解放 (任意実装) */
  dispose?(): void;

  /** 内部状態をリセット (複数回 build() 対応、任意実装) */
  reset?(aspectRatio?: AspectRatio): void;
}
