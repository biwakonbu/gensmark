// 手動検証: gensmark API で .pptx を生成する
import { gensmark, ph } from "../src/index.ts";

const theme = gensmark.defineTheme({
  name: "verify-theme",
  colors: {
    primary: "#1a73e8",
    secondary: "#ea4335",
    background: "#ffffff",
    text: "#333333",
    accent: "#34a853",
  },
  fonts: {
    heading: "Arial",
    body: "Arial",
    mono: "Courier New",
  },
});

const master = gensmark.defineMaster({
  name: "verify-master",
  theme,
  layouts: {
    "title-slide": {
      placeholders: [
        ph.title({
          x: 0.75,
          y: 2.0,
          width: 11.5,
          height: 1.5,
          style: { fontSize: 44, align: "center" },
        }),
        ph.subtitle({
          x: 0.75,
          y: 3.8,
          width: 11.5,
          height: 1.0,
          style: { align: "center" },
        }),
      ],
    },
    content: {
      placeholders: [
        ph.title({ x: 0.75, y: 0.4, width: 11.5, height: 0.8 }),
        ph.body({ x: 0.75, y: 1.5, width: 11.5, height: 5.5 }),
      ],
    },
    "two-column": {
      placeholders: [
        ph.title({ x: 0.75, y: 0.4, width: 11.5, height: 0.8 }),
        ph.body({ name: "left", x: 0.75, y: 1.5, width: 5.25, height: 5.5 }),
        ph.body({ name: "right", x: 6.5, y: 1.5, width: 5.25, height: 5.5 }),
      ],
    },
  },
});

const deck = gensmark.create({ master });

// スライド1: タイトル
deck.slide({
  layout: "title-slide",
  data: {
    title: "gensmark 動作検証",
    subtitle: "AI-first スライド生成ツール",
  },
  notes: "このスライドは gensmark の動作検証用です。",
});

// スライド2: コンテンツ (箇条書き)
deck.slide({
  layout: "content",
  data: {
    title: "主要機能",
    body: {
      type: "bullet",
      items: [
        { text: "オーバーフロー検知と自動修正" },
        { text: "スライドマスター / テーマ対応" },
        { text: "AI エージェントによる自動生成", children: [
          { text: "バリデーション結果を見て修正可能" },
          { text: "suggestion で具体的な修正方法を提示" },
        ]},
        { text: "TypeScript + Bun による高速実行" },
      ],
    },
  },
});

// スライド3: 2カラム
deck.slide({
  layout: "two-column",
  data: {
    title: "技術選定",
    left: {
      type: "bullet",
      items: [
        { text: "TypeScript + Bun" },
        { text: "pptxgenjs" },
        { text: "opentype.js" },
      ],
    },
    right: {
      type: "bullet",
      items: [
        { text: "Biome (lint/format)" },
        { text: "bun:test (テスト)" },
        { text: "GitHub Actions (CI)" },
      ],
    },
  },
});

// スライド4: テーブル
deck.slide({
  layout: "content",
  data: {
    title: "比較表",
    body: {
      type: "table",
      headers: ["機能", "Marp", "gensmark"],
      rows: [
        ["オーバーフロー検知", "なし", "あり"],
        ["スライドマスター", "なし", "あり"],
        ["AI 生成向け API", "なし", "あり"],
        ["出力形式", "HTML/PDF", "PPTX"],
      ],
      style: {
        headerFill: "#1a73e8",
        headerColor: "#ffffff",
        altRowFill: "#f0f4ff",
        borderColor: "#cccccc",
      },
    },
  },
});

// スライド5: コードブロック
deck.slide({
  layout: "content",
  data: {
    title: "使用例",
    body: {
      type: "code",
      code: `const deck = gensmark.create({ master });
deck.slide({
  layout: 'content',
  data: {
    title: 'Hello World',
    body: 'This is gensmark!',
  },
});
const result = await deck.build();`,
      language: "typescript",
    },
  },
});

// ビルド
console.log("ビルド開始...");
const result = await deck.build();

console.log(`isValid: ${result.isValid}`);
console.log(`validations: ${result.validations.length} 件`);
for (const v of result.validations) {
  console.log(`  [${v.severity}] Slide ${v.slideIndex}, "${v.placeholder}": ${v.message}`);
}

if (result.isValid) {
  const outputPath = "./output/verify.pptx";
  await Bun.write("./output/.gitkeep", "");
  await result.toPptxFile(outputPath);
  console.log(`\n.pptx ファイルを生成しました: ${outputPath}`);

  // ファイルサイズ確認
  const file = Bun.file(outputPath);
  const size = file.size;
  console.log(`ファイルサイズ: ${(size / 1024).toFixed(1)} KB`);

  // バッファ確認
  if (result.pptxBuffer) {
    console.log(`pptxBuffer サイズ: ${(result.pptxBuffer.byteLength / 1024).toFixed(1)} KB`);
  }
} else {
  console.error("\nバリデーションエラーがあるため .pptx を生成できません。");
}
