"use client";

import { useState } from "react";
import DocumentList from "@/components/DocumentList";
import AppHeader from "@/components/document-library/app-header";
import CreateDocumentPanel from "@/components/document-library/create-document-panel";
import type { ChatItem } from "@/components/useDocumentGenerationChat";
import type { DocumentSummary } from "@/lib/types/document";

export default function HomeClient({
  initialDocuments,
}: {
  initialDocuments: DocumentSummary[];
}) {
  const [previewItem, setPreviewItem] = useState<ChatItem | null>(null);
  const [creationOpen, setCreationOpen] = useState(false);

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-3 py-6 sm:px-5"
      aria-label="Trang chính"
    >
      <AppHeader
        creationOpen={creationOpen}
        onToggleCreation={() => setCreationOpen((open) => !open)}
      />
      <CreateDocumentPanel
        open={creationOpen}
        previewItem={previewItem}
        onPreview={setPreviewItem}
      />
      <DocumentList initialDocuments={initialDocuments} />
    </div>
  );
}
