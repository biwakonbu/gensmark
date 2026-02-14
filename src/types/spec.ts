import type { SlideContent } from "./content.ts";
import type { AspectRatio, SlideMaster } from "./master.ts";

/** JSON で表現可能な入力スペック (AI/人間の共通インターフェース) */
export interface DeckSpec {
  master: SlideMaster;
  slides: SlideContent[];
  /** アスペクト比 (未指定時は master.aspectRatio or 16:9) */
  aspectRatio?: AspectRatio;
}
