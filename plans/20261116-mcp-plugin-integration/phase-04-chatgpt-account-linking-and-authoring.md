# Phase 4 — ChatGPT account linking, edit existing documents, and web-compatible output

Trạng thái: **IMPLEMENTATION PARTIAL** (2026-11-17). P3 có template spec, MCP discovery và server-side format validation. P2 có atomic patch cho text file project, giữ binary/untouched file, CAS và realtime signal. User chọn một consent bundle cho toàn bộ tool; migration 0010 bổ sung active-consent guard ở RPC/RLS, đã xác minh local. HTTPS staging và ChatGPT full-flow chưa hoàn tất.

## Baseline đã xác nhận trong source

- Plugin private `latex-ai-generator` đã được tạo trong ChatGPT, nhưng `plugins/ai-latex/mcp.json` đang trỏ `http://localhost:3001/api/mcp`. Server local không phải endpoint dùng được từ ChatGPT cloud.
- MCP đã xác minh bearer Supabase JWT, `sub`, issuer, audience và client allowlist trong `lib/auth/mcp-principal.ts`; DB access dùng user-scoped Supabase client.
- Supabase cùng project là identity store của web và MCP; RLS owner scope gắn tài liệu với cùng `userId`. MCP currently chỉ yêu cầu OAuth scope `openid`.
- Các tool đã có: `list_templates`, `get_template_spec`, `compile_document`, `list_documents`, `get_document`, `update_document_source`, job/artifact tools. `compile_document` tạo document mới. `update_document_source` hỗ trợ full source cho single-file và path/content patches cho text file hiện có trong project; project structure/root không đổi, binary/untouched entries được merge-preserve trong RPC CAS.
- Web editor nhận source revision qua Supabase Realtime; API đọc lại document có xác thực để lấy nội dung. User có thể mở `webUrl` trên tab web riêng và compile bằng UI.
- Web generation contract đang dùng `title`, `docType`, `template`, complete LaTeX. Template registry chứa guidance/capabilities/package allowlist; worker validate source theo allowlist rồi compile bằng Tectonic. MCP `list_templates` hiện chỉ đưa metadata cơ bản, chưa đủ template contract cho model.
- `getTemplateSpec()`/`listTemplateSpecs()` machine-readable từ registry được expose qua read-only MCP tool `get_template_spec`; `tests/unit/mcp-server.test.ts` xác nhận tool schema và gọi.
- `compileDocumentInputSchema` gọi pure validator `validateMcpLatexContract()` trước khi compile job được nhận: kiểm tra template/docType mapping, class, full document markers, Markdown fences và raw-text root source. Source không bị rewrite.
- Plugin skill hướng dẫn lấy spec, phân giải document mơ hồ, đọc source + `updatedAt` trước khi CAS update và phân biệt lưu source với compile PDF.
- Migration `0009_mcp_project_text_updates.sql` thêm RPC project patch riêng. SQL local Docker verification đã xác nhận text update, metadata/binary preservation, root `latex` sync, PDF/log/error invalidation, binary rejection và stale CAS conflict. Migration chưa được đẩy lên cloud.
- Consent page mô tả rõ một quyền kết nối chung cho đọc/sửa/tạo/compile/download/cancel. Migration `0010_mcp_active_consent_boundary.sql` chặn revoked consent ở document/revision RLS reads, job/artifact mutation triggers và job-result projection; local Docker verification xác nhận active read pass, revoked document rows 0, job projection null, cancel/job insert bị từ chối. Migration chưa được apply lên cloud.
- MCP project update focused unit tests 12/12 pass; typecheck/ESLint sau thay đổi pass.
- Local checks đã chạy: MCP server tests 3/3, LaTeX contract tests 11/11, TypeScript và ESLint cho các file liên quan đều pass. Đây không phải xác nhận compile bằng Tectonic thật hoặc kết nối ChatGPT cloud.

## Mục tiêu và nguyên tắc

