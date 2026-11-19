"use client";

import type { PDFDocumentProxy, TextLayer as PdfTextLayer } from "pdfjs-dist";
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { highlightPdfReplacement } from "./pdf-replacement-highlight";
import "./pdf-text-selection-layer.css";

export function PdfTextSelectionLayer({
  pdf,
  page,
  width,
  onSelect,
  highlight,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  width: number;
  onSelect: (text: string) => void;
  highlight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const runRef = useRef(0);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    if (!Number.isFinite(width) || width <= 0) {
      container.replaceChildren();
      return;
    }

    const run = ++runRef.current;
    let cancelled = false;
    let loaded = false;
    let textLayer: PdfTextLayer | undefined;

    const load = async () => {
      try {
        const source = await pdf.getPage(page);
        if (cancelled) return;

        // Keep this in lockstep with PdfPageCanvas: both derive the viewport from
        // the requested CSS width, not from the canvas backing-store resolution.
        const base = source.getViewport({ scale: 1 });
        if (!Number.isFinite(base.width) || base.width <= 0) return;
        const viewport = source.getViewport({ scale: width / base.width });
        const totalScale = viewport.scale * viewport.userUnit;
        const [x1, y1, x2, y2] = viewport.viewBox;

        const { TextLayer } = await import("pdfjs-dist");
        if (cancelled) return;

        container.style.setProperty("--total-scale-factor", String(totalScale));
        textLayer = new TextLayer({
          textContentSource: source.streamTextContent(),
          container,
          viewport,
        });

        // TextLayer's constructor writes a CSS round() size expression. Pin the
        // box to the exact viewport geometry computed above, then let the layer
        // rotate itself for rotated pages via the scoped data-main-rotation rules.
        container.style.width = `${(x2 - x1) * totalScale}px`;
        container.style.height = `${(y2 - y1) * totalScale}px`;

        await textLayer.render();
        loaded = true;
        if (cancelled) return;

        if (highlight) highlightPdfReplacement(textLayer.textDivs, highlight);
      } catch {
        // Cancellation is expected during cleanup; page failures leave the
        // canvas usable without a text-selection overlay.
      } finally {
        // A cancelled TextLayer can still flush one queued text chunk. Only clear
        // if a newer effect run has not already claimed the container.
        if (cancelled && runRef.current === run) container.replaceChildren();
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (!loaded) textLayer?.cancel();
      container.replaceChildren();
    };
  }, [pdf, page, width, highlight]);

  function emitSelection(layer: HTMLDivElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    if (!layer.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
    const text = selection.toString();
    if (text) onSelect(text);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const layer = event.currentTarget;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(layer);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    if (event.key === "Escape") {
      window.getSelection()?.removeAllRanges();
      return;
    }

    if (!event.shiftKey) return;
    const direction =
      event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Home"
        ? "backward"
        : event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "End"
          ? "forward"
          : null;
    if (!direction) return;

    const selection = window.getSelection();
    if (!selection) return;

    if (selection.rangeCount === 0 || !layer.contains(selection.anchorNode)) {
      const spans = layer.querySelectorAll<HTMLElement>('span[role="presentation"]');
      const seed = direction === "forward" ? spans[0] : spans[spans.length - 1];
      if (!seed) return;

      const range = document.createRange();
      range.selectNodeContents(seed);
      range.collapse(direction === "forward");
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (!layer.contains(selection.anchorNode)) return;

    event.preventDefault();
    const granularity =
      event.key === "ArrowUp" || event.key === "ArrowDown"
        ? "line"
        : event.key === "Home" || event.key === "End"
          ? "lineboundary"
          : "character";
    selection.modify?.("extend", direction, granularity);
  }

  function handleMouseUp(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button === 0) emitSelection(event.currentTarget);
  }

  function handleClick(event: ReactMouseEvent<HTMLDivElement>) {
    const layer = event.currentTarget;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const textDiv = target.closest<HTMLElement>('span[role="presentation"]');
    if (!textDiv || !layer.contains(textDiv)) return;

    const selection = window.getSelection();
    if (
      selection?.rangeCount &&
      !selection.isCollapsed &&
      layer.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(textDiv);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const text = textDiv.textContent;
    if (text) onSelect(text);
  }

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`Văn bản PDF, trang ${page}`}
      tabIndex={0}
      className="pdf-text-selection-layer"
      onKeyDown={handleKeyDown}
      onKeyUp={(event) => emitSelection(event.currentTarget)}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    />
  );
}
