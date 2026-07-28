// lib/document-blueprint/types.ts
//
// DocumentBlueprint — the normalized request object the Context Engine consumes.
//
// The context selector must NOT read the raw user prompt directly; it reads a DocumentBlueprint.
// At Level 1 this is produced by a DETERMINISTIC adapter (build-blueprint.ts) from GenerateInput —
// no LLM. Fields that would need genuine request-understanding (audience, depth, inferred
// requirements, ambiguity) are left at safe defaults rather than fabricated. The full shape is kept
// so a future LLM-backed Request Understanding stage (E7) can populate the same object.

export type DocumentIntent = "create" | "edit" | "repair" | "extend";
export type DocumentDepth = "brief" | "standard" | "detailed";
export type DocumentLanguage = "vi" | "en";
export type GenerationMode = "single-shot" | "section-by-section";
export type AmbiguityLevel = "low" | "medium" | "high";

export type DocumentBlueprint = {
  requestId: string;

  intent: DocumentIntent;
  templateId: string;
  topic: string;

  language: DocumentLanguage;
  audience?: string;
  depth: DocumentDepth;

  /** Deterministically resolved capability ids (e.g. "matrix", "theorem", "advanced-math"). */
  capabilities: string[];

  explicitRequirements: string[];
  inferredRequirements: string[];

  generationMode: GenerationMode;

  ambiguity: AmbiguityLevel;
  /** 0–1. At Level 1 this reflects the deterministic adapter, NOT an LLM confidence. */
  confidence: number;
};
