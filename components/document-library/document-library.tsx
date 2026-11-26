"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { DocumentSummary } from "@/lib/types/document";
import { DOCUMENTS_QUERY_KEY } from "@/lib/query-keys";
import { getTemplate } from "@/lib/templates/registry";
import { useLibraryUpdates } from "@/lib/hooks/use-library-updates";
import DocumentToolbar, { type DocumentSort } from "./document-toolbar";
import DocumentRow from "./document-row";
import { LibraryUpdatesNotice } from "./library-updates-notice";

async function fetchDocuments(): Promise<DocumentSummary[]> {
  const res = await fetch("/api/documents", { cache: "no-store" });
  if (!res.ok) throw new Error("Không tải được danh sách tài liệu.");
  const data = (await res.json()) as { documents: DocumentSummary[] };
  return data.documents;
}

/** Accent-insensitive search so "bao cao" also matches "Báo cáo". */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase();
}

/**
 * Library state owner: the list query, delete mutation, local filter/sort and the explicit
 * refresh that acknowledges pending library updates.
 */
export default function DocumentLibrary({
  initialDocuments,
}: {
  initialDocuments: DocumentSummary[];
}) {
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DocumentSort>("updated");

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
    // Documents refresh explicitly: background focus/reconnect refetches could replace the list
    // while the user is reading it.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Signals are compared against the currently displayed list; displayed results stay untouched
  // until an explicit refresh acknowledges the captured version.
  const { version, acknowledgedVersion, acknowledge } = useLibraryUpdates(docs);

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

  const handleRefresh = useCallback(async () => {
    const capturedVersion = version;
    const result = await refetch();
    // Only an explicit, successful refresh acknowledges the update version captured at click time.
    if (!result.isError) acknowledge(capturedVersion);
  }, [refetch, version, acknowledge]);

  const normalizedQuery = normalize(search);
  const visibleDocs = useMemo(() => {
    const filtered = normalizedQuery
      ? docs.filter((doc) => {
          const templateLabel = getTemplate(doc.template)?.label ?? doc.template;
          return (
            normalize(doc.title).includes(normalizedQuery) ||
            normalize(templateLabel).includes(normalizedQuery) ||
            normalize(doc.template).includes(normalizedQuery)
          );
        })
      : docs;

    return [...filtered].sort((left, right) => {
      if (sort === "title") {
        return left.title.localeCompare(right.title, "vi");
      }
      const updatedDelta =
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      return updatedDelta || left.title.localeCompare(right.title, "vi");
    });
  }, [docs, normalizedQuery, sort]);

  const hasPendingUpdate = version > acknowledgedVersion;
  const errorMessage =
    (isError ? (error as Error)?.message : undefined) ??
    (deleteMutation.isError ? (deleteMutation.error as Error)?.message : undefined);

  return (
    <section
      aria-label="Thư viện tài liệu"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-3 sm:p-4"
    >
      <DocumentToolbar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        onRefresh={() => void handleRefresh()}
        isFetching={isFetching}
        matchCount={visibleDocs.length}
        totalCount={docs.length}
      />

      <LibraryUpdatesNotice
        pending={hasPendingUpdate}
        loading={isFetching}
        onApply={() => void handleRefresh()}
      />

      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}

      {docs.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="Chưa có tài liệu nào"
          description="Bấm Tạo tài liệu để bắt đầu. Tài liệu được lưu từ ChatGPT hoặc Codex qua MCP cũng xuất hiện ở đây."
        />
      ) : visibleDocs.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Không tìm thấy tài liệu"
          description={`Không có tài liệu nào khớp với “${search.trim()}”. Thử từ khóa ngắn hơn.`}
          action={
            <Button variant="outline" size="xs" onClick={() => setSearch("")}>
              Xoá tìm kiếm
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
          {visibleDocs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              confirming={confirmId === doc.id}
              deleting={
                deleteMutation.isPending && deleteMutation.variables === doc.id
              }
              onRequestDelete={() => setConfirmId(doc.id)}
              onCancelDelete={() => setConfirmId(null)}
              onConfirmDelete={() => deleteMutation.mutate(doc.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
