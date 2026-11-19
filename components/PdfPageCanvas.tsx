"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

export function PdfPageCanvas({ pdf, page, width }: {
  pdf: PDFDocumentProxy;
  page: number;
  width: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | undefined;
    const canvas = ref.current;
    if (!canvas) return;
    void pdf.getPage(page).then((source) => {
      if (cancelled) return;
      const viewport = source.getViewport({ scale: width / source.getViewport({ scale: 1 }).width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      task = source.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      return task.promise;
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, page, width]);

  return (
    <>
      <canvas ref={ref} aria-hidden="true" className="block h-auto" style={{ width }} />
      {failed && <p role="status" className="p-2 text-sm">Không thể hiển thị trang {page}.</p>}
    </>
  );
}
