import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopySelectionContextButton } from "@/components/CopySelectionContextButton";
import type { SourceSelectionContext } from "@/lib/mcp/selection-context";

const context: SourceSelectionContext = {
  schemaVersion: 1,
  documentId: "4b1b1158-3933-42d5-aed9-76507e8c1540",
  updatedAt: "2026-11-17T12:00:00.000Z",
  filePath: "main.tex",
  start: 6,
  end: 11,
  selectedText: "world",
  prefix: "Hello ",
  suffix: "!",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CopySelectionContextButton", () => {
  it("copies selection metadata when clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<CopySelectionContextButton context={context} />);

    await userEvent.click(screen.getByRole("button", { name: /copy context cho ai/i }));

    expect(writeText).toHaveBeenCalledWith(JSON.stringify(context, null, 2));
    expect(await screen.findByRole("button", { name: /đã copy context/i })).toBeInTheDocument();
  });

  it("explains that unsaved source must be saved first", () => {
    render(<CopySelectionContextButton context={null} disabled />);

    expect(screen.getByRole("button", { name: /copy context cho ai/i })).toBeDisabled();
    expect(screen.getByText(/lưu bản nháp trước/i)).toBeInTheDocument();
  });
});
