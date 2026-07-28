// lib/context-engineering/renderer/render-prompt.ts
//
// Renderer — turns ORDERED blocks into a neutral RenderedPrompt { system, user }.
// Intentionally NOT ModelMessage[] (keeps the engine provider-agnostic; VercelAiProvider maps this
// onto the SDK). Blocks are placed by their `source`:
//   system | template → system message (stable contract the model should always honor)
//   user   | runtime  → user message   (this request's data)
// Input MUST already be ordered by orderContextBlocks — this function preserves incoming order.

import type { ContextBlock, RenderedPrompt } from "@/lib/context-engineering/types";

const SYSTEM_SOURCES: ReadonlySet<ContextBlock["source"]> = new Set(["system", "template"]);

export function renderPrompt(orderedBlocks: ContextBlock[]): RenderedPrompt {
  const system: string[] = [];
  const user: string[] = [];

  for (const block of orderedBlocks) {
    (SYSTEM_SOURCES.has(block.source) ? system : user).push(block.content);
  }

  return {
    system: system.join("\n\n"),
    user: user.join("\n\n"),
  };
}
