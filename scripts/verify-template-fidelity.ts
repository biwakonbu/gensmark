/**
 * PPTX テンプレートインポートのビジュアル忠実度検証
 *
 * インポート → スライド生成 → LibreOffice PNG 変換 → pixelmatch 比較 → HTML レポート
 *
 * 使い方:
 *   bun run scripts/verify-template-fidelity.ts
 *   bun run scripts/verify-template-fidelity.ts --skip-download
 *   bun run scripts/verify-template-fidelity.ts --template tests/fixtures/template/samples/foo.pptx
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import JSZip from "jszip";
import { importPptxTemplate } from "../src/import/pptx-template-importer.ts";
import { gensmark } from "../src/index.ts";
import type { PlaceholderValue } from "../src/types/content.ts";
import type { ImportedTemplate } from "../src/types/template.ts";

// ---------------------------------------------------------------------------
// CLI 引数パース
// ---------------------------------------------------------------------------

const SKIP_DOWNLOAD = process.argv.includes("--skip-download");
const templateArgIdx = process.argv.indexOf("--template");
const SINGLE_TEMPLATE =
  templateArgIdx >= 0 ? resolve(process.argv[templateArgIdx + 1] ?? "") : null;

const ROOT = process.cwd();
const SAMPLES_DIR = join(ROOT, "tests/fixtures/template/samples");
const OUT_ROOT = join(ROOT, "tests/visual/output/template-fidelity");
const REPORT_PATH = join(ROOT, "output/template-fidelity-report.html");
const FALLBACK_TEMPLATE = join(ROOT, "tests/fixtures/template/basic-template.pptx");

// ---------------------------------------------------------------------------
// PPTX テンプレートのダウンロード候補
// ---------------------------------------------------------------------------

interface TemplateSource {
  name: string;
  url: string;
  filename: string;
}

// 直接ダウンロード可能な無料 PPTX テンプレート (MIT / Apache 2.0)
const TEMPLATE_SOURCES: TemplateSource[] = [
  {
    name: "python-pptx default template",
    url: "https://raw.githubusercontent.com/scanny/python-pptx/master/src/pptx/templates/default.pptx",
    filename: "python-pptx-default.pptx",
  },
  {
    name: "python-pptx test",
    url: "https://raw.githubusercontent.com/scanny/python-pptx/master/features/steps/test_files/test.pptx",
    filename: "python-pptx-test.pptx",
  },
  {
    name: "python-pptx slide masters",
    url: "https://raw.githubusercontent.com/scanny/python-pptx/master/features/steps/test_files/prs-slide-masters.pptx",
    filename: "python-pptx-slide-masters.pptx",
  },
];

// ---------------------------------------------------------------------------
// ユーティリティ: LibreOffice / pdftoppm 検出
// ---------------------------------------------------------------------------

async function canRun(cmd: string, args: string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn([cmd, ...args], { stdout: "ignore", stderr: "ignore" });
    const code = await proc.exited;
    return code === 0;
  } catch {
    return false;
  }
}

async function findLibreOfficeBinary(): Promise<string | null> {
  const env = process.env.LIBREOFFICE_BIN;
  if (env && existsSync(env)) return env;

  const candidates = [
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "soffice",
    "libreoffice",
  ];
  for (const cmd of candidates) {
    if (await canRun(cmd, ["--version"])) return cmd;
  }
  return null;
}

async function findPdfToPpmBinary(): Promise<string | null> {
  for (const cmd of ["pdftoppm"]) {
    if (await canRun(cmd, ["-h"])) return cmd;
  }
  return null;
}

// ---------------------------------------------------------------------------
// PPTX → PNG 変換 (LibreOffice + pdftoppm)
// ---------------------------------------------------------------------------

async function convertPptxToPng(args: {
  libreoffice: string;
  pdftoppm: string;
  pptxPath: string;
  outDir: string;
}): Promise<string[]> {
  const base = basename(args.pptxPath, ".pptx");
  const pdfPath = join(args.outDir, `${base}.pdf`);

  // PPTX → PDF
  const proc = Bun.spawn(
    [
      args.libreoffice,
      "--headless",
      "--nologo",
      "--nolockcheck",
      "--nodefault",
      "--nofirststartwizard",
      "--convert-to",
      "pdf",
      "--outdir",
      args.outDir,
      args.pptxPath,
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(err.trim() || `LibreOffice convert failed: exit=${code}`);
  }

  // PDF → PNG (page-wise) - 統一ベース名 "slide" を使用
  const pngBase = join(args.outDir, "slide");
  const proc2 = Bun.spawn(
    [args.pdftoppm, "-png", "-r", "150", pdfPath, pngBase],
    { stdout: "ignore", stderr: "pipe" },
  );
  const code2 = await proc2.exited;
  if (code2 !== 0) {
    const err = await new Response(proc2.stderr).text();
    throw new Error(err.trim() || `pdftoppm failed: exit=${code2}`);
  }

  return listConvertedPngs(args.outDir, "slide");
}

function listConvertedPngs(dir: string, base: string): string[] {
  const re = new RegExp(`^${escapeRe(base)}-(\\d+)\\.png$`);
  return readdirSync(dir)
    .filter((f) => re.test(f))
    .map((f) => {
      const m = f.match(re);
      const idx = m?.[1] ? Number.parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
      return { f, idx };
    })
    .sort((a, b) => a.idx - b.idx)
    .map((x) => join(dir, x.f));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// PPTX スライド有無の検出
// ---------------------------------------------------------------------------

/** 元テンプレート PPTX に実スライド (ppt/slides/slide*.xml) が含まれているか確認 */
async function hasActualSlides(pptxPath: string): Promise<boolean> {
  const buf = readFileSync(pptxPath);
  const zip = await JSZip.loadAsync(buf);
  const slidePattern = /^ppt\/slides\/slide\d+\.xml$/;
  return Object.keys(zip.files).some((name) => slidePattern.test(name));
}

