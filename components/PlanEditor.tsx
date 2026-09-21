"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface PlanEditorProps {
  docId: string;
  initialPlanContent?: string;
  onApprove: (docId: string, finalPlan: string) => void;
}

export default function PlanEditor({ docId, initialPlanContent, onApprove }: PlanEditorProps) {
  const [content, setContent] = useState(initialPlanContent ?? "");
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string>();

  const handleApprove = async () => {
    setIsApproving(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/documents/${docId}/approve-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // We could also send updated plan content here if we modify the backend 
        // to accept it and save it back to DB before transitioning state.
        body: JSON.stringify({ planContent: content }), 
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Duyệt dàn ý thất bại.");
      }

      onApprove(docId, content);
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra khi duyệt dàn ý.");
      setIsApproving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
            Duyệt Dàn ý (Plan)
          </h3>
          <p className="text-sm text-zinc-500">
            AI đã đề xuất dàn ý dưới đây. Bạn có thể tự do chỉnh sửa trước khi AI bắt tay vào sinh mã LaTeX.
          </p>
        </div>
      </div>

      <textarea
        className="w-full min-h-[300px] rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-600/50"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Nội dung dàn ý (Markdown)..."
        disabled={isApproving}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button 
          onClick={handleApprove} 
          disabled={isApproving || content.trim().length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isApproving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang xác nhận...
            </>
          ) : (
            "Xác nhận Dàn ý & Sinh mã"
          )}
        </Button>
      </div>
    </div>
  );
}