1. Plugin dùng OAuth của cùng Supabase project với web; sau sign-in/consent, `sub` phải là đúng user ID của phiên web. Không tạo mật khẩu/token riêng cho plugin.
2. Chỉ đọc/sửa tài liệu thuộc user đã kết nối. User chọn tài liệu bằng tên/ngữ cảnh; khi kết quả mơ hồ, hỏi lại, tuyệt đối không tự chọn mục đầu tiên.
3. GPT là nơi soạn source theo yêu cầu user. MCP cung cấp format contract, lưu/kiểm tra/compile và trả web link; không âm thầm gọi AI nội bộ của ứng dụng.
4. Một document trong web có `title`, `docType`, `template`, `latex`, và tùy chọn `files`/`rootFile`. MCP output phải duy trì các trường này và compile được bởi pipeline hiện hành.
5. Mọi cập nhật hiện hữu dùng optimistic concurrency. Nếu user đang sửa ở web, MCP không ghi đè revision mới hơn; web chỉ cập nhật source realtime khi draft local sạch, còn draft dirty thì hiển thị xung đột.
6. Không xem việc plugin được lưu trong ChatGPT là bằng chứng endpoint đã kết nối. Cloud acceptance cần HTTPS public/staging, OAuth issuer/audience/client registration và full-flow thật.

## Quyết định contract đề xuất

### OAuth consent và tài khoản

