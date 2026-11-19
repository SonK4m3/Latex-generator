"use client";

import Link from "next/link";
import ChatAssistant from "@/components/ChatAssistant";
import ResultPanel from "@/components/ResultPanel";
import type { ChatItem } from "@/components/useDocumentGenerationChat";

/**
 * Collapsible creation panel. It stays mounted while closed so the chat draft survives toggling.
 */
export default function CreateDocumentPanel({
  open,
  previewItem,
  onPreview,
}: {
  open: boolean;
  previewItem: ChatItem | null;
  onPreview: (item: ChatItem | null) => void;
}) {
  return (
    <section
      id="document-creation"
      hidden={!open}
      aria-label="Tạo tài liệu bằng trợ lý AI"
    >
      <div
        className={`grid min-w-0 gap-4 ${
          previewItem
            ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
            : "max-w-2xl"
        }`}
      >
        <div className="flex min-h-[35rem] min-w-0 flex-col gap-2">
          <h2 className="text-base font-semibold">Tạo bằng trợ lý AI</h2>
          <ChatAssistant onPreview={onPreview} />
        </div>

        {previewItem && (
          <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Kết quả</h2>
              {previewItem.docId && (
                <Link
                  href={`/documents/${previewItem.docId}`}
                  className="rounded text-sm text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Mở tài liệu
                </Link>
              )}
            </div>
            <ResultPanel
              result={{
                docId: previewItem.docId,
                status:
                  previewItem.status === "planned"
                    ? "PLANNED"
                    : previewItem.stepStatus?.step === "analyzing"
                      ? "ANALYZING"
                      : previewItem.stepStatus?.step === "generating"
                        ? "GENERATING"
                        : previewItem.stepStatus?.step === "repairing"
                          ? "REVIEWING"
                          : previewItem.stepStatus?.step === "compiling"
                            ? "COMPILING"
                            : previewItem.hasPdf
                              ? "EXPORTABLE"
                              : undefined,
                planContent: previewItem.planContent,
                latex: previewItem.streamedLatex,
                pdfBase64: previewItem.pdfBase64,
                error: previewItem.error,
              }}
              onPlanApproved={(docId, plan) => {
                window.dispatchEvent(
                  new CustomEvent("plan-approved", {
                    detail: { botId: previewItem.id, docId, plan },
                  }),
                );
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
