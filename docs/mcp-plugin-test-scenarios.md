# Kịch bản test MCP + plugin LaTeX AI Generator

Ngày soạn: 18/11/2026. Đây là hướng dẫn chạy thủ công, không phải báo cáo đã chạy các ca dưới đây.

## 1. Chọn môi trường trước khi test

| Chế độ | Kết nối | Kiểm chứng được |
| --- | --- | --- |
| MCP local | `http://localhost:3001/api/mcp`, client gửi development API key trong Bearer header | Tool discovery, compile, đọc/sửa tài liệu, selection edit, realtime web |
| Plugin local | Host hỗ trợ local HTTP; package hiện khai báo OAuth | Khả năng host nạp plugin/skill và OAuth local nếu host hỗ trợ; API key không tự thay thế cấu hình OAuth |
| Plugin ChatGPT cloud | Endpoint HTTPS mà ChatGPT truy cập được, OAuth cùng Supabase với web | Luồng plugin + liên kết tài khoản + toàn bộ nghiệp vụ |

Package trong repo hiện trỏ localhost và dùng OAuth. ChatGPT cloud không gọi được localhost trên máy bạn. Thấy plugin trong danh sách chưa chứng minh kết nối MCP thành công. Nếu chưa có HTTPS/OAuth đã cấu hình, ghi các ca cloud là **BLOCKED**, chạy nghiệp vụ bằng MCP local trước.

Không nhập API key hoặc JWT vào nội dung chat. Chỉ đặt API key trong cấu hình header của client local; không sửa package để lưu credential. Xem [deployment-guide.md](deployment-guide.md) nếu cần tạo lại credential hết hạn bằng `npm run mcp:dev-credentials`.

## 2. Chuẩn bị

1. Local Supabase có migrations 0001–0010 và Realtime; web, compiler, MCP worker đang chạy theo deployment guide.
2. Mở web ở `http://localhost:3001`, đăng nhập bằng tài khoản test. Client MCP phải đại diện đúng tài khoản đó.
3. Mở một cuộc chat mới, bật plugin LaTeX AI Generator theo cơ chế của host. Giữ web ở tab riêng.
4. Trong mỗi prompt bên dưới, thay `<DOCUMENT_ID>` bằng ID thật. Thay `<SELECTION_JSON>` bằng toàn bộ JSON từ nút **Copy context cho AI**.
5. Quan sát tool call của host: không tính câu trả lời “đã xong” là PASS nếu không có kết quả tool hoặc thay đổi thực tế trên web.

Để test nhanh, chạy T01 → T02 → T03 → T04 → T05 → T06. Sau đó chạy các ca âm và OAuth.

## T01 — Plugin gọi được MCP và lấy format

Copy vào chat:

```text
Dùng plugin LaTeX AI Generator: gọi list_templates, sau đó get_template_spec với templateId academic. Chỉ trả tên template, docType, documentClass và các yêu cầu định dạng chính từ kết quả tool. Chưa tạo tài liệu. Nếu tool không khả dụng hoặc cần kết nối tài khoản, nói rõ lỗi.
```

PASS: có hai tool call thành công, format lấy từ server. Kết nối OAuth nếu được yêu cầu phải đăng nhập đúng tài khoản web và cấp consent. Không tạo document ở bước này.

Nếu không thấy `edit_document_selection` trong tool discovery của client, refresh/reconnect tool catalog trước T04; không xem việc plugin được cài là đủ.

## Preflight trước T02

Nếu dùng khóa dev, đối chiếu email đang đăng nhập trên web với `MCP_DEV_TEST_EMAIL` trong cấu hình local của MCP. Chỉ chạy các bước nghiệm thu editor khi hai email khớp. Nếu khác hoặc chưa xác nhận được, ghi **BLOCKED** cho phần mở editor và các ca phụ thuộc. Vẫn có thể kiểm tra compile/PDF riêng qua MCP. Không đưa giá trị khóa dev vào báo cáo.

## T02 — GPT tạo báo cáo hai trang, server compile và lưu

```text
Dùng LaTeX AI Generator tạo một báo cáo test tên MCP E2E — precise edit. Đọc list_templates và get_template_spec cho academic trước khi viết. Nội dung tiếng Anh để giảm phụ thuộc font: trang 1 có tiêu đề Introduction, câu chính xác "TARGET_SENTENCE: This paragraph needs improvement." và câu "KEEP_UNCHANGED: Alpha 123."; trang 2 có tiêu đề Conclusion và câu "KEEP_UNCHANGED: Beta 456.". Dùng ngắt trang tường minh để có hai trang, không thêm mục lục hay bibliography không cần thiết. Bạn tự viết LaTeX theo format tool trả về, gọi compile_document đúng một lần cho payload này với idempotencyKey mới. Poll get_job đến trạng thái cuối. Nếu thành công, trả documentId, artifactId, jobId và webUrl; nếu thất bại, báo lỗi thật.
```

