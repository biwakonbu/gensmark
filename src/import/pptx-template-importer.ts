import { basename } from "node:path";
import { defaultTheme } from "../master/presets/themes/default.ts";
import type {
  BackgroundDef,
  PlaceholderDef,
  PlaceholderType,
  SlideLayout,
  SlideMaster,
} from "../types/master.ts";
import type {
  ImportedTemplate,
  PlaceholderHint,
  TemplateImportOptions,
  TemplateImportWarning,
  TemplateLayoutMapEntry,
} from "../types/template.ts";
import {
  asArray,
  asObject,
  asString,
  loadZipFromPath,
  readRelationships,
  readXml,
  readXmlRequired,
  resolveRelationshipTarget,
  toRelsPath,
} from "./ooxml-reader.ts";

const EMU_PER_INCH = 914400;

const REL_TYPE = {
  SLIDE_MASTER: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster",
  SLIDE_LAYOUT: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
  THEME: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
} as const;

interface ParsedLayout {
  canonical: string;
  layoutPart: string;
  layout: SlideLayout;
  hints: PlaceholderHint[];
  aliases: string[];
}

/** .pptx からテンプレートを取り込む */
export async function importPptxTemplate(
  options: TemplateImportOptions,
): Promise<ImportedTemplate> {
  const aliasStrategy = options.aliasStrategy ?? "keep-original-with-alias";
  const { zip, rawBytes } = await loadZipFromPath(options.path);
  const warnings: TemplateImportWarning[] = [];

  const presentation = await readXmlRequired(zip, "ppt/presentation.xml");
  const presentationRoot = asObject(presentation["p:presentation"]);
  if (!presentationRoot) {
    throw new Error('Invalid PPTX: "p:presentation" not found');
  }

  const presentationRels = await readRelationships(zip, "ppt/_rels/presentation.xml.rels");
  const masterRel = presentationRels.find((r) => r.Type === REL_TYPE.SLIDE_MASTER);
  if (!masterRel) {
    throw new Error("Invalid PPTX: slide master relationship not found");
  }

  const masterPart = resolveRelationshipTarget("ppt/presentation.xml", masterRel.Target);
  const masterXml = await readXmlRequired(zip, masterPart);
  const masterRoot = asObject(masterXml["p:sldMaster"]);
  if (!masterRoot) {
    throw new Error(`Invalid PPTX: "p:sldMaster" not found (${masterPart})`);
  }

  const masterRels = await readRelationships(zip, toRelsPath(masterPart));
  const slideSize = asObject(presentationRoot["p:sldSz"]);
  const aspectRatio = resolveAspectRatio(slideSize);

  const theme = await resolveTheme(zip, presentationRels, masterRels, masterPart, warnings);

  const parsedLayouts = await parseLayouts({
    zip,
    masterRoot,
    masterPart,
    masterRels,
    warnings,
  });

  if (parsedLayouts.length === 0) {
    throw new Error("Template import failed: no slide layouts found");
  }

  const layouts: Record<string, SlideLayout> = {};
  const placeholderHints: Record<string, PlaceholderHint[]> = {};
  const layoutMap: Record<string, TemplateLayoutMapEntry> = {};
  const layoutCanonicalIndex = new Map<string, ParsedLayout>();

  for (const parsed of parsedLayouts) {
    let canonical = parsed.canonical;
    if (layoutCanonicalIndex.has(canonical)) {
      const uniq = uniquifyLayoutName(canonical, layoutCanonicalIndex);
      warnings.push({
        code: "layout-alias-collision",
        message: `Duplicate layout name "${canonical}" detected. Renamed to "${uniq}".`,
        layout: canonical,
      });
      canonical = uniq;
    }

    const baseEntry: TemplateLayoutMapEntry = {
      canonical,
      aliases: [...parsed.aliases],
      layoutPart: parsed.layoutPart,
    };
    layoutCanonicalIndex.set(canonical, { ...parsed, canonical });
    layouts[canonical] = cloneLayout(parsed.layout);
    placeholderHints[canonical] = [...parsed.hints];
    layoutMap[canonical] = baseEntry;
  }

  if (aliasStrategy === "keep-original-with-alias") {
    for (const [canonical, parsed] of layoutCanonicalIndex) {
      const entry = layoutMap[canonical];
      if (!entry) continue;
      for (const alias of parsed.aliases) {
        if (!alias || alias === canonical) continue;
        const existing = layoutMap[alias];
        if (existing && existing.layoutPart !== entry.layoutPart) {
          warnings.push({
            code: "layout-alias-collision",
            message: `Alias "${alias}" collides with existing layout mapping. Alias skipped.`,
            layout: canonical,
          });
          continue;
        }
        if (!existing) {
          layouts[alias] = cloneLayout(parsed.layout);
          placeholderHints[alias] = [...parsed.hints];
          layoutMap[alias] = entry;
        }
      }
    }
  }

  const master: SlideMaster = {
    name: basename(options.path, ".pptx"),
    theme,
    layouts,
    aspectRatio,
  };

  return {
    kind: "pptx-template",
    sourcePath: options.path,
    master,
    rawBytes,
    layoutMap,
    placeholderHints,
    warnings,
  };
}

