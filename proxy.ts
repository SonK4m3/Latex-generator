import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// Proxy toàn cục (Next 16, trước đây là "middleware"): refresh session Supabase
// + chặn (optimistic) truy cập trang khi chưa đăng nhập. Kiểm tra quyền THẬT vẫn
// nằm ở từng API route và Server Component (getCurrentUserId).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // MCP discovery, bearer auth and download grants do not use web session cookies.
    "/((?!api/mcp(?:/|$)|api/artifacts/|\\.well-known/oauth-protected-resource(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
