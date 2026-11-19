import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectFileEditor from "@/components/ProjectFileEditor";
import type { StoredDocument } from "@/lib/types/document";

const original: StoredDocument = {
  id: "4b1b1158-3933-42d5-aed9-76507e8c1540",
  title: "Report",
  docType: "article",
  template: "academic",
  description: "",
  latex: "\\documentclass{article}",
  attempts: 1,
  messages: [],
  createdAt: "2026-11-17T12:00:00.000Z",
  updatedAt: "2026-11-17T12:00:00.000Z",
  files: [{ path: "main.tex", content: "\\documentclass{article}\nHello world." }],
  rootFile: "main.tex",
};

function nextRevision(content: string): StoredDocument {
  return {
    ...original,
    updatedAt: "2026-11-17T12:01:00.000Z",
    files: [{ path: "main.tex", content }],
  };
}

describe("ProjectFileEditor selection context and realtime updates", () => {
  it("copies file path, saved revision, and exact source span", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ProjectFileEditor doc={original} onSaved={vi.fn()} />);
    const editor = screen.getByRole("textbox", { name: "Mã LaTeX — main.tex" }) as HTMLTextAreaElement;
    const start = editor.value.indexOf("world");
    editor.setSelectionRange(start, start + 5);
    fireEvent.select(editor);

    await userEvent.click(screen.getByRole("button", { name: /copy context cho ai/i }));

    const context = JSON.parse(writeText.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(context).toMatchObject({
      schemaVersion: 1,
      documentId: original.id,
      updatedAt: original.updatedAt,
      filePath: "main.tex",
      start,
      end: start + 5,
      selectedText: "world",
    });
  });

  it("shows an external MCP revision in a clean editor", () => {
    const { rerender } = render(<ProjectFileEditor doc={original} onSaved={vi.fn()} />);
    rerender(<ProjectFileEditor doc={nextRevision("\\documentclass{article}\nEdited by AI.")} onSaved={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Mã LaTeX — main.tex" })).toHaveValue(
      "\\documentclass{article}\nEdited by AI.",
    );
  });

  it("preserves a dirty draft until the user accepts the newer revision", async () => {
    const { rerender } = render(<ProjectFileEditor doc={original} onSaved={vi.fn()} />);
    const editor = screen.getByRole("textbox", { name: "Mã LaTeX — main.tex" });
    await userEvent.type(editor, " local draft");
    rerender(<ProjectFileEditor doc={nextRevision("\\documentclass{article}\nEdited by AI.")} onSaved={vi.fn()} />);

    expect(editor).toHaveValue("\\documentclass{article}\nHello world. local draft");
    await userEvent.click(screen.getByRole("button", { name: "Dùng bản mới nhất" }));
    expect(editor).toHaveValue("\\documentclass{article}\nEdited by AI.");
  });
});
