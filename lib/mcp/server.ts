import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { compileDocumentInputSchema } from "@/lib/application/input-schema";
import {
  artifactFormatSchema, cancelMcpJob, createMcpArtifactGrant, enqueueMcpCompile, getMcpJob, jobResultSchema,
} from "@/lib/application/mcp-compile-jobs";
import {
  documentSourceSchema, documentSummarySchema, getMcpDocument, listMcpDocuments,
} from "@/lib/application/mcp-documents";
import { McpOperationError } from "@/lib/application/mcp-operation-error";
import { updateMcpSource, updateMcpSourceInput, updateMcpSourceOutput } from "@/lib/application/mcp-update-source";
import {
  updateMcpSelection,
  updateMcpSelectionInput,
  updateMcpSelectionOutput,
} from "@/lib/application/mcp-selection-edit";
import { McpAuthError } from "@/lib/auth/mcp-errors";
import { type McpPrincipal, requireMcpScope } from "@/lib/auth/mcp-principal";
import { getTemplateSpec, TemplateSpecSchema } from "@/lib/templates/mcp-format-contract";
import { listTemplates } from "@/lib/templates/registry";

const version = { schemaVersion: z.literal(1) };
const jobOutput = z.object({ ...version, job: jobResultSchema });
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const _meta = { securitySchemes: [{ type: "oauth2", scopes: ["openid"] }] };

function result(text: string, structuredContent: Record<string, unknown>, isError = false): CallToolResult {
  const content = [{ type: "text" as const, text }];
  // Clients validate structuredContent against the success schema whenever it is present.
  if (isError) return { content, isError: true, _meta: structuredContent };
  return { content, structuredContent: { schemaVersion: 1, ...structuredContent } };
}

function toolAction(
  principal: McpPrincipal,
  operation: () => Promise<CallToolResult> | CallToolResult,
): Promise<CallToolResult> {
  return (async () => {
    try {
      requireMcpScope(principal, "openid");
      return await operation();
    } catch (error) {
      if (error instanceof McpAuthError) {
        const response = result("Connect your account to continue.", { code: "insufficient_scope" }, true);
        return { ...response, _meta: { "mcp/www_authenticate": [error.challenge] } };
      }
      if (error instanceof McpOperationError) return result(error.message, { code: error.code }, true);
      // Log the correlation ID only. Errors could contain source or signed download links.
      console.error("MCP operation failed", { requestId: principal.requestId });
      return result("The document service is temporarily unavailable.", { code: "not_available" }, true);
    }
  })();
}

