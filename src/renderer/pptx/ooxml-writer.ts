import { extname } from "node:path";
import {
  asArray,
  asObject,
  asString,
  type ContentTypesDoc,
  ensureContentTypeDefault,
  ensureContentTypeOverride,
  inferContentTypeByPath,
  loadZipFromBytes,
  nextRelId,
  normalizePartName,
  type RelationshipEntry,
  readContentTypes,
  readRelationships,
  readText,
  readXml,
  readXmlRequired,
  removeContentTypeOverride,
  resolveRelationshipTarget,
  toRelationshipTarget,
  toRelsPath,
  writeContentTypes,
  writeRelationships,
  writeXml,
} from "../../import/ooxml-reader.ts";
import type { ComputedSlide } from "../../types/layout.ts";
import type { SlideMaster } from "../../types/master.ts";
import type { ImportedTemplate, TemplateImportWarning } from "../../types/template.ts";

const REL_TYPE = {
  SLIDE: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
  SLIDE_LAYOUT: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
  NOTES_SLIDE: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide",
  NOTES_MASTER: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster",
  IMAGE: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
} as const;

const CONTENT_TYPE = {
  SLIDE: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
  NOTES_SLIDE: "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml",
} as const;

export async function composeTemplatePptx(args: {
  template: ImportedTemplate;
  renderedPptx: ArrayBuffer;
  computedSlides: ComputedSlide[];
  master: SlideMaster;
}): Promise<{ buffer: ArrayBuffer; warnings: TemplateImportWarning[] }> {
  const warnings: TemplateImportWarning[] = [];
  const [{ zip: templateZip }, { zip: renderedZip }] = await Promise.all([
    loadZipFromBytes(args.template.rawBytes),
    loadZipFromBytes(args.renderedPptx),
  ]);

  const [presentationXml, presentationRels, contentTypes] = await Promise.all([
    readXmlRequired(templateZip, "ppt/presentation.xml"),
    readRelationships(templateZip, "ppt/_rels/presentation.xml.rels"),
    readContentTypes(templateZip),
  ]);
  const presentationRoot = asObject(presentationXml["p:presentation"]);
  if (!presentationRoot) throw new Error('Invalid template: "p:presentation" missing');

  const notesMasterRel = presentationRels.find((r) => r.Type === REL_TYPE.NOTES_MASTER);
  const notesMasterPart = notesMasterRel
    ? resolveRelationshipTarget("ppt/presentation.xml", notesMasterRel.Target)
    : undefined;

  clearTemplateSlides({
    zip: templateZip,
    presentationRoot,
    presentationRels,
    contentTypes,
  });

  const renderedPresentationXml = await readXmlRequired(renderedZip, "ppt/presentation.xml");
  const renderedPresentationRoot = asObject(renderedPresentationXml["p:presentation"]);
  if (!renderedPresentationRoot) {
    throw new Error('Invalid rendered pptx: "p:presentation" missing');
  }
  const renderedRels = await readRelationships(renderedZip, "ppt/_rels/presentation.xml.rels");

  const orderedRenderedSlides = collectRenderedSlides(renderedPresentationRoot, renderedRels);
  if (orderedRenderedSlides.length < args.computedSlides.length) {
    throw new Error(
      `Rendered slides are fewer than expected: rendered=${orderedRenderedSlides.length}, expected=${args.computedSlides.length}`,
    );
  }

  const slideIds: Record<string, unknown>[] = [];
  let nextSlideId = 256;
  let nextNotesIndex = nextPartIndex(templateZip, /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/);
  let mediaCounter = nextPartIndex(templateZip, /^ppt\/media\/image(\d+)\.[a-z0-9]+$/i);

  for (let i = 0; i < args.computedSlides.length; i++) {
    const computed = args.computedSlides[i]!;
    const rendered = orderedRenderedSlides[i];
    if (!rendered) break;

    const newSlidePath = `ppt/slides/slide${i + 1}.xml`;
    const slideText = await readText(renderedZip, rendered.slidePath);
    if (!slideText) {
      throw new Error(`Rendered slide not found: ${rendered.slidePath}`);
    }
    const slideXml = await readXml(renderedZip, rendered.slidePath);
    const shouldStripBackground = shouldStripLayoutBackground(computed, args.master);
    if (slideXml && shouldStripBackground) {
      const root = asObject(slideXml["p:sld"]);
      const cSld = asObject(root?.["p:cSld"]);
      if (cSld && "p:bg" in cSld) {
        delete cSld["p:bg"];
        writeXml(templateZip, newSlidePath, slideXml);
      } else {
        templateZip.file(newSlidePath, slideText);
      }
    } else {
      templateZip.file(newSlidePath, slideText);
    }

    ensureContentTypeOverride(contentTypes, newSlidePath, CONTENT_TYPE.SLIDE);

    const newSlideRelsPath = toRelsPath(newSlidePath);
    const sourceSlideRels = await readRelationships(renderedZip, rendered.slideRelsPath);
    const layoutInfo =
      args.template.layoutMap[computed.layoutName] ??
      args.template.layoutMap[Object.keys(args.template.layoutMap)[0] ?? ""];
    if (!layoutInfo) {
      throw new Error(`No layout mapping available for "${computed.layoutName}"`);
    }

    const relOut: RelationshipEntry[] = [];
    let hasLayoutRel = false;
    for (const rel of sourceSlideRels) {
      if (rel.Type === REL_TYPE.SLIDE_LAYOUT) {
        hasLayoutRel = true;
        relOut.push({
          Id: rel.Id,
          Type: rel.Type,
          Target: toRelationshipTarget(newSlidePath, layoutInfo.layoutPart),
        });
        continue;
      }

      if (rel.Type === REL_TYPE.NOTES_SLIDE) {
        if (!computed.notes) continue;
        const sourceNotesPath = resolveRelationshipTarget(rendered.slidePath, rel.Target);
        const copied = await copyNotesSlide({
          sourceZip: renderedZip,
          targetZip: templateZip,
          sourceNotesPath,
          slidePath: newSlidePath,
          notesMasterPart,
          nextNotesIndex,
        });
        if (copied) {
          nextNotesIndex = copied.nextNotesIndex;
          relOut.push({
            Id: rel.Id,
            Type: rel.Type,
            Target: toRelationshipTarget(newSlidePath, copied.notesPath),
          });
          ensureContentTypeOverride(contentTypes, copied.notesPath, CONTENT_TYPE.NOTES_SLIDE);
        }
        continue;
      }

      if (rel.TargetMode === "External") {
        relOut.push(rel);
        continue;
      }

      if (rel.Type === REL_TYPE.IMAGE) {
        const sourceImagePath = resolveRelationshipTarget(rendered.slidePath, rel.Target);
        const copied = await copyMediaPart({
          sourceZip: renderedZip,
          targetZip: templateZip,
          sourcePartPath: sourceImagePath,
          slideIndex: i,
          mediaCounter,
        });
        mediaCounter = copied.mediaCounter;
        relOut.push({
          Id: rel.Id,
          Type: rel.Type,
          Target: toRelationshipTarget(newSlidePath, copied.targetPath),
        });
        const inferred = inferContentTypeByPath(copied.targetPath);
        if (inferred) {
          ensureContentTypeDefault(contentTypes, extname(copied.targetPath), inferred);
        }
        continue;
      }

      warnings.push({
        code: "unsupported-layout-feature",
        message: `Relationship type "${rel.Type}" is not copied in template inheritance renderer.`,
        layout: computed.layoutName,
      });
    }

    if (!hasLayoutRel) {
      relOut.unshift({
        Id: "rId1",
        Type: REL_TYPE.SLIDE_LAYOUT,
        Target: toRelationshipTarget(newSlidePath, layoutInfo.layoutPart),
      });
    }
    writeRelationships(templateZip, newSlideRelsPath, relOut);

    const relId = nextRelId(presentationRels);
    presentationRels.push({
      Id: relId,
      Type: REL_TYPE.SLIDE,
      Target: toRelationshipTarget("ppt/presentation.xml", newSlidePath),
    });
    slideIds.push({
      "@_id": String(nextSlideId++),
      "@_r:id": relId,
    });
  }

  presentationRoot["p:sldIdLst"] = {
    "p:sldId": slideIds,
  };
  writeXml(templateZip, "ppt/presentation.xml", presentationXml);
  writeRelationships(templateZip, "ppt/_rels/presentation.xml.rels", presentationRels);
  writeContentTypes(templateZip, contentTypes);

  const out = await templateZip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return { buffer: out, warnings };
}

