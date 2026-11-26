// @vitest-environment node
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { authenticateMcpRequest } from "@/lib/auth/mcp-principal";
import { getMcpConfig } from "@/lib/auth/mcp-config";

const doubles = vi.hoisted(() => ({ getUser: vi.fn(), resolveKey: vi.fn(), grant: vi.fn() }));
vi.mock("jose", async importOriginal => ({
  ...await importOriginal<typeof import("jose")>(),
  createRemoteJWKSet: () => doubles.resolveKey,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: doubles.getUser }, rpc: () => ({ abortSignal: doubles.grant }) }),
}));

const userId = "c13bb868-bfa6-4ab7-8a67-364dfe435625";
const clientId = "4d41e58b-8819-47d1-889d-c90a46a33228";
const issuer = "https://auth.example.test/auth/v1";
const resource = "http://localhost:3001/api/mcp";
let key: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  key = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  doubles.resolveKey.mockImplementation(createLocalJWKSet({ keys: [{ ...jwk, kid: "test", alg: "ES256" }] }));
});

beforeEach(() => {
  vi.stubEnv("MCP_ENABLED", "true");
  vi.stubEnv("MCP_RESOURCE_URL", resource);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://auth.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("MCP_AUTH_ISSUER", issuer);
  vi.stubEnv("MCP_ALLOWED_CLIENT_IDS", clientId);
  vi.stubEnv("MCP_ALLOWED_ORIGINS", "");
  doubles.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  doubles.grant.mockResolvedValue({ data: ["openid"], error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function token(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: userId, role: "authenticated", client_id: clientId,
    iss: process.env.MCP_AUTH_ISSUER ?? issuer, aud: resource, iat: now, exp: now + 300, ...overrides })
    .setProtectedHeader({ alg: "ES256", kid: "test" }).sign(key);
}
function request(value: string) {
  return new Request(resource, { headers: { Authorization: `Bearer ${value}` } });
}

describe("MCP OAuth principal", () => {
  it("verifies a real signed JWT and resolves an active consent grant", async () => {
    const principal = await authenticateMcpRequest(request(await token()));
    expect(principal.userId).toBe(userId);
    expect(principal.scopes).toEqual(["openid"]);
    expect(doubles.getUser).toHaveBeenCalledWith(expect.any(String));
  });
  it("maps only a local dev API key to its server-held user-scoped JWT", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("MCP_AUTH_ISSUER", "http://127.0.0.1:54321/auth/v1");
    vi.stubEnv("MCP_DEV_AUTH_ENABLED", "true");
    vi.stubEnv("MCP_DEV_API_KEY", "mcp_dev_123456789012345678901234567890");
    const accessToken = await token();
    vi.stubEnv("MCP_DEV_ACCESS_TOKEN", accessToken);

    const principal = await authenticateMcpRequest(request("mcp_dev_123456789012345678901234567890"));
    expect(principal.userId).toBe(userId);
    expect(doubles.getUser).toHaveBeenCalledWith(accessToken);
    await expect(authenticateMcpRequest(request("mcp_dev_wrong_key_12345678901234567890")))
      .rejects.toMatchObject({ status: 401 });
  });
  it("still verifies the mapped JWT instead of trusting the dev API key alone", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("MCP_AUTH_ISSUER", "http://127.0.0.1:54321/auth/v1");
    vi.stubEnv("MCP_DEV_AUTH_ENABLED", "true");
    vi.stubEnv("MCP_DEV_API_KEY", "mcp_dev_123456789012345678901234567890");
    vi.stubEnv("MCP_DEV_ACCESS_TOKEN", "not-a-signed-token");
    doubles.getUser.mockClear();
    await expect(authenticateMcpRequest(request("mcp_dev_123456789012345678901234567890")))
      .rejects.toMatchObject({ status: 401 });
    expect(doubles.getUser).not.toHaveBeenCalled();
  });
  it.each([
    ["wrong audience", { aud: "authenticated" }],
    ["wrong issuer", { iss: "https://attacker.test" }],
    ["expired", { exp: 1 }],
    ["not an OAuth client", { client_id: "unknown-client" }],
    ["service role", { role: "service_role" }],
    ["missing expiration", { exp: undefined }],
  ])("rejects %s", async (_label, claims) => {
    await expect(authenticateMcpRequest(request(await token(claims)))).rejects.toMatchObject({ status: 401 });
  });
  it("rejects revoked consent even when the signature is valid", async () => {
    doubles.grant.mockResolvedValue({ data: null, error: null });
    await expect(authenticateMcpRequest(request(await token()))).rejects.toMatchObject({ status: 401 });
  });
  it("fails closed when the grant service is unavailable", async () => {
    doubles.grant.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(authenticateMcpRequest(request(await token()))).rejects.toMatchObject({ status: 503 });
  });
  it("does not elevate a token with narrower signed scopes", async () => {
    await expect(authenticateMcpRequest(request(await token({ scope: "email" })))).rejects.toMatchObject({ status: 403 });
  });
  it("rejects a mismatched authenticated user", async () => {
    doubles.getUser.mockResolvedValue({ data: { user: { id: "other" } }, error: null });
    await expect(authenticateMcpRequest(request(await token()))).rejects.toMatchObject({ status: 401 });
  });
  it("rejects missing bearer with resource discovery challenge", async () => {
    await expect(authenticateMcpRequest(new Request(resource))).rejects.toMatchObject({
      status: 401, challenge: expect.stringContaining("/.well-known/oauth-protected-resource/api/mcp"),
    });
  });
  it("requires an explicit allowed-client policy", () => {
    vi.stubEnv("MCP_ALLOWED_CLIENT_IDS", "");
    expect(() => getMcpConfig()).toThrow();
  });
  it("does not accept public HTTP or a mismatched issuer configuration", () => {
    vi.stubEnv("MCP_RESOURCE_URL", "http://public.test/api/mcp");
    expect(() => getMcpConfig()).toThrow();
    vi.stubEnv("MCP_RESOURCE_URL", resource);
    vi.stubEnv("MCP_AUTH_ISSUER", "https://attacker.test/auth/v1");
    expect(() => getMcpConfig()).toThrow();
  });
  it.each([
    ["production mode", "production", "http://127.0.0.1:54321", "http://127.0.0.1:54321/auth/v1"],
    ["non-loopback URL", "development", "https://auth.example.test", "https://auth.example.test/auth/v1"],
  ])("rejects dev credentials in %s", (_label, mode, supabaseUrl, issuerUrl) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    vi.stubEnv("MCP_AUTH_ISSUER", issuerUrl);
    vi.stubEnv("MCP_DEV_AUTH_ENABLED", "true");
    vi.stubEnv("MCP_DEV_API_KEY", "mcp_dev_123456789012345678901234567890");
    vi.stubEnv("MCP_DEV_ACCESS_TOKEN", "server-held-test-jwt");
    expect(() => getMcpConfig()).toThrow();
  });
  it("fails closed when disabled", async () => {
    vi.stubEnv("MCP_ENABLED", "false");
    await expect(authenticateMcpRequest(new Request(resource))).rejects.toMatchObject({ status: 503 });
  });
});
