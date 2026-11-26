"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { findPdfSourceMatches, type PdfSelectionDocument, type PdfSourceMatch } from "@/lib/mcp/pdf-source-selection";
import { copySourceSelectionContext } from "@/lib/mcp/selection-context";

export function PdfSourceConfirmation({ doc, selected, onCopied, onClose }: {
  doc: PdfSelectionDocument;
  selected: string;
  onCopied: (match: PdfSourceMatch) => void;
  onClose: () => void;
}) {
  const { matches, overflow } = useMemo(() => findPdfSourceMatches(doc, selected), [doc, selected]);
  const [choice, setChoice] = useState<number>();
  const [error, setError] = useState(false);
  const match = matches.length === 1 ? matches[0] : matches[choice ?? -1];
  async function copy() {
    if (!match) return;
    try {
      await copySourceSelectionContext(match.context);
      onCopied(match);
    } catch {
      setError(true);
    }
  }
  return (
    <section aria-label="Xác nhận đoạn nguồn" className="space-y-2 border-b p-3 text-sm">
      {matches.length > 1 && (
        <label className="block">Đoạn này xuất hiện ở nhiều vị trí. Chọn đoạn nguồn tương ứng.
          <select className="block w-full rounded border bg-background p-1" value={choice ?? ""}
            onChange={(event) => setChoice(event.target.value === "" ? undefined : Number(event.target.value))}>
            <option value="">Chọn vị trí trong mã nguồn</option>
            {matches.map(({ context, line }, i) => (
              <option key={i} value={i}>{context.filePath} · dòng {line} · ký tự {context.start + 1}</option>
            ))}
          </select>
        </label>
      )}
      {match && (
        <>
          <p>{match.context.filePath} · dòng {match.line}</p>
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">
            {match.context.prefix.slice(-85)}<mark>{match.context.selectedText}</mark>{match.context.suffix.slice(0, 85)}
          </pre>
        </>
      )}
      {!matches.length && <p role="status">{overflow
        ? "Quá nhiều vị trí trùng khớp. Hãy chọn một cụm dài hơn."
        : "Không tìm thấy đoạn chữ tương ứng. Hãy chọn cụm ngắn hơn hoặc chọn trực tiếp trong tab LaTeX."}</p>}
      <div className="flex gap-2">
        {matches.length > 0 && <Button size="sm" disabled={!match} onClick={() => void copy()}>Sao chép cho GPT</Button>}
        <Button size="sm" variant="ghost" onClick={onClose}>Đóng</Button>
      </div>
      {error && <p role="alert">Trình duyệt chưa cấp quyền sao chép.</p>}
    </section>
  );
}
