// lib/context-engineering/types.ts
//
// Context Engineering — Level 1 core types.
//
// Design goal (see docs/features/context-engineering-l1/explainer.md):
//   Turn the previous "one big prompt string" into a pipeline that can SELECT, ORDER, LIMIT and
//   TRACE context deterministically (no LLM, no RAG, no vector DB at this level).
//
// A ContextBlock is a typed, versioned unit of context. Static blocks live in the registry
// (registry.ts); dynamic per-request blocks (request-blueprint, sources) are built at runtime
// (runtime/build-runtime-blocks.ts). Both flow through the SAME select -> order -> budget ->
// render -> trace pipeline (pipeline.ts).

/** What role a block plays in the prompt. Drives stage-eligibility and precedence ordering. */
export type ContextBlockKind =
  | "global-contract" // universal LaTeX/compile contract (applies to every template)
  | "template" // per-template base guidance (structure, packages, preamble contract)
  | "capability" // fine-grained, request-selected guidance (matrix, theorem, ...)
  | "constraint" // hard "must not" rules (forbidden packages/commands)
  | "example" // illustrative snippet (safely droppable under budget pressure)
  | "request-blueprint" // the normalized DocumentBlueprint + raw user request (runtime)
  | "runtime-state" // per-request runtime data (uploaded sources, existing labels, ...)
  | "output-contract"; // what a good final answer looks like (completeness, language)

/** Drop/keep importance. Critical blocks are NEVER dropped by the budget enforcer. */
export type ContextPriority = "critical" | "high" | "medium" | "low";

/**
 * Where the block originates. Used by the renderer to place a block into the correct message role:
 *   system | template -> system message   (stable contract the model should always honor)
 *   user | runtime     -> user message     (this specific request's data)
 */
export type ContextSource = "system" | "template" | "user" | "runtime";

/**
 * A typed unit of context. `content` is the raw text injected into the prompt; everything else is
 * metadata used to select/order/limit/trace it.
 */
export type ContextBlock = {
  id: string;
  version: string;

  kind: ContextBlockKind;
  source: ContextSource;
  priority: ContextPriority;

  content: string;

  /** Heuristic token estimate (chars/4). Calibrated over time against real SDK usage. */
  estimatedTokens: number;

  /** Content never changes between requests (enables future prompt caching). */
  stable: boolean;
  cacheable: boolean;

  /** Only select for these templates. Undefined/empty ⇒ applies to all templates. */
  appliesToTemplates?: string[];
  /** Only select when ALL of these capabilities are present in the blueprint. */
  requiredCapabilities?: string[];

  /** Reserved for Level 1+ (not enforced yet in the selector). */
  dependsOn?: string[];
  conflictsWith?: string[];
};

/**
 * Pipeline stage. Determines which block kinds are eligible.
 * Level 1 slice wires only "generation"; the others are declared for forward compatibility.
 */
export type ContextStage =
  | "request-understanding"
  | "generation"
  | "repair"
  | "quality-review";

/**
 * Neutral render target. Intentionally NOT `ModelMessage[]` from the `ai` package — keeping this
 * provider-agnostic so MockProvider (which must not import `ai`) and any future provider can consume
 * it. VercelAiProvider maps {system, user} onto the SDK's `system`/`prompt` (or `messages`) itself.
 */
export type RenderedPrompt = {
  system: string;
  user: string;
};

/** Simple token budget for Level 1 (no true tokenizer). */
export type ContextBudget = {
  maxInputTokens: number;
  reservedForOutput: number;
  safetyMargin: number;
};

export type DropReason =
  | "template-mismatch"
  | "capability-not-selected"
  | "stage-mismatch"
  | "dependency-missing"
  | "budget-exceeded";

export type DroppedBlock = {
  block: ContextBlock;
  reason: DropReason;
};

export type BudgetResult = {
  selected: ContextBlock[];
  dropped: DroppedBlock[];
  totalEstimatedTokens: number;
};

/**
 * Auditable record of every context decision for a single generation. Emitted per request (via
 * deps.logger) so we can inspect exactly what went into the prompt WITHOUT logging the model's
 * private reasoning. Only inputs, block ids, selector decisions, and technical results.
 */
export type ContextTrace = {
  requestId: string;
  stage: ContextStage;

  templateId: string;
  capabilityIds: string[];

  selectedBlocks: Array<{
    id: string;
    version: string;
    kind: ContextBlockKind;
    estimatedTokens: number;
  }>;

  droppedBlocks: Array<{
    id: string;
    reason: DropReason;
  }>;

  estimatedInputTokens: number;

  /** Filled in AFTER generation from the provider outcome. */
  actualUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
};

/** Output of assembleContext(): the rendered prompt plus its auditable trace. */
export type AssembledContext = {
  rendered: RenderedPrompt;
  trace: ContextTrace;
};