async function parseLayouts(args: {
  zip: Awaited<ReturnType<typeof loadZipFromPath>>["zip"];
  masterRoot: Record<string, unknown>;
  masterPart: string;
  masterRels: Awaited<ReturnType<typeof readRelationships>>;
  warnings: TemplateImportWarning[];
}): Promise<ParsedLayout[]> {
  const { zip, masterRoot, masterPart, masterRels, warnings } = args;
  const out: ParsedLayout[] = [];

  const layoutIdListRaw = asObject(masterRoot["p:sldLayoutIdLst"]);
  const layoutIds = asArray(layoutIdListRaw?.["p:sldLayoutId"])
    .map((x) => asObject(x))
    .filter((x): x is Record<string, unknown> => x !== undefined)
    .map((x) => asString(x["@_r:id"]))
    .filter((x): x is string => !!x);

  const relCandidates =
    layoutIds.length > 0
      ? layoutIds
          .map((id) => masterRels.find((r) => r.Id === id && r.Type === REL_TYPE.SLIDE_LAYOUT))
          .filter((r): r is NonNullable<typeof r> => r !== undefined)
      : masterRels.filter((r) => r.Type === REL_TYPE.SLIDE_LAYOUT);

  for (const rel of relCandidates) {
    const layoutPart = resolveRelationshipTarget(masterPart, rel.Target);
    const layoutXml = await readXml(zip, layoutPart);
    if (!layoutXml) continue;
    const parsed = parseLayout(layoutXml, layoutPart, warnings);
    out.push(parsed);
  }

  return out;
}

function parseLayout(
  layoutXml: Record<string, unknown>,
  layoutPart: string,
  warnings: TemplateImportWarning[],
): ParsedLayout {
  const root = asObject(layoutXml["p:sldLayout"]);
  const cSld = asObject(root?.["p:cSld"]);
  const rawName =
    asString(cSld?.["@_name"]) ??
    asString(root?.["@_matchingName"]) ??
    asString(root?.["@_type"]) ??
    basename(layoutPart, ".xml");
  const canonical = rawName.trim().length > 0 ? rawName.trim() : basename(layoutPart, ".xml");

  const placeholders = extractPlaceholders(cSld, warnings, canonical);
  const hints: PlaceholderHint[] = placeholders.map((ph, idx) => ({
    name: ph.name,
    type: ph.type,
    order: idx,
  }));

  const aliases = inferAliases(canonical, placeholders);
  const background = extractBackground(cSld);

  const layout: SlideLayout = {
    placeholders: placeholders.length > 0 ? placeholders : makeFallbackPlaceholders(),
    ...(background ? { background } : {}),
  };

  if (placeholders.length === 0) {
    warnings.push({
      code: "layout-without-placeholder",
      message: `Layout "${canonical}" has no recognizable placeholders. Fallback placeholders were generated.`,
      layout: canonical,
    });
  }

  const usedHints =
    hints.length > 0
      ? hints
      : layout.placeholders.map((ph, idx) => ({
          name: ph.name,
          type: ph.type,
          order: idx,
        }));

  return {
    canonical,
    layoutPart,
    layout,
    hints: usedHints,
    aliases,
  };
}

