import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { McpOperationError } from "@/lib/application/mcp-operation-error";
import { updateMcpSource, updateMcpSourceInput } from "@/lib/application/mcp-update-source";

const validInput = {
  documentId: "4b1b1158-3933-42d5-aed9-76507e8c1540",
  expectedUpdatedAt: "2026-11-17T12:00:00.000Z",
};

describe("project text source updates", () => {
  it("accepts text patches for existing project paths", () => {
    expect(updateMcpSourceInput.safeParse({
      ...validInput,
      files: [{ path: "chapters/intro.tex", content: "Updated text" }],
    }).success).toBe(true);
  });

  it.each([
    { files: [] },
    { files: [{ path: "../secret.tex", content: "x" }] },
    { files: [{ path: "main.tex", content: "bad\0text" }] },
    { files: [{ path: "main.tex", content: "x" }, { path: "main.tex", content: "y" }] },
    { files: [{ path: "main.tex", content: "x" }], latex: "also supplied" },
    { latex: "   " },
  ])("rejects an invalid update shape: %j", (patch) => {
    expect(updateMcpSourceInput.safeParse({ ...validInput, ...patch }).success).toBe(false);
  });

  it("rejects a text patch over the 100 KB limit", () => {
    const result = updateMcpSourceInput.safeParse({
      ...validInput,
      files: [{ path: "main.tex", content: "x".repeat(100_001) }],
    });
    expect(result.success).toBe(false);
  });

  it("calls the project patch RPC and returns the editor URL", async () => {
    const rpc = vi.fn().mockReturnValue({
      abortSignal: vi.fn().mockResolvedValue({
        data: { documentId: validInput.documentId, updatedAt: "2026-11-17T12:01:00.000Z" },
        error: null,
      }),
    });
    const result = await updateMcpSource({
      supabase: { rpc } as unknown as SupabaseClient,
      resourceUrl: "https://latex.example.test/api/mcp",
      signal: new AbortController().signal,
    }, {
      ...validInput,
      files: [{ path: "main.tex", content: "Updated root" }],
    });

    expect(rpc).toHaveBeenCalledWith("mcp_update_document_project_text", {
      p_document_id: validInput.documentId,
      p_expected_updated_at: validInput.expectedUpdatedAt,
      p_files: [{ path: "main.tex", content: "Updated root" }],
    });
    expect(result.webUrl).toBe(`https://latex.example.test/documents/${validInput.documentId}`);
  });

  it("keeps single-file updates on the existing RPC", async () => {
    const rpc = vi.fn().mockReturnValue({
      abortSignal: vi.fn().mockResolvedValue({
        data: { documentId: validInput.documentId, updatedAt: "2026-11-17T12:01:00.000Z" },
        error: null,
      }),
    });
    await updateMcpSource({
      supabase: { rpc } as unknown as SupabaseClient,
      resourceUrl: "https://latex.example.test/api/mcp",
      signal: new AbortController().signal,
    }, { ...validInput, latex: String.raw`\documentclass{article}\begin{document}Hi\end{document}` });
    expect(rpc).toHaveBeenCalledWith("mcp_update_document_source", {
      p_document_id: validInput.documentId,
      p_expected_updated_at: validInput.expectedUpdatedAt,
      p_latex: expect.stringContaining("documentclass"),
    });
  });

  it("keeps the single-file byte limit for multibyte source", async () => {
    const rpc = vi.fn();
    await expect(updateMcpSource({
      supabase: { rpc } as unknown as SupabaseClient,
      resourceUrl: "https://latex.example.test/api/mcp",
      signal: new AbortController().signal,
    }, { ...validInput, latex: "ế".repeat(40_000) })).rejects.toMatchObject({ code: "invalid_input" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a project RPC validation error to a safe input error", async () => {
    const rpc = vi.fn().mockReturnValue({
      abortSignal: vi.fn().mockResolvedValue({ data: null, error: { code: "PT422" } }),
    });
    await expect(updateMcpSource({
      supabase: { rpc } as unknown as SupabaseClient,
      resourceUrl: "https://latex.example.test/api/mcp",
      signal: new AbortController().signal,
    }, {
      ...validInput,
      files: [{ path: "asset.pdf", content: "not editable" }],
    })).rejects.toMatchObject({
      name: "McpOperationError",
      code: "invalid_input",
    } satisfies Partial<McpOperationError>);
  });
});
