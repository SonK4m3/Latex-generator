"use client";

import type { DocumentSummary } from "@/lib/types/document";
import DocumentLibrary from "@/components/document-library/document-library";

/**
 * Compatibility entry point kept for existing imports (page, HomeClient, tests).
 * The library state now lives in `components/document-library/document-library.tsx`.
 */
export default function DocumentList({
  initialDocuments,
}: {
  initialDocuments: DocumentSummary[];
}) {
  return <DocumentLibrary initialDocuments={initialDocuments} />;
}
