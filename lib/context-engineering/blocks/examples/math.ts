// lib/context-engineering/blocks/examples/math.ts
//
// example blocks for `math` — illustrative snippets. Priority "low": these are the first to be
// dropped under budget pressure (an example is the safest thing to shed). Each is gated by the same
// capability as its guidance, so a matrix request gets the matrix example, not the theorem one.
// theorem/align examples are carved from math.promptGuidance; the matrix example is NEW (the legacy
// prompt had no dedicated matrix example).

import type { ContextBlock } from "@/lib/context-engineering/types";
import { estimateTokens } from "@/lib/context-engineering/budget/estimate-tokens";
import { CAP } from "@/lib/document-blueprint/capabilities";

const THEOREM_EXAMPLE = [
  '<example name="theorem-proof">',
  "\\begin{theorem}\\label{thm:ftc}",
  "For $f \\in C^1([a,b])$, $\\int_a^b f'(x)\\,dx = f(b)-f(a)$.",
  "\\end{theorem}",
  "\\begin{proof}",
  "By the definition of the Riemann integral and continuity of $f'$.",
  "\\end{proof}",
  "</example>",
].join("\n");

const ALIGN_EXAMPLE = [
  '<example name="align-and-cases">',
  "\\begin{align}",
  "(x+1)^2 &= x^2 + 2x + 1 \\\\",
  "        &= x(x+2) + 1.",
  "\\end{align}",
  "\\[ f(x) = \\begin{cases} x^2 & x \\ge 0, \\\\ -x & x < 0. \\end{cases} \\]",
  "</example>",
].join("\n");

const MATRIX_EXAMPLE = [
  '<example name="matrix">',
  "Dimensions must match: an $m\\times n$ matrix times an $n\\times p$ matrix gives $m\\times p$.",
  "\\[",
  "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}",
  "\\begin{pmatrix} 5 & 6 \\\\ 7 & 8 \\end{pmatrix}",
  "=",
  "\\begin{pmatrix} 19 & 22 \\\\ 43 & 50 \\end{pmatrix}.",
  "\\]",
  "</example>",
].join("\n");

export const mathExTheorem: ContextBlock = {
  id: "math-ex-theorem",
  version: "1.0.0",
  kind: "example",
  source: "template",
  priority: "low",
  content: THEOREM_EXAMPLE,
  estimatedTokens: estimateTokens(THEOREM_EXAMPLE),
  stable: true,
  cacheable: true,
  appliesToTemplates: ["math"],
  requiredCapabilities: [CAP.THEOREM],
};

export const mathExAlign: ContextBlock = {
  id: "math-ex-align",
  version: "1.0.0",
  kind: "example",
  source: "template",
  priority: "low",
  content: ALIGN_EXAMPLE,
  estimatedTokens: estimateTokens(ALIGN_EXAMPLE),
  stable: true,
  cacheable: true,
  appliesToTemplates: ["math"],
  requiredCapabilities: [CAP.ADVANCED_MATH],
};

export const mathExMatrix: ContextBlock = {
  id: "math-ex-matrix",
  version: "1.0.0",
  kind: "example",
  source: "template",
  priority: "low",
  content: MATRIX_EXAMPLE,
  estimatedTokens: estimateTokens(MATRIX_EXAMPLE),
  stable: true,
  cacheable: true,
  appliesToTemplates: ["math"],
  requiredCapabilities: [CAP.MATRIX],
};
