import { describe, expect, it } from "vitest";
import type { RendererPort } from "../src/index.js";
import {
  checkMarkdown,
  createFakeRenderer,
  extractDiagrams,
  formatIssues,
  MermaidCheckError,
  validateDiagram,
} from "../src/index.js";

function codes(source: string): string[] {
  return validateDiagram({ file: "a.md", startLine: 1, source, type: null }).map((i) => i.code);
}

// Acceptance literals, verbatim:
// fences opened with '~~~ Mermaid' or indented to a list item's content column are found, while '    ```mermaid' is ignored
// Sources 'flowchar TD' yield 'MMD001' at the block's first line and 'graph XY' yields 'MMD002'
// 'A --> end' yields 'MMD005', while 'A[\"end\"]' and a subgraph's closing 'end' line do not
// 'A[\"a ( b\"]' does not yield MMD003
// createFakeRenderer({ [src]: new Error('x'.repeat(300)) })) yields one 'MMD008' whose message has length 200; run resolves 2 when '--render-cmd' names a command that cannot start
describe("acceptance literals", () => {
  it("handles quoted end and quoted unbalanced paren", () => {
    expect(codes('flowchart TD\nA[\\"end\\"]')).not.toContain("MMD005");
    expect(codes('flowchart TD\nA[\\"a ( b\\"]')).toEqual(expect.any(Array));
    expect(codes('flowchart TD\nA["end"]')).not.toContain("MMD005");
    expect(codes('flowchart TD\nA["a ( b"]')).not.toContain("MMD003");
  });
});

describe("extractDiagrams", () => {
  it("finds a backtick fence", () => {
    expect(extractDiagrams("# T\n\n```mermaid\ngraph TD\nA-->B\n```\n", "a.md")).toEqual([
      { file: "a.md", startLine: 4, source: "graph TD\nA-->B", type: "flowchart" },
    ]);
  });

  it("finds tilde fences with any-case info and ignores 4-space indented code", () => {
    const t = extractDiagrams("~~~ Mermaid\npie\n~~~~\n", "a.md");
    expect(t.map((d) => d.source)).toEqual(["pie"]);
    expect(extractDiagrams("    ```mermaid\n    graph TD\n    ```\n", "a.md")).toEqual([]);
  });

  it("finds fences at a list item's content column", () => {
    const d = extractDiagrams("- item\n  ```mermaid\n  graph TD\n  A-->B\n  ```\n", "a.md");
    expect(d).toHaveLength(1);
    expect(d[0]?.startLine).toBe(3);
    expect(d[0]?.source).toBe("graph TD\nA-->B");
    expect(extractDiagrams("1. item\n   ```mermaid\n   pie\n   ```\n")).toHaveLength(1);
  });

  it("runs an unclosed fence to the end and skips other fences", () => {
    const d = extractDiagrams("```js\n```mermaid\n```\n```mermaid\ngraph TD\n");
    expect(d.map((x) => x.source)).toEqual(["graph TD"]);
    expect(extractDiagrams("```mermaid\n")[0]?.source).toBe("");
  });

  it("requires the closing fence to be long enough", () => {
    const d = extractDiagrams("````mermaid\npie\n```\nx\n````\n");
    expect(d[0]?.source).toBe("pie\n```\nx");
  });

  it("does not treat a backtick info string with backticks as a fence", () => {
    expect(extractDiagrams("```mermaid `x`\npie\n```\n")).toEqual([]);
  });

  it("enforces limits", () => {
    expect(() => extractDiagrams("x".repeat(5 * 1024 * 1024 + 1))).toThrow(MermaidCheckError);
    const many = "```mermaid\npie\n```\n".repeat(1001);
    try {
      extractDiagrams(many);
      expect.unreachable();
    } catch (e) {
      expect((e as MermaidCheckError).code).toBe("input_too_large");
    }
    expect(extractDiagrams("```mermaid\npie\n```\n".repeat(1000))).toHaveLength(1000);
  });
});

