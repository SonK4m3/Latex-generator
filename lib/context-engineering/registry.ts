// lib/context-engineering/registry.ts
//
// Context Registry — the single source of STATIC context blocks the selector chooses from.
// A plain TypeScript array (no database at Level 1): type-safe, versioned in Git, reviewable in PRs,
// trivially testable. Dynamic per-request blocks (request-blueprint, sources) are NOT here — they
// are built at runtime (runtime/build-runtime-blocks.ts) and merged into the pipeline.
//
// To extend coverage to another template: author its blocks + add them here + declare its
// capabilities in lib/document-blueprint/capabilities.ts.

import type { ContextBlock } from "@/lib/context-engineering/types";

import { globalLatexContract } from "@/lib/context-engineering/blocks/global/latex-contract";
import { latexOutputContract } from "@/lib/context-engineering/blocks/output-contracts/latex-output";
import { mathBase } from "@/lib/context-engineering/blocks/templates/math-base";
import {
  mathAdvancedMath,
  mathMatrix,
  mathTheorem,
} from "@/lib/context-engineering/blocks/capabilities/math";
import { mathConstraints } from "@/lib/context-engineering/blocks/constraints/math";
import {
  mathExTheorem,
  mathExAlign,
  mathExMatrix,
} from "@/lib/context-engineering/blocks/examples/math";

export const contextRegistry: ContextBlock[] = [
  // Global (all templates)
  globalLatexContract,
  latexOutputContract,

  // Math template
  mathBase,
  mathConstraints,
  mathAdvancedMath,
  mathMatrix,
  mathTheorem,
  mathExTheorem,
  mathExAlign,
  mathExMatrix,
];

/** Convenience: does the registry have any template-specific coverage for this templateId? */
export function hasTemplateCoverage(templateId: string): boolean {
  return contextRegistry.some((b) => b.appliesToTemplates?.includes(templateId));
}
