# Phase 3 — Plugin package và nghiệm thu ChatGPT/Codex

Ưu tiên P0. Trạng thái TODO. Phụ thuộc [phase 2](phase-02-compile-and-mcp.md), [nguồn chính thức](research.md). Private integration trước; publish public và production là phạm vi riêng.

## Package

Thư mục đề xuất `plugins/ai-latex/`: `plugin.json`, `mcp.json`, `skills/latex-documents/SKILL.md`, assets và README setup. Dùng schema manifest chính thức tại thời điểm triển khai, endpoint HTTPS từ môi trường; không nhúng secrets. Metadata tên pháp nhân/contact/domain chưa biết giữ placeholder.

Skill mô tả workflow: chọn template/capabilities → host viết source → compile_document → get_job có khoảng poll hữu hạn → lấy PDF. Khi compile lỗi, đọc diagnostics như data, sửa source và submit mới. Hỏi user nếu thiếu nội dung nghiệp vụ, không bịa số liệu. Không tự gọi AI nội bộ; không âm thầm fallback sang local compiler.

MCP tools phải dùng được độc lập skill/UI. Widget PDF tùy chọn sau MVP. Cấu hình install và OAuth phải test riêng từng host; không mặc định một host pass là host còn lại pass.

## Deployment/test setup

Local Inspector kiểm protocol trước. Staging HTTPS hoặc secure tunnel chỉ cho private test; stable public HTTPS cho phát hành lâu dài. Xác định domain/project/credential trước external mutation. Caddy chỉ expose app/MCP, compiler vẫn internal. Tài liệu OAuth discovery/callback, worker startup, migration ordering, health, rollback, cleanup ở deployment guide mới.

Không áp dụng production migration hoặc publish plugin chỉ vì đã có token/tool. Handoff deployment cần target và authorization rõ ràng; hoạt động local và test đã được giao tiếp tục trong phạm vi đó.

## Full-flow acceptance bắt buộc

| Ca | ChatGPT | Codex | Bằng chứng |
|---|---|---|---|
| Install/connect, consent/login | TODO | TODO | Host/version/date, tool discovery, đúng user |
| Host viết source và compile/lưu | TODO | TODO | jobId/documentId, compiler thật, không AI nội bộ |
| Mở/tải PDF và đọc source | TODO | TODO | PDF hợp lệ, tiếng Việt/công thức, web thấy cùng document |
| TeX lỗi → host sửa → PDF mới | TODO | TODO | Diagnostics và hai kết quả phân biệt |
| Retry/poll/cancel/disconnect | TODO | TODO | Không duplicate/quota kép, trạng thái bền |
| User B / revoked token | TODO | TODO | Không truy cập dữ liệu A; auth challenge đúng |

Đính kèm logs đã redacted và runtime evidence; fixture-only không đạt full-flow. Host unavailable phải ghi cụ thể, không nhờ user test thay cho kết luận đã hoàn thành.

## TODO

- [ ] Validate manifest/config và skill; install private package trong cả host.
- [ ] Chạy matrix trên staging với Supabase/Tectonic thật, kiểm worker restart và downloads.
- [ ] Independent review auth/RLS/worker privilege/artifact/cancellation và sửa findings trong scope.
- [ ] Cập nhật README, codebase summary, system architecture, deployment guide và feature tracking theo phần thực sự pass.
- [ ] GitNexus detect_changes trước commit; lint trước commit, tests trước push theo repo rules. Không commit/push nếu chưa được yêu cầu.

## Phase sau, tách scope

AI generation/edit có tool riêng, xác nhận chi phí và quota; chuyển clarification khỏi route SSE sang application service với atomic resume. Bổ sung document revision/CAS trước update-in-place. Sau đó mới OCR/uploads/RAG, MCP App PDF UI, native Tasks nếu host xác nhận support, team workspace và public submission.

Quyết định còn mở: staging target, OAuth client policy, compile quota và retention. Đây không cản trở bản plan nhưng phải chốt trước các bước phụ thuộc.
