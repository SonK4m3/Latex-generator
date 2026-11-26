# Cơ hội sản phẩm cho sinh viên chuẩn bị bảo vệ đồ án

Nghiên cứu tài liệu ngày 19/11/2026. Đối tượng đề xuất là sinh viên CNTT Việt Nam đã có bản báo cáo, đang chuẩn bị bảo vệ hoặc chỉnh sửa sau phản biện, ưu tiên chương trình chấp nhận PDF. Giảng viên hướng dẫn là người có thể đánh giá đầu ra khi thử nghiệm. Các hướng dẫn của khoa xác nhận công việc phải làm. Tần suất gặp khó, công cụ sinh viên đang dùng và khả năng trả phí vẫn cần phỏng vấn.

## Bằng chứng và giới hạn

| Bối cảnh | Yêu cầu được công bố | Ý nghĩa đối với sản phẩm |
|---|---|---|
| Khoa CNTT, Đại học Kinh tế Quốc dân | Chuẩn bị slide và sản phẩm để bảo vệ. Có thể phải sửa và nộp lại báo cáo sau hội đồng. [Quy định khóa luận](https://fit.neu.edu.vn/post/some-regulations-on-writing-graduation-thesis-reports) | Một bản báo cáo có thể phục vụ cả khâu thuyết trình và khâu chỉnh sửa. |
| Khoa CNTT, Học viện Kỹ thuật mật mã | Sau bảo vệ, sinh viên chỉnh sửa theo ý kiến hội đồng và nộp phiếu giải trình. Hướng dẫn yêu cầu bản mềm Word. [Hướng dẫn đồ án](https://cntt.actvn.edu.vn/news/huong-dan-chung-cho-do-an-tot-nghiep) | Có đầu ra cụ thể cho việc xử lý phản biện. Cần hỏi định dạng bắt buộc trước khi chọn khoa thử nghiệm. |
| Chương trình được mô tả trong hướng dẫn của ĐH Khoa học Tự nhiên, ĐHQG-HCM | Hướng dẫn quy định các nhóm tệp báo cáo, slide và mã nguồn, trong đó có cả bản quét có chữ ký. [Hướng dẫn nộp file mềm](https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/07/CTDA_Huong-dan-trinh-bay-KLTN_TTDATN_TTTN.pdf) | Có thể kiểm tra bộ hồ sơ theo một hướng dẫn cụ thể. Phải xác nhận phiên bản quy định của đúng chương trình và kỳ nộp. |

## Ba giả thuyết tính năng

1. **Tạo slide bảo vệ từ phiên bản báo cáo đã chốt.** Cho người dùng chọn thời lượng, mục và hình kết quả. Sinh dàn slide để duyệt, rồi xuất Beamer PDF. Lưu liên kết từ slide đến mục hoặc hình gốc để đối chiếu số liệu. Sản phẩm đã có template Beamer, phần mới là chuyển một báo cáo đang mở sang bài bảo vệ có căn cứ. Đo thời gian đến bộ slide đủ để tập trình bày và số khẳng định phải sửa vì sai nguồn. [README](../README.md)
2. **Lập phiếu giải trình từ góp ý và bản sửa.** Dán từng góp ý, gắn với đoạn tương ứng, duyệt nội dung sửa và xuất bảng góp ý / cách xử lý / vị trí trong bản cuối. Nếu sửa tiếp làm đổi số trang, yêu cầu đối chiếu lại trước khi xuất. Tận dụng chức năng chọn đoạn PDF theo revision. Overleaf đã có bình luận và theo dõi sửa đổi, nên giá trị cần thử là thời gian hoàn thành phiếu và khả năng kiểm tra từng mục. [Chọn đoạn PDF](feature-tracking.md) · [Overleaf Track Changes](https://www.overleaf.com/learn/how-to/Track_Changes_in_Overleaf)
3. **Kiểm tra và đóng gói hồ sơ nộp theo khoa.** Thử với một chương trình và một kỳ nộp. Hiện danh sách tệp bắt buộc, phát hiện thiếu tệp hoặc sai tên, cho người dùng xác nhận giấy tờ có chữ ký rồi xuất ZIP. E8 đã dự kiến kiểm tra định dạng bên trong tài liệu. Phạm vi mới là kiểm tra nhiều hiện vật bên ngoài PDF. Đo số lỗi thiếu hoặc nhầm tệp được phát hiện, xác minh với người nhận hồ sơ. [Đặc tả E8](../specs/003-academic-document-formatter/spec.md)

## Thử trước khi đưa vào roadmap

Đề xuất mời 5 sinh viên thuộc 2 chương trình và 2 giảng viên. Xin xem bản báo cáo, bộ slide và góp ý đã ẩn danh từ lần bảo vệ gần nhất. Hỏi họ thực sự mất thời gian ở bước nào, lần cuối phải sửa gì và phải nộp định dạng nào. Không suy rộng kết quả từ mẫu nhỏ thành ước tính thị trường.

Thử thủ công luồng báo cáo → slide trên 3 báo cáo được phép sử dụng. So sánh với cách làm quen thuộc trên các phần báo cáo tương đương. Ghi thời gian tạo và kiểm tra, số lần sửa kết quả hoặc số liệu, ý kiến của giảng viên về khả năng dùng để tập bảo vệ. Ngưỡng quyết định đề xuất là ít nhất 2/3 người hoàn thành nhanh hơn và tất cả bộ slide cuối giữ đúng số liệu nguồn. Nếu việc làm slide vốn nhanh nhưng giải trình tốn nhiều lượt đối chiếu, chuyển thử nghiệm sang tính năng số 2. Chỉ thử đóng gói khi có khoa cung cấp checklist hiện hành và người xác nhận đầu ra.
