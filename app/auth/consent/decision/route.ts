import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getMcpConfig } from "@/lib/auth/mcp-config";
import { safeOAuthRedirect, validAuthorizationId } from "../oauth-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = getMcpConfig();
  if (!config.enabled) return Response.json({ error: "Not found" }, { status: 404 });
  // Browser-only cookie mutation requires a same-origin POST; no bearer-client CORS here.
  if (request.headers.get("origin") !== new URL(config.resourceUrl).origin) {
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") ||
      Number(request.headers.get("content-length") ?? 0) > 4096) {
    return Response.json({ error: "Invalid form" }, { status: 400 });
  }
  const text = await request.text();
  if (text.length > 4096) return Response.json({ error: "Invalid form" }, { status: 400 });
  const form = new URLSearchParams(text);
  const authorizationId = form.get("authorization_id");
  const decision = form.get("decision");
  if (!validAuthorizationId(authorizationId) || !["approve", "deny"].includes(decision ?? "")) {
    return Response.json({ error: "Invalid decision" }, { status: 400 });
  }
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const details = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (details.error || !details.data || !("authorization_id" in details.data) ||
      details.data.user.id !== user.id || !config.allowedClientIds.includes(details.data.client.id)) {
    return Response.json({ error: "Invalid authorization request" }, { status: 400 });
  }
  const result = decision === "approve"
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
  const destination = result.data ? safeOAuthRedirect(result.data.redirect_url) : null;
  if (result.error || !destination) return Response.json({ error: "Unable to complete authorization" }, { status: 400 });
  return new Response(null, { status: 303, headers: { Location: destination, "Cache-Control": "no-store" } });
}
