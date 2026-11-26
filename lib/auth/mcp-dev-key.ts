import { timingSafeEqual } from "node:crypto";

/** Map one local development API key to a server-held, user-scoped Supabase JWT. */
export function resolveMcpDevAccessToken(
  presentedToken: string,
  apiKey: string | null,
  accessToken: string | null,
): string {
  if (!apiKey || !accessToken) return presentedToken;
  const presented = Buffer.from(presentedToken, "utf8");
  const expected = Buffer.from(apiKey, "utf8");
  if (presented.length !== expected.length) return presentedToken;
  return timingSafeEqual(presented, expected) ? accessToken : presentedToken;
}
