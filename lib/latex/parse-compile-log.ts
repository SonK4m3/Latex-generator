// Trích số dòng lỗi từ log biên dịch (Tectonic / TeX) để làm nổi bật trong
// khung mã nguồn. TeX báo lỗi theo vài dạng khác nhau, nên gom lại ở một chỗ:
//
//   ./main.tex:42: Undefined control sequence     <- dạng file:line:
//   l.42 \badmacro                               <- dạng "l.<n>" của TeX
//
// Chỉ thu số dòng; phần diễn giải lỗi vẫn do log gốc hiển thị.

const FILE_LINE = /^[^\s:]*\.tex:(\d+):/gm;
const TEX_LINE = /^l\.(\d+)(?:\s|$)/gm;

/**
 * Trả về danh sách số dòng (1-based) đã sắp xếp, không trùng lặp.
 * Trả về mảng rỗng nếu log trống hoặc không khớp dạng nào.
 */
export function parseCompileLogErrorLines(log?: string): number[] {
  if (!log) return [];

  const lines = new Set<number>();
  for (const pattern of [FILE_LINE, TEX_LINE]) {
    // `lastIndex` phải reset vì regex dùng cờ /g và được tái sử dụng.
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(log)) !== null) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n) && n > 0) lines.add(n);
    }
  }

  return [...lines].sort((a, b) => a - b);
}
