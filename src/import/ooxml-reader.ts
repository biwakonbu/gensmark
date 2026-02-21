import { readFile } from "node:fs/promises";
import { extname, posix } from "node:path";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  trimValues: false,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  suppressBooleanAttributes: false,
  format: false,
});

export interface RelationshipEntry {
  Id: string;
  Type: string;
  Target: string;
  TargetMode?: string;
}

export interface ContentTypeDefault {
  "@_Extension": string;
  "@_ContentType": string;
}

export interface ContentTypeOverride {
  "@_PartName": string;
  "@_ContentType": string;
}

export interface ContentTypesDoc {
  Defaults: ContentTypeDefault[];
  Overrides: ContentTypeOverride[];
}

export async function loadZipFromPath(path: string): Promise<{ zip: JSZip; rawBytes: Uint8Array }> {
  const raw = new Uint8Array(await readFile(path));
  const zip = await JSZip.loadAsync(raw);
  return { zip, rawBytes: raw };
}

export async function loadZipFromBytes(
  bytes: Uint8Array | ArrayBuffer,
): Promise<{ zip: JSZip; rawBytes: Uint8Array }> {
  const rawBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const zip = await JSZip.loadAsync(rawBytes);
  return { zip, rawBytes };
}

export function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function readXml(
  zip: JSZip,
  path: string,
): Promise<Record<string, unknown> | undefined> {
  const file = zip.file(path);
  if (!file) return undefined;
  const text = await file.async("text");
  const parsed = parser.parse(text);
  return asObject(parsed);
}

export async function readXmlRequired(zip: JSZip, path: string): Promise<Record<string, unknown>> {
  const parsed = await readXml(zip, path);
  if (!parsed) {
    throw new Error(`Required XML part not found: ${path}`);
  }
  return parsed;
}

export async function readText(zip: JSZip, path: string): Promise<string | undefined> {
  const file = zip.file(path);
  if (!file) return undefined;
  return await file.async("text");
}

export function writeXml(zip: JSZip, path: string, data: Record<string, unknown>): void {
  const normalized: Record<string, unknown> = { ...data };
  delete normalized["?xml"];
  zip.file(path, `${XML_DECLARATION}${builder.build(normalized)}`);
}

export function writeText(zip: JSZip, path: string, text: string): void {
  zip.file(path, text);
}

export function toRelsPath(partPath: string): string {
  const dir = posix.dirname(partPath);
  const file = posix.basename(partPath);
  return posix.join(dir, "_rels", `${file}.rels`);
}

export function resolveRelationshipTarget(fromPartPath: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  return posix.normalize(posix.join(posix.dirname(fromPartPath), target));
}

export function toRelationshipTarget(fromPartPath: string, toPartPath: string): string {
  const rel = posix.relative(posix.dirname(fromPartPath), toPartPath);
  if (rel.length === 0) return posix.basename(toPartPath);
  return rel;
}

export async function readRelationships(
  zip: JSZip,
  relsPath: string,
): Promise<RelationshipEntry[]> {
  const xml = await readXml(zip, relsPath);
  if (!xml) return [];
  const root = asObject(xml.Relationships);
  if (!root) return [];
  const rels = asArray(root.Relationship as unknown);
  return rels
    .map((raw) => {
      const rel = asObject(raw);
      if (!rel) return undefined;
      const id = asString(rel["@_Id"]);
      const type = asString(rel["@_Type"]);
      const target = asString(rel["@_Target"]);
      if (!id || !type || !target) return undefined;
      const targetMode = asString(rel["@_TargetMode"]);
      return {
        Id: id,
        Type: type,
        Target: target,
        ...(targetMode ? { TargetMode: targetMode } : {}),
      };
    })
    .filter((x): x is RelationshipEntry => x !== undefined);
}

