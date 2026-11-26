import { z } from "zod";
import { getConfig } from "@/lib/config";
import { TEMPLATE_IDS } from "@/lib/types/document";
import { validateMcpLatexContract } from "./mcp-latex-contract";

const safeRelativePath = z.string().min(1).max(255).refine((path) =>
  path === path.trim() &&
  !path.startsWith("/") &&
  !path.includes("\\") &&
  !/[\u0000-\u001f\u007f]/.test(path) &&
  !/^[A-Za-z]:/.test(path) &&
  !path.split("/").some((part) => part === "" || part === "." || part === ".."),
"Use a safe relative POSIX path.");

const projectFileSchema = z.strictObject({
  path: safeRelativePath,
  content: z.string().optional(),
  contentBase64: z.string().optional(),
}).superRefine((file, ctx) => {
  if ((file.content === undefined) === (file.contentBase64 === undefined)) {
    ctx.addIssue({ code: "custom", message: "Provide exactly one of content or contentBase64." });
  }
  if (file.contentBase64 !== undefined && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.contentBase64)) {
    ctx.addIssue({ code: "custom", path: ["contentBase64"], message: "contentBase64 must be valid standard Base64." });
  }
});

const inputShape = z.strictObject({
  title: z.string().trim().min(1).max(500),
  docType: z.enum(["article", "report"]),
  template: z.enum(TEMPLATE_IDS).optional(),
  latex: z.string().optional(),
  files: z.array(projectFileSchema).optional(),
  rootFile: safeRelativePath.optional(),
  idempotencyKey: z.string().min(1).max(200).refine((key) => key.trim().length > 0),
});

export const compileDocumentInputSchema = inputShape.superRefine((input, ctx) => {
  const hasLatex = input.latex !== undefined;
  const hasFiles = input.files !== undefined;
  if (hasLatex === hasFiles) {
    ctx.addIssue({ code: "custom", message: "Provide either latex or files with rootFile." });
  }
  if (hasFiles && input.rootFile === undefined) {
    ctx.addIssue({ code: "custom", path: ["rootFile"], message: "rootFile is required when files are provided." });
  }
  if (!hasFiles && input.rootFile !== undefined) {
    ctx.addIssue({ code: "custom", path: ["rootFile"], message: "rootFile can only be used with files." });
  }
  if (hasFiles && input.files) {
    const seen = new Set<string>();
    let totalBytes = 0;
    for (const [index, file] of input.files.entries()) {
      if (seen.has(file.path)) {
        ctx.addIssue({ code: "custom", path: ["files", index, "path"], message: "File paths must be unique." });
      }
      seen.add(file.path);
      totalBytes += file.content !== undefined
        ? Buffer.byteLength(file.content, "utf8")
        : Buffer.from(file.contentBase64 ?? "", "base64").byteLength;
    }
    if (input.files.length === 0 || input.files.length > getConfig().maxProjectFiles) {
      ctx.addIssue({ code: "custom", path: ["files"], message: "The project file count is outside the configured limit." });
    }
    if (input.rootFile && !seen.has(input.rootFile)) {
      ctx.addIssue({ code: "custom", path: ["rootFile"], message: "rootFile must match one of files[].path." });
    }
    if (totalBytes > getConfig().maxProjectBytes) {
      ctx.addIssue({ code: "custom", path: ["files"], message: "The project exceeds the configured byte limit." });
    }
  }
  if (input.latex !== undefined && Buffer.byteLength(input.latex, "utf8") > getConfig().maxProjectBytes) {
    ctx.addIssue({ code: "custom", path: ["latex"], message: "The source exceeds the configured byte limit." });
  }
  for (const issue of validateMcpLatexContract(input)) {
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
});

export type CompileDocumentInput = z.infer<typeof compileDocumentInputSchema>;

export function normalizeCompileInput(raw: CompileDocumentInput) {
  const { idempotencyKey, ...input } = compileDocumentInputSchema.parse(raw);
  return { idempotencyKey, input };
}
