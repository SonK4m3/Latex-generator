"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { DocumentSummary } from "@/lib/types/document";
import { DOCUMENTS_QUERY_KEY } from "@/lib/query-keys";
import { getTemplate } from "@/lib/templates/registry";

async function fetchDocuments(): Promise<DocumentSummary[]> {
  const res = await fetch("/api/documents");
  if (!res.ok) throw new Error("Không tải được danh sách tài liệu.");
  const data = (await res.json()) as { documents: DocumentSummary[] };
  return data.documents;
}

export default function DocumentList({
  initialDocuments,
}: {
  initialDocuments: DocumentSummary[];
}) {
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const {
    data: docs = [],
    error,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: fetchDocuments,
    initialData: initialDocuments,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xoá thất bại.");
      return id;
    },
    onSuccess: () => {
      setConfirmId(null);
      void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });

  const errorMessage =
    (isError ? (error as Error)?.message : undefined) ??
    (deleteMutation.isError ? (deleteMutation.error as Error)?.message : undefined);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Tài liệu đã lưu</h2>
        <Button
          variant="link"
          size="xs"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Đang tải..." : "Làm mới"}
        </Button>
      </div>

      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">{errorMessage}</p>
      )}

      {docs.length === 0 && (
        <EmptyState
          icon={<FileText />}
          title="Chưa có tài liệu nào"
          description="Tạo tài liệu đầu tiên bằng cách mô tả nội dung trong khung chat bên trái."
        />
      )}

      <ul className="flex flex-row gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {docs.map((d) => {
          const deleting =
            deleteMutation.isPending && deleteMutation.variables === d.id;
          const isConfirming = confirmId === d.id;

          return (
            <li
              key={d.id}
              className="flex w-64 shrink-0 snap-start flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm shadow-sm"
            >
              <Link
                href={`/documents/${d.id}`}
                className="flex flex-col hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              >
                <span className="truncate font-bold text-foreground">{d.title}</span>
                <span className="mt-1">
                  <Badge variant="muted" className="text-[10px] uppercase tracking-wider">
                    {getTemplate(d.template)?.label ?? d.template}
                  </Badge>
                </span>
                <span className="mt-2 text-xs text-muted-foreground" suppressHydrationWarning>
                  {d.hasPdf ? "Có PDF" : "Chưa có PDF"}
                  {d.isProject && " · Dự án"}
                </span>
                <span className="text-[10px] text-muted-foreground/70 mt-1" suppressHydrationWarning>
                  {new Date(d.updatedAt).toLocaleDateString()}
                </span>
              </Link>

              {isConfirming ? (
                <div className="flex items-center gap-1 self-end">
                  <span className="text-xs text-destructive">Xoá?</span>
                  <Button
                    size="xs"
                    variant="destructive"
                    disabled={deleting}
                    onClick={() => deleteMutation.mutate(d.id)}
                  >
                    {deleting ? "..." : "Xác nhận"}
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setConfirmId(null)}
                  >
                    Huỷ
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  className="self-end text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmId(d.id)}
                  aria-label={`Xoá ${d.title}`}
                >
                  Xoá
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
