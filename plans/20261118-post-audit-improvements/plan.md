# Kế hoạch cải thiện AI LaTeX Generator sau audit

## Kết quả cần đạt

- Người dùng mở web cạnh GPT thấy PDF phù hợp với source, kể cả khi GPT sửa liên tiếp hoặc người dùng đang giữ bản nháp.
- Workspace mở nhanh với tài liệu dài và cho thấy trạng thái PDF rõ ràng.
- Staging có thể chạy MCP worker, hoàn tất job và liên kết tài khoản thật qua OAuth.
- Sidebar và lịch sử phù hợp với chiều rộng cửa sổ khi đặt cạnh GPT.

Mốc đầu tiên là nghiệm thu local. Staging và ChatGPT cloud là một cổng riêng, cần endpoint HTTPS, cấu hình OAuth và hai tài khoản test. Các gói đều có thể bắt đầu cùng đợt sau khi thống nhất giao diện dữ liệu.

## Hợp đồng cần chốt trước khi giao việc

1. **Danh tính phiên bản.** `sourceRevision` đổi khi source, file project hoặc file gốc thay đổi, kể cả khi nội dung quay về giống bản cũ. `updatedAt` tiếp tục dùng cho các caller CAS hiện có trong giai đoạn chuyển đổi. Compile và thay đổi metadata không tự tăng `sourceRevision`.
2. **Danh tính PDF.** Metadata preview gồm revision hiện tại, revision của PDF khả dụng, trạng thái compile và định danh PDF. UI phân biệt có bản mới, đang compile, có PDF bản trước, chưa có PDF và compile lỗi. Bản nháp chưa lưu có nhãn riêng. Bản PDF cũ chỉ dành cho cùng chủ tài liệu, có thể xem hoặc tải với nhãn rõ ràng.
3. **Compile tại chỗ.** Tạo đường compile revision trên documentId hiện hữu. `compile_document` tiếp tục tạo tài liệu mới. Queue nhận snapshot source/project thuộc đúng revision, chống trùng theo tài liệu + revision, claim có lease và chỉ publish khi revision còn hiện hành. Các lần ghi gần nhau gom vào revision mới nhất; job đang chạy có thể hoàn thành nhưng kết quả cũ không được ghi đè. Nút Biên dịch vẫn cho phép retry khi lỗi và fallback khi auto-preview bị tắt.
4. **API metadata và bytes.** Chốt response metadata nhỏ cho editor/realtime, với URL PDF cùng origin và định danh version. Endpoint bytes kiểm tra quyền chủ sở hữu, có cache riêng tư phù hợp và không nhận định danh owner từ client. Giữ hợp đồng MCP và đường tải cũ trong lúc chuyển đổi; không xóa base64 khỏi API cũ trước khi rà hết caller.
5. **Lưu trữ và rollout.** Migration cộng thêm trường, backfill theo lô. Với PDF cũ không truy được revision, để trạng thái chưa xác định cho tới lần compile mới. Triển khai backend tương thích trước, frontend opt-in sau, bật auto-preview sau nghiệm thu. Flag tắt auto-enqueue khi cần rollback; thao tác biên dịch tay vẫn hoạt động.

## Gói chạy song song

| Gói | Quyền sửa độc quyền đề xuất | Việc làm và đầu ra | Phụ thuộc khi tích hợp |
| --- | --- | --- | --- |
| **A. Backend revision và queue** | Migration mới, `lib/jobs/`, application service compile và test tương ứng | Ghi revision ở mọi đường cập nhật source gồm autosave, MCP, chat và project; enqueue theo revision, áp quota, lease, retry, CAS khi publish; bảo toàn quyền và consent. | Chốt hợp đồng dữ liệu; cung cấp adapter cho store/API ở B. |
| **B. API PDF và hiệu năng dữ liệu** | Document store, API document/PDF, server loader; test API | Đo baseline payload/body và thời gian render trang đầu với PDF 2 trang, 30 trang và tài liệu nặng đại diện. Tách metadata và bytes bằng endpoint có xác thực. So số đo trước/sau; chỉ mở rộng sang Storage nếu có lý do từ số đo. | Dùng fixture theo hợp đồng của A trong lúc chờ migration; kiểm tra lại với dữ liệu thật sau khi ghép. |
| **C. Workspace và viewer** | `DocumentWorkspace`, viewer, hook realtime, test UI liên quan | Dựng trạng thái PDF theo revision, giữ PDF cũ có nhãn, giữ trang và zoom khi nạp bản mới, xử lý draft xung đột. Đổi nhãn lịch sử thành “Cập nhật trong phiên” và không suy đoán người sửa. Kiểm tra tải PDF worker và chi phí DOM với tài liệu dài. | Dựng và test UI bằng fixture metadata trong khi A/B chạy; nối backend sau. |
| **D. Bố cục /app** | `app/app/layout.tsx`, sidebar và test layout | Thu sidebar thành drawer/rail theo độ rộng. Kiểm tra điều hướng, focus trả về nút mở, nhãn cho icon và bố cục ở 360/600/768/1280px. | Độc lập, có thể nghiệm thu trước. |
| **E. Docker và OAuth staging** | Compose, env mẫu, deployment guide và kiểm tra vận hành | Kiểm tra fail-fast khi MCP bật mà thiếu URL/worker config. Ghi lệnh chạy profile, health và job từ queued đến hoàn tất. Xác minh manifest/client registration trên host thật, cấu hình HTTPS và audience, thử cấp và thu hồi consent bằng tài khoản test. | Runbook và Docker local làm ngay. OAuth hosted cần môi trường và client registration phù hợp. |