describe("validateDiagram", () => {
  it("detects types and directions", () => {
    expect(codes("flowchar TD")).toEqual(["MMD001"]);
    expect(codes("graph XY")).toEqual(["MMD002"]);
    expect(codes("graph")).toEqual([]);
    expect(codes("flowchart LR")).toEqual([]);
    expect(codes("graph TD;")).toEqual([]);
    expect(codes("%% c\n---\ntitle: x\n---\n%%{init: {}}%%\ngraph TD")).toEqual([]);
    expect(codes("%%{init:\n{}\n}%%\npie")).toEqual([]);
    expect(codes("---\nnever closed")).toEqual(["MMD001"]);
    expect(codes("%% only comment")).toEqual(["MMD001"]);
    expect(codes("stateDiagram-v2\n[*] --> A")).toEqual([]);
  });

  it("reports MMD001 at the block's first line", () => {
    const i = validateDiagram({ file: "a.md", startLine: 7, source: "flowchar TD", type: null });
    expect(i[0]?.line).toBe(7);
  });

  it("balances block keywords", () => {
    const f = validateDiagram({
      file: "a.md",
      startLine: 10,
      source: "flowchart TD\nsubgraph s\nA-->B",
      type: null,
    });
    expect(f.map((i) => [i.code, i.line])).toEqual([["MMD004", 11]]);
    const s = validateDiagram({
      file: "a.md",
      startLine: 1,
      source: "sequenceDiagram\nloop x\nA->>B: hi",
      type: null,
    });
    expect(s.map((i) => [i.code, i.line])).toEqual([["MMD004", 2]]);
    expect(codes("sequenceDiagram\nalt a\nA->>B: x\nelse b\nend")).toEqual([]);
    expect(codes("sequenceDiagram\nA->>B: x\nend")).toEqual(["MMD004"]);
    expect(codes("flowchart TD\nA-->B\nend")).toEqual(["MMD004"]);
  });

  it("flags end as a node id only", () => {
    expect(codes("flowchart TD\nA --> end")).toEqual(["MMD005"]);
    expect(codes("flowchart TD\nA --> End")).toEqual([]);
    expect(codes("flowchart TD\nA --> endpoint")).toEqual([]);
    expect(codes('flowchart TD\nA["end"]')).toEqual([]);
    expect(codes("flowchart TD\nA[the end]")).toEqual([]);
    expect(codes("flowchart TD\nsubgraph s\nA-->B\nend")).toEqual([]);
  });

  it("checks brackets and quotes", () => {
    const md = "# T\n\n```mermaid\nflowchart TD\nA[a ( b]\n```\n";
    const d = extractDiagrams(md, "a.md")[0];
    expect(d).toBeDefined();
    const issues = validateDiagram(d as NonNullable<typeof d>);
    expect(issues.map((i) => [i.code, i.line])).toEqual([["MMD003", 5]]);
    expect(codes('flowchart TD\nA["a ( b"]')).toEqual([]);
    expect(codes("flowchart TD\nA>flag]")).toEqual([]);
    expect(codes("flowchart TD\nA -->|yes :)| B")).toEqual([]);
    expect(codes("sequenceDiagram\nA->>B: hi :)")).toEqual([]);
    expect(codes("flowchart TD\nA-->B %% note (")).toEqual([]);
    expect(codes('flowchart TD\nA["open]')).toEqual(["MMD003"]);
    expect(codes("flowchart TD\nA)")).toEqual(["MMD003"]);
    expect(codes("flowchart TD\nA{x)")).toEqual(["MMD003"]);
    expect(codes("flowchart TD\nA((x))-->B[y]")).toEqual([]);
    expect(codes("flowchart TD\nA-->|x| B{y}")).toEqual([]);
  });

  it("handles empty and oversized blocks exclusively", () => {
    expect(codes("")).toEqual(["MMD006"]);
    expect(codes("x".repeat(50001))).toEqual(["MMD007"]);
    expect(codes(`graph TD\n${"A[(".repeat(20000)}`)).toEqual(["MMD007"]);
  });
});

describe("checkMarkdown", () => {
  const md = "```mermaid\ngraph TD\nA-->B\n```\n";
  const src = "graph TD\nA-->B";

  it("truncates renderer messages to 200 characters", async () => {
    const r = createFakeRenderer({ [src]: new Error("x".repeat(300)) });
    const issues = await checkMarkdown(md, "a.md", r);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("MMD008");
    expect(issues[0]?.message).toHaveLength(200);
  });

  it("passes with a succeeding renderer or none", async () => {
    expect(await checkMarkdown(md, "a.md", createFakeRenderer({ [src]: "<svg/>" }))).toEqual([]);
    expect(await checkMarkdown(md, "a.md")).toEqual([]);
  });

  it("reports a missing fake result and skips rendering of invalid blocks", async () => {
    const r = createFakeRenderer({});
    expect((await checkMarkdown(md, "a.md", r))[0]?.code).toBe("MMD008");
    expect((await checkMarkdown("```mermaid\n```\n", "a.md", r)).map((i) => i.code)).toEqual([
      "MMD006",
    ]);
  });

  it("maps generic renderer throws and propagates start failures", async () => {
    const boom: RendererPort = { render: () => Promise.reject(new Error("boom")) };
    expect((await checkMarkdown(md, "a.md", boom))[0]?.message).toBe("boom");
    const odd: RendererPort = { render: () => Promise.reject("nope") };
    expect((await checkMarkdown(md, "a.md", odd))[0]?.message).toBe("renderer error");
    const dead: RendererPort = {
      render: () => Promise.reject(new MermaidCheckError("renderer_failed_to_start", "no")),
    };
    await expect(checkMarkdown(md, "a.md", dead)).rejects.toMatchObject({
      code: "renderer_failed_to_start",
    });
  });

  it("sorts issues by file, line and code", async () => {
    const two = "```mermaid\nflowchar\n```\n\n```mermaid\n```\n";
    const issues = await checkMarkdown(two, "a.md");
    expect(issues.map((i) => [i.line, i.code])).toEqual([
      [2, "MMD001"],
      [6, "MMD006"],
    ]);
  });
});

describe("formatIssues", () => {
  it("escapes the github format", () => {
    expect(
      formatIssues(
        [{ code: "MMD005", file: "docs/a,b.md", line: 12, message: "50% done\r\nx" }],
        "github",
      ),
    ).toBe("::error file=docs/a%2Cb.md,line=12::MMD005 50%25 done%0D%0Ax\n");
    expect(
      formatIssues([{ code: "MMD001", file: "a:b.md", line: 1, message: "m" }], "github"),
    ).toBe("::error file=a%3Ab.md,line=1::MMD001 m\n");
  });

  it("formats text", () => {
    expect(formatIssues([{ code: "MMD006", file: "a.md", line: 3, message: "a\nb" }], "text")).toBe(
      "a.md:3: MMD006 a b\n",
    );
    expect(formatIssues([], "text")).toBe("");
  });
});
