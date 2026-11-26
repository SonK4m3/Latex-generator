# Deployment Guide

This guide covers the Supabase-backed MCP compile path. It does not apply migrations, enable
OAuth, or change any hosted project by itself. Rehearse migrations against staging before using
them for a shared environment.

## Database migrations

Apply the migrations in order with the Supabase CLI or the project's normal migration workflow:

1. `0001_documents.sql`
2. `0002_clarification_sessions.sql`
3. `0003_documents_is_project_column.sql`
4. `0004_accounts-workspaces-and-generation-quota.sql`
5. `0005_mcp_compile_jobs.sql`
6. `0006_mcp_oauth_database_boundary.sql`
7. `0007_mcp_live_oauth_consent.sql`
8. `0008_mcp_realtime_source_updates.sql`
9. `0009_mcp_project_text_updates.sql`
10. `0010_mcp_active_consent_boundary.sql`
11. `0011_document_preview_revisions.sql`
12. `0012_document_preview_queue.sql`

### Opt in to automatic preview compilation

Migration 0011 binds each new PDF to a source revision. Existing PDFs stay readable with an
unknown revision until recompiled. Rehearse on a copy of the database first. The new generated
columns can rewrite the document table, including its PDF payloads.

After applying 0011 and 0012, start the worker with `MCP_PREVIEW_WORKER_ENABLED=true` and confirm
it is healthy. Then, using the database administrator connection for the intended environment:

```sql
update public.document_preview_policy set enabled = true where singleton;
```

Edit a dedicated test document twice. Confirm the newest revision receives a PDF, the prior
PDF remains available while compiling, and no new document is created. Preview jobs share the
MCP daily compile budget. To turn off automatic admission and claiming, set `enabled = false`
and stop the preview-enabled worker. A job already claimed may finish. Manual compile remains
available.

Migration 0006 adds restrictive RLS policies that reject direct writes from JWTs with a
`client_id` claim. Existing cookie sessions retain web document, clarification, profile and
workspace behavior. MCP work uses the explicit user-scoped job RPCs; the isolated worker publishes
documents through the service-role-only RPC from migration 0005. The MCP queue's table privileges
remain revoked from client and worker roles.

Migration 0007 verifies live OAuth consent through an authenticated RPC. The RPC only returns
the caller's scopes for the registered client and matching resource audience. GoTrue reserves
its grants management endpoint for first-party sessions, so the MCP bearer cannot use it.

Migration 0008 adds the MCP source update RPC and publishes an owner-visible revision
table through Supabase Realtime. Keep Realtime enabled in the Supabase stack and
include the `realtime` container when starting it locally. The WebSocket event carries
document ID and revision metadata. The editor fetches document content through the
authenticated application API.

Migration 0009 adds an atomic RPC for patching existing readable text files in a project.
It merges only the requested paths into the stored JSONB file list, preserving binary
assets and untouched entries. It does not change project structure or the root file. A
stale revision is rejected; after a successful update, the existing revision trigger
notifies the web editor and the old PDF is cleared. Rehearse this migration locally and
on staging before applying it to a hosted project.

Migration 0010 binds the one-bundle MCP consent to direct data paths as well as the MCP
HTTP layer. Revoked OAuth consent stops owner-scoped document/revision reads and blocks
job or artifact mutations through Postgres RPCs. Cookie sessions and the service-role
worker retain their separate paths.

## Supabase OAuth audience hook

Supabase's Custom Access Token Hook lets the application set the OAuth token `aud` claim to its
MCP resource URL. The hook in migration 0006 only changes tokens whose registered `client_id` is
present in `mcp_oauth_audience_policy`; other sessions and clients keep their original claims.
The configuration table has no API-role write access. Only a database administrator should manage
its row.

1. Register the OAuth clients in Supabase Auth and enable the Supabase OAuth server for the
   project.
2. Set `MCP_RESOURCE_URL` to the canonical public MCP URL, ending in `/api/mcp`, and set
   `MCP_ALLOWED_CLIENT_IDS` to the same comma-separated client IDs in the application environment.
