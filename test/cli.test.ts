import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";

function io() {
  const o = { out: "", err: "" };
  return {
    o,
    io: {
      stdout: (s: string) => {
        o.out += s;
      },
      stderr: (s: string) => {
        o.err += s;
      },
    },
  };
}

const GOOD = "# T\n\n```mermaid\ngraph TD\nA-->B\n```\n";
const BAD = "```mermaid\nflowchar TD\n```\n";

describe("run", () => {
  const dir = mkdtempSync(join(tmpdir(), "mc-test-"));
  writeFileSync(join(dir, "good.md"), GOOD);
  writeFileSync(join(dir, "bad.md"), BAD);
  writeFileSync(join(dir, "x.mmd"), "graph XY\r\n");
  writeFileSync(join(dir, "ok.mmd"), "graph TD\nA-->B\n");
  writeFileSync(join(dir, "note.txt"), "ignored");

  it("exits 0 without issues", async () => {
    const t = io();
    expect(
      await run([join(dir, "good.md"), join(dir, "ok.mmd"), join(dir, "note.txt")], t.io),
    ).toBe(0);
    expect(t.o.out).toBe("");
  });

  it("exits 1 with issues in text and github formats", async () => {
    const t = io();
    expect(await run([join(dir, "bad.md")], t.io)).toBe(1);
    expect(t.o.out).toContain("bad.md:2: MMD001");
    const g = io();
    expect(await run([join(dir, "x.mmd"), "--format", "github"], g.io)).toBe(1);
    expect(g.o.out).toContain("line=1::MMD002");
  });

  it("walks directories without following symlinks", async () => {
    const d = mkdtempSync(join(tmpdir(), "mc-walk-"));
    mkdirSync(join(d, "sub"));
    writeFileSync(join(d, "sub", "bad.md"), BAD);
    writeFileSync(join(d, "good.md"), GOOD);
    try {
      symlinkSync(join(d, "sub", "bad.md"), join(d, "link.md"));
    } catch {
      // symlinks unavailable on this platform
    }
    const t = io();
    expect(await run([d], t.io)).toBe(1);
    expect(t.o.out.trim().split("\n")).toHaveLength(1);
  });

  it("returns 2 for usage errors", async () => {
    for (const argv of [
      [],
      [dir, "--format", "xml"],
      [dir, "--format"],
      [dir, "--bogus"],
      [dir, "--render-cmd"],
    ]) {
      const t = io();
      expect(await run(argv, t.io)).toBe(2);
      expect(t.o.err).toContain("usage");
    }
  });

  it("returns 2 for missing paths and unstartable renderers", async () => {
    const t = io();
    expect(await run([join(dir, "missing.md")], t.io)).toBe(2);
    expect(t.o.err).toContain("error:");
    const r = io();
    expect(await run([join(dir, "good.md"), "--render-cmd", "/nonexistent/mc-cmd"], r.io)).toBe(2);
    expect(r.o.err).toContain("renderer_failed_to_start");
  });
});
