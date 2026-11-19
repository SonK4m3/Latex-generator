import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getDocumentWebUrl } from "./mcp-documents";
import { normalizeCompileInput, type CompileDocumentInput } from "./input-schema";
import { mapMcpStoreError, McpOperationError } from "./mcp-operation-error";

interface JobContext {
  supabase: SupabaseClient;
  resourceUrl: string;
  signal: AbortSignal;
}

const statusSchema = z.enum(["queued", "running", "cancel_requested", "succeeded", "failed", "cancelled"]);
const jobRow = z.object({
  id: z.uuid(),
  status: statusSchema,
  title: z.string(),
  docType: z.enum(["article", "report"]),
  template: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  attempts: z.number().int().nonnegative(),
  documentId: z.uuid().nullish(),
  artifactId: z.uuid().nullish(),
  error: z.string().nullish(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  cancelRequestedAt: z.string().nullable(),
});

export const jobResultSchema = z.object({
  jobId: z.uuid(),
  status: statusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  attempts: z.number().int().nonnegative(),
  documentId: z.uuid().nullable(),
  artifactId: z.uuid().nullable(),
  error: z.string().nullable(),
  webUrl: z.url().nullable(),
});

function toJobResult(value: unknown, resourceUrl: string) {
  if (value === null) throw new McpOperationError("not_found", "The requested job is unavailable.");
  const row = jobRow.parse(value);
  return {
    jobId: row.id,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attempts: row.attempts,
    documentId: row.documentId ?? null,
    artifactId: row.artifactId ?? null,
    error: row.error?.slice(0, 4000) ?? null,
    webUrl: row.documentId ? getDocumentWebUrl(resourceUrl, row.documentId) : null,
  };
}

export async function enqueueMcpCompile(ctx: JobContext, raw: CompileDocumentInput) {
  let normalized: ReturnType<typeof normalizeCompileInput>;
  try {
    normalized = normalizeCompileInput(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpOperationError("invalid_input", "The request data is invalid.");
    }
    throw error;
  }
  const { idempotencyKey, input } = normalized;
  const { data, error } = await ctx.supabase.rpc("mcp_enqueue_compile", {
    p_input: input,
    p_input_hash: createHash("sha256").update(JSON.stringify(input)).digest("hex"),
    p_idempotency_key: idempotencyKey,
  }).abortSignal(ctx.signal);
  if (error) mapMcpStoreError(error);
  if (!data || typeof data !== "object" || !("job" in data)) {
    throw new McpOperationError("not_available", "The document service is temporarily unavailable.");
  }
  return toJobResult(data.job, ctx.resourceUrl);
}

export async function getMcpJob(ctx: JobContext, jobId: string) {
  const { data, error } = await ctx.supabase.rpc("mcp_get_job", { p_job_id: jobId }).abortSignal(ctx.signal);
  if (error) mapMcpStoreError(error);
  return toJobResult(data, ctx.resourceUrl);
}

export async function cancelMcpJob(ctx: JobContext, jobId: string) {
  const { data, error } = await ctx.supabase.rpc("mcp_cancel_job", { p_job_id: jobId }).abortSignal(ctx.signal);
  if (error) mapMcpStoreError(error);
  return toJobResult(data, ctx.resourceUrl);
}

export const artifactFormatSchema = z.enum(["pdf", "tex"]);
const grantRow = z.object({ expiresAt: z.string(), documentId: z.uuid().nullish() });

export async function createMcpArtifactGrant(ctx: JobContext, artifactId: string, format: z.infer<typeof artifactFormatSchema>) {
  const token = randomBytes(32).toString("hex");
  const { data, error } = await ctx.supabase.rpc("mcp_create_artifact_grant", {
    p_artifact_id: artifactId,
    p_token_hash: createHash("sha256").update(token).digest("hex"),
    p_format: format === "tex" ? "source" : "pdf",
  }).abortSignal(ctx.signal);
  if (error) mapMcpStoreError(error);
  if (!data) throw new McpOperationError("not_found", "The requested artifact is unavailable.");
  const grant = grantRow.parse(data);
  return {
    artifactId,
    format,
    downloadUrl: new URL(`/api/artifacts/${token}`, ctx.resourceUrl).href,
    expiresAt: grant.expiresAt,
    webUrl: grant.documentId ? getDocumentWebUrl(ctx.resourceUrl, grant.documentId) : null,
  };
}
