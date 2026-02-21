import type { SlideMaster, PlaceholderDef, PlaceholderStyle, PlaceholderConstraints } from "../../types/master.ts";
import type { Theme } from "../../types/theme.ts";
import { ph } from "../../master/master-builder.ts";

// SlideMaster -> TypeScript コード文字列変換

/** ph.* のデフォルト値を取得 */
function getDefaults(type: PlaceholderDef["type"]): PlaceholderDef | null {
  switch (type) {
    case "title": return ph.title();
    case "subtitle": return ph.subtitle();
    case "body": return ph.body();
    case "image": return ph.image();
    default: return null;
  }
}

/** 数値を整形 (不要な末尾ゼロ除去) */
function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** オブジェクトを TypeScript コード文字列に変換 */
function objToCode(obj: Record<string, unknown>, indent: string): string {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "{}";

  const lines: string[] = [];
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      lines.push(`${indent}  ${key}: "${value}",`);
    } else if (typeof value === "number") {
      lines.push(`${indent}  ${key}: ${fmt(value)},`);
    } else if (typeof value === "boolean") {
      lines.push(`${indent}  ${key}: ${value},`);
    } else if (typeof value === "object" && value !== null) {
      lines.push(`${indent}  ${key}: ${objToCode(value as Record<string, unknown>, indent + "  ")},`);
    }
  }
  return `{\n${lines.join("\n")}\n${indent}}`;
}

/** スタイルの差分を計算 */
function diffStyle(actual?: PlaceholderStyle, defaults?: PlaceholderStyle): Record<string, unknown> | undefined {
  if (!actual) return undefined;
  if (!defaults) return actual as Record<string, unknown>;

  const diff: Record<string, unknown> = {};
  const keys: (keyof PlaceholderStyle)[] = [
    "fontSize", "fontFace", "color", "bold", "italic",
    "align", "valign", "lineSpacing", "monoFont", "codeBgColor",
  ];

  for (const key of keys) {
    if (actual[key] !== undefined && actual[key] !== defaults[key]) {
      diff[key] = actual[key];
    }
  }

  // padding の差分
  if (actual.padding) {
    const dp = defaults.padding;
    const ap = actual.padding;
    const padDiff: Record<string, unknown> = {};
    for (const side of ["top", "right", "bottom", "left"] as const) {
      if (ap[side] !== undefined && ap[side] !== dp?.[side]) {
        padDiff[side] = ap[side];
      }
    }
    if (Object.keys(padDiff).length > 0) {
      diff.padding = padDiff;
    }
  }

  return Object.keys(diff).length > 0 ? diff : undefined;
}

/** 制約の差分を計算 */
function diffConstraints(actual?: PlaceholderConstraints, defaults?: PlaceholderConstraints): Record<string, unknown> | undefined {
  if (!actual) return undefined;
  if (!defaults) return actual as Record<string, unknown>;

  const diff: Record<string, unknown> = {};
  const keys: (keyof PlaceholderConstraints)[] = [
    "maxFontSize", "minFontSize", "maxLines", "overflow", "required",
  ];

  for (const key of keys) {
    if (actual[key] !== undefined && actual[key] !== defaults[key]) {
      diff[key] = actual[key];
    }
  }

  return Object.keys(diff).length > 0 ? diff : undefined;
}

/** プレースホルダーのコード生成 */
function placeholderToCode(p: PlaceholderDef, indent: string): string {
  const defaults = getDefaults(p.type);

  // custom タイプはそのまま出力
  if (p.type === "custom" || !defaults) {
    const rect = `{ x: ${fmt(p.x)}, y: ${fmt(p.y)}, width: ${fmt(p.width)}, height: ${fmt(p.height)} }`;
    const overrides: string[] = [];
    if (p.style) {
      overrides.push(`style: ${objToCode(p.style as Record<string, unknown>, indent + "  ")}`);
    }
    if (p.constraints) {
      overrides.push(`constraints: ${objToCode(p.constraints as Record<string, unknown>, indent + "  ")}`);
    }
    const extra = overrides.length > 0 ? `, { ${overrides.join(", ")} }` : "";
    return `${indent}ph.custom("${p.name}", ${rect}${extra})`;
  }

  // 差分のみのオーバーライドを構築
  const overrides: Record<string, unknown> = {};

  // name がデフォルトと異なる場合
  if (p.name !== defaults.name) {
    overrides.name = p.name;
  }

  // 位置・サイズの差分
  if (Math.abs(p.x - defaults.x) > 0.005) overrides.x = p.x;
  if (Math.abs(p.y - defaults.y) > 0.005) overrides.y = p.y;
  if (Math.abs(p.width - defaults.width) > 0.005) overrides.width = p.width;
  if (Math.abs(p.height - defaults.height) > 0.005) overrides.height = p.height;

  // スタイルの差分
  const styleDiff = diffStyle(p.style, defaults.style);
  if (styleDiff) overrides.style = styleDiff;

  // 制約の差分
  const constraintsDiff = diffConstraints(p.constraints, defaults.constraints);
  if (constraintsDiff) overrides.constraints = constraintsDiff;

  if (Object.keys(overrides).length === 0) {
    return `${indent}ph.${p.type}()`;
  }

  return `${indent}ph.${p.type}(${objToCode(overrides, indent)})`;
}

