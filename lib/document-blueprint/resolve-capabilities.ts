// lib/document-blueprint/resolve-capabilities.ts
//
// Deterministic capability resolver (Level 1 — no LLM). Given a raw description + templateId,
// returns the capability ids relevant to THIS request.
//
// Rules:
//   1. Only capabilities the template declares are ever returned (intersect with declared set).
//   2. Output order is deterministic (declared order).
//   3. SAFETY: if no keyword matches, return the full declared superset — never under-select, so a
//      vague request still gets complete guidance (behaves like the pre-pipeline prompt).

import {
  CAPABILITY_KEYWORD_GROUPS,
  TEMPLATE_DECLARED_CAPABILITIES,
  foldText,
} from "./capabilities";

export function resolveCapabilities(description: string, templateId: string): string[] {
  const declared = TEMPLATE_DECLARED_CAPABILITIES[templateId] ?? [];
  if (declared.length === 0) return [];

  const text = foldText(description ?? "");
  const matched = new Set<string>();

  if (text.trim().length > 0) {
    for (const group of CAPABILITY_KEYWORD_GROUPS) {
      if (group.patterns.some((p) => text.includes(p))) {
        for (const cap of group.implies) matched.add(cap);
      }
    }
  }

  // Preserve declared order for determinism.
  const narrowed = declared.filter((c) => matched.has(c));

  // No positive signal ⇒ full template superset (safety: never send a bare prompt).
  return narrowed.length > 0 ? narrowed : [...declared];
}
