# LaTeX AI Generator — private plugin

Portable Agent Plugins package for the remote HTTP MCP adapter in this repository.
The checked-in endpoint is the application's local development URL, `http://localhost:3001/api/mcp`.
It is not a public deployment. ChatGPT cloud cannot reach this loopback address.

Before connecting: configure the server's Supabase OAuth issuer, resource audience,
allowed OAuth client IDs and consent screen following `docs/deployment-guide.md`.
Start the app and worker; install/register this directory through the target host's
supported local plugin flow if it supports local HTTP endpoints. Do not bypass OAuth
by sharing a service-role key or putting a bearer token in this package.

For future hosted use, change `mcp.json` to the verified HTTPS URL and configure that
client's registration through the host flow. The configured resource audience must
match the new URL. A hosted/tunnel connection needs separate authorization and testing.
No public listing metadata, domain, author identity, or contact information is invented.

This package does not include an MCP App UI or filesystem access. Verify tool discovery,
OAuth, compile, polling and PDF downloads independently in each host before declaring
the integration ready.
