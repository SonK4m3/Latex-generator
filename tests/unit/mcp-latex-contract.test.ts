import { describe, expect, it } from "vitest";

import { compileDocumentInputSchema } from "@/lib/application/input-schema";
import { docTypeForClass, getTemplate } from "@/lib/templates/registry";
import { TEMPLATE_IDS } from "@/lib/types/document";

const base = { title: "Contract", idempotencyKey: "idem-1", docType: "article" } as const;

const VALID_LATEX = String.raw`\documentclass[12pt]{article}
\begin{document}
Hello.
\end{document}`;

function parse(input: Record<string, unknown>) {
  return compileDocumentInputSchema.safeParse({ ...base, ...input });
}

function sourceFor(documentClass: string) {
  return String.raw`\documentclass{${documentClass}}
\begin{document}
Body.
\end{document}`;
}

function expectIssue(result: ReturnType<typeof parse>, path: string, message?: RegExp) {
  expect(result.success).toBe(false);
  if (!result.success) {
    const issue = result.error.issues.find((candidate) => candidate.path.join(".") === path);
    expect(issue, `expected an issue at ${path}`).toBeDefined();
    if (message) expect(issue?.message).toMatch(message);
  }
}

describe("MCP LaTeX contract enforcement", () => {
  it("accepts a complete source with documentclass options and preserves the source", () => {
    const result = parse({ template: "academic", latex: VALID_LATEX });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.latex).toBe(VALID_LATEX);
  });

  it("accepts every registry template with its documentClass and mapped docType", () => {
    for (const templateId of TEMPLATE_IDS) {
      const template = getTemplate(templateId);
      const result = parse({
        docType: docTypeForClass(template.documentClass),
        template: templateId,
        latex: sourceFor(template.documentClass),
      });
      expect(result.success, `template ${templateId} (${template.documentClass})`).toBe(true);
    }
    expect(getTemplate("slides").documentClass).toBe("beamer");
    expect(getTemplate("exam").documentClass).toBe("exam");
    expect(getTemplate("letter").documentClass).toBe("letter");
  });

  it("rejects a template/docType mismatch at docType", () => {
    expectIssue(
      parse({ docType: "report", template: "slides", latex: sourceFor("beamer") }),
      "docType",
      /article/,
    );
  });

  it("rejects a documentclass that does not match the supplied template", () => {
    expectIssue(
      parse({ template: "academic", latex: sourceFor("report") }),
      "latex",
      /article/,
    );
  });

  it("rejects a missing or duplicate documentclass", () => {
    expectIssue(
      parse({ latex: String.raw`\begin{document}
Body.
\end{document}` }),
      "latex",
      /documentclass/,
    );
    expectIssue(
      parse({ latex: `${sourceFor("article")}\n${sourceFor("report")}` }),
      "latex",
      /exactly one \\documentclass/,
    );
  });

  it("rejects missing, duplicate, and out-of-order document markers", () => {
    expectIssue(
      parse({ latex: String.raw`\documentclass{article}
\end{document}` }),
      "latex",
      /begin\{document\}/,
    );
    expectIssue(
      parse({ latex: String.raw`\documentclass{article}
\begin{document}` }),
      "latex",
      /end\{document\}/,
    );
    expectIssue(
      parse({ latex: String.raw`\documentclass{article}
\end{document}
\begin{document}
\begin{document}` }),
      "latex",
      /exactly one \\begin\{document\}/,
    );
    expectIssue(
      parse({ latex: String.raw`\documentclass{article}
\end{document}
\begin{document}` }),
      "latex",
      /before/,
    );
  });

  it("rejects standalone Markdown fences", () => {
    expectIssue(
      parse({ latex: `\`\`\`latex\n${VALID_LATEX}\n\`\`\`` }),
      "latex",
      /Markdown code fences/,
    );
  });

  it("does not let commented-out markers satisfy the contract", () => {
    expectIssue(
      parse({
        latex: String.raw`% \documentclass{article}
% \begin{document}
% \end{document}
Text only.`,
      }),
      "latex",
      /documentclass/,
    );
  });

  it("validates only the selected root file of a project", () => {
    const files = [
      { path: "main.tex", content: VALID_LATEX },
      { path: "notes.tex", content: "not a complete document" },
    ];
    expect(parse({ files, rootFile: "main.tex" }).success).toBe(true);
    expectIssue(
      parse({ files: [...files].reverse(), rootFile: "notes.tex" }),
      "files.0.content",
      /documentclass/,
    );
  });

  it("rejects a root file with base64-only content and an unknown root path", () => {
    expectIssue(
      parse({
        files: [{ path: "main.tex", contentBase64: Buffer.from(VALID_LATEX).toString("base64") }],
        rootFile: "main.tex",
      }),
      "files.0.content",
      /contentBase64/,
    );
    expectIssue(
      parse({ files: [{ path: "main.tex", content: VALID_LATEX }], rootFile: "other.tex" }),
      "rootFile",
    );
  });

  it("accepts legacy complete source when no template is supplied", () => {
    const result = parse({ docType: "report", latex: sourceFor("report") });
    expect(result.success).toBe(true);
  });
});
