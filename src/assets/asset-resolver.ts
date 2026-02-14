import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { MermaidContent } from "../types/content.ts";
import type { DeckSpec } from "../types/spec.ts";
import type { ValidationResult } from "../types/validation.ts";

export interface AssetResolveOptions {
  /** 生成物の出力先 (未指定時は OS の temp 配下) */
  assetDir?: string;
  /**
   * Mermaid の埋め込み形式 (既定: "auto")
   * - "auto": SVG を優先し、失敗時に PNG にフォールバック
   * - "svg": SVG のみ
   * - "png": PNG のみ
   */
  mermaidFormat?: "auto" | "svg" | "png";
  /** Mermaid の base font size (px) */
  mermaidFontSizePx?: number;
}

export interface MermaidAssetInfo {
  slideIndex: number;
  placeholder: string;
  svgPath?: string;
  pngPath?: string;
  viewBox?: { w: number; h: number };
  nodeCount?: number;
  edgeCount?: number;
  estimatedMinFontPt?: number;
}

export interface AssetResolveResult {
  spec: DeckSpec;
  validations: ValidationResult[];
  mermaidAssets: MermaidAssetInfo[];
}

export async function resolveAssets(
  spec: DeckSpec,
  options: AssetResolveOptions = {},
): Promise<AssetResolveResult> {
  const validations: ValidationResult[] = [];
  const mermaidAssets: MermaidAssetInfo[] = [];

  const outDir = options.assetDir ?? join(tmpdir(), "gensmark-assets");
  mkdirSync(outDir, { recursive: true });

  const nextSpec: DeckSpec = structuredClone(spec);

  for (let slideIndex = 0; slideIndex < nextSpec.slides.length; slideIndex++) {
    const slide = nextSpec.slides[slideIndex]!;
    const layout = nextSpec.master.layouts[slide.layout];
    if (!layout) continue;

    for (const [phName, value] of Object.entries(slide.data)) {
      if (!value || typeof value !== "object") continue;
      if ((value as { type?: unknown }).type !== "mermaid") continue;

      const mermaid = value as MermaidContent;
      const phDef = layout.placeholders.find((p) => p.name === phName);
      if (!phDef) continue;

      try {
        const embedFormat = mermaid.format ?? options.mermaidFormat ?? "auto";
        const info = await renderMermaid(mermaid, outDir, nextSpec.master.theme, {
          widthIn: phDef.width,
          heightIn: phDef.height,
          embedFormat,
          fontSizePx: options.mermaidFontSizePx ?? 16,
        });

        const embedPath = selectEmbedPath(info, embedFormat);

        // Mermaid は画像として扱う (既存の image 経路に乗せる)
        slide.data[phName] = {
          type: "image",
          path: embedPath,
          alt: "mermaid diagram",
          sizing: "contain",
        };

        mermaidAssets.push({
          slideIndex,
          placeholder: phName,
          svgPath: info.svgPath,
          pngPath: info.pngPath,
          viewBox: info.viewBox,
          nodeCount: info.nodeCount,
          edgeCount: info.edgeCount,
          estimatedMinFontPt: info.estimatedMinFontPt,
        });
      } catch (e) {
        validations.push({
          slideIndex,
          placeholder: phName,
          severity: "error",
          type: "asset-error",
          message: `Failed to render mermaid: ${(e as Error).message}`,
          suggestion:
            "Install mermaid-cli dependencies and ensure Chromium is available (PUPPETEER_EXECUTABLE_PATH).",
        });
      }
    }
  }

  return { spec: nextSpec, validations, mermaidAssets };
}

