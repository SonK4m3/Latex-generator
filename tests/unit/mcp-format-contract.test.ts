import { describe, expect, it } from "vitest";

import {
  FULL_DOCUMENT_REQUIREMENTS,
  TemplateSpecSchema,
  getTemplateSpec,
  listTemplateSpecs,
} from "@/lib/templates/mcp-format-contract";
import { docTypeForClass, getTemplate } from "@/lib/templates/registry";
import { TEMPLATE_IDS } from "@/lib/types/document";

const SPEC_KEYS = [
  "capabilities",
  "category",
  "description",
  "docType",
  "documentClass",
  "fullDocumentRequirements",
  "id",
  "label",
  "packageAllowlist",
  "packages",
  "promptGuidance",
];

describe("MCP template format contract", () => {
  it("lists every registry template in exact TEMPLATE_IDS order", () => {
    const specs = listTemplateSpecs();
    expect(specs).toHaveLength(TEMPLATE_IDS.length);
    expect(specs.map((spec) => spec.id)).toEqual([...TEMPLATE_IDS]);
    specs.forEach((spec, index) => expect(spec.id).toBe(TEMPLATE_IDS[index]));
  });

  it("returns the same validated spec for every TemplateId", () => {
    const listed = listTemplateSpecs();
    for (const id of TEMPLATE_IDS) {
      const spec = getTemplateSpec(id);
      expect(spec).toEqual(listed.find((item) => item.id === id));
      expect(TemplateSpecSchema.parse(spec)).toEqual(spec);
    }
  });

  it("maps docType through docTypeForClass for each documentClass", () => {
    for (const id of TEMPLATE_IDS) {
      const template = getTemplate(id);
      const spec = getTemplateSpec(id);
      expect(spec.documentClass).toBe(template.documentClass);
      expect(spec.docType).toBe(docTypeForClass(template.documentClass));
    }
    expect(getTemplateSpec("thesis").docType).toBe("report");
    expect(getTemplateSpec("report").docType).toBe("report");
    expect(getTemplateSpec("slides").docType).toBe("article");
    expect(getTemplateSpec("exam").docType).toBe("article");
    expect(getTemplateSpec("letter").docType).toBe("article");
  });

  it("copies suggested packages, allowlists, and capability flags from the registry", () => {
    for (const id of TEMPLATE_IDS) {
      const template = getTemplate(id);
      const spec = getTemplateSpec(id);
      expect(spec.packages).toEqual(template.packages);
      expect(spec.packageAllowlist).toEqual(template.packageAllowlist ?? []);
      expect(spec.capabilities).toEqual(template.capabilities ?? {});
      expect(Object.values(spec.capabilities).every((flag) => typeof flag === "boolean")).toBe(true);
      expect(spec.label).toBe(template.label);
      expect(spec.category).toBe(template.category);
      expect(spec.description).toBe(template.description);
      expect(spec.promptGuidance).toBe(template.promptGuidance);
    }
  });

  it("defaults absent allowlist and capabilities safely", () => {
    const withoutOptional = Object.fromEntries(
      Object.entries(getTemplateSpec("academic")).filter(
        ([key]) => key !== "packageAllowlist" && key !== "capabilities",
      ),
    );
    const parsed = TemplateSpecSchema.parse(withoutOptional);
    expect(parsed.packageAllowlist).toEqual([]);
    expect(parsed.capabilities).toEqual({});
  });

  it("is JSON-serializable and exposes no render, repair, or clarification internals", () => {
    for (const spec of listTemplateSpecs()) {
      expect(() => JSON.stringify(spec)).not.toThrow();
      expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
      expect(Object.keys(spec).sort()).toEqual(SPEC_KEYS);
      expect(spec).not.toHaveProperty("renderMock");
      expect(spec).not.toHaveProperty("repairHints");
      expect(spec).not.toHaveProperty("clarificationFields");
      expect(spec).not.toHaveProperty("knownTheoremEnvironments");
    }
  });

  it("states the generic full-document requirements explicitly", () => {
    for (const spec of listTemplateSpecs()) {
      const requirements = spec.fullDocumentRequirements;
      expect(requirements).toEqual(FULL_DOCUMENT_REQUIREMENTS);
      expect(requirements.rawLatexOnly).toBe(true);
      expect(requirements.completeDocument).toBe(true);
      expect(requirements.requiredMarkers).toEqual(
        expect.arrayContaining(["\\documentclass", "\\begin{document}", "\\end{document}"]),
      );
      expect(requirements.encoding).toBe("UTF-8");
      expect(requirements.engine).toBe("XeLaTeX");
      expect(requirements.markdownFences).toBe(false);
      expect(requirements.rules.length).toBeGreaterThanOrEqual(3);
    }
  });
});
