# Phase 2 — Durable compile jobs, artifacts, MCP adapter

Ưu tiên P0. Trạng thái TODO. Phụ thuộc [phase 1](phase-01-contract-and-identity.md). MVP không gọi provider AI, không repair bằng AI ẩn.

## Execution design

`compile_document` validate + authorize + atomically admit job rồi trả jobId. Postgres queue + worker trong Docker hiện tại; không thêm Redis ngay. Worker claim job có lease; giới hạn concurrency để bảo vệ compiler. Không dùng fire-and-forget promise trong Next request.

Trạng thái đề xuất: queued → running → succeeded | failed | cancelled; có cancel_requested. Worker chết: lease expiry cho retry hữu hạn; lưu diagnostics và số attempt. At-least-once execution, publication result idempotent; không hứa exactly-once compile.

`jobs` giữ owner_id, operation, input snapshot/hash, idempotency key, trạng thái, lease/attempt, timestamps, result document/artifact references, lỗi chuẩn hóa. Unique(owner, operation, key); cùng key khác payload trả conflict. Transaction admission/quota tránh double charge khi client retry. Cancel không tự hoàn quota trừ khi policy được định nghĩa.

Worker cần quyền nhận job, nhưng không lưu user refresh token vào queue. Dùng DB role/RPC đặc quyền hẹp cho claim/publish, kiểm owner và immutable job input trong transaction; user-facing access vẫn RLS. Nếu bắt buộc credential admin, cô lập worker, không dùng chung với MCP request, giới hạn bề mặt RPC và audit rõ quyền bypass RLS.

Lease cần fencing token/attempt tăng đơn điệu. Publish chỉ hợp lệ nếu token còn hiện hành, lease hợp lệ và job chưa bị cancel; kết thúc job + publish snapshot trong cùng transaction. User JWT chỉ được owner-read jobs/artifacts và gọi admission/cancel RPC đã kiểm quyền; không được trực tiếp INSERT/UPDATE input, status, lease, quota hoặc result qua PostgREST. RLS owner-check riêng lẻ không đủ bảo vệ invariant này.

Compile source phải tái dùng validation/path guards phù hợp, compile client và compiler sandbox; lỗi trả source/diagnostics cho host sửa. Valid single-file và multi-file đều được hỗ trợ theo giới hạn hiện có. Không expose compiler trực tiếp internet.

## Persistence và artifacts

- Create draft/document/result bằng thao tác idempotent; compile failure vẫn có diagnostics/source có thể đọc. Chỉ expose PDF thuộc đúng successful artifact snapshot.
- Thêm immutable artifacts theo artifactId/jobId/owner, source hash + source snapshot + PDF bytes/base64 và metadata. Document có thể giữ pdf_base64 để tương thích web; artifact endpoint đọc snapshot, không đọc PDF mutable hiện tại của document. Chưa bắt buộc object storage ở MVP; giới hạn tổng bytes/retention để kiểm chi phí DB.
- Grant download opaque, có hạn dùng và gắn đúng owner/artifactId/format, chỉ cấp sau owner check. Grant là bearer capability: không log token, không index/cache công khai, không đặt OAuth token trong query. Có authenticated web URL fallback; kiểm host có tải được PDF thật. Web URL có thể hiển thị bản mới, nên result phải phân biệt snapshot download và document hiện tại.
- Quy định quota bytes, retention source/PDF/job và cleanup trong phase này theo nhu cầu staging; chưa tự chọn con số business.
- Không dựa vào MCP resource URI để giả định host tự download/render; có get_artifact tool và đường HTTP rõ ràng.

## MCP adapter

Tạo `app/api/mcp/route.ts`, `lib/mcp/server.ts`, schemas/tools/result mapping. Streamable HTTP với official SDK, Node runtime; transport session không được dùng thay auth. Xác minh identity mỗi request, Origin/Host checks theo protocol, negotiate protocol version, input/output limit. MVP có thể stateless transport vì job state ở DB.

Tool annotations: list/get read-only; compile/cancel có side effects. Retry compile chỉ idempotent với contract key; không gắn idempotentHint tùy tiện. Metadata/securitySchemes và auth challenge theo hướng dẫn host. Không phụ thuộc native MCP Tasks hoặc elicitation support để hoàn thành workflow.

## File dự kiến

Tạo `lib/jobs/`, worker entrypoint, `lib/artifacts/`, migration jobs/artifacts/grants + constrained RPC; `lib/mcp/`, route MCP/artifacts; sửa compose thêm worker, config limits và compiler client nếu cần cancellation. Sửa `/api/compile` auth/admission cùng policy để tránh public bypass; kiểm web caller tương thích. Không xóa legacy routes trong feature này.

## TODO và acceptance

- [ ] Transaction/idempotency/quota, worker leases và bounded retries; chứng minh restart recovery.
- [ ] Tectonic thật: minimal article, tiếng Việt, công thức và multi-file include.
- [ ] TeX lỗi trả diagnostics; không gọi AI nội bộ; host sửa và compile lại nhận PDF hợp lệ.
- [ ] Reject traversal, absolute paths, quá số file/byte, root thiếu, compile timeout và unsafe TeX theo sandbox policy.
- [ ] Cancel queued thành terminal; running cancel có ngữ nghĩa trung thực. Nếu chưa kill được compiler, trả cancel_requested và chặn publish, ghi rõ execution có thể chạy đến timeout.
- [ ] Duplicate/concurrent request không tạo nhiều document hoặc charge lại; worker crash trước/sau publish không nhân đôi kết quả.
- [ ] Worker cũ hết lease không publish sau worker mới hoặc sau cancel; JWT user không sửa trực tiếp protected job fields qua Supabase REST.
- [ ] PDF download: MIME/filename đúng, expired/revoked grant bị từ chối, không lộ artifact user khác, không trả PDF cũ khi compile mới fail.
- [ ] Cấp artifact link rồi sửa document qua web: link vẫn trả snapshot gốc hoặc lỗi expiry/revocation rõ ràng, tuyệt đối không trả PDF mới dưới artifactId cũ.
- [ ] Unit/contract + DB integration thật + compiler integration; `npm test`, `npm run lint`, `npm run build`, compiler tests theo phạm vi thay đổi. Phân loại failure có sẵn, sửa lỗi do feature.

Rủi ro chính: queue privilege, resource exhaustion, stale artifact và async cancellation. Đo thời gian/queue depth/error rate; logs dùng requestId/jobId/owner reference, không raw token/full source. Sau pass chuyển phase 3.
