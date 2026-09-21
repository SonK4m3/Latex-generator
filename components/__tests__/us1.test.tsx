import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GeneratorForm from "@/components/GeneratorForm";
import ResultPanel from "@/components/ResultPanel";

describe("GeneratorForm (US1)", () => {
  it("submit gọi onSubmit với đúng { description, template }", async () => {
    const onSubmit = vi.fn();
    render(<GeneratorForm onSubmit={onSubmit} />);
    await userEvent.type(
      screen.getByLabelText("Mô tả tài liệu"),
      "Một bài báo",
    );
    await userEvent.selectOptions(screen.getByLabelText("Dạng tài liệu"), "math");
    await userEvent.click(screen.getByRole("button", { name: /Tạo tài liệu/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      description: "Một bài báo",
      template: "math",
      sources: [],
    });
  });
});

describe("ResultPanel (US1)", () => {
  // Các tab do beUI ExpandableTabs dựng: role="tab", tên trợ năng là nhãn tab.
  it("hiển thị mã LaTeX ở tab mã nguồn", async () => {
    render(
      <ResultPanel result={{ latex: "\\documentclass{article}", attempts: 1 }} />,
    );

    // Không có PDF ⇒ ResultPanel mở sẵn tab mã nguồn.
    expect(
      screen.getByRole("tab", { name: "Mã nguồn LaTeX" }),
    ).toHaveAttribute("aria-selected", "true");

    // CodeBlock tô sáng bằng shiki nên `\documentclass` bị tách thành nhiều
    // token span — dùng findAllByText thay vì findByText.
    expect((await screen.findAllByText(/documentclass/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Lần thử: 1/)).toBeInTheDocument();
  });

  it("chuyển sang tab PDF khi bấm vào tab đó", async () => {
    const user = userEvent.setup();
    render(
      <ResultPanel
        result={{ latex: "\\documentclass{article}", pdfBase64: "JVBERi0=", attempts: 2 }}
      />,
    );

    // Có PDF ⇒ mặc định mở tab PDF.
    expect(screen.getByRole("tab", { name: "PDF" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("tab", { name: "Mã nguồn LaTeX" }));
    expect(
      screen.getByRole("tab", { name: "Mã nguồn LaTeX" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("liệt kê dòng lỗi lấy từ log biên dịch khi thất bại", () => {
    render(
      <ResultPanel
        result={{
          latex: "\\documentclass{article}",
          error: "Biên dịch thất bại.",
          log: "./main.tex:42: Undefined control sequence\nl.57 \\badmacro",
          attempts: 3,
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Biên dịch thất bại.");
    expect(screen.getByText(/Dòng lỗi được đánh dấu/)).toHaveTextContent("42, 57");
  });
});
