// app/not-found.tsx
// Trang 404 toàn cục. Dùng biến thể "terminal" của beUI vì nó khớp với ngôn ngữ
// hình ảnh của hệ thống: log biên dịch Tectonic chạy từng dòng.
import { NotFoundTerminal } from "@/components/motion/not-found";

export const metadata = {
  title: "Không tìm thấy trang — AI LaTeX Generator",
};

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center">
      <NotFoundTerminal
        code="404"
        title="Không tìm thấy trang"
        description="Đường dẫn này không tồn tại, đã bị di chuyển, hoặc tài liệu đã bị xoá."
        homeHref="/app"
        homeLabel="Về khu làm việc"
        browseHref="/"
        browseLabel="Trang chủ"
      />
    </main>
  );
}
