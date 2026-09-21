import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderWithClient } from "@/tests/utils/react-query";

import ChatAssistant from "@/components/ChatAssistant";
import {
  Menubar,
  MenubarContent,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

// ChatAssistant dùng useRouter — mock để render được trong jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

// Trước đây bộ test này mô tả một UI cũ (Menubar chọn "Dạng tài liệu", lời chào
// "Xin chào"). Khung soạn tin hiện dựng trên beUI PromptInput: template chọn qua
// model selector của PromptInput, không còn menubar riêng.
describe("ChatAssistant (Trợ lý AI Chat trang chủ)", () => {
  it("render được khung soạn tin và thông tin template đang chọn", () => {
    renderWithClient(<ChatAssistant />);

    expect(screen.getByLabelText("Mô tả tài liệu")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Hội thoại mới/ }),
    ).toBeInTheDocument();
    // Template mặc định là "academic".
    expect(screen.getByText(/Đang chọn:/)).toBeInTheDocument();
  });

  it("nút gửi có nhãn tiếng Việt và bị chặn khi chưa nhập gì", () => {
    renderWithClient(<ChatAssistant />);

    const send = screen.getByRole("button", {
      name: "Gửi yêu cầu tạo tài liệu",
    });
    expect(send).toBeDisabled();
  });

  it("gõ nội dung thì mở được nút gửi", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithClient(<ChatAssistant />);

    await user.type(screen.getByLabelText("Mô tả tài liệu"), "Một bài báo");
    expect(
      screen.getByRole("button", { name: "Gửi yêu cầu tạo tài liệu" }),
    ).toBeEnabled();
  });
});

describe("Menubar template picker — regression MenuGroupContext", () => {
  it("MenubarLabel nằm trong MenubarRadioGroup thì render không ném lỗi", () => {
    // Giữ lại: đây là regression test cho MenuGroupContext của Menubar, vẫn có
    // giá trị độc lập với việc ChatAssistant còn dùng menubar hay không.
    render(
      <Menubar>
        <MenubarMenu defaultOpen>
          <MenubarTrigger>Dạng tài liệu</MenubarTrigger>
          <MenubarContent>
            <MenubarRadioGroup value="general" onValueChange={() => {}}>
              <MenubarLabel>Chọn dạng tài liệu</MenubarLabel>
              <MenubarSeparator />
              <MenubarLabel inset>Cơ bản</MenubarLabel>
              <MenubarRadioItem value="general">Báo cáo thường</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );

    expect(screen.getByText("Chọn dạng tài liệu")).toBeInTheDocument();
    expect(screen.getByText("Báo cáo thường")).toBeInTheDocument();
  });
});
