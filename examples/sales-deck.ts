/**
 * CloudFlow Inc. 営業資料 (20p)
 *
 * gensmark の全10レイアウトを活用したビジネスプレゼンテーション例。
 * 架空の SaaS 企業「CloudFlow Inc.」の営業資料を生成する。
 *
 * 実行: bun examples/sales-deck.ts
 * 出力: examples/output/sales-deck.pptx
 */

import { gensmark } from "../src/index.ts";

const theme = gensmark.presets.themes.default;
const master = gensmark.presets.standardMaster(theme);

const deck = gensmark
  .create({ master })

  // --- p1: 表紙 ---
  .slide({
    layout: "title-slide",
    data: {
      title: "CloudFlow",
      subtitle: "クラウド業務効率化プラットフォーム",
    },
    notes: "営業資料 表紙。CloudFlow のブランド名とキャッチコピーを提示。",
  })

  // --- p2: セクション - 会社概要 ---
  .slide({
    layout: "section-header",
    data: { title: "会社概要" },
  })

  // --- p3: 会社概要テキスト ---
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

  // --- p4: 主要サービス一覧 ---
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
          {
            text: "CloudFlow Security - エンタープライズセキュリティ",
            children: [
              { text: "SOC 2 Type II / ISO 27001 準拠" },
              { text: "ゼロトラストアーキテクチャ" },
            ],
          },
        ],
      },
    },
  })

  // --- p5: セクション - 市場背景と課題 ---
  .slide({
    layout: "section-header",
    data: { title: "市場背景と課題" },
  })

  // --- p6: 企業が抱える業務課題 ---
  .slide({
    layout: "bullets",
    data: {
      title: "企業が直面する業務課題",
      body: {
        type: "bullet",
        items: [
          { text: "手作業による定型業務がコア業務を圧迫 (平均 週12時間)" },
          { text: "複数ツール間のデータ連携が断絶し、二重入力が常態化" },
          { text: "リモートワーク環境でのチーム間コミュニケーション不足" },
          { text: "データが分散し、経営判断に必要なインサイトを得られない" },
          { text: "セキュリティ管理の複雑化に IT 部門が対応しきれない" },
          { text: "既存システムの保守コストが年々増大 (年平均 +18%)" },
        ],
      },
    },
  })

  // --- p7: 市場規模データ ---
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
          ["2026 (予測)", "11,500", "+25.0%", "AI エージェント連携"],
        ],
        style: {
          headerFill: "#2B579A",
          headerColor: "#ffffff",
          altRowFill: "#f0f6ff",
        },
      },
    },
  })

  // --- p8: セクション - ソリューション ---
  .slide({
    layout: "section-header",
    data: { title: "ソリューション" },
  })

  // --- p9: プロダクト概要 ---
  .slide({
    layout: "content",
    data: {
      title: "CloudFlow プラットフォーム",
      body: {
        type: "text",
        value:
          "CloudFlow は、業務プロセスの自動化・分析・コラボレーションを\n" +
          "1つの統合プラットフォームで実現するクラウドサービスです。\n\n" +
          "直感的な UI と強力な API により、IT 部門だけでなく\n" +
          "現場の担当者も自らワークフローを構築できます。\n\n" +
          "既存のシステムとの連携は 200 以上のコネクタで対応。\n" +
          "導入初日から効果を実感していただけます。",
      },
    },
  })

  // --- p10: 機能比較 (従来 vs CloudFlow) ---
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
          { text: "承認フローはメールで依頼" },
          { text: "セキュリティは個別対応" },
        ],
      },
      right: {
        type: "bullet",
        items: [
          { text: "[CloudFlow 導入後]" },
          { text: "データ連携を自動化" },
          { text: "単一ダッシュボードで完結" },
          { text: "レポートはリアルタイム生成" },
          { text: "ワンクリック承認フロー" },
          { text: "統合セキュリティ管理" },
        ],
      },
    },
  })

  // --- p11: 主要機能ハイライト ---
  .slide({
    layout: "bullets",
    data: {
      title: "主要機能ハイライト",
      body: {
        type: "bullet",
        items: [
          {
            text: "ノーコードワークフロービルダー",
            children: [{ text: "ドラッグ&ドロップで業務フローを構築" }],
          },
          {
            text: "AI アシスタント (CloudFlow Copilot)",
            children: [{ text: "自然言語で分析クエリや自動化ルールを作成" }],
          },
          {
            text: "リアルタイムダッシュボード",
            children: [{ text: "チーム全体の KPI を常時モニタリング" }],
          },
          {
            text: "API ファースト設計",
            children: [{ text: "REST / GraphQL / Webhook で外部連携" }],
          },
          {
            text: "エンタープライズ監査ログ",
            children: [{ text: "全操作を記録し、コンプライアンスに対応" }],
          },
        ],
      },
    },
  })

  // --- p12: セクション - 導入実績 ---
  .slide({
    layout: "section-header",
    data: { title: "導入実績" },
  })

  // --- p13: 導入企業一覧・効果 ---
  .slide({
    layout: "table",
    data: {
      title: "主要導入企業と成果",
      table: {
        type: "table",
        headers: ["企業名", "業種", "導入規模", "主な成果"],
        rows: [
          ["A 商事", "総合商社", "3,000名", "定型業務 60% 削減"],
          ["B 銀行", "金融", "8,000名", "承認リードタイム 75% 短縮"],
          ["C 製薬", "製造業", "1,500名", "レポート作成工数 80% 削減"],
          ["D テック", "IT", "500名", "ツール統合でコスト 40% 削減"],
          ["E 物流", "物流", "2,000名", "配送手配ミス 90% 低減"],
        ],
        style: {
          headerFill: "#2B579A",
          headerColor: "#ffffff",
          altRowFill: "#f0f6ff",
        },
      },
    },
  })

  // --- p14: 導入事例 A社 / B社 ---
  .slide({
    layout: "two-column",
    data: {
      title: "導入事例",
      left: {
        type: "bullet",
        items: [
          { text: "[A 商事]" },
          { text: "課題: 月次決算に5営業日" },
          { text: "施策: 仕訳自動化+承認フロー" },
          { text: "成果: 決算を2営業日に短縮" },
          { text: "ROI: 導入6ヶ月で投資回収" },
        ],
      },
      right: {
        type: "bullet",
        items: [
          { text: "[B 銀行]" },
          { text: "課題: 審査プロセスが属人化" },
          { text: "施策: 審査ワークフロー標準化" },
          { text: "成果: 審査時間を75%短縮" },
          { text: "ROI: 顧客満足度 30pt 向上" },
        ],
      },
    },
  })

  // --- p15: セクション - 料金プラン ---
  .slide({
    layout: "section-header",
    data: { title: "料金プラン" },
  })

  // --- p16: 料金プラン比較表 ---
  .slide({
    layout: "table",
    data: {
      title: "料金プラン比較",
      table: {
        type: "table",
        headers: ["", "Starter", "Business", "Enterprise"],
        rows: [
          ["月額 (税抜)", "980円/人", "2,480円/人", "個別見積"],
          ["ワークフロー数", "10件", "無制限", "無制限"],
          ["外部連携", "20種", "200種以上", "200種以上 + カスタム"],
          ["AI Copilot", "-", "利用可", "優先利用"],
          ["監査ログ", "30日", "1年", "無期限"],
          ["SLA", "99.5%", "99.9%", "99.99%"],
          ["サポート", "メール", "メール + チャット", "専任 CSM"],
        ],
        style: {
          headerFill: "#2B579A",
          headerColor: "#ffffff",
          altRowFill: "#f0f6ff",
        },
      },
    },
  })

  // --- p17: セクション - 導入ステップ ---
  .slide({
    layout: "section-header",
    data: { title: "導入ステップ" },
  })

  // --- p18: 導入フロー ---
  .slide({
    layout: "bullets",
    data: {
      title: "導入の流れ",
      body: {
        type: "bullet",
        ordered: true,
        items: [
          {
            text: "ヒアリング (1週間)",
            children: [{ text: "現状の業務フローと課題をヒアリング" }],
          },
          {
            text: "PoC 実施 (2週間)",
            children: [{ text: "実データで効果を検証するトライアル環境を提供" }],
          },
          {
            text: "導入設計 (2週間)",
            children: [{ text: "ワークフロー設計と外部連携の設定" }],
          },
          {
            text: "本番展開 (1週間)",
            children: [{ text: "段階的なロールアウトとユーザートレーニング" }],
          },
          {
            text: "運用・改善 (継続)",
            children: [{ text: "専任 CSM が定着化と継続的な改善をサポート" }],
          },
        ],
      },
    },
  })

  // --- p19: お問い合わせ情報 ---
  .slide({
    layout: "content",
    data: {
      title: "お問い合わせ",
      body: {
        type: "text",
        value:
          "CloudFlow にご興味をお持ちいただきありがとうございます。\n\n" +
          "お問い合わせ先:\n" +
          "  営業部  sales@cloudflow-inc.example.com\n" +
          "  電話    03-XXXX-XXXX (平日 9:00-18:00)\n\n" +
          "無料トライアル (14日間) も実施中です。\n" +
          "まずはお気軽にご相談ください。",
      },
    },
  })

  // --- p20: Thank You ---
  .slide({
    layout: "end-slide",
    data: { title: "Thank You" },
    notes: "ご清聴ありがとうございました。ご質問をお待ちしています。",
  });

// --- ビルド & 出力 ---
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

// 警告があれば表示
const warnings = result.validations.filter((v) => v.severity === "warning");
if (warnings.length > 0) {
  console.warn("警告:");
  for (const w of warnings) {
    console.warn(`  [warn] p${w.slideIndex + 1} ${w.placeholder}: ${w.message}`);
  }
}

const outputPath = new URL("./output/sales-deck.pptx", import.meta.url).pathname;
await result.toPptxFile(outputPath);
console.log(`生成完了: ${outputPath}`);
