// app/api/documents/[id]/pdf/route.ts
// Tải PDF của một tài liệu — chỉ chủ sở hữu (owner-authenticated).
// Không dùng cache chia sẻ: PDF là dữ liệu riêng, luôn private + no-store.
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getDocument } from "@/lib/store/documentStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

/** Tên file an toàn cho Content-Disposition (id đã được store validate). */
function pdfFileName(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9_-]/g, "");
  return `document-${safe || "download"}.pdf`;
}

/**
 * GET /api/documents/:id/pdf
 * - 401 khi chưa đăng nhập; 404 khi không tồn tại, không thuộc user, hoặc chưa có PDF.
 * - `?revision=` là TUỲ CHỌN. Khi DB có `pdf_source_revision` và client gửi revision khác
 *   ⇒ 404 (tránh trả PDF cũ). DB chưa migrate revision ⇒ bỏ qua query, trả PDF hiện tại.
 */
export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  if (!userId) return errorResponse("Chưa đăng nhập", 401);

  // getDocument(id, userId) đã scope owner ở cả file backend và Supabase/RLS.
  const doc = await getDocument(id, userId);
  if (!doc?.pdfBase64) return errorResponse("Không tìm thấy PDF", 404);

  const requestedRevision = new URL(request.url).searchParams.get("revision");
  if (
    requestedRevision &&
    doc.pdfSourceRevision !== undefined &&
    requestedRevision !== doc.pdfSourceRevision
  ) {
    return errorResponse("Không tìm thấy PDF", 404);
  }

  const bytes = Uint8Array.from(Buffer.from(doc.pdfBase64, "base64"));
  if (bytes.byteLength === 0) return errorResponse("Không tìm thấy PDF", 404);

  return new Response(bytes, {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(id)}"`,
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
