/**
 * Public entry point of @trysac/mermaid-check.
 *
 * A heuristic, browser-free linter for Mermaid diagrams. It does not guarantee that Mermaid's own
 * parser accepts a diagram.
 */
import { MermaidCheckError } from "./errors.js";
import { checkDiagram, detectType, sortIssues, validateDiagram } from "./lint.js";
import type { Diagram, Issue, RendererPort, RenderResult } from "./types.js";

export type { MermaidCheckErrorCode } from "./errors.js";
export type { Diagram, DiagramType, Issue, RendererPort, RenderResult } from "./types.js";
export { MermaidCheckError, validateDiagram };

const MAX_MARKDOWN_CHARS = 5 * 1024 * 1024;
const MAX_DIAGRAMS = 1000;

function indentOf(line: string): number {
  let n = 0;
  while (n < line.length && line.charAt(n) === " ") n++;
  return n;
}

function listColumn(trimmed: string, indent: number): number {
  let m = 0;
  const c = trimmed.charAt(0);
  if (c === "-" || c === "+" || c === "*") {
    m = 1;
  } else {
    let d = 0;
    while (d < trimmed.length && d < 10 && /[0-9]/.test(trimmed.charAt(d))) d++;
    const p = trimmed.charAt(d);
    if (d >= 1 && d <= 9 && (p === "." || p === ")")) m = d + 1;
  }
  if (m === 0 || trimmed.charAt(m) !== " ") return 0;
  let s = 0;
  while (trimmed.charAt(m + s) === " ") s++;
  const blank = trimmed.slice(m).trim() === "";
  return blank || s >= 5 ? indent + m + 1 : indent + m + s;
}

function parseFence(trimmed: string): { ch: string; len: number; info: string } | null {
  const ch = trimmed.charAt(0);
  if (ch !== "`" && ch !== "~") return null;
  let n = 0;
  while (trimmed.charAt(n) === ch) n++;
  if (n < 3) return null;
  const info = trimmed.slice(n);
  if (ch === "`" && info.includes("`")) return null;
  return { ch, len: n, info };
}

function isClosing(line: string, openIndent: number, ch: string, len: number): boolean {
  const ind = indentOf(line);
  if (ind > openIndent + 3) return false;
  const t = line.slice(ind);
  let n = 0;
  while (t.charAt(n) === ch) n++;
  return n >= len && t.slice(n).trim() === "";
}

function stripIndent(line: string, max: number): string {
  return line.slice(Math.min(indentOf(line), max));
}

/**
 * Finds fenced Mermaid diagrams in Markdown (CommonMark fences, also inside list items).
 *
 * @param markdown - Markdown text, at most 5 MiB (UTF-16 code units).
 * @param file - File name reported in diagrams and issues.
 * @throws {MermaidCheckError} `input_too_large` for oversized input or more than 1000 diagrams.
 */
export function extractDiagrams(markdown: string, file = ""): Diagram[] {
  if (markdown.length > MAX_MARKDOWN_CHARS) {
    throw new MermaidCheckError("input_too_large", "Markdown input exceeds 5 MiB");
  }
  const lines = markdown.split(/\r\n|\r|\n/);
  const out: Diagram[] = [];
  let listCol = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const indent = indentOf(line);
    const trimmed = line.slice(indent);
    if (trimmed.trim() === "") {
      i++;
      continue;
    }
    const lm = listColumn(trimmed, indent);
    if (lm > 0) listCol = lm;
    else if (indent < listCol) listCol = 0;
    const allowed = indent <= 3 || (listCol > 0 && indent >= listCol && indent <= listCol + 3);
    const fence = allowed ? parseFence(trimmed) : null;
    if (fence === null) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < lines.length && !isClosing(lines[j] ?? "", indent, fence.ch, fence.len)) j++;
    const closed = j < lines.length;
    let end = j;
    if (!closed && end > i + 1 && lines[end - 1] === "") end--;
    const word = fence.info.trim().split(/\s/, 1)[0] ?? "";
    if (word.toLowerCase() === "mermaid") {
      if (out.length >= MAX_DIAGRAMS) {
        throw new MermaidCheckError("input_too_large", "more than 1000 diagrams in one file");
      }
      const source = lines
        .slice(i + 1, end)
        .map((l) => stripIndent(l, indent))
        .join("\n");
      out.push({ file, startLine: i + 2, source, type: detectType(source).type });
    }
    i = j + 1;
  }
  return out;
}

/**
 * Extracts, validates and optionally renders every diagram in a Markdown file.
 *
 * @throws {MermaidCheckError} When extraction limits are hit or the renderer cannot start.
 */
export async function checkMarkdown(
  markdown: string,
  file: string,
  renderer?: RendererPort,
): Promise<Issue[]> {
  const issues: Issue[] = [];
  for (const d of extractDiagrams(markdown, file)) {
    issues.push(...(await checkDiagram(d, renderer)));
  }
  return sortIssues(issues);
}

function escapeData(s: string): string {
  return s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function escapeProperty(s: string): string {
  return escapeData(s).replaceAll(":", "%3A").replaceAll(",", "%2C");
}

/**
 * Formats issues as `file:line: CODE message` lines or GitHub Actions `::error` commands.
 * Each entry ends with LF.
 */
export function formatIssues(issues: readonly Issue[], format: "text" | "github"): string {
  let out = "";
  for (const i of issues) {
    if (format === "github") {
      out += `::error file=${escapeProperty(i.file)},line=${i.line}::${i.code} ${escapeData(i.message)}\n`;
    } else {
      out += `${i.file}:${i.line}: ${i.code} ${i.message.replace(/[\r\n]+/g, " ")}\n`;
    }
  }
  return out;
}

/** Creates a deterministic renderer: a string result succeeds, an Error result fails. */
export function createFakeRenderer(results: Record<string, string | Error>): RendererPort {
  return {
    render(source: string): Promise<RenderResult> {
      if (!Object.hasOwn(results, source)) {
        return Promise.resolve({ ok: false, message: "no fake result for source" });
      }
      const r = results[source];
      if (r instanceof Error) return Promise.resolve({ ok: false, message: r.message });
      return Promise.resolve({ ok: true, svg: r ?? "" });
    },
  };
}
