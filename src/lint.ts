import { MermaidCheckError } from "./errors.js";
import type { Diagram, DiagramType, Issue, RendererPort } from "./types.js";

/** Mermaid's default maxTextSize. */
export const MAX_DIAGRAM_CHARS = 50000;

const TYPES: ReadonlyMap<string, DiagramType> = new Map<string, DiagramType>([
  ["flowchart", "flowchart"],
  ["graph", "flowchart"],
  ["sequenceDiagram", "sequenceDiagram"],
  ["classDiagram", "classDiagram"],
  ["stateDiagram", "stateDiagram"],
  ["stateDiagram-v2", "stateDiagram-v2"],
  ["erDiagram", "erDiagram"],
  ["gantt", "gantt"],
  ["pie", "pie"],
  ["journey", "journey"],
  ["gitGraph", "gitGraph"],
  ["mindmap", "mindmap"],
  ["timeline", "timeline"],
  ["quadrantChart", "quadrantChart"],
  ["requirementDiagram", "requirementDiagram"],
  ["sankey-beta", "sankey-beta"],
  ["xychart-beta", "xychart-beta"],
  ["block-beta", "block-beta"],
  ["C4Context", "C4Context"],
  ["C4Container", "C4Container"],
  ["C4Component", "C4Component"],
  ["C4Dynamic", "C4Dynamic"],
  ["C4Deployment", "C4Deployment"],
]);

const DIRECTIONS: ReadonlySet<string> = new Set(["TB", "TD", "BT", "RL", "LR"]);
const SEQUENCE_OPENERS: ReadonlySet<string> = new Set([
  "alt",
  "opt",
  "loop",
  "par",
  "critical",
  "break",
  "rect",
  "box",
]);
const FLOWCHART_OPENERS: ReadonlySet<string> = new Set(["subgraph"]);

function lineAt(lines: readonly string[], i: number): string {
  return lines[i] ?? "";
}

function firstWord(text: string): string {
  return text.trim().split(/\s/, 1)[0] ?? "";
}

/** Result of type detection. `index` is the 0-based line of the type word or -1. */
export interface Detected {
  readonly type: DiagramType | null;
  readonly index: number;
  readonly word: string;
}

/** Detects the diagram type, skipping blank lines, comments, directives and front matter. */
export function detectType(source: string): Detected {
  const lines = source.split("\n");
  let i = 0;
  while (i < lines.length) {
    const t = lineAt(lines, i).trim();
    if (t === "" || (t.startsWith("%%") && !t.startsWith("%%{"))) i++;
    else break;
  }
  if (i < lines.length && lineAt(lines, i).trim() === "---") {
    i++;
    while (i < lines.length && lineAt(lines, i).trim() !== "---") i++;
    i++;
  }
  for (; i < lines.length; i++) {
    const t = lineAt(lines, i).trim();
    if (t === "") continue;
    if (t.startsWith("%%{")) {
      while (i < lines.length && !lineAt(lines, i).includes("}%%")) i++;
      continue;
    }
    if (t.startsWith("%%")) continue;
    const word = firstWord(t).replace(/;+$/, "");
    return { type: TYPES.get(word) ?? null, index: i, word };
  }
  return { type: null, index: -1, word: "" };
}

function isWord(c: string): boolean {
  return /[A-Za-z0-9_]/.test(c);
}

function closes(top: string | undefined, c: string): boolean {
  return (
    (c === ")" && top === "(") ||
    (c === "]" && (top === "[" || top === ">")) ||
    (c === "}" && top === "{")
  );
}

function scanLine(line: string): { unbalanced: boolean; endNode: boolean } {
  const stack: string[] = [];
  let inQuote = false;
  let inEdge = false;
  let endNode = false;
  let bad = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (inQuote) {
      if (c === '"') inQuote = false;
      continue;
    }
    if (c === '"') {
      inQuote = true;
      continue;
    }
    if (c === "%" && line.charAt(i + 1) === "%") break;
    if (inEdge) {
      if (c === "|") inEdge = false;
      continue;
    }
    if (c === "|" && stack.length === 0) {
      inEdge = true;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      stack.push(c);
      continue;
    }
    if (c === ">" && stack.length === 0 && i > 0 && isWord(line.charAt(i - 1))) {
      stack.push(">");
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      if (!closes(stack.pop(), c)) {
        bad = true;
        break;
      }
      continue;
    }
    if (stack.length === 0 && isWord(c)) {
      let j = i + 1;
      while (j < line.length && isWord(line.charAt(j))) j++;
      if (line.slice(i, j) === "end") endNode = true;
      i = j - 1;
    }
  }
  return { unbalanced: bad || inQuote || stack.length > 0, endNode };
}