export function createLatexMcpServer(principal: McpPrincipal, resourceUrl: string): McpServer {
  const server = new McpServer({ name: "ai-latex-generator", version: "0.1.0" });
  const context = (signal: AbortSignal) => ({ ...principal, resourceUrl, signal });

  server.registerTool("list_templates", {
    title: "List LaTeX templates",
    description: "List the available document categories, classes and suggested LaTeX packages.",
    inputSchema: z.strictObject({}),
    outputSchema: z.object({ ...version, templates: z.array(z.object({
      id: z.string(), label: z.string(), description: z.string(), documentClass: z.string(), packages: z.array(z.string()),
    })) }),
    annotations: readOnly,
    _meta,
  }, () => toolAction(principal, () => {
    const templates = listTemplates().map(({ id, label, description, documentClass, packages }) => ({
      id, label, description, documentClass, packages,
    }));
    return result(`${templates.length} LaTeX templates available.`, { templates });
  }));

  server.registerTool("get_template_spec", {
    title: "Get a LaTeX template format spec",
    description: "Get the full format contract for one template id from list_templates: document class, suggested and allowed packages, capability flags, prompt guidance, and full-document requirements.",
    inputSchema: z.strictObject({ templateId: TemplateSpecSchema.shape.id }),
    outputSchema: z.object({ ...version, template: TemplateSpecSchema }),
    annotations: readOnly,
    _meta,
  }, ({ templateId }) => toolAction(principal, () => {
    const template = getTemplateSpec(templateId);
    return result(`Format spec for the ${template.label} template.`, { template });
  }));

  server.registerTool("compile_document", {
    title: "Compile and save LaTeX",
    description: "Start a job to compile and save a new document from complete LaTeX source. Supply latex alone, or files and rootFile for a project. Reuse the same idempotencyKey only when retrying identical input. Poll get_job to get the result.",
    inputSchema: compileDocumentInputSchema,
    outputSchema: jobOutput,
    annotations: write,
    _meta,
  }, (args, { signal }) => toolAction(principal, async () => {
    const job = await enqueueMcpCompile(context(signal), args);
    return result(`Compile job ${job.jobId} is ${job.status}.`, { job });
  }));

  server.registerTool("get_job", {
    title: "Get compile job status",
    description: "Get the status of one of your jobs. Successful jobs include an artifactId for get_artifact. Failure diagnostics are compiler output.",
    inputSchema: z.strictObject({ jobId: z.uuid() }),
    outputSchema: jobOutput,
    annotations: readOnly,
    _meta,
  }, ({ jobId }, { signal }) => toolAction(principal, async () => {
    const job = await getMcpJob(context(signal), jobId);
    return result(`Compile job ${jobId} is ${job.status}.`, { job });
  }));

  server.registerTool("cancel_job", {
    title: "Cancel compile job",
    description: "Cancel one of your queued jobs or request cancellation of a running job. Completed jobs keep their result.",
    inputSchema: z.strictObject({ jobId: z.uuid() }),
    outputSchema: jobOutput,
    annotations: { ...write, destructiveHint: true, idempotentHint: true },
    _meta,
  }, ({ jobId }, { signal }) => toolAction(principal, async () => {
    const job = await cancelMcpJob(context(signal), jobId);
    return result(`Compile job ${jobId} is ${job.status}.`, { job });
  }));

  server.registerTool("list_documents", {
    title: "List saved documents",
    description: "List metadata for your saved documents. Use nextCursor for the next page.",
    inputSchema: z.strictObject({ limit: z.number().int().min(1).max(50).optional(), cursor: z.string().min(1).max(256).optional() }),
    outputSchema: z.object({ ...version, documents: z.array(documentSummarySchema), nextCursor: z.string().nullable() }),
    annotations: readOnly,
    _meta,
  }, ({ limit = 20, cursor }, { signal }) => toolAction(principal, async () => {
    const page = await listMcpDocuments(context(signal), limit, cursor);
    return result(`${page.documents.length} saved documents on this page.`, page);
  }));

  server.registerTool("get_document", {
    title: "Get a saved document",
    description: "Get your document metadata and web link. Set includeSource only when you need text source. Large sources and binary attachments are available from the web workspace.",
    inputSchema: z.strictObject({ documentId: z.uuid(), includeSource: z.boolean().optional() }),
    outputSchema: z.object({ ...version, document: documentSummarySchema, source: documentSourceSchema.optional() }),
    annotations: readOnly,
    _meta,
  }, ({ documentId, includeSource = false }, { signal }) => toolAction(principal, async () => {
    const document = await getMcpDocument(context(signal), documentId, includeSource);
    return result("Saved document found.", document);
  }));

  server.registerTool("update_document_source", {
    title: "Update saved document source",
    description: "Update a saved document using either complete latex for a single-file document or files [{path,content}] patches for existing readable project text files. Always read get_document(includeSource=true) first and pass that exact updatedAt. Project patches cannot add, remove, rename files, or change rootFile; binary and untouched files are preserved. The editor receives saved revisions in realtime. Saving clears the old PDF; compile the new revision separately in the web editor.",
    inputSchema: updateMcpSourceInput,
    outputSchema: updateMcpSourceOutput.extend(version),
    annotations: write,
    _meta,
  }, (input, { signal }) => toolAction(principal, async () => {
    const saved = await updateMcpSource(context(signal), input);
    return result("LaTeX saved. Open the editor to preview or compile the new revision.", saved);
  }));

  server.registerTool("edit_document_selection", {
    title: "Edit selected source range",
    description: "Replace one exact LaTeX source selection copied from the web editor. Pass the copied selection JSON and replacement source text without Markdown fences. The tool checks the saved document revision, exact selected text, and surrounding anchors before writing through the existing compare-and-set path. If the context is stale or mismatched, ask the user to copy a fresh selection; do not guess a new location. The web editor receives the saved revision in realtime; compile it there to refresh the PDF.",
    inputSchema: updateMcpSelectionInput,
    outputSchema: updateMcpSelectionOutput.extend(version),
    annotations: write,
    _meta,
  }, ({ selection, replacement }, { signal }) => toolAction(principal, async () => {
    const saved = await updateMcpSelection(context(signal), { selection, replacement });
    return result(`Updated ${saved.filePath} at source range ${saved.changedRange.start}-${saved.changedRange.end}.`, saved);
  }));

  server.registerTool("get_artifact", {
    title: "Get a compiled file download link",
    description: "Create a temporary download link for an artifact you own. Use the artifactId from get_job. PDF and single-file TeX are supported.",
    inputSchema: z.strictObject({ artifactId: z.uuid(), format: artifactFormatSchema.optional() }),
    outputSchema: z.object({
      ...version, artifactId: z.uuid(), format: artifactFormatSchema, downloadUrl: z.url(),
      expiresAt: z.string(), webUrl: z.url().nullable(),
    }),
    annotations: write,
    _meta,
  }, ({ artifactId, format = "pdf" }, { signal }) => toolAction(principal, async () => {
    const grant = await createMcpArtifactGrant(context(signal), artifactId, format);
    return result(`The ${format.toUpperCase()} download link expires at ${grant.expiresAt}.`, grant);
  }));

  return server;
}
