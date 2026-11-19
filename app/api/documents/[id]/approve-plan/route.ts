import { NextResponse } from "next/server";
import { getDocument, updateDocument } from "@/lib/store/documentStore";
import { getCurrentUserId } from "@/lib/auth/current-user";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: docId } = await params;
    const userId = await getCurrentUserId();
    
    // Pass userId if available, but many local routes might not have one.
    const document = await getDocument(docId, userId || undefined);

    if (!document) {
      return NextResponse.json(
        { error: "Tài liệu không tồn tại" },
        { status: 404 }
      );
    }

    if (document.status !== "PLANNED") {
      return NextResponse.json(
        { error: "Tài liệu không ở trạng thái PLANNED" },
        { status: 400 }
      );
    }

    // Parse potential new planContent from request body
    const body = await req.json().catch(() => ({}));
    
    // Cập nhật trạng thái
    await updateDocument(docId, { 
      status: "GENERATING",
      ...(body.planContent ? { planContent: body.planContent } : {})
    }, userId || undefined);

    // Trả về response để client biết chuyển UI sang GENERATING
    return NextResponse.json({
      message: "Đã duyệt dàn ý, chuyển sang trạng thái GENERATING",
      nextStatus: "GENERATING",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