async function renderMermaid(
  mermaid: MermaidContent,
  outDir: string,
  theme: DeckSpec["master"]["theme"],
  options: {
    widthIn: number;
    heightIn: number;
    embedFormat: "auto" | "svg" | "png";
    fontSizePx: number;
  },
): Promise<{
  svgPath?: string;
  pngPath?: string;
  viewBox?: { w: number; h: number };
  nodeCount?: number;
  edgeCount?: number;
  estimatedMinFontPt?: number;
}> {
  const hash = createHash("sha256")
    .update(mermaid.code)
    .update(JSON.stringify(mermaid.config ?? {}))
    .update(JSON.stringify(theme))
    .digest("hex")
    .slice(0, 16);

  const base = join(outDir, `mermaid-${hash}`);
  const inputPath = `${base}.mmd`;
  const configPath = `${base}.config.json`;
  const cssPath = `${base}.style.css`;
  const svgPath = `${base}.svg`;
  const pngPath = `${base}.png`;

  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(inputPath, mermaid.code, "utf8");

  const { configJson, cssText, mermaidTheme } = buildMermaidTheme(
    theme,
    options.fontSizePx,
    mermaid.config,
  );
  writeFileSync(configPath, JSON.stringify(configJson, null, 2), "utf8");
  writeFileSync(cssPath, cssText, "utf8");

  // (品質分析のため) SVG は常に生成を試みる。キャッシュがあれば再生成しない。
  let svgOk = fileExistsNonEmpty(svgPath);
  let svgErr: Error | undefined;
  if (!svgOk) {
    try {
      await runMmdc({
        inputPath,
        outputPath: svgPath,
        theme: mermaidTheme,
        configPath,
        cssPath,
        background: "transparent",
      });
      svgOk = true;
    } catch (e) {
      svgErr = e as Error;
    }
  }

  // PNG は埋め込みが要求される場合のみ生成 (auto で svg が失敗した場合も含む)
  const needPng = options.embedFormat === "png" || (options.embedFormat === "auto" && !svgOk);
  let pngOk = fileExistsNonEmpty(pngPath);
  if (needPng && !pngOk) {
    await runMmdc({
      inputPath,
      outputPath: pngPath,
      theme: mermaidTheme,
      configPath,
      cssPath,
      background: "transparent",
    });
    pngOk = true;
  }

  // svg 必須なのに失敗した場合はここで落とす
  if (options.embedFormat === "svg" && !svgOk) {
    throw svgErr ?? new Error("Failed to render mermaid SVG");
  }

  // auto で svg が落ちた場合、png も落ちたならエラー
  if (options.embedFormat === "auto" && !svgOk && !pngOk) {
    throw svgErr ?? new Error("Failed to render mermaid (svg and png)");
  }

  // png 指定で png が生成できなかった場合はエラー (svg があっても指定尊重)
  if (options.embedFormat === "png" && !pngOk) {
    throw new Error("Failed to render mermaid PNG");
  }

  // SVG から品質メタを推定
  let viewBox: { w: number; h: number } | undefined;
  let nodeCount: number | undefined;
  let edgeCount: number | undefined;
  let estimatedMinFontPt: number | undefined;

  if (svgOk) {
    const svg = await Bun.file(svgPath).text();
    viewBox = parseViewBox(svg);
    nodeCount = (svg.match(/class="node\b/g) ?? []).length;
    edgeCount = (svg.match(/data-edge="true"/g) ?? []).length;
    const baseFontPx = parseBaseFontPx(svg) ?? options.fontSizePx;
    if (viewBox) {
      // 96dpi 仮定で、placeholder への contain スケールを推定する
      const targetWpx = options.widthIn * 96;
      const targetHpx = options.heightIn * 96;
      const scale = Math.min(targetWpx / viewBox.w, targetHpx / viewBox.h);
      const effectivePx = baseFontPx * scale;
      estimatedMinFontPt = effectivePx * (72 / 96);
    }
  }

  return {
    svgPath: svgOk ? svgPath : undefined,
    pngPath: pngOk ? pngPath : undefined,
    viewBox,
    nodeCount,
    edgeCount,
    estimatedMinFontPt,
  };
}

function buildMermaidTheme(
  theme: DeckSpec["master"]["theme"],
  fontSizePx: number,
  override?: Record<string, unknown>,
): {
  configJson: Record<string, unknown>;
  cssText: string;
  mermaidTheme: "default" | "neutral" | "dark" | "forest";
} {
  const bg = theme.colors.background;
  const fg = theme.colors.text;
  const primary = theme.colors.primary;
  const muted = theme.colors.muted ?? "#F4F5F7";

  const isDark = isDarkColor(bg);
  const mermaidTheme: "default" | "neutral" | "dark" | "forest" = isDark ? "dark" : "neutral";

  const configJson: Record<string, unknown> = {
    themeVariables: {
      fontFamily: `${theme.fonts.body}, Arial, sans-serif`,
      fontSize: `${fontSizePx}px`,
      // 一部の要素にしか効かないが、可能な限りテーマに寄せる
      primaryColor: bg,
      primaryTextColor: fg,
      primaryBorderColor: primary,
      lineColor: primary,
      secondaryColor: muted,
      tertiaryColor: muted,
    },
    ...(override ?? {}),
  };

  // draw.io 風の見た目を CSS で上書き (SVG 内 style の後ろに追記される)
  const nodeFill = muted;
  const cssText = [
    `#my-svg{font-family:${theme.fonts.body},Arial,sans-serif;font-size:${fontSizePx}px;}`,
    `#my-svg .label text,#my-svg span{fill:${fg};color:${fg};}`,
    `#my-svg .node rect,#my-svg .node circle,#my-svg .node ellipse,#my-svg .node polygon,#my-svg .node path{fill:${nodeFill};stroke:${primary};stroke-width:1.5px;}`,
    `#my-svg .edgePath .path,#my-svg .flowchart-link{stroke:${primary};stroke-width:2px;}`,
    `#my-svg .marker{fill:${primary};stroke:${primary};}`,
    `#my-svg .edgeLabel{background-color:transparent;}`,
    `#my-svg .edgeLabel rect{opacity:0;}`,
  ].join("\n");

  return { configJson, cssText, mermaidTheme };
}

function isDarkColor(hex: string): boolean {
  const c = hex.startsWith("#") ? hex.slice(1) : hex;
  if (c.length !== 6) return false;
  const r = Number.parseInt(c.slice(0, 2), 16);
  const g = Number.parseInt(c.slice(2, 4), 16);
  const b = Number.parseInt(c.slice(4, 6), 16);
  // relative luminance
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.5;
}

function parseViewBox(svg: string): { w: number; h: number } | undefined {
  // 先頭2値 (x,y) は無視し、w/h のみ使う
  const m = svg.match(/viewBox="[-0-9.]+ [-0-9.]+ ([0-9.]+) ([0-9.]+)"/);
  if (!m) return undefined;
  return { w: Number(m[1]), h: Number(m[2]) };
}

function parseBaseFontPx(svg: string): number | undefined {
  const m = svg.match(/font-size:([0-9.]+)px/);
  if (!m) return undefined;
  return Number(m[1]);
}

async function runMmdc(args: {
  inputPath: string;
  outputPath: string;
  theme: string;
  configPath: string;
  cssPath: string;
  background: string;
}): Promise<void> {
  const proc = Bun.spawn(
    [
      "bunx",
      "mmdc",
      "-i",
      args.inputPath,
      "-o",
      args.outputPath,
      "-b",
      args.background,
      "-t",
      args.theme,
      "-c",
      args.configPath,
      "-C",
      args.cssPath,
      "-q",
    ],
    {
      stdout: "ignore",
      stderr: "pipe",
    },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(err.trim() || `mmdc failed with exit code ${exitCode}`);
  }
}

function fileExistsNonEmpty(path: string): boolean {
  try {
    if (!existsSync(path)) return false;
    return statSync(path).size > 0;
  } catch {
    return false;
  }
}

function selectEmbedPath(
  rendered: { svgPath?: string; pngPath?: string },
  format: "auto" | "svg" | "png",
): string {
  if (format === "svg") {
    if (!rendered.svgPath) throw new Error("Mermaid SVG is not available");
    return rendered.svgPath;
  }
  if (format === "png") {
    if (!rendered.pngPath) throw new Error("Mermaid PNG is not available");
    return rendered.pngPath;
  }
  const auto = rendered.svgPath ?? rendered.pngPath;
  if (!auto) throw new Error("Mermaid output is not available");
  return auto;
}