3. As a database administrator, configure the matching hook row, replacing placeholders with the
   exact deployment URL and registered client IDs:

   ```sql
   insert into public.mcp_oauth_audience_policy (singleton, resource_url, client_ids)
   values (true, 'https://<host>/api/mcp', array['<registered-client-id>'])
   on conflict (singleton) do update
     set resource_url = excluded.resource_url,
         client_ids = excluded.client_ids;
   ```

4. In Supabase Dashboard, open **Authentication → Hooks → Custom Access Token** and select
   `public.custom_access_token_hook`. For a local Supabase stack, configure the same hook in
   `supabase/config.toml`:

   ```toml
   [auth.hook.custom_access_token]
   enabled = true
   uri = "pg-functions://postgres/public/custom_access_token_hook"
   ```

5. Ensure the Supabase Auth hook role can execute the function and read its locked configuration;
   migration 0006 grants only those permissions. Keep the SQL configuration's client IDs aligned
   with `MCP_ALLOWED_CLIENT_IDS`. A missing or mismatched entry fails closed at MCP token audience
   validation.

The hook API and OAuth client claims are described in Supabase's [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) and [Token Security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security) documentation.

## Application and worker configuration

MCP is off unless explicitly enabled. The URL contract depends on the runtime:

| Runtime | `MCP_ENABLED` | `MCP_RESOURCE_URL` |
| --- | --- | --- |
| Default / MCP disabled | `false` (default) | Not required; may be empty. Do not fail startup on it. |
| Local Next dev server | `true` | `http://localhost:3001/api/mcp`; loopback HTTP is allowed only with `NODE_ENV=development` |
| Docker, staging, production | `true` | Canonical public `https://<host>/api/mcp`; HTTPS required, loopback rejected |
| Docker, staging, production | `false` | Not required; leave empty. The app must not require an MCP URL while disabled. |

When MCP is enabled outside local development, `MCP_RESOURCE_URL` is a hard requirement and must be
the canonical public URL:

- absolute HTTPS URL whose path is exactly `/api/mcp`; no trailing slash, query, fragment, userinfo,
  or container-internal host such as `next-app:3000`;
- host must be the public host served by Caddy (`SITE_ADDRESS`) and the same resource/audience
  registered in `mcp_oauth_audience_policy` and the OAuth client configuration;
- never derive it from request headers. A mismatch fails closed at token audience validation.
  Changing the host requires updating the database hook row and registered clients together.

Do not set `MCP_ENABLED=true` on a plain-HTTP localhost Docker stack: the image runs
`NODE_ENV=production`, so loopback HTTP is rejected by `lib/auth/mcp-config.ts`. Use the Next dev
server for loopback MCP testing, or give the Docker stack a real HTTPS host.

Other required values when enabled: `MCP_ALLOWED_CLIENT_IDS` (must match the locked database row),
`NEXT_PUBLIC_SUPABASE_URL` plus the publishable key, and `STORE_BACKEND=supabase`.
`MCP_ALLOWED_ORIGINS` lists browser origins; the resource origin is added automatically.

Run the MCP worker as the opt-in `mcp-worker` Compose service. It has no published port and no HTTP
health endpoint; it fails fast when the Supabase URL, service-role key, or store backend is missing.
Keep `MCP_WORKER_SERVICE_ROLE_KEY` only in the worker environment or a deployment secret store;
never put it in `NEXT_PUBLIC_*`, plugin configuration, the browser bundle, logs, or this repository.
Keep the compile service private.

## Local Docker MCP preflight

Run from the repository root with Docker Compose v2 and a populated `.env`. This preflight is
read-only and never prints `.env`, resolved secrets, or `docker inspect` output. A bare
`docker compose config` renders secrets, so only use it through the boolean checks below.

