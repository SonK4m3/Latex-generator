import type { DocumentSummary } from "@/lib/types/document";

/** PDF revision state exposed by the list metadata contract (M2). */
export type PdfRevisionStatus = NonNullable<DocumentSummary["pdfRevisionStatus"]>;

const PDF_REVISION_LABELS: Record<PdfRevisionStatus, string> = {
  missing: "Chưa có PDF",
  unknown: "PDF chưa rõ bản nguồn",
  current: "PDF khớp nguồn",
  stale: "PDF của bản trước",
};

const PDF_REVISION_TONES: Record<
  PdfRevisionStatus,
  "muted" | "warning" | "success" | "info"
> = {
  missing: "muted",
  unknown: "warning",
  current: "success",
  stale: "info",
};

/**
 * Resolve the PDF revision state. A document with a PDF but no revision metadata (old API or
 * file backend) is explicitly "unknown" rather than assumed current.
 */
export function getPdfRevisionStatus(
  doc: Pick<DocumentSummary, "hasPdf" | "pdfRevisionStatus">,
): PdfRevisionStatus {
  return doc.pdfRevisionStatus ?? (doc.hasPdf ? "unknown" : "missing");
}

export function getPdfRevisionLabel(status: PdfRevisionStatus): string {
  return PDF_REVISION_LABELS[status];
}

export function getPdfRevisionTone(
  status: PdfRevisionStatus,
): "muted" | "warning" | "success" | "info" {
  return PDF_REVISION_TONES[status];
}
