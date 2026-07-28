// lib/context-engineering/tests/precedence.test.ts
import { describe, it, expect } from "vitest";
import { orderContextBlocks } from "@/lib/context-engineering/precedence";
import type { ContextBlock, ContextBlockKind, ContextPriority } from "@/lib/context-engineering/types";

function blk(id: string, kind: ContextBlockKind, priority: ContextPriority): ContextBlock {
  return {
    id,
    version: "1",
    kind,
    source: "system",
    priority,
    content: "",
    estimatedTokens: 0,
    stable: true,
    cacheable: true,
  };
}

describe("orderContextBlocks", () => {
  it("orders by kind group first (semantic precedence)", () => {
    const out = orderContextBlocks([
      blk("out", "output-contract", "high"),
      blk("cap", "capability", "high"),
      blk("glob", "global-contract", "critical"),
      blk("con", "constraint", "critical"),
      blk("tpl", "template", "high"),
      blk("ex", "example", "low"),
    ]);
    expect(out.map((b) => b.id)).toEqual(["glob", "tpl", "con", "cap", "ex", "out"]);
  });

  it("orders by priority within the same kind (higher first)", () => {
    const out = orderContextBlocks([
      blk("low", "capability", "low"),
      blk("high", "capability", "high"),
      blk("med", "capability", "medium"),
    ]);
    expect(out.map((b) => b.id)).toEqual(["high", "med", "low"]);
  });
});
