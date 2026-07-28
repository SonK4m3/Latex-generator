// lib/context-engineering/tests/enforce-budget.test.ts
import { describe, it, expect } from "vitest";
import { enforceContextBudget } from "@/lib/context-engineering/budget/enforce-budget";
import type { ContextBlock, ContextBudget, ContextPriority } from "@/lib/context-engineering/types";

function blk(id: string, priority: ContextPriority, estimatedTokens: number): ContextBlock {
  return {
    id,
    version: "1",
    kind: "capability",
    source: "template",
    priority,
    content: "x",
    estimatedTokens,
    stable: true,
    cacheable: true,
  };
}

const budget = (maxInputTokens: number): ContextBudget => ({
  maxInputTokens,
  reservedForOutput: 0,
  safetyMargin: 0,
});

describe("enforceContextBudget", () => {
  it("keeps everything when under budget", () => {
    const r = enforceContextBudget([blk("a", "high", 100), blk("b", "low", 100)], budget(1000));
    expect(r.dropped).toHaveLength(0);
    expect(r.totalEstimatedTokens).toBe(200);
  });

  it("drops low priority before high", () => {
    const r = enforceContextBudget([blk("hi", "high", 100), blk("lo", "low", 100)], budget(100));
    expect(r.selected.map((b) => b.id)).toEqual(["hi"]);
    expect(r.dropped.map((d) => d.block.id)).toEqual(["lo"]);
    expect(r.dropped[0].reason).toBe("budget-exceeded");
  });

  it("drops medium before high", () => {
    const r = enforceContextBudget(
      [blk("hi", "high", 100), blk("md", "medium", 100), blk("lo", "low", 100)],
      budget(100),
    );
    // low then medium dropped, high kept
    expect(r.selected.map((b) => b.id)).toEqual(["hi"]);
    expect(r.dropped.map((d) => d.block.id).sort()).toEqual(["lo", "md"]);
  });

  it("never drops critical; throws if critical alone exceeds the budget", () => {
    expect(() => enforceContextBudget([blk("c", "critical", 500)], budget(100))).toThrow();
  });
});
