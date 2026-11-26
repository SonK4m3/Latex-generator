# Plan — Xem trước LaTeX cạnh ChatGPT

## Mục tiêu

Khi người dùng mở ChatGPT và web cạnh nhau, web ưu tiên hiển thị tài liệu. Người dùng nhìn thấy tên file, số trang, trang hiện tại và bản cập nhật mới nhất mà không cần mở chat nội bộ. Giữ hệ thiết kế trung tính hiện tại và dùng màu nhấn cho trang đang chọn, trạng thái biên dịch và hành động chính.

## Hiện trạng

- `DocumentWorkspace` chia không gian giữa preview và chat. Trạng thái xem PDF, mã nguồn và thông báo xung đột đã tồn tại.
- `PdfPreview` nhúng PDF bằng iframe. App chưa điều khiển được danh sách trang, số trang và đồng bộ trang đang xem qua component này.
- `use-document-realtime` đã nhận thông báo revision. Dùng lại luồng này cho phản hồi trong UI. Cần xác minh riêng dữ liệu trước khi cam kết lịch sử bền vững, danh tính tác giả hoặc thao tác khôi phục.

## Bố cục và tương tác

| Vùng | Hành vi |
| --- | --- |
| Thanh trên | Tên tài liệu, nhãn tên file nguồn thực khi có. Với project, phân biệt file đang sửa và file gốc dùng để biên dịch. Đặt trạng thái và nút Lịch sử, Chat ở bên phải. |
| Danh sách trang | Cột thumbnail có số trang và trạng thái đang chọn. Bấm thumbnail hoặc nhập số để mở trang. Bản đầu hiển thị từng trang và chỉ dựng thumbnail gần trang hiện tại. |
| Vùng chính | PDF vừa chiều rộng theo mặc định, có zoom và chỉ số “Trang 2 / 12”. Tab Mã nguồn giữ luồng chỉnh sửa và Copy context cho AI. Có tải PDF khi bản hiện hành sẵn sàng. |
| Chat nội bộ | Đóng mặc định. Nút Chat mở và đóng panel, giữ hội thoại hiện tại và không ngắt luồng gửi đang chạy. Với project nhiều file, giữ giới hạn chat hiện có. |
| Lịch sử | Hiện “Đã cập nhật” cùng thời gian khi nhận revision mới. Nút Lịch sử mở danh sách thay đổi trong phiên và thời điểm cập nhật cuối đã lưu. Chỉ gắn nhãn nguồn khi backend có dữ liệu xác thực. |

Dùng chiều rộng **workspace**, vì cửa sổ thường bị thu hẹp khi mở cạnh GPT. Từ 900px của vùng viewer, hiển thị cột thumbnail. Dưới mốc đó, nút Trang mở hàng thumbnail cuộn ngang. Chat mở trên vùng làm việc và Lịch sử mở dưới thanh tên tài liệu. Khi zoom, cuộn ngang trong vùng PDF.

## Thứ tự triển khai

| Gói | Phạm vi | Điều kiện bàn giao |
| --- | --- | --- |
| Workspace | `DocumentWorkspace`: thanh tài liệu, chat đóng mặc định, hành động compile luôn truy cập được, thông báo và lịch sử trong phiên | Rà lại guard lưu/compile, project và xử lý bản nháp. |
| Viewer | Viewer riêng của workspace, PDF worker cục bộ, canvas theo vùng nhìn thấy, danh sách trang và zoom | Chrome mở tài liệu T02, hiển thị đúng 2 trang, nhảy trang và tải được PDF. |
| Tích hợp | Gắn viewer vào workspace, giữ đường xem PDF khi thao tác canvas lỗi | TypeScript, lint theo phạm vi, build và kiểm tra 360/768/1280px. |
| Realtime | Dùng revision được workspace chấp nhận để ghi sự kiện, phân biệt source mới và PDF | Kiểm tra bằng MCP và editor mở đồng thời; ghi riêng kết quả xác minh trình duyệt và trạng thái T04–T06. |

1. **Đổi bố cục workspace.** Tách thanh tài liệu, vùng xem chính và panel tùy chọn. Ưu tiên PDF, ẩn chat mặc định, triển khai hành vi theo chiều rộng vùng chứa. Giữ nguyên editor, lưu, compile và thông báo xung đột.
2. **Thử viewer có API trang.** Làm spike với PDF.js trên PDF hai trang hiện có và một tài liệu dài. Kiểm tra worker với Next.js, số trang, thumbnail, điều hướng và tải PDF. Chỉ tích hợp viewer mới sau khi spike chạy được; duy trì đường tải PDF nếu viewer lỗi.
3. **Nối trạng thái cập nhật.** Khi MCP lưu source, báo “Mã nguồn đã cập nhật · cần biên dịch” nếu chưa có PDF cho revision mới. App tiếp tục dùng trạng thái PDF của revision hiện tại. Giữ draft và luồng xử lý xung đột đang có.
4. **Nghiệm thu với ChatGPT/Codex và web mở cạnh nhau.** Dùng tài liệu T02 đã mở được và chạy T04–T06. Xác minh riêng thao tác trình duyệt, hành vi realtime và bản PDF sau compile. Giai đoạn sau mới chốt lưu lịch sử xuyên phiên hoặc khôi phục phiên bản nếu cần.

## Tiêu chí nghiệm thu

- Ở 360, 600, 768 và 1280px, PDF có thể xem ngay, tên tài liệu dài không đẩy tràn thanh công cụ, chat luôn có thể mở và đóng bằng bàn phím.
- PDF hai trang báo đúng tổng số, nhảy đúng trang khi chọn thumbnail. Với tài liệu dài, chỉ dựng các trang/thumbnail gần vùng nhìn thấy.
- Cập nhật từ MCP phản ánh đúng revision, thông báo không lặp khi reconnect, bản nháp đang sửa được giữ nguyên. Người dùng phân biệt được source mới với PDF cũ.
- Trạng thái chưa có PDF, đang compile và compile lỗi có hành động rõ ràng. Có thể mở Mã nguồn và Copy context khi đang dùng bố cục hẹp.

Các bước mở rộng có thể tách riêng: cuộn liên tục qua nhiều trang, giữ vị trí qua khoảng thời gian không có PDF, chọn vùng trực tiếp trên PDF, lưu toàn bộ phiên bản và khôi phục lịch sử.

Đã kiểm tra trên Chrome local bằng tài liệu T02: render PDF hai trang, chọn thumbnail trang 2, tải đúng tên PDF, đóng/mở chat và lịch sử, không tràn ngang ở 360/600/768/1280px. T04–T06 cũng đã đạt bằng Chrome và MCP HTTP local trên một tài liệu test riêng. Lượt này kiểm chứng thay đúng đoạn không reload, hiển thị thông báo và lịch sử, biên dịch lại cùng tài liệu và đồng bộ chiều web → MCP → web. Xem kết quả tại `docs/mcp-plugin-test-scenarios.md`.
