// lib/context-engineering/blocks/capabilities/math.ts
//
// capability blocks for `math` — selected ONLY when the resolved blueprint includes the matching
// capability. This is what makes selection meaningful: a "matrix multiplication" request pulls
// math-cap-matrix (+ advanced-math) but NOT math-cap-theorem.
// Text carved faithfully from lib/templates/registry.ts (math.promptGuidance).

import type { ContextBlock } from "@/lib/context-engineering/types";
import { estimateTokens } from "@/lib/context-engineering/budget/estimate-tokens";
import { CAP } from "@/lib/document-blueprint/capabilities";

const ADVANCED_MATH_CONTENT = [
  '<capability name="advanced-math">',
  "Environment selection rules:",
  "  inline $...$: short expressions embedded in prose.",
  "  \\[ ... \\]: standalone important expression (no number needed).",
  "  equation: single expression that will be referenced with \\eqref{}.",
  "  align: multi-step derivation — align around = or \\iff; each row except last ends with \\\\.",
  "  gather: multiple related expressions not needing alignment.",
  "  cases: piecewise definitions — one \\\\-terminated row per case.",
  "</capability>",
].join("\n");

const MATRIX_CONTENT = [
  '<capability name="matrix">',
  "Matrices: use pmatrix/bmatrix/vmatrix (amsmath) — choose the delimiter by mathematical meaning",
  "(pmatrix = parentheses, bmatrix = brackets, vmatrix = determinant bars).",
  "State the dimension-compatibility rule before multiplying matrices.",
  "Use an align environment for multi-step matrix calculations so steps line up.",
  "</capability>",
].join("\n");

const THEOREM_CONTENT = [
  '<capability name="theorem">',
  "Theorem environments (pre-declared — use as-is): theorem, lemma, corollary, proposition,",
  "definition, example, remark, proof. Do NOT \\newtheorem{} in the body.",
  "Proof quality:",
  "  State all necessary assumptions before the proof begins.",
  "  Maintain logical order — do not skip steps without explanation.",
  "  Do NOT use 'obviously', 'clearly', or 'trivially' for non-trivial steps.",
  "  End proofs inside \\begin{proof}...\\end{proof} — \\qed is automatic.",
  "</capability>",
].join("\n");

export const mathAdvancedMath: ContextBlock = {
  id: "math-cap-advanced-math",
  version: "1.0.0",
  kind: "capability",
  source: "template",
  priority: "high",
  content: ADVANCED_MATH_CONTENT,
  estimatedTokens: estimateTokens(ADVANCED_MATH_CONTENT),
  stable: true,
  cacheable: true,
  appliesToTemplates: ["math"],
  requiredCapabilities: [CAP.ADVANCED_MATH],
};

export const mathMatrix: ContextBlock = {
  id: "math-cap-matrix",
  version: "1.0.0",
  kind: "capability",
  source: "template",
  priority: "medium",
  content: MATRIX_CONTENT,
  estimatedTokens: estimateTokens(MATRIX_CONTENT),
  stable: true,
  cacheable: true,
  appliesToTemplates: ["math"],
  requiredCapabilities: [CAP.MATRIX],
};

export const mathTheorem: ContextBlock = {
  id: "math-cap-theorem",
  version: "1.0.0",
  kind: "capability",
  source: "template",
  priority: "high",
  content: THEOREM_CONTENT,
  estimatedTokens: estimateTokens(THEOREM_CONTENT),
  stable: true,
  cacheable: true,
  appliesToTemplates: ["math"],
  requiredCapabilities: [CAP.THEOREM],
};
