import { createSourceSelectionContext, type SourceSelectionContext } from "./selection-context";
import type { StoredDocument } from "@/lib/types/document";

export type PdfSelectionDocument = Pick<StoredDocument, "id" | "updatedAt" | "latex" | "files">;
export type PdfSourceMatch = { context: SourceSelectionContext; source: string; line: number };

// PDF line wrapping may differ from the author's whitespace. Preserve UTF-16 offsets for MCP.
export function flattenPdfWhitespace(source: string) {
  const offsets: number[] = [];
  const text = source.replace(/\s+|\S+/gu, (run: string, start: number) => {
    if (/^\s/u.test(run)) {
      offsets.push(start);
      return " ";
    }
    for (let i = 0; i < run.length; i++) offsets.push(start + i);
    return run;
  });
  offsets.push(source.length);
  return { text, offsets };
}

export function findPdfSourceMatches(doc: PdfSelectionDocument, selected: string) {
  const needle = selected.trim().replace(/\s+/gu, " ");
  const matches: PdfSourceMatch[] = [];
  if (!needle || needle.length > 100_000) return { matches, overflow: false };
  const files = doc.files?.length ? doc.files : [{ path: "main.tex", content: doc.latex }];
  for (const file of files) {
    if (!/\.tex$/i.test(file.path) || typeof file.content !== "string") continue;
    const source = file.content;
    const { text, offsets } = flattenPdfWhitespace(source);
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(needle, from);
      if (index < 0) break;
      from = index + 1;
      const start = offsets[index], end = offsets[index + needle.length];
      if (end - start > 100_000) continue;
      if (matches.length === 12) return { matches: [], overflow: true };
      const context = createSourceSelectionContext({
        documentId: doc.id, updatedAt: doc.updatedAt, filePath: file.path, source,
        selection: { start, end, source, updatedAt: doc.updatedAt },
      });
      if (context) matches.push({ context, source, line: source.slice(0, start).split("\n").length });
    }
  }
  return { matches, overflow: false };
}

// Only mark a replacement if all source outside the copied range still matches.
export function getPdfReplacement(doc: PdfSelectionDocument, match: PdfSourceMatch) {
  const { context, source } = match;
  if (context.documentId !== doc.id || context.updatedAt === doc.updatedAt) return;
  const fresh = doc.files?.length
    ? doc.files.find((file) => file.path === context.filePath)?.content : doc.latex;
  const tail = source.slice(context.end);
  if (fresh === undefined || fresh === source || fresh.length < context.start + tail.length ||
      !fresh.startsWith(source.slice(0, context.start)) || !fresh.endsWith(tail)) return;
  return fresh.slice(context.start, fresh.length - tail.length).trim() || undefined;
}
