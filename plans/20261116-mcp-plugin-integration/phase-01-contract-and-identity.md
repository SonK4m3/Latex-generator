# Phase 1 — Contract, identity, shared application services

Ưu tiên P0. Trạng thái TODO. Phụ thuộc: [khảo sát](architecture-current.md), [nguồn OAuth](research.md). Mục tiêu: có ranh giới độc lập cookie và chứng minh hai host đăng nhập đúng user.

## Contract MVP đề xuất

| Tool | Input chính | Output / quyền |
|---|---|---|
| `list_templates` | Không hoặc filter đơn giản | Metadata, package/capability giới hạn; read-only |
| `compile_document` | title, template tùy chọn, một trong latex hoặc files+rootFile, idempotencyKey | jobId, status; tạo tài liệu mới, không gọi AI |
| `get_job` | jobId | status, diagnostics ngắn, documentId, immutable artifactId khi xong; owner-only |
| `get_document` | documentId, includeSource mặc định false | Metadata; source chỉ khi yêu cầu, giới hạn kích thước; owner-only |
| `list_documents` | cursor, limit | Danh sách metadata phân trang; owner-only |
| `get_artifact` | artifactId, format=pdf hoặc tex | URL download snapshot có thời hạn và web URL; owner-only |
| `cancel_job` | jobId | cancellationRequested hoặc terminal state; owner-only |

MVP compile luôn tạo document mới; host sửa source rồi gọi compile lần mới. Không mở cập nhật tài liệu tại chỗ khi chưa có revision/CAS trên cả web và MCP. Tool update/delete là phần mở rộng riêng. `tex` export chỉ single-file MVP; multi-file source dùng schema có giới hạn qua get_document, ZIP export để sau.

Input không nhận ownerId, filesystem path tùy ý, compile-service URL hay remote fetch URL. Identity luôn từ token đã xác minh. Validate object/union, số file, đường dẫn, tổng byte, rootFile tồn tại, binary MIME nếu hỗ trợ. Không tự chèn template làm thay đổi source hoàn chỉnh; template chỉ chọn chính sách/capability đã công bố.

Tool results dùng structuredContent có schemaVersion; text summary ngắn. Phân biệt lỗi protocol/schema, auth challenge, và lỗi nghiệp vụ compile. Không trả base64 PDF vào context. Logs/output không được xem là chỉ thị agent.

## Identity và ứng dụng

- Đề xuất Supabase OAuth Server; phase này chứng minh PKCE/discovery/consent/issuer/audience/resource trên cả host trước khi xây private tools đầy đủ. Client registration theo policy staging, không tự bật public DCR.
- Xác minh bearer ở MCP boundary; tạo user-scoped Supabase client với token hợp lệ của issuer đã chọn. Không forward token bất kỳ, không dùng service-role cho truy vấn người dùng.
- `ExecutionContext`: principal, scopes, requestId, user-scoped repositories và cancellation context. Web adapter dựng từ cookie; MCP dựng từ bearer. Business service không import `next/headers`.
- Scope đề xuất: documents:read, documents:write, documents:compile; chi tiết mapping token phải xác minh với issuer. Tool annotations phản ánh side effects; không thay thế authorization server-side.
- Discovery paths trả JSON metadata, không redirect `/login`. Nếu endpoint `/api/mcp`, vẫn tách khỏi cookie refresh không cần thiết; well-known root phải được proxy cho phép rõ ràng.
- File backend chỉ dev; production MCP bắt buộc Supabase và owner không tùy chọn. Không giả định workspace/team đã có.

## File dự kiến

Tạo `lib/application/` (compile workflow/queries), `lib/auth/mcp-principal.ts`, repository factory và schemas MCP. Sửa giới hạn trong `lib/store/`, `utils/supabase/`, `proxy.ts`, routes cần shared services. Không di chuyển toàn bộ orchestrator để phục vụ compile-only.

Trước sửa: đọc guide liên quan trong `node_modules/next/dist/docs/`, sửa GitNexus runtime/reindex, impact từng symbol và báo direct callers/process/risk. Không edit khi chưa chạy impact theo AGENTS. Chọn MCP SDK/version bằng docs chính thức tại thời điểm cài; không pin theo suy đoán.

## TODO và acceptance

- [ ] Freeze tool schemas, auth scopes và error taxonomy.
- [ ] Spike OAuth hai host bằng một tool đọc danh tính tối thiểu; bỏ tool debug trước release.
- [ ] Inject repositories/context; bảo toàn web behavior và RLS.
- [ ] Test user A không xem document/job/artifact của B; không tiết lộ tồn tại qua lỗi.
- [ ] Test token thiếu/sai issuer/audience/hết hạn/thiếu scope, refresh/revoke và consent từ chối.
- [ ] So sánh web-cookie và MCP-bearer cùng user nhìn cùng dữ liệu.

Rủi ro chính: token OAuth không tương thích audience/RLS hoặc metadata client. Nếu spike fail, chốt issuer/bridge thiết kế trước private tools; không tự hạ bảo mật thành shared API key. Sau pass chuyển phase 2.
