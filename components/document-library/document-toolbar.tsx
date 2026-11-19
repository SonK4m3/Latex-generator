"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DocumentSort = "updated" | "title";

/** Search, sort and refresh controls above the library results. */
export default function DocumentToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  onRefresh,
  isFetching,
  matchCount,
  totalCount,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: DocumentSort;
  onSortChange: (value: DocumentSort) => void;
  onRefresh: () => void;
  isFetching: boolean;
  matchCount: number;
  totalCount: number;
}) {
  const trimmedQuery = search.trim();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Tài liệu đã lưu
        </h2>
          <Button
            variant="link"
            size="xs"
            onClick={onRefresh}
            disabled={isFetching}
          >
            {isFetching ? "Đang tải..." : "Làm mới"}
          </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <label htmlFor="document-search" className="sr-only">
            Tìm tài liệu theo tên hoặc mẫu
          </label>
          <Input
            id="document-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm theo tên hoặc mẫu..."
            autoComplete="off"
            className="h-8 pl-8 pr-8 text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Xoá tìm kiếm"
              onClick={() => onSearchChange("")}
              className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <label htmlFor="document-sort" className="sr-only">Sắp xếp tài liệu</label>
        <select
          id="document-sort"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as DocumentSort)}
          className="h-8 self-start rounded-lg border border-border bg-background px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="updated">Mới cập nhật</option>
          <option value="title">Theo tên</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]" aria-live="polite">
        {trimmedQuery ? `${matchCount} / ${totalCount} tài liệu khớp “${trimmedQuery}”` : null}
      </p>
    </div>
  );
}
