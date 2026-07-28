// lib/context-engineering/blocks/output-contracts/latex-output.ts
//
// output-contract — what a good final answer looks like (completeness, expansion, language).
// Carved faithfully from buildGeneratePrompt()'s <output_requirements> so the model receives the
// same completeness contract as before. source:"system" ⇒ rendered into the system message (stable
// contract), which is a small, intentional reorganization vs. the legacy prompt (where it sat at
// the end of the user prompt). Content is unchanged.

import type { ContextBlock } from "@/lib/context-engineering/types";
import { estimateTokens } from "@/lib/context-engineering/budget/estimate-tokens";

const CONTENT = [
  "<output_requirements>",
  "- Write a COMPLETE, DETAILED, and COHERENT document — not a bare skeleton.",
  "- If the description is short or vague, PROACTIVELY expand it: add context, concrete examples,",
  "  illustrative figures/data, and relevant analysis (label as illustrative if fabricated).",
  "- If SOURCE MATERIAL is provided, SYNTHESIZE and develop content from it; preserve factual accuracy.",
  "- Each section/chapter should contain MULTIPLE substantive paragraphs; use lists, tables (tabular),",
  "  and formulas where appropriate for the subject.",
  "- Write in the language of the description (Vietnamese if the description is in Vietnamese).",
  "- Generate the full document all the way to \\end{document} — do NOT truncate.",
  "</output_requirements>",
].join("\n");

export const latexOutputContract: ContextBlock = {
  id: "latex-output-contract",
  version: "1.0.0",

  kind: "output-contract",
  source: "system",
  priority: "high",

  content: CONTENT,
  estimatedTokens: estimateTokens(CONTENT),

  stable: true,
  cacheable: true,
};