```powershell
docker compose version

# Refuse to run this runbook against a remote/staging/production Docker endpoint.
$ctx = docker context show
if ($ctx -notin @('default', 'desktop-linux')) {
  throw "Refusing: Docker context '$ctx' is not local. Switch to the local context first."
}

# Validate YAML/interpolation, then read resolved values without echoing secrets.
docker compose --profile mcp config --quiet
$cfg = docker compose --profile mcp config --format json | ConvertFrom-Json
$app = $cfg.services.'next-app'.environment
$worker = $cfg.services.'mcp-worker'.environment
$enabled = $app.MCP_ENABLED -eq 'true'

"mcp_enabled=$enabled"
"worker_key_present=$([bool]$worker.MCP_WORKER_SERVICE_ROLE_KEY)"
"worker_store_backend=$($worker.STORE_BACKEND)"

# Profile contract: the worker is opt-in, never part of the default service set.
$defaultServices = @(docker compose config --services)
$profileServices = @(docker compose --profile mcp config --services)
if ($defaultServices -contains 'mcp-worker') { throw 'mcp-worker must stay behind the mcp profile' }
if ($profileServices -notcontains 'mcp-worker') { throw 'mcp-worker is missing from the mcp profile' }

if ($enabled) {
  $raw = [string]$app.MCP_RESOURCE_URL
  if ([string]::IsNullOrWhiteSpace($raw)) { throw 'MCP_RESOURCE_URL is required when MCP_ENABLED=true' }
  $u = [uri]$raw
  if ($u.AbsolutePath -ne '/api/mcp') { throw 'MCP_RESOURCE_URL path must be exactly /api/mcp' }
  if ($u.Scheme -ne 'https' -or $u.Host -in @('localhost', '127.0.0.1', '::1')) {
    throw 'Docker runs NODE_ENV=production: use the canonical public HTTPS URL, or test loopback with npm run dev:next.'
  }
  if (-not $app.MCP_ALLOWED_CLIENT_IDS) { throw 'MCP_ALLOWED_CLIENT_IDS is required' }
  if (-not $app.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) { throw 'Supabase publishable key is required' }
  $site = [string]$cfg.services.caddy.environment.SITE_ADDRESS
  if ($site) {
    $siteHost = ($site -replace '^https?://', '').Split(':')[0]
    if ($siteHost -ne $u.Host) { throw 'MCP_RESOURCE_URL host must match the public SITE_ADDRESS host' }
  }
  "mcp_resource_url=$($u.GetLeftPart([UriPartial]::Authority))/api/mcp"
}
else {
  'MCP disabled: MCP_RESOURCE_URL is not required and is not validated.'
}
```

Expected: `mcp_enabled` matches intent, `worker_key_present=True`, `worker_store_backend=supabase`,
and both profile checks pass. With MCP disabled the URL block is skipped even when the URL is empty.
With MCP enabled in Docker, anything other than the canonical HTTPS URL stops the runbook before
containers start.

## Local Docker MCP runbook

1. **MCP disabled (default):** `docker compose up --build --detach` starts `caddy`, `next-app`, and
   `compile-service` only. `docker compose ps --status running --services` must not list
   `mcp-worker`.
2. **Loopback MCP testing:** use the Next dev server, not the production image. Start the compiler
   with `docker compose up --build --detach compile-service`, then run `npm run dev:next` with
   `MCP_RESOURCE_URL=http://localhost:3001/api/mcp`.
3. **Docker MCP with a real HTTPS host:** set `SITE_ADDRESS=<public-host>` and
   `MCP_RESOURCE_URL=https://<public-host>/api/mcp`, re-run the preflight, then:

   ```powershell
   docker compose --profile mcp up --build --detach
   ```

   Caddy obtains TLS; the app, compiler, and worker start. Do not expose `next-app`,
   `compile-service`, or `mcp-worker` directly.