function extractPlaceholders(
  cSld: Record<string, unknown> | undefined,
  warnings: TemplateImportWarning[],
  layoutName: string,
): PlaceholderDef[] {
  const spTree = asObject(cSld?.["p:spTree"]);
  if (!spTree) return [];

  const placeholders: PlaceholderDef[] = [];
  let missingNameIndex = 0;

  const textShapes = asArray(spTree["p:sp"])
    .map((x) => asObject(x))
    .filter((x): x is Record<string, unknown> => x !== undefined);
  for (const shape of textShapes) {
    const nvSpPr = asObject(shape["p:nvSpPr"]);
    const cNvPr = asObject(nvSpPr?.["p:cNvPr"]);
    const nvPr = asObject(nvSpPr?.["p:nvPr"]);
    const ph = asObject(nvPr?.["p:ph"]);
    if (!ph) continue;

    let type = mapPlaceholderType(asString(ph["@_type"]));
    if (type === "custom") {
      const hasTitle = placeholders.some((p) => p.type === "title");
      const hasSubtitle = placeholders.some((p) => p.type === "subtitle");
      type = hasTitle && !hasSubtitle ? "subtitle" : "body";
    }
    const shapeRect = extractRect(asObject(shape["p:spPr"]));
    if (!shapeRect) continue;

    const cNvName = asString(cNvPr?.["@_name"]);
    const name =
      inferPlaceholderName(cNvName, type, placeholders.length) ??
      `ph_${type}_${missingNameIndex++}`;

    if (!cNvName || cNvName.trim().length === 0 || /^Text \d+$/i.test(cNvName)) {
      warnings.push({
        code: "placeholder-name-missing",
        message: `Placeholder name missing in layout "${layoutName}". Generated "${name}".`,
        layout: layoutName,
        placeholder: name,
      });
    }

    placeholders.push({
      name,
      type,
      ...shapeRect,
    });
  }

  const picShapes = asArray(spTree["p:pic"])
    .map((x) => asObject(x))
    .filter((x): x is Record<string, unknown> => x !== undefined);
  for (const pic of picShapes) {
    const nvPicPr = asObject(pic["p:nvPicPr"]);
    const cNvPr = asObject(nvPicPr?.["p:cNvPr"]);
    const nvPr = asObject(nvPicPr?.["p:nvPr"]);
    const ph = asObject(nvPr?.["p:ph"]);
    if (!ph) continue;

    const shapeRect = extractRect(asObject(pic["p:spPr"]));
    if (!shapeRect) continue;

    const cNvName = asString(cNvPr?.["@_name"]);
    const name =
      inferPlaceholderName(cNvName, "image", placeholders.length) ??
      `ph_image_${missingNameIndex++}`;

    if (!cNvName || cNvName.trim().length === 0 || /^Picture \d+$/i.test(cNvName)) {
      warnings.push({
        code: "placeholder-name-missing",
        message: `Image placeholder name missing in layout "${layoutName}". Generated "${name}".`,
        layout: layoutName,
        placeholder: name,
      });
    }

    placeholders.push({
      name,
      type: "image",
      ...shapeRect,
    });
  }

  return placeholders.sort((a, b) => (a.y - b.y !== 0 ? a.y - b.y : a.x - b.x));
}

function extractBackground(cSld: Record<string, unknown> | undefined): BackgroundDef | undefined {
  const bg = asObject(cSld?.["p:bg"]);
  const bgPr = asObject(bg?.["p:bgPr"]);
  const solidFill = asObject(bgPr?.["a:solidFill"]);
  const rgb = asObject(solidFill?.["a:srgbClr"]);
  const hex = asString(rgb?.["@_val"]);
  if (hex) {
    return { type: "solid", color: `#${hex.toUpperCase()}` };
  }
  return undefined;
}

