import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const doubles = vi.hoisted(() => ({ getMcpDocument: vi.fn(), updateMcpSource: vi.fn() }));

vi.mock("@/lib/application/mcp-documents", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/application/mcp-documents")>(),
  getMcpDocument: doubles.getMcpDocument,
}));
vi.mock("@/lib/application/mcp-update-source", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/application/mcp-update-source")>(),
  updateMcpSource: doubles.updateMcpSource,
}));

import { McpOperationError } from "@/lib/application/mcp-operation-error";
import {
  updateMcpSelection,
  updateMcpSelectionInput,
  updateMcpSelectionOutput,
  type UpdateMcpSelectionInput,
} from "@/lib/application/mcp-selection-edit";

type Selection = UpdateMcpSelectionInput["selection"];

const documentId = "4b1b1158-3933-42d5-aed9-76507e8c1540";
const previousUpdatedAt = "2026-11-17T12:00:00.000Z";
const savedUpdatedAt = "2026-11-17T12:01:00.000Z";
const resourceUrl = "https://latex.example.test/api/mcp";
const ctx = {
  supabase: {} as SupabaseClient,
  userId: "c13bb868-bfa6-4ab7-8a67-364dfe435625",
  resourceUrl,
  signal: new AbortController().signal,
};
const saved = {
  documentId,
  updatedAt: savedUpdatedAt,
  webUrl: `https://latex.example.test/documents/${documentId}`,
};
const singleLatex = String.raw`\documentclass{article}
\begin{document}
Hello world.
\end{document}
`;
const chapter = String.raw`\section{Intro}
Hello world here.
`;

function makeSelection(
  content: string,
  start: number,
  end: number,
  filePath = "main.tex",
  overrides: Partial<Selection> = {},
): Selection {
  return {
    schemaVersion: 1,
    documentId,
    updatedAt: previousUpdatedAt,
    filePath,
    start,
    end,
    selectedText: content.slice(start, end),
    prefix: content.slice(Math.max(0, start - 10), start),
    suffix: content.slice(end, end + 10),
    ...overrides,
  };
}

function mockSingle(latex = singleLatex, updatedAt = previousUpdatedAt) {
  doubles.getMcpDocument.mockResolvedValue({
    document: { documentId, updatedAt, isProject: false },
    source: { latex, rootFile: "main.tex", files: null },
  });
}

function mockProject(files: Array<{ path: string; content: string }>, updatedAt = previousUpdatedAt) {
  doubles.getMcpDocument.mockResolvedValue({
    document: { documentId, updatedAt, isProject: true },
    source: { latex: files[0]?.content ?? "", rootFile: "main.tex", files },
  });
}

function selectionIn(content: string, needle: string, filePath = "main.tex") {
  const start = content.indexOf(needle);
  return makeSelection(content, start, start + needle.length, filePath);
}

async function expectNoWrite(promise: Promise<unknown>, code: "invalid_input" | "version_conflict") {
  await expect(promise).rejects.toMatchObject({
    name: "McpOperationError",
    code,
  } satisfies Partial<McpOperationError>);
  expect(doubles.updateMcpSource).not.toHaveBeenCalled();
}

describe("updateMcpSelectionInput schema", () => {
  it("accepts an exact selection and replacement", () => {
    expect(updateMcpSelectionInput.safeParse({
      selection: selectionIn(singleLatex, "world"),
      replacement: "there",
    }).success).toBe(true);
  });

  it.each([
    ["old schema version", { schemaVersion: 2 }],
    ["unsafe file path", { filePath: "../main.tex" }],
    ["fractional offset", { start: 1.5 }],
    ["missing suffix", { suffix: undefined }],
  ])("rejects %s", (_name, patch) => {
    const selection = { ...selectionIn(singleLatex, "world"), ...patch };
    expect(updateMcpSelectionInput.safeParse({ selection, replacement: "x" }).success).toBe(false);
  });

  it("rejects a replacement over 100 KB and unknown fields", () => {
    expect(updateMcpSelectionInput.safeParse({
      selection: selectionIn(singleLatex, "world"),
      replacement: "x".repeat(100_001),
    }).success).toBe(false);
    expect(updateMcpSelectionInput.safeParse({
      selection: selectionIn(singleLatex, "world"),
      replacement: "x",
      extra: true,
    }).success).toBe(false);
  });
});

