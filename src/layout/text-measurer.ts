import opentype from "opentype.js";

// opentype.js を使ったテキスト計測

/** 計測結果 */
export interface MeasureResult {
  /** テキスト全体の幅 (インチ) */
  width: number;
  /** テキスト全体の高さ (インチ) */
  height: number;
  /** 行数 */
  lineCount: number;
  /** 各行のテキスト */
  lines: string[];
}

/** フォントサイズ探索結果 */
export interface FittingResult {
  /** 収まるフォントサイズ (pt) */
  fontSize: number;
  /** その際の計測結果 */
  measure: MeasureResult;
}

// pt → インチ変換定数
const PT_TO_INCH = 1 / 72;

// 日本語禁則処理: 行頭禁止文字
const LINE_START_PROHIBITED =
  /^[、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼〜‖｜…‥''"）〕］｝〉》」』】°′″℃％‰ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ、。）」』】〉》〕\]）},.;:!?\-ー〜]/;

// 日本語禁則処理: 行末禁止文字
const LINE_END_PROHIBITED = /[（〔［｛〈《「『【'"（[({]$/;

// CJK 文字の範囲判定
function isCJK(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code === undefined) return false;
  return (
    (code >= 0x3000 && code <= 0x9fff) || // CJK
    (code >= 0xf900 && code <= 0xfaff) || // CJK 互換
    (code >= 0xff00 && code <= 0xffef) || // 全角
    code >= 0x20000 // CJK 拡張
  );
}

/** フォントキャッシュ付きテキスト計測 */
export class TextMeasurer {
  private fontCache = new Map<string, opentype.Font>();

  /** フォントファイルをロード (キャッシュ付き) */
  async loadFont(fontPath: string): Promise<opentype.Font> {
    const cached = this.fontCache.get(fontPath);
    if (cached) return cached;

    const font = await opentype.load(fontPath);
    this.fontCache.set(fontPath, font);
    return font;
  }

  /** テキストの幅を pt 単位で計算 */
  measureTextWidth(text: string, font: opentype.Font, fontSize: number): number {
    if (text.length === 0) return 0;

    const scale = fontSize / font.unitsPerEm;
    let width = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i]!;
      const glyph = font.charToGlyph(char);
      width += (glyph.advanceWidth ?? 0) * scale;

      // カーニング適用
      if (i < text.length - 1) {
        const nextChar = text[i + 1]!;
        const kerning = font.getKerningValue(font.charToGlyph(char), font.charToGlyph(nextChar));
        width += kerning * scale;
      }
    }

    return width;
  }

  /** テキストをワードラップして計測 */
  measure(
    text: string,
    font: opentype.Font,
    fontSize: number,
    maxWidth: number,
    lineSpacing = 1.2,
  ): MeasureResult {
    // maxWidth をインチから pt に変換
    const maxWidthPt = maxWidth / PT_TO_INCH;

    const lines = this.wrapText(text, font, fontSize, maxWidthPt);
    const lineHeightPt = fontSize * lineSpacing;

    // 各行の最大幅を求める
    let maxLineWidth = 0;
    for (const line of lines) {
      const w = this.measureTextWidth(line, font, fontSize);
      if (w > maxLineWidth) maxLineWidth = w;
    }

    return {
      width: maxLineWidth * PT_TO_INCH,
      height: lines.length * lineHeightPt * PT_TO_INCH,
      lineCount: lines.length,
      lines,
    };
  }

  /** テキストをワードラップ */
  private wrapText(
    text: string,
    font: opentype.Font,
    fontSize: number,
    maxWidthPt: number,
  ): string[] {
    // 改行で分割してから各行をラップ
    const paragraphs = text.split("\n");
    const result: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.length === 0) {
        result.push("");
        continue;
      }
      const wrapped = this.wrapParagraph(paragraph, font, fontSize, maxWidthPt);
      result.push(...wrapped);
    }

    return result;
  }

  /** 1段落をワードラップ */
  private wrapParagraph(
    text: string,
    font: opentype.Font,
    fontSize: number,
    maxWidthPt: number,
  ): string[] {
    const lines: string[] = [];
    let currentLine = "";
    let currentWidth = 0;
    let i = 0;

    while (i < text.length) {
      const char = text[i]!;

      if (isCJK(char)) {
        // CJK 文字: 1文字ずつ処理
        const charWidth = this.measureTextWidth(char, font, fontSize);

        if (currentWidth + charWidth > maxWidthPt && currentLine.length > 0) {
          // 禁則処理: 次の文字が行頭禁止文字なら現在の文字と一緒に次行へ
          if (i + 1 < text.length && LINE_START_PROHIBITED.test(text[i + 1]!)) {
            // 現在行末の文字を次行に送る
            lines.push(currentLine);
            currentLine = char;
            currentWidth = charWidth;
          } else if (LINE_END_PROHIBITED.test(char)) {
            // 行末禁止文字は次行の先頭に
            lines.push(currentLine);
            currentLine = char;
            currentWidth = charWidth;
          } else {
            lines.push(currentLine);
            currentLine = char;
            currentWidth = charWidth;
          }
        } else {
          currentLine += char;
          currentWidth += charWidth;
        }
        i++;
      } else if (char === " " || char === "\t") {
        // 空白文字
        const charWidth = this.measureTextWidth(char, font, fontSize);
        currentLine += char;
        currentWidth += charWidth;
        i++;
      } else {
        // ラテン文字: 単語単位で処理
        let word = "";
        while (
          i < text.length &&
          text[i] !== " " &&
          text[i] !== "\t" &&
          text[i] !== "\n" &&
          !isCJK(text[i]!)
        ) {
          word += text[i];
          i++;
        }

        const wordWidth = this.measureTextWidth(word, font, fontSize);

        if (currentWidth + wordWidth > maxWidthPt && currentLine.length > 0) {
          // 1単語が1行に収まらない場合は文字単位で分割
          if (wordWidth > maxWidthPt) {
            lines.push(currentLine.trimEnd());
            currentLine = "";
            currentWidth = 0;
            for (const ch of word) {
              const chWidth = this.measureTextWidth(ch, font, fontSize);
              if (currentWidth + chWidth > maxWidthPt && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = ch;
                currentWidth = chWidth;
              } else {
                currentLine += ch;
                currentWidth += chWidth;
              }
            }
          } else {
            lines.push(currentLine.trimEnd());
            currentLine = word;
            currentWidth = wordWidth;
          }
        } else {
          currentLine += word;
          currentWidth += wordWidth;
        }
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine.trimEnd());
    }

    return lines.length === 0 ? [""] : lines;
  }

  /** 指定領域に収まるフォントサイズを二分探索で見つける */
  findFittingFontSize(
    text: string,
    font: opentype.Font,
    maxWidth: number,
    maxHeight: number,
    minFontSize: number,
    maxFontSize: number,
    lineSpacing = 1.2,
  ): FittingResult | null {
    let low = minFontSize;
    let high = maxFontSize;
    let bestResult: FittingResult | null = null;

    // 最小サイズでも収まらない場合
    const minResult = this.measure(text, font, minFontSize, maxWidth, lineSpacing);
    if (minResult.height > maxHeight) {
      return null;
    }

    // 二分探索 (0.5pt 精度)
    while (high - low > 0.5) {
      const mid = (low + high) / 2;
      const result = this.measure(text, font, mid, maxWidth, lineSpacing);

      if (result.height <= maxHeight) {
        bestResult = { fontSize: mid, measure: result };
        low = mid;
      } else {
        high = mid;
      }
    }

    // 最終確認
    if (!bestResult) {
      bestResult = { fontSize: low, measure: minResult };
    }

    return bestResult;
  }

  /** キャッシュをクリア */
  clearCache(): void {
    this.fontCache.clear();
  }
}
