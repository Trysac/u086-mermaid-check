import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { MermaidCheckError } from "./errors.js";
import { checkMarkdown, formatIssues } from "./index.js";
import { checkDiagram, detectType, sortIssues } from "./lint.js";
import { createCommandRenderer } from "./node.js";
import type { Issue, RendererPort } from "./types.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 10000;
const MAX_DEPTH = 32;

/** Output sinks injected into {@link run}. */
export interface Io {
  stdout(s: string): void;
  stderr(s: string): void;
}

async function collect(p: string, depth: number, out: string[]): Promise<void> {
  const st = await lstat(p);
  if (st.isSymbolicLink()) return;
  if (st.isDirectory()) {
    if (depth > MAX_DEPTH) {
      throw new MermaidCheckError("input_too_large", "directory nesting too deep");
    }
    const names = (await readdir(p)).sort();
    for (const n of names) await collect(join(p, n), depth + 1, out);
    return;
  }
  if (st.isFile() && (p.endsWith(".md") || p.endsWith(".mmd"))) {
    if (out.length >= MAX_FILES) {
      throw new MermaidCheckError("input_too_large", "too many files");
    }
    if (st.size > MAX_FILE_BYTES) {
      throw new MermaidCheckError("input_too_large", "file exceeds 5 MiB");
    }
    out.push(p);
  }
}

/**
 * Runs the command line. Exit codes: 0 no issues, 1 issues found, 2 usage, I/O or renderer start failure.
 */
export async function run(argv: string[], io: Io): Promise<number> {
  const paths: string[] = [];
  let format: "text" | "github" = "text";
  let renderCmd: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--format") {
      const v = argv[++i];
      if (v !== "text" && v !== "github") {
        io.stderr("usage: --format must be text or github\n");
        return 2;
      }
      format = v;
    } else if (a === "--render-cmd") {
      const v = argv[++i];
      if (v === undefined || v === "") {
        io.stderr("usage: --render-cmd needs a command\n");
        return 2;
      }
      renderCmd = v;
    } else if (a.startsWith("--")) {
      io.stderr(`usage: unknown option ${a.slice(0, 40)}\n`);
      return 2;
    } else {
      paths.push(a);
    }
  }
  if (paths.length === 0) {
    io.stderr("usage: mermaid-check [PATH ...] [--format text|github] [--render-cmd PATH]\n");
    return 2;
  }
  try {
    const files: string[] = [];
    for (const p of paths) await collect(p, 0, files);
    const renderer: RendererPort | undefined =
      renderCmd === null ? undefined : createCommandRenderer(renderCmd);
    const issues: Issue[] = [];
    for (const f of files) {
      const text = await readFile(f, "utf8");
      if (f.endsWith(".mmd")) {
        const source = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
        const d = { file: f, startLine: 1, source, type: detectType(source).type };
        issues.push(...(await checkDiagram(d, renderer)));
      } else {
        issues.push(...(await checkMarkdown(text, f, renderer)));
      }
    }
    const sorted = sortIssues(issues);
    io.stdout(formatIssues(sorted, format));
    return sorted.length > 0 ? 1 : 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    const code = e instanceof MermaidCheckError ? `${e.code}: ` : "";
    io.stderr(`error: ${code}${msg.slice(0, 200)}\n`);
    return 2;
  }
}
