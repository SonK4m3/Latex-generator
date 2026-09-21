import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatEditor from "@/components/ChatEditor";
import type { ChatMessage } from "@/lib/types/document";

const msgs: ChatMessage[] = [
  { id: "1", role: "user", content: "Thêm phần A", createdAt: new Date().toISOString() },
  { id: "2", role: "assistant", content: "✅ Đã cập nhật", createdAt: new Date().toISOString() },
];

// Khung soạn tin dựng trên beUI PromptInput: ô nhập là textarea có
// aria-label "Yêu cầu chỉnh sửa", nút gửi là icon button có nhãn trợ năng
// "Gửi yêu cầu chỉnh sửa" (không còn chữ "Gửi" hiển thị như bản cũ).
describe("ChatEditor", () => {
  it("hiển thị gợi ý khi chưa có message", () => {
    render(<ChatEditor messages={[]} onSend={vi.fn()} />);
    expect(
      screen.getByText(/Chỉnh sửa tài liệu bằng ngôn ngữ tự nhiên/i),
    ).toBeInTheDocument();
  });

  it("render lịch sử message (user + assistant)", () => {
    render(<ChatEditor messages={msgs} onSend={vi.fn()} />);
    expect(screen.getByText("Thêm phần A")).toBeInTheDocument();
    expect(screen.getByText("✅ Đã cập nhật")).toBeInTheDocument();
  });

  it("submit gọi onSend với text đã trim và xoá ô nhập", async () => {
    const onSend = vi.fn();
    render(<ChatEditor messages={[]} onSend={onSend} />);

    const box = screen.getByLabelText("Yêu cầu chỉnh sửa");
    await userEvent.type(box, "  Đổi tiêu đề  ");
    await userEvent.click(
      screen.getByRole("button", { name: "Gửi yêu cầu chỉnh sửa" }),
    );

    expect(onSend).toHaveBeenCalledWith("Đổi tiêu đề");
    expect((box as HTMLTextAreaElement).value).toBe("");
  });

  it("nút gửi bị disable khi ô nhập rỗng", () => {
    render(<ChatEditor messages={[]} onSend={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Gửi yêu cầu chỉnh sửa" }),
    ).toBeDisabled();
  });

  it("khi busy: hiện trạng thái xử lý và đổi nút gửi thành huỷ", () => {
    const onCancel = vi.fn();
    render(
      <ChatEditor messages={[]} onSend={vi.fn()} onCancel={onCancel} busy />,
    );

    expect(screen.getByText(/Đang xử lý yêu cầu/i)).toBeInTheDocument();
    // loading ⇒ nút đổi sang trạng thái dừng, gọi onStop khi bấm.
    expect(
      screen.getByRole("button", { name: "Huỷ yêu cầu" }),
    ).toBeInTheDocument();
  });

  it("bấm huỷ khi đang xử lý gọi onCancel", async () => {
    const onCancel = vi.fn();
    render(
      <ChatEditor messages={[]} onSend={vi.fn()} onCancel={onCancel} busy />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Huỷ yêu cầu" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