- **Compile/PDF PASS** khi job trả `succeeded`, có `documentId`, `artifactId`, `webUrl` và PDF có đúng hai trang với đủ ba marker.
- **Mở editor PASS** khi mở `webUrl` trong phiên web đã qua preflight và thấy đúng tài liệu, tiêu đề và PDF. Ghi lại các ID để dùng cho các bước tiếp theo.

## T03 — Tải PDF snapshot

```text
Với artifactId vừa tạo, gọi get_artifact(format=pdf) và đưa link tải cho tôi. Không compile_document lại.
```

PASS: tải được PDF, nội dung khớp kết quả T02. Link có thời hạn và dùng một lần; nếu cần tải lại, xin link mới. Snapshot này không đổi khi source được chỉnh ở các bước sau.

## T04 — Chọn chính xác một đoạn và edit realtime

Trong source LaTeX thường, các marker dùng dấu gạch dưới đã escape, ví dụ `TARGET\_SENTENCE`. Copy đúng chuỗi trong editor và giữ dấu escape ở replacement. PDF vẫn hiển thị `TARGET_SENTENCE`. Áp dụng tương tự cho `KEEP\_UNCHANGED`, `WEB\_EDIT` và `AI\_FOLLOWUP`.

1. Trong web mở tab **LaTeX** của document T02. Bôi đen nguyên câu `TARGET_SENTENCE: This paragraph needs improvement.` trong source đã lưu.
2. Bấm **Copy context cho AI**. Giữ tab editor mở, không sửa thêm source.
3. Gửi prompt sau cùng JSON đã copy:

```text
Dùng edit_document_selection cho selection JSON bên dưới. Replacement chính xác là "TARGET_SENTENCE: This paragraph is now clear and concise.". Giữ nguyên selection JSON và dùng nó làm trường selection, chỉ thay nội dung đoạn đã chọn. Không gọi compile_document hoặc update_document_source. Trả documentId, filePath, changedRange và updatedAt từ tool.

<SELECTION_JSON>
```

PASS: đúng tool được gọi thành công, cùng documentId; web nhận câu mới mà không reload thủ công; hai câu KEEP_UNCHANGED vẫn nguyên vẹn. Source save có thể làm PDF cũ biến mất vì chưa compile revision mới. Không tính PDF chưa cập nhật là lỗi realtime source.

FAIL: model chỉ in LaTeX trong chat, tạo document khác, sửa ngoài đoạn chọn, hoặc web không nhận source mới. Ghi thời gian từ tool thành công đến khi web cập nhật nếu có chậm.

## T05 — Compile revision vừa sửa trên web

1. Ở cùng document, bấm **Biên dịch** trên web.
2. Mở PDF và kiểm tra câu mới cùng hai marker giữ nguyên.

PASS: vẫn documentId cũ, PDF mới có replacement, không tạo bản ghi khác. Nút compile đang thuộc editor web; `compile_document` trong MCP tạo tài liệu mới nên không dùng nó để nghiệm thu bước này.

## T06 — Web sửa trước, GPT đọc lại rồi sửa đúng bản ghi

1. Sửa câu Conclusion trên web thành `WEB_EDIT: Updated in the browser.`. Đợi trạng thái **Đã lưu**.
2. Gửi:

```text
Đọc documentId <DOCUMENT_ID> bằng get_document(includeSource=true). Trích lại câu WEB_EDIT tìm thấy, rồi thêm đúng một câu "AI_FOLLOWUP: Read the latest revision first." ngay sau nó bằng update_document_source với expectedUpdatedAt đúng từ lần đọc đó. Không tạo tài liệu mới. Giữ nguyên các phần còn lại và trả documentId + updatedAt từ tool.
```

PASS: GPT đọc được `WEB_EDIT`, update cùng ID, web thấy cả hai câu. Đây là test chỉnh source toàn file, bổ sung cho test chỉnh selection ở T04.

## T07 — Context cũ phải bị từ chối

1. Bôi đen một câu đã lưu và copy context, giữ JSON này.
2. Sửa một đoạn khác trên web, đợi **Đã lưu** để revision thay đổi.
3. Gửi:

```text
Đây là ca kiểm thử context cũ. Gọi edit_document_selection đúng một lần với JSON bên dưới và replacement "STALE_WRITE_MUST_NOT_APPEAR". Nếu tool báo conflict, dừng và báo mã lỗi; không đọc lại để tự retry, không dùng tool khác để ghi.

<SELECTION_JSON_CŨ>
```

PASS: tool trả `isError=true`, code `version_conflict`; source không chứa marker replacement; thay đổi web ở bước 2 được giữ. Model né gọi tool thì chưa kiểm chứng được ca này.

