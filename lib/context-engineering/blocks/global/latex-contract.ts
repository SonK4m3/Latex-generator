// lib/context-engineering/blocks/global/latex-contract.ts
//
// global-contract — the universal LaTeX/compile contract that applies to EVERY template.
// Reuses the existing SYSTEM_PROMPT verbatim (single source of truth) so the pipeline path and the
// legacy fallback path send an identical global contract (parity by construction).

import type { ContextBlock } from "@/lib/context-engineering/types";
import { estimateTokens } from "@/lib/context-engineering/budget/estimate-tokens";
import { SYSTEM_PROMPT, PROMPT_VERSION } from "@/lib/ai/prompts/system";

export const globalLatexContract: ContextBlock = {
  id: "global-latex-contract",
  version: PROMPT_VERSION,

  kind: "global-contract",
  source: "system",
  priority: "critical", // never dropped by the budget enforcer

  content: SYSTEM_PROMPT,
  estimatedTokens: estimateTokens(SYSTEM_PROMPT),

  stable: true,
  cacheable: true,
};
