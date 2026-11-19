import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A short-lived opaque grant is the credential. Never accept OAuth tokens in URLs. */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  if (process.env.MCP_ENABLED !== "true" || !/^[a-f0-9]{64}$/.test(token)) {
    return new Response("Artifact unavailable", { status: 404, headers });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Response("Artifact service unavailable", { status: 503, headers });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("mcp_redeem_artifact_grant", {
    p_token_hash: createHash("sha256").update(token).digest("hex"),
  });
  if (error || !data) return new Response("Artifact unavailable", { status: 404, headers });
  const snapshot = data as { format: string; pdfBase64?: string; source?: { latex?: string }; latex?: string };
  const isPdf = snapshot.format === "pdf";
  const source = snapshot.source?.latex ?? snapshot.latex;
  if ((isPdf && !snapshot.pdfBase64) || (!isPdf && (snapshot.format !== "source" || typeof source !== "string"))) {
    return new Response("Artifact unavailable", { status: 404, headers });
  }
  const bytes = isPdf ? Buffer.from(snapshot.pdfBase64!, "base64") : Buffer.from(source!, "utf8");
  return new Response(new Uint8Array(bytes), { headers: {
    ...headers, "Content-Type": isPdf ? "application/pdf" : "application/x-tex; charset=utf-8",
    "Content-Disposition": `attachment; filename="document.${isPdf ? "pdf" : "tex"}"`,
    "X-Content-Type-Options": "nosniff", "Content-Length": String(bytes.byteLength),
  } });
}
