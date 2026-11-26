import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { importJWK, SignJWT } from "jose";

const resource = process.env.MCP_RESOURCE_URL ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const issuer = process.env.MCP_AUTH_ISSUER ?? `${supabaseUrl}/auth/v1`;
const clientId = (process.env.MCP_ALLOWED_CLIENT_IDS ?? "").split(",")[0]?.trim() ?? "";
const localHosts = ["localhost", "127.0.0.1", "[::1]"];

function assertLocalSetup() {
  const urls = [resource, supabaseUrl, issuer].map(value => new URL(value));
  if (urls.some(url => !localHosts.includes(url.hostname) || url.username || url.password || url.search || url.hash) ||
      urls[0].pathname !== "/api/mcp" || urls[1].pathname !== "" || urls[2].pathname !== "/auth/v1" ||
      urls[2].origin !== urls[1].origin ||
      !/^[0-9a-f-]{36}$/i.test(clientId)) {
    throw new Error("Dev credentials require a loopback MCP/Supabase URL and an allowed local OAuth client.");
  }
}

function containerEnv(container: string, key: string): string {
  const inspect = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
  const value = inspect.Config.Env.find((entry: string) => entry.startsWith(`${key}=`));
  if (!value) throw new Error(`Missing ${key} in local Supabase Auth container.`);
  return value.slice(key.length + 1);
}

function updateEnvFile(contents: string, values: Record<string, string>): string {
  const keys = new Set(Object.keys(values));
  const lines = contents.split(/\r?\n/).filter(line => !keys.has(line.split("=", 1)[0]));
  while (lines.at(-1) === "") lines.pop();
  return `${[...lines, ...Object.entries(values).map(([key, value]) => `${key}=${value}`)].join("\n")}\n`;
}

function readEnvValue(contents: string, name: string): string | null {
  const line = contents.split(/\r?\n/).find(value => value.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1) : null;
}

async function main() {
  assertLocalSetup();
  const authContainer = process.env.MCP_DEV_AUTH_CONTAINER ?? "supabase_auth_ai-latex-mcp-supabase-local";
  const dbContainer = process.env.MCP_DEV_DB_CONTAINER ?? "supabase_db_ai-latex-mcp-supabase-local";
  const jwks = JSON.parse(containerEnv(authContainer, "GOTRUE_JWT_KEYS"));
  const signingJwk = jwks.find((entry: { d?: string; alg?: string }) => entry.d && entry.alg === "ES256");
  if (!signingJwk) throw new Error("The local Supabase Auth container has no ES256 signing key.");
  signingJwk.key_ops = ["sign"];
  const signingKey = await importJWK(signingJwk, "ES256");
  const issueJwt = (claims: Record<string, unknown>, audience: string, expiresIn: number) =>
    new SignJWT(claims).setProtectedHeader({ alg: "ES256", kid: signingJwk.kid })
      .setIssuer(issuer).setAudience(audience).setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn).sign(signingKey);

  const serviceKey = await issueJwt({ role: "service_role" }, "authenticated", 300);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const envPath = path.resolve(".env.local");
  const currentEnv = await readFile(envPath, "utf8");
  const email = readEnvValue(currentEnv, "MCP_DEV_TEST_EMAIL") ?? `mcp-dev-${randomBytes(5).toString("hex")}@example.test`;
  if (!email.endsWith("@example.test")) throw new Error("Refusing to reuse a non-test account.");
  let password = readEnvValue(currentEnv, "MCP_DEV_TEST_PASSWORD");
  let userId = readEnvValue(currentEnv, "MCP_DEV_TEST_USER_ID");
  let createdUser = false;
  if (userId && /^[0-9a-f-]{36}$/i.test(userId)) {
    const existing = await admin.auth.admin.getUserById(userId);
    if (existing.error || !existing.data.user || existing.data.user.email !== email) userId = null;
  } else userId = null;
  if (!userId) {
    password = randomBytes(24).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { purpose: "local-mcp-development-test" },
    });
    if (error || !data.user) throw new Error(`Could not create local test account (${error?.status ?? "unknown"}).`);
    userId = data.user.id;
    createdUser = true;
  }
  if (!password) {
    password = randomBytes(24).toString("base64url");
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(`Could not set a password on the local test account (${error.status}).`);
  }

  const testToken = await issueJwt({ sub: userId, role: "authenticated", client_id: clientId, scope: "openid" },
    resource, 7 * 24 * 60 * 60);
  const sql = `
    do $$ begin
      if not exists (
        select 1 from public.mcp_oauth_audience_policy
        where singleton and resource_url = '${resource}' and '${clientId}' = any(client_ids)
      ) or not exists (
        select 1 from auth.oauth_clients where id = '${clientId}'::uuid and deleted_at is null
      ) then raise exception 'local MCP client/audience is not configured'; end if;
    end $$;
    insert into auth.oauth_consents(id, user_id, client_id, scopes, granted_at, revoked_at)
    values ('${randomUUID()}'::uuid, '${userId}'::uuid, '${clientId}'::uuid, 'openid', now(), null)
    on conflict (user_id, client_id) do update
      set scopes = excluded.scopes, granted_at = excluded.granted_at, revoked_at = null;
  `;
  try {
    execFileSync("docker", ["exec", "-i", dbContainer, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
      input: sql, encoding: "utf8", stdio: ["pipe", "ignore", "pipe"],
    });
  } catch (error) {
    if (createdUser) await admin.auth.admin.deleteUser(userId);
    const detail = error && typeof error === "object" && "stderr" in error
      ? String((error as { stderr?: unknown }).stderr ?? "").trim().slice(0, 300)
      : "";
    throw new Error(`Could not create local test consent${createdUser ? "; the temporary account was removed" : ""}.${detail ? ` ${detail}` : ""}`);
  }

  const apiKey = `mcp_dev_${randomBytes(32).toString("base64url")}`;
  await writeFile(envPath, updateEnvFile(currentEnv, {
    MCP_DEV_AUTH_ENABLED: "true",
    MCP_DEV_API_KEY: apiKey,
    MCP_DEV_ACCESS_TOKEN: testToken,
    MCP_DEV_TEST_EMAIL: email,
    MCP_DEV_TEST_PASSWORD: password,
    MCP_DEV_TEST_USER_ID: userId,
  }), { encoding: "utf8", mode: 0o600 });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  console.log(JSON.stringify({
    account: { email, password, userId },
    apiKey,
    accessToken: testToken,
    expiresAt,
    resource,
    note: "Local development only. Send apiKey as Authorization: Bearer; server maps it to the user-scoped accessToken.",
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Local MCP dev credential setup failed.");
  process.exitCode = 1;
});