describe("updateMcpSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces a single-file span through the CAS update", async () => {
    mockSingle();
    doubles.updateMcpSource.mockResolvedValue(saved);
    const selection = selectionIn(singleLatex, "world");
    const expectedLatex = singleLatex.replace("world", "there");

    const result = await updateMcpSelection(ctx, { selection, replacement: "there" });

    expect(doubles.getMcpDocument).toHaveBeenCalledWith(ctx, documentId, true);
    expect(doubles.updateMcpSource).toHaveBeenCalledTimes(1);
    expect(doubles.updateMcpSource).toHaveBeenCalledWith(ctx, {
      documentId,
      expectedUpdatedAt: previousUpdatedAt,
      latex: expectedLatex,
    });
    expect(result).toEqual({
      ...saved,
      filePath: "main.tex",
      changedRange: { start: selection.start, end: selection.start + "there".length },
    });
    expect(updateMcpSelectionOutput.parse(result)).toEqual(result);
  });

  it("patches one project file and leaves other files untouched", async () => {
    const files = [
      { path: "main.tex", content: singleLatex },
      { path: "chapters/intro.tex", content: chapter },
    ];
    mockProject(files);
    doubles.updateMcpSource.mockResolvedValue(saved);
    const selection = selectionIn(chapter, "world", "chapters/intro.tex");

    const result = await updateMcpSelection(ctx, { selection, replacement: "there" });

    expect(doubles.updateMcpSource).toHaveBeenCalledTimes(1);
    expect(doubles.updateMcpSource).toHaveBeenCalledWith(ctx, {
      documentId,
      expectedUpdatedAt: previousUpdatedAt,
      files: [{ path: "chapters/intro.tex", content: chapter.replace("world", "there") }],
    });
    expect(result.filePath).toBe("chapters/intro.tex");
    expect(result.changedRange).toEqual({
      start: selection.start,
      end: selection.start + "there".length,
    });
  });

  it("rejects a stale revision before editing", async () => {
    mockSingle(singleLatex, savedUpdatedAt);
    const selection = selectionIn(singleLatex, "world");

    await expectNoWrite(
      updateMcpSelection(ctx, { selection, replacement: "there" }),
      "version_conflict",
    );
  });

  it.each<[string, (selection: Selection) => Selection]>([
    ["selected text", (selection) => ({ ...selection, selectedText: "World" })],
    ["prefix", (selection) => ({ ...selection, prefix: `X${selection.prefix.slice(1)}` })],
    ["suffix", (selection) => ({ ...selection, suffix: `X${selection.suffix.slice(1)}` })],
  ])("rejects a %s anchor mismatch without writing", async (_name, patch) => {
    mockSingle();
    const selection = patch(selectionIn(singleLatex, "world"));

    await expectNoWrite(
      updateMcpSelection(ctx, { selection, replacement: "there" }),
      "version_conflict",
    );
  });

  it.each([
    ["reversed", (selection: Selection) => ({ start: selection.end, end: selection.start })],
    ["past the end", () => ({ end: singleLatex.length + 1 })],
    ["negative", () => ({ start: -1 })],
  ] as Array<[string, (selection: Selection) => Partial<Selection>]>)(
    "rejects a %s range without writing",
    async (_name, patch) => {
      mockSingle();
      const selection = { ...selectionIn(singleLatex, "world"), ...patch(selectionIn(singleLatex, "world")) };

      await expectNoWrite(
        updateMcpSelection(ctx, { selection, replacement: "there" }),
        "invalid_input",
      );
    },
  );

  it("rejects a missing project path without writing", async () => {
    mockProject([{ path: "main.tex", content: singleLatex }]);
    const selection = selectionIn(chapter, "world", "chapters/missing.tex");

    await expectNoWrite(
      updateMcpSelection(ctx, { selection, replacement: "there" }),
      "invalid_input",
    );
  });

  it("rejects a duplicated project path as ambiguous without writing", async () => {
    mockProject([
      { path: "chapters/intro.tex", content: chapter },
      { path: "chapters/intro.tex", content: `${chapter}duplicate` },
    ]);
    const selection = selectionIn(chapter, "world", "chapters/intro.tex");

    await expectNoWrite(
      updateMcpSelection(ctx, { selection, replacement: "there" }),
      "invalid_input",
    );
  });

  it("rejects a non-main path for a single-file document without writing", async () => {
    mockSingle();
    const selection = selectionIn(singleLatex, "world", "chapters/intro.tex");

    await expectNoWrite(
      updateMcpSelection(ctx, { selection, replacement: "there" }),
      "invalid_input",
    );
  });

  it("does not treat a project with no readable text files as a single-file document", async () => {
    mockProject([]);
    const selection = selectionIn(singleLatex, "world");

    await expectNoWrite(
      updateMcpSelection(ctx, { selection, replacement: "there" }),
      "invalid_input",
    );
  });
});
