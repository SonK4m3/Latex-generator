import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const UPSTREAM_URL = "http://localhost:3001/api/mcp";
const SERVER_INFO = { name: "mcp-dev-stdio", version: "1.0.0" };
const FORWARD_ERROR = "MCP bridge request failed.";

async function main() {
  const apiKey = process.env.MCP_DEV_API_KEY?.trim();
  if (!apiKey) throw new Error("MCP_DEV_API_KEY is required.");

  const client = new Client(SERVER_INFO, { capabilities: {} });
  const upstreamTransport = new StreamableHTTPClientTransport(new URL(UPSTREAM_URL), {
    requestInit: {
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  });
  await client.connect(upstreamTransport);

  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async request => {
    try {
      return await client.listTools(request.params);
    } catch {
      throw new Error(FORWARD_ERROR);
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      return await client.callTool(request.params);
    } catch {
      throw new Error(FORWARD_ERROR);
    }
  });

  await server.connect(new StdioServerTransport());
}

main().catch(() => {
  console.error("MCP stdio bridge failed to start.");
  process.exitCode = 1;
});
