import { MasterStore } from "./master-store.ts";
import { renderLayoutPreview, renderPlaceholderTable } from "./layout-preview-renderer.ts";
import { generateMasterCode } from "./code-generator.ts";
import { importPptxTemplate } from "../../import/pptx-template-importer.ts";
import type { AspectRatio } from "../../types/master.ts";

// Slide Master Editor GUI サーバー
// 起動: bun run src/tools/master-editor/master-editor.ts

const PORT = 3100;
const store = new MasterStore();

/** メイン HTML ページを生成 */
function generateEditorHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>gensmark Master Editor</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #1a1a1a;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, sans-serif;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ヘッダー */
.header {
  background: #2d2d2d;
  border-bottom: 1px solid #444;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}
.header h1 {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}
.header .actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.btn {
  background: #444;
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}
.btn:hover { background: #555; }
.btn-primary { background: #2B579A; }
.btn-primary:hover { background: #3668B0; }

/* メインレイアウト */
.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* サイドバー */
.sidebar {
  width: 260px;
  background: #222;
  border-right: 1px solid #444;
  overflow-y: auto;
  flex-shrink: 0;
}
.sidebar-section {
  padding: 12px;
  border-bottom: 1px solid #333;
}
.sidebar-section h3 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  margin-bottom: 8px;
}
.master-item, .layout-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
  display: flex;
  align-items: center;
  gap: 8px;
}
.master-item:hover, .layout-item:hover { background: #333; }
.master-item.active, .layout-item.active { background: #2B579A; color: #fff; }
.master-item .badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #444;
  color: #aaa;
}
.master-item.active .badge { background: rgba(255,255,255,0.2); color: #ddd; }

/* コンテンツエリア */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* ギャラリービュー */
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.gallery-card {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}
.gallery-card:hover {
  border-color: #5B9BD5;
  transform: translateY(-2px);
}
.gallery-card .preview-container {
  padding: 12px;
  background: #1e1e1e;
  display: flex;
  justify-content: center;
}
.gallery-card .preview-container .wireframe-slide {
  transform-origin: top left;
}
.gallery-card .card-label {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #ccc;
  border-top: 1px solid #333;
}

/* 詳細ビュー */
.detail-view {
  display: flex;
  gap: 20px;
  height: 100%;
}
.detail-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.detail-preview .wireframe-slide {
  transform-origin: top center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.detail-info {
  width: 340px;
  flex-shrink: 0;
  overflow-y: auto;
}
.detail-info h3 {
  font-size: 14px;
  margin-bottom: 12px;
  color: #fff;
}
.back-link {
  font-size: 13px;
  color: #5B9BD5;
  cursor: pointer;
  margin-bottom: 16px;
  display: inline-block;
}
.back-link:hover { text-decoration: underline; }

/* モーダル */
.modal-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  z-index: 100;
  justify-content: center;
  align-items: center;
}
.modal-overlay.visible { display: flex; }
.modal {
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.modal-header {
  padding: 14px 20px;
  border-bottom: 1px solid #444;
  display: flex;
  align-items: center;
  gap: 12px;
}
.modal-header h2 { font-size: 16px; color: #fff; }
.modal-header .close-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
}
.modal-header .close-btn:hover { color: #fff; }
.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}
.code-block {
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 16px;
  font-family: "Consolas", "Monaco", monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre;
  overflow-x: auto;
  color: #e0e0e0;
  tab-size: 2;
}
.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid #444;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #2B579A;
  color: #fff;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 200;
}
.toast.visible { opacity: 1; }
</style>
</head>
<body>

<div class="header">
  <h1>gensmark Master Editor</h1>
  <div class="actions">
    <button class="btn btn-primary" id="importBtn">Import PPTX</button>
    <button class="btn" id="exportBtn" disabled>Export Code</button>
  </div>
</div>

<div class="main">
  <div class="sidebar" id="sidebar"></div>
  <div class="content" id="content">
    <p style="color:#666;padding:40px;text-align:center;">マスターを選択してください</p>
  </div>
</div>

<!-- コードエクスポートモーダル -->
<div class="modal-overlay" id="exportModal">
  <div class="modal">
    <div class="modal-header">
      <h2>Export TypeScript Code</h2>
      <button class="close-btn" id="closeExportModal">&times;</button>
    </div>
    <div class="modal-body">
      <div class="code-block" id="exportCode"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="copyCodeBtn">Copy to Clipboard</button>
    </div>
  </div>
</div>

<!-- PPTX インポート -->
<input type="file" id="pptxInput" accept=".pptx" style="display:none">

<!-- トースト通知 -->
<div class="toast" id="toast"></div>

<script>
// 状態管理
let masters = [];
let selectedMasterId = null;
let selectedLayoutName = null;

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("content");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const pptxInput = document.getElementById("pptxInput");
const exportModal = document.getElementById("exportModal");
const exportCode = document.getElementById("exportCode");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const closeExportModal = document.getElementById("closeExportModal");
const toast = document.getElementById("toast");

// トースト通知
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2000);
}

// API 呼び出し
async function fetchMasters() {
  const res = await fetch("/api/masters");
  masters = await res.json();
  renderSidebar();
  if (!selectedMasterId && masters.length > 0) {
    selectMaster(masters[0].id);
  }
}

async function fetchLayoutPreview(masterId, layoutName) {
  const res = await fetch("/api/masters/" + masterId + "/layouts/" + encodeURIComponent(layoutName) + "/preview");
  return res.text();
}

async function fetchExportCode(masterId) {
  const res = await fetch("/api/masters/" + masterId + "/export");
  return res.text();
}

// サイドバー描画
function renderSidebar() {
  let html = '<div class="sidebar-section"><h3>Masters</h3>';
  for (const m of masters) {
    const active = m.id === selectedMasterId ? " active" : "";
    const badge = m.source === "builtin" ? "builtin" : "imported";
    html += '<div class="master-item' + active + '" data-id="' + m.id + '">';
    html += '<span>' + escapeHtml(m.name) + '</span>';
    html += '<span class="badge">' + badge + '</span>';
    html += '</div>';
  }
  html += '</div>';

  // 選択中マスターのレイアウト一覧
  if (selectedMasterId) {
    const master = masters.find(m => m.id === selectedMasterId);
    if (master) {
      html += '<div class="sidebar-section"><h3>Layouts</h3>';
      for (const name of master.layoutNames) {
        const active = name === selectedLayoutName ? " active" : "";
        html += '<div class="layout-item' + active + '" data-layout="' + escapeHtml(name) + '">';
        html += escapeHtml(name);
        html += '</div>';
      }
      html += '</div>';
    }
  }

  sidebar.innerHTML = html;

  // イベントハンドラ
  sidebar.querySelectorAll(".master-item").forEach(el => {
    el.addEventListener("click", () => selectMaster(el.dataset.id));
  });
  sidebar.querySelectorAll(".layout-item").forEach(el => {
    el.addEventListener("click", () => selectLayout(el.dataset.layout));
  });
}

// マスター選択
function selectMaster(id) {
  selectedMasterId = id;
  selectedLayoutName = null;
  exportBtn.disabled = false;
  renderSidebar();
  renderGallery();
}

// レイアウト選択 -> 詳細ビュー
async function selectLayout(name) {
  selectedLayoutName = name;
  renderSidebar();
  await renderDetail(name);
}

// ギャラリービュー描画
async function renderGallery() {
  const master = masters.find(m => m.id === selectedMasterId);
  if (!master) return;

  content.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">読み込み中...</p>';

  const previews = await Promise.all(
    master.layoutNames.map(async name => {
      const html = await fetchLayoutPreview(selectedMasterId, name);
      return { name, html };
    })
  );

  let html = '<div class="gallery">';
  for (const { name, html: previewHtml } of previews) {
    // サムネイルとして縮小表示
    html += '<div class="gallery-card" data-layout="' + escapeHtml(name) + '">';
    html += '<div class="preview-container"><div style="transform:scale(0.23);width:13.33in;height:7.5in;flex-shrink:0;">' + previewHtml + '</div></div>';
    html += '<div class="card-label">' + escapeHtml(name) + '</div>';
    html += '</div>';
  }
  html += '</div>';

  content.innerHTML = html;

  // カードクリック -> 詳細ビュー
  content.querySelectorAll(".gallery-card").forEach(el => {
    el.addEventListener("click", () => selectLayout(el.dataset.layout));
  });
}

// 詳細ビュー描画
async function renderDetail(layoutName) {
  content.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">読み込み中...</p>';

  const previewHtml = await fetchLayoutPreview(selectedMasterId, layoutName);

  // プレースホルダーテーブル
  const res = await fetch("/api/masters/" + selectedMasterId);
  const masterData = await res.json();
  const layout = masterData.layouts[layoutName];

  // スケールを計算
  const contentEl = document.getElementById("content");
  const availableWidth = contentEl.clientWidth - 340 - 60; // detail-info width + gaps
  const slideWidthPx = 13.33 * 96;
  const scale = Math.min(availableWidth / slideWidthPx, 0.55);

  let html = '<div class="detail-view">';
  html += '<div class="detail-preview">';
  html += '<span class="back-link" id="backToGallery">&larr; ギャラリーに戻る</span>';
  html += '<div style="transform:scale(' + scale + ');transform-origin:top center;width:13.33in;height:7.5in;flex-shrink:0;">' + previewHtml + '</div>';
  html += '</div>';

  html += '<div class="detail-info">';
  html += '<h3>' + escapeHtml(layoutName) + '</h3>';
  html += renderPlaceholderTableClient(layout);
  html += '</div>';

  html += '</div>';

  content.innerHTML = html;

  document.getElementById("backToGallery").addEventListener("click", () => {
    selectedLayoutName = null;
    renderSidebar();
    renderGallery();
  });
}

// クライアントサイドのプレースホルダーテーブル描画
function renderPlaceholderTableClient(layout) {
  if (!layout || !layout.placeholders) return "";
  let html = '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
  html += '<thead><tr style="border-bottom:1px solid #444;">';
  html += '<th style="text-align:left;padding:6px 8px;color:#aaa;">Name</th>';
  html += '<th style="text-align:left;padding:6px 8px;color:#aaa;">Type</th>';
  html += '<th style="text-align:right;padding:6px 8px;color:#aaa;">X</th>';
  html += '<th style="text-align:right;padding:6px 8px;color:#aaa;">Y</th>';
  html += '<th style="text-align:right;padding:6px 8px;color:#aaa;">W</th>';
  html += '<th style="text-align:right;padding:6px 8px;color:#aaa;">H</th>';
  html += '</tr></thead><tbody>';
  for (const ph of layout.placeholders) {
    html += '<tr style="border-bottom:1px solid #333;">';
    html += '<td style="padding:6px 8px;font-weight:bold;color:#5B9BD5;">' + escapeHtml(ph.name) + '</td>';
    html += '<td style="padding:6px 8px;color:#ccc;">' + escapeHtml(ph.type) + '</td>';
    html += '<td style="padding:6px 8px;color:#ccc;text-align:right;">' + ph.x.toFixed(2) + '</td>';
    html += '<td style="padding:6px 8px;color:#ccc;text-align:right;">' + ph.y.toFixed(2) + '</td>';
    html += '<td style="padding:6px 8px;color:#ccc;text-align:right;">' + ph.width.toFixed(2) + '</td>';
    html += '<td style="padding:6px 8px;color:#ccc;text-align:right;">' + ph.height.toFixed(2) + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// エクスポート
exportBtn.addEventListener("click", async () => {
  if (!selectedMasterId) return;
  const code = await fetchExportCode(selectedMasterId);
  exportCode.textContent = code;
  exportModal.classList.add("visible");
});

closeExportModal.addEventListener("click", () => {
  exportModal.classList.remove("visible");
});
exportModal.addEventListener("click", (e) => {
  if (e.target === exportModal) exportModal.classList.remove("visible");
});

copyCodeBtn.addEventListener("click", async () => {
  const code = exportCode.textContent;
  await navigator.clipboard.writeText(code);
  showToast("Copied to clipboard!");
});

// PPTX インポート
importBtn.addEventListener("click", () => pptxInput.click());
pptxInput.addEventListener("change", async () => {
  const file = pptxInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/import", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json();
      showToast("Error: " + (err.error || "Import failed"));
      return;
    }
    const result = await res.json();
    showToast("Imported: " + result.name);
    await fetchMasters();
    selectMaster(result.id);
  } catch (e) {
    showToast("Import error: " + e.message);
  }
  pptxInput.value = "";
});

// キーボードショートカット
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    exportModal.classList.remove("visible");
  }
});

