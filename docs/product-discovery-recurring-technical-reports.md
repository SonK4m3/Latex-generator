# Thị trường cho tài liệu kỹ thuật phải xuất lại nhiều lần

Ngày 19/11/2026. Ba giả thuyết bên dưới bổ sung cho các hướng giáo viên Toán, sinh viên bảo vệ và nhóm nộp arXiv trong [roadmap](project-roadmap.md). Nguồn công khai xác nhận quy trình và công cụ hiện hữu. Chưa phỏng vấn khách hàng hoặc đo nhu cầu trả phí.

### 1. Nhóm khảo sát làm báo cáo riêng cho từng đơn vị

Người dùng thử là chuyên viên tổng hợp khảo sát có một bảng kết quả đã duyệt, phải gửi cùng cấu trúc báo cáo cho nhiều trường, chi nhánh hoặc phòng ban. Quarto hỗ trợ báo cáo theo tham số; tarchetypes hỗ trợ dựng một báo cáo cho từng dòng tham số. Đây là phương án đối chiếu cho nhóm đã có người viết mã. [Quarto](https://quarto.org/docs/computations/parameters.html) · [rOpenSci](https://docs.ropensci.org/tarchetypes/reference/tar_quarto_rep.html)

Giả thuyết cần kiểm tra là thời gian nhân bản mẫu và rà tên đơn vị, kỳ báo cáo, mẫu số và biểu đồ trước khi gửi. Tìm người đang dùng bảng tính và Word, nhờ họ trình bày một lần xuất gần nhất. Thử thủ công với dữ liệu tổng hợp ẩn danh của ba đơn vị và mẫu đang dùng. Bắt đầu bằng một bảng kết quả đã tính sẵn. Cần bổ sung ánh xạ cột, dựng hàng loạt và đối chiếu dữ liệu theo đơn vị bên cạnh khả năng dựng PDF đang có. Đếm số sai khác so với bảng nguồn và thời gian rà toàn bộ lô. Dừng nếu công cụ sẵn có đã làm tốt hoặc người nhận bắt buộc cần Word để sửa tiếp.

### 2. Nhóm kỹ thuật cần bàn giao thuyết minh tính toán

Người dùng thử là người lập và người rà một bảng tính thường xuyên đổi đầu vào. handcalcs đã có thể hiển thị công thức và phép thế số từ Python, đồng thời ghi nhận nguy cơ dùng giá trị cũ khi chạy notebook sai thứ tự. [Tài liệu của handcalcs](https://github.com/connorferster/handcalcs)

Giả thuyết là người lập sửa bảng tính nhưng phải cập nhật lại thuyết minh, còn người rà khó tìm số nào đã đổi. Xin hai phiên bản của một phép tính được phép chia sẻ. Thử nhận bảng giá trị và công thức do người lập duyệt, xuất hai bản PDF có đơn vị và đánh dấu phần đổi. Đo thời gian người rà tìm đúng đầu vào thay đổi và phát hiện sai lệch. Năng lực còn thiếu là liên kết mỗi giá trị với ô nguồn và phiên bản; biên dịch PDF chỉ kiểm tra khả năng dựng tài liệu. Người lập chịu trách nhiệm duyệt phép tính. Nếu phần lớn thời gian nằm ở thẩm tra phương pháp tính, ưu tiên ngách khác.

### 3. Giảng viên phát tài liệu thực hành từ Jupyter

nbgrader tạo bản bài tập cho sinh viên bằng cách ẩn phần lời giải. nbconvert xuất notebook sang PDF. Một trao đổi của người dùng mô tả các bước sao chép sau lần tạo lại bài; đây là một trường hợp để phỏng vấn thêm. [nbgrader](https://nbgrader.readthedocs.io/en/stable/user_guide/creating_and_grading_assignments.html) · [nbconvert](https://nbconvert.readthedocs.io/) · [Trao đổi trong cộng đồng Jupyter](https://discourse.jupyter.org/t/using-nbgrader-with-git/23792)

Tuyển giảng viên có nhu cầu phát bản in hoặc PDF song song với notebook. Dùng một bài đã dạy, sửa một câu rồi xuất bản học viên và bản hướng dẫn từ cùng phiên bản. Kiểm tra phần đáp án trong ô, output và hình đính kèm trước khi phát; đo thời gian rà và xem họ có dùng lại cho buổi sau. Phần mới là đọc notebook, phân loại nội dung và kiểm tra hai đầu ra. Nếu lớp chỉ trao đổi notebook, lợi ích của PDF thấp.
