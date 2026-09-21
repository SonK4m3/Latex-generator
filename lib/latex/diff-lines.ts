// Diff theo dòng cho mã LaTeX, dùng để hiển thị thay đổi sau mỗi lần chat-edit.
//
// Dự án không có thư viện diff nào, và việc này chỉ cần so hai chuỗi LaTeX của
// cùng một tài liệu — nên dùng LCS (Longest Common Subsequence) là đủ và tránh
// thêm dependency. Kết quả trả về đúng shape `FileDiffLine` của beUI FileDiff.

import type { FileDiffLine } from "@/components/agents/file-diff";

export interface DiffLinesResult {
  lines: FileDiffLine[];
  additions: number;
  deletions: number;
}

/** Số dòng tối đa mỗi phía; quá ngưỡng này thì bỏ qua diff để không treo UI. */
const MAX_LINES = 4000;

/** Số dòng ngữ cảnh giữ lại quanh mỗi khối thay đổi. */
const CONTEXT = 3;

/**
 * Bảng LCS dạng ma trận. Với tài liệu cỡ vài nghìn dòng thì O(n*m) ô số nguyên
 * vẫn chấp nhận được, và MAX_LINES chặn trường hợp bệnh lý.
 */
function lcsTable(a: string[], b: string[]): Uint32Array {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i] === b[j]
          ? table[(i + 1) * cols + (j + 1)] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)]);
    }
  }
  return table;
}

type RawLine = {
  type: "added" | "removed" | "context";
  content: string;
  oldLine?: number;
  newLine?: number;
};

/** Duyệt bảng LCS để dựng chuỗi thao tác đầy đủ (chưa rút ngữ cảnh). */
function walk(a: string[], b: string[]): RawLine[] {
  const cols = b.length + 1;
  const table = lcsTable(a, b);
  const out: RawLine[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "context", content: a[i], oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      out.push({ type: "removed", content: a[i], oldLine: i + 1 });
      i++;
    } else {
      out.push({ type: "added", content: b[j], newLine: j + 1 });
      j++;
    }
  }
  while (i < a.length) {
    out.push({ type: "removed", content: a[i], oldLine: i + 1 });
    i++;
  }
  while (j < b.length) {
    out.push({ type: "added", content: b[j], newLine: j + 1 });
    j++;
  }
  return out;
}

/**
 * Chỉ giữ các dòng thay đổi cùng `CONTEXT` dòng ngữ cảnh quanh chúng. Một tài
 * liệu LaTeX sửa một mục sẽ cho diff ngắn thay vì in lại toàn bộ tệp.
 */
function trimToHunks(raw: RawLine[]): RawLine[] {
  const keep = new Array<boolean>(raw.length).fill(false);
  let anyChange = false;

  for (let k = 0; k < raw.length; k++) {
    if (raw[k].type === "context") continue;
    anyChange = true;
    const from = Math.max(0, k - CONTEXT);
    const to = Math.min(raw.length - 1, k + CONTEXT);
    for (let m = from; m <= to; m++) keep[m] = true;
  }

  if (!anyChange) return [];
  return raw.filter((_, k) => keep[k]);
}

/**
 * So sánh hai phiên bản mã LaTeX theo dòng.
 * Trả về `lines` rỗng khi không có thay đổi, hoặc khi đầu vào quá lớn.
 */
export function diffLatexLines(
  before: string,
  after: string,
): DiffLinesResult {
  if (before === after) return { lines: [], additions: 0, deletions: 0 };

  const a = before.split("\n");
  const b = after.split("\n");

  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return { lines: [], additions: 0, deletions: 0 };
  }

  const hunks = trimToHunks(walk(a, b));

  let additions = 0;
  let deletions = 0;
  const lines: FileDiffLine[] = hunks.map((line, index) => {
    if (line.type === "added") additions++;
    if (line.type === "removed") deletions++;
    return {
      // Chỉ số đảm bảo key duy nhất kể cả khi nội dung dòng trùng nhau.
      id: `${index}-${line.type}-${line.oldLine ?? ""}-${line.newLine ?? ""}`,
      type: line.type,
      oldLine: line.oldLine,
      newLine: line.newLine,
      content: line.content,
    };
  });

  return { lines, additions, deletions };
}
