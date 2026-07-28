// lib/context-engineering/runtime/build-runtime-blocks.ts
//
// Runtime (per-request) blocks. Unlike registry blocks these are BUILT per request, but they flow
// through the SAME select → order → budget → render pipeline so budget and trace cover them too
// (this is the point of "everything is a block": the biggest variable input — uploaded sources —
// must be inside the pipeline, not bypassing it).

import type { ContextBlock } from "@/lib/context-engineering/types";
import type { DocumentBlueprint } from "@/lib/document-blueprint/types";
import { estimateTokens } from "@/lib/context-engineering/budget/estimate-tokens";
import { buildSourcesBlock } from "@/lib/ai/prompts/sources";
import type { SourceFile, RetrievedChunk } from "@/lib/types/document";

/**
 * request-blueprint block — the actual user request plus a curated, low-noise summary of the
 * blueprint (not the full JSON: requestId/confidence/etc. are internal and not useful to the model).
 * Priority "critical": the request itself must never be dropped. source "user" ⇒ user message.
 */
export function buildRequestBlueprintBlock(
  blueprint: DocumentBlueprint,
  description: string,
): ContextBlock {
  const hasDescription = description.trim().length > 0;
  const content = [
    "<document_blueprint>",
    `template: ${blueprint.templateId}`,
    blueprint.topic ? `topic: ${blueprint.topic}` : "",
    `language: ${blueprint.language}`,
    blueprint.capabilities.length > 0
      ? `capabilities: ${blueprint.capabilities.join(", ")}`
      : "",
    "</document_blueprint>",
    "",
    "<user_request>",
    hasDescription
      ? description
      : "(no description provided — base the document on the source material below)",
    "</user_request>",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    id: "runtime-request-blueprint",
    version: "1.0.0",
    kind: "request-blueprint",
    source: "user",
    priority: "critical",
    content,
    estimatedTokens: estimateTokens(content),
    stable: false,
    cacheable: false,
  };
}

/**
 * sources runtime block — wraps uploaded sources (or RAG chunks) using the existing, injection-
 * resistant builder (security note + per-file char budget). Returns null when there are no sources.
 * Priority "high": droppable under budget pressure, but only after examples (low) / capability
 * (medium). source "user" ⇒ user message.
 */
export function buildSourcesRuntimeBlock(
  sources: SourceFile[] | undefined,
  retrievedSources: RetrievedChunk[] | undefined,
): ContextBlock | null {
  const content = buildSourcesBlock(sources, retrievedSources).trim();
  if (content.length === 0) return null;

  return {
    id: "runtime-sources",
    version: "1.0.0",
    kind: "runtime-state",
    source: "user",
    priority: "high",
    content,
    estimatedTokens: estimateTokens(content),
    stable: false,
    cacheable: false,
  };
}
