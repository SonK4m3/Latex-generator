// lib/document-blueprint/build-blueprint.ts
//
// Deterministic adapter: GenerateInput -> DocumentBlueprint (Level 1, no LLM).
//
// Populates only fields we can derive without a model. Fields that would require genuine request
// understanding (audience, inferredRequirements, meaningful ambiguity/confidence) are left at safe
// defaults — we do NOT fabricate them. A future LLM Request Understanding stage (E7) can fill the
// same shape without changing downstream consumers.

import type { GenerateInput } from "@/lib/ai/types";
import type { DocumentBlueprint, DocumentIntent, DocumentLanguage } from "./types";
import { resolveCapabilities } from "./resolve-capabilities";

export type BuildBlueprintOptions = {
  /** Correlation id from the route/logger. A uuid is generated when omitted. */
  requestId?: string;
};

/** Any Vietnamese-specific letter (diacritic or đ) ⇒ treat as Vietnamese. */
const VI_MARKER = /[ăâđêôơư]|[\u0300-\u036f]/;

function detectLanguage(description: string): DocumentLanguage {
  const decomposed = description.normalize("NFD");
  return VI_MARKER.test(decomposed.toLowerCase()) || /đ/.test(description) ? "vi" : "en";
}

/** Short topic string derived from the first non-empty line of the description. */
function deriveTopic(description: string): string {
  const firstLine = description
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0) ?? "";
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}

function intentOf(input: GenerateInput): DocumentIntent {
  if (input.errorContext) return "repair";
  if (input.editContext) return "edit";
  return "create";
}

function newRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildBlueprint(
  input: GenerateInput,
  opts: BuildBlueprintOptions = {},
): DocumentBlueprint {
  const description = (input.description ?? "").trim();
  const templateId = input.template ?? "";

  return {
    requestId: opts.requestId ?? newRequestId(),
    intent: intentOf(input),
    templateId,
    topic: deriveTopic(description),
    language: detectLanguage(description),
    depth: "standard",
    capabilities: resolveCapabilities(description, templateId),
    explicitRequirements: [],
    inferredRequirements: [],
    generationMode: "single-shot",
    ambiguity: "low",
    confidence: 1,
  };
}
