import { describe, expect, it, vi } from "vitest";
import { copySourceSelectionContext, createSourceSelectionContext } from "@/lib/mcp/selection-context";

describe("source selection context", () => {
  it("captures exact text, textarea offsets, and bounded neighboring anchors", () => {
    const source = `${"a".repeat(300)}\n\\section{Title}\n${"b".repeat(300)}`;
    const start = source.indexOf("Title");
    const context = createSourceSelectionContext({
      documentId: "4b1b1158-3933-42d5-aed9-76507e8c1540",
      updatedAt: "2026-11-17T12:00:00.000Z",
      filePath: "chapters/intro.tex",
      source,
      selection: { start, end: start + "Title".length, source, updatedAt: "2026-11-17T12:00:00.000Z" },
    });

    expect(context).toEqual({
      schemaVersion: 1,
      documentId: "4b1b1158-3933-42d5-aed9-76507e8c1540",
      updatedAt: "2026-11-17T12:00:00.000Z",
      filePath: "chapters/intro.tex",
      start,
      end: start + "Title".length,
      selectedText: "Title",
      prefix: source.slice(start - 256, start),
      suffix: source.slice(start + "Title".length, start + "Title".length + 256),
    });
  });

  it.each([
    { start: -1, end: 2 },
    { start: 2, end: 2 },
    { start: 0.5, end: 2 },
    { start: 0, end: 99 },
  ])("does not create an invalid or empty selection payload", ({ start, end }) => {
    expect(createSourceSelectionContext({
      documentId: "4b1b1158-3933-42d5-aed9-76507e8c1540",
      updatedAt: "2026-11-17T12:00:00.000Z",
      filePath: "main.tex",
      source: "Hello",
      selection: { start, end, source: "Hello", updatedAt: "2026-11-17T12:00:00.000Z" },
    })).toBeNull();
  });

  it("invalidates a previously selected span after its source or revision changes", () => {
    const selection = { start: 6, end: 11, source: "Hello world", updatedAt: "2026-11-17T12:00:00.000Z" };
    const base = {
      documentId: "4b1b1158-3933-42d5-aed9-76507e8c1540",
      filePath: "main.tex",
      selection,
    };

    expect(createSourceSelectionContext({ ...base, source: "Hello there", updatedAt: "2026-11-17T12:00:00.000Z" })).toBeNull();
    expect(createSourceSelectionContext({ ...base, source: "Hello world", updatedAt: "2026-11-17T12:01:00.000Z" })).toBeNull();
  });

  it("copies the structured payload only when explicitly requested", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const context = createSourceSelectionContext({
      documentId: "4b1b1158-3933-42d5-aed9-76507e8c1540",
      updatedAt: "2026-11-17T12:00:00.000Z",
      filePath: "main.tex",
      source: "Hello",
      selection: { start: 0, end: 5, source: "Hello", updatedAt: "2026-11-17T12:00:00.000Z" },
    });

    await copySourceSelectionContext(context!);

    expect(writeText).toHaveBeenCalledWith(JSON.stringify(context, null, 2));
  });
});
