// lib/templates/mcp-format-contract.ts
// Machine-readable, JSON-safe template format contract for MCP/web clients.
//
// Derived entirely from the canonical template registry (TEMPLATE_IDS + getTemplate +
// docTypeForClass) so discovery cannot drift from the templates the compile pipeline actually
// supports. Deliberately omits renderMock, repair hints, and clarification internals.

import { z } from "zod";

import { docTypeForClass, getTemplate } from "@/lib/templates/registry";
import type { DocumentTemplate } from "@/lib/templates/registry";
import { DOC_TYPES, TEMPLATE_IDS, type LatexClass, type TemplateId } from "@/lib/types/document";

const LATEX_CLASSES = ["article", "report", "beamer", "exam", "letter"] as const satisfies readonly LatexClass[];

/** Requirements every generated source must satisfy, regardless of template. */
export const FULL_DOCUMENT_REQUIREMENTS = {
  rawLatexOnly: true,
  completeDocument: true,
  requiredMarkers: ["\\documentclass", "\\begin{document}", "\\end{document}"],
  encoding: "UTF-8",
  engine: "XeLaTeX",
  markdownFences: false,
  rules: [
    "Return only raw LaTeX source: no Markdown code fences, no prose, no explanations.",
    "Emit a complete document: \\documentclass{...}, \\begin{document}, and \\end{document}.",
    "Use UTF-8 text and XeLaTeX-compatible source (fontspec; do not load inputenc/fontenc).",
  ],
} as const;

export const FullDocumentRequirementsSchema = z.strictObject({
  rawLatexOnly: z.literal(true),
  completeDocument: z.literal(true),
  requiredMarkers: z.array(z.string()).min(3),
  encoding: z.literal("UTF-8"),
  engine: z.literal("XeLaTeX"),
  markdownFences: z.literal(false),
  rules: z.array(z.string()).min(3),
});

export const TemplateSpecSchema = z.strictObject({
  id: z.enum(TEMPLATE_IDS),
  label: z.string(),
  category: z.string(),
  description: z.string(),
  docType: z.enum(DOC_TYPES),
  documentClass: z.enum(LATEX_CLASSES),
  packages: z.array(z.string()),
  packageAllowlist: z.array(z.string()).default([]),
  capabilities: z.record(z.string(), z.boolean()).default({}),
  promptGuidance: z.string(),
  fullDocumentRequirements: FullDocumentRequirementsSchema,
});

export type TemplateSpec = z.infer<typeof TemplateSpecSchema>;

/** Build one spec from registry data, then validate it before it can reach a client. */
function toTemplateSpec(template: DocumentTemplate): TemplateSpec {
  return TemplateSpecSchema.parse({
    id: template.id,
    label: template.label,
    category: template.category,
    description: template.description,
    docType: docTypeForClass(template.documentClass),
    documentClass: template.documentClass,
    packages: [...template.packages],
    packageAllowlist: [...(template.packageAllowlist ?? [])],
    capabilities: { ...(template.capabilities ?? {}) },
    promptGuidance: template.promptGuidance,
    fullDocumentRequirements: FULL_DOCUMENT_REQUIREMENTS,
  });
}

/** One validated format spec for a known TemplateId. */
export function getTemplateSpec(id: TemplateId): TemplateSpec {
  return toTemplateSpec(getTemplate(id));
}

/** Every validated format spec, in canonical registry (TEMPLATE_IDS) order. */
export function listTemplateSpecs(): TemplateSpec[] {
  return TEMPLATE_IDS.map((id) => getTemplateSpec(id));
}
