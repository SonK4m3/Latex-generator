// lib/context-engineering/tests/pipeline.test.ts
import { describe, it, expect } from "vitest";
import { assembleContext } from "@/lib/context-engineering/pipeline";
import { buildBlueprint } from "@/lib/document-blueprint/build-blueprint";

describe("assembleContext (math generation)", () => {
  it("renders {system,user} + trace and narrows to matrix (not theorem)", () => {
    const description = "Hướng dẫn nhân hai ma trận cho sinh viên năm nhất";
    const blueprint = buildBlueprint(
      { description, docType: "article", template: "math" },
      { requestId: "req-1" },
    );
    const assembled = assembleContext({ blueprint, description });
    expect(assembled).not.toBeNull();
    const a = assembled!;

    const ids = a.trace.selectedBlocks.map((b) => b.id);
    expect(ids).toContain("math-cap-matrix");
    expect(ids).not.toContain("math-cap-theorem");

    // Parity: the assembled prompt still carries the key invariants of the legacy math prompt.
    const full = `${a.rendered.system}\n${a.rendered.user}`;
    expect(full).toContain("LaTeX document engine"); // global SYSTEM_PROMPT
    expect(full).toContain("FORBIDDEN: $$"); // math constraints
    expect(full).toContain("<output_requirements>"); // output contract
    expect(a.rendered.user).toContain("nhân hai ma trận"); // the actual user request

    // Trace completeness.
    expect(a.trace.requestId).toBe("req-1");
    expect(a.trace.estimatedInputTokens).toBeGreaterThan(0);
    expect(a.trace.droppedBlocks.some((d) => d.id === "math-cap-theorem")).toBe(true);
  });

  it("returns null for a template without block coverage (fallback signal)", () => {
    const description = "Thư xin việc gửi công ty";
    const blueprint = buildBlueprint(
      { description, docType: "article", template: "letter" },
      { requestId: "req-2" },
    );
    expect(assembleContext({ blueprint, description })).toBeNull();
  });

  it("a vague math request keeps the full guidance superset (safety default)", () => {
    const description = "Một tài liệu toán ngắn";
    const blueprint = buildBlueprint(
      { description, docType: "article", template: "math" },
      { requestId: "req-3" },
    );
    const ids = assembleContext({ blueprint, description })!.trace.selectedBlocks.map((b) => b.id);
    expect(ids).toContain("math-cap-theorem");
    expect(ids).toContain("math-cap-matrix");
    expect(ids).toContain("math-cap-advanced-math");
  });
});
