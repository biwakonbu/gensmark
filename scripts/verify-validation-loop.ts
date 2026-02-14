// AI 生成テスト: バリデーション→修正ループの動作確認
// fontPaths を設定してオーバーフロー検知が実際に機能することを確認する
import { gensmark, ph } from "../src/index.ts";

const FONT_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const FONT_BOLD_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";

const theme = gensmark.defineTheme({
  name: "test-theme",
  colors: {
    primary: "#1a73e8",
    secondary: "#ea4335",
    background: "#ffffff",
    text: "#333333",
  },
  fonts: {
    heading: "Arial",
    body: "Arial",
  },
  fontPaths: {
    heading: FONT_PATH,
    headingBold: FONT_BOLD_PATH,
    body: FONT_PATH,
    bodyBold: FONT_BOLD_PATH,
  },
});

const master = gensmark.defineMaster({
  name: "test-master",
  theme,
  layouts: {
    content: {
      placeholders: [
        ph.title({
          x: 0.75,
          y: 0.4,
          width: 11.5,
          height: 0.8,
          constraints: { maxLines: 1, overflow: "error" },
        }),
        ph.body({
          x: 0.75,
          y: 1.5,
          width: 11.5,
          height: 5.5,
          constraints: { overflow: "error", minFontSize: 10 },
        }),
      ],
    },
    "content-shrink": {
      placeholders: [
        ph.title({
          x: 0.75,
          y: 0.4,
          width: 11.5,
          height: 0.8,
        }),
        ph.body({
          x: 0.75,
          y: 1.5,
          width: 11.5,
          height: 5.5,
          constraints: { overflow: "shrink", minFontSize: 10 },
        }),
      ],
    },
  },
});

console.log("=== テスト1: 正常なスライド ===");
{
  const deck = gensmark.create({ master });
  deck.slide({
    layout: "content",
    data: {
      title: "正常なタイトル",
      body: "短いテキストです。",
    },
  });
  const result = await deck.build();
  console.log(`isValid: ${result.isValid}`);
  console.log(`errors: ${result.validations.filter((v) => v.severity === "error").length}`);
  console.log("");
}

console.log("=== テスト2: オーバーフローするスライド (error モード) ===");
{
  const deck = gensmark.create({ master });
  deck.slide({
    layout: "content",
    data: {
      title: "このタイトルは非常に長いため一行に収まりません。複数行になるはずです。",
      body: "長いテキスト。".repeat(200),
    },
  });
  const result = await deck.build();
  console.log(`isValid: ${result.isValid}`);
  for (const v of result.validations) {
    if (v.severity === "error") {
      console.log(`  [ERROR] "${v.placeholder}": ${v.message}`);
      if (v.suggestion) console.log(`    suggestion: ${v.suggestion}`);
      if (v.overflowDetail) {
        console.log(
          `    detail: contentH=${v.overflowDetail.contentHeight.toFixed(2)}, availH=${v.overflowDetail.availableHeight.toFixed(2)}`,
        );
        if (v.overflowDetail.suggestedFontSize) {
          console.log(`    suggestedFontSize: ${v.overflowDetail.suggestedFontSize.toFixed(1)}pt`);
        }
      }
    }
  }

  // toPptxFile() が例外を投げることを確認
  try {
    await result.toPptxFile("./output/should-not-exist.pptx");
    console.log("  ERROR: toPptxFile() が例外を投げませんでした!");
  } catch (e) {
    console.log(`  toPptxFile() が正しく例外を投げました: ${(e as Error).message}`);
  }
  console.log("");
}

console.log("=== テスト3: shrink モードでの自動縮小 ===");
{
  const deck = gensmark.create({ master });
  deck.slide({
    layout: "content-shrink",
    data: {
      title: "shrink テスト",
      body: {
        type: "bullet",
        items: Array.from({ length: 15 }, (_, i) => ({
          text: `項目 ${i + 1}: この箇条書きは多いので自動的にフォントサイズが縮小されるはずです`,
        })),
      },
    },
  });
  const result = await deck.build();
  console.log(`isValid: ${result.isValid}`);
  console.log(`validations: ${result.validations.filter((v) => v.severity === "error").length} errors`);

  if (result.isValid) {
    await result.toPptxFile("./output/verify-shrink.pptx");
    console.log("  shrink 結果の .pptx を生成しました");
  }
  console.log("");
}

console.log("=== テスト4: バリデーション→修正ループのシミュレーション ===");
{
  // ステップ1: 長すぎるテキストで失敗
  let bodyText = "この文章はとても長いです。".repeat(100);
  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`  試行 ${attempt}: テキスト長 ${bodyText.length} 文字`);

    const deck = gensmark.create({ master });
    deck.slide({
      layout: "content",
      data: { title: "修正ループテスト", body: bodyText },
    });

    const result = await deck.build();

    if (result.isValid) {
      await result.toPptxFile("./output/verify-loop.pptx");
      console.log(`  成功! ${attempt} 回目で .pptx を生成`);
      break;
    }

    // バリデーション結果からテキストを短縮
    const bodyError = result.validations.find(
      (v) => v.placeholder === "body" && v.severity === "error",
    );
    if (bodyError?.overflowDetail) {
      const ratio =
        bodyError.overflowDetail.availableHeight / bodyError.overflowDetail.contentHeight;
      const newLength = Math.floor(bodyText.length * ratio * 0.9); // 10% マージン
      bodyText = bodyText.slice(0, newLength);
      console.log(
        `    overflow: ${bodyError.overflowDetail.contentHeight.toFixed(2)}in > ${bodyError.overflowDetail.availableHeight.toFixed(2)}in`,
      );
      console.log(`    テキストを ${newLength} 文字に短縮`);
    } else {
      console.log("    予期しないエラー。ループ終了。");
      break;
    }
  }
}

console.log("\n=== 全テスト完了 ===");
