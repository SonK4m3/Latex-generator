import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getMcpConfig } from "@/lib/auth/mcp-config";
import { McpAuthError } from "@/lib/auth/mcp-errors";
import { resolveMcpDevAccessToken } from "@/lib/auth/mcp-dev-key";

export type McpPrincipal = {
  userId: string;
  scopes: string[];
  supabase: SupabaseClient;
  requestId: string;
};

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** No shared session: each request receives its own user-scoped database client. */
export async function authenticateMcpRequest(request: Request): Promise<McpPrincipal> {
  const config = getMcpConfig();
  if (!config.enabled) throw new McpAuthError("MCP is disabled", 503);
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(authorization);
  if (!match || match[1].length > 16384) throw new McpAuthError("A valid OAuth access token is required");
  const token = resolveMcpDevAccessToken(match[1], config.devApiKey, config.devAccessToken);
  const jwksUrl = `${config.issuer}/.well-known/jwks.json`;
  let keySet = keySets.get(jwksUrl);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(jwksUrl), { timeoutDuration: 5000 });
    keySets.set(jwksUrl, keySet);
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, keySet, {
      issuer: config.issuer, audience: config.resourceUrl,
      algorithms: ["RS256", "ES256"], requiredClaims: ["sub", "exp", "iat", "client_id"],
    }));
  } catch {
    throw new McpAuthError("Invalid or expired OAuth access token");
  }
  const clientId = payload.client_id;
  if (!payload.sub || payload.role !== "authenticated" || typeof clientId !== "string" ||
      !config.allowedClientIds.includes(clientId)) {
    throw new McpAuthError("OAuth client is not allowed");
  }
  const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || data.user?.id !== payload.sub) throw new McpAuthError("OAuth user is unavailable");

  // GoTrue's grants endpoint only accepts first-party sessions. Resolve the
  // caller's active consent via a user-scoped RPC and check it on every call.
  const grant = await supabase.rpc("mcp_current_oauth_scopes").abortSignal(AbortSignal.timeout(5000));
  if (grant.error) throw new McpAuthError("Cannot verify OAuth consent", 503);
  if (!Array.isArray(grant.data)) throw new McpAuthError("OAuth consent was revoked");
  const signedScopes = typeof payload.scope === "string" ? payload.scope.split(/\s+/) : null;
  const scopes = grant.data.filter((value: unknown): value is string =>
    typeof value === "string" && (!signedScopes || signedScopes.includes(value)));
  const principal = { userId: payload.sub, scopes, supabase, requestId: crypto.randomUUID() };
  requireMcpScope(principal, "openid");
  return principal;
}

export function requireMcpScope(principal: McpPrincipal, scope: string): void {
  if (!principal.scopes.includes(scope)) throw new McpAuthError("Required OAuth scope was not granted", 403, scope);
}
