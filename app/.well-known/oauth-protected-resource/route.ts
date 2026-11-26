import { getMcpConfig, getMcpResourceMetadata } from "@/lib/auth/mcp-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  try {
    const config = getMcpConfig();
    if (!config.enabled) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json(getMcpResourceMetadata(config), {
      headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    });
  } catch {
    return Response.json({ error: "MCP is not configured" }, { status: 503 });
  }
}
