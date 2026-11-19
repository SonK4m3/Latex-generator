import { getMcpConfig } from "@/lib/auth/mcp-config";

export class McpAuthError extends Error {
  readonly challenge: string;
  readonly headers: Record<string, string>;

  constructor(
    message: string,
    readonly status: 401 | 403 | 503 = 401,
    scope?: string,
  ) {
    super(message);
    this.name = "McpAuthError";
    const resource = getMcpConfig().resourceUrl;
    const metadata = resource ? `${new URL(resource).origin}/.well-known/oauth-protected-resource/api/mcp` : "";
    const error = status === 403 ? "insufficient_scope" : "invalid_token";
    this.challenge = `Bearer resource_metadata="${metadata}", error="${error}"${scope ? `, scope="${scope.replace(/[^a-z0-9:_ -]/gi, "")}"` : ""}`;
    this.headers = { "Cache-Control": "no-store", ...(status !== 503 ? { "WWW-Authenticate": this.challenge } : {}) };
  }
}
