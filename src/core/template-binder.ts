import type { PlaceholderValue } from "../types/content.ts";
import type { PlaceholderDef, PlaceholderType } from "../types/master.ts";

/** テンプレート利用時の data キーを placeholder 名へ寄せる */
export function bindTemplateData(
  data: Record<string, PlaceholderValue>,
  placeholders: PlaceholderDef[],
): Record<string, PlaceholderValue> {
  if (placeholders.length === 0) return { ...data };

  const out: Record<string, PlaceholderValue> = {};
  const used = new Set<string>();
  const byName = new Map(placeholders.map((p) => [p.name, p] as const));
  const ordered = [...placeholders].sort((a, b) => (a.y - b.y !== 0 ? a.y - b.y : a.x - b.x));

  for (const [key, value] of Object.entries(data)) {
    const target = selectPlaceholder({
      key,
      value,
      placeholders: ordered,
      byName,
      used,
    });

    if (target && !(target.name in out) && !used.has(target.name)) {
      out[target.name] = value;
      used.add(target.name);
      continue;
    }

    if (!(key in out)) {
      out[key] = value;
      continue;
    }

    // キー衝突時は unknown-placeholder として扱えるよう人工キーへ退避
    let i = 2;
    let fallback = `${key}_${i}`;
    while (fallback in out) {
      i += 1;
      fallback = `${key}_${i}`;
    }
    out[fallback] = value;
  }

  return out;
}

function selectPlaceholder(args: {
  key: string;
  value: PlaceholderValue;
  placeholders: PlaceholderDef[];
  byName: Map<string, PlaceholderDef>;
  used: Set<string>;
}): PlaceholderDef | undefined {
  const { key, value, placeholders, byName, used } = args;

  // 1) 完全一致
  const exact = byName.get(key);
  if (exact && !used.has(exact.name)) return exact;

  // 2) 別名一致 (正規化)
  const normalizedKey = normalizeKey(key);
  const alias = placeholders.find(
    (ph) => normalizeKey(ph.name) === normalizedKey && !used.has(ph.name),
  );
  if (alias) return alias;

  // 3) 型一致
  const desiredType = inferDesiredType(key, value);
  if (desiredType) {
    const typed = placeholders.find((ph) => ph.type === desiredType && !used.has(ph.name));
    if (typed) return typed;
  }

  // 4) 順序補完
  return placeholders.find((ph) => !used.has(ph.name));
}

function normalizeKey(v: string): string {
  return v.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
}

function inferDesiredType(key: string, value: PlaceholderValue): PlaceholderType | undefined {
  const n = normalizeKey(key);

  if (n.includes("subtitle")) return "subtitle";
  if (n.includes("title") || n.includes("headline")) return "title";
  if (n.includes("image") || n.includes("img") || n.includes("photo") || n.includes("picture")) {
    return "image";
  }
  if (
    n.includes("body") ||
    n.includes("content") ||
    n.includes("text") ||
    n.includes("summary") ||
    n.includes("table") ||
    n.includes("code")
  ) {
    return "body";
  }

  if (typeof value !== "string" && value.type === "image") {
    return "image";
  }
  if (
    typeof value !== "string" &&
    (value.type === "text" ||
      value.type === "bullet" ||
      value.type === "table" ||
      value.type === "code" ||
      value.type === "mermaid")
  ) {
    return "body";
  }
  return undefined;
}