function clearTemplateSlides(args: {
  zip: Awaited<ReturnType<typeof loadZipFromBytes>>["zip"];
  presentationRoot: Record<string, unknown>;
  presentationRels: RelationshipEntry[];
  contentTypes: ContentTypesDoc;
}): void {
  const { zip, presentationRoot, presentationRels, contentTypes } = args;
  const slideRels = presentationRels.filter((r) => r.Type === REL_TYPE.SLIDE);
  for (const rel of slideRels) {
    const slidePart = resolveRelationshipTarget("ppt/presentation.xml", rel.Target);
    removeSlidePart(zip, slidePart, contentTypes);
  }

  // 既存 notesSlide も出力から除外する
  for (const name of Object.keys(zip.files)) {
    if (!/^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name)) continue;
    zip.remove(name);
    removeContentTypeOverride(contentTypes, name);
    zip.remove(toRelsPath(name));
  }

  presentationRels.splice(
    0,
    presentationRels.length,
    ...presentationRels.filter((r) => r.Type !== REL_TYPE.SLIDE),
  );
  presentationRoot["p:sldIdLst"] = { "p:sldId": [] };
}

function removeSlidePart(
  zip: Awaited<ReturnType<typeof loadZipFromBytes>>["zip"],
  slidePart: string,
  contentTypes: ContentTypesDoc,
): void {
  zip.remove(slidePart);
  removeContentTypeOverride(contentTypes, slidePart);
  zip.remove(toRelsPath(slidePart));
}

