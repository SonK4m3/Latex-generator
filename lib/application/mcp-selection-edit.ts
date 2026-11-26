import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getMcpDocument } from "./mcp-documents";
import { McpOperationError } from "./mcp-operation-error";
import { updateMcpSource, updateMcpSourceOutput } from "./mcp-update-source";

interface SelectionEditContext {
  supabase: SupabaseClient;
  userId: string;
  resourceUrl: string;
  signal: AbortSignal;
}

const MAX_TEXT = 100_000;
const MAX_ANCHOR = 256;

// Mirrors the project path grammar enforced by updateMcpSource.
const relativeFilePath = z.string().min(1).max(255).refine((path) =>
  path === path.trim() &&
  !path.startsWith("/") &&
  !path.includes("\\") &&
  !/[\u0000-\u001f\u007f]/.test(path) &&
  !/^[A-Za-z]:/.test(path) &&
  !path.split("/").some((part) => part === "" || part === "." || part === ".."),
"Use a safe relative POSIX path.");

export const mcpSelectionContextSchema = z.strictObject({
  schemaVersion: z.literal(1),
  documentId: z.uuid(),
  updatedAt: z.iso.datetime({ offset: true }),
  filePath: relativeFilePath,
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  selectedText: z.string().max(MAX_TEXT),
  prefix: z.string().max(MAX_ANCHOR),
  suffix: z.string().max(MAX_ANCHOR),
});

export const updateMcpSelectionInput = z.strictObject({
  selection: mcpSelectionContextSchema,
  replacement: z.string().max(MAX_TEXT),
});

export const updateMcpSelectionOutput = updateMcpSourceOutput.extend({
  filePath: relativeFilePath,
  changedRange: z.strictObject({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  }),
});

export type UpdateMcpSelectionInput = z.infer<typeof updateMcpSelectionInput>;
export type UpdateMcpSelectionOutput = z.infer<typeof updateMcpSelectionOutput>;

function staleSelection(): never {
  throw new McpOperationError(
    "version_conflict",
    "The document or selection context changed since it was captured. Read the latest source and select the text again.",
  );
}

/**
 * Replaces one exact source span. The selection carries a revision and small
 * anchors so a stale or shifted span is rejected before the CAS write.
 */
export async function updateMcpSelection(
  ctx: SelectionEditContext,
  input: UpdateMcpSelectionInput,
): Promise<UpdateMcpSelectionOutput> {
  const { selection, replacement } = input;
  const { document, source } = await getMcpDocument(ctx, selection.documentId, true);
  if (!source) {
    throw new McpOperationError("not_available", "The document source is temporarily unavailable.");
  }

  if (document.updatedAt !== selection.updatedAt) staleSelection();

  const files = source.files ?? [];
  const isProject = document.isProject;
  let filePath: string;
  let current: string;

  if (!isProject) {
    if (selection.filePath !== "main.tex") {
      throw new McpOperationError("invalid_input", "Single-file documents can only edit main.tex.");
    }
    filePath = "main.tex";
    current = source.latex;
  } else {
    const matches = files.filter((file) => file.path === selection.filePath);
    if (matches.length === 0) {
      throw new McpOperationError("invalid_input", "The selected file is not a readable text file in this project.");
    }
    if (matches.length > 1) {
      throw new McpOperationError("invalid_input", "The selected file path is ambiguous in this project.");
    }
    filePath = matches[0].path;
    const content = matches[0].content;
    if (typeof content !== "string") {
      throw new McpOperationError("invalid_input", "The selected project file is not readable text.");
    }
    current = content;
  }

  const { start, end } = selection;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > current.length) {
    throw new McpOperationError("invalid_input", "The selection range is out of bounds for this file.");
  }
  if (current.slice(start, end) !== selection.selectedText) staleSelection();
  if (
    selection.prefix.length > start ||
    current.slice(start - selection.prefix.length, start) !== selection.prefix
  ) staleSelection();
  if (current.slice(end, end + selection.suffix.length) !== selection.suffix) staleSelection();

  const updated = current.slice(0, start) + replacement + current.slice(end);
  if (!isProject && !updated.trim()) {
    throw new McpOperationError("invalid_input", "The edit would leave the single-file document empty.");
  }

  // expectedUpdatedAt was already proven equal to the freshly read revision;
  // updateMcpSource still enforces the final compare-and-swap atomically.
  const saved = isProject
    ? await updateMcpSource(ctx, {
      documentId: selection.documentId,
      expectedUpdatedAt: selection.updatedAt,
      files: [{ path: filePath, content: updated }],
    })
    : await updateMcpSource(ctx, {
      documentId: selection.documentId,
      expectedUpdatedAt: selection.updatedAt,
      latex: updated,
    });

  return {
    ...saved,
    filePath,
    changedRange: { start, end: start + replacement.length },
  };
}
