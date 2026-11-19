// lib/jobs/types.ts
// TypeScript contracts for the durable MCP compile RPCs in
// supabase/migrations/0005_mcp_compile_jobs.sql.
//
// The SQL functions return camelCase jsonb keys. Job input itself keeps the public document
// contract's camelCase fields (title/docType/template/latex/files/rootFile), matching
// lib/types/document.ts.
//
// Security notes:
// - McpCompileJobPublic deliberately has no source/input/lease fields; mcp_get_job must never
//   expose the job input snapshot.
// - McpClaimedJob is a service-role worker result and is the only job view that contains input.
// - Grants carry only token hashes over the wire; McpArtifactGrant never contains a raw token.

import type { DocType, ProjectFile, TemplateId } from "@/lib/types/document";

export type McpCompileJobStatus =
  | "queued"
  | "running"
  | "cancel_requested"
  | "succeeded"
  | "failed"
  | "cancelled";

/** Validated compile job input. Optional keys are omitted, not set to null. */
export interface McpCompileJobInput {
  title: string;
  docType: DocType;
  template?: TemplateId;
  latex?: string;
  files?: ProjectFile[];
  rootFile?: string;
}

/** Owner-safe projection returned by enqueue/get/cancel. Cannot carry source or lease data. */
export interface McpCompileJobPublic {
  id: string;
  status: McpCompileJobStatus;
  title: string;
  docType: DocType;
  template: TemplateId | null;
  attempts: number;
  documentId: string | null;
  artifactId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelRequestedAt: string | null;
}

export interface McpCompileQuota {
  limit: number;
  used: number;
  /** Never negative; 0 when the user is over a newly lowered limit. */
  remaining: number;
}

/** mcp_enqueue_compile result. Same key+hash+input is a free, non-charging replay. */
export interface McpEnqueueCompileResult {
  job: McpCompileJobPublic;
  reused: boolean;
  quota: McpCompileQuota;
}

/** mcp_claim_job result. Service-role only; includes the immutable input and fencing token. */
export interface McpClaimedJob {
  status: "running";
  jobId: string;
  ownerId: string;
  input: McpCompileJobInput;
  inputHash: string;
  attempts: number;
  maxAttempts: number;
  workerId: string;
  leaseToken: string;
  leaseExpiresAt: string;
  createdAt: string;
}

export type McpGetJobResult = McpCompileJobPublic | null;
export type McpCancelJobResult = McpCompileJobPublic | null;
export type McpClaimJobResult = McpClaimedJob | null;

/** mcp_finish_job result after an atomic, fenced terminal transition. */
export interface McpFinishJobResult {
  jobId: string;
  status: "succeeded" | "failed";
  documentId: string;
  artifactId: string | null;
  attempts: number;
  finishedAt: string;
}

export type McpArtifactFormat = "pdf" | "source";

/** mcp_create_artifact_grant result. The raw bearer token is never returned or stored. */
export interface McpArtifactGrant {
  grantId: string;
  artifactId: string;
  format: McpArtifactFormat;
  expiresAt: string;
}

export type McpCreateArtifactGrantResult = McpArtifactGrant | null;

/** mcp_redeem_artifact_grant result: the immutable artifact snapshot plus the grant format. */
export interface McpRedeemedArtifactGrant {
  artifactId: string;
  ownerId: string;
  jobId: string | null;
  documentId: string | null;
  format: McpArtifactFormat;
  sourceHash: string;
  source: McpCompileJobInput;
  /** Present only when format === "pdf". */
  pdfBase64: string | null;
  pdfBytes: number;
  log: string | null;
  createdAt: string;
  expiresAt: string;
}

export type McpRedeemArtifactGrantResult = McpRedeemedArtifactGrant | null;

/** mcp_cleanup_expired result. Counts are bounded by the requested batch size. */
export interface McpCleanupResult {
  expiredGrantsDeleted: number;
  artifactsDeleted: number;
  jobsDeleted: number;
}

/**
 * Stable SQL error messages raised by the job RPCs. Supabase surfaces these in
 * PostgRESTError.message; SQLSTATE is available in PostgRESTError.code.
 */
export type McpRpcErrorCode =
  | "not_authenticated"
  | "forbidden"
  | "invalid_idempotency_key"
  | "invalid_input_hash"
  | "invalid_input"
  | "idempotency_conflict"
  | "quota_exceeded"
  | "invalid_worker_id"
  | "invalid_lease_seconds"
  | "invalid_finish_arguments"
  | "invalid_pdf_base64"
  | "invalid_token_hash"
  | "invalid_format"
  | "invalid_batch_size"
  | "job_not_found"
  | "already_finished"
  | "job_cancelled"
  | "job_cancel_requested"
  | "job_not_running"
  | "stale_lease"
  | "lease_expired"
  | "duplicate_publication"
  | "missing_pdf"
  | "token_hash_conflict"
  | "job_identity_immutable"
  | "artifact_snapshot_immutable";

/** Shape of a Supabase/PostgREST RPC error for these functions. */
export interface McpRpcError {
  code: string;
  /** Usually McpRpcErrorCode, but other SQL/PostgREST messages can also surface here. */
  message: string;
  details: string | null;
  hint: string | null;
}

export const MCP_RPC_NAMES = {
  enqueueCompile: "mcp_enqueue_compile",
  getJob: "mcp_get_job",
  cancelJob: "mcp_cancel_job",
  claimJob: "mcp_claim_job",
  finishJob: "mcp_finish_job",
  createArtifactGrant: "mcp_create_artifact_grant",
  redeemArtifactGrant: "mcp_redeem_artifact_grant",
  cleanupExpired: "mcp_cleanup_expired",
} as const;

export type McpRpcName = (typeof MCP_RPC_NAMES)[keyof typeof MCP_RPC_NAMES];
