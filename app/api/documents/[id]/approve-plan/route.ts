import { NextResponse } from "next/server";
import { store } from "@/lib/store/document-store";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const docId = params.id;
    const document = store.get(docId);

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

    // Cập nhật trạng thái
    store.update(docId, { status: "GENERATING" });

    // Trả về response để client biết chuyển UI sang GENERATING
    return NextResponse.json({
      message: "Đã duyệt dàn ý, chuyển sang trạng thái GENERATING",
      nextStatus: "GENERATING",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
