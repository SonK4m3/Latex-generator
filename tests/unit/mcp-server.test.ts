import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { McpPrincipal } from "@/lib/auth/mcp-principal";
import { createLatexMcpServer } from "@/lib/mcp/server";
import { getTemplateSpec, TemplateSpecSchema } from "@/lib/templates/mcp-format-contract";
import { TEMPLATE_IDS } from "@/lib/types/document";

const principal = {
  userId: "user_test",
  scopes: ["openid"],
  supabase: {} as McpPrincipal["supabase"],
  requestId: "request_test",
} satisfies McpPrincipal;

async function connectServer() {
  const server = createLatexMcpServer(principal, "https://example.test/api/mcp");
  const client = new Client({ name: "mcp-server-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

describe("MCP server template format tool", () => {
  it("exposes exact source-span editing as a write tool", async () => {
    const { client, close } = await connectServer();
    try {
      const { tools } = await client.listTools();
      const tool = tools.find(({ name }) => name === "edit_document_selection");
      expect(tool).toBeDefined();
      expect(tool?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      });
      expect(tool?.inputSchema).toMatchObject({
        type: "object",
        required: ["selection", "replacement"],
        additionalProperties: false,
      });
      expect(tool?.inputSchema.properties).toHaveProperty("selection");
      expect(tool?.inputSchema.properties).toHaveProperty("replacement");
    } finally {
      await close();
    }
  });

  it("discovers get_template_spec as a read-only tool without breaking list_templates", async () => {
    const { client, close } = await connectServer();
    try {
      const { tools } = await client.listTools();
      const tool = tools.find(({ name }) => name === "get_template_spec");
      expect(tool).toBeDefined();
      expect(tool?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
      expect(tool?.inputSchema).toMatchObject({
        type: "object",
        required: ["templateId"],
        additionalProperties: false,
      });

      const listTool = tools.find(({ name }) => name === "list_templates");
      expect(listTool?.annotations).toMatchObject({ readOnlyHint: true });
      const listed = await client.callTool({ name: "list_templates", arguments: {} });
      const listedPayload = z.object({
        schemaVersion: z.literal(1),
        templates: z.array(z.unknown()),
      }).parse(listed.structuredContent);
      expect(listedPayload.schemaVersion).toBe(1);
      expect(listedPayload.templates).toHaveLength(TEMPLATE_IDS.length);
    } finally {
      await close();
    }
  });

  it("returns the schemaVersion 1 envelope with the validated full spec for slides", async () => {
    const { client, close } = await connectServer();
    try {
      const response = await client.callTool({
        name: "get_template_spec",
        arguments: { templateId: "slides" },
      });
      const payload = z.object({
        schemaVersion: z.literal(1),
        template: TemplateSpecSchema,
      }).parse(response.structuredContent);
      expect(payload.schemaVersion).toBe(1);

      const template = payload.template;
      expect(template).toEqual(getTemplateSpec("slides"));
      expect(template.id).toBe("slides");
      expect(template.documentClass).toBe("beamer");
      expect(template.fullDocumentRequirements.engine).toBe("XeLaTeX");

      expect(JSON.stringify(response.content)).toContain(template.label);
    } finally {
      await close();
    }
  });

  it("rejects invalid template input at the schema boundary", async () => {
    const { client, close } = await connectServer();
    try {
      const invalidTemplate = await client.callTool({
        name: "get_template_spec",
        arguments: { templateId: "unknown-template" },
      });
      expect(invalidTemplate.isError).toBe(true);
      expect(JSON.stringify(invalidTemplate.content)).toContain("Input validation error");

      const missingTemplate = await client.callTool({
        name: "get_template_spec",
        arguments: {},
      });
      expect(missingTemplate.isError).toBe(true);
      expect(JSON.stringify(missingTemplate.content)).toContain("Input validation error");

      const extraInput = await client.callTool({
        name: "get_template_spec",
        arguments: { templateId: "slides", extra: true },
      });
      expect(extraInput.isError).toBe(true);
      expect(JSON.stringify(extraInput.content)).toContain("Input validation error");
    } finally {
      await close();
    }
  });
});
