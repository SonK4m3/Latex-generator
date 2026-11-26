"use client";

import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import PdfPreview from "./PdfPreview";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { PdfTextSelectionLayer } from "./pdf-text-selection-layer";
import { PdfSourceConfirmation } from "./pdf-source-confirmation";
import { getPdfReplacement, type PdfSelectionDocument, type PdfSourceMatch } from "@/lib/mcp/pdf-source-selection";

type PdfSource = {
  /** PDF URL served by the authenticated API, preferred for fresh revisions. */
  url?: string;
  /** Legacy PATCH/GET payload kept as a fallback while the API is rolled out. */
  base64?: string;
};

export default function WorkspacePdfViewer({
  documentId,
  pdfBase64,
  hasPdf,
  sourceRevision,
  pdfSourceRevision,
  pending = false,
  fileName,
  selectionDocument,
  selectionBlocked,
}: {
  documentId: string;
  pdfBase64?: string;
  hasPdf?: boolean;
  sourceRevision?: string;
  pdfSourceRevision?: string;
  pending?: boolean;
  fileName: string;
  selectionDocument?: PdfSelectionDocument;
  selectionBlocked?: boolean;
}) {
  const [loaded, setLoaded] = useState<{ source: string; pdf: PDFDocumentProxy }>();
  const [failure, setFailure] = useState<{ source: string; attempt: number }>();
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(320);
  const [showPages, setShowPages] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<{ text: string; page: number; revision: string; id: string }>();
  const [copied, setCopied] = useState<{ match: PdfSourceMatch; page: number }>();
  const [selectMode, setSelectMode] = useState(false);
  const scroll = useRef({ page: 1, top: 0, left: 0 });

  // The PDF bytes come from the authenticated API. The cache-busting revision keeps a compiled PDF
  // from being served stale after `pdfSourceRevision` changes.
  const pdfUrl = useMemo(() => {
    if (!documentId) return undefined;
    if (!hasPdf && !pdfSourceRevision) return undefined;
    const query = pdfSourceRevision ? `?revision=${encodeURIComponent(pdfSourceRevision)}` : "";
    return `/api/documents/${encodeURIComponent(documentId)}/pdf${query}`;
  }, [documentId, hasPdf, pdfSourceRevision]);

  // Legacy PATCH/GET payloads carry the newest bytes inline; use them while present. Workspace
  // reads exclude the PDF, so a fresh document falls back to the authenticated URL. When realtime
  // reports a newer `pdfSourceRevision`, the merge drops the old base64 and the URL takes over.
  const source = useMemo<PdfSource>(
    () => (pdfBase64 ? { base64: pdfBase64 } : { url: pdfUrl }),
    [pdfBase64, pdfUrl],
  );
  const sourceKey = pdfBase64 ?? pdfUrl;
  const pdf = loaded && loaded.source === sourceKey ? loaded.pdf : undefined;
  const count = pdf?.numPages ?? 0;
  const current = Math.max(1, Math.min(page, count || 1));
  const stale = Boolean(
    pdfSourceRevision && sourceRevision && pdfSourceRevision !== sourceRevision,
  );
  const unknown = Boolean(
    (hasPdf || pdfBase64) && (!pdfSourceRevision || !sourceRevision),
  );
  const hasSource = Boolean(pdfBase64 || pdfUrl);
  const selectable = selectionDocument?.id === documentId && !!sourceRevision &&
    sourceRevision === pdfSourceRevision && !selectionBlocked;
  const visiblePick = selectable && selectMode && pick?.id === documentId && pick.page === current &&
    pick.revision === selectionDocument?.updatedAt ? pick : undefined;
  const highlight = selectable && selectionDocument && copied?.page === current
    ? getPdfReplacement(selectionDocument, copied.match) : undefined;

  useEffect(() => {
    if (!sourceKey) return;
    let stopped = false;
    let task: PDFDocumentLoadingTask | undefined;
    const abort = new AbortController();

    const load = async () => {
      const read = async (): Promise<{ key: string; bytes: Uint8Array }> => {
        if (source.url) {
          const response = await fetch(source.url, {
            credentials: "same-origin",
            cache: "no-store",
          signal: abort.signal,
          });
          if (!response.ok) throw new Error(`pdf_http_${response.status}`);
          return { key: source.url, bytes: new Uint8Array(await response.arrayBuffer()) };
        }
        if (!source.base64) throw new Error("missing_pdf_source");
        return { key: source.base64, bytes: decodeBase64(source.base64) };
      };

      try {
        let payload: { key: string; bytes: Uint8Array };
        try {
          payload = await read();
        } catch (error) {
          // URL failed but a legacy inline PDF is available: display it rather than an empty pane.
          if (source.base64) {
            payload = { key: sourceKey ?? source.base64, bytes: decodeBase64(source.base64) };
          } else {
            throw error;
          }
        }
        if (stopped) return;
        const api = await import("pdfjs-dist");
        if (stopped) return;
        api.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        task = api.getDocument({ data: payload.bytes });
        const document = await task.promise;
        if (stopped) return;
        setLoaded({ source: payload.key, pdf: document });
      } catch {
        if (!stopped) setFailure({ source: sourceKey, attempt });
      }
    };

    void load();
    return () => {
      stopped = true;
      abort.abort();
      void task?.destroy().catch(() => {});
    };
  }, [source, sourceKey, pdfBase64, attempt]);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(100, Math.floor(entry.contentRect.width))),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [pdf]);

  useEffect(() => {
    const region = viewport.current;
    const sheet = region?.firstElementChild;
    if (!pdf || !region || !sheet) return;
    const position = scroll.current;
    if (position.page !== current || (!position.top && !position.left)) {
      region.scrollTo({ top: 0, left: 0 });
      return;
    }
    // Canvas dimensions arrive asynchronously after the replacement PDF is loaded.
    const observer = new ResizeObserver(() => {
      region.scrollTo({ top: position.top, left: position.left });
      if (sheet.querySelector("canvas")?.hasAttribute("height")) observer.disconnect();
    });
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [current, pdf]);

  function download() {
    const url = source.url ?? URL.createObjectURL(
      new Blob([Uint8Array.from(decodeBase64(source.base64 ?? ""))], { type: "application/pdf" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    if (!source.url) window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  if (!hasSource) {
    return (
      <div className="flex flex-col gap-1 p-3 text-sm text-muted-foreground" role="status">
        <p>Chưa có PDF. Biên dịch mã LaTeX để xem bản mới.</p>
        {pending && <p aria-live="polite">Đang biên dịch PDF…</p>}
      </div>
    );
  }

  if (failure?.source === sourceKey && failure?.attempt === attempt) {
    return (
      <div className="flex flex-col gap-2 p-3 text-sm">
        <p role="alert" className="text-destructive">
          Không tải được PDF từ máy chủ.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            Thử lại
          </Button>
          {pending && <span role="status" className="text-muted-foreground">Đang biên dịch PDF…</span>}
        </div>
        {pdfBase64 && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground">Đang hiển thị bản PDF dự phòng.</p>
            <PdfPreview pdfBase64={pdfBase64} />
          </div>
        )}
      </div>
    );
  }

  if (!pdf) {
    return (
      <p role="status" className="p-3 text-sm">
        Đang tải PDF…
      </p>
    );
  }

  return (
    <section aria-label="Xem trước PDF" className="@container min-w-0">
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1">
        <Button size="sm" variant="ghost" className="@[900px]:hidden" aria-controls="pdf-page-list" aria-expanded={showPages} onClick={() => setShowPages(!showPages)}>Trang</Button>
        <Button size="sm" variant="ghost" disabled={current === 1} onClick={() => setPage(current - 1)}>Trước</Button>
        <label className="flex items-center gap-1 text-sm">
          Trang
          <input aria-label="Trang hiện tại" type="number" min={1} max={count} value={current} className="w-12 rounded border bg-background px-1" onChange={(event) => {
            const value = event.currentTarget.valueAsNumber;
            if (Number.isInteger(value)) setPage(Math.max(1, Math.min(value, count)));
          }} />
          / {count}
        </label>
        <Button size="sm" variant="ghost" disabled={current === count} onClick={() => setPage(current + 1)}>Sau</Button>
        <Button size="sm" variant="ghost" aria-label="Thu nhỏ" disabled={zoom <= 0.5} onClick={() => setZoom(zoom - 0.25)}>−</Button>
        <Button size="sm" variant="ghost" title="Vừa chiều rộng" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</Button>
        <Button size="sm" variant="ghost" aria-label="Phóng to" disabled={zoom >= 2} onClick={() => setZoom(zoom + 0.25)}>+</Button>
        {selectionDocument && <Button size="sm" variant="outline" aria-pressed={selectMode && selectable}
          disabled={!selectable} onClick={() => { setSelectMode(!selectMode); setPick(undefined); }}>
          Chọn đoạn cho GPT
        </Button>}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void download()}>Tải PDF</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-2 py-1 text-xs" role="status" aria-live="polite">
        {selectionBlocked && <span>Hãy lưu hoặc xử lý thay đổi đang chờ để chọn đoạn từ PDF.</span>}
        {selectMode && selectable && !visiblePick && <span>Bấm hoặc kéo chọn chữ trên trang PDF.</span>}
        {selectable && copied?.match.context.documentId === documentId &&
          copied.match.context.updatedAt === selectionDocument?.updatedAt && <span>Đã sao chép. Dán vào ChatGPT để yêu cầu sửa đoạn này.</span>}
        {pending && <span className="text-muted-foreground">Đang biên dịch PDF…</span>}
        {unknown && <span className="text-muted-foreground">Phiên bản PDF không xác định</span>}
        {stale && <span className="text-destructive">PDF cũ hơn mã nguồn — cần biên dịch lại</span>}
      </div>
      {visiblePick && selectionDocument && <PdfSourceConfirmation
        key={JSON.stringify(visiblePick)} doc={selectionDocument} selected={visiblePick.text}
        onClose={() => setPick(undefined)} onCopied={(match) => {
          setCopied({ match, page: current }); setPick(undefined);
        }} />}
      <div className="flex min-w-0 flex-col @[900px]:flex-row">
        <nav id="pdf-page-list" aria-label="Danh sách trang PDF" className={`${showPages ? "block" : "hidden"} max-h-40 overflow-auto border-b bg-muted p-2 @[900px]:block @[900px]:max-h-[70dvh] @[900px]:w-28 @[900px]:shrink-0 @[900px]:border-r`}>
          <ol className="flex gap-1 @[900px]:flex-col">
            {Array.from({ length: count }, (_, index) => index + 1).map((item) => (
              <li key={item} className="shrink-0">
                <button type="button" aria-current={current === item ? "page" : undefined} className="flex min-w-16 flex-col items-center gap-1 rounded border border-transparent p-1 text-xs aria-[current=page]:border-primary focus-visible:ring-2" onClick={() => { setPage(item); }}>
                  {Math.abs(item - current) <= 3 && <PdfPageCanvas pdf={pdf} page={item} width={58} />}
                  Trang {item}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div ref={viewport} role="region" aria-label={`Nội dung PDF, trang ${current} trên ${count}`} tabIndex={0}
          onScroll={(event) => { scroll.current = { page: current, top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft }; }}
          className="max-h-[70dvh] min-w-0 flex-1 overflow-auto bg-muted p-3">
          <div className="relative mx-auto w-max bg-white shadow-sm">
            <PdfPageCanvas key={current} pdf={pdf} page={current} width={Math.floor(width * zoom)} />
            {selectable && selectionDocument && selectMode && <PdfTextSelectionLayer
              key={`text-${current}`} pdf={pdf} page={current} width={Math.floor(width * zoom)}
              highlight={highlight} onSelect={(text) => setPick({ text, page: current, revision: selectionDocument.updatedAt, id: documentId })} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function decodeBase64(pdfBase64: string): Uint8Array {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