export function writeRelationships(zip: JSZip, relsPath: string, rels: RelationshipEntry[]): void {
  const data: Record<string, unknown> = {
    Relationships: {
      "@_xmlns": "http://schemas.openxmlformats.org/package/2006/relationships",
      Relationship: rels.map((r) => ({
        "@_Id": r.Id,
        "@_Type": r.Type,
        "@_Target": r.Target,
        ...(r.TargetMode ? { "@_TargetMode": r.TargetMode } : {}),
      })),
    },
  };
  writeXml(zip, relsPath, data);
}

export function nextRelId(rels: RelationshipEntry[]): string {
  const max = rels.reduce((acc, r) => {
    const m = /^rId(\d+)$/.exec(r.Id);
    if (!m) return acc;
    const n = Number.parseInt(m[1], 10);
    if (!Number.isFinite(n)) return acc;
    return Math.max(acc, n);
  }, 0);
  return `rId${max + 1}`;
}

export async function readContentTypes(zip: JSZip): Promise<ContentTypesDoc> {
  const xml = await readXmlRequired(zip, "[Content_Types].xml");
  const types = asObject(xml.Types);
  if (!types) {
    throw new Error("Invalid [Content_Types].xml");
  }

  const defaults = asArray(types.Default)
    .map((x) => asObject(x))
    .filter((x): x is Record<string, unknown> => x !== undefined)
    .map((x) => ({
      "@_Extension": asString(x["@_Extension"]) ?? "",
      "@_ContentType": asString(x["@_ContentType"]) ?? "",
    }))
    .filter((x) => x["@_Extension"].length > 0 && x["@_ContentType"].length > 0);

  const overrides = asArray(types.Override)
    .map((x) => asObject(x))
    .filter((x): x is Record<string, unknown> => x !== undefined)
    .map((x) => ({
      "@_PartName": asString(x["@_PartName"]) ?? "",
      "@_ContentType": asString(x["@_ContentType"]) ?? "",
    }))
    .filter((x) => x["@_PartName"].length > 0 && x["@_ContentType"].length > 0);

  return { Defaults: defaults, Overrides: overrides };
}

export function writeContentTypes(zip: JSZip, contentTypes: ContentTypesDoc): void {
  const data: Record<string, unknown> = {
    Types: {
      "@_xmlns": "http://schemas.openxmlformats.org/package/2006/content-types",
      Default: contentTypes.Defaults.map((d) => ({
        "@_Extension": d["@_Extension"],
        "@_ContentType": d["@_ContentType"],
      })),
      Override: contentTypes.Overrides.map((o) => ({
        "@_PartName": o["@_PartName"],
        "@_ContentType": o["@_ContentType"],
      })),
    },
  };
  writeXml(zip, "[Content_Types].xml", data);
}

export function normalizePartName(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function removeContentTypeOverride(contentTypes: ContentTypesDoc, partPath: string): void {
  const normalized = normalizePartName(partPath);
  contentTypes.Overrides = contentTypes.Overrides.filter((o) => o["@_PartName"] !== normalized);
}

export function ensureContentTypeOverride(
  contentTypes: ContentTypesDoc,
  partPath: string,
  contentType: string,
): void {
  const normalized = normalizePartName(partPath);
  const existing = contentTypes.Overrides.find((o) => o["@_PartName"] === normalized);
  if (existing) {
    existing["@_ContentType"] = contentType;
    return;
  }
  contentTypes.Overrides.push({
    "@_PartName": normalized,
    "@_ContentType": contentType,
  });
}

export function ensureContentTypeDefault(
  contentTypes: ContentTypesDoc,
  extension: string,
  contentType: string,
): void {
  const ext = extension.startsWith(".") ? extension.slice(1) : extension;
  const existing = contentTypes.Defaults.find(
    (d) => d["@_Extension"].toLowerCase() === ext.toLowerCase(),
  );
  if (existing) return;
  contentTypes.Defaults.push({
    "@_Extension": ext,
    "@_ContentType": contentType,
  });
}

export function inferContentTypeByPath(path: string): string | undefined {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".xml":
      return "application/xml";
    default:
      return undefined;
  }
}
