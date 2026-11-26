import type { SupabaseClient } from "@supabase/supabase-js";
import { compileLatex, compileProject, CompileServiceError } from "@/lib/compile/client";
import { getConfig } from "@/lib/config";
import { getTemplate } from "@/lib/templates/registry";
import type { ProjectFile, TemplateId } from "@/lib/types/document";
import { validateLatex } from "@/lib/validation/validate";

type PreviewClaim = {
  documentId: string;
  revision: string;
  leaseToken: string;
  latex: string;
  files: ProjectFile[] | null;
  rootFile: string | null;
  template: TemplateId;
};

export async function processNextPreviewJob(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.rpc("claim_document_preview");
  if (error) throw new Error(`Preview claim failed (${error.code})`);
  const job = data as PreviewClaim | null;
  if (!job) return false;

  const config = getConfig();
  const options = { serviceUrl: config.compileServiceUrl, timeoutMs: Math.min(config.requestTimeoutMs, 240_000) };
  let pdf: string | null = null;
  let log: string | null = null;
  try {
    if (!job.files?.length) {
      const check = validateLatex(job.latex, {
        packageAllowlist: getTemplate(job.template)?.packageAllowlist,
      });
      if (!check.ok) throw new Error(check.diagnostics.map((item) => item.message).join("\n"));
    }
    const result = job.files?.length
      ? await compileProject(job.files, job.rootFile ?? "main.tex", options)
      : await compileLatex(job.latex, options);
    if (result.success) {
      if (result.pdf.byteLength > 20_000_000) throw new Error("PDF exceeds 20 MB");
      pdf = Buffer.from(result.pdf).toString("base64");
    } else {
      log = result.log;
    }
  } catch (cause) {
    if (cause instanceof CompileServiceError) {
      const retry = await db.rpc("retry_document_preview", {
        p_document_id: job.documentId,
        p_revision: job.revision,
        p_lease_token: job.leaseToken,
      });
      if (retry.error) throw new Error(`Preview retry failed (${retry.error.code})`);
      if (retry.data === true) return true;
    }
    log = cause instanceof Error ? cause.message : "Compilation failed";
  }

  const { error: publishError } = await db.rpc("finish_document_preview", {
    p_document_id: job.documentId,
    p_revision: job.revision,
    p_lease_token: job.leaseToken,
    p_pdf: pdf,
    p_log: log?.slice(0, 16_000) ?? null,
  });
  if (publishError) throw new Error(`Preview publication failed (${publishError.code})`);
  return true;
}
