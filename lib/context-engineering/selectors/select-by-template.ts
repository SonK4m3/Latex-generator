// lib/context-engineering/selectors/select-by-template.ts
//
// Template eligibility: a block applies if it declares no template restriction, or explicitly lists
// the blueprint's templateId. Global blocks (no appliesToTemplates) pass for every template.

import type { ContextBlock } from "@/lib/context-engineering/types";

export function isBlockAllowedForTemplate(block: ContextBlock, templateId: string): boolean {
  if (!block.appliesToTemplates || block.appliesToTemplates.length === 0) return true;
  return block.appliesToTemplates.includes(templateId);
}