// ---------------------------------------------------------------------------
// テンプレートダウンロード
// ---------------------------------------------------------------------------

async function downloadTemplates(): Promise<string[]> {
  mkdirSync(SAMPLES_DIR, { recursive: true });
  const downloaded: string[] = [];

  for (const src of TEMPLATE_SOURCES) {
    const dest = join(SAMPLES_DIR, src.filename);
    if (existsSync(dest)) {
      console.log(`[download] skip (exists): ${src.filename}`);
      downloaded.push(dest);
      continue;
    }

    console.log(`[download] ${src.name} -> ${src.filename} ...`);
    try {
      const res = await fetch(src.url, { redirect: "follow" });
      if (!res.ok) {
        console.warn(`[download] failed (${res.status}): ${src.url}`);
        continue;
      }
      const buf = await res.arrayBuffer();
      writeFileSync(dest, Buffer.from(buf));
      downloaded.push(dest);
      console.log(`[download] ok: ${src.filename} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
    } catch (e) {
      console.warn(`[download] error: ${src.url} - ${e}`);
    }
  }

  return downloaded;
}

// ---------------------------------------------------------------------------
// テンプレートのインポートとスライド生成
// ---------------------------------------------------------------------------

/** 1x1 白 PNG (テスト用ダミー画像) を生成 */
function getDummyImagePath(): string {
  const dummyPath = join(OUT_ROOT, "_dummy-placeholder.png");
  if (!existsSync(dummyPath)) {
    // 64x64 白 PNG
    const img = new PNG({ width: 64, height: 64 });
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 200;     // R
      img.data[i + 1] = 200; // G
      img.data[i + 2] = 200; // B
      img.data[i + 3] = 255; // A
    }
    writeFileSync(dummyPath, PNG.sync.write(img));
  }
  return dummyPath;
}

/** プレースホルダータイプに応じたダミーコンテンツを生成 */
function makeDummyContent(
  phName: string,
  phType: string,
  layoutName: string,
): PlaceholderValue {
  switch (phType) {
    case "title":
      return `Layout: ${layoutName}`;
    case "subtitle":
      return "Imported template test";
    case "body":
      return {
        type: "bullet",
        items: [
          { text: "First bullet item" },
          { text: "Second bullet item" },
        ],
      };
    case "image":
      return { type: "image", path: getDummyImagePath(), alt: "placeholder" };
    default:
      return { type: "text", value: `${phName}` };
  }
}

interface TemplateTestResult {
  templateName: string;
  templatePath: string;
  importResult: ImportedTemplate;
  generatedPptxPath: string;
  layouts: LayoutTestResult[];
}

interface LayoutTestResult {
  layoutName: string;
  placeholders: { name: string; type: string; x: number; y: number; width: number; height: number }[];
  slideIndex: number;
}

async function processTemplate(
  templatePath: string,
  outDir: string,
): Promise<TemplateTestResult> {
  const templateName = basename(templatePath, ".pptx");
  console.log(`\n[import] ${templateName} ...`);

  // 1. インポート
  const imported = await importPptxTemplate({ path: templatePath });
  const { master, warnings } = imported;

  if (warnings.length > 0) {
    console.log(`[import] warnings (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  [${w.code}] ${w.message}`);
    }
  }

  const layoutNames = Object.keys(master.layouts);
  console.log(`[import] layouts (${layoutNames.length}): ${layoutNames.join(", ")}`);

  // レイアウトマップから canonical なレイアウトのみ使用 (エイリアスの重複を除外)
  const canonicalLayouts = new Set<string>();
  for (const [key, entry] of Object.entries(imported.layoutMap)) {
    if (key === entry.canonical) {
      canonicalLayouts.add(key);
    }
  }
  const uniqueLayoutNames = layoutNames.filter(
    (name) => canonicalLayouts.has(name) || !imported.layoutMap[name],
  );

  // 2. 各レイアウトにスライドを生成
  const deck = gensmark.create({ master, template: imported });
  const layoutResults: LayoutTestResult[] = [];

  for (let i = 0; i < uniqueLayoutNames.length; i++) {
    const layoutName = uniqueLayoutNames[i]!;
    const layout = master.layouts[layoutName];
    if (!layout) continue;

    const data: Record<string, PlaceholderValue> = {};
    const phDetails: LayoutTestResult["placeholders"] = [];

    for (const ph of layout.placeholders) {
      data[ph.name] = makeDummyContent(ph.name, ph.type, layoutName);
      phDetails.push({
        name: ph.name,
        type: ph.type,
        x: ph.x,
        y: ph.y,
        width: ph.width,
        height: ph.height,
      });
    }

    deck.slide({ layout: layoutName, data });
    layoutResults.push({
      layoutName,
      placeholders: phDetails,
      slideIndex: i,
    });
  }

  // 3. ビルドと PPTX 出力
  const result = await deck.build();
  const generatedPptxPath = join(outDir, `${templateName}-generated.pptx`);

  if (result.isValid) {
    await result.toPptxFile(generatedPptxPath);
    console.log(`[build] ok: ${generatedPptxPath}`);
  } else {
    // エラーがあっても可能な限り進める
    console.warn(`[build] validation errors:`);
    for (const v of result.validations) {
      if (v.severity === "error") {
        console.warn(`  [error] p${v.slideIndex + 1} ${v.placeholder}: ${v.message}`);
      }
    }
    // エラー時でも続行可能にするため空ファイル
    writeFileSync(generatedPptxPath, "");
  }

  return {
    templateName,
    templatePath,
    importResult: imported,
    generatedPptxPath,
    layouts: layoutResults,
  };
}

// ---------------------------------------------------------------------------
// ピクセル比較
// ---------------------------------------------------------------------------

interface DiffResult {
  layoutName: string;
  slideIndex: number;
  originalPng: string | null;
  generatedPng: string | null;
  diffPng: string | null;
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  sizeMatch: boolean;
  originalSize: string;
  generatedSize: string;
}

function comparePngs(
  originalPngs: string[],
  generatedPngs: string[],
  layoutResults: LayoutTestResult[],
  diffDir: string,
): DiffResult[] {
  const results: DiffResult[] = [];

  for (let i = 0; i < layoutResults.length; i++) {
    const layout = layoutResults[i]!;
    const origPath = originalPngs[i] ?? null;
    const genPath = generatedPngs[i] ?? null;

    if (!origPath || !genPath || !existsSync(origPath) || !existsSync(genPath)) {
      results.push({
        layoutName: layout.layoutName,
        slideIndex: layout.slideIndex,
        originalPng: origPath,
        generatedPng: genPath,
        diffPng: null,
        diffPixels: -1,
        totalPixels: 0,
        diffRatio: -1,
        sizeMatch: false,
        originalSize: "N/A",
        generatedSize: "N/A",
      });
      continue;
    }

    const a = PNG.sync.read(readFileSync(origPath));
    const b = PNG.sync.read(readFileSync(genPath));
    const origSizeStr = `${a.width}x${a.height}`;
    const genSizeStr = `${b.width}x${b.height}`;

    const sizeMatch = a.width === b.width && a.height === b.height;
    const diffPath = join(diffDir, `diff-${i + 1}.png`);

    if (!sizeMatch) {
      results.push({
        layoutName: layout.layoutName,
        slideIndex: layout.slideIndex,
        originalPng: origPath,
        generatedPng: genPath,
        diffPng: null,
        diffPixels: -1,
        totalPixels: a.width * a.height,
        diffRatio: -1,
        sizeMatch: false,
        originalSize: origSizeStr,
        generatedSize: genSizeStr,
      });
      continue;
    }

    const diff = new PNG({ width: a.width, height: a.height });
    const totalPixels = a.width * a.height;
    const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
      threshold: 0.1,
      includeAA: true,
    });
    writeFileSync(diffPath, PNG.sync.write(diff));

    results.push({
      layoutName: layout.layoutName,
      slideIndex: layout.slideIndex,
      originalPng: origPath,
      generatedPng: genPath,
      diffPng: diffPath,
      diffPixels,
      totalPixels,
      diffRatio: totalPixels > 0 ? diffPixels / totalPixels : 0,
      sizeMatch: true,
      originalSize: origSizeStr,
      generatedSize: genSizeStr,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// HTML レポート生成
// ---------------------------------------------------------------------------

/** PNG ファイルを base64 data URI に変換 */
function pngToDataUri(path: string | null): string {
  if (!path || !existsSync(path)) return "";
  const buf = readFileSync(path);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

interface ReportData {
  templateName: string;
  templatePath: string;
  importResult: ImportedTemplate;
  layouts: LayoutTestResult[];
  diffs: DiffResult[];
  hasOriginalSlides: boolean;
}

function generateHtmlReport(reports: ReportData[]): string {
  const now = new Date().toISOString();

  let html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>PPTX Template Import Fidelity Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 24px; }
  h1 { font-size: 28px; margin-bottom: 8px; color: #fff; }
  h2 { font-size: 22px; margin: 32px 0 12px; color: #7dd3fc; border-bottom: 1px solid #334; padding-bottom: 6px; }
  h3 { font-size: 18px; margin: 20px 0 8px; color: #a5b4fc; }
  .meta { font-size: 13px; color: #888; margin-bottom: 24px; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .summary-card { background: #16213e; border-radius: 8px; padding: 16px; }
  .summary-card .label { font-size: 12px; color: #888; text-transform: uppercase; }
  .summary-card .value { font-size: 24px; font-weight: bold; color: #fff; margin-top: 4px; }
  .warning-list { background: #2a1a00; border: 1px solid #f59e0b44; border-radius: 8px; padding: 12px 16px; margin: 12px 0; font-size: 13px; }
  .warning-list li { margin: 4px 0; color: #fbbf24; }
  .theme-info { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
  .color-swatch { display: inline-block; width: 24px; height: 24px; border-radius: 4px; border: 1px solid #555; vertical-align: middle; margin-right: 6px; }
  .slide-comparison { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 12px 0; }
  .slide-comparison img { width: 100%; border: 1px solid #333; border-radius: 4px; background: #222; }
  .slide-comparison .col-header { text-align: center; font-size: 12px; color: #888; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
  .diff-stats { font-size: 13px; margin: 6px 0; padding: 8px 12px; border-radius: 6px; }
  .diff-stats.good { background: #064e3b; color: #6ee7b7; }
  .diff-stats.warn { background: #78350f; color: #fde68a; }
  .diff-stats.bad { background: #7f1d1d; color: #fca5a5; }
  .diff-stats.na { background: #1e293b; color: #94a3b8; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0; }
  table th { text-align: left; padding: 8px; color: #94a3b8; border-bottom: 1px solid #334; font-weight: 600; }
  table td { padding: 8px; border-bottom: 1px solid #1e293b; }
  .ph-title { color: #60a5fa; font-weight: bold; }
  .ph-subtitle { color: #34d399; font-weight: bold; }
  .ph-body { color: #fb923c; font-weight: bold; }
  .ph-image { color: #a78bfa; font-weight: bold; }
  .ph-custom { color: #9ca3af; font-weight: bold; }
  .layout-section { background: #16213e; border-radius: 12px; padding: 20px; margin: 16px 0; }
  .template-section { margin-bottom: 48px; }
</style>
</head>
<body>
<h1>PPTX Template Import Fidelity Report</h1>
<p class="meta">Generated: ${now}</p>
`;

  // サマリー
  const totalTemplates = reports.length;
  const totalLayouts = reports.reduce((s, r) => s + r.layouts.length, 0);
  const totalDiffs = reports.reduce((s, r) => s + r.diffs.length, 0);
  const avgDiffRatio =
    totalDiffs > 0
      ? reports.reduce(
          (s, r) =>
            s +
            r.diffs.reduce((ds, d) => ds + (d.diffRatio >= 0 ? d.diffRatio : 0), 0),
          0,
        ) / Math.max(1, reports.reduce((s, r) => s + r.diffs.filter((d) => d.diffRatio >= 0).length, 0))
      : 0;
  const totalWarnings = reports.reduce((s, r) => s + r.importResult.warnings.length, 0);

  html += `
<div class="summary-grid">
  <div class="summary-card"><div class="label">Templates</div><div class="value">${totalTemplates}</div></div>
  <div class="summary-card"><div class="label">Layouts</div><div class="value">${totalLayouts}</div></div>
  <div class="summary-card"><div class="label">Comparisons</div><div class="value">${totalDiffs}</div></div>
  <div class="summary-card"><div class="label">Avg Diff Ratio</div><div class="value">${(avgDiffRatio * 100).toFixed(1)}%</div></div>
  <div class="summary-card"><div class="label">Warnings</div><div class="value">${totalWarnings}</div></div>
</div>
`;

  // 各テンプレートの詳細
  for (const report of reports) {
    const { templateName, importResult, layouts, diffs } = report;
    const { master, warnings, layoutMap } = importResult;

    html += `<div class="template-section">`;
    html += `<h2>${templateName}</h2>`;
    html += `<p style="font-size:13px;color:#888;">Source: ${report.templatePath}</p>`;
    if (!report.hasOriginalSlides) {
      html += `<div class="diff-stats na" style="margin-top:8px;">Template-only file (no slides in original) - pixel comparison skipped. Generated slides shown for layout verification.</div>`;
    }

    // 構造比較: テーマ情報
    html += `<h3>Theme</h3>`;
    html += `<div class="theme-info">`;
    html += `<div>`;
    html += `<p style="margin-bottom:8px;"><strong>Colors:</strong></p>`;
    for (const [name, color] of Object.entries(master.theme.colors)) {
      html += `<div style="margin:4px 0;"><span class="color-swatch" style="background:${color};"></span> ${name}: ${color}</div>`;
    }
    html += `</div>`;
    html += `<div>`;
    html += `<p style="margin-bottom:8px;"><strong>Fonts:</strong></p>`;
    html += `<div style="margin:4px 0;">Heading: ${master.theme.fonts.heading}</div>`;
    html += `<div style="margin:4px 0;">Body: ${master.theme.fonts.body}</div>`;
    if (master.theme.fonts.mono) {
      html += `<div style="margin:4px 0;">Mono: ${master.theme.fonts.mono}</div>`;
    }
    html += `<div style="margin:8px 0;">Aspect Ratio: ${master.aspectRatio}</div>`;
    html += `</div>`;
    html += `</div>`;

    // 構造比較: レイアウト一覧
    html += `<h3>Layouts (${Object.keys(master.layouts).length} total, ${layouts.length} canonical)</h3>`;
    html += `<table><thead><tr><th>Layout</th><th>Aliases</th><th>Placeholders</th></tr></thead><tbody>`;
    for (const layout of layouts) {
      const entry = layoutMap[layout.layoutName];
      const aliases = entry?.aliases.filter((a) => a !== layout.layoutName).join(", ") || "-";
      const phSummary = layout.placeholders
        .map((p) => `<span class="ph-${p.type}">${p.name}</span>`)
        .join(", ");
      html += `<tr><td><strong>${layout.layoutName}</strong></td><td>${aliases}</td><td>${phSummary || "(fallback)"}</td></tr>`;
    }
    html += `</tbody></table>`;

    // 警告
    if (warnings.length > 0) {
      html += `<h3>Import Warnings (${warnings.length})</h3>`;
      html += `<ul class="warning-list">`;
      for (const w of warnings) {
        html += `<li>[${w.code}] ${w.message}</li>`;
      }
      html += `</ul>`;
    }

    // 各レイアウトのビジュアル比較
    html += `<h3>Visual Comparison</h3>`;

    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i]!;
      const diff = diffs[i];

      html += `<div class="layout-section">`;
      html += `<h3 style="margin-top:0;">${layout.layoutName}</h3>`;

      // 差分統計
      if (diff) {
        if (!report.hasOriginalSlides) {
          html += `<div class="diff-stats na">No slides in original template - showing generated slide only</div>`;
        } else if (!diff.sizeMatch && diff.originalSize !== "N/A") {
          html += `<div class="diff-stats warn">Size mismatch: original ${diff.originalSize} vs generated ${diff.generatedSize} - pixel diff skipped</div>`;
        } else if (diff.diffRatio < 0) {
          html += `<div class="diff-stats na">No PNG available for comparison</div>`;
        } else {
          const pct = (diff.diffRatio * 100).toFixed(2);
          const cls = diff.diffRatio < 0.05 ? "good" : diff.diffRatio < 0.3 ? "warn" : "bad";
          html += `<div class="diff-stats ${cls}">Diff: ${diff.diffPixels.toLocaleString()} pixels (${pct}% of ${diff.totalPixels.toLocaleString()} total)</div>`;
        }
      }

      // PNG 比較表示
      if (diff) {
        if (!report.hasOriginalSlides) {
          // スライドなしテンプレート: 生成 PNG のみ表示
          const genUri = pngToDataUri(diff.generatedPng);
          html += `<div style="margin:12px 0;">`;
          html += `<div class="col-header" style="text-align:left;">Generated Slide</div>`;
          html += genUri ? `<img src="${genUri}" alt="generated" style="max-width:50%;border:1px solid #333;border-radius:4px;background:#222;">` : `<p style="color:#666;">N/A</p>`;
          html += `</div>`;
        } else {
          // スライドありテンプレート: 3 列比較
          const origUri = pngToDataUri(diff.originalPng);
          const genUri = pngToDataUri(diff.generatedPng);
          const diffUri = pngToDataUri(diff.diffPng);

          html += `<div class="slide-comparison">`;
          html += `<div><div class="col-header">Original Template</div>`;
          html += origUri ? `<img src="${origUri}" alt="original">` : `<p style="color:#666;">N/A</p>`;
          html += `</div>`;
          html += `<div><div class="col-header">Generated</div>`;
          html += genUri ? `<img src="${genUri}" alt="generated">` : `<p style="color:#666;">N/A</p>`;
          html += `</div>`;
          html += `<div><div class="col-header">Diff</div>`;
          html += diffUri ? `<img src="${diffUri}" alt="diff">` : `<p style="color:#666;">N/A</p>`;
          html += `</div>`;
          html += `</div>`;
        }
      }

      // プレースホルダー情報テーブル
      html += `<table><thead><tr><th>Name</th><th>Type</th><th>X</th><th>Y</th><th>W</th><th>H</th></tr></thead><tbody>`;
      for (const ph of layout.placeholders) {
        html += `<tr>`;
        html += `<td class="ph-${ph.type}">${ph.name}</td>`;
        html += `<td>${ph.type}</td>`;
        html += `<td>${ph.x.toFixed(2)}</td>`;
        html += `<td>${ph.y.toFixed(2)}</td>`;
        html += `<td>${ph.width.toFixed(2)}</td>`;
        html += `<td>${ph.height.toFixed(2)}</td>`;
        html += `</tr>`;
      }
      html += `</tbody></table>`;

      html += `</div>`; // .layout-section
    }

    html += `</div>`; // .template-section
  }

  html += `
<footer style="margin-top:48px;padding:16px 0;border-top:1px solid #333;font-size:12px;color:#666;">
  <p>gensmark - PPTX Template Import Fidelity Report</p>
  <p>Diff threshold: 0.1 (pixelmatch) | PNG resolution: 150 DPI (pdftoppm)</p>
</footer>
</body>
</html>`;

  return html;
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== PPTX Template Import Fidelity Verification ===\n");

  // ツール検出
  const libreoffice = await findLibreOfficeBinary();
  if (!libreoffice) {
    throw new Error(
      'LibreOffice (soffice) not found. Install it or set LIBREOFFICE_BIN.',
    );
  }
  console.log(`[tool] LibreOffice: ${libreoffice}`);

  const pdftoppm = await findPdfToPpmBinary();
  if (!pdftoppm) {
    throw new Error("pdftoppm not found. Install poppler-utils (Linux) or poppler (macOS).");
  }
  console.log(`[tool] pdftoppm: ${pdftoppm}`);

  // テンプレート取得
  let templatePaths: string[] = [];

  if (SINGLE_TEMPLATE) {
    if (!existsSync(SINGLE_TEMPLATE)) {
      throw new Error(`Template not found: ${SINGLE_TEMPLATE}`);
    }
    templatePaths = [SINGLE_TEMPLATE];
  } else if (SKIP_DOWNLOAD) {
    // 既存のサンプルを探す
    if (existsSync(SAMPLES_DIR)) {
      templatePaths = readdirSync(SAMPLES_DIR)
        .filter((f) => f.endsWith(".pptx"))
        .map((f) => join(SAMPLES_DIR, f));
    }
    if (templatePaths.length === 0 && existsSync(FALLBACK_TEMPLATE)) {
      templatePaths = [FALLBACK_TEMPLATE];
    }
  } else {
    templatePaths = await downloadTemplates();
  }

  // フォールバック: 既存テンプレート
  if (templatePaths.length === 0 && existsSync(FALLBACK_TEMPLATE)) {
    console.log("[fallback] Using basic-template.pptx");
    templatePaths = [FALLBACK_TEMPLATE];
  }

  if (templatePaths.length === 0) {
    throw new Error("No PPTX templates available for testing.");
  }

  console.log(`\n[templates] ${templatePaths.length} template(s) to process`);

  // 出力ディレクトリ準備
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });
  mkdirSync(join(ROOT, "output"), { recursive: true });

  const reportDataList: ReportData[] = [];

  for (const templatePath of templatePaths) {
    const templateName = basename(templatePath, ".pptx");
    const templateOutDir = join(OUT_ROOT, templateName);
    const origPngDir = join(templateOutDir, "original-png");
    const genPngDir = join(templateOutDir, "generated-png");
    const diffDir = join(templateOutDir, "diff");

    mkdirSync(origPngDir, { recursive: true });
    mkdirSync(genPngDir, { recursive: true });
    mkdirSync(diffDir, { recursive: true });

    try {
      // スライド有無の検出
      const origHasSlides = await hasActualSlides(templatePath);
      if (!origHasSlides) {
        console.log(`[slides] ${templateName}: no slides in original (template-only file)`);
      } else {
        console.log(`[slides] ${templateName}: has actual slides`);
      }

      // インポート + スライド生成
      const testResult = await processTemplate(templatePath, templateOutDir);

      // 元テンプレート → PNG (スライドがある場合のみ意味がある)
      let originalPngs: string[] = [];
      if (origHasSlides) {
        console.log(`[convert] original -> PNG ...`);
        try {
          originalPngs = await convertPptxToPng({
            libreoffice,
            pdftoppm,
            pptxPath: templatePath,
            outDir: origPngDir,
          });
          console.log(`[convert] original: ${originalPngs.length} slide(s)`);
        } catch (e) {
          console.warn(`[convert] original failed: ${e}`);
        }
      } else {
        console.log(`[convert] skipping original PNG conversion (no slides in template)`);
      }

      // 生成 PPTX → PNG
      console.log(`[convert] generated -> PNG ...`);
      let generatedPngs: string[] = [];
      if (existsSync(testResult.generatedPptxPath) && readFileSync(testResult.generatedPptxPath).length > 0) {
        try {
          generatedPngs = await convertPptxToPng({
            libreoffice,
            pdftoppm,
            pptxPath: testResult.generatedPptxPath,
            outDir: genPngDir,
          });
          console.log(`[convert] generated: ${generatedPngs.length} slide(s)`);
        } catch (e) {
          console.warn(`[convert] generated failed: ${e}`);
        }
      } else {
        console.warn(`[convert] generated PPTX is empty or missing, skipping`);
      }

      // ピクセル比較 (元テンプレートにスライドがある場合のみ)
      let diffs: DiffResult[] = [];
      if (origHasSlides && originalPngs.length > 0) {
        console.log(`[compare] pixel diff ...`);
        const compareCount = Math.min(originalPngs.length, generatedPngs.length);
        if (originalPngs.length !== generatedPngs.length) {
          console.log(`[compare] slide count mismatch: original=${originalPngs.length} generated=${generatedPngs.length}, comparing first ${compareCount}`);
        }
        diffs = comparePngs(originalPngs, generatedPngs, testResult.layouts, diffDir);

        for (const d of diffs) {
          if (d.diffRatio >= 0) {
            const pct = (d.diffRatio * 100).toFixed(1);
            console.log(`  [${d.layoutName}] diff=${pct}% (${d.diffPixels} px) [${d.originalSize} -> ${d.generatedSize}]`);
          } else if (!d.sizeMatch && d.originalSize !== "N/A") {
            console.log(`  [${d.layoutName}] size mismatch: ${d.originalSize} vs ${d.generatedSize}`);
          } else {
            console.log(`  [${d.layoutName}] no PNG available`);
          }
        }
      } else {
        // スライドなしテンプレート: 生成 PNG のみの DiffResult を作成
        for (let i = 0; i < testResult.layouts.length; i++) {
          const layout = testResult.layouts[i]!;
          const genPath = generatedPngs[i] ?? null;
          diffs.push({
            layoutName: layout.layoutName,
            slideIndex: layout.slideIndex,
            originalPng: null,
            generatedPng: genPath,
            diffPng: null,
            diffPixels: -1,
            totalPixels: 0,
            diffRatio: -1,
            sizeMatch: false,
            originalSize: "N/A (no slides in template)",
            generatedSize: genPath ? "available" : "N/A",
          });
        }
        console.log(`[compare] skipped pixel diff (no slides in original template)`);
      }

      reportDataList.push({
        templateName: testResult.templateName,
        templatePath: testResult.templatePath,
        importResult: testResult.importResult,
        layouts: testResult.layouts,
        diffs,
        hasOriginalSlides: origHasSlides,
      });
    } catch (e) {
      console.error(`[error] ${templateName}: ${e}`);
    }
  }

  // HTML レポート生成
  console.log(`\n[report] Generating HTML report ...`);
  const html = generateHtmlReport(reportDataList);
  writeFileSync(REPORT_PATH, html, "utf8");
  console.log(`[report] ${REPORT_PATH}`);

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