- Giữ cùng Supabase Auth issuer cho website và MCP. OAuth authorization yêu cầu user đăng nhập/chọn đúng tài khoản, sau đó hiển thị consent gắn với website/ứng dụng.
- **Không gửi `documents:read/write/compile` như OAuth `scope`**: Supabase hiện chỉ hỗ trợ `openid`, `email`, `profile`, `phone`; custom scopes chưa được hỗ trợ. Xem [OAuth flows — supported scopes](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows) và [OAuth server overview](https://supabase.com/docs/guides/auth/oauth-server).
- User chọn **một consent chung cho toàn bộ bundle tool hiện có**: đọc/sửa tài liệu, tạo/compile, tải PDF và hủy job. Không có quyền chọn riêng theo thao tác.
- Kiểm tra active OAuth consent mỗi MCP request và tại database boundary; không tin riêng JWT claim nếu consent đã thu hồi. RLS vẫn giới hạn user sở hữu tài liệu.
- Plugin chỉ khai báo OAuth scopes Supabase thực sự hỗ trợ. Nút ngắt kết nối/revoke dùng host/Supabase OAuth revocation flow; xác minh token cũ không dùng được.
- Account linking MVP là đăng nhập OAuth vào cùng Supabase user, không ghép email từ hai identity provider và không chấp nhận user ID từ tool input.

### Chọn và sửa bản ghi

- Workflow skill: `list_documents` theo cursor → khớp title/ngữ cảnh → hỏi user khi có nhiều kết quả hợp lý → `get_document(includeSource=true)` → xác nhận đúng `documentId`/title với user trước khi có ý định ghi → sinh toàn bộ source/changes → gọi update với đúng `updatedAt`.
- Nếu target đã xác định rõ bằng `documentId`/webUrl từ ngữ cảnh, không cần hỏi lại. Không chọn theo thứ tự trả về hay chỉ dựa trên title trùng.
- Mở rộng update contract cho single-file và project nhiều file dạng text: input chứa `documentId`, `expectedUpdatedAt`, và nội dung thay đổi theo path; chỉ cho phép thay file `.tex`/text mà tool đọc được, giữ nguyên file không được yêu cầu sửa và mọi binary asset. Root file không được đổi nếu không có yêu cầu.
- Mọi file path đi qua cùng path guard hiện có; cấm traversal/absolute path/trùng path, giới hạn tổng byte/số file. Từ chối project mà nội dung một file/binary bị ẩn hoặc không đọc được nếu phép cập nhật có thể làm mất dữ liệu.
- CAS phải ghi source/files/rootFile/title (nếu được hỗ trợ) atomic trong một RPC/transaction. Xung đột trả `version_conflict` kèm hướng dẫn đọc lại và review thay đổi; không tự retry ghi đè.
- Không thêm delete-document tool trong phase này. Compile revision là hành động riêng trong UI; ChatGPT không được tuyên bố PDF đã cập nhật nếu chỉ mới lưu source.

### Output format tương thích web

MCP compile input/output giữ envelope rõ ràng:

```json
{
  "title": "...",
  "docType": "article | report",
  "template": "<TemplateId>",
  "latex": "\\documentclass{...} ... \\end{document}",
  "idempotencyKey": "..."
}
```

- Mở rộng template discovery thành `get_template_spec(templateId)` hoặc response tương đương có version, label, `docType`, document class, package allowlist, capability flags, required structure/output rules và hướng dẫn sinh; không trả implementation nội bộ dư thừa.
- Server là authority cuối: validate template ID, `docType` mapping, document class, package allowlist, complete document boundaries, safe source/project constraints và byte limits trước khi enqueue/compile. Prompt/skill hướng dẫn GPT nhưng không thay server validation.
- Nếu template không được chỉ định, GPT phải chọn sau khi suy ra loại tài liệu hoặc hỏi user khi lựa chọn ảnh hưởng đáng kể. Web và MCP lưu cùng `template`/`docType` enum và metadata.
- Compile failure trả diagnostics chuẩn hóa và giữ source/job đúng bản; GPT có thể sửa source và gửi compile job mới. Không tạo bản ghi sai định dạng một cách lặng lẽ.
- Không dùng provider AI của web trong tool MCP. Nếu sau này muốn server tự sinh, đó là feature/chi phí/quota riêng.

## Các workstream và thứ tự

### P0 — Cloud endpoint và OAuth connection spike

Phụ thuộc: staging target có HTTPS public và Supabase Auth/OAuth được bật, hoặc một tunnel HTTPS được duyệt cho test có giới hạn. Plugin account hiện có là private và đã được lưu.

1. Chốt hosting/domain staging và Supabase project non-production; không dùng project production đã thấy có dữ liệu unrelated làm nơi rehearsal.
2. Triển khai app MCP trên HTTPS ổn định; worker và compiler vẫn private/internal. `MCP_RESOURCE_URL`, audience policy, issuer, callback/client ID allowlist cùng OAuth consent phải trỏ đúng endpoint.
3. Cập nhật plugin private `mcp.json` bằng endpoint đã kiểm chứng; cấu hình scopes. Không đưa secret/service-role vào plugin.
4. Chạy OAuth Authorization Code + PKCE từ plugin ChatGPT: login user web → consent → discover tools. Ghi nhận JWT `sub` (redacted) khớp Supabase user web; kiểm tra sign-out/revoke.

Acceptance: ChatGPT thật gọi được `list_documents`; document của cùng web user xuất hiện; user B không thấy tài liệu A; revoke làm request tiếp theo thất bại. Nếu chưa có HTTPS target, các workstream code/local có thể triển khai, nhưng không đánh dấu kết nối ChatGPT hoàn tất.

### P1 — OAuth permission boundary

Phụ thuộc: P0 issuer/client/consent spike; user đã chọn một consent bundle. GitNexus impact hiện lỗi WAL, nên giữ mọi thay đổi ở boundary có thể source-trace và test local.

File chính: `app/auth/consent/page.tsx`, `supabase/migrations/0010_mcp_active_consent_boundary.sql`, deployment guide, auth tests. `plugins/ai-latex/mcp.json` chỉ giữ OAuth scopes Supabase hỗ trợ; không thêm custom scopes.

1. [x] Chốt một OAuth consent bundle cho toàn bộ công cụ; không yêu cầu custom OAuth scopes.
2. [x] Consent UI hiển thị rõ đọc/sửa/tạo/compile/download/cancel và thông báo bundle không tách quyền.
3. [x] MCP endpoint xác minh active consent mỗi request; migration 0010 bảo vệ document/revision RLS reads, job/artifact mutation và job-result projection theo live consent bound user/client/audience.
4. [x] Local Docker SQL checks: active consent đọc được owner document; revoked consent trả 0 document row/null job và chặn cancel/job insert. Cloud, full user A/B, audience/issuer/client matrix còn pending.

Acceptance: một consent cho phép đúng bundle tool; consent bị revoke thì MCP và các RPC/RLS read path đều từ chối; OAuth `sub` luôn ánh xạ đúng user web; không chấp nhận `userId` từ model/input. OAuth request chỉ dùng scopes Supabase hỗ trợ.

### P2 — Document resolution và atomic project edit

Phụ thuộc: P1 cho production/cloud acceptance. Local schema và semantics MVP được chốt: patch nội dung text tại path hiện có, không đổi cấu trúc/root; binary và phần không yêu cầu sửa được giữ nguyên.

File dự kiến: `lib/mcp/server.ts`, `lib/application/mcp-documents.ts`, `lib/application/mcp-update-source.ts`, migration/RPC `mcp_update_document_source`, plugin skill; tests MCP/RPC/realtime.

1. [x] Giữ `list_documents` pagination làm discovery; skill yêu cầu hỏi lại khi nhiều tài liệu phù hợp và đọc trước khi ghi. `search_documents` riêng chưa cần cho MVP này.
2. [x] Update input hỗ trợ single-file full source hoặc text patch paths, `expectedUpdatedAt`; patch không cho add/delete/rename/root change.
3. [x] RPC riêng thực hiện owner check, active grant check, row lock/CAS và merge `files` JSONB; preserve binary/untouched entries. Project patch/RPC local verified; edit-to-open-editor realtime E2E remains pending.
4. [x] Tool description/skill yêu cầu read-before-write, xử lý ambiguity/conflict và trả `webUrl`.
5. Realtime event vẫn chỉ mang revision metadata; editor lấy source bằng authenticated GET. WebSocket mất kết nối không được làm hỏng persistence; reconnect/refresh phải hội tụ.

Acceptance: user tìm/chọn đúng tài liệu; title trùng thì hỏi rõ; một edit chỉ đổi path được yêu cầu; multi-file assets không mất; source mới hiện trong editor đang mở mà không reload; draft local không mất; write stale bị từ chối; user khác nhận not_found; binary/unsupported document bị từ chối an toàn.

### P3 — Web format contract và compile quality

Phụ thuộc: schema P2 không bắt buộc; có thể làm song song P2 nếu contract compile không đổi.

File dự kiến: `lib/mcp/server.ts`, `lib/application/input-schema.ts`, `lib/jobs/worker.ts`, `lib/templates/registry.ts` (đọc metadata; tránh đổi registry nếu không cần), `lib/validation/*`, plugin skill, tests template/MCP/compiler.

1. [x] Tạo machine-readable template spec từ registry và expose qua `get_template_spec` MCP tool.
2. [x] MCP input boundary validate `docType` + `template` + full source format trước khi nhận compile job. Package allowlist trong worker vẫn là bước kiểm tra tiếp theo; project root được kiểm tra raw text và các file khác không bị đổi.
3. Giữ full LaTeX do ChatGPT viết; không sửa source tự động để hợp thức hóa sai contract. Diagnostics nói trường/constraint vi phạm.
4. [x] Cập nhật skill: GPT chọn template, tạo complete source theo spec, compile, sửa theo diagnostics có giới hạn, rồi trả `webUrl` và kết quả PDF đúng trạng thái.
5. Kiểm tra output trường lưu khớp web UI (title/type/template/source/project/root); Web editor mở được và compile lại bằng cùng pipeline.

Acceptance: từng template được GPT hướng dẫn bằng spec đúng; malformed/incompatible source bị từ chối trước hoặc thất bại có diagnostics rõ; valid Vietnamese/math/table/document compile bằng Tectonic thật; không lẫn Markdown fence; bản lưu trên web có đúng metadata.

### P4 — End-to-end private release

Phụ thuộc: P0–P3. Cập nhật release plugin đã có thay vì tạo bản duplicate.

1. Upload/update private plugin cùng ID, xác nhận icon/tên/skill/config hiển thị và OAuth connect hoàn tất.
2. Full flow trên ChatGPT: tạo doc mới → mở editor web tab riêng → cập nhật doc đã chọn → thấy realtime → compile trên web → PDF mới; có cả stale conflict và 2-user denial.
3. Kiểm tra tối thiểu một single-file và một multi-file project, một template tiếng Việt/math, OAuth revoke, reconnect user.
4. Chạy type/lint và test unit/DB/compiler/auth liên quan; independent review auth/RLS/CAS/asset preservation. E2E cloud được ghi riêng, không thay bằng MCP Inspector/local SDK.
5. Cập nhật `docs/deployment-guide.md`, `docs/system-architecture.md`, plan/feature tracking với endpoint/environment cụ thể nhưng không ghi secret.

## Acceptance ledger

| ID | Kết quả | Verification | Gate |
|---|---|---|---|
| A1 | Plugin login vào đúng web account | ChatGPT OAuth PKCE + so sánh Supabase `sub`; hai account | P0/P1 |
| A2 | Một consent bundle, revoke có hiệu lực | Local active/revoked RPC/RLS checks pass; ChatGPT OAuth revoke và cloud user A/B pending | P1/P4 |
| A3 | GPT chọn đúng record | Tool discovery + skill ambiguity rule; live ChatGPT choice flow chưa xác minh | P2/P4 |
| A4 | Edit hiện trong editor realtime | RPC trigger phát revision; earlier local single-file realtime flow verified; project update-to-open-editor E2E pending | P2/P4 |
| A5 | CAS giữ thay đổi người dùng | Single-file local verified earlier; project RPC stale-CAS conflict verified in local SQL | P2 |
| A6 | Multi-file edit không mất asset | Local SQL confirms binary/untouched JSON preservation for requested-path patch | P2 |
| A7 | Output theo format web | Format validator + MCP tool contract đã qua local unit checks; compile Tectonic thật và reopen trên web chưa xác minh | P3/P4 |
| A8 | User thấy trạng thái đúng | Source saved ≠ PDF compiled; mở webUrl; PDF chỉ báo thành công sau job success | P3/P4 |

## Rủi ro, giới hạn và quyết định cần chốt trước implementation

- **Endpoint ChatGPT cloud:** hiện chưa có domain/staging HTTPS được xác nhận; localhost config không hoàn tất OAuth ChatGPT. Đây là dependency ngoài code và là gate trước khi tuyên bố kết nối plugin thành công.
- **OAuth scopes:** Supabase OAuth hiện không hỗ trợ custom scopes. Plugin dùng một consent bundle với scopes chuẩn Supabase; consent UI phải mô tả rõ toàn bộ thao tác và revoke behavior.
- **Supabase target:** dùng project/staging cô lập; không áp dụng migrations lên project production đã có schema unrelated. Giữ migration và local verification độc lập.
- **Multi-file/binary:** current source read không trả binary content và update RPC từ chối project. Chốt phạm vi text edit + preservation; không cho model thay cả project khi có asset ẩn.
- **GitNexus:** impact analysis cho `compileDocumentInputSchema` vẫn lỗi `Corrupted wal file` (risk UNKNOWN); implementation giới hạn ở validator boundary, dựa trên source caller trace. Cần sửa/rebuild index trước thay đổi rộng hơn.
- **Generated output correctness:** template prompt là hướng dẫn, không phải security boundary; server validator + Tectonic là acceptance cuối.
- **Không nằm trong phase:** public marketplace, chia sẻ team workspace, plugin multi-user administration, tự compile mỗi lần GPT sửa, gọi AI nội bộ, xóa tài liệu, bảo đảm compile an toàn cho TeX không đáng tin cậy ngoài sandbox hiện tại.

## Thứ tự triển khai đề xuất

1. (Done locally) OAuth spike, one-bundle consent UI, and active-consent checks in MCP/RPC/RLS (P0/P1).
2. (Done locally) Atomic project text patch, CAS, binary preservation, and realtime revision signal (P2); browser editor full-flow remains pending.
3. (Done locally) Expose template format spec and validate web-compatible source (P3); real Tectonic + web reopen remains pending.
4. (Pending external environment) Configure HTTPS staging and production-like OAuth registration with a non-production Supabase project.
5. (Pending) Update the existing private plugin against that endpoint and run ChatGPT end-to-end including account A/B, revoke, realtime editor, and PDF acceptance (P4).

Chưa implement, chưa chạy test/deploy trong lần lập plan này.
