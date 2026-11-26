// lib/application/mcp-latex-contract.ts
// Server-side LaTeX format contract for the MCP compile input boundary.
//
// This is a pure validator: it returns Zod-compatible issues and never rewrites or repairs the
// caller's source. Template metadata comes from the canonical registry, so class/docType rules
// cannot drift from the templates the compile pipeline supports.

import { docTypeForClass, getTemplate } from "@/lib/templates/registry";
import type { DocType, ProjectFile, TemplateId } from "@/lib/types/document";

export interface McpLatexContractInput {
  docType: DocType;
  template?: TemplateId;
  latex?: string;
  files?: readonly ProjectFile[];
  rootFile?: string;
}

export interface McpLatexContractIssue {
  path: (string | number)[];
  message: string;
}

const DOCUMENT_CLASS_COMMAND = /\\documentclass(?![A-Za-z@])/g;
const DOCUMENT_CLASS = /\\documentclass(?![A-Za-z@])\s*(?:\[[^\]]*\]\s*)?\{([^{}]+)\}/;
const BEGIN_DOCUMENT = /\\begin\s*\{\s*document\s*\}/g;
const END_DOCUMENT = /\\end\s*\{\s*document\s*\}/g;
const BEGIN_DOCUMENT_ORDER = /\\begin\s*\{\s*document\s*\}/;
const END_DOCUMENT_ORDER = /\\end\s*\{\s*document\s*\}/;
const MARKDOWN_FENCE = /^[ \t]*(?:```|~~~)/m;

function countMatches(source: string, pattern: RegExp): number {
  return Array.from(source.matchAll(pattern)).length;
}

/**
 * Remove ordinary LaTeX comments (`%` through end of line) before marker checks.
 * An escaped `\%` is content, not a comment; `\\%` is still a comment because the percent
 * follows an even number of backslashes. Newlines are preserved so line-based checks still work.
 */
function stripLatexComments(source: string): string {
  let stripped = "";
  let backslashes = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "%" && backslashes % 2 === 0) {
      while (index < source.length && source[index] !== "\n") index += 1;
      if (index < source.length) stripped += "\n";
      backslashes = 0;
      continue;
    }
    stripped += char;
    backslashes = char === "\\" ? backslashes + 1 : 0;
  }
  return stripped;
}

interface SourceTarget {
  text: string;
  path: (string | number)[];
}

/** Select the one source text the contract validates: `latex`, or the selected project root. */
function resolveSource(input: McpLatexContractInput): { target?: SourceTarget; issue?: McpLatexContractIssue } {
  if (input.latex !== undefined) {
    return { target: { text: input.latex, path: ["latex"] } };
  }
  if (!input.files || input.rootFile === undefined) return {};
  const index = input.files.findIndex((file) => file.path === input.rootFile);
  if (index < 0) return {}; // The parent schema already reports a rootFile that is not in files.
  const path = ["files", index, "content"];
  const content = input.files[index].content;
  if (content === undefined) {
    return {
      issue: {
        path,
        message: `Root file "${input.rootFile}" must provide raw LaTeX text in content; contentBase64 is not accepted.`,
      },
    };
  }
  return { target: { text: content, path } };
}

function validateSource(
  source: string,
  path: (string | number)[],
  template: { id: TemplateId; documentClass: string } | undefined,
): McpLatexContractIssue[] {
  const issues: McpLatexContractIssue[] = [];
  const clean = stripLatexComments(source);

  const classCount = countMatches(clean, DOCUMENT_CLASS_COMMAND);
  if (classCount !== 1) {
    issues.push({
      path,
      message: `A complete LaTeX document must contain exactly one \\documentclass declaration; found ${classCount}.`,
    });
  } else {
    const documentClass = DOCUMENT_CLASS.exec(clean)?.[1]?.trim();
    if (!documentClass) {
      issues.push({
        path,
        message: "A complete LaTeX document must contain a valid \\documentclass{class} declaration.",
      });
    } else if (template && documentClass !== template.documentClass) {
      issues.push({
        path,
        message: `Template "${template.id}" requires document class "${template.documentClass}", but the source uses "${documentClass}".`,
      });
    }
  }

  const beginCount = countMatches(clean, BEGIN_DOCUMENT);
  const endCount = countMatches(clean, END_DOCUMENT);
  if (beginCount !== 1) {
    issues.push({
      path,
      message: `A complete LaTeX document must contain exactly one \\begin{document}; found ${beginCount}.`,
    });
  }
  if (endCount !== 1) {
    issues.push({
      path,
      message: `A complete LaTeX document must contain exactly one \\end{document}; found ${endCount}.`,
    });
  }
  if (beginCount === 1 && endCount === 1) {
    const beginIndex = clean.search(BEGIN_DOCUMENT_ORDER);
    const endIndex = clean.search(END_DOCUMENT_ORDER);
    if (beginIndex > endIndex) {
      issues.push({ path, message: "\\begin{document} must appear before \\end{document}." });
    }
  }

  if (MARKDOWN_FENCE.test(clean)) {
    issues.push({ path, message: "LaTeX source must not contain standalone Markdown code fences." });
  }

  return issues;
}

/**
 * Validate one MCP compile input against the LaTeX format contract.
 * Returns Zod-compatible issues with paths under `docType`, `latex`, or `files[<index>]`.
 */
export function validateMcpLatexContract(input: McpLatexContractInput): McpLatexContractIssue[] {
  const issues: McpLatexContractIssue[] = [];
  const template = input.template ? getTemplate(input.template) : undefined;

  if (template) {
    const expectedDocType = docTypeForClass(template.documentClass);
    if (input.docType !== expectedDocType) {
      issues.push({
        path: ["docType"],
        message: `Template "${template.id}" requires docType "${expectedDocType}", but received "${input.docType}".`,
      });
    }
  }

  const { target, issue } = resolveSource(input);
  if (issue) issues.push(issue);
  if (!target) return issues;

  return [...issues, ...validateSource(target.text, target.path, template)];
}
