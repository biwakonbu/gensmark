export interface SplitMermaidResult {
  parts: string[];
}

type Entry =
  | { kind: "global"; pos: number; line: string }
  | { kind: "edge"; pos: number; line: string; a: string; b: string }
  | { kind: "node"; pos: number; line: string; id: string }
  | { kind: "style"; pos: number; line: string; id: string }
  | { kind: "class"; pos: number; line: string; ids: string[]; className: string }
  | { kind: "other"; pos: number; line: string };

/**
 * Mermaid flowchart/graph を決定論的に 2 分割する。
 * - 対象: `flowchart` / `graph` のみ (その他の記法は null)
 * - 目的: 1枚に詰め込みすぎた図を複数枚に分割し、可読性を上げる
 *
 * 注意: 完全な Mermaid パーサではないため、特殊な記法では分割できない場合がある。
 */
export function splitMermaidFlowchart(code: string): SplitMermaidResult | null {
  const lines = normalize(code).split("\n");

  const headerIndex = findHeaderIndex(lines);
  if (headerIndex === null) return null;

  const header = lines[headerIndex]!.trim();
  if (!/^(flowchart|graph)\b/i.test(header)) return null;

  const preamble = lines.slice(0, headerIndex); // init directive 等を保持
  const body = lines.slice(headerIndex + 1);

  const entries: Entry[] = [];

  for (let i = 0; i < body.length; i++) {
    const line = body[i]!;
    const pos = headerIndex + 1 + i;
    const t = line.trim();
    if (t.length === 0) continue;

    // コメント/初期化 directive は両方に入れる
    if (t.startsWith("%%")) {
      entries.push({ kind: "global", pos, line });
      continue;
    }

    // classDef は両方に入れる (見た目をできるだけ維持)
    if (/^classDef\b/i.test(t)) {
      entries.push({ kind: "global", pos, line });
      continue;
    }

    // linkStyle はエッジ index に依存するため不安定。分割時は破棄する。
    if (/^linkStyle\b/i.test(t)) continue;

    // subgraph/end はブロック構造を壊しやすいので破棄し、ノード/エッジを残す
    if (/^subgraph\b/i.test(t) || /^end\b/i.test(t)) continue;

    const edge = extractEdgeEndpoints(line);
    if (edge) {
      entries.push({ kind: "edge", pos, line, a: edge[0], b: edge[1] });
      continue;
    }

    const style = parseStyleLine(t);
    if (style) {
      entries.push({ kind: "style", pos, line, id: style.id });
      continue;
    }

    const cls = parseClassLine(t);
    if (cls) {
      entries.push({ kind: "class", pos, line, ids: cls.ids, className: cls.className });
      continue;
    }

    const nodeId = extractNodeIdFromToken(t);
    if (nodeId && /[[({]/.test(t)) {
      entries.push({ kind: "node", pos, line, id: nodeId });
      continue;
    }

    entries.push({ kind: "other", pos, line });
  }

  const nodes = new Set<string>();
  const edges: Array<[string, string]> = [];
  for (const e of entries) {
    if (e.kind === "edge") {
      nodes.add(e.a);
      nodes.add(e.b);
      edges.push([e.a, e.b]);
    }
    if (e.kind === "node") nodes.add(e.id);
    if (e.kind === "style") nodes.add(e.id);
    if (e.kind === "class") for (const id of e.ids) nodes.add(id);
  }

  if (nodes.size < 2) return null;

  const { a: groupA, b: groupB } = partitionNodes(nodes, edges);
  if (groupA.size === 0 || groupB.size === 0) return null;

  // 片側に内部エッジがない場合、ハブを両方に複製して最低限の文脈を保つ
  if (internalEdgeCount(groupA, edges) === 0 || internalEdgeCount(groupB, edges) === 0) {
    const hub = findHubNode(nodes, edges);
    if (hub) {
      groupA.add(hub);
      groupB.add(hub);
    }
  }

  const partA = buildPart(preamble, header, entries, groupA);
  const partB = buildPart(preamble, header, entries, groupB);

  if (partA.trim().length === 0 || partB.trim().length === 0) return null;

  return { parts: [partA, partB] };
}

function normalize(code: string): string {
  return code.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
}

function findHeaderIndex(lines: string[]): number | null {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t.length === 0) continue;
    if (t.startsWith("%%")) continue; // init directive / comment
    return i;
  }
  return null;
}

function extractNodeIdFromToken(token: string): string | null {
  const m = token.match(/^([A-Za-z0-9_][A-Za-z0-9_-]*)/);
  return m ? m[1] : null;
}

function extractEdgeEndpoints(line: string): [string, string] | null {
  // 先頭/末尾トークンからノードIDを推定する (厳密ではないが決定論的)
  if (!/(-->|---|--|==>|==|\\.\\.>|\\.\\.)/.test(line)) return null;
  const tokens = line
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length < 3) return null;
  const left = extractNodeIdFromToken(tokens[0]!);
  const right = extractNodeIdFromToken(tokens[tokens.length - 1]!);
  if (!left || !right) return null;
  if (left === "flowchart" || left === "graph") return null;
  return [left, right];
}

