"use client";

// Hiển thị mã nguồn LaTeX. Dựng trên beUI CodeBlock (shiki) để có:
// - tô sáng cú pháp LaTeX theo theme sáng/tối của app,
// - số dòng + đánh dấu dòng lỗi (nối với log biên dịch Tectonic),
// - nút copy có phản hồi, và chế độ `streaming` khi AI đang sinh mã.
import { CodeBlock } from "@/components/agents/code-block";

export interface LatexSourceProps {
  latex: string;
  /** Tên tệp hiển thị trên thanh tiêu đề. */
  filename?: string;
  /** Đang được AI sinh dần — CodeBlock sẽ tự cuộn theo mép dưới. */
  streaming?: boolean;
  /** Các dòng cần làm nổi bật, ví dụ dòng lỗi lấy từ log biên dịch (1-based). */
  errorLines?: number[];
}

export default function LatexSource({
  latex,
  filename = "main.tex",
  streaming = false,
  errorLines,
}: LatexSourceProps) {
  return (
    <CodeBlock
      code={latex}
      language="latex"
      filename={filename}
      status={streaming ? "streaming" : "complete"}
      showLineNumbers
      highlightLines={errorLines}
      // ~70vh trước đây, quy về px để CodeBlock quản lý vùng cuộn của nó.
      maxHeight={560}
      copyable
    />
  );
}
