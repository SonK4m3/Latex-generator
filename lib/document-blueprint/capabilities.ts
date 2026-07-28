// lib/document-blueprint/capabilities.ts
//
// Capability vocabulary for deterministic (no-LLM) request understanding at Level 1.
//
// A "capability" is a fine-grained, request-selectable feature (e.g. "matrix", "theorem"). It is
// distinct from the coarse per-template boolean `TemplateCapabilities` in lib/templates/registry.ts
// (which declares what a template CAN do). Here we resolve which capabilities THIS request needs.
//
// This module is dependency-free (no imports from context-engineering) so the dependency direction
// stays one-way: context-engineering blocks import these constants, not the reverse.

export const CAP = {
  ADVANCED_MATH: "advanced-math",
  THEOREM: "theorem",
  MATRIX: "matrix",
} as const;

export type CapabilityId = (typeof CAP)[keyof typeof CAP];

/**
 * The capability superset each template supports. resolveCapabilities() intersects keyword matches
 * with this list, and falls back to the whole list when no keyword matches (never under-select).
 * Adding a new template here + authoring its blocks is all it takes to extend coverage.
 */
export const TEMPLATE_DECLARED_CAPABILITIES: Record<string, string[]> = {
  math: [CAP.ADVANCED_MATH, CAP.THEOREM, CAP.MATRIX],
};

export type CapabilityKeywordGroup = {
  /** Capabilities implied when any pattern matches. */
  implies: string[];
  /** Diacritic-folded, lowercase substrings to look for in the (folded) description. */
  patterns: string[];
};

/**
 * Keyword → capability groups. Patterns are stored diacritic-folded + lowercase; matching folds the
 * description the same way (foldText), so both "ma trận" and "ma tran" match. Intentionally small
 * and auditable — this is a heuristic, not an NLP model.
 */
export const CAPABILITY_KEYWORD_GROUPS: CapabilityKeywordGroup[] = [
  {
    // Matrices imply advanced math (aligned multi-step work).
    implies: [CAP.MATRIX, CAP.ADVANCED_MATH],
    patterns: ["ma tran", "matrix", "matrices", "pmatrix", "bmatrix", "vmatrix", "dinh thuc", "determinant"],
  },
  {
    implies: [CAP.THEOREM],
    patterns: [
      "dinh ly", "bo de", "chung minh", "theorem", "lemma", "proof",
      "he qua", "corollary", "menh de", "proposition", "dinh nghia", "definition", "qed",
    ],
  },
  {
    implies: [CAP.ADVANCED_MATH],
    patterns: [
      "phuong trinh", "equation", "tich phan", "integral", "dao ham", "derivative",
      "he phuong trinh", "align", "chuoi", "series", "gioi han", "limit", "khai trien",
    ],
  },
];

/**
 * Diacritic-insensitive fold: lowercase, strip combining marks (NFD), map đ→d.
 * Makes keyword matching robust to accented vs unaccented Vietnamese input.
 */
export function foldText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}