function extractRect(spPr: Record<string, unknown> | undefined):
  | {
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | undefined {
  const xfrm = asObject(spPr?.["a:xfrm"]);
  const off = asObject(xfrm?.["a:off"]);
  const ext = asObject(xfrm?.["a:ext"]);
  if (!off || !ext) return undefined;

  const x = Number.parseFloat(asString(off["@_x"]) ?? "");
  const y = Number.parseFloat(asString(off["@_y"]) ?? "");
  const cx = Number.parseFloat(asString(ext["@_cx"]) ?? "");
  const cy = Number.parseFloat(asString(ext["@_cy"]) ?? "");
  if (![x, y, cx, cy].every((v) => Number.isFinite(v))) return undefined;

  return {
    x: x / EMU_PER_INCH,
    y: y / EMU_PER_INCH,
    width: cx / EMU_PER_INCH,
    height: cy / EMU_PER_INCH,
  };
}

function mapPlaceholderType(raw: string | undefined): PlaceholderType {
  const normalized = raw?.trim().toLowerCase();
  switch (normalized) {
    case "title":
    case "ctrtitle":
      return "title";
    case "subtitle":
    case "sub-title":
      return "subtitle";
    case "pic":
    case "picture":
    case "img":
      return "image";
    case "body":
    case "obj":
      return "body";
    default:
      return "custom";
  }
}

function inferPlaceholderName(
  rawName: string | undefined,
  type: PlaceholderType,
  order: number,
): string | undefined {
  if (!rawName) return undefined;
  const normalized = rawName.trim().toLowerCase();
  if (normalized.length === 0) return undefined;

  if (/title/.test(normalized) && type === "title") return "title";
  if (/sub/.test(normalized) && type === "subtitle") return "subtitle";
  if (/body|content|text/.test(normalized) && type === "body") return "body";
  if (/image|picture|photo|pic|chart/.test(normalized) && type === "image") return "image";

  if (/^text \d+$/i.test(rawName) || /^placeholder \d+$/i.test(rawName)) {
    return undefined;
  }
  return sanitizedName(rawName, `${type}_${order}`);
}

function inferAliases(canonical: string, placeholders: PlaceholderDef[]): string[] {
  const aliases = new Set<string>();
  const counts = placeholders.reduce<Record<PlaceholderType, number>>(
    (acc, ph) => {
      acc[ph.type] += 1;
      return acc;
    },
    { title: 0, subtitle: 0, body: 0, image: 0, custom: 0 },
  );

  const suffix = canonical.split("_").at(-1);
  if (suffix && suffix.length > 0) aliases.add(suffix);

  if (counts.title >= 1 && counts.subtitle >= 1) aliases.add("title-slide");
  if (counts.title >= 1 && counts.body >= 1) aliases.add("content");
  if (counts.title >= 1 && counts.body >= 2) aliases.add("two-column");
  if (counts.title >= 1 && counts.image >= 1) aliases.add("content-image");
  if (counts.body >= 1 && counts.title === 0) aliases.add("content");

  aliases.delete(canonical);
  return Array.from(aliases);
}

function makeFallbackPlaceholders(): PlaceholderDef[] {
  return [
    {
      name: "title",
      type: "title",
      x: 0.75,
      y: 0.5,
      width: 11.83,
      height: 0.9,
    },
    {
      name: "body",
      type: "body",
      x: 0.75,
      y: 1.5,
      width: 11.83,
      height: 5.3,
    },
  ];
}

function cloneLayout(layout: SlideLayout): SlideLayout {
  return {
    placeholders: layout.placeholders.map((p) => ({ ...p })),
    ...(layout.background ? { background: { ...layout.background } } : {}),
    ...(layout.fixedElements ? { fixedElements: layout.fixedElements.map((e) => ({ ...e })) } : {}),
  };
}

function uniquifyLayoutName(name: string, existing: Map<string, ParsedLayout>): string {
  let i = 2;
  let candidate = `${name}-${i}`;
  while (existing.has(candidate)) {
    i += 1;
    candidate = `${name}-${i}`;
  }
  return candidate;
}

function resolveAspectRatio(sldSz: Record<string, unknown> | undefined): "16:9" | "4:3" {
  const cx = Number.parseFloat(asString(sldSz?.["@_cx"]) ?? "");
  const cy = Number.parseFloat(asString(sldSz?.["@_cy"]) ?? "");
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || cy === 0) return "16:9";
  const ratio = cx / cy;
  const delta169 = Math.abs(ratio - 16 / 9);
  const delta43 = Math.abs(ratio - 4 / 3);
  return delta43 < delta169 ? "4:3" : "16:9";
}

