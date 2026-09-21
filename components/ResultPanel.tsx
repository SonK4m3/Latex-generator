"use client";

import { useMemo, useState } from "react";
import { FileTextIcon, CodeIcon } from "lucide-react";
import PdfPreview from "@/components/PdfPreview";
import LatexSource from "@/components/LatexSource";
import DocumentGenerationStepper from "@/components/DocumentGenerationStepper";
import PlanEditor from "@/components/PlanEditor";
import CVFormEditor from "@/components/cv/CVFormEditor";
import {
  ExpandableTabs,
  type ExpandableTabsItem,
} from "@/components/motion/expandable-tabs";
import { parseCompileLogErrorLines } from "@/lib/latex/parse-compile-log";
import type { DocumentStatus } from "@/lib/types/document";

export interface ResultData {
  docId?: string;
  status?: DocumentStatus;
  planContent?: string;
  latex?: string;
  pdfBase64?: string;
  log?: string;
  attempts?: number;
  error?: string;
}

type Tab = "pdf" | "source";

export default function ResultPanel({
  result,
  onPlanApproved,
}: {
  result: ResultData;
  onPlanApproved?: (docId: string, finalPlan: string) => void;
}) {
  const hasPdf = Boolean(result.pdfBase64);
  // Không có PDF thì mở sẵn tab mã nguồn — tab PDF rỗng không giúp gì cho user.
  const [tab, setTab] = useState<Tab>(hasPdf ? "pdf" : "source");
  const isFailure = Boolean(result.error);
  const showStepper =
    result.status &&
    result.status !== "EXPORTABLE" &&
    result.status !== ("DRAFT" as DocumentStatus);

  // Dòng lỗi từ log biên dịch, dùng để làm nổi bật trong khung mã nguồn.
  const errorLines = useMemo(
    () => (isFailure ? parseCompileLogErrorLines(result.log) : []),
    [isFailure, result.log],
  );

  const tabs: ExpandableTabsItem[] = [
    {
      id: "pdf",
      label: "PDF",
      icon: <FileTextIcon className="size-4" aria-hidden="true" />,
      content: hasPdf ? (
        <PdfPreview pdfBase64={result.pdfBase64!} />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          Chưa có PDF để hiển thị.
        </p>
      ),
    },
    {
      id: "source",
      label: "Mã nguồn LaTeX",
      icon: <CodeIcon className="size-4" aria-hidden="true" />,
      content: result.latex ? (
        <LatexSource
          latex={result.latex}
          streaming={result.status === "GENERATING"}
          errorLines={errorLines.length > 0 ? errorLines : undefined}
        />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">Chưa có mã LaTeX.</p>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {showStepper && (
        <DocumentGenerationStepper
          currentStatus={result.status!}
          attempts={result.attempts}
          errorMessage={result.error}
        />
      )}

      {result.status === "PLANNED" && result.docId ? (
        result.planContent?.trim().startsWith("{") ? (
          <CVFormEditor
            docId={result.docId}
            initialJson={result.planContent}
            onApprove={onPlanApproved ?? (() => {})}
          />
        ) : (
          <PlanEditor
            docId={result.docId}
            initialPlanContent={result.planContent}
            onApprove={onPlanApproved ?? (() => {})}
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          {isFailure && (
            <div
              className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm"
              role="alert"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="font-medium text-destructive">{result.error}</p>
              {errorLines.length > 0 && (
                <p className="mt-1 text-xs text-destructive/80">
                  Dòng lỗi được đánh dấu trong tab mã nguồn:{" "}
                  {errorLines.slice(0, 8).join(", ")}
                  {errorLines.length > 8 ? "…" : ""}
                </p>
              )}
              {result.log && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-destructive/80 hover:text-destructive">
                    Chi tiết lỗi
                  </summary>
                  <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap text-xs">
                    {result.log}
                  </pre>
                </details>
              )}
            </div>
          )}

          <ExpandableTabs
            items={tabs}
            value={tab}
            tablistLabel="Chọn nội dung hiển thị"
            onValueChange={(id) => {
              if (id === "pdf" || id === "source") setTab(id);
            }}
          />

          {typeof result.attempts === "number" && (
            <span className="self-end text-xs text-muted-foreground">
              Lần thử: {result.attempts}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