/** テーマのコード生成 */
function themeToCode(theme: Theme): string {
  const lines: string[] = [];
  lines.push(`const theme = gensmark.defineTheme({`);
  lines.push(`  name: "${theme.name}",`);
  lines.push(`  colors: {`);
  lines.push(`    primary: "${theme.colors.primary}",`);
  lines.push(`    secondary: "${theme.colors.secondary}",`);
  lines.push(`    background: "${theme.colors.background}",`);
  lines.push(`    text: "${theme.colors.text}",`);
  if (theme.colors.accent) lines.push(`    accent: "${theme.colors.accent}",`);
  if (theme.colors.muted) lines.push(`    muted: "${theme.colors.muted}",`);
  lines.push(`  },`);
  lines.push(`  fonts: {`);
  lines.push(`    heading: "${theme.fonts.heading}",`);
  lines.push(`    body: "${theme.fonts.body}",`);
  if (theme.fonts.mono) lines.push(`    mono: "${theme.fonts.mono}",`);
  lines.push(`  },`);
  lines.push(`});`);
  return lines.join("\n");
}

/** SlideMaster -> TypeScript ソースコード文字列を生成 */
export function generateMasterCode(master: SlideMaster): string {
  const lines: string[] = [];

  lines.push(`import { gensmark, ph } from "gensmark";`);
  lines.push(``);
  lines.push(themeToCode(master.theme));
  lines.push(``);
  lines.push(`export const master = gensmark.defineMaster({`);
  lines.push(`  name: "${master.name}",`);
  lines.push(`  theme,`);

  if (master.aspectRatio) {
    lines.push(`  aspectRatio: "${master.aspectRatio}",`);
  }

  if (master.margins) {
    const m = master.margins;
    lines.push(`  margins: { top: ${fmt(m.top)}, right: ${fmt(m.right)}, bottom: ${fmt(m.bottom)}, left: ${fmt(m.left)} },`);
  }

  lines.push(`  layouts: {`);

  for (const [layoutName, layout] of Object.entries(master.layouts)) {
    // レイアウト名にハイフンが含まれる場合はクォート
    const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(layoutName)
      ? layoutName
      : `"${layoutName}"`;

    lines.push(`    ${key}: {`);
    lines.push(`      placeholders: [`);
    for (const p of layout.placeholders) {
      lines.push(`${placeholderToCode(p, "        ")},`);
    }
    lines.push(`      ],`);

    if (layout.background) {
      const bg = layout.background;
      if (bg.type === "solid") {
        lines.push(`      background: { type: "solid", color: "${bg.color}" },`);
      } else if (bg.type === "gradient") {
        const colors = bg.colors.map((c) => `"${c}"`).join(", ");
        const dir = bg.direction ? `, direction: "${bg.direction}"` : "";
        lines.push(`      background: { type: "gradient", colors: [${colors}]${dir} },`);
      } else if (bg.type === "image") {
        lines.push(`      background: { type: "image", path: "${bg.path}" },`);
      }
    }

    if (layout.fixedElements && layout.fixedElements.length > 0) {
      lines.push(`      fixedElements: [`);
      for (const el of layout.fixedElements) {
        const parts = [
          `type: "${el.type}"`,
          `x: ${fmt(el.x)}`,
          `y: ${fmt(el.y)}`,
          `width: ${fmt(el.width)}`,
          `height: ${fmt(el.height)}`,
        ];
        if (el.color) parts.push(`color: "${el.color}"`);
        if (el.path) parts.push(`path: "${el.path}"`);
        if (el.lineWidth) parts.push(`lineWidth: ${el.lineWidth}`);
        lines.push(`        { ${parts.join(", ")} },`);
      }
      lines.push(`      ],`);
    }

    lines.push(`    },`);
  }

  lines.push(`  },`);
  lines.push(`});`);

  return lines.join("\n");
}