function collectRenderedSlides(
  renderedPresentationRoot: Record<string, unknown>,
  renderedRels: RelationshipEntry[],
): Array<{ slidePath: string; slideRelsPath: string }> {
  const sldIdLst = asObject(renderedPresentationRoot["p:sldIdLst"]);
  const sldIds = asArray(sldIdLst?.["p:sldId"])
    .map((x) => asObject(x))
    .filter((x): x is Record<string, unknown> => x !== undefined);
  const out: Array<{ slidePath: string; slideRelsPath: string }> = [];
  for (const sldId of sldIds) {
    const rid = asString(sldId["@_r:id"]);
    if (!rid) continue;
    const rel = renderedRels.find((r) => r.Id === rid && r.Type === REL_TYPE.SLIDE);
    if (!rel) continue;
    const slidePath = resolveRelationshipTarget("ppt/presentation.xml", rel.Target);
    out.push({
      slidePath,
      slideRelsPath: toRelsPath(slidePath),
    });
  }
  return out;
}

function shouldStripLayoutBackground(computed: ComputedSlide, master: SlideMaster): boolean {
  if (!computed.background) return false;
  const fromLayout = master.layouts[computed.layoutName]?.background;
  if (!fromLayout) return false;
  return JSON.stringify(fromLayout) === JSON.stringify(computed.background);
}