// 起動
fetchMasters();
</script>
</body>
</html>`;
}

/** サーバーを起動 */
const server = Bun.serve({
  port: PORT,
  routes: {
    "/": () => {
      return new Response(generateEditorHtml(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
    "/api/masters": () => {
      const masters = store.list().map((e) => ({
        id: e.id,
        name: `${e.master.name}/${e.master.theme.name}`,
        source: e.source,
        layoutNames: Object.keys(e.master.layouts),
      }));
      return Response.json(masters);
    },
  },
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // GET /api/masters/:id
    const masterMatch = path.match(/^\/api\/masters\/(\w+)$/);
    if (masterMatch && req.method === "GET") {
      const entry = store.get(masterMatch[1]!);
      if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({
        id: entry.id,
        name: entry.master.name,
        source: entry.source,
        aspectRatio: entry.master.aspectRatio ?? "16:9",
        theme: entry.master.theme,
        margins: entry.master.margins,
        layouts: entry.master.layouts,
      });
    }

    // GET /api/masters/:id/layouts/:name/preview
    const previewMatch = path.match(/^\/api\/masters\/(\w+)\/layouts\/(.+)\/preview$/);
    if (previewMatch && req.method === "GET") {
      const entry = store.get(previewMatch[1]!);
      if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
      const layoutName = decodeURIComponent(previewMatch[2]!);
      const layout = entry.master.layouts[layoutName];
      if (!layout) return Response.json({ error: "Layout not found" }, { status: 404 });
      const aspectRatio: AspectRatio = entry.master.aspectRatio ?? "16:9";
      const html = renderLayoutPreview(layout, layoutName, aspectRatio);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // GET /api/masters/:id/export
    const exportMatch = path.match(/^\/api\/masters\/(\w+)\/export$/);
    if (exportMatch && req.method === "GET") {
      const entry = store.get(exportMatch[1]!);
      if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
      const code = generateMasterCode(entry.master);
      return new Response(code, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // POST /api/import
    if (path === "/api/import" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
          return Response.json({ error: "No file provided" }, { status: 400 });
        }

        // 一時ファイルに保存してインポート
        const tmpPath = `/tmp/gensmark-import-${Date.now()}.pptx`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await Bun.write(tmpPath, bytes);

        try {
          const result = await importPptxTemplate({ path: tmpPath });
          const id = store.add(result.master, "imported");
          return Response.json({
            id,
            name: `${result.master.name}/${result.master.theme.name}`,
            warnings: result.warnings,
          });
        } finally {
          // 一時ファイルを削除
          try {
            const { unlink } = await import("node:fs/promises");
            await unlink(tmpPath);
          } catch {
            // 削除失敗は無視
          }
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return Response.json({ error: message }, { status: 500 });
      }
    }

    // フォールバック: メイン HTML
    return new Response(generateEditorHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});

const editorUrl = `http://localhost:${PORT}`;
console.log(`gensmark Master Editor running at ${editorUrl}`);

// macOS でブラウザを自動オープン
try {
  Bun.spawn(["open", editorUrl]);
} catch {
  // ブラウザを開けなくても続行
}

// Ctrl+C まで待機
await new Promise<void>(() => {});
