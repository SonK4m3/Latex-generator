// lib/context-engineering/blocks/templates/math-base.ts
//
// template block for `math` — always selected for math requests (no requiredCapabilities).
// Holds the guidance that applies to EVERY math document regardless of which capabilities the
// specific request needs: type, the preamble contract (theorem envs are pre-declared), document
// structure, required packages, cross-reference/diagram alternatives, and label discipline.
// Text carved faithfully from lib/templates/registry.ts (math.promptGuidance).

import type { ContextBlock } from "@/lib/context-engineering/types";
import { estimateTokens } from "@/lib/context-engineering/budget/estimate-tokens";

const CONTENT = [
  '<template_guidance name="math">',
  "TYPE: Mathematics document — theorems, proofs, and formal mathematical exposition (article class).",
  "",
  "Preamble contract: The following theorem environments are PRE-DECLARED by the template.",
  "Use them directly — do NOT add \\newtheorem{} in the generated document:",
  "  theorem, lemma, corollary, proposition (share counter),",
  "  definition, example (definition style),",
  "  remark (unnumbered, remark style),",
  "  proof (from amsthm — always ends with \\qed automatically).",
  "",
  "Structure: \\maketitle → \\section{} → definitions → lemmas → main theorems",
  "→ \\begin{proof}...\\end{proof} → corollaries → \\section{} for new topic.",
  "Interleave explanatory prose between formal statements.",
  "",
  "Required packages: amsmath (align/gather/cases/multline), amssymb (\\mathbb{}/\\mathcal{}/",
  "\\leq/\\geq/\\subset/\\forall/\\exists), amsthm (theorem environments),",
  "mathtools (\\coloneqq/\\underbracket/\\prescript).",
  "",
  "Cross-references: use plain \\label{} + \\ref{}/\\eqref{} — no hyperref needed.",
  "Numbers resolve correctly without clickable links; this is standard and expected output.",
  "Diagrams: this template has no TikZ. Represent mathematical relationships with equation,",
  "cases, pmatrix/bmatrix/vmatrix, or a table (tabular, already available via base LaTeX) —",
  "whichever preserves the mathematical meaning best. Do not attempt to draw a picture.",
  "",
  "Label discipline:",
  "  Use \\label{eq:name} on equations only when they will be referenced with \\eqref{}.",
  "  Use \\label{thm:name} on theorems only when referenced with \\ref{}.",
  "  Every \\ref{} and \\eqref{} MUST resolve to an existing \\label{}.",
  "  Do NOT duplicate label values anywhere in the document.",
  "</template_guidance>",
].join("\n");

export const mathBase: ContextBlock = {
  id: "math-base",
  version: "1.0.0",

  kind: "template",
  source: "template",
  priority: "high",

  content: CONTENT,
  estimatedTokens: estimateTokens(CONTENT),

  stable: true,
  cacheable: true,

  appliesToTemplates: ["math"],
};