async function copyMediaPart(args: {
  sourceZip: Awaited<ReturnType<typeof loadZipFromBytes>>["zip"];
  targetZip: Awaited<ReturnType<typeof loadZipFromBytes>>["zip"];
  sourcePartPath: string;
  slideIndex: number;
  mediaCounter: number;
}): Promise<{ targetPath: string; mediaCounter: number }> {
  const { sourceZip, targetZip, sourcePartPath, slideIndex } = args;
  let { mediaCounter } = args;
  const file = sourceZip.file(sourcePartPath);
  if (!file) {
    throw new Error(`Referenced media part not found: ${sourcePartPath}`);
  }
  const ext = extname(sourcePartPath) || ".bin";
  mediaCounter += 1;
  const targetPath = `ppt/media/image_tmpl_${slideIndex + 1}_${mediaCounter}${ext}`;
  const data = await file.async("uint8array");
  targetZip.file(targetPath, data);
  return { targetPath, mediaCounter };
}

async function copyNotesSlide(args: {
  sourceZip: Awaited<ReturnType<typeof loadZipFromBytes>>["zip"];
  targetZip: Awaited<ReturnType<typeof loadZipFromBytes>>["zip"];
  sourceNotesPath: string;
  slidePath: string;
  notesMasterPart?: string;
  nextNotesIndex: number;
}): Promise<{ notesPath: string; nextNotesIndex: number } | undefined> {
  const { sourceZip, targetZip, sourceNotesPath, slidePath, notesMasterPart } = args;
  let { nextNotesIndex } = args;
  const notesFile = sourceZip.file(sourceNotesPath);
  if (!notesFile) return undefined;

  nextNotesIndex += 1;
  const notesPath = `ppt/notesSlides/notesSlide${nextNotesIndex}.xml`;
  targetZip.file(notesPath, await notesFile.async("text"));

  const sourceRelsPath = toRelsPath(sourceNotesPath);
  const sourceRels = await readRelationships(sourceZip, sourceRelsPath);
  const mappedRels: RelationshipEntry[] = [];
  for (const rel of sourceRels) {
    if (rel.Type === REL_TYPE.SLIDE) {
      mappedRels.push({
        Id: rel.Id,
        Type: rel.Type,
        Target: toRelationshipTarget(notesPath, slidePath),
      });
      continue;
    }
    if (rel.Type === REL_TYPE.NOTES_MASTER && notesMasterPart) {
      mappedRels.push({
        Id: rel.Id,
        Type: rel.Type,
        Target: toRelationshipTarget(notesPath, notesMasterPart),
      });
      continue;
    }
    mappedRels.push(rel);
  }
  writeRelationships(targetZip, toRelsPath(notesPath), mappedRels);
  return { notesPath, nextNotesIndex };
}

function nextPartIndex(
  zip: Awaited<ReturnType<typeof loadZipFromBytes>>["zip"],
  pattern: RegExp,
): number {
  let max = 0;
  for (const name of Object.keys(zip.files)) {
    const m = pattern.exec(name);
    if (!m?.[1]) continue;
    const n = Number.parseInt(m[1], 10);
    if (!Number.isFinite(n)) continue;
    max = Math.max(max, n);
  }
  return max;
}

export function collectSlideTargetsForTest(
  presentationXml: Record<string, unknown>,
  presentationRels: RelationshipEntry[],
): string[] {
  const root = asObject(presentationXml["p:presentation"]);
  const sldIdLst = asObject(root?.["p:sldIdLst"]);
  const sldIds = asArray(sldIdLst?.["p:sldId"])
    .map((x) => asObject(x))
    .filter((x): x is Record<string, unknown> => x !== undefined);
  const out: string[] = [];
  for (const sldId of sldIds) {
    const rid = asString(sldId["@_r:id"]);
    if (!rid) continue;
    const rel = presentationRels.find((r) => r.Id === rid && r.Type === REL_TYPE.SLIDE);
    if (!rel) continue;
    out.push(normalizePartName(resolveRelationshipTarget("ppt/presentation.xml", rel.Target)));
  }
  return out;
}
