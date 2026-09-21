"use client";

import { useState } from "react";
import Link from "next/link";
import ChatAssistant from "@/components/ChatAssistant";
import DocumentList from "@/components/DocumentList";
import ResultPanel from "@/components/ResultPanel";
import type { ChatItem } from "@/components/useDocumentGenerationChat";
import type { DocumentSummary } from "@/lib/types/document";

/**
 * Layout 2 cột: chat (trái) + panel xem kết quả live (phải, trên) + danh sách tài liệu (phải,
 * dưới). Panel bên phải cập nhật NGAY khi 1 lượt chat hoàn tất.
 */
export default function HomeClient({
  initialDocuments,
}: {
  initialDocuments: DocumentSummary[];
}) {
  const [previewItem, setPreviewItem] = useState<ChatItem | null>(null);

  return (
    <main
      className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-4 p-2 lg:p-4 lg:grid-cols-[400px_minmax(0,1fr)]"
      aria-label="Trang chính"
    >
      {/* Cột trái: Chat */}
      <section
        className="flex flex-col gap-3 sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto pr-2"
        aria-label="Trò chuyện với trợ lý AI"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Khởi tạo &amp; Trò chuyện
          </h1>
          <p className="text-sm text-muted-foreground">
            Tương tác với AI để tạo mới, cấu hình và sửa đổi tài liệu LaTeX của bạn.
          </p>
        </div>
        <ChatAssistant onPreview={setPreviewItem} />
      </section>

      {/* Cột phải: Kết quả + Danh sách tài liệu */}
      <section
        className="flex min-w-0 flex-col gap-4"
        aria-label="Kết quả và danh sách tài liệu"
      >
        {/* Preview panel */}
        <div className="flex min-h-[60vh] flex-1 flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Kết quả</h2>
            {previewItem?.docId && (
              <Link
                href={`/documents/${previewItem.docId}`}
                className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              >
                Mở toàn màn hình
              </Link>
            )}
          </div>
          {previewItem ? (
            <ResultPanel
              result={{
                docId: previewItem.docId,
                status: previewItem.status === "planned" ? "PLANNED" :
                        previewItem.stepStatus?.step === "analyzing" ? "ANALYZING" :
                        previewItem.stepStatus?.step === "generating" ? "GENERATING" :
                        previewItem.stepStatus?.step === "repairing" ? "REVIEWING" :
                        previewItem.stepStatus?.step === "compiling" ? "COMPILING" :
                        previewItem.hasPdf ? "EXPORTABLE" : undefined,
                planContent: previewItem.planContent,
                latex: previewItem.streamedLatex,
                pdfBase64: previewItem.pdfBase64,
                error: previewItem.error,
              }}
              onPlanApproved={(docId, plan) => {
                window.dispatchEvent(
                  new CustomEvent("plan-approved", {
                    detail: { botId: previewItem.id, docId, plan },
                  })
                );
              }}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="max-w-xs text-center text-sm text-muted-foreground">
                Kết quả tài liệu vừa tạo sẽ hiện ở đây. Gửi một yêu cầu trong
                khung chat bên trái để bắt đầu.
              </p>
            </div>
          )}
        </div>

        {/* Danh sách tài liệu */}
        <DocumentList initialDocuments={initialDocuments} />
      </section>
    </main>
  );
}