Root chốt từng đường ghi và file tích hợp sau khi rà dependency. Nếu hai gói cần cùng một file, root giữ file đó hoặc chuyển quyền sau khi worker trước đã dừng. Test runner tích hợp và báo cáo do root giữ. Không dùng chung fixture ghi dữ liệu giữa các worker.

## Điều phối và nghiệm thu

1. **Chốt hợp đồng và baseline.** Rà tác động theo symbol, xác định caller thực tế. Đo Chrome trên cùng profile, thiết bị và bộ PDF với vài lần chạy lạnh/ấm; lưu payload, thời gian đến canvas đầu tiên và số request. Phân việc theo bảng sau khi đóng băng interface.
2. **Chạy A–E đồng thời.** DeepSeek triển khai các gói độc lập trong phạm vi file đã giao, ưu tiên gói nhỏ có output kiểm chứng. Mỗi gói có mốc bàn giao 180 giây và wrapper timeout 300 giây. Nếu chưa xong ở mốc bàn giao, trả phần đã làm, file và lệnh kiểm tra; root chỉ chuyển quyền khi tiến trình đã dừng. Luna hoặc root tiếp quản phần còn lại nếu DeepSeek không khả dụng.
3. **Ghép A → B → C.** D và phần local của E nghiệm thu độc lập. Chạy migration trên local Supabase, giữ đường đọc/compile cũ để so sánh. Rà độc lập tranh chấp revision, quyền tải bytes, consent và lease trước khi bật auto-preview.
4. **Kiểm tra chạy thật.** Chạy test đơn vị, integration và build. Dùng Playwright + MCP trên tài liệu test riêng. Ghi riêng bằng chứng trình duyệt, DB/worker và kết quả ChatGPT hosted. Không coi tỉ lệ pass của local là pass OAuth.

| Cổng | PASS khi |
| --- | --- |
| Thứ tự revision | Hai cập nhật liên tiếp, kể cả kết quả compile đến ngược thứ tự, chỉ PDF revision mới nhất được đánh dấu hiện hành. Cùng revision enqueue nhiều lần chỉ có một công việc hữu hiệu. Truy vết được trường hợp worker restart/lease hết hạn. |
| An toàn dữ liệu | T04–T10 chạy với tài liệu test riêng. Bản nháp chưa lưu được giữ, compile lỗi vẫn còn bản trước có nhãn, project biên dịch đúng file gốc. Không tạo documentId mới khi compile lại. |
| Phân quyền | B không đọc hoặc tải PDF của A, kể cả khi biết URL. Consent bị thu hồi thì thao tác MCP tiếp theo bị từ chối. Kiểm tra riêng dev-token local và OAuth staging. |
| Hiệu năng | Realtime metadata không gửi PDF base64 sau khi bật đường API mới. So sánh payload và thời gian trang đầu trước/sau, báo rõ môi trường; không tuyên bố cải thiện nếu chưa đo. |
| UI | Chrome ở 360/600/768/1280px, dùng được bằng bàn phím, không cuộn ngang toàn trang. Người dùng phân biệt draft, PDF bản trước, đang compile, lỗi và PDF hiện hành mà không mở chat. |
| Vận hành | Khởi chạy theo runbook, worker claim và hoàn tất job, host kết nối đúng HTTPS. T11a, T11b và T12 chỉ PASS khi chạy được đúng môi trường và danh tính. |

## Bàn giao local

- Supabase local đã áp dụng 0011–0012. Queue được bật cùng worker local có `MCP_PREVIEW_WORKER_ENABLED=true`. Ở môi trường khác queue vẫn opt-in theo deployment guide.
- Kiểm tra SQL trong transaction đã xác nhận claim đúng revision, từ chối publish đến muộn, publish bản mới và giữ PDF trước khi compile lỗi.
- Chrome và MCP HTTP local đã thử hai lần sửa liên tiếp trên tài liệu `473428f1-3f17-4abb-b8b5-89d5ff3a37f1`. Trong lúc chờ, metadata tiếp tục trỏ tới PDF trước. Worker hoàn tất và PDF mới chứa nội dung mới nhất. URL version cũ trả 404 sau khi PDF mới thay thế.
- Trên fixture một trang, GET cũ trả 7.630 byte và GET metadata trả 575 byte. Chưa đo latency mở trang đầu hoặc tải với luận văn dài.
- Sidebar dùng drawer ở 360/600/768px, sidebar cố định ở 1280px. Chrome xác nhận không tràn ngang, có thể mở bằng Enter và đóng bằng Escape, focus quay về nút mở.
- Route PDF trả 401 với khách và 404 khi tài khoản B đã đăng nhập yêu cầu PDF của A. Đây là kiểm chứng route PDF, không thay cho T11a kiểm tra đọc, sửa và liệt kê ở MCP.
- Build, TypeScript, lint theo phạm vi, Docker Compose config và 52 test MCP/editor theo phạm vi đã đạt.
- Chrome mở editor ở 768px đã tự lấy và render PDF revision mới sau khoảng 3,1 giây từ lúc gửi MCP. Canvas thay đổi trong cùng trang, không reload và giữ zoom 125%.
- T07–T10 đã đạt trên Chrome và MCP local, gồm từ chối context cũ/anchor sai, giữ draft xung đột và sửa đúng một file trong project text. Hosted staging, T11–T12 qua OAuth và rehearsal trên dữ liệu lớn vẫn cần nghiệm thu riêng.
