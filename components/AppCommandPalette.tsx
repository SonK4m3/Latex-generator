"use client";

// Command palette toàn app (⌘K / Ctrl+K), dựng trên beUI CommandPalette.
//
// Lý do có mặt: điều hướng giữa các tài liệu trước đây phải quay về /app rồi
// cuộn ngang qua danh sách thẻ. Palette cho phép nhảy thẳng tới một tài liệu
// theo tên, cộng vài hành động hay dùng — không cần đổi route để tìm.
//
// Danh sách tài liệu lấy từ cùng query key với DocumentList, nên nó dùng chung
// cache: mở palette không sinh request mới nếu danh sách còn tươi.

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Home,
  LogOut,
  Moon,
  PlusIcon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandPalette,
  type CommandItem,
} from "@/components/motion/command-palette";
import { DOCUMENTS_QUERY_KEY } from "@/lib/query-keys";
import { getTemplate } from "@/lib/templates/registry";
import type { DocumentSummary } from "@/lib/types/document";

async function fetchDocuments(): Promise<DocumentSummary[]> {
  const res = await fetch("/api/documents");
  if (!res.ok) throw new Error("Không tải được danh sách tài liệu.");
  const data = (await res.json()) as { documents: DocumentSummary[] };
  return data.documents;
}

/** Số tài liệu tối đa đưa vào palette; tìm kiếm mờ vẫn lọc trong số này. */
const MAX_DOCS = 50;

export default function AppCommandPalette() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  // `enabled: false` — không tự fetch khi mount; dùng dữ liệu đã có trong cache
  // từ DocumentList. Nếu chưa có thì palette chỉ hiện nhóm hành động.
  const { data: docs = [] } = useQuery({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: fetchDocuments,
    enabled: false,
  });

  const items: CommandItem[] = [
    {
      id: "new-document",
      label: "Tạo tài liệu mới",
      group: "Hành động",
      icon: PlusIcon,
      keywords: ["new", "tao", "moi", "create"],
      onSelect: () => router.push("/app"),
    },
    {
      id: "go-home",
      label: "Về khu làm việc",
      group: "Điều hướng",
      icon: Home,
      keywords: ["home", "app", "workspace"],
      onSelect: () => router.push("/app"),
    },
    {
      id: "toggle-theme",
      label: resolvedTheme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối",
      group: "Hành động",
      icon: resolvedTheme === "dark" ? Sun : Moon,
      keywords: ["theme", "dark", "light", "giao dien", "toi", "sang"],
      onSelect: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
    {
      id: "logout",
      label: "Đăng xuất",
      group: "Hành động",
      icon: LogOut,
      keywords: ["logout", "dang xuat", "sign out"],
      onSelect: () => router.push("/login"),
    },
    ...docs.slice(0, MAX_DOCS).map<CommandItem>((d) => ({
      id: `doc-${d.id}`,
      label: d.title,
      group: "Tài liệu",
      hint: getTemplate(d.template)?.label ?? d.template,
      icon: FileText,
      keywords: [d.template, d.hasPdf ? "pdf" : "chua pdf"],
      onSelect: () => router.push(`/documents/${d.id}`),
    })),
  ];

  return (
    <CommandPalette
      items={items}
      placeholder="Tìm tài liệu hoặc hành động…"
      emptyMessage="Không có kết quả phù hợp."
    />
  );
}
