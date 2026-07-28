// lib/context-engineering/pipeline.ts
//
// assembleContext — the single entry point that runs the whole Level 1 pipeline:
//   build candidates (registry + runtime) → select → order → budget → render → trace.
//
// Returns null when the blueprint's template has no block coverage, which signals the caller to use
// the legacy prompt path (buildUserPrompt). This is how the slice stays backward-compatible: only
// templates with authored blocks (currently `math`) go through the engine.

import type {
  AssembledContext,
  ContextBlock,
  ContextBudget,
  ContextStage,
} from "@/lib/context-engineering/types";
import type { DocumentBlueprint } from "@/lib/document-blueprint/types";
import type { SourceFile, RetrievedChunk } from "@/lib/types/document";
import { contextRegistry, hasTemplateCoverage } from "@/lib/context-engineering/registry";
import { selectContextBlocks } from "@/lib/context-engineering/selectors/select";
import { orderContextBlocks } from "@/lib/context-engineering/precedence";
import { enforceContextBudget } from "@/lib/context-engineering/budget/enforce-budget";
import { renderPrompt } from "@/lib/context-engineering/renderer/render-prompt";
import { buildContextTrace } from "@/lib/context-engineering/tracing/build-context-trace";
import {
  buildRequestBlueprintBlock,
  buildSourcesRuntimeBlock,
} from "@/lib/context-engineering/runtime/build-runtime-blocks";

/**
 * Conservative default budget. available = 24000 - 8000 - 2000 = 14000 est. input tokens.
 * Normal math prompts are far under this; budget only bites when large sources are attached.
 */
export const DEFAULT_GENERATION_BUDGET: ContextBudget = {
  maxInputTokens: 24_000,
  reservedForOutput: 8_000,
  safetyMargin: 2_000,
};

export type AssembleContextInput = {
  blueprint: DocumentBlueprint;
  description: string;
  sources?: SourceFile[];
  retrievedSources?: RetrievedChunk[];
  stage?: ContextStage;
  budget?: ContextBudget;
};

export function assembleContext(input: AssembleContextInput): AssembledContext | null {
  const { blueprint, description } = input;
  const stage: ContextStage = input.stage ?? "generation";
  const budget = input.budget ?? DEFAULT_GENERATION_BUDGET;

  // No authored blocks for this template ⇒ let the caller fall back to the legacy prompt.
  if (!hasTemplateCoverage(blueprint.templateId)) return null;

  // Per-request runtime blocks flow through the same pipeline as static blocks.
  const runtimeBlocks: ContextBlock[] = [buildRequestBlueprintBlock(blueprint, description)];
  const sourcesBlock = buildSourcesRuntimeBlock(input.sources, input.retrievedSources);
  if (sourcesBlock) runtimeBlocks.push(sourcesBlock);

  const candidates: ContextBlock[] = [...contextRegistry, ...runtimeBlocks];

  const selected = selectContextBlocks({ stage, blueprint, candidates });
  const ordered = orderContextBlocks(selected);
  const budgetResult = enforceContextBudget(ordered, budget);

  const rendered = renderPrompt(budgetResult.selected);
  const trace = buildContextTrace({
    requestId: blueprint.requestId,
    stage,
    blueprint,
    candidates,
    budgetResult,
  });

  return { rendered, trace };
}
