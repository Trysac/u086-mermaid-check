import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MermaidCheckError } from "./errors.js";
import type { RendererPort, RenderResult } from "./types.js";

const START_CODES: ReadonlySet<string> = new Set(["ENOENT", "EACCES", "EPERM", "ENOTDIR"]);

function run(command: string, args: string[], timeoutMs: number): Promise<RenderResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, shell: false, encoding: "utf8" },
      (err, stdout, stderr) => {
        if (err === null) {
          resolve({ ok: true, svg: stdout });
          return;
        }
        if (typeof err.code === "string" && START_CODES.has(err.code) && err.killed !== true) {
          reject(
            new MermaidCheckError(
              "renderer_failed_to_start",
              `cannot start renderer (${err.code})`,
            ),
          );
          return;
        }
        const text = stderr.trim() === "" ? err.message : stderr.trim();
        resolve({ ok: false, message: text.slice(0, 200) });
      },
    );
  });
}

/**
 * Creates a renderer that runs an external command on a temporary `.mmd` file (no shell).
 *
 * @throws {MermaidCheckError} From `render`, with `renderer_failed_to_start`, when the command cannot start.
 */
export function createCommandRenderer(
  command: string,
  args: string[] = [],
  opts: { timeoutMs?: number } = {},
): RendererPort {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  return {
    async render(source: string): Promise<RenderResult> {
      const dir = await mkdtemp(join(tmpdir(), "mermaid-check-"));
      try {
        const file = join(dir, "diagram.mmd");
        await writeFile(file, source, "utf8");
        return await run(command, [...args, file], timeoutMs);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}
