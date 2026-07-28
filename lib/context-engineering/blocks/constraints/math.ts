// lib/context-engineering/blocks/constraints/math.ts
//
// constraint block for `math` — the hard "must not" rules. Priority "critical": the budget enforcer
// never drops this (dropping constraints would produce non-compiling / out-of-allowlist output).
// Text carved faithfully from lib/templates/registry.ts (math.promptGuidance FORBIDDEN section).

import type { ContextBlock } from "@/lib/context-engineering/types";
import { estimateTokens } from "@/lib/context-engineering/budget/estimate-tokens";

const CONTENT = [
  '<constraints name="math">',
  "FORBIDDEN: $$ ... $$ display math — use \\[ ... \\] instead.",
  "FORBIDDEN: \\newtheorem{} in the document body — all environments are pre-declared.",
  "FORBIDDEN: \\begin{proof} without a preceding theorem/lemma/proposition.",
  "FORBIDDEN: \\ref{} or \\eqref{} pointing to a label not defined in the document.",
  "FORBIDDEN: packages outside the allowlist (no tikz, hyperref, listings).",
  "FORBIDDEN: \\setmainfont or \\babelfont.",
  "</constraints>",
].join("\n");

export const mathConstraints: ContextBlock = {
  id: "math-constraints",
  version: "1.0.0",

  kind: "constraint",
  source: "template",
  priority: "critical",

  content: CONTENT,
  estimatedTokens: estimateTokens(CONTENT),

  stable: true,
  cacheable: true,

  appliesToTemplates: ["math"],
};
