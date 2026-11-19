"use client";

import Link from "next/link";
import { FileText, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DocumentSummary } from "@/lib/types/document";
import { getTemplate } from "@/lib/templates/registry";
import {
  getPdfRevisionLabel,
  getPdfRevisionStatus,
  getPdfRevisionTone,
} from "./document-pdf-status";

/** One library row: open link, metadata, PDF revision state and an accessible action menu. */
export default function DocumentRow({
  doc,
  confirming,
  deleting,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  doc: DocumentSummary;
  confirming: boolean;
  deleting: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const templateLabel = getTemplate(doc.template)?.label ?? doc.template;
  const pdfStatus = getPdfRevisionStatus(doc);

  return (
    <li className="flex items-start gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:items-center sm:gap-3">
      <Link
        href={`/documents/${doc.id}`}
        className="grid min-w-0 flex-1 grid-cols-1 gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <FileText
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="truncate text-sm font-semibold text-foreground">
            {doc.title}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-5 text-xs text-muted-foreground">
          <span>{templateLabel}</span>
          {doc.isProject && <span>· Dự án</span>}
          <time dateTime={doc.updatedAt} suppressHydrationWarning>
            · Cập nhật {formatUpdatedAt(doc.updatedAt)}
          </time>
        </span>
        <span className="pl-5 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center sm:pl-0">
          <Badge
            variant={getPdfRevisionTone(pdfStatus)}
            className="text-[10px] font-medium"
          >
            {getPdfRevisionLabel(pdfStatus)}
          </Badge>
        </span>
      </Link>

      <div className="flex shrink-0 items-center justify-end gap-1 pl-5 sm:pl-0">
        {confirming ? (
          <>
            <span className="text-xs text-destructive">Xoá?</span>
            <Button
              size="xs"
              variant="destructive"
              disabled={deleting}
              onClick={onConfirmDelete}
            >
              {deleting ? "..." : "Xác nhận"}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              disabled={deleting}
              onClick={onCancelDelete}
            >
              Huỷ
            </Button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Thao tác cho ${doc.title}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem render={<Link href={`/documents/${doc.id}`} />}>
                Mở tài liệu
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onRequestDelete}>
                Xoá tài liệu
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
