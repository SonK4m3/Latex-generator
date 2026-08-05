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
 * dưới). Panel bên phải cập nhật NGAY khi 1 lượt chat hoàn tất — không cần điều hướng sang
 * `/documents/[id]` để xem PDF/mã nguồn (phản hồi dogfood: "list ở gần chính giữa, không có màn
 * preview" + "xem thì phải vào route chi tiết"). Route chi tiết vẫn còn, chỉ không còn là lối
 * DUY NHẤT để xem — người dùng vẫn có thể "Mở toàn màn hình" khi cần chỉnh sửa sâu.
 */
export default function HomeClient({
  initialDocuments,
}: {
  initialDocuments: DocumentSummary[];
}) {
  const [previewItem, setPreviewItem] = useState<ChatItem | null>(null);

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">AI LaTeX Generator</h1>
          <p className="text-sm text-muted-foreground">
            Trò chuyện với trợ lý để mô tả tài liệu bằng ngôn ngữ tự nhiên. Kết
            quả (PDF/mã nguồn) hiện ngay ở bảng bên phải khi xong — không cần
            rời khỏi trang này.
          </p>
        </div>
        <ChatAssistant onPreview={setPreviewItem} />
      </section>

      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Kết quả</h2>
            {previewItem?.docId && (
              <Link
                href={`/documents/${previewItem.docId}`}
                className="text-xs text-blue-600 hover:underline"
              >
                Mở toàn màn hình
              </Link>
            )}
          </div>
          {previewItem ? (
            <ResultPanel
              result={{
                latex: previewItem.streamedLatex,
                pdfBase64: previewItem.pdfBase64,
                error: previewItem.error,
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Kết quả tài liệu vừa tạo sẽ hiện ở đây. Gửi một yêu cầu trong
              khung chat bên trái để bắt đầu.
            </p>
          )}
        </div>

        <DocumentList initialDocuments={initialDocuments} />
      </section>
    </main>
  );
}
