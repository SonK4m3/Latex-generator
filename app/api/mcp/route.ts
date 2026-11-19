import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getMcpConfig } from "@/lib/auth/mcp-config";
import { McpAuthError } from "@/lib/auth/mcp-errors";
import { authenticateMcpRequest } from "@/lib/auth/mcp-principal";
import { getConfig } from "@/lib/config";
import { createLatexMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rpcError(status: number, message: string, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message } }, {
    status, headers: responseHeaders,
  });
}

async function handleRequest(request: Request): Promise<Response> {
  try {
    const config = getMcpConfig();
    if (!config.enabled) return rpcError(404, "MCP endpoint is unavailable.");
    const target = new URL(config.resourceUrl);
    const declaredHost = (request.headers.get("host") ?? new URL(request.url).host).toLowerCase();
    const origin = request.headers.get("origin");
    if (declaredHost !== target.host.toLowerCase() ||
        (origin !== null && origin !== target.origin && !config.allowedOrigins.includes(origin))) {
      return rpcError(403, "Request origin or host is not permitted.");
    }

    const principal = await authenticateMcpRequest(request);
    if (request.method !== "POST") return rpcError(405, "Use POST for this stateless MCP endpoint.", { Allow: "POST" });

    const server = createLatexMcpServer(principal, config.resourceUrl);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      // Leave room for JSON escaping and metadata while limiting the actual stream read.
      maxRequestBodySize: Math.min(20_000_000, getConfig().maxProjectBytes * 3 + 65_536),
    });

    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store");
      return new Response(response.body, { status: response.status, headers });
    } finally {
      // JSON responses are materialized by the transport before handleRequest resolves.
      await server.close();
    }
  } catch (error) {
    if (error instanceof McpAuthError) {
      return rpcError(error.status, error.status === 503 ? "Account service is temporarily unavailable." : "OAuth authorization required.", error.headers);
    }
    return rpcError(503, "MCP endpoint is temporarily unavailable.");
  }
}

export const POST = handleRequest;
export const GET = handleRequest;
export const DELETE = handleRequest;
