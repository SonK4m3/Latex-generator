// lib/context-engineering/precedence.ts
//
// orderContextBlocks — deterministic ordering. TWO-TIER (per the design decision):
//   1. HARD precedence by kind group (semantic order — contract before content).
//   2. Priority only as a tiebreaker WITHIN the same kind.
// This prevents a high-priority capability from ever jumping ahead of the global contract, while
// still letting priority decide order among sibling blocks of the same kind.
//
// Final semantic order (matches the doc's "Order cuối"):
//   global-contract → template → constraint → capability → example → request-blueprint
//   → runtime-state → output-contract

import type { ContextBlock, ContextBlockKind, ContextPriority } from "@/lib/context-engineering/types";

const KIND_ORDER: Record<ContextBlockKind, number> = {
  "global-contract": 10,
  template: 20,
  constraint: 30,
  capability: 40,
  example: 50,
  "request-blueprint": 60,
  "runtime-state": 70,
  "output-contract": 80,
};

const PRIORITY_WEIGHT: Record<ContextPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function orderContextBlocks(blocks: ContextBlock[]): ContextBlock[] {
  return [...blocks].sort((a, b) => {
    const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kindDiff !== 0) return kindDiff;
    // Higher priority first within the same kind.
    return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  });
}

export { KIND_ORDER, PRIORITY_WEIGHT };