function parseStyleLine(line: string): { id: string } | null {
  const m = line.match(/^style\s+([A-Za-z0-9_][A-Za-z0-9_-]*)\b/i);
  if (!m) return null;
  return { id: m[1]! };
}

function parseClassLine(line: string): { ids: string[]; className: string } | null {
  const m = line.match(/^class\s+(.+?)\s+([A-Za-z0-9_][A-Za-z0-9_-]*)\s*$/i);
  if (!m) return null;
  const ids = m[1]!
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => extractNodeIdFromToken(s) ?? "")
    .filter((s) => s.length > 0);
  if (ids.length === 0) return null;
  return { ids, className: m[2]! };
}

function partitionNodes(
  nodes: Set<string>,
  edges: Array<[string, string]>,
): { a: Set<string>; b: Set<string> } {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n, new Set());
  for (const [u, v] of edges) {
    adj.get(u)?.add(v);
    adj.get(v)?.add(u);
  }

  const seen = new Set<string>();
  const components: string[][] = [];
  for (const n of nodes) {
    if (seen.has(n)) continue;
    const comp: string[] = [];
    const stack = [n];
    seen.add(n);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nxt of adj.get(cur) ?? []) {
        if (seen.has(nxt)) continue;
        seen.add(nxt);
        stack.push(nxt);
      }
    }
    components.push(comp);
  }

  // 複数コンポーネントなら、サイズの均衡が取れるように貪欲に 2 分割
  components.sort((x, y) => y.length - x.length);
  const a = new Set<string>();
  const b = new Set<string>();
  for (const comp of components) {
    if (a.size <= b.size) {
      for (const n of comp) a.add(n);
    } else {
      for (const n of comp) b.add(n);
    }
  }

  // 単一巨大コンポーネント等で片側が空の場合、BFS で半分に割る
  if (a.size === 0 || b.size === 0) {
    a.clear();
    b.clear();
    const all = Array.from(nodes).sort();
    const start = all[0]!;
    const q: string[] = [start];
    const visited = new Set<string>([start]);
    while (q.length > 0 && visited.size < Math.ceil(nodes.size / 2)) {
      const cur = q.shift()!;
      for (const nxt of adj.get(cur) ?? []) {
        if (visited.has(nxt)) continue;
        visited.add(nxt);
        q.push(nxt);
        if (visited.size >= Math.ceil(nodes.size / 2)) break;
      }
    }
    for (const n of visited) a.add(n);
    for (const n of nodes) if (!a.has(n)) b.add(n);
  }

  return { a, b };
}

function buildPart(
  preamble: string[],
  header: string,
  entries: Entry[],
  group: Set<string>,
): string {
  const selected: Array<{ pos: number; line: string }> = [];
  let hasDiagramLine = false;

  // preamble は pos を確保できないので、先頭にそのまま入れる
  const out: string[] = [];
  for (const line of preamble) {
    if (line.trim().length === 0) continue;
    out.push(line);
  }
  out.push(header);

  for (const e of entries) {
    if (e.kind === "global") {
      selected.push({ pos: e.pos, line: e.line });
      continue;
    }
    if (e.kind === "edge") {
      if (group.has(e.a) && group.has(e.b)) {
        selected.push({ pos: e.pos, line: e.line });
        hasDiagramLine = true;
      }
      continue;
    }
    if (e.kind === "node") {
      if (group.has(e.id)) {
        selected.push({ pos: e.pos, line: e.line });
        hasDiagramLine = true;
      }
      continue;
    }
    if (e.kind === "style") {
      if (group.has(e.id)) selected.push({ pos: e.pos, line: e.line });
      continue;
    }
    if (e.kind === "class") {
      const ids = e.ids.filter((id) => group.has(id));
      if (ids.length === 0) continue;
      selected.push({ pos: e.pos, line: `class ${ids.join(",")} ${e.className}` });
    }
  }

  selected.sort((x, y) => x.pos - y.pos);
  for (const s of selected) out.push(s.line);

  // ヘッダーだけの空図を作らない
  if (!hasDiagramLine) return "";
  return out.join("\n").trim();
}

function internalEdgeCount(group: Set<string>, edges: Array<[string, string]>): number {
  let c = 0;
  for (const [a, b] of edges) {
    if (group.has(a) && group.has(b)) c++;
  }
  return c;
}

function findHubNode(nodes: Set<string>, edges: Array<[string, string]>): string | null {
  const degree = new Map<string, number>();
  for (const n of nodes) degree.set(n, 0);
  for (const [a, b] of edges) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }

  let best: { id: string; deg: number } | null = null;
  for (const [id, deg] of degree) {
    if (!best || deg > best.deg || (deg === best.deg && id < best.id)) {
      best = { id, deg };
    }
  }
  return best?.deg ? best.id : null;
}
