# Tổ chức trang chính thành thư viện tài liệu LaTeX

## Purpose / Big Picture

Ở `/app`, người dùng mở web cạnh ChatGPT có thể tìm và mở ngay tài liệu vừa lưu, biết PDF đang phản ánh bản nguồn nào, và chủ động áp dụng danh sách mới khi GPT tạo hoặc sửa tài liệu. Nút **Tạo tài liệu** mở trợ lý web ngay dưới thanh đầu trang. Khi đóng, thư viện lấy lại không gian và phiên chat vẫn còn.

## Progress

- [x] (2026-11-18 16:22Z) M1 — Tách header, panel tạo, thư viện, toolbar và hàng tài liệu; đặt tìm và sắp xếp cạnh nhau, xóa chuyển vào menu.
- [x] (2026-11-18 16:19Z) M2 — Bổ sung trạng thái PDF theo revision vào metadata tương thích ngược. Chưa chạy kiểm chứng theo phạm vi đã chốt.
- [x] (2026-11-18 16:22Z) M3 — Nối thông báo theo tài khoản và dò metadata cho tạo/xóa; Xem mới cập nhật danh sách, giữ bộ lọc và sắp xếp.
- [ ] M4 — Kiểm chứng và bàn giao theo phạm vi được yêu cầu.

## Surprises & Discoveries

- Repo và thư mục skill nguồn không có `docs/PLANS.md`. Dùng các mục bắt buộc và quy tắc lifecycle trong đầu ra của `exec-plan`. Lệnh tải báo Git submodule chưa khởi tạo và không cung cấp thư mục hỗ trợ.
- GitNexus impact tiếp tục trả UNKNOWN do lỗi FTS/WAL. Đường gọi được đối chiếu từ source; không dùng kết quả UNKNOWN làm bằng chứng rủi ro thấp.

## Decision Log

- Thư viện dùng một cột trong vùng nội dung. Giữ thứ tự thanh đầu trang, panel tạo khi mở, toolbar tìm kiếm, thông báo thay đổi và các hàng tài liệu.
- Dùng chung một bộ lọc và quy tắc sắp xếp khi cập nhật danh sách. Mặc định theo thời gian cập nhật giảm dần. Không thêm mục Gần đây trùng với cách sắp xếp mặc định.
- Chỉ báo trạng thái job đang chạy khi có tín hiệu queue xác thực. PDF tồn tại với revision chưa biết phải có nhãn riêng.
- Projection revision phát sự kiện khi UPDATE, không bao phủ INSERT tài liệu. Dùng listener owner-scoped cho sửa/compile và dò metadata mỗi 30 giây khi tab hiện để phát hiện tài liệu mới/xóa, không sửa cache hiển thị trước khi áp dụng.

## Outcomes & Retrospective

M1–M3 đã triển khai trong workspace. M4 vẫn mở vì người dùng đã hoãn test và nghiệm thu. Chưa tạo migration, commit hoặc phát hành. Gói giao diện và metadata được DeepSeek thực hiện song song. Root thực hiện listener, ghép dữ liệu và rà diff.

## Context and Orientation

- `/app/app/page.tsx` là route Next.js có xác thực, tải danh sách theo chủ sở hữu.
- `/components/HomeClient.tsx` giữ trạng thái mở chat và kết quả. `/components/DocumentList.tsx` dùng chung TanStack Query với command palette. TanStack Query giữ dữ liệu fetch trong bộ nhớ phía client, còn query key là định danh của bản cache.
- `/lib/types/document.ts`, `/lib/store/supabase-document-store.ts`, `/lib/store/file-document-store.ts` và `/app/api/documents/route.ts` cung cấp bản tóm tắt. Phản hồi thư viện chỉ cần metadata; source và bytes PDF thuộc trang tài liệu.
- Revision nguồn là định danh của một phiên bản source đã lưu. Migration `/supabase/migrations/0011_document_preview_revisions.sql` có trạng thái rõ ràng: thiếu PDF, PDF không rõ revision, PDF khớp source và PDF của bản trước. `/supabase/migrations/0012_document_preview_queue.sql` quản lý compile nền khi được bật.
- `/supabase/migrations/0008_mcp_realtime_source_updates.sql` tạo bảng sự kiện revision theo chủ sở hữu. Cần xác minh các thao tác tạo, sửa, hoàn tất compile và xóa được phản ánh trước khi bật đồng bộ cả thư viện.

## Plan of Work

