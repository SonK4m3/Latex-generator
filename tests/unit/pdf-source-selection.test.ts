import { describe, expect, it } from "vitest";
import { findPdfSourceMatches, getPdfReplacement } from "@/lib/mcp/pdf-source-selection";
import { highlightPdfReplacement } from "@/components/pdf-replacement-highlight";

const doc = { id: "doc", updatedAt: "v1", latex: "Một 😀 câu.\n\\newpage\nHai 😀\n  câu." };

describe("PDF text to MCP selection", () => {
  it("marks a unique replacement spanning rendered lines and leaves repeated text alone", () => {
    const layer = document.createElement("div");
    layer.innerHTML = "<span>Câu đầu, phần</span><br><span>tiếp của câu.</span><span> Câu đầu</span>";
    const spans = Array.from(layer.querySelectorAll("span"));
    highlightPdfReplacement(spans, "Câu đầu");
    expect(layer.querySelector("mark")).toBeNull();
    highlightPdfReplacement(spans, "phần tiếp");
    expect(Array.from(layer.querySelectorAll("mark"), (mark) => mark.textContent)).toEqual(["phần", "tiếp"]);
  });

  it("preserves each occurrence's raw UTF-16 range across line wraps", () => {
    const { matches } = findPdfSourceMatches(doc, "😀 câu.");
    expect(matches.map((m) => m.line)).toEqual([1, 3]);
    const second = matches[1];
    expect(second.context.selectedText).toBe("😀\n  câu.");
    const latex = doc.latex.slice(0, second.context.start) + "Bản mới." + doc.latex.slice(second.context.end);
    expect(latex).toBe("Một 😀 câu.\n\\newpage\nHai Bản mới.");
    expect(getPdfReplacement({ ...doc, updatedAt: "v2", latex }, second)).toBe("Bản mới.");
    expect(getPdfReplacement({ ...doc, updatedAt: "v3", latex: "Khác " + latex }, second)).toBeUndefined();
  });

  it("keeps project file identity and rejects unresolvable or excessively ambiguous text", () => {
    const project = { ...doc, files: [
      { path: "main.tex", content: "Chào" }, { path: "chuong.tex", content: "Chào" },
      { path: "asset.png", contentBase64: "Chào" },
    ] };
    expect(findPdfSourceMatches(project, "Chào").matches.map((m) => m.context.filePath))
      .toEqual(["main.tex", "chuong.tex"]);
    expect(findPdfSourceMatches(project, "khác").matches).toEqual([]);
    expect(findPdfSourceMatches({ ...doc, latex: "a".repeat(13) }, "a")).toEqual({ matches: [], overflow: true });
  });
});