/** Validates one diagram and returns its issues sorted by line and code. */
export function validateDiagram(d: Diagram): Issue[] {
  const mk = (code: string, idx: number, message: string): Issue => ({
    code,
    file: d.file,
    line: d.startLine + idx,
    message,
  });
  if (d.source.length > MAX_DIAGRAM_CHARS) {
    return [mk("MMD007", 0, `diagram exceeds ${MAX_DIAGRAM_CHARS} characters`)];
  }
  if (d.source.trim() === "") return [mk("MMD006", 0, "diagram is empty")];
  const det = detectType(d.source);
  if (det.type === null) {
    const w = det.word === "" ? "" : `: ${det.word.slice(0, 40)}`;
    return [mk("MMD001", 0, `unknown or missing diagram type${w}`)];
  }
  const lines = d.source.split("\n");
  const issues: Issue[] = [];
  const blocks = (openers: ReadonlySet<string>): void => {
    const stack: { idx: number; kw: string }[] = [];
    for (let i = det.index + 1; i < lines.length; i++) {
      const w = firstWord(lineAt(lines, i));
      if (openers.has(w)) {
        stack.push({ idx: i, kw: w });
      } else if (w === "end" || w === "end;") {
        if (stack.pop() === undefined) {
          issues.push(mk("MMD004", i, "'end' without an opening block"));
        }
      }
    }
    for (const open of stack) {
      issues.push(mk("MMD004", open.idx, `'${open.kw}' is never closed with 'end'`));
    }
  };
  if (det.type === "flowchart") {
    const first = lineAt(lines, det.index).trim();
    let k = 0;
    while (k < first.length && !/\s/.test(first.charAt(k)) && first.charAt(k) !== ";") k++;
    const rest = first.slice(k).trim();
    let m = 0;
    while (m < rest.length && /[A-Za-z]/.test(rest.charAt(m))) m++;
    const dir = rest.slice(0, m);
    if (dir !== "" && !DIRECTIONS.has(dir)) {
      issues.push(mk("MMD002", det.index, `invalid flowchart direction: ${dir.slice(0, 40)}`));
    }
    if (scanLine(rest.slice(m)).unbalanced) {
      issues.push(mk("MMD003", det.index, "unbalanced brackets or quotes"));
    }
    blocks(FLOWCHART_OPENERS);
    for (let i = det.index + 1; i < lines.length; i++) {
      const line = lineAt(lines, i);
      const t = line.trim();
      const closer = t === "end" || t === "end;";
      const r = scanLine(line);
      if (r.unbalanced) {
        issues.push(mk("MMD003", i, "unbalanced brackets or quotes"));
      }
      if (r.endNode && !closer) {
        issues.push(
          mk("MMD005", i, "lowercase 'end' used as a node id; write it as 'End' or quote it"),
        );
      }
    }
  } else if (det.type === "sequenceDiagram") {
    blocks(SEQUENCE_OPENERS);
  }
  return sortIssues(issues);
}

/** Sorts issues by file, line and code (new array). */
export function sortIssues(issues: readonly Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    if (a.line !== b.line) return a.line - b.line;
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    return 0;
  });
}

/** Validates a diagram and, when a renderer is given, renders it too. */
export async function checkDiagram(d: Diagram, renderer?: RendererPort): Promise<Issue[]> {
  const issues = validateDiagram(d);
  const skip = issues.some(
    (i) => i.code === "MMD006" || i.code === "MMD007" || i.code === "MMD001",
  );
  if (renderer !== undefined && !skip) {
    let message: string | null = null;
    try {
      const res = await renderer.render(d.source);
      if (!res.ok) message = res.message;
    } catch (e) {
      if (e instanceof MermaidCheckError) throw e;
      message = e instanceof Error ? e.message : "renderer error";
    }
    if (message !== null) {
      issues.push({
        code: "MMD008",
        file: d.file,
        line: d.startLine,
        message: message.slice(0, 200),
      });
    }
  }
  return sortIssues(issues);
}
