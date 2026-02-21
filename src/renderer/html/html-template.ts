// ベース HTML テンプレート

/** self-contained HTML ドキュメントを生成 */
export function wrapHtml(options: {
  themeCSS: string;
  slidesHtml: string;
  slideWidth: number;
  slideHeight: number;
  title?: string;
  mermaidEnabled?: boolean;
}): string {
  const { themeCSS, slidesHtml, slideWidth, slideHeight, title, mermaidEnabled } = options;

  const mermaidScript = mermaidEnabled
    ? '<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script><script>mermaid.initialize({startOnLoad:true,theme:"default"});</script>'
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title ?? "gensmark presentation"}</title>
<style>
${themeCSS}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #e0e0e0;
  font-family: var(--gm-font-body);
  color: var(--gm-color-text);
}

.gm-deck {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 24px 0;
}

.gm-slide {
  background: #FFFFFF;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  flex-shrink: 0;
}

/* プレースホルダー内のテキストラッピング */
.gm-ph {
  overflow: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* テーブル */
.gm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: inherit;
}
.gm-table th,
.gm-table td {
  border: 1px solid #ddd;
  padding: 4pt 6pt;
  text-align: left;
}
.gm-table th {
  font-weight: bold;
}

/* 箇条書き */
.gm-bullets {
  padding-left: 1.5em;
  margin: 0;
  list-style-position: outside;
}
.gm-bullets li {
  margin-bottom: 0.3em;
}
.gm-bullets-nested {
  padding-left: 1.5em;
  margin-top: 0.2em;
}

/* コードブロック */
.gm-code {
  margin: 0;
  padding: 8pt;
  border-radius: 4pt;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: inherit;
  line-height: 1.4;
}
.gm-code code {
  font-family: var(--gm-font-mono);
  font-size: inherit;
}

/* 画像 */
.gm-image {
  display: block;
}

/* Mermaid */
.mermaid {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 印刷用 */
@media print {
  body {
    background: none;
  }
  .gm-deck {
    gap: 0;
    padding: 0;
  }
  .gm-slide {
    box-shadow: none;
    page-break-after: always;
    width: ${slideWidth}in !important;
    height: ${slideHeight}in !important;
  }
  .gm-slide:last-child {
    page-break-after: auto;
  }
}
</style>
${mermaidScript}
</head>
<body>
<div class="gm-deck" data-slide-width="${slideWidth}" data-slide-height="${slideHeight}">
${slidesHtml}
</div>
</body>
</html>`;
}
