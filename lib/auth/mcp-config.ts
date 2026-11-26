/** Trusted, deployment-owned URLs; never derive issuer/audience from request headers. */
export type McpConfig = {
  enabled: boolean;
  resourceUrl: string;
  issuer: string;
  authorizationServerUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  allowedOrigins: string[];
  allowedClientIds: string[];
  devApiKey: string | null;
  devAccessToken: string | null;
};

function trustedUrl(value: string, name: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`Invalid ${name}`); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:" && process.env.NODE_ENV !== "production"))) {
    throw new Error(`Invalid ${name}`);
  }
  return url;
}

export function getMcpConfig(): McpConfig {
  const enabled = process.env.MCP_ENABLED === "true";
  const resourceUrl = process.env.MCP_RESOURCE_URL ?? "";
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const issuer = process.env.MCP_AUTH_ISSUER ?? `${supabaseUrl}/auth/v1`;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const allowedClientIds = (process.env.MCP_ALLOWED_CLIENT_IDS ?? "").split(",").map(v => v.trim()).filter(Boolean);
  const allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? "").split(",").map(v => v.trim()).filter(Boolean);
  const devAuthEnabled = process.env.MCP_DEV_AUTH_ENABLED === "true";
  const devApiKey = process.env.MCP_DEV_API_KEY ?? "";
  const devAccessToken = process.env.MCP_DEV_ACCESS_TOKEN ?? "";
  if (devAuthEnabled !== Boolean(devApiKey || devAccessToken) || Boolean(devApiKey) !== Boolean(devAccessToken)) {
    throw new Error("MCP dev auth requires its explicit flag, API key and access token together");
  }
  if (devAuthEnabled) {
    if (process.env.NODE_ENV !== "development" || devApiKey.length < 32) {
      throw new Error("MCP dev auth requires development mode and a 32-character API key");
    }
    const isLoopback = (url: URL) => ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!isLoopback(trustedUrl(resourceUrl, "MCP_RESOURCE_URL")) ||
        !isLoopback(trustedUrl(issuer, "MCP_AUTH_ISSUER")) ||
        !isLoopback(trustedUrl(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"))) {
      throw new Error("MCP dev auth only supports loopback URLs");
    }
  }
  if (enabled) {
    const resource = trustedUrl(resourceUrl, "MCP_RESOURCE_URL");
    const auth = trustedUrl(issuer, "MCP_AUTH_ISSUER");
    trustedUrl(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
    if (resource.pathname !== "/api/mcp" || auth.href.replace(/\/$/, "") !== `${supabaseUrl}/auth/v1` ||
        !supabasePublishableKey || !allowedClientIds.length) {
      throw new Error("MCP requires /api/mcp resource, matching Supabase issuer, publishable key and allowed client IDs");
    }
    for (const origin of allowedOrigins) {
      if (trustedUrl(origin, "MCP_ALLOWED_ORIGINS").origin !== origin) throw new Error("MCP origins must be origins only");
    }
    if (!allowedOrigins.includes(resource.origin)) allowedOrigins.push(resource.origin);
  }
  return { enabled, resourceUrl, issuer, authorizationServerUrl: issuer,
    supabaseUrl, supabasePublishableKey, allowedOrigins, allowedClientIds,
    devApiKey: devApiKey || null, devAccessToken: devAccessToken || null };
}

export function getMcpResourceMetadata(config = getMcpConfig()) {
  return {
    resource: config.resourceUrl,
    authorization_servers: [config.authorizationServerUrl],
    scopes_supported: ["openid"],
    bearer_methods_supported: ["header"],
    resource_name: "AI LaTeX documents",
  };
}
