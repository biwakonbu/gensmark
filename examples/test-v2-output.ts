/**
 * gensmark v2 出力テスト
 *
 * HTML + PDF + PPTX の 3 形式で出力して動作確認。
 *
 * 実行: bun examples/test-v2-output.ts
 */

import { gensmark } from "../src/index.ts";
import { disposeSharedBrowserPool } from "../src/layout/browser-pool.ts";

const theme = gensmark.presets.themes.default;
const master = gensmark.presets.standardMaster(theme);

const deck = gensmark
  .create({ master })

  // 表紙
  .slide({
    layout: "title-slide",
    data: {
      title: "CloudFlow",
      subtitle: "クラウド業務効率化プラットフォーム",
    },
    notes: "営業資料 表紙",
  })

  // セクション
  .slide({
    layout: "section-header",
    data: { title: "会社概要" },
  })

  // コンテンツ
  .slide({
    layout: "content",
    data: {
      title: "CloudFlow Inc. について",
      body: {
        type: "text",
        value:
          "CloudFlow Inc. は 2019 年に設立されたクラウド SaaS 企業です。\n" +
          "「すべての業務をシンプルに」をミッションに掲げ、\n" +
          "業務プロセスの自動化・可視化ソリューションを提供しています。\n\n" +
          "本社: 東京都港区  |  従業員数: 320名  |  資本金: 15億円\n" +
          "導入企業数: 1,200社以上  |  年間成長率: 45%",
      },
    },
  })

  // 箇条書き
  .slide({
    layout: "bullets",
    data: {
      title: "主要サービス",
      body: {
        type: "bullet",
        items: [
          {
            text: "CloudFlow Automate - ワークフロー自動化エンジン",
            children: [
              { text: "ノーコードで業務フローを設計・実行" },
              { text: "200以上の外部サービスと連携" },
            ],
          },
          {
            text: "CloudFlow Analytics - リアルタイム分析ダッシュボード",
            children: [
              { text: "KPI の自動追跡と異常検知" },
              { text: "カスタムレポートをワンクリック生成" },
            ],
          },
          {
            text: "CloudFlow Connect - チーム間コラボレーション基盤",
            children: [
              { text: "プロジェクト横断のタスク管理" },
              { text: "リアルタイムドキュメント共同編集" },
            ],
          },
        ],
      },
    },
  })

  // テーブル
  .slide({
    layout: "table",
    data: {
      title: "クラウド業務効率化市場の推移",
      table: {
        type: "table",
        headers: ["年度", "市場規模 (億円)", "前年比成長率", "主なトレンド"],
        rows: [
          ["2022", "4,800", "-", "リモートワーク定着"],
          ["2023", "5,900", "+22.9%", "AI 活用の広がり"],
          ["2024", "7,400", "+25.4%", "業務自動化の本格普及"],
          ["2025", "9,200", "+24.3%", "統合プラットフォーム志向"],
        ],
        style: {
          headerFill: "#2B579A",
          headerColor: "#ffffff",
          altRowFill: "#f0f6ff",
        },
      },
    },
  })

  // 2カラム比較
  .slide({
    layout: "two-column",
    data: {
      title: "従来の業務環境 vs CloudFlow",
      left: {
        type: "bullet",
        items: [
          { text: "[従来の環境]" },
          { text: "手動でのデータ入力・集計" },
          { text: "複数ツールを行き来" },
          { text: "週次レポートに丸1日" },
        ],
      },
      right: {
        type: "bullet",
        items: [
          { text: "[CloudFlow 導入後]" },
          { text: "データ連携を自動化" },
          { text: "単一ダッシュボードで完結" },
          { text: "レポートはリアルタイム生成" },
        ],
      },
    },
  })

  // コード例
  .slide({
    layout: "code",
    data: {
      title: "API 連携サンプル",
      code: {
        type: "code",
        code: `// CloudFlow API で承認ワークフローを起動
const response = await fetch("https://api.cloudflow.io/v1/workflows", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    template: "purchase-approval",
    data: { amount: 150000, department: "Engineering" }
  })
});

const workflow = await response.json();
console.log("Workflow started:", workflow.id);`,
        language: "typescript",
      },
    },
  })

  // グラデーション背景テスト
  .slide({
    layout: "content",
    data: {
      title: "次世代のクラウドプラットフォーム",
      body: "グラデーション背景は HTML/PDF 出力でネイティブサポートされます。",
    },
    background: {
      type: "gradient",
      colors: ["#667eea", "#764ba2"],
      direction: "diagonal",
    },
  })

  // エンドスライド
  .slide({
    layout: "end-slide",
    data: { title: "Thank You" },
    notes: "ご清聴ありがとうございました。",
  });

// --- ビルド ---
console.log("ビルド中...");
const result = await deck.build();

if (!result.isValid) {
  console.error("バリデーションエラー:");
  for (const v of result.validations) {
    if (v.severity === "error") {
      console.error(`  [${v.severity}] p${v.slideIndex + 1} ${v.placeholder}: ${v.message}`);
    }
  }
  process.exit(1);
}

// 警告表示
const warnings = result.validations.filter((v) => v.severity === "warning");
if (warnings.length > 0) {
  console.warn("警告:");
  for (const w of warnings) {
    console.warn(`  [warn] p${w.slideIndex + 1} ${w.placeholder}: ${w.message}`);
  }
}

// --- 出力 ---
const outputDir = new URL("./output/", import.meta.url).pathname;
await Bun.write(outputDir + ".keep", ""); // ディレクトリ確保

// 1. PPTX
console.time("PPTX");
await result.toPptxFile(outputDir + "v2-test.pptx");
console.timeEnd("PPTX");

// 2. HTML
console.time("HTML");
await result.toHtmlFile(outputDir + "v2-test.html");
console.timeEnd("HTML");

// 3. PDF
console.time("PDF");
await result.toPdfFile(outputDir + "v2-test.pdf");
console.timeEnd("PDF");

// クリーンアップ
await disposeSharedBrowserPool();

console.log("\n全出力完了:");
console.log(`  PPTX: ${outputDir}v2-test.pptx`);
console.log(`  HTML: ${outputDir}v2-test.html`);
console.log(`  PDF:  ${outputDir}v2-test.pdf`);
