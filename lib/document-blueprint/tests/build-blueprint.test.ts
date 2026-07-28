// lib/document-blueprint/tests/build-blueprint.test.ts
import { describe, it, expect } from "vitest";
import { buildBlueprint } from "@/lib/document-blueprint/build-blueprint";

describe("buildBlueprint (deterministic adapter)", () => {
  it("create intent + Vietnamese + math capabilities", () => {
    const bp = buildBlueprint(
      { description: "Chứng minh định lý Pythagoras", docType: "article", template: "math" },
      { requestId: "r" },
    );
    expect(bp.intent).toBe("create");
    expect(bp.language).toBe("vi");
    expect(bp.templateId).toBe("math");
    expect(bp.capabilities).toContain("theorem");
    expect(bp.requestId).toBe("r");
    expect(bp.generationMode).toBe("single-shot");
    expect(bp.confidence).toBe(1);
  });

  it("repair intent when errorContext present", () => {
    const bp = buildBlueprint({
      description: "x",
      docType: "article",
      template: "math",
      errorContext: { previousLatex: "", errorLog: "" },
    });
    expect(bp.intent).toBe("repair");
  });

  it("edit intent when editContext present", () => {
    const bp = buildBlueprint({
      description: "x",
      docType: "article",
      template: "math",
      editContext: { currentLatex: "", instruction: "đổi tiêu đề" },
    });
    expect(bp.intent).toBe("edit");
  });

  it("detects English", () => {
    const bp = buildBlueprint({ description: "Prove the theorem", docType: "article", template: "math" });
    expect(bp.language).toBe("en");
  });

  it("generates a requestId when none is provided", () => {
    const bp = buildBlueprint({ description: "x", docType: "article", template: "math" });
    expect(bp.requestId.length).toBeGreaterThan(0);
  });
});
