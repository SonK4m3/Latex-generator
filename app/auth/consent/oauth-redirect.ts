/** Only call with the authorization server's response, never a form/query URL. */
export function safeOAuthRedirect(value: string): string | null {
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) return null;
    return url.href;
  } catch { return null; }
}

export function validAuthorizationId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