## T08 — Cùng revision nhưng anchor sai phải bị từ chối

1. Copy context mới từ một đoạn đã lưu, không sửa web.
2. Trong bản JSON để gửi, đổi riêng `selectedText` thành `INTENTIONALLY_WRONG_ANCHOR`; giữ nguyên revision và offsets.
3. Gửi prompt như T07, dùng JSON đã sửa và replacement `BAD_ANCHOR_MUST_NOT_APPEAR`.

PASS: `version_conflict`, không có write. Đừng đổi documentId hoặc đoán lại offsets để làm ca test pass.

## T09 — Bản nháp trên web không bị MCP ghi đè

1. Copy một context từ source đã lưu.
2. Bắt đầu sửa thêm trên web rồi gửi selection edit từ MCP. Nếu auto-save kịp chạy trước, MCP có thể trả conflict: đó là hành vi hợp lệ.
3. Muốn tái hiện ổn định: tạm chuyển browser Offline để giữ draft chưa lưu, sửa draft, thực hiện MCP edit qua client riêng, rồi đưa browser Online lại. Không sửa source để giả lập response.

PASS: nếu MCP ghi thành công trước, editor giữ draft và hiện thông báo revision mới; người dùng chọn bản máy chủ hoặc giữ/lưu draft theo UI. Không âm thầm thay draft bằng source MCP. Nếu web auto-save trước, MCP phải từ chối context cũ như T07. Khôi phục Online sau test.

## T10 — Multi-file: sửa đúng một file

1. Dùng một project test có `main.tex` và `section1.tex`; có thể dùng hành động **Thêm file** của tài liệu single-file rồi chuẩn bị/lưu nội dung hai file trên web.
2. Trong `section1.tex`, bôi đen một câu, copy context; kiểm tra `filePath` là `section1.tex`.
3. Gửi prompt T04 với replacement phù hợp.

PASS: chỉ file đã chọn thay đổi; file gốc, file khác và danh sách path giữ nguyên. Editor sạch nhận revision realtime. Nếu có ảnh/binary đã chuẩn bị, chúng vẫn còn. MCP selection edit không thêm/xóa/đổi tên file.

## T11a — Quyền truy cập chéo A/B

Chỉ dùng hai tài khoản test bạn sở hữu, không dùng document thật của người khác.

1. Dùng danh tính MCP của A để tạo tài liệu test và lấy context vùng chọn hợp lệ của A.
2. Mở URL tài liệu A trong phiên web riêng của B để kiểm tra quyền đọc trên web.
3. Dùng danh tính MCP đã xác nhận của B để gọi `get_document(documentId=<ID_CỦA_A>, includeSource=true)`, thử `edit_document_selection` bằng context test A, rồi gọi `list_documents`.

PASS khi web của B không mở được tài liệu A, MCP của B từ chối đọc và sửa tài liệu A, và `list_documents` của B không liệt kê tài liệu A.

## T11b — Liên kết tài khoản qua OAuth

Kết nối A qua OAuth trên host và đối chiếu với phiên web của A bằng một tài liệu test. Ngắt kết nối A, kết nối B qua OAuth và đối chiếu bằng phiên web riêng của B. PASS khi tài liệu test do MCP tạo dưới mỗi kết nối OAuth xuất hiện trong đúng tài khoản web tương ứng. Ghi BLOCKED nếu luồng OAuth trên host chưa hoạt động.

## T12 — Consent OAuth và thu hồi quyền (môi trường có OAuth)

1. Kết nối plugin với tài khoản test web qua OAuth; kiểm tra consent bundle đọc/sửa/compile.
2. Chạy T01/T02, đối chiếu document thấy trong đúng tài khoản web.
3. Thu hồi consent đã cấp cho client test bằng chức năng quản lý grants của môi trường Supabase/host. Việc chỉ xóa plugin trên host chưa đủ chứng minh server đã thu hồi consent.
4. Thử đọc document/cập nhật source bằng credential đã cấp trước đó.

PASS: server từ chối quyền sau thu hồi; web session thường vẫn dùng được. Kết nối lại qua OAuth, cấp consent và test lại T01. Nếu môi trường chưa có cách revoke/quan sát grant, đánh dấu BLOCKED và ghi rõ phụ thuộc.

## Ghi kết quả

### Lần chạy Codex MCP local ngày 18/11/2026

T01–T03 chạy qua **Codex MCP local dùng adapter stdio và khóa dev**. Kết quả của lần chạy này chỉ xác nhận đường gọi qua adapter stdio. Việc nạp MCP từ manifest plugin và đăng nhập OAuth chưa được kiểm chứng.

- `documentId` — `65181566-f43a-48c9-83e5-7d138b73a707`
- `jobId` — `f7ff9f08-59cf-44fe-94a6-d9fcf889e442`
- `artifactId` — `d5f064ab-5293-4953-9593-d5dac2ba7e38`

