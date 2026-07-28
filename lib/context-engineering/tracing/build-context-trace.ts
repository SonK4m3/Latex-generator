// lib/context-engineering/tracing/build-context-trace.ts
//
// buildContextTrace — assembles the auditable ContextTrace for one generation. Records WHAT went
// into the prompt and WHY each candidate was kept or dropped. Deliberately logs only inputs, block
// ids, selector decisions and technical numbers — never the model's private reasoning.

import type {
  BudgetResult,
  ContextBlock,
  ContextStage,
  ContextTrace,
  DropReason,
} from "@/lib/context-engineering/types";
import type { DocumentBlueprint } from "@/lib/document-blueprint/types";
import { isBlockAllowedForTemplate } from "@/lib/context-engineering/selectors/select-by-template";
import { isBlockAllowedForCapabilities } from "@/lib/context-engineering/selectors/select-by-capability";
import { isBlockAllowedForStage } from "@/lib/context-engineering/selectors/select-by-stage";

export type BuildContextTraceInput = {
  requestId: string;
  stage: ContextStage;
  blueprint: DocumentBlueprint;
  /** Every candidate considered (registry + runtime blocks). */
  candidates: ContextBlock[];
  /** Result after budget enforcement (selected + budget-dropped + estimated tokens). */
  budgetResult: BudgetResult;
};

function classifyDropReason(
  block: ContextBlock,
  blueprint: DocumentBlueprint,
  stage: ContextStage,
  budgetDroppedIds: Set<string>,
): DropReason {
  if (budgetDroppedIds.has(block.id)) return "budget-exceeded";
  if (!isBlockAllowedForTemplate(block, blueprint.templateId)) return "template-mismatch";
  if (!isBlockAllowedForStage(block, stage)) return "stage-mismatch";
  if (!isBlockAllowedForCapabilities(block, blueprint.capabilities)) return "capability-not-selected";
  return "dependency-missing";
}

export function buildContextTrace({
  requestId,
  stage,
  blueprint,
  candidates,
  budgetResult,
}: BuildContextTraceInput): ContextTrace {
  const selectedIds = new Set(budgetResult.selected.map((b) => b.id));
  const budgetDroppedIds = new Set(budgetResult.dropped.map((d) => d.block.id));

  const droppedBlocks = candidates
    .filter((b) => !selectedIds.has(b.id))
    .map((b) => ({
      id: b.id,
      reason: classifyDropReason(b, blueprint, stage, budgetDroppedIds),
    }));

  return {
    requestId,
    stage,
    templateId: blueprint.templateId,
    capabilityIds: blueprint.capabilities,
    selectedBlocks: budgetResult.selected.map((b) => ({
      id: b.id,
      version: b.version,
      kind: b.kind,
      estimatedTokens: b.estimatedTokens,
    })),
    droppedBlocks,
    estimatedInputTokens: budgetResult.totalEstimatedTokens,
  };
}
