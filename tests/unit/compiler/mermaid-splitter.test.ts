import { describe, expect, test } from "bun:test";
import { splitMermaidFlowchart } from "../../../src/compiler/mermaid-splitter.ts";

describe("compiler: mermaid-splitter", () => {
  test("flowchart/graph 以外は null", () => {
    const code = `sequenceDiagram\n  A->>B: hello`;
    expect(splitMermaidFlowchart(code)).toBeNull();
  });

  test("flowchart を 2 分割し、preamble(init) を保持する", () => {
    const code = `%%{init: {"theme": "neutral"}}%%\nflowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[OK]\n  B -->|No| D[Retry]`;
    const res = splitMermaidFlowchart(code);
    expect(res).not.toBeNull();
    const [p1, p2] = res!.parts;
    expect(p1).toContain("%%{init:");
    expect(p2).toContain("%%{init:");
    expect(p1).toContain("flowchart TD");
    expect(p2).toContain("flowchart TD");
    expect((p1.match(/-->/g) ?? []).length).toBeGreaterThan(0);
    expect((p2.match(/-->/g) ?? []).length).toBeGreaterThan(0);
  });

  test("ハブ複製により、スター型でも両方にエッジが残る", () => {
    const code = `flowchart TD\n  Hub --> A\n  Hub --> B\n  Hub --> C\n  Hub --> D\n  Hub --> E\n  Hub --> F`;
    const res = splitMermaidFlowchart(code);
    expect(res).not.toBeNull();
    const [p1, p2] = res!.parts;
    expect(p1).toContain("Hub");
    expect(p2).toContain("Hub");
    expect((p1.match(/-->/g) ?? []).length).toBeGreaterThan(0);
    expect((p2.match(/-->/g) ?? []).length).toBeGreaterThan(0);
  });
});
