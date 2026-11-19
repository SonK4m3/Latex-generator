import type { SupabaseClient } from "@supabase/supabase-js";
import { compileLatex, compileProject } from "@/lib/compile/client";
import { getConfig } from "@/lib/config";
import { validateLatex } from "@/lib/validation/validate";
import { getTemplate } from "@/lib/templates/registry";
import type { McpClaimJobResult } from "./types";

/** One lease per process: retries are owned by the database, never an in-memory queue. */
export async function processNextCompileJob(db: SupabaseClient, workerId: string): Promise<boolean> {
  const cfg = getConfig();
  const leaseSeconds = Math.ceil(cfg.requestTimeoutMs / 1000) + 60;
  const { data, error } = await db.rpc("mcp_claim_job", {
    p_worker_id: workerId, p_lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(`Job claim failed (${error.code})`);
  const job = data as McpClaimJobResult;
  if (!job?.jobId) return false;
  let pdf: string | null = null;
  let diagnostic: string | null = null;
  try {
    const input = job.input;
    // A project can split environments across files. Validate the complete single-file
    // source here; the compiler owns cross-file syntax and path validation for projects.
    if (input.latex !== undefined) {
      const validation = validateLatex(input.latex, input.template
        ? { packageAllowlist: getTemplate(input.template).packageAllowlist }
        : undefined);
      if (!validation.ok) throw new Error(validation.diagnostics.map((d) => d.message).join("\n"));
    }
    const options = { serviceUrl: cfg.compileServiceUrl, timeoutMs: cfg.requestTimeoutMs };
    const result = input.files
      ? await compileProject(input.files, input.rootFile ?? "main.tex", options)
      : await compileLatex(input.latex ?? "", options);
    if (result.success) {
      if (result.pdf.byteLength > 20_000_000) throw new Error("PDF exceeds 20 MB artifact limit");
      pdf = Buffer.from(result.pdf).toString("base64");
    } else diagnostic = result.log;
  } catch (cause) {
    diagnostic = cause instanceof Error ? cause.message : "Compilation failed";
  }
  const { error: finishError } = await db.rpc("mcp_finish_job", {
    p_job_id: job.jobId, p_lease_token: job.leaseToken, p_success: pdf !== null,
    p_pdf_base64: pdf, p_log: diagnostic?.slice(0, 16000) ?? null,
  });
  if (finishError) throw new Error(`Job publication failed (${finishError.code})`);
  return true;
}
