import { resolveSlide } from "../core/slide-resolver.ts";
import { HtmlRenderer } from "../renderer/html/html-renderer.ts";
import { getSlideDimensions } from "../renderer/html/slide-to-html.ts";
import type { ComputedSlide } from "../types/layout.ts";
import type { AspectRatio } from "../types/master.ts";
import type { DeckSpec } from "../types/spec.ts";

// Bun.serve() ベースのライブプレビューサーバー

/** プレビューオプション */
export interface PreviewOptions {
  /** ポート番号 (デフォルト: 3000) */
  port?: number;
  /** 自動でブラウザを開くか (デフォルト: true) */
  open?: boolean;
}

/** DeckSpec から ComputedSlide[] を生成 */
function specToComputedSlides(spec: DeckSpec): ComputedSlide[] {
  const computed: ComputedSlide[] = [];
  for (let i = 0; i < spec.slides.length; i++) {
    const slide = spec.slides[i]!;
    const result = resolveSlide(slide, spec.master, i);
    computed.push(result.computed);
  }
  return computed;
}

/** プレビュー用 HTML を生成 (スライドナビ + WebSocket HMR 付き) */
function generatePreviewHtml(spec: DeckSpec): string {
  const aspectRatio: AspectRatio = spec.aspectRatio ?? spec.master.aspectRatio ?? "16:9";
  const computedSlides = specToComputedSlides(spec);
  const { width, height } = getSlideDimensions(aspectRatio);

  const htmlRenderer = new HtmlRenderer(aspectRatio);
  htmlRenderer.setMaster(spec.master);
  htmlRenderer.renderSlides(computedSlides);
  const deckHtml = htmlRenderer.toHtmlString();

  // プレビュー用の HTML を返す (ナビゲーション + スケーリング + WebSocket)
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>gensmark preview</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #1a1a1a;
  color: #fff;
  font-family: system-ui, sans-serif;
  overflow: hidden;
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.toolbar {
  background: #2d2d2d;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  flex-shrink: 0;
}
.toolbar button {
  background: #444;
  color: #fff;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.toolbar button:hover { background: #555; }
.toolbar .slide-counter { margin-left: auto; opacity: 0.7; }
.viewport {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  position: relative;
}
.slide-frame {
  width: ${width}in;
  height: ${height}in;
  transform-origin: center center;
  position: relative;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}
.notes-panel {
  background: #2d2d2d;
  padding: 12px 16px;
  max-height: 120px;
  overflow-y: auto;
  font-size: 13px;
  color: #ccc;
  flex-shrink: 0;
  display: none;
}
.notes-panel.visible { display: block; }
</style>
</head>
<body>
<div class="toolbar">
  <button id="prevBtn">&larr; Prev</button>
  <button id="nextBtn">Next &rarr;</button>
  <button id="notesBtn">Notes</button>
  <span class="slide-counter" id="counter">1 / 1</span>
</div>
<div class="viewport" id="viewport"></div>
<div class="notes-panel" id="notes"></div>

<script>
// スライドデータを iframe にせず、テンプレートリテラルで埋め込む
const deckHtml = ${JSON.stringify(deckHtml)};
const slideWidth = ${width};
const slideHeight = ${height};

// HTML をパースしてスライド要素を抽出
const parser = new DOMParser();
const doc = parser.parseFromString(deckHtml, "text/html");
const slideEls = doc.querySelectorAll(".gm-slide");
const slides = Array.from(slideEls).map(el => ({
  html: el.outerHTML,
  notes: el.dataset.notes || ""
}));

// スライドのスピーカーノートを抽出 (data属性やコメントから)
const slideNotes = ${JSON.stringify(computedSlides.map((s) => s.notes ?? ""))};

let current = 0;
const viewport = document.getElementById("viewport");
const counter = document.getElementById("counter");
const notesPanel = document.getElementById("notes");

function renderSlide() {
  if (slides.length === 0) {
    viewport.innerHTML = "<p style='color:#888'>No slides</p>";
    return;
  }

  // スケール計算
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const sw = slideWidth * 96;
  const sh = slideHeight * 96;
  const scale = Math.min(vw / sw, vh / sh) * 0.95;

  viewport.innerHTML = '<div class="slide-frame" style="transform:scale(' + scale + ')">' +
    slides[current].html + '</div>';
  counter.textContent = (current + 1) + " / " + slides.length;

  // ノート
  const note = slideNotes[current] || "";
  notesPanel.textContent = note || "(no notes)";
}

function prev() { if (current > 0) { current--; renderSlide(); } }
function next() { if (current < slides.length - 1) { current++; renderSlide(); } }

document.getElementById("prevBtn").onclick = prev;
document.getElementById("nextBtn").onclick = next;
document.getElementById("notesBtn").onclick = () => {
  notesPanel.classList.toggle("visible");
};

// キーボードナビゲーション
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
  if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") next();
});

// WebSocket HMR
const ws = new WebSocket("ws://" + location.host + "/ws");
ws.onmessage = (e) => {
  if (e.data === "reload") location.reload();
};
ws.onclose = () => {
  // 再接続を試みる
  setTimeout(() => { location.reload(); }, 2000);
};

renderSlide();
window.addEventListener("resize", renderSlide);
</script>
</body>
</html>`;
}

/** プレビューサーバーを起動 */
export async function startPreview(
  spec: DeckSpec,
  options: PreviewOptions = {},
): Promise<void> {
  const port = options.port ?? 3000;
  const open = options.open ?? true;

  const wsClients = new Set<any>();

  const server = Bun.serve({
    port,
    routes: {
      "/": () => {
        const html = generatePreviewHtml(spec);
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
    websocket: {
      open(ws) {
        wsClients.add(ws);
      },
      message(_ws, _msg) {
        // クライアントからのメッセージは不要
      },
      close(ws) {
        wsClients.delete(ws);
      },
    },
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        if (server.upgrade(req)) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      // ルートにフォールバック
      const html = generatePreviewHtml(spec);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  });

  const url = `http://localhost:${port}`;
  console.log(`gensmark preview server running at ${url}`);

  if (open) {
    // macOS でブラウザを開く
    try {
      Bun.spawn(["open", url]);
    } catch {
      // ブラウザを開けなくても続行
    }
  }

  // サーバーが終了するまで待機 (Ctrl+C で停止)
  await new Promise<void>(() => {});
}
