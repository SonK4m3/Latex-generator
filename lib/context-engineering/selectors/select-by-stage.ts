// lib/context-engineering/selectors/select-by-stage.ts
//
// Stage eligibility: which block KINDS are allowed at a given pipeline stage.
// Level 1 wires only "generation"; the others are declared for forward compatibility.

import type { ContextBlock, ContextBlockKind, ContextStage } from "@/lib/context-engineering/types";

const STAGE_KINDS: Record<ContextStage, ContextBlockKind[]> = {
  "request-understanding": ["global-contract", "constraint", "output-contract"],
  generation: [
    "global-contract",
    "template",
    "capability",
    "constraint",
    "example",
    "request-blueprint",
    "runtime-state",
    "output-contract",
  ],
  repair: ["global-contract", "constraint", "runtime-state", "output-contract"],
  "quality-review": ["constraint", "request-blueprint", "runtime-state", "output-contract"],
};

export function isBlockAllowedForStage(block: ContextBlock, stage: ContextStage): boolean {
  return STAGE_KINDS[stage].includes(block.kind);
}
