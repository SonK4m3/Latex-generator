// lib/context-engineering/selectors/select-by-capability.ts
//
// Capability eligibility: a block with requiredCapabilities is selected only when the blueprint
// includes ALL of them. Blocks without requiredCapabilities (template base, constraints, global,
// output contract) are always eligible.

import type { ContextBlock } from "@/lib/context-engineering/types";

export function isBlockAllowedForCapabilities(
  block: ContextBlock,
  capabilities: string[],
): boolean {
  if (!block.requiredCapabilities || block.requiredCapabilities.length === 0) return true;
  return block.requiredCapabilities.every((cap) => capabilities.includes(cap));
}
