import { Button } from "@/components/ui/button";

export function LibraryUpdatesNotice({ pending, loading, onApply }: {
  pending: boolean;
  loading: boolean;
  onApply: () => void;
}) {
  if (!pending) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
      <p role="status">Danh sách tài liệu có cập nhật.</p>
      <Button variant="outline" size="sm" disabled={loading} onClick={onApply}>
        {loading ? "Đang tải…" : "Xem mới"}
      </Button>
    </div>
  );
}
