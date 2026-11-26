import { describe, expect, it } from "vitest";
import { safeOAuthRedirect, validAuthorizationId } from "@/app/auth/consent/oauth-redirect";

describe("OAuth consent input boundaries", () => {
  it("accepts HTTPS and native-client loopback callback URLs", () => {
    expect(safeOAuthRedirect("https://chatgpt.com/callback?code=abc")).toBe("https://chatgpt.com/callback?code=abc");
    expect(safeOAuthRedirect("http://127.0.0.1:1455/auth/callback?code=abc")).not.toBeNull();
  });
  it.each(["javascript:alert(1)", "https://user:secret@host.test/", "http://public.test/", "//evil.test", "/callback"])("rejects unsafe redirect %s", value => {
    expect(safeOAuthRedirect(value)).toBeNull();
  });
  it("rejects authorization IDs with path/query injection or ambiguous arrays", () => {
    expect(validAuthorizationId("abc-123_456")).toBe(true);
    for (const value of ["../user", "id?approve=true", ["id"], "", "a".repeat(129)]) {
      expect(validAuthorizationId(value)).toBe(false);
    }
  });
});