**M1.** Giữ server loader và điều hướng hiện tại. Tách `AppHeader` và `CreateDocumentPanel` từ HomeClient. Tách `DocumentToolbar` và `DocumentRow` từ DocumentList, giữ danh sách và các hành động fetch/xóa trong `DocumentLibrary`. Toolbar hỗ trợ tìm không dấu, sắp xếp Mới cập nhật hoặc Theo tên. Trạng thái trống, không tìm thấy hoặc lỗi nằm trong vùng kết quả. Hàng hiện tên, mẫu, giờ cập nhật, trạng thái PDF và menu thao tác. Giữ xác nhận xóa; cho phép mở tài liệu và menu bằng bàn phím.

**M2.** Đưa giá trị generated `pdf_revision_status` vào bản tóm tắt Supabase, có fallback cho môi trường trước migration và file backend. Ánh xạ sang nhãn rõ nghĩa. Tận dụng projection metadata hiện có để không tải base64. Chỉ thêm chỉ báo Đang biên dịch nếu xác định được state job của chính revision đó.

**M3.** Kết nối một listener theo người dùng đã đăng nhập, dùng bảng dự kiến ở trên sau khi xác nhận RLS và event coverage. RLS là chính sách Postgres giới hạn dữ liệu theo tài khoản. Gom event liên tiếp vào một cờ “Có cập nhật”. Không thay kết quả đang hiển thị trước khi người dùng chọn **Xem mới**; giữ từ khóa và thứ tự, chỉ xóa thông báo sau khi fetch thành công. Giữ **Làm mới** làm fallback khi không có realtime. Hủy listener khi unmount hoặc đổi tài khoản. Không tự gắn nhãn nguồn thay đổi là MCP nếu event không có tác giả.

**M4.** Tổng hợp bằng chứng theo từng mốc. Giữ nguyên yêu cầu hoãn chạy test và nghiệm thu của user cho đến khi họ thay đổi phạm vi. Khi các mốc đã nghiệm thu, điền kết quả và chuyển plan sang completed.

## Concrete Steps

Chạy từ `D:/Web/ai-latex-generator`.

1. `git status --short` để xác định các thay đổi đã tồn tại. Chạy GitNexus impact cho từng symbol sắp sửa. Nếu index tiếp tục lỗi, ghi phạm vi caller đã rà bằng source.
2. Giữ M1 và phần API M2 thành hai gói có quyền file riêng; M3 dùng giao diện component và contract metadata đã chốt. Cập nhật Progress theo UTC sau mỗi mốc, ghi vào Decisions mọi thay đổi hợp đồng.
3. Trước bất kỳ commit nào, chạy GitNexus detect_changes theo AGENTS.md. Commit chỉ chứa các tệp của mốc tương ứng.
4. Khi được phép nghiệm thu, chạy `npx tsc --noEmit` và `npx vitest run tests/unit/document-list.test.tsx`; kỳ vọng exit 0. Chạy `npm run dev:next` nếu chưa có server local, mở `http://localhost:3001/app`.

## Validation and Acceptance

- 360px và 768px dùng một cột, không tràn ngang. Thanh tìm nằm sát danh sách; nút tạo mở panel ngay dưới header và đóng mở giữ nội dung đang nhập.
- Tìm “bao cao” khớp “Báo cáo”, sắp xếp hoạt động với danh sách đã lọc. Hủy xóa giữ tài liệu; xác nhận xóa vẫn gọi cùng API.
- Dùng tài liệu test riêng để kiểm tra trạng thái PDF thiếu, không rõ, cũ và hiện hành. GET danh sách không chứa source hoặc base64.
- Khi một client khác cập nhật tài liệu, thư viện đang tìm/đọc không đổi vị trí trước khi chọn **Xem mới**. Áp dụng update giữ filter và sort. Hai tài khoản không nhận tín hiệu của nhau.

## Idempotence and Recovery

- Refactor layout không cần migration mới. Nếu phải quay lại, hoàn nguyên diff riêng của gói UI để giữ thay đổi đang có từ trước.
- Trường trạng thái metadata là tùy chọn; server cũ hoặc file backend tiếp tục hiển thị trạng thái PDF chưa rõ revision.
- Có thể tắt listener danh sách và giữ **Làm mới**. Sự kiện lặp chỉ duy trì cùng một thông báo. Fetch lỗi giữ kết quả cũ, trạng thái đang tìm và nút thử lại.
- Dùng fixture local có tên riêng. Không áp dụng vào staging hoặc thay đổi dữ liệu người dùng khi chưa có phạm vi triển khai rõ.