async function resolveTheme(
  zip: Awaited<ReturnType<typeof loadZipFromPath>>["zip"],
  presentationRels: Awaited<ReturnType<typeof readRelationships>>,
  masterRels: Awaited<ReturnType<typeof readRelationships>>,
  masterPart: string,
  warnings: TemplateImportWarning[],
): Promise<SlideMaster["theme"]> {
  const themeRel =
    masterRels.find((r) => r.Type === REL_TYPE.THEME) ??
    presentationRels.find((r) => r.Type === REL_TYPE.THEME);
  if (!themeRel) {
    warnings.push({
      code: "theme-fallback",
      message: "Theme relationship not found. Falling back to default theme.",
    });
    return { ...defaultTheme };
  }

  const themePart = resolveRelationshipTarget(masterPart, themeRel.Target);
  const themeXml = await readXml(zip, themePart);
  if (!themeXml) {
    warnings.push({
      code: "theme-fallback",
      message: `Theme part not found (${themePart}). Falling back to default theme.`,
    });
    return { ...defaultTheme };
  }

  const root = asObject(themeXml["a:theme"]);
  const themeElements = asObject(root?.["a:themeElements"]);
  const clrScheme = asObject(themeElements?.["a:clrScheme"]);
  const fontScheme = asObject(themeElements?.["a:fontScheme"]);
  if (!themeElements || !clrScheme || !fontScheme) {
    warnings.push({
      code: "theme-fallback",
      message: "Theme structure is incomplete. Falling back to default theme.",
    });
    return { ...defaultTheme };
  }

  const toHex = (node: unknown): string | undefined => {
    const obj = asObject(node);
    const rgb = asObject(obj?.["a:srgbClr"]);
    const val = asString(rgb?.["@_val"]);
    return val ? `#${val.toUpperCase()}` : undefined;
  };

  const colors = {
    primary: toHex(clrScheme["a:accent1"]) ?? defaultTheme.colors.primary,
    secondary: toHex(clrScheme["a:accent2"]) ?? defaultTheme.colors.secondary,
    background: toHex(clrScheme["a:lt1"]) ?? defaultTheme.colors.background,
    text: toHex(clrScheme["a:dk1"]) ?? defaultTheme.colors.text,
    accent: toHex(clrScheme["a:accent3"]) ?? defaultTheme.colors.accent,
    muted: toHex(clrScheme["a:lt2"]) ?? defaultTheme.colors.muted,
  };

  const majorFont = asObject(asObject(fontScheme["a:majorFont"])?.["a:latin"]);
  const minorFont = asObject(asObject(fontScheme["a:minorFont"])?.["a:latin"]);
  const heading = asString(majorFont?.["@_typeface"]) ?? defaultTheme.fonts.heading;
  const body = asString(minorFont?.["@_typeface"]) ?? defaultTheme.fonts.body;

  const hasFallback =
    colors.primary === defaultTheme.colors.primary ||
    colors.secondary === defaultTheme.colors.secondary ||
    colors.background === defaultTheme.colors.background ||
    colors.text === defaultTheme.colors.text ||
    heading === defaultTheme.fonts.heading ||
    body === defaultTheme.fonts.body;
  if (hasFallback) {
    warnings.push({
      code: "theme-fallback",
      message: "Theme values were partially missing. Default theme values were applied.",
    });
  }

  return {
    name: `${defaultTheme.name}-imported`,
    colors,
    fonts: {
      heading,
      body,
      mono: defaultTheme.fonts.mono ?? body,
    },
  };
}

function sanitizedName(name: string, fallback: string): string {
  const out = name
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return out.length > 0 ? out : fallback;
}
