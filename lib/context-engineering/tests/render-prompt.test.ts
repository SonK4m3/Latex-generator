// lib/context-engineering/tests/render-prompt.test.ts
import { describe, it, expect } from "vitest";
import { renderPrompt } from "@/lib/context-engineering/renderer/render-prompt";
import type { ContextBlock, ContextSource } from "@/lib/context-engineering/types";

function blk(id: string, source: ContextSource, content: string): ContextBlock {
  return {
    id,
    version: "1",
    kind: "template",
    source,
    priority: "high",
    content,
    estimatedTokens: 0,
    stable: true,
    cacheable: true,
  };
}

describe("renderPrompt", () => {
  it("routes system/template blocks to system, user/runtime blocks to user", () => {
    const { system, user } = renderPrompt([
      blk("g", "system", "SYS_CONTENT"),
      blk("t", "template", "TPL_CONTENT"),
      blk("r", "user", "USR_CONTENT"),
      blk("s", "runtime", "SRC_CONTENT"),
    ]);

    expect(system).toContain("SYS_CONTENT");
    expect(system).toContain("TPL_CONTENT");
    expect(system).not.toContain("USR_CONTENT");
    expect(system).not.toContain("SRC_CONTENT");

    expect(user).toContain("USR_CONTENT");
    expect(user).toContain("SRC_CONTENT");
    expect(user).not.toContain("SYS_CONTENT");
  });

  it("preserves incoming order within each message", () => {
    const { system } = renderPrompt([
      blk("a", "system", "AAA"),
      blk("b", "template", "BBB"),
    ]);
    expect(system.indexOf("AAA")).toBeLessThan(system.indexOf("BBB"));
  });
});
