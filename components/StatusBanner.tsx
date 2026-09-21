"use client"

import { Badge } from "@/components/ui/badge"

export type Status = "idle" | "loading" | "success" | "error"

const statusConfig = {
  idle: { variant: "muted" as const, role: undefined },
  loading: { variant: "info" as const, role: "status" as const },
  success: { variant: "success" as const, role: "status" as const },
  error: { variant: "destructive" as const, role: "alert" as const },
}

export default function StatusBanner({
  status,
  attempts,
  errorMessage,
}: {
  status: Status
  attempts?: number
  errorMessage?: string
}) {
  const { variant, role } = statusConfig[status]

  const messages: Record<Status, string> = {
    idle: "Mô tả tài liệu bạn muốn tạo, chọn loại tài liệu, rồi bấm \"Tạo tài liệu\".",
    loading: "Đang xử lý (sinh → kiểm tra → biên dịch → sửa nếu cần)...",
    success: `Đã tạo tài liệu${typeof attempts === "number" ? ` sau ${attempts} lần thử` : ""}.`,
    error: errorMessage ?? "Đã xảy ra lỗi.",
  }

  return (
    <Badge variant={variant} role={role} className="text-sm">
      {messages[status]}
    </Badge>
  )
}
