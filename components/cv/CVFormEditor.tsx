"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { CVData } from "@/lib/schema/cv";

interface CVFormEditorProps {
  docId: string;
  initialJson: string;
  onApprove: (docId: string, finalPlan: string) => void;
}

export default function CVFormEditor({ docId, initialJson, onApprove }: CVFormEditorProps) {
  const [data, setData] = useState<CVData | null>(null);
  const [rawJson, setRawJson] = useState(initialJson);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string>();

  // Parse initial json on mount
  useState(() => {
    try {
      const parsed = JSON.parse(initialJson) as CVData;
      setData(parsed);
    } catch {
      setMode("json"); // Fallback to raw json if parse fails
    }
  });

  const handleApprove = async () => {
    setIsApproving(true);
    setError(undefined);
    try {
      const finalJson = mode === "form" ? JSON.stringify(data) : rawJson;
      const res = await fetch(`/api/documents/${docId}/approve-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planContent: finalJson }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Duyệt CV thất bại.");
      }

      onApprove(docId, finalJson);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Có lỗi xảy ra khi duyệt CV.");
      setIsApproving(false);
    }
  };

  const updateHeader = (field: keyof CVData["header"], value: string) => {
    if (!data) return;
    setData({ ...data, header: { ...data.header, [field]: value } });
  };

  return (
    <div className="flex flex-col gap-4 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm max-h-[75vh] overflow-y-auto">
      <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-950 z-10 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
            Duyệt & Tinh chỉnh CV
          </h3>
          <p className="text-sm text-zinc-500">
            AI đã Tailor lại CV của bạn theo JD. Vui lòng kiểm tra lại thông tin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMode(mode === "form" ? "json" : "form")}>
            {mode === "form" ? "Sửa mã JSON" : "Sửa bằng Form"}
          </Button>
          <Button 
            onClick={handleApprove} 
            disabled={isApproving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            {isApproving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang tạo...</> : "Tạo CV LaTeX"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {mode === "json" || !data ? (
        <textarea
          className="w-full min-h-[300px] rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 font-mono text-xs resize-y"
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          disabled={isApproving}
        />
      ) : (
        <div className="flex flex-col gap-6 text-sm">
          {/* Header */}
          <section className="flex flex-col gap-3">
            <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 uppercase text-xs tracking-wider">Thông tin cá nhân</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-zinc-600 dark:text-zinc-400">Họ tên</span>
                <input type="text" className="border rounded px-2 py-1 bg-transparent" value={data.header.name} onChange={(e) => updateHeader("name", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-zinc-600 dark:text-zinc-400">Số điện thoại</span>
                <input type="text" className="border rounded px-2 py-1 bg-transparent" value={data.header.phone} onChange={(e) => updateHeader("phone", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-zinc-600 dark:text-zinc-400">Email</span>
                <input type="text" className="border rounded px-2 py-1 bg-transparent" value={data.header.email} onChange={(e) => updateHeader("email", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-zinc-600 dark:text-zinc-400">Link</span>
                <input type="text" className="border rounded px-2 py-1 bg-transparent" value={data.header.link} onChange={(e) => updateHeader("link", e.target.value)} />
              </label>
            </div>
          </section>

          {/* Summary */}
          <section className="flex flex-col gap-2">
            <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 uppercase text-xs tracking-wider">Mục tiêu nghề nghiệp</h4>
            <textarea className="border rounded p-2 text-xs h-20 bg-transparent" value={data.summary || ""} onChange={(e) => setData({ ...data, summary: e.target.value })} />
          </section>

          {/* Kinh nghiệm */}
          <section className="flex flex-col gap-4">
            <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 uppercase text-xs tracking-wider">Kinh nghiệm làm việc</h4>
            {data.experience?.map((exp, i) => (
              <div key={i} className="border rounded p-3 bg-zinc-50 dark:bg-zinc-900 flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" className="border rounded px-2 py-1 bg-transparent font-medium" value={exp.company} onChange={(e) => { const ne = [...data.experience!]; ne[i].company = e.target.value; setData({ ...data, experience: ne }); }} />
                  <input type="text" className="border rounded px-2 py-1 bg-transparent text-zinc-600" value={exp.role} onChange={(e) => { const ne = [...data.experience!]; ne[i].role = e.target.value; setData({ ...data, experience: ne }); }} />
                  <input type="text" className="border rounded px-2 py-1 bg-transparent text-right" value={exp.date} onChange={(e) => { const ne = [...data.experience!]; ne[i].date = e.target.value; setData({ ...data, experience: ne }); }} />
                </div>
                <textarea className="border rounded px-2 py-1 bg-transparent min-h-24 w-full" value={exp.bullets.join("\n")} onChange={(e) => { const ne = [...data.experience!]; ne[i].bullets = e.target.value.split("\n"); setData({ ...data, experience: ne }); }} />
              </div>
            ))}
          </section>

          <p className="text-xs text-amber-600">* Để tối giản form, các phần Dự án & Học vấn bạn có thể chuyển qua tab “Sửa mã JSON” để tinh chỉnh chi tiết.</p>
        </div>
      )}
    </div>
  );
}