4. **Verify the worker** (no port and no HTTP healthcheck):

   ```powershell
   docker compose --profile mcp ps --status running --services
   docker compose --profile mcp logs --since 10m --no-log-prefix mcp-worker |
     Select-String -SimpleMatch 'mcp.worker.started'
   docker compose --profile mcp exec -T mcp-worker node -e "console.log(JSON.stringify({store:process.env.STORE_BACKEND,supabase:!!process.env.NEXT_PUBLIC_SUPABASE_URL,key:!!process.env.MCP_WORKER_SERVICE_ROLE_KEY}))"
   ```

   Healthy means the service is `running`, the log contains `mcp.worker.started`, and the exec
   prints `{"store":"supabase","supabase":true,"key":true}` (booleans only). A restart loop with
   `MCP worker configuration/startup failed` means a missing value, not a wrong key value; check
   presence without printing it.
5. **Stop only what you started:** `docker compose --profile mcp stop mcp-worker`. Do not run
   `docker compose down -v`; named volumes hold documents and caches.

## Secret handling and scope

- Never print `.env`, bare `docker compose config`, `docker inspect`, or `env` into recorded output.
  Never paste key values into tickets, chat, CI logs, or docs.
- Use the boolean checks above to prove a key is present. Treat any printed key as exposed.
- `MCP_WORKER_SERVICE_ROLE_KEY` is worker-only. It is not a `NEXT_PUBLIC_*` value and must not reach
  the browser, plugin manifest, or app container.
- This runbook performs no production mutation: it only reads local Compose state and starts or
  stops local containers. It does not apply migrations, seed data, create OAuth clients, update the
  audience hook row, rotate keys, or call a hosted Supabase project. Migration and OAuth changes
  remain separate, staging-rehearsed steps.

## Local dev server (loopback MCP)

Configure `.env.local` against a development Supabase stack with migrations 0001–0010 applied. Set
`STORE_BACKEND=supabase`, `MCP_ENABLED=true`, the publishable key, the loopback
`MCP_RESOURCE_URL`, and `COMPILE_SERVICE_URL=http://127.0.0.1:8080`. Start the compiler and web app
from the repository root:

```powershell
docker compose up --build --detach compile-service
npm run dev:next
```

The dev server sets `NODE_ENV=development` and binds to `localhost`, so the local MCP API-key mode
is not exposed on the LAN. The compiler container publishes port 8080 only on host loopback
(`127.0.0.1`); it is not exposed to the LAN or Internet. In a separate PowerShell terminal, start
the local worker with its key set only in that process environment:

```powershell
$env:MCP_WORKER_SERVICE_ROLE_KEY = '<development service role key>'
npm run mcp:worker
Remove-Item Env:MCP_WORKER_SERVICE_ROLE_KEY
```

Do not put the worker key in `.env.local`, because Next.js loads that file too. Open the local app
at `http://localhost:3001`. This local setup has not been validated against remote ChatGPT or Codex
hosts.

### Local MCP development credentials

After local Supabase and `.env.local` are configured, run `npm run mcp:dev-credentials`. The
command creates or reuses one `@example.test` Supabase account, grants it the existing local
MCP client's `openid` consent, and writes a random `MCP_DEV_API_KEY` plus a seven-day,
user-scoped Supabase JWT to `.env.local`.

Send the API key as `Authorization: Bearer <MCP_DEV_API_KEY>`. The local MCP server maps it to the
server-held JWT and still checks its signature, issuer, resource audience, user, client allowlist,
and active consent before creating the ordinary RLS-scoped Supabase client. The JWT can also be
sent directly as a bearer token. The account password, API key, and JWT are printed by the setup
command for local web/client testing.

This shortcut is accepted only when `NODE_ENV=development`, the explicit
`MCP_DEV_AUTH_ENABLED=true` flag is set, both credentials exist, and all MCP/Auth URLs use
loopback hosts. Never put these values in plugin packages, source control, or a hosted environment.
The normal OAuth flow remains the path for ChatGPT cloud; this local key does not make localhost
reachable from a cloud host.

## Compiler trust boundary

The MCP endpoint accepts raw TeX. Tectonic's untrusted mode and the container limits are useful
defenses, but per-job filesystem isolation has not been verified to a level that makes arbitrary
third-party TeX safe. Treat submitted TeX as trusted input until stronger per-job isolation is
implemented and independently verified. Keep the compiler private and do not expose its port on a
non-loopback host interface.
