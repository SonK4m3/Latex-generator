// lib/context-engineering/selectors/select.ts
//
// selectContextBlocks — the deterministic core of Level 1. Given a stage + blueprint, it filters the
// candidate blocks by template, capability, and stage eligibility. No LLM, no ranking model: the
// same input always yields the same set (in registry order).
//
// `candidates` is the combined list of static registry blocks + runtime blocks (request-blueprint,
// sources). Filtering all of them uniformly keeps one code path.

import type { ContextBlock, ContextStage } from "@/lib/context-engineering/types";
import type { DocumentBlueprint } from "@/lib/document-blueprint/types";
import { isBlockAllowedForTemplate } from "@/lib/context-engineering/selectors/select-by-template";
import { isBlockAllowedForCapabilities } from "@/lib/context-engineering/selectors/select-by-capability";
import { isBlockAllowedForStage } from "@/lib/context-engineering/selectors/select-by-stage";

export type SelectContextInput = {
  stage: ContextStage;
  blueprint: DocumentBlueprint;
  candidates: ContextBlock[];
};

export function selectContextBlocks({
  stage,
  blueprint,
  candidates,
}: SelectContextInput): ContextBlock[] {
  return candidates.filter(
    (block) =>
      isBlockAllowedForTemplate(block, blueprint.templateId) &&
      isBlockAllowedForCapabilities(block, blueprint.capabilities) &&
      isBlockAllowedForStage(block, stage),
  );
}
