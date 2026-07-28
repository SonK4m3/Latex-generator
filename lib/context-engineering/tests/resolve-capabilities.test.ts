// lib/context-engineering/tests/resolve-capabilities.test.ts
import { describe, it, expect } from "vitest";
import { resolveCapabilities } from "@/lib/document-blueprint/resolve-capabilities";
import { CAP } from "@/lib/document-blueprint/capabilities";

describe("resolveCapabilities", () => {
  it("matrix request → matrix + advanced-math, NOT theorem", () => {
    const caps = resolveCapabilities("Hướng dẫn nhân hai ma trận", "math");
    expect(caps).toContain(CAP.MATRIX);
    expect(caps).toContain(CAP.ADVANCED_MATH);
    expect(caps).not.toContain(CAP.THEOREM);
  });

  it("theorem request → theorem, NOT matrix", () => {
    const caps = resolveCapabilities("Chứng minh định lý Pythagoras", "math");
    expect(caps).toContain(CAP.THEOREM);
    expect(caps).not.toContain(CAP.MATRIX);
  });

  it("no keyword match → full template superset (never under-select)", () => {
    const caps = resolveCapabilities("Một tài liệu toán ngắn", "math");
    expect([...caps].sort()).toEqual([CAP.ADVANCED_MATH, CAP.MATRIX, CAP.THEOREM].sort());
  });

  it("unknown/uncovered template → []", () => {
    expect(resolveCapabilities("nhân ma trận", "letter")).toEqual([]);
  });

  it("is diacritic-insensitive (unaccented input still matches)", () => {
    expect(resolveCapabilities("nhan hai ma tran", "math")).toContain(CAP.MATRIX);
  });

  it("is deterministic (declared order, stable across calls)", () => {
    const a = resolveCapabilities("phương trình và ma trận", "math");
    const b = resolveCapabilities("phương trình và ma trận", "math");
    expect(a).toEqual(b);
    // declared order is [advanced-math, theorem, matrix]
    expect(a).toEqual([CAP.ADVANCED_MATH, CAP.MATRIX]);
  });
});
