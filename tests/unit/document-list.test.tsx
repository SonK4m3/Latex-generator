// tests/unit/document-list.test.tsx
// FE-1.2: DocumentList qua TanStack Query — initialData hydration, delete → invalidate/refetch,
// nút "Làm mới" → refetch. (Đặt trong tests/ vì vitest.config include chỉ gom tests/** + app/**.)
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/tests/utils/react-query";
import DocumentList from "@/components/DocumentList";
import type { DocumentSummary } from "@/lib/types/document";

function doc(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: "d1",
    title: "Tài liệu A",
    docType: "article",
    template: "academic",
    attempts: 1,
    hasPdf: true,
    isProject: false,
    createdAt: "2026-07-16T00:00:00.000Z",
    updatedAt: "2026-07-16T00:00:00.000Z",
    ...overrides,
  };
}

/** Response JSON tiện dụng cho fetch stub. */
function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DocumentList — TanStack Query (FE-1.2)", () => {
  it("render ngay từ initialData while checking for newer library items + badge isProject", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    renderWithClient(
      <DocumentList
        initialDocuments={[
          doc({ id: "d1", title: "Đơn file" }),
          doc({ id: "d2", title: "Dự án luận văn", isProject: true }),
        ]}
      />,
    );

    // Initial data is immediately visible while the update probe checks for newer library items.
    expect(screen.getByText("Đơn file")).toBeInTheDocument();
    expect(screen.getByText("Dự án luận văn")).toBeInTheDocument();
    // isProject badge shows "· Dự án" inline
    expect(screen.getByText(/· Dự án/)).toBeInTheDocument();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });

  it("xoá → inline confirm → gọi DELETE rồi invalidate/refetch (item biến mất)", async () => {
    const user = userEvent.setup();
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET" });
      if (init?.method === "DELETE") return jsonResponse({ ok: true });
      return jsonResponse({ documents: [doc({ id: "d2", title: "Còn lại" })] });
    });

    renderWithClient(
      <DocumentList
        initialDocuments={[
          doc({ id: "d1", title: "Sẽ xoá" }),
          doc({ id: "d2", title: "Còn lại" }),
        ]}
      />,
    );

    // Open the row menu and choose delete to show inline confirmation.
    await user.click(screen.getByRole("button", { name: "Thao tác cho Sẽ xoá" }));
    await user.click(await screen.findByRole("menuitem", { name: "Xoá tài liệu" }));

    // Then click "Xác nhận" to actually delete
    await user.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => {
      expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/api/documents/d1"))).toBe(true);
    });
    await waitFor(() => {
      expect(calls.some((c) => c.method === "GET" && c.url.endsWith("/api/documents"))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByText("Sẽ xoá")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Còn lại")).toBeInTheDocument();
  });

  it("bấm 'Làm mới' → refetch /api/documents, cập nhật danh sách", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", async () =>
      jsonResponse({ documents: [doc({ id: "d9", title: "Mới từ server" })] }),
    );

    renderWithClient(<DocumentList initialDocuments={[doc({ id: "d1", title: "Cũ" })]} />);

    expect(screen.getByText("Cũ")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Làm mới" }));

    await waitFor(() => {
      expect(screen.getByText("Mới từ server")).toBeInTheDocument();
    });
    expect(screen.queryByText("Cũ")).not.toBeInTheDocument();
  });

  it("lỗi tải danh sách khi refetch → hiện thông báo lỗi", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));

    renderWithClient(<DocumentList initialDocuments={[doc({ id: "d1", title: "Cũ" })]} />);
    await user.click(screen.getByRole("button", { name: "Làm mới" }));

    await waitFor(() => {
      expect(screen.getByText(/Không tải được danh sách/)).toBeInTheDocument();
    });
  });

  it("danh sách rỗng → hiện EmptyState 'Chưa có tài liệu nào'", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderWithClient(<DocumentList initialDocuments={[]} />);
    expect(screen.getByText("Chưa có tài liệu nào")).toBeInTheDocument();
  });

  it("huỷ inline confirm → KHÔNG gọi DELETE", async () => {
    const user = userEvent.setup();
    // vi.fn<typeof fetch> cho `mock.calls` kiểu đúng ([input, init?]) mà không
    // cần khai báo tham số không dùng.
    const fetchSpy = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ documents: [] }) as Response),
    );
    vi.stubGlobal("fetch", fetchSpy);

    renderWithClient(<DocumentList initialDocuments={[doc({ id: "d1", title: "Giữ lại" })]} />);

    // Open the row menu and choose delete to show inline confirmation.
    await user.click(screen.getByRole("button", { name: "Thao tác cho Giữ lại" }));
    await user.click(await screen.findByRole("menuitem", { name: "Xoá tài liệu" }));
    // Then click "Huỷ" to cancel
    await user.click(screen.getByRole("button", { name: "Huỷ" }));

    // Không có lời gọi DELETE nào.
    expect(fetchSpy.mock.calls.every((c) => (c[1] as RequestInit | undefined)?.method !== "DELETE")).toBe(true);
    expect(screen.getByText("Giữ lại")).toBeInTheDocument();
  });
});
