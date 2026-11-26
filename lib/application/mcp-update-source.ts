import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getDocumentWebUrl } from "./mcp-documents";
import { McpOperationError, mapMcpStoreError } from "./mcp-operation-error";

const safeProjectPath = z.string().min(1).max(255).refine((path) =>
  path === path.trim() &&
  !path.startsWith("/") &&
  !path.includes("\\") &&
  !/[\u0000-\u001f\u007f]/.test(path) &&
  !/^[A-Za-z]:/.test(path) &&
  !path.split("/").some((part) => part === "" || part === "." || part === ".."),
"Use a safe relative POSIX path.");

const sourcePatch = z.strictObject({
  path: safeProjectPath,
  content: z.string().refine((content) => !content.includes("\0"), "Text content cannot contain NUL bytes."),
});
const MAX_SOURCE_BYTES = 100_000;

export const updateMcpSourceInput = z.strictObject({
  documentId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  latex: z.string().min(1).max(MAX_SOURCE_BYTES).optional(),
  files: z.array(sourcePatch).min(1).max(100).optional(),
}).superRefine((input, ctx) => {
  if ((input.latex === undefined) === (input.files === undefined)) {
    ctx.addIssue({ code: "custom", message: "Provide either latex or files text patches." });
  }
  if (input.latex !== undefined && !input.latex.trim()) {
    ctx.addIssue({ code: "custom", path: ["latex"], message: "LaTeX must not be empty." });
  }
  if (input.files) {
    const seen = new Set<string>();
    let totalBytes = 0;
    for (const [index, file] of input.files.entries()) {
      if (seen.has(file.path)) {
        ctx.addIssue({ code: "custom", path: ["files", index, "path"], message: "File paths must be unique." });
      }
      seen.add(file.path);
      totalBytes += Buffer.byteLength(file.content, "utf8");
    }
    if (totalBytes > MAX_SOURCE_BYTES) {
      ctx.addIssue({ code: "custom", path: ["files"], message: "Text patches exceed 100 KB." });
    }
  }
});

const savedSource = z.object({ documentId: z.uuid(), updatedAt: z.string() });
export const updateMcpSourceOutput = savedSource.extend({ webUrl: z.url() });

export async function updateMcpSource(
  ctx: { supabase: SupabaseClient; resourceUrl: string; signal: AbortSignal },
  input: z.infer<typeof updateMcpSourceInput>,
) {
  if (input.latex !== undefined && (!input.latex.trim() || Buffer.byteLength(input.latex, "utf8") > MAX_SOURCE_BYTES)) {
    throw new McpOperationError("invalid_input", "LaTeX must be non-empty and at most 100 KB.");
  }
  const isProjectPatch = input.files !== undefined;
  const { data, error } = isProjectPatch
    ? await ctx.supabase.rpc("mcp_update_document_project_text", {
      p_document_id: input.documentId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_files: input.files,
    }).abortSignal(ctx.signal)
    : await ctx.supabase.rpc("mcp_update_document_source", {
      p_document_id: input.documentId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_latex: input.latex,
    }).abortSignal(ctx.signal);
  if (error?.code === "PT409") {
    throw new McpOperationError("version_conflict", "The document changed. Read its latest source and ask before overwriting another edit.");
  }
  if (error?.code === "PT422") {
    throw new McpOperationError("invalid_input", isProjectPatch
      ? "Only existing readable text files in a project can be edited; binary files and project structure are preserved."
      : "This operation requires a single-file LaTeX document and valid source.");
  }
  if (error) mapMcpStoreError(error);
  if (!data) throw new McpOperationError("not_found", "The requested document is unavailable.");
  const saved = savedSource.parse(data);
  return { ...saved, webUrl: getDocumentWebUrl(ctx.resourceUrl, saved.documentId) };
}
