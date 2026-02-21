/**
 * NeuralVerse AI - スタートアップピッチデッキ (16p)
 *
 * gensmark ダークテーマを活用した美しいプレゼンテーション。
 * 架空の AI スタートアップ「NeuralVerse」のピッチ資料。
 *
 * 実行: bun examples/ai-startup-pitch.ts
 * 出力: examples/output/ai-startup-pitch.pptx
 */

import { gensmark } from "../src/index.ts";

const theme = gensmark.presets.themes.dark;
const master = gensmark.presets.standardMaster(theme);

const deck = gensmark
  .create({ master })

  // --- p1: 表紙 ---
  .slide({
    layout: "title-slide",
    data: {
      title: "NeuralVerse",
      subtitle: "言葉の壁を超える - 次世代リアルタイム AI 翻訳プラットフォーム",
    },
    notes: "表紙。NeuralVerse のビジョンを一言で伝える。",
  })

  // --- p2: セクション - ビジョン ---
  .slide({
    layout: "section-header",
    data: { title: "Why We Exist" },
  })

  // --- p3: 世界の課題 ---
  .slide({
    layout: "content",
    data: {
      title: "言語の壁が生む損失",
      body: {
        type: "text",
        value:
          "世界には 7,000 以上の言語が存在し、\n" +
          "企業の海外展開において最大の障壁となっています。\n\n" +
          "グローバル企業の 72% が「言語の壁」を\n" +
          "ビジネス成長の阻害要因として挙げています。\n\n" +
          "年間の翻訳市場規模は 650 億ドル。\n" +
          "しかし、従来の翻訳は遅く、高く、スケールしない。",
      },
    },
  })

  // --- p4: 市場の課題 ---
  .slide({
    layout: "bullets",
    data: {
      title: "既存ソリューションの限界",
      body: {
        type: "bullet",
        items: [
          {
            text: "人力翻訳 - 高品質だが、遅くてコストが高い",
            children: [
              { text: "平均納品まで 3-5 営業日、1ワード 10-30 円" },
            ],
          },
          {
            text: "従来の機械翻訳 - 速いが、品質が不安定",
            children: [
              { text: "専門用語や文脈を理解できず、致命的な誤訳が発生" },
            ],
          },
          {
            text: "汎用 LLM - 高品質だが、レイテンシとコストに課題",
            children: [
              { text: "リアルタイム会話では 2-5 秒の遅延が致命的" },
            ],
          },
          {
            text: "どのソリューションも「速さ」「品質」「コスト」を両立できていない",
          },
        ],
      },
    },
  })

  // --- p5: セクション - ソリューション ---
  .slide({
    layout: "section-header",
    data: { title: "Our Solution" },
  })

  // --- p6: NeuralVerse プラットフォーム ---
  .slide({
    layout: "content",
    data: {
      title: "NeuralVerse - リアルタイム AI 翻訳",
      body: {
        type: "text",
        value:
          "NeuralVerse は、独自開発の軽量 LLM と\n" +
          "ストリーミング推論技術により、\n" +
          "200ms 以下のレイテンシでプロ品質の翻訳を実現します。\n\n" +
          "42 言語をサポートし、業界特化の用語辞書と\n" +
          "コンテキスト学習により、誤訳率を 95% 削減。\n\n" +
          "API / SDK / ブラウザ拡張で\n" +
          "あらゆるアプリケーションにシームレスに統合。",
      },
    },
  })

  // --- p7: 技術的優位性 ---
  .slide({
    layout: "two-column",
    data: {
      title: "技術的競争優位",
      left: {
        type: "bullet",
        items: [
          { text: "[コア技術]" },
          { text: "独自の蒸留モデル (3B params)" },
          { text: "Speculative decoding で高速化" },
          { text: "文脈記憶による一貫性保持" },
          { text: "エッジ推論対応 (on-device)" },
        ],
      },
      right: {
        type: "bullet",
        items: [
          { text: "[特許・参入障壁]" },
          { text: "特許出願中: 3 件" },
          { text: "独自学習データ: 50B tokens" },
          { text: "業界辞書: 120 業種対応" },
          { text: "BLEU スコア: 業界最高水準" },
        ],
      },
    },
  })

  // --- p8: 競合比較 ---
  .slide({
    layout: "table",
    data: {
      title: "競合比較",
      table: {
        type: "table",
        headers: ["", "NeuralVerse", "Google 翻訳", "DeepL", "人力翻訳"],
        rows: [
          ["レイテンシ", "< 200ms", "300-800ms", "500ms-2s", "3-5 日"],
          ["BLEU スコア", "92.3", "78.5", "85.1", "95+"],
          ["対応言語", "42", "133", "31", "制限なし"],
          ["業界特化", "120 業種", "汎用のみ", "一部対応", "対応可"],
          ["コスト/100万文字", "$2.5", "$20", "$25", "$500+"],
          ["オンプレミス対応", "対応", "不可", "不可", "-"],
        ],
        style: {
          headerFill: "#5B9BD5",
          headerColor: "#FFFFFF",
          altRowFill: "#243447",
        },
      },
    },
  })

  // --- p9: セクション - トラクション ---
  .slide({
    layout: "section-header",
    data: { title: "Traction" },
  })

  // --- p10: KPI ---
  .slide({
    layout: "bullets",
    data: {
      title: "成長指標",
      body: {
        type: "bullet",
        items: [
          {
            text: "ARR: $4.2M (前年比 320% 成長)",
            children: [{ text: "MRR $350K、月次成長率 +15%" }],
          },
          {
            text: "有料顧客数: 180 社",
            children: [{ text: "NRR 135% - 既存顧客の拡大が加速" }],
          },
          {
            text: "API コール数: 月間 12 億回",
            children: [{ text: "1 日平均 4,000 万回、ピーク 8,000 万回" }],
          },
          {
            text: "翻訳精度 NPS: +72",
            children: [{ text: "競合平均 +35 を大幅に上回る" }],
          },
        ],
      },
    },
  })

  // --- p11: 主要顧客 ---
  .slide({
    layout: "table",
    data: {
      title: "主要顧客と導入効果",
      table: {
        type: "table",
        headers: ["企業", "業種", "利用規模", "導入効果"],
        rows: [
          ["グローバル商社 A", "商社", "5,000 名", "翻訳コスト 85% 削減"],
          ["メガバンク B", "金融", "10,000 名", "海外取引スピード 3x"],
          ["ゲーム会社 C", "エンタメ", "ローカライズ", "リリース 2 週間短縮"],
          ["製薬会社 D", "ヘルスケア", "治験文書", "規制対応コスト 60% 削減"],
          ["EC プラットフォーム E", "小売", "月 5 億文字", "CVR 海外 +23%"],
        ],
        style: {
          headerFill: "#5B9BD5",
          headerColor: "#FFFFFF",
          altRowFill: "#243447",
        },
      },
    },
  })

  // --- p12: セクション - ビジネスモデル ---
  .slide({
    layout: "section-header",
    data: { title: "Business Model" },
  })

  // --- p13: 料金体系 ---
  .slide({
    layout: "table",
    data: {
      title: "料金プラン",
      table: {
        type: "table",
        headers: ["", "Developer", "Business", "Enterprise"],
        rows: [
          ["月額", "無料", "$499/月", "カスタム"],
          ["文字数上限", "50 万文字/月", "5,000 万文字/月", "無制限"],
          ["対応言語", "10 言語", "42 言語", "42 言語 + カスタム"],
          ["業界辞書", "汎用のみ", "20 業種", "120 業種"],
          ["SLA", "-", "99.9%", "99.99%"],
          ["サポート", "コミュニティ", "メール + チャット", "専任 CSM"],
        ],
        style: {
          headerFill: "#5B9BD5",
          headerColor: "#FFFFFF",
          altRowFill: "#243447",
        },
      },
    },
  })

  // --- p14: セクション - チーム & 調達 ---
  .slide({
    layout: "section-header",
    data: { title: "Team & Ask" },
  })

  // --- p15: チームと資金調達 ---
  .slide({
    layout: "two-column",
    data: {
      title: "チーム & 資金調達",
      left: {
        type: "bullet",
        items: [
          { text: "[経営チーム]" },
          { text: "CEO: 元 Google Brain 研究員" },
          { text: "CTO: NLP 論文被引用 3,000+" },
          { text: "COO: 元 Salesforce VP" },
          { text: "チーム: 35 名 (エンジニア 70%)" },
        ],
      },
      right: {
        type: "bullet",
        items: [
          { text: "[Series B 調達]" },
          { text: "調達目標: $30M" },
          { text: "用途: R&D 強化 + 北米展開" },
          { text: "目標 ARR: 18 ヶ月で $20M" },
          { text: "既存投資家: Tier 1 VC 2 社" },
        ],
      },
    },
  })

  // --- p16: Thank You ---
  .slide({
    layout: "end-slide",
    data: { title: "Let's Break the Language Barrier" },
    notes: "NeuralVerse で言葉の壁を超えましょう。ご清聴ありがとうございました。",
  });

// --- ビルド & 出力 ---
const result = await deck.build();

if (!result.isValid) {
  console.error("バリデーションエラー:");
  for (const v of result.validations) {
    if (v.severity === "error") {
      console.error(
        `  [${v.severity}] p${v.slideIndex + 1} ${v.placeholder}: ${v.message}`
      );
    }
  }
  process.exit(1);
}

// 警告があれば表示
const warnings = result.validations.filter((v) => v.severity === "warning");
if (warnings.length > 0) {
  console.warn("警告:");
  for (const w of warnings) {
    console.warn(
      `  [warn] p${w.slideIndex + 1} ${w.placeholder}: ${w.message}`
    );
  }
}

const outputPath = new URL(
  "./output/ai-startup-pitch.pptx",
  import.meta.url
).pathname;
await result.toPptxFile(outputPath);
console.log(`生成完了: ${outputPath}`);
