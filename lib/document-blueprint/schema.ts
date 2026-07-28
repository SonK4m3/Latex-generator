// lib/document-blueprint/schema.ts
//
// Zod schema mirroring DocumentBlueprint (types.ts). Used to validate blueprints in tests and at
// any future boundary where a blueprint arrives from outside the deterministic adapter.

import { z } from "zod";

export const DocumentIntentSchema = z.enum(["create", "edit", "repair", "extend"]);
export const DocumentDepthSchema = z.enum(["brief", "standard", "detailed"]);
export const DocumentLanguageSchema = z.enum(["vi", "en"]);
export const GenerationModeSchema = z.enum(["single-shot", "section-by-section"]);
export const AmbiguityLevelSchema = z.enum(["low", "medium", "high"]);

export const DocumentBlueprintSchema = z.object({
  requestId: z.string().min(1),

  intent: DocumentIntentSchema,
  templateId: z.string().min(1),
  topic: z.string(),

  language: DocumentLanguageSchema,
  audience: z.string().optional(),
  depth: DocumentDepthSchema,

  capabilities: z.array(z.string()),

  explicitRequirements: z.array(z.string()),
  inferredRequirements: z.array(z.string()),

  generationMode: GenerationModeSchema,

  ambiguity: AmbiguityLevelSchema,
  confidence: z.number().min(0).max(1),
});

export type DocumentBlueprintFromSchema = z.infer<typeof DocumentBlueprintSchema>;
