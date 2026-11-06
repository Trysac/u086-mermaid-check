import { describe, expect, it } from "vitest";
import { createCommandRenderer } from "../src/node.js";

describe("createCommandRenderer", () => {
  it("succeeds when the command exits 0", async () => {
    const r = createCommandRenderer(process.execPath, ["-e", "0"]);
    expect((await r.render("graph TD")).ok).toBe(true);
  });

  it("reports a non-zero exit with stderr", async () => {
    const r = createCommandRenderer(process.execPath, [
      "-e",
      "console.error('bad');process.exit(3)",
    ]);
    expect(await r.render("graph TD")).toEqual({ ok: false, message: "bad" });
  });

  it("falls back to the error message when stderr is empty", async () => {
    const r = createCommandRenderer(process.execPath, ["-e", "process.exit(4)"]);
    const res = await r.render("graph TD");
    expect(res.ok).toBe(false);
  });

  it("times out", async () => {
    const r = createCommandRenderer(process.execPath, ["-e", "setTimeout(()=>{},5000)"], {
      timeoutMs: 200,
    });
    expect((await r.render("graph TD")).ok).toBe(false);
  });

  it("rejects when the command cannot start", async () => {
    const r = createCommandRenderer("/nonexistent/mermaid-check-cmd");
    await expect(r.render("graph TD")).rejects.toMatchObject({
      code: "renderer_failed_to_start",
    });
  });
});
