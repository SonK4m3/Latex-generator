"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copySourceSelectionContext, type SourceSelectionContext } from "@/lib/mcp/selection-context";

export function CopySelectionContextButton({
  context,
  disabled = false,
  disabledMessage = "Lưu bản nháp trước để tạo context đúng revision.",
}: {
  context: SourceSelectionContext | null;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    if (!context || disabled) return;
    try {
      await copySourceSelectionContext(context);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  if (!context && !disabled) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={!context || disabled} onClick={() => void copy()}>
        {status === "copied" ? <CheckIcon className="size-4" aria-hidden="true" /> : <CopyIcon className="size-4" aria-hidden="true" />}
        {status === "copied" ? "Đã copy context" : "Copy context cho AI"}
      </Button>
      {disabled ? (
        <span className="text-xs text-muted-foreground">{disabledMessage}</span>
      ) : status === "error" ? (
        <span role="alert" className="text-xs text-destructive">Không truy cập được clipboard.</span>
      ) : context ? (
        <span className="text-xs text-muted-foreground">{context.filePath} · {context.end - context.start} ký tự</span>
      ) : null}
    </div>
  );
}
