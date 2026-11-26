"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Library header: title, subtitle and the create-panel toggle. */
export default function AppHeader({
  creationOpen,
  onToggleCreation,
}: {
  creationOpen: boolean;
  onToggleCreation: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 pr-9 lg:pr-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tài liệu LaTeX</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mở tài liệu đã lưu để xem PDF hoặc chỉnh sửa mã nguồn.
        </p>
      </div>
      <Button
        aria-expanded={creationOpen}
        aria-controls="document-creation"
        onClick={onToggleCreation}
      >
        {creationOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {creationOpen ? "Đóng khung tạo" : "Tạo tài liệu"}
      </Button>
    </header>
  );
}
