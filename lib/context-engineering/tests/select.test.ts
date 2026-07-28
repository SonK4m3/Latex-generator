// lib/context-engineering/tests/select.test.ts
import { describe, it, expect } from "vitest";
import { selectContextBlocks } from "@/lib/context-engineering/selectors/select";
import { contextRegistry } from "@/lib/context-engineering/registry";
import { CAP } from "@/lib/document-blueprint/capabilities";
import type { DocumentBlueprint } from "@/lib/document-blueprint/types";

function mathBlueprint(capabilities: string[]): DocumentBlueprint {
  return {
    requestId: "req-test",
    intent: "create",
    templateId: "math",
    topic: "t",
    language: "vi",
    depth: "standard",
    capabilities,
    explicitRequirements: [],
    inferredRequirements: [],
    generationMode: "single-shot",
    ambiguity: "low",
    confidence: 1,
  };
}

describe("selectContextBlocks (generation)", () => {
  it("matrix request selects matrix guidance + example, NOT theorem ones", () => {
    const selected = selectContextBlocks({
      stage: "generation",
      blueprint: mathBlueprint([CAP.MATRIX, CAP.ADVANCED_MATH]),
      candidates: contextRegistry,
    });
    const ids = selected.map((b) => b.id);
    expect(ids).toContain("math-cap-matrix");
    expect(ids).toContain("math-cap-advanced-math");
    expect(ids).toContain("math-ex-matrix");
    expect(ids).not.toContain("math-cap-theorem");
    expect(ids).not.toContain("math-ex-theorem");
  });

  it("theorem request selects theorem guidance, NOT matrix", () => {
    const ids = selectContextBlocks({
      stage: "generation",
      blueprint: mathBlueprint([CAP.THEOREM]),
      candidates: contextRegistry,
    }).map((b) => b.id);
    expect(ids).toContain("math-cap-theorem");
    expect(ids).not.toContain("math-cap-matrix");
  });

  it("always retains the critical/base contracts regardless of capabilities", () => {
    const ids = selectContextBlocks({
      stage: "generation",
      blueprint: mathBlueprint([CAP.MATRIX]),
      candidates: contextRegistry,
    }).map((b) => b.id);
    expect(ids).toContain("global-latex-contract");
    expect(ids).toContain("math-base");
    expect(ids).toContain("math-constraints");
    expect(ids).toContain("latex-output-contract");
  });
});
