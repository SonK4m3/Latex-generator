import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { mapMcpStoreError, McpOperationError } from "./mcp-operation-error";

interface DocumentContext {
  supabase: SupabaseClient;
  userId: string;
  resourceUrl: string;
  signal: AbortSignal;
}

const SUMMARY_COLUMNS = "id,title,template,doc_type,has_pdf,is_project,created_at,updated_at";
const SOURCE_LIMIT = 100_000;

const summaryRow = z.object({
  id: z.uuid(),
  title: z.string(),
  template: z.string(),
  doc_type: z.string(),
  has_pdf: z.boolean(),
  is_project: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const documentSummarySchema = z.object({
  documentId: z.uuid(),
  title: z.string(),
  template: z.string(),
  docType: z.string(),
  hasPdf: z.boolean(),
  isProject: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  webUrl: z.url(),
});

const sourceFileSchema = z.object({ path: z.string(), content: z.string() });
export const documentSourceSchema = z.object({
  latex: z.string(),
  rootFile: z.string().nullable(),
  files: z.array(sourceFileSchema).nullable(),
});

const sourceRow = z.object({
  latex: z.string(),
  root_file: z.string().nullable(),
  files: z.array(z.object({ path: z.string(), content: z.string().optional() })).nullable(),
});

const cursorSchema = z.object({
  id: z.uuid(),
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/)
    .refine((value) => Number.isFinite(Date.parse(value))),
});

function readCursor(encoded: string) {
  try {
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(encoded)) throw new Error("Invalid encoding");
    return cursorSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  } catch {
    throw new McpOperationError("invalid_input", "Pass the nextCursor from the previous list_documents response.");
  }
}

export function getDocumentWebUrl(resourceUrl: string, documentId: string): string {
  return new URL(`/documents/${documentId}`, resourceUrl).href;
}

function toSummary(row: z.infer<typeof summaryRow>, resourceUrl: string) {
  return {
    documentId: row.id,
    title: row.title,
    template: row.template,
    docType: row.doc_type,
    hasPdf: row.has_pdf,
    isProject: row.is_project,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    webUrl: getDocumentWebUrl(resourceUrl, row.id),
  };
}

export async function listMcpDocuments(ctx: DocumentContext, limit: number, cursor?: string) {
  const position = cursor ? readCursor(cursor) : undefined;
  let query = ctx.supabase.from("documents").select(SUMMARY_COLUMNS).eq("owner_id", ctx.userId);
  if (position) {
    // Both interpolated values have been parsed with strict grammars before use.
    query = query.or(`updated_at.lt.${position.at},and(updated_at.eq.${position.at},id.lt.${position.id})`);
  }
  const { data, error } = await query.order("updated_at", { ascending: false })
    .order("id", { ascending: false }).limit(limit + 1).abortSignal(ctx.signal);
  if (error) mapMcpStoreError(error);
  const rows = z.array(summaryRow).parse(data);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    documents: page.map((row) => toSummary(row, ctx.resourceUrl)),
    nextCursor: last && rows.length > limit
      ? Buffer.from(JSON.stringify({ id: last.id, at: last.updated_at })).toString("base64url")
      : null,
  };
}

export async function getMcpDocument(ctx: DocumentContext, documentId: string, includeSource: boolean) {
  const columns = includeSource ? `${SUMMARY_COLUMNS},latex,root_file,files` : SUMMARY_COLUMNS;
  const { data, error } = await ctx.supabase.from("documents").select(columns)
    .eq("owner_id", ctx.userId).eq("id", documentId).abortSignal(ctx.signal).maybeSingle();
  if (error) mapMcpStoreError(error);
  if (!data) throw new McpOperationError("not_found", "The requested document is unavailable.");
  const document = toSummary(summaryRow.parse(data), ctx.resourceUrl);
  if (!includeSource) return { document };

  const row = sourceRow.parse(data);
  const source = {
    latex: row.latex,
    rootFile: row.root_file,
    // Binary attachments from existing web documents stay in the web workspace.
    files: row.files?.flatMap(({ path, content }) => content === undefined ? [] : [{ path, content }]) ?? null,
  };
  if (Buffer.byteLength(JSON.stringify(source)) > SOURCE_LIMIT) {
    throw new McpOperationError("source_too_large", "The source exceeds the tool response limit. Open the web document to view it.");
  }
  return { document, source };
}