| Ca | Kết quả | Bằng chứng |
| --- | --- | --- |
| T01 | PASS | `list_templates` và `get_template_spec` trả mẫu `academic`. |
| T02 — Compile/PDF | PASS | Job `succeeded`. PDF có đúng hai trang và đủ ba marker. |
| T02 — Mở editor | PASS | Lần đầu, phiên web `editor-test-236a50@example.test` báo “Không tìm thấy tài liệu”. Khi kiểm tra lại, cấu hình Codex dùng adapter stdio và `.env.local`. Database xác nhận chủ tài liệu trùng `MCP_DEV_TEST_EMAIL`. Chrome đăng nhập bằng tài khoản đó và mở đúng documentId, thấy tiêu đề “MCP E2E — precise edit” và khung xem PDF. |
| T03 | PASS | `get_artifact(format=pdf)` cấp link tải. HTTP 200 và nội dung PDF khớp T02. |
| T04 | PASS | Chrome local + MCP HTTP dùng khóa dev. Tài liệu test riêng `95f070e3-ebb4-4c6b-a959-a36d4daa2b6e`. Copy context thật, thay đúng vùng 93–151, giữ hai marker. Editor đổi source sau 788 ms đo từ lúc gửi tool, không reload. Trạng thái cần biên dịch và mục Lịch sử xuất hiện. |
| T05 | PASS | Biên dịch bằng nút trên web, giữ nguyên documentId. PDF render trong viewer và PDF.js xác nhận đúng hai trang, chứa câu mới và hai marker. |
| T06 | PASS | Web tự lưu `WEB_EDIT`. MCP đọc revision đã lưu, cập nhật cùng tài liệu bằng `expectedUpdatedAt`. Web nhận cả hai câu sau khi MCP ghi. |
| T07 | PASS | MCP từ chối context của revision trước sau một lần ghi mới; source không chứa replacement từ lần thử stale. |
| T08 | PASS | MCP từ chối selectedText sai ở đúng revision và offsets; source không đổi. |
| T09 | PASS | Biến thể Chrome local: chặn riêng PATCH để giữ bản nháp, gọi MCP cập nhật source từ client khác, thấy cảnh báo xung đột và draft giữ nguyên cho đến khi chọn Dùng bản máy chủ. |
| T10 | PASS | Chrome copy context từ `section1.tex` của project `fea0844d-55f7-4e37-a60d-e495b9aa98db`. Editor nhận đúng đoạn mới; root, `main.tex`, `section2.tex` và danh sách file giữ nguyên. Fixture chỉ có file text. |
| T11a — Quyền truy cập chéo A/B | BLOCKED | Lần mở bằng tài khoản web khác cho bằng chứng ban đầu về việc chặn đọc trên web. Chưa kiểm tra đọc, sửa và liệt kê bằng danh tính MCP của B. |
| T11b — Liên kết tài khoản qua OAuth | BLOCKED | Chưa xác nhận được luồng liên kết OAuth cho hai tài khoản test. |
| T12 — Thu hồi consent | BLOCKED | Chờ môi trường OAuth hoạt động và có chức năng thu hồi grant để kiểm tra. |

Có thể chạy lại T04–T06 bằng `node --env-file=.env.local scripts/smoke-mcp-workspace.mjs <test-document-uuid>`. Dùng tài liệu local riêng với hai trang và marker baseline T02. Script thực hiện ghi lên tài liệu được truyền vào. Lượt tự động kiểm chứng trình duyệt và MCP HTTP local, chưa kiểm chứng ChatGPT cloud hoặc OAuth.

### Mẫu cho lần chạy tiếp theo

| Ca | Môi trường/host | PASS / FAIL / BLOCKED / NOT RUN | jobId/documentId | Bằng chứng và lỗi |
| --- | --- | --- | --- | --- |
| T01 | | NOT RUN | | |
| T02 — Compile/PDF | | NOT RUN | | |
| T02 — Mở editor | | NOT RUN | | |
| T03 | | NOT RUN | | |
| T04 | | NOT RUN | | |
| T05 | | NOT RUN | | |
| T06 | | NOT RUN | | |
| T07 | | NOT RUN | | |
| T08 | | NOT RUN | | |
| T09 | | NOT RUN | | |
| T10 | | NOT RUN | | |
| T11a — Quyền truy cập chéo A/B | | NOT RUN | | |
| T11b — Liên kết tài khoản qua OAuth | | NOT RUN | | |
| T12 | | NOT RUN | | |

Khi lỗi, gửi tên ca, tool name, mã lỗi/status, jobId/documentId và ảnh UI nếu có. Không gửi Bearer header, API key, JWT hoặc service-role key. Ghi riêng kết quả MCP local và plugin cloud; kết quả local không thay thế nghiệm thu OAuth/cloud.
